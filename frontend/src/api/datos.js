// ---------------------------------------------------------------------------
// datos.js: capa intermedia entre la aplicación y api.js para las operaciones
// comunes (leer, crear, actualizar y eliminar) de cualquier recurso:
// productos, categorias, clientes, proveedores, descuentos, ventas, compras, faltantes.
//
// En el MVP 2 este archivo también "normalizaba" los tipos, porque Google Sheets
// devolvía números como texto. El backend propio ya responde con los tipos
// correctos (la base de datos tiene columnas con tipo), así que ya no hace falta.
// ---------------------------------------------------------------------------
import { apiGet, apiPost, apiPut, apiDelete } from "./api.js";

// Lee todos los registros de un recurso (GET /recurso).
// "filtros" es opcional: un texto como "?estado=pendiente" que se agrega a la dirección.
export async function leerRecurso(recurso, filtros) {
  let ruta = "/" + recurso;
  if (filtros) {
    ruta = ruta + filtros;
  }
  return await apiGet(ruta);
}

// Crea un registro (POST /recurso). El id lo genera quien llama.
export async function crearRecurso(recurso, datos) {
  return await apiPost("/" + recurso, datos);
}

// Actualiza un registro (PUT /recurso/id). Solo cambian los campos que se envíen.
export async function actualizarRecurso(recurso, datos) {
  return await apiPut("/" + recurso + "/" + datos.id, datos);
}

// Elimina un registro por su id (DELETE /recurso/id)
export async function eliminarRecurso(recurso, id) {
  await apiDelete("/" + recurso + "/" + id);
  return id;
}
