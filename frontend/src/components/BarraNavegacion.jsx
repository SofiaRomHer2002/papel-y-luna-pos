// ---------------------------------------------------------------------------
// BarraNavegacion.jsx: menú principal. En el celular queda abajo (fácil de alcanzar
// con el pulgar); en pantallas grandes sube y se ve como pestañas.
// Props: vista (la pantalla actual), alCambiar (función), esAdmin (true si es administrador)
// y unidadesEnVenta (número para el globito sobre "Vender").
// El cajero no ve "Compras": esa sección es solo del administrador.
// ---------------------------------------------------------------------------
import Icono from "./Icono.jsx";

// Las opciones del menú: id = nombre de la vista, etiqueta = lo que se lee, icono = dibujo
const OPCIONES = [
  { id: "venta", etiqueta: "Vender", icono: "carrito" },
  { id: "historial", etiqueta: "Ventas", icono: "recibo" },
  { id: "productos", etiqueta: "Productos", icono: "caja" },
  { id: "compras", etiqueta: "Compras", icono: "camion", soloAdmin: true },
  { id: "mas", etiqueta: "Más", icono: "mas" }
];

// Pantallas que viven dentro de "Más" (la opción "Más" se ve activa cuando estamos en ellas)
const PANTALLAS_DE_MAS = ["mas", "categorias", "proveedores", "clientes", "descuentos", "faltantes", "reportes"];

function BarraNavegacion(props) {
  // Dejamos solo las opciones que este usuario puede usar según su rol
  const opcionesVisibles = OPCIONES.filter(function (opcion) {
    if (opcion.soloAdmin && !props.esAdmin) {
      return false;
    }
    return true;
  });

  return (
    <nav className="navegacion" aria-label="Secciones principales">
      {opcionesVisibles.map(function (opcion) {
        // ¿Esta opción es la pantalla actual?
        let activa = props.vista === opcion.id;
        if (opcion.id === "mas" && PANTALLAS_DE_MAS.indexOf(props.vista) !== -1) {
          activa = true;
        }

        let clase = "nav-boton";
        if (activa) {
          clase = "nav-boton nav-boton-activo";
        }

        // Atributo para lectores de pantalla: marca la opción actual
        let paginaActual = undefined;
        if (activa) {
          paginaActual = "page";
        }

        return (
          <button
            type="button"
            key={opcion.id}
            className={clase}
            aria-current={paginaActual}
            onClick={function () {
              props.alCambiar(opcion.id);
            }}
          >
            <span className="nav-icono">
              <Icono nombre={opcion.icono} />
              {/* Globito con las unidades que lleva la venta en curso */}
              {opcion.id === "venta" && props.unidadesEnVenta > 0 && <span className="nav-globo">{props.unidadesEnVenta}</span>}
            </span>
            <span className="nav-etiqueta">{opcion.etiqueta}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default BarraNavegacion;
