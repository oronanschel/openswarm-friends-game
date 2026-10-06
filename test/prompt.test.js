import test from 'node:test';
import assert from 'node:assert/strict';
import { promptFor, drawPrompt } from '../src/prompt.js';
import { World, Tiles, TILE } from '../src/world.js';
import { treeInReach } from '../src/chop.js';
import { buttonRects } from '../src/touch.js';

const stranger = { name: 'Mira', friend: false };
const friend = { name: 'Mira', friend: true };
const tree = { tx: 1, ty: 2 };

test('nothing in reach means no prompt', () => {
  assert.equal(promptFor(), null);
  assert.equal(promptFor({ hasAxe: true, hasNecklace: true }), null);
});

test('a villager who is not yet a friend prompts for the necklace', () => {
  assert.deepEqual(promptFor({ npc: stranger, hasNecklace: true }), { key: 'E', text: 'Give Mira a Shell Necklace' });
  const hint = promptFor({ npc: stranger });
  assert.equal(hint.key, null);
  assert.equal(hint.text, 'Mira wants a Shell Necklace');
  assert.equal(promptFor({ npc: friend, hasNecklace: true }), null);
});

test('a tree prompts only with an axe, and names the touch button on touch', () => {
  assert.equal(promptFor({ tree }), null);
  assert.deepEqual(promptFor({ tree, hasAxe: true }), { key: 'Space', text: 'Chop tree' });
  assert.equal(promptFor({ tree, hasAxe: true, touch: true }).key, 'Chop');
});

test('a villager comes before a tree, and a friend does not hide the tree', () => {
  assert.equal(promptFor({ npc: stranger, hasNecklace: true, tree, hasAxe: true }).key, 'E');
  assert.equal(promptFor({ npc: friend, tree, hasAxe: true }).key, 'Space');
});

test('treeInReach finds a tree at the player and leaves it standing', () => {
  const world = new World(7, 4);
  const spawn = world.findSpawn();
  const tx = Math.floor(spawn.x / TILE);
  const ty = Math.floor(spawn.y / TILE);
  world.setTile(tx, ty, Tiles.TREE);
  assert.deepEqual(treeInReach(world, spawn), { tx, ty });
  assert.equal(world.tileAt(tx, ty), Tiles.TREE);
});

function fakeCtx(calls) {
  return new Proxy({}, {
    get: (target, name) => {
      if (name === 'measureText') return (text) => ({ width: text.length * 7 });
      return name in target ? target[name] : (...args) => calls.push([name, ...args]);
    },
    set: (target, name, value) => ((target[name] = value), true),
  });
}

test('the prompt draws nothing when there is none and restores context state', () => {
  const calls = [];
  drawPrompt(fakeCtx(calls), null, 800, 600, 1);
  assert.equal(calls.length, 0);
  drawPrompt(fakeCtx(calls), { key: 'E', text: 'Give Mira a Shell Necklace' }, 800, 600, 2);
  assert.equal(calls[0][0], 'save');
  assert.equal(calls.at(-1)[0], 'restore');
  assert.deepEqual(calls.filter((c) => c[0] === 'fillText').map((c) => c[1]), ['E', 'Give Mira a Shell Necklace']);
});

test('the prompt keeps clear of the touch buttons on a 320px phone', () => {
  const prompt = { key: 'E', text: 'Give Mira a Shell Necklace' };
  const pill = (avoid) => {
    const calls = [];
    drawPrompt(fakeCtx(calls), prompt, 320, 568, 1, avoid);
    const [, x, y, w, h] = calls.find((c) => c[0] === 'fillRect');
    return { x, y, w, h, calls };
  };
  const buttons = buttonRects(320, 568);
  const free = pill([]);
  const level = buttons.filter((r) => r.y < free.y + free.h && r.y + r.h > free.y);
  assert.ok(level.some((r) => r.x < free.x + free.w), 'without care the pill would run under a button');
  const clear = pill(buttons);
  assert.ok(clear.x >= 12);
  for (const r of level) assert.ok(clear.x + clear.w <= r.x, `${r.label} at ${r.x}, pill ends ${clear.x + clear.w}`);
  // Both the key and the text are still drawn, the text squeezed into the pill.
  const texts = clear.calls.filter((c) => c[0] === 'fillText');
  assert.deepEqual(texts.map((c) => c[1]), ['E', prompt.text]);
  assert.ok(texts[1][2] + texts[1][4] <= clear.x + clear.w);
  // Buttons above or below the pill's line do not move it.
  const away = pill(buttons.filter((r) => !level.includes(r)));
  assert.equal(away.x, free.x);
  assert.equal(away.w, free.w);
});

test('the prompt stays inside a narrow window, under the player', () => {
  const calls = [];
  drawPrompt(fakeCtx(calls), { key: null, text: 'Bring Mira a Shell Necklace to make friends' }, 200, 400, 1);
  const [, x, y, w] = calls.find((c) => c[0] === 'fillRect');
  assert.ok(x >= 12 && x + w <= 188);
  assert.ok(y > 200 + 10); // below the player's 10px radius
  const text = calls.find((c) => c[0] === 'fillText');
  assert.ok(text[4] <= w); // squeezed by maxWidth
});
