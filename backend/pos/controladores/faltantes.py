# ---------------------------------------------------------------------------
# controladores/faltantes.py: productos que un cliente pidió y no había.
#   GET    /api/faltantes         listar, con filtros ?tipo= &proveedorId= &estado=
#   POST   /api/faltantes         registrar (administrador y cajero)
#   PUT    /api/faltantes/<id>    cambiar el estado: resuelto o pendiente (administrador)
#   DELETE /api/faltantes/<id>    eliminar un faltante registrado por error (administrador)
# Un faltante es solo informativo: NO cambia el inventario ni las ventas.
# ---------------------------------------------------------------------------
from django.utils import timezone

from ..models import Faltante, Producto, Proveedor
from ..serializadores import faltante_a_json
from ..utilidades import (
    ErrorNegocio, controlador_api, exigir_administrador, id_o_nuevo, leer_entero, leer_json,
    leer_texto, metodo_no_permitido, normalizar_nombre, responder,
)


@controlador_api()
def faltantes(request):
    if request.method == "GET":
        consulta = Faltante.objects.select_related("usuario").order_by("-fecha")

        # Filtros: solo se aplican los que lleguen en la dirección
        tipo = request.GET.get("tipo", "")
        if tipo != "":
            consulta = consulta.filter(tipo=tipo)

        proveedor_id = request.GET.get("proveedorId", "")
        if proveedor_id == "ninguno":
            consulta = consulta.filter(proveedor__isnull=True)  # faltantes sin proveedor
        elif proveedor_id != "":
            consulta = consulta.filter(proveedor_id=proveedor_id)

        estado = request.GET.get("estado", "")
        if estado != "":
            consulta = consulta.filter(estado=estado)

        lista = []
        for faltante in consulta:
            lista.append(faltante_a_json(faltante))
        return responder(lista)

    if request.method == "POST":
        datos = leer_json(request)

        identificador = id_o_nuevo(datos)
        if Faltante.objects.filter(id=identificador).exists():
            raise ErrorNegocio("Ya existe un registro con ese id.", 409)

        tipo = leer_texto(datos, "tipo")
        if tipo not in ["agotado", "inexistente"]:
            raise ErrorNegocio("Indica si el producto está agotado o no existe en el inventario.", 400)

        nuevo = Faltante(id=identificador, tipo=tipo, usuario=request.usuario)

        # El producto puede venir como id (existe en el catálogo) o como texto libre
        producto_id = leer_texto(datos, "productoId")
        if producto_id != "":
            producto = Producto.objects.filter(id=producto_id).first()
            if producto is None:
                raise ErrorNegocio("El producto elegido ya no existe en el catálogo.", 400)
            nuevo.producto = producto
            nuevo.descripcion = producto.nombre
        else:
            nuevo.descripcion = leer_texto(datos, "descripcion", True, "Producto")

        # Nombre normalizado: sirve para agrupar "cofia" y "cofias" en los reportes
        nuevo.nombre_normalizado = normalizar_nombre(nuevo.descripcion)
        nuevo.cantidad = leer_entero(datos, "cantidad", "Cantidad solicitada", minimo=1)
        nuevo.observacion = leer_texto(datos, "observacion")

        # Proveedor: opcional
        proveedor_id = leer_texto(datos, "proveedorId")
        if proveedor_id != "":
            proveedor = Proveedor.objects.filter(id=proveedor_id).first()
            if proveedor is None:
                raise ErrorNegocio("El proveedor elegido ya no existe.", 400)
            nuevo.proveedor = proveedor

        nuevo.save()
        return responder(faltante_a_json(nuevo), 201)

    return metodo_no_permitido()


@controlador_api()
def faltante(request, faltante_id):
    registro = Faltante.objects.select_related("usuario").filter(id=faltante_id).first()
    if registro is None:
        raise ErrorNegocio("El faltante no existe.", 404)

    if request.method == "GET":
        return responder(faltante_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        exigir_administrador(request)
        estado = leer_texto(leer_json(request), "estado")
        if estado not in ["pendiente", "resuelto"]:
            raise ErrorNegocio("El estado debe ser pendiente o resuelto.", 400)

        registro.estado = estado
        if estado == "resuelto":
            registro.resuelto_en = timezone.now()
        else:
            registro.resuelto_en = None
        registro.save()
        return responder(faltante_a_json(registro))

    if request.method == "DELETE":
        exigir_administrador(request)
        registro.delete()
        return responder({"id": faltante_id})

    return metodo_no_permitido()
