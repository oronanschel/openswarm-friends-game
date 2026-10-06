export const TILE = 32;
export const CHUNK = 32; // tiles per chunk side
const MAX_CHUNKS = 256; // ~256K tiles kept in memory

// Ids are stable: append new tiles, never renumber. Save/load relies on them.
export const Tiles = {
  WATER: { id: 0, color: '#2b5fa8', solid: true },
  SAND: { id: 1, color: '#d8c47a', solid: false },
  GRASS: { id: 2, color: '#4f9a3a', solid: false },
  TREE: { id: 3, color: '#25602a', solid: true },
  STUMP: { id: 4, color: '#7a5a34', solid: false },
  SNOW: { id: 5, color: '#e8eef2', solid: false },
  PINE: { id: 6, color: '#1f4a45', solid: true },
};

const COLD = 0.6; // temperature noise above this is snow country

export const TileById = [];
for (const tile of Object.values(Tiles)) TileById[tile.id] = tile;

// Deterministic integer hash -> [0, 1).
function hash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise sampled on a grid of `scale` tiles.
function noise(x, y, scale, seed) {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = smooth(x / scale - gx);
  const fy = smooth(y / scale - gy);
  const top = hash(gx, gy, seed) + (hash(gx + 1, gy, seed) - hash(gx, gy, seed)) * fx;
  const bottom = hash(gx, gy + 1, seed) + (hash(gx + 1, gy + 1, seed) - hash(gx, gy + 1, seed)) * fx;
  return top + (bottom - top) * fy;
}

export class World {
  constructor(seed = 1, maxChunks = MAX_CHUNKS) {
    this.seed = seed;
    this.maxChunks = maxChunks;
    // Map iteration order doubles as LRU order: oldest first.
    this.chunks = new Map();
    this.lastKey = null;
    this.lastChunk = null;
    // Tiles changed by the player: chunk key -> Map(index in chunk -> tile id).
    // Kept apart from `chunks` so changes survive eviction; save/load persists them.
    this.overrides = new Map();
  }

  // Replace the generated tile at (tx, ty) for good.
  setTile(tx, ty, tile) {
    const cx = Math.floor(tx / CHUNK);
    const cy = Math.floor(ty / CHUNK);
    const key = cx + ',' + cy;
    const index = (ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK);
    let changed = this.overrides.get(key);
    if (!changed) this.overrides.set(key, (changed = new Map()));
    changed.set(index, tile.id);
    const chunk = this.chunks.get(key);
    if (chunk) chunk[index] = tile.id;
  }

  // Every changed tile as [tx, ty, id], for save/load.
  changedTiles() {
    const out = [];
    for (const [key, changed] of this.overrides) {
      const [cx, cy] = key.split(',').map(Number);
      for (const [index, id] of changed) {
        out.push([cx * CHUNK + (index % CHUNK), cy * CHUNK + Math.floor(index / CHUNK), id]);
      }
    }
    return out;
  }

  // Replace all changes with a list from changedTiles(); unknown ids are skipped.
  restoreTiles(list) {
    this.overrides.clear();
    this.chunks.clear();
    this.lastKey = null;
    this.lastChunk = null;
    for (const [tx, ty, id] of list) {
      if (Number.isInteger(tx) && Number.isInteger(ty) && TileById[id]) this.setTile(tx, ty, TileById[id]);
    }
  }

  tileAt(tx, ty) {
    const cx = Math.floor(tx / CHUNK);
    const cy = Math.floor(ty / CHUNK);
    const chunk = this.chunk(cx, cy);
    return TileById[chunk[(ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK)]];
  }

  chunk(cx, cy) {
    const key = cx + ',' + cy;
    if (key === this.lastKey) return this.lastChunk;
    let chunk = this.chunks.get(key);
    if (chunk) {
      this.chunks.delete(key);
    } else {
      chunk = this.generateChunk(cx, cy);
      if (this.chunks.size >= this.maxChunks) {
        this.chunks.delete(this.chunks.keys().next().value);
      }
    }
    this.chunks.set(key, chunk);
    this.lastKey = key;
    this.lastChunk = chunk;
    return chunk;
  }

  generateChunk(cx, cy) {
    const ids = new Uint8Array(CHUNK * CHUNK);
    for (let y = 0; y < CHUNK; y++) {
      for (let x = 0; x < CHUNK; x++) {
        ids[y * CHUNK + x] = this.generate(cx * CHUNK + x, cy * CHUNK + y).id;
      }
    }
    const changed = this.overrides.get(cx + ',' + cy);
    if (changed) for (const [index, id] of changed) ids[index] = id;
    return ids;
  }

  // The procedural tile at (tx, ty), ignoring anything the player changed.
  generate(tx, ty) {
    const tile = this.terrain(tx, ty);
    // Biomes only swap a tile for one of the same solidity, so where the player
    // can walk, and everything spawned from that, is the same in every biome.
    if (tile !== Tiles.GRASS && tile !== Tiles.TREE) return tile;
    if (noise(tx, ty, 96, this.seed + 3) <= COLD) return tile;
    return tile === Tiles.GRASS ? Tiles.SNOW : Tiles.PINE;
  }

  // Land, water and trees before biomes are applied.
  terrain(tx, ty) {
    const height = noise(tx, ty, 24, this.seed) * 0.7 + noise(tx, ty, 6, this.seed + 1) * 0.3;
    if (height < 0.35) return Tiles.WATER;
    if (height < 0.4) return Tiles.SAND;
    if (hash(tx, ty, this.seed + 2) < 0.08) return Tiles.TREE;
    return Tiles.GRASS;
  }

  isSolid(px, py) {
    return this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)).solid;
  }

  // True if at least `min` walkable tiles are 4-connected to (tx, ty).
  hasRoom(tx, ty, min) {
    if (this.tileAt(tx, ty).solid) return false;
    if (min <= 1) return true;
    const seen = new Set([tx + ',' + ty]);
    const queue = [[tx, ty]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const key = nx + ',' + ny;
        if (seen.has(key) || this.tileAt(nx, ny).solid) continue;
        seen.add(key);
        if (seen.size >= min) return true;
        queue.push([nx, ny]);
      }
    }
    return false;
  }

  // Find a walkable tile near the origin that isn't boxed in.
  findSpawn(minRoom = 64) {
    for (let r = 0; r < 200; r++) {
      for (let dy = -r; dy <= r; dy++) {
        // Full ring: every tile at Chebyshev distance r.
        const edge = dy === -r || dy === r;
        for (let dx = -r; dx <= r; dx += edge ? 1 : 2 * r) {
          if (this.hasRoom(dx, dy, minRoom)) return { x: (dx + 0.5) * TILE, y: (dy + 0.5) * TILE };
        }
      }
    }
    return { x: 0, y: 0 };
  }
}
