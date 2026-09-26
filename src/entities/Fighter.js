import { rand, dist, TAU } from '../utils/math.js';
import { CLASSES } from '../data/classes.js';
import { makeAbility } from '../data/abilities.js';
import { damage, applyStatus, resolvePillars, spawnHitParticles } from '../systems/combat.js';
import { think } from '../systems/bot.js';

export class Fighter {
  // controller: { kind:'bot' } | { kind:'local', input: Input }
  // kitIds: override del kit (loadout elegido). null = kit de clase.
  constructor(ctx, clsKey, x, y, team, controller, kitIds = null) {
    const base = CLASSES[clsKey];
    const d = kitIds
      ? { ...base, abilities: kitIds.map((id, i) => makeAbility(id, ['1', '2', '3'][i])) }
      : base;
    this.cls = clsKey; this.def = d;
    this.x = x; this.y = y;
    this.team = team;
    this.controller = controller;
    this.radius = d.radius;
    this.maxHp = d.hp; this.hp = d.hp;
    this.maxRes = d.res; this.res = d.res;
    this.speed = d.speed; this.type = d.type; this.name = d.name;
    this.facing = 0; this.alive = true;
    this.cds = {}; d.abilities.forEach((a) => (this.cds[a.key] = 0));
    this.pp = { basic: d.basic.pp ?? Infinity };
    d.abilities.forEach((a) => (this.pp[a.key] = a.pp ?? Infinity));
    this.basicCd = 0; this.hitFlash = 0;
    this.dash = null; this.spin = null;
    this.kx = 0; this.ky = 0;
    this.aiTimer = 0; this.dodgeCd = 0;
    // pizarra del bot (la lee/escribe systems/bot.js, no la lógica de movimiento)
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = rand(1, 2.5);
    this.status = { stun: 0, root: 0, slowT: 0, slowPct: 0, shield: 0, shieldT: 0,
      invis: 0, empowered: 0, burn: 0, burnDps: 0, invuln: 0, immuneSlow: 0 };
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), sp = rand(60, 200);
      ctx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: rand(0.3, 0.8), max: 0.8, r: rand(2, 5), color: d.color });
    }
    // Vista Phaser (se crea en la escena)
    this.view = null;
  }

  update(dt, ctx) {
    if (!this.alive) return;
    const s = this.status;
    for (const k in this.cds) this.cds[k] = Math.max(0, this.cds[k] - dt);
    this.basicCd = Math.max(0, this.basicCd - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    s.stun = Math.max(0, s.stun - dt);
    s.root = Math.max(0, s.root - dt);
    s.slowT = Math.max(0, s.slowT - dt);
    s.invis = Math.max(0, s.invis - dt);
    s.empowered = Math.max(0, s.empowered - dt);
    s.invuln = Math.max(0, s.invuln - dt);
    s.immuneSlow = Math.max(0, s.immuneSlow - dt);
    if (s.slowT <= 0) s.slowPct = 0;
    if (s.shieldT > 0) { s.shieldT -= dt; if (s.shieldT <= 0) s.shield = 0; }
    if (s.burn > 0) {
      s.burn -= dt;
      damage(ctx, this, s.burnDps * dt, null, { noEmpower: true });
      if (Math.random() < 0.35)
        ctx.particles.push({ x: this.x + rand(-14, 14), y: this.y + rand(-14, 14), vx: 0, vy: -40, t: 0.4, max: 0.4, r: rand(2, 4), color: '#ff6b35' });
      if (s.burn <= 0) s.burnDps = 0;
    }
    if (this.res < this.maxRes) this.res = Math.min(this.maxRes, this.res + this.def.resRegen * dt);

    if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) {
      this.x += this.kx * dt; this.y += this.ky * dt;
      const damp = Math.pow(0.0015, dt);
      this.kx *= damp; this.ky *= damp;
      if (Math.abs(this.kx) < 5) this.kx = 0;
      if (Math.abs(this.ky) < 5) this.ky = 0;
    }

    if (this.dash) {
      const d = this.dash;
      d.time -= dt;
      this.x += d.vx * dt; this.y += d.vy * dt;
      resolvePillars(ctx, this);
      for (const e of ctx.fighters) {
        if (e.team === this.team || !e.alive || d.hitSet.has(e)) continue;
        if (dist(this, e) < this.radius + e.radius + 12) {
          d.hitSet.add(e);
          damage(ctx, e, d.dmg, this);
          spawnHitParticles(ctx, e.x, e.y, d.color);
          if (d.stun) applyStatus(e, { stun: d.stun });
          if (d.stopOnHit) d.time = 0;
        }
      }
      if (d.time <= 0) this.dash = null;
      return;
    }

    let dx = 0, dy = 0;
    if (this.controller.kind === 'local') {
      const { keys, pad } = this.controller.input;
      if (keys.KeyA || keys.ArrowLeft) dx -= 1;
      if (keys.KeyD || keys.ArrowRight) dx += 1;
      if (keys.KeyW || keys.ArrowUp) dy -= 1;
      if (keys.KeyS || keys.ArrowDown) dy += 1;
      if (pad.connected) { dx += pad.move.x; dy += pad.move.y; }
    } else {
      const mv = think(ctx, this, dt);
      dx = mv.x; dy = mv.y;
    }

    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }

    let spd = this.speed;
    if (s.stun > 0 || s.root > 0) spd = 0;
    if (s.slowT > 0 && s.immuneSlow <= 0) spd *= 1 - s.slowPct;
    if (s.invis > 0) spd *= 1.45;

    this.x += dx * spd * dt;
    this.y += dy * spd * dt;
    resolvePillars(ctx, this);

    if (this.spin) {
      this.spin.t -= dt;
      this.spin.tick -= dt;
      if (this.spin.tick <= 0) {
        this.spin.tick = 0.25;
        for (const e of ctx.fighters) {
          if (e.team === this.team || !e.alive) continue;
          if (dist(this, e) < this.spin.radius + e.radius) {
            damage(ctx, e, this.spin.dmg, this);
            spawnHitParticles(ctx, e.x, e.y, '#a06bff');
          }
        }
        ctx.particles.push({ x: this.x, y: this.y, vx: 0, vy: 0, t: 0.25, max: 0.25,
          r: this.spin.radius * rand(0.7, 1), color: '#a06bff', ring: true, ang: rand(0, TAU) });
      }
      if (this.spin.t <= 0) this.spin = null;
    }
  }
}
