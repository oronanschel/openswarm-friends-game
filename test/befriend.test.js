import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { Items, ItemTypes } from '../src/items.js';
import { Inventory } from '../src/inventory.js';
import { serialize, apply } from '../src/save.js';
import { drawRecipes, Recipes } from '../src/crafting.js';

const NECKLACE = ItemTypes.NECKLACE.id;
const world = new World(1337);
const spawn = world.findSpawn();

function loaded() {
  const npcs = new Npcs(world);
  npcs.update(1 / 60, spawn);
  return npcs;
}

// Stand next to the first NPC so it talks; no inventory, so no gifts interfere.
function talkTo(npcs) {
  const npc = npcs.all[0];
  const near = { x: npc.x + 20, y: npc.y };
  npcs.update(1 / 60, near);
  return { npc, near };
}

test('befriending consumes exactly one necklace', () => {
  const npcs = loaded();
  const { npc, near } = talkTo(npcs);
  assert.equal(npcs.talkingTo(near), npc);
  const inventory = new Inventory();
  inventory.add(NECKLACE, 2);
  assert.equal(npcs.befriend(npc, inventory), true);
  assert.equal(inventory.count(NECKLACE), 1);
  assert.ok(npcs.friends.has(npc.key));
  assert.equal(npc.friend, true);
  // Already a friend: nothing more is taken.
  assert.equal(npcs.befriend(npc, inventory), false);
  assert.equal(inventory.count(NECKLACE), 1);
});

test('without a necklace nothing changes', () => {
  const npcs = loaded();
  const { npc } = talkTo(npcs);
  assert.equal(npcs.befriend(npc, new Inventory()), false);
  assert.equal(npcs.friends.size, 0);
  assert.equal(npcs.befriend(null, new Inventory()), false);
});

test('talkingTo is null when nobody is near', () => {
  const npcs = loaded();
  const far = { x: spawn.x + 16 * TILE * 100, y: spawn.y };
  npcs.update(1 / 60, far);
  assert.equal(npcs.talkingTo(far), null);
});

test('friends survive a region reload and a save round trip', () => {
  const npcs = loaded();
  const { npc, near } = talkTo(npcs);
  const inventory = new Inventory();
  inventory.add(NECKLACE);
  npcs.befriend(npc, inventory);

  npcs.update(1 / 60, { x: near.x + 16 * TILE * 10, y: near.y });
  npcs.update(1 / 60, near);
  const again = npcs.all.find((n) => n.key === npc.key);
  assert.ok(again && again !== npc);
  assert.equal(again.friend, true);

  const state = (n) => ({ world, player: new Player(spawn.x, spawn.y), inventory: new Inventory(), items: new Items(world), npcs: n });
  const data = JSON.parse(JSON.stringify(serialize(state(npcs))));
  const fresh = new Npcs(world);
  assert.equal(apply(data, state(fresh)), true);
  assert.deepEqual([...fresh.friends], [npc.key]);

  // Saves from before befriending load with no friends.
  delete data.friends;
  const older = new Npcs(world);
  assert.equal(apply(data, state(older)), true);
  assert.equal(older.friends.size, 0);
});

test('the recipe panel draws the friend counter as a footer', () => {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : (...args) => name === 'fillText' && texts.push(args[0])),
    set: (target, name, value) => ((target[name] = value), true),
  });
  drawRecipes(ctx, new Inventory(), 1, 'Friends: 2');
  assert.equal(texts.length, Recipes.length + 2);
  assert.equal(texts.at(-1), 'Friends: 2');
});
