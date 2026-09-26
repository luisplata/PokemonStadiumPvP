// Catálogo único de habilidades.
// Cada habilidad es DATOS: identidad + lista de efectos primitivos.
// El motor (RUNNERS + executeAbility) sabe ejecutar cada efecto.
// Crear una habilidad nueva = agregar una entrada acá. Crear una criatura
// nuevo = elegir 4 ids existentes en classes.js. Nada de copiar cast().
import { clamp, angTo, dist, angDiff, rand } from '../utils/math.js';
import { WORLD } from './types.js';
import {
  spawnProjectile, spawnZone, damage, heal,
  applyStatus, startDash, resolvePillars, spawnHitParticles,
} from '../systems/combat.js';

/* ------------------------- runners (el motor) ------------------------- */
const RUNNERS = {
  face(ctx, f, fx, aim) { f.facing = aim.ang; },

  ring(ctx, f, fx) {
    ctx.particles.push({
      x: f.x, y: f.y, vx: 0, vy: 0,
      t: fx.t ?? 0.5, max: fx.t ?? 0.5, r: fx.r, color: fx.color, ring: true, ang: 0,
    });
  },

  cone(ctx, f, fx, aim) {
    for (const e of ctx.fighters) {
      if (e.team === f.team || !e.alive) continue;
      if (dist(f, e) < fx.range + e.radius &&
          Math.abs(angDiff(angTo(f, e), aim.ang)) < (fx.halfAngle ?? 0.85)) {
        damage(ctx, e, fx.dmg, f);
        if (fx.slow) applyStatus(e, { slowPct: fx.slow.pct, slowDur: fx.slow.dur });
        if (fx.poison) applyStatus(e, { poisonDps: fx.poison.dps, poisonDur: fx.poison.dur });
        if (fx.stun) applyStatus(e, { stun: fx.stun });
        if (fx.root) applyStatus(e, { root: fx.root });
        spawnHitParticles(ctx, e.x, e.y, fx.hitColor || f.def.accent);
      }
    }
  },

  projectile(ctx, f, fx, aim) {
    spawnProjectile(ctx, f, {
      x: f.x, y: f.y, angle: aim.ang,
      speed: fx.speed, radius: fx.radius, dmg: fx.dmg, range: fx.range, color: fx.color,
      rootDur: fx.rootDur || 0, burnDps: fx.burn?.dps || 0, burnDur: fx.burn?.dur || 0,
      slowPct: fx.slow?.pct || 0, slowDur: fx.slow?.dur || 0,
      pierce: !!fx.pierce, knock: fx.knock || 0,
    });
  },

  dash(ctx, f, fx, aim) {
    startDash(f, aim.ang, fx.speed, fx.time, fx.dmg, {
      stun: fx.stun || 0, slow: fx.slow || null, stopOnHit: !!fx.stopOnHit, color: fx.color || f.def.accent,
    });
  },

  zoneSelf(ctx, f, fx) {
    spawnZone(ctx, {
      x: f.x, y: f.y, r: fx.r, delay: fx.delay ?? 0.4, dmg: fx.dmg, owner: f,
      color: fx.color, knock: fx.knock || 0,
      onHit: statusOnHit(fx),
    });
  },

  zoneAt(ctx, f, fx, aim) {
    spawnZone(ctx, {
      x: aim.ax, y: aim.ay, r: fx.r, delay: fx.delay ?? 0.35, dmg: fx.dmg, owner: f,
      color: fx.color, knock: fx.knock || 0,
      onHit: statusOnHit(fx),
    });
  },

  blink(ctx, f, fx, aim) {
    ctx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 0.45, max: 0.45, r: 46, color: fx.color, ring: true, ang: 0 });
    const d = Math.min(fx.maxDist ?? 360, Math.hypot(aim.ax - f.x, aim.ay - f.y));
    f.x = clamp(f.x + Math.cos(aim.ang) * d, f.radius, WORLD.w - f.radius);
    f.y = clamp(f.y + Math.sin(aim.ang) * d, f.radius, WORLD.h - f.radius);
    resolvePillars(ctx, f);
    ctx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 0.45, max: 0.45, r: 46, color: fx.color, ring: true, ang: 0 });
  },

  shield(ctx, f, fx) { applyStatus(f, { shield: fx.amount, shieldDur: fx.dur }); },

  heal(ctx, f, fx) { heal(ctx, f, fx.amount); },

  buff(ctx, f, fx) {
    if (fx.invis) applyStatus(f, { invis: fx.invis });
    if (fx.empowered) f.status.empowered = fx.empowered;
  },

  spin(ctx, f, fx) {
    f.spin = { t: fx.t, tick: 0, dmg: fx.dmg, radius: fx.radius };
    if (fx.immuneSlow) f.status.immuneSlow = fx.immuneSlow;
  },

  cleanse(ctx, f) { f.status.stun = 0; f.status.root = 0; f.status.slowT = 0; f.status.slowStacks = []; f.status.slowPct = 0; f.status.burn = 0; },

  floater(ctx, f, fx) {
    ctx.floaters.push({
      x: f.x + (fx.dx || 0), y: f.y + (fx.dy ?? -70), vy: -40,
      t: 1, max: 1, text: fx.text, color: fx.color || '#fff', size: fx.size || 16,
    });
  },

  thorns(ctx, f, fx) {
    applyStatus(f, {});
    f.status.thornsPct = Math.max(f.status.thornsPct || 0, fx.pct);
    f.status.thornsT = Math.max(f.status.thornsT || 0, fx.dur);
  },

  cleanseSlow(ctx, f) {
    f.status.slowStacks = [];
    f.status.slowPct = 0;
    f.status.slowT = 0;
  },

  mine(ctx, f, fx, aim) {
    ctx.traps.push({
      x: aim.ax, y: aim.ay, r: fx.r || 110, triggerR: fx.triggerR || 70,
      armT: fx.armDelay ?? 0.5, ttl: fx.ttl || 20, t: 0,
      dmg: fx.dmg, owner: f, team: f.team, color: fx.color || '#7ddf64',
      slow: fx.slow || null, poison: fx.poison || null,
    });
  },

  scatter(ctx, f, fx, aim) {
    for (let i = 0; i < (fx.count || 5); i++) {
      spawnZone(ctx, {
        x: aim.ax + rand(-1, 1) * (fx.spread || 200),
        y: aim.ay + rand(-1, 1) * (fx.spread || 200),
        r: fx.r, delay: (fx.delay || 0.8) + i * 0.15, dmg: fx.dmg, owner: f,
        color: fx.color, onHit: statusOnHit(fx),
      });
    }
  },

  aura(ctx, f, fx, aim) {
    const at = fx.at === 'self' ? { x: f.x, y: f.y } : { x: aim.ax, y: aim.ay };
    spawnZone(ctx, {
      x: at.x, y: at.y, r: fx.r, delay: fx.delay ?? 0.4, dmg: 0, owner: f,
      color: fx.color,
      aura: {
        dur: fx.dur, every: fx.every ?? 0.5,
        slow: fx.slow || null, poison: fx.poison || null, root: fx.root || 0,
        healRate: fx.healRate || 0,
      },
    });
  },

  beam(ctx, f, fx, aim) {
    const dx = Math.cos(aim.ang), dy = Math.sin(aim.ang);
    for (const e of ctx.fighters) {
      if (e.team === f.team || !e.alive) continue;
      const rx = e.x - f.x, ry = e.y - f.y;
      const proj = rx * dx + ry * dy;
      if (proj < 0 || proj > fx.range) continue;
      if (Math.abs(rx * dy - ry * dx) < (fx.halfWidth || 30) + e.radius) {
        damage(ctx, e, fx.dmg, f);
        if (fx.slow) applyStatus(e, { slowPct: fx.slow.pct, slowDur: fx.slow.dur });
        if (fx.poison) applyStatus(e, { poisonDps: fx.poison.dps, poisonDur: fx.poison.dur });
        spawnHitParticles(ctx, e.x, e.y, fx.color);
      }
    }
    ctx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, ang: aim.ang, len: fx.range,
      width: (fx.halfWidth || 30) * 2, color: fx.color, t: 0.25, max: 0.25, beam: true });
  },
};

function statusOnHit(fx) {
  if (!fx.slow && !fx.stun && !fx.root && !fx.poison) return null;
  return (e) => {
    if (fx.slow) applyStatus(e, { slowPct: fx.slow.pct, slowDur: fx.slow.dur });
    if (fx.stun) applyStatus(e, { stun: fx.stun });
    if (fx.root) applyStatus(e, { root: fx.root });
    if (fx.poison) applyStatus(e, { poisonDps: fx.poison.dps, poisonDur: fx.poison.dur });
  };
}

export function runEffects(ctx, f, effects, aim) {
  for (const fx of effects) RUNNERS[fx.do](ctx, f, fx, aim);
}

export function executeAbility(ctx, f, def, ax, ay) {
  const aim = { ax, ay, ang: angTo(f, { x: ax, y: ay }) };
  const first = def.effects[0];
  // Efecto 'cast' primero = casteo con raíz: se dispara al completar.
  if (first && first.do === 'cast') {
    f.casting = {
      t: first.dur, then: def.effects.slice(1), ax, ay,
      key: def.key, cd: def.cd, cost: def.cost, ppKey: def.key,
    };
    ctx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 0.4, max: 0.4, r: 40, color: '#ffffff', ring: true, ang: 0 });
    return;
  }
  runEffects(ctx, f, def.effects, aim);
}

/* ------------------------- catálogo (datos) ------------------------- */
export const ABILITIES = {
  'seismic-slam': { name: 'Impacto Sísmico', icon: '💥', cd: 6, cost: 20, pp: 15, types: ['Tierra'], range: 190, aimMode: 'target',
    desc: 'Cono frontal: daño + ralentiza 45% por 2s',
    effects: [
      { do: 'face' },
      { do: 'ring', r: 80, color: '#d4a017', t: 0.35 },
      { do: 'cone', range: 190, halfAngle: 0.85, dmg: 115, slow: { pct: 0.45, dur: 2 }, hitColor: '#d4a017' },
    ] },
  'iron-skin': { name: 'Piel de Hierro', icon: '🛡️', cd: 14, cost: 25, pp: 10, types: ['Tierra'], range: 9999, aimMode: 'self',
    desc: 'Escudo de 340 durante 4.5s',
    effects: [
      { do: 'shield', amount: 340, dur: 4.5 },
      { do: 'floater', text: 'ESCUDO', color: '#9fe8ff', size: 16 },
    ] },
  'rock-charge': { name: 'Carga Rocosa', icon: '🐗', cd: 13, cost: 30, pp: 10, range: 420, aimMode: 'target',
    desc: 'Embestida: daño + aturde 1s',
    effects: [
      { do: 'dash', speed: 980, time: 0.30, dmg: 105, stun: 1.0, stopOnHit: true, color: '#d4a017' },
    ] },
  'earthquake': { name: 'Terremoto', icon: '🌋', cd: 45, cost: 50, pp: 5, types: ['Tierra'], range: 260, aimMode: 'self',
    desc: 'ULTI: AoE a tu alrededor, daño masivo + empuje',
    effects: [
      { do: 'zoneSelf', r: 250, delay: 0.45, dmg: 230, color: '#d4a017', knock: 520, slow: { pct: 0.5, dur: 2.5 } },
    ] },

  'shadow-slash': { name: 'Cuchillada Sombría', icon: '⚡', cd: 6, cost: 20, pp: 15, types: ['Siniestro'], range: 300, aimMode: 'target',
    desc: 'Dash que atraviesa: daño en el camino',
    effects: [
      { do: 'dash', speed: 1350, time: 0.22, dmg: 135, color: '#a06bff' },
    ] },
  'veil': { name: 'Velo de Sombras', icon: '🌑', cd: 15, cost: 25, pp: 10, types: ['Siniestro', 'Psiquico'], range: 9999, aimMode: 'self',
    desc: 'Invisible 1.6s, +45% vel, próximo golpe +60%',
    effects: [
      { do: 'buff', invis: 1.6, empowered: 3.5 },
      { do: 'ring', r: 60, color: '#a06bff', t: 0.5 },
    ] },
  'electric-trap': { name: 'Trampa Eléctrica', icon: '🕸️', cd: 9, cost: 20, pp: 15, types: ['Siniestro', 'Psiquico'], range: 420, aimMode: 'target',
    desc: 'Proyectil que enraíza 1.6s',
    effects: [
      { do: 'projectile', speed: 820, radius: 11, dmg: 65, range: 420, color: '#ffe066', rootDur: 1.6 },
    ] },
  'blade-storm': { name: 'Tormenta de Cuchillas', icon: '🌀', cd: 45, cost: 50, pp: 5, types: ['Siniestro'], range: 170, aimMode: 'self',
    desc: 'ULTI: giras 2.5s con daño en área',
    effects: [
      { do: 'spin', t: 2.5, dmg: 58, radius: 150, immuneSlow: 2.5 },
      { do: 'ring', r: 150, color: '#a06bff', t: 0.5 },
    ] },

  'fireball': { name: 'Bola de Fuego', icon: '🔥', cd: 4.5, cost: 25, pp: 15, types: ['Psiquico'], range: 780, aimMode: 'target',
    desc: 'Skillshot + quemadura 3s',
    effects: [
      { do: 'projectile', speed: 760, radius: 15, dmg: 175, range: 780, color: '#ff6b35', burn: { dps: 28, dur: 3 } },
    ] },
  'ice-prison': { name: 'Prisión de Hielo', icon: '❄️', cd: 11, cost: 25, pp: 10, types: ['Psiquico'], range: 620, aimMode: 'target',
    desc: 'Skillshot que enraíza 1.8s',
    effects: [
      { do: 'projectile', speed: 700, radius: 13, dmg: 70, range: 620, color: '#6fd6ff', rootDur: 1.8 },
    ] },
  'teleport': { name: 'Teletransporte', icon: '💫', cd: 15, cost: 20, pp: 10, range: 9999, aimMode: 'direction',
    desc: 'Parpadeo direccional',
    effects: [
      { do: 'blink', maxDist: 360, color: '#ff9ecb' },
    ] },
  'psychic-nova': { name: 'Nova Psíquica', icon: '🧠', cd: 50, cost: 60, pp: 5, types: ['Psiquico'], range: 320, aimMode: 'self',
    desc: 'ULTI: aturde 1.3s en gran área',
    effects: [
      { do: 'zoneSelf', r: 300, delay: 0.5, dmg: 215, color: '#ff5fa2', stun: 1.3 },
    ] },

  'healing-pulse': { name: 'Pulso Curativo', icon: '💚', cd: 6, cost: 30, pp: 10, types: ['Planta', 'Psiquico'], range: 9999, aimMode: 'self',
    desc: 'Cura 240 al instante',
    effects: [
      { do: 'heal', amount: 240 },
      { do: 'ring', r: 55, color: '#4bd88a', t: 0.5 },
    ] },
  'pollen-shield': { name: 'Escudo de Polen', icon: '🌼', cd: 12, cost: 25, pp: 10, types: ['Planta'], range: 9999, aimMode: 'self',
    desc: 'Escudo 300 por 5s',
    effects: [
      { do: 'shield', amount: 300, dur: 5 },
      { do: 'ring', r: 50, color: '#ffe066', t: 0.5 },
    ] },
  'vines': { name: 'Lianas', icon: '🌱', cd: 12, cost: 25, pp: 15, types: ['Planta'], range: 560, aimMode: 'target',
    desc: 'Área que enraíza 1.7s',
    effects: [
      { do: 'zoneAt', r: 135, delay: 0.35, dmg: 55, color: '#4bd88a', root: 1.7 },
    ] },
  'forest-blessing': { name: 'Bendición del Bosque', icon: '🌳', cd: 50, cost: 60, pp: 5, types: ['Planta'], range: 400, aimMode: 'self',
    desc: 'ULTI: cura 480 y limpia estados',
    effects: [
      { do: 'heal', amount: 480 },
      { do: 'cleanse' },
      { do: 'zoneSelf', r: 330, delay: 0.15, dmg: 0, color: '#4bd88a' },
      { do: 'ring', r: 330, color: '#4bd88a', t: 0.8 },
    ] },

  'razor-leaf': { name: 'Hoja Afilada', icon: '🍃', cd: 5, cost: 22, pp: 15, types: ['Planta'], range: 600, aimMode: 'target',
    desc: 'Proyectil que atraviesa enemigos',
    effects: [
      { do: 'projectile', speed: 850, radius: 12, dmg: 80, range: 600, color: '#7ddf64', pierce: true },
    ] },
  'sleep-powder': { name: 'Somnífero', icon: '😴', cd: 12, cost: 25, pp: 10, types: ['Planta'], range: 480, aimMode: 'target',
    desc: 'Nube que duerme 1.5s en área',
    effects: [
      { do: 'zoneAt', r: 120, delay: 0.4, dmg: 30, color: '#b8a9e0', stun: 1.5 },
    ] },
  'ember': { name: 'Ascuas', icon: '🔥', cd: 3.5, cost: 20, pp: 20, types: ['Fuego'], range: 640, aimMode: 'target',
    desc: 'Llamarada rápida + quemadura 2s',
    effects: [
      { do: 'projectile', speed: 800, radius: 12, dmg: 90, range: 640, color: '#ff9a3d', burn: { dps: 20, dur: 2 } },
    ] },
  'smokescreen': { name: 'Pantalla de Humo', icon: '💨', cd: 14, cost: 25, pp: 15, types: ['Fuego'], range: 9999, aimMode: 'self',
    desc: 'Humo que ralentiza 50% alrededor',
    effects: [
      { do: 'zoneSelf', r: 200, delay: 0.3, dmg: 0, color: '#8a8f98', slow: { pct: 0.5, dur: 2 } },
    ] },
  'water-gun': { name: 'Pistola Agua', icon: '💧', cd: 5, cost: 22, pp: 15, types: ['Agua'], range: 620, aimMode: 'target',
    desc: 'Chorro que empuja al impactar',
    effects: [
      { do: 'projectile', speed: 820, radius: 13, dmg: 95, range: 620, color: '#4db2ff', knock: 260 },
    ] },
  'withdraw': { name: 'Refugio', icon: '🐚', cd: 13, cost: 25, pp: 10, types: ['Agua'], range: 9999, aimMode: 'self',
    desc: 'Escudo de 300 durante 4s',
    effects: [
      { do: 'shield', amount: 300, dur: 4 },
      { do: 'ring', r: 50, color: '#4db2ff', t: 0.5 },
    ] },
  'thunder-shock': { name: 'Impactrueno', icon: '⚡', cd: 4, cost: 22, pp: 15, types: ['Electrico'], range: 660, aimMode: 'target',
    desc: 'Rayo velocísimo que ralentiza',
    effects: [
      { do: 'projectile', speed: 950, radius: 11, dmg: 120, range: 660, color: '#ffe14d', slow: { pct: 0.3, dur: 1.5 } },
    ] },
  'thunder-wave': { name: 'Onda Trueno', icon: '🌩️', cd: 11, cost: 25, pp: 10, types: ['Electrico'], range: 520, aimMode: 'target',
    desc: 'Área que paraliza 60% por 2s',
    effects: [
      { do: 'zoneAt', r: 140, delay: 0.35, dmg: 20, color: '#ffe14d', slow: { pct: 0.6, dur: 2 } },
    ] },

  'spore-charge': { name: 'Carga de Esporas', icon: '🍂', cd: 8, cost: 25, types: ['Veneno'], range: 300, aimMode: 'target',
    desc: 'Embestida que ralentiza 25% al atravesar',
    effects: [
      { do: 'dash', speed: 1100, time: 0.24, dmg: 20, slow: { pct: 0.25, dur: 2 }, color: '#7ddf64' },
    ] },
  'dorsal-shield': { name: 'Escudo Dorsal', icon: '🛡️', cd: 14, cost: 30, types: ['Veneno'], range: 9999, aimMode: 'self',
    desc: 'Escudo 280 + quien te pega se frena',
    effects: [
      { do: 'shield', amount: 280, dur: 4 },
      { do: 'thorns', pct: 0.2, dur: 4 },
    ] },
  'thorn-ice': { name: 'Hielo de Espinas', icon: '🧊', cd: 10, cost: 35, types: ['Veneno'], range: 220, aimMode: 'direction',
    desc: 'Cono amplio: daño + slow 40%',
    effects: [
      { do: 'face' },
      { do: 'cone', range: 220, halfAngle: 1.75, dmg: 90, slow: { pct: 0.4, dur: 2.5 }, hitColor: '#aee3ff' },
    ] },
  'spore-masterpiece': { name: 'Obra Maestra', icon: '🍄', cd: 30, cost: 60, pp: 5, types: ['Veneno'], range: 320, aimMode: 'self',
    desc: 'ULTI: nova que envenena + frena 4s',
    effects: [
      { do: 'aura', at: 'self', r: 260, delay: 0.4, dur: 4, color: '#7ddf64',
        slow: { pct: 0.3, dur: 2.5 }, poison: { dps: 30, dur: 4 } },
    ] },
  'bombardment': { name: 'Bombardeo', icon: '☄️', cd: 12, cost: 40, types: ['Veneno'], range: 550, aimMode: 'target',
    desc: 'Zona telegrafiada: daño 150 en área',
    effects: [
      { do: 'zoneAt', r: 140, delay: 1.0, dmg: 150, color: '#d8b24a' },
    ] },
  'spore-mine': { name: 'Mina de Esporas', icon: '🟣', cd: 14, cost: 30, types: ['Veneno'], range: 400, aimMode: 'target',
    desc: 'Trampa 20s: explota al pisar',
    effects: [
      { do: 'mine', r: 110, triggerR: 70, armDelay: 0.5, ttl: 20, dmg: 100, color: '#9d6fd1',
        slow: { pct: 0.3, dur: 2 } },
    ] },
  'mineral-sap': { name: 'Savia Mineral', icon: '🧪', cd: 16, cost: 35, types: ['Veneno'], range: 9999, aimMode: 'self',
    desc: 'Zona que cura 200 en 3s',
    effects: [
      { do: 'aura', at: 'self', r: 200, delay: 0.2, dur: 3, color: '#4bd88a', healRate: 70 },
    ] },
  'pearl-rain': { name: 'Lluvia de Perlas', icon: '🌧️', cd: 32, cost: 65, pp: 5, types: ['Veneno'], range: 400, aimMode: 'target',
    desc: 'ULTI: 5 zonas telegrafiadas, 110 c/u',
    effects: [
      { do: 'scatter', count: 5, r: 110, delay: 0.8, dmg: 110, spread: 200, color: '#cfc3e8' },
    ] },
  'charged-shot': { name: 'Tiro Cargado', icon: '🏹', cd: 9, cost: 30, types: ['Veneno'], range: 700, aimMode: 'target',
    desc: 'Casteo 1s: daño 220 (se interrumpe)',
    effects: [
      { do: 'cast', dur: 1.0 },
      { do: 'projectile', speed: 1100, radius: 10, dmg: 220, range: 700, color: '#e8f0ff' },
    ] },
  'tailwind': { name: 'Viento a Favor', icon: '🌬️', cd: 10, cost: 20, types: ['Veneno'], range: 9999, aimMode: 'direction',
    desc: 'Escape + limpia tu slow',
    effects: [
      { do: 'dash', speed: 1200, time: 0.25, dmg: 0, color: '#c0b3e8' },
      { do: 'cleanseSlow' },
    ] },
  'spore-cloud': { name: 'Nube de Esporas', icon: '☁️', cd: 13, cost: 35, types: ['Veneno'], range: 450, aimMode: 'target',
    desc: 'Nube 8s que frena 25% (visión: pendiente online)',
    effects: [
      { do: 'aura', at: 'point', r: 180, delay: 0.4, dur: 8, color: '#9d6fd1', slow: { pct: 0.25, dur: 2 } },
    ] },
  'silent-death': { name: 'Muerte Silenciosa', icon: '💀', cd: 30, cost: 60, pp: 5, types: ['Veneno'], range: 900, aimMode: 'target',
    desc: 'ULTI: canaliza 1.2s, rayo de 380',
    effects: [
      { do: 'cast', dur: 1.2 },
      { do: 'beam', range: 900, halfWidth: 26, dmg: 380, color: '#f2ecff' },
    ] },
  'ice-spikes': { name: 'Pinchos de Hielo', icon: '📌', cd: 9, cost: 30, types: ['Veneno'], range: 260, aimMode: 'direction',
    desc: 'Cono: daño + slow 45%',
    effects: [
      { do: 'face' },
      { do: 'cone', range: 260, halfAngle: 0.7, dmg: 70, slow: { pct: 0.45, dur: 2 }, hitColor: '#aee3ff' },
    ] },
  'snow-fungus': { name: 'Hongo de Nieve', icon: '⛄', cd: 15, cost: 35, types: ['Veneno'], range: 480, aimMode: 'target',
    desc: 'Zona 6s que frena 35% al entrar',
    effects: [
      { do: 'aura', at: 'point', r: 220, delay: 0.4, dur: 6, color: '#bcd8e8', slow: { pct: 0.35, dur: 2 } },
    ] },
  'root-snare': { name: 'Arraigo', icon: '🪢', cd: 16, cost: 40, types: ['Veneno'], range: 400, aimMode: 'target',
    desc: 'Enraíza 1.5s + envenena',
    effects: [
      { do: 'projectile', speed: 750, radius: 12, dmg: 60, range: 400, color: '#8fce7d',
        rootDur: 1.5, poison: { dps: 20, dur: 3 } },
    ] },
  'spore-winter': { name: 'Invierno de Esporas', icon: '🌨️', cd: 34, cost: 70, pp: 5, types: ['Veneno'], range: 520, aimMode: 'target',
    desc: 'ULTI: zona 5s slow 40% + veneno',
    effects: [
      { do: 'aura', at: 'point', r: 320, delay: 0.5, dur: 5, color: '#a9cdea',
        slow: { pct: 0.4, dur: 2.5 }, poison: { dps: 25, dur: 4 } },
    ] },
};

// Compatibilidad estilo MT: ¿puede un tipo equiparla? Sin `types` = universal
// (las utilidades como Teletransporte o Carga, igual que las MT universales).
export function canLearn(clsType, def) {
  if (!def.types || def.types.length === 0) return true;
  return def.types.includes(clsType);
}

// Arma el slot jugable: copia la definición del catálogo + tecla + cast().
export function makeAbility(id, key) {
  const def = ABILITIES[id];
  if (!def) throw new Error(`Habilidad desconocida: ${id}`);
  return {
    ...def,
    id,
    key,
    cast: (ctx, f, ax, ay) => executeAbility(ctx, f, def, ax, ay),
  };
}
