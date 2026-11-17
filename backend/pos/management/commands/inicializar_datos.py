# ---------------------------------------------------------------------------
# inicializar_datos.py: script de inicialización. Se ejecuta UNA vez, después de
# crear las tablas, con:
#       python manage.py inicializar_datos
# Crea los dos usuarios del sistema (administrador y cajero) y, si la base de datos
# está vacía, carga el catálogo inicial: los mismos productos, categorías, clientes y
# proveedores que estaban en la hoja de cálculo del MVP 2 (migración de datos).
# Se puede ejecutar varias veces sin problema: no duplica nada.
# Con "--solo-usuarios" crea únicamente los usuarios (sin datos de ejemplo).
# ---------------------------------------------------------------------------
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from pos.models import Categoria, Cliente, Descuento, Producto, Proveedor, Sesion, Usuario

# Usuarios iniciales: (usuario, contraseña, rol, nombre para mostrar)
USUARIOS = [
    ("Admin_PapelyLuna", "Admin_12345!", "administrador", "Administrador"),
    ("Cajero_PapelyLuna", "Cajero_12345!", "cajero", "Cajero"),
]

# (id, nombre)
CATEGORIAS = [
    ("c-001", "Papelería"),
    ("c-002", "Escritura"),
    ("c-003", "Accesorios"),
    ("c-004", "Blocs"),
    ("c-005", "Servicios"),
]

# (id, código, nombre, id de la categoría, precio, costo, ¿lleva inventario?, stock)
PRODUCTOS = [
    ("p-001", "PL-1", "Cuaderno", "c-001", 50000, 30000, True, 20),
    ("p-002", "PL-2", "Lápiz", "c-002", 5000, 2000, True, 30),
    ("p-003", "PL-3", "Borrador", "c-002", 4000, 1500, True, 18),
    ("p-004", "PL-4", "Regla", "c-003", 5000, 3000, True, 12),
    ("p-005", "PL-5", "Carpeta", "c-001", 8000, 5000, True, 15),
    ("p-006", "PL-6", "Marcador", "c-002", 9000, 6000, True, 12),
    ("p-007", "PL-7", "Bloc de notas (50x50)", "c-004", 6000, 4500, True, 25),
    ("p-008", "PL-8", "Pluma negra", "c-002", 7000, 5500, True, 27),
    ("p-009", "PL-9", "Bolígrafo Bic negro", "c-002", 8000, 6000, True, 11),
    ("p-010", "PL-10", "Tijeras", "c-003", 9000, 7000, True, 8),
    ("p-011", "PL-11", "Cinta adhesiva", "c-003", 10000, 8000, True, 4),
    ("p-012", "PL-12", "Papel bond", "c-001", 11000, 9000, True, 23),
    ("p-013", "PL-13", "Fotocopia (por hoja)", "c-005", 200, 60, False, 0),
]

# (id, nombre, teléfono, correo) - datos de ejemplo: reemplázalos por los reales
CLIENTES = [
    ("cl-001", "María Fernanda Gómez", "3001234567", "maria.gomez@example.com"),
    ("cl-002", "Carlos Andrés Pérez", "3109876543", "carlos.perez@example.com"),
]

PROVEEDORES = [
    ("pr-001", "Distribuidora Escolar Bogotá", "6011234567", "ventas@distribuidoraescolar.example.com"),
    ("pr-002", "Mayorista del Norte", "6017654321", "pedidos@mayoristadelnorte.example.com"),
]

# (id, nombre, tipo, valor) - dos descuentos de ejemplo, uno de cada tipo
DESCUENTOS = [
    ("d-001", "Estudiantes 10 %", "porcentual", 10),
    ("d-002", "Bono de $ 2.000", "fijo", 2000),
]


class Command(BaseCommand):
    help = "Crea los usuarios iniciales (administrador y cajero) y carga el catálogo inicial."

    def add_arguments(self, parser):
        parser.add_argument("--solo-usuarios", action="store_true", help="Crea solo los usuarios, sin datos de ejemplo.")
        parser.add_argument("--restablecer-claves", action="store_true", help="Recuperación explícita: exige INITIAL_ADMIN_PASSWORD e INITIAL_CASHIER_PASSWORD y revoca sus sesiones.")

    def handle(self, *args, **opciones):
        restablecer = opciones["restablecer_claves"]
        if restablecer and not all(os.environ.get(nombre) for nombre in ("INITIAL_ADMIN_PASSWORD", "INITIAL_CASHIER_PASSWORD")):
            raise CommandError("Para restablecer claves define INITIAL_ADMIN_PASSWORD e INITIAL_CASHIER_PASSWORD. No se cambió ningún usuario.")
        self.crear_usuarios(restablecer)

        if opciones["solo_usuarios"]:
            self.stdout.write("Se omitieron los datos de ejemplo (--solo-usuarios).")
        elif Producto.objects.exists() or Categoria.objects.exists():
            # Si ya hay catálogo, no lo tocamos (para no pisar los datos reales de la papelería)
            self.stdout.write("La base de datos ya tiene catálogo: no se cargaron datos de ejemplo.")
        else:
            self.cargar_catalogo()

        self.stdout.write(self.style.SUCCESS("Listo. Ya puedes iniciar sesión."))

    @transaction.atomic
    def crear_usuarios(self, restablecer=False):
        for nombre_usuario, clave, rol, nombre in USUARIOS:
            variable = "INITIAL_ADMIN_PASSWORD" if rol == "administrador" else "INITIAL_CASHIER_PASSWORD"
            # Una transacción y username único impiden duplicados en deploys simultáneos.
            with transaction.atomic():
                usuario, creado = Usuario.objects.get_or_create(
                    username=nombre_usuario, defaults={"rol": rol, "nombre": nombre},
                )
                if creado or restablecer:
                    usuario.set_password(os.environ.get(variable) or clave)
                    usuario.save(update_fields=["password"])
                    if restablecer:
                        Sesion.objects.filter(usuario=usuario).delete()
            estado = "Clave restablecida: " if restablecer else ("Usuario creado: " if creado else "Usuario existente, sin cambios: ")
            self.stdout.write(estado + nombre_usuario + " (" + usuario.rol + ")")

    @transaction.atomic
    def cargar_catalogo(self):
        for identificador, nombre in CATEGORIAS:
            Categoria.objects.create(id=identificador, nombre=nombre)

        for identificador, codigo, nombre, categoria_id, precio, costo, seguimiento, stock in PRODUCTOS:
            Producto.objects.create(
                id=identificador, codigo=codigo, nombre=nombre, categoria_id=categoria_id,
                precio=precio, costo=costo, seguimiento_inventario=seguimiento, stock=stock,
            )

        for identificador, nombre, telefono, correo in CLIENTES:
            Cliente.objects.create(id=identificador, nombre=nombre, telefono=telefono, correo=correo)

        for identificador, nombre, telefono, correo in PROVEEDORES:
            Proveedor.objects.create(id=identificador, nombre=nombre, telefono=telefono, correo=correo)

        for identificador, nombre, tipo, valor in DESCUENTOS:
            Descuento.objects.create(id=identificador, nombre=nombre, tipo=tipo, valor=valor)

        self.stdout.write("Catálogo inicial cargado: categorías, productos, clientes, proveedores y descuentos.")
