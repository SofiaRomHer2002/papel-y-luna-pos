// ---------------------------------------------------------------------------
// reportes.js: pide los reportes al backend (solo administrador).
// Los cálculos los hace el backend con los datos de la base de datos; aquí solo
// se arma la dirección con el rango de fechas.
// ---------------------------------------------------------------------------
import { apiGet } from "../api/api.js";

// Reportes que usan rango de fechas. "nombre" puede ser: "ventas", "productos-vendidos" o "compras".
// "desde" y "hasta" van en formato AAAA-MM-DD (el mismo de <input type="date">).
export async function leerReportePorFechas(nombre, desde, hasta) {
  return await apiGet("/reportes/" + nombre + "?desde=" + desde + "&hasta=" + hasta);
}

// Faltantes frecuentes: productos con más solicitudes
export async function leerReporteFaltantes() {
  return await apiGet("/reportes/faltantes");
}

// Faltantes pendientes agrupados por proveedor y producto (para armar la próxima compra)
export async function leerFaltantesPorProveedor() {
  return await apiGet("/reportes/faltantes-por-proveedor");
}
