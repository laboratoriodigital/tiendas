/* ═══════════════════════════════════════════════════════════════════════════
   EL PANEL DE LA FLOTA · una página, sin servidor (0.15.0)
   ---------------------------------------------------------------------------
   Lo escribe `flota/estado.mjs` junto a ESTADO.md: panel/index.html, con los
   datos YA DENTRO. No pide nada a nadie al abrirse —ni GitHub, ni las tiendas—,
   no trae fuentes ni librerías de fuera y no tiene JavaScript: se puede servir
   desde Cloudflare detrás de Cloudflare Access (README, «El panel») o abrir
   desde el disco. Lo que muestra es la foto de la última corrida de `estado`.

   Mínimo y sobrio, como el panel de las tiendas: tinta casi negra, un gris,
   un color por estado, y aire.
   ═══════════════════════════════════════════════════════════════════════════ */
const esc = t => String(t === undefined || t === null ? '' : t)
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function panelHtml(filas, ahora, { dueno = 'laboratoriodigital', servicio = 'laboratoriodigital/tiendas' } = {}) {
  const gh = r => 'https://github.com/' + r;
  const flujo = f => gh(servicio) + '/actions/workflows/' + f;
  const atrasadas = filas.filter(f => f.atrasada).length;
  const caidas = filas.filter(f => /no contesta|sin catalogo/.test(String(f.maestro || ''))).length;
  const productos = [...new Set(filas.map(f => f.linea))];
  const estado = f => f.atrasada ? ['aviso', 'Detrás de su semilla'] :
    /no contesta|sin catalogo/.test(String(f.maestro || '')) ? ['mal', 'No contesta'] :
    f.semilla ? ['neutro', 'Semilla'] :
    !/^\d+\.\d+\.\d+$/.test(String(f.versionRepo || '')) ? ['neutro', 'Sin revisar'] : ['bien', 'Al día'];
  const fila = f => {
    const [cl, tx] = estado(f);
    return `<tr>
      <td><div class="t">${f.sitio ? `<a href="${esc(f.sitio)}" target="_blank" rel="noopener">${esc(f.nombre)}</a>` : esc(f.nombre)}</div>
          <div class="s"><a href="${esc(gh(f.repo))}" target="_blank" rel="noopener">${esc(f.repo)}</a></div></td>
      <td><span class="pill ${cl}">${esc(tx)}</span></td>
      <td class="n">${esc(f.versionRepo || '—')}<div class="s">semilla ${esc(f.versionSemilla || '—')}</div></td>
      <td class="n">${esc(f.maestro || '—')}<div class="s">${esc(f.publicado || '')}</div></td>
      <td class="n">${f.semilla ? '—' : esc(f.anillo)}</td>
      <td>${f.prUrl ? `<a href="${esc(f.prUrl)}" target="_blank" rel="noopener">#${esc(f.prNumero)}</a>` : '<span class="s">—</span>'}
          <div class="s"><a href="${esc(gh(f.repo))}/actions" target="_blank" rel="noopener">Actions</a>
          · <a href="${esc(gh(f.repo))}/actions/workflows/restaurar.yml" target="_blank" rel="noopener">volver atrás</a></div></td>
    </tr>`;
  };
  const cifra = (r, v, n) => `<div class="cifra"><div class="r">${esc(r)}</div><div class="v">${esc(v)}</div>${n ? `<div class="s">${esc(n)}</div>` : ''}</div>`;
  return `<!DOCTYPE html>
<html lang="es-CO">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Flota · ${esc(dueno)}</title>
<style>
:root{--tinta:#18181B;--tenue:#71717A;--linea:#E7E7EA;--fondo:#FAFAFA;--carta:#fff;
  --bien:#067647;--bien-f:#ECFDF3;--aviso:#93370D;--aviso-f:#FFFAEB;--mal:#B42318;--mal-f:#FEF3F2;
  --sombra:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06)}
@media (prefers-color-scheme:dark){:root{--tinta:#F4F4F5;--tenue:#A1A1AA;--linea:#2A2A2E;--fondo:#0E0E10;--carta:#161618;
  --bien:#47CD89;--bien-f:#0B2A1A;--aviso:#FDB022;--aviso-f:#2B1F07;--mal:#F97066;--mal-f:#2D0F0C;--sombra:none}}
*{box-sizing:border-box;margin:0;padding:0}
body{font:400 15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  background:var(--fondo);color:var(--tinta);-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 1}
a{color:inherit;text-decoration:none;border-bottom:1px solid var(--linea)}
a:hover{border-color:currentColor}
.env{max-width:1040px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--linea);background:var(--carta)}
header .env{display:flex;align-items:center;justify-content:space-between;height:60px;gap:12px}
.marca{font-weight:650;letter-spacing:-.01em}
.marca small{font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--tenue);
  border:1px solid var(--linea);border-radius:99px;padding:2px 8px;margin-left:10px;vertical-align:2px}
nav{display:flex;gap:8px;flex-wrap:wrap}
nav a{border:1px solid var(--linea);border-radius:8px;padding:7px 12px;font-size:.84rem;font-weight:550;background:var(--carta);box-shadow:var(--sombra)}
nav a.fuerte{background:var(--tinta);color:var(--carta);border-color:var(--tinta)}
h1{font-size:1.5rem;font-weight:650;letter-spacing:-.02em;margin:36px 0 4px}
.sub{color:var(--tenue);font-size:.9rem}
.cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:24px 0}
.cifra{background:var(--carta);border:1px solid var(--linea);border-radius:12px;padding:16px;box-shadow:var(--sombra)}
.cifra .r{font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tenue)}
.cifra .v{font-size:1.7rem;font-weight:650;letter-spacing:-.02em;margin-top:2px}
.caja{background:var(--carta);border:1px solid var(--linea);border-radius:14px;box-shadow:var(--sombra);overflow:auto}
table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:720px}
table{table-layout:fixed}th:nth-child(1){width:32%}th:nth-child(2){width:15%}th:nth-child(3){width:14%}th:nth-child(4){width:17%}th:nth-child(5){width:8%}th:nth-child(6){width:14%}
td{overflow-wrap:anywhere}
th{text-align:left;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--tenue);
  padding:12px 16px;border-bottom:1px solid var(--linea)}
td{padding:14px 16px;border-bottom:1px solid var(--linea);vertical-align:top}
tr:last-child td{border-bottom:none}
.n{white-space:nowrap}
.t{font-weight:600}
.s{font-size:.78rem;color:var(--tenue);margin-top:2px}
.pill{display:inline-block;font-size:.74rem;font-weight:600;padding:3px 9px;border-radius:6px;white-space:nowrap}
.pill.bien{background:var(--bien-f);color:var(--bien)}.pill.aviso{background:var(--aviso-f);color:var(--aviso)}
.pill.mal{background:var(--mal-f);color:var(--mal)}.pill.neutro{background:var(--fondo);color:var(--tenue);border:1px solid var(--linea)}
h2{font-size:1rem;font-weight:650;margin:32px 0 10px}
footer{color:var(--tenue);font-size:.8rem;margin:28px 0 48px}
</style>
</head>
<body>
<header><div class="env">
  <div class="marca">${esc(dueno)}<small>flota</small></div>
  <nav>
    <a class="fuerte" href="${esc(flujo('alta.yml'))}" target="_blank" rel="noopener">Nueva tienda</a>
    <a href="${esc(flujo('conectar.yml'))}" target="_blank" rel="noopener">Conectar</a>
    <a href="${esc(flujo('flota.yml'))}" target="_blank" rel="noopener">Actualizar</a>
  </nav>
</div></header>
<main class="env">
  <h1>La flota</h1>
  <p class="sub">Revisada ${esc(ahora)}. ${atrasadas ? `${atrasadas} tienda(s) detrás de su semilla.` : 'Todas las tiendas están en la versión de su semilla.'}</p>
  <div class="cifras">
    ${cifra('Tiendas', filas.filter(f => !f.semilla).length, filas.filter(f => f.semilla).length + ' semilla(s)')}
    ${cifra('Detrás de su semilla', atrasadas, atrasadas ? 'Actualizar las pone al día' : 'Ninguna')}
    ${cifra('Sin contestar', caidas, caidas ? 'Revisa su sitio' : 'Todas contestan')}
    ${cifra('Productos', productos.length, productos.join(' · '))}
  </div>
  ${productos.map(p => `<h2>${esc(p)}</h2>
  <div class="caja"><table>
    <thead><tr><th>Tienda</th><th>Estado</th><th>Versión</th><th>Maestro vivo</th><th>Anillo</th><th>Actualización</th></tr></thead>
    <tbody>${filas.filter(f => f.linea === p).map(fila).join('')}</tbody>
  </table></div>`).join('\n')}
  <footer>Lo escribe el flujo <b>flota</b> (acción <i>estado</i>), los lunes y cada vez que se corre. «Maestro vivo» es lo que contesta
    la tienda publicada: si no coincide con el repositorio, falta un montaje con la casilla del maestro.</footer>
</main>
</body>
</html>
`;
}
