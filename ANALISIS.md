# Arena (legado) — Qué está pasando en `arena-legado.html`

> Nota histórica: prototipo anterior al juego actual (ya reemplazado por el
> proyecto Phaser). Se conserva como referencia, no se usa.

Este archivo es un **juego completo en un solo HTML**, sin librerías externas. Solo HTML + CSS + JavaScript vanilla con Canvas 2D.

Idea: arena PvP topdown 1v1. Elegís 1 de 4 clases y peleás contra un bot con IA.

Para correrlo: abrir `arena-legado.html` en el navegador. Nada más.

---

## 1. Mapa del archivo

| Líneas | Bloque | Qué hace |
|---|---|---|
| 1-104 | `<style>` | Todo el UI: HUD, barras, slots, menú, pantalla final |
| 106-135 | `<body>` | `canvas#game`, `#hud`, `#menu`, `#end` |
| 137-153 | Utils | `clamp, rand, dist, angTo, angDiff, lerp` |
| 156-161 | Tipos | Tabla `BEATS` y `typeMult()` |
| 163-179 | Mundo + estado | `WORLD 2600x1700`, `canvas/ctx`, `cam`, objeto `game` |
| 181-286 | Input | Teclado/ratón + gamepad completo |
| 292-381 | Auto-apuntado | `getNearestEnemy`, `getTargetAimPoint`, `getDirectionalAimPoint` |
| 384-498 | Helpers combate | `spawnProjectile, spawnZone, damage, heal, applyStatus, onDeath` |
| 507-664 | `CLASSES` | Las 4 clases con sus 1 básico + 4 habilidades |
| 688-872 | `class Fighter` | Entidad jugador/bot: stats, `update()`, `botThink()` |
| 895-935 | Casteo | `castBasic(), castAbility()` |
| 940-1111 | `update(dt)` | Lógica por frame: input, movimiento, proyectiles, zonas, cámara |
| 1116-1469 | Render | `drawArena, drawPillars, drawZones, drawFighters, drawLockOn...` |
| 1474-1549 | HUD | `buildHUD(), updateHUD()` barras y cooldowns |
| 1554-1643 | Init + loop | `buildArena(), startGame(), loop()` con `requestAnimationFrame` |

---

## 2. Bucle principal — el corazón

Todo juego de acción es esto:

```
loop(now) -> dt -> update(dt) -> render() -> requestAnimationFrame(loop)
```

* `dt` se clampa a `0.05` para que un lagazo no teletransporte todo.
* `update()` avanza simulación: input, fighters, proyectiles, zonas, partículas, floaters, cámara.
* `render()` dibuja todo trasladado por `-cam.x, -cam.y`. La cámara hace `lerp` suave hacia el jugador.

Concepto clave: **separar simulación de dibujo**. La lógica no sabe de píxeles, el render no decide daño.

---

## 3. Input dual

### Teclado + ratón
* `keys` guarda `e.code`. `mouse` guarda posición pantalla (`sx,sy`) y mundo (`wx,wy = s + cam`).
* `WASD` mover, click izq básico, `1-4` habilidades, `Espacio` esquiva.
* Cualquier movimiento de mouse/tecla pone `aimSource = 'mouse'`.

### Gamepad
* `padState` guarda `move, aimAngle, abilities[4], basic, dodge, connected`.
* `pollGamepad()` corre cada frame: lee `navigator.getGamepads()`, aplica deadzone `0.22`.
* Mapeo: stick izq mover, stick der apuntar, `RT(7)` básico, `A(0) B(1) X(2) Y(3)` habilidades, `LT(6)` esquiva.
* Si tocás cualquier stick o botón, `aimSource = 'gamepad'`.

---

## 4. Auto-apuntado — el sistema más inteligente del archivo

Problema: con mando no tenés mouse, apuntar con stick derecho mientras te movés es horrible.

Solución por prioridades en `getTargetAimPoint(f)`:

1. **Mouse:** si `aimSource === 'mouse'`, apunta a `mouse.wx,wy`.
2. **Stick derecho manual:** si `padState.aimAngle !== null`, tira 450px en esa dirección. Override total.
3. **Auto-lock:** si no, `getNearestEnemy(f, 900)`. Si hay enemigo, apunta directo a él. Guarda `game.lockMode='auto'` y `game.lockOn=enemy`.
4. **Movimiento:** si te estás moviendo, apunta hacia ahí.
5. **Facing:** si no, sigue mirando a donde miraba.

Hay una variante `getDirectionalAimPoint()` para escapes como Teletransporte: si estás quieto y hay enemigo cerca, apunta **para el lado opuesto** (huida). Cada habilidad declara `aimMode: 'target' | 'direction' | 'self'`.

El HUD te avisa: `#padind.locked` + retículo amarillo con brackets + línea punteada en `drawLockOn()` solo en modo `auto`.

---

## 5. Clases y tipos

Tabla de tipos piedra-papel-tijera:

```
Tierra > Siniestro > Psíquico > Planta > Tierra (x1.4 a favor, x0.72 en contra)
```

Las 4 clases (`CLASSES`):

* **Terravox 🪨 (Tanque Tierra, 1500 HP, lento):** cono + slow, escudo 340, carga que aturde, ulti Terremoto AoE con knockback.
* **Umbraclaw 🗡️ (Asesino Siniestro, 980 HP, rápido 205):** dash que atraviesa, invis + próximo golpe x1.6, proyectil que enraíza, ulti giro 2.5s.
* **Psyflame 🔮 (Mago Psíquico, 880 HP, rango):** Bola Fuego + burn, Prisión Hielo que enraíza, Teletransporte direccional, Nova que aturde en área.
* **Floraviva 🌸 (Healer Planta, 1150 HP):** cura 240, escudo 300, zona de Lianas que enraíza, ulti cura 480 + limpia estados.

Cada habilidad es un objeto `{ key, name, icon, cd, cost, range, aimMode, cast(g,f,ax,ay) }`. El patrón es lindo: datos + función `cast` inyectada.

Recurso: `res` con `resRegen`. Si no tenés maná, el slot se pone gris (`nomana`).

---

## 6. Combate

`damage(g, target, amount, source)`:

1. Si `invuln > 0` ignora.
2. Aplica `typeMult`.
3. Si atacante tiene `empowered`, x1.6 y lo consume (texto ¡CRÍTICO!).
4. Descuenta escudo primero, después HP.
5. Spawnea número flotante (amarillo grande si efectivo, gris si resistido).
6. Si HP <= 0 -> `onDeath()`: explosión de 50 partículas + pantalla VICTORIA/DERROTA a los 700ms.

Estados en `f.status` via `applyStatus()`: `stun, root, slowPct/slowDur, shield/shieldDur, invis, burn/burnDps, invuln, empowered`.

Entidades efímeras:

* **Proyectil:** `x,y,vx,vy,r,dmg,range,trail[8],pierce,hitSet`. Choca con pilares y con fighters. Aplica slow/root/burn/knock.
* **Zona:** `x,y,r,delay,fired,fade`. Fase 1: telegrafía parpadeante con anillo de progreso. Fase 2: daño + partículas, fade 0.4s.
* **Dash:** `vx,vy,time,dmg,hitSet`. Mientras dura, ignora movimiento normal y pega al contacto. La esquiva es un dash de 0 daño con `dodgeCd 1.6s`.
* **Spin (ulti Umbraclaw):** tick cada 0.25s en radio 150.

Colisiones: círculos contra pilares (`resolvePillars` empuja fuera) + clamp a bordes del mundo. Knockback con `kx,ky` y damping exponencial `pow(0.0015, dt)`.

---

## 7. El bot

`Fighter.botThink(dt,g)`:

* Busca al jugador vivo, calcula distancia y ángulo.
* Movimiento: si lejos de `preferredRange` se acerca, si cerca se aleja, y siempre strafea perpendicular cambiando de lado cada 1-2.8s.
* Ataque: cada `aiTimer` prueba habilidades en orden `[0,1,2,3]` si tiene cd, maná y rango. Reglas especiales: no gasta ulti si te quedan <120 HP (te remata con básico), Floraviva solo se cura si está <45%, Terravox solo escuda si está bajo.
* Los básicos usan `range_ai` distinto al rango real para que no sea aimbot perfecto.

Es simple pero se siente vivo por el strafe + gestión de rango por clase (Terravox 105, Umbraclaw 85, Psyflame 430, Floraviva 360).

---

## 8. Render y HUD

Orden en `render()`: fondo -> `drawArena()` (gradiente + grid 100px + círculos centrales) -> `drawZones()` -> `drawPillars()` -> partículas abajo -> `drawFighters()` -> `drawLockOn()` -> `drawProjectiles()` con glow -> partículas arriba -> `drawFloaters()`.

Fighters: sombra elipse, aura azul (equipo 0) / roja (equipo 1), cuerpo con gradiente radial, ojo direccional según `facing`, emoji de clase, iconos de estado (estrellas stun, anillo root, fuego burn, anillo celeste escudo), barra HP + nombre arriba.

HUD DOM (no canvas): `#hpfill` verde, `#shfill` celeste superpuesta, `#resfill` azul, 5 slots con `.cdmask` que se llena de abajo hacia arriba + número de cooldown. Label `#cd` muestra rol, tipo y modo de lock.

---

## 9. Para llevarlo más lejos

* El próximo cuello de botella es `game.fighters.find` y loops O(n) — bien para 1v1, mal para 5v5.
* `keys['Digit1']` castea mientras mantengas apretado, el cd lo frena pero gasta maná ni bien vuelve. Un edge-trigger (solo al presionar) sería mejor.
* Todo el balance está hardcodeado en `CLASSES`. Sacarlo a JSON sería el primer paso a escalar.
* No hay separación jugador/bot real: el bot es un `Fighter` con `isBot=true`. Para PvP online habría que separar input de simulación.
