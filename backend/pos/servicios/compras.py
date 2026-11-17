# ---------------------------------------------------------------------------
# servicios/compras.py: regla del negocio para registrar una compra a un proveedor.
# La compra, sus líneas, el stock y el costo se guardan en UNA transacción.
# ---------------------------------------------------------------------------
from django.db import transaction

from ..models import Compra, CompraDetalle, Proveedor
from ..utilidades import ErrorNegocio, leer_entero, leer_fecha_hora, leer_texto
from .inventario import bloquear_productos


def consulta_de_compras():
    """Consulta base de compras, trayendo sus líneas de una sola vez."""
    return Compra.objects.select_related("usuario").prefetch_related("detalles")


@transaction.atomic
def registrar_compra(compra_id, datos, usuario):
    """Registra la compra: suma el stock (si el producto lleva inventario) y actualiza
    el costo de cada producto. Devuelve (compra, productos_cambiados)."""
    # Si la compra ya existe es un reintento: no la registramos (ni sumamos stock) dos veces
    existente = consulta_de_compras().filter(id=compra_id).first()
    if existente is not None:
        return existente, []

    proveedor_id = leer_texto(datos, "proveedorId")
    proveedor = Proveedor.objects.filter(id=proveedor_id).first()
    if proveedor is None:
        raise ErrorNegocio("Elige el proveedor de la compra.", 400)

    items = datos.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise ErrorNegocio("Agrega al menos un producto a la compra.", 400)

    compra = Compra.objects.create(
        id=compra_id,
        fecha=leer_fecha_hora(datos.get("fecha")),
        proveedor=proveedor,
        usuario=usuario,
        total=0,
    )

    # Bloqueamos los productos de la compra: si en ese instante una caja está vendiendo
    # uno de ellos, esperamos a que termine para sumar sobre el stock correcto.
    ids = []
    for item in items:
        if not isinstance(item, dict):
            raise ErrorNegocio("Las líneas de la compra no tienen el formato esperado.", 400)
        ids.append(leer_texto(item, "productoId"))
    bloqueados = bloquear_productos(ids)

    total = 0
    cambiados = []
    for item in items:
        producto = bloqueados.get(leer_texto(item, "productoId"))
        if producto is None:
            nombre = leer_texto(item, "nombre") or "Un producto"
            raise ErrorNegocio("\"" + nombre + "\" ya no existe en el catálogo. Quítalo de la compra.", 400)

        cantidad = leer_entero(item, "cantidad", "cantidad", minimo=1)
        costo = leer_entero(item, "costo", "costo", minimo=0)

        CompraDetalle.objects.create(
            compra=compra, producto=producto, nombre=producto.nombre, costo=costo, cantidad=cantidad
        )
        total = total + costo * cantidad

        # Regla del MVP 2: el costo SIEMPRE se actualiza; el stock solo si hay seguimiento
        producto.costo = costo
        if producto.seguimiento_inventario:
            producto.stock = producto.stock + cantidad
        producto.save()
        cambiados.append(producto)

    compra.total = total
    compra.save()

    return consulta_de_compras().get(id=compra_id), cambiados
