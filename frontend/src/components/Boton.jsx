// ---------------------------------------------------------------------------
// Boton.jsx: botón reutilizable de toda la aplicación.
// Props que recibe:
//   variante: "principal" | "secundario" | "suave" | "peligro"  (cambia el color)
//   cargando: true muestra una ruedita y bloquea el botón (evita envíos duplicados)
//   textoCargando: texto que se muestra mientras carga (ejemplo: "Guardando…")
//   deshabilitado: true bloquea el botón
//   tipo: "button" (por defecto) o "submit" para los formularios
//   alHacerClic: función que se ejecuta al tocar el botón
//   ancho: true hace que ocupe todo el ancho disponible
// ---------------------------------------------------------------------------
import Icono from "./Icono.jsx";

function Boton(props) {
  // Elegimos la variante (si no llega ninguna, usamos la secundaria)
  let variante = "secundario";
  if (props.variante) {
    variante = props.variante;
  }

  // Armamos las clases de CSS según las opciones que llegaron
  let clase = "boton boton-" + variante;
  if (props.ancho) {
    clase = clase + " boton-ancho";
  }

  // El botón queda bloqueado si lo deshabilitaron o si está guardando
  const bloqueado = props.deshabilitado === true || props.cargando === true;

  // Mientras carga mostramos otro texto (si nos dieron uno)
  let contenido = props.children;
  if (props.cargando && props.textoCargando) {
    contenido = props.textoCargando;
  }

  // Si no nos dicen el tipo, es "button" para que NO envíe formularios sin querer
  let tipo = "button";
  if (props.tipo) {
    tipo = props.tipo;
  }

  return (
    <button type={tipo} className={clase} onClick={props.alHacerClic} disabled={bloqueado} aria-busy={props.cargando === true}>
      {/* La ruedita solo aparece mientras el botón está cargando */}
      {props.cargando && <span className="spinner-mini" aria-hidden="true"></span>}
      {/* Icono opcional a la izquierda del texto */}
      {props.icono && !props.cargando && <Icono nombre={props.icono} />}
      <span>{contenido}</span>
    </button>
  );
}

export default Boton;
