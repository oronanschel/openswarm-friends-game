import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { Items, ItemTypes } from '../src/items.js';
import { Inventory } from '../src/inventory.js';
import { save, load, clear, serialize } from '../src/save.js';

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

function newState(seed = 1337) {
  const world = new World(seed);
  const spawn = world.findSpawn();
  return {
    world,
    spawn,
    player: new Player(spawn.x, spawn.y),
    inventory: new Inventory(),
    items: new Items(world),
    npcs: new Npcs(world),
  };
}

test('a saved game is restored into a fresh state', () => {
  const storage = fakeStorage();
  const a = newState();
  a.items.update(a.player, a.inventory);
  const target = a.items.all[0];
  a.player.x = target.x;
  a.player.y = target.y;
  a.items.update(a.player, a.inventory);
  a.inventory.add(ItemTypes.STONE.id, 3);
  assert.equal(save(storage, a), true);

  const b = newState();
  assert.equal(load(storage, b), true);
  assert.deepEqual([b.player.x, b.player.y], [target.x, target.y]);
  assert.deepEqual([...b.inventory.counts].sort(), [...a.inventory.counts].sort());
  assert.equal(b.inventory.count(ItemTypes.STONE.id) >= 3, true);

  // The picked-up item does not come back.
  b.items.update(b.player, b.inventory);
  assert.ok(!b.items.all.some((item) => item.key === target.key));
  assert.deepEqual([...b.inventory.counts].sort(), [...a.inventory.counts].sort());
});

test('items already loaded before a load are respawned without collected ones', () => {
  const storage = fakeStorage();
  const a = newState();
  a.items.update(a.player, a.inventory);
  const target = a.items.all[0];
  a.items.collected.add(target.key);
  save(storage, a);

  const b = newState();
  b.items.update(b.player, b.inventory);
  assert.ok(b.items.all.some((item) => item.key === target.key));
  load(storage, b);
  b.items.update(b.spawn, b.inventory);
  assert.ok(!b.items.all.some((item) => item.key === target.key));
});

test('a gifted set on npcs round-trips when present', () => {
  const storage = fakeStorage();
  const a = newState();
  a.npcs.gifted = new Set(['0,0:1']);
  save(storage, a);
  const b = newState();
  b.npcs.gifted = new Set();
  load(storage, b);
  assert.deepEqual([...b.npcs.gifted], ['0,0:1']);
});

test('saves from another seed or version are ignored', () => {
  const storage = fakeStorage();
  const a = newState(7);
  a.inventory.add(ItemTypes.BERRY.id);
  save(storage, a);
  const b = newState(8);
  assert.equal(load(storage, b), false);
  assert.equal(b.inventory.count(ItemTypes.BERRY.id), 0);

  const c = newState(7);
  storage.setItem('friends-game-save', JSON.stringify({ ...serialize(a), version: 0 }));
  assert.equal(load(storage, c), false);
  assert.equal(c.inventory.count(ItemTypes.BERRY.id), 0);
});

test('a saved position inside a solid tile falls back to the spawn', () => {
  const storage = fakeStorage();
  const a = newState();
  // Find a solid tile and pretend the player was saved inside it.
  let tx = 0;
  while (!a.world.tileAt(tx, 0).solid) tx++;
  a.player.x = (tx + 0.5) * TILE;
  a.player.y = 0.5 * TILE;
  save(storage, a);
  const b = newState();
  assert.equal(load(storage, b), true);
  assert.deepEqual([b.player.x, b.player.y], [b.spawn.x, b.spawn.y]);
});

test('missing, corrupt or unavailable storage never throws', () => {
  const storage = fakeStorage();
  assert.equal(load(storage, newState()), false);
  storage.setItem('friends-game-save', '{not json');
  assert.equal(load(storage, newState()), false);
  assert.equal(load(null, newState()), false);
  assert.equal(save(null, newState()), false);
  clear(null);
  const full = { setItem: () => { throw new Error('quota'); } };
  assert.equal(save(full, newState()), false);
});

test('clear removes the save', () => {
  const storage = fakeStorage();
  save(storage, newState());
  clear(storage);
  assert.equal(storage.data.size, 0);
});
