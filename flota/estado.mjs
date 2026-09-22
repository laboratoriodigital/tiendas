/* ═══════════════════════════════════════════════════════════════════════════
   EL ESTADO DE LA FLOTA
   ---------------------------------------------------------------------------
   Una fila por tienda: qué versión tiene su repositorio, cuál es la última de
   su semilla, qué contesta la tienda publicada y si tiene una actualización
   esperando. Escribe ESTADO.md (el flujo lo guarda en este repositorio) y el
   resumen de la corrida.

   Solo LEE. Lo que la tienda publicada enseña es público —su catalogo.json—;
   lo del repositorio se lee con FLOTA_TOKEN. Nada de la hoja, nada de ventas:
   eso vive en el panel de tiendas (panel.gs), que pregunta a cada maestro.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tablaEstado, ultimaEtiqueta, atrasada } from './nucleo.mjs';
import { panelHtml } from './panel.mjs';

const TOKEN = process.env.FLOTA_TOKEN || '';
const RESUMEN = process.env.GITHUB_STEP_SUMMARY || '';

async function api(ruta) {
  const r = await fetch('https://api.github.com/' + ruta, { headers: {
    Accept: 'application/vnd.github+json', 'User-Agent': 'flota',
    ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) } });
  if (!r.ok) throw new Error(ruta.split('/').slice(1, 3).join('/') + ': ' + r.status);
  return r.json();
}

async function versionDelRepo(repo) {
  const c = await api(`repos/${repo}/contents/package.json`);
  return JSON.parse(Buffer.from(c.content, 'base64').toString('utf8')).version || '';
}

async function ultimaDeLaSemilla(repo) {
  const tags = await api(`repos/${repo}/tags?per_page=100`);
  return ultimaEtiqueta(tags.map(t => t.name)).replace(/^v/, '');
}

async function publicado(sitio) {
  const c = new AbortController();
  const reloj = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(String(sitio).replace(/\/+$/, '') + '/catalogo.json', { signal: c.signal, headers: { 'User-Agent': 'flota' } });
    if (!r.ok) return { maestro: 'sin catalogo.json (' + r.status + ')', publicado: '' };
    const d = await r.json();
    return { maestro: d.version || '', publicado: String(d.generado || '').slice(0, 16).replace('T', ' ') };
  } catch (e) { return { maestro: 'no contesta', publicado: '' }; }
  finally { clearTimeout(reloj); }
}

async function prAbierto(repo) {
  const prs = await api(`repos/${repo}/pulls?state=open&per_page=50`);
  const p = prs.find(x => String(x.head && x.head.ref || '').startsWith('semilla/'));
  return p ? { numero: p.number, url: p.html_url } : null;
}

async function main() {
  const flota = JSON.parse(readFileSync('flota.json', 'utf8'));
  const semillas = {};
  for (const [nombre, l] of Object.entries(flota.lineas || {})) {
    try { semillas[nombre] = await ultimaDeLaSemilla(l.semilla); } catch (e) { semillas[nombre] = '¿? ' + e.message; }
  }
  const filas = [];
  for (const t of flota.tiendas || []) {
    const f = { nombre: t.nombre + (t.semilla ? ' (semilla)' : ''), sitio: t.sitio, linea: ((flota.lineas || {})[t.linea] || {}).producto || t.linea, anillo: t.semilla ? 'semilla' : t.anillo,
                versionSemilla: semillas[t.linea] };
    try { f.versionRepo = await versionDelRepo(t.repo); } catch (e) { f.versionRepo = '¿? ' + e.message; }
    Object.assign(f, t.sitio ? await publicado(t.sitio) : {});
    f.repo = t.repo; f.semilla = !!t.semilla;
    try { const pr = t.semilla ? null : await prAbierto(t.repo); if (pr) { f.pr = `[#${pr.numero}](${pr.url})`; f.prNumero = pr.numero; f.prUrl = pr.url; } } catch (e) { }
    f.atrasada = !t.semilla && atrasada(f.versionRepo, f.versionSemilla);
    filas.push(f);
  }
  const ahora = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const md = tablaEstado(filas, ahora);
  writeFileSync('ESTADO.md', md);
  /* 0.15.0 · y la misma foto como página: panel/index.html (flota/panel.mjs). */
  mkdirSync('panel', { recursive: true });
  const dueno = String((Object.values(flota.lineas || {})[0] || {}).semilla || 'laboratoriodigital').split('/')[0];
  writeFileSync('panel/index.html', panelHtml(filas, ahora, { dueno, servicio: process.env.GITHUB_REPOSITORY || dueno + '/tiendas' }));
  if (RESUMEN) appendFileSync(RESUMEN, md + '\n');
  console.log(md);
}

main().catch(e => { console.error(e.message); process.exit(1); });
