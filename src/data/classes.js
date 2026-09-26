// Criaturas como DATOS: stats + 4 ids del catálogo (src/data/abilities.js).
// Para crear un bicho nuevo: stats + elegir 4 habilidades existentes.
// Para crear una habilidad nueva: agregarla al catálogo, no acá.
import { ABILITIES, makeAbility, canLearn } from './abilities.js';

function build(stats, abilityIds) {
  const keys = ['1', '2', '3'];
  return {
    ...stats,
    abilities: abilityIds.map((id, i) => makeAbility(id, keys[i])),
  };
}

const STATS = {
  terravox: {
    name: 'Defensor', role: 'Tanque', type: 'Tierra', icon: '🪨',
    portrait: { key: 'defensor', file: 'defensor.png', crop: [60, 30, 920, 1281] },
    color: '#d4a017', accent: '#f2c94c',
    hp: 1500, res: 100, resRegen: 11, speed: 160, radius: 30, preferredRange: 105,
    basic: { name: 'Golpe Pesado', key: 'LMB', icon: '👊', cd: 0.9, dmg: 80, range: 120, arc: 1.5, kind: 'melee', range_ai: 120 },
  },
  umbraclaw: {
    name: 'Ubicador', role: 'Asesino', type: 'Siniestro', icon: '🗡️',
    portrait: { key: 'ubicador', file: 'ubicador.png', crop: [0, 0, 995, 1222] },
    color: '#a06bff', accent: '#c9a4ff',
    hp: 980, res: 100, resRegen: 15, speed: 205, radius: 24, preferredRange: 85,
    basic: { name: 'Zarpazo', key: 'LMB', icon: '🐾', cd: 0.5, dmg: 58, range: 100, arc: 1.3, kind: 'melee', range_ai: 100 },
  },
  psyflame: {
    name: 'Energizador', role: 'Mago', type: 'Psiquico', icon: '🔮',
    portrait: { key: 'energizador', file: 'energizador.png', crop: [15, 15, 752, 1105] },
    color: '#ff5fa2', accent: '#ff9ecb',
    hp: 880, res: 120, resRegen: 15, speed: 175, radius: 24, preferredRange: 430,
    basic: { name: 'Chispa Psíquica', key: 'LMB', icon: '✨', cd: 0.55, dmg: 55, range: 640, kind: 'proj', projSpeed: 900, projRadius: 9, range_ai: 620, color: '#ff9ecb' },
  },
  floraviva: {
    name: 'Mirash', role: 'Sanador', type: 'Planta', icon: '🌸',
    portrait: { key: 'mirash', file: 'mirash.png', crop: [40, 20, 1390, 3470] },
    color: '#4bd88a', accent: '#9bffc4',
    hp: 1150, res: 130, resRegen: 19, speed: 180, radius: 26, preferredRange: 360,
    basic: { name: 'Latigazo', key: 'LMB', icon: '🌿', cd: 0.7, dmg: 52, range: 520, kind: 'proj', projSpeed: 700, projRadius: 10, range_ai: 500, color: '#9bffc4' },
  },
  campeon: {
    name: 'Campeón', role: 'Bruiser', type: 'Veneno', icon: '🦔',
    portrait: { key: 'campeon', file: 'campeon.png', crop: [52, 0, 470, 987] },
    color: '#6a9a4f', accent: '#a5d66f',
    hp: 1250, res: 100, resRegen: 12, speed: 190, radius: 27, preferredRange: 120,
    basic: { name: 'Espina Rápida', key: 'LMB', icon: '🌵', cd: 0.45, dmg: 45, range: 95, arc: 1.4, kind: 'melee', range_ai: 95, slow: { pct: 0.1, dur: 2 } },
  },
  mortero: {
    name: 'Mortero', role: 'Soporte', type: 'Veneno', icon: '🧨',
    portrait: { key: 'mortero', file: 'mortero.png', crop: [70, 30, 430, 491] },
    color: '#8a6f4d', accent: '#d8b24a',
    hp: 950, res: 120, resRegen: 15, speed: 165, radius: 25, preferredRange: 420,
    basic: { name: 'Bola de Cañón', key: 'LMB', icon: '💣', cd: 1.1, dmg: 80, range: 500, kind: 'proj', projSpeed: 320, projRadius: 14, range_ai: 480, color: '#d8b24a' },
  },
  franco: {
    name: 'Franco', role: 'Daño', type: 'Veneno', icon: '🔭',
    portrait: { key: 'franco', file: 'franco.png', crop: [160, 15, 530, 682] },
    color: '#7d6fa8', accent: '#c0b3e8',
    hp: 850, res: 100, resRegen: 14, speed: 195, radius: 23, preferredRange: 480,
    basic: { name: 'Disparo de Esporas', key: 'LMB', icon: '🎯', cd: 0.8, dmg: 55, range: 600, kind: 'proj', projSpeed: 900, projRadius: 8, range_ai: 580, color: '#c0b3e8' },
  },
  disparador: {
    name: 'Disparador', role: 'Control', type: 'Veneno', icon: '🎋',
    portrait: { key: 'disparador', file: 'disparador.png', crop: [58, 5, 445, 802] },
    color: '#4f8a7d', accent: '#8fd0c0',
    hp: 1000, res: 110, resRegen: 14, speed: 175, radius: 25, preferredRange: 350,
    basic: { name: 'Fruto Contaminado', key: 'LMB', icon: '🍇', cd: 0.9, dmg: 50, range: 520, kind: 'proj', projSpeed: 750, projRadius: 10, range_ai: 500, color: '#8fd0c0', slow: { pct: 0.15, dur: 2 } },
  },
};

// Formato clásico: 1 básico insignia (en STATS, único) + 3 fijas por campeón.
// Las que salen del kit quedan en el catálogo como pool para otros.
const KITS = {
  terravox: ['seismic-slam', 'iron-skin', 'earthquake'],
  umbraclaw: ['shadow-slash', 'veil', 'blade-storm'],
  psyflame: ['fireball', 'teleport', 'psychic-nova'],
  floraviva: ['healing-pulse', 'vines', 'forest-blessing'],
  campeon: ['spore-charge', 'dorsal-shield', 'spore-masterpiece'],
  mortero: ['bombardment', 'spore-mine', 'pearl-rain'],
  franco: ['charged-shot', 'tailwind', 'silent-death'],
  disparador: ['ice-spikes', 'snow-fungus', 'spore-winter'],
};

export const CLASSES = Object.fromEntries(
  Object.entries(STATS).map(([k, s]) => [k, build(s, KITS[k])]),
);

// Falla fuerte y temprano si el contenido está mal (id typo, kit incompleto).
// Se llama en main.js antes de arrancar el juego.
export function validateContent() {
  for (const [cls, ids] of Object.entries(KITS)) {
    if (!STATS[cls]) throw new Error(`KITS trae clase desconocida: ${cls}`);
    if (ids.length !== 3) throw new Error(`${cls} tiene ${ids.length} habilidades, se esperan 3`);
    for (const id of ids) {
      if (!ABILITIES[id]) throw new Error(`${cls} referencia habilidad desconocida: ${id}`);
      if (!canLearn(STATS[cls].type, ABILITIES[id])) throw new Error(`${cls} (${STATS[cls].type}) no puede llevar ${id}`);
    }
  }
}
