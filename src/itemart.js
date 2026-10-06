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
        ctx.lineTo(x + dx * 1.3, y - 4);
      }
      ctx.stroke();
      ctx.strokeStyle = OUTLINE;
    },
  ],
  [
    'Berry Jam',
    (ctx, x, y, colour) => {
      ctx.fillStyle = colour; // jar of jam
      ctx.fillRect(x - 4, y - 2, 8, 8);
      ctx.strokeRect(x - 4, y - 2, 8, 8);
      ctx.fillStyle = '#e0e0e0'; // lid
      ctx.fillRect(x - 3, y - 5, 6, 3);
      ctx.strokeRect(x - 3, y - 5, 6, 3);
    },
  ],
  [
    'Shell Necklace',
    (ctx, x, y, colour) => {
      ctx.beginPath(); // the string, a loop hanging from the top
      ctx.arc(x, y - 2, 4, 0, Math.PI);
      ctx.stroke();
      for (const [dx, dy] of [[-4, -2], [-3, 2], [0, 3], [3, 2], [4, -2]]) {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    },
  ],
  [
    'Wood',
    (ctx, x, y, colour) => {
      for (const [dy, tone] of [[-4, '#a1887f'], [0, colour], [4, '#6d4c41']]) {
        ctx.fillStyle = tone; // three stacked logs
        ctx.fillRect(x - 5, y + dy - 2, 10, 4);
        ctx.strokeRect(x - 5, y + dy - 2, 10, 4);
      }
    },
  ],
  [
    'Stone Axe',
    (ctx, x, y, colour) => {
      ctx.fillStyle = colour; // wooden handle, running up to the right
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 5);
      ctx.lineTo(x - 2, y + 5);
      ctx.lineTo(x + 3, y - 4);
      ctx.lineTo(x + 1, y - 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9e9e9e'; // stone head
      ctx.beginPath();
      ctx.moveTo(x - 1, y - 5);
      ctx.lineTo(x + 5, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x + 2, y - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
