import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Npcs } from '../src/npc.js';
import { Inventory } from '../src/inventory.js';
import { drawRecipes, Recipes } from '../src/crafting.js';

function recordingContext() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : (...args) => calls.push({ name, args })),
    set: (target, name, value) => ((target[name] = value), true),
  });
  ctx.measureText = () => ({ width: 100 });
  return { ctx, calls };
}

test('compact recipe panel is narrow enough to sit beside the minimap at 360px', () => {
  const { ctx, calls } = recordingContext();
  drawRecipes(ctx, new Inventory(), 1, 'Friends: 0', true);
  const panel = calls.find((c) => c.name === 'fillRect');
  const [left, , width] = panel.args;
  // Minimap is 162px wide with a 12px margin on the right.
  assert.ok(left + width + 8 <= 360 - 162 - 12, `panel ends at ${left + width}`);
  const texts = calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
  assert.equal(texts.length, Recipes.length + 2);
  assert.ok(texts.slice(1, -1).every((t) => !t.includes('=')), 'compact lines list no inputs');
});

test('full recipe panel still lists inputs', () => {
  const { ctx, calls } = recordingContext();
  drawRecipes(ctx, new Inventory(), 1);
  const texts = calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
  assert.ok(texts.slice(1).every((t) => t.includes('=')));
});

test('NPC drawing restores context state and draws hearts as paths', () => {
  const world = new World(1337);
  const npcs = new Npcs(world);
  const spawn = world.findSpawn();
  npcs.update(1 / 60, spawn);
  const npc = npcs.all[0];
  npcs.friends.add(npc.key);
  npcs.update(1 / 60, { x: npc.x + 20, y: npc.y });
  const { ctx, calls } = recordingContext();
  npc.draw(ctx);
  assert.equal(calls[0].name, 'save');
  assert.equal(calls.at(-1).name, 'restore');
  assert.ok(calls.some((c) => c.name === 'bezierCurveTo'), 'heart path drawn');
  assert.ok(!calls.some((c) => c.name === 'fillText' && c.args[0] === '♥'));
});
