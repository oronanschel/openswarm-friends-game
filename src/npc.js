import { TILE } from './world.js';
import { ItemTypes, RawItems } from './items.js';

const REGION = 16; // tiles per side of a spawn region
const LOAD_RADIUS = 2; // regions kept populated around the player
const SPEED = 50; // pixels per second
const RADIUS = 10;
const TALK_DISTANCE = 56;

const NAMES = ['Ada', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn', 'Gita', 'Hugo'];
const LINES = [
  'Nice day for a walk.',
  'I hear the water goes on forever.',
  'Mind the trees.',
  'Have you been far to the east?',
  'I am sure I left my boat around here.',
  'The sand is warm today.',
];
const COLORS = ['#d9534f', '#8e6bd1', '#e08a2e', '#3fb6c6'];
const GIFT_CHANCE = 1 / 3;

// Small seeded PRNG so each region always spawns the same NPCs.
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collides(x, y, world) {
  return (
    world.isSolid(x - RADIUS, y - RADIUS) ||
    world.isSolid(x + RADIUS, y - RADIUS) ||
    world.isSolid(x - RADIUS, y + RADIUS) ||
    world.isSolid(x + RADIUS, y + RADIUS)
  );
}

// A heart drawn as a path (a ♥ glyph can render as a colour emoji), centred on
// (x, y) with half-width r.
function drawHeart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  ctx.fillStyle = '#e53950';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1b1b1b';
  ctx.stroke();
}

class Npc {
  constructor(x, y, random) {
    this.x = x;
    this.y = y;
    this.random = random;
    this.name = NAMES[Math.floor(random() * NAMES.length)];
    this.line = LINES[Math.floor(random() * LINES.length)];
    this.color = COLORS[Math.floor(random() * COLORS.length)];
    this.dx = 0;
    this.dy = 0;
    this.timer = 0;
    this.talking = false;
    this.key = null; // "rx,ry,index": stable across region reloads
    this.gift = null; // item type handed over on first talk, if any
    this.giving = false; // true while showing the gift line
    this.friend = false; // mirrors Npcs.friends, refreshed every update
  }

  update(dt, player, world) {
    this.talking = Math.hypot(player.x - this.x, player.y - this.y) < TALK_DISTANCE;
    if (this.talking) return;

    this.timer -= dt;
    if (this.timer <= 0) {
      // Alternate between standing still and walking in a random direction.
      this.timer = 1 + this.random() * 2;
      if (this.dx || this.dy) {
        this.dx = 0;
        this.dy = 0;
      } else {
        const angle = this.random() * Math.PI * 2;
        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);
      }
    }
    const nx = this.x + this.dx * SPEED * dt;
    if (!collides(nx, this.y, world)) this.x = nx;
    else this.dx = -this.dx;
    const ny = this.y + this.dy * SPEED * dt;
    if (!collides(this.x, ny, world)) this.y = ny;
    else this.dy = -this.dy;
  }

  // Restores all context state (font, alignment, colours) afterwards.
  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (this.friend) drawHeart(ctx, this.x + RADIUS, this.y - RADIUS, 5);
    if (this.talking) this.drawBubble(ctx);
    ctx.restore();
  }

  drawBubble(ctx) {
    let line = this.line;
    if (this.giving) line = 'Here, take this ' + this.gift.name.toLowerCase() + '!';
    else if (this.friend) line = 'Good to see you, friend!';
    const text = this.name + ': ' + line;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 12;
    const h = 22;
    const bx = this.x - w / 2;
    const by = this.y - RADIUS - h - 8;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, w, h);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillText(text, this.x, by + h / 2);
  }
}

export class Npcs {
  constructor(world) {
    this.world = world;
    this.regions = new Map();
    // Keys of NPCs that already handed over their gift; persisted by save/load.
    this.gifted = new Set();
    // Keys of NPCs befriended with a Shell Necklace; persisted by save/load.
    this.friends = new Set();
  }

  // Every NPC in a loaded region, for other systems such as the minimap.
  get all() {
    return [...this.regions.values()].flat();
  }

  // The nearest NPC currently talking to the player, or null.
  talkingTo(player) {
    let best = null;
    for (const npc of this.all) {
      if (!npc.talking) continue;
      if (!best || Math.hypot(player.x - npc.x, player.y - npc.y) < Math.hypot(player.x - best.x, player.y - best.y)) best = npc;
    }
    return best;
  }

  // Gives `npc` a Shell Necklace from the inventory to become friends.
  // Returns false, changing nothing, if already friends or there is no necklace.
  befriend(npc, inventory) {
    if (!npc || this.friends.has(npc.key)) return false;
    if (!inventory.remove(ItemTypes.NECKLACE.id)) return false;
    this.friends.add(npc.key);
    npc.friend = true;
    npc.giving = false;
    return true;
  }

  spawnRegion(rx, ry) {
    const random = rng(Math.imul(rx, 73856093) ^ Math.imul(ry, 19349663) ^ Math.imul(this.world.seed, 83492791));
    const npcs = [];
    const count = Math.floor(random() * 3);
    // A few attempts per NPC; a region that is mostly water just stays empty.
    for (let i = 0; i < count * 4 && npcs.length < count; i++) {
      const tx = rx * REGION + Math.floor(random() * REGION);
      const ty = ry * REGION + Math.floor(random() * REGION);
      // Judge the tile as generated, not as the player has changed it, so the
      // spawn order (and with it each NPC's key) never depends on chopped trees.
      if (this.world.generate(tx, ty).solid) continue;
      const npc = new Npc((tx + 0.5) * TILE, (ty + 0.5) * TILE, random);
      npc.key = rx + ',' + ry + ',' + npcs.length;
      // Gifts use their own PRNG so they don't shift names, lines or positions.
      const giftRandom = rng(
        Math.imul(rx, 2654435761) ^ Math.imul(ry, 40503) ^ Math.imul(npcs.length + 1, 97) ^ Math.imul(this.world.seed, 2246822519)
      );
      if (giftRandom() < GIFT_CHANCE) npc.gift = RawItems[Math.floor(giftRandom() * RawItems.length)];
      npcs.push(npc);
    }
    return npcs;
  }

  // `inventory` is optional; without it NPCs talk but never hand over gifts.
  update(dt, player, inventory) {
    const prx = Math.floor(player.x / TILE / REGION);
    const pry = Math.floor(player.y / TILE / REGION);
    for (let ry = pry - LOAD_RADIUS; ry <= pry + LOAD_RADIUS; ry++) {
      for (let rx = prx - LOAD_RADIUS; rx <= prx + LOAD_RADIUS; rx++) {
        const key = rx + ',' + ry;
        if (!this.regions.has(key)) this.regions.set(key, this.spawnRegion(rx, ry));
      }
    }
    // Drop regions well behind the player; they respawn the same when revisited.
    for (const key of this.regions.keys()) {
      const [rx, ry] = key.split(',').map(Number);
      if (Math.abs(rx - prx) > LOAD_RADIUS + 1 || Math.abs(ry - pry) > LOAD_RADIUS + 1) this.regions.delete(key);
    }
    for (const npcs of this.regions.values()) {
      for (const npc of npcs) {
        npc.update(dt, player, this.world);
        npc.friend = this.friends.has(npc.key);
        if (!npc.talking) npc.giving = false;
        else if (inventory && npc.gift && !this.gifted.has(npc.key)) {
          inventory.add(npc.gift.id);
          this.gifted.add(npc.key);
          npc.giving = true;
        }
      }
    }
  }

  draw(ctx) {
    for (const npcs of this.regions.values()) {
      for (const npc of npcs) npc.draw(ctx);
    }
  }
}
