import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { Items, ItemTypes, RawItems } from '../src/items.js';
import { Inventory } from '../src/inventory.js';
import { DayNight, CYCLE } from '../src/daynight.js';
import { serialize, apply } from '../src/save.js';

const world = new World(1337);
const spawn = world.findSpawn();
const total = (inventory) => RawItems.reduce((sum, type) => sum + inventory.count(type.id), 0);

// Villagers loaded, the first one befriended on `day`, with the player beside
// it. The inventory starts empty: any first-meeting gift is taken out again.
function friendOn(day) {
  const npcs = new Npcs(world);
  npcs.update(1 / 60, spawn);
  const npc = npcs.all[0];
  const near = { x: npc.x + 20, y: npc.y };
  const inventory = new Inventory();
  npcs.update(1 / 60, near, inventory, day);
  inventory.add(ItemTypes.NECKLACE.id);
  assert.equal(npcs.befriend(npc, inventory), true);
  inventory.counts.clear();
  npcs.update(1 / 60, near, inventory, day);
  return { npcs, npc, near, inventory };
}

test('the clock counts days as it wraps', () => {
  const clock = new DayNight();
  assert.equal(clock.day, 0);
  clock.update(CYCLE - 1);
  assert.equal(clock.day, 0);
  clock.update(2);
  assert.equal(clock.day, 1);
  assert.ok(Math.abs(clock.time - 1) < 1e-9);
  // A long step still counts every day it covers.
  clock.update(CYCLE * 3);
  assert.equal(clock.day, 4);
});

test('a new friend gives nothing the same day and one item the next', () => {
  const { npcs, npc, near, inventory } = friendOn(3);
  assert.equal(total(inventory), 0);
  assert.equal(npcs.friendGifts.get(npc.key), 3);
  for (let i = 0; i < 10; i++) npcs.update(1 / 60, near, inventory, 3);
  assert.equal(total(inventory), 0);

  npcs.update(1 / 60, near, inventory, 4);
  assert.equal(total(inventory), 1);
  assert.equal(npc.giving, true);
  assert.ok(RawItems.includes(npc.given));
  assert.equal(inventory.count(npc.given.id), 1);
  // Only once that day, however long the player stays.
  for (let i = 0; i < 10; i++) npcs.update(1 / 60, near, inventory, 4);
  assert.equal(total(inventory), 1);

  // Several days away still means one gift on return, not one per day missed.
  npcs.update(1 / 60, near, inventory, 9);
  assert.equal(total(inventory), 2);
});

test('the gift waits until the player actually talks to the friend', () => {
  const { npcs, npc, near, inventory } = friendOn(0);
  const far = { x: npc.x + 300, y: npc.y };
  for (let i = 0; i < 5; i++) npcs.update(1 / 60, far, inventory, 1);
  assert.equal(total(inventory), 0);
  assert.equal(npc.giving, false);
  npcs.update(1 / 60, { x: npc.x + 20, y: npc.y }, inventory, 1);
  assert.equal(total(inventory), 1);
  assert.ok(near);
});

test('villagers who are not friends give no daily gift', () => {
  const npcs = new Npcs(world);
  npcs.update(1 / 60, spawn);
  const npc = npcs.all[0];
  const near = { x: npc.x + 20, y: npc.y };
  const inventory = new Inventory();
  npcs.update(1 / 60, near, inventory, 0);
  const afterMeeting = total(inventory);
  for (let day = 1; day < 6; day++) npcs.update(1 / 60, near, inventory, day);
  assert.equal(total(inventory), afterMeeting);
  assert.equal(npcs.friendGifts.size, 0);
});

test('without a day or an inventory nothing is given and nothing breaks', () => {
  const { npcs, near, inventory } = friendOn(0);
  npcs.update(1 / 60, near, inventory);
  npcs.update(1 / 60, near, undefined, 5);
  assert.equal(total(inventory), 0);
  // The gift is still there to collect once an inventory is passed.
  npcs.update(1 / 60, near, inventory, 5);
  assert.equal(total(inventory), 1);
});

test('the item is fixed by villager and day, and varies over days', () => {
  const seen = new Set();
  for (let day = 1; day <= 30; day++) {
    const a = friendOn(0);
    a.npcs.update(1 / 60, a.near, a.inventory, day);
    const b = friendOn(0);
    b.npcs.update(1 / 60, b.near, b.inventory, day);
    assert.equal(a.npc.given, b.npc.given, `day ${day}`);
    seen.add(a.npc.given);
  }
  assert.equal(seen.size, RawItems.length);
});

test('the day and the last gift days survive a save and load', () => {
  const { npcs, npc, near, inventory } = friendOn(2);
  npcs.update(1 / 60, near, inventory, 3);
  assert.equal(total(inventory), 1);
  const clock = new DayNight(100);
  clock.day = 3;
  const state = { world, player: new Player(spawn.x, spawn.y), inventory, items: new Items(world), npcs, dayNight: clock };
  const data = JSON.parse(JSON.stringify(serialize(state)));
  assert.equal(data.day, 3);
  assert.deepEqual(data.friendGifts, [[npc.key, 3]]);

  const fresh = {
    world,
    player: new Player(spawn.x, spawn.y),
    inventory: new Inventory(),
    items: new Items(world),
    npcs: new Npcs(world),
    dayNight: new DayNight(),
  };
  assert.equal(apply(data, fresh), true);
  assert.equal(fresh.dayNight.day, 3);
  assert.equal(fresh.npcs.friendGifts.get(npc.key), 3);
  // Same day after loading: no second gift. Next day: one.
  const before = total(fresh.inventory);
  fresh.npcs.update(1 / 60, near, fresh.inventory, 3);
  assert.equal(total(fresh.inventory), before);
  fresh.npcs.update(1 / 60, near, fresh.inventory, 4);
  assert.equal(total(fresh.inventory), before + 1);
});

test('a save from before daily gifts loads, and its friends start giving tomorrow', () => {
  const { npcs, npc, near, inventory } = friendOn(0);
  const state = { world, player: new Player(spawn.x, spawn.y), inventory, items: new Items(world), npcs, dayNight: new DayNight() };
  const old = JSON.parse(JSON.stringify(serialize(state)));
  delete old.day;
  delete old.friendGifts;

  const fresh = {
    world,
    player: new Player(spawn.x, spawn.y),
    inventory: new Inventory(),
    items: new Items(world),
    npcs: new Npcs(world),
    dayNight: new DayNight(),
  };
  assert.equal(apply(old, fresh), true);
  assert.equal(fresh.dayNight.day, 0);
  assert.equal(fresh.npcs.friendGifts.size, 0);
  assert.ok(fresh.npcs.friends.has(npc.key));
  fresh.npcs.update(1 / 60, near, fresh.inventory, 0);
  assert.equal(total(fresh.inventory), 0);
  fresh.npcs.update(1 / 60, near, fresh.inventory, 1);
  assert.equal(total(fresh.inventory), 1);

  // Junk in the new fields is ignored rather than trusted.
  const junk = { ...old, day: -2, friendGifts: [['x', 'y'], 7, [npc.key, 1.5]] };
  assert.equal(apply(junk, fresh), true);
  assert.equal(fresh.npcs.friendGifts.size, 0);
});
