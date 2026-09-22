/* ═══════════════════════════════════════════════════════════════════════════
   EL ALTA DE UNA TIENDA · lo que se decide, sin red (flujos `alta` y `conectar`)
   ---------------------------------------------------------------------------
   0.15.0 · SE PIDE LO MÍNIMO, Y EL RESTO SE VA LLENANDO. El alta pedía de
   entrada la URL del maestro, su token, la hoja… cosas que todavía no existen
   cuando se crea el repositorio. Ahora son dos pasos:

     alta      tres campos: el nombre corto, el comercio y el producto.
               CLONA la semilla en su última versión publicada, la limpia de
               lo que es de otra tienda, le pone su nombre y la sube a un
               repositorio nuevo. Deja escrita la lista de lo que falta.
     conectar  tres campos, cuando la hoja existe: el nombre, la URL del
               servicio y el token. El resto —la hoja, el proyecto, el
               repositorio, la dirección— lo pregunta y lo escribe solo.

   Y ya no hace falta marcar la semilla como «Template repository»: el primer
   alta falló con «gh: Not Found (HTTP 404)» justo ahí (bitácora 70). Clonar la
   ETIQUETA, además, deja la tienda naciendo en una versión con nombre, que es
   la base contra la que se actualiza después (decisión 19).

   Aquí vive lo que se decide (se prueba en flota/pruebas.mjs):
     node flota/alta.mjs validar     (NOMBRE, COMERCIO, LINEA)
     node flota/alta.mjs preparar    (DIR: la copia de la semilla a limpiar)
     node flota/alta.mjs agregar     (escribe la fila en flota.json)
     node flota/alta.mjs lista       (lo que falta, en Markdown)
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, appendFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/* Minúsculas, números y guiones: es a la vez el nombre del repositorio, el del
   sitio en Cloudflare (que no admite otra cosa) y el subdominio. */
export const NOMBRE_VALIDO = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function validar(flota, { nombre, comercio, linea }) {
  const errores = [];
  const n = String(nombre || '').trim().toLowerCase();
  if (!NOMBRE_VALIDO.test(n)) errores.push('El nombre va en minúsculas, números y guiones, de 3 a 40 (ej: cafe-la-esquina). Es el del repositorio, el del sitio y el subdominio.');
  if (!String(comercio || '').trim()) errores.push('Falta el nombre del comercio, como lo verá el comprador.');
  if (!(flota.lineas || {})[linea]) errores.push('El producto tiene que ser uno de: ' + Object.keys(flota.lineas || {}).join(', ') + '.');
  const dueno = String(((flota.lineas || {})[linea] || {}).semilla || '').split('/')[0] || 'laboratoriodigital';
  const repo = dueno + '/' + n;
  const sitio = flota.dominio ? `https://${n}.${flota.dominio}` : '';
  if ((flota.tiendas || []).some(t => t.repo.toLowerCase() === repo)) errores.push('Ya hay una tienda ' + repo + ' en flota.json.');
  if (sitio && (flota.tiendas || []).some(t => t.sitio && t.sitio.replace(/\/+$/, '') === sitio)) {
    errores.push(`La dirección ${sitio} ya es de otra tienda.`);
  }
  return { errores, repo, nombre: n, sitio };
}

/* LO QUE ES DE OTRA TIENDA NO SE HEREDA. La semilla también es una tienda
   publicada: su catálogo, sus fotos, sus fichas, su imagen para compartir y su
   dominio. Una tienda nueva que nace con eso muestra otro comercio el día que
   alguien conecta Cloudflare antes de tiempo. Y lo que es solo de la semilla
   (publicar versiones, las notas de trabajo) tampoco. */
export const NO_SE_HEREDA = [
  '.github/workflows/release.yml', 'Claude outputs', 'tienda.json', 'ESTADO.md',
  'publicar/catalogo.json', 'publicar/fotos', 'publicar/productos', 'publicar/sitemap.xml',
  'publicar/compartir.jpg'
];
/* En la Tienda Panel, lo publicado se rehace desde plantilla/: nace en blanco
   (sin SCRIPT_URL: «esta tienda todavía no está conectada») hasta el primer
   montaje. La Básica no tiene plantilla/: su index se rehornea en el montaje
   que dispara `conectar`, antes de que Cloudflare exista (la lista lo ordena así). */
const DE_LA_PLANTILLA = ['index.html', 'admin.html', 'pedido.html', '404.html'];

export function preparar(dir, { nombre, comercio, linea, producto, semilla, etiqueta }) {
  const hecho = { borrados: [], plantilla: [] };
  NO_SE_HEREDA.forEach(r => { if (existsSync(join(dir, r))) { rmSync(join(dir, r), { recursive: true, force: true }); hecho.borrados.push(r); } });
  DE_LA_PLANTILLA.forEach(n => {
    if (existsSync(join(dir, 'plantilla', n))) { copyFileSync(join(dir, 'plantilla', n), join(dir, 'publicar', n)); hecho.plantilla.push(n); }
  });
  const w = join(dir, 'wrangler.jsonc');
  if (existsSync(w)) {
    const t = readFileSync(w, 'utf8');
    const n = t.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${nombre}"`)
               /* El dominio de la semilla NO: lo escribe el montaje desde la
                  hoja de ESTA tienda (sitio_url). */
               .replace(/,?\s*"routes"\s*:\s*\[[^\]]*\]/, '');
    writeFileSync(w, n);
    hecho.wrangler = !/"name"\s*:\s*"[^"]*"/.test(t) ? 'sin name' : 'ok';
  }
  writeFileSync(join(dir, 'README.md'),
    `# ${comercio}\n\nTienda en línea de **${comercio}** — ${producto || linea}.\n\n` +
    `Nace de \`${semilla}\` en la versión ${etiqueta}. Lo que es de la semilla se actualiza ` +
    `desde allá (docs/ACTUALIZAR-UNA-TIENDA.md); lo de esta tienda vive en su hoja de cálculo.\n`);
  return hecho;
}

/* La fila de flota.json. Anillo 2: una tienda nueva no es la de pruebas ni de
   las primeras en recibir una versión, hasta que alguien decida lo contrario. */
export function agregar(flota, { repo, comercio, linea, sitio }) {
  const fila = { nombre: String(comercio).trim(), repo, linea, anillo: 2 };
  if (sitio) fila.sitio = sitio;
  return Object.assign({}, flota, { tiendas: [...(flota.tiendas || []), fila] });
}

/* Lo que queda a mano, EN ORDEN y con los datos de esta tienda. Cloudflare va
   AL FINAL a propósito: conectado antes del primer montaje, publicaría lo que
   haya en el repositorio, y eso todavía no es esta tienda. */
export function lista(flota, { repo, comercio, linea, sitio, nombre, etiqueta }) {
  const l = flota.lineas[linea] || {};
  const panel = l.modo === 'montaje';
  return [
    `## ${comercio}: el repositorio está listo`,
    '',
    `**${l.producto || linea}** · \`${repo}\` · nace de \`${l.semilla}\` ${etiqueta || ''} · ${sitio || '(sin dominio propio)'}`,
    '',
    'Hecho: el repositorio con la semilla limpia (sin el catálogo, las fotos ni el dominio de otra',
    'tienda), su nombre de sitio, los permisos de Actions y las fusiones automáticas, `SEMILLA_TOKEN`',
    'si existe, y su fila en `flota.json`.',
    '',
    '### Lo que falta, en este orden',
    '',
    '**1. Google** — con una cuenta de Google NUEVA para esta tienda (cada una gasta sus propios límites):',
    `   1. Una hoja nueva llamada «${comercio}».`,
    `   2. Un proyecto en script.google.com: pega \`maestro.gs\` de \`${repo}\`, pon el ID de la hoja`,
    '      (lo que va entre `/d/` y `/edit`) en `HOJA_ID`, ejecuta **A0_instalar** y autoriza.',
    '   3. Implementar › Nueva implementación › Aplicación web (Ejecutar como: yo · Acceso: cualquiera).',
    '   4. `A1_generarStub` en el maestro, y pega lo que imprime en Extensiones › Apps Script de la hoja.',
    '   5. En la hoja: menú › **Diagnóstico**: copia la *URL del servicio* y el *token*.',
    '',
    `**2. Conectar** — Actions › **conectar**: el nombre \`${nombre}\`, la URL y el token. Nada más:`,
    '   pregunta al maestro por la hoja y el proyecto, pone los secretos, escribe en la hoja el',
    '   repositorio y la dirección, y dispara el primer montaje.',
    '',
    `**3. Cloudflare**, cuando ese montaje termine en verde — Workers & Pages › Create › Import a`,
    `   repository › \`${repo}\`. El nombre del sitio ya viene puesto` + (sitio ? ` y \`${sitio.replace('https://', '')}\` lo escribe el montaje.` : '.'),
    '',
    panel
      ? `**4. El panel** — en la hoja, menú › **Clave del panel**, y a entrar en \`${sitio || 'https://<tu tienda>'}/admin.html\`.`
      : '**4. La hoja es el panel** — el comercio trabaja en su hoja; las gráficas están en la pestaña Tablero.',
    '',
    `**5. Publicar y actualizar desde la ${panel ? 'tienda' : 'hoja'}** — un token de grano fino solo sobre \`${repo}\`,`,
    '   *Actions: Read and write*, en las Propiedades del script del maestro como `GITHUB_TOKEN`.',
    '   (Para publicar el maestro desde GitHub, además `CLASPRC` en el repositorio: docs/DESPLIEGUE.md.)'
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archivo = process.env.FLOTA_JSON || 'flota.json';
  const flota = JSON.parse(readFileSync(archivo, 'utf8'));
  const datos = { nombre: process.env.NOMBRE, comercio: process.env.COMERCIO, linea: process.env.LINEA };
  const v = validar(flota, datos);
  const l = flota.lineas[datos.linea] || {};
  const que = process.argv[2];
  const salida = (k, x) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + x + '\n'); };
  if (que === 'validar') {
    if (v.errores.length) { console.error(v.errores.join('\n')); process.exit(1); }
    salida('repo', v.repo); salida('nombre', v.nombre); salida('sitio', v.sitio); salida('semilla', l.semilla);
    console.log(`${v.repo} · ${v.sitio || 'sin dominio'} · ${l.producto} · semilla ${l.semilla}`);
  } else if (que === 'preparar') {
    const h = preparar(process.env.DIR, Object.assign({}, datos, v, { producto: l.producto, semilla: l.semilla, etiqueta: process.env.ETIQUETA }));
    console.log('Sin lo de otra tienda: ' + (h.borrados.join(', ') || 'nada') + '. De la plantilla: ' + (h.plantilla.join(', ') || '—') + '.');
  } else if (que === 'agregar') {
    writeFileSync(archivo, JSON.stringify(agregar(flota, Object.assign({}, datos, v)), null, 2) + '\n');
  } else if (que === 'lista') {
    const md = lista(flota, Object.assign({}, datos, v, { repo: process.env.REPO || v.repo, etiqueta: process.env.ETIQUETA }));
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  } else { console.error('Uso: node flota/alta.mjs validar|preparar|agregar|lista'); process.exit(1); }
}
