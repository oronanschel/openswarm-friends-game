import { TILE } from './world.js';

const HALF = 40; // tiles shown on each side of the player
const VIEW = HALF * 2 + 1;
const SCALE = 2; // screen pixels per tile
const SIZE = VIEW * SCALE;
const MARGIN = 12;

export const BLIP_RANGE = 10; // tiles: in dark mode a zombie this close shows

// Offsets in tiles from the player of the zombies close enough to show on the
// dark minimap, nearest first.
export function zombieBlips(player, zombies) {
  return zombies
    .map((z) => ({ dx: Math.floor(z.x / TILE) - Math.floor(player.x / TILE), dy: Math.floor(z.y / TILE) - Math.floor(player.y / TILE) }))
    .filter(({ dx, dy }) => Math.hypot(dx, dy) <= BLIP_RANGE)
    .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
}

export class Minimap {
  constructor(world) {
    this.world = world;
    this.buffer = null;
    this.tx = null;
    this.ty = null;
  }

  // Call after a tile changes so the next draw repaints the terrain.
  invalidate() {
    this.tx = null;
    this.ty = null;
  }

  // Repaint the terrain buffer; only needed when the player enters a new tile.
  refresh(tx, ty) {
    if (!this.buffer) {
      this.buffer = document.createElement('canvas');
      this.buffer.width = SIZE;
      this.buffer.height = SIZE;
    }
    const bctx = this.buffer.getContext('2d');
    for (let y = 0; y < VIEW; y++) {
      for (let x = 0; x < VIEW; x++) {
        bctx.fillStyle = this.world.tileAt(tx - HALF + x, ty - HALF + y).color;
        bctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
    this.tx = tx;
    this.ty = ty;
  }

  // Dark mode: no map. A box of grey static (a few dim specks that change
  // about eight times a second, never a full-screen flash), the player at the
  // centre, and a red blip for each zombie within BLIP_RANGE tiles. Replaces
  // the canvas transform, like draw().
  drawDark(ctx, viewWidth, dpr, player, zombies = [], time = 0) {
    const left = viewWidth - SIZE - MARGIN;
    const top = MARGIN;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0b0e';
    ctx.fillRect(left, top, SIZE, SIZE);
    // A small seeded generator keyed to the current static frame.
    let seed = Math.floor(time * 8) * 2654435761;
    const next = () => {
      seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 0x9e3779b9) | 0;
      return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 90; i++) {
      const grey = 40 + Math.floor(next() * 50);
      ctx.fillStyle = `rgb(${grey}, ${grey}, ${grey + 6})`;
      ctx.fillRect(left + Math.floor(next() * (SIZE - 2)), top + Math.floor(next() * (SIZE - 2)), 2, 2);
    }
    const cx = left + SIZE / 2;
    const cy = top + SIZE / 2;
    for (const { dx, dy } of zombieBlips(player, zombies)) {
      ctx.fillStyle = '#c4281f';
      ctx.fillRect(cx + dx * SCALE - 2, cy + dy * SCALE - 2, 4, 4);
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillStyle = '#f2e14c';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, SIZE, SIZE);
  }

  // Draws in screen space (CSS pixels) at the top-right corner; replaces the canvas transform.
  draw(ctx, viewWidth, dpr, player, npcs = [], items = []) {
    const tx = Math.floor(player.x / TILE);
    const ty = Math.floor(player.y / TILE);
    if (tx !== this.tx || ty !== this.ty) this.refresh(tx, ty);

    const left = viewWidth - SIZE - MARGIN;
    const top = MARGIN;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // keep tiles crisp when the buffer is scaled up
    ctx.drawImage(this.buffer, left, top);

    // A square of `size` centred on a tile's cell; `outline` adds a dark 1px
    // rim so light dots still show on snow.
    const square = (dx, dy, size, color, outline) => {
      const x = left + (dx + HALF) * SCALE + (SCALE - size) / 2;
      const y = top + (dy + HALF) * SCALE + (SCALE - size) / 2;
      if (outline) {
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 1, y - 1, size + 2, size + 2);
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
    };
    const dot = (entity, color, outline) => {
      const dx = Math.floor(entity.x / TILE) - tx;
      const dy = Math.floor(entity.y / TILE) - ty;
      if (Math.abs(dx) > HALF || Math.abs(dy) > HALF) return;
      square(dx, dy, SCALE, color, outline);
    };
    // Items first, so a villager standing on one stays visible.
    for (const item of items) dot(item, item.type.color, false);
    for (const npc of npcs) dot(npc, '#ffffff', true);
    square(0, 0, SCALE + 2, '#f2e14c', true);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, SIZE, SIZE);
  }
}
