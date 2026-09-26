// Pantalla 2: selección de personaje.
// PvE: P1 elige con mouse / teclado / mando.
// PvP: P1 (azul) con teclado+mouse, P2 (rojo) con mando. Lock con A/Enter/click.
import Phaser from 'phaser';
import { CLASSES } from '../data/classes.js';
import { PadNav, countPads, resolveSlots } from '../systems/input.js';
import { css } from '../utils/color.js';
import { splashBg } from '../ui/theme.js';

const P1 = { label: 'P1', color: '#3fa9ff' };
const P2 = { label: 'P2', color: '#ff4d6d' };
// Teclas combinadas teclado/mando: P1 usa LMB/1-3, P2 usa A/X/B/Y.
const SEL_KEYS = ['1/R1', '2/L1', '3/L2'];
const BASIC_KEY = 'LMB/R2';

export class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }

  init(data) { this.mode = data.mode || 'pve'; }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#05070c');
    splashBg(this);
    this.pvp = this.mode === 'pvp';
    // Gracia anti-autoselección: el Enter/A del menú no debe lockear acá.
    this.born = this.time.now;
    this.awake = false;

    this.keys = Object.keys(CLASSES);
    this.p1 = { idx: 0, locked: null };
    this.p2 = { idx: this.keys.length - 1, locked: null };
    this.started = false;

    // Cualquier mando maneja el cursor activo: primero P1, después P2.
    // Así no importa cuántos mandos haya ni en qué orden se conectaron.
    this.navA = new PadNav(0);
    this.navB = new PadNav(1);

    this.add.text(width / 2, 60, this.pvp ? 'ELIJAN SU POKÉMON' : 'ELEGÍ TU POKÉMON',
      { fontSize: '34px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    this.hint = this.add.text(width / 2, 100, '', { fontSize: '13px', color: '#7b8ea3' }).setOrigin(0.5);

    // Cards a pantalla completa: escalan con la ventana.
    const gap = Math.max(12, width * 0.015);
    const cardW = Math.min(300, (width - 40 - gap * (this.keys.length - 1)) / this.keys.length);
    const s = cardW / 200;
    const cardH = Math.round(cardW * 1.55);
    this.cardW = cardW;
    this.cardH = cardH;
    const startX = width / 2 - ((cardW + gap) * this.keys.length - gap) / 2;
    this.cardX = [];
    const topArea = 112, bottomArea = height - 224;
    const y = Math.max(topArea, topArea + Math.max(0, (bottomArea - topArea - cardH) / 2));
    this.cardY = y;
    const F = (base, min = 10) => `${Math.max(min, Math.round(base * s))}px`;
    this.keys.forEach((k, i) => {
      const c = CLASSES[k];
      const x = startX + i * (cardW + gap);
      this.cardX.push(x);
      const bg = this.add.graphics();
      bg.fillStyle(0x0d1420, 1).fillRoundedRect(x, y, cardW, this.cardH, 14);
      bg.lineStyle(2, css(c.color), 1).strokeRoundedRect(x, y, cardW, this.cardH, 14);
      // Retrato del arte propio (con recorte); fallback al emoji.
      if (c.portrait && this.textures.exists(c.portrait.key)) {
        const [pcx, pcy, pcw, pch] = c.portrait.crop;
        const img = this.add.image(x + cardW / 2, y + 75 * s, c.portrait.key).setCrop(pcx, pcy, pcw, pch);
        const asp = pcw / pch;
        let dh = 130 * s, dw = dh * asp;
        if (dw > cardW - 16) { dw = cardW - 16; dh = dw / asp; }
        img.setDisplaySize(dw, dh);
      } else {
        this.add.text(x + cardW / 2, y + 75 * s, c.icon, { fontSize: F(44) }).setOrigin(0.5);
      }
      this.add.text(x + cardW / 2, y + 150 * s, c.name, { fontSize: F(18), color: c.color, fontStyle: '800' }).setOrigin(0.5);
      this.add.text(x + cardW / 2, y + 170 * s, `${c.role} · ${c.type}`, { fontSize: F(10), color: '#7b8ea3' }).setOrigin(0.5);
      this.add.text(x + cardW / 2, y + 205 * s, `VIDA ${c.hp}\nVEL ${c.speed}\n${c.abilities.map((a) => a.icon).join(' ')}`,
        { fontSize: F(12), color: '#93a6ba', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
      c.abilities.forEach((a, j) => {
        this.add.text(x + cardW / 2, y + (240 + j * 18) * s, `${a.icon} [${SEL_KEYS[j]}] ${a.name}`,
          { fontSize: F(11), color: '#cddbe8' }).setOrigin(0.5);
      });
      const hit = this.add.rectangle(x + cardW / 2, y + this.cardH / 2, cardW, this.cardH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { if (!this.p1.locked) this.p1.idx = i; });
      hit.on('pointerdown', () => this.lockP1(i, 'CLICK'));
    });

    this.cursorGfx = this.add.graphics().setDepth(5);
    this.tagP1 = this.add.text(0, 0, 'P1', { fontSize: '18px', fontStyle: '800', color: P1.color }).setOrigin(0.5).setDepth(6);
    this.tagP2 = this.add.text(0, 0, 'P2', { fontSize: '18px', fontStyle: '800', color: P2.color }).setOrigin(0.5).setDepth(6);

    // Panel de detalle del kit del cursor (abajo).
    this.detBg = this.add.graphics();
    this.detObjs = [];
    this.detKey = '';

    const kb = this.input.keyboard;
    this.kLeft = kb ? kb.addKey('LEFT') : null;
    this.kRight = kb ? kb.addKey('RIGHT') : null;
    this.kOk = kb ? kb.addKey('ENTER') : null;
    this.kOk2 = kb ? kb.addKey('SPACE') : null;
    this.kBack = kb ? kb.addKey('ESC') : null;
  }

  lockP1(i) {
    if (!this.awake || this.p1.locked) return;
    this.p1.idx = i;
    this.p1.locked = this.keys[i];
    this.maybeStart();
  }

  lockP2(i) {
    if (!this.awake || !this.pvp || this.p2.locked) return;
    this.p2.idx = i;
    this.p2.locked = this.keys[i];
    this.maybeStart();
  }

  maybeStart() {
    if (this.started) return;
    const ready = this.pvp ? (this.p1.locked && this.p2.locked) : this.p1.locked;
    if (!ready) return;
    this.started = true;
    // En PvE el bot se sortea acá para mostrarlo en el versus.
    let botCls;
    if (!this.pvp) {
      const pool = Object.keys(CLASSES).filter((k) => k !== this.p1.locked);
      botCls = pool[Math.floor(Math.random() * pool.length)];
    }
    this.time.delayedCall(450, () => {
      this.scene.start('Versus', {
        mode: this.mode,
        p1Cls: this.p1.locked,
        p2Cls: this.pvp ? this.p2.locked : botCls,
      });
    });
  }

  refreshDetail() {
    const key = this.pvp ? `${this.p1.idx}:${this.p2.idx}` : `${this.p1.idx}`;
    if (key === this.detKey) return;
    this.detKey = key;
    for (const o of this.detObjs) o.destroy();
    this.detObjs = [];
    this.detBg.clear();
    const { width, height } = this.scale;
    const kits = this.pvp
      ? [{ cls: this.keys[this.p1.idx], color: P1.color, tag: 'P1' },
         { cls: this.keys[this.p2.idx], color: P2.color, tag: 'P2' }]
      : [{ cls: this.keys[this.p1.idx], color: P1.color, tag: '' }];
    const pw = Math.min(560, (width - 60) / kits.length);
    const ds = Math.max(0.95, Math.min(1.35, width / 1400));
    const T = (v) => `${Math.round(v * ds)}px`;
    const rowH = Math.round(32 * ds), panelH = 52 + rowH * 5;
    const y0 = height - panelH - 22;
    if (y0 < this.cardY + this.cardH + 12) return;
    kits.forEach((k, pi) => {
      const c = CLASSES[k.cls];
      const px = width / 2 + (pi - (kits.length - 1) / 2) * (pw + 20) - pw / 2;
      this.detBg.fillStyle(0x0d1420, 0.92).fillRoundedRect(px, y0, pw, panelH, 10);
      this.detBg.lineStyle(2, css(k.color), 1).strokeRoundedRect(px, y0, pw, panelH, 10);
      this.detObjs.push(this.add.text(px + 14, y0 + 20, `${k.tag ? k.tag + ' · ' : ''}${c.icon} ${c.name}`,
        { fontSize: T(17), fontStyle: '800', color: k.color }).setOrigin(0, 0.5));
      const rows = [
        { icon: c.basic.icon, key: BASIC_KEY, name: c.basic.name, cd: c.basic.cd, cost: 0, pp: c.basic.pp, desc: 'Ataque básico' },
        ...c.abilities.map((a, k) => ({ icon: a.icon, key: SEL_KEYS[k], name: a.name, cd: a.cd, cost: a.cost, pp: a.pp, desc: a.desc })),
      ];
      rows.forEach((r, i) => {
        this.detObjs.push(this.add.text(px + 14, y0 + 48 + i * rowH,
          `${r.icon} [${r.key}] ${r.name} (CD${r.cd} · ◈${r.cost} · PP${r.pp ?? '∞'}): ${r.desc}`,
          { fontSize: T(13), color: '#aebfd2', wordWrap: { width: pw - 28 } }).setOrigin(0, 0));
      });
    });
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const n = this.keys.length;
    this.awake = this.time.now - this.born > 400;
    const back1 = this.awake && this.kBack && Phaser.Input.Keyboard.JustDown(this.kBack);

    // --- Mandos: cada jugador maneja SU cursor al mismo tiempo ---
    // P1: teclado/mouse + mando 1 (si hay 2). P2: su mando. Igual que en la arena.
    const slots = resolveSlots(this.mode);
    this.navA.slot = slots.p1;
    this.navB.slot = slots.p2;
    const nav1 = this.awake ? this.navA.poll(dt) : this.navA.idle();
    const nav2 = this.awake ? this.navB.poll(dt) : this.navB.idle();

    // --- P1 ---
    if (this.awake && !this.p1.locked) {
      if (this.kLeft && Phaser.Input.Keyboard.JustDown(this.kLeft)) this.p1.idx = (this.p1.idx + n - 1) % n;
      if (this.kRight && Phaser.Input.Keyboard.JustDown(this.kRight)) this.p1.idx = (this.p1.idx + 1) % n;
      if ((this.kOk && Phaser.Input.Keyboard.JustDown(this.kOk)) ||
          (this.kOk2 && Phaser.Input.Keyboard.JustDown(this.kOk2))) this.lockP1(this.p1.idx, 'TECLA');
      if (nav1.left) this.p1.idx = (this.p1.idx + n - 1) % n;
      if (nav1.right) this.p1.idx = (this.p1.idx + 1) % n;
      if (nav1.confirm) this.lockP1(this.p1.idx, 'PAD');
    }

    // --- P2 (solo PvP, independiente de P1) ---
    if (this.awake && this.pvp && !this.p2.locked) {
      if (nav2.left) this.p2.idx = (this.p2.idx + n - 1) % n;
      if (nav2.right) this.p2.idx = (this.p2.idx + 1) % n;
      if (nav2.confirm) this.lockP2(this.p2.idx, 'PAD');
    }

    // --- Atrás: cada uno deslockea lo suyo; sin locks, al menú ---
    if (this.awake && (back1 || nav1.back)) {
      if (this.p1.locked) this.p1.locked = null;
      else if (this.p2.locked) this.p2.locked = null;
      else this.scene.start('Menu');
    }
    if (this.awake && nav2.back && this.p2.locked) this.p2.locked = null;

    // --- dibujar cursores ---
    const g = this.cursorGfx;
    g.clear();
    const drawCursor = (cur, color, tag, yOff) => {
      const x = this.cardX[cur.idx], y = this.cardY, w = this.cardW;
      g.lineStyle(4, css(color), 1).strokeRoundedRect(x - 6, y - 6 + yOff, w + 12, this.cardH + 12, 16);
      tag.setPosition(x + w / 2, y - 22 + yOff).setVisible(true);
      if (cur.locked) {
        g.fillStyle(css(color), 0.22).fillRoundedRect(x - 6, y - 6 + yOff, w + 12, this.cardH + 12, 16);
      }
    };
    drawCursor(this.p1, P1.color, this.tagP1, 0);
    if (this.pvp) drawCursor(this.p2, P2.color, this.tagP2, 0);
    else this.tagP2.setVisible(false);
    this.refreshDetail();

    const pads = countPads();
    this.hint.setText(this.pvp
      ? `P1: ←→ + Enter/click${slots.p1 !== null ? ' + mando 1' : ''} · P2: su mando + A${pads === 0 ? ' · ¡conectá un mando!' : ''} · B/ESC vuelve`
      : '←→ + Enter/click · Mando: dpad + A · ESC vuelve');
  }
}
