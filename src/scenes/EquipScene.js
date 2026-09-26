// Pantalla de equipar: elegí 3 habilidades del catálogo para tu pokémon.
// Default = kit de clase (confirmar sin tocar respeta el original).
// En PvP equipan por turnos: primero P1, después P2.
import Phaser from 'phaser';
import { CLASSES } from '../data/classes.js';
import { ABILITIES, canLearn } from '../data/abilities.js';
import { PadNav } from '../systems/input.js';
import { css } from '../utils/color.js';

const IDS = Object.keys(ABILITIES);
const COLS = 6;
const ROWS = Math.ceil(IDS.length / COLS);
const CONFIRM = IDS.length; // índice de la celda-confirmar
// El orden de elección = botón: 1° X, 2° B, 3° Y (1/2/3 en teclado).
const SLOT_LABELS = ['X/1', 'B/2', 'Y/3'];

export class EquipScene extends Phaser.Scene {
  constructor() { super('Equip'); }

  init(data) {
    this.mode = data.mode || 'pve';
    this.p1Cls = data.p1Cls;
    this.p2Cls = data.p2Cls;
    this.phase = data.phase || 0; // 0 = P1, 1 = P2 (solo pvp)
    this.p1Kit = data.p1Kit || null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#05070c');
    this.pvp = this.mode === 'pvp';
    this.born = this.time.now;
    this.awake = false;
    this.gone = false;

    this.clsKey = this.phase === 0 ? this.p1Cls : this.p2Cls;
    this.cls = CLASSES[this.clsKey];
    this.color = this.phase === 0 ? '#3fa9ff' : '#ff4d6d';
    this.who = this.pvp ? (this.phase === 0 ? 'P1' : 'P2') : 'P1';
    // Default: kit de clase.
    const defKit = this.cls.abilities.map((a) => a.id).filter((id) => ABILITIES[id]);
    this.picked = defKit.length === 3 ? defKit : IDS.slice(0, 3);

    this.focus = 0;
    this.navA = new PadNav(0);
    this.navB = new PadNav(1);

    this.add.text(width / 2, 44, `${this.who}: EQUIPÁ A ${this.cls.name.toUpperCase()} (elegí 3)`,
      { fontSize: '26px', fontStyle: '800', color: this.color }).setOrigin(0.5);
    this.counter = this.add.text(width / 2, 76, '', { fontSize: '15px', color: '#9fb3c8' }).setOrigin(0.5);

    // Grilla 4x4 de habilidades.
    this.cellW = Math.min(230, (width - 80) / COLS - 14);
    this.cellH = 86;
    this.gx = width / 2 - (this.cellW * COLS + 14 * (COLS - 1)) / 2;
    this.gy = 110;
    this.cardTexts = [];
    IDS.forEach((id, i) => {
      const a = ABILITIES[id];
      const cx = this.gx + (i % COLS) * (this.cellW + 14);
      const cy = this.gy + Math.floor(i / COLS) * (this.cellH + 12);
      const bg = this.add.graphics();
      const icon = this.add.text(cx + 30, cy + this.cellH / 2, a.icon, { fontSize: '30px' }).setOrigin(0.5);
      const nm = this.add.text(cx + 56, cy + 22, a.name, { fontSize: '13px', fontStyle: '700', color: '#dbe9f7' }).setOrigin(0, 0.5);
      const sub = this.add.text(cx + 56, cy + 46, `CD${a.cd} · ◈${a.cost} · PP${a.pp} · ${a.types ? a.types.join('/') : 'todos'}`, { fontSize: '11px', color: '#7b8ea3' }).setOrigin(0, 0.5);
      const desc = this.add.text(cx + 56, cy + 64, a.desc, { fontSize: '10px', color: '#5d7d9e', wordWrap: { width: this.cellW - 66 } }).setOrigin(0, 0.5);
      const hit = this.add.rectangle(cx + this.cellW / 2, cy + this.cellH / 2, this.cellW, this.cellH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { this.focus = i; });
      hit.on('pointerdown', () => { if (this.awake) this.toggle(i); });
      this.cardTexts.push({ bg, icon, nm, sub, desc });
    });

    // Botón confirmar.
    this.btnY = this.gy + 4 * (this.cellH + 12) + 30;
    this.btnBg = this.add.graphics();
    this.btnTxt = this.add.text(width / 2, this.btnY, '¡A PELEAR! →', { fontSize: '22px', fontStyle: '800', color: '#fff' }).setOrigin(0.5);
    const bhit = this.add.rectangle(width / 2, this.btnY, 320, 52, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    bhit.on('pointerover', () => { this.focus = CONFIRM; });
    bhit.on('pointerdown', () => { if (this.awake) this.confirm(); });

    this.hint = this.add.text(width / 2, height - 24,
      'Dpad/flechas mover · A/Enter/click elige en orden (1°X 2°B 3°Y) · C confirmar · ESC volver',
      { fontSize: '13px', color: '#4f6478' }).setOrigin(0.5);

    const kb = this.input.keyboard;
    this.kLeft = kb ? kb.addKey('LEFT') : null;
    this.kRight = kb ? kb.addKey('RIGHT') : null;
    this.kUp = kb ? kb.addKey('UP') : null;
    this.kDown = kb ? kb.addKey('DOWN') : null;
    this.kOk = kb ? kb.addKey('ENTER') : null;
    this.kOk2 = kb ? kb.addKey('SPACE') : null;
    this.kGo = kb ? kb.addKey('C') : null;
    this.kBack = kb ? kb.addKey('ESC') : null;
  }

  toggle(i) {
    const id = IDS[i];
    const at = this.picked.indexOf(id);
    if (at >= 0) { this.picked.splice(at, 1); return; }
    if (!canLearn(this.cls.type, ABILITIES[id])) {
      this.deny = { text: `🔒 ${ABILITIES[id].name} no es compatible con tipo ${this.cls.type}`, until: this.time.now + 1400 };
      return;
    }
    if (this.picked.length < 3) this.picked.push(id);
  }

  confirm() {
    if (this.gone || this.picked.length !== 3) return;
    this.gone = true;
    if (this.pvp && this.phase === 0) {
      this.scene.start('Equip', { mode: this.mode, p1Cls: this.p1Cls, p2Cls: this.p2Cls, phase: 1, p1Kit: [...this.picked] });
    } else {
      const botKit = CLASSES[this.p2Cls].abilities.map((a) => a.id);
      this.scene.start('Versus', {
        mode: this.mode, p1Cls: this.p1Cls, p2Cls: this.p2Cls,
        p1Kit: this.pvp ? this.p1Kit : [...this.picked],
        p2Kit: this.pvp ? [...this.picked] : botKit,
      });
    }
  }

  move(dRow, dCol) {
    if (this.focus === CONFIRM) {
      if (dRow < 0) this.focus = (ROWS - 1) * COLS + 2;
      return;
    }
    let r = Math.floor(this.focus / COLS), c = this.focus % COLS;
    r += dRow; c += dCol;
    if (r > ROWS - 1) { this.focus = CONFIRM; return; }
    if (r < 0) return;
    c = Math.max(0, Math.min(COLS - 1, c));
    this.focus = r * COLS + c;
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.awake = this.time.now - this.born > 400;
    const a = this.awake ? this.navA.poll(dt) : this.navA.idle();
    const b = this.awake ? this.navB.poll(dt) : this.navB.idle();
    const nav = {
      left: a.left || b.left, right: a.right || b.right,
      up: a.up || b.up, down: a.down || b.down,
      confirm: a.confirm || b.confirm, back: a.back || b.back,
    };

    if (this.awake) {
      if (nav.left) this.move(0, -1);
      if (nav.right) this.move(0, 1);
      if (nav.up) this.move(-1, 0);
      if (nav.down) this.move(1, 0);
      if (this.kLeft && Phaser.Input.Keyboard.JustDown(this.kLeft)) this.move(0, -1);
      if (this.kRight && Phaser.Input.Keyboard.JustDown(this.kRight)) this.move(0, 1);
      if (this.kUp && Phaser.Input.Keyboard.JustDown(this.kUp)) this.move(-1, 0);
      if (this.kDown && Phaser.Input.Keyboard.JustDown(this.kDown)) this.move(1, 0);
      if (nav.confirm) {
        if (this.focus === CONFIRM) this.confirm();
        else this.toggle(this.focus);
      }
      if ((this.kOk && Phaser.Input.Keyboard.JustDown(this.kOk)) ||
          (this.kOk2 && Phaser.Input.Keyboard.JustDown(this.kOk2))) {
        if (this.focus === CONFIRM) this.confirm();
        else this.toggle(this.focus);
      }
      if (this.kGo && Phaser.Input.Keyboard.JustDown(this.kGo)) this.confirm();
      if (nav.back || (this.kBack && Phaser.Input.Keyboard.JustDown(this.kBack))) {
        if (!this.gone) { this.gone = true; this.scene.start('Select', { mode: this.mode }); }
      }
    }

    // Dibujar grilla.
    const full = this.picked.length === 3;
    const chips = this.picked.map((id, i) => `[${SLOT_LABELS[i]}]${ABILITIES[id].name}`).join('  ');
    if (this.deny && this.time.now < this.deny.until) {
      this.counter.setText(this.deny.text).setColor('#ff8fa3');
    } else {
      this.counter.setText(`${this.who} · ${this.picked.length}/3${full ? ' ✓' : ''}   ${chips}`).setColor(full ? '#4ade80' : '#9fb3c8');
    }
    IDS.forEach((id, i) => {
      const t = this.cardTexts[i];
      const a = ABILITIES[id];
      const cx = this.gx + (i % COLS) * (this.cellW + 14);
      const cy = this.gy + Math.floor(i / COLS) * (this.cellH + 12);
      const sel = this.picked.includes(id);
      const foc = this.focus === i;
      const ok = canLearn(this.cls.type, a);
      t.bg.clear();
      t.bg.fillStyle(sel ? 0x14283f : 0x0d1420, ok ? 1 : 0.45).fillRoundedRect(cx, cy, this.cellW, this.cellH, 10);
      t.bg.lineStyle(foc ? 3 : 2, css(!ok ? '#3a3f4a' : sel ? this.color : foc ? '#5fa8ff' : '#22303f'), 1)
        .strokeRoundedRect(cx, cy, this.cellW, this.cellH, 10);
      t.nm.setText(`${ok ? '' : '🔒 '}${a.name}`).setColor(sel ? this.color : '#dbe9f7').setAlpha(ok ? 1 : 0.45);
      t.icon.setAlpha(ok ? 1 : 0.35);
      t.sub.setAlpha(ok ? 1 : 0.45);
      t.desc.setAlpha(ok ? 1 : 0.45);
    });
    const { width } = this.scale;
    this.btnBg.clear();
    this.btnBg.fillStyle(full ? 0x1b3355 : 0x0d1420, 1).fillRoundedRect(width / 2 - 160, this.btnY - 26, 320, 52, 12);
    this.btnBg.lineStyle(2, full ? 0x5fa8ff : 0x22303f, 1).strokeRoundedRect(width / 2 - 160, this.btnY - 26, 320, 52, 12);
    this.btnTxt.setColor(full ? '#ffffff' : '#4f6478');
  }
}
