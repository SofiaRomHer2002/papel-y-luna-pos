// ---------------------------------------------------------------------------
// Campo.jsx: una etiqueta + un campo de formulario, con texto de ayuda opcional.
// Al estar dentro de <label>, tocar el texto también enfoca el campo (mejor en el celular).
// ---------------------------------------------------------------------------
function Campo(props) {
  return (
    <label className="campo">
      <span className="campo-etiqueta">{props.etiqueta}</span>
      {/* Aquí va el <input>, <select> u otro control que nos pasen */}
      {props.children}
      {/* El texto de ayuda solo aparece si nos lo dieron */}
      {props.ayuda && <span className="campo-ayuda">{props.ayuda}</span>}
    </label>
  );
}

export default Campo;
