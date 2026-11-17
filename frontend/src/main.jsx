// ---------------------------------------------------------------------------
// main.jsx: punto de entrada. Importa los estilos y las tipografías (se instalan con
// el proyecto, así funcionan sin internet) y "monta" la aplicación React dentro del
// <div id="root"> que está en index.html.
// ---------------------------------------------------------------------------
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tipografías: Atkinson Hyperlegible (texto y cifras muy legibles) y Patrick Hand (letra a mano para títulos)
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/patrick-hand/400.css";

// Estilos propios, separados por responsabilidad
import "./estilos/variables.css";
import "./estilos/base.css";
import "./estilos/componentes.css";
import "./estilos/paginas.css";
import "./estilos/entrega-final.css"; // estilos de lo nuevo del MVP 3
import "./estilos/impresion.css";

import App from "./App.jsx";

// Busca el <div id="root"> del HTML y dibuja ahí la aplicación
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
