// ---------------------------------------------------------------------------
// compras.js: registrar una compra a un proveedor.
// Una sola petición: el backend guarda la compra, suma el stock y actualiza el
// costo de cada producto dentro de una transacción.
// ---------------------------------------------------------------------------
import { apiPost } from "../api/api.js";

// Registra la compra. "compra" trae { id, proveedorId, fecha, lineas: [{ productoId, nombre, cantidad, costo }] }.
// Devuelve { compra, productos }: la compra guardada y los productos ya actualizados.
export async function registrarCompra(compra) {
  return await apiPost("/compras", {
    id: compra.id,
    proveedorId: compra.proveedorId,
    fecha: compra.fecha,
    items: compra.lineas
  });
}
