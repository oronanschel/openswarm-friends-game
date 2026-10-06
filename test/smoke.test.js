import test from 'node:test';
import assert from 'node:assert/strict';

// Boots the real src/main.js against stand-ins for the browser and drives it.
// It cannot say how anything looks, only that the entry point wires the
// modules together without throwing and that the basic effects happen.

const SAVE_KEY = 'friends-game-save';

// A 2D context that accepts any call or property and counts the calls.
function fakeContext(counts) {
  const gradient = { addColorStop() {} };
  const known = {
    measureText: (text) => ({ width: String(text).length * 7 }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  };
  return new Proxy(known, {
    get: (target, name) => {
      if (name in target) return target[name];
      return (target[name] = () => {
        counts[name] = (counts[name] || 0) + 1;
      });
    },
    set: () => true,
  });
}

function fakeCanvas(counts) {
  const context = fakeContext(counts);
  const handlers = {};
  return {
    width: 0,
    height: 0,
    style: {},
    handlers,
    getContext: () => context,
    addEventListener: (name, fn) => (handlers[name] = fn),
  };
}

// Installs the globals main.js reads, imports a fresh copy of it, and returns
// handles for driving it. `tag` makes the import a new module instance.
async function boot(tag, { width, height, dpr }) {
  const counts = {};
  const canvas = fakeCanvas(counts);
  const listeners = { window: {}, document: {} };
  const on = (map) => (name, fn) => (map[name] ||= []).push(fn);
  const data = new Map();
  const frames = [];
  const intervals = [];
  let now = 0;

  const window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
    location: { reload() {} },
    addEventListener: on(listeners.window),
    dispatchEvent: (event) => fire(event.type, event),
  };
  const fire = (name, event = {}) => (listeners.window[name] || []).forEach((fn) => fn(event));

  globalThis.window = window;
  globalThis.document = {
    visibilityState: 'visible',
    getElementById: () => canvas,
    createElement: () => fakeCanvas(counts),
    addEventListener: on(listeners.document),
  };
  globalThis.KeyboardEvent = class {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  };
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.setInterval = (fn, ms) => intervals.push({ fn, ms });
  // Node's own performance.now() is real time; frames are stepped by hand.
  const realNow = performance.now;
  performance.now = () => now;

  await import('../src/main.js?' + tag);
  performance.now = realNow;

  return {
    window,
    canvas,
    counts,
    intervals,
    fire,
    fireDocument: (name) => (listeners.document[name] || []).forEach((fn) => fn({})),
    key: (code, extra = {}) => fire('keydown', { code, ...extra }),
    release: (code) => fire('keyup', { code }),
    // Runs `n` frames 1/60s apart.
    run(n) {
      for (let i = 0; i < n; i++) {
        assert.equal(frames.length, 1, 'exactly one frame is scheduled at a time');
        now += 1000 / 60;
        frames.shift()(now);
      }
    },
    saved: () => JSON.parse(data.get(SAVE_KEY) || 'null'),
  };
}

test('the game boots, draws, moves, acts on every key and saves', async () => {
  const game = await boot('desktop', { width: 800, height: 600, dpr: 1 });

  // The backing store is sized from the window.
  assert.equal(game.canvas.width, 800);
  assert.equal(game.canvas.height, 600);
  assert.equal(game.canvas.style.width, '800px');

  game.run(3);
  // One fillRect per visible tile at least: 25 by 19 tiles cover 800x600.
  assert.ok(game.counts.fillRect >= 3 * 25 * 19, String(game.counts.fillRect));
  assert.ok(game.counts.arc > 0);
  assert.ok(game.counts.drawImage >= 3, 'the minimap is blitted every frame');

  // The autosave timer is set up and writes the player's position.
  assert.equal(game.intervals.length, 1);
  game.intervals[0].fn();
  const start = game.saved();
  assert.ok(start && Number.isFinite(start.player.x) && Number.isFinite(start.player.y));

  // Walk in each direction for a while; the player ends up somewhere else.
  for (const code of ['KeyD', 'KeyS', 'ArrowLeft', 'ArrowUp', 'KeyD']) {
    game.key(code);
    game.run(40);
    game.release(code);
  }
  game.fire('pagehide');
  const moved = game.saved();
  assert.ok(moved.player.x !== start.player.x || moved.player.y !== start.player.y);

  // Every action key, with and without the means to do the action.
  for (const code of ['Digit1', 'Digit2', 'Digit3', 'KeyE', 'KeyF', 'KeyM', 'KeyM', 'Space']) {
    game.key(code);
    game.release(code);
    game.run(2);
  }
  // Toasts from those presses are on screen as text.
  assert.ok(game.counts.fillText > 0);

  // Losing focus drops held keys: the player stops.
  game.key('KeyD');
  game.fire('blur');
  game.fire('pagehide');
  const before = game.saved().player;
  game.run(20);
  game.fire('pagehide');
  assert.deepEqual(game.saved().player, before);

  // A few more seconds of play, long enough for toasts to expire.
  game.run(200);
});

test('the game runs at a fractional zoom on a narrow window and follows a resize', async () => {
  const game = await boot('phone', { width: 360, height: 500, dpr: 1.1 });
  assert.equal(game.canvas.width, Math.round(360 * 1.1));
  assert.equal(game.canvas.height, Math.round(500 * 1.1));
  game.run(5);

  // A touch brings up the on-screen buttons and steers the player.
  const pointer = (name, x, y) =>
    game.canvas.handlers[name]({ pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} });
  pointer('pointerdown', 120, 250);
  pointer('pointermove', 60, 250);
  game.run(30);
  pointer('pointerup', 60, 250);
  game.run(2);

  // Tapping the bottom-right corner reaches a button, which sends its key.
  let presses = 0;
  game.window.addEventListener('keydown', () => presses++);
  pointer('pointerdown', 360 - 30, 500 - 12 - 48 - 20);
  pointer('pointerup', 360 - 30, 500 - 12 - 48 - 20);
  assert.equal(presses, 1);

  game.window.innerWidth = 700;
  game.window.innerHeight = 320;
  game.window.devicePixelRatio = 2;
  game.fire('resize');
  assert.equal(game.canvas.width, 1400);
  assert.equal(game.canvas.height, 640);
  game.run(5);

  // Hiding the tab saves; merely changing visibility while shown does not.
  game.fireDocument('visibilitychange');
  assert.equal(game.saved(), null);
  globalThis.document.visibilityState = 'hidden';
  game.fireDocument('visibilitychange');
  assert.ok(game.saved());
});
