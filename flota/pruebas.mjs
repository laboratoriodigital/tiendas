/* Las pruebas de la flota: sin red, sin git, sin tokens.
 *   node flota/pruebas.mjs
 * Corren en cada corrida del flujo `flota` ANTES de tocar nada: una regla de
 * actualizar rota no llega a abrir un pull request. */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
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
  ok('  ...y otra con la misma dirección ya no pasa', validar(Object.assign({}, f2, { tiendas: f2.tiendas.map(t => t.sitio === v.sitio ? Object.assign({}, t, { repo: 'x/otro' }) : t) }), { nombre: 'cafe-la-esquina', comercio: 'x', linea: 'tienda' }).errores.some(e => /dirección/.test(e)));
  const md = lista(flota, Object.assign({ comercio: 'Café La Esquina', linea: 'tienda' }, v));
  ok('  ...y la lista de lo que falta trae los datos de ESTA tienda: Google, Cloudflare, conectar, el panel',
     /Café La Esquina/.test(md) && /Import a\s+repository › `laboratoriodigital\/cafe-la-esquina`/.test(md) && /conectar/.test(md) && /admin\.html/.test(md) &&
     /actions\/workflows\/conectar\.yml/.test(md));
  ok('  ...y a mano solo queda CLASPRC (el token lo da diagnosticoCompleto, no el menú)',
     /Lo único que queda a mano: `CLASPRC`/.test(md) && /diagnosticoCompleto/.test(md) && !/Propiedades del script del maestro como `GITHUB_TOKEN`/.test(md));
  const mdB = lista(flota, Object.assign({ comercio: 'Pan', linea: 'organico' }, validar(flota, { nombre: 'pan', comercio: 'Pan', linea: 'organico' })));
  ok('  ...y a una Tienda Básica no le promete panel: la hoja es el panel', !/admin\.html/.test(mdB) && /La hoja es el panel/.test(mdB));
  ok('  ...y en la lista Cloudflare va DESPUÉS de conectar: conectado antes, publicaría lo que no es esta tienda',
     md.indexOf('**2. Conectar**') > 0 && md.indexOf('**2. Conectar**') < md.indexOf('**3. Cloudflare**'));

  // 0.15.0 · el formulario pide lo mínimo
  const campos = t => [...t.matchAll(/^      ([a-z_]+):\n\s+description:/gm)].map(m => m[1]);
  const flujoAlta = readFileSync(new URL('../.github/workflows/alta.yml', import.meta.url), 'utf8');
  const flujoCon = readFileSync(new URL('../.github/workflows/conectar.yml', import.meta.url), 'utf8');
  ok('EL ALTA PIDE TRES COSAS: el nombre, el comercio y el producto', campos(flujoAlta).join() === 'nombre,comercio,producto', campos(flujoAlta).join());
  /* 0.20.2 · Las tres obligatorias son las del Diagnóstico; la cuarta es una
     casilla opcional (forzar el permiso) y va AL FINAL, R1. */
  ok('  ...y conectar, las tres que da el Diagnóstico de la hoja',
     campos(flujoCon).slice(0, 3).join() === 'nombre,maestro_url,maestro_token' &&
     campos(flujoCon).join() === 'nombre,maestro_url,maestro_token,forzar_permiso', campos(flujoCon).join());
  ok('  ...el alta CLONA la última etiqueta de la semilla (no necesita «Template repository») y comprueba antes el token',
     /git clone --quiet --depth 1 --branch "\$ETIQUETA"/.test(flujoAlta) && !/\/generate/.test(flujoAlta) &&
     /ALTA_TOKEN no ve la semilla/.test(flujoAlta) && flujoAlta.indexOf('ALTA_TOKEN no ve la semilla') < flujoAlta.indexOf('gh repo create'));
  ok('  ...todo automático en la tienda', /allow_auto_merge=true/.test(flujoAlta) && /default_workflow_permissions=write/.test(flujoAlta));
  ok('  ...conectar tapa el token sin meterlo en el guion, y dispara el primer montaje',
     /TK: \$\{\{ inputs\.maestro_token \}\}\n\s+run: echo "::add-mask::\$TK"/.test(flujoCon) && !/run: echo "::add-mask::\$\{\{/.test(flujoCon) &&
     /gh workflow run montaje\.yml/.test(flujoCon) && /HOJA_ID/.test(flujoCon) && /SCRIPT_ID/.test(flujoCon));

  // preparar: la semilla limpia
  const { preparar, NO_SE_HEREDA } = await import('./alta.mjs');
  const d = carpeta({ 'plantilla/index.html': 'PLANTILLA', 'plantilla/admin.html': 'PANEL EN BLANCO', 'publicar/index.html': 'LA TIENDA DE LA SEMILLA',
    'publicar/catalogo.json': '{}', 'publicar/fotos/pan.webp': 'x', 'publicar/productos/pan/index.html': 'x', 'publicar/compartir.jpg': 'x',
    'publicar/_headers': 'h', '.github/workflows/release.yml': 'r', '.github/workflows/montaje.yml': 'm', 'tienda.json': '{"token":"tk-x"}',
    'Claude outputs/nota.md': 'n', 'README.md': 'la semilla', 'maestro.gs': 'm',
    'wrangler.jsonc': '{\n  "name": "tienda-laboratorio",\n  "assets": {"directory": "./publicar"},\n  "routes": [{ "pattern": "tienda.laboratorio-digital.com", "custom_domain": true }]\n}' });
  preparar(d, { nombre: 'cafe-la-esquina', comercio: 'Café La Esquina', linea: 'tienda', producto: 'Tienda Panel', semilla: 'laboratoriodigital/tienda', etiqueta: 'v0.15.0' });
  const hay = r => existsSync(join(d, r));
  const lee = r => readFileSync(join(d, r), 'utf8');
  ok('PREPARAR: no hereda el catálogo, las fotos, las fichas ni la imagen de la semilla', !hay('publicar/catalogo.json') && !hay('publicar/fotos') &&
     !hay('publicar/productos') && !hay('publicar/compartir.jpg') && hay('publicar/_headers'));
  ok('  ...ni lo que es solo de la semilla (release, notas, tienda.json con su token)', !hay('.github/workflows/release.yml') && !hay('Claude outputs') &&
     !hay('tienda.json') && hay('.github/workflows/montaje.yml') && hay('maestro.gs'));
  ok('  ...lo publicado de la Panel nace de la plantilla, en blanco', lee('publicar/index.html') === 'PLANTILLA' && lee('publicar/admin.html') === 'PANEL EN BLANCO');
  ok('  ...con su propio nombre de sitio y SIN el dominio de la semilla', /"name": "cafe-la-esquina"/.test(lee('wrangler.jsonc')) &&
     !/laboratorio-digital\.com|routes/.test(lee('wrangler.jsonc')), lee('wrangler.jsonc'));
  ok('  ...y su README dice de dónde y en qué versión nació', /Café La Esquina/.test(lee('README.md')) && /v0\.15\.0/.test(lee('README.md')));
}

// ═══ Conectar ═══
{
  const { laFila, problemaDeIdentidad, sembrado, URL_VALIDA } = await import('./conectar.mjs');
  const f3 = { tiendas: [{ nombre: 'Café La Esquina', repo: 'laboratoriodigital/cafe-la-esquina', linea: 'tienda', anillo: 2, sitio: 'https://cafe-la-esquina.laboratorio-digital.com' }] };
  const fila = laFila(f3, 'Cafe-La-Esquina');
  ok('CONECTAR: encuentra la tienda por su nombre corto', fila && fila.repo === 'laboratoriodigital/cafe-la-esquina');
  ok('  ...y solo acepta la URL /exec del maestro', URL_VALIDA.test('https://script.google.com/macros/s/AKfy-cb_x1/exec') &&
     !URL_VALIDA.test('https://script.google.com/macros/s/AKfy/dev') && !URL_VALIDA.test('https://evil.example/exec'));
  const bien = { ok: true, hojaOk: true, hojaId: 'h1', scriptId: 's1', repositorio: '', _esperado: fila.repo };
  ok('  ...con la identidad del maestro saca la hoja y el proyecto', problemaDeIdentidad(bien) === null);
  ok('  ...pero no conecta un maestro que no abre su hoja, ni con un token que no es el suyo',
     /no abre su hoja/.test(problemaDeIdentidad(Object.assign({}, bien, { hojaOk: false }))) &&
     /dijo que no/.test(problemaDeIdentidad({ ok: false, error: 'Token que no corresponde' })));
  ok('  ...ni la hoja de OTRA tienda', /otra tienda/.test(problemaDeIdentidad(Object.assign({}, bien, { repositorio: 'laboratoriodigital/organico' }))));
  {
    const { herramientasQueFaltan } = await import('./alta.mjs');
    const base = mkdtempSync(join(tmpdir(), 'herr-'));
    mkdirSync(join(base, '.github', 'workflows'), { recursive: true });
    mkdirSync(join(base, 'montar'), { recursive: true });
    writeFileSync(join(base, '.github', 'workflows', 'montaje.yml'),
      'run: |\n  node montar/preparar-index.mjs --desde\n  node montar/tiempos.mjs || estado=$?\n');
    writeFileSync(join(base, 'montar', 'preparar-index.mjs'), '// ahí está');
    ok('EL ALTA no entrega una tienda cuyo flujo llame a algo que no trae (0.20.3)',
       herramientasQueFaltan(base).join() === 'montar/tiempos.mjs', herramientasQueFaltan(base).join());
    writeFileSync(join(base, 'montar', 'tiempos.mjs'), '// y ahora también');
    ok('  ...y con todas presentes no se queja', herramientasQueFaltan(base).length === 0);
  }
  const sem = sembrado(fila);
  const { textoDelPermiso } = await import('./conectar.mjs');
  ok('  ...le pone al maestro su permiso de GitHub, y dice qué pasó en cada caso',
     /puesto/.test(textoDelPermiso({ ok: true, puesto: true }, true)) && /no se tocó \(marca/.test(textoDelPermiso({ ok: true, puesto: false, yaEstaba: true }, true)) &&
     /DISPARO_TOKEN/.test(textoDelPermiso(null, false)) && /a mano/.test(textoDelPermiso({ ok: false, error: 'Acción desconocida: permiso' }, true)));
  ok('  ...y si el que tenía ya no servía, dice que lo reemplazó (0.20.2)',
     /ya no servía/.test(textoDelPermiso({ ok: true, puesto: true, reemplazado: true }, true)) &&
     /exactamente este/.test(textoDelPermiso({ ok: true, puesto: false, mismo: true }, true)) &&
     /sigue sirviendo/.test(textoDelPermiso({ ok: true, puesto: false, yaEstaba: true }, true)) &&
     /forzar_permiso/.test(readFileSync(new URL('../.github/workflows/conectar.yml', import.meta.url), 'utf8')));
  const flujoC = readFileSync(new URL('../.github/workflows/conectar.yml', import.meta.url), 'utf8');
  ok('  ...con DISPARO_TOKEN, que solo pide Actions, y por POST', /DISPARO_TOKEN: \$\{\{ secrets\.DISPARO_TOKEN \}\}/.test(flujoC) &&
     /method: 'POST'/.test(readFileSync(new URL('./conectar.mjs', import.meta.url), 'utf8')));
  ok('  ...«falta HOJA_ID» con diagnóstico bueno: dice que es la versión implementada, y cómo salir',
     /Nueva versión/.test(problemaDeIdentidad(Object.assign({}, bien, { hojaOk: false, problema: 'Falta HOJA_ID: pega el ID' }))) &&
     /A0_instalar/.test(problemaDeIdentidad(Object.assign({}, bien, { hojaOk: false, problema: 'Falta HOJA_ID' }))) &&
     !/Nueva versión/.test(problemaDeIdentidad(Object.assign({}, bien, { hojaOk: false, problema: 'No tienes permiso' }))));
  const { textoDelAlcance } = await import('./conectar.mjs');
  ok('  ...y comprueba que ESE token vea ESTE repositorio, antes de sembrarlo',
     textoDelAlcance({ ok: true }, 'lab/x') === '' &&
     /Only select repositories/.test(textoDelAlcance({ ok: false, codigo: 404 }, 'lab/x')) &&
     /vencido/.test(textoDelAlcance({ ok: false, codigo: 401 }, 'lab/x')),
     textoDelAlcance({ ok: false, codigo: 404 }, 'lab/x').slice(0, 70));
  const { registroParaElPanel, textoDelPanel } = await import('./conectar.mjs');
  const rp = registroParaElPanel({ lineas: { tienda: { producto: 'Tienda Panel' } } }, Object.assign({}, fila, { linea: 'tienda' }),
                                 'https://script.google.com/macros/s/AKfy/exec', 'tk-1', 'alta-x');
  ok('  ...y avisa a la hoja de administración con lo que ella necesita (y su clave)',
     rp.a === 'registrar_tienda' && rp.clave === 'alta-x' && rp.repo === fila.repo && rp.comercio === fila.nombre &&
     rp.producto === 'Tienda Panel' && rp.token === 'tk-1' && rp.servicio.endsWith('/exec'));
  ok('  ...con su anillo, para que el portal no obligue a abrir flota.json',
     registroParaElPanel({ lineas: {} }, Object.assign({}, fila, { anillo: 2 }), 'u', 't', 'c').anillo === '2' &&
     registroParaElPanel({ lineas: {} }, { nombre: 'x', repo: 'a/b' }, 'u', 't', 'c').anillo === '');
  ok('  ...diciendo qué pasó, y sin secretos no lo intenta',
     /PANEL_URL/.test(textoDelPanel(null, false)) && /registrada/.test(textoDelPanel({ ok: true, nueva: true, fila: 5 }, true)) &&
     /servicio y su token/.test(textoDelPanel({ ok: true, nueva: false, fila: 5 }, true)) && /a mano/.test(textoDelPanel({ ok: false, error: 'Clave' }, true)) &&
     /PANEL_CLAVE: \$\{\{ secrets\.PANEL_CLAVE \}\}/.test(flujoC) && /PANEL_URL: \$\{\{ secrets\.PANEL_URL \}\}/.test(flujoC));
  ok('  ...y le escribe a la hoja el comercio, la dirección y el repositorio', sem.negocio === 'Café La Esquina' &&
     sem.sitio_url === fila.sitio && sem.repositorio === fila.repo);
}

// ═══ El panel de la flota ═══
{
  const { panelHtml } = await import('./panel.mjs');
  const h = panelHtml([
    { nombre: 'Laboratorio Digital (semilla)', repo: 'laboratoriodigital/tienda', linea: 'Tienda Panel', semilla: true, versionRepo: '0.15.0', versionSemilla: '0.15.0', maestro: '2026-09-22-3' },
    { nombre: 'Cinnamon <b>', repo: 'laboratoriodigital/tienda_cinnamonbeauty', linea: 'Tienda Básica', anillo: 1, versionRepo: '3.6.1', versionSemilla: '3.7.0', atrasada: true, maestro: 'no contesta', prNumero: 7, prUrl: 'https://github.com/x/y/pull/7' }
  ], 'hoy', { dueno: 'laboratoriodigital', servicio: 'laboratoriodigital/tiendas' });
  ok('EL PANEL DE LA FLOTA: una tabla por producto, con cada tienda', /<h2>Tienda Panel<\/h2>/.test(h) && /<h2>Tienda Básica<\/h2>/.test(h) &&
     /laboratoriodigital\/tienda_cinnamonbeauty/.test(h));
  ok('  ...dice cuál está atrasada y cuál no contesta', /Detrás de su semilla/.test(h) && /1 tienda\(s\) detrás/.test(h) && /#7/.test(h));
  ok('  ...escapa lo que viene de fuera', /Cinnamon &lt;b&gt;/.test(h) && !/Cinnamon <b>/.test(h));
  ok('  ...no pide nada al abrirse: ni scripts, ni fuentes, ni hojas de estilo de fuera', !/<script|<link|@import|url\(/i.test(h));
  {
    const flujoF = readFileSync(new URL('../.github/workflows/flota.yml', import.meta.url), 'utf8');
    ok('EL PANEL SE PUBLICA SOLO si hay token de Cloudflare, y si no, lo dice y sigue',
       /wrangler@4 deploy/.test(flujoF) && /CLOUDFLARE_API_TOKEN/.test(flujoF) &&
       /CLOUDFLARE_ACCOUNT_ID/.test(flujoF) && /exit 0/.test(flujoF) &&
       /Access/.test(flujoF));
    const w = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'));
    ok('  ...lo que publica es la carpeta del panel, y nada más',
       w.assets && w.assets.directory === './panel' && !w.main,
       JSON.stringify(w.assets));
  }
  {
    const { laPedida } = await import('./nucleo.mjs');
    const lista = [{ repo: 'lab/prueba1', nombre: 'prueba1', anillo: 2 },
                   { repo: 'lab/cafe', nombre: 'Café', anillo: 1 }];
    ok('«SOLO ESTA TIENDA» se entiende por el nombre corto, no solo por dueño/repositorio',
       laPedida(lista, 'prueba1').tiendas.length === 1 &&
       laPedida(lista, 'LAB/Prueba1').tiendas.length === 1 &&
       laPedida(lista, '').tiendas.length === 2);
    ok('  ...y si no existe, lo dice con la lista y el anillo de las que sí',
       /No hay ninguna tienda/.test(laPedida(lista, 'prueba9').error) &&
       /anillo 2/.test(laPedida(lista, 'prueba9').error),
       laPedida(lista, 'prueba9').error.slice(0, 80));
  }
  ok('  ...y cada tienda lleva a su «volver atrás» (0.18.0)',
     (h.match(/workflows\/restaurar\.yml/g) || []).length >= 2);
  ok('  ...y lleva a las acciones: nueva tienda, conectar, actualizar',
     /actions\/workflows\/alta\.yml/.test(h) && /actions\/workflows\/conectar\.yml/.test(h) && /actions\/workflows\/flota\.yml/.test(h) && /noindex/.test(h));
}

/* ═══ UNA TIENDA PUEDE ESTAR FUERA DEL REPARTO (Flota · bitácora 105) ═══
   Una tienda de prueba abandonada en el anillo 2 era la primera en la cola: su
   montaje fallaba y, como debe ser, las siguientes no se tocaban —entre ellas
   la que sí importaba—. `"anillo": "fuera"` la deja en la lista y fuera de
   todo reparto. */
{
  const { enReparto, elegirTiendas } = await import('./nucleo.mjs');
  const fl = { tiendas: [
    { nombre: 'vieja', linea: 'tienda', anillo: 'fuera' },
    { nombre: 'buena', linea: 'tienda', anillo: 2 },
    { nombre: 'sin', linea: 'tienda' },
    { nombre: 'uno', linea: 'tienda', anillo: '1' }] };
  ok('UNA TIENDA «fuera» no la toca ningún reparto, y las demás sí',
     elegirTiendas(fl, 'tienda', 2).map(t => t.nombre).join() === 'buena,uno' &&
     enReparto({ anillo: 'fuera' }) === false && enReparto({ anillo: 0 }) === true);
  const flota = JSON.parse(readFileSync(new URL('../flota.json', import.meta.url), 'utf8'));
  const vieja = flota.tiendas.filter(t => t.nombre === 'prueba-panel')[0];
  ok('  ...y `prueba-panel` (0.15.0, abandonada) está fuera: ya no tapa el anillo 2',
     !vieja || vieja.anillo === 'fuera', vieja ? 'anillo ' + vieja.anillo : 'no está en la lista');
  const fu = readFileSync(new URL('./flujos.mjs', import.meta.url), 'utf8');
  ok('  ...y tampoco recibe flujos: fuera es fuera', /enReparto\(t\)/.test(fu));
  const act = readFileSync(new URL('./actualizar.mjs', import.meta.url), 'utf8');
  ok('  ...y cuando la flota se detiene, dice cómo seguir sin esa tienda',
     /Quedaron sin tocar/.test(act) && /"anillo": "fuera"/.test(act) && /solo esta tienda/.test(act));
}

/* ═══ LOS FLUJOS DE UNA TIENDA LOS ENTREGA LA FLOTA (0.22.1 · bitácora 103) ═══
   Una tienda no puede escribir sus propios `.github/workflows`: su push va con
   el permiso de Actions —`actions/checkout` deja una cabecera que gana a
   cualquier token en la URL— y ese no puede nunca. Así que una tienda con
   flujos nuevos se quedaba sin publicar nada, y el arreglo viajaba justo en
   esos flujos. La flota sí puede: esto se prueba sin red, con un GitHub de
   mentira en memoria. */
{
  const { flujosDeLaSemilla, queHacer, entregar } = await import('./flujos.mjs');
  ok('LOS FLUJOS que se entregan son los que la semilla declara suyos, y nada más',
     flujosDeLaSemilla(['maestro.gs', '.github/workflows/montaje.yml', '.github/workflows/fotos.yml',
                        '.github/workflows/', 'docs/']).join() === '.github/workflows/montaje.yml,.github/workflows/fotos.yml');
  ok('  ...y se decide cada uno: igual, nuevo o cambia',
     queHacer('a', null) === 'nuevo' && queHacer('a', 'a') === 'igual' && queHacer('a', 'b') === 'cambia');

  /* Un GitHub de mentira: la semilla en v9, la tienda con uno igual, uno viejo
     y uno que le falta. */
  const repo = {
    'lab/semilla@v9:semilla.json': JSON.stringify({ propios: ['maestro.gs', '.github/workflows/montaje.yml',
                                     '.github/workflows/fotos.yml', '.github/workflows/restaurar.yml'] }),
    'lab/semilla@v9:.github/workflows/montaje.yml': 'montaje v9',
    'lab/semilla@v9:.github/workflows/fotos.yml': 'fotos v9',
    'lab/semilla@v9:.github/workflows/restaurar.yml': 'restaurar v9',
    'lab/t1@:.github/workflows/montaje.yml': 'montaje v9',
    'lab/t1@:.github/workflows/fotos.yml': 'fotos VIEJO'
  };
  const puestos = [];
  const falso = {
    contenido: (r, ruta, ref) => {
      const k = r + '@' + (ref || '') + ':' + ruta;
      return k in repo ? { texto: repo[k], sha: 'sha-' + k.length } : null;
    },
    gh: (...a) => { puestos.push(a); return '{}'; }
  };
  const h = entregar(falso, { semilla: 'lab/semilla', etiqueta: 'v9', tienda: 'lab/t1', ensayo: false });
  ok('  ...escribe SOLO lo que cambia o falta, y lo igual no se toca',
     h.escritos.join() === '.github/workflows/fotos.yml,.github/workflows/restaurar.yml (nuevo)' &&
     h.iguales.join() === '.github/workflows/montaje.yml' && puestos.length === 2,
     h.escritos.join(' · '));
  ok('  ...y al reemplazar uno dice cuál reemplaza (sha), o GitHub lo rechaza',
     puestos[0].includes('-X') && puestos[0].includes('PUT') &&
     puestos[0].some(x => /^sha=/.test(x)) && !puestos[1].some(x => /^sha=/.test(x)));
  puestos.length = 0;
  entregar(falso, { semilla: 'lab/semilla', etiqueta: 'v9', tienda: 'lab/t1', ensayo: true });
  ok('  ...y en ensayo no escribe nada', puestos.length === 0);

  const act = readFileSync(new URL('./actualizar.mjs', import.meta.url), 'utf8');
  const tras = act.slice(act.indexOf('function porMontaje'));
  ok('  ...y `actualizar` los entrega DESPUÉS de que la tienda se actualiza bien',
     /entregar\(cliente\(TOKEN\)/.test(tras) && tras.indexOf('✓ actualizada') < tras.indexOf('entregar(cliente(TOKEN)'),
     'si el montaje falla, la tienda se queda entera en la versión de antes, flujos incluidos');
  const fy = readFileSync(new URL('../.github/workflows/flota.yml', import.meta.url), 'utf8');
  ok('  ...y se pueden pedir a mano: flota › flujos',
     /options: \[estado, actualizar, flujos\]/.test(fy) && /node flota\/flujos\.mjs/.test(fy));
}

/* ═══ EL PERMISO DE LA SEMILLA SE REFRESCA EN CADA CONEXIÓN (0.21.2 · bit. 101) ═══
   `alta` copia `SEMILLA_TOKEN` a la tienda el día que nace y nadie lo volvía a
   tocar. El día que ese token se rehace, cada tienda se queda con el valor viejo
   y sus actualizaciones dejan de poder traer flujos —el push se rechaza entero—
   sin que nada lo diga. `conectar` es donde se ponen los permisos de una tienda:
   aquí se pone también este, así que volver a correrlo vuelve a ser la
   respuesta. */
{
  const y = readFileSync(new URL('../.github/workflows/conectar.yml', import.meta.url), 'utf8');
  ok('CONECTAR refresca el `SEMILLA_TOKEN` de la tienda, no solo los cuatro del maestro',
     /gh secret set SEMILLA_TOKEN -R "\$REPO"/.test(y) &&
     /if \[ -n "\$SEMILLA_TOKEN" \]/.test(y));
  ok('  ...y dice en el resumen si lo puso o por qué no',
     /SEMILLA_TOKEN\\` de la tienda: \$refresco/.test(y) && /no hay/.test(y));
}

/* ═══ UNA TIENDA QUE YA NO EXISTE NO PARA A LA FLOTA (0.21.1 · bitácora 100) ═══
   `flota.json` lo edita una persona: una tienda de prueba borrada en GitHub se
   queda en la lista y la actualización se detenía en ella —«no pude leer su
   versión. Me detengo aquí»—, así que una lista vieja bloqueaba el reparto de
   una versión que estaba bien. */
{
  const { esQueNoExiste, textoDeLasQueNoEstan } = await import('./actualizar.mjs');
  ok('UN 404 se distingue de un fallo de verdad',
     esQueNoExiste(new Error('gh: Not Found (HTTP 404)')) === true &&
     esQueNoExiste({ stderr: 'HTTP 404: Not Found' }) === true &&
     esQueNoExiste(new Error('HTTP 500: server error')) === false &&
     esQueNoExiste(new Error('bad credentials (401)')) === false);
  ok('  ...y lo que se dice al final nombra las que hay que quitar de flota.json',
     /prueba-panel/.test(textoDeLasQueNoEstan(['prueba-panel'])) &&
     /flota\.json/.test(textoDeLasQueNoEstan(['prueba-panel'])) &&
     textoDeLasQueNoEstan([]) === '');

  const fuente = readFileSync(new URL('./actualizar.mjs', import.meta.url), 'utf8');
  const porMontaje = fuente.slice(fuente.indexOf('function porMontaje'));
  ok('  ...y la que no está se SALTA, no detiene a las demás',
     /esQueNoExiste\(e\)/.test(porMontaje) && /noEstan\.push/.test(porMontaje) &&
     porMontaje.indexOf('noEstan.push') < porMontaje.indexOf('Me detengo'),
     'lo que sí detiene a la flota es una tienda que está y falla: para eso son los anillos');
  ok('  ...pero si NO EXISTE NINGUNA, la corrida es roja: no se repartió nada',
     /noEstan\.length === orden\.length/.test(porMontaje) && /No se actualizó ninguna tienda/.test(porMontaje));
}

/* ═══ EL PANEL DE LA FLOTA SE PUBLICA SOLO (0.21.1 · bitácora 100) ═══
   Era el último paso que seguía siendo copiar y pegar: `panel.gs` vive en la
   semilla y corre en la hoja de administración. El flujo nuevo usa LA MISMA
   herramienta de la semilla que publica el maestro de cada tienda; una copia
   suya aquí se separaría de la otra el día que una cambie (patrón 2). */
{
  const y = readFileSync(new URL('../.github/workflows/panel.yml', import.meta.url), 'utf8');
  ok('EL PANEL se publica con la herramienta de la semilla, no con una copia',
     /ARCHIVO: panel\.gs/.test(y) && /node montar\/publicar-maestro\.mjs/.test(y) &&
     /git clone/.test(y) && /\$\{SEMILLA\}\.git/.test(y));
  ok('  ...y la versión se decide con la misma regla que el alta',
     /ultimaEtiqueta/.test(y),
     'dos maneras de entender «la última» se contradicen el día que una cambia');
  ok('  ...y sin los dos secretos lo dice y no toca nada',
     /PANEL_SCRIPT_ID/.test(y) && /PANEL_CLASPRC/.test(y) && /Faltan los secretos/.test(y));
  ok('  ...y la credencial de Google no se imprime en ninguna parte',
     !/echo[^\n]*PANEL_CLASPRC/.test(y),
     'un resumen es una página web: lo que se escribe ahí queda escrito');
}

/* ═══ EL PERMISO SE COMPRUEBA ANTES DE SEMBRARLO (0.20.8 · bitácora 96) ═══
   `conectar` sembraba el `DISPARO_TOKEN` en el maestro y DESPUÉS preguntaba si
   ese token veía la tienda. Desde la 0.20.2 el maestro reemplaza el permiso que
   ya no sirve por el que llega, así que un token vencido o corto pisaba uno
   bueno y el fallo salía semanas después, cuando el comercio tocaba Publicar:
   «El permiso de esta tienda no sirve o se venció». */
{
  const { quePasaConElPermiso, textoDelAlcance } = await import('./conectar.mjs');
  const bueno = quePasaConElPermiso({ ok: true, codigo: 200 }, 'lab/prueba1');
  const vencido = quePasaConElPermiso({ ok: false, codigo: 401 }, 'lab/prueba1');
  const corto = quePasaConElPermiso({ ok: false, codigo: 404 }, 'lab/prueba1');
  ok('UN PERMISO QUE SIRVE se siembra; uno que no, NO',
     bueno.sembrar === true && vencido.sembrar === false && corto.sembrar === false);
  ok('  ...y se dice qué pasa con cada uno: vencido, o que no alcanza esta tienda',
     /vencido o mal copiado/.test(vencido.texto) && /no se sembró/i.test(vencido.texto) &&
     /Only select repositories/.test(corto.texto) && /no se sembró/i.test(corto.texto) &&
     /sí ve/.test(bueno.texto),
     'sembrar uno muerto borra el bueno que la tienda pudiera tener');

  const fuente = readFileSync(new URL('./conectar.mjs', import.meta.url), 'utf8');
  const main = fuente.slice(fuente.indexOf('async function main'));
  ok('  ...y el programa lo hace EN ESE ORDEN, no solo lo cuenta',
     main.indexOf('veElRepositorio(') !== -1 &&
     main.indexOf('veElRepositorio(') < main.indexOf('ponerPermiso('),
     'el comentario decía «antes de sembrárselo» y el código sembraba primero');
}

/* ═══ EL RESUMEN DE CADA FLUJO (0.20.4 · bitácora 91) ═══
   La misma regla que vigila la semilla en `pruebas/montaje.js`, aquí para los
   tres flujos de servicio: el resumen abre con una ficha —qué es esta corrida,
   sobre qué, cómo está la flota antes de tocar nada, qué se pidió y quién lo
   pidió— y nada se dice dos veces. Está escrita en los dos repositorios porque
   ninguno puede leer los archivos del otro; cuando eso pasa, patrón 2 pide que
   las dos copias se comprueben por separado y digan lo mismo. */
{
  const dir = new URL('../.github/workflows/', import.meta.url);
  const nombres = readdirSync(dir).filter(f => /\.ya?ml$/.test(f));
  const flujos = nombres.map(f => ({ f, t: readFileSync(new URL(f, dir), 'utf8') }));
  const pasos = t => t.split(/\n      - (?=name:|uses:)/).slice(1)
    .map(p => ({ nombre: (p.match(/^name: (.+)/) || ['', ''])[1].trim(), t: p }));

  const sinFicha = flujos.filter(({ t }) => {
    const p = pasos(t).filter(x => /GITHUB_STEP_SUMMARY/.test(x.t))[0];
    return !p || p.nombre !== 'Qué es esta corrida';
  });
  ok('LA FICHA es lo PRIMERO que cada flujo escribe en el resumen',
     nombres.length >= 3 && sinFicha.length === 0,
     sinFicha.map(x => x.f).join(', ') || nombres.join(', '));

  const floja = flujos.filter(({ t }) => {
    const p = pasos(t).filter(x => x.nombre === 'Qué es esta corrida')[0];
    return !p || !(/echo "## /.test(p.t) && /flota\.json/.test(p.t) && /GITHUB_ACTOR/.test(p.t));
  });
  ok('  ...y dice qué es, cómo está la flota hoy y quién lo pidió',
     floja.length === 0, floja.map(x => x.f).join(', ') || 'las tres fichas completas');

  const repes = [];
  flujos.forEach(({ f, t }) => {
    const titulos = (t.match(/echo "#{2,4} [^"]+"/g) || []).map(x => x.replace(/^echo "#+ |"$/g, ''));
    const cuenta = {};
    titulos.forEach(x => { cuenta[x] = (cuenta[x] || 0) + 1; });
    Object.keys(cuenta).filter(k => cuenta[k] > 1).forEach(k => repes.push(f + ' › ' + k));
  });
  ok('  ...y ningún encabezado se repite dentro del mismo flujo',
     repes.length === 0, repes.join(' · ') || 'sin repeticiones');

  /* Y EL TOKEN DE LA TIENDA NO SE ESCRIBE EN NINGÚN RESUMEN: `conectar` lo
     recibe por el formulario, lo enmascara y solo dice que llegó. */
  const con = flujos.filter(x => x.f === 'conectar.yml')[0].t;
  ok('  ...y la ficha de `conectar` no imprime el token, solo dice que llegó',
     /add-mask/.test(con) && !/echo[^\n]*inputs\.maestro_token/.test(con) &&
     /\(enmascarado\)/.test(con),
     'un resumen es una página web: lo que se escribe ahí queda escrito');
}

console.log(T.join('\n'));
console.log('\nResultado: ' + T.filter(x => x.startsWith('  OK')).length + '/' + T.length);
process.exit(T.every(x => x.startsWith('  OK')) ? 0 : 1);
