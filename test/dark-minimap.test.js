import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE, World } from '../src/world.js';
import { Minimap, BLIP_RANGE, zombieBlips } from '../src/minimap.js';

const at = (tx, ty) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });

test('only zombies within range show as blips, nearest first', () => {
  const player = at(100, 100);
  const blips = zombieBlips(player, [at(100 + BLIP_RANGE + 1, 100), at(103, 100), at(100, 98), at(100 - BLIP_RANGE, 100)]);
  assert.deepEqual(blips, [{ dx: 0, dy: -2 }, { dx: 3, dy: 0 }, { dx: -BLIP_RANGE, dy: 0 }]);
  assert.deepEqual(zombieBlips(player, []), []);
});

function recorder() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (t, name) => (name in t ? t[name] : (...args) => calls.push({ name, args, fillStyle: t.fillStyle })),
      set: (t, name, value) => ((t[name] = value), true),
    }
  );
  return { ctx, calls };
}

test('the dark minimap shows no terrain, items or villagers, only static, you and close zombies', () => {
  const world = new World(1337);
  const map = new Minimap(world);
  const player = at(100, 100);
  const { ctx, calls } = recorder();
  map.drawDark(ctx, 800, 1, player, [at(103, 100), at(100 + BLIP_RANGE + 5, 100)], 1);
  assert.ok(!calls.some((c) => c.name === 'drawImage'), 'the terrain is not drawn');
  assert.equal(map.buffer, null, 'and never even painted');
  const red = calls.filter((c) => c.name === 'fillRect' && c.fillStyle === '#c4281f');
  assert.equal(red.length, 1, 'one zombie in range');
  assert.ok(calls.some((c) => c.name === 'fillRect' && c.fillStyle === '#f2e14c'), 'the player is shown');
});

test('the static changes from frame to frame but stays dim', () => {
  const map = new Minimap(new World(1337));
  const specks = (time) => {
    const { ctx, calls } = recorder();
    map.drawDark(ctx, 800, 1, at(0, 0), [], time);
    return calls.filter((c) => c.name === 'fillRect' && /^rgb/.test(c.fillStyle)).map((c) => c.args.join() + c.fillStyle);
  };
  assert.notDeepEqual(specks(1), specks(1.2));
  assert.deepEqual(specks(1), specks(1.05), 'it holds for about an eighth of a second');
  for (const style of specks(2).map((s) => s.match(/rgb\((\d+)/)[1])) assert.ok(Number(style) < 100);
});
