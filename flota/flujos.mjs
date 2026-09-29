/* ═══════════════════════════════════════════════════════════════════════════
   LOS FLUJOS DE CADA TIENDA LOS ENTREGA LA FLOTA (0.22.1 · bitácora 103)
   ---------------------------------------------------------------------------
   Una tienda no puede escribir sus propios `.github/workflows`: su push va con
   el permiso de Actions, que no puede nunca, y el truco de meter otro token en
   la URL no servía —`actions/checkout` deja en `.git/config` una cabecera con
   el permiso de Actions que git manda en cada push, gane quien gane en la URL—.
   Así que una tienda con flujos nuevos se quedaba sin publicar nada, y como el
   arreglo viajaba justo en esos flujos, no podía salir de ahí sola.

   La flota sí puede: `FLOTA_TOKEN` tiene *Workflows* en escritura sobre todas
   las tiendas. Esto copia los flujos de la semilla, en la versión pedida, a
   cada tienda de la línea —por la API de contenidos, sin clonar nada—, y solo
   los que cambian. Lo corre `flota › flujos` a mano, y `flota › actualizar`
   después de cada tienda que se actualiza bien.

     node flota/flujos.mjs      (FLOTA_TOKEN, LINEA, TIENDA?, VERSION?, ENSAYO?)
   ═══════════════════════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { laPedida, ultimaEtiqueta, enReparto } from './nucleo.mjs';

/* Qué se entrega: lo que la semilla declara suyo dentro de `.github/workflows`.
   La lista la dice su `semilla.json`, no este archivo (patrón 2). */
export function flujosDeLaSemilla(propios) {
  return (propios || []).filter(p => String(p).indexOf('.github/workflows/') === 0 && /\.ya?ml$/.test(p));
}

/* Qué hacer con uno: igual (no se toca), nuevo o cambia (se escribe). */
export function queHacer(enSemilla, enTienda) {
  if (enTienda === null || enTienda === undefined) return 'nuevo';
  return String(enSemilla) === String(enTienda) ? 'igual' : 'cambia';
}

const RESUMEN = process.env.GITHUB_STEP_SUMMARY || '';
const decir = t => { console.log(t); if (RESUMEN) appendFileSync(RESUMEN, t + '\n'); };

export function cliente(token) {
  const gh = (...a) => execFileSync('gh', a, { env: Object.assign({}, process.env, { GH_TOKEN: token }),
                                             stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  const contenido = (repo, ruta, ref) => {
    try {
      const r = JSON.parse(gh('api', `repos/${repo}/contents/${ruta}` + (ref ? `?ref=${ref}` : '')));
      return { texto: Buffer.from(r.content || '', 'base64').toString('utf8'), sha: r.sha };
    } catch (e) {
      if (/HTTP 404|Not Found/i.test(String(e.stderr || e.message))) return null;
      throw e;
    }
  };
  return { gh, contenido };
}

/* Entrega los flujos de la semilla (en `etiqueta`) a UNA tienda. Devuelve lo
   que hizo, para que quien la llame lo cuente. */
export function entregar({ gh, contenido }, { semilla, etiqueta, tienda, ensayo }) {
  const conf = contenido(semilla, 'semilla.json', etiqueta);
  if (!conf) throw new Error(`la semilla ${semilla} no tiene semilla.json en ${etiqueta}`);
  const rutas = flujosDeLaSemilla(JSON.parse(conf.texto).propios);
  const hecho = { escritos: [], iguales: [] };
  for (const ruta of rutas) {
    const n = contenido(semilla, ruta, etiqueta);
    if (!n) continue;
    const t = contenido(tienda, ruta, '');
    const q = queHacer(n.texto, t ? t.texto : null);
    if (q === 'igual') { hecho.iguales.push(ruta); continue; }
    if (!ensayo) {
      const args = ['api', '-X', 'PUT', `repos/${tienda}/contents/${ruta}`,
        '-f', `message=ci/flujos: ${ruta.split('/').pop()} desde ${semilla} ${etiqueta}`,
        '-f', `content=${Buffer.from(n.texto, 'utf8').toString('base64')}`];
      if (t && t.sha) args.push('-f', `sha=${t.sha}`);
      gh(...args);
    }
    hecho.escritos.push(ruta + (q === 'nuevo' ? ' (nuevo)' : ''));
  }
  return hecho;
}

function main() {
  const token = String(process.env.FLOTA_TOKEN || '').trim();
  if (!token) { decir('### Falta el secreto `FLOTA_TOKEN`'); process.exit(1); }
  const flota = JSON.parse(readFileSync(new URL('../flota.json', import.meta.url), 'utf8'));
  const linea = String(process.env.LINEA || 'tienda');
  const l = (flota.lineas || {})[linea];
  if (!l) { decir(`### No existe la línea \`${linea}\``); process.exit(1); }
  if (l.modo !== 'montaje') {
    decir(`### La línea \`${linea}\` no tiene flujos que entregar: se actualiza por pull request y los lleva ahí.`);
    return;
  }
  const c = cliente(token);
  const etiqueta = String(process.env.VERSION || '').trim() ||
    ultimaEtiqueta(c.gh('api', `repos/${l.semilla}/tags?per_page=100`, '--jq', '.[].name').split('\n'));
  if (!etiqueta) { decir(`### La semilla ${l.semilla} no tiene ninguna versión publicada.`); process.exit(1); }
  const ensayo = /^(1|true|si|sí)$/i.test(String(process.env.ENSAYO || ''));
  const todas = (flota.tiendas || []).filter(t => t.linea === linea && !t.semilla && enReparto(t));
  const pedida = laPedida(todas, process.env.TIENDA || '');
  if (pedida.error) { decir('### ' + pedida.error); process.exit(1); }

  decir(`### Los flujos de \`${l.semilla}\` ${etiqueta}${ensayo ? ' — ensayo: no se escribe nada' : ''}`);
  decir('');
  let fallos = 0;
  for (const t of pedida.tiendas) {
    try {
      const h = entregar(c, { semilla: l.semilla, etiqueta, tienda: t.repo, ensayo });
      decir(h.escritos.length
        ? `- **${t.nombre}**: ${ensayo ? 'escribiría' : 'puestos'} ${h.escritos.map(x => '`' + x.split('/').pop() + '`').join(', ')}` +
          (h.iguales.length ? ` · ya al día: ${h.iguales.length}` : '')
        : `- **${t.nombre}**: ya los tenía todos al día (${h.iguales.length}).`);
    } catch (e) {
      const txt = String(e.stderr || e.message).split('\n')[0];
      if (/HTTP 404|Not Found/i.test(txt)) { decir(`- **${t.nombre}**: no está en GitHub (404). La salto.`); continue; }
      fallos++;
      decir(`- **${t.nombre}**: no se pudieron poner — ${txt}` +
            (/403|permission/i.test(txt) ? ' (¿`FLOTA_TOKEN` tiene *Workflows: Read and write*?)' : ''));
    }
  }
  if (fallos) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
