// ---------------------------------------------------------------------------
// calculos.js: cálculos de la venta y utilidades para trabajar con listas.
// Son funciones "puras": reciben datos y devuelven un resultado, no tocan la pantalla.
// ---------------------------------------------------------------------------
import { TASA_IVA_PORCENTAJE } from "../config.js";
import { formatearPrecio } from "./formato.js";
import { sonIguales } from "./ids.js";

// Busca en una lista el registro que tenga ese id (devuelve undefined si no está)
export function buscarPorId(lista, id) {
  return lista.find(function (registro) {
    return sonIguales(registro.id, id);
  });
}

// Devuelve el nombre del registro con ese id, o un texto por defecto si no existe
export function nombreDe(lista, id, textoSiNoHay) {
  const registro = buscarPorId(lista, id);
  if (registro) {
    return registro.nombre;
  }
  return textoSiNoHay;
}

// Devuelve una lista NUEVA donde el registro con el mismo id fue reemplazado.
// Si no estaba, lo agrega al final. (En React nunca se modifica el arreglo original.)
export function reemplazarEnLista(lista, registroNuevo) {
  let encontrado = false;
  const resultado = lista.map(function (registro) {
    if (sonIguales(registro.id, registroNuevo.id)) {
      encontrado = true;
      return registroNuevo;
    }
    return registro;
  });
  if (!encontrado) {
    resultado.push(registroNuevo);
  }
  return resultado;
}

// Devuelve una lista NUEVA sin el registro con ese id
export function quitarDeLista(lista, id) {
  return lista.filter(function (registro) {
    return !sonIguales(registro.id, id);
  });
}

// Une cada línea de la venta ({ productoId, cantidad }) con los datos ACTUALES de su producto.
// Así, si cambiamos el precio de un producto, la venta en curso se actualiza sola.
export function describirItems(items, productos) {
  const lineas = [];

  items.forEach(function (item) {
    const producto = buscarPorId(productos, item.productoId);

    if (producto) {
      lineas.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        producto: producto,
        nombre: producto.nombre,
        precio: producto.precio,
        costo: producto.costo,
        subtotal: producto.precio * item.cantidad
      });
    } else {
      // El producto ya no existe en el catálogo (alguien lo eliminó): dejamos la línea marcada
      lineas.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        producto: null,
        nombre: item.nombre || "Producto eliminado",
        precio: 0,
        costo: 0,
        subtotal: 0
      });
    }
  });

  return lineas;
}

// Calcula cuántos pesos resta un descuento. El descuento se aplica al TOTAL de la venta
// (subtotal + IVA), no a cada producto. "descuento" trae { tipo, valor }.
//   porcentual: valor es el porcentaje (10 = 10 %)
//   fijo: valor son pesos
export function calcularMontoDescuento(descuento, totalSinDescuento) {
  if (!descuento) {
    return 0; // la venta no tiene descuento
  }
  if (descuento.tipo === "porcentual") {
    return Math.round((totalSinDescuento * descuento.valor) / 100);
  }
  return descuento.valor;
}

// Calcula subtotal, IVA, descuento y total de una venta (todo en pesos enteros).
// "descuento" es opcional (el descuento elegido, o null / undefined si no hay).
// El backend hace este mismo cálculo al guardar: el suyo es el que vale.
export function calcularTotales(lineas, descuento) {
  let subtotal = 0;
  lineas.forEach(function (linea) {
    subtotal = subtotal + linea.subtotal;
  });

  // Math.round evita decimales: el dinero se guarda siempre como número entero
  const iva = Math.round((subtotal * TASA_IVA_PORCENTAJE) / 100);
  const totalSinDescuento = subtotal + iva;
  const montoDescuento = calcularMontoDescuento(descuento, totalSinDescuento);

  // Regla: un descuento no puede dejar el total en negativo
  const descuentoExcede = montoDescuento > totalSinDescuento;

  return {
    subtotal: subtotal,
    iva: iva,
    descuento: montoDescuento,
    descuentoExcede: descuentoExcede,
    total: totalSinDescuento - montoDescuento
  };
}

// Texto corto que describe un descuento: "10 %" o "$ 2.000"
export function describirDescuento(tipo, valor) {
  if (tipo === "porcentual") {
    return valor + " %";
  }
  return formatearPrecio(valor);
}

// Cuenta cuántas unidades hay en total en la venta (para el globito de la barra)
export function contarUnidades(items) {
  let unidades = 0;
  items.forEach(function (item) {
    unidades = unidades + item.cantidad;
  });
  return unidades;
}
