import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" hace que los archivos se busquen con rutas relativas.
// Así la aplicación funciona igual en el computador (localhost) y publicada en
// GitHub Pages (que la sirve desde una carpeta con el nombre del repositorio).
export default defineConfig({
  base: "./",
  plugins: [react()]
});
