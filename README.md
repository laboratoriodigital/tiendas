# `laboratoriodigital/tiendas` — el repositorio de servicio

Aquí vive lo que es **del negocio de vender tiendas**, no de una tienda:
dar de alta una tienda nueva y llevar la **flota** —todas las tiendas
publicadas— al día. Ninguna tienda ve este repositorio, y los dos secretos
poderosos (`ALTA_TOKEN`, `FLOTA_TOKEN`) viven solo aquí.

| | Qué | Dónde |
|---|---|---|
| Alta | Crear el repositorio de una tienda nueva desde su semilla | Actions › **tienda nueva** |
| Estado | Qué versión tiene cada tienda, qué contesta publicada, si tiene una actualización esperando | Actions › **flota** › `estado` · [`ESTADO.md`](ESTADO.md) |
| Actualizar | Abrir en cada tienda un pull request con la versión nueva de su semilla | Actions › **flota** › `actualizar` |
| Números | Ventas, pedidos por confirmar y agotados de todas las tiendas | La hoja **Panel de tiendas** (`panel.gs`), aparte |

---

## La flota (S3, versión 1: empezar sencillo)

### La lista: `flota.json`

Dos **líneas**, cada una con su **semilla** —el repositorio del que salen sus
tiendas— y la lista de lo que es de la semilla (`propios`):

- **`tienda`** — `laboratoriodigital/tienda`, la segunda generación (0.x). Hoy
  su única tienda es ella misma (Laboratorio Digital).
- **`organico`** — `laboratoriodigital/organico`, la primera (3.x). Su semilla
  es también la tienda Orgánico, y de ella salió **Cinnamon Beauty**.

Las dos líneas **no se mezclan**: la hoja de cálculo de una tienda 3.x no es
la de la 0.x (Pagos, variantes e inventario tienen otras columnas), así que
pasar Orgánico o Cinnamon a la línea `tienda` es una **migración de su hoja**,
no una actualización. Está planeada aparte (ver *Lo que viene*).

Cada tienda tiene un **anillo**: 0 para la de pruebas, 1 para las primeras,
2 para el resto. Se actualiza «hasta el anillo N»: primero el 0, se mira, luego
el 1…

Agregar una tienda es agregar una fila. **Nada secreto va en este archivo**
(las pruebas lo comprueban).

### Actualizar: la regla

**Sobrescribir lo que es de la semilla, nunca fusionar** — con un matiz que
Cinnamon Beauty obligó a escribir el primer día: esa tienda había arreglado
un archivo de la semilla (los ID repetidos del SEO) antes que la semilla
misma. Pisarlo a ciegas era deshacer el arreglo sin que nadie lo viera. Por
eso cada archivo se compara contra la versión de la que salió la tienda:

| La tienda… | La semilla… | Qué pasa |
|---|---|---|
| no lo tocó | lo cambió | se sobrescribe |
| lo cambió | no lo cambió | se respeta |
| lo cambió | también lo cambió | **no se toca** y el pull request lo dice arriba |
| no lo tiene | lo trae nuevo | se agrega |
| — | ya no lo trae | no se borra nada |
| (no se sabe de qué versión salió) | | **no se toca** lo distinto; se lista |

Nunca se toca `publicar/` (salvo lo que la línea declare), `wrangler.jsonc`,
el README ni `release.yml`. La versión de la tienda (`package.json`) pasa a
la nueva.

### Actualizar: los pasos

1. Actions › **flota** › Run workflow › `actualizar`, la línea, el anillo.
   **Sale en ensayo**: dice qué haría y enseña el pull request que abriría.
2. Si se ve bien, lo mismo **sin** la casilla de ensayo: abre un pull request
   `semilla/vX.Y.Z` en cada tienda.
3. En cada tienda: **pruebas** en verde → fusionar → **montaje** con la
   casilla del maestro y `PUBLICAR` (rehornea desde su hoja y publica el
   maestro verificando contra la tienda viva). Y lo que diga su
   `docs/ACTUALIZAR-UNA-TIENDA.md` para esa versión (a veces `A0_instalar()`).

Solo se actualiza a versiones **publicadas con release** (etiquetas `vX.Y.Z`),
nunca a lo que haya en `main`.

> **Orgánico no tiene la etiqueta `v3.6.1`**, que es la versión de la que
> salió Cinnamon. Sin ella no se puede saber qué archivos cambió Cinnamon por
> su cuenta, y la flota no toca los que difieran. Crear esa etiqueta en
> Orgánico (sobre el commit de la 3.6.1) lo resuelve.

### El secreto `FLOTA_TOKEN`

De grano fino, del dueño de las tiendas, con vencimiento, **solo en este
repositorio**. Sobre los repositorios de la flota: *Contents* lectura y
escritura, *Pull requests* lectura y escritura, *Workflows* lectura y
escritura (la semilla trae flujos), *Metadata* lectura.

### Las pruebas

`node flota/pruebas.mjs` — sin red ni token. Corren al principio de cada
corrida del flujo: una regla rota no llega a abrir un pull request.

---

## Alta de una tienda: `tienda-nueva.yml`

El flujo vive versionado en la semilla (`servicio/tienda-nueva.yml`, con sus
aserciones) y se copia aquí. Crea el repositorio a partir de la plantilla, le
pone su propio `name` en `wrangler.jsonc`, deja que Actions abra pull requests
y le carga `MAESTRO_URL` y `MAESTRO_TOKEN`. No conecta Cloudflare ni Google:
eso es el runbook `DESPLIEGUE.md` de la semilla.

Necesita `ALTA_TOKEN` (ver el encabezado del flujo). Al crear una tienda,
**agrégala a `flota.json`**.

---

## Lo que viene (en este orden)

1. **Volver atrás solo**: si el montaje de una tienda actualizada no contesta
   la versión esperada, reabrir la anterior.
2. **Montaje desde aquí**: tras fusionar, disparar el montaje de cada tienda y
   esperar su verificación.
3. **Un panel web de la flota** (detrás de Cloudflare Access): el estado de
   `ESTADO.md` más las cifras del Panel de tiendas en una sola pantalla, con
   los botones de actualizar y publicar.
4. **Tareas de valor para cada comercio**: el informe mensual, campañas de
   cupones y avisos de «volvió a llegar» para todas las tiendas a la vez.
5. **Migrar Orgánico y Cinnamon a la línea `tienda`**: un script que lleva su
   hoja 3.x a las columnas de la 0.x, ensayado sobre una copia de la hoja.
