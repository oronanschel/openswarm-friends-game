import test from 'node:test';
import assert from 'node:assert/strict';
import { Zombies, MAX_ZOMBIES, SPAWN_MIN, SPAWN_MAX, NOTICE, SPEED, TOUCH, SHOVE, DAZED } from '../src/zombies.js';
import { World, Tiles, TILE } from '../src/world.js';
import { Player } from '../src/player.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes, RawItems } from '../src/items.js';
import { DARK_RADIUS } from '../src/darkmode.js';
import { Effects } from '../src/sound.js';

// A repeatable stand-in for Math.random.
function seeded(seed = 1) {
  let a = seed;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) | 0;
    return (a >>> 0) / 4294967296;
  };
}

// Open ground everywhere, with tileAt for the player's own checks.
const open = { isSolid: () => false, tileAt: () => Tiles.GRASS };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rawTotal = (inventory) => RawItems.reduce((sum, type) => sum + inventory.count(type.id), 0);

test('zombies appear only in dark mode and vanish when it is turned off', () => {
  const zombies = new Zombies(open, seeded());
  const player = new Player(0, 0);
  for (let i = 0; i < 100; i++) zombies.update(1 / 60, player, false, new Inventory());
  assert.equal(zombies.all.length, 0);

  for (let i = 0; i < 20; i++) zombies.update(1 / 60, player, true, new Inventory());
  assert.equal(zombies.all.length, MAX_ZOMBIES);
  // Never more than the cap, however long it runs.
  for (let i = 0; i < 200; i++) zombies.update(1 / 60, player, true, new Inventory());
  assert.equal(zombies.all.length, MAX_ZOMBIES);

  assert.deepEqual(zombies.update(1 / 60, player, false, new Inventory()), []);
  assert.equal(zombies.all.length, 0);
});

test('they appear out of the light, on a ring around the player', () => {
  const zombies = new Zombies(open, seeded(7));
  const player = { x: 1000, y: -500 };
  for (let i = 0; i < 500; i++) {
    if (zombies.spawn(player)) {
      const d = dist(zombies.all.at(-1), player);
      // Snapped to a tile centre, so allow most of a tile either way.
      assert.ok(d > SPAWN_MIN - TILE && d < SPAWN_MAX + TILE, String(d));
      assert.ok(d > DARK_RADIUS * 2);
    }
  }
  assert.ok(zombies.all.length > 400);
});

test('they never appear on water or in a tree, and stay on land', () => {
  const world = new World(1337);
  const spawn = world.findSpawn();
  const zombies = new Zombies(world, seeded(3));
  const player = new Player(spawn.x, spawn.y);
  const corners = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
  for (let i = 0; i < 1800; i++) {
    zombies.update(1 / 60, player, true, new Inventory());
    for (const zombie of zombies.all) {
      for (const [ox, oy] of corners) assert.ok(!world.isSolid(zombie.x + ox, zombie.y + oy), 'zombie inside a solid tile');
    }
  }
  assert.ok(zombies.all.length > 0);
});

test('a zombie that notices the player shuffles towards them, slower than the player walks', () => {
  const zombies = new Zombies(open, seeded());
  const player = new Player(0, 0);
  zombies.all.push({ x: NOTICE - 20, y: 0, dx: 0, dy: 1, timer: 5, dazed: 0 });
  const zombie = zombies.all[0];
  const before = dist(zombie, player);
  // Keep the cap full so no newcomer joins in.
  while (zombies.all.length < MAX_ZOMBIES) zombies.all.push({ x: 5000, y: 5000, dx: 0, dy: 1, timer: 99, dazed: 99 });
  zombies.update(1, player, true, new Inventory());
  const moved = before - dist(zombie, player);
  assert.ok(Math.abs(moved - SPEED) < 1e-6, String(moved));
  assert.ok(SPEED < 160 / 2);

  // Out of range it does not home in.
  const far = { x: NOTICE + 200, y: 0, dx: 0, dy: 1, timer: 5, dazed: 0 };
  zombies.all[0] = far;
  zombies.update(1, player, true, new Inventory());
  assert.equal(far.x, NOTICE + 200);
});

// A zombie right beside the player, with the cap full of far-off dazed ones.
function contact(inventory, world = open, seed = 1) {
  const zombies = new Zombies(world, seeded(seed));
  const player = new Player(TILE * 4.5, TILE * 4.5);
  zombies.all.push({ x: player.x - TOUCH + 4, y: player.y, dx: 1, dy: 0, timer: 5, dazed: 0 });
  while (zombies.all.length < MAX_ZOMBIES) zombies.all.push({ x: player.x + 600, y: player.y, dx: 0, dy: 1, timer: 99, dazed: 99 });
  const start = { x: player.x, y: player.y };
  const events = zombies.update(1 / 60, player, true, inventory);
  return { zombies, player, start, events, zombie: zombies.all[0] };
}

test('a grab takes exactly one raw item, shoves the player away and dazes the zombie', () => {
  const inventory = new Inventory();
  inventory.add(ItemTypes.BERRY.id, 3);
  inventory.add(ItemTypes.SHELL.id, 2);
  const { player, start, events, zombie, zombies } = contact(inventory);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'grab');
  assert.ok(RawItems.includes(events[0].item));
  assert.equal(rawTotal(inventory), 4);
  // Shoved straight away from the zombie, which stood to the left.
  assert.ok(Math.abs(player.x - start.x - SHOVE) < 1e-6);
  assert.equal(player.y, start.y);
  assert.equal(zombie.dazed, DAZED);

  // Dazed: it neither moves nor grabs again, even with the player back on it.
  player.x = zombie.x;
  player.y = zombie.y;
  const at = { x: zombie.x, y: zombie.y };
  for (let i = 0; i < 60; i++) assert.deepEqual(zombies.update(1 / 60, player, true, inventory), []);
  assert.deepEqual({ x: zombie.x, y: zombie.y }, at);
  assert.equal(rawTotal(inventory), 4);
  // Once the daze wears off it grabs again.
  let grabbed = 0;
  for (let i = 0; i < DAZED * 60; i++) grabbed += zombies.update(1 / 60, player, true, inventory).length;
  assert.ok(grabbed >= 1);
});

test('crafted things and wood are never taken; with nothing to take it only shoves', () => {
  const inventory = new Inventory();
  for (const type of [ItemTypes.STONE_AXE, ItemTypes.NECKLACE, ItemTypes.JAM, ItemTypes.WOOD, ItemTypes.RAFT]) inventory.add(type.id, 2);
  const before = [...inventory.counts];
  const { player, start, events } = contact(inventory);
  assert.deepEqual(events, [{ type: 'grab', item: null }]);
  assert.deepEqual([...inventory.counts], before);
  assert.ok(player.x > start.x);

  // No inventory at all is fine too.
  assert.deepEqual(contact(undefined).events, [{ type: 'grab', item: null }]);
});

test('over many grabs every raw item is taken sometimes', () => {
  const taken = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const inventory = new Inventory();
    for (const type of RawItems) inventory.add(type.id, 1);
    // Spread the seeds out: neighbouring ones start this generator alike.
    taken.add(contact(inventory, open, Math.imul(seed, 2654435761)).events[0].item);
  }
  assert.equal(taken.size, RawItems.length);
});

test('the shove never puts the player inside a wall', () => {
  // Solid from two tiles to the right of the player onwards; SHOVE would
  // carry the player's edge into it.
  const wallX = TILE * 5.5;
  const world = { isSolid: (x) => x >= wallX, tileAt: (tx) => (tx * TILE >= wallX ? Tiles.TREE : Tiles.GRASS) };
  const { player, start } = contact(new Inventory(), world);
  assert.ok(!player.collides(player.x, player.y, world));
  assert.ok(player.x >= start.x && player.x + 10 < wallX);

  // Boxed in completely: the player stays put.
  const boxed = { isSolid: (x, y) => Math.hypot(x - TILE * 4.5, y - TILE * 4.5) > 16, tileAt: () => Tiles.TREE };
  const stuck = contact(new Inventory(), boxed);
  assert.deepEqual({ x: stuck.player.x, y: stuck.player.y }, stuck.start);
});

test('a zombie left far behind is dropped', () => {
  const zombies = new Zombies(open, seeded());
  const player = new Player(0, 0);
  for (let i = 0; i < 20; i++) zombies.update(1 / 60, player, true, new Inventory());
  const old = [...zombies.all];
  player.x = 5000;
  zombies.update(1 / 60, player, true, new Inventory());
  for (const zombie of old) assert.ok(!zombies.all.includes(zombie));
});

// Records arc() calls; every other canvas method is a no-op.
test('each zombie is drawn, and nothing when there are none', () => {
  const arcs = [];
  const ctx = new Proxy({ arc: (...args) => arcs.push(args) }, { get: (t, name) => (name in t ? t[name] : () => {}), set: () => true });
  const zombies = new Zombies(open, seeded());
  zombies.draw(ctx);
  assert.equal(arcs.length, 0);
  zombies.all.push({ x: 5, y: 6, dx: 0, dy: 1, timer: 0, dazed: 0 }, { x: 50, y: 60, dx: 1, dy: 0, timer: 0, dazed: 2 });
  zombies.draw(ctx);
  assert.deepEqual(arcs.map((a) => a.slice(0, 2)), [[5, 6], [50, 60]]);
});

test('there is a groan sound for the grab', () => {
  assert.ok(Effects.groan.length > 0);
  for (const [freq, start, length] of Effects.groan) assert.ok(freq > 0 && start >= 0 && length > 0);
});
