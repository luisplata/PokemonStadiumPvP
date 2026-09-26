export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const TAU = Math.PI * 2;
export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
export function lerp(a, b, t) { return a + (b - a) * t; }
