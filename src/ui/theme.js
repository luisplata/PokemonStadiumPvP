// Tema visual "Solar Carnival" — paleta medida del splash (public/assets/splash.jpg):
// fondo marigold #d2ad34 · naranja #ca8628 · magenta #b66994 · lima #70ab26
// cian hielo #6ebed7 · rojo #b94946 · tinta casi-negra (logo).
// Reglas: fondo oscuro para legibilidad, acentos cálidos del splash,
// blanco "sticker" para selección, títulos siempre Bungee con borde tinta.
export const THEME = {
  bg: 0x0d1420,
  bgDeep: 0x05070c,
  ink: 0x1a0f1e,
  panel: 0x141d2b,
  panelEdge: 0x2b3648,
  solar: 0xe8b73a,
  ember: 0xca8628,
  pink: 0xd16ba5,
  slime: 0x7fbf3f,
  ice: 0x6ebed7,
  blood: 0xc0392b,
  sticker: 0xffffff,
  text: '#f5ead2',
  muted: '#a89880',
  player1: 0x3fa9ff,
  player2: 0xff4d6d,
  fontTitle: 'Bungee',
  fontBody: "'Trebuchet MS', system-ui, sans-serif",
};

// Hex number -> css string ('#e8b73a').
export function cssNum(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Estilo de título display (logo): Bungee + borde tinta grueso estilo sticker.
export function titleStyle(color = '#e8b73a', size = '52px') {
  return {
    fontFamily: THEME.fontTitle,
    fontSize: size,
    color,
    stroke: '#14101a',
    strokeThickness: 8,
  };
}

// Estilo de texto UI normal.
export function bodyStyle(color = THEME.text, size = '14px', bold = false) {
  return {
    fontFamily: THEME.fontBody,
    fontSize: size,
    color,
    fontStyle: bold ? '800' : '400',
  };
}

// Fondo con el splash (cover) + velo oscuro para legibilidad.
// La textura 'splash' se precarga en el menú y es global al juego.
export function splashBg(scene, alpha = 0.78) {
  const { width, height } = scene.scale;
  if (scene.textures.exists('splash')) {
    const src = scene.textures.get('splash').getSourceImage();
    const img = scene.add.image(width / 2, height / 2, 'splash');
    const sc = Math.max(width / src.width, height / src.height);
    img.setDisplaySize(src.width * sc, src.height * sc);
  }
  scene.add.rectangle(width / 2, height / 2, width, height, 0x05070c, alpha);
}

// Panel redondeado estilo carta (fondo + borde). selected = borde sticker.
export function panel(g, x, y, w, h, { edge = THEME.panelEdge, selected = false } = {}) {
  g.fillStyle(THEME.panel, 1).fillRoundedRect(x, y, w, h, 14);
  g.lineStyle(selected ? 3 : 2, selected ? THEME.sticker : edge, 1)
    .strokeRoundedRect(x, y, w, h, 14);
  return g;
}
