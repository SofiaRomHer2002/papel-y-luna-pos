// ---------------------------------------------------------------------------
// Cargando.jsx: ruedita animada con un texto, para cuando se espera al backend.
// ---------------------------------------------------------------------------
function Cargando(props) {
  // Si no nos dan un texto, usamos uno por defecto
  let texto = "Cargando…";
  if (props.texto) {
    texto = props.texto;
  }

  return (
    <div className="cargando" role="status">
      <span className="spinner" aria-hidden="true"></span>
      <p className="cargando-texto">{texto}</p>
    </div>
  );
}

export default Cargando;
