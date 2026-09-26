// Convierte '#rrggbb' | 'rrggbb' | number -> number 0xrrggbb.
// Evita depender de Phaser.Display.Color.HexStringToColor (frágil entre versiones).
export function css(c) {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const h = c.startsWith('#') ? c.slice(1) : c;
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? 0xffffff : n;
  }
  return 0xffffff;
}
