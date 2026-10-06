import test from 'node:test';
import assert from 'node:assert/strict';
import { Player, BOOST, BOOST_SECONDS, RADIUS } from '../src/player.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes } from '../src/items.js';
import { TILE } from '../src/world.js';

const JAM = ItemTypes.JAM;
const open = { isSolid: () => false };
const right = new Set(['ArrowRight']);

// Distance walked to the right in one update of `dt` seconds.
function step(player, dt, world = open) {
  const before = player.x;
  player.update(dt, right, world);
  return player.x - before;
}

test('eating uses up one jam and speeds the player up', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  const normal = step(player, 0.1);
  inventory.add(JAM.id, 2);
  assert.equal(player.eat(inventory, JAM), true);
  assert.equal(inventory.count(JAM.id), 1);
  assert.ok(Math.abs(step(player, 0.1) - normal * BOOST) < 1e-9);
});

test('eating without jam changes nothing', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  inventory.add(ItemTypes.BERRY.id, 3);
  const normal = step(player, 0.1);
  assert.equal(player.eat(inventory, JAM), false);
  assert.equal(player.eat(inventory, undefined), false);
  assert.equal(player.boost, 0);
  assert.equal(inventory.count(ItemTypes.BERRY.id), 3);
  assert.ok(Math.abs(step(player, 0.1) - normal) < 1e-9);
});

test('the boost runs out after BOOST_SECONDS', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  inventory.add(JAM.id);
  const normal = step(player, 0.1);
  player.eat(inventory, JAM);
  for (let t = 0; t < BOOST_SECONDS * 10 + 1; t++) player.update(0.1, new Set(), open);
  assert.equal(player.boost, 0);
  assert.ok(Math.abs(step(player, 0.1) - normal) < 1e-9);
});

test('eating again restarts the timer without stacking speed', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  inventory.add(JAM.id, 2);
  player.eat(inventory, JAM);
  const boosted = step(player, 0.1);
  player.update(5, new Set(), open);
  player.eat(inventory, JAM);
  assert.equal(player.boost, BOOST_SECONDS);
  assert.ok(Math.abs(step(player, 0.1) - boosted) < 1e-9);
});

test('a boosted player still stops flush against a wall', () => {
  // Everything from x = 2 tiles onwards is solid.
  const wall = { isSolid: (x) => x >= TILE * 2 };
  const player = new Player(TILE, TILE / 2);
  const inventory = new Inventory();
  inventory.add(JAM.id);
  player.eat(inventory, JAM);
  for (let i = 0; i < 20; i++) player.update(0.1, right, wall);
  assert.ok(player.x + RADIUS < TILE * 2);
  assert.ok(TILE * 2 - (player.x + RADIUS) < 0.01);
});

test('update reports the end of a boost exactly once', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  inventory.add(JAM.id);
  const idle = new Set();
  // Never boosted: nothing to report.
  assert.equal(player.update(0.1, idle, open), false);
  player.eat(inventory, JAM);
  let ends = 0;
  for (let t = 0; t < BOOST_SECONDS * 10 + 20; t++) {
    if (player.update(0.1, idle, open)) ends++;
  }
  assert.equal(ends, 1);
});

// Records arc() calls; every other canvas method is a no-op.
function arcs(player) {
  const calls = [];
  const ctx = new Proxy(
    { arc: (...args) => calls.push(args) },
    { get: (target, name) => (name in target ? target[name] : () => {}), set: () => true }
  );
  player.draw(ctx);
  return calls;
}

test('a ring is drawn only while boosted and shrinks with the time left', () => {
  const player = new Player(0, 0);
  const inventory = new Inventory();
  inventory.add(JAM.id);
  assert.equal(arcs(player).length, 1);
  player.eat(inventory, JAM);
  const full = arcs(player);
  assert.equal(full.length, 2);
  assert.ok(full[1][2] > RADIUS);
  assert.ok(Math.abs(full[1][4] - full[1][3] - Math.PI * 2) < 1e-9);
  player.update(BOOST_SECONDS / 2, new Set(), open);
  const half = arcs(player)[1];
  assert.ok(Math.abs(half[4] - half[3] - Math.PI) < 1e-9);
  player.update(BOOST_SECONDS, new Set(), open);
  assert.equal(arcs(player).length, 1);
});
