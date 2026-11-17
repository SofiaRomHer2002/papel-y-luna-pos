> **Render:** consulta [DESPLIEGUE_RENDER.md](DESPLIEGUE_RENDER.md) para desplegar la API con PostgreSQL y conectar GitHub Pages.

# Papel y Luna — POS (Entrega final, MVP 3)

Punto de venta para la papelería **Papel y Luna**. En esta entrega el sistema pasa de usar
Google Sheets a una solución **full-stack**:

| Parte | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 19 + Vite | `frontend/` |
| Backend (API REST) | Python + Django 5.2 | `backend/` |
| Base de datos | PostgreSQL 16 | tablas creadas con `migrate` (SQL de referencia en `backend/sql/`) |

La aplicación está pensada para usarse sobre todo **desde el celular**, y varias personas
(por ejemplo, el administrador y un cajero) pueden usarla **al mismo tiempo**.

## Usuarios iniciales

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `Admin_PapelyLuna` | `Admin_12345!` |
| Cajero | `Cajero_PapelyLuna` | `Cajero_12345!` |

Los crea el script de inicialización (`python manage.py inicializar_datos`). Las contraseñas
se guardan cifradas en la base de datos. El usuario distingue mayúsculas y minúsculas.

## Cómo ejecutarlo

Se necesitan **Python 3.10 o superior**, **Node.js 22** (o 20.19 o superior) y **PostgreSQL 14 o superior**
(en Windows se instala desde postgresql.org; trae pgAdmin).
Se usan dos terminales: una para el backend y otra para el frontend.

### 0. Base de datos (solo la primera vez)

Crear el usuario y la base de datos vacía, como administrador de PostgreSQL:

```bash
psql -U postgres -f backend/sql/01_crear_base_de_datos.sql
```

(O abrir pgAdmin > Query Tool y ejecutar las dos líneas de ese archivo.) Crea la base `papelyluna`
con el usuario `papelyluna` / contraseña `papelyluna`. Si usas otros datos, cámbialos también en `backend/.env`.

### 1. Backend (terminal 1)

```bash
cd backend
python -m venv venv                 # crea un entorno virtual (solo la primera vez)
venv\Scripts\activate               # Windows   |   en Mac / Linux:  source venv/bin/activate
pip install -r requirements.txt     # instala Django, el conector de PostgreSQL y lo demás
copy .env.example .env              # Windows   |   en Mac / Linux:  cp .env.example .env
python manage.py migrate            # crea las tablas en PostgreSQL
python manage.py inicializar_datos  # crea los usuarios y carga el catálogo inicial
python manage.py runserver 0.0.0.0:8000
```

La API queda en `http://localhost:8000/api`. `inicializar_datos` se puede ejecutar varias
veces sin duplicar nada; con `--solo-usuarios` crea solo los usuarios, sin datos de ejemplo.
Para empezar de cero: borrar y volver a crear la base de datos (paso 0) y repetir `migrate` e `inicializar_datos`.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install       # descarga las dependencias (React, Vite y las tipografías)
npm run dev       # abre la dirección que aparece (http://localhost:5173)
```

El frontend busca el backend en el mismo computador, puerto 8000. Para usar otra dirección,
copiar `frontend/.env.example` como `frontend/.env` y cambiar `VITE_API_URL`.

Para probarla en el celular: `npm run dev -- --host` y abrir en el celular la dirección de red
que aparece (el computador y el celular deben estar en el mismo wifi).

Otros comandos: `npm run build` (genera `dist` para publicar), `npm run preview`, `npm run lint`.

## Qué hace

| Módulo | Funciones | Administrador | Cajero |
|---|---|---|---|
| **Vender** | Catálogo con buscador y filtro, cantidades, subtotal / IVA / descuento / total, cliente, guardar la venta para después, cobrar (Efectivo con cambio, Nequi o Debe con cliente obligatorio), factura imprimir / PDF, editar un producto sin salir de la venta, anotar faltantes | Sí | Sí |
| **Ventas** | Historial (abiertas y cerradas), detalle, factura, retomar una venta abierta | Sí | Sí |
| **Corrección** de ventas cerradas | Cambiar productos, cantidades, cliente, método de pago y descuento; la venta conserva su número y queda marcada (quién y cuándo) | Sí | No |
| **Reembolsos** | Parciales o totales, por producto, indicando si vuelve al inventario; respeta el descuento | Sí | No |
| **Productos** | Listar y buscar | Sí | Sí |
| | Crear, editar y eliminar | Sí | No |
| **Compras** | Registrar, listar y ver detalle (suma stock y actualiza costo) | Sí | No |
| **Clientes** | Listar, crear, editar y eliminar | Sí | Sí |
| **Categorías y proveedores** | Listar, crear, editar y eliminar | Sí | No |
| **Descuentos** | Catálogo: crear, editar y eliminar (porcentaje o valor fijo) | Sí | No |
| | Aplicar un descuento existente a una venta (uno por venta) | Sí | Sí |
| **Faltantes** | Registrar, listar y filtrar por tipo, proveedor y estado | Sí | Sí |
| | Marcar como resuelto, reabrir y eliminar | Sí | No |
| **Reportes** | Ventas por fechas, productos más vendidos, compras por fechas, faltantes frecuentes y pendientes por proveedor | Sí | No |

Los permisos se revisan **en el backend** en cada petición (responde `403` si el rol no alcanza).
El frontend además oculta lo que el rol no puede usar.

## Arquitectura

```
Navegador (React)  --fetch + JSON-->  API REST (Django)  --ORM-->  PostgreSQL
   frontend/                              backend/                 base papelyluna
```

El frontend **solo** habla con el backend, y lo hace desde un único archivo (`frontend/src/api/api.js`).
Google Sheets ya no se usa en ninguna parte.

### Estructura del código

```
backend/
├── manage.py                      Comandos de Django (migrate, runserver, inicializar_datos)
├── requirements.txt               Dependencias de Python
├── papelyluna/
│   ├── settings.py                Configuración: base de datos (lee .env), CORS, zona horaria, IVA
│   └── urls.py                    Envía todo lo que empiece por /api/ a la aplicación pos
├── pos/
│   ├── models.py                  MODELOS: las tablas de la base de datos
│   ├── urls.py                    RUTAS: qué dirección atiende cada controlador
│   ├── controladores/             CONTROLADORES: reciben la petición, revisan permisos y responden JSON
│   │   ├── autenticacion.py       Iniciar, consultar y cerrar sesión
│   │   ├── catalogos.py           Categorías, clientes, proveedores y descuentos
│   │   ├── productos.py           Productos
│   │   ├── ventas.py              Ventas, cierre, corrección y reembolsos
│   │   ├── compras.py             Compras
│   │   ├── faltantes.py           Faltantes
│   │   └── reportes.py            Reportes
│   ├── servicios/                 REGLAS DEL NEGOCIO con transacciones
│   │   ├── ventas.py              Guardar, cerrar, corregir y reembolsar (ajustan inventario)
│   │   ├── compras.py             Registrar compra (stock y costo)
│   │   └── inventario.py          Bloquea los productos mientras se cambia su stock (varias cajas a la vez)
│   ├── serializadores.py          Convierte los modelos a JSON
│   ├── utilidades.py              Sesión, errores, lectura segura de datos, fechas
│   ├── migrations/                Historial de cambios de las tablas (lo genera Django)
│   └── management/commands/inicializar_datos.py   Script de inicialización (usuarios y catálogo)
├── .env.example                   Plantilla de los datos de conexión (se copia como .env)
└── sql/
    ├── 01_crear_base_de_datos.sql Crea el usuario y la base de datos vacía
    └── 02_esquema.sql             SQL de las tablas que crea migrate (consulta)

frontend/
├── index.html, package.json, vite.config.js, .env.example
└── src/
    ├── main.jsx                   Punto de entrada
    ├── App.jsx                    Componente raíz: sesión, estado compartido y navegación
    ├── config.js                  Constantes: IVA, métodos de pago, tipos de descuento y faltante
    ├── api/
    │   ├── api.js                 ÚNICO módulo que usa fetch (API_URL, token, apiGet/apiPost/apiPut/apiDelete)
    │   └── datos.js               Leer / crear / actualizar / eliminar un recurso
    ├── servicios/                 Operaciones contra el backend (sin HTML)
    │   ├── sesion.js              Iniciar, recuperar y cerrar sesión; rol
    │   ├── ventas.js              Guardar, cerrar, corregir y reembolsar
    │   ├── compras.js             Registrar compra
    │   └── reportes.js            Pedir reportes
    ├── pages/                     Una pantalla por archivo (Login, Venta, Historial, Productos,
    │                              Compras, Más, GestorEntidad, Faltantes, Reportes)
    ├── components/                Piezas reutilizables (Boton, Modal, Factura, ModalCobro,
    │                              CorreccionVenta, ModalReembolso, FormularioFaltante...)
    ├── utils/                     Funciones puras: cálculos, formato, validaciones, ids
    └── estilos/                   CSS: variables, base, componentes, páginas, entrega-final e impresión
```

## API REST

Todas las rutas empiezan por `/api`. Se envía y se recibe **JSON**. Salvo iniciar sesión, todas
exigen el encabezado `Authorization: Bearer <token>`.

| Verbo y ruta | Qué hace | Rol |
|---|---|---|
| `POST /sesion` | Iniciar sesión: `{ usuario, clave }` → `{ token, usuario }` | público |
| `GET /sesion` · `DELETE /sesion` | Consultar la sesión · cerrar sesión | con sesión |
| `GET /productos` · `GET /productos/:id` | Listar · ver uno | todos |
| `POST /productos` · `DELETE /productos/:id` | Crear · eliminar | administrador |
| `PUT /productos/:id` | Actualizar (el cajero solo nombre, categoría, precio y costo) | todos |
| `GET /categorias`, `/proveedores`, `/descuentos` | Listar | todos |
| `POST`, `PUT /:id`, `DELETE /:id` en categorías, proveedores y descuentos | Crear, actualizar, eliminar | administrador |
| `GET`, `POST`, `PUT /:id`, `DELETE /:id` en `/clientes` | CRUD de clientes | todos |
| `GET /ventas` (`?estado=abierta` o `cerrada`) · `GET /ventas/:id` | Listar · ver una | todos |
| `PUT /ventas/:id` | Guardar una venta abierta (la crea o la actualiza) | todos |
| `POST /ventas/:id/cierre` | Cobrar y cerrar (descuenta inventario) | todos |
| `PUT /ventas/:id/correccion` | Corregir una venta cerrada | administrador |
| `GET /ventas/:id/reembolsos` · `POST /ventas/:id/reembolsos` | Listar · registrar reembolso | todos · administrador |
| `GET /compras` · `POST /compras` · `GET /compras/:id` | Listar · registrar · ver una | administrador |
| `GET /faltantes` (`?tipo=&proveedorId=&estado=`) · `POST /faltantes` | Listar con filtros · registrar | todos |
| `PUT /faltantes/:id` · `DELETE /faltantes/:id` | Resolver o reabrir · eliminar | administrador |
| `GET /reportes/ventas?desde=&hasta=` | Ventas totales por rango de fechas | administrador |
| `GET /reportes/productos-vendidos?desde=&hasta=` | Productos más vendidos | administrador |
| `GET /reportes/compras?desde=&hasta=` | Compras por rango de fechas | administrador |
| `GET /reportes/faltantes` · `GET /reportes/faltantes-por-proveedor` | Faltantes frecuentes · pendientes por proveedor | administrador |

Códigos de respuesta: `200` bien, `201` creado, `400` datos inválidos, `401` sin sesión,
`403` sin permiso, `404` no existe, `409` conflicto (stock insuficiente, registros asociados...).
Los errores siempre llegan como `{ "mensaje": "..." }`.

## Base de datos

Tablas: `usuarios`, `sesiones`, `categorias`, `productos`, `clientes`, `proveedores`, `descuentos`,
`ventas`, `ventas_detalle`, `compras`, `compras_detalle`, `reembolsos`, `reembolsos_detalle` y `faltantes`.

- Las líneas de venta y de compra están en **tablas de detalle** (no como JSON en una columna).
  La API las devuelve dentro de cada venta o compra como el arreglo `items`.
- Cada línea copia nombre, precio y costo del producto al momento de la operación.
- Las llaves foráneas protegen las reglas: no se puede eliminar una categoría con productos,
  un cliente con ventas ni un proveedor con compras o faltantes.

## Decisiones importantes

- **Transacciones.** Cerrar una venta, corregirla, reembolsar y registrar una compra cambian a la vez
  el registro y el inventario. Cada operación corre en una transacción: se guarda todo o no se guarda nada.
- **Varias personas a la vez.** Cuando una operación cambia el stock, PostgreSQL **bloquea** esas filas
  de productos (`SELECT ... FOR UPDATE`) hasta que termina. Si dos cajas cobran al mismo tiempo la última
  unidad, una venta se cierra y la otra recibe el aviso de que no hay stock (probado con 12 ventas
  simultáneas sobre 3 unidades: se cerraron exactamente 3). El frontend vuelve a leer el catálogo cada
  15 segundos y al volver a la pestaña, así cada pantalla ve lo que hacen las demás.
- **Varios clientes a la vez en la misma caja ("ventas en espera").** Arriba del catálogo aparecen las
  ventas guardadas (de esta caja o de otra). Con un toque se cambia a una de ellas, y la venta que estaba
  en pantalla se guarda sola en espera. Así se puede atender a un cliente mientras otro busca algo.
- **Reintentos seguros.** Los ids se generan en el frontend. Si se pierde la respuesta y se reintenta,
  el backend reconoce el mismo id y no duplica la venta, la compra ni el reembolso.
- **El backend calcula los totales.** El frontend solo envía qué productos y cuántos; los precios salen
  de la base de datos. Si el total cambió mientras se cobraba, la venta no se cierra y se avisa.
- **IVA del 19 %** sobre el subtotal, como en los MVP anteriores.
- **Descuentos.** Se aplican al total (subtotal + IVA), uno por venta. La venta guarda una copia del
  descuento: eliminarlo del catálogo no altera las ventas ya registradas. No se permiten totales negativos.
- **Corrección.** La venta conserva su id y queda marcada con quién la corrigió y cuándo (se ve en el
  historial y en la factura). El inventario se ajusta por la diferencia. Si un producto quedaría en
  negativo, se rechaza indicando cuál. Una venta con reembolsos ya no se puede corregir.
- **Reembolsos.** No se puede reembolsar más de lo vendido (descontando reembolsos previos). El valor
  es la parte proporcional del total pagado, así se respeta el descuento. El stock sube solo si se
  marca que el producto vuelve al inventario.
- **Faltantes.** Son informativos: no cambian el inventario. Para los reportes se agrupan por nombre
  normalizado (minúsculas, sin tildes y plural simple): "Cofias" y "cofia" cuentan juntos.
- **Autenticación.** Al iniciar sesión el backend entrega un token que el frontend guarda en
  `localStorage` (así la sesión se mantiene al recargar) y envía en cada petición. La sesión dura 12 horas.
- **Sin `alert`, `confirm` ni `prompt`:** los avisos y confirmaciones son componentes propios.

## Despliegue

Pendiente. El proyecto quedó preparado: el frontend toma la dirección de la API de la variable
`VITE_API_URL` (ver `frontend/.env.example`), y el backend lee de variables de entorno (archivo `backend/.env`)
los datos de PostgreSQL (`DB_NOMBRE`, `DB_USUARIO`, `DB_CLAVE`, `DB_SERVIDOR`, `DB_PUERTO`), la clave secreta
(`DJANGO_SECRET_KEY`), el modo (`DJANGO_DEBUG`) y los orígenes permitidos (`CORS_ORIGENES`).
El archivo `.github/workflows/desplegar.yml` ya publica la carpeta `frontend`.

- URL frontend: _por definir_
- URL backend / API: _por definir_

## Recursos utilizados

- React 19 y Vite. Django 5.2, PostgreSQL, psycopg, django-cors-headers y python-dotenv.
- Tipografías **Atkinson Hyperlegible** y **Patrick Hand** (licencia SIL OFL), instaladas con `@fontsource`.
- Iconos de línea basados en **Feather Icons** (licencia MIT), dibujados como SVG propios en `components/Icono.jsx`.
- Logo de Papel y Luna (propio del negocio).
- Documentos del curso: P1 Documento de Requerimientos y P3.1 Entrega Final MVP 3.

## Equipo

- Eduardo Llamas
- Sofia Romero
- Ana Lucia Solis 
