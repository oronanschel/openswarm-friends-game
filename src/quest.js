export const GOAL = 5; // villagers to befriend
const BANNER_TIME = 5; // seconds the win banner stays up
const FADE = 1;

// The game's goal: make GOAL friends. Progress is read from the friend count
// each frame, so it needs nothing of its own in the save.
export class Quest {
  constructor() {
    this.last = null; // friend count seen last update; null before the first
    this.banner = 0; // seconds of banner left
  }

  // The first call only records the count, so loading a finished game
  // doesn't replay the banner.
  update(dt, friendCount) {
    if (this.last !== null && this.last < GOAL && friendCount >= GOAL) this.banner = BANNER_TIME;
    this.last = friendCount;
    this.banner = Math.max(0, this.banner - dt);
  }

  progressText() {
    const count = this.last || 0;
    return count >= GOAL ? `Friends: ${count} - goal reached!` : `Friends: ${count}/${GOAL}`;
  }

  // Centred banner in CSS pixels; all context state is restored.
  draw(ctx, viewWidth, viewHeight, dpr) {
    if (!this.banner) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = Math.min(1, this.banner / FADE);
    const text = `You made ${GOAL} friends!`;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(viewWidth - 24, ctx.measureText(text).width + 40);
    const x = viewWidth / 2;
    const y = viewHeight / 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - w / 2, y - 30, w, 60);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
