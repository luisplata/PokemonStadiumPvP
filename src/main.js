import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene.js';
import { SplashScene } from './scenes/SplashScene.js';
import { SelectScene } from './scenes/SelectScene.js';
import { VersusScene } from './scenes/VersusScene.js';
import { ArenaScene } from './scenes/ArenaScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { validateContent } from './data/classes.js';

validateContent();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#05070c',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { antialias: true },
  scene: [SplashScene, MenuScene, SelectScene, VersusScene, ArenaScene, HUDScene],
});
