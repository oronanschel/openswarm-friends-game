// Node smoke test for src/npc.js. Run with: node test/npc.test.mjs
import assert from 'node:assert';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';

const world = new World(1337);
const spawn = world.findSpawn();
const player = new Player(spawn.x, spawn.y);
const snapshot = (npcs) => npcs.all.map((npc) => [npc.name, npc.x, npc.y].join());

const npcs = new Npcs(world);
npcs.update(1 / 60, player);
const first = snapshot(npcs);
assert.equal(npcs.regions.size, 25);
assert.ok(first.length > 0, 'no NPCs spawned near the spawn point');

// The same seed spawns the same NPCs.
const again = new Npcs(world);
again.update(1 / 60, player);
assert.deepEqual(snapshot(again), first);

// A minute of wandering never leaves an NPC inside a solid tile.
const corners = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
for (let i = 0; i < 3600; i++) {
  npcs.update(1 / 60, player);
  for (const npc of npcs.all) {
    for (const [ox, oy] of corners) assert.ok(!world.isSolid(npc.x + ox, npc.y + oy), 'NPC inside a solid tile');
  }
}
const moved = snapshot(npcs).filter((value, i) => value !== first[i]).length;
assert.ok(moved > 0, 'no NPC moved');

// Standing next to an NPC makes it stop and talk.
const target = npcs.all[0];
player.x = target.x + 20;
player.y = target.y;
npcs.update(1 / 60, player);
assert.ok(target.talking);
const { x, y } = target;
npcs.update(1, player);
assert.deepEqual([target.x, target.y], [x, y]);

// Walking far away unloads old regions instead of keeping them forever.
player.x += 16 * 32 * 10;
npcs.update(1 / 60, player);
assert.equal(npcs.regions.size, 25);

console.log(`ok: ${first.length} NPCs near spawn, ${moved} moved in 60s`);
