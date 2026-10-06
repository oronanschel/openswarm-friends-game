import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { Items, ItemTypes, ItemById } from '../src/items.js';
import { Inventory } from '../src/inventory.js';

const keys = (items) => items.all.map((item) => item.key + ':' + item.type.id).sort();

test('item ids are unique and round-trip', () => {
  for (const type of Object.values(ItemTypes)) assert.equal(ItemById[type.id], type);
});

test('items spawn deterministically and never on solid tiles', () => {
  const world = new World(1337);
  const player = world.findSpawn();
  const a = new Items(world);
  const b = new Items(world);
  a.update(player, new Inventory());
  b.update(player, new Inventory());
  assert.ok(a.all.length > 0, 'no items near spawn');
  assert.deepEqual(keys(a), keys(b));
  for (const item of a.all) {
    assert.equal(world.isSolid(item.x, item.y), false);
  }
});

test('walking onto an item picks it up and it stays gone after reload', () => {
  const world = new World(1337);
  const spawn = world.findSpawn();
  const items = new Items(world);
  const inventory = new Inventory();
  items.update(spawn, inventory);
  const target = items.all[0];
  const region = Math.floor(target.x / TILE / 16) + ',' + Math.floor(target.y / TILE / 16);

  items.update({ x: target.x, y: target.y }, inventory);
  assert.equal(inventory.count(target.type.id), 1);
  assert.ok(!items.all.some((item) => item.key === target.key));

  // Walk far away so the region unloads, then come back.
  items.update({ x: target.x + 16 * TILE * 20, y: target.y }, inventory);
  assert.equal(items.regions.has(region), false);
  items.update({ x: target.x + 2 * TILE * 16, y: target.y }, inventory);
  assert.equal(items.regions.has(region), true);
  assert.ok(!items.all.some((item) => item.key === target.key), 'collected item respawned');
});

test('inventory counts accumulate', () => {
  const inventory = new Inventory();
  inventory.add(ItemTypes.BERRY.id);
  inventory.add(ItemTypes.BERRY.id, 2);
  assert.equal(inventory.count(ItemTypes.BERRY.id), 3);
  assert.equal(inventory.count(ItemTypes.STONE.id), 0);
});
