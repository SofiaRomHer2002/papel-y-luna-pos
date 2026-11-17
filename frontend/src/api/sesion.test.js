import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

test("sesión envía credenciales y Bearer; limpia tokens inválidos", async (t) => {
  const originales = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const almacenamiento = new Map();
  globalThis.window = { location: { hostname: "localhost" } };
  globalThis.localStorage = {
    getItem: (clave) => almacenamiento.get(clave),
    setItem: (clave, valor) => almacenamiento.set(clave, valor),
    removeItem: (clave) => almacenamiento.delete(clave)
  };
  const servidor = await createServer({ configFile: false, server: { middlewareMode: true }, logLevel: "silent" });
  try {
    const sesion = await servidor.ssrLoadModule("/src/servicios/sesion.js");
    const api = await servidor.ssrLoadModule("/src/api/api.js");
    await t.test("login y recuperación usan las rutas y el token correctos", async () => {
      globalThis.fetch = async (url, opciones) => {
        assert.equal(url, "http://localhost:8000/api/sesion");
        assert.equal(opciones.method, "POST");
        assert.deepEqual(JSON.parse(opciones.body), { usuario: "Admin_PapelyLuna", clave: "Admin_12345!" });
        return Response.json({ token: "token-prueba", usuario: { rol: "administrador" } }, { status: 201 });
      };
      assert.equal((await sesion.iniciarSesion("Admin_PapelyLuna", "Admin_12345!")).rol, "administrador");
      assert.equal(api.leerToken(), "token-prueba");
      globalThis.fetch = async (_url, opciones) => {
        assert.equal(opciones.headers.Authorization, "Bearer token-prueba");
        assert.equal(opciones.method, "GET");
        return Response.json({ usuario: { rol: "administrador" } });
      };
      assert.equal((await sesion.recuperarSesion()).rol, "administrador");
    });
    await t.test("credenciales incorrectas conservan el mensaje de login", async () => {
      let vencida = false;
      api.registrarAvisoSesionVencida(() => { vencida = true; });
      globalThis.fetch = async () => Response.json({ mensaje: "Usuario o contraseña incorrectos." }, { status: 401 });
      await assert.rejects(sesion.iniciarSesion("x", "x"), /Usuario o contraseña incorrectos/);
      assert.equal(vencida, false);
    });
    await t.test("GET de sesión inválida elimina el token y avisa", async () => {
      let vencida = false;
      api.registrarAvisoSesionVencida(() => { vencida = true; });
      await assert.rejects(api.apiGet("/sesion"));
      assert.equal(api.leerToken(), "");
      assert.equal(vencida, true);
    });
    await t.test("logout limpia la sesión incluso si se pierde conexión", async () => {
      api.guardarToken("token-prueba");
      globalThis.fetch = async () => { throw new TypeError("sin conexión"); };
      await sesion.cerrarSesion();
      assert.equal(api.leerToken(), "");
    });
  } finally {
    await servidor.close();
    for (const [clave, valor] of Object.entries(originales)) {
      if (valor === undefined) delete globalThis[clave];
      else globalThis[clave] = valor;
    }
  }
});
