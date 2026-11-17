import test from "node:test";
import assert from "node:assert/strict";
import { resolverApiUrl } from "./direccion.js";

test("producción agrega /api una sola vez y usa HTTPS", () => {
  for (const valor of ["https://papelyluna-api.onrender.com", "https://papelyluna-api.onrender.com/", " https://papelyluna-api.onrender.com/api/ "]) {
    assert.equal(resolverApiUrl(valor, false, "caja.example"), "https://papelyluna-api.onrender.com/api");
  }
});

test("producción sin variable usa la API Render y nunca el computador del visitante", () => {
  assert.equal(resolverApiUrl("", false, "papelyluna-web.onrender.com"), "https://papelyluna-api.onrender.com/api");
  assert.throws(() => resolverApiUrl("http://localhost:8000/api", false, "web.example"), /HTTPS/);
});

test("desarrollo conserva backend local y URL explícita", () => {
  assert.equal(resolverApiUrl("", true, "192.168.1.20"), "http://192.168.1.20:8000/api");
  assert.equal(resolverApiUrl("http://localhost:8000/api/", true, "localhost"), "http://localhost:8000/api");
});
