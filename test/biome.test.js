import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Tiles, TileById } from '../src/world.js';
import { Inventory } from '../src/inventory.js';
import { chop } from '../src/chop.js';
import { TILE } from '../src/world.js';

const SPAN = 300; // tiles each side of the origin sampled below

function census(seed) {
  const world = new World(seed);
  const counts = new Map();
  for (let ty = -SPAN; ty < SPAN; ty += 2) {
    for (let tx = -SPAN; tx < SPAN; tx += 2) {
      const tile = world.generate(tx, ty);
      counts.set(tile, (counts.get(tile) || 0) + 1);
    }
  }
  return counts;
}

test('new tile ids are appended and round-trip', () => {
  assert.equal(Tiles.SNOW.id, 5);
  assert.equal(Tiles.PINE.id, 6);
  assert.equal(TileById[5], Tiles.SNOW);
  assert.equal(TileById[6], Tiles.PINE);
});

test('biomes never change where the player can walk', () => {
  for (const seed of [1, 7, 1337]) {
    const world = new World(seed);
    for (let ty = -SPAN; ty < SPAN; ty += 3) {
      for (let tx = -SPAN; tx < SPAN; tx += 3) {
        const before = world.terrain(tx, ty);
        const after = world.generate(tx, ty);
        assert.equal(after.solid, before.solid, `seed ${seed} at ${tx},${ty}`);
        // Water and sand are left alone, so shells still spawn on the same tiles.
        if (before === Tiles.WATER || before === Tiles.SAND) assert.equal(after, before);
        if (after === Tiles.SNOW) assert.equal(before, Tiles.GRASS);
        if (after === Tiles.PINE) assert.equal(before, Tiles.TREE);
      }
    }
  }
});

test('both biomes exist within a few hundred tiles, and snow is the smaller one', () => {
  for (const seed of [1, 7, 1337]) {
    const counts = census(seed);
    const snow = counts.get(Tiles.SNOW) || 0;
    const grass = counts.get(Tiles.GRASS) || 0;
    assert.ok(snow > 0, `seed ${seed} has no snow`);
    assert.ok((counts.get(Tiles.PINE) || 0) > 0, `seed ${seed} has no pines`);
    assert.ok(grass > snow, `seed ${seed}: grass ${grass}, snow ${snow}`);
  }
});

test('snow comes in regions, not speckles', () => {
  const world = new World(1337);
  let same = 0;
  let total = 0;
  for (let ty = -SPAN; ty < SPAN; ty += 3) {
    for (let tx = -SPAN; tx < SPAN; tx += 3) {
      const a = world.generate(tx, ty);
      const b = world.generate(tx + 1, ty);
      const cold = (t) => t === Tiles.SNOW || t === Tiles.PINE;
      const land = (t) => t !== Tiles.WATER && t !== Tiles.SAND;
      if (!land(a) || !land(b)) continue;
      total++;
      if (cold(a) === cold(b)) same++;
    }
  }
  assert.ok(same / total > 0.97, `only ${((same / total) * 100).toFixed(1)}% of neighbours share a biome`);
});

test('pines can be chopped like trees', () => {
  const world = new World(1);
  world.generate = () => Tiles.SNOW;
  world.setTile(1, 0, Tiles.PINE);
  const axe = { id: 99 };
  const inventory = new Inventory();
  inventory.add(axe.id);
  assert.deepEqual(chop(world, { x: 0.5 * TILE, y: 0.5 * TILE }, inventory, axe), { tx: 1, ty: 0 });
  assert.equal(world.tileAt(1, 0), Tiles.STUMP);
});
