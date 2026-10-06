import test from 'node:test';
import assert from 'node:assert/strict';
import { buttonRects, HelpButton } from '../src/touch.js';
import { ItemTypes } from '../src/items.js';

// Boots the real src/main.js against stand-ins for the browser and drives it.
// It cannot say how anything looks, only that the entry point wires the
// modules together without throwing and that the basic effects happen.

const SAVE_KEY = 'friends-game-save';
const HELP_KEY = 'friends-game-help-seen';

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
    addEventListener: (name, fn) => (handlers[name] ||= []).push(fn),
  };
}

// Installs the globals main.js reads, imports a fresh copy of it, and returns
// handles for driving it. `tag` makes the import a new module instance.
// `stored` is what localStorage already holds, as { key: string }.
async function boot(tag, { width, height, dpr, stored = {} }) {
  const counts = {};
  const canvas = fakeCanvas(counts);
  const listeners = { window: {}, document: {} };
  const on = (map) => (name, fn) => (map[name] ||= []).push(fn);
  const data = new Map(Object.entries(stored));
  const frames = [];
  const intervals = [];
  let now = 0;
  let reloads = 0;

  const window = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: dpr,
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
    location: { reload: () => reloads++ },
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
    stored: (key) => (data.has(key) ? data.get(key) : null),
    reloads: () => reloads,
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

  // The help panel is up on a first visit and adds its text to each frame.
  assert.equal(game.stored(HELP_KEY), null);
  const withHelp = game.counts.fillText;
  game.run(1);
  const perFrameWithHelp = game.counts.fillText - withHelp;

  // Walk in each direction for a while; the player ends up somewhere else.
  // The first key press also closes the help, and still moves the player.
  for (const code of ['KeyD', 'KeyS', 'ArrowLeft', 'ArrowUp', 'KeyD']) {
    game.key(code);
    game.run(40);
    game.release(code);
  }
  game.fire('pagehide');
  const moved = game.saved();
  assert.ok(moved.player.x !== start.player.x || moved.player.y !== start.player.y);
  assert.equal(game.stored(HELP_KEY), '1');
  const withoutHelp = game.counts.fillText;
  game.run(1);
  const perFrame = game.counts.fillText - withoutHelp;
  assert.ok(perFrame < perFrameWithHelp, `${perFrame} < ${perFrameWithHelp}`);

  // H brings the panel back and puts it away again. The panel is ten pieces
  // of text; a toast or speech bubble coming or going is one or two.
  game.key('KeyH');
  game.release('KeyH');
  const reopened = game.counts.fillText;
  game.run(1);
  const perFrameReopened = game.counts.fillText - reopened;
  game.key('KeyH');
  game.release('KeyH');
  const closed = game.counts.fillText;
  game.run(1);
  assert.ok(perFrameReopened - (game.counts.fillText - closed) >= 5);

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
  const pointer = (name, x, y) => {
    const event = { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} };
    game.canvas.handlers[name].forEach((fn) => fn(event));
  };
  // The first tap also closes the first-visit help panel.
  assert.equal(game.stored(HELP_KEY), null);
  pointer('pointerdown', 120, 250);
  assert.equal(game.stored(HELP_KEY), '1');
  pointer('pointermove', 60, 250);
  game.run(30);
  pointer('pointerup', 60, 250);
  game.run(2);

  // Tapping an on-screen button sends its key.
  const pressed = [];
  game.window.addEventListener('keydown', (e) => pressed.push(e.code));
  const button = buttonRects(360, 500)[0];
  pointer('pointerdown', button.x + button.w / 2, button.y + button.h / 2);
  pointer('pointerup', button.x + button.w / 2, button.y + button.h / 2);
  assert.deepEqual(pressed, [button.code]);

  // The ? button opens the help, and a second tap on it closes it again.
  const tapHelp = () => {
    pointer('pointerdown', HelpButton.x + HelpButton.w / 2, HelpButton.y + HelpButton.h / 2);
    pointer('pointerup', HelpButton.x + HelpButton.w / 2, HelpButton.y + HelpButton.h / 2);
  };
  const framesText = () => {
    const before = game.counts.fillText;
    game.run(1);
    return game.counts.fillText - before;
  };
  const closedText = framesText();
  tapHelp();
  assert.deepEqual(pressed, [button.code, 'KeyH']);
  assert.ok(framesText() >= closedText + 5, 'the help panel is drawn');
  tapHelp();
  assert.deepEqual(pressed, [button.code, 'KeyH']);
  assert.equal(framesText(), closedText);

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

// A save for the game's world (seed 1337) with a stocked inventory. No player
// position, so the fresh spawn is kept.
function stockedSave(overrides = {}) {
  const { BERRY, STONE_AXE, NECKLACE, JAM, WOOD, RAFT } = ItemTypes;
  return {
    version: 1,
    seed: 1337,
    inventory: [[BERRY.id, 4], [STONE_AXE.id, 1], [NECKLACE.id, 1], [JAM.id, 2], [WOOD.id, 7], [RAFT.id, 1]],
    collected: [],
    gifted: [],
    friends: [],
    tiles: [],
    time: 100,
    day: 3,
    friendGifts: [],
    ...overrides,
  };
}

test('booting from a save restores the inventory, and the actions that need items work', async () => {
  const { BERRY, JAM, WOOD, RAFT } = ItemTypes;
  const game = await boot('saved', {
    width: 800,
    height: 600,
    dpr: 1,
    // Help already seen, so no key press is spent closing it.
    stored: { [SAVE_KEY]: JSON.stringify(stockedSave()), [HELP_KEY]: '1' },
  });
  const count = (type) => new Map(game.saved().inventory).get(type.id) || 0;
  const press = (code) => {
    game.key(code);
    game.release(code);
    game.run(2);
    game.fire('pagehide');
  };

  game.run(3);
  game.fire('pagehide');
  assert.equal(count(JAM), 2);
  assert.equal(count(RAFT), 1);
  // The clock carries on from the save.
  assert.equal(game.saved().day, 3);
  assert.ok(game.saved().time > 100 && game.saved().time < 101);

  // F eats one jam.
  press('KeyF');
  assert.equal(count(JAM), 1);

  // 3 turns three berries into a jam.
  press('Digit3');
  assert.equal(count(BERRY), 1);
  assert.equal(count(JAM), 2);
  // And again with one berry left: refused, nothing changes.
  press('Digit3');
  assert.equal(count(BERRY), 1);
  assert.equal(count(JAM), 2);

  // 4 is refused while a raft is held, and the wood is kept.
  press('Digit4');
  assert.equal(count(WOOD), 7);
  assert.equal(count(RAFT), 1);

  // The rest of the keys, with items in the bag, then a walk while boosted.
  for (const code of ['Space', 'KeyE', 'KeyH', 'KeyH', 'KeyM', 'KeyM']) press(code);
  for (const code of ['KeyD', 'KeyS', 'KeyA', 'KeyW']) {
    game.key(code);
    game.run(60);
    game.release(code);
  }
  game.fire('pagehide');
  assert.equal(count(RAFT), 1);
});

test('a save from another world is ignored and the game starts fresh', async () => {
  const game = await boot('other-world', {
    width: 800,
    height: 600,
    dpr: 1,
    stored: { [SAVE_KEY]: JSON.stringify(stockedSave({ seed: 42 })) },
  });
  game.run(3);
  game.fire('pagehide');
  const saved = game.saved();
  assert.equal(saved.seed, 1337);
  assert.deepEqual(saved.inventory, []);
  assert.equal(saved.day, 0);

  // Unreadable storage contents do not stop the game either.
  const broken = await boot('broken-save', { width: 800, height: 600, dpr: 1, stored: { [SAVE_KEY]: '{not json' } });
  broken.run(3);
  broken.fire('pagehide');
  assert.deepEqual(broken.saved().inventory, []);
});

test('N turns dark mode on and off, and the choice is saved', async () => {
  const game = await boot('dark', { width: 800, height: 600, dpr: 1, stored: { [HELP_KEY]: '1' } });
  game.run(2);
  game.fire('pagehide');
  assert.equal(game.saved().dark, false);
  game.key('KeyN');
  game.release('KeyN');
  game.run(3);
  game.fire('pagehide');
  assert.equal(game.saved().dark, true);
  game.key('KeyN');
  game.release('KeyN');
  game.fire('pagehide');
  assert.equal(game.saved().dark, false);
});

test('browser shortcuts are left alone: only a plain Shift+R wipes the save', async () => {
  const { JAM, BERRY } = ItemTypes;
  const game = await boot('shortcuts', {
    width: 800,
    height: 600,
    dpr: 1,
    stored: { [SAVE_KEY]: JSON.stringify(stockedSave()) },
  });
  const count = (type) => new Map(game.saved().inventory).get(type.id) || 0;
  game.run(2);
  game.fire('pagehide');
  const start = game.saved().player;

  // The modifiers a browser shortcut carries, one at a time.
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    const held = { [modifier]: true };
    // Hard reload: the save must survive it.
    game.key('KeyR', { shiftKey: true, ...held });
    assert.equal(game.reloads(), 0, modifier);
    assert.ok(game.saved(), modifier);
    // Find, switch tab, minimise, history, bookmark: no game action.
    for (const code of ['KeyF', 'Digit3', 'KeyM', 'KeyH', 'KeyD']) game.key(code, held);
    game.run(20);
    for (const code of ['KeyF', 'Digit3', 'KeyM', 'KeyH', 'KeyD']) game.release(code);
    game.fire('pagehide');
    // No jam eaten, none crafted, no berries spent. (Berries can go up: a
    // villager may wander over with a gift.)
    assert.equal(count(JAM), 2, modifier);
    assert.ok(count(BERRY) >= 4, modifier);
    assert.equal(game.stored('friends-game-muted'), null, modifier);
    // The first-visit help is still up: none of those presses closed it.
    assert.equal(game.stored(HELP_KEY), null, modifier);
    assert.deepEqual(game.saved().player, start, modifier);
  }

  // The same keys without a modifier do act.
  game.key('KeyF');
  game.release('KeyF');
  game.fire('pagehide');
  assert.equal(count(JAM), 1);
  assert.equal(game.stored(HELP_KEY), '1');

  // Shift alone is not a browser modifier here: Shift+R resets.
  game.key('KeyR', { shiftKey: true });
  assert.equal(game.reloads(), 1);
  assert.equal(game.saved(), null);
  // Nothing is saved again on the way out.
  game.fire('pagehide');
  assert.equal(game.saved(), null);
});
