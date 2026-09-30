# `laboratoriodigital/tiendas` — el repositorio de servicio

Aquí vive lo que es **del negocio de vender tiendas**, no de una tienda:
dar de alta una tienda nueva, conectarla con su hoja, llevar la **flota**
—todas las tiendas publicadas— al día y publicar el panel de administración.
Ninguna tienda ve este repositorio (es privado), y el secreto poderoso
(`FLOTA_TOKEN`; el antiguo `ALTA_TOKEN` se borró el 29-sep-2026) vive solo
aquí.

El procedimiento completo de una tienda Panel —de la cuenta de Google a la
entrega, publicar, actualizar y volver atrás— está en la semilla:
`laboratoriodigital/tienda` › `docs/DESPLIEGUE.md` (el mapa) y
`docs/RUNBOOK-TECNICO.md` (los clics y los incidentes). Este archivo describe
lo que hay en este repositorio.

## Dos productos

| | **Tienda Básica** | **Tienda Panel** |
|---|---|---|
| Semilla | `laboratoriodigital/organico` (3.x) | `laboratoriodigital/tienda` (0.x) |
| Línea en `flota.json` | `organico`, modo `pull-request` | `tienda`, modo `montaje` |
| El comercio trabaja en | su hoja de cálculo | un panel web (y su hoja, si quiere) |
| Velocidad de gestión | rápida: la hoja es directa | más lenta: cada gestión pasa por Apps Script |
| Gráficas | en la pestaña Tablero de la hoja; extras posibles | en el panel |
| Precio | el de entrada | más caro, más fácil de manejar |
| Se actualiza | por pull request, que la flota fusiona sola | sola: su `montaje` con la semilla; la flota la dispara y le entrega los flujos |
| Tiendas en `flota.json` | Orgánico (semilla), Cinnamon Beauty | Laboratorio Digital (semilla), prueba1 |

Las dos venden igual (catálogo, variantes, cupones, envíos, pasarela Bold o
WhatsApp, rastreo). **No se mezclan**: la hoja de una no es la de la otra, y
pasar una tienda de producto es darla de alta de nuevo (decisión 20 de la
semilla `tienda`).

| | Qué | Dónde |
|---|---|---|
| Alta | Crear una tienda nueva, de cualquiera de los dos productos | Actions › **alta**, luego **conectar** |
| Estado | Qué versión tiene cada tienda y qué contesta publicada | Actions › **flota** › `estado` · [`ESTADO.md`](ESTADO.md) (generado) |
| Panel | La flota de un vistazo | [`panel/index.html`](panel/index.html) (generado por `estado`) |
| Actualizar | Poner al día una línea, por anillos | Actions › **flota** › `actualizar` |
| Flujos | Entregar los `.github/workflows` de la semilla a las tiendas Panel | Actions › **flota** › `flujos` (y `actualizar`, sola) |
| Hoja de administración | Publicar `panel.gs` en la hoja *Panel de tiendas* | Actions › **panel** |
| Números | Ventas, pedidos y agotados de todas las tiendas | La hoja **Panel de tiendas** (`panel.gs`), aparte |

---

## Los flujos

Todos se disparan a mano desde Actions › *Run workflow*; solo `flota` corre
además por horario. Todos abren su resumen con una ficha (qué es la corrida,
sobre qué, cómo está la flota y quién la pidió) y ninguno imprime un token.

### `alta` — tres campos

| Entrada | Valores |
|---|---|
| `nombre` | minúsculas, números y guiones, de 3 a 40 (`cafe-la-esquina`): el repositorio y el subdominio |
| `comercio` | como lo verá el comprador |
| `producto` | `tienda` (de fábrica) · `organico` |

Secretos: `FLOTA_TOKEN` (`ALTA_TOKEN` ganaría si alguien lo vuelve a poner); `SEMILLA_TOKEN`
si existe. Qué hace, en orden:

1. `node flota/pruebas.mjs` (sin red) y valida el formulario
   (`flota/alta.mjs validar`): nombre válido, línea que exista, y que ni el
   repositorio ni el sitio `https://<nombre>.<dominio>` estén ya en
   `flota.json`.
2. Comprueba que el token ve la semilla («FLOTA_TOKEN no ve la semilla», o
   `ALTA_TOKEN` si es ese el que usa, con las tres causas) y que el
   repositorio no existe.
3. Busca **la última etiqueta publicada** `vX.Y.Z` de la semilla
   (`nucleo.mjs › ultimaEtiqueta`). No hace falta marcar la semilla como
   plantilla.
4. **Crea el repositorio privado** y lo llena clonando esa etiqueta, limpio de
   lo que es de otra tienda (`NO_SE_HEREDA`: `release.yml`, `Claude outputs`,
   `tienda.json`, `ESTADO.md`, el catálogo, las fotos, las fichas, el
   `sitemap`, la imagen para compartir, `servicio`); rehace `publicar/` desde
   `plantilla/`; pone su `"name"` en `wrangler.jsonc` y quita las `routes` de
   la semilla; y comprueba que cada `node montar/x.mjs` de sus flujos existe
   (si no, se detiene: **el repositorio ya quedó creado, vacío**).
5. Permisos de Actions (escritura, aprobar pull requests), fusión *squash*,
   fusión automática y borrar ramas al fusionar; `SEMILLA_TOKEN` en la tienda.
6. **El resumen es la lista de lo que falta**, en orden; la fila en
   `flota.json` (`anillo: 2`) y un commit aquí.

### `conectar` — tres campos y una casilla

**Dónde está:** github.com/laboratoriodigital/tiendas › pestaña **Actions** ›
en la lista de la izquierda, **conectar** › botón **Run workflow**
([enlace directo](https://github.com/laboratoriodigital/tiendas/actions/workflows/conectar.yml);
también el enlace *Conectar* del panel de la flota).

| Entrada | Valores |
|---|---|
| `nombre` | el nombre corto del alta (se busca por el repositorio en `flota.json`) |
| `maestro_url` | la URL `/exec` del maestro: línea *Servicio* de `A2_diagnosticoCompleto` en el editor del maestro |
| `maestro_token` | el token `tk-…`: línea *Token* de la misma función. **El Diagnóstico del menú de la hoja no lo enseña** |
| `forzar_permiso` | casilla, sin marcar: reemplazar el permiso de GitHub del maestro aunque el que tenga siga sirviendo |

Secretos: `FLOTA_TOKEN` (poner secretos, disparar el montaje), `DISPARO_TOKEN`,
`PANEL_URL`, `PANEL_CLAVE`, `SEMILLA_TOKEN`. Qué hace (`flota/conectar.mjs`):
le pregunta al maestro su hoja y su proyecto (`identidad`) y se planta si la
hoja dice que es de otro repositorio; escribe en la hoja `negocio`,
`repositorio` y `sitio_url` solo donde están vacíos (`sembrar`); comprueba que
`DISPARO_TOKEN` ve la tienda y **solo entonces** se lo pone al maestro como
`GITHUB_TOKEN` (por POST); registra la tienda en la hoja de administración;
pone en la tienda `MAESTRO_URL`, `MAESTRO_TOKEN`, `HOJA_ID`, `SCRIPT_ID` y
refresca `SEMILLA_TOKEN` (0.21.2); y dispara su primer `montaje` (`que=todo`).

**A mano queda solo `CLASPRC`**, la credencial de Google de la tienda
(`clasp login --no-localhost` con su cuenta), para que la tienda publique su
maestro —y pueda terminar una actualización que traiga uno nuevo—.

**Después, Cloudflare**, cuando ese montaje termine: Import a repository. Al
final a propósito: conectado antes, publicaría lo que todavía no es esta
tienda.

### `flota` — estado, actualizar, flujos

| Entrada | De fábrica | Valores |
|---|---|---|
| `accion` | `estado` | `estado` · `actualizar` · `flujos` |
| `linea` | **`organico`** | `organico` · `tienda` (las claves de `lineas`) |
| `anillo` | `'1'` | `'0'` · `'1'` · `'2'`: hasta ese anillo, incluido |
| `version` | vacío | la etiqueta; vacío = la última publicada. En `flujos`, **con `v`** |
| `ensayo` | **marcada** | solo decir qué haría |
| `tienda` | vacío | solo esa: `dueño/repositorio`, el nombre corto o el `nombre` de la fila. En `actualizar` se busca dentro del anillo pedido |
| `sin_base` | `dejar` | `dejar` · `sobrescribir` (solo `pull-request`) |

Secreto: `FLOTA_TOKEN` (sin él, se niega). Comparte el grupo de concurrencia
con `alta`. Antes de nada corre `node flota/pruebas.mjs`.

- **`estado`** (también cada lunes, `23 12 * * 1` = 7:23 en Colombia):
  `flota/estado.mjs` lee la versión del `package.json` de cada repositorio, la
  última etiqueta de cada semilla, el `catalogo.json` publicado de cada `sitio`
  y los pull requests `semilla/*` abiertos. Escribe `ESTADO.md` y
  `panel/index.html` y los guarda aquí. Solo lee.
- **`actualizar`** (`flota/actualizar.mjs`): ver *Actualizar*, abajo.
- **`flujos`** (`flota/flujos.mjs`): ver *Los flujos de las tiendas*, abajo.

### `panel` — publicar `panel.gs`

| Entrada | Valores |
|---|---|
| `version` | la etiqueta de la semilla `tienda`, **con `v`**; vacío = la última publicada |

Secretos: `PANEL_SCRIPT_ID`, `PANEL_CLASPRC` (sin los dos, «Faltan los
secretos» y no toca nada); para leer la semilla, `ALTA_TOKEN` si existe, si
no `FLOTA_TOKEN`, y si no el `GITHUB_TOKEN` de la corrida (que no ve una
semilla privada). Clona la semilla en esa
etiqueta y corre **su** `montar/publicar-maestro.mjs` con `ARCHIVO=panel.gs`
(la misma herramienta que publica el maestro de cada tienda, no una copia):
sube el archivo con clasp 3 y actualiza la implementación que ya existe, sobre
la misma URL. La primera implementación de esa hoja se crea a mano, una vez.

> **Defecto conocido, a hoy (sin verificar en una corrida real):** ningún paso
> escribe `PANEL_CLASPRC` en `~/.clasprc.json`, que es donde lo busca clasp; se
> le pasa a la herramienta como variable `CLASPRC`, que no la lee. Lo esperable
> es «Clasp dice que NO ENCUENTRA CREDENCIALES». Hasta que se corrija,
> `panel.gs` se pega a mano.

---

## La flota

### La lista: `flota.json`

Nada secreto va en este archivo —ni tokens ni URLs de maestros—, y las
pruebas lo comprueban. Lo edita una persona, o `alta` (que agrega filas). Las
claves que empiezan por `_` son comentarios.

```jsonc
{
  "lineas": {
    "tienda":   { "producto": "Tienda Panel", "descripcion": "…", "modo": "montaje",
                  "semilla": "laboratoriodigital/tienda" },
    "organico": { "producto": "Tienda Básica", "descripcion": "…", "modo": "pull-request",
                  "semilla": "laboratoriodigital/organico",
                  "propios": ["maestro.gs", "montar/", "…"] }
  },
  "tiendas": [
    { "nombre": "Laboratorio Digital", "repo": "laboratoriodigital/tienda", "linea": "tienda",
      "semilla": true, "sitio": "https://tienda.laboratorio-digital.com" },
    { "nombre": "prueba1", "repo": "laboratoriodigital/prueba1", "linea": "tienda",
      "anillo": 2, "sitio": "https://prueba1.laboratorio-digital.com" }
  ],
  "dominio": "laboratorio-digital.com"
}
```

| Campo | Qué es |
|---|---|
| `lineas.<clave>.modo` | `montaje`: la tienda se actualiza sola (Tienda Panel); qué es de la semilla lo dice el `semilla.json` de la propia semilla. `pull-request`: la flota aplica la versión desde fuera (Tienda Básica) |
| `lineas.<clave>.semilla` | el repositorio de la semilla |
| `lineas.<clave>.propios` | solo en `pull-request`: qué archivos son de la semilla (las rutas que acaban en `/` son carpetas) |
| `tiendas[].nombre` | el nombre del comercio (el alta pone el que se escribió en `comercio`) |
| `tiendas[].repo` | `dueño/repositorio`. `conectar` busca la tienda por su segunda parte |
| `tiendas[].linea` | la clave de su línea |
| `tiendas[].semilla` | `true` en la semilla misma: sale en el estado y nunca se actualiza |
| `tiendas[].anillo` | `0` pruebas, `1` primeras, `2` el resto (el alta pone `2`). **`"fuera"`** —o cualquier cosa que no sea un número, o no ponerlo— la deja en la lista y en el estado, pero **ningún reparto la toca**: ni `actualizar` ni `flujos` (bitácora 105). Para devolverla, un número |
| `tiendas[].sitio` | la dirección pública: la usan `estado` (lee su `catalogo.json`), `alta` (no repetirla) y `conectar` (la escribe en `sitio_url`) |
| `tiendas[].conserva` | opcional, solo en `pull-request`: rutas de la semilla que esa tienda conserva como suyas |
| `dominio` | con él, el alta propone `https://<nombre>.<dominio>` |

Sirve `"fuera"` para una tienda de prueba abandonada o pausada, que de otro
modo sería la primera en fallar y dejaría sin versión a las que vienen detrás
en su anillo. Una tienda cuyo repositorio da 404 no detiene el reparto: se
salta y se dice al final.

### Actualizar

Solo se actualiza a versiones **publicadas con `release`** (etiquetas
`vX.Y.Z`). **De fábrica, en ensayo**: dice qué haría y no toca nada.

Se eligen las tiendas de la línea, que no sean semilla, con anillo numérico y
menor o igual al pedido (y solo la pedida, si se dio `tienda`), y se recorren
en orden de anillo:

- **Tienda Panel (`montaje`)**: por cada tienda, si su `package.json` ya está en
  esa versión, sigue; si no, dispara su `montaje` con `semilla=true`,
  `que=todo` y la versión, y **espera a que termine**. La tienda trae la
  versión, publica el maestro si cambió, rehornea, corre su guardia
  (`pruebas/tienda-viva.js`) y publica en `main`; si algo falla, vuelve atrás
  el maestro y queda como estaba. Si el montaje falla, **la flota se detiene**
  y dice cuáles quedaron sin tocar y cómo seguir («solo esta tienda», o
  `"anillo": "fuera"`). Si termina bien, **le entrega los flujos**. Es lo mismo
  que el botón *Actualizar* del panel y la opción del menú de la hoja, salvo
  la entrega de flujos, que solo hace la flota.
- **Tienda Básica (`pull-request`)**: la flota clona la tienda y la semilla,
  aplica la versión nueva, abre el pull request `semilla/vX.Y.Z`, espera las
  pruebas de la tienda, lo fusiona y dispara su montaje (con el maestro si
  cambió). **Excepción**: si trae `publicar/index.html`, se queda abierto
  (fusionarlo antes del montaje dejaría unos minutos la tienda con el index de
  la semilla). Se acaba cuando la Básica aprenda a actualizarse sola.

En las dos, la regla por archivo es la misma —las tres versiones: la tienda
hoy, la semilla nueva y la semilla de la que salió la tienda—:

| La tienda… | La semilla… | Qué pasa |
|---|---|---|
| no lo tocó | lo cambió | se sobrescribe |
| lo cambió | no lo cambió | se respeta |
| lo cambió | también lo cambió | **no se toca** y se dice arriba |
| no lo tiene | lo trae nuevo | se agrega |
| — | ya no lo trae | en la Panel, se borra si la versión nueva lo lista en `retirados` de su `semilla.json` (nunca `publicar/` ni `.git`); si no, y en la Básica, no se borra nada |
| (no se sabe de qué versión salió) | | **no se toca** lo distinto; se lista (con `sin_base: sobrescribir`, en la Básica, se pisa) |

### Los flujos de las tiendas (0.22.1 · bitácora 103)

Una tienda no puede escribir sus propios `.github/workflows`: su push va con el
`GITHUB_TOKEN` de Actions, que no puede nunca, y `actions/checkout` deja una
cabecera con ese permiso que gana a cualquier token en la URL. Así que los
entrega la flota, con `FLOTA_TOKEN` y por la API de contenidos: lee el
`semilla.json` de la semilla en esa etiqueta, toma de `propios` los que están
en `.github/workflows/` y escribe en cada tienda solo los que cambian. Desde
la 0.22.3 también **quita** los de `retirados` que la tienda todavía tenga
(nunca uno que la semilla siga entregando): la tienda no puede borrarlos.
`actualizar` lo hace sola tras cada tienda que se actualiza bien; `flujos` lo
hace a mano para toda la línea (sin mirar el anillo, pero saltando las
`"fuera"`) o para una sola tienda, y es el rescate de una que se quedó con
flujos viejos. En una línea `pull-request` no hay nada que entregar: lo dice y
termina.

### Los secretos (solo en este repositorio)

Sin valores, obviamente. Todos los tokens de GitHub, de grano fino, del mismo
dueño que las tiendas y **con vencimiento**. Los que tienen que alcanzar a las
tiendas, sobre **todos** los repositorios del dueño, no sobre una lista: una
lista fija no incluye las tiendas que nacen después, y GitHub contesta 404 —no
403— a lo que el token no ve.

**Tres tokens de GitHub, y ninguno sobra** (29-sep-2026). Se juntan los que
viven en el mismo sitio y los ve la misma gente; no se juntan los que acaban
fuera de aquí, porque ahí cada permiso de más se ve:

- `FLOTA_TOKEN` es **el token del dueño** y hace todo lo de este repositorio:
  `alta`, `conectar`, `flota` y `panel`. Sustituye a `ALTA_TOKEN`: los dos
  vivían solo aquí, sobre los mismos repositorios, y juntos no dan a nadie
  nada que no tuviera ya quien ve estos secretos. Lo que cambia: `flota` (y
  su corrida de los lunes) lleva también *Administration* y *Secrets*, que no
  usa.
- `DISPARO_TOKEN` acaba en las propiedades del script de **cada** maestro, que
  ve quien administre la cuenta de Google de la tienda. Por eso lleva **solo**
  *Actions* y no se junta con nada.
- `SEMILLA_TOKEN` acaba en los secretos de **cada** tienda. Juntarlo con
  `DISPARO_TOKEN` le daría al comercio *Contents* de lectura sobre todos los
  repositorios (en grano fino, un permiso vale para toda la lista de
  repositorios); juntarlo con `FLOTA_TOKEN` repartiría el token del dueño por
  todas las tiendas. Sobra solo si la semilla se hace pública.
- El `GITHUB_TOKEN` de Actions no reemplaza a ninguno: solo alcanza al
  repositorio donde corre, y los tres trabajan sobre otros.

| Secreto | Para qué | Permisos mínimos |
|---|---|---|
| `FLOTA_TOKEN` | `flota`: leer semillas y tiendas (`estado`: `package.json`, etiquetas, pull requests abiertos), disparar y esperar montajes (`actualizar`), escribir y borrar `.github/workflows` en las tiendas (`flujos`, y `actualizar` tras cada tienda); en la Básica, ramas y pull requests. `alta` (ver la semilla, crear el repositorio, clonarla y empujarla, permisos de Actions y fusiones, poner `SEMILLA_TOKEN`) y `conectar` (secretos de la tienda, disparar su montaje) **cuando no hay `ALTA_TOKEN`**. `panel`, para leer la semilla, si no hay `ALTA_TOKEN` | Sobre todos los repositorios del dueño: *Contents*, *Pull requests*, *Workflows*, *Actions*, *Administration* y *Secrets* en lectura y escritura; *Metadata* lectura. Mientras exista `ALTA_TOKEN`, bastan los cuatro primeros |
| `ALTA_TOKEN` | **Borrado de este repositorio el 29-sep-2026.** Si reapareciera, `alta`, `conectar` y `panel` lo usan antes que `FLOTA_TOKEN` (`ALTA_TOKEN \|\| FLOTA_TOKEN`); cuando no está, usan `FLOTA_TOKEN` sin cambiar nada más | *Administration*, *Contents*, *Workflows*, *Secrets* y *Actions* en lectura y escritura |
| `DISPARO_TOKEN` | `conectar` se lo pone al maestro de cada tienda como `GITHUB_TOKEN`, después de comprobar que ve esa tienda: Publicar y Actualizar desde el panel y el menú (el maestro dispara `fotos.yml` y `montaje.yml`, lista sus corridas y lee las etiquetas de la semilla) | **solo** *Actions* en lectura y escritura (*Metadata* lectura va siempre). Nunca otro permiso: es el que ve el comercio |
| `SEMILLA_TOKEN` | `alta` lo copia a cada tienda y `conectar` lo refresca: la tienda lo usa para clonar la semilla al actualizarse (`montaje` con `semilla`, `montar/actualizar-semilla.mjs`) y leer sus etiquetas (`restaurar` › `la-version`). Desde la 0.22.1 ya no empuja flujos | *Contents* lectura, y basta **solo sobre la semilla** (*Only select repositories*: la tienda no necesita verse a sí misma con él, y esa lista no envejece). Solo hace falta si la semilla es privada |

> **Riesgo abierto: `DISPARO_TOKEN` alcanza también a este repositorio.**
> Hecho sobre todos los repositorios del dueño, incluye `tiendas`, y *Actions:
> Read and write* basta para disparar `alta`, `conectar` o `flota` —que corren
> con `FLOTA_TOKEN`—. Quien lo copie de las propiedades del script de una
> tienda puede, por ejemplo, correr `conectar` con el nombre de **otra** tienda
> y la URL de un Apps Script suyo: le cambia `MAESTRO_URL` y dispara su
> montaje. Se cierra haciéndolo sobre *Only select repositories* (las tiendas
> y la semilla, sin `tiendas`) y añadiendo cada tienda nueva a esa lista
> después del alta; `conectar` ya avisa si no la ve. Pendiente de decisión.

| `PANEL_URL` · `PANEL_CLAVE` | opcionales: `conectar` registra la tienda en la hoja de administración | ninguno de GitHub: la URL `/exec` de esa hoja y la clave de su menú › *Clave para el alta* |
| `PANEL_SCRIPT_ID` | el flujo **panel** publica `panel.gs` en la hoja de administración | el id del proyecto: en la URL del editor, entre `/projects/` y `/edit` |
| `PANEL_CLASPRC` | lo mismo: la credencial de Google de la cuenta dueña de esa hoja | el contenido de `~/.clasprc.json` de `clasp login --no-localhost` |
| `CLOUDFLARE_API_TOKEN` · `CLOUDFLARE_ACCOUNT_ID` | opcionales: con los dos, `flota` › `estado` publica `panel/` en Cloudflare (Worker de recursos estáticos, `wrangler.jsonc`) | lo mínimo que necesita `wrangler deploy` de una página estática: **Account › Workers Scripts: Edit** y **Account › Account Settings: Read**. Si el panel va en un dominio propio, además **Zone › Workers Routes: Edit**. Lo demás (KV, R2, Pages, Containers, CI, Observability, Tail, CF Agents) no hace falta. **Sin filtro de IP**: los runners de GitHub cambian de dirección en cada corrida. Ponle **vencimiento** y anótalo |

> **Orgánico no tenía la etiqueta `v3.6.1`**, la versión de la que salió
> Cinnamon. Se creó el 22-sep sobre `e5863d5`; hay que subirla con
> `git push origin v3.6.1` desde `organico`. *(Sin verificar aquí si ya se
> subió.)*

### Las pruebas

`node flota/pruebas.mjs` — sin red ni token, al principio de `alta` y de cada
corrida de `flota`.

---

## El panel de la flota: `panel/index.html`

Una página que escribe `flota › estado` (los lunes y cada vez que se corre),
con la misma información que `ESTADO.md` y los enlaces **Nueva tienda**,
**Conectar** y **Actualizar** (llevan a la pestaña Actions de cada flujo).
Estática, sin JavaScript y sin nada secreto. Para verla en la web: Cloudflare ›
Import a repository › `tiendas` (`wrangler.jsonc` ya dice qué publicar, con el
nombre `flota-panel`), o los dos secretos de Cloudflare de arriba. Cuando se
sirva en una dirección, **protégela con Cloudflare Access** (Zero Trust ›
Access › Applications › Self-hosted, solo tu correo): no tiene secretos, pero sí
la lista de tus clientes.

## La hoja de administración de tiendas (0.17.0)

La hoja «Panel de tiendas» (`panel.gs` de la semilla) es el registro del
negocio: estado, plan, precio, contacto y notas de cada tienda, con sus cifras.
`conectar` le deja la fila sola —comercio, repositorio, sitio, producto,
servicio, token y anillo— si este repositorio tiene `PANEL_URL` y
`PANEL_CLAVE`. Lo que el operador escribió allá (contacto, plan, precio, notas)
no se toca.

Para activarlo: en la hoja, menú **Panel › Clave para el alta**; Implementar ›
Aplicación web (yo · cualquiera); y la URL `/exec` y la clave como secretos.
Las versiones nuevas de `panel.gs` las publica el flujo **panel** (ver el
defecto de arriba).

**El portal** (0.18.0) se abre desde esa misma hoja: menú **Panel › Abrir el
portal**. Es una pantalla con cada tienda —estado, producto, ventas del mes,
pedidos, versión, último respaldo— y sus enlaces: ver la tienda, su panel, su
repositorio, publicar y **volver atrás**. Arriba, las acciones de la flota.
Abrirlo no consulta a ninguna tienda: pinta lo de la última actualización.

Y cada tienda tiene su flujo **`restaurar`**: `el-sitio` vuelve a una
publicación anterior y `la-version` a una versión anterior de la semilla. Los
datos de su hoja se restauran desde el editor de su maestro (`A5_respaldos`,
`A6_restaurarDatos`).

`tienda-nueva.yml`, el alta de antes con sus campos viejos, ya no existe: lo
reemplazan `alta` y `conectar`.

---

## Lo que viene (en este orden)

1. **La Tienda Básica se actualiza sola**, como la Panel: se acaba la excepción
   de `publicar/index.html` y hay un solo modo.
2. **El despliegue en Cloudflare desde Actions** (`wrangler` con un token de
   Cloudflare): el alta quedaría sin ningún clic fuera de Google.
3. **El panel web de la flota detrás de Cloudflare Access**: el estado y las
   cifras en una dirección propia.
4. **Tareas de valor para los comercios**: el informe mensual, campañas de
   cupones y avisos de «volvió a llegar» para todas las tiendas a la vez; las
   gráficas de la Básica como extra.
