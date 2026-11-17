# ---------------------------------------------------------------------------
# controladores/autenticacion.py: iniciar sesión, consultar la sesión y cerrarla.
#
# Cómo funciona la autenticación (sencilla, sin librerías extra):
#   1) El frontend envía usuario y contraseña a POST /api/sesion.
#   2) Si son correctos, el backend crea una fila en la tabla "sesiones" con un
#      TOKEN (una clave larga al azar) y se lo devuelve al frontend.
#   3) El frontend guarda el token y lo manda en cada petición, en el encabezado
#      "Authorization: Bearer <token>". Con eso el backend sabe quién es y qué rol tiene.
#   4) Al cerrar sesión, la fila se borra y el token deja de servir.
# ---------------------------------------------------------------------------
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from ..models import Sesion, Usuario
from ..serializadores import usuario_a_json
from ..utilidades import ErrorNegocio, buscar_usuario_de_la_peticion, controlador_api, leer_json, leer_texto, metodo_no_permitido, responder


@controlador_api(publico=True)
def sesion(request):
    """Ruta /api/sesion
       POST   -> iniciar sesión (público: todavía no hay token)
       GET    -> ¿quién soy? (sirve para comprobar que el token guardado sigue vigente)
       DELETE -> cerrar sesión"""
    if request.method == "POST":
        return iniciar_sesion(request)
    if request.method == "GET":
        return consultar_sesion(request)
    if request.method == "DELETE":
        return cerrar_sesion(request)
    return metodo_no_permitido()


def iniciar_sesion(request):
    datos = leer_json(request)
    nombre_usuario = leer_texto(datos, "usuario")
    clave = str(datos.get("clave") or "")

    if nombre_usuario == "" or clave == "":
        raise ErrorNegocio("Escribe tu usuario y tu contraseña.", 400)

    # Buscamos el usuario y comparamos la contraseña con la versión cifrada guardada.
    # El mensaje es el mismo si falla el usuario o la clave, para no dar pistas.
    usuario = Usuario.objects.filter(username=nombre_usuario, is_active=True).first()
    if usuario is None or not usuario.check_password(clave):
        raise ErrorNegocio("Usuario o contraseña incorrectos.", 401)

    # Limpieza: borramos las sesiones de este usuario que ya vencieron
    Sesion.objects.filter(usuario=usuario, vence_en__lt=timezone.now()).delete()

    # Creamos la sesión con un token al azar de 64 caracteres
    nueva = Sesion.objects.create(
        token=secrets.token_hex(32),
        usuario=usuario,
        vence_en=timezone.now() + timedelta(hours=settings.HORAS_SESION),
    )

    return responder({"token": nueva.token, "usuario": usuario_a_json(usuario)}, 201)


def consultar_sesion(request):
    # Esta ruta es pública (por el login), así que aquí revisamos el token a mano
    usuario = buscar_usuario_de_la_peticion(request)
    if usuario is None:
        raise ErrorNegocio("Tu sesión terminó. Inicia sesión de nuevo.", 401)
    return responder({"usuario": usuario_a_json(usuario)})


def cerrar_sesion(request):
    usuario = buscar_usuario_de_la_peticion(request)
    if usuario is not None:
        request.sesion.delete()  # el token deja de servir
    return responder({"mensaje": "Sesión cerrada."})
