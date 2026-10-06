import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Npcs } from '../src/npc.js';
import { Inventory } from '../src/inventory.js';

const world = new World(1337);
const spawn = world.findSpawn();

function loaded() {
  const npcs = new Npcs(world);
  npcs.update(1 / 60, { x: spawn.x, y: spawn.y });
  return npcs;
}

test('gifts and keys are deterministic, and keys are unique', () => {
  const a = loaded().all.map((npc) => npc.key + ':' + (npc.gift ? npc.gift.id : '-'));
  const b = loaded().all.map((npc) => npc.key + ':' + (npc.gift ? npc.gift.id : '-'));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  assert.ok(a.some((s) => !s.endsWith(':-')), 'no NPC near spawn carries a gift');
});

test('an NPC gives its gift once, even after its region reloads', () => {
  const npcs = loaded();
  const inventory = new Inventory();
  const giver = npcs.all.find((npc) => npc.gift);
  const near = { x: giver.x + 20, y: giver.y };

  npcs.update(1 / 60, near, inventory);
  assert.equal(inventory.count(giver.gift.id), 1);
  assert.ok(npcs.gifted.has(giver.key));
  assert.equal(giver.giving, true);

  npcs.update(1 / 60, near, inventory);
  assert.equal(inventory.count(giver.gift.id), 1);

  // Walk far away so the region unloads, then come back to the respawned NPC.
  npcs.update(1 / 60, { x: near.x + 16 * 32 * 10, y: near.y }, inventory);
  npcs.update(1 / 60, spawn, inventory);
  const again = npcs.all.find((npc) => npc.key === giver.key);
  assert.ok(again && again !== giver);
  npcs.update(1 / 60, { x: again.x + 20, y: again.y }, inventory);
  assert.equal(again.talking, true);
  assert.equal(again.giving, false);
  assert.equal(inventory.count(giver.gift.id), 1);
});

test('without an inventory NPCs never hand over gifts', () => {
  const npcs = loaded();
  const giver = npcs.all.find((npc) => npc.gift);
  npcs.update(1 / 60, { x: giver.x + 20, y: giver.y });
  assert.equal(npcs.gifted.size, 0);
});
