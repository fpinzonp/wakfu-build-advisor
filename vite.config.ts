import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Rutas relativas: funciona en GitHub Pages sin importar el nombre del repositorio.
  base: './',
  plugins: [react()],
});
