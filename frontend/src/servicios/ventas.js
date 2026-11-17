// ---------------------------------------------------------------------------
// ventas.js: operaciones de las ventas contra el backend.
// Las pantallas llaman a estas funciones; aquí no hay nada de HTML.

import { apiPost, apiPut } from "../api/api.js";
import { nuevoId } from "../utils/ids.js";

// Crea una venta nueva y vacía en memoria (todavía no existe en el backend: guardada = false)
export function crearVentaNueva() {
  return {
    id: nuevoId(),
    fecha: new Date().toISOString(),
    items: [],
    clienteId: "",
    descuentoId: "",
    guardada: false
  };
}

// Convierte una venta ABIERTA que viene del backend en la "venta en curso" de la pantalla.
// Solo necesitamos el id del producto y la cantidad: el precio se toma del catálogo actual.
export function ventaParaPantalla(venta) {
  const items = venta.items.map(function (linea) {
    return { productoId: linea.productoId, nombre: linea.nombre, cantidad: linea.cantidad };
  });
  return {
    id: venta.id,
    fecha: venta.fecha,
    items: items,
    clienteId: venta.clienteId,
    descuentoId: venta.descuentoId,
    guardada: true
  };
}

// Deja de cada línea solo lo que el backend necesita: qué producto y cuántas unidades.
// Los precios NO se envían: el backend usa los de la base de datos (así nadie puede alterarlos).
function armarItems(items) {
  return items.map(function (item) {
    return { productoId: item.productoId, nombre: item.nombre, cantidad: item.cantidad };
  });
}

// Guarda la venta con estado "abierta" (para retomarla después). NO toca el stock.
// PUT /ventas/:id  -> la crea si no existía o la actualiza si ya estaba guardada.
export async function guardarVentaAbierta(venta) {
  return await apiPut("/ventas/" + venta.id, {
    fecha: venta.fecha,
    clienteId: venta.clienteId,
    descuentoId: venta.descuentoId,
    items: armarItems(venta.items)
  });
}

// Cobra y cierra la venta. POST /ventas/:id/cierre
// "pago" trae { metodoPago, clienteId, valorRecibido }.
// "totalEsperado" es el total que vio el cajero: si en el backend da otro valor (porque
// alguien cambió un precio mientras tanto), la venta NO se cierra y se avisa.
// Devuelve { venta, productos }: la venta cerrada y los productos con su stock nuevo.
export async function cerrarVenta(venta, pago, totalEsperado) {
  return await apiPost("/ventas/" + venta.id + "/cierre", {
    clienteId: pago.clienteId,
    descuentoId: venta.descuentoId,
    metodoPago: pago.metodoPago,
    valorRecibido: pago.valorRecibido,
    totalEsperado: totalEsperado,
    items: armarItems(venta.items)
  });
}

// Corrige una venta cerrada (solo administrador). PUT /ventas/:id/correccion
// "correccion" trae { items, clienteId, metodoPago, valorRecibido, descuentoId, conservarDescuento }.
// Devuelve { venta, productos } igual que cerrarVenta.
export async function corregirVenta(ventaId, correccion) {
  return await apiPut("/ventas/" + ventaId + "/correccion", correccion);
}

// Registra un reembolso (solo administrador). POST /ventas/:id/reembolsos
// "items" es una lista de { detalleId, cantidad, retornaInventario }.
// El id del reembolso se genera una sola vez: si hay que reintentar, no se duplica.
export async function reembolsarVenta(ventaId, reembolsoId, items) {
  return await apiPost("/ventas/" + ventaId + "/reembolsos", { id: reembolsoId, items: items });
}
