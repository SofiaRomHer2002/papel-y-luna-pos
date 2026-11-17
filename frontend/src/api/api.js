// ---------------------------------------------------------------------------
// api.js: ÚNICO archivo que sabe cómo hablar con el backend (Django).
// En el MVP 2 este archivo hablaba con Google Apps Script; para la entrega final
// solo cambió este módulo (y datos.js): ahora usa una API REST con verbos HTTP.
//
//   GET    = consultar        POST   = crear
//   PUT    = actualizar       DELETE = eliminar
//
// En cada petición se envía el TOKEN de la sesión para que el backend sepa quién
// es el usuario y qué rol tiene.
// ---------------------------------------------------------------------------
import { TIEMPO_MAXIMO_ESPERA } from "../config.js";

// Dirección del backend.
//  - Al publicar la aplicación se define en la variable VITE_API_URL (archivo .env).
//  - En desarrollo, si no está definida, usamos el mismo computador donde se abrió
//    la página, en el puerto 8000 (así también funciona al probar desde el celular).
let direccion = "http://" + window.location.hostname + ":8000/api";
if (import.meta.env.VITE_API_URL) {
  direccion = import.meta.env.VITE_API_URL;
}
export const API_URL = direccion;

// ----- Token de la sesión -----
// El token se guarda en localStorage para que la sesión se mantenga al recargar la página.
// (Los datos del negocio NO se guardan aquí: viven en la base de datos del backend.)
const CLAVE_TOKEN = "papelyluna-token";

// Devuelve el token guardado, o "" si no hay
export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN) || "";
  } catch (error) {
    // Algunos navegadores en modo privado no dejan usar localStorage
    console.warn("No se pudo leer el token guardado:", error);
    return "";
  }
}

// Guarda el token que entregó el backend al iniciar sesión
export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE_TOKEN, token);
  } catch (error) {
    console.warn("No se pudo guardar el token:", error);
  }
}

// Borra el token (al cerrar sesión o cuando el backend dice que ya venció)
export function borrarToken() {
  try {
    localStorage.removeItem(CLAVE_TOKEN);
  } catch (error) {
    console.warn("No se pudo borrar el token:", error);
  }
}

// Función que App.jsx registra para enterarse de que la sesión venció
let avisarSesionVencida = null;

export function registrarAvisoSesionVencida(funcion) {
  avisarSesionVencida = funcion;
}

// Función interna: manda la petición, controla el tiempo máximo de espera
// y traduce los errores técnicos a mensajes que una persona entienda.
async function enviar(metodo, ruta, datos) {
  // AbortController nos permite cancelar el fetch si el backend tarda demasiado
  const controlador = new AbortController();
  const temporizador = setTimeout(function () {
    controlador.abort();
  }, TIEMPO_MAXIMO_ESPERA);

  // Encabezados: avisamos que hablamos JSON y, si hay sesión, mandamos el token
  const encabezados = { "Content-Type": "application/json" };
  const token = leerToken();
  if (token !== "") {
    encabezados["Authorization"] = "Bearer " + token;
  }

  const opciones = { method: metodo, headers: encabezados, signal: controlador.signal };
  if (datos !== undefined) {
    opciones.body = JSON.stringify(datos); // el cuerpo viaja como texto JSON
  }

  let respuesta;
  try {
    respuesta = await fetch(API_URL + ruta, opciones);
  } catch (error) {
    // fetch solo falla (reject) por problemas de red o por cancelación, no por errores del servidor
    if (error.name === "AbortError") {
      throw new Error("El servidor tardó demasiado en responder. Inténtalo de nuevo.");
    }
    throw new Error("No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    // Pase lo que pase, apagamos el temporizador
    clearTimeout(temporizador);
  }

  // Convertimos la respuesta a JSON
  let json;
  try {
    json = await respuesta.json();
  } catch (error) {
    console.error("Respuesta no válida del servidor:", error);
    throw new Error("El servidor respondió algo inesperado. Inténtalo de nuevo.");
  }

  // respuesta.ok es true cuando el código HTTP es 200-299 (todo salió bien)
  if (respuesta.ok) {
    return json;
  }

  // 401 = la sesión venció o el token no sirve: volvemos a la pantalla de inicio de sesión.
  // (En la ruta /sesion un 401 solo significa "usuario o contraseña incorrectos".)
  if (respuesta.status === 401 && ruta !== "/sesion") {
    borrarToken();
    if (avisarSesionVencida) {
      avisarSesionVencida();
    }
  }

  // Cualquier otro error trae un mensaje escrito por el backend: { "mensaje": "..." }
  let mensaje = "Ocurrió un error. Inténtalo de nuevo.";
  if (json && json.mensaje) {
    mensaje = json.mensaje;
  }
  throw new Error(mensaje);
}

// Consulta (GET). Ejemplo: apiGet("/productos")
export async function apiGet(ruta) {
  return await enviar("GET", ruta, undefined);
}

// Crea (POST). Ejemplo: apiPost("/clientes", { nombre: "Ana" })
export async function apiPost(ruta, datos) {
  return await enviar("POST", ruta, datos);
}

// Actualiza (PUT). Ejemplo: apiPut("/clientes/123", { nombre: "Ana María" })
export async function apiPut(ruta, datos) {
  return await enviar("PUT", ruta, datos);
}

// Elimina (DELETE). Ejemplo: apiDelete("/clientes/123")
export async function apiDelete(ruta) {
  return await enviar("DELETE", ruta, undefined);
}
