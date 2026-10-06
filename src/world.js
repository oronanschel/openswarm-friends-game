export const TILE = 32;

export const Tiles = {
  WATER: { color: '#2b5fa8', solid: true },
  SAND: { color: '#d8c47a', solid: false },
  GRASS: { color: '#4f9a3a', solid: false },
  TREE: { color: '#25602a', solid: true },
};

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
  constructor(seed = 1) {
    this.seed = seed;
    this.cache = new Map();
  }

  tileAt(tx, ty) {
    const key = tx + ',' + ty;
    let tile = this.cache.get(key);
    if (!tile) {
      tile = this.generate(tx, ty);
      this.cache.set(key, tile);
    }
    return tile;
  }

  generate(tx, ty) {
    const height = noise(tx, ty, 24, this.seed) * 0.7 + noise(tx, ty, 6, this.seed + 1) * 0.3;
    if (height < 0.35) return Tiles.WATER;
    if (height < 0.4) return Tiles.SAND;
    if (hash(tx, ty, this.seed + 2) < 0.08) return Tiles.TREE;
    return Tiles.GRASS;
  }

  isSolid(px, py) {
    return this.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)).solid;
  }

  // Find a walkable tile near the origin to spawn on.
  findSpawn() {
    for (let r = 0; r < 200; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (const dy of [-r, r]) {
          if (!this.tileAt(dx, dy).solid) return { x: (dx + 0.5) * TILE, y: (dy + 0.5) * TILE };
        }
      }
    }
    return { x: 0, y: 0 };
  }
}
