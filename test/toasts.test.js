import test from 'node:test';
import assert from 'node:assert/strict';
import { Toasts } from '../src/toasts.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes } from '../src/items.js';

function recordingContext() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : (...args) => calls.push({ name, args, alpha: target.globalAlpha })),
    set: (target, name, value) => ((target[name] = value), true),
  });
  return { ctx, calls };
}

test('messages fade out and expire', () => {
  const toasts = new Toasts();
  toasts.push('+1 Shell');
  assert.equal(Toasts.alpha(0), 1);
  assert.equal(Toasts.alpha(1.75), 0.5);
  toasts.update(1.9);
  assert.equal(toasts.messages.length, 1);
  toasts.update(0.2);
  assert.equal(toasts.messages.length, 0);
});

test('only the newest few messages are kept', () => {
  const toasts = new Toasts();
  for (let i = 0; i < 6; i++) toasts.push('m' + i);
  assert.deepEqual(toasts.messages.map((m) => m.text), ['m2', 'm3', 'm4', 'm5']);
});

test('draw stacks newest at the bottom and restores context state', () => {
  const toasts = new Toasts();
  toasts.push('old');
  toasts.push('new');
  const { ctx, calls } = recordingContext();
  toasts.draw(ctx, 600, 2);
  assert.equal(calls[0].name, 'save');
  assert.deepEqual(calls[1].args, [2, 0, 0, 2, 0, 0]);
  assert.equal(calls.at(-1).name, 'restore');
  const fills = calls.filter((c) => c.name === 'fillText');
  assert.deepEqual(fills.map((c) => c.args[0]), ['old', 'new']);
  assert.ok(fills[0].args[2] < fills[1].args[2]);
});

test('drawing nothing touches no context state', () => {
  const { ctx, calls } = recordingContext();
  new Toasts().draw(ctx, 600, 1);
  assert.equal(calls.length, 0);
});

test('inventory reports additions through onAdd', () => {
  const inventory = new Inventory();
  const seen = [];
  inventory.onAdd = (id, n) => seen.push([id, n]);
  inventory.add(ItemTypes.SHELL.id);
  inventory.add(ItemTypes.STONE.id, 3);
  assert.deepEqual(seen, [[ItemTypes.SHELL.id, 1], [ItemTypes.STONE.id, 3]]);
});
