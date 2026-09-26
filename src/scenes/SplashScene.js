// Splash inicial: arte del juego unos segundos, skipeable.
import Phaser from 'phaser';
import { PadNav } from '../systems/input.js';

export class SplashScene extends Phaser.Scene {
  constructor() { super('Splash'); }

  preload() {
    this.load.image('splash', 'assets/splash.jpg');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#05070c');
    this.gone = false;
    this.born = this.time.now;
    this.awake = false;

    const src = this.textures.get('splash').getSourceImage();
    const img = this.add.image(width / 2, height / 2, 'splash');
    const sc = Math.min(width / src.width, height / src.height);
    img.setDisplaySize(src.width * sc, src.height * sc);

    this.add.text(width / 2, height - 30, 'tocá / A / Enter para continuar',
      { fontSize: '14px', color: '#9fb3c8' }).setOrigin(0.5);

    this.navA = new PadNav(0);
    this.navB = new PadNav(1);
    const kb = this.input.keyboard;
    this.kOk = kb ? kb.addKey('ENTER') : null;
    this.kOk2 = kb ? kb.addKey('SPACE') : null;
    this.input.on('pointerdown', () => { if (this.awake) this.go(); });
    this.time.delayedCall(3500, () => this.go());
  }

  go() {
    if (this.gone) return;
    this.gone = true;
    this.cameras.main.fadeOut(300, 5, 7, 12);
    this.time.delayedCall(320, () => this.scene.start('Menu'));
  }

  update(_, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.awake = this.time.now - this.born > 500;
    const a = this.awake ? this.navA.poll(dt) : this.navA.idle();
    const b = this.awake ? this.navB.poll(dt) : this.navB.idle();
    if (!this.awake) return;
    if (a.confirm || b.confirm) this.go();
    if (this.kOk && Phaser.Input.Keyboard.JustDown(this.kOk)) this.go();
    if (this.kOk2 && Phaser.Input.Keyboard.JustDown(this.kOk2)) this.go();
  }
}
