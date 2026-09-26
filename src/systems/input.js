// Input unificado: teclado + ratón + gamepad.
// - Clase instanciable: un Input por jugador (P1 teclado+mouse, P2 mando).
// - padSlot: qué mando usa (0 = primero conectado). null = sin mando.
// - useKeyboard: solo UN Input debe escuchar el teclado (si no, dos
//   instancias reaccionarían a las mismas teclas).
// - PadNav: navegación de menús con mando (flancos, no niveles).
export class Input {
  constructor({ useKeyboard = true, useMouse = true, padSlot = null } = {}) {
    this.useKeyboard = useKeyboard;
    this.useMouse = useMouse;
    this.padSlot = padSlot;
    this.keys = {};
    this.mouse = { sx: 0, sy: 0, wx: 0, wy: 0, down: false };
    this.aimSource = 'mouse';
    this.pad = {
      connected: false, move: { x: 0, y: 0 }, aimAngle: null,
      abilities: [false, false, false, false], basic: false, dodge: false,
    };
    this.deadzone = 0.22;
    this.bound = false;
  }

  padDevice() {
    return getPadBySlot(this.padSlot);
  }

  bind() {
    if (this.bound) return;
    this.bound = true;
    if (!this.useKeyboard) return;
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      this.aimSource = 'mouse';
      if (['Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => (this.keys[e.code] = false));
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
  }

  bindCanvas(scene) {
    if (!this.useMouse) return;
    scene.input.on('pointermove', (p) => {
      this.mouse.sx = p.x; this.mouse.sy = p.y;
      this.aimSource = 'mouse';
    });
    scene.input.on('pointerdown', (p) => {
      if (p.leftButtonDown()) this.mouse.down = true;
    });
    scene.input.on('pointerup', () => { this.mouse.down = false; });
  }

  get connected() {
    return this.pad.connected;
  }

  poll() {
    const gp = this.padDevice();
    const pad = this.pad;
    pad.connected = !!gp;
    if (!gp) {
      pad.move.x = 0; pad.move.y = 0;
      pad.aimAngle = null;
      pad.abilities = [false, false, false, false];
      pad.basic = false; pad.dodge = false;
      return;
    }
    let lx = gp.axes[0] || 0, ly = gp.axes[1] || 0;
    if (Math.hypot(lx, ly) < this.deadzone) { lx = 0; ly = 0; }
    pad.move.x = lx; pad.move.y = ly;

    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    pad.aimAngle = Math.hypot(rx, ry) < this.deadzone ? null : Math.atan2(ry, rx);

    const b = gp.buttons;
    // Mando: A = básico, X/B/Y = habilidades 1-3, LT = esquiva.
    pad.basic = !!(b[0]?.pressed);
    pad.abilities[0] = !!(b[2]?.pressed);
    pad.abilities[1] = !!(b[1]?.pressed);
    pad.abilities[2] = !!(b[3]?.pressed);
    pad.abilities[3] = false;
    pad.dodge = !!(b[6] && (b[6].pressed || b[6].value > 0.5));

    if (lx !== 0 || ly !== 0 || pad.aimAngle !== null ||
        pad.abilities.some(Boolean) || pad.basic || pad.dodge) {
      this.aimSource = 'gamepad';
    }
  }
}

// El mando N (0-based) entre los conectados, o null.
export function getPadBySlot(slot) {
  if (slot === null || slot === undefined) return null;
  try {
    const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((g) => g && g.connected);
    return pads[slot] || null;
  } catch { return null; }
}

export function countPads() {
  try {
    return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((g) => g && g.connected).length;
  } catch { return 0; }
}

// Quién usa qué mando, recalculado en caliente (conectar/desconectar anda):
// - PvE: P1 usa el primero.
// - PvP: con 2+ mandos, P1 el primero y P2 el segundo;
//   con 1 mando, es de P2 y P1 queda teclado+mouse.
export function resolveSlots(mode) {
  const n = countPads();
  if (mode === 'pvp') return n > 1 ? { p1: 0, p2: 1 } : { p1: null, p2: 0 };
  return { p1: 0, p2: null };
}

// Navegación de menús con un mando: devuelve flancos (solo el frame
// en que se presiona). Incluye repetición al mantener dirección.
export class PadNav {
  constructor(slot) {
    this.slot = slot;
    this.prev = {};
    this.repeatT = {};
    this.lastConfirm = 0;
    this.confirmGap = 600;
    // Un botón que ya nace apretado no vale hasta verlo suelto una vez.
    // Así un A trabado (hardware, turbo, driver) no maneja menús solo.
    this.armed = {};
  }

  poll(dt = 0.016) {
    const out = { up: false, down: false, left: false, right: false, confirm: false, back: false };
    const gp = getPadBySlot(this.slot);
    if (!gp) { this.prev = {}; this.repeatT = {}; return out; }
    const pressed = (i) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const cur = {
      up: pressed(12) || ay < -0.5, down: pressed(13) || ay > 0.5,
      left: pressed(14) || ax < -0.5, right: pressed(15) || ax > 0.5,
      confirm: pressed(0), back: pressed(1),
    };
    for (const k of Object.keys(out)) {
      if (!cur[k]) { this.armed[k] = true; continue; }
      if (!this.armed[k]) continue;
      // El confirm lleva cooldown: come rebotes y ráfagas (turbo),
      // así un botón fallado no atraviesa menús solo.
      if (k === 'confirm') {
        if (cur.confirm && !this.prev.confirm) {
          const now = performance.now();
          if (now - this.lastConfirm > this.confirmGap) {
            out.confirm = true;
            this.lastConfirm = now;
          }
        }
      } else if (cur[k] && !this.prev[k]) { out[k] = true; this.repeatT[k] = 0.45; }
      else if (cur[k] && (k === 'up' || k === 'down' || k === 'left' || k === 'right')) {
        this.repeatT[k] = (this.repeatT[k] ?? 0.45) - dt;
        if (this.repeatT[k] <= 0) { out[k] = true; this.repeatT[k] = 0.16; }
      }
    }
    this.prev = cur;
    return out;
  }

  // Sincroniza el estado sin emitir flancos: para períodos de gracia
  // donde se ignoran inputs (ej. el A que trajo al jugador hasta acá).
  idle() {
    const out = { up: false, down: false, left: false, right: false, confirm: false, back: false };
    const gp = getPadBySlot(this.slot);
    if (!gp) { this.prev = {}; this.repeatT = {}; return out; }
    const pressed = (i) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    this.prev = {
      up: pressed(12) || ay < -0.5, down: pressed(13) || ay > 0.5,
      left: pressed(14) || ax < -0.5, right: pressed(15) || ax > 0.5,
      confirm: pressed(0), back: pressed(1),
    };
    for (const k of Object.keys(out)) {
      if (!this.prev[k]) this.armed[k] = true;
    }
    return out;
  }
}
