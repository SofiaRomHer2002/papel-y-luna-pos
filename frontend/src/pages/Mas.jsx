// ---------------------------------------------------------------------------
// Mas.jsx: menú con las pantallas que no caben en la barra principal:
// Clientes, Faltantes, Descuentos, Categorías, Proveedores y Reportes, y el botón
// para cerrar sesión. Cada usuario ve solo las opciones que su rol puede usar.
// Props: irA (función para cambiar de pantalla), esAdmin, usuario, alSalir,
//        cantidades (cuántos registros hay de cada uno).
// ---------------------------------------------------------------------------
import Icono from "../components/Icono.jsx";
import { textoCantidad } from "../utils/formato.js";

function Mas(props) {
  // Todas las opciones del menú. soloAdmin = true: solo la ve el administrador.
  const opciones = [
    { id: "clientes", titulo: "Clientes", descripcion: "Quién te compra", icono: "usuario", cantidad: textoCantidad(props.cantidades.clientes, "cliente", "clientes"), soloAdmin: false },
    { id: "faltantes", titulo: "Faltantes", descripcion: "Lo que pidieron y no había", icono: "lista", cantidad: "", soloAdmin: false },
    { id: "descuentos", titulo: "Descuentos", descripcion: "Promociones para aplicar al cobrar", icono: "porcentaje", cantidad: textoCantidad(props.cantidades.descuentos, "descuento", "descuentos"), soloAdmin: true },
    { id: "categorias", titulo: "Categorías", descripcion: "Agrupa tus productos", icono: "carpeta", cantidad: textoCantidad(props.cantidades.categorias, "categoría", "categorías"), soloAdmin: true },
    { id: "proveedores", titulo: "Proveedores", descripcion: "A quién le compras", icono: "camion", cantidad: textoCantidad(props.cantidades.proveedores, "proveedor", "proveedores"), soloAdmin: true },
    { id: "reportes", titulo: "Reportes", descripcion: "Ventas, compras y faltantes por fechas", icono: "grafico", cantidad: "", soloAdmin: true }
  ];

  // Dejamos solo las opciones que este usuario puede usar
  const opcionesVisibles = opciones.filter(function (opcion) {
    if (opcion.soloAdmin && !props.esAdmin) {
      return false;
    }
    return true;
  });

  let textoRol = "Cajero";
  if (props.esAdmin) {
    textoRol = "Administrador";
  }

  return (
    <div className="pagina">
      <ul className="menu-mas">
        {opcionesVisibles.map(function (opcion) {
          return (
            <li key={opcion.id}>
              <button
                type="button"
                className="menu-mas-opcion"
                onClick={function () {
                  props.irA(opcion.id);
                }}
              >
                <span className="menu-mas-icono">
                  <Icono nombre={opcion.icono} />
                </span>
                <span className="menu-mas-textos">
                  <span className="menu-mas-titulo">{opcion.titulo}</span>
                  <span className="menu-mas-descripcion">{opcion.descripcion}</span>
                </span>
                {opcion.cantidad !== "" && <span className="menu-mas-cantidad">{opcion.cantidad}</span>}
                <Icono nombre="siguiente" />
              </button>
            </li>
          );
        })}

        {/* Sesión: quién está usando el sistema y el botón para salir */}
        <li>
          <button type="button" className="menu-mas-opcion menu-mas-salir" onClick={props.alSalir}>
            <span className="menu-mas-icono">
              <Icono nombre="salir" />
            </span>
            <span className="menu-mas-textos">
              <span className="menu-mas-titulo">Cerrar sesión</span>
              <span className="menu-mas-descripcion">
                {props.usuario.usuario} ({textoRol})
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export default Mas;
