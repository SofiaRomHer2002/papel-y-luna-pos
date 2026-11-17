// ---------------------------------------------------------------------------
// validaciones.js: revisan lo que escribe la persona ANTES de enviarlo al backend.
// (El backend vuelve a validar todo: estas revisiones son para avisar más rápido.)
// Cada función devuelve un texto con el problema, o "" si todo está bien.
// ---------------------------------------------------------------------------
import { buscarPorId } from "./calculos.js";
import { soloDigitos } from "./formato.js";

// Valida los datos del formulario de producto.
// "valores" trae textos (lo que escribió la persona), por eso aquí revisamos si están vacíos.
export function validarProducto(valores, categorias, modo) {
  if (valores.nombre.trim() === "") {
    return "El nombre del producto es obligatorio.";
  }

  if (valores.categoriaId === "") {
    return "Elige una categoría para el producto.";
  }

  // La categoría tiene que existir de verdad (el producto la referencia por id)
  if (!buscarPorId(categorias, valores.categoriaId)) {
    return "La categoría elegida ya no existe. Elige otra.";
  }

  if (valores.precio.trim() === "") {
    return "Escribe el precio de venta.";
  }

  if (valores.costo.trim() === "") {
    return "Escribe el costo del producto.";
  }

  // En el flujo de venta no se edita el inventario, así que no se revisa
  if (modo === "completo" && valores.seguimiento && valores.stock.trim() === "") {
    return "Escribe el stock: el producto tiene seguimiento de inventario.";
  }

  return "";
}

// Valida los datos de una categoría, proveedor, cliente o descuento.
// "campos" es la lista de campos de ese formulario (viene de config de la pantalla).
export function validarEntidad(valores, campos) {
  for (let i = 0; i < campos.length; i++) {
    const campo = campos[i];
    const texto = String(valores[campo.clave] || "").trim();

    // Campo obligatorio vacío
    if (campo.requerido && texto === "") {
      return "El campo \"" + campo.etiqueta + "\" es obligatorio.";
    }

    // Correo: si lo escribieron, debe tener forma de correo (algo@algo.algo)
    if (campo.tipo === "email" && texto !== "") {
      const posicionArroba = texto.indexOf("@");
      const posicionPunto = texto.lastIndexOf(".");
      if (posicionArroba < 1 || posicionPunto < posicionArroba + 2 || posicionPunto === texto.length - 1) {
        return "Escribe un correo válido, por ejemplo nombre@correo.com.";
      }
    }

    // Número: debe ser mayor que cero
    if (campo.tipo === "numero" && texto !== "") {
      if (Number(soloDigitos(texto)) < 1) {
        return "El campo \"" + campo.etiqueta + "\" debe ser mayor que cero.";
      }
    }

    // Teléfono: si lo escribieron, debe tener al menos 7 dígitos
    if (campo.tipo === "tel" && texto !== "") {
      if (soloDigitos(texto).length < 7) {
        return "El teléfono debe tener al menos 7 dígitos.";
      }
    }
  }

  return "";
}

// Regla extra de los descuentos: un porcentaje no puede pasar de 100
export function validarDescuento(valores) {
  if (valores.tipo === "porcentual" && Number(valores.valor) > 100) {
    return "Un descuento en porcentaje no puede ser mayor que 100.";
  }
  return "";
}
