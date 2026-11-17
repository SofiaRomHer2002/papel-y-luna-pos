# ---------------------------------------------------------------------------
# servicios/ventas.py: las REGLAS DEL NEGOCIO de las ventas.
#   - guardar una venta abierta (no toca el inventario)
#   - cerrar una venta (cobro + descuento de inventario)
#   - corregir una venta cerrada (ajusta el inventario por la diferencia)
#   - reembolsar productos de una venta cerrada
#
# Las funciones que cambian a la vez la venta y el inventario llevan
# @transaction.atomic: o se guardan TODOS los cambios o no se guarda NINGUNO.
# Si algo falla a la mitad (por ejemplo, falta stock del tercer producto), la base
# de datos deshace sola lo que ya se había hecho. Esto reemplaza la lista de
# "pendientes por reintentar" que necesitábamos con Google Sheets.
#
# Además, esas funciones BLOQUEAN la venta y los productos que van a cambiar
# (select_for_update / bloquear_productos): si dos personas hacen algo sobre lo
# mismo al mismo tiempo, la segunda espera a que la primera termine.
# ---------------------------------------------------------------------------
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..models import Cliente, Descuento, Producto, Reembolso, ReembolsoDetalle, Venta, VentaDetalle
from ..utilidades import ErrorNegocio, leer_entero, leer_fecha_hora, leer_texto, nuevo_id
from .inventario import bloquear_productos

METODOS_PAGO = ["Efectivo", "Nequi", "Debe"]


def consulta_de_ventas():
    """Consulta base de ventas. prefetch_related trae de una vez las líneas y los
    reembolsos de todas las ventas (en vez de una consulta por cada venta)."""
    return Venta.objects.select_related("usuario", "corregida_por").prefetch_related(
        "detalles", "reembolsos__detalles", "reembolsos__usuario"
    )


def buscar_venta(venta_id):
    """Devuelve la venta con sus líneas y reembolsos, o un error 404 si no existe."""
    venta = consulta_de_ventas().filter(id=venta_id).first()
    if venta is None:
        raise ErrorNegocio("La venta no existe.", 404)
    return venta


# ----- Cálculos -------------------------------------------------------------

def redondear_division(numerador, denominador):
    """Divide y redondea al entero más cercano usando solo enteros (el dinero no lleva decimales)."""
    return (2 * numerador + denominador) // (2 * denominador)


def calcular_iva(subtotal):
    """IVA del subtotal, redondeado al peso."""
    porcentaje = round(settings.TASA_IVA * 100)  # 19
    return redondear_division(subtotal * porcentaje, 100)


def calcular_monto_descuento(tipo, valor, total_sin_descuento):
    """Cuántos pesos se restan. El descuento se aplica al TOTAL de la venta (subtotal + IVA)."""
    if tipo == "porcentual":
        return redondear_division(total_sin_descuento * valor, 100)
    if tipo == "fijo":
        return valor
    return 0  # sin descuento


def aplicar_totales(venta, subtotal):
    """Calcula IVA, descuento y total, y los deja escritos en la venta (sin guardarla todavía)."""
    iva = calcular_iva(subtotal)
    total_sin_descuento = subtotal + iva
    monto = calcular_monto_descuento(venta.descuento_tipo, venta.descuento_valor, total_sin_descuento)

    # Regla: no se permiten totales negativos
    if monto > total_sin_descuento:
        raise ErrorNegocio(
            "El descuento \"" + venta.descuento_nombre + "\" es mayor que el total de la venta. "
            "Quita el descuento o agrega más productos.", 400
        )

    venta.subtotal = subtotal
    venta.iva = iva
    venta.descuento_monto = monto
    venta.total = total_sin_descuento - monto


# ----- Lectura de los datos que manda el frontend ----------------------------

def leer_cliente(datos):
    """Devuelve el cliente indicado en "clienteId" (o None si la venta es de mostrador)."""
    cliente_id = leer_texto(datos, "clienteId")
    if cliente_id == "":
        return None
    cliente = Cliente.objects.filter(id=cliente_id).first()
    if cliente is None:
        raise ErrorNegocio("El cliente elegido ya no existe. Elige otro.", 400)
    return cliente


def poner_descuento(venta, datos):
    """Copia en la venta el descuento indicado en "descuentoId" (solo uno por venta).
    Si llega vacío, la venta queda sin descuento."""
    descuento_id = leer_texto(datos, "descuentoId")
    if descuento_id == "":
        venta.descuento = None
        venta.descuento_nombre = ""
        venta.descuento_tipo = ""
        venta.descuento_valor = 0
        return

    descuento = Descuento.objects.filter(id=descuento_id).first()
    if descuento is None:
        raise ErrorNegocio("El descuento elegido ya no existe. Elige otro o quítalo.", 400)

    venta.descuento = descuento
    venta.descuento_nombre = descuento.nombre
    venta.descuento_tipo = descuento.tipo
    venta.descuento_valor = descuento.valor


def leer_lineas(datos, bloquear=False):
    """Lee "items": [{ productoId, cantidad }] y devuelve una lista de (producto, cantidad)
    con los datos ACTUALES de cada producto en la base de datos.
    Con bloquear=True los productos quedan bloqueados hasta terminar la transacción
    (se usa al cerrar la venta, porque ahí se va a cambiar el stock)."""
    items = datos.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise ErrorNegocio("Agrega al menos un producto a la venta.", 400)

    # 1. Juntamos los ids de todos los productos de la venta
    ids = []
    for item in items:
        if not isinstance(item, dict):
            raise ErrorNegocio("Las líneas de la venta no tienen el formato esperado.", 400)
        ids.append(leer_texto(item, "productoId"))

    # 2. Los traemos de la base de datos en una sola consulta (bloqueados si se pidió)
    if bloquear:
        encontrados = bloquear_productos(ids)
    else:
        encontrados = {}
        for producto in Producto.objects.filter(id__in=ids):
            encontrados[producto.id] = producto

    # 3. Armamos las líneas revisando cada una
    lineas = []
    ids_vistos = []
    for item in items:
        producto_id = leer_texto(item, "productoId")
        cantidad = leer_entero(item, "cantidad", "cantidad", minimo=1)

        producto = encontrados.get(producto_id)
        if producto is None:
            nombre = leer_texto(item, "nombre") or "Un producto"
            raise ErrorNegocio("\"" + nombre + "\" ya no existe en el catálogo. Quítalo de la venta.", 400)

        if producto_id in ids_vistos:
            raise ErrorNegocio("El producto \"" + producto.nombre + "\" está repetido en la venta.", 400)
        ids_vistos.append(producto_id)

        lineas.append((producto, cantidad))
    return lineas


def reemplazar_detalles(venta, lineas):
    """Borra las líneas anteriores de la venta y crea las nuevas. Devuelve el subtotal."""
    venta.detalles.all().delete()
    subtotal = 0
    for producto, cantidad in lineas:
        VentaDetalle.objects.create(
            venta=venta,
            producto=producto,
            nombre=producto.nombre,
            precio=producto.precio,
            costo=producto.costo,
            cantidad=cantidad,
        )
        subtotal = subtotal + producto.precio * cantidad
    return subtotal


def leer_pago(venta, datos):
    """Valida el método de pago y deja escritos en la venta: método, valor recibido y cambio.
    Se llama DESPUÉS de calcular el total."""
    metodo = leer_texto(datos, "metodoPago")
    if metodo not in METODOS_PAGO:
        raise ErrorNegocio("Elige un método de pago: Efectivo, Nequi o Debe.", 400)

    # Regla heredada del MVP 2: pagar con "Debe" exige un cliente
    if metodo == "Debe" and venta.cliente is None:
        raise ErrorNegocio("Para dejar la venta en Debe, elige un cliente.", 400)

    venta.metodo_pago = metodo
    if metodo == "Efectivo":
        recibido = leer_entero(datos, "valorRecibido", "valor recibido", minimo=0, por_defecto=0)
        if recibido < venta.total:
            raise ErrorNegocio("El valor recibido no alcanza para pagar el total de la venta.", 400)
        venta.valor_recibido = recibido
        venta.cambio = recibido - venta.total
    elif metodo == "Nequi":
        venta.valor_recibido = venta.total  # Nequi llega exacto: no hay cambio
        venta.cambio = 0
    else:
        venta.valor_recibido = 0  # Debe: no se recibe dinero
        venta.cambio = 0


# ----- Guardar una venta abierta ---------------------------------------------

@transaction.atomic
def guardar_venta_abierta(venta_id, datos, usuario):
    """Crea o actualiza una venta con estado "abierta". NO toca el inventario."""
    # select_for_update: si la venta ya existe, queda bloqueada mientras la guardamos
    venta = Venta.objects.select_for_update().filter(id=venta_id).first()

    if venta is not None and venta.estado == "cerrada":
        raise ErrorNegocio("Esta venta ya fue cerrada (quizás desde otro dispositivo). Actualiza la lista de ventas.", 409)

    if venta is None:
        venta = Venta(id=venta_id, fecha=leer_fecha_hora(datos.get("fecha")))

    lineas = leer_lineas(datos)

    venta.estado = "abierta"
    venta.cliente = leer_cliente(datos)
    venta.metodo_pago = ""
    venta.valor_recibido = 0
    venta.cambio = 0
    venta.usuario = usuario
    poner_descuento(venta, datos)
    venta.save()  # la venta debe existir antes de crear sus líneas

    subtotal = reemplazar_detalles(venta, lineas)
    aplicar_totales(venta, subtotal)
    venta.save()

    return buscar_venta(venta_id)


# ----- Cerrar una venta (cobro) ----------------------------------------------

@transaction.atomic
def cerrar_venta(venta_id, datos, usuario):
    """Cobra y cierra la venta, y descuenta el inventario, todo en UNA transacción.
    Devuelve (venta, productos_cambiados)."""
    venta = Venta.objects.select_for_update().filter(id=venta_id).first()

    # Si la venta ya estaba cerrada, es un reintento (la respuesta anterior se perdió):
    # devolvemos la misma venta SIN descontar el inventario otra vez.
    if venta is not None and venta.estado == "cerrada":
        return buscar_venta(venta_id), []

    if venta is None:
        venta = Venta(id=venta_id)

    # bloquear=True: nadie más puede cambiar el stock de estos productos hasta que terminemos
    lineas = leer_lineas(datos, bloquear=True)

    # 1. Revisamos el stock de TODA la venta antes de cambiar nada
    problemas = []
    for producto, cantidad in lineas:
        if producto.seguimiento_inventario and cantidad > producto.stock:
            problemas.append(producto.nombre + " (quedan " + str(producto.stock) + ", la venta lleva " + str(cantidad) + ")")
    if len(problemas) > 0:
        raise ErrorNegocio("No se puede cerrar la venta, no hay stock suficiente: " + "; ".join(problemas) + ".", 409)

    # 2. Datos generales de la venta
    venta.estado = "cerrada"
    venta.fecha = timezone.now()  # la fecha de la venta es el momento del cobro
    venta.cliente = leer_cliente(datos)
    venta.usuario = usuario
    poner_descuento(venta, datos)
    venta.save()

    # 3. Líneas y totales (con los precios actuales de la base de datos)
    subtotal = reemplazar_detalles(venta, lineas)
    aplicar_totales(venta, subtotal)

    # 4. Si el total cambió mientras el cajero cobraba (otro usuario cambió un precio o el
    #    descuento), NO cerramos: el cajero debe ver el total nuevo antes de recibir el dinero.
    total_esperado = datos.get("totalEsperado")
    if total_esperado is not None and total_esperado != venta.total:
        raise ErrorNegocio(
            "El total de la venta cambió mientras cobrabas (alguien actualizó un precio o el descuento). "
            "Revisa el total nuevo y vuelve a cobrar.", 409
        )

    # 5. Pago
    leer_pago(venta, datos)
    venta.save()

    # 6. Descontamos el inventario (solo productos con seguimiento)
    cambiados = []
    for producto, cantidad in lineas:
        if producto.seguimiento_inventario:
            producto.stock = producto.stock - cantidad
            producto.save()
            cambiados.append(producto)

    return buscar_venta(venta_id), cambiados


# ----- Corregir una venta cerrada (sección 3.4) --------------------------------

@transaction.atomic
def corregir_venta(venta_id, datos, usuario):
    """Corrige una venta cerrada: productos, cantidades, cliente, método de pago y descuento.
    La venta conserva su id y queda marcada como corregida (quién y cuándo).
    El inventario se ajusta por la DIFERENCIA entre la venta original y la corregida.
    Devuelve (venta, productos_cambiados)."""
    venta = Venta.objects.select_for_update().filter(id=venta_id).first()
    if venta is None:
        raise ErrorNegocio("La venta no existe.", 404)
    if venta.estado != "cerrada":
        raise ErrorNegocio("Solo se pueden corregir ventas cerradas.", 409)
    if venta.reembolsos.count() > 0:
        raise ErrorNegocio("Esta venta ya tiene reembolsos, por eso no se puede corregir.", 409)

    items = datos.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise ErrorNegocio("La venta corregida debe tener al menos un producto.", 400)

    # Líneas que tiene la venta ANTES de corregir, guardadas por su id
    originales = {}
    for detalle in venta.detalles.all():
        originales[detalle.id] = detalle

    # 1. Recorremos las líneas corregidas y anotamos qué cambia
    diferencias = {}    # id del producto -> unidades de más (+) o de menos (-) respecto al original
    conservadas = []    # ids de las líneas originales que siguen en la venta
    por_actualizar = [] # (línea original, cantidad nueva)
    por_crear = []      # (producto, cantidad) de productos que no estaban en la venta

    for item in items:
        if not isinstance(item, dict):
            raise ErrorNegocio("Las líneas de la venta no tienen el formato esperado.", 400)
        cantidad = leer_entero(item, "cantidad", "cantidad", minimo=1)
        producto_id = leer_texto(item, "productoId")

        # ¿Esta línea ya estaba en la venta original? La buscamos por su id o por su producto
        original = None
        detalle_id = item.get("detalleId")
        if detalle_id in originales:
            original = originales[detalle_id]
        elif producto_id != "":
            for detalle in originales.values():
                if detalle.producto_id == producto_id:
                    original = detalle

        if original is not None:
            if original.id in conservadas:
                raise ErrorNegocio("El producto \"" + original.nombre + "\" está repetido en la venta.", 400)
            conservadas.append(original.id)
            por_actualizar.append((original, cantidad))

            diferencia = cantidad - original.cantidad
            if original.producto_id is None:
                # El producto fue eliminado del catálogo: se puede bajar la cantidad, pero no subirla
                if diferencia > 0:
                    raise ErrorNegocio("\"" + original.nombre + "\" ya no existe en el catálogo: no se puede aumentar su cantidad.", 400)
            else:
                diferencias[original.producto_id] = diferencias.get(original.producto_id, 0) + diferencia
        else:
            # Producto nuevo en la venta: entra con el precio actual del catálogo
            producto = Producto.objects.filter(id=producto_id).first()
            if producto is None:
                raise ErrorNegocio("Uno de los productos agregados ya no existe en el catálogo.", 400)
            ya_agregado = False
            for otro, otra_cantidad in por_crear:
                if otro.id == producto.id:
                    ya_agregado = True
            if ya_agregado:
                raise ErrorNegocio("El producto \"" + producto.nombre + "\" está repetido en la venta.", 400)
            por_crear.append((producto, cantidad))
            diferencias[producto.id] = diferencias.get(producto.id, 0) + cantidad

    # 2. Las líneas originales que ya no están se quitan: sus unidades vuelven al inventario
    por_borrar = []
    for detalle in originales.values():
        if detalle.id not in conservadas:
            por_borrar.append(detalle)
            if detalle.producto_id is not None:
                diferencias[detalle.producto_id] = diferencias.get(detalle.producto_id, 0) - detalle.cantidad

    # 3. Ajustamos el inventario según la diferencia. Si algún producto quedara en negativo,
    #    se lanza el error y la transacción deshace TODO (no queda nada a medias).
    cambiados = []
    bloqueados = bloquear_productos(list(diferencias.keys()))
    for producto_id, diferencia in diferencias.items():
        if diferencia == 0:
            continue
        producto = bloqueados.get(producto_id)
        if producto is None or not producto.seguimiento_inventario:
            continue  # sin seguimiento de inventario: el stock no cambia
        stock_nuevo = producto.stock - diferencia
        if stock_nuevo < 0:
            raise ErrorNegocio(
                "No se puede corregir la venta: no hay stock suficiente de \"" + producto.nombre + "\" "
                "(quedan " + str(producto.stock) + " y la corrección necesita " + str(diferencia) + " más).", 409
            )
        producto.stock = stock_nuevo
        producto.save()
        cambiados.append(producto)

    # 4. Guardamos las líneas corregidas
    for detalle in por_borrar:
        detalle.delete()
    for detalle, cantidad in por_actualizar:
        detalle.cantidad = cantidad
        detalle.save()
    for producto, cantidad in por_crear:
        VentaDetalle.objects.create(
            venta=venta, producto=producto, nombre=producto.nombre,
            precio=producto.precio, costo=producto.costo, cantidad=cantidad,
        )

    # 5. Cliente y descuento. "conservarDescuento" deja el descuento que ya tenía la venta
    #    (sirve cuando ese descuento ya fue eliminado del catálogo).
    venta.cliente = leer_cliente(datos)
    if datos.get("conservarDescuento") is not True:
        poner_descuento(venta, datos)

    # 6. Totales recalculados automáticamente
    subtotal = 0
    for detalle in venta.detalles.all():
        subtotal = subtotal + detalle.precio * detalle.cantidad
    aplicar_totales(venta, subtotal)

    # 7. Método de pago (se valida contra el total nuevo)
    leer_pago(venta, datos)

    # 8. Marca de corrección: quién y cuándo
    venta.corregida = True
    venta.corregida_por = usuario
    venta.corregida_en = timezone.now()
    venta.save()

    return buscar_venta(venta_id), cambiados


# ----- Reembolsos (sección 3.5) -------------------------------------------------

@transaction.atomic
def reembolsar_venta(venta_id, datos, usuario):
    """Registra un reembolso (parcial o total) de una venta cerrada.
    "items": [{ detalleId, cantidad, retornaInventario }].
    Devuelve (venta, productos_cambiados)."""
    # Bloqueamos la venta: dos reembolsos al mismo tiempo no pueden devolver más de lo vendido
    venta = Venta.objects.select_for_update().filter(id=venta_id).first()
    if venta is None:
        raise ErrorNegocio("La venta no existe.", 404)
    if venta.estado != "cerrada":
        raise ErrorNegocio("Solo se pueden reembolsar productos de ventas cerradas.", 409)

    # Si este reembolso ya se había guardado (reintento), no lo registramos dos veces
    reembolso_id = leer_texto(datos, "id")
    if reembolso_id == "":
        reembolso_id = nuevo_id()
    if Reembolso.objects.filter(id=reembolso_id).exists():
        return buscar_venta(venta_id), []

    items = datos.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise ErrorNegocio("Elige al menos un producto para reembolsar.", 400)

    # Unidades ya reembolsadas antes, por línea de la venta
    devuelto_antes = {}
    total_devuelto_antes = 0
    for anterior in venta.reembolsos.all():
        total_devuelto_antes = total_devuelto_antes + anterior.total
        for detalle in anterior.detalles.all():
            devuelto_antes[detalle.venta_detalle_id] = devuelto_antes.get(detalle.venta_detalle_id, 0) + detalle.cantidad

    lineas_venta = {}
    ids_productos = []
    for detalle in venta.detalles.all():
        lineas_venta[detalle.id] = detalle
        if detalle.producto_id is not None:
            ids_productos.append(detalle.producto_id)

    # Productos de la venta, bloqueados por si hay que devolverlos al inventario
    bloqueados = bloquear_productos(ids_productos)

    reembolso = Reembolso.objects.create(id=reembolso_id, venta=venta, usuario=usuario, total=0)

    total = 0
    cambiados = []
    ultimo = None
    ids_vistos = []
    for item in items:
        if not isinstance(item, dict):
            raise ErrorNegocio("Los productos a reembolsar no tienen el formato esperado.", 400)

        linea = lineas_venta.get(item.get("detalleId"))
        if linea is None:
            raise ErrorNegocio("Uno de los productos no pertenece a esta venta.", 400)
        if linea.id in ids_vistos:
            raise ErrorNegocio("El producto \"" + linea.nombre + "\" está repetido en el reembolso.", 400)
        ids_vistos.append(linea.id)

        cantidad = leer_entero(item, "cantidad", "cantidad", minimo=1)

        # Regla: no se puede reembolsar más de lo vendido (descontando reembolsos previos)
        disponible = linea.cantidad - devuelto_antes.get(linea.id, 0)
        if cantidad > disponible:
            raise ErrorNegocio(
                "De \"" + linea.nombre + "\" solo se pueden reembolsar " + str(disponible) + " (ya descontando reembolsos anteriores).", 409
            )

        # Valor a devolver: la parte del TOTAL pagado que corresponde a estas unidades.
        # venta.total ya incluye el IVA y el descuento, así el descuento se respeta de forma proporcional.
        valor = 0
        if venta.subtotal > 0:
            valor = redondear_division(linea.precio * cantidad * venta.total, venta.subtotal)

        retorna = item.get("retornaInventario") is True
        ultimo = ReembolsoDetalle.objects.create(
            reembolso=reembolso, venta_detalle=linea, nombre=linea.nombre,
            cantidad=cantidad, valor=valor, retorna_inventario=retorna,
        )
        total = total + valor
        devuelto_antes[linea.id] = devuelto_antes.get(linea.id, 0) + cantidad

        # El stock solo sube si se indicó que el producto retorna al inventario
        if retorna and linea.producto_id is not None:
            producto = bloqueados.get(linea.producto_id)
            if producto is not None and producto.seguimiento_inventario:
                producto.stock = producto.stock + cantidad
                producto.save()
                cambiados.append(producto)

    # Si con este reembolso ya se devolvió TODA la venta, ajustamos los pesos del redondeo
    # para que lo devuelto en total sea exactamente lo que pagó el cliente.
    todo_devuelto = True
    for linea in lineas_venta.values():
        if devuelto_antes.get(linea.id, 0) < linea.cantidad:
            todo_devuelto = False
    if todo_devuelto and ultimo is not None:
        ajuste = venta.total - total_devuelto_antes - total
        if ajuste != 0:
            ultimo.valor = ultimo.valor + ajuste
            ultimo.save()
            total = total + ajuste

    reembolso.total = total
    reembolso.save()

    return buscar_venta(venta_id), cambiados
