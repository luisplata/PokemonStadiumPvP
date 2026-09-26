# CARNAVAL SOLAR — Resumen del juego

Arena de acción topdown 1v1. Elegís criatura y peleás contra la máquina (JcE)
o contra un amigo en el mismo sillón (JCJ). Cada campeón tiene su kit fijo
con personalidad propia.
https://luisplata.github.io/PokemonStadiumPvP/

## Modos

- **JcE:** vos vs. bot con IA (mantiene distancia según su rango, strafea,
  guarda la ulti para rematar y se cura/escuda con poca vida).
- **JCJ local:** P1 con teclado+mouse vs. P2 con mando. Cámara compartida con
  zoom dinámico y HUD lateral para cada uno.

## Roster (8)

| Criatura | Rol | Tipo | Estilo |
|---|---|---|---|
| Terravox | Tanque | Tierra | Cono sísmico, escudo, terremoto |
| Umbraclaw | Asesino | Siniestro | Dash, invisibilidad + crítico, torbellino |
| Psyflame | Mago | Psíquico | Bola de fuego con quemadura, teletransporte, nova que aturde |
| Floraviva | Sanador | Planta | Cura, lianas que enraízan, bendición que limpia estados |
| Campeón | Bruiser | Veneno | Espinas que frenan, embestida, escudo con espinas, nova venenosa |
| Mortero | Soporte | Veneno | Bombardeo en área, minas, zona que cura, lluvia de 5 zonas |
| Franco | Daño | Veneno | Tiro cargado, dash que limpia slow, rayo canalizado |
| Disparador | Control | Veneno | Conos y zonas de slow, raíz que envenena, invierno tóxico |

## Sistemas

- **8 tipos con fortalezas** (Tierra/Siniestro/Psíquico/Planta/Fuego/Agua/Eléctrico/Veneno):
  daño x1.4 a favor, x0.72 en contra.
- **Formato fijo por campeón:** 1 ataque básico infinito y único + 3 habilidades
  propias (con botón asignado: X/1, B/2, Y/3). Sin intercambio: cada kit es la
  personalidad del campeón y se balancea como unidad.
- **PP estilo cartucho:** cada habilidad tiene usos limitados (las ultis solo 5).
- **Afinidad por tipo:** valida los kits fijos al arrancar (las curas son de Planta/Psíquico,
  Teletransporte y Carga son universales).
- **Recurso de maná**, cooldowns con sombra, escudos, quemadura, envenenamiento,
  stun, root, ralentizaciones y knockback.
- **Auto-apuntado para mando:** sin tocar el stick derecho, apunta solo al rival.
- **40 habilidades** en catálogo, todas combinables y reutilizables.

## Flujo

Menú (JcE/JCJ) → selección con info completa del kit →
pantalla versus → arena. Al terminar: revancha o menú, todo usable con mando.

## Estado

Prototipo jugable y estable. Arte actual: procedural + emoji (pendiente: sprites
de criaturas y piso con tiles; ver `DEUDA.md` para la hoja de ruta técnica).
