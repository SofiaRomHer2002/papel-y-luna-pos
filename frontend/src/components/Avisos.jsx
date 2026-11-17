// ---------------------------------------------------------------------------
// Avisos.jsx: mensajes cortos que aparecen arriba y desaparecen solos.
// Reemplazan a window.alert (prohibido en este proyecto): no bloquean la pantalla.
// Cada aviso tiene { id, texto, tipo } y tipo puede ser "ok", "error" o "info".
// Tocar un aviso lo cierra.
// ---------------------------------------------------------------------------
import Icono from "./Icono.jsx";

function Avisos(props) {
  return (
    <div className="avisos" role="status" aria-live="polite">
      {props.avisos.map(function (aviso) {
        // Elegimos el icono según el tipo de aviso
        let icono = "info";
        if (aviso.tipo === "ok") {
          icono = "check";
        }
        if (aviso.tipo === "error") {
          icono = "alerta";
        }

        return (
          <button
            type="button"
            key={aviso.id}
            className={"aviso aviso-" + aviso.tipo}
            onClick={function () {
              props.alQuitar(aviso.id);
            }}
          >
            <Icono nombre={icono} />
            <span>{aviso.texto}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Avisos;
