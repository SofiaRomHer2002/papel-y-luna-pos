// ---------------------------------------------------------------------------
// sesion.js: iniciar sesión, recuperar la sesión guardada y cerrar sesión.
// El backend entrega un TOKEN al iniciar sesión; api.js lo guarda y lo envía
// en cada petición. El rol (administrador o cajero) lo define el backend.
// ---------------------------------------------------------------------------
import { apiGet, apiPost, apiDelete, leerToken, guardarToken, borrarToken } from "../api/api.js";

// Envía usuario y contraseña al backend. Si son correctos guarda el token y
// devuelve el usuario: { id, usuario, nombre, rol }. Si no, lanza un error con el motivo.
export async function iniciarSesion(usuario, clave) {
  const respuesta = await apiPost("/sesion", { usuario: usuario, clave: clave });
  guardarToken(respuesta.token);
  return respuesta.usuario;
}

// Al abrir la aplicación: si hay un token guardado, le preguntamos al backend si sigue
// vigente. Devuelve el usuario, o null si no hay sesión (o ya venció).
export async function recuperarSesion() {
  if (leerToken() === "") {
    return null;
  }
  try {
    const respuesta = await apiGet("/sesion");
    return respuesta.usuario;
  } catch (error) {
    // El token ya no sirve (o no hay conexión): se pedirá iniciar sesión otra vez
    console.warn("No se pudo recuperar la sesión:", error.message);
    return null;
  }
}

// Cierra la sesión: el backend borra el token y aquí lo olvidamos
export async function cerrarSesion() {
  try {
    await apiDelete("/sesion");
  } catch (error) {
    // Si no hay conexión igual cerramos la sesión en este dispositivo
    console.warn("No se pudo avisar al servidor del cierre de sesión:", error.message);
  }
  borrarToken();
}

// Dice si el usuario es administrador (para mostrar u ocultar las funciones administrativas).
// Ocultar botones es solo comodidad: el backend revisa el rol en cada petición.
export function esAdministrador(usuario) {
  if (!usuario) {
    return false;
  }
  return usuario.rol === "administrador";
}
