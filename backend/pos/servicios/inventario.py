# ---------------------------------------------------------------------------
# servicios/inventario.py: apoyo para cambiar el stock sin errores cuando varias
# personas usan el sistema AL MISMO TIEMPO (por ejemplo, dos cajas cobrando).
#
# El problema: si dos cajas venden a la vez la última unidad de un producto, las
# dos podrían leer "stock = 1", y las dos lo dejarían en 0: se vendería dos veces.
#
# La solución: antes de revisar y cambiar el stock, la transacción BLOQUEA las
# filas de esos productos en PostgreSQL (SELECT ... FOR UPDATE). Mientras una caja
# tiene el bloqueo, la otra ESPERA; cuando la primera termina, la segunda lee el
# stock ya actualizado (0) y recibe el aviso de que no alcanza.
# ---------------------------------------------------------------------------
from ..models import Producto


def bloquear_productos(ids):
    """Trae los productos con esos ids y los deja bloqueados hasta que termine la
    transacción. Devuelve un diccionario: id del producto -> producto.
    Solo se puede usar dentro de una función con @transaction.atomic."""
    productos = {}

    # order_by("id"): todas las transacciones bloquean en el MISMO orden. Así dos
    # operaciones nunca se quedan esperándose la una a la otra (un "abrazo mortal").
    consulta = Producto.objects.select_for_update().filter(id__in=ids).order_by("id")
    for producto in consulta:
        productos[producto.id] = producto

    return productos
