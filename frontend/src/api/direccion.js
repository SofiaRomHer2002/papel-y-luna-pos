// VITE_API_URL puede contener el origen del backend o terminar en /api.
export function resolverApiUrl(valor, desarrollo, hostname) {
  let direccion = (valor || "").trim().replace(/\/+$/, "");
  if (!direccion) {
    direccion = desarrollo
      ? "http://" + hostname + ":8000"
      : "https://papelyluna-api.onrender.com";
  }
  const url = new URL(direccion);
  if (!desarrollo && url.protocol !== "https:") {
    throw new Error("VITE_API_URL debe usar HTTPS en producción.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
    throw new Error("VITE_API_URL debe ser una URL HTTP sin credenciales, parámetros ni fragmentos.");
  }
  return direccion.endsWith("/api") ? direccion : direccion + "/api";
}
