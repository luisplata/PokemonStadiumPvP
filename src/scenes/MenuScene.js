// Pantalla 1: modo de juego. Navegable con teclado, mouse Y mando.
import Phaser from 'phaser';
import { CLASSES } from '../data/classes.js';
import { PadNav, countPads } from '../systems/input.js';
import { THEME, titleStyle, bodyStyle, panel, splashBg } from '../ui/theme.js';

const OPTIONS = [
  { mode: 'pve', icon: '⚔️', title: 'JcE — ARENA', desc: 'Vos contra la máquina' },
  { mode: 'pvp', icon: '👥', title: 'JCJ — VERSUS LOCAL', desc: 'P1 teclado+mouse · P2 mando' },
];

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  preload() {
    for (const c of Object.values(CLASSES)) {
      if (c.portrait) this.load.image(c.portrait.key, `assets/fighters/${c.portrait.file}`);
    }
    this.load.image('grass', 'assets/tiles/grass.png');
    this.load.image('sand', 'assets/tiles/sand.png');
    this.load.image('water', 'assets/tiles/water.png');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#05070c');
    splashBg(this);
    this.sel = 0;
    this.nav = new PadNav(0);

    this.add.text(width / 2, 90, 'CARNAVAL SOLAR', titleStyle()).setOrigin(0.5);
    this.add.text(width / 2, 140, 'ELEGÍ EL MODO', bodyStyle(THEME.muted, '14px')).setOrigin(0.5);

    this.optGfx = this.add.graphics();
    this.optTexts = [];
    OPTIONS.forEach((o, i) => {
      const y = 250 + i * 120;
      const hit = this.add.rectangle(width / 2, y, 460, 96, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { this.sel = i; });
      hit.on('pointerdown', () => this.choose(o.mode));
      const t1 = this.add.text(width / 2, y - 14, `${o.icon}  ${o.title}`, { fontFamily: THEME.fontTitle, fontSize: '20px', color: THEME.text }).setOrigin(0.5);
      const t2 = this.add.text(width / 2, y + 20, o.desc, bodyStyle(THEME.muted, '13px')).setOrigin(0.5);
      this.optTexts.push([t1, t2]);
    });

    const kb = this.input.keyboard;
    this.keyUp = kb ? kb.addKey('UP') : null;
    this.keyDown = kb ? kb.addKey('DOWN') : null;
    this.keyOk = kb ? kb.addKey('ENTER') : null;
    this.keyOk2 = kb ? kb.addKey('SPACE') : null;

    this.padHint = this.add.text(width / 2, height - 100, '', { fontSize: '13px', color: '#4ade80' }).setOrigin(0.5);
    this.add.text(width / 2, height - 70,
      '⌨ ↑↓ + Enter · 🖱 click · 🎮 dpad + A',
      { fontSize: '13px', color: '#4f6478' }).setOrigin(0.5);
    this.add.text(width / 2, height - 44,
      'WASD mover · Mouse apuntar · Click básico · 1-3 habs · Espacio esquiva',
      { fontSize: '13px', color: '#4f6478' }).setOrigin(0.5);
  }

  choose(mode) {
    this.scene.start('Select', { mode });
  }

  update(_, deltaMs) {
    const { width } = this.scale;
    const dt = Math.min(0.05, deltaMs / 1000);
    const nav = this.nav.poll(dt);
    let moved = false;
    if (nav.up) { this.sel = (this.sel + OPTIONS.length - 1) % OPTIONS.length; moved = true; }
    if (nav.down) { this.sel = (this.sel + 1) % OPTIONS.length; moved = true; }
    if (this.keyUp && Phaser.Input.Keyboard.JustDown(this.keyUp)) { this.sel = (this.sel + OPTIONS.length - 1) % OPTIONS.length; moved = true; }
    if (this.keyDown && Phaser.Input.Keyboard.JustDown(this.keyDown)) { this.sel = (this.sel + 1) % OPTIONS.length; moved = true; }
    if (nav.confirm || (this.keyOk && Phaser.Input.Keyboard.JustDown(this.keyOk)) ||
        (this.keyOk2 && Phaser.Input.Keyboard.JustDown(this.keyOk2))) {
      this.choose(OPTIONS[this.sel].mode);
      return;
    }
    void moved;

    this.optGfx.clear();
    OPTIONS.forEach((o, i) => {
      const y = 250 + i * 120;
      const on = i === this.sel;
      panel(this.optGfx, width / 2 - 230, y - 48, 460, 96, { selected: on, edge: on ? THEME.solar : THEME.panelEdge });
    });

    const n = countPads();
    this.padHint.setText(n > 0 ? `🎮 ${n} mando(s) conectado(s)` : 'Conectá un mando para jugar JCJ con control');
  }
}
