# `laboratoriodigital/tiendas` — el repositorio de servicio

Aquí vive lo que es **del negocio de vender tiendas**, no de una tienda:
dar de alta una tienda nueva y llevar la **flota** —todas las tiendas
publicadas— al día. Ninguna tienda ve este repositorio, y los dos secretos
poderosos (`ALTA_TOKEN`, `FLOTA_TOKEN`) viven solo aquí.

## Dos productos

| | **Tienda Básica** | **Tienda Panel** |
|---|---|---|
| Semilla | `laboratoriodigital/organico` (3.x) | `laboratoriodigital/tienda` (0.x) |
| El comercio trabaja en | su hoja de cálculo | un panel web (y su hoja, si quiere) |
| Velocidad de gestión | rápida: la hoja es directa | más lenta: cada gestión pasa por Apps Script |
| Gráficas | en la pestaña Tablero de la hoja; extras posibles | en el panel |
| Precio | el de entrada | más caro, más fácil de manejar |
| Se actualiza | por pull request, que la flota fusiona sola | sola: su montaje con la semilla |
| Tiendas | Orgánico (semilla), Cinnamon Beauty | Laboratorio Digital (semilla); todavía sin hijas |

Las dos venden igual (catálogo, variantes, cupones, envíos, pasarela Bold o
WhatsApp, rastreo). **No se mezclan**: la hoja de una no es la de la otra, y
pasar una tienda de producto es darla de alta de nuevo (decisión 20 de la
semilla `tienda`).

| | Qué | Dónde |
|---|---|---|
| Alta | Crear una tienda nueva, de cualquiera de los dos productos | Actions › **alta**, luego **conectar** |
| Panel | La flota de un vistazo | [`panel/index.html`](panel/index.html), detrás de Cloudflare Access |
| Estado | Qué versión tiene cada tienda y qué contesta publicada | Actions › **flota** › `estado` · [`ESTADO.md`](ESTADO.md) |
| Actualizar | Poner al día una línea, por anillos | Actions › **flota** › `actualizar` |
| Números | Ventas, pedidos y agotados de todas las tiendas | La hoja **Panel de tiendas** (`panel.gs`), aparte |

---

## El alta: `alta` y `conectar`, tres campos cada uno

**1. `alta`** — el nombre corto (`cafe-la-esquina`: repositorio, sitio y
subdominio), el comercio y el producto. Comprueba que `ALTA_TOKEN` ve la
semilla (y si no, dice qué revisar), **clona su última versión publicada**
—no hace falta marcarla como plantilla—, la limpia de lo que es de otra tienda
(catálogo, fotos, fichas, imagen, dominio, `release`), le pone su nombre,
permisos, fusiones automáticas y `SEMILLA_TOKEN`, y la agrega a `flota.json`.
**El resumen de la corrida es la lista de lo que falta**, en orden.

**2. Google** (a mano, en la cuenta de la tienda): la hoja, el maestro,
`A0_instalar`, la implementación y el stub. El Diagnóstico de la hoja da la URL
y el token.

**3. `conectar`** — **dónde está**: github.com/laboratoriodigital/tiendas ›
pestaña **Actions** › en la lista de la izquierda, **conectar** › botón **Run
workflow** a la derecha ([enlace directo](https://github.com/laboratoriodigital/tiendas/actions/workflows/conectar.yml);
también el botón *Conectar* del panel de la flota y el Diagnóstico de la
hoja). Aparece cuando `conectar.yml` está en `main`. Tres campos: el nombre
corto, el *Servicio* y el *Token* que da `diagnosticoCompleto()` en el editor
del maestro. Le pregunta al maestro su hoja y su proyecto, escribe en la hoja
el comercio, la dirección y el repositorio, pone los cuatro secretos, le pone
al maestro su permiso de GitHub y dispara el primer montaje.

**A mano queda solo `CLASPRC`**, la credencial de Google de la tienda
(`clasp login --no-localhost` con su cuenta), para publicar el maestro desde
GitHub.

**4. Cloudflare**, cuando ese montaje termine: Import a repository. Al final a
propósito: conectado antes, publicaría lo que todavía no es esta tienda.

Todavía no ha corrido de punta a punta: la primera vez, míralo paso a paso.

---

## El panel: `panel/index.html`

Una página que escribe `flota › estado` (los lunes y cada vez que se corre),
con la misma información que `ESTADO.md` y los botones de **Nueva tienda**,
**Conectar** y **Actualizar**. Estática, sin JavaScript y sin nada secreto.
Para verla en la web: Cloudflare › Import a repository › `tiendas`
(`wrangler.jsonc` ya dice qué publicar) y **protégela con Cloudflare Access**
(Zero Trust › Access › Applications › Self-hosted, solo tu correo): no tiene
secretos, pero sí la lista de tus clientes.

---

## La flota

### La lista: `flota.json`

Cada línea dice su **producto**, su **semilla** y su **modo** de actualizarse.
Cada tienda tiene un **anillo**: 0 para la de pruebas, 1 para las primeras, 2
para el resto. «Hasta el anillo N» va en orden y **se detiene si una falla**.
Nada secreto va en este archivo (las pruebas lo comprueban).

### Actualizar

- **Tienda Panel (`montaje`)**: la flota dispara el `montaje` de cada tienda con
  `semilla: true` y espera. La tienda trae la versión nueva, publica el maestro,
  rehornea, corre TODAS las baterías y publica en main; si algo falla, vuelve
  atrás el maestro y queda como estaba. Es lo mismo que el botón *Actualizar*
  del panel y la opción del menú de la hoja.
- **Tienda Básica (`pull-request`)**: la flota abre el pull request con la
  versión nueva, espera las pruebas de la tienda, lo fusiona y dispara su
  montaje. **Excepción**: si trae `publicar/index.html`, se queda abierto
  (fusionarlo antes del montaje dejaría unos minutos la tienda con el index de
  la semilla). Se acaba cuando la Básica aprenda a actualizarse sola.

En las dos, la regla por archivo es la misma —las tres versiones—:

| La tienda… | La semilla… | Qué pasa |
|---|---|---|
| no lo tocó | lo cambió | se sobrescribe |
| lo cambió | no lo cambió | se respeta |
| lo cambió | también lo cambió | **no se toca** y se dice arriba |
| no lo tiene | lo trae nuevo | se agrega |
| — | ya no lo trae | no se borra nada |
| (no se sabe de qué versión salió) | | **no se toca** lo distinto; se lista |

Solo se actualiza a versiones **publicadas con release** (etiquetas `vX.Y.Z`).
**De fábrica, en ensayo**: dice qué haría y no toca nada.

### Los secretos (solo en este repositorio)

| Secreto | Para qué | Permisos (de grano fino, con vencimiento) |
|---|---|---|
| `ALTA_TOKEN` | crear repositorios, llenarlos, ponerles secretos y disparar su montaje | **del mismo dueño de las tiendas**, sobre todos sus repositorios: *Administration*, *Secrets*, *Contents*, *Workflows*, *Actions* en escritura |
| `FLOTA_TOKEN` | leer semillas, empujar ramas, abrir y fusionar pull requests, disparar y esperar montajes | los de la flota: *Contents*, *Pull requests*, *Workflows*, *Actions* en escritura |
| `DISPARO_TOKEN` | `conectar` se lo pone al maestro de cada tienda como `GITHUB_TOKEN`: Publicar y Actualizar desde el panel | todos los repositorios de las tiendas: **solo** *Actions* en escritura |
| `SEMILLA_TOKEN` | el alta lo copia a cada tienda Panel para que se actualice sola con sus flujos | la semilla en lectura; las tiendas con *Contents* y *Workflows* en escritura |

> **Orgánico no tenía la etiqueta `v3.6.1`**, la versión de la que salió
> Cinnamon. Se creó el 22-sep sobre `e5863d5`; hay que subirla con
> `git push origin v3.6.1` desde `organico`.

### Las pruebas

`node flota/pruebas.mjs` — sin red ni token, al principio de cada corrida.

---

## `tienda-nueva.yml` (el de antes)

Lo reemplaza `alta.yml`. Se queda mientras `alta` no haya corrido una vez.

---

## Lo que viene (en este orden)

1. **La Tienda Básica se actualiza sola**, como la Panel: se acaba la excepción
   de `publicar/index.html` y hay un solo modo.
2. **El despliegue en Cloudflare desde Actions** (`wrangler` con un token de
   Cloudflare): el alta quedaría sin ningún clic fuera de Google.
3. **Un panel web de la flota** (detrás de Cloudflare Access): el estado y las
   cifras en una pantalla, con los botones de alta y actualizar.
4. **Tareas de valor para los comercios**: el informe mensual, campañas de
   cupones y avisos de «volvió a llegar» para todas las tiendas a la vez; las
   gráficas de la Básica como extra.
