import test from 'node:test';
import assert from 'node:assert/strict';
import { DarkMode, DARK_RADIUS, MIN_RADIUS, flicker, lightRadius, blackout } from '../src/darkmode.js';
import { Sound } from '../src/sound.js';
import { World } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { Items } from '../src/items.js';
import { Inventory } from '../src/inventory.js';
import { save, load } from '../src/save.js';
import { DarkButton, HelpButton, buttonRects } from '../src/touch.js';
import { HelpLines } from '../src/help.js';

function recorder() {
  const calls = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy(
    {},
    {
      get: (target, name) => {
        if (name === 'createRadialGradient') return () => gradient;
        return name in target ? target[name] : (...args) => calls.push({ name, args });
      },
      set: (target, name, value) => ((target[name] = value), true),
    }
  );
  return { ctx, calls };
}

test('dark mode is off by default and toggles', () => {
  const dark = new DarkMode();
  assert.equal(dark.on, false);
  assert.equal(dark.toggle(), true);
  assert.equal(dark.toggle(), false);
});

test('nothing is drawn while it is off; drawing restores the context', () => {
  const dark = new DarkMode();
  const off = recorder();
  dark.draw(off.ctx, 800, 600, 1);
  assert.equal(off.calls.length, 0);
  dark.toggle();
  const on = recorder();
  dark.draw(on.ctx, 800, 600, 1);
  assert.equal(on.calls[0].name, 'save');
  assert.equal(on.calls.at(-1).name, 'restore');
  assert.ok(on.calls.some((c) => c.name === 'fillRect'));
});

test('the light flickers but stays close to its base size', () => {
  const radii = [];
  for (let t = 0; t < 20; t += 0.05) radii.push(flicker(t));
  assert.ok(new Set(radii.map((r) => r.toFixed(2))).size > 10, 'it varies');
  for (const r of radii) assert.ok(r > DARK_RADIUS * 0.85 && r < DARK_RADIUS * 1.15, String(r));
});

function newState() {
  const world = new World(1337);
  const spawn = world.findSpawn();
  return {
    world,
    player: new Player(spawn.x, spawn.y),
    inventory: new Inventory(),
    items: new Items(world),
    npcs: new Npcs(world),
    darkMode: new DarkMode(),
  };
}

test('the setting is saved and restored; old saves stay light', () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
  const first = newState();
  first.darkMode.toggle();
  assert.equal(save(storage, first), true);
  const second = newState();
  assert.equal(load(storage, second), true);
  assert.equal(second.darkMode.on, true);

  const saved = JSON.parse(data.get('friends-game-save'));
  delete saved.dark;
  data.set('friends-game-save', JSON.stringify(saved));
  const third = newState();
  third.darkMode.on = true;
  assert.equal(load(storage, third), true);
  assert.equal(third.darkMode.on, false);
});

class FakeAudio {
  static started = 0;
  static stopped = 0;
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createOscillator() {
    return { frequency: {}, connect() {}, start() { FakeAudio.started++; }, stop() { FakeAudio.stopped++; } };
  }
  createGain() {
    return { gain: {}, connect() {} };
  }
}

test('the hum plays in dark mode, stops when it ends, and respects Mute', () => {
  FakeAudio.started = 0;
  FakeAudio.stopped = 0;
  const sound = new Sound(null, FakeAudio);
  sound.setDrone(true);
  assert.ok(sound.drone);
  sound.setDrone(true);
  assert.equal(FakeAudio.started, 2, 'one hum, not two');
  assert.equal(sound.toggleMute(), true);
  assert.equal(sound.drone, null);
  assert.equal(FakeAudio.stopped, 2);
  assert.equal(sound.toggleMute(), false);
  assert.ok(sound.drone, 'unmuting brings it back');
  sound.setDrone(false);
  assert.equal(sound.drone, null);

  const muted = new Sound({ getItem: () => '1', setItem() {} }, FakeAudio);
  muted.setDrone(true);
  assert.equal(muted.drone, null);
  assert.doesNotThrow(() => new Sound(null, null).setDrone(true));
});

test('the Dark button sends N, beside the help button and clear of the others', () => {
  assert.equal(DarkButton.code, 'KeyN');
  assert.ok(DarkButton.x >= HelpButton.x + HelpButton.w);
  assert.equal(DarkButton.y, HelpButton.y);
  for (const [w, h] of [[360, 640], [800, 600], [640, 360]]) {
    for (const r of buttonRects(w, h)) {
      const apart = r.x >= DarkButton.x + DarkButton.w || r.x + r.w <= DarkButton.x || r.y >= DarkButton.y + DarkButton.h || r.y + r.h <= DarkButton.y;
      assert.ok(apart, `${r.label} at ${w}x${h}`);
    }
  }
});

test('the help panel mentions the key', () => {
  assert.ok(HelpLines.some((line) => line.includes('Dark mode: N')));
});

test('the light shrinks the longer it is dark, to a floor', () => {
  const average = (from) => {
    let sum = 0;
    for (let t = from; t < from + 10; t += 0.05) sum += lightRadius(t);
    return sum / 200;
  };
  assert.ok(average(0) > average(60) && average(60) > average(150));
  assert.ok(average(400) > MIN_RADIUS * 0.8, 'it settles at the floor');
  assert.ok(lightRadius(0) < DARK_RADIUS * 1.11 && lightRadius(0) > DARK_RADIUS * 0.89);
});

test('the light goes out briefly now and then, never in the first seconds, and never abruptly', () => {
  for (let t = 0; t < 20; t += 0.05) assert.equal(blackout(t), 1);
  let dips = 0;
  let longest = 0;
  let run = 0;
  let previous = 1;
  for (let t = 20; t < 300; t += 0.02) {
    const b = blackout(t);
    assert.ok(Math.abs(b - previous) < 0.1, 'no sudden jump at ' + t);
    previous = b;
    if (b < 0.9) run += 0.02;
    else {
      if (run) dips++;
      longest = Math.max(longest, run);
      run = 0;
    }
    assert.ok(b >= 0.2 - 1e-9);
  }
  assert.ok(dips >= 10, 'about one a window: ' + dips);
  assert.ok(longest < 1, 'each is a split second: ' + longest);
});

test('turning dark mode on starts the light at full size again', () => {
  const dark = new DarkMode();
  dark.toggle();
  dark.update(100);
  assert.equal(dark.time, 100);
  dark.toggle();
  dark.toggle();
  assert.equal(dark.time, 0);
});
