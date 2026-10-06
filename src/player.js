import { TILE, Tiles } from './world.js';
import { ItemTypes } from './items.js';
import { drawFace } from './face.js';

const SPEED = 160; // pixels per second
export const BOOST = 1.5; // speed multiplier while a boost lasts
export const BOOST_SECONDS = 20;
export const RADIUS = 10;
const EPSILON = 0.001;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.boost = 0; // seconds of speed boost left
    this.raft = false; // true while carrying a Raft: water does not block
    this.sailing = false; // true while the player's centre is over water
    // The last direction moved, for the face; starts looking down the screen.
    this.faceX = 0;
    this.faceY = 1;
  }

  // Eats one `food` (an item type) from the inventory for a speed boost.
  // Eating again while boosted restarts the timer; the speed does not stack.
  // Returns false and changes nothing if there is none to eat.
  eat(inventory, food) {
    if (!food || !inventory.remove(food.id)) return false;
    this.boost = BOOST_SECONDS;
    return true;
  }

  // Returns true on the one update in which a boost runs out.
  update(dt, input, world) {
    const boosted = this.boost > 0;
    const speed = boosted ? SPEED * BOOST : SPEED;
    this.boost = Math.max(0, this.boost - dt);
    let dx = 0;
    let dy = 0;
    if (input.has('ArrowLeft') || input.has('KeyA')) dx -= 1;
    if (input.has('ArrowRight') || input.has('KeyD')) dx += 1;
    if (input.has('ArrowUp') || input.has('KeyW')) dy -= 1;
    if (input.has('ArrowDown') || input.has('KeyS')) dy += 1;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    if (dx || dy) {
      this.faceX = dx;
      this.faceY = dy;
    }
    // Move each axis separately so the player slides along walls.
    this.x = this.moveAxis(this.x, dx * speed * dt, (x) => this.collides(x, this.y, world));
    this.y = this.moveAxis(this.y, dy * speed * dt, (y) => this.collides(this.x, y, world));
    // Fake worlds in tests may have no tiles; they are never water.
    const tile = world.tileAt?.(Math.floor(this.x / TILE), Math.floor(this.y / TILE));
    this.sailing = this.raft && tile === Tiles.WATER;
    return boosted && this.boost === 0;
  }

  // Move along one axis; if blocked, stop flush against the wall edge.
  moveAxis(pos, delta, blocked) {
    if (!delta) return pos;
    const next = pos + delta;
    if (!blocked(next)) return next;
    const flush =
      delta > 0
        ? Math.floor((next + RADIUS) / TILE) * TILE - RADIUS - EPSILON
        : Math.floor((next - RADIUS) / TILE + 1) * TILE + RADIUS + EPSILON;
    const moved = delta > 0 ? flush > pos : flush < pos;
    return moved && !blocked(flush) ? flush : pos;
  }

  // Whether the player carries a Raft; call after the inventory changes.
  sync(inventory) {
    this.raft = inventory.count(ItemTypes.RAFT.id) > 0;
  }

  // With a raft, water is the one kind of solid tile that does not block.
  blocks(world, px, py) {
    if (!world.isSolid(px, py)) return false;
    return !(this.raft && world.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)) === Tiles.WATER);
  }

  collides(x, y, world) {
    return (
      this.blocks(world, x - RADIUS, y - RADIUS) ||
      this.blocks(world, x + RADIUS, y - RADIUS) ||
      this.blocks(world, x - RADIUS, y + RADIUS) ||
      this.blocks(world, x + RADIUS, y + RADIUS)
    );
  }

  draw(ctx) {
    if (this.sailing) {
      // The raft the player stands on: planks a little wider than the body.
      ctx.fillStyle = ItemTypes.RAFT.color;
      ctx.fillRect(this.x - RADIUS - 3, this.y - RADIUS + 2, RADIUS * 2 + 6, RADIUS * 2);
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x - RADIUS - 3, this.y - RADIUS + 2, RADIUS * 2 + 6, RADIUS * 2);
      for (const dx of [-3.5, 3.5]) {
        ctx.beginPath();
        ctx.moveTo(this.x + dx, this.y - RADIUS + 2);
        ctx.lineTo(this.x + dx, this.y + RADIUS + 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#f2e14c';
    ctx.beginPath();
    ctx.arc(this.x, this.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2f00';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawFace(ctx, this.x, this.y, this.faceX, this.faceY);
    if (this.boost <= 0) return;
    // A ring that empties clockwise from the top as the boost runs down.
    ctx.strokeStyle = '#ce93d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, RADIUS + 5, -Math.PI / 2, -Math.PI / 2 + (this.boost / BOOST_SECONDS) * Math.PI * 2);
    ctx.stroke();
  }
}
