// Terreno con gameplay: el río central frena al que lo cruza.
// Formato como datos: agregar una forma = una entrada (futura laguna, lodo...).
import { WORLD } from '../data/types.js';

export const WATER_SLOW = 0.7;

// Río horizontal al centro (los spawns quedan fuera: y=330 y y=1370).
export const RIVER = { y0: 760, y1: 940 };
export const SAND_H = 64;

export function terrainAt(x, y) {
  if (y >= RIVER.y0 && y <= RIVER.y1) return 'water';
  return 'land';
}

export function inWater(x, y) {
  return terrainAt(x, y) === 'water';
}
