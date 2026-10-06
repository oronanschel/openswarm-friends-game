const KEY = 'friends-game-help-seen';

export const HelpLines = [
  'Walk: WASD or arrows (drag on touch)',
  'Pick up berries, stones and shells',
  'Craft: 1, 2, 3, 4 (recipes at top-left)',
  'Chop a tree: Space, with a Stone Axe',
  'Trees give Wood; a Raft crosses water',
  'Make a friend: E, with a Shell Necklace',
  'Eat Berry Jam: F, for a speed boost',
  'Mute: M      Start over: Shift+R',
  'Goal: make 5 friends',
];
const TITLE = 'How to play';
const FOOTER = 'Press any key or tap to close. H brings this back.';

const LINE = 19;
const PAD = 14;
const MARGIN = 12;
const WIDTH = 300;

// The controls and the goal, shown on the first visit and whenever H is
// pressed. Whether it has been seen is remembered in `storage`; without
// storage it simply shows on every visit.
export class Help {
  constructor(storage) {
    this.storage = storage;
    this.visible = true;
    try {
      this.visible = storage?.getItem(KEY) !== '1';
    } catch {
      // Storage unavailable: show it.
    }
  }

  toggle() {
    if (this.visible) this.dismiss();
    else this.visible = true;
    return this.visible;
  }

  // Hides the panel; returns whether it was showing.
  dismiss() {
    if (!this.visible) return false;
    this.visible = false;
    try {
      this.storage?.setItem(KEY, '1');
    } catch {
      // It will just show again next visit.
    }
    return true;
  }

  // The panel's rectangle in CSS pixels, centred, narrower on small windows.
  static rect(viewWidth, viewHeight) {
    const w = Math.min(WIDTH, viewWidth - MARGIN * 2);
    const h = PAD * 2 + LINE * (HelpLines.length + 3);
    return { x: (viewWidth - w) / 2, y: Math.max(MARGIN, (viewHeight - h) / 2), w, h };
  }

  // In CSS pixels; all context state is restored afterwards.
  draw(ctx, viewWidth, viewHeight, dpr) {
    if (!this.visible) return;
    const { x, y, w, h } = Help.rect(viewWidth, viewHeight);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(TITLE, x + PAD, y + PAD);
    ctx.font = '13px sans-serif';
    // maxWidth squeezes a line rather than letting it run out of the panel.
    HelpLines.forEach((line, i) => ctx.fillText(line, x + PAD, y + PAD + LINE * (i + 1.5), w - PAD * 2));
    ctx.globalAlpha = 0.7;
    ctx.font = '11px sans-serif';
    ctx.fillText(FOOTER, x + PAD, y + h - PAD - 11, w - PAD * 2);
    ctx.restore();
  }
}
