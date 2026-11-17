# ---------------------------------------------------------------------------
# controladores/reportes.py: reportes básicos (solo administrador). Todos son GET.
#   /api/reportes/ventas?desde=&hasta=              ventas totales por rango de fechas
#   /api/reportes/productos-vendidos?desde=&hasta=  productos más vendidos
#   /api/reportes/compras?desde=&hasta=             compras registradas
#   /api/reportes/faltantes                         faltantes frecuentes (agrupados por nombre)
#   /api/reportes/faltantes-por-proveedor           pendientes agrupados por proveedor y producto
# Las fechas van como AAAA-MM-DD. El rango mínimo es de 1 día (desde = hasta).
# Los cálculos se hacen con ciclos sencillos para que sean fáciles de seguir.
# ---------------------------------------------------------------------------
from django.utils import timezone

from ..models import Faltante
from ..servicios.compras import consulta_de_compras
from ..servicios.ventas import consulta_de_ventas
from ..utilidades import (
    controlador_api, exigir_administrador, fecha_a_texto, leer_rango_de_fechas, metodo_no_permitido, responder,
)


def ordenar_de_mayor_a_menor(lista, clave):
    """Ordena una lista de diccionarios por una de sus claves, de mayor a menor."""
    def valor_de(elemento):
        return elemento[clave]

    lista.sort(key=valor_de, reverse=True)
    return lista


def ordenar_por_texto(lista, clave):
    """Ordena una lista de diccionarios por una de sus claves, en orden alfabético."""
    def valor_de(elemento):
        return elemento[clave]

    lista.sort(key=valor_de)
    return lista


@controlador_api()
def reporte_ventas(request):
    exigir_administrador(request)
    if request.method != "GET":
        return metodo_no_permitido()

    inicio, fin = leer_rango_de_fechas(request)
    # Solo cuentan las ventas CERRADAS (las abiertas todavía no se cobraron)
    ventas = consulta_de_ventas().filter(estado="cerrada", fecha__gte=inicio, fecha__lt=fin)

    cantidad = 0
    total_vendido = 0
    total_descuentos = 0
    total_reembolsado = 0
    por_metodo = {}  # método de pago -> { cantidad, total }
    por_dia = {}     # día (AAAA-MM-DD) -> { cantidad, total }

    for venta in ventas:
        cantidad = cantidad + 1
        total_vendido = total_vendido + venta.total
        total_descuentos = total_descuentos + venta.descuento_monto
        for reembolso in venta.reembolsos.all():
            total_reembolsado = total_reembolsado + reembolso.total

        if venta.metodo_pago not in por_metodo:
            por_metodo[venta.metodo_pago] = {"metodoPago": venta.metodo_pago, "cantidad": 0, "total": 0}
        por_metodo[venta.metodo_pago]["cantidad"] = por_metodo[venta.metodo_pago]["cantidad"] + 1
        por_metodo[venta.metodo_pago]["total"] = por_metodo[venta.metodo_pago]["total"] + venta.total

        # localtime pasa la fecha a la hora de Colombia antes de sacar el día
        dia = timezone.localtime(venta.fecha).strftime("%Y-%m-%d")
        if dia not in por_dia:
            por_dia[dia] = {"dia": dia, "cantidad": 0, "total": 0}
        por_dia[dia]["cantidad"] = por_dia[dia]["cantidad"] + 1
        por_dia[dia]["total"] = por_dia[dia]["total"] + venta.total

    dias = ordenar_por_texto(list(por_dia.values()), "dia")  # del día más antiguo al más reciente

    return responder({
        "cantidadVentas": cantidad,
        "totalVendido": total_vendido,
        "totalDescuentos": total_descuentos,
        "totalReembolsado": total_reembolsado,
        "totalNeto": total_vendido - total_reembolsado,
        "porMetodoPago": ordenar_de_mayor_a_menor(list(por_metodo.values()), "total"),
        "porDia": dias,
    })


@controlador_api()
def reporte_productos_vendidos(request):
    exigir_administrador(request)
    if request.method != "GET":
        return metodo_no_permitido()

    inicio, fin = leer_rango_de_fechas(request)
    ventas = consulta_de_ventas().filter(estado="cerrada", fecha__gte=inicio, fecha__lt=fin)

    productos = {}  # clave del producto -> { nombre, unidades, reembolsadas, ingresos }
    for venta in ventas:
        # Unidades reembolsadas de cada línea de esta venta
        devuelto = {}
        for reembolso in venta.reembolsos.all():
            for detalle in reembolso.detalles.all():
                devuelto[detalle.venta_detalle_id] = devuelto.get(detalle.venta_detalle_id, 0) + detalle.cantidad

        for linea in venta.detalles.all():
            # Agrupamos por el id del producto; si el producto fue eliminado, por su nombre
            clave = linea.producto_id
            if clave is None:
                clave = "nombre:" + linea.nombre
            if clave not in productos:
                productos[clave] = {"nombre": linea.nombre, "unidades": 0, "reembolsadas": 0, "ingresos": 0}

            productos[clave]["nombre"] = linea.nombre
            productos[clave]["unidades"] = productos[clave]["unidades"] + linea.cantidad
            productos[clave]["reembolsadas"] = productos[clave]["reembolsadas"] + devuelto.get(linea.id, 0)
            productos[clave]["ingresos"] = productos[clave]["ingresos"] + linea.precio * linea.cantidad

    lista = []
    for fila in productos.values():
        fila["unidadesNetas"] = fila["unidades"] - fila["reembolsadas"]
        lista.append(fila)

    return responder(ordenar_de_mayor_a_menor(lista, "unidadesNetas"))


@controlador_api()
def reporte_compras(request):
    exigir_administrador(request)
    if request.method != "GET":
        return metodo_no_permitido()

    inicio, fin = leer_rango_de_fechas(request)
    compras = consulta_de_compras().select_related("proveedor").filter(fecha__gte=inicio, fecha__lt=fin).order_by("-fecha")

    cantidad = 0
    total = 0
    por_proveedor = {}
    lista = []
    for compra in compras:
        cantidad = cantidad + 1
        total = total + compra.total

        nombre = compra.proveedor.nombre
        if compra.proveedor_id not in por_proveedor:
            por_proveedor[compra.proveedor_id] = {"proveedor": nombre, "cantidad": 0, "total": 0}
        por_proveedor[compra.proveedor_id]["cantidad"] = por_proveedor[compra.proveedor_id]["cantidad"] + 1
        por_proveedor[compra.proveedor_id]["total"] = por_proveedor[compra.proveedor_id]["total"] + compra.total

        lista.append({
            "id": compra.id,
            "fecha": fecha_a_texto(compra.fecha),
            "proveedor": nombre,
            "productos": compra.detalles.count(),
            "total": compra.total,
        })

    return responder({
        "cantidadCompras": cantidad,
        "totalComprado": total,
        "porProveedor": ordenar_de_mayor_a_menor(list(por_proveedor.values()), "total"),
        "compras": lista,
    })


@controlador_api()
def reporte_faltantes(request):
    """Faltantes frecuentes: productos con más solicitudes. Los que se escribieron como
    texto se agrupan por su nombre normalizado ("cofia" y "Cofias" cuentan juntos)."""
    exigir_administrador(request)
    if request.method != "GET":
        return metodo_no_permitido()

    grupos = {}
    # order_by("fecha"): al recorrer del más antiguo al más reciente, el último dato visto es el más nuevo
    for faltante in Faltante.objects.order_by("fecha"):
        clave = faltante.nombre_normalizado
        if clave not in grupos:
            grupos[clave] = {"producto": faltante.descripcion, "solicitudes": 0, "unidades": 0, "pendientes": 0, "ultimaFecha": "", "tipo": faltante.tipo}

        grupos[clave]["producto"] = faltante.descripcion
        grupos[clave]["tipo"] = faltante.tipo
        grupos[clave]["solicitudes"] = grupos[clave]["solicitudes"] + 1
        grupos[clave]["unidades"] = grupos[clave]["unidades"] + faltante.cantidad
        grupos[clave]["ultimaFecha"] = fecha_a_texto(faltante.fecha)
        if faltante.estado == "pendiente":
            grupos[clave]["pendientes"] = grupos[clave]["pendientes"] + 1

    lista = []
    for fila in grupos.values():
        # El grupo está "pendiente" mientras tenga al menos una solicitud sin resolver
        if fila["pendientes"] > 0:
            fila["estado"] = "pendiente"
        else:
            fila["estado"] = "resuelto"
        lista.append(fila)

    return responder(ordenar_de_mayor_a_menor(lista, "solicitudes"))


@controlador_api()
def reporte_faltantes_por_proveedor(request):
    """Información para la próxima compra: faltantes PENDIENTES agrupados por proveedor
    y, dentro de cada proveedor, por producto (con las unidades que se han pedido)."""
    exigir_administrador(request)
    if request.method != "GET":
        return metodo_no_permitido()

    proveedores = {}  # id del proveedor (o "" si no tiene) -> { proveedor, productos: {clave: fila} }
    pendientes = Faltante.objects.select_related("proveedor").filter(estado="pendiente").order_by("fecha")
    for faltante in pendientes:
        clave_proveedor = ""
        nombre_proveedor = "Sin proveedor asignado"
        if faltante.proveedor is not None:
            clave_proveedor = faltante.proveedor_id
            nombre_proveedor = faltante.proveedor.nombre

        if clave_proveedor not in proveedores:
            proveedores[clave_proveedor] = {"proveedorId": clave_proveedor, "proveedor": nombre_proveedor, "productos": {}}

        productos = proveedores[clave_proveedor]["productos"]
        clave = faltante.nombre_normalizado
        if clave not in productos:
            productos[clave] = {"producto": faltante.descripcion, "solicitudes": 0, "unidades": 0}
        productos[clave]["producto"] = faltante.descripcion
        productos[clave]["solicitudes"] = productos[clave]["solicitudes"] + 1
        productos[clave]["unidades"] = productos[clave]["unidades"] + faltante.cantidad

    lista = []
    for grupo in proveedores.values():
        grupo["productos"] = ordenar_de_mayor_a_menor(list(grupo["productos"].values()), "unidades")
        lista.append(grupo)

    return responder(ordenar_por_texto(lista, "proveedor"))
