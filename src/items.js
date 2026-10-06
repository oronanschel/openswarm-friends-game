import { TILE, Tiles } from './world.js';

const REGION = 16; // tiles per side of a spawn region
const LOAD_RADIUS = 2; // regions kept populated around the player
const DENSITY = 0.015; // chance a walkable tile holds an item
const PICKUP_DISTANCE = 18;
const SIZE = 6;
const MIN_ROOM = 16; // walkable tiles that must connect to an item's tile

// Ids are stable: append new items, never renumber. Save/load relies on them.
export const ItemTypes = {
  BERRY: { id: 0, name: 'Berry', color: '#c2185b' },
  STONE: { id: 1, name: 'Stone', color: '#9e9e9e' },
  SHELL: { id: 2, name: 'Shell', color: '#ffccbc' },
};

export const ItemById = [];
for (const type of Object.values(ItemTypes)) ItemById[type.id] = type;

// Deterministic integer hash -> [0, 1); salted differently from world gen.
function hash(x, y, seed) {
  let h = (Math.imul(x, 668265263) + Math.imul(y, 374761393) + Math.imul(seed ^ 0x5bd1e995, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Items {
  constructor(world) {
    this.world = world;
    this.regions = new Map();
    // Tile keys of picked-up items, so they stay gone when a region reloads.
    this.collected = new Set();
  }

  // Every item in a loaded region, for other systems such as the minimap.
  get all() {
    return [...this.regions.values()].flat();
  }

  spawnRegion(rx, ry) {
    const items = [];
    for (let y = 0; y < REGION; y++) {
      for (let x = 0; x < REGION; x++) {
        const tx = rx * REGION + x;
        const ty = ry * REGION + y;
        if (hash(tx, ty, this.world.seed) >= DENSITY) continue;
        const key = tx + ',' + ty;
        if (this.collected.has(key)) continue;
        const tile = this.world.tileAt(tx, ty);
        // Skip tiles boxed in by trees or water: the player could never reach them.
        if (!this.world.hasRoom(tx, ty, MIN_ROOM)) continue;
        const roll = hash(tx, ty, this.world.seed + 1);
        const type = tile === Tiles.SAND ? ItemTypes.SHELL : roll < 0.6 ? ItemTypes.BERRY : ItemTypes.STONE;
        items.push({ key, type, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
      }
    }
    return items;
  }

  update(player, inventory) {
    const prx = Math.floor(player.x / TILE / REGION);
    const pry = Math.floor(player.y / TILE / REGION);
    for (let ry = pry - LOAD_RADIUS; ry <= pry + LOAD_RADIUS; ry++) {
      for (let rx = prx - LOAD_RADIUS; rx <= prx + LOAD_RADIUS; rx++) {
        const key = rx + ',' + ry;
        if (!this.regions.has(key)) this.regions.set(key, this.spawnRegion(rx, ry));
      }
    }
    for (const key of this.regions.keys()) {
      const [rx, ry] = key.split(',').map(Number);
      if (Math.abs(rx - prx) > LOAD_RADIUS + 1 || Math.abs(ry - pry) > LOAD_RADIUS + 1) this.regions.delete(key);
    }
    // Only the player's region and its neighbours can be within reach.
    for (let ry = pry - 1; ry <= pry + 1; ry++) {
      for (let rx = prx - 1; rx <= prx + 1; rx++) {
        const key = rx + ',' + ry;
        const items = this.regions.get(key);
        const kept = items.filter((item) => {
          if (Math.hypot(player.x - item.x, player.y - item.y) >= PICKUP_DISTANCE) return true;
          this.collected.add(item.key);
          inventory.add(item.type.id);
          return false;
        });
        if (kept.length !== items.length) this.regions.set(key, kept);
      }
    }
  }

  draw(ctx) {
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 1;
    for (const items of this.regions.values()) {
      for (const item of items) {
        ctx.fillStyle = item.type.color;
        ctx.fillRect(item.x - SIZE / 2, item.y - SIZE / 2, SIZE, SIZE);
        ctx.strokeRect(item.x - SIZE / 2, item.y - SIZE / 2, SIZE, SIZE);
      }
    }
  }
}
