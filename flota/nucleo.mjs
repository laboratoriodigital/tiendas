/* ═══════════════════════════════════════════════════════════════════════════
   LA FLOTA · lo que se decide, sin red ni git (S3, versión 1)
   ---------------------------------------------------------------------------
   Todo lo que aquí se decide se prueba en flota/pruebas.mjs sin tocar GitHub.
   Los dos scripts que sí hablan con la red —estado.mjs y actualizar.mjs— solo
   traen datos y ejecutan lo que esto decide.

   LA REGLA DE ACTUALIZAR, decidida en el roadmap (S3) y no se vuelve a
   discutir: SOBRESCRIBIR lo que es de la semilla, nunca fusionar. Con un
   matiz que la primera tienda real obligó a escribir (Cinnamon Beauty, 22 de
   septiembre de 2026): una tienda puede haber cambiado un archivo de la
   semilla —Cinnamon arregló los ID repetidos del SEO antes que Orgánico—, y
   sobrescribirlo a ciegas es deshacer ese arreglo sin que nadie lo vea.

   Por eso cada archivo se mira contra TRES versiones:
     · T — el de la tienda, hoy;
     · N — el de la semilla en la versión NUEVA;
     · B — el de la semilla en la versión de la que salió la tienda (BASE).
   Y la decisión es una tabla, no una fusión:
     T = N                 → nada que hacer.
     T = B                 → la tienda no lo tocó: se sobrescribe con N.
     T ≠ B, N = B          → la tienda lo cambió y la semilla no: se deja.
     T ≠ B, N ≠ B          → los dos lo cambiaron: NO SE TOCA y se dice en
                             grande. Lo decide una persona.
     sin B (no se sabe de qué versión salió) → NO se toca, y se dice; con
                             la opción `sin_base: sobrescribir` se pisa y se
                             lista igual.
     T no existe           → archivo nuevo de la semilla: se agrega.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ¿Qué tiendas toca esta corrida? Las de la línea, HASTA el anillo pedido
   (el 1 incluye al 0), y nunca la semilla misma: la semilla ya es la versión. */
export function elegirTiendas(flota, linea, anillo) {
  const hasta = Number(anillo);
  return (flota.tiendas || []).filter(t =>
    t.linea === linea && !t.semilla && Number(t.anillo) <= hasta);
}

/* ¿Este archivo es de la semilla? `propios` lista rutas; las que acaban en «/»
   son carpetas enteras. */
export function esPropio(ruta, propios) {
  return propios.some(p => p.endsWith('/') ? ruta.startsWith(p) : ruta === p);
}

/* Qué hacer con UN archivo. Recibe los contenidos (Buffer o texto) o null si
   el archivo no existe en esa versión; `conocida` dice si hay base. */
export function decidir(T, N, B, conocida) {
  const igual = (a, b) => a !== null && b !== null && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
  if (N === null) return 'nada';                       // la semilla no lo trae: no se borra nada
  if (T === null) return 'agregar';
  if (igual(T, N)) return 'nada';
  if (!conocida) return 'sobrescribir-sin-base';
  if (B !== null && igual(T, B)) return 'sobrescribir';
  if (B !== null && igual(N, B)) return 'conservar-propio';
  return 'desvio';                                     // los dos cambiaron (o la tienda lo creó y la semilla también)
}

/* «3.6.1» → [3,6,1]. Una etiqueta que no se entiende no se ordena: se ignora. */
export function version(t) {
  const m = String(t || '').trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
export function comparar(a, b) {
  const x = version(a), y = version(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
export function ultimaEtiqueta(etiquetas) {
  return (etiquetas || []).filter(e => version(e)).sort((a, b) => comparar(b, a))[0] || '';
}

/* El cuerpo del pull request: lo que se hizo, lo que NO se hizo y por qué, y
   los pasos que siguen. Es lo que lee la persona que decide fusionar. */
export function cuerpoDelPR({ tienda, linea, desde, hasta, informe }) {
  const lista = (xs) => xs.length ? xs.map(x => '- `' + x + '`').join('\n') : '_(ninguno)_';
  const partes = [
    `## ${tienda.nombre}: semilla \`${linea}\` ${desde || '(desconocida)'} → ${hasta}`,
    '',
    'Lo abre el flujo **flota** del repositorio `tiendas`. Sobrescribe los archivos que son de la',
    'semilla y **no toca nada de la tienda**: ni `publicar/`, ni `wrangler.jsonc`, ni el README.',
    ''
  ];
  if (informe.desvios.length) {
    partes.push('### ⚠ No se tocaron: la tienda y la semilla los cambiaron los dos', '',
      'La tienda tiene un cambio propio en estos archivos y la semilla también cambió. Sobrescribir',
      'sería perder el de la tienda. Revísalos a mano (o llévate el cambio de la tienda a la semilla).', '',
      lista(informe.desvios), '');
  }
  if ((informe.sinBaseDejados || []).length) {
    partes.push('### ⚠ No se tocaron: no se sabe de qué versión salió la tienda', '',
      `La semilla no tiene la etiqueta v${String(desde || '').replace(/^v/, '')}, así que no se puede saber si estos archivos`,
      'tienen un cambio propio de la tienda. Se dejaron como estaban. Para ponerlos al día: etiqueta esa',
      'versión en la semilla y vuelve a correr, o corre con `sin_base: sobrescribir` mirando el diff.', '',
      lista(informe.sinBaseDejados), '');
  }
  if (informe.sinBase.length) {
    partes.push('### ⚠ Sobrescritos sin poder comprobar', '',
      `No se encontró la etiqueta de la versión de la que salió la tienda (${desde || 'sin versión'}),`,
      'así que no se sabe si estos tenían un cambio propio. Míralos en el diff antes de fusionar.', '',
      lista(informe.sinBase), '');
  }
  partes.push('### Lo que cambia', '',
    `Sobrescritos: ${informe.sobrescritos.length + informe.sinBase.length} · Nuevos: ${informe.nuevos.length}` +
    ` · Cambios propios de la tienda que se respetan: ${informe.propios.length}`, '');
  if (informe.nuevos.length) partes.push('Nuevos:', '', lista(informe.nuevos), '');
  if (informe.propios.length) partes.push('Cambios propios que se respetan (la semilla no los tocó):', '', lista(informe.propios), '');
  if (informe.conservados.length) partes.push('Declarados como de la tienda en `flota.json` (`conserva`):', '', lista(informe.conservados), '');
  partes.push('### Qué sigue', '',
    '1. Espera a que **pruebas** termine en verde en este pull request.',
    '2. Fusiónalo.',
    '3. Corre **montaje** con la casilla del **maestro** marcada y `PUBLICAR`: rehornea desde la hoja',
    '   de esta tienda y publica el maestro verificando contra la tienda viva.',
    `4. Mira en \`docs/ACTUALIZAR-UNA-TIENDA.md\` si alguna versión entre ${desde || '?'} y ${hasta} pide`,
    '   `A0_instalar()` en la hoja.');
  return partes.join('\n');
}

/* La tabla del estado de la flota, en Markdown. Una fila por tienda. */
export function tablaEstado(filas, ahora) {
  const c = v => String(v === undefined || v === null || v === '' ? '—' : v).replace(/\|/g, '\\|');
  const cab = '| Tienda | Producto | Anillo | Repositorio | Semilla | Maestro vivo | Catálogo publicado | Actualización |\n' +
              '|---|---|---|---|---|---|---|---|';
  const cuerpo = filas.map(f => '| ' + [
    f.sitio ? `[${c(f.nombre)}](${f.sitio})` : c(f.nombre), c(f.linea), c(f.anillo),
    c(f.versionRepo) + (f.atrasada ? ' ⚠' : ''), c(f.versionSemilla), c(f.maestro), c(f.publicado),
    c(f.pr)
  ].join(' | ') + ' |').join('\n');
  const atrasadas = filas.filter(f => f.atrasada).length;
  return [`# La flota`, '',
    `_Lo escribe el flujo **flota** (acción \`estado\`). Última revisión: ${ahora}._`, '',
    atrasadas ? `**${atrasadas} tienda(s) detrás de su semilla** (⚠). Para ponerlas al día: Actions › flota › actualizar.`
              : '**Todas las tiendas están en la versión de su semilla.**', '',
    cab, cuerpo, '',
    '«Maestro vivo» es lo que contesta la tienda publicada (su `catalogo.json`); si no coincide con',
    'el repositorio, falta un montaje con la casilla del maestro.', ''].join('\n');
}

/* ¿Está atrasada? Solo si las dos versiones se entienden y la del repositorio
   es menor. Una que no se entiende no se da por atrasada: se ve en la tabla. */
export function atrasada(deLaTienda, deLaSemilla) {
  return !!(version(deLaTienda) && version(deLaSemilla) && comparar(deLaTienda, deLaSemilla) < 0);
}
