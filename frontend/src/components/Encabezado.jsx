// ---------------------------------------------------------------------------
// Encabezado.jsx: franja de arriba con el logo, el nombre del negocio, el título
// de la pantalla en la que estamos y quién tiene la sesión abierta.
// Props: titulo, usuario ({ nombre, rol }) y alSalir (función para cerrar sesión).
// ---------------------------------------------------------------------------
import { NOMBRE_NEGOCIO } from "../config.js";
import Icono from "./Icono.jsx";

function Encabezado(props) {
  // Texto del rol para mostrar ("administrador" -> "Administrador")
  let textoRol = "Cajero";
  if (props.usuario.rol === "administrador") {
    textoRol = "Administrador";
  }

  return (
    <header className="encabezado">
      {/* BASE_URL es la carpeta desde donde se publica la app (así funciona también en GitHub Pages) */}
      <img className="encabezado-logo" src={import.meta.env.BASE_URL + "logo-papel-y-luna.png"} alt="Logo de Papel y Luna" />
      <div className="encabezado-textos">
        <p className="encabezado-negocio">{NOMBRE_NEGOCIO}</p>
        <h1 className="encabezado-titulo">{props.titulo}</h1>
      </div>

      {/* Quién está usando el sistema y el botón para cerrar sesión */}
      <div className="encabezado-sesion">
        <div className="encabezado-usuario">
          <span className="encabezado-usuario-nombre">{props.usuario.usuario}</span>
          <span className="encabezado-usuario-rol">{textoRol}</span>
        </div>
        <button type="button" className="boton-icono" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={props.alSalir}>
          <Icono nombre="salir" />
        </button>
      </div>
    </header>
  );
}

export default Encabezado;
