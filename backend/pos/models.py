# ---------------------------------------------------------------------------
# models.py: los MODELOS. Cada clase es una TABLA de la base de datos y cada
# atributo es una COLUMNA. Django crea las tablas a partir de estas clases
# (con "python manage.py migrate").
#
# Tablas del sistema:
#   usuarios, sesiones
#   categorias, productos, clientes, proveedores, descuentos
#   ventas + ventas_detalle        (una fila por cada producto de la venta)
#   compras + compras_detalle      (una fila por cada producto de la compra)
#   reembolsos + reembolsos_detalle
#   faltantes
#
# Los ids de los registros son TEXTO (un UUID que genera el frontend), igual que
# en el MVP 2. Así reintentar un guardado nunca duplica el registro.
# ---------------------------------------------------------------------------
from django.contrib.auth.models import AbstractUser
from django.db import models


# ----- Usuarios y sesiones -------------------------------------------------

class Usuario(AbstractUser):
    """Usuario del sistema. Hereda de Django el nombre de usuario y la contraseña
    (que se guarda CIFRADA, nunca en texto) y le agregamos el rol."""

    ROLES = [("administrador", "Administrador"), ("cajero", "Cajero")]

    rol = models.CharField(max_length=20, choices=ROLES, default="cajero")
    nombre = models.CharField(max_length=80, blank=True, default="")  # nombre para mostrar

    class Meta:
        db_table = "usuarios"


class Sesion(models.Model):
    """Una sesión iniciada. El "token" es una clave larga al azar que el frontend
    guarda y envía en cada petición para demostrar quién es."""

    token = models.CharField(max_length=64, primary_key=True)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="sesiones")
    creada_en = models.DateTimeField(auto_now_add=True)
    vence_en = models.DateTimeField()

    class Meta:
        db_table = "sesiones"


# ----- Catálogos -----------------------------------------------------------

class Categoria(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=80)

    class Meta:
        db_table = "categorias"


class Producto(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    codigo = models.CharField(max_length=20)
    nombre = models.CharField(max_length=120)
    # PROTECT: la base de datos NO deja borrar una categoría que tenga productos
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="productos")
    precio = models.IntegerField()  # dinero en pesos enteros
    costo = models.IntegerField()
    seguimiento_inventario = models.BooleanField(default=True)
    stock = models.IntegerField(default=0)

    class Meta:
        db_table = "productos"


class Cliente(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=120)
    telefono = models.CharField(max_length=30, blank=True, default="")
    correo = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        db_table = "clientes"


class Proveedor(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=120)
    telefono = models.CharField(max_length=30, blank=True, default="")
    correo = models.CharField(max_length=120, blank=True, default="")

    class Meta:
        db_table = "proveedores"


class Descuento(models.Model):
    """Catálogo de descuentos reutilizables. Se aplican al TOTAL de la venta."""

    TIPOS = [("porcentual", "Porcentual"), ("fijo", "Valor fijo")]

    id = models.CharField(max_length=50, primary_key=True)
    nombre = models.CharField(max_length=80)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    valor = models.IntegerField()  # porcentual: de 1 a 100; fijo: pesos

    class Meta:
        db_table = "descuentos"


# ----- Ventas --------------------------------------------------------------

class Venta(models.Model):
    ESTADOS = [("abierta", "Abierta"), ("cerrada", "Cerrada")]

    id = models.CharField(max_length=50, primary_key=True)
    fecha = models.DateTimeField()
    estado = models.CharField(max_length=10, choices=ESTADOS)
    # PROTECT: no se puede borrar un cliente que tenga ventas
    cliente = models.ForeignKey(Cliente, null=True, blank=True, on_delete=models.PROTECT, related_name="ventas")
    metodo_pago = models.CharField(max_length=20, blank=True, default="")

    # Totales (los calcula SIEMPRE el backend)
    subtotal = models.IntegerField(default=0)         # suma de precio x cantidad
    iva = models.IntegerField(default=0)              # 19 % del subtotal
    descuento_monto = models.IntegerField(default=0)  # pesos que se restan por el descuento
    total = models.IntegerField(default=0)            # subtotal + iva - descuento_monto
    valor_recibido = models.IntegerField(default=0)
    cambio = models.IntegerField(default=0)

    # Descuento aplicado. Guardamos una COPIA del nombre, tipo y valor: si después se edita
    # o elimina el descuento del catálogo, la venta ya registrada no cambia.
    # SET_NULL: al borrar el descuento, esta columna queda vacía pero la copia se conserva.
    descuento = models.ForeignKey(Descuento, null=True, blank=True, on_delete=models.SET_NULL, related_name="ventas")
    descuento_nombre = models.CharField(max_length=80, blank=True, default="")
    descuento_tipo = models.CharField(max_length=20, blank=True, default="")
    descuento_valor = models.IntegerField(default=0)

    # Quién la registró y cuándo se modificó por última vez
    usuario = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL, related_name="ventas")
    actualizado_en = models.DateTimeField(auto_now=True)

    # Marca de corrección (sección 3.4): quién corrigió la venta y cuándo
    corregida = models.BooleanField(default=False)
    corregida_por = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL, related_name="correcciones")
    corregida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ventas"


class VentaDetalle(models.Model):
    """Una línea de la venta (tabla de detalle). Copia nombre, precio y costo del
    producto al momento de vender, así un cambio posterior no altera la venta."""

    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="detalles")
    # SET_NULL: si se elimina el producto, la línea conserva su copia de los datos
    producto = models.ForeignKey(Producto, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    nombre = models.CharField(max_length=120)
    precio = models.IntegerField()
    costo = models.IntegerField(default=0)
    cantidad = models.IntegerField()

    class Meta:
        db_table = "ventas_detalle"
        ordering = ["id"]  # las líneas salen siempre en el orden en que se agregaron


# ----- Compras -------------------------------------------------------------

class Compra(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    fecha = models.DateTimeField()
    # PROTECT: no se puede borrar un proveedor que tenga compras
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name="compras")
    total = models.IntegerField(default=0)
    usuario = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL, related_name="compras")

    class Meta:
        db_table = "compras"


class CompraDetalle(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey(Producto, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    nombre = models.CharField(max_length=120)
    costo = models.IntegerField()
    cantidad = models.IntegerField()

    class Meta:
        db_table = "compras_detalle"
        ordering = ["id"]


# ----- Reembolsos ----------------------------------------------------------

class Reembolso(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="reembolsos")
    fecha = models.DateTimeField(auto_now_add=True)
    usuario = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL, related_name="reembolsos")
    total = models.IntegerField(default=0)  # dinero devuelto al cliente en este reembolso

    class Meta:
        db_table = "reembolsos"
        ordering = ["fecha"]  # del reembolso más antiguo al más reciente


class ReembolsoDetalle(models.Model):
    """Qué producto se reembolsó, cuántas unidades y si volvió al inventario."""

    reembolso = models.ForeignKey(Reembolso, on_delete=models.CASCADE, related_name="detalles")
    venta_detalle = models.ForeignKey(VentaDetalle, on_delete=models.CASCADE, related_name="reembolsos")
    nombre = models.CharField(max_length=120)
    cantidad = models.IntegerField()
    valor = models.IntegerField()  # dinero devuelto por esta línea
    retorna_inventario = models.BooleanField(default=True)

    class Meta:
        db_table = "reembolsos_detalle"
        ordering = ["id"]


# ----- Faltantes -----------------------------------------------------------

class Faltante(models.Model):
    """Producto que un cliente pidió y no había (agotado o inexistente)."""

    TIPOS = [("agotado", "Agotado"), ("inexistente", "Producto inexistente")]
    ESTADOS = [("pendiente", "Pendiente"), ("resuelto", "Resuelto")]

    id = models.CharField(max_length=50, primary_key=True)
    # El producto puede ser uno del catálogo (producto) o solo un texto (descripcion)
    producto = models.ForeignKey(Producto, null=True, blank=True, on_delete=models.SET_NULL, related_name="faltantes")
    descripcion = models.CharField(max_length=120)
    # Nombre "normalizado" (minúsculas, sin tildes y en singular) para agrupar en los reportes
    nombre_normalizado = models.CharField(max_length=120)
    cantidad = models.IntegerField(default=1)
    fecha = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    proveedor = models.ForeignKey(Proveedor, null=True, blank=True, on_delete=models.PROTECT, related_name="faltantes")
    observacion = models.CharField(max_length=200, blank=True, default="")
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    usuario = models.ForeignKey(Usuario, null=True, blank=True, on_delete=models.SET_NULL, related_name="faltantes")
    resuelto_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "faltantes"
