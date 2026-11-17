// ---------------------------------------------------------------------------
// DialogoConfirmar.jsx: reemplaza a window.confirm (que está prohibido en este proyecto).
// Recibe un objeto "confirmacion" con: titulo, mensaje, textoConfirmar, peligro (true/false)
// y alConfirmar (función async que hace la acción). Mientras la acción corre, el botón
// muestra una ruedita y todo queda bloqueado para evitar toques repetidos.
// ---------------------------------------------------------------------------
import { useState } from "react";
import Modal from "./Modal.jsx";
import Boton from "./Boton.jsx";

function DialogoConfirmar(props) {
  const confirmacion = props.confirmacion;

  // trabajando = true mientras se ejecuta la acción confirmada
  // (useState devuelve la pareja [valor, funciónParaCambiarlo]; es la única forma de usarlo)
  const [trabajando, setTrabajando] = useState(false);

  // Se ejecuta al tocar el botón de confirmar
  async function confirmar() {
    if (trabajando) {
      return; // ya hay una acción en marcha: ignoramos el toque repetido
    }
    setTrabajando(true);
    try {
      await confirmacion.alConfirmar();
    } catch (error) {
      // Quien creó la confirmación muestra sus propios errores al usuario; aquí solo queda el registro
      console.error("La acción confirmada falló:", error);
    } finally {
      props.alCerrar();
    }
  }

  // El botón de confirmar es rojo si la acción es peligrosa (como eliminar)
  let variante = "principal";
  if (confirmacion.peligro) {
    variante = "peligro";
  }

  return (
    <Modal titulo={confirmacion.titulo} alCerrar={props.alCerrar} bloqueado={trabajando}>
      <p className="dialogo-mensaje">{confirmacion.mensaje}</p>
      <div className="acciones-fila">
        <Boton variante="suave" alHacerClic={props.alCerrar} deshabilitado={trabajando}>
          Cancelar
        </Boton>
        <Boton variante={variante} alHacerClic={confirmar} cargando={trabajando} textoCargando="Un momento…">
          {confirmacion.textoConfirmar}
        </Boton>
      </div>
    </Modal>
  );
}

export default DialogoConfirmar;
