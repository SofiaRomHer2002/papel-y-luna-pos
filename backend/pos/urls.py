# ---------------------------------------------------------------------------
# urls.py (de la aplicación pos): las RUTAS de la API REST.
# Cada línea une una dirección con el controlador que la atiende.
# El verbo HTTP (GET, POST, PUT, DELETE) decide qué hace el controlador:
#   GET = consultar    POST = crear    PUT = actualizar    DELETE = eliminar
# Todas quedan bajo /api/ (ver papelyluna/urls.py). <str:...> es el id del registro.
# ---------------------------------------------------------------------------
from django.urls import path

from .controladores import autenticacion, catalogos, compras, faltantes, productos, reportes, ventas

urlpatterns = [
    # Autenticación
    path("sesion", autenticacion.sesion),

    # Catálogos
    path("categorias", catalogos.categorias),
    path("categorias/<str:categoria_id>", catalogos.categoria),
    path("clientes", catalogos.clientes),
    path("clientes/<str:cliente_id>", catalogos.cliente),
    path("proveedores", catalogos.proveedores),
    path("proveedores/<str:proveedor_id>", catalogos.proveedor),
    path("descuentos", catalogos.descuentos),
    path("descuentos/<str:descuento_id>", catalogos.descuento),

    # Productos
    path("productos", productos.productos),
    path("productos/<str:producto_id>", productos.producto),

    # Ventas, correcciones y reembolsos
    path("ventas", ventas.ventas),
    path("ventas/<str:venta_id>", ventas.venta),
    path("ventas/<str:venta_id>/cierre", ventas.cierre),
    path("ventas/<str:venta_id>/correccion", ventas.correccion),
    path("ventas/<str:venta_id>/reembolsos", ventas.reembolsos),

    # Compras
    path("compras", compras.compras),
    path("compras/<str:compra_id>", compras.compra),

    # Faltantes
    path("faltantes", faltantes.faltantes),
    path("faltantes/<str:faltante_id>", faltantes.faltante),

    # Reportes
    path("reportes/ventas", reportes.reporte_ventas),
    path("reportes/productos-vendidos", reportes.reporte_productos_vendidos),
    path("reportes/compras", reportes.reporte_compras),
    path("reportes/faltantes", reportes.reporte_faltantes),
    path("reportes/faltantes-por-proveedor", reportes.reporte_faltantes_por_proveedor),
]
