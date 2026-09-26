// Orquestadora: input de cada jugador humano + cámara compartida.
// Delega simular (simulation.js), dibujar (renderer.js) y HUD (HUDScene).
// Modos: pve (P1 vs bot) y pvp (P1 vs P2 local).
import Phaser from 'phaser';
import { WORLD } from '../data/types.js';
import { CLASSES } from '../data/classes.js';
import { Fighter } from '../entities/Fighter.js';
import { Input, resolveSlots } from '../systems/input.js';
import { getTargetAimPoint, getAimPointFor } from '../systems/aim.js';
import { startDash, castBasic, castAbility, buildPillars } from '../systems/combat.js';
import { stepSimulation } from '../systems/simulation.js';
import { WorldRenderer } from '../systems/renderer.js';
import { angTo, clamp, lerp, rand, TAU } from '../utils/math.js';

export class ArenaScene extends Phaser.Scene {
  constructor() { super('Arena'); }

  init(data) {
    this.mode = data.mode || 'pve';
    this.p1Cls = data.p1Cls || 'terravox';
    this.p2Cls = data.p2Cls;
    this.p1Kit = data.p1Kit || null;
    this.p2Kit = data.p2Kit || null;
  }

  create() {
    this.run = (this.run || 0) + 1;
    // Gracia anti-autocasteo: el A/click que lockeó no debe disparar al nacer.
    this.born = this.time.now;

    // P1: teclado+mouse siempre; mando según slots. P2 (PvP): mando.
    const slots = resolveSlots(this.mode);
    this.p1input = new Input({ useKeyboard: true, useMouse: true, padSlot: slots.p1 });
    this.p1input.bind();
    this.p1input.bindCanvas(this);
    if (this.mode === 'pvp') {
      this.p2input = new Input({ useKeyboard: false, useMouse: false, padSlot: slots.p2 });
      this.p2input.bind();
    } else {
      this.p2input = null;
    }

    this.ctx = {
      fighters: [], projectiles: [], zones: [], traps: [], particles: [], floaters: [],
      pillars: buildPillars(),
      onDeath: () => this.handleDeath(),
    };
    this.over = false;
    this.time_s = 0;

    const spawnL = { x: WORLD.w * 0.5, y: WORLD.h * 0.5 + 520 };
    const spawnR = { x: WORLD.w * 0.5, y: WORLD.h * 0.5 - 520 };
    this.player = new Fighter(this.ctx, this.p1Cls, spawnL.x, spawnL.y, 0,
      { kind: 'local', input: this.p1input }, this.p1Kit);
    this.ctx.fighters.push(this.player);

    if (this.mode === 'pvp') {
      this.bot = null;
      this.rival = new Fighter(this.ctx, this.p2Cls, spawnR.x, spawnR.y, 1,
        { kind: 'local', input: this.p2input }, this.p2Kit);
      this.ctx.fighters.push(this.rival);
    } else {
      const pool = Object.keys(CLASSES).filter((k) => k !== this.p1Cls);
      const botCls = this.p2Cls && CLASSES[this.p2Cls] ? this.p2Cls : pool[Math.floor(Math.random() * pool.length)];
      this.bot = new Fighter(this.ctx, botCls, spawnR.x, spawnR.y, 1,
        { kind: 'bot' }, this.p2Kit);
      this.ctx.fighters.push(this.bot);
      this.rival = this.bot;
    }

    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    this.camX = this.player.x;
    this.camY = this.player.y;
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(this.camX, this.camY);

    this.renderer = new WorldRenderer(this);
    this.renderer.syncFighters(this.ctx.fighters);
    this.scene.launch('HUD');
  }

  restartRun() { this.scene.restart({ mode: this.mode, p1Cls: this.p1Cls, p2Cls: this.p2Cls, p1Kit: this.p1Kit, p2Kit: this.p2Kit }); }

  handleDeath() {
    const dead = this.ctx.fighters.filter((x) => !x.alive);
    for (const f of dead) {
      if (f.deathFx) continue;
      f.deathFx = true;
      for (let i = 0; i < 50; i++) {
        const a = rand(0, TAU), sp = rand(60, 420);
        this.ctx.particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: rand(0.4, 1.1), max: 1.1, r: rand(2, 6), color: f.def.color });
      }
    }
    this.over = true;
    this.ctx.over = true;
  }

  handleHuman(f, dt, awake) {
    const inp = f.controller.input;
    const { keys, mouse, pad } = inp;
    const cam = this.cameras.main;
    mouse.wx = cam.scrollX + mouse.sx / cam.zoom;
    mouse.wy = cam.scrollY + mouse.sy / cam.zoom;
    const baseAim = getTargetAimPoint(this.ctx.fighters, f, inp);
    f.facing = angTo(f, baseAim);
    if (!awake) return;

    if ((keys.Space || (pad.connected && pad.dodge)) && !f.dash && !f.dodgeCd) {
      startDash(f, f.facing, 950, 0.16, 0, { stopOnHit: false, color: f.def.accent });
      f.dodgeCd = 1.6;
    }
    if (f.dodgeCd) f.dodgeCd = Math.max(0, f.dodgeCd - dt);

    if (inp.useMouse && mouse.down) castBasic(this.ctx, f, mouse.wx, mouse.wy);

    if (inp.useKeyboard) {
      const codes = ['Digit1', 'Digit2', 'Digit3'];
      codes.forEach((code, i) => {
        if (keys[code]) {
          const a = f.def.abilities[i];
          const pt = getAimPointFor(this.ctx.fighters, f, a.aimMode, inp);
          castAbility(this.ctx, f, i, pt.x, pt.y);
        }
      });
    }

    // Mando estilo Brawl (R2 básico, R1/L1/L2 habs): tap = auto-apuntado,
    // mantener = guía con stick derecho, soltar = disparar. Self se dispara
    // al presionar (no tiene a dónde apuntar).
    if (pad.connected) {
      let aiming = false;
      for (let i = 0; i <= f.def.abilities.length; i++) {
        const slot = inp.shots[i];
        const isBasic = i === 0;
        const aimMode = isBasic ? 'target' : f.def.abilities[i - 1].aimMode;
        const fire = (pt) => {
          if (isBasic) castBasic(this.ctx, f, pt.x, pt.y);
          else castAbility(this.ctx, f, i - 1, pt.x, pt.y);
        };
        if (slot.tap) {
          slot.tap = false;
          fire(getAimPointFor(this.ctx.fighters, f, aimMode, inp));
        } else if (slot.down && slot.t >= inp.TAP && aimMode !== 'self') {
          aiming = true;
          let ang = f.facing;
          if (pad.aimAngle !== null) { ang = pad.aimAngle; f.facing = ang; }
          const rawR = isBasic ? (f.def.basic.range || 300) : (f.def.abilities[i - 1].range || 300);
          f.aiming = { idx: i, ang, range: Math.min(rawR, 900) };
        } else if (slot.aimFire) {
          slot.aimFire = false;
          if (pad.aimAngle !== null) {
            fire({ x: f.x + Math.cos(pad.aimAngle) * 450, y: f.y + Math.sin(pad.aimAngle) * 450 });
          } else {
            fire(getAimPointFor(this.ctx.fighters, f, aimMode, inp));
          }
          f.aiming = null;
        }
      }
      if (!aiming) f.aiming = null;
    } else {
      f.aiming = null;
    }
  }

  updateCamera(dt) {
    const cam = this.cameras.main;
    const VW = this.scale.width, VH = this.scale.height;
    const locals = this.ctx.fighters.filter((f) => f.alive && f.controller.kind === 'local');
    const focus = locals.length ? locals : this.ctx.fighters.filter((f) => f.alive);
    if (!focus.length) return;

    let tx, ty, tz;
    if (focus.length === 1) {
      tx = focus[0].x; ty = focus[0].y; tz = 1;
    } else {
      tx = (focus[0].x + focus[1].x) / 2;
      ty = (focus[0].y + focus[1].y) / 2;
      const dx = Math.abs(focus[0].x - focus[1].x) + 520;
      const dy = Math.abs(focus[0].y - focus[1].y) + 460;
      tz = clamp(Math.min(VW / dx, VH / dy), 0.32, 1);
    }
    const k = 1 - Math.pow(0.001, dt);
    this.camX = lerp(this.camX, tx, k);
    this.camY = lerp(this.camY, ty, k);
    cam.setZoom(lerp(cam.zoom, tz, k));
    cam.centerOn(this.camX, this.camY);
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.time_s += dt;
    // Slots en caliente: si se conecta un 2do mando, se reasigna solo.
    const slots = resolveSlots(this.mode);
    this.p1input.padSlot = slots.p1;
    if (this.p2input) this.p2input.padSlot = slots.p2;
    this.p1input.poll(dt);
    this.p2input?.poll(dt);

    if (!this.over) {
      const awake = this.time.now - this.born > 300;
      for (const f of this.ctx.fighters) {
        if (f.controller.kind === 'local' && f.alive) this.handleHuman(f, dt, awake);
      }
    }

    stepSimulation(this.ctx, dt);
    this.updateCamera(dt);
    this.renderer.render(this.ctx, this.time_s, this.player);
  }
}
