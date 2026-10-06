import test from 'node:test';
import assert from 'node:assert/strict';
import { Tiles, TILE } from '../src/world.js';
import { baseColor, hasArt, drawTileArt } from '../src/tileart.js';

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

test('trees stand on grass and pines on snow; other tiles keep their colour', () => {
  assert.equal(baseColor(Tiles.TREE), Tiles.GRASS.color);
  assert.equal(baseColor(Tiles.PINE), Tiles.SNOW.color);
  for (const tile of Object.values(Tiles)) {
    if (tile === Tiles.TREE || tile === Tiles.PINE) {
      assert.equal(hasArt(tile), true);
    } else {
      assert.equal(hasArt(tile), false);
      assert.equal(baseColor(tile), tile.color);
    }
  }
});

test('art stays inside its tile, wherever the tile is', () => {
  for (const tile of [Tiles.TREE, Tiles.PINE]) {
    for (const [x, y] of [[0, 0], [-5 * TILE, 7 * TILE]]) {
      const { ctx, points, fills } = recorder();
      assert.equal(drawTileArt(ctx, tile, x, y), true);
      assert.ok(points.length > 0);
      for (const [px, py] of points) {
        assert.ok(px >= x && px <= x + TILE && py >= y && py <= y + TILE, `${px},${py}`);
      }
      // The tile's own colour is used, so it still matches the minimap.
      assert.ok(fills.includes(tile.color));
    }
  }
});

test('tiles without art draw nothing', () => {
  for (const tile of Object.values(Tiles)) {
    if (hasArt(tile)) continue;
    const { ctx, points, fills } = recorder();
    assert.equal(drawTileArt(ctx, tile, 0, 0), false);
    assert.equal(points.length + fills.length, 0);
  }
});
