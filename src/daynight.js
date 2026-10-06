export const CYCLE = 240; // seconds for a full day
export const MAX_ALPHA = 0.45; // night stays this light so the game is playable

// Tint over the world through the day: [phase in 0..1, r, g, b, alpha].
// The first and last keys match so the cycle wraps smoothly.
const KEYS = [
  [0, 0, 0, 0, 0],
  [0.45, 0, 0, 0, 0], // day
  [0.55, 255, 120, 40, 0.22], // dusk
  [0.65, 10, 20, 60, MAX_ALPHA], // night
  [0.85, 10, 20, 60, MAX_ALPHA],
  [0.95, 255, 170, 120, 0.18], // dawn
  [1, 0, 0, 0, 0],
];

const lerp = (a, b, t) => a + (b - a) * t;

// Interpolated { r, g, b, a } for a phase in [0, 1). Fully transparent keys
// borrow the colour of their neighbour so fades don't pass through grey.
export function tintAt(phase) {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (KEYS[i + 1][0] <= p) i++;
  const [p0, r0, g0, b0, a0] = KEYS[i];
  const [p1, r1, g1, b1, a1] = KEYS[i + 1];
  const t = (p - p0) / (p1 - p0);
  const from = a0 === 0 ? [r1, g1, b1] : [r0, g0, b0];
  const to = a1 === 0 ? [r0, g0, b0] : [r1, g1, b1];
  return {
    r: Math.round(lerp(from[0], to[0], t)),
    g: Math.round(lerp(from[1], to[1], t)),
    b: Math.round(lerp(from[2], to[2], t)),
    a: lerp(a0, a1, t),
  };
}

export class DayNight {
  constructor(time = 0) {
    this.time = time; // seconds into the current day; 0 is morning
  }

  update(dt) {
    this.time = (this.time + dt) % CYCLE;
  }

  get phase() {
    return this.time / CYCLE;
  }

  // Full-screen tint; draw after the world and before the HUD. Restores ctx.
  draw(ctx, viewWidth, viewHeight, dpr) {
    const { r, g, b, a } = tintAt(this.phase);
    if (a <= 0) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.restore();
  }
}
