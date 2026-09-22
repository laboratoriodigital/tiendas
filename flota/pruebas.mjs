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
ok('  ...cada línea tiene semilla y lista de propios', Object.values(flota.lineas).every(l => /^[\w.-]+\/[\w.-]+$/.test(l.semilla) && l.propios.length));
ok('  ...ninguna línea se adueña de lo que es de cada tienda (publicar/ entero, wrangler, README, release)',
   Object.values(flota.lineas).every(l => !l.propios.some(p => p === 'publicar/' || p === 'wrangler.jsonc' || p === 'README.md' ||
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

console.log(T.join('\n'));
console.log('\nResultado: ' + T.filter(x => x.startsWith('  OK')).length + '/' + T.length);
process.exit(T.every(x => x.startsWith('  OK')) ? 0 : 1);
