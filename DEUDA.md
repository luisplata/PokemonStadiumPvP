# DEUDA TÉCNICA — PokéArena (Phaser)

> Estado al cerrar la sesión de refactor "catálogo de habilidades".
> El juego anda idéntico al `PokemonV4.html` original. Lo de abajo es lo que
> duele (o va a doler) cuando sumemos contenido.

## Deuda 1 — `ArenaScene.js` hace 3 trabajos [HECHA]
**Dónde:** `src/scenes/ArenaScene.js` (~324 líneas).
**Qué pasa:** una sola clase simula (proyectiles, zonas, partículas),
dibuja todo el mundo (arena, pilares, fighters, floaters, lock-on)
y pinta el HUD (barras, cooldowns, victoria/derrota).
**Por qué duele:** cualquier cambio de reglas toca el mismo archivo que el
dibujo; agregar un modo de juego o un efecto nuevo lo hace crecer sin control.
**Plan:** partir en 3 piezas con responsabilidades únicas:
- `src/systems/simulation.js` → avanza el estado (`stepSimulation`).
- `src/systems/renderer.js` → dibuja el estado (`WorldRenderer`).
- `src/scenes/HUDScene.js` → overlay de UI (barras, cooldowns, fin de partida).
- `ArenaScene` queda como orquestadora: input → sim → render.

## Deuda 2 — La IA vive adentro de `Fighter` [HECHA]
**Dónde:** `botThink()` en `src/entities/Fighter.js`.
**Qué pasa:** entidad (posición, vida, estados) y cerebro (a quién persigo,
cuándo casteo, strafe) están en la misma clase.
**Por qué duele:** no se puede tener un bot agresivo y otro defensivo sin
tocar la clase del personaje; testear la IA exige instanciar un Fighter.
**Plan:** extraer a `src/systems/bot.js` con una función
`think(ctx, f, dt) -> {x, y}` + tabla de personalidades por clase
(`preferredRange`, agresividad, reglas de ulti/cura). `Fighter.update`
solo mueve y aplica estados.

## Deuda 3 — Detalles menores [HECHA]
- `src/systems/input.js` era estado global suelto (`keys`, `mouse`,
  `padState`). Ahora es clase `Input` instanciable + singleton `input`
  que usan `aim.js`, `Fighter.js` y `ArenaScene.js`.
- `build()` en `src/data/classes.js` ya no recibe `clsKey` sin usar.
- `main.js` llama `validateContent()` antes de arrancar: kit incompleto
  o id mal escrito falla fuerte al cargar, no en mitad de la partida.

## Cómo agregar contenido (no es deuda, es la prueba de que el diseño anda)
- **Pokémon nuevo:** 1 bloque en `STATS` + 1 línea en `KITS`
  (`src/data/classes.js`). ~10 líneas, cero lógica. Hereda menú, HUD, bot.
- **Habilidad nueva:** 1 entrada en `ABILITIES` (`src/data/abilities.js`)
  combinando efectos primitivos (`projectile`, `cone`, `dash`, `zoneSelf`,
  `zoneAt`, `blink`, `shield`, `heal`, `buff`, `spin`, `cleanse`, `ring`,
  `floater`, `face`). Si el efecto no existe, se agrega un runner una vez
  y queda reutilizable.
