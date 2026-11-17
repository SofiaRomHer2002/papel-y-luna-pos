# Papel y Luna en Render

## Aplicar la corrección

Integra esta rama en `main`. Si creaste los servicios con un Blueprint, sincroniza
ese Blueprint con el `render.yaml` actualizado. Un push por sí solo no garantiza
que Render aplique cambios de variables o comandos de un servicio creado manualmente.

El Blueprint declara PostgreSQL 16 (`papelyluna-db`), Django (`papelyluna-api`,
plan Free) y un Static Site React (`papelyluna-web`). Conserva también el workflow
existente de GitHub Pages. No se contratan planes de pago en este archivo.

Si ya tienes servicios creados manualmente, actualiza los existentes; no crees
otra base si quieres conservar los datos. Configura en el servicio Django:

| Campo | Valor |
| --- | --- |
| Root Directory | `backend` |
| Build Command | `bash build.sh` |
| Start Command | `gunicorn papelyluna.wsgi:application --bind 0.0.0.0:$PORT --access-logfile - --error-logfile -` |
| Health Check Path | `/health/` |
| `DEBUG` | `False` |
| `SECRET_KEY` | Clave aleatoria privada y estable; el Blueprint la genera |
| `DATABASE_URL` | Internal Database URL de **tu base existente**; el Blueprint la enlaza |
| `CORS_ORIGENES` | Origen HTTPS real del Static Site; varios separados por comas |

El archivo incluye los orígenes previstos `https://papelyluna-web.onrender.com`
y `https://sofiaromher2002.github.io`. Si Render asigna otro nombre, un sufijo
o usas dominio propio, cambia `CORS_ORIGENES` por los orígenes reales. No incluye
rutas: GitHub Pages usa el origen sin `/papel-y-luna-pos`. No se permiten todos
los dominios en producción. El hostname del backend se agrega automáticamente
a `ALLOWED_HOSTS` mediante `RENDER_EXTERNAL_HOSTNAME`; añade dominios propios
en `ALLOWED_HOSTS` si corresponde. No cambies `SECRET_KEY` en cada despliegue.

Para el Static Site:

| Campo | Valor |
| --- | --- |
| Root Directory | `frontend` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| `VITE_API_URL` | `https://papelyluna-api.onrender.com/api` (sustituye por tu API real) |

La dirección se normaliza para incluir `/api` una sola vez. Un build de producción
rechaza direcciones HTTP. Sin variable usa la API Render prevista, nunca
`http://<sitio-estatico>:8000`. Si cambias `VITE_API_URL`, reconstruye el frontend:
Vite incorpora su valor durante el build. Revisa también `.env` o `.env.production`
privados: un valor `localhost` de desarrollo no sirve para el build de producción.

En GitHub Pages define la variable de Actions `VITE_API_URL` con la URL HTTPS real
de la API y vuelve a ejecutar `Publicar en GitHub Pages`. Su ruta de login es
`POST /api/sesion`, con JSON `{"usuario":"...","clave":"..."}`.

## Migraciones y usuarios

`build.sh` instala dependencias, recoge estáticos, ejecuta las migraciones y llama
a `inicializar_datos --solo-usuarios`. Se hace en el build para ser compatible con
Render Free; no requiere Shell, One-Off Jobs ni un comando previo al despliegue.
Si falla una etapa, se detiene el build.

En una base nueva se crean:

| Usuario | Contraseña inicial predeterminada | Rol |
| --- | --- | --- |
| `Admin_PapelyLuna` | `Admin_12345!` | administrador |
| `Cajero_PapelyLuna` | `Cajero_12345!` | cajero |

Para usar contraseñas privadas desde el primer despliegue, define
`INITIAL_ADMIN_PASSWORD` e `INITIAL_CASHIER_PASSWORD` en el backend antes del build.
No publiques esos valores en Git. Si el usuario ya existe, el comando normal
**no modifica contraseña, nombre, rol ni estado activo**, aunque cambien esas
variables. No se reviven cuentas desactivadas. Los tokens de usuarios desactivados
se rechazan. La creación de usuarios es transaccional y no duplica usernames.

No se cargan productos ni ventas de demostración automáticamente. El catálogo
manual se carga con `python manage.py inicializar_datos`, dentro de una transacción,
y se omite si ya existen productos o categorías. Una base nueva no contiene las
ventas guardadas en otra base ni importa automáticamente el SQLite del repositorio.

### Recuperar contraseñas existentes solo si hace falta

Si el login devuelve 401 y no recuerdas las claves existentes, configura **ambas**
variables privadas anteriores con las claves que quieres usar. En Render Free,
cambia temporalmente el Build Command del backend a:

```bash
bash build.sh && python manage.py inicializar_datos --solo-usuarios --restablecer-claves
```

Despliega una vez. El restablecimiento exige ambas variables, revoca los tokens
de esos dos usuarios y conserva sus roles y su estado activo. Verifica el acceso
y vuelve a dejar el Build Command en `bash build.sh`. Sin el indicador explícito,
los futuros deploys nunca vuelven a aplicar las claves iniciales. Si necesitas
conservar las claves de una base existente, no ejecutes esta recuperación.

## CORS y CSRF

La autenticación usa tokens propios enviados como `Authorization: Bearer ...`,
sin cookies de sesión. El frontend no necesita `credentials: include` ni obtener
una cookie CSRF. CORS permite el origen configurado y el preflight con Authorization
y Content-Type. `CSRF_TRUSTED_ORIGINS` sigue disponible para una futura función con
cookies; no reemplaza `CORS_ORIGENES` ni resuelve por sí sola el login actual.
No se ha agregado autenticación por cookies ni desactivado una protección existente.

## Desarrollo local

Copia `backend/.env.example` a `backend/.env`, configura PostgreSQL local y ejecuta
las migraciones y `inicializar_datos`. `DB_*` y los alias `DJANGO_*` siguen funcionando.
`DATABASE_URL` tiene prioridad; en Render es obligatoria. SSL se exige por defecto
en producción. Para PostgreSQL local por URL sin SSL usa `DATABASE_SSL_REQUIRE=False`.

Con `npm run dev`, sin `VITE_API_URL`, se usa `http://<computador>:8000/api`.
La plantilla `frontend/.env.example` conserva una dirección local explícita.

## Validar

```powershell
# Desde la raíz del repo, después de instalar backend/requirements.txt
python backend/manage.py test pos --settings=papelyluna.test_settings
python backend/manage.py makemigrations --check --dry-run --settings=papelyluna.test_settings
cd frontend
npm ci
npm test
npm run lint
npm run build
```

Las pruebas locales usan SQLite en memoria exclusivamente en `test_settings`;
no cambian la base local ni la configuración de PostgreSQL de producción.
El workflow `Validar aplicación` ejecuta las mismas pruebas del backend sobre
PostgreSQL 16 en Linux y compila el frontend en Node 22.

Después del despliegue, abre `/health/` y comprueba el login desde el Static Site,
el catálogo y una venta. `/health/` comprueba que Django responde, no la base de datos.
La raíz `/` del backend puede devolver 404: el frontend se publica por separado.
El timeout del frontend es de 90 segundos para tolerar el arranque tras inactividad.

Render Free suspende el backend tras inactividad y su PostgreSQL gratuito expira
a los 30 días; conserva copias de tus datos y elige un plan adecuado para operación real.
Consulta [limitaciones Free](https://render.com/docs/free),
[Blueprint](https://render.com/docs/blueprint-spec) y
[Django en Render](https://render.com/docs/deploy-django).

Las verificaciones locales y CI no equivalen a haber desplegado ni a haber
comprobado las variables privadas y la base que están actualmente en tu cuenta Render.

## Resultado de la revisión (17 de noviembre de 2026)

- 13 pruebas backend aprobadas sobre SQLite temporal: login inicial, claves
  personalizadas, conservación del hash, recuperación explícita, sesiones,
  CORS, configuración de producción, ventas, compras, reportes y permisos.
- 8 pruebas frontend aprobadas; instalación limpia y build con Vite 8.3.8 correctos.
- `npm audit`: 0 vulnerabilidades después de actualizar Vite y su lockfile.
- `makemigrations --check --dry-run`: sin cambios pendientes; `pip check` correcto.
- `collectstatic` correcto. YAML analizado y referencias del Blueprint comprobadas.
- `build.sh` normalizado a LF; `.gitattributes` conserva ese formato para Bash en Linux.
- Lint sin errores, con una advertencia preexistente en `Venta.jsx` sobre un efecto React.
- No hay PostgreSQL ni Gunicorn Linux disponibles en este equipo Windows.
  El workflow agregado permite comprobar PostgreSQL 16 en GitHub Actions; no se
  ejecutó remotamente porque no se pudo publicar la rama con la integración actual.
- No se modificaron servicios Render ni su base real. La integración GitHub devolvió
  403 al intentar crear una rama; los cambios se entregan también como ZIP y parche.
