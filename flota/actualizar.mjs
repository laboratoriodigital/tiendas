/* ═══════════════════════════════════════════════════════════════════════════
   ACTUALIZAR LA FLOTA (S3 · versión 1: sencilla, con una persona al final)
   ---------------------------------------------------------------------------
   Para cada tienda de una línea, hasta el anillo pedido:
     1. clona la tienda y la semilla (con sus etiquetas);
     2. mira de qué versión salió la tienda (su package.json) y cuál es la
        nueva (la etiqueta pedida, o la última);
     3. aplica la semilla con la tabla de nucleo.mjs;
     4. si algo cambia, abre UN pull request en la tienda: rama
        `semilla/vX.Y.Z`, con lo que cambió y lo que NO se tocó.

   Lo que NO hace, a propósito, en esta versión:
     · no fusiona: las pruebas de la tienda corren en el pull request y una
       persona lo fusiona;
     · no publica el maestro ni rehornea: eso es el `montaje` de cada tienda,
       que ya verifica contra la tienda viva y es el único que tiene sus
       secretos;
     · no borra archivos que la semilla dejó de traer.

   Con ENSAYO=1 no empuja nada: dice qué haría. Es lo de fábrica en el flujo.

   Necesita FLOTA_TOKEN (ver README): leer las semillas, escribir en las
   tiendas —contenido, flujos y pull requests—. El token no se imprime nunca.
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { elegirTiendas, ultimaEtiqueta, version, comparar, cuerpoDelPR } from './nucleo.mjs';
import { aplicar } from './aplicar.mjs';

const TOKEN = process.env.FLOTA_TOKEN || '';
const LINEA = process.env.LINEA || 'tienda';
const ANILLO = process.env.ANILLO || '1';
const PEDIDA = (process.env.VERSION || '').trim().replace(/^v/, '');
const SIN_BASE = process.env.SIN_BASE === 'sobrescribir' ? 'sobrescribir' : 'dejar';
const ENSAYO = /^(1|true|si|sí)$/i.test(process.env.ENSAYO || '');
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
  const tiendas = elegirTiendas(flota, LINEA, ANILLO);

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

  decir(`## Flota · línea \`${LINEA}\` · hasta el anillo ${ANILLO} · semilla ${nueva}${ENSAYO ? ' · **ENSAYO: no se empuja nada**' : ''}\n`);
  if (!tiendas.length) { decir('Ninguna tienda de esta línea en esos anillos.'); return; }

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
    } catch (e) {
      fallos++;
      decir(`- **${t.nombre}**: FALLÓ — ${tapar(e).split('\n')[0]}`);
    }
  }
  if (fallos) process.exit(1);
}

main();
