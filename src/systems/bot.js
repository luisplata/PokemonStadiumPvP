// Cerebro del bot: decide a dónde moverse y qué castear.
// Recibe el estado, devuelve movimiento {x, y}. No toca la vista ni el HUD.
// Para un bot distinto (agresivo, defensivo, otro personaje): agregar una
// entrada en BRAINS, no tocar Fighter.
import { dist, angTo, rand } from '../utils/math.js';
import { castBasic, castAbility } from './combat.js';

// Personalidad por clase. Mismo comportamiento que el prototipo original,
// pero ahora como DATOS en vez de ifs hardcodeados:
// - holdDefensive: no gasta esa habilidad salvo que su vida baje de hpFrac
// - ultiSaveHp: no gasta la ulti (slot 3) si al rival le queda menos que esto
const BRAINS = {
  terravox: { holdDefensive: { index: 1, hpFrac: 0.45 }, ultiSaveHp: 120 },
  umbraclaw: { ultiSaveHp: 120 },
  psyflame: { ultiSaveHp: 120 },
  floraviva: { holdDefensive: { index: 0, hpFrac: 0.45 }, ultiSaveHp: 120 },
  squirtle: { holdDefensive: { index: 1, hpFrac: 0.45 }, ultiSaveHp: 120 },
};

const DEFAULT_BRAIN = { ultiSaveHp: 120 };

export function think(ctx, f, dt) {
  const brain = BRAINS[f.cls] || DEFAULT_BRAIN;
  const target = ctx.fighters.find((e) => e.team !== f.team && e.alive);
  if (!target) return { x: 0, y: 0 };

  const d = dist(f, target);
  const ang = angTo(f, target);
  f.facing = ang;
  f.aiTimer -= dt;
  f.strafeTimer -= dt;
  if (f.strafeTimer <= 0) { f.strafeDir *= -1; f.strafeTimer = rand(1.2, 2.8); }

  const pref = f.def.preferredRange;
  let mx = 0, my = 0;
  if (d > pref + 45) { mx += Math.cos(ang); my += Math.sin(ang); }
  else if (d < pref - 55) { mx -= Math.cos(ang); my -= Math.sin(ang); }
  if (d < pref + 140) {
    mx += Math.cos(ang + Math.PI / 2) * f.strafeDir * 0.7;
    my += Math.sin(ang + Math.PI / 2) * f.strafeDir * 0.7;
  }

  if (f.aiTimer <= 0 && f.status.stun <= 0) {
    let casted = false;
    const abil = f.def.abilities;
    const ultiIdx = abil.length - 1;
    const lowHp = brain.holdDefensive
      ? f.hp < f.maxHp * brain.holdDefensive.hpFrac
      : false;
    for (let i = 0; i < abil.length; i++) {
      const a = abil[i];
      if (f.cds[a.key] > 0 || f.res < a.cost || d > (a.range || 200)) continue;
      if ((f.pp?.[a.key] ?? Infinity) <= 0) continue;
      if (i === ultiIdx && target.hp < (brain.ultiSaveHp ?? 0)) continue;
      if (brain.holdDefensive && i === brain.holdDefensive.index && !lowHp) continue;
      castAbility(ctx, f, i, target.x, target.y);
      f.aiTimer = rand(0.12, 0.42);
      casted = true;
      break;
    }
    if (!casted && d < (f.def.basic.range_ai || 120)) {
      castBasic(ctx, f, target.x, target.y);
      f.aiTimer = rand(0.15, 0.5);
    }
  }

  return { x: mx, y: my };
}
