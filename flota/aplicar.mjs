/* Aplica una versión de la semilla sobre la copia de una tienda, archivo por
   archivo, con la tabla de flota/nucleo.mjs. Solo disco: ni red ni git, para
   que se pueda probar entero con carpetas de juguete (flota/pruebas.mjs). */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { decidir, esPropio } from './nucleo.mjs';

function archivosDe(raiz) {
  const salida = [];
  const andar = (d) => {
    for (const n of readdirSync(d)) {
      if (n === '.git' || n === 'node_modules') continue;
      const r = join(d, n);
      if (statSync(r).isDirectory()) andar(r);
      else salida.push(relative(raiz, r).split(sep).join('/'));
    }
  };
  andar(raiz);
  return salida.sort();
}

const leer = (raiz, ruta) => (raiz && existsSync(join(raiz, ruta))) ? readFileSync(join(raiz, ruta)) : null;

/* `sinBase`: qué hacer con un archivo distinto cuando no se sabe de qué versión
   salió la tienda. De fábrica 'dejar' —no se pierde nada que no se vea—; con
   'sobrescribir' se pisa, y el pull request lo lista igual. */
export function aplicar({ tiendaDir, nuevaDir, baseDir, propios, conserva = [], sinBase = 'dejar', version = '' }) {
  const informe = { sobrescritos: [], sinBase: [], sinBaseDejados: [], nuevos: [], propios: [], desvios: [], conservados: [] };
  const conocida = !!baseDir;
  for (const ruta of archivosDe(nuevaDir)) {
    if (!esPropio(ruta, propios)) continue;
    if (esPropio(ruta, conserva)) { informe.conservados.push(ruta); continue; }
    const T = leer(tiendaDir, ruta), N = leer(nuevaDir, ruta), B = leer(baseDir, ruta);
    const d = decidir(T, N, B, conocida);
    const escribir = () => {
      mkdirSync(dirname(join(tiendaDir, ruta)), { recursive: true });
      writeFileSync(join(tiendaDir, ruta), N);
    };
    if (d === 'agregar') { escribir(); informe.nuevos.push(ruta); }
    else if (d === 'sobrescribir') { escribir(); informe.sobrescritos.push(ruta); }
    else if (d === 'sobrescribir-sin-base') {
      if (sinBase === 'sobrescribir') { escribir(); informe.sinBase.push(ruta); }
      else informe.sinBaseDejados.push(ruta);
    }
    else if (d === 'conservar-propio') informe.propios.push(ruta);
    else if (d === 'desvio') informe.desvios.push(ruta);
  }
  informe.cambia = informe.sobrescritos.length + informe.sinBase.length + informe.nuevos.length > 0;
  /* LA VERSIÓN DE LA TIENDA ES LA DE LA SEMILLA QUE LLEVA, aunque su
     package.json tenga algo propio (un nombre, un script) y por eso no se haya
     sobrescrito entero. Sin esto, la corrida siguiente creería que sigue en la
     vieja y compararía contra la base equivocada. Solo se toca ese campo. */
  const pj = join(tiendaDir, 'package.json');
  if (informe.cambia && version && existsSync(pj)) {
    const texto = readFileSync(pj, 'utf8');
    const nuevo = texto.replace(/("version"\s*:\s*")[^"]*(")/, '$1' + String(version).replace(/^v/, '') + '$2');
    if (nuevo !== texto) writeFileSync(pj, nuevo);
  }
  return informe;
}
