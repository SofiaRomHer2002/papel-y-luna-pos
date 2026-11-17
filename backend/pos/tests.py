import io
import json
import os
from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .models import Categoria, Producto, Sesion, Usuario


class DespliegueTests(TestCase):
    def inicializar(self, **kwargs):
        call_command("inicializar_datos", solo_usuarios=True, stdout=io.StringIO(), **kwargs)

    def login(self, clave="Admin_12345!"):
        return self.client.post("/api/sesion", {"usuario": "Admin_PapelyLuna", "clave": clave}, content_type="application/json")

    def test_inicializacion_y_login_completo(self):
        self.inicializar()
        self.assertEqual(Usuario.objects.count(), 2)
        self.assertFalse(Producto.objects.exists())
        respuesta = self.login()
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.json()["usuario"]["rol"], "administrador")
        token = respuesta.json()["token"]
        headers = {"HTTP_AUTHORIZATION": "Bearer " + token}
        self.assertEqual(self.client.get("/api/sesion", **headers).status_code, 200)
        for ruta in ("productos", "categorias", "clientes", "proveedores", "descuentos", "ventas", "compras", "faltantes"):
            self.assertEqual(self.client.get("/api/" + ruta, **headers).status_code, 200, ruta)
        self.assertEqual(self.client.delete("/api/sesion", **headers).status_code, 200)
        self.assertEqual(self.client.get("/api/productos", **headers).status_code, 401)

    def test_futuros_deploys_preservan_usuario_y_hash(self):
        self.inicializar()
        usuario = Usuario.objects.get(username="Admin_PapelyLuna")
        usuario.set_password("Clave-nueva-privada!")
        usuario.nombre = "Nombre propio"
        usuario.is_active = False
        usuario.save()
        hash_anterior = usuario.password
        self.inicializar()
        usuario.refresh_from_db()
        self.assertEqual(usuario.password, hash_anterior)
        self.assertEqual(usuario.nombre, "Nombre propio")
        self.assertFalse(usuario.is_active)
        self.assertEqual(Usuario.objects.count(), 2)

    def test_login_invalido_y_token_vencido(self):
        self.inicializar()
        self.assertEqual(self.login("incorrecta").status_code, 401)
        self.assertEqual(self.client.post("/api/sesion", {}, content_type="application/json").status_code, 400)
        usuario = Usuario.objects.get(username="Admin_PapelyLuna")
        Sesion.objects.create(token="vencido", usuario=usuario, vence_en=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get("/api/productos", HTTP_AUTHORIZATION="Bearer vencido").status_code, 401)

    def test_usuario_desactivado_no_puede_usar_token_existente(self):
        self.inicializar()
        token = self.login().json()["token"]
        Usuario.objects.filter(username="Admin_PapelyLuna").update(is_active=False)
        self.assertEqual(self.client.get("/api/productos", HTTP_AUTHORIZATION="Bearer " + token).status_code, 401)

    @override_settings(DEBUG=False, CORS_ALLOW_ALL_ORIGINS=False, CORS_ALLOWED_ORIGINS=["https://papelyluna-web.onrender.com"])
    def test_cors_preflight_y_login_sin_cookies_csrf(self):
        self.inicializar()
        cliente = Client(enforce_csrf_checks=True)
        origen = "https://papelyluna-web.onrender.com"
        respuesta = cliente.options("/api/sesion", HTTP_ORIGIN=origen, HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST", HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,authorization")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.headers["access-control-allow-origin"], origen)
        respuesta = cliente.post("/api/sesion", json.dumps({"usuario": "Admin_PapelyLuna", "clave": "Admin_12345!"}), content_type="application/json", HTTP_ORIGIN=origen)
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.headers["access-control-allow-origin"], origen)
        self.assertNotIn("access-control-allow-origin", cliente.options("/api/sesion", HTTP_ORIGIN="https://otro.example", HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST").headers)

    def test_catalogo_manual_no_sobrescribe_stock(self):
        call_command("inicializar_datos", stdout=io.StringIO())
        Producto.objects.filter(pk="p-001").update(stock=7)
        call_command("inicializar_datos", stdout=io.StringIO())
        self.assertEqual(Producto.objects.get(pk="p-001").stock, 7)
        self.assertEqual(Categoria.objects.count(), 5)

    @patch.dict(os.environ, {"INITIAL_ADMIN_PASSWORD": "Clave-inicial-personal!"})
    def test_clave_inicial_personalizada_no_se_reaplica(self):
        self.inicializar()
        self.assertEqual(self.login("Clave-inicial-personal!").status_code, 201)
        with patch.dict(os.environ, {"INITIAL_ADMIN_PASSWORD": "Otra-clave!"}):
            self.inicializar()
        self.assertEqual(self.login("Clave-inicial-personal!").status_code, 201)

    def test_recuperacion_explicita_exige_claves_y_revoca_tokens(self):
        self.inicializar()
        token = self.login().json()["token"]
        with patch.dict(os.environ, {"INITIAL_ADMIN_PASSWORD": "", "INITIAL_CASHIER_PASSWORD": ""}):
            with self.assertRaises(CommandError):
                self.inicializar(restablecer_claves=True)
        self.assertEqual(self.client.get("/api/sesion", HTTP_AUTHORIZATION="Bearer " + token).status_code, 200)
        with patch.dict(os.environ, {"INITIAL_ADMIN_PASSWORD": "Recuperada-admin!", "INITIAL_CASHIER_PASSWORD": "Recuperada-caja!"}):
            self.inicializar(restablecer_claves=True)
        self.assertEqual(self.login("Recuperada-admin!").status_code, 201)
        self.assertEqual(self.client.get("/api/sesion", HTTP_AUTHORIZATION="Bearer " + token).status_code, 401)

    def test_venta_compra_reportes_y_permisos(self):
        call_command("inicializar_datos", stdout=io.StringIO())
        headers = {"HTTP_AUTHORIZATION": "Bearer " + self.login().json()["token"]}
        datos = {"items": [{"productoId": "p-002", "cantidad": 2}], "metodoPago": "Efectivo", "valorRecibido": 20000, "totalEsperado": 11900}
        ruta = "/api/ventas/venta-prueba/cierre"
        respuesta = self.client.post(ruta, datos, content_type="application/json", **headers)
        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        self.assertEqual(respuesta.json()["venta"]["total"], 11900)
        self.assertEqual(Producto.objects.get(pk="p-002").stock, 28)
        self.client.post(ruta, datos, content_type="application/json", **headers)
        self.assertEqual(Producto.objects.get(pk="p-002").stock, 28)
        compra = {"id": "compra-prueba", "proveedorId": "pr-001", "items": [{"productoId": "p-002", "cantidad": 3, "costo": 2000}]}
        self.assertEqual(self.client.post("/api/compras", compra, content_type="application/json", **headers).status_code, 201)
        self.assertEqual(Producto.objects.get(pk="p-002").stock, 31)
        hoy = timezone.localdate().isoformat()
        for reporte in ("ventas", "productos-vendidos", "compras", "faltantes", "faltantes-por-proveedor"):
            self.assertEqual(self.client.get(f"/api/reportes/{reporte}?desde={hoy}&hasta={hoy}", **headers).status_code, 200, reporte)
        cajero = self.client.post("/api/sesion", {"usuario": "Cajero_PapelyLuna", "clave": "Cajero_12345!"}, content_type="application/json")
        self.assertEqual(cajero.status_code, 201)
        self.assertEqual(self.client.get("/api/compras", HTTP_AUTHORIZATION="Bearer " + cajero.json()["token"]).status_code, 403)
