# ---------------------------------------------------------------------------
# controladores/ventas.py: rutas de las ventas. El controlador solo recibe la
# petición, revisa permisos y responde; las reglas están en servicios/ventas.py.
#
#   GET  /api/ventas                    listar (se puede filtrar con ?estado=abierta|cerrada)
#   GET  /api/ventas/<id>               ver una venta
#   PUT  /api/ventas/<id>               guardar una venta ABIERTA (la crea o la actualiza)
#   POST /api/ventas/<id>/cierre        cobrar y cerrar la venta (descuenta inventario)
#   PUT  /api/ventas/<id>/correccion    corregir una venta cerrada (solo administrador)
#   GET  /api/ventas/<id>/reembolsos    listar los reembolsos de la venta
#   POST /api/ventas/<id>/reembolsos    registrar un reembolso (solo administrador)
# ---------------------------------------------------------------------------
from ..serializadores import producto_a_json, reembolso_a_json, venta_a_json
from ..servicios import ventas as servicio
from ..utilidades import controlador_api, exigir_administrador, leer_json, metodo_no_permitido, responder


def productos_a_json(productos):
    """Lista de productos cuyo stock cambió, para que el frontend actualice su catálogo."""
    lista = []
    for producto in productos:
        lista.append(producto_a_json(producto))
    return lista


@controlador_api()
def ventas(request):
    if request.method == "GET":
        consulta = servicio.consulta_de_ventas().order_by("-fecha")

        # Filtro opcional por estado
        estado = request.GET.get("estado", "")
        if estado != "":
            consulta = consulta.filter(estado=estado)

        lista = []
        for venta in consulta:
            lista.append(venta_a_json(venta))
        return responder(lista)

    return metodo_no_permitido()


@controlador_api()
def venta(request, venta_id):
    if request.method == "GET":
        return responder(venta_a_json(servicio.buscar_venta(venta_id)))

    if request.method == "PUT":
        guardada = servicio.guardar_venta_abierta(venta_id, leer_json(request), request.usuario)
        return responder(venta_a_json(guardada))

    return metodo_no_permitido()


@controlador_api()
def cierre(request, venta_id):
    if request.method == "POST":
        cerrada, cambiados = servicio.cerrar_venta(venta_id, leer_json(request), request.usuario)
        return responder({"venta": venta_a_json(cerrada), "productos": productos_a_json(cambiados)})

    return metodo_no_permitido()


@controlador_api()
def correccion(request, venta_id):
    if request.method == "PUT":
        exigir_administrador(request)
        corregida, cambiados = servicio.corregir_venta(venta_id, leer_json(request), request.usuario)
        return responder({"venta": venta_a_json(corregida), "productos": productos_a_json(cambiados)})

    return metodo_no_permitido()


@controlador_api()
def reembolsos(request, venta_id):
    if request.method == "GET":
        lista = []
        for reembolso in servicio.buscar_venta(venta_id).reembolsos.all():
            lista.append(reembolso_a_json(reembolso))
        return responder(lista)

    if request.method == "POST":
        exigir_administrador(request)
        actualizada, cambiados = servicio.reembolsar_venta(venta_id, leer_json(request), request.usuario)
        return responder({"venta": venta_a_json(actualizada), "productos": productos_a_json(cambiados)}, 201)

    return metodo_no_permitido()
