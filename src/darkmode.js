const DARKNESS = 0.96; // how black the world is beyond the light
export const DARK_RADIUS = 80; // CSS pixels of lit area around the player at the start
export const MIN_RADIUS = 48; // the light never shrinks below this
const SHRINK_TIME = 150; // seconds in the dark until the light has shrunk to its minimum
const BLACKOUT_AFTER = 20; // seconds in before the light first goes out
const BLACKOUT_EVERY = 14; // one blackout in each window this long, at a hashed moment
const BLACKOUT_LENGTH = 0.7; // seconds, ramping down and back up so it never snaps

// The light's radius at time t (seconds): a slow wobble plus a faster shimmer,
// within about 10% of the base so it flickers without strobing.
export function flicker(t, radius = DARK_RADIUS) {
  return radius * (1 + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 11.7 + 1));
}

// How much of the light is left at time t: 1 normally, dipping to 0.2 and back
// once in each window after the first BLACKOUT_AFTER seconds.
export function blackout(t) {
  if (t < BLACKOUT_AFTER) return 1;
  const window = Math.floor(t / BLACKOUT_EVERY);
  // A stable pseudo-random moment in this window, leaving room for the dip.
  const hash = Math.sin(window * 127.1 + 311.7) * 43758.5453;
  const start = window * BLACKOUT_EVERY + (hash - Math.floor(hash)) * (BLACKOUT_EVERY - BLACKOUT_LENGTH);
  const along = (t - start) / BLACKOUT_LENGTH;
  if (along < 0 || along > 1) return 1;
  return 1 - 0.8 * Math.sin(along * Math.PI);
}

// The light's radius after `t` seconds in the dark: it shrinks steadily to
// MIN_RADIUS, flickers harder as it does, and goes out now and then.
export function lightRadius(t) {
  const shrink = Math.min(t / SHRINK_TIME, 1);
  const base = DARK_RADIUS + (MIN_RADIUS - DARK_RADIUS) * shrink;
  const wobble = 1 + 0.06 * Math.sin(t * 3.1) + (0.04 + 0.06 * shrink) * Math.sin(t * 11.7 + 1);
  return base * wobble * blackout(t);
}

// A few pale fog banks, as [x, y, size, speed] with positions in 0..1 of the
// view; they drift sideways and sway a little.
const FOG = [
  [0.1, 0.3, 0.45, 0.011],
  [0.5, 0.7, 0.55, -0.008],
  [0.8, 0.2, 0.4, 0.014],
  [0.3, 0.85, 0.5, -0.012],
  [0.65, 0.5, 0.6, 0.009],
];

// A spooky, mostly black view with a small light around the player. Off by
// default; whether it is on is kept in the save. The longer it is on, the
// smaller the light.
export class DarkMode {
  constructor() {
    this.on = false;
    this.time = 0; // seconds the mode has run, for the flicker and shrinking
  }

  // Turning it on starts the dark afresh, with the light at full size.
  toggle() {
    this.on = !this.on;
    if (this.on) this.time = 0;
    return this.on;
  }

  update(dt) {
    if (this.on) this.time += dt;
  }

  // Full-screen darkness; draw after the day/night tint and before the HUD.
  // The camera keeps the player at the centre of the view. Restores ctx.
  draw(ctx, viewWidth, viewHeight, dpr) {
    if (!this.on) return;
    const cx = viewWidth / 2;
    const cy = viewHeight / 2;
    const radius = lightRadius(this.time);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A cold, sickly light rather than a friendly one.
    const dark = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    dark.addColorStop(0, 'rgba(70, 90, 100, 0.18)');
    dark.addColorStop(0.6, `rgba(4, 8, 12, ${(DARKNESS * 0.6).toFixed(3)})`);
    dark.addColorStop(1, `rgba(2, 4, 8, ${DARKNESS})`);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    // Slow fog drifting over the screen: faint and soft, never a flash.
    for (const [x, y, size, speed] of FOG) {
      const fx = (((x + speed * this.time) % 1.3) + 1.3) % 1.3 - 0.15;
      const fy = y + 0.04 * Math.sin(this.time * 0.2 + x * 9);
      const r = size * Math.max(viewWidth, viewHeight) * 0.5;
      const fog = ctx.createRadialGradient(fx * viewWidth, fy * viewHeight, 0, fx * viewWidth, fy * viewHeight, r);
      fog.addColorStop(0, 'rgba(150, 170, 175, 0.09)');
      fog.addColorStop(1, 'rgba(150, 170, 175, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, viewWidth, viewHeight);
    }
    // A soft vignette, so the edges close in on the corners.
    const far = Math.hypot(cx, cy);
    const vignette = ctx.createRadialGradient(cx, cy, far * 0.4, cx, cy, far);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.restore();
  }
}
