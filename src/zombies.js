import { TILE } from './world.js';
import { RawItems } from './items.js';
import { drawFace } from './face.js';

export const MAX_ZOMBIES = 6;
export const SPAWN_MIN = 260; // pixels from the player: outside the dark-mode light
export const SPAWN_MAX = 420;
const DESPAWN = 700; // one left this far behind is dropped
export const NOTICE = 220; // within this it shuffles towards the player
export const SPEED = 45; // pixels per second; the player walks at 160
const WANDER_SPEED = 20;
const RADIUS = 10;
export const TOUCH = 18; // centre-to-centre distance that counts as a grab
export const SHOVE = TILE * 1.5; // how far a grab pushes the player
export const DAZED = 3; // seconds a zombie stands still after a grab

function collides(x, y, world) {
  return (
    world.isSolid(x - RADIUS, y - RADIUS) ||
    world.isSolid(x + RADIUS, y - RADIUS) ||
    world.isSolid(x - RADIUS, y + RADIUS) ||
    world.isSolid(x + RADIUS, y + RADIUS)
  );
}

// The zombies of dark mode. They exist only while it is on: they appear out
// of sight around the player, wander, and shuffle towards the player once
// near. One that touches the player takes a single berry, stone or shell and
// shoves the player away, then stands dazed for a while. They stay on land.
// Nothing here is saved. `random` returns [0, 1), for tests.
export class Zombies {
  constructor(world, random = Math.random) {
    this.world = world;
    this.random = random;
    this.all = []; // { x, y, dx, dy, timer, dazed }
  }

  // Advances the zombies; `active` is whether dark mode is on. Returns what
  // happened this step as a list of { type: 'grab', item } (item is the item
  // type taken, or null when the player had nothing to take).
  update(dt, player, active, inventory) {
    if (!active) {
      this.all.length = 0;
      return [];
    }
    this.all = this.all.filter((z) => Math.hypot(z.x - player.x, z.y - player.y) <= DESPAWN);
    // One attempt a step; a spot in water or a tree just waits for the next.
    if (this.all.length < MAX_ZOMBIES) this.spawn(player);

    const events = [];
    for (const zombie of this.all) {
      if (zombie.dazed > 0) {
        zombie.dazed -= dt;
        continue;
      }
      const toX = player.x - zombie.x;
      const toY = player.y - zombie.y;
      const distance = Math.hypot(toX, toY);
      let speed = WANDER_SPEED;
      if (distance < NOTICE && distance > 0) {
        zombie.dx = toX / distance;
        zombie.dy = toY / distance;
        speed = SPEED;
      } else {
        zombie.timer -= dt;
        if (zombie.timer <= 0) {
          zombie.timer = 1 + this.random() * 2;
          const angle = this.random() * Math.PI * 2;
          zombie.dx = Math.cos(angle);
          zombie.dy = Math.sin(angle);
        }
      }
      const nx = zombie.x + zombie.dx * speed * dt;
      if (!collides(nx, zombie.y, this.world)) zombie.x = nx;
      const ny = zombie.y + zombie.dy * speed * dt;
      if (!collides(zombie.x, ny, this.world)) zombie.y = ny;

      if (Math.hypot(player.x - zombie.x, player.y - zombie.y) < TOUCH) {
        events.push({ type: 'grab', item: this.grab(zombie, player, inventory) });
      }
    }
    return events;
  }

  // Tries one spot on a ring around the player; adds a zombie if it is land.
  spawn(player) {
    const angle = this.random() * Math.PI * 2;
    const distance = SPAWN_MIN + this.random() * (SPAWN_MAX - SPAWN_MIN);
    const tx = Math.floor((player.x + Math.cos(angle) * distance) / TILE);
    const ty = Math.floor((player.y + Math.sin(angle) * distance) / TILE);
    const x = (tx + 0.5) * TILE;
    const y = (ty + 0.5) * TILE;
    if (collides(x, y, this.world)) return false;
    this.all.push({ x, y, dx: 0, dy: 1, timer: 0, dazed: 0 });
    return true;
  }

  // The contact rule: take one raw item at random, shove the player away, and
  // leave the zombie dazed. Returns the item type taken, or null.
  grab(zombie, player, inventory) {
    zombie.dazed = DAZED;
    let dx = player.x - zombie.x;
    let dy = player.y - zombie.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx /= length;
      dy /= length;
    } else {
      dx = 0;
      dy = 1;
    }
    // As far as there is room for, in quarter steps, never into a wall.
    for (let step = 4; step > 0; step--) {
      const x = player.x + (dx * SHOVE * step) / 4;
      const y = player.y + (dy * SHOVE * step) / 4;
      if (!player.collides(x, y, this.world)) {
        player.x = x;
        player.y = y;
        break;
      }
    }
    const held = inventory ? RawItems.filter((type) => inventory.count(type.id) > 0) : [];
    if (!held.length) return null;
    const item = held[Math.floor(this.random() * held.length)];
    inventory.remove(item.id);
    return item;
  }

  draw(ctx) {
    for (const zombie of this.all) {
      ctx.fillStyle = zombie.dazed > 0 ? '#93a58a' : '#6f9a5b';
      ctx.beginPath();
      ctx.arc(zombie.x, zombie.y, RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1f2b1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawFace(ctx, zombie.x, zombie.y, zombie.dx, zombie.dy);
    }
  }
}
