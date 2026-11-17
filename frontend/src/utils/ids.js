// ---------------------------------------------------------------------------
// ids.js: funciones pequeñas para trabajar con ids y códigos.
// ---------------------------------------------------------------------------

// Genera un id único para un registro nuevo (el id SIEMPRE se genera en el frontend)
export function nuevoId() {
  // crypto.randomUUID solo existe en páginas seguras (https o localhost)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Plan B (por ejemplo al probar desde el celular por http): la hora actual + un número al azar
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
}

// Compara dos ids como TEXTO (por si uno llega como número y el otro como texto)
export function sonIguales(a, b) {
  return String(a) === String(b);
}
