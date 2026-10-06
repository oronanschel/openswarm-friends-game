import { ItemById } from './items.js';
import { drawItemArt, ART_SIZE } from './itemart.js';

const SLOT = 40;
const GAP = 6;
const MARGIN = 12;
const MIN_SLOT = 24;
const ICON_SCALE = 1.5; // world art is 12px; icons are 18px in a full-size slot

// The hotbar for a view `viewWidth` CSS pixels wide holding `slots` item
// types: `slot` is the side of one slot, shrunk evenly from 40px when the bar
// would not fit; `right` and `top` are its extent from the bottom-left corner
// of the view, for other HUD parts to stay clear of.
export function hotbarLayout(viewWidth = Infinity, slots = ItemById.length) {
  const fit = Math.floor((viewWidth - MARGIN * 2 - (slots - 1) * GAP) / slots);
  const slot = Math.max(MIN_SLOT, Math.min(SLOT, fit));
  return { slot, right: MARGIN + slots * (slot + GAP) - GAP, top: MARGIN + slot };
}

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
  // Given `viewWidth`, the slots shrink to fit a narrow window.
  draw(ctx, viewHeight, dpr, viewWidth = Infinity) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { slot } = hotbarLayout(viewWidth);
    const scale = slot / SLOT;
    const top = viewHeight - slot - MARGIN;
    ctx.font = `bold ${scale < 0.8 ? 10 : 12}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ItemById.forEach((type, i) => {
      const left = MARGIN + i * (slot + GAP);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(left, top, slot, slot);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, slot - 1, slot - 1);
      const count = this.count(type.id);
      ctx.globalAlpha = count ? 1 : 0.3;
      // The same art as in the world, scaled up to fill the slot's icon area.
      ctx.save();
      ctx.translate(left + slot / 2, top + 16 * scale);
      ctx.scale(ICON_SCALE * scale, ICON_SCALE * scale);
      if (!drawItemArt(ctx, type, 0, 0)) {
        ctx.fillStyle = type.color;
        ctx.fillRect(-ART_SIZE / 2, -ART_SIZE / 2, ART_SIZE, ART_SIZE);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(String(count), left + slot - 4 * scale, top + slot - 2 * scale);
    });
    ctx.restore();
  }
}
