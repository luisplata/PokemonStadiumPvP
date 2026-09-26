// Render del mundo: dibuja el ESTADO, no lo cambia. Si un día querés
// cambiar canvas por sprites, shaders o lo que sea, se toca solo acá.
import { WORLD } from '../data/types.js';
import { getLocks } from './aim.js';
import { clamp, TAU } from '../utils/math.js';
import { css } from '../utils/color.js';

export class WorldRenderer {
  constructor(scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics().setDepth(10);
    this.floatTexts = [];
    this.fighterTexts = new Map();
  }

  syncFighters(fighters) {
    for (const f of fighters) {
      const emoji = this.scene.add.text(f.x, f.y, f.def.icon, { fontSize: `${Math.round(f.radius)}px` }).setOrigin(0.5).setDepth(12);
      const name = this.scene.add.text(f.x, f.y - f.radius - 30, f.name.toUpperCase(),
        { fontSize: '11px', color: f.team === 0 ? '#9fd0ff' : '#ffb3c1', fontStyle: '800' }).setOrigin(0.5).setDepth(12);
      this.fighterTexts.set(f, { emoji, name });
    }
  }

  render(ctx, time, player) {
    const g = this.gfx;
    g.clear();
    // arena
    g.fillStyle(0x141d2b, 1).fillRect(0, 0, WORLD.w, WORLD.h);
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = 0; x <= WORLD.w; x += 100) g.lineBetween(x, 0, x, WORLD.h);
    for (let y = 0; y <= WORLD.h; y += 100) g.lineBetween(0, y, WORLD.w, y);
    g.lineStyle(4, 0x4a7fb5, 0.25);
    g.strokeCircle(WORLD.w / 2, WORLD.h / 2, 260);
    g.strokeCircle(WORLD.w / 2, WORLD.h / 2, 90);
    g.lineStyle(8, 0x2f4a68, 1).strokeRect(4, 4, WORLD.w - 8, WORLD.h - 8);

    for (const pl of ctx.pillars) {
      g.fillStyle(0x1a2432, 1).fillCircle(pl.x, pl.y, pl.r);
      g.lineStyle(3, 0x4d6480, 1).strokeCircle(pl.x, pl.y, pl.r);
    }
    for (const z of ctx.zones) {
      const col = css(z.color);
      if (!z.fired) {
        g.fillStyle(col, 0.2 + 0.15 * Math.sin(time * 22)).fillCircle(z.x, z.y, z.r);
        g.lineStyle(3, col, 0.9).strokeCircle(z.x, z.y, z.r);
      } else if (z.aura && z.aura.rem > 0) {
        // Aura persistente: relleno tenue pulsante mientras dura.
        g.fillStyle(col, 0.16 + 0.08 * Math.sin(time * 10)).fillCircle(z.x, z.y, z.r);
        g.lineStyle(3, col, 0.75).strokeCircle(z.x, z.y, z.r);
      } else {
        const a = Math.max(0, 1 - z.fade / 0.4);
        g.fillStyle(col, a * 0.5).fillCircle(z.x, z.y, z.r * (1 + z.fade * 1.4));
      }
    }
    for (const t of ctx.traps || []) {
      const armed = t.t >= t.armT;
      const pulse = 0.5 + 0.5 * Math.sin(time * (armed ? 8 : 3));
      g.fillStyle(css(t.color), armed ? 0.5 + 0.3 * pulse : 0.25).fillCircle(t.x, t.y, armed ? 9 : 6);
      g.lineStyle(2, css(t.color), armed ? 0.8 : 0.4).strokeCircle(t.x, t.y, t.r * (0.5 + 0.1 * pulse));
    }
    for (const pt of ctx.particles) {
      const a = Math.max(0, Math.min(1, pt.t / pt.max));
      if (pt.ring) { g.lineStyle(Math.max(1, 6 * a), css(pt.color), a * 0.85); g.strokeCircle(pt.x, pt.y, pt.r * (1.25 - a * 0.35)); }
      else if (pt.arc) { g.lineStyle(14, css(pt.color), a * 0.75); g.beginPath().arc(pt.x, pt.y, pt.r, pt.ang - pt.arcWidth / 2, pt.ang + pt.arcWidth / 2).strokePath(); }
      else if (pt.beam) {
        g.lineStyle(Math.max(1, pt.width * a), css(pt.color), a);
        g.lineBetween(pt.x, pt.y, pt.x + Math.cos(pt.ang) * pt.len, pt.y + Math.sin(pt.ang) * pt.len);
        g.lineStyle(Math.max(1, pt.width * 0.4 * a), 0xffffff, a);
        g.lineBetween(pt.x, pt.y, pt.x + Math.cos(pt.ang) * pt.len, pt.y + Math.sin(pt.ang) * pt.len);
      }
      else { g.fillStyle(css(pt.color), a).fillCircle(pt.x, pt.y, Math.max(0.5, pt.r * a)); }
    }
    // lock-on: un retículo por jugador humano en modo auto
    for (const lock of getLocks()) {
      if (lock.mode !== 'auto' || !lock.target?.alive || !lock.fighter?.alive) continue;
      const t = lock.target;
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      const r = t.radius + 16 + pulse * 4;
      g.lineStyle(2.5, 0xffd93d, 0.9).strokeCircle(t.x, t.y, r);
      g.lineStyle(1.5, 0xffd93d, 0.25).lineBetween(lock.fighter.x, lock.fighter.y, t.x, t.y);
    }
    for (const pr of ctx.projectiles) {
      const col = css(pr.color);
      for (let i = 0; i < pr.trail.length; i++) {
        const t = pr.trail[i];
        g.fillStyle(col, (i / pr.trail.length) * 0.5).fillCircle(t.x, t.y, pr.r * (i / pr.trail.length) * 0.9);
      }
      g.fillStyle(col, 1).fillCircle(pr.x, pr.y, pr.r);
      g.fillStyle(0xffffff, 1).fillCircle(pr.x, pr.y, pr.r * 0.45);
    }
    for (const f of ctx.fighters) {
      if (!f.alive) continue;
      const v = this.fighterTexts.get(f);
      // Versus local: pantalla compartida, el invis se ve fantasma para todos.
      const invis = f.status.invis > 0;
      const aura = f.team === 0 ? 0x3fa9ff : 0xff4d6d;
      g.lineStyle(3, aura, 0.6).strokeCircle(f.x, f.y + f.radius * 0.85, f.radius * 1.05);
      const body = f.hitFlash > 0 ? 0xffffff : css(f.def.color);
      g.fillStyle(body, invis ? 0.25 : 1).fillCircle(f.x, f.y, f.radius);
      g.lineStyle(3, 0x0a0f18, 1).strokeCircle(f.x, f.y, f.radius);
      const fx = Math.cos(f.facing), fy = Math.sin(f.facing);
      g.fillStyle(0x0a0f18, 1).fillCircle(f.x + fx * f.radius * 0.55, f.y + fy * f.radius * 0.55, f.radius * 0.3);
      if (f.status.shield > 0) { g.lineStyle(3.5, 0x9fe8ff, 0.85).strokeCircle(f.x, f.y, f.radius + 8); }
      if (f.status.stun > 0) { g.fillStyle(0xffd93d, 1); for (let i = 0; i < 3; i++) { const a = time * 7 + (i * TAU) / 3; g.fillCircle(f.x + Math.cos(a) * 22, f.y - f.radius - 14 + Math.sin(a) * 5, 3.5); } }
      v.emoji.setPosition(f.x, f.y).setAlpha(invis ? 0.25 : 1);
      v.name.setPosition(f.x, f.y - f.radius - 30);
      // hp mini bar
      const bw = f.radius * 2.6, bh = 7;
      g.fillStyle(0x000000, 0.8).fillRect(f.x - bw / 2 - 2, f.y - f.radius - 28, bw + 4, bh + 4);
      g.fillStyle(0x2a3546, 1).fillRect(f.x - bw / 2, f.y - f.radius - 26, bw, bh);
      g.fillStyle(f.team === 0 ? 0x4ade80 : 0xff5c72, 1).fillRect(f.x - bw / 2, f.y - f.radius - 26, bw * clamp(f.hp / f.maxHp, 0, 1), bh);
    }
    // floaters
    while (this.floatTexts.length < ctx.floaters.length) {
      const t = this.scene.add.text(0, 0, '', { fontSize: '18px', fontStyle: '800', color: '#fff' }).setOrigin(0.5).setDepth(50);
      this.floatTexts.push(t);
    }
    this.floatTexts.forEach((t, i) => {
      const fl = ctx.floaters[i];
      if (!fl) { t.setVisible(false); return; }
      t.setVisible(true).setPosition(fl.x, fl.y).setText(String(fl.text)).setColor(fl.color).setFontSize(fl.size).setAlpha(Math.min(1, fl.t / (fl.max * 0.6)));
    });
  }
}
