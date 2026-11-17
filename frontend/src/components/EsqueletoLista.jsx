// ---------------------------------------------------------------------------
// EsqueletoLista.jsx: filas "fantasma" con un brillo animado que aparecen mientras
// llegan los datos del backend. Así la pantalla no se ve vacía ni parece congelada.
// ---------------------------------------------------------------------------
function EsqueletoLista(props) {
  // Cuántas filas fantasma dibujar (6 si no nos dicen)
  let cantidad = 6;
  if (props.filas) {
    cantidad = props.filas;
  }

  // Armamos las filas con un for normal
  const filas = [];
  for (let i = 0; i < cantidad; i++) {
    filas.push(
      <div className="esqueleto-fila" key={i}>
        <div className="esqueleto-textos">
          <span className="esqueleto-linea esqueleto-linea-larga"></span>
          <span className="esqueleto-linea esqueleto-linea-corta"></span>
        </div>
        <span className="esqueleto-bloque"></span>
      </div>
    );
  }

  return (
    <div className="esqueleto" aria-hidden="true">
      {filas}
    </div>
  );
}

export default EsqueletoLista;
