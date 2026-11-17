# ---------------------------------------------------------------------------
# serializadores.py: convierten un registro de la base de datos (un modelo) en un
# diccionario listo para enviar como JSON al frontend.
# Los nombres de los campos son los mismos de la Guía P2.2 (categoriaId, metodoPago,
# seguimientoInventario...) para que el frontend casi no tuviera que cambiar.
# ---------------------------------------------------------------------------
from .utilidades import fecha_a_texto


def nombre_de_usuario(usuario):
    """Nombre para mostrar de un usuario (o texto vacío si no hay)."""
    if usuario is None:
        return ""
    if usuario.nombre != "":
        return usuario.nombre
    return usuario.username


def usuario_a_json(usuario):
    return {
        "id": usuario.id,
        "usuario": usuario.username,
        "nombre": nombre_de_usuario(usuario),
        "rol": usuario.rol,
    }


def categoria_a_json(categoria):
    return {"id": categoria.id, "nombre": categoria.nombre}


def producto_a_json(producto):
    return {
        "id": producto.id,
        "codigo": producto.codigo,
        "nombre": producto.nombre,
        "categoriaId": producto.categoria_id,
        "precio": producto.precio,
        "costo": producto.costo,
        "seguimientoInventario": producto.seguimiento_inventario,
        "stock": producto.stock,
    }


def contacto_a_json(registro):
    """Sirve para clientes y proveedores: tienen los mismos campos."""
    return {
        "id": registro.id,
        "nombre": registro.nombre,
        "telefono": registro.telefono,
        "correo": registro.correo,
    }


def descuento_a_json(descuento):
    return {
        "id": descuento.id,
        "nombre": descuento.nombre,
        "tipo": descuento.tipo,
        "valor": descuento.valor,
    }


def reembolso_a_json(reembolso):
    items = []
    for detalle in reembolso.detalles.all():
        items.append({
            "detalleId": detalle.venta_detalle_id,
            "nombre": detalle.nombre,
            "cantidad": detalle.cantidad,
            "valor": detalle.valor,
            "retornaInventario": detalle.retorna_inventario,
        })
    return {
        "id": reembolso.id,
        "ventaId": reembolso.venta_id,
        "fecha": fecha_a_texto(reembolso.fecha),
        "usuario": nombre_de_usuario(reembolso.usuario),
        "total": reembolso.total,
        "items": items,
    }


def venta_a_json(venta):
    """La venta con sus líneas (arreglo "items") y sus reembolsos."""
    # 1. Reembolsos de la venta y cuántas unidades se han devuelto de cada línea
    reembolsos = []
    total_reembolsado = 0
    devuelto_por_linea = {}  # id de la línea -> unidades ya reembolsadas
    for reembolso in venta.reembolsos.all():
        reembolsos.append(reembolso_a_json(reembolso))
        total_reembolsado = total_reembolsado + reembolso.total
        for detalle in reembolso.detalles.all():
            anterior = devuelto_por_linea.get(detalle.venta_detalle_id, 0)
            devuelto_por_linea[detalle.venta_detalle_id] = anterior + detalle.cantidad

    # 2. Líneas de la venta
    items = []
    unidades_vendidas = 0
    unidades_devueltas = 0
    for detalle in venta.detalles.all():
        devuelto = devuelto_por_linea.get(detalle.id, 0)
        unidades_vendidas = unidades_vendidas + detalle.cantidad
        unidades_devueltas = unidades_devueltas + devuelto

        producto_id = ""
        if detalle.producto_id is not None:
            producto_id = detalle.producto_id

        items.append({
            "detalleId": detalle.id,
            "productoId": producto_id,
            "nombre": detalle.nombre,
            "precio": detalle.precio,
            "costo": detalle.costo,
            "cantidad": detalle.cantidad,
            "cantidadReembolsada": devuelto,
        })

    # 3. ¿La venta tiene reembolsos? "ninguno", "parcial" o "total"
    estado_reembolso = "ninguno"
    if unidades_devueltas > 0:
        estado_reembolso = "parcial"
        if unidades_devueltas >= unidades_vendidas:
            estado_reembolso = "total"

    cliente_id = ""
    if venta.cliente_id is not None:
        cliente_id = venta.cliente_id

    descuento_id = ""
    if venta.descuento_id is not None:
        descuento_id = venta.descuento_id

    return {
        "id": venta.id,
        "fecha": fecha_a_texto(venta.fecha),
        "estado": venta.estado,
        "clienteId": cliente_id,
        "metodoPago": venta.metodo_pago,
        "subtotal": venta.subtotal,
        "iva": venta.iva,
        "descuentoId": descuento_id,
        "descuentoNombre": venta.descuento_nombre,
        "descuentoTipo": venta.descuento_tipo,
        "descuentoValor": venta.descuento_valor,
        "descuentoMonto": venta.descuento_monto,
        "total": venta.total,
        "valorRecibido": venta.valor_recibido,
        "cambio": venta.cambio,
        "usuario": nombre_de_usuario(venta.usuario),
        "actualizadoEn": fecha_a_texto(venta.actualizado_en),
        "corregida": venta.corregida,
        "corregidaPor": nombre_de_usuario(venta.corregida_por),
        "corregidaEn": fecha_a_texto(venta.corregida_en),
        "estadoReembolso": estado_reembolso,
        "totalReembolsado": total_reembolsado,
        "reembolsos": reembolsos,
        "items": items,
    }


def compra_a_json(compra):
    items = []
    for detalle in compra.detalles.all():
        producto_id = ""
        if detalle.producto_id is not None:
            producto_id = detalle.producto_id
        items.append({
            "productoId": producto_id,
            "nombre": detalle.nombre,
            "costo": detalle.costo,
            "cantidad": detalle.cantidad,
        })
    return {
        "id": compra.id,
        "fecha": fecha_a_texto(compra.fecha),
        "proveedorId": compra.proveedor_id,
        "total": compra.total,
        "usuario": nombre_de_usuario(compra.usuario),
        "items": items,
    }


def faltante_a_json(faltante):
    producto_id = ""
    if faltante.producto_id is not None:
        producto_id = faltante.producto_id

    proveedor_id = ""
    if faltante.proveedor_id is not None:
        proveedor_id = faltante.proveedor_id

    return {
        "id": faltante.id,
        "productoId": producto_id,
        "descripcion": faltante.descripcion,
        "cantidad": faltante.cantidad,
        "fecha": fecha_a_texto(faltante.fecha),
        "tipo": faltante.tipo,
        "proveedorId": proveedor_id,
        "observacion": faltante.observacion,
        "estado": faltante.estado,
        "usuario": nombre_de_usuario(faltante.usuario),
        "resueltoEn": fecha_a_texto(faltante.resuelto_en),
    }
