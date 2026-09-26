import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // En dev: raíz (localhost:5173/). Al compilar: prefijo de GitHub Pages.
  base: command === 'build' ? '/carnaval-solar-arena/' : '/',
  server: { port: 5173 },
  build: { outDir: 'dist' }
}));
