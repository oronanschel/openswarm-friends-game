import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs, SPOOKY_LINES } from '../src/npc.js';

function recorder() {
  const calls = [];
  const fills = [];
  const ctx = new Proxy(
    { measureText: (t) => ({ width: t.length * 7 }) },
    {
      get: (target, name) => (name in target ? target[name] : (...args) => calls.push({ name, args })),
      set: (target, name, value) => {
        if (name === 'fillStyle') fills.push(value);
        target[name] = value;
        return true;
      },
    }
  );
  return { ctx, calls, fills };
}

function nearVillager() {
  const world = new World(1337);
  const spawn = world.findSpawn();
  const player = new Player(spawn.x, spawn.y);
  const npcs = new Npcs(world);
  npcs.update(1 / 60, player, undefined, 0);
  const npc = npcs.all[0];
  player.x = npc.x + 20;
  player.y = npc.y;
  npcs.update(1 / 60, player, undefined, 0);
  assert.ok(npc.talking);
  return { npcs, npc };
}

test('every ordinary line has a spookier twin', () => {
  const { npc } = nearVillager();
  assert.ok(SPOOKY_LINES.includes(npc.say(true)));
  assert.notEqual(npc.say(true), npc.say(false));
  npc.friend = true;
  assert.notEqual(npc.say(true), npc.say(false));
  npc.giving = true;
  npc.given = { name: 'Berry' };
  assert.notEqual(npc.say(true), npc.say(false));
  assert.equal(npc.say(false), 'Here, take this berry!');
});

test('normal drawing is unchanged: the bubble comes with the villager', () => {
  const { npcs } = nearVillager();
  const normal = recorder();
  npcs.draw(normal.ctx);
  assert.ok(normal.calls.some((c) => c.name === 'fillText'));
  const dark = recorder();
  npcs.draw(dark.ctx, true);
  assert.ok(!dark.calls.some((c) => c.name === 'fillText'), 'no bubble under the darkness');
  assert.notDeepEqual(dark.fills[0], normal.fills[0], 'villagers are paler');
});

test('in dark mode the bubbles are drawn on their own, with a dark panel', () => {
  const { npcs, npc } = nearVillager();
  const bubbles = recorder();
  npcs.drawBubbles(bubbles.ctx);
  const text = bubbles.calls.find((c) => c.name === 'fillText');
  assert.ok(text.args[0].endsWith(npc.say(true)));
  assert.equal(bubbles.calls[0].name, 'save');
  assert.equal(bubbles.calls.at(-1).name, 'restore');
});
