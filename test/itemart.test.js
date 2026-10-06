import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemTypes } from '../src/items.js';
import { drawItemArt, ART_SIZE } from '../src/itemart.js';

// Records every coordinate passed to the path and rect calls.
function recorder() {
  const points = [];
  const state = { saves: 0, restores: 0 };
  const ctx = {
    save: () => state.saves++,
    restore: () => state.restores++,
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    moveTo: (x, y) => points.push([x, y]),
    lineTo: (x, y) => points.push([x, y]),
    fillRect: (x, y, w, h) => points.push([x, y], [x + w, y + h]),
    strokeRect: (x, y, w, h) => points.push([x, y], [x + w, y + h]),
    arc: (x, y, r) => points.push([x - r, y - r], [x + r, y + r]),
  };
  return { ctx, points, state };
}

test('every item type is drawn inside its box', () => {
  for (const type of Object.values(ItemTypes)) {
    const { ctx, points, state } = recorder();
    assert.equal(drawItemArt(ctx, type, 100, -40), true, type.name);
    assert.ok(points.length > 0);
    for (const [px, py] of points) {
      assert.ok(Math.abs(px - 100) <= ART_SIZE / 2 && Math.abs(py + 40) <= ART_SIZE / 2, `${type.name} ${px},${py}`);
    }
    assert.equal(state.saves, state.restores);
  }
});

test('an unknown item type draws nothing so the caller can fall back', () => {
  const { ctx, points } = recorder();
  assert.equal(drawItemArt(ctx, { name: 'Mystery', color: '#000' }, 0, 0), false);
  assert.equal(points.length, 0);
});
