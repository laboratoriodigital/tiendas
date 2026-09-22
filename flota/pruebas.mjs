/* Las pruebas de la flota: sin red, sin git, sin tokens.
 *   node flota/pruebas.mjs
 * Corren en cada corrida del flujo `flota` ANTES de tocar nada: una regla de
 * actualizar rota no llega a abrir un pull request. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { elegirTiendas, esPropio, decidir, ultimaEtiqueta, comparar, atrasada, cuerpoDelPR, tablaEstado } from './nucleo.mjs';
import { aplicar } from './aplicar.mjs';

const T = [];
const ok = (n, c, d) => T.push((c ? '  OK  ' : ' FALLA') + ' | ' + n + (d ? '  -> ' + d : ''));

const flota = JSON.parse(readFileSync(new URL('../flota.json', import.meta.url)));

// ═══ flota.json ═══
ok('FLOTA.JSON: cada tienda nombra una línea que existe', flota.tiendas.every(t => flota.lineas[t.linea]));
ok('  ...cada línea tiene producto, semilla y modo; las de pull request, su lista de propios',
   Object.values(flota.lineas).every(l => l.producto && /^[\w.-]+\/[\w.-]+$/.test(l.semilla) && ['montaje', 'pull-request'].includes(l.modo) &&
     (l.modo === 'montaje' ? !l.propios : l.propios.length)));
ok('  ...Panel se actualiza sola (montaje) y Básica por pull request, y no se mezclan',
   flota.lineas.tienda.modo === 'montaje' && flota.lineas.organico.modo === 'pull-request' &&
   flota.lineas.tienda.semilla !== flota.lineas.organico.semilla);
ok('  ...ninguna línea se adueña de lo que es de cada tienda (publicar/ entero, wrangler, README, release)',
   Object.values(flota.lineas).every(l => !(l.propios || []).some(p => p === 'publicar/' || p === 'wrangler.jsonc' || p === 'README.md' ||
     p === '.github/workflows/release.yml' || p === '.github/' || p === '.github/workflows/')));
ok('  ...y ningún secreto: ni tokens ni maestros', !/tk-|AKfyc|ghp_|github_pat_/.test(JSON.stringify(flota)));
ok('  ...Orgánico y Cinnamon Beauty están conectados', flota.tiendas.some(t => /organico$/.test(t.repo)) &&
   flota.tiendas.some(t => /cinnamon/.test(t.repo)));

// ═══ A quién toca ═══
const f = { tiendas: [
  { repo: 'a/semilla', linea: 'x', semilla: true }, { repo: 'a/cero', linea: 'x', anillo: 0 },
  { repo: 'a/uno', linea: 'x', anillo: 1 }, { repo: 'a/dos', linea: 'x', anillo: 2 }, { repo: 'a/otra', linea: 'y', anillo: 0 } ] };
ok('ANILLOS: «hasta el 1» es el 0 y el 1, de esa línea, nunca la semilla',
   elegirTiendas(f, 'x', 1).map(t => t.repo).join() === 'a/cero,a/uno');
ok('  ...y el 0 es solo el 0', elegirTiendas(f, 'x', '0').map(t => t.repo).join() === 'a/cero');

// ═══ La tabla ═══
ok('PROPIOS: una carpeta termina en «/» y cubre lo de dentro; un archivo es exacto',
   esPropio('montar/a.mjs', ['montar/']) && !esPropio('montarx/a', ['montar/']) && esPropio('maestro.gs', ['maestro.gs']) &&
   !esPropio('publicar/catalogo.json', ['publicar/index.html']));
ok('DECIDIR: la tienda no lo tocó → se sobrescribe', decidir('b', 'n', 'b', true) === 'sobrescribir');
ok('  ...la tienda lo cambió y la semilla no → se respeta', decidir('t', 'b', 'b', true) === 'conservar-propio');
ok('  ...los dos lo cambiaron → NO se toca', decidir('t', 'n', 'b', true) === 'desvio');
ok('  ...ya son iguales → nada', decidir('n', 'n', 'b', true) === 'nada');
ok('  ...no existe en la tienda → se agrega', decidir(null, 'n', null, true) === 'agregar');
ok('  ...la semilla no lo trae → nada (no se borra)', decidir('t', null, 'b', true) === 'nada');
ok('  ...sin saber la base → lo dice', decidir('t', 'n', null, false) === 'sobrescribir-sin-base');
ok('  ...la tienda lo creó y la semilla lo trae nuevo, distinto → no se toca', decidir('t', 'n', null, true) === 'desvio');

ok('VERSIONES: la última etiqueta es la mayor, no la última en orden alfabético',
   ultimaEtiqueta(['v3.9.0', 'v3.10.0', 'v3.6.1', 'raro']) === 'v3.10.0');
ok('  ...«atrasada» solo si las dos se entienden y la de la tienda es menor',
   atrasada('3.6.1', '3.10.0') && !atrasada('0.13.0', '0.13.0') && !atrasada('¿?', '1.0.0') && comparar('v1.2.3', '1.2.3') === 0);

// ═══ Aplicar sobre carpetas de juguete ═══
function carpeta(archivos) {
  const d = mkdtempSync(join(tmpdir(), 'flota-prueba-'));
  for (const [r, c] of Object.entries(archivos)) { mkdirSync(dirname(join(d, r)), { recursive: true }); writeFileSync(join(d, r), c); }
  return d;
}
const base = carpeta({ 'maestro.gs': 'v1', 'montar/seo.mjs': 'seo v1', 'pruebas/todas.sh': 'lista v1', 'docs/A.md': 'a',
                      'package.json': '{"name":"x","version":"1.0.0"}' });
const nueva = carpeta({ 'maestro.gs': 'v2', 'montar/seo.mjs': 'seo v2', 'pruebas/todas.sh': 'lista v1', 'docs/A.md': 'a',
                       'montar/nuevo.mjs': 'nuevo', 'publicar/index.html': 'de la semilla',
                       'package.json': '{"name":"x","version":"2.0.0"}' });
const tienda = carpeta({ 'maestro.gs': 'v1', 'montar/seo.mjs': 'seo v1 con arreglo propio', 'pruebas/todas.sh': 'lista v1 + la mía',
                        'docs/A.md': 'a', 'publicar/index.html': 'MI TIENDA', 'README.md': 'mío',
                        'package.json': '{"name":"mi-tienda","version":"1.0.0"}' });
const propios = ['maestro.gs', 'montar/', 'pruebas/', 'docs/', 'package.json'];
const i = aplicar({ tiendaDir: tienda, nuevaDir: nueva, baseDir: base, propios, version: 'v2.0.0' });
const leer = r => existsSync(join(tienda, r)) ? readFileSync(join(tienda, r), 'utf8') : null;
ok('APLICAR: lo que la tienda no tocó queda en la versión nueva', leer('maestro.gs') === 'v2' && i.sobrescritos.includes('maestro.gs'));
ok('  ...lo nuevo de la semilla llega', leer('montar/nuevo.mjs') === 'nuevo' && i.nuevos.includes('montar/nuevo.mjs'));
ok('  ...el arreglo propio que la semilla también cambió NO se pisa, y se dice',
   leer('montar/seo.mjs') === 'seo v1 con arreglo propio' && i.desvios.includes('montar/seo.mjs'));
ok('  ...lo propio que la semilla no cambió se respeta', leer('pruebas/todas.sh') === 'lista v1 + la mía' && i.propios.includes('pruebas/todas.sh'));
ok('  ...lo que no es de la semilla no se toca aunque la semilla lo traiga (publicar/, README)',
   leer('publicar/index.html') === 'MI TIENDA' && leer('README.md') === 'mío');
ok('  ...y la versión de la tienda pasa a la nueva, sin tocar su nombre',
   JSON.parse(leer('package.json')).version === '2.0.0' && JSON.parse(leer('package.json')).name === 'mi-tienda', leer('package.json'));
ok('  ...y el informe dice que hay algo que publicar', i.cambia === true);

const t2 = carpeta({ 'maestro.gs': 'v1 tocado', 'montar/seo.mjs': 'seo v1', 'package.json': '{"version":"1.0.0"}' });
const sinBase = aplicar({ tiendaDir: t2, nuevaDir: nueva, baseDir: null, propios });
ok('SIN BASE, de fábrica no se pisa nada que difiera: se lista', readFileSync(join(t2, 'maestro.gs'), 'utf8') === 'v1 tocado' &&
   sinBase.sinBaseDejados.includes('maestro.gs') && sinBase.sinBase.length === 0);
const t3 = carpeta({ 'maestro.gs': 'v1 tocado' });
const pisado = aplicar({ tiendaDir: t3, nuevaDir: nueva, baseDir: null, propios, sinBase: 'sobrescribir' });
ok('  ...y con sin_base: sobrescribir se pisa, y también se lista', readFileSync(join(t3, 'maestro.gs'), 'utf8') === 'v2' &&
   pisado.sinBase.includes('maestro.gs'));
const t4 = carpeta({ 'maestro.gs': 'v1', 'montar/seo.mjs': 'seo v1' });
const decl = aplicar({ tiendaDir: t4, nuevaDir: nueva, baseDir: base, propios, conserva: ['montar/seo.mjs'] });
ok('CONSERVA: lo declarado en flota.json como de la tienda no se toca', readFileSync(join(t4, 'montar/seo.mjs'), 'utf8') === 'seo v1' &&
   decl.conservados.includes('montar/seo.mjs'));

// ═══ Lo que se escribe para una persona ═══
const cuerpo = cuerpoDelPR({ tienda: { nombre: 'Cinnamon' }, linea: 'organico', desde: '3.6.1', hasta: 'v3.7.0', informe: i });
ok('EL PULL REQUEST dice qué NO se tocó y por qué, arriba', /No se tocaron/.test(cuerpo) && cuerpo.indexOf('montar/seo.mjs') < cuerpo.indexOf('### Lo que cambia'));
ok('  ...y los pasos que siguen: pruebas, fusionar, montaje con el maestro', /pruebas/.test(cuerpo) && /montaje/.test(cuerpo) && /maestro/.test(cuerpo));
const tabla = tablaEstado([{ nombre: 'A', linea: 'x', anillo: 1, versionRepo: '1.0.0', versionSemilla: '2.0.0', atrasada: true, maestro: '2026-09-22-1', sitio: 'https://a' },
                           { nombre: 'B | C', linea: 'x', anillo: 0, versionRepo: '2.0.0', versionSemilla: '2.0.0' }], 'hoy');
ok('EL ESTADO marca la atrasada y cuenta cuántas', /1 tienda\(s\) detrás/.test(tabla) && /1\.0\.0 ⚠/.test(tabla));
ok('  ...y un nombre con «|» no rompe la tabla', /B \\\| C/.test(tabla));

// ═══ De punta a punta, en ensayo, con repositorios de juguete ═══
{
  const { execFileSync } = await import('node:child_process');
  const origen = mkdtempSync(join(tmpdir(), 'flota-origen-'));
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe' }).toString().trim();
  const repo = (nombre, archivos) => {
    const d = join(origen, 'lab', nombre);
    mkdirSync(d, { recursive: true });
    g(d, 'init', '-q', '-b', 'main'); g(d, 'config', 'user.email', 'x@x'); g(d, 'config', 'user.name', 'x');
    for (const [r, c] of Object.entries(archivos)) { mkdirSync(dirname(join(d, r)), { recursive: true }); writeFileSync(join(d, r), c); }
    g(d, 'add', '-A'); g(d, 'commit', '-qm', 'uno');
    return d;
  };
  const s = repo('semilla', { 'maestro.gs': 'v1', 'montar/seo.mjs': 'seo v1', 'package.json': '{"version":"1.0.0"}' });
  g(s, 'tag', 'v1.0.0');
  writeFileSync(join(s, 'maestro.gs'), 'v2'); writeFileSync(join(s, 'montar/seo.mjs'), 'seo v2');
  writeFileSync(join(s, 'package.json'), '{"version":"2.0.0"}');
  g(s, 'commit', '-qam', 'dos'); g(s, 'tag', 'v2.0.0');
  writeFileSync(join(s, 'maestro.gs'), 'v3 sin publicar'); g(s, 'commit', '-qam', 'tres');
  repo('tienda', { 'maestro.gs': 'v1', 'montar/seo.mjs': 'seo arreglado en la tienda', 'package.json': '{"name":"t","version":"1.0.0"}', 'publicar/index.html': 'mía' });
  const cfg = join(origen, 'flota.json');
  writeFileSync(cfg, JSON.stringify({ lineas: { l: { semilla: 'lab/semilla', propios: ['maestro.gs', 'montar/', 'package.json'] } },
    tiendas: [{ nombre: 'Juguete', repo: 'lab/tienda', linea: 'l', anillo: 1 }] }));
  let salida = '';
  try {
    salida = execFileSync(process.execPath, [new URL('./actualizar.mjs', import.meta.url).pathname], { stdio: 'pipe',
      env: Object.assign({}, process.env, { FLOTA_TOKEN: 'ficticio', FLOTA_ORIGEN: origen, FLOTA_JSON: cfg, LINEA: 'l', ANILLO: '1',
                                            ENSAYO: 'true', GITHUB_STEP_SUMMARY: '' }) }).toString();
  } catch (e) { salida = 'FALLÓ: ' + String(e.stderr || e.message); }
  ok('DE PUNTA A PUNTA (ensayo): va a la última versión PUBLICADA, no a lo que hay en main', /semilla v2\.0\.0/.test(salida) && !/v3/.test(salida), salida.split('\n')[0]);
  ok('  ...dice que abriría un pull request, con el arreglo de la tienda sin tocar', /abriría un pull request/.test(salida) &&
     /1 sobrescritos/.test(salida) && /2 sin tocar por desvío/.test(salida) && /montar\/seo\.mjs/.test(salida), salida.replace(/\s+/g, ' ').slice(0, 200));
  ok('  ...y en ensayo no empuja nada', !g(join(origen, 'lab', 'tienda'), 'branch', '--list', 'semilla/*'));
}

// ═══ Modo montaje (Tienda Panel), en ensayo ═══
{
  const { execFileSync } = await import('node:child_process');
  const origen = mkdtempSync(join(tmpdir(), 'flota-panel-'));
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe' }).toString().trim();
  const s = join(origen, 'lab', 'panel'); mkdirSync(s, { recursive: true });
  g(s, 'init', '-q', '-b', 'main'); g(s, 'config', 'user.email', 'x@x'); g(s, 'config', 'user.name', 'x');
  writeFileSync(join(s, 'package.json'), '{"version":"0.14.0"}'); g(s, 'add', '-A'); g(s, 'commit', '-qm', '1'); g(s, 'tag', 'v0.14.0');
  const cfg = join(origen, 'flota.json');
  writeFileSync(cfg, JSON.stringify({ lineas: { p: { producto: 'Tienda Panel', modo: 'montaje', semilla: 'lab/panel' } },
    tiendas: [{ nombre: 'Dos', repo: 'lab/dos', linea: 'p', anillo: 2 }, { nombre: 'Cero', repo: 'lab/cero', linea: 'p', anillo: 0 },
              { nombre: 'Uno', repo: 'lab/uno', linea: 'p', anillo: 1 }] }));
  let salida = '';
  try {
    salida = execFileSync(process.execPath, [new URL('./actualizar.mjs', import.meta.url).pathname], { stdio: 'pipe',
      env: Object.assign({}, process.env, { FLOTA_TOKEN: 'ficticio', FLOTA_ORIGEN: origen, FLOTA_JSON: cfg, LINEA: 'p', ANILLO: '2',
                                            ENSAYO: 'true', GITHUB_STEP_SUMMARY: '', PATH: '/usr/bin:/bin' }) }).toString();
  } catch (e) { salida = 'FALLÓ: ' + String(e.stdout || '') + String(e.stderr || e.message); }
  const pos = n => salida.indexOf('**' + n + '**');
  ok('TIENDA PANEL (ensayo): dispara el montaje de cada tienda con la semilla, sin abrir pull requests',
     /dispararía su \*\*montaje\*\* con la semilla/.test(salida) && !/pull request/.test(salida), salida.replace(/\s+/g, ' ').slice(0, 160));
  ok('  ...en orden de anillos: 0, luego 1, luego 2', pos('Cero') > 0 && pos('Cero') < pos('Uno') && pos('Uno') < pos('Dos'));
  ok('  ...y el flujo espera a cada una y se detiene si falla', /run', 'watch'/.test(readFileSync(new URL('./actualizar.mjs', import.meta.url), 'utf8')) &&
     /Las siguientes no se tocan/.test(readFileSync(new URL('./actualizar.mjs', import.meta.url), 'utf8')));
}

// ═══ El alta ═══
{
  const { validar, agregar, lista, NOMBRE_VALIDO } = await import('./alta.mjs');
  const v = validar(flota, { nombre: 'cafe-la-esquina', comercio: 'Café La Esquina', linea: 'tienda' });
  ok('ALTA: un nombre bueno da el repositorio, el subdominio y el sitio', v.errores.length === 0 &&
     v.repo === 'laboratoriodigital/cafe-la-esquina' && v.sitio === 'https://cafe-la-esquina.laboratorio-digital.com', JSON.stringify(v));
  ok('  ...un nombre con mayúsculas, espacios o tildes no pasa', validar(flota, { nombre: 'Café Esquina', comercio: 'x', linea: 'tienda' }).errores.length > 0 &&
     !NOMBRE_VALIDO.test('a') && !NOMBRE_VALIDO.test('-cafe'));
  ok('  ...ni una línea que no existe, ni sin comercio', validar(flota, { nombre: 'cafe', comercio: 'x', linea: 'otra' }).errores.length === 1 &&
     validar(flota, { nombre: 'cafe', comercio: '', linea: 'tienda' }).errores.length === 1);
  ok('  ...ni un repositorio que ya está en la flota', validar(flota, { nombre: 'organico', comercio: 'x', linea: 'organico' }).errores.some(e => /Ya hay/.test(e)));
  const f2 = agregar(flota, Object.assign({ comercio: 'Café La Esquina', linea: 'tienda' }, v));
  const fila = f2.tiendas[f2.tiendas.length - 1];
  ok('  ...la fila nueva entra en el anillo 2, con su sitio, y el resto no cambia', fila.anillo === 2 && fila.sitio === v.sitio &&
     f2.tiendas.length === flota.tiendas.length + 1 && flota.tiendas.length === JSON.parse(readFileSync(new URL('../flota.json', import.meta.url))).tiendas.length);
  ok('  ...y otra con el mismo subdominio ya no pasa', validar(f2, { nombre: 'otra', comercio: 'x', linea: 'tienda', subdominio: 'cafe-la-esquina' }).errores.some(e => /subdominio/.test(e)));
  const md = lista(flota, Object.assign({ comercio: 'Café La Esquina', linea: 'tienda' }, v));
  ok('  ...y la lista de lo que falta trae los datos de ESTA tienda: Google, Cloudflare, conectar, el panel',
     /Café La Esquina/.test(md) && /Import a repository › `laboratoriodigital\/cafe-la-esquina`/.test(md) && /conectar/.test(md) && /admin\.html/.test(md) &&
     /GITHUB_TOKEN/.test(md));
  const mdB = lista(flota, Object.assign({ comercio: 'Pan', linea: 'organico' }, validar(flota, { nombre: 'pan', comercio: 'Pan', linea: 'organico' })));
  ok('  ...y a una Tienda Básica no le promete panel: la hoja es el panel', !/admin\.html/.test(mdB) && /La hoja es el panel/.test(mdB));
  const flujoAlta = readFileSync(new URL('../.github/workflows/alta.yml', import.meta.url), 'utf8');
  ok('  ...el flujo: todo automático en la tienda y el token enmascarado', /allow_auto_merge=true/.test(flujoAlta) &&
     /default_workflow_permissions=write/.test(flujoAlta) && /::add-mask::\$TK/.test(flujoAlta) && /gh workflow run montaje\.yml/.test(flujoAlta));
}

console.log(T.join('\n'));
console.log('\nResultado: ' + T.filter(x => x.startsWith('  OK')).length + '/' + T.length);
process.exit(T.every(x => x.startsWith('  OK')) ? 0 : 1);
