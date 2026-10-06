const DARKNESS = 0.96; // how black the world is beyond the light
export const DARK_RADIUS = 80; // CSS pixels of lit area around the player

// The light's radius at time t (seconds): a slow wobble plus a faster shimmer,
// within about 10% of the base so it flickers without strobing.
export function flicker(t, radius = DARK_RADIUS) {
  return radius * (1 + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 11.7 + 1));
}

// A spooky, mostly black view with a small light around the player. Off by
// default; whether it is on is kept in the save.
export class DarkMode {
  constructor() {
    this.on = false;
    this.time = 0; // seconds the mode has run, for the flicker
  }

  toggle() {
    this.on = !this.on;
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
    const radius = flicker(this.time);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    dark.addColorStop(0, 'rgba(6, 0, 10, 0)');
    dark.addColorStop(0.6, `rgba(6, 0, 10, ${(DARKNESS * 0.6).toFixed(3)})`);
    dark.addColorStop(1, `rgba(6, 0, 10, ${DARKNESS})`);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
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
