const LIFETIME = 2; // seconds a message stays up
const FADE = 0.5; // seconds of fade-out at the end
const MAX = 4; // oldest messages drop off beyond this
const LINE = 20;
const BOTTOM = 70; // CSS pixels above the bottom edge, clear of the hotbar
const MARGIN = 12;

// Short-lived messages such as "+1 Shell", stacked bottom-left.
export class Toasts {
  constructor() {
    this.messages = []; // { text, age }, oldest first
  }

  push(text) {
    this.messages.push({ text, age: 0 });
    if (this.messages.length > MAX) this.messages.shift();
  }

  update(dt) {
    for (const message of this.messages) message.age += dt;
    this.messages = this.messages.filter((message) => message.age < LIFETIME);
  }

  // Opacity of a message: full, then a linear fade over the last FADE seconds.
  static alpha(age) {
    return Math.max(0, Math.min(1, (LIFETIME - age) / FADE));
  }

  // In CSS pixels; all context state is restored afterwards.
  draw(ctx, viewHeight, dpr) {
    if (!this.messages.length) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillStyle = '#fff';
    // Newest at the bottom.
    this.messages.forEach((message, i) => {
      const y = viewHeight - BOTTOM - (this.messages.length - 1 - i) * LINE;
      ctx.globalAlpha = Toasts.alpha(message.age);
      ctx.strokeText(message.text, MARGIN, y);
      ctx.fillText(message.text, MARGIN, y);
    });
    ctx.restore();
  }
}
