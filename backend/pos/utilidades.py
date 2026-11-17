# ---------------------------------------------------------------------------
# utilidades.py: funciones de apoyo que usan todos los controladores.
#   - ErrorNegocio: error con un mensaje para la persona y un código HTTP.
#   - controlador_api: "envoltura" que revisa la sesión, atrapa los errores y
#     responde siempre en JSON.
#   - Funciones para leer con cuidado los datos que llegan del frontend.
# ---------------------------------------------------------------------------
import json
import unicodedata
import uuid
from datetime import datetime, time, timedelta
from functools import wraps

from django.db import IntegrityError
from django.db.models import ProtectedError
from django.http import JsonResponse
from django.utils import timezone

from .models import Sesion


class ErrorNegocio(Exception):
    """Error "esperado": algo que la persona puede corregir (un dato que falta,
    stock insuficiente, no tener permiso...). Lleva el mensaje y el código HTTP."""

    def __init__(self, mensaje, codigo=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


def responder(datos, codigo=200):
    """Devuelve una respuesta JSON. safe=False permite responder listas además de objetos."""
    return JsonResponse(datos, status=codigo, safe=False)


def responder_error(mensaje, codigo):
    """Todas las respuestas de error tienen la misma forma: { "mensaje": "..." }"""
    return JsonResponse({"mensaje": mensaje}, status=codigo)


def buscar_usuario_de_la_peticion(request):
    """Lee el encabezado "Authorization: Bearer <token>" y devuelve el usuario dueño
    de ese token. Devuelve None si no hay token, no existe o ya venció."""
    encabezado = request.headers.get("Authorization", "")
    if not encabezado.startswith("Bearer "):
        return None

    token = encabezado[len("Bearer "):].strip()
    sesion = Sesion.objects.select_related("usuario").filter(token=token).first()
    if sesion is None or not sesion.usuario.is_active:
        return None

    # Si la sesión ya venció, la borramos y pedimos iniciar sesión otra vez
    if sesion.vence_en < timezone.now():
        sesion.delete()
        return None

    request.sesion = sesion
    return sesion.usuario


def controlador_api(publico=False):
    """Decorador para los controladores. Hace tres cosas por cada petición:
       1) revisa que haya una sesión válida (salvo que el controlador sea público, como el login),
       2) ejecuta el controlador,
       3) si ocurre un error, lo convierte en una respuesta JSON con el código HTTP correcto."""

    def decorador(funcion):
        @wraps(funcion)
        def envoltura(request, *args, **kwargs):
            try:
                if not publico:
                    usuario = buscar_usuario_de_la_peticion(request)
                    if usuario is None:
                        # 401 = "no sabemos quién eres": el frontend vuelve a la pantalla de login
                        return responder_error("Tu sesión terminó. Inicia sesión de nuevo.", 401)
                    request.usuario = usuario
                return funcion(request, *args, **kwargs)
            except ErrorNegocio as error:
                return responder_error(error.mensaje, error.codigo)
            except ProtectedError:
                # La base de datos se negó a borrar porque hay registros que dependen de este
                return responder_error("No se puede eliminar: tiene registros asociados.", 409)
            except IntegrityError:
                # Dos peticiones intentaron crear el mismo registro en el mismo instante
                return responder_error("Ese registro ya se estaba guardando. Inténtalo de nuevo.", 409)
            except Exception as error:
                # Error inesperado (un fallo del programa): lo dejamos en la consola del servidor
                print("Error inesperado en", request.path, "->", repr(error))
                return responder_error("Ocurrió un error inesperado en el servidor. Inténtalo de nuevo.", 500)

        return envoltura

    return decorador


def exigir_administrador(request):
    """Corta la petición con 403 si quien la hace no es administrador."""
    if request.usuario.rol != "administrador":
        raise ErrorNegocio("Esta acción solo la puede hacer un administrador.", 403)


def metodo_no_permitido():
    """Respuesta para cuando llaman una ruta con un verbo HTTP que no maneja."""
    return responder_error("Método no permitido en esta ruta.", 405)


# ----- Lectura de los datos que llegan en la petición -----------------------

def leer_json(request):
    """Convierte el cuerpo de la petición (texto JSON) en un diccionario de Python."""
    if not request.body:
        return {}
    try:
        datos = json.loads(request.body)
    except json.JSONDecodeError:
        raise ErrorNegocio("Los datos enviados no son JSON válido.", 400)
    if not isinstance(datos, dict):
        raise ErrorNegocio("Se esperaba un objeto JSON.", 400)
    return datos


def leer_texto(datos, clave, obligatorio=False, etiqueta=""):
    """Lee un texto del diccionario, sin espacios sobrantes. Si es obligatorio y viene vacío, avisa."""
    valor = datos.get(clave)
    if valor is None:
        valor = ""
    valor = str(valor).strip()
    if obligatorio and valor == "":
        raise ErrorNegocio("El campo \"" + (etiqueta or clave) + "\" es obligatorio.", 400)
    return valor


def leer_entero(datos, clave, etiqueta="", minimo=0, por_defecto=None):
    """Lee un número entero mayor o igual a "minimo". Rechaza textos, decimales y negativos."""
    valor = datos.get(clave)
    if valor is None or valor == "":
        if por_defecto is not None:
            return por_defecto
        raise ErrorNegocio("El campo \"" + (etiqueta or clave) + "\" es obligatorio.", 400)
    # bool es un tipo de entero en Python: lo descartamos a mano
    if isinstance(valor, bool):
        raise ErrorNegocio("El campo \"" + (etiqueta or clave) + "\" debe ser un número.", 400)
    try:
        numero = int(valor)
    except (TypeError, ValueError):
        raise ErrorNegocio("El campo \"" + (etiqueta or clave) + "\" debe ser un número entero.", 400)
    if numero < minimo:
        raise ErrorNegocio("El campo \"" + (etiqueta or clave) + "\" no puede ser menor que " + str(minimo) + ".", 400)
    return numero


def nuevo_id():
    """Genera un id único (UUID) cuando el frontend no envió uno."""
    return str(uuid.uuid4())


def id_o_nuevo(datos):
    """Usa el id que mandó el frontend o, si no mandó, genera uno."""
    identificador = leer_texto(datos, "id")
    if identificador == "":
        return nuevo_id()
    return identificador


# ----- Fechas ---------------------------------------------------------------

def fecha_a_texto(fecha):
    """Convierte una fecha de la base de datos a texto ISO (el formato que entiende JavaScript)."""
    if fecha is None:
        return ""
    return fecha.isoformat()


def leer_fecha_hora(texto):
    """Convierte un texto ISO (ej. 2026-11-16T15:30:00.000Z) en fecha. Si no sirve, usa "ahora"."""
    if not texto:
        return timezone.now()
    try:
        fecha = datetime.fromisoformat(str(texto).replace("Z", "+00:00"))
    except ValueError:
        return timezone.now()
    if timezone.is_naive(fecha):
        fecha = timezone.make_aware(fecha)
    return fecha


def leer_rango_de_fechas(request):
    """Lee ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD y devuelve (inicio, fin) como fechas con hora:
    desde las 00:00 del día "desde" hasta las 00:00 del día SIGUIENTE a "hasta".
    Así un rango de un solo día (desde = hasta) cubre ese día completo."""
    texto_desde = request.GET.get("desde", "")
    texto_hasta = request.GET.get("hasta", "")
    if texto_desde == "" or texto_hasta == "":
        raise ErrorNegocio("Indica las fechas \"desde\" y \"hasta\" del reporte.", 400)

    try:
        dia_desde = datetime.strptime(texto_desde, "%Y-%m-%d").date()
        dia_hasta = datetime.strptime(texto_hasta, "%Y-%m-%d").date()
    except ValueError:
        raise ErrorNegocio("Las fechas deben tener el formato AAAA-MM-DD.", 400)

    if dia_hasta < dia_desde:
        raise ErrorNegocio("La fecha \"hasta\" no puede ser anterior a la fecha \"desde\".", 400)

    # make_aware les pone la zona horaria de la papelería (America/Bogota)
    inicio = timezone.make_aware(datetime.combine(dia_desde, time.min))
    fin = timezone.make_aware(datetime.combine(dia_hasta + timedelta(days=1), time.min))
    return inicio, fin


# ----- Textos ---------------------------------------------------------------

def normalizar_nombre(texto):
    """Deja un nombre en minúsculas, sin tildes y en singular simple, para poder agrupar
    faltantes escritos distinto: "Cofias", "cofia" y "COFÍA" quedan todos como "cofia"."""
    texto = str(texto).strip().lower()

    # Quitar tildes: se separa cada letra de su tilde (NFD) y se descartan las tildes
    sin_tildes = ""
    for letra in unicodedata.normalize("NFD", texto):
        if unicodedata.category(letra) != "Mn":  # "Mn" = marca de acento
            sin_tildes = sin_tildes + letra

    # Plural simple, palabra por palabra: "lapices" -> "lapiz", "cofias" -> "cofia"
    palabras = []
    for palabra in sin_tildes.split():
        if len(palabra) > 3 and palabra.endswith("ces"):
            palabra = palabra[:-3] + "z"
        elif len(palabra) > 2 and palabra.endswith("s"):
            palabra = palabra[:-1]
        palabras.append(palabra)

    return " ".join(palabras)
