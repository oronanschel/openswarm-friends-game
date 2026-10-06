import test from 'node:test';
import assert from 'node:assert/strict';
import { Quest, GOAL } from '../src/quest.js';

test('the banner fires once when the friend count reaches the goal', () => {
  const quest = new Quest();
  quest.update(0.016, 0);
  for (let n = 1; n < GOAL; n++) {
    quest.update(0.016, n);
    assert.equal(quest.banner, 0);
  }
  quest.update(0.016, GOAL);
  assert.ok(quest.banner > 4);
  quest.update(10, GOAL);
  assert.equal(quest.banner, 0);
  quest.update(0.016, GOAL + 1);
  assert.equal(quest.banner, 0, 'not replayed for more friends');
});

test('loading a game already at the goal shows no banner', () => {
  const quest = new Quest();
  quest.update(0.016, GOAL);
  assert.equal(quest.banner, 0);
  assert.match(quest.progressText(), /goal reached/);
});

test('progress text counts towards the goal', () => {
  const quest = new Quest();
  assert.equal(quest.progressText(), `Friends: 0/${GOAL}`);
  quest.update(0.016, 2);
  assert.equal(quest.progressText(), `Friends: 2/${GOAL}`);
});

test('the banner restores context state and draws nothing when hidden', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => calls.push(name)),
    set: (target, name, value) => ((target[name] = value), true),
  });
  ctx.measureText = () => ({ width: 200 });
  const quest = new Quest();
  quest.draw(ctx, 800, 600, 2);
  assert.equal(calls.length, 0);
  quest.update(0, 0);
  quest.update(0, GOAL);
  quest.draw(ctx, 800, 600, 2);
  assert.equal(calls[0], 'save');
  assert.equal(calls.at(-1), 'restore');
  assert.ok(calls.includes('fillText'));
});
