# ---------------------------------------------------------------------------
# controladores/productos.py: CRUD de productos.
#   /api/productos        GET = listar     POST = crear (administrador)
#   /api/productos/<id>   GET = ver uno    PUT = actualizar    DELETE = eliminar (administrador)
# El cajero puede CONSULTAR productos y hacer la "edición en caliente" desde la venta
# (nombre, categoría, precio y costo), pero no puede tocar el inventario.
# ---------------------------------------------------------------------------
from ..models import Categoria, Producto
from ..serializadores import producto_a_json
from ..utilidades import (
    ErrorNegocio, controlador_api, exigir_administrador, id_o_nuevo, leer_entero, leer_json,
    leer_texto, metodo_no_permitido, responder,
)


def siguiente_codigo():
    """Calcula el siguiente código interno: PL-14, PL-15... Lo hace el backend para que
    dos personas creando productos al mismo tiempo no reciban el mismo código."""
    maximo = 0
    for codigo in Producto.objects.values_list("codigo", flat=True):
        texto = str(codigo).replace("PL-", "")
        if texto.isdigit() and int(texto) > maximo:
            maximo = int(texto)
    return "PL-" + str(maximo + 1)


def buscar_categoria(categoria_id):
    categoria = Categoria.objects.filter(id=categoria_id).first()
    if categoria is None:
        raise ErrorNegocio("La categoría elegida ya no existe. Elige otra.", 400)
    return categoria


@controlador_api()
def productos(request):
    if request.method == "GET":
        lista = []
        for producto in Producto.objects.order_by("nombre"):
            lista.append(producto_a_json(producto))
        return responder(lista)

    if request.method == "POST":
        exigir_administrador(request)
        datos = leer_json(request)

        identificador = id_o_nuevo(datos)
        if Producto.objects.filter(id=identificador).exists():
            raise ErrorNegocio("Ya existe un registro con ese id.", 409)

        nuevo = Producto(id=identificador, codigo=siguiente_codigo())
        nuevo.nombre = leer_texto(datos, "nombre", True, "Nombre")
        nuevo.categoria = buscar_categoria(leer_texto(datos, "categoriaId", True, "Categoría"))
        nuevo.precio = leer_entero(datos, "precio", "Precio de venta", minimo=0)
        nuevo.costo = leer_entero(datos, "costo", "Costo", minimo=0)
        nuevo.seguimiento_inventario = datos.get("seguimientoInventario") is True
        nuevo.stock = 0
        if nuevo.seguimiento_inventario:
            nuevo.stock = leer_entero(datos, "stock", "Stock", minimo=0)
        nuevo.save()
        return responder(producto_a_json(nuevo), 201)

    return metodo_no_permitido()


@controlador_api()
def producto(request, producto_id):
    registro = Producto.objects.filter(id=producto_id).first()
    if registro is None:
        raise ErrorNegocio("El producto no existe (puede que alguien lo haya eliminado).", 404)

    if request.method == "GET":
        return responder(producto_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        datos = leer_json(request)

        # El cajero solo hace la edición en caliente: no puede cambiar el inventario
        cambia_inventario = "stock" in datos or "seguimientoInventario" in datos
        if cambia_inventario and request.usuario.rol != "administrador":
            raise ErrorNegocio("Solo un administrador puede cambiar el inventario de un producto.", 403)

        # Solo cambian los campos que llegaron en la petición
        if "nombre" in datos:
            registro.nombre = leer_texto(datos, "nombre", True, "Nombre")
        if "categoriaId" in datos:
            registro.categoria = buscar_categoria(leer_texto(datos, "categoriaId", True, "Categoría"))
        if "precio" in datos:
            registro.precio = leer_entero(datos, "precio", "Precio de venta", minimo=0)
        if "costo" in datos:
            registro.costo = leer_entero(datos, "costo", "Costo", minimo=0)
        if "seguimientoInventario" in datos:
            registro.seguimiento_inventario = datos.get("seguimientoInventario") is True
        if "stock" in datos and registro.seguimiento_inventario:
            registro.stock = leer_entero(datos, "stock", "Stock", minimo=0, por_defecto=0)

        registro.save()
        return responder(producto_a_json(registro))

    if request.method == "DELETE":
        exigir_administrador(request)
        # Las ventas y compras ya registradas conservan su copia del nombre y el precio
        registro.delete()
        return responder({"id": producto_id})

    return metodo_no_permitido()
