# ---------------------------------------------------------------------------
# controladores/catalogos.py: CRUD de categorías, clientes, proveedores y descuentos.
# Cada recurso tiene dos rutas REST:
#   /api/<recurso>        GET = listar          POST = crear
#   /api/<recurso>/<id>   GET = ver uno         PUT = actualizar     DELETE = eliminar
# Permisos (matriz de la guía, sección 3.8):
#   categorías, proveedores y descuentos: todos pueden CONSULTAR; solo el administrador cambia.
#   clientes: administrador y cajero pueden hacer todo.
# ---------------------------------------------------------------------------
from ..models import Categoria, Cliente, Descuento, Proveedor
from ..serializadores import categoria_a_json, contacto_a_json, descuento_a_json
from ..utilidades import (
    ErrorNegocio, controlador_api, exigir_administrador, id_o_nuevo, leer_entero, leer_json,
    leer_texto, metodo_no_permitido, responder,
)


def texto_cantidad(cantidad, singular, plural):
    """Escribe "1 venta" o "3 ventas" según la cantidad."""
    if cantidad == 1:
        return "1 " + singular
    return str(cantidad) + " " + plural


def revisar_id_libre(modelo, identificador):
    """Evita crear dos registros con el mismo id."""
    if modelo.objects.filter(id=identificador).exists():
        raise ErrorNegocio("Ya existe un registro con ese id.", 409)


def buscar_o_404(modelo, identificador, mensaje):
    registro = modelo.objects.filter(id=identificador).first()
    if registro is None:
        raise ErrorNegocio(mensaje, 404)
    return registro


# ----- Categorías -------------------------------------------------------------

@controlador_api()
def categorias(request):
    if request.method == "GET":
        lista = []
        for categoria in Categoria.objects.order_by("nombre"):
            lista.append(categoria_a_json(categoria))
        return responder(lista)

    if request.method == "POST":
        exigir_administrador(request)
        datos = leer_json(request)
        identificador = id_o_nuevo(datos)
        revisar_id_libre(Categoria, identificador)
        categoria = Categoria.objects.create(id=identificador, nombre=leer_texto(datos, "nombre", True, "Nombre"))
        return responder(categoria_a_json(categoria), 201)

    return metodo_no_permitido()


@controlador_api()
def categoria(request, categoria_id):
    registro = buscar_o_404(Categoria, categoria_id, "La categoría no existe.")

    if request.method == "GET":
        return responder(categoria_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        exigir_administrador(request)
        datos = leer_json(request)
        registro.nombre = leer_texto(datos, "nombre", True, "Nombre")
        registro.save()
        return responder(categoria_a_json(registro))

    if request.method == "DELETE":
        exigir_administrador(request)
        # Regla: no se elimina una categoría que tenga productos
        usados = registro.productos.count()
        if usados > 0:
            raise ErrorNegocio(
                "No se puede eliminar: hay " + texto_cantidad(usados, "producto que usa", "productos que usan") + " esta categoría.", 409
            )
        registro.delete()
        return responder({"id": categoria_id})

    return metodo_no_permitido()


# ----- Clientes y proveedores (tienen los mismos campos) -------------------------

def leer_contacto(registro, datos):
    """Copia en el registro los campos nombre, teléfono y correo que llegaron."""
    registro.nombre = leer_texto(datos, "nombre", True, "Nombre")
    registro.telefono = leer_texto(datos, "telefono")
    registro.correo = leer_texto(datos, "correo")


@controlador_api()
def clientes(request):
    if request.method == "GET":
        lista = []
        for cliente in Cliente.objects.order_by("nombre"):
            lista.append(contacto_a_json(cliente))
        return responder(lista)

    if request.method == "POST":
        datos = leer_json(request)
        identificador = id_o_nuevo(datos)
        revisar_id_libre(Cliente, identificador)
        nuevo = Cliente(id=identificador)
        leer_contacto(nuevo, datos)
        nuevo.save()
        return responder(contacto_a_json(nuevo), 201)

    return metodo_no_permitido()


@controlador_api()
def cliente(request, cliente_id):
    registro = buscar_o_404(Cliente, cliente_id, "El cliente no existe.")

    if request.method == "GET":
        return responder(contacto_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        leer_contacto(registro, leer_json(request))
        registro.save()
        return responder(contacto_a_json(registro))

    if request.method == "DELETE":
        # Regla: no se elimina un cliente con ventas (abiertas o cerradas)
        asociadas = registro.ventas.count()
        if asociadas > 0:
            raise ErrorNegocio(
                "No se puede eliminar: este cliente tiene " + texto_cantidad(asociadas, "venta registrada", "ventas registradas") + ".", 409
            )
        registro.delete()
        return responder({"id": cliente_id})

    return metodo_no_permitido()


@controlador_api()
def proveedores(request):
    if request.method == "GET":
        lista = []
        for proveedor in Proveedor.objects.order_by("nombre"):
            lista.append(contacto_a_json(proveedor))
        return responder(lista)

    if request.method == "POST":
        exigir_administrador(request)
        datos = leer_json(request)
        identificador = id_o_nuevo(datos)
        revisar_id_libre(Proveedor, identificador)
        nuevo = Proveedor(id=identificador)
        leer_contacto(nuevo, datos)
        nuevo.save()
        return responder(contacto_a_json(nuevo), 201)

    return metodo_no_permitido()


@controlador_api()
def proveedor(request, proveedor_id):
    registro = buscar_o_404(Proveedor, proveedor_id, "El proveedor no existe.")

    if request.method == "GET":
        return responder(contacto_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        exigir_administrador(request)
        leer_contacto(registro, leer_json(request))
        registro.save()
        return responder(contacto_a_json(registro))

    if request.method == "DELETE":
        exigir_administrador(request)
        # Regla: no se elimina un proveedor con compras o con faltantes asociados
        compras = registro.compras.count()
        if compras > 0:
            raise ErrorNegocio(
                "No se puede eliminar: este proveedor tiene " + texto_cantidad(compras, "compra registrada", "compras registradas") + ".", 409
            )
        faltantes = registro.faltantes.count()
        if faltantes > 0:
            raise ErrorNegocio(
                "No se puede eliminar: este proveedor tiene " + texto_cantidad(faltantes, "faltante asociado", "faltantes asociados") + ".", 409
            )
        registro.delete()
        return responder({"id": proveedor_id})

    return metodo_no_permitido()


# ----- Descuentos (catálogo reutilizable) ------------------------------------------

def leer_descuento(registro, datos):
    """Valida y copia nombre, tipo y valor del descuento."""
    registro.nombre = leer_texto(datos, "nombre", True, "Nombre")

    tipo = leer_texto(datos, "tipo")
    if tipo not in ["porcentual", "fijo"]:
        raise ErrorNegocio("Elige el tipo de descuento: porcentual o valor fijo.", 400)
    registro.tipo = tipo

    valor = leer_entero(datos, "valor", "Valor", minimo=1)
    # Un porcentaje mayor a 100 dejaría el total en negativo
    if tipo == "porcentual" and valor > 100:
        raise ErrorNegocio("Un descuento porcentual no puede ser mayor que 100.", 400)
    registro.valor = valor


@controlador_api()
def descuentos(request):
    if request.method == "GET":
        # El cajero también los consulta: los necesita para aplicarlos en una venta
        lista = []
        for descuento in Descuento.objects.order_by("nombre"):
            lista.append(descuento_a_json(descuento))
        return responder(lista)

    if request.method == "POST":
        exigir_administrador(request)
        datos = leer_json(request)
        identificador = id_o_nuevo(datos)
        revisar_id_libre(Descuento, identificador)
        nuevo = Descuento(id=identificador)
        leer_descuento(nuevo, datos)
        nuevo.save()
        return responder(descuento_a_json(nuevo), 201)

    return metodo_no_permitido()


@controlador_api()
def descuento(request, descuento_id):
    registro = buscar_o_404(Descuento, descuento_id, "El descuento no existe.")

    if request.method == "GET":
        return responder(descuento_a_json(registro))

    if request.method in ["PUT", "PATCH"]:
        exigir_administrador(request)
        leer_descuento(registro, leer_json(request))
        registro.save()
        return responder(descuento_a_json(registro))

    if request.method == "DELETE":
        exigir_administrador(request)
        # Eliminar un descuento NO altera las ventas que ya lo usaron: cada venta guardó
        # su propia copia del nombre, el tipo, el valor y los pesos descontados.
        registro.delete()
        return responder({"id": descuento_id})

    return metodo_no_permitido()
