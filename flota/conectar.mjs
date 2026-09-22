/* ═══════════════════════════════════════════════════════════════════════════
   CONECTAR UNA TIENDA CON SU HOJA (flujo `conectar`)
   ---------------------------------------------------------------------------
   Se le dan TRES cosas —el nombre corto, la URL del servicio y el token, que
   da el menú de la hoja › Diagnóstico— y el resto lo averigua:

     · al maestro, por su puerta `identidad`: el ID de la hoja, el del proyecto
       de Apps Script, y si de verdad abre su hoja;
     · a flota.json: el repositorio, el comercio y la dirección;
     · y le ESCRIBE a la hoja, por la puerta `sembrar`, el comercio, la
       dirección y el repositorio —solo donde la celda está vacía o de fábrica:
       lo que el comercio ya escribió no se pisa—.

   Deja en GITHUB_OUTPUT repo, hoja_id y script_id para que el flujo ponga los
   secretos y dispare el primer montaje. No imprime el token nunca.

     NOMBRE=… MAESTRO_URL=… MAESTRO_TOKEN=… node flota/conectar.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const URL_VALIDA = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

export function laFila(flota, nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  return (flota.tiendas || []).find(t => t.repo.toLowerCase().split('/')[1] === n) || null;
}

/* ¿Lo que contestó el maestro sirve para conectar? Devuelve el motivo si no. */
export function problemaDeIdentidad(r) {
  if (!r || typeof r !== 'object') return 'El maestro no contestó algo que se entienda. ¿Es la URL /exec de la implementación?';
  if (!r.ok) return 'El maestro dijo que no: ' + (r.error || 'sin motivo') + '. ¿El token es el de ESTA hoja?';
  if (!r.hojaOk) return 'El maestro no abre su hoja: ' + (r.problema || 'falta HOJA_ID') + '. Revisa HOJA_ID en el maestro.';
  if (!r.hojaId || !r.scriptId) return 'El maestro no dijo su hoja o su proyecto: publícale una versión nueva.';
  if (r.repositorio && r.repositorio.toLowerCase() !== (r._esperado || '').toLowerCase()) {
    return 'Esta hoja dice que es de ' + r.repositorio + ', no de ' + r._esperado + '. ¿Es la hoja de otra tienda?';
  }
  return null;
}

/* Lo que se le siembra a la hoja: lo que ya se sabe desde el alta. */
export function sembrado(fila) {
  const d = { negocio: fila.nombre, repositorio: fila.repo };
  if (fila.sitio) d.sitio_url = fila.sitio;
  return d;
}

async function pedir(url, token, a, extra) {
  const q = new URLSearchParams(Object.assign({ a, t: token }, extra || {}));
  const r = await fetch(url + '?' + q.toString(), { redirect: 'follow' });
  const texto = await r.text();
  try { return JSON.parse(texto); } catch { return { ok: false, error: 'respuesta que no es JSON (' + r.status + ')' }; }
}

async function main() {
  const flota = JSON.parse(readFileSync(process.env.FLOTA_JSON || 'flota.json', 'utf8'));
  const url = String(process.env.MAESTRO_URL || '').trim();
  const token = String(process.env.MAESTRO_TOKEN || '').trim();
  const fila = laFila(flota, process.env.NOMBRE);
  const decir = t => { console.log(t); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, t + '\n'); };
  const salida = (k, v) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + v + '\n'); };
  if (!fila) { decir(`### No hay una tienda «${process.env.NOMBRE}» en flota.json\n\n¿Corriste **alta** con ese nombre?`); process.exit(1); }
  if (!URL_VALIDA.test(url)) { decir('### La URL no es la del servicio\n\nTiene que ser la `/exec` de la implementación (menú de la hoja › Diagnóstico).'); process.exit(1); }
  if (!/^tk-[\w-]+$/.test(token)) { decir('### El token no parece el de la hoja\n\nEmpieza por `tk-` (menú de la hoja › Diagnóstico).'); process.exit(1); }

  const id = await pedir(url, token, 'identidad');
  id._esperado = fila.repo;
  const mal = problemaDeIdentidad(id);
  if (mal) { decir('### No se conectó\n\n' + mal); process.exit(1); }
  const s = await pedir(url, token, 'sembrar', sembrado(fila));
  decir(`### ${fila.nombre} conectada con su hoja\n\n` +
        `- Hoja \`${id.hojaId}\` · proyecto \`${id.scriptId}\` · maestro ${id.version}\n` +
        `- Escrito en la hoja: ${(s.escritos || []).join(', ') || 'nada (ya estaba)'}` +
        ((s.respetados || []).length ? ` · respetado lo que el comercio ya puso: ${s.respetados.join(', ')}` : ''));
  salida('repo', fila.repo); salida('hoja_id', id.hojaId); salida('script_id', id.scriptId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
