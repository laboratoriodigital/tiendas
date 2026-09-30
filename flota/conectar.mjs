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

   0.16.0 · 3.4 · Y le pone al maestro su permiso de GitHub (GITHUB_TOKEN en
   sus propiedades) con DISPARO_TOKEN, si existe en tiendas: Publicar y
   Actualizar quedan andando sin tocar el editor. No pisa uno ya puesto.

   0.17.0 · Si «falta HOJA_ID» pero el diagnóstico sí la ve, lo dice claro:
   es la versión implementada (bitácora 74). Y avisa a la hoja de
   administración de tiendas (PANEL_URL + PANEL_CLAVE), si existe.

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
  if (!r.hojaOk) {
    /* 0.17.0 · El caso de la bitácora 74: el editor y el diagnóstico SÍ ven
       HOJA_ID, pero la web app corre la versión IMPLEMENTADA, que es de antes
       de pegarlo. No es la hoja: es la implementación. */
    if (/HOJA_ID/i.test(String(r.problema || '')) || !r.problema) {
      return 'El maestro no abre su hoja: ' + (r.problema || 'falta HOJA_ID') + '.\n\n' +
        'Si el diagnóstico SÍ la ve, la aplicación web corre una versión de ANTES de pegar HOJA_ID. ' +
        'En el editor del maestro: **Implementar › Gestionar implementaciones › lápiz › Versión: Nueva versión › Implementar**, ' +
        'y vuelve a correr conectar (la URL no cambia). Con el maestro 0.17.0 basta ejecutar **A0_instalar** una vez.';
    }
    return 'El maestro no abre su hoja: ' + r.problema + '. Revisa HOJA_ID en el maestro.';
  }
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

/* 0.16.0 · 3.4 · El permiso de GitHub del maestro (para Publicar y Actualizar
   desde el panel o el menú). Va por POST: un token no viaja en una dirección. */
async function ponerPermiso(url, token, tk, forzar) {
  const r = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                               body: JSON.stringify(Object.assign({ a: 'permiso', t: token, tk },
                                                                  forzar ? { forzar: 'si' } : {})) });
  try { return JSON.parse(await r.text()); } catch { return { ok: false, error: 'respuesta que no es JSON (' + r.status + ')' }; }
}

/* 0.20.1 · ¿ESE TOKEN VE ESTA TIENDA? (bitácora 87). GitHub contesta 404 —no
   403— cuando un token de grano fino no alcanza un repositorio, así que el
   maestro no puede distinguir «no existe» de «no lo incluye»: se le pregunta
   aquí, ANTES de sembrárselo, con el mismo token que va a recibir. Un
   `DISPARO_TOKEN` hecho sobre «Only select repositories» no incluye a las
   tiendas que nacieron después, y el síntoma aparece semanas más tarde, el día
   que el comercio toca Publicar. */
async function veElRepositorio(repo, tk) {
  try {
    const r = await fetch('https://api.github.com/repos/' + repo, {
      headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json',
                 'User-Agent': 'flota' } });
    return { ok: r.status === 200, codigo: r.status };
  } catch (e) { return { ok: false, codigo: 0, error: e.message }; }
}

export function textoDelAlcance(r, repo) {
  if (!r || r.ok) return '';
  if (r.codigo === 401) return 'Ojo: `DISPARO_TOKEN` está vencido o mal copiado (GitHub contestó 401).';
  return 'Ojo: `DISPARO_TOKEN` NO alcanza a ver `' + repo + '` (GitHub contestó ' + (r.codigo || 'nada') +
         '). Un token de grano fino sobre «Only select repositories» no incluye las tiendas creadas ' +
         'después: hazlo sobre TODOS los repositorios del dueño, con solo *Actions: Read and write*, ' +
         'y vuelve a correr `conectar`. Hasta entonces, Publicar y Actualizar desde el panel no van a ' +
         'disparar nada.';
}

/* 0.20.8 · PRIMERO SE COMPRUEBA, DESPUÉS SE SIEMBRA (bitácora 96). El
   comentario de arriba decía «ANTES de sembrárselo» y el orden del programa
   hacía lo contrario: sembraba el token y después preguntaba si servía. Con eso,
   un `DISPARO_TOKEN` vencido o corto REEMPLAZA al que la tienda tuviera bueno
   —desde la 0.20.2 el maestro reemplaza el que ya no sirve— y el fallo aparece
   semanas después, el día que el comercio toca Publicar y le sale «el permiso no
   sirve o se venció». Pasó en la tienda de prueba.

   Un permiso que no sirve no se siembra. Y no por eso se cae `conectar`: los
   secretos, la hoja y el primer montaje son lo que de verdad conecta la tienda;
   lo que no va a funcionar se dice, y se dice qué arreglar. */
export function quePasaConElPermiso(alcance, repo) {
  if (!alcance || alcance.ok) return { sembrar: true, texto: 'Permiso comprobado: ese token sí ve `' + repo + '`.' };
  return { sembrar: false,
           texto: textoDelAlcance(alcance, repo) + '\n- **El permiso no se sembró**, a propósito: sembrar uno que ' +
                  'no sirve borra el que la tienda pudiera tener bueno. Todo lo demás de `conectar` sí quedó hecho.' };
}

/* Qué decir del permiso, según lo que contestó el maestro. */
export function textoDelPermiso(r, hayToken) {
  if (!hayToken) return 'Permiso de GitHub: no se puso (falta el secreto `DISPARO_TOKEN` en tiendas). Publicar y Actualizar desde el panel esperan a que alguien lo ponga a mano.';
  /* 0.20.2 · Se dice si REEMPLAZÓ a uno que ya no servía: es la respuesta a
     «roté el token y sigue igual» (bitácora 89). */
  if (r && r.ok && r.puesto && r.reemplazado) return 'Permiso de GitHub: el que tenía ya no servía y se reemplazó por el de ahora.';
  if (r && r.ok && r.puesto) return 'Permiso de GitHub: puesto. Publicar y Actualizar ya funcionan desde el panel y el menú.';
  if (r && r.ok && r.mismo) return 'Permiso de GitHub: ya tenía exactamente este; no hacía falta tocarlo.';
  if (r && r.ok && r.yaEstaba) return 'Permiso de GitHub: el que tiene sigue sirviendo; no se tocó (marca «forzar» si quieres cambiarlo igual).';
  if (r && /desconocida/i.test(String(r.error || ''))) return 'Permiso de GitHub: este maestro no sabe recibirlo (Tienda Básica o versión anterior a la 0.16.0). Ponlo a mano en las Propiedades del script como `GITHUB_TOKEN`.';
  return 'Permiso de GitHub: no se pudo poner (' + ((r && r.error) || 'sin respuesta') + ').';
}

/* 0.17.0 · LA HOJA DE ADMINISTRACIÓN SE ENTERA SOLA. Si tiendas tiene
   PANEL_URL (la web app del «Panel de tiendas») y PANEL_CLAVE (su menú › Clave
   para el alta), conectar le deja la fila: comercio, repositorio, sitio,
   producto, servicio y token. Lo que el operador escribió allá no se toca. */
export function registroParaElPanel(flota, fila, url, token, clave) {
  const l = (flota.lineas || {})[fila.linea] || {};
  return { a: 'registrar_tienda', clave, comercio: fila.nombre, repo: fila.repo, sitio: fila.sitio || '',
           producto: l.producto || fila.linea || '', servicio: url, token,
           /* 0.20.1 · EL ANILLO, TAMBIÉN (bitácora 88). Vivía solo en
              `flota.json`, que es un archivo de un repositorio privado: quien
              mira el portal no tiene por qué abrir GitHub para saber si una
              tienda recibe las versiones primero o de últimas. */
           anillo: fila.anillo === undefined || fila.anillo === null ? '' : String(fila.anillo) };
}

export function textoDelPanel(r, hay) {
  if (!hay) return 'Hoja de administración: no se avisó (faltan los secretos `PANEL_URL` y `PANEL_CLAVE` en tiendas).';
  if (r && r.ok) return 'Hoja de administración: ' + (r.nueva ? 'la tienda quedó registrada' : 'se actualizaron su servicio y su token') + ' (fila ' + r.fila + ').';
  return 'Hoja de administración: no se pudo registrar (' + ((r && r.error) || 'sin respuesta') + '). Pégala a mano en la pestaña Tiendas.';
}

async function avisarAlPanel(panelUrl, cuerpo) {
  const r = await fetch(panelUrl, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                    body: JSON.stringify(cuerpo) });
  try { return JSON.parse(await r.text()); } catch { return { ok: false, error: 'respuesta que no es JSON (' + r.status + ')' }; }
}

/* 1.0.0 · El token de montaje va en el CUERPO, nunca en la dirección: una
   dirección queda en los registros (ROADMAP 5.7 de la semilla). El maestro
   atiende estas puertas por POST desde la 0.16.0, y desde la 1.0.0 solo así. */
async function pedir(url, token, a, extra) {
  const r = await fetch(url, { method: 'POST', redirect: 'follow',
                               headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                               body: JSON.stringify(Object.assign({ a, t: token }, extra || {})) });
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
  const disparo = String(process.env.DISPARO_TOKEN || '').trim();
  const forzar = /^(1|true|si|sí)$/i.test(String(process.env.FORZAR_PERMISO || ''));
  if (!disparo) {
    decir('- ' + textoDelPermiso(null, false));
  } else {
    const q = quePasaConElPermiso(await veElRepositorio(fila.repo, disparo), fila.repo);
    decir('- ' + q.texto);
    if (q.sembrar) decir('- ' + textoDelPermiso(await ponerPermiso(url, token, disparo, forzar), true));
    else console.log('::warning::DISPARO_TOKEN no sirve para ' + fila.repo + ': el permiso de GitHub no se sembró.');
  }
  const panelUrl = String(process.env.PANEL_URL || '').trim(), panelClave = String(process.env.PANEL_CLAVE || '').trim();
  const hayPanel = !!(panelUrl && panelClave);
  let rp = null;
  if (hayPanel) { try { rp = await avisarAlPanel(panelUrl, registroParaElPanel(flota, fila, url, token, panelClave)); } catch (e) { rp = { ok: false, error: e.message }; } }
  decir('- ' + textoDelPanel(rp, hayPanel));
  salida('repo', fila.repo); salida('hoja_id', id.hojaId); salida('script_id', id.scriptId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
