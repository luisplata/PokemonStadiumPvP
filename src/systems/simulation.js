// Simulación: avanza el ESTADO del juego. No dibuja nada, no lee input.
// ArenaScene le pasa el ctx y el dt; esto actualiza fighters, proyectiles,
// zonas y efectos. Regla: si no cambia estado, no va acá (va en renderer).
import { WORLD } from '../data/types.js';
import { damage, applyStatus, spawnHitParticles } from './combat.js';
import { rand, TAU } from '../utils/math.js';

export function stepSimulation(ctx, dt) {
  for (const f of ctx.fighters) f.update(dt, ctx);
  updateProjectiles(ctx, dt);
  updateZones(ctx, dt);
  updateFx(ctx, dt);
}

function updateProjectiles(ctx, dt) {
  const { projectiles, pillars, fighters } = ctx;
  for (const pr of projectiles) {
    const sx = pr.vx * dt, sy = pr.vy * dt;
    pr.x += sx; pr.y += sy;
    pr.travelled += Math.hypot(sx, sy);
    pr.trail.push({ x: pr.x, y: pr.y });
    if (pr.trail.length > 8) pr.trail.shift();
    if (pr.travelled > pr.range || pr.x < -50 || pr.y < -50 || pr.x > WORLD.w + 50 || pr.y > WORLD.h + 50) { pr.dead = true; continue; }
    for (const pil of pillars) {
      if (Math.hypot(pr.x - pil.x, pr.y - pil.y) < pil.r + pr.r) {
        pr.dead = true; spawnHitParticles(ctx, pr.x, pr.y, pr.color); break;
      }
    }
    if (pr.dead) continue;
    for (const f of fighters) {
      if (f.team === pr.team || !f.alive || pr.hitSet.has(f)) continue;
      if (Math.hypot(pr.x - f.x, pr.y - f.y) < f.radius + pr.r) {
        pr.hitSet.add(f);
        damage(ctx, f, pr.dmg, pr.owner);
        spawnHitParticles(ctx, pr.x, pr.y, pr.color);
        const st = {};
        if (pr.slowPct) { st.slowPct = pr.slowPct; st.slowDur = pr.slowDur; }
        if (pr.rootDur) st.root = pr.rootDur;
        if (pr.burnDps) { st.burnDps = pr.burnDps; st.burnDur = pr.burnDur; }
        if (Object.keys(st).length) applyStatus(f, st);
        if (pr.knock) {
          const a = Math.atan2(pr.vy, pr.vx);
          f.kx += Math.cos(a) * pr.knock; f.ky += Math.sin(a) * pr.knock;
        }
        if (!pr.pierce) { pr.dead = true; break; }
      }
    }
  }
  ctx.projectiles = projectiles.filter((x) => !x.dead);
}

function updateZones(ctx, dt) {
  for (const z of ctx.zones) {
    z.t += dt;
    if (!z.fired && z.t >= z.delay) {
      z.fired = true;
      for (const f of ctx.fighters) {
        if (f.team === z.team || !f.alive) continue;
        if (Math.hypot(f.x - z.x, f.y - z.y) < z.r + f.radius * 0.4) {
          if (z.dmg > 0) damage(ctx, f, z.dmg, z.owner);
          if (z.knock) {
            const a = Math.atan2(f.y - z.y, f.x - z.x);
            f.kx += Math.cos(a) * z.knock; f.ky += Math.sin(a) * z.knock;
          }
          z.onHit?.(f, z, ctx);
        }
      }
      for (let i = 0; i < 24; i++) {
        const a = rand(0, TAU), rr = rand(0, z.r);
        ctx.particles.push({ x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr,
          vx: Math.cos(a) * rand(60, 260), vy: Math.sin(a) * rand(60, 260),
          t: rand(0.25, 0.6), max: 0.6, r: rand(2, 6), color: z.color });
      }
    }
    if (z.fired) z.fade += dt;
  }
  ctx.zones = ctx.zones.filter((z) => !(z.fired && z.fade > 0.4));
}

function updateFx(ctx, dt) {
  for (const pt of ctx.particles) {
    pt.t -= dt;
    if (!pt.ring && !pt.arc) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= Math.pow(0.02, dt); pt.vy *= Math.pow(0.02, dt);
    }
  }
  ctx.particles = ctx.particles.filter((x) => x.t > 0);
  for (const fl of ctx.floaters) { fl.t -= dt; fl.y += fl.vy * dt; fl.vy *= Math.pow(0.2, dt); }
  ctx.floaters = ctx.floaters.filter((x) => x.t > 0);
}
