import { TILE } from './world.js';

const HALF = 40; // tiles shown on each side of the player
const VIEW = HALF * 2 + 1;
const SCALE = 2; // screen pixels per tile
const SIZE = VIEW * SCALE;
const MARGIN = 12;

export class Minimap {
  constructor(world) {
    this.world = world;
    this.buffer = null;
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

  // Draws in screen space (CSS pixels) at the top-right corner; replaces the canvas transform.
  draw(ctx, viewWidth, dpr, player, npcs = []) {
    const tx = Math.floor(player.x / TILE);
    const ty = Math.floor(player.y / TILE);
    if (tx !== this.tx || ty !== this.ty) this.refresh(tx, ty);

    const left = viewWidth - SIZE - MARGIN;
    const top = MARGIN;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // keep tiles crisp when the buffer is scaled up
    ctx.drawImage(this.buffer, left, top);

    ctx.fillStyle = '#ffffff';
    for (const npc of npcs) {
      const dx = Math.floor(npc.x / TILE) - tx;
      const dy = Math.floor(npc.y / TILE) - ty;
      if (Math.abs(dx) > HALF || Math.abs(dy) > HALF) continue;
      ctx.fillRect(left + (dx + HALF) * SCALE, top + (dy + HALF) * SCALE, SCALE, SCALE);
    }

    ctx.fillStyle = '#f2e14c';
    ctx.fillRect(left + HALF * SCALE - 1, top + HALF * SCALE - 1, SCALE + 2, SCALE + 2);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, SIZE, SIZE);
  }
}
