// Art is keyed by item name, so this file need not import items.js (which
// imports it).

// Pickup shapes are drawn inside a box this wide, centred on the item.
export const ART_SIZE = 12;
const HALF = ART_SIZE / 2;

const OUTLINE = '#1b1b1b';

function disc(ctx, x, y, r, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

const Art = new Map([
  [
    'Berry',
    (ctx, x, y, colour) => {
      ctx.fillStyle = '#388e3c';
      ctx.fillRect(x - 1, y - HALF, 4, 3); // leaf
      disc(ctx, x - 2.5, y + 1, 2.5, colour);
      disc(ctx, x + 2.5, y + 1.5, 2.5, colour);
      disc(ctx, x, y - 1.5, 2.5, colour);
    },
  ],
  [
    'Stone',
    (ctx, x, y, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x - HALF, y + 3);
      ctx.lineTo(x - 3, y - 4);
      ctx.lineTo(x + 3, y - 4);
      ctx.lineTo(x + HALF, y + 3);
      ctx.lineTo(x + 3, y + 5);
      ctx.lineTo(x - 3, y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0e0e0'; // highlight
      ctx.fillRect(x - 2, y - 3, 3, 2);
    },
  ],
  [
    'Shell',
    (ctx, x, y, colour) => {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x, y + 5); // hinge at the bottom, fan opening upwards
      ctx.lineTo(x - 5, y - 1);
      ctx.arc(x, y - 1, 5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d7a99a'; // ridges
      ctx.beginPath();
      for (const dx of [-3, 0, 3]) {
        ctx.moveTo(x, y + 5);
        ctx.lineTo(x + dx * 1.5, y - 4);
      }
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
    },
  ],
]);

// Draws one pickup centred at (x, y) in world pixels. Returns false, drawing
// nothing, for item types without art so the caller can fall back to a square.
export function drawItemArt(ctx, type, x, y) {
  const art = Art.get(type.name);
  if (!art) return false;
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  art(ctx, x, y, type.color);
  ctx.restore();
  return true;
}
