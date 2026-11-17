// ---------------------------------------------------------------------------
// formato.js: funciones para mostrar y leer valores (dinero, fechas, números).
// ---------------------------------------------------------------------------

// Convierte un número a pesos colombianos (ejemplo: 50000 -> "$ 50.000")
export function formatearPrecio(valor) {
  return Number(valor).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  });
}

// Convierte una fecha ISO que entrega el backend a un texto fácil de leer
export function formatearFecha(textoIso) {
  if (!textoIso) {
    return "";
  }
  const fecha = new Date(textoIso);
  // Si el texto no es una fecha válida, lo mostramos tal cual
  if (isNaN(fecha.getTime())) {
    return String(textoIso);
  }
  return fecha.toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// Solo la hora de una fecha ISO (ejemplo: "3:45 p. m."), para las ventas en espera
export function formatearHora(textoIso) {
  const fecha = new Date(textoIso);
  if (isNaN(fecha.getTime())) {
    return "";
  }
  return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

// Código corto y legible de una venta, sacado de su id largo (ejemplo: "V-3F9A2C")
export function codigoCorto(id) {
  const sinGuiones = String(id).split("-").join("");
  return "V-" + sinGuiones.slice(0, 6).toUpperCase();
}

// Deja en un texto SOLO los dígitos 0-9 (la expresión /[^0-9]/g significa "todo lo que no sea un dígito")
export function soloDigitos(texto) {
  return String(texto).replace(/[^0-9]/g, "");
}

// Convierte lo que escribió la persona en un número entero (vacío = 0)
export function aEntero(texto) {
  const limpio = soloDigitos(texto);
  if (limpio === "") {
    return 0;
  }
  return Number(limpio);
}

// Convierte una fecha (objeto Date) al formato que entiende <input type="date"> (AAAA-MM-DD)
export function fechaParaInput(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return fecha.getFullYear() + "-" + mes + "-" + dia;
}

// Fecha de hoy en el formato de <input type="date">
export function fechaDeHoyParaInput() {
  return fechaParaInput(new Date());
}

// Fecha de hace "dias" días en el formato de <input type="date"> (para los reportes)
export function fechaHaceDiasParaInput(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaParaInput(fecha);
}

// Convierte "2026-11-16" en un texto corto como "16 nov 2026" (para las tablas de reportes)
export function formatearDia(textoDia) {
  const fecha = new Date(textoDia + "T12:00:00");
  if (isNaN(fecha.getTime())) {
    return String(textoDia);
  }
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// Convierte la fecha elegida en el <input type="date"> a texto ISO para guardarla.
// Si es hoy se guarda la hora actual; si es otro día, el mediodía de ese día.
export function fechaIsoDesdeInput(valor) {
  if (valor === fechaDeHoyParaInput()) {
    return new Date().toISOString();
  }
  return new Date(valor + "T12:00:00").toISOString();
}

// Escribe "1 producto" o "3 productos" según la cantidad
export function textoCantidad(cantidad, singular, plural) {
  if (cantidad === 1) {
    return cantidad + " " + singular;
  }
  return cantidad + " " + plural;
}
