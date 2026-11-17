import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolverApiUrl } from "./src/api/direccion.js";

// base: "./" hace que los archivos se busquen con rutas relativas.
// Así la aplicación funciona igual en el computador (localhost) y publicada en
// GitHub Pages (que la sirve desde una carpeta con el nombre del repositorio).
export default defineConfig(({ command, mode }) => {
  // Fallar durante el build evita publicar una dirección local o HTTP por error.
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    resolverApiUrl(env.VITE_API_URL, false, "");
  }
  return { base: "./", plugins: [react()] };
});
