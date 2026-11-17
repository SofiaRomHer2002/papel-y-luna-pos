// ---------------------------------------------------------------------------
// EstadoVacio.jsx: lo que se muestra cuando una lista no tiene nada todavía.
// No es un mensaje de error: es una invitación a hacer el primer paso.
// Props: icono, titulo, texto, textoBoton (opcional) y alHacerClic (opcional).
// ---------------------------------------------------------------------------
import Icono from "./Icono.jsx";
import Boton from "./Boton.jsx";

function EstadoVacio(props) {
  return (
    <div className="estado-vacio">
      {props.icono && (
        <span className="estado-vacio-icono">
          <Icono nombre={props.icono} />
        </span>
      )}
      <p className="estado-vacio-titulo">{props.titulo}</p>
      {props.texto && <p className="estado-vacio-texto">{props.texto}</p>}
      {/* El botón solo aparece si nos dieron un texto y una función */}
      {props.textoBoton && props.alHacerClic && (
        <Boton variante="principal" alHacerClic={props.alHacerClic}>
          {props.textoBoton}
        </Boton>
      )}
    </div>
  );
}

export default EstadoVacio;
