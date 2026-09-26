// HUD como escena aparte: lee el estado de Arena y lo muestra.
// Barras arriba/abajo + columnas laterales de habilidades (P1 izquierda,
// P2 derecha, grandes). Solo se muestra lo de jugadores humanos: en PvE
// ves lo tuyo, los cooldowns del bot no se regalan. No simula ni dibuja
// el mundo.
import Phaser from 'phaser';
import { lockFor } from '../systems/aim.js';
import { clamp } from '../utils/math.js';
import { PadNav } from '../systems/input.js';

export class HUDScene extends Phaser.Scene {
  constructor() { super('HUD'); }

  create() {
    this.arena = this.scene.get('Arena');
    this.overT = 0;
    this.endShown = false;
    this.run = -1;
    this.blocks = [];
    this.choice = 0;
    this.endNavA = new PadNav(0);
    this.endNavB = new PadNav(1);

    this.endText = this.add.text(0, 0, '', { fontSize: '52px', fontStyle: '800', color: '#fff' }).setOrigin(0.5).setDepth(200).setVisible(false);
    this.endBg = this.add.rectangle(0, 0, 10, 10, 0x02040a, 0.72).setOrigin(0.5).setDepth(199).setVisible(false);
    this.optTexts = [];
    const labels = ['🔁 REVANCHA', '📋 MENÚ'];
    labels.forEach((lb, i) => {
      const t = this.add.text(0, 0, lb, { fontSize: '20px', fontStyle: '800', color: '#9fb3c8' }).setOrigin(0.5).setDepth(201).setVisible(false);
      const hit = this.add.rectangle(0, 0, 300, 44, 0xffffff, 0).setOrigin(0.5).setDepth(201)
        .setInteractive({ useHandCursor: true }).setVisible(false);
      hit.on('pointerover', () => { if (this.endShown) this.choice = i; });
      hit.on('pointerdown', () => { if (this.endShown) this.activate(i); });
      this.optTexts.push({ t, hit });
    });
    this.endHint = this.add.text(0, 0, '↑↓/dpad + A · R revancha · B menú', { fontSize: '13px', color: '#7b8ea3' }).setOrigin(0.5).setDepth(200).setVisible(false);

    const kb = this.input.keyboard;
    kb?.on('keydown-R', () => { if (this.endShown) this.activate(0); else this.arena.restartRun(); });
    this.kUp = kb ? kb.addKey('UP') : null;
    this.kDown = kb ? kb.addKey('DOWN') : null;
    this.kEnter = kb ? kb.addKey('ENTER') : null;
  }

  slotKeys(inp) {
    // Etiqueta por botón según con qué juega: teclado, mando o ambos.
    const kb = inp.useKeyboard, pad = inp.padSlot !== null;
    const K = ['LMB', '1', '2', '3'];
    const G = ['R2', 'R1', 'L1', 'L2'];
    return K.map((k, i) => (kb && pad ? `${k}/${G[i]}` : kb ? k : G[i]));
  }

  rebuild() {
    for (const b of this.blocks) {
      b.hpBg.destroy(); b.hpBar.destroy(); b.resBar.destroy(); b.cardGfx.destroy();
      b.hpText.destroy(); b.infoText.destroy();
      b.slots.forEach((s) => { s.icon.destroy(); s.key.destroy(); s.name.destroy(); s.cost.destroy(); s.cd.destroy(); s.pp.destroy(); });
    }
    this.blocks = [];
    this.run = this.arena.run;
    const humans = this.arena.ctx.fighters.filter((f) => f.controller.kind === 'local');
    humans.forEach((f, i) => {
      const b = {
        f, left: i === 0,
        hpBg: this.add.graphics(), hpBar: this.add.graphics(), resBar: this.add.graphics(),
        cardGfx: this.add.graphics(),
        hpText: this.add.text(0, 0, '', { fontSize: '13px', color: '#fff', fontStyle: '700' }).setOrigin(0.5),
        infoText: this.add.text(0, 0, '', { fontSize: '12px', color: '#7b8ea3' }).setOrigin(0.5),
        slots: [],
        icons: [f.def.basic.icon, ...f.def.abilities.map((a) => a.icon)],
        names: [f.def.basic.name, ...f.def.abilities.map((a) => a.name)],
        costs: [0, ...f.def.abilities.map((a) => a.cost)],
        maxs: [f.def.basic.cd, ...f.def.abilities.map((a) => a.cd)],
        maxpp: [f.def.basic.pp ?? Infinity, ...f.def.abilities.map((a) => a.pp ?? Infinity)],
        keys: this.slotKeys(f.controller.input),
      };
      const slotCount = 1 + f.def.abilities.length;
      for (let k = 0; k < slotCount; k++) {
        b.slots.push({
          icon: this.add.text(0, 0, '', { fontSize: '26px', color: '#fff' }).setOrigin(0.5),
          key: this.add.text(0, 0, '', { fontSize: '12px', fontStyle: '800', color: '#9fb3c8' }).setOrigin(0.5),
          name: this.add.text(0, 0, '', { fontSize: '11px', color: '#cddbe8' }).setOrigin(0, 0.5),
          cost: this.add.text(0, 0, '', { fontSize: '10px', color: '#7fb8ff' }).setOrigin(0, 0.5),
          cd: this.add.text(0, 0, '', { fontSize: '22px', fontStyle: '800', color: '#ffdf6e' }).setOrigin(0.5),
          pp: this.add.text(0, 0, '', { fontSize: '10px', color: '#9bffc4' }).setOrigin(1, 0.5),
        });
      }
      this.blocks.push(b);
    });
  }

  drawBlock(b, width, height) {
    const p = b.f;
    const bw = Math.min(560, width * 0.6);
    const x0 = width / 2 - bw / 2;
    const hpY = b.left ? 18 : height - 44;
    const resY = b.left ? 48 : height - 56;
    b.hpBg.clear().fillStyle(0x0e131c, 1).fillRect(x0, hpY, bw, 26);
    b.hpBar.clear().fillStyle(p.team === 0 ? 0x1f9c46 : 0xb03a4e, 1)
      .fillRect(x0, hpY, bw * clamp(p.hp / p.maxHp, 0, 1), 26);
    if (p.status.shield > 0) b.hpBar.fillStyle(0x3aa8d8, 0.85).fillRect(x0, hpY, bw * Math.min(1, p.status.shield / p.maxHp), 26);
    b.hpText.setPosition(width / 2, hpY + 13).setText(`${Math.ceil(p.hp)} / ${p.maxHp}`);
    const rw = bw * 0.6, rx = width / 2 - rw / 2;
    b.resBar.clear().fillStyle(0x0e131c, 1).fillRect(rx, resY, rw, 10);
    b.resBar.fillStyle(0x2f6fd0, 1).fillRect(rx, resY, rw * clamp(p.res / p.maxRes, 0, 1), 10);

    const tag = this.arena.mode === 'pvp' ? (p.team === 0 ? 'P1 · ' : 'P2 · ') : '';
    const lock = lockFor(p.controller.input);
    const lockTxt = lock.mode === 'auto' && lock.target ? ' · 🎯 AUTO' : lock.mode === 'manual-stick' ? ' · 🕹 MANUAL' : '';
    b.infoText.setPosition(width / 2, b.left ? 72 : height - 66)
      .setText(`${tag}${p.def.role} · ${p.type}${lockTxt}${p.status.empowered > 0 ? ' · ¡POTENCIADO!' : ''}`);

    // Tarjetas laterales de habilidades: tecla + icono + nombre + costo,
    // sombra de cooldown y número solo los últimos 0.5s.
    const CARD_W = 150, CARD_H = 62, STEP = 72;
    const cds = [p.basicCd, ...p.def.abilities.map((a) => p.cds[a.key])];
    const cx0 = b.left ? 10 : width - 10 - CARD_W;
    const yStart = height / 2 - ((cds.length - 1) * STEP) / 2;
    const g = b.cardGfx;
    g.clear();
    cds.forEach((cd, i) => {
      const y = yStart + i * STEP;
      const s = b.slots[i];
      const max = b.maxs[i] || 1;
      const noMana = i > 0 && p.res < b.costs[i];
      const frac = max > 0 ? Math.max(0, Math.min(1, cd / max)) : 0;

      g.fillStyle(0x0d1420, 0.92).fillRoundedRect(cx0, y, CARD_W, CARD_H, 10);
      g.lineStyle(p.aiming && p.aiming.idx === i ? 3 : 2, p.aiming && p.aiming.idx === i ? 0xffd93d : noMana ? 0x2b3648 : 0x4a5a70, 1).strokeRoundedRect(cx0, y, CARD_W, CARD_H, 10);
      if (frac > 0) g.fillStyle(0x02060e, 0.78).fillRect(cx0 + 2, y + 2, (CARD_W - 4) * frac, CARD_H - 4);

      const ppCur = i === 0 ? p.pp?.basic : p.pp?.[p.def.abilities[i - 1].key];
      const ppMax = b.maxpp[i];
      const noPP = ppCur <= 0;
      const dim = (noMana || noPP) ? 0.4 : 1;
      s.icon.setPosition(cx0 + 24, y + CARD_H / 2).setText(b.icons[i]).setAlpha(frac > 0 ? 0.45 : dim);
      s.key.setPosition(cx0 + CARD_W - 20, y + 12).setText(b.keys[i]).setAlpha(dim);
      s.name.setPosition(cx0 + 44, y + 22).setText(b.names[i]).setAlpha(frac > 0 ? 0.5 : dim);
      s.cost.setPosition(cx0 + 44, y + 44).setText(i === 0 ? '' : `◈ ${b.costs[i]}`).setAlpha(dim);
      s.pp.setPosition(cx0 + CARD_W - 12, y + 44)
        .setText(Number.isFinite(ppMax) ? `PP ${ppCur}/${ppMax}` : '')
        .setColor(ppCur <= 0 ? '#ff5c72' : '#9bffc4').setAlpha(dim);
      s.cd.setPosition(cx0 + CARD_W / 2, y + CARD_H / 2)
        .setText(cd > 0 && cd <= 0.5 ? cd.toFixed(1) : '');
    });
  }

  winner() {
    const alive = this.arena.ctx.fighters.filter((f) => f.alive);
    if (this.arena.mode === 'pvp') {
      if (alive.length === 1) {
        return alive[0].team === 0
          ? { text: '¡GANA P1!', color: '#3fa9ff' }
          : { text: '¡GANA P2!', color: '#ff4d6d' };
      }
      return { text: 'EMPATE', color: '#9fb3c8' };
    }
    const won = this.arena.player.alive;
    return won ? { text: 'VICTORIA', color: '#63e08a' } : { text: 'DERROTA', color: '#ff5c72' };
  }

  activate(i) {
    if (!this.endShown) return;
    this.choice = i;
    if (i === 0) this.arena.restartRun();
    else {
      this.scene.stop('Arena');
      this.scene.start('Menu');
    }
  }

  drawEnd(width, height, ea, eb) {
    if (ea.up || eb.up) this.choice = 0;
    if (ea.down || eb.down) this.choice = 1;
    if (this.kUp && Phaser.Input.Keyboard.JustDown(this.kUp)) this.choice = 0;
    if (this.kDown && Phaser.Input.Keyboard.JustDown(this.kDown)) this.choice = 1;

    const w = this.winner();
    this.endBg.setPosition(width / 2, height / 2).setSize(width, height).setVisible(true);
    this.endText.setText(w.text).setColor(w.color)
      .setPosition(width / 2, height / 2 - 70).setVisible(true);
    this.optTexts.forEach((o, i) => {
      const on = i === this.choice;
      o.t.setText(`${on ? '▶ ' : '  '}${['🔁 REVANCHA', '📋 MENÚ'][i]}`)
        .setColor(on ? '#ffffff' : '#9fb3c8')
        .setPosition(width / 2, height / 2 + i * 48).setVisible(true);
      o.hit.setPosition(width / 2, height / 2 + i * 48).setVisible(true);
    });
    this.endHint.setPosition(width / 2, height / 2 + 110).setVisible(true);

    if (ea.confirm || eb.confirm) this.activate(this.choice);
    if (this.kEnter && Phaser.Input.Keyboard.JustDown(this.kEnter)) this.activate(this.choice);
  }

  hideEnd() {
    this.endShown = false;
    this.choice = 0;
    this.endBg.setVisible(false);
    this.endText.setVisible(false);
    this.endHint.setVisible(false);
    this.optTexts.forEach((o) => { o.t.setVisible(false); o.hit.setVisible(false); });
  }

  update(_, deltaMs) {
    const arena = this.arena;
    if (!arena.ctx) return;
    if (arena.run !== this.run) this.rebuild();
    const dt = Math.min(0.05, deltaMs / 1000);
    const { width, height } = this.scale;
    // Los navs se poleean siempre para que no hereden pulsos del juego.
    const ea = this.endNavA.poll(dt), eb = this.endNavB.poll(dt);

    for (const b of this.blocks) this.drawBlock(b, width, height);

    if (!arena.over) {
      this.overT = 0;
      if (this.endShown) this.hideEnd();
      return;
    }
    if (this.endShown) {
      this.drawEnd(width, height, ea, eb);
      return;
    }
    this.overT += dt;
    if (this.overT < 0.7) return;
    this.endShown = true;
  }
}
