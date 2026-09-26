# PokemonStadiumPvP

Arena topdown estilo Pokémon: JcE contra IA o JCJ local (P1 teclado+mouse, P2 mando).
Hecho con Phaser 4 + Vite, sin dependencias de más.

## Jugar

- Local: `npm install` y `npm run dev` (http://localhost:5173)
- Online: https://luisplata.github.io/PokemonStadiumPvP/ (deploy automático por GitHub Actions en cada push a `main`)

## Controles

- **P1:** WASD mover · mouse apuntar · click básico · 1-2-3 habilidades · Espacio esquiva
- **P2 (mando):** stick izq mover · A básico · X/B/Y habilidades · LT esquiva · stick der apuntado manual (si no lo tocás, auto-lock al rival)
- Menús y selección: teclado, mouse o cualquier mando (dpad + A)

## El juego

8 pokémon (4 originales + 4 iniciales), 24 habilidades intercambiables con PP estilo
cartucho, afinidad por tipo (7 tipos), loadouts elegibles, cámara compartida con zoom
dinámico y HUD lateral por jugador.

## Estructura

```
src/
  data/      abilities.js (catálogo) · classes.js (stats+kits) · types.js (tabla)
  systems/   simulation · renderer · combat · aim · bot · input
  entities/  Fighter.js
  scenes/    Menu · Select · Equip · Versus · Arena · HUD
```

Ver `DEUDA.md` (deuda técnica) y `ANALISIS-PokeArena.md` (origen del prototipo).

## Créditos de arte

- Sprites y tiles de marcador: [Kenney](https://kenney.nl) — packs *Top-Down Shooter* y
  *Pirate Pack* (CC0, sin atribución requerida). Los ZIPs viven en `assets/` local
  y no se commitean; los PNG finales sí.
