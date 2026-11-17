# ---------------------------------------------------------------------------
# settings.py: configuración del proyecto Django de Papel y Luna.
# Aquí se define qué aplicaciones se usan, cuál es la base de datos y quién
# puede llamar a la API (CORS).
# ---------------------------------------------------------------------------
import os
from pathlib import Path

from dotenv import load_dotenv
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

# Carpeta "backend" (donde está manage.py). Sirve para armar rutas de archivos.
BASE_DIR = Path(__file__).resolve().parent.parent

# Lee el archivo backend/.env (si existe) y deja sus valores disponibles en os.environ.
# Ahí van los datos propios de cada computador: la contraseña de la base de datos, etc.
load_dotenv(BASE_DIR / ".env")

def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# Las variables estándar tienen prioridad; se conservan los nombres DJANGO_*.
DEBUG = env_bool("DEBUG", env_bool("DJANGO_DEBUG", False))
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "clave-solo-para-desarrollo-papel-y-luna"
    else:
        raise ImproperlyConfigured("Define SECRET_KEY (o DJANGO_SECRET_KEY) en producción.")

ALLOWED_HOSTS = [host.strip() for host in os.environ.get(
    "ALLOWED_HOSTS", os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]")
).split(",") if host.strip()]
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.environ.get(
    "CSRF_TRUSTED_ORIGINS", ""
).split(",") if origin.strip()]

# Aplicaciones instaladas: solo lo que el proyecto necesita
INSTALLED_APPS = [
    "django.contrib.contenttypes",  # la necesita el sistema de usuarios de Django
    "django.contrib.staticfiles",
    "django.contrib.auth",          # usuarios y contraseñas cifradas
    "corsheaders",                  # permite que el frontend (otro origen) llame a la API
    "pos",                          # NUESTRA aplicación: modelos, rutas y controladores
]

# Los "middleware" son pasos por los que pasa cada petición antes de llegar al controlador
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # agrega los encabezados CORS a las respuestas
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Archivo principal de rutas
ROOT_URLCONF = "papelyluna.urls"

WSGI_APPLICATION = "papelyluna.wsgi.application"

# ----- Base de datos: PostgreSQL -----
# Los datos de conexión se leen del archivo .env (ver .env.example). Si una variable
# no existe, se usa el valor que está a la derecha (sirve para trabajar en el computador).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NOMBRE", "papelyluna"),      # nombre de la base de datos
        "USER": os.environ.get("DB_USUARIO", "papelyluna"),     # usuario de PostgreSQL
        "PASSWORD": os.environ.get("DB_CLAVE", "papelyluna"),   # contraseña de ese usuario
        "HOST": os.environ.get("DB_SERVIDOR", "localhost"),     # dónde está PostgreSQL
        "PORT": os.environ.get("DB_PUERTO", "5432"),            # puerto normal de PostgreSQL
    }
}

# Render entrega la conexión completa; DB_* sigue funcionando en desarrollo.
if os.environ.get("DATABASE_URL"):
    DATABASES["default"] = dj_database_url.parse(
        os.environ["DATABASE_URL"], conn_max_age=600, conn_health_checks=True,
        ssl_require=env_bool("DATABASE_SSL_REQUIRE", not DEBUG),
    )
elif os.environ.get("RENDER") and not DEBUG:
    raise ImproperlyConfigured("Render requiere DATABASE_URL.")

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Usamos nuestro propio modelo de usuario (agrega el campo "rol")
AUTH_USER_MODEL = "pos.Usuario"

# Idioma y zona horaria de la papelería
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True  # las fechas se guardan con zona horaria

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ----- CORS: quién puede llamar a la API desde el navegador -----
# En desarrollo se permite cualquier origen. Al desplegar se puede limitar con la
# variable CORS_ORIGENES (por ejemplo: https://usuario.github.io).
ORIGENES = os.environ.get("CORS_ORIGENES", "")
if ORIGENES == "":
    CORS_ALLOW_ALL_ORIGINS = DEBUG
else:
    CORS_ALLOWED_ORIGINS = [origin.strip() for origin in ORIGENES.split(",") if origin.strip()]

# ----- Reglas del negocio que usa el backend -----
TASA_IVA = 0.19          # 19 % de IVA, igual que en el MVP 1 y el MVP 2
HORAS_SESION = 12        # una sesión iniciada dura 12 horas (un turno largo)
