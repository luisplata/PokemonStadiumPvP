import { defineConfig } from 'vite';

export default defineConfig({
  // Base para GitHub Pages: luisplata.github.io/PokemonStadiumPvP/
  base: '/PokemonStadiumPvP/',
  server: { port: 5173 },
  build: { outDir: 'dist' }
});
