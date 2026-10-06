import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Tiles, TILE } from '../src/world.js';
import { baseColor, groundColor, hasArt, drawTileArt } from '../src/tileart.js';

// Records every coordinate pair passed to the path and rect calls.
function recorder() {
  const points = [];
  const fills = [];
  const ctx = {
    set fillStyle(value) {
      fills.push(value);
    },
    beginPath() {},
    closePath() {},
    fill() {},
    moveTo: (x, y) => points.push([x, y]),
    lineTo: (x, y) => points.push([x, y]),
    fillRect: (x, y, w, h) => points.push([x, y], [x + w, y + h]),
    arc: (x, y, r) => points.push([x - r, y - r], [x + r, y + r]),
  };
  return { ctx, points, fills };
}

const ALWAYS = [Tiles.TREE, Tiles.PINE, Tiles.STUMP];
const NEVER = [Tiles.GRASS, Tiles.SAND, Tiles.SNOW];

test('trees stand on grass and pines on snow; other tiles keep their colour', () => {
  assert.equal(baseColor(Tiles.TREE), Tiles.GRASS.color);
  assert.equal(baseColor(Tiles.PINE), Tiles.SNOW.color);
  for (const tile of Object.values(Tiles)) {
    if (tile !== Tiles.TREE && tile !== Tiles.PINE) assert.equal(baseColor(tile), tile.color);
  }
  for (const tile of ALWAYS) assert.equal(hasArt(tile, 3, -8), true);
  for (const tile of NEVER) assert.equal(hasArt(tile, 3, -8), false);
});

test('art stays inside its tile, wherever the tile is', () => {
  for (const tile of [...ALWAYS, Tiles.WATER]) {
    for (const [x, y] of [[0, 0], [-5 * TILE, 7 * TILE]]) {
      const { ctx, points, fills } = recorder();
      assert.equal(drawTileArt(ctx, tile, x, y), true);
      assert.ok(points.length > 0);
      for (const [px, py] of points) {
        assert.ok(px >= x && px <= x + TILE && py >= y && py <= y + TILE, `${px},${py}`);
      }
      // Solid shapes use the tile's own colour, so they still match the minimap.
      if (tile !== Tiles.WATER) assert.ok(fills.includes(tile.color));
    }
  }
});

test('tiles without art draw nothing', () => {
  for (const tile of NEVER) {
    const { ctx, points, fills } = recorder();
    assert.equal(drawTileArt(ctx, tile, 0, 0), false);
    assert.equal(points.length + fills.length, 0);
  }
});

test('about a fifth of water tiles ripple, the same ones every time', () => {
  let rippling = 0;
  for (let ty = -50; ty < 50; ty++) {
    for (let tx = -50; tx < 50; tx++) {
      const first = hasArt(Tiles.WATER, tx, ty);
      assert.equal(hasArt(Tiles.WATER, tx, ty), first);
      if (first) rippling++;
    }
  }
  assert.ok(rippling > 1500 && rippling < 2500, String(rippling));
  // Not a visible pattern: no row or column is all ripples or has none.
  for (let i = -50; i < 50; i++) {
    let row = 0;
    let column = 0;
    for (let j = -50; j < 50; j++) {
      if (hasArt(Tiles.WATER, j, i)) row++;
      if (hasArt(Tiles.WATER, i, j)) column++;
    }
    assert.ok(row > 3 && row < 45 && column > 3 && column < 45, `line ${i}: ${row}, ${column}`);
  }
});

// The first tile of a kind, searching outwards from the origin.
function find(world, tile) {
  for (let r = 0; r < 200; r++) {
    for (let ty = -r; ty <= r; ty++) {
      for (let tx = -r; tx <= r; tx++) {
        if (world.tileAt(tx, ty) === tile) return { tx, ty };
      }
    }
  }
  return null;
}

test('a stump is filled with the ground its tree stood on', () => {
  const world = new World(1337);
  const tree = find(world, Tiles.TREE);
  assert.equal(groundColor(world, tree.tx, tree.ty), Tiles.GRASS.color);
  world.setTile(tree.tx, tree.ty, Tiles.STUMP);
  assert.equal(groundColor(world, tree.tx, tree.ty), Tiles.GRASS.color);

  // A stump where the generator made bare ground keeps that ground.
  const sand = find(world, Tiles.SAND);
  world.setTile(sand.tx, sand.ty, Tiles.STUMP);
  assert.equal(groundColor(world, sand.tx, sand.ty), Tiles.SAND.color);

  // Anything that is not a stump is its base colour.
  const water = find(world, Tiles.WATER);
  assert.equal(groundColor(world, water.tx, water.ty), Tiles.WATER.color);
});

test('a chopped pine leaves its stump on snow', () => {
  // Snow country can be far from the origin, so look across a few seeds.
  for (let seed = 1; seed <= 20; seed++) {
    const world = new World(seed);
    const pine = find(world, Tiles.PINE);
    if (!pine) continue;
    world.setTile(pine.tx, pine.ty, Tiles.STUMP);
    assert.equal(groundColor(world, pine.tx, pine.ty), Tiles.SNOW.color);
    return;
  }
  assert.fail('no pine found in any seed');
});
