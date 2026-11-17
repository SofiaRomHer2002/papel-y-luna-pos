# Desplegar Papel y Luna en Render

## Archivos y decisiones

La estructura real es Django + PostgreSQL (no SQLite, DRF ni JWT) y React/Vite.
Se conservan modelos, migraciones, controladores, tokens propios y frontend.
Se conserva psycopg[binary] 3, compatible con Django: no se instala también
psycopg2-binary. Se conserva python-dotenv: no hace falta python-decouple.
Se agregan Gunicorn, dj-database-url y WhiteNoise.

DEBUG es False por defecto. SECRET_KEY es obligatoria en producción.
Los nombres SECRET_KEY, DEBUG y ALLOWED_HOSTS tienen prioridad sobre sus alias
DJANGO_SECRET_KEY, DJANGO_DEBUG y DJANGO_ALLOWED_HOSTS, que siguen funcionando.
DATABASE_URL tiene prioridad sobre DB_*. Las conexiones por URL requieren SSL
por defecto en producción; para un PostgreSQL local sin SSL se puede configurar
DATABASE_SSL_REQUIRE=False. En Render no cambies ese valor.
El hostname asignado por Render se agrega automáticamente a ALLOWED_HOSTS.
CORS solo permite todos los orígenes cuando DEBUG=True y CORS_ORIGENES está vacío.

## 1. Preparar el repositorio

Descomprime el ZIP. Sube el CONTENIDO de la carpeta papel-y-luna-pos a la raíz
del repositorio: render.yaml, backend/, frontend/ y .github/ deben quedar juntos.
No subas la carpeta contenedora como otro nivel. No se incluye el .env privado
ni venv, node_modules o archivos compilados. Para trabajar localmente copia
backend/.env.example a backend/.env; esa plantilla activa DJANGO_DEBUG=True.

## 2. Crear el Blueprint

En Render selecciona New > Blueprint y conecta el repositorio.
Render leerá render.yaml y creará PostgreSQL 16 y el servicio Python.
Este Blueprint usa planes DE PAGO: web 0.5c-512mb y PostgreSQL 0.1c-256mb.
Revisa los cargos que muestre Render antes de confirmar. No se han creado
servicios ni contratado recursos desde esta tarea.

Cuando Render solicite CORS_ORIGENES, introduce el origen HTTPS del frontend,
por ejemplo https://usuario.github.io (sin ruta del repositorio ni barra final).
Para varios orígenes usa comas. No lo dejes vacío si vas a conectar el frontend.
SECRET_KEY se genera automáticamente y DATABASE_URL se enlaza con la base.

El build instala dependencias y ejecuta collectstatic. Antes de cada despliegue
se ejecuta migrate --noinput. Gunicorn sirve papelyluna.wsgi:application en $PORT.
El chequeo /health/ devuelve {"status":"ok"}; comprueba que Django responde,
no la disponibilidad de PostgreSQL. Las migraciones sí requieren conexión real.
La base solo permite conexiones internas de Render por defecto.

## 3. Usuarios y datos iniciales

Las migraciones crean tablas pero no usuarios del negocio. En la Shell de Render,
desde backend, ejecuta una vez:

    python manage.py inicializar_datos --solo-usuarios

Para incluir también el catálogo de demostración omite --solo-usuarios.
El comando original contiene contraseñas de ejemplo publicadas en README.md.
Antes de dar acceso público, cambia las contraseñas de AMBOS usuarios desde la shell:

    python manage.py shell

    from getpass import getpass
    from pos.models import Usuario
    for nombre in ("Admin_PapelyLuna", "Cajero_PapelyLuna"):
        usuario = Usuario.objects.get(username=nombre)
        usuario.set_password(getpass(f"Nueva contraseña para {nombre}: "))
        usuario.save(update_fields=["password"])

La carga de ejemplos se mantiene manual y no se ejecuta en cada despliegue.
Una base nueva no contiene tus ventas previas: este ZIP contiene código,
no una copia de la base de datos anterior.

## 4. Conectar el frontend existente

Se conserva el despliegue de GitHub Pages definido en .github/workflows/desplegar.yml.
En GitHub configura Settings > Pages > Source = GitHub Actions.
En Settings > Secrets and variables > Actions > Variables define:

    VITE_API_URL=https://TU-API.onrender.com/api

Incluye /api y no agregues barra al final. Vuelve a ejecutar el workflow para
reconstruir el frontend. En Render CORS_ORIGENES debe coincidir con su origen.
Si tienes dominio propio, añade el hostname de la API a ALLOWED_HOSTS y el origen
del frontend a CORS_ORIGENES. CSRF_TRUSTED_ORIGINS queda disponible si se necesita;
la API actual usa sus propios tokens y no se cambia su autenticación.

## 5. Comprobar

Abre https://TU-API.onrender.com/health/ y espera status ok. La raíz / no tiene
página y puede devolver 404: es una API. Abre el frontend e inicia sesión; comprueba
catálogo, registro de una venta de prueba y consulta del historial.
WhiteNoise sirve archivos estáticos de Django bajo /static/; el frontend React
se construye y publica por separado. Actualmente no hay estáticos de Django,
por lo que collectstatic puede informar 0 archivos copiados.

## Referencias oficiales

- https://render.com/docs/deploy-django
- https://render.com/docs/blueprint-spec
- https://render.com/docs/python-version

## Validación realizada

- Python 3.14.7; instalación limpia de requirements.txt y pip check sin conflictos.
- Django check: sin incidencias. WSGI importa correctamente con DEBUG=False.
- collectstatic: correcto (0 archivos; el frontend se publica por separado).
- DATABASE_URL selecciona PostgreSQL y SSL; hostname de Render permitido.
- Probados /health/, redirección HTTPS, rechazo de hosts ajenos, CORS permitido
  y denegado, y validación de petición de login. Sin SECRET_KEY, producción falla
  con un mensaje claro, como se espera.
- Migraciones, ausencia de cambios pendientes de modelos, carga inicial y login
  original (HTTP 201) comprobados con SQLite temporal en memoria, solo para esta
  prueba. No se ha modificado la configuración de producción para usar SQLite.
- render.yaml se analizó como YAML y se comprobaron rutas y referencia a la base.
- check --deploy termina con dos advertencias: CSRF middleware ausente (la API
  existente usa tokens Bearer propios, sin cookies de sesión) y HSTS sin activar.
  Se conserva la autenticación original; no se silencian esas advertencias.
- No se probó conexión ni migración en un servidor PostgreSQL real, ni arranque
  de Gunicorn en Linux/Render (la validación local se hizo en Windows).

La prueba final en Render debe confirmar migraciones, inicio de sesión y una
venta completa. La preparación del ZIP no equivale a un despliegue realizado.
