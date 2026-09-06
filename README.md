# El repositorio de servicio

Lo que hay en esta carpeta **no corre aquí**. Va copiado en
`laboratoriodigital/tiendas`, que es el repositorio desde donde se dan de alta
las tiendas.

## Por qué separado

Este repositorio es la **plantilla**. Pedirle el nombre de un repositorio nuevo
desde dentro de un repositorio que ya *es* el nuevo no tiene sentido, y cada
tienda heredaría en su copia un flujo que no va a usar nunca.

Y hay una razón más fuerte: el alta necesita un token capaz de **crear
repositorios y escribir secretos**. Ese token tiene que vivir en un solo sitio,
y ese sitio no puede ser algo de lo que se saquen copias.

El archivo se queda versionado aquí porque aquí están sus aserciones
(`pruebas/montaje.js`, batería 11), que es lo que impide que las dos copias se
separen. Cuando cambies `servicio/tienda-nueva.yml`, cópialo otra vez.

## Montarlo, una sola vez

1. Crear `laboratoriodigital/tiendas`, **privado**.
2. Subir `tienda-nueva.yml` a `.github/workflows/tienda-nueva.yml`.
3. Crear el token de grano fino con los permisos que dice el encabezado de ese
   archivo, y guardarlo como el secreto **`ALTA_TOKEN`**.
4. Marcar `laboratoriodigital/organico` como **Template repository**
   (Settings → arriba del todo).

Desde ahí: Actions → **tienda nueva** → Run workflow.

## Qué hace, y qué no

| | |
|---|---|
| ✔ | Crea el repositorio de la tienda a partir de la plantilla |
| ✔ | Le pone **su propio `name`** en `wrangler.jsonc` — dos tiendas con el mismo nombre son el mismo sitio en Cloudflare, y la segunda pisa a la primera |
| ✔ | Le deja a Actions permiso de abrir pull requests, y las ramas se borran al fusionar |
| ✔ | Le carga `MAESTRO_URL` y `MAESTRO_TOKEN`, si se los pasas |
| ✘ | Cloudflare: ese diálogo es del navegador |
| ✘ | Google: cuenta, hoja, maestro e `instalar()` son el bloque D del runbook |

## Lo que puede crecer aquí

El panel de tiendas, los cobros y los informes son de este lado, no del de la
plantilla: son del negocio de vender tiendas, no de la tienda. Hoy no están —
el panel vive en su propia hoja de cálculo, con `panel.gs`.
