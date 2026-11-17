// ---------------------------------------------------------------------------
// Modal.jsx: ventana que se abre encima de la pantalla.
// En el celular se ve como una hoja que sube desde abajo; en computador, centrada.
// Props: titulo, alCerrar (función), bloqueado (true = no se puede cerrar, por ejemplo
// mientras se está guardando), ancho ("amplio" para facturas y formularios largos).
// ---------------------------------------------------------------------------
import { useEffect } from "react";
import Icono from "./Icono.jsx";

// Cuenta cuántos modales hay abiertos para bloquear el desplazamiento del fondo
let modalesAbiertos = 0;

function Modal(props) {
  // Copiamos a variables locales lo que usa el efecto (así React sabe exactamente de qué depende)
  const alCerrar = props.alCerrar;
  const bloqueado = props.bloqueado;

  // useEffect corre DESPUÉS de dibujar el componente. Aquí lo usamos para:
  //   1) cerrar el modal con la tecla Escape
  //   2) bloquear el desplazamiento de la página que queda detrás
  useEffect(
    function () {
      function alPresionarTecla(evento) {
        if (evento.key === "Escape" && !bloqueado) {
          alCerrar();
        }
      }

      document.addEventListener("keydown", alPresionarTecla);
      modalesAbiertos = modalesAbiertos + 1;
      document.body.classList.add("sin-desplazamiento");

      // La función que devolvemos se ejecuta cuando el modal se cierra: limpia lo anterior
      return function () {
        document.removeEventListener("keydown", alPresionarTecla);
        modalesAbiertos = modalesAbiertos - 1;
        if (modalesAbiertos <= 0) {
          modalesAbiertos = 0;
          document.body.classList.remove("sin-desplazamiento");
        }
      };
    },
    [bloqueado, alCerrar]
  );

  // Si tocan el fondo oscuro (y no el contenido), cerramos el modal
  function cerrarPorFondo(evento) {
    if (evento.target === evento.currentTarget && !props.bloqueado) {
      props.alCerrar();
    }
  }

  let claseCaja = "modal-caja";
  if (props.ancho === "amplio") {
    claseCaja = "modal-caja modal-caja-amplia";
  }

  return (
    <div className="modal-capa" onClick={cerrarPorFondo}>
      <div className={claseCaja} role="dialog" aria-modal="true" aria-label={props.titulo}>
        <div className="modal-encabezado">
          <h2 className="modal-titulo">{props.titulo}</h2>
          <button type="button" className="modal-cerrar" onClick={props.alCerrar} disabled={props.bloqueado} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="modal-cuerpo">{props.children}</div>
      </div>
    </div>
  );
}

export default Modal;
