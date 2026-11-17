# ---------------------------------------------------------------------------
# controladores/compras.py: compras a proveedores (solo administrador).
#   GET  /api/compras          listar
#   POST /api/compras          registrar (suma stock y actualiza costos en una transacción)
#   GET  /api/compras/<id>     ver el detalle de una compra
# ---------------------------------------------------------------------------
from ..serializadores import compra_a_json, producto_a_json
from ..servicios import compras as servicio
from ..utilidades import (
    ErrorNegocio, controlador_api, exigir_administrador, id_o_nuevo, leer_json, metodo_no_permitido, responder,
)


@controlador_api()
def compras(request):
    exigir_administrador(request)

    if request.method == "GET":
        lista = []
        for compra in servicio.consulta_de_compras().order_by("-fecha"):
            lista.append(compra_a_json(compra))
        return responder(lista)

    if request.method == "POST":
        datos = leer_json(request)
        registrada, cambiados = servicio.registrar_compra(id_o_nuevo(datos), datos, request.usuario)

        productos = []
        for producto in cambiados:
            productos.append(producto_a_json(producto))
        return responder({"compra": compra_a_json(registrada), "productos": productos}, 201)

    return metodo_no_permitido()


@controlador_api()
def compra(request, compra_id):
    exigir_administrador(request)

    if request.method == "GET":
        registro = servicio.consulta_de_compras().filter(id=compra_id).first()
        if registro is None:
            raise ErrorNegocio("La compra no existe.", 404)
        return responder(compra_a_json(registro))

    return metodo_no_permitido()
