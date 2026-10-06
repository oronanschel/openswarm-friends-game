// Node smoke test for src/minimap.js with a recording stand-in for the canvas.
// Run with: node test/minimap.test.mjs
import assert from 'node:assert';
import { World, TILE } from '../src/world.js';
import { Minimap } from '../src/minimap.js';

function fakeContext() {
  const calls = [];
  const record = (name) => (...args) => calls.push({ name, args, fillStyle: ctx.fillStyle });
  const ctx = {
    calls,
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    drawImage: record('drawImage'),
    setTransform: record('setTransform'),
  };
  return ctx;
}

const bufferCtx = fakeContext();
globalThis.document = { createElement: () => ({ getContext: () => bufferCtx }) };

const world = new World(1337);
const spawn = world.findSpawn();
const player = { x: spawn.x, y: spawn.y };
const minimap = new Minimap(world);
const ctx = fakeContext();
const npcs = [
  { x: player.x + 5 * TILE, y: player.y - 3 * TILE }, // in range
  { x: player.x + 500 * TILE, y: player.y }, // out of range
];
const items = [
  { x: player.x - 2 * TILE, y: player.y + 4 * TILE, type: { color: '#c2185b' } }, // in range
  { x: player.x, y: player.y - 500 * TILE, type: { color: '#9e9e9e' } }, // out of range
];
minimap.draw(ctx, 800, 2, player, npcs, items);

// The terrain buffer holds one cell per tile, coloured like the world.
assert.equal(bufferCtx.calls.length, 81 * 81);
const centre = bufferCtx.calls[40 * 81 + 40];
assert.deepEqual(centre.args, [80, 80, 2, 2]);
assert.equal(centre.fillStyle, world.tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE)).color);

// Drawn in CSS pixels in the top-right corner, scaled by the device pixel ratio.
assert.deepEqual(ctx.calls[0], { name: 'setTransform', args: [2, 0, 0, 2, 0, 0], fillStyle: undefined });
const image = ctx.calls.find((call) => call.name === 'drawImage');
assert.deepEqual(image.args.slice(1), [800 - 162 - 12, 12]);

// One dot each for the item and NPC in range, then the player, at the right cells.
const dots = ctx.calls.filter((call) => call.name === 'fillRect');
// The NPC and the player each get a dark rim first, so they show on snow.
assert.equal(dots.length, 5);
assert.deepEqual(dots[0].args, [626 + 38 * 2, 12 + 44 * 2, 2, 2]);
assert.equal(dots[0].fillStyle, '#c2185b');
assert.deepEqual(dots[1].args, [626 + 45 * 2 - 1, 12 + 37 * 2 - 1, 4, 4]);
assert.equal(dots[1].fillStyle, '#111');
assert.deepEqual(dots[2].args, [626 + 45 * 2, 12 + 37 * 2, 2, 2]);
assert.equal(dots[2].fillStyle, '#ffffff');
assert.deepEqual(dots[3].args, [626 + 78, 12 + 78, 6, 6]);
assert.equal(dots[3].fillStyle, '#111');
assert.deepEqual(dots[4].args, [626 + 79, 12 + 79, 4, 4]);
assert.equal(dots[4].fillStyle, '#f2e14c');

// The buffer is only repainted when the player changes tile.
player.x += 1;
minimap.draw(ctx, 800, 2, player, npcs);
assert.equal(bufferCtx.calls.length, 81 * 81);
player.x += TILE;
minimap.draw(ctx, 800, 2, player, npcs);
assert.equal(bufferCtx.calls.length, 2 * 81 * 81);

console.log('ok');
