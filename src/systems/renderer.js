// Render del mundo en 2.5D: sprites frontales + y-sort, como Gungeon/NT.
// La cámara sigue cenital; la "perspectiva" la dan fichas verticales,
// sombras blob, pilares con volumen y orden por Y. La sim no se entera.
import Phaser from 'phaser';
import { WORLD } from '../data/types.js';
import { RIVER, SAND_H } from './terrain.js';
import { getLocks } from './aim.js';
import { clamp, TAU } from '../utils/math.js';
import { css } from '../utils/color.js';

export class WorldRenderer {
  constructor(scene) {
    this.scene = scene;
    if (!scene.textures.exists('mk-blob')) {
      const mk = scene.add.graphics();
      mk.fillStyle(0xffffff, 1).fillEllipse(32, 16, 64, 32);
      mk.generateTexture('mk-blob', 64, 32);
      mk.destroy();
    }
    this.gfxGround = scene.add.graphics().setDepth(1);
    this.gfxTop = scene.add.graphics().setDepth(2000);
    if (scene.textures.exists('grass')) {
      scene.add.tileSprite(0, 0, WORLD.w, WORLD.h, 'grass').setOrigin(0, 0).setDepth(0);
    }
    if (scene.textures.exists('water')) {
      scene.add.tileSprite(0, RIVER.y0, WORLD.w, RIVER.y1 - RIVER.y0, 'water').setOrigin(0, 0).setDepth(0);
    }
    if (scene.textures.exists('sand')) {
      scene.add.tileSprite(0, RIVER.y0 - SAND_H, WORLD.w, SAND_H, 'sand').setOrigin(0, 0).setDepth(0);
      scene.add.tileSprite(0, RIVER.y1, WORLD.w, SAND_H, 'sand').setOrigin(0, 0).setDepth(0);
    }
    this.floatTexts = [];
    this.fighterViews = new Map();
    this.pillarViews = [];
  }

  syncPillars(pillars) {
    for (const p of pillars) {
      const h = p.r * 1.1;
      const side = this.scene.add.image(p.x, p.y - h / 2, '__WHITE')
        .setDisplaySize(p.r * 2, h).setTint(0x1a2432).setDepth(p.y);
      const top = this.scene.add.image(p.x, p.y, 'mk-blob')
        .setDisplaySize(p.r * 2.3, p.r * 1.5).setTint(0x2a3a52).setDepth(p.y + 1);
      const cap = this.scene.add.image(p.x, p.y - 3, 'mk-blob')
        .setDisplaySize(p.r * 1.7, p.r * 1.05).setTint(0x46586e).setDepth(p.y + 2);
      this.pillarViews.push([side, top, cap]);
    }
  }

  syncFighters(fighters) {
    for (const f of fighters) {
      const shadow = this.scene.add.image(f.x, f.y, 'mk-blob')
        .setDisplaySize(f.radius * 2.2, f.radius * 1.1).setTint(0x000000).setAlpha(0.35);
      const H = f.radius * 3.4;
      let body;
      if (f.def.portrait) {
        const [cx, cy, cw, ch] = f.def.portrait.crop;
        body = this.scene.add.image(f.x, f.y, f.def.portrait.key).setCrop(cx, cy, cw, ch);
        body.setDisplaySize(H * (cw / ch), H);
      } else {
        body = this.scene.add.image(f.x, f.y, '__WHITE')
          .setDisplaySize(f.radius * 2, f.radius * 2).setTint(css(f.def.color));
      }
      const name = this.scene.add.text(f.x, f.y, f.name.toUpperCase(),
        { fontSize: '11px', color: f.team === 0 ? '#9fd0ff' : '#ffb3c1', fontStyle: '800' }).setOrigin(0.5);
      this.fighterViews.set(f, { shadow, body, name, H });
    }
  }

  render(ctx, time) {
    const g = this.gfxGround;
    g.clear();
    g.lineStyle(4, 0x4a7fb5, 0.25);
    g.strokeCircle(WORLD.w / 2, WORLD.h / 2, 260);
    g.strokeCircle(WORLD.w / 2, WORLD.h / 2, 90);
    g.lineStyle(8, 0x2f4a68, 1).strokeRect(4, 4, WORLD.w - 8, WORLD.h - 8);
    g.lineStyle(3, 0xffffff, 0.45);
    g.lineBetween(0, RIVER.y0 + 2, WORLD.w, RIVER.y0 + 2);
    g.lineBetween(0, RIVER.y1 - 2, WORLD.w, RIVER.y1 - 2);

    for (const z of ctx.zones) {
      const col = css(z.color);
      if (!z.fired) {
        g.fillStyle(col, 0.2 + 0.15 * Math.sin(time * 22)).fillCircle(z.x, z.y, z.r);
        g.lineStyle(3, col, 0.9).strokeCircle(z.x, z.y, z.r);
      } else if (z.aura && z.aura.rem > 0) {
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

    const t = this.gfxTop;
    t.clear();
    for (const f of ctx.fighters) {
      const v = this.fighterViews.get(f);
      if (!v) continue;
      if (!f.alive) {
        v.shadow.setVisible(false); v.body.setVisible(false); v.name.setVisible(false);
        continue;
      }
      const invis = f.status.invis > 0;
      v.shadow.setVisible(true).setPosition(f.x, f.y + f.radius * 0.75).setDepth(f.y - 1);
      v.body.setVisible(true);
      v.body.setPosition(f.x, f.y - v.H / 2 + 10).setDepth(f.y);
      v.body.setFlipX(Math.cos(f.facing) < 0);
      v.body.setAlpha(invis ? 0.25 : 1);
      if (f.hitFlash > 0) v.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else v.body.clearTint();
      v.name.setPosition(f.x, f.y - v.H - 8).setDepth(f.y + 60);

      const aura = f.team === 0 ? 0x3fa9ff : 0xff4d6d;
      t.lineStyle(3, aura, 0.6);
      t.strokeEllipse(f.x, f.y + f.radius * 0.85, f.radius * 2.1, f.radius * 0.9);
      if (f.status.shield > 0) {
        t.lineStyle(3.5, 0x9fe8ff, 0.85);
        t.strokeCircle(f.x, f.y - v.H / 2, v.H / 2 + 8);
      }
      if (f.status.stun > 0) {
        t.fillStyle(0xffd93d, 1);
        for (let i = 0; i < 3; i++) {
          const a = time * 7 + (i * TAU) / 3;
          t.fillCircle(f.x + Math.cos(a) * 22, f.y - v.H - 2 + Math.sin(a) * 5, 3.5);
        }
      }
      if (f.status.root > 0) {
        t.lineStyle(4, 0x8b5a2b, 1);
        t.strokeEllipse(f.x, f.y + f.radius * 0.8, f.radius * 1.8, f.radius * 0.8);
      }
      const bw = f.radius * 2.6, bh = 7;
      const bx = f.x - bw / 2, by = f.y - v.H - 30;
      t.fillStyle(0x000000, 0.8).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      t.fillStyle(0x2a3546, 1).fillRect(bx, by, bw, bh);
      t.fillStyle(f.team === 0 ? 0x4ade80 : 0xff5c72, 1).fillRect(bx, by, bw * clamp(f.hp / f.maxHp, 0, 1), bh);
      if (f.status.shield > 0) {
        t.fillStyle(0x9fe8ff, 1).fillRect(bx, by, bw * Math.min(1, f.status.shield / f.maxHp), bh);
      }
    }

    for (const lock of getLocks()) {
      if (lock.mode !== 'auto' || !lock.target?.alive || !lock.fighter?.alive) continue;
      const tg = lock.target;
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      const r = tg.radius + 16 + pulse * 4;
      t.lineStyle(2.5, 0xffd93d, 0.9).strokeCircle(tg.x, tg.y, r);
      t.lineStyle(1.5, 0xffd93d, 0.25).lineBetween(lock.fighter.x, lock.fighter.y, tg.x, tg.y);
    }
    for (const f of ctx.fighters) {
      if (!f.alive || !f.aiming) continue;
      const a = f.aiming.ang, R = f.aiming.range || 300;
      const ex = f.x + Math.cos(a) * R, ey = f.y + Math.sin(a) * R;
      t.lineStyle(3, 0xffd93d, 0.45).lineBetween(f.x, f.y, ex, ey);
      t.fillStyle(0xffd93d, 0.6).fillCircle(ex, ey, 6);
    }
    for (const pr of ctx.projectiles) {
      const col = css(pr.color);
      for (let i = 0; i < pr.trail.length; i++) {
        const tr = pr.trail[i];
        t.fillStyle(col, (i / pr.trail.length) * 0.5).fillCircle(tr.x, tr.y, pr.r * (i / pr.trail.length) * 0.9);
      }
      t.fillStyle(col, 1).fillCircle(pr.x, pr.y, pr.r);
      t.fillStyle(0xffffff, 1).fillCircle(pr.x, pr.y, pr.r * 0.45);
    }
    for (const pt of ctx.particles) {
      const a = Math.max(0, Math.min(1, pt.t / pt.max));
      if (pt.ring) { t.lineStyle(Math.max(1, 6 * a), css(pt.color), a * 0.85); t.strokeCircle(pt.x, pt.y, pt.r * (1.25 - a * 0.35)); }
      else if (pt.arc) { t.lineStyle(14, css(pt.color), a * 0.75); t.beginPath().arc(pt.x, pt.y, pt.r, pt.ang - pt.arcWidth / 2, pt.ang + pt.arcWidth / 2).strokePath(); }
      else if (pt.beam) {
        t.lineStyle(Math.max(1, pt.width * a), css(pt.color), a);
        t.lineBetween(pt.x, pt.y, pt.x + Math.cos(pt.ang) * pt.len, pt.y + Math.sin(pt.ang) * pt.len);
        t.lineStyle(Math.max(1, pt.width * 0.4 * a), 0xffffff, a);
        t.lineBetween(pt.x, pt.y, pt.x + Math.cos(pt.ang) * pt.len, pt.y + Math.sin(pt.ang) * pt.len);
      }
      else { t.fillStyle(css(pt.color), a).fillCircle(pt.x, pt.y, Math.max(0.5, pt.r * a)); }
    }
    while (this.floatTexts.length < ctx.floaters.length) {
      const ft = this.scene.add.text(0, 0, '', { fontSize: '18px', fontStyle: '800', color: '#fff' }).setOrigin(0.5).setDepth(2001);
      this.floatTexts.push(ft);
    }
    this.floatTexts.forEach((ft, i) => {
      const fl = ctx.floaters[i];
      if (!fl) { ft.setVisible(false); return; }
      ft.setVisible(true).setPosition(fl.x, fl.y).setText(String(fl.text)).setColor(fl.color).setFontSize(fl.size).setAlpha(Math.min(1, fl.t / (fl.max * 0.6)));
    });
  }
}
