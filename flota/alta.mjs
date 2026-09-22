/* ═══════════════════════════════════════════════════════════════════════════
   EL ALTA DE UNA TIENDA · lo que se decide, sin red (flujo `alta`)
   ---------------------------------------------------------------------------
   El flujo `alta` hace, con ALTA_TOKEN, todo lo que GitHub deja hacer desde
   aquí; lo que no —la cuenta de Google de la tienda, su hoja y su maestro, y
   conectar el repositorio en Cloudflare— lo deja escrito como lista, con los
   datos de ESTA tienda ya puestos. Y cuando esa parte está hecha, `conectar`
   le pone los secretos y dispara su primer montaje.

   Aquí vive lo que se decide (y se prueba en flota/pruebas.mjs):
     · qué nombre vale para el repositorio, el Worker y el subdominio;
     · la fila que se agrega a flota.json;
     · la lista de lo que falta, para el resumen de la corrida.

     node flota/alta.mjs validar     (lee NOMBRE, COMERCIO, LINEA, SUBDOMINIO)
     node flota/alta.mjs agregar     (escribe la fila en flota.json)
     node flota/alta.mjs lista       (imprime lo que falta, en Markdown)
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/* Minúsculas, números y guiones: es a la vez el nombre del repositorio, el del
   Worker de Cloudflare (que no admite otra cosa) y el subdominio por defecto. */
export const NOMBRE_VALIDO = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function validar(flota, { nombre, comercio, linea, subdominio }) {
  const errores = [];
  const n = String(nombre || '').trim().toLowerCase();
  const sub = String(subdominio || '').trim().toLowerCase() || n;
  if (!NOMBRE_VALIDO.test(n)) errores.push('El nombre va en minúsculas, números y guiones, de 3 a 40 (ej: cafe-la-esquina). Es el del repositorio y el del sitio en Cloudflare.');
  if (!String(comercio || '').trim()) errores.push('Falta el nombre del comercio, como lo verá el comprador.');
  if (!(flota.lineas || {})[linea]) errores.push('La línea tiene que ser una de: ' + Object.keys(flota.lineas || {}).join(', ') + '.');
  if (!NOMBRE_VALIDO.test(sub)) errores.push('El subdominio va como el nombre: minúsculas, números y guiones.');
  const dueno = String((flota.lineas[linea] || {}).semilla || '').split('/')[0] || 'laboratoriodigital';
  const repo = dueno + '/' + n;
  if ((flota.tiendas || []).some(t => t.repo.toLowerCase() === repo)) errores.push('Ya hay una tienda ' + repo + ' en flota.json.');
  if ((flota.tiendas || []).some(t => t.sitio && flota.dominio && t.sitio.replace(/\/+$/, '') === `https://${sub}.${flota.dominio}`)) {
    errores.push(`El subdominio ${sub}.${flota.dominio} ya es de otra tienda.`);
  }
  return { errores, repo, nombre: n, subdominio: sub,
           sitio: flota.dominio ? `https://${sub}.${flota.dominio}` : '' };
}

/* La fila de flota.json. Anillo 2: una tienda nueva no es la de pruebas ni de
   las primeras en recibir una versión, hasta que alguien decida lo contrario. */
export function agregar(flota, { repo, comercio, linea, sitio }) {
  const fila = { nombre: String(comercio).trim(), repo, linea, anillo: 2 };
  if (sitio) fila.sitio = sitio;
  return Object.assign({}, flota, { tiendas: [...(flota.tiendas || []), fila] });
}

/* Lo que queda por hacer a mano, con los datos de esta tienda. Cada paso dice
   DÓNDE y QUÉ, no «configura Google». */
export function lista(flota, { repo, comercio, linea, sitio, nombre }) {
  const l = flota.lineas[linea] || {};
  const panel = l.modo === 'montaje';
  return [
    `## ${comercio}: el repositorio está listo`,
    '',
    `**${l.producto || linea}** · \`${repo}\` · ${sitio || '(sin dominio propio)'}`,
    '',
    'Hecho desde aquí: el repositorio desde la semilla, su propio nombre en `wrangler.jsonc`, los',
    'permisos de Actions, las fusiones automáticas y, si existe, `SEMILLA_TOKEN`. Y la fila en `flota.json`.',
    '',
    '### Lo que falta (una vez, unos 20 minutos)',
    '',
    '**1. Google** — con una cuenta de Google NUEVA para esta tienda (cada tienda gasta sus propios límites):',
    `   1. Una hoja nueva llamada «${comercio}». Copia su ID (entre \`/d/\` y \`/edit\`).`,
    '   2. Un proyecto de Apps Script aparte (script.google.com › Nuevo proyecto), pega `maestro.gs` de la',
    `      semilla, pon el ID de la hoja en \`HOJA_ID\`, ejecuta **A0_instalar** y autoriza.`,
    '   3. Implementar › Nueva implementación › Aplicación web (Ejecutar como: yo · Acceso: cualquiera).',
    '   4. En la hoja: menú › **Diagnóstico** te da la *URL del servicio* y el *token*.',
    '   5. `generarStub` en el maestro, y pega lo que imprime en Extensiones › Apps Script de la hoja.',
    '',
    `**2. Cloudflare** — Workers & Pages › Create › Import a repository › \`${repo}\`. Nada más: el`,
    '   nombre del sitio ya viene en `wrangler.jsonc`' + (sitio ? `, y el dominio \`${sitio.replace('https://', '')}\` lo escribe el montaje desde la hoja (\`sitio_url\`)` : '') + '.',
    '',
    `**3. Conectar** — Actions › **alta** › \`conectar\` con el nombre \`${nombre}\`, la URL del servicio y el token.`,
    '   Pone los secretos y dispara el primer montaje. Para publicar el maestro desde GitHub hacen falta',
    `   además \`CLASPRC\`, \`SCRIPT_ID\` y \`HOJA_ID\` en el repositorio (docs/DESPLIEGUE.md de la semilla).`,
    '',
    panel
      ? `**4. El panel** — en la hoja, menú › **Clave del panel**. Entra en \`${sitio || 'https://<tu tienda>'}/admin.html\`.`
      : '**4. La hoja es el panel** — el comercio trabaja en su hoja; las gráficas están en la pestaña Tablero.',
    '',
    `**5. El permiso para publicar y actualizar desde la ${panel ? 'tienda' : 'hoja'}** — un token de grano fino, solo sobre \`${repo}\`,`,
    '   *Actions: Read and write*, en las Propiedades del script del maestro como `GITHUB_TOKEN`.'
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archivo = process.env.FLOTA_JSON || 'flota.json';
  const flota = JSON.parse(readFileSync(archivo, 'utf8'));
  const datos = { nombre: process.env.NOMBRE, comercio: process.env.COMERCIO, linea: process.env.LINEA, subdominio: process.env.SUBDOMINIO };
  const v = validar(flota, datos);
  const que = process.argv[2];
  const salida = (k, x) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + x + '\n'); };
  if (que === 'validar') {
    if (v.errores.length) { console.error(v.errores.join('\n')); process.exit(1); }
    salida('repo', v.repo); salida('nombre', v.nombre); salida('sitio', v.sitio);
    salida('semilla', flota.lineas[datos.linea].semilla);
    console.log(`${v.repo} · ${v.sitio || 'sin dominio'} · semilla ${flota.lineas[datos.linea].semilla}`);
  } else if (que === 'agregar') {
    writeFileSync(archivo, JSON.stringify(agregar(flota, Object.assign({}, datos, v)), null, 2) + '\n');
  } else if (que === 'lista') {
    const md = lista(flota, Object.assign({}, datos, { repo: process.env.REPO || v.repo, sitio: v.sitio, nombre: v.nombre }));
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  } else { console.error('Uso: node flota/alta.mjs validar|agregar|lista'); process.exit(1); }
}
