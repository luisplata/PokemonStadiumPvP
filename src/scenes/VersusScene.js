// Splash previo a la arena: muestra los dos picks con sus kits.
// Auto-arranca a los 3s; cualquier confirm/click lo skipea.
import Phaser from 'phaser';
import { CLASSES } from '../data/classes.js';
import { ABILITIES } from '../data/abilities.js';
import { PadNav } from '../systems/input.js';
import { css } from '../utils/color.js';

export class VersusScene extends Phaser.Scene {
  constructor() { super('Versus'); }

  init(data) {
    this.mode = data.mode || 'pve';
    this.p1Cls = data.p1Cls;
    this.p2Cls = data.p2Cls;
    this.p1Kit = data.p1Kit || null;
    this.p2Kit = data.p2Kit || null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#05070c');
    this.born = this.time.now;
    this.awake = false;
    this.gone = false;
    this.pvp = this.mode === 'pvp';
    this.navA = new PadNav(0);
    this.navB = new PadNav(1);

    this.add.text(width / 2, 70, this.pvp ? '⚔️ VERSUS ⚔️' : 'A LA ARENA',
      { fontSize: '44px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);

    const sides = this.pvp
      ? [{ cls: this.p1Cls, color: '#3fa9ff', tag: 'P1' }, { cls: this.p2Cls, color: '#ff4d6d', tag: 'P2' }]
      : [{ cls: this.p1Cls, color: '#3fa9ff', tag: 'VOS' }, { cls: this.p2Cls, color: '#ff4d6d', tag: 'RIVAL' }];
    const pw = Math.min(420, width / 2 - 60);
    sides.forEach((s, i) => {
      const c = CLASSES[s.cls];
      const px = width / 2 + (i === 0 ? -1 : 1) * (pw / 2 + 40) - pw / 2;
      const py = 130;
      const g = this.add.graphics();
      g.fillStyle(0x0d1420, 1).fillRoundedRect(px, py, pw, height - py - 120, 14);
      g.lineStyle(3, css(s.color), 1).strokeRoundedRect(px, py, pw, height - py - 120, 14);
      if (c.portrait && this.textures.exists(c.portrait.key)) {
        const [pcx, pcy, pcw, pch] = c.portrait.crop;
        const img = this.add.image(px + pw / 2, py + 115, c.portrait.key).setCrop(pcx, pcy, pcw, pch);
        const asp = pcw / pch;
        let dh = 190, dw = dh * asp;
        if (dw > pw - 32) { dw = pw - 32; dh = dw / asp; }
        img.setDisplaySize(dw, dh);
      } else {
        this.add.text(px + pw / 2, py + 115, c.icon, { fontSize: '72px' }).setOrigin(0.5);
      }
      this.add.text(px + pw / 2, py + 235, `${s.tag} · ${c.name}`,
        { fontSize: '20px', fontStyle: '800', color: s.color }).setOrigin(0.5);
      this.add.text(px + pw / 2, py + 259, `${c.role} · Tipo ${c.type}`,
        { fontSize: '12px', color: '#7b8ea3' }).setOrigin(0.5);
      const kitIds = (i === 0 ? this.p1Kit : this.p2Kit) || c.abilities.map((a) => a.id).filter((id) => ABILITIES[id]);
      const kit = [c.basic, ...kitIds.map((id) => ABILITIES[id]).filter(Boolean)];
      const keys = ['LMB/A', '1/X', '2/B', '3/Y'];
      kit.forEach((a, k) => {
        this.add.text(px + 24, py + 291 + k * 30, `${a.icon} [${keys[k]}] ${a.name} (PP${a.pp ?? '∞'})`,
          { fontSize: '14px', color: '#cddbe8' }).setOrigin(0, 0.5);
      });
    });

    if (this.pvp) {
      this.add.text(width / 2, height / 2, 'VS', { fontSize: '48px', fontStyle: '800', color: '#ffd93d' }).setOrigin(0.5);
    }

    this.add.text(width / 2, height - 40, 'A / Enter / click para pelear YA',
      { fontSize: '14px', color: '#4f6478' }).setOrigin(0.5);

    const kb = this.input.keyboard;
    this.kOk = kb ? kb.addKey('ENTER') : null;
    this.kOk2 = kb ? kb.addKey('SPACE') : null;
    this.input.on('pointerdown', () => { if (this.awake) this.go(); });
    this.time.delayedCall(3000, () => this.go());
  }

  go() {
    if (this.gone) return;
    this.gone = true;
    this.scene.start('Arena', { mode: this.mode, p1Cls: this.p1Cls, p2Cls: this.p2Cls, p1Kit: this.p1Kit, p2Kit: this.p2Kit });
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.awake = this.time.now - this.born > 400;
    const a = this.awake ? this.navA.poll(dt) : this.navA.idle();
    const b = this.awake ? this.navB.poll(dt) : this.navB.idle();
    if (!this.awake) return;
    if (a.confirm || b.confirm) this.go();
    if (this.kOk && Phaser.Input.Keyboard.JustDown(this.kOk)) this.go();
    if (this.kOk2 && Phaser.Input.Keyboard.JustDown(this.kOk2)) this.go();
  }
}
