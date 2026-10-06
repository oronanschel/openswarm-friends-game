import { ItemById } from './items.js';

const SLOT = 40;
const GAP = 6;
const MARGIN = 12;

// The hotbar's extent in CSS pixels from the bottom-left corner of the view,
// for other HUD parts to stay clear of.
export const HOTBAR_RIGHT = MARGIN + ItemById.length * (SLOT + GAP) - GAP;
export const HOTBAR_TOP = MARGIN + SLOT;

export class Inventory {
  constructor() {
    this.counts = new Map(); // item id -> count
    this.onAdd = null; // optional (id, n) callback, e.g. for pickup messages
  }

  add(id, n = 1) {
    this.counts.set(id, this.count(id) + n);
    if (this.onAdd) this.onAdd(id, n);
  }

  // Removes n of an item; returns false and changes nothing if there are fewer.
  remove(id, n = 1) {
    const have = this.count(id);
    if (have < n) return false;
    if (have === n) this.counts.delete(id);
    else this.counts.set(id, have - n);
    return true;
  }

  count(id) {
    return this.counts.get(id) || 0;
  }

  // Hotbar at the bottom-left, in CSS pixels. All context state (transform,
  // text alignment, alpha) is restored afterwards so it doesn't leak to callers.
  draw(ctx, viewHeight, dpr) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = viewHeight - SLOT - MARGIN;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ItemById.forEach((type, i) => {
      const left = MARGIN + i * (SLOT + GAP);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(left, top, SLOT, SLOT);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, SLOT - 1, SLOT - 1);
      const count = this.count(type.id);
      ctx.globalAlpha = count ? 1 : 0.3;
      ctx.fillStyle = type.color;
      ctx.fillRect(left + 12, top + 8, 16, 16);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(String(count), left + SLOT - 4, top + SLOT - 2);
    });
    ctx.restore();
  }
}
