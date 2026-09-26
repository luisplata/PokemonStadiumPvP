// Pokémon como DATOS: stats + 4 ids del catálogo (src/data/abilities.js).
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
    name: 'Terravox', role: 'Tanque', type: 'Tierra', icon: '🪨',
    color: '#d4a017', accent: '#f2c94c',
    hp: 1500, res: 100, resRegen: 11, speed: 160, radius: 30, preferredRange: 105,
    basic: { name: 'Golpe Pesado', key: 'LMB', icon: '👊', cd: 0.9, dmg: 80, range: 120, arc: 1.5, kind: 'melee', range_ai: 120 },
  },
  umbraclaw: {
    name: 'Umbraclaw', role: 'Asesino', type: 'Siniestro', icon: '🗡️',
    color: '#a06bff', accent: '#c9a4ff',
    hp: 980, res: 100, resRegen: 15, speed: 205, radius: 24, preferredRange: 85,
    basic: { name: 'Zarpazo', key: 'LMB', icon: '🐾', cd: 0.5, dmg: 58, range: 100, arc: 1.3, kind: 'melee', range_ai: 100 },
  },
  psyflame: {
    name: 'Psyflame', role: 'Mago', type: 'Psiquico', icon: '🔮',
    color: '#ff5fa2', accent: '#ff9ecb',
    hp: 880, res: 120, resRegen: 15, speed: 175, radius: 24, preferredRange: 430,
    basic: { name: 'Chispa Psíquica', key: 'LMB', icon: '✨', cd: 0.55, dmg: 55, range: 640, kind: 'proj', projSpeed: 900, projRadius: 9, range_ai: 620, color: '#ff9ecb' },
  },
  floraviva: {
    name: 'Floraviva', role: 'Sanador', type: 'Planta', icon: '🌸',
    color: '#4bd88a', accent: '#9bffc4',
    hp: 1150, res: 130, resRegen: 19, speed: 180, radius: 26, preferredRange: 360,
    basic: { name: 'Latigazo', key: 'LMB', icon: '🌿', cd: 0.7, dmg: 52, range: 520, kind: 'proj', projSpeed: 700, projRadius: 10, range_ai: 500, color: '#9bffc4' },
  },
  bulbasaur: {
    name: 'Bulbasaur', role: 'Tanque', type: 'Planta', icon: '🌱',
    color: '#58a05c', accent: '#8fd694',
    hp: 1250, res: 110, resRegen: 13, speed: 165, radius: 27, preferredRange: 300,
    basic: { name: 'Látigo Cepa', key: 'LMB', icon: '🌿', cd: 0.65, dmg: 50, range: 480, kind: 'proj', projSpeed: 750, projRadius: 10, range_ai: 460, color: '#8fd694' },
  },
  charmander: {
    name: 'Charmander', role: 'Mago', type: 'Fuego', icon: '🔥',
    color: '#e0632f', accent: '#ffb066',
    hp: 900, res: 115, resRegen: 14, speed: 182, radius: 24, preferredRange: 200,
    basic: { name: 'Arañazo', key: 'LMB', icon: '🐾', cd: 0.5, dmg: 55, range: 100, arc: 1.3, kind: 'melee', range_ai: 100 },
  },
  squirtle: {
    name: 'Squirtle', role: 'Tanque', type: 'Agua', icon: '🐢',
    color: '#4d8fd1', accent: '#9fd0ff',
    hp: 1400, res: 100, resRegen: 11, speed: 158, radius: 29, preferredRange: 110,
    basic: { name: 'Placaje', key: 'LMB', icon: '💥', cd: 0.8, dmg: 75, range: 110, arc: 1.4, kind: 'melee', range_ai: 110 },
  },
  pikachu: {
    name: 'Pikachu', role: 'Asesino', type: 'Electrico', icon: '⚡',
    color: '#e8b923', accent: '#fff06e',
    hp: 950, res: 105, resRegen: 16, speed: 215, radius: 23, preferredRange: 380,
    basic: { name: 'Ataque Rápido', key: 'LMB', icon: '💨', cd: 0.4, dmg: 48, range: 95, arc: 1.4, kind: 'melee', range_ai: 95 },
  },
};

// Formato Pokémon: 1 básico insignia (en STATS, único) + 3 intercambiables.
// Las que salen del kit quedan en el catálogo como pool para otros.
const KITS = {
  terravox: ['seismic-slam', 'iron-skin', 'earthquake'],
  umbraclaw: ['shadow-slash', 'veil', 'blade-storm'],
  psyflame: ['fireball', 'teleport', 'psychic-nova'],
  floraviva: ['healing-pulse', 'vines', 'forest-blessing'],
  bulbasaur: ['razor-leaf', 'sleep-powder', 'healing-pulse'],
  charmander: ['ember', 'smokescreen', 'rock-charge'],
  squirtle: ['water-gun', 'withdraw', 'rock-charge'],
  pikachu: ['thunder-shock', 'thunder-wave', 'teleport'],
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
