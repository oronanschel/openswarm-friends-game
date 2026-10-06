import test from 'node:test';
import assert from 'node:assert/strict';
import { Sound, Effects } from '../src/sound.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

class FakeAudio {
  static made = 0;
  static oscillators = 0;
  constructor() {
    FakeAudio.made++;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createOscillator() {
    FakeAudio.oscillators++;
    return { frequency: {}, connect() {}, start() {}, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
  }
}

test('play makes one oscillator per note and reuses one context', () => {
  FakeAudio.made = 0;
  FakeAudio.oscillators = 0;
  const sound = new Sound(fakeStorage(), FakeAudio);
  assert.equal(sound.play('friend'), true);
  assert.equal(sound.play('pickup'), true);
  assert.equal(FakeAudio.made, 1);
  assert.equal(FakeAudio.oscillators, Effects.friend.length + Effects.pickup.length);
});

test('every effect has notes and the boost-end sound exists', () => {
  assert.ok(Effects.boostEnd.length > 0);
  for (const notes of Object.values(Effects)) {
    for (const [freq, start, length] of notes) assert.ok(freq > 0 && start >= 0 && length > 0);
  }
});

test('muting silences play and is remembered', () => {
  const storage = fakeStorage();
  const sound = new Sound(storage, FakeAudio);
  assert.equal(sound.toggleMute(), true);
  assert.equal(sound.play('eat'), false);
  assert.equal(new Sound(storage, FakeAudio).muted, true);
  assert.equal(sound.toggleMute(), false);
  assert.equal(new Sound(storage, FakeAudio).muted, false);
});

test('without WebAudio, storage, or a known effect nothing throws', () => {
  assert.equal(new Sound(null, null).play('chop'), false);
  assert.equal(new Sound(null, FakeAudio).play('no-such-effect'), false);
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const sound = new Sound(broken, FakeAudio);
  assert.equal(sound.muted, false);
  assert.equal(sound.toggleMute(), true);
  const Throwing = class { constructor() { throw new Error('no audio'); } };
  assert.equal(new Sound(null, Throwing).play('chop'), false);
});
