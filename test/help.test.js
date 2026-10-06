import test from 'node:test';
import assert from 'node:assert/strict';
import { Help, HelpLines } from '../src/help.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('the panel shows on a first visit and not after it has been closed', () => {
  const storage = fakeStorage();
  const help = new Help(storage);
  assert.equal(help.visible, true);
  assert.equal(help.dismiss(), true);
  assert.equal(help.visible, false);
  // Closing again is a no-op.
  assert.equal(help.dismiss(), false);
  assert.equal(new Help(storage).visible, false);
});

test('toggle shows and hides, and hiding counts as seen', () => {
  const storage = fakeStorage();
  const help = new Help(storage);
  assert.equal(help.toggle(), false);
  assert.equal(new Help(storage).visible, false);
  assert.equal(help.toggle(), true);
  assert.equal(help.toggle(), false);
});

test('without storage, or with storage that throws, it shows and still closes', () => {
  const none = new Help(null);
  assert.equal(none.visible, true);
  assert.equal(none.dismiss(), true);
  assert.equal(none.visible, false);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const help = new Help(broken);
  assert.equal(help.visible, true);
  assert.equal(help.dismiss(), true);
  assert.equal(help.visible, false);
});

test('the panel fits on screen from 320x320 up and is centred', () => {
  for (const [width, height] of [[320, 320], [360, 640], [800, 600], [1920, 1080]]) {
    const r = Help.rect(width, height);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height, `${width}x${height}`);
    assert.equal(r.x + r.w / 2, width / 2);
  }
  assert.ok(Help.rect(320, 320).w < Help.rect(800, 600).w);
});

// Records calls by name; fillText keeps its arguments.
function recorder() {
  const calls = [];
  const texts = [];
  const ctx = new Proxy(
    { fillText: (...args) => (calls.push('fillText'), texts.push(args)) },
    { get: (target, name) => (name in target ? target[name] : () => calls.push(name)), set: () => true }
  );
  return { ctx, calls, texts };
}

test('drawing writes every line inside the panel and restores context state', () => {
  const help = new Help(null);
  const { ctx, calls, texts } = recorder();
  help.draw(ctx, 320, 480, 2);
  assert.equal(calls[0], 'save');
  assert.equal(calls.at(-1), 'restore');
  const r = Help.rect(320, 480);
  const drawn = texts.map(([text]) => text);
  for (const line of HelpLines) assert.ok(drawn.includes(line), line);
  // A title and a footer besides the lines.
  assert.equal(texts.length, HelpLines.length + 2);
  for (const [text, x, y, maxWidth] of texts) {
    assert.ok(x >= r.x && y >= r.y && y + 11 <= r.y + r.h, text);
    // Lines carry a maxWidth so long ones squeeze rather than overflow.
    if (maxWidth !== undefined) assert.ok(x + maxWidth <= r.x + r.w, text);
  }
});

test('a hidden panel draws nothing', () => {
  const help = new Help(null);
  help.dismiss();
  const { ctx, calls } = recorder();
  help.draw(ctx, 800, 600, 1);
  assert.equal(calls.length, 0);
});

test('the lines mention every key the game listens for', () => {
  const text = HelpLines.join(' ');
  for (const key of ['WASD', '1, 2, 3', 'Space', 'E,', 'F,', 'M', 'Shift+R']) assert.ok(text.includes(key), key);
});
