import { clamp, rand, dist, angTo, angDiff, TAU } from '../utils/math.js';
import { typeMult, WORLD } from '../data/types.js';

// ctx = { fighters, projectiles, zones, particles, floaters, pillars, onDeath }

export function spawnProjectile(ctx, owner, o) {
  const p = {
    x: o.x, y: o.y,
    vx: Math.cos(o.angle) * o.speed, vy: Math.sin(o.angle) * o.speed,
    r: o.radius || 10, dmg: o.dmg, owner, team: owner.team,
    travelled: 0, range: o.range || 700,
    color: o.color || '#fff', type: o.type || owner.type,
    pierce: !!o.pierce, hitSet: new Set(), trail: [],
    slowPct: o.slowPct || 0, slowDur: o.slowDur || 0,
    rootDur: o.rootDur || 0, burnDps: o.burnDps || 0, burnDur: o.burnDur || 0,
    knock: o.knock || 0, onHit: o.onHit || null,
  };
  ctx.projectiles.push(p);
  return p;
}

export function spawnZone(ctx, o) {
  const z = {
    x: o.x, y: o.y, r: o.r, delay: o.delay || 0,
    t: 0, fired: false, fade: 0, dmg: o.dmg || 0,
    owner: o.owner, team: o.owner.team, color: o.color || '#ff8844',
    onHit: o.onHit || null, knock: o.knock || 0,
  };
  ctx.zones.push(z);
  return z;
}

export function spawnHitParticles(ctx, x, y, color) {
  for (let i = 0; i < 9; i++) {
    const a = rand(0, TAU), sp = rand(70, 240);
    ctx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t: rand(0.2, 0.45), max: 0.45, r: rand(2, 4), color });
  }
}

export function startDash(f, ang, speed, time, dmg, opts = {}) {
  f.dash = {
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    time, dmg, hitSet: new Set(),
    stun: opts.stun || 0, stopOnHit: !!opts.stopOnHit, color: opts.color || '#fff',
  };
}

export function applyStatus(target, st) {
  const s = target.status;
  if (st.stun) s.stun = Math.max(s.stun, st.stun);
  if (st.root) s.root = Math.max(s.root, st.root);
  if (st.slowPct) { s.slowPct = Math.max(s.slowPct, st.slowPct); s.slowT = Math.max(s.slowT, st.slowDur || 2); }
  if (st.shield) { s.shield = Math.max(s.shield, st.shield); s.shieldT = Math.max(s.shieldT, st.shieldDur || 4); }
  if (st.invis) s.invis = Math.max(s.invis, st.invis);
  if (st.burn) { s.burn = Math.max(s.burn, st.burnDur || 3); s.burnDps = Math.max(s.burnDps, st.burnDps || 25); }
}

export function damage(ctx, target, amount, source, opts = {}) {
  if (!target.alive || target.status.invuln > 0) return 0;
  let mult = 1;
  if (source?.type && target.type) mult = typeMult(source.type, target.type);
  let dmg = amount * mult;

  if (source?.status?.empowered > 0 && !opts.noEmpower) {
    dmg *= 1.6;
    source.status.empowered = 0;
    ctx.floaters.push({ x: source.x, y: source.y - 60, vy: -40, t: 0.8, max: 0.8, text: '¡CRÍTICO!', color: '#c77dff', size: 14 });
  }

  const s = target.status;
  if (s.shield > 0) {
    const abs = Math.min(s.shield, dmg);
    s.shield -= abs; dmg -= abs;
    if (s.shield <= 0.5) { s.shield = 0; s.shieldT = 0; }
  }

  target.hp -= dmg;
  target.hitFlash = 0.16;
  ctx.floaters.push({
    x: target.x + rand(-12, 12), y: target.y - target.radius - 8,
    vy: -55, t: 0.95, max: 0.95, text: String(Math.round(dmg)),
    color: mult > 1 ? '#ffd93d' : mult < 1 ? '#8fa3b0' : '#ffffff',
    size: mult > 1 ? 24 : 18,
  });

  if (target.hp <= 0) { target.hp = 0; target.alive = false; ctx.onDeath?.(target); }
  return dmg;
}

export function heal(ctx, target, amount) {
  if (!target.alive) return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  if (target.hp - before > 1) {
    ctx.floaters.push({ x: target.x, y: target.y - target.radius - 8, vy: -50, t: 0.9, max: 0.9,
      text: '+' + Math.round(target.hp - before), color: '#63e08a', size: 19 });
  }
}

export function resolvePillars(ctx, e) {
  for (const p of ctx.pillars) {
    const dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    const min = p.r + e.radius;
    if (d < min && d > 0.0001) {
      e.x += (dx / d) * (min - d);
      e.y += (dy / d) * (min - d);
    } else if (d <= 0.0001) e.x += min;
  }
  e.x = clamp(e.x, e.radius, WORLD.w - e.radius);
  e.y = clamp(e.y, e.radius, WORLD.h - e.radius);
}

export function castBasic(ctx, f, ax, ay) {
  if (f.basicCd > 0 || f.status.stun > 0 || f.dash) return;
  if ((f.pp?.basic ?? Infinity) <= 0) return;
  const b = f.def.basic;
  const ang = angTo(f, { x: ax, y: ay });
  f.facing = ang;
  f.basicCd = b.cd;
  if (f.pp) f.pp.basic = Math.max(0, f.pp.basic - 1);

  if (b.kind === 'melee') {
    for (const e of ctx.fighters) {
      if (e.team === f.team || !e.alive) continue;
      if (dist(f, e) < b.range + e.radius) {
        if (Math.abs(angDiff(angTo(f, e), ang)) < b.arc / 2 + 0.15) {
          damage(ctx, e, b.dmg, f);
          spawnHitParticles(ctx, e.x, e.y, f.def.accent);
        }
      }
    }
    ctx.particles.push({ x: f.x, y: f.y, vx: 0, vy: 0, t: 0.14, max: 0.14,
      r: b.range * 0.8, color: f.def.accent, arc: true, ang, arcWidth: b.arc });
  } else {
    spawnProjectile(ctx, f, {
      x: f.x + Math.cos(ang) * f.radius, y: f.y + Math.sin(ang) * f.radius,
      angle: ang, speed: b.projSpeed, radius: b.projRadius, dmg: b.dmg, range: b.range, color: b.color,
    });
  }
}

export function castAbility(ctx, f, idx, ax, ay) {
  const a = f.def.abilities[idx];
  if (!a || f.cds[a.key] > 0 || f.res < a.cost || f.status.stun > 0 || f.dash) return false;
  if ((f.pp?.[a.key] ?? Infinity) <= 0) return false;
  f.res -= a.cost;
  f.cds[a.key] = a.cd;
  if (f.pp) f.pp[a.key] = Math.max(0, f.pp[a.key] - 1);
  a.cast(ctx, f, ax, ay);
  return true;
}

export function buildPillars() {
  const pillars = [];
  const cols = 5, rows = 4;
  const mx = WORLD.w * 0.14, my = WORLD.h * 0.16;
  const stepX = (WORLD.w - mx * 2) / (cols - 1);
  const stepY = (WORLD.h - my * 2) / (rows - 1);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = mx + i * stepX, y = my + j * stepY;
    if (Math.hypot(x - WORLD.w / 2, y - WORLD.h / 2) < 200) continue;
    pillars.push({ x, y, r: rand(46, 62) });
  }
  return pillars;
}
