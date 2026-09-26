import { dist } from '../utils/math.js';

// Estado de lock por jugador (para dibujar retículos). Clave: su Input.
const locks = new Map();

export function lockFor(inp, fighter = null) {
  let l = locks.get(inp);
  if (!l) { l = { mode: 'none', target: null, fighter: null }; locks.set(inp, l); }
  if (fighter) l.fighter = fighter;
  return l;
}

export function getLocks() { return [...locks.values()]; }

export function getNearestEnemy(fighters, f, maxRange = 900) {
  let best = null, bestD = Infinity;
  for (const e of fighters) {
    if (e === f || e.team === f.team || !e.alive) continue;
    const d = dist(f, e);
    if (d < bestD && d < maxRange) { bestD = d; best = e; }
  }
  return best;
}

export function getTargetAimPoint(fighters, f, inp) {
  const lock = lockFor(inp, f);
  const pad = inp.pad, mouse = inp.mouse;
  if (inp.aimSource === 'mouse') {
    lock.mode = 'mouse'; lock.target = null;
    return { x: mouse.wx, y: mouse.wy };
  }
  if (pad.aimAngle !== null) {
    lock.mode = 'manual-stick'; lock.target = null;
    return { x: f.x + Math.cos(pad.aimAngle) * 450, y: f.y + Math.sin(pad.aimAngle) * 450 };
  }
  const enemy = getNearestEnemy(fighters, f, 900);
  if (enemy) {
    lock.mode = 'auto'; lock.target = enemy;
    return { x: enemy.x, y: enemy.y };
  }
  const mvMag = Math.hypot(pad.move.x, pad.move.y);
  if (mvMag > 0.15) {
    const a = Math.atan2(pad.move.y, pad.move.x);
    lock.mode = 'move'; lock.target = null;
    return { x: f.x + Math.cos(a) * 450, y: f.y + Math.sin(a) * 450 };
  }
  lock.mode = 'move'; lock.target = null;
  return { x: f.x + Math.cos(f.facing) * 450, y: f.y + Math.sin(f.facing) * 450 };
}

export function getDirectionalAimPoint(fighters, f, inp) {
  const pad = inp.pad, mouse = inp.mouse;
  if (inp.aimSource === 'mouse') return { x: mouse.wx, y: mouse.wy };
  if (pad.aimAngle !== null) {
    return { x: f.x + Math.cos(pad.aimAngle) * 450, y: f.y + Math.sin(pad.aimAngle) * 450 };
  }
  const mvMag = Math.hypot(pad.move.x, pad.move.y);
  if (mvMag > 0.15) {
    const a = Math.atan2(pad.move.y, pad.move.x);
    return { x: f.x + Math.cos(a) * 450, y: f.y + Math.sin(a) * 450 };
  }
  const enemy = getNearestEnemy(fighters, f, 900);
  if (enemy) {
    const a = Math.atan2(f.y - enemy.y, f.x - enemy.x);
    return { x: f.x + Math.cos(a) * 450, y: f.y + Math.sin(a) * 450 };
  }
  return { x: f.x + Math.cos(f.facing) * 450, y: f.y + Math.sin(f.facing) * 450 };
}

export function getAimPointFor(fighters, f, aimMode, inp) {
  if (aimMode === 'direction') return getDirectionalAimPoint(fighters, f, inp);
  return getTargetAimPoint(fighters, f, inp);
}
