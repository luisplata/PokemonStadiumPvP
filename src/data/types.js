// Tabla de tipos como DATOS: agregar un tipo = agregar una línea.
// Clásicos integrados: Agua>Fuego>Planta>Agua, Electrico>Agua, Tierra>Electrico.
export const BEATS = {
  Tierra: ['Siniestro', 'Electrico'],
  Siniestro: ['Psiquico'],
  Psiquico: ['Planta'],
  Planta: ['Tierra', 'Agua'],
  Fuego: ['Planta'],
  Agua: ['Fuego'],
  Electrico: ['Agua'],
};

export function typeMult(atkType, defType) {
  if (!atkType || !defType) return 1;
  if ((BEATS[atkType] || []).includes(defType)) return 1.4;
  if ((BEATS[defType] || []).includes(atkType)) return 0.72;
  return 1;
}

export const WORLD = { w: 2600, h: 1700 };
