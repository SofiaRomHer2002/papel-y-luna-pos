// ---------------------------------------------------------------------------
// configEntidades.js: describe cada una de las cuatro entidades que se gestionan igual
// (categorías, proveedores, clientes y descuentos): qué recurso del backend usan, cómo se
// llaman en pantalla y qué campos tienen. El gestor y el formulario se adaptan a esta config.
// Campos mínimos pedidos en el documento:
//   categorías: nombre | proveedores y clientes: nombre, teléfono y correo
//   descuentos: nombre, tipo (porcentual o valor fijo) y valor
// Tipos de campo: "text", "tel", "email", "numero" (solo dígitos) y "select" (lista de opciones).
// ---------------------------------------------------------------------------
import { TIPOS_DESCUENTO } from "../config.js";
import { formatearPrecio } from "../utils/formato.js";
import { validarDescuento } from "../utils/validaciones.js";

export const CONFIG_CATEGORIAS = {
  recurso: "categorias", // nombre del recurso en la API: /api/categorias
  icono: "carpeta",
  titulo: "Categorías",
  nuevo: "Nueva categoría",
  editar: "Editar categoría",
  leyenda: "Datos de la categoría",
  descripcionVacia: "Las categorías agrupan tus productos (por ejemplo: Escritura, Papelería).",
  campos: [{ clave: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ejemplo: "Ejemplo: Escritura" }]
};

export const CONFIG_PROVEEDORES = {
  recurso: "proveedores",
  icono: "camion",
  titulo: "Proveedores",
  nuevo: "Nuevo proveedor",
  editar: "Editar proveedor",
  leyenda: "Datos del proveedor",
  descripcionVacia: "Los proveedores son a quienes les compras mercancía.",
  campos: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ejemplo: "Ejemplo: Distribuidora Escolar" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: false, ejemplo: "3001234567" },
    { clave: "correo", etiqueta: "Correo", tipo: "email", requerido: false, ejemplo: "ventas@proveedor.com" }
  ]
};

export const CONFIG_CLIENTES = {
  recurso: "clientes",
  icono: "usuario",
  titulo: "Clientes",
  nuevo: "Nuevo cliente",
  editar: "Editar cliente",
  leyenda: "Datos del cliente",
  descripcionVacia: "Los clientes se asocian a las ventas. Para vender en Debe es obligatorio elegir uno.",
  campos: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ejemplo: "Ejemplo: María Gómez" },
    { clave: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: false, ejemplo: "3001234567" },
    { clave: "correo", etiqueta: "Correo", tipo: "email", requerido: false, ejemplo: "maria@correo.com" }
  ]
};

// Descuentos: catálogo reutilizable que se aplica al total de una venta (nuevo en el MVP 3)
export const CONFIG_DESCUENTOS = {
  recurso: "descuentos",
  icono: "porcentaje",
  titulo: "Descuentos",
  nuevo: "Nuevo descuento",
  editar: "Editar descuento",
  leyenda: "Datos del descuento",
  descripcionVacia: "Los descuentos se crean aquí una vez y luego se eligen al cobrar una venta. Solo se aplica uno por venta.",
  campos: [
    { clave: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true, ejemplo: "Ejemplo: Estudiantes 10 %" },
    { clave: "tipo", etiqueta: "Tipo de descuento", tipo: "select", requerido: true, opciones: TIPOS_DESCUENTO },
    { clave: "valor", etiqueta: "Valor", tipo: "numero", requerido: true, ejemplo: "10", ayuda: "Si es porcentaje, escribe un número de 1 a 100. Si es valor fijo, escribe los pesos." }
  ],
  // Regla propia de los descuentos (un porcentaje no puede pasar de 100)
  validarExtra: validarDescuento,
  // Texto que se muestra debajo del nombre en la lista
  detalle: function (descuento) {
    if (descuento.tipo === "porcentual") {
      return "Descuenta el " + descuento.valor + " % del total";
    }
    return "Descuenta " + formatearPrecio(descuento.valor) + " del total";
  }
};
