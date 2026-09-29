/* ═══════════════════════════════════════════════════════════════════════════
   ACTUALIZAR LA FLOTA (S3 · versión 2: automática)
   ---------------------------------------------------------------------------
   DOS MODOS, según la línea (flota.json › lineas › modo):

   `montaje` — Tienda Panel (semilla `tienda`, 0.14.0 en adelante). La tienda
     SABE actualizarse: su flujo `montaje` con `semilla: true` trae la versión
     nueva, publica el maestro, rehornea, corre TODAS las baterías y publica en
     main, o vuelve atrás solo. La flota solo lo dispara, por anillos, y espera
     a que cada una termine antes de seguir: si una falla, las de los anillos
     siguientes no se tocan. Es el mismo botón que el dueño tiene en su panel.

   `pull-request` — Tienda Básica (semilla `organico`, 3.x), que todavía no
     sabe actualizarse sola. La flota hace el trabajo desde fuera:
       1. clona la tienda y la semilla (con sus etiquetas);
       2. aplica la versión nueva con la tabla de nucleo.mjs;
       3. abre UN pull request, espera las pruebas de la tienda, lo FUSIONA
          solo y dispara su montaje (con el maestro si cambió).
     Con UNA excepción, a propósito: si cambia `publicar/index.html`, entre la
     fusión y el montaje la tienda serviría el index de la SEMILLA —otro
     nombre, otro WhatsApp— unos minutos. Ese pull request se queda abierto y
     lo dice. Se acaba cuando la Básica aprenda a actualizarse sola.

   Para cada tienda de una línea `pull-request`, hasta el anillo pedido:
     1. clona la tienda y la semilla (con sus etiquetas);
     2. mira de qué versión salió la tienda (su package.json) y cuál es la
        nueva (la etiqueta pedida, o la última);
     3. aplica la semilla con la tabla de nucleo.mjs;
     4. si algo cambia, abre UN pull request en la tienda: rama
        `semilla/vX.Y.Z`, con lo que cambió y lo que NO se tocó.

   Lo que NO hace: rehornear desde aquí (no tiene los secretos de ninguna
   tienda: eso es su `montaje`), ni borrar archivos que la semilla dejó de
   traer.

   Con ENSAYO=1 no empuja nada: dice qué haría. Es lo de fábrica en el flujo.

   Necesita FLOTA_TOKEN (ver README): leer las semillas, escribir en las
   tiendas —contenido, flujos y pull requests—. El token no se imprime nunca.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFileSync, mkdtempSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { elegirTiendas, laPedida, ultimaEtiqueta, version, comparar, cuerpoDelPR } from './nucleo.mjs';
import { entregar, cliente } from './flujos.mjs';
import { aplicar } from './aplicar.mjs';

const TOKEN = process.env.FLOTA_TOKEN || '';
const LINEA = process.env.LINEA || 'tienda';
const ANILLO = process.env.ANILLO || '1';
const PEDIDA = (process.env.VERSION || '').trim().replace(/^v/, '');
const SIN_BASE = process.env.SIN_BASE === 'sobrescribir' ? 'sobrescribir' : 'dejar';
const ENSAYO = /^(1|true|si|sí)$/i.test(process.env.ENSAYO || '');
const SOLO = (process.env.TIENDA || '').trim().toLowerCase();     // una sola tienda (dueño/repo), opcional
const RESUMEN = process.env.GITHUB_STEP_SUMMARY || '';

const decir = (t) => { console.log(t); if (RESUMEN) appendFileSync(RESUMEN, t + '\n'); };
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
/* FLOTA_ORIGEN solo lo usan las pruebas: repositorios de juguete en disco. */
const ORIGEN = process.env.FLOTA_ORIGEN || '';
const url = (repo) => ORIGEN ? join(ORIGEN, repo) : `https://x-access-token:${TOKEN}@github.com/${repo}.git`;
const tapar = (e) => String(e && (e.stderr || e.message) || e).split(TOKEN || '\u0000').join('***');

function clonar(repo, destino, completo) {
  const a = ['clone', '--quiet'];
  if (!completo) a.push('--depth', '1');
  a.push(url(repo), destino);
  execFileSync('git', a, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function versionDe(dir) {
  try { return String(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version || ''); } catch { return ''; }
}

function main() {
  if (!TOKEN) { decir('### Falta el secreto `FLOTA_TOKEN`\n\nVer el README de este repositorio.'); process.exit(1); }
  const flota = JSON.parse(readFileSync(process.env.FLOTA_JSON || 'flota.json', 'utf8'));
  const linea = (flota.lineas || {})[LINEA];
  if (!linea) { decir(`### No hay una línea «${LINEA}» en flota.json`); process.exit(1); }
  const delAnillo = elegirTiendas(flota, LINEA, ANILLO);
  const pedida = laPedida(delAnillo, SOLO);
  const tiendas = pedida.tiendas;

  const trabajo = mkdtempSync(join(tmpdir(), 'flota-'));
  const semilla = join(trabajo, 'semilla');
  clonar(linea.semilla, semilla, true);
  const etiquetas = git(semilla, 'tag', '-l', 'v*').split('\n').filter(Boolean);
  const nueva = PEDIDA ? 'v' + PEDIDA : ultimaEtiqueta(etiquetas);
  if (!nueva || etiquetas.indexOf(nueva) === -1) {
    decir(`### La semilla ${linea.semilla} no tiene la etiqueta ${nueva || '(ninguna)'}\n\nSe actualiza a versiones publicadas con **release**, no a lo que haya en main.`);
    process.exit(1);
  }
  const nuevaDir = join(trabajo, 'nueva');
  git(semilla, 'worktree', 'add', '--quiet', '--detach', nuevaDir, nueva);

  decir(`## Flota · ${linea.producto || LINEA} (\`${LINEA}\`) · hasta el anillo ${ANILLO} · semilla ${nueva}${ENSAYO ? ' · **ENSAYO: no se toca nada**' : ''}\n`);
  if (!tiendas.length) {
    decir(pedida.error ||
      'Ninguna tienda de esta línea en esos anillos. Las de esta línea, con su anillo, están en `flota.json`.');
    return;
  }
  if (linea.modo === 'montaje') return porMontaje(tiendas, nueva, linea.semilla);

  let fallos = 0;
  for (const t of tiendas) {
    try {
      const dir = join(trabajo, 't-' + t.repo.replace(/\W+/g, '-'));
      clonar(t.repo, dir, false);
      const desde = versionDe(dir);
      if (version(desde) && comparar(desde, nueva) >= 0) { decir(`- **${t.nombre}**: ya está en ${desde}. Nada que hacer.`); continue; }
      const rama = 'semilla/' + nueva;
      if (git(dir, 'ls-remote', '--heads', 'origin', rama)) {
        decir(`- **${t.nombre}**: ya tiene la rama \`${rama}\` (un pull request abierto). No se abre otro.`); continue;
      }
      const base = desde ? 'v' + desde.replace(/^v/, '') : '';
      let baseDir = null;
      if (base && etiquetas.indexOf(base) !== -1) {
        baseDir = join(trabajo, 'base-' + base);
        if (!existsSync(baseDir)) git(semilla, 'worktree', 'add', '--quiet', '--detach', baseDir, base);
      }
      const informe = aplicar({ tiendaDir: dir, nuevaDir, baseDir, propios: linea.propios, conserva: t.conserva || [], sinBase: SIN_BASE, version: nueva });
      const linea1 = `${informe.sobrescritos.length + informe.sinBase.length} sobrescritos, ${informe.nuevos.length} nuevos, ` +
                     `${informe.propios.length} propios respetados, ${informe.desvios.length} sin tocar por desvío` +
                     (informe.sinBaseDejados.length ? `, ${informe.sinBaseDejados.length} sin tocar por no saber la base` : '');
      if (!informe.cambia) { decir(`- **${t.nombre}** (${desde || '?'}): nada que cambiar (${linea1}).`); continue; }
      const cuerpo = cuerpoDelPR({ tienda: t, linea: LINEA, desde, hasta: nueva, informe });
      if (ENSAYO) {
        decir(`- **${t.nombre}** (${desde || '?'} → ${nueva}): abriría un pull request. ${linea1}.`);
        decir('\n<details><summary>El pull request que abriría</summary>\n\n' + cuerpo + '\n\n</details>\n');
        continue;
      }
      git(dir, 'config', 'user.name', 'flota');
      git(dir, 'config', 'user.email', 'noreply@github.com');
      git(dir, 'switch', '--quiet', '-c', rama);
      git(dir, 'add', '-A');
      git(dir, 'commit', '--quiet', '-m', `chore/flota: semilla ${LINEA} ${nueva}`, '-m', linea1);
      git(dir, 'push', '--quiet', 'origin', rama);
      const cuerpoArchivo = join(trabajo, 'cuerpo.md');
      writeFileSync(cuerpoArchivo, cuerpo);
      const pr = execFileSync('gh', ['pr', 'create', '--repo', t.repo, '--base', 'main', '--head', rama,
        '--title', `Semilla ${LINEA} ${nueva}`, '--body-file', cuerpoArchivo],
        { env: Object.assign({}, process.env, { GH_TOKEN: TOKEN }), stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
      decir(`- **${t.nombre}** (${desde || '?'} → ${nueva}): pull request abierto: ${pr}. ${linea1}.`);
      /* AUTOMÁTICO, salvo el index de la semilla (ver arriba). */
      const escritos = [...informe.sobrescritos, ...informe.sinBase, ...informe.nuevos];
      if (escritos.includes('publicar/index.html')) {
        decir('  - ⚠ **Se queda abierto**: trae `publicar/index.html`. Fusionarlo antes del montaje dejaría la tienda unos minutos con el index de la semilla. Corre su **montaje** sobre esta rama o fusiónalo y corre el montaje enseguida.');
        continue;
      }
      const gh = (...a) => execFileSync('gh', a, { env: Object.assign({}, process.env, { GH_TOKEN: TOKEN }), stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
      /* Las pruebas de la tienda arrancan con el pull request (lo abrió un
         token personal, así que sí disparan). Se les da un momento para
         aparecer y se espera a que terminen. */
      execFileSync('sleep', ['30']);
      try { gh('pr', 'checks', pr, '--repo', t.repo, '--watch', '--fail-fast'); }
      catch (e) { decir(`  - ✗ Las pruebas de la tienda no pasaron: **no se fusiona**. ${pr}`); fallos++; continue; }
      gh('pr', 'merge', pr, '--repo', t.repo, '--squash', '--delete-branch');
      const conMaestro = escritos.includes('maestro.gs');
      gh('workflow', 'run', 'montaje.yml', '--repo', t.repo, '-f', 'que=todo', '-f', 'aprobacion=automatica',
         ...(conMaestro ? ['-f', 'maestro=true', '-f', 'confirmar=PUBLICAR'] : []));
      decir(`  - ✓ Pruebas en verde, fusionado, y su **montaje** disparado${conMaestro ? ' con el maestro' : ''}.`);
    } catch (e) {
      fallos++;
      decir(`- **${t.nombre}**: FALLÓ — ${tapar(e).split('\n')[0]}`);
    }
  }
  if (fallos) process.exit(1);
}

/* 0.21.1 · UNA TIENDA QUE YA NO EXISTE NO PARA A LA FLOTA (bitácora 100).
   `flota.json` lo edita una persona, así que una tienda de prueba borrada en
   GitHub se queda en la lista. La actualización se detenía en ella —«no pude
   leer su versión. Me detengo aquí»— y las demás no recibían nada: una lista
   vieja bloqueaba el reparto de una versión que estaba bien.

   Una tienda que NO ESTÁ no es un fallo de la versión que se reparte: es un
   dato viejo. Se dice, se salta, y al final se recuerda qué hay que arreglar.
   Lo que sí sigue deteniendo la flota es una tienda que está y falla: para eso
   son los anillos. */
export function esQueNoExiste(e) {
  const t = String((e && (e.stderr || e.message)) || e || '');
  return /HTTP 404|Not Found|404: Not Found/i.test(t);
}

export function textoDeLasQueNoEstan(nombres) {
  if (!nombres.length) return '';
  return '\n**Ojo: ' + (nombres.length === 1 ? 'una tienda de la lista ya no está' :
         nombres.length + ' tiendas de la lista ya no están') + ' en GitHub** (' +
         nombres.map(n => '`' + n + '`').join(', ') + '). No se las saltó por un fallo: ' +
         'GitHub contesta 404, que es «no existe» o «este permiso no la incluye». ' +
         'Quítalas de `flota.json` —o amplía el permiso— para que dejen de aparecer.';
}

/* ── Modo `montaje`: la tienda se actualiza sola; la flota la dispara y espera ── */
function porMontaje(tiendas, nueva, semillaDeLaLinea) {
  const gh = (...a) => execFileSync('gh', a, { env: Object.assign({}, process.env, { GH_TOKEN: TOKEN }), stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const orden = [...tiendas].sort((a, b) => Number(a.anillo) - Number(b.anillo));
  const noEstan = [];
  for (const t of orden) {
    let desde = '';
    try { desde = JSON.parse(Buffer.from(JSON.parse(gh('api', `repos/${t.repo}/contents/package.json`)).content, 'base64').toString()).version || ''; }
    catch (e) {
      if (esQueNoExiste(e)) {
        noEstan.push(t.nombre);
        decir(`- **${t.nombre}**: no está en GitHub (404). La salto y sigo con las demás.`);
        continue;
      }
      if (!ENSAYO) { decir(`- **${t.nombre}**: no pude leer su versión — ${tapar(e).split('\n')[0]}. **Me detengo** aquí.`); process.exit(1); }
    }
    if (version(desde) && comparar(desde, nueva) >= 0) { decir(`- **${t.nombre}** (anillo ${t.anillo}): ya está en ${desde}.`); continue; }
    if (ENSAYO) { decir(`- **${t.nombre}** (anillo ${t.anillo}, ${desde || '?'} → ${nueva}): dispararía su **montaje** con la semilla.`); continue; }
    const antes = Date.now();
    gh('workflow', 'run', 'montaje.yml', '--repo', t.repo, '-f', 'semilla=true', '-f', 'que=todo', '-f', 'version=' + nueva.replace(/^v/, ''));
    /* Se espera a que termine: si una tienda falla, las siguientes no se tocan.
       Es lo que hace útiles a los anillos. */
    let corrida = null;
    for (let i = 0; i < 12 && !corrida; i++) {
      execFileSync('sleep', ['10']);
      const rs = JSON.parse(gh('run', 'list', '--repo', t.repo, '--workflow', 'montaje.yml', '--event', 'workflow_dispatch', '--limit', '1',
                               '--json', 'databaseId,createdAt,url'));
      if (rs[0] && Date.parse(rs[0].createdAt) >= antes - 60000) corrida = rs[0];
    }
    if (!corrida) { decir(`- **${t.nombre}**: el montaje no arrancó. **Me detengo** aquí.`); process.exit(1); }
    let bien = true;
    try { gh('run', 'watch', String(corrida.databaseId), '--repo', t.repo, '--exit-status', '--interval', '30'); } catch (e) { bien = false; }
    if (!bien) {
      decir(`- **${t.nombre}** (${desde || '?'} → ${nueva}): ✗ su montaje falló (${corrida.url}). La tienda quedó como estaba —el montaje vuelve atrás solo—. **Las siguientes no se tocan.**`);
      /* Flota · Y CÓMO SEGUIR (bitácora 105). Detenerse es lo correcto: para
         eso son los anillos. Pero quien lo lee tiene que saber qué hacer si esa
         tienda no importa, sin ir a buscarlo a la documentación. */
      const siguientes = orden.slice(orden.indexOf(t) + 1).map(x => '`' + x.nombre + '`');
      if (siguientes.length) {
        decir(`\n  Quedaron sin tocar: ${siguientes.join(', ')}. Si **${t.nombre}** no importa ahora, dos caminos: ` +
              `correr esto otra vez con **solo esta tienda** = el nombre de la que sí, o sacarla del reparto ` +
              `en \`flota.json\` con \`"anillo": "fuera"\` —sigue en la lista y en el estado, pero ningún reparto la toca—.`);
      }
      process.exit(1);
    }
    decir(`- **${t.nombre}** (${desde || '?'} → ${nueva}): ✓ actualizada (${corrida.url}).`);
    /* 0.22.1 · Y SUS FLUJOS, QUE LA TIENDA NO PUEDE PONERSE SOLA (bitácora
       103). Después y no antes: si el montaje falla, la tienda se queda entera
       en la versión de antes, flujos incluidos. */
    if (!ENSAYO) try {
      const h = entregar(cliente(TOKEN), { semilla: semillaDeLaLinea, etiqueta: nueva, tienda: t.repo, ensayo: false });
      decir(h.escritos.length ? `  - y sus flujos: ${h.escritos.map(x => '`' + x.split('/').pop() + '`').join(', ')}.`
                              : '  - sus flujos ya estaban al día.');
    } catch (e) {
      decir(`  - ⚠ sus flujos no se pudieron poner (${tapar(e).split('\n')[0]}). Se puede repetir con **flota › flujos**.`);
    }
  }
  /* Lo que hay que arreglar, al final y una sola vez: si se dijera tienda por
     tienda, en una flota con tres borradas serían tres avisos iguales. */
  if (noEstan.length) decir(textoDeLasQueNoEstan(noEstan));
  /* Y si NINGUNA de las que se pidió existe, la corrida no hizo nada: eso sí es
     rojo, porque alguien pidió repartir una versión y no se repartió a nadie. */
  if (noEstan.length === orden.length) {
    decir('\n**No se actualizó ninguna tienda**: todas las de esta línea y este anillo están en esa lista.');
    process.exit(1);
  }
}

/* 0.21.1 · SE EJECUTA CUANDO SE LANZA, NO CUANDO SE IMPORTA. Llamarlo suelto
   convertía un `import` en una corrida: la batería que quería comprobar una
   función de aquí arrancaba la actualización de la flota entera y moría por
   falta de FLOTA_TOKEN. Es el mismo remate que llevan las demás herramientas. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
