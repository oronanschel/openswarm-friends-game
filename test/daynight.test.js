import test from 'node:test';
import assert from 'node:assert/strict';
import { DayNight, tintAt, CYCLE, MAX_ALPHA } from '../src/daynight.js';

test('the tint is continuous across the whole cycle, including the wrap', () => {
  const steps = 2000;
  let prev = tintAt(0);
  for (let i = 1; i <= steps; i++) {
    const cur = tintAt(i / steps);
    assert.ok(Math.abs(cur.a - prev.a) < 0.01, `alpha jump at ${i / steps}`);
    // Colour may only move freely while the tint is nearly invisible.
    if (Math.min(cur.a, prev.a) > 0.02) {
      for (const k of ['r', 'g', 'b']) assert.ok(Math.abs(cur[k] - prev[k]) <= 8, `${k} jump at ${i / steps}`);
    }
    prev = cur;
  }
});

test('morning is clear, night is dark but capped', () => {
  assert.equal(tintAt(0).a, 0);
  assert.equal(tintAt(0.3).a, 0);
  const night = tintAt(0.75);
  assert.equal(night.a, MAX_ALPHA);
  for (let i = 0; i < 1000; i++) assert.ok(tintAt(i / 1000).a <= MAX_ALPHA);
});

test('time wraps after a full cycle', () => {
  const dn = new DayNight();
  dn.update(CYCLE * 0.75);
  assert.ok(Math.abs(dn.phase - 0.75) < 1e-9);
  dn.update(CYCLE * 0.5);
  assert.ok(Math.abs(dn.phase - 0.25) < 1e-9);
});

test('draw does nothing by day and restores ctx at night', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : (...args) => calls.push({ name, args })),
    set: (target, name, value) => ((target[name] = value), true),
  });
  new DayNight(0).draw(ctx, 800, 600, 2);
  assert.equal(calls.length, 0);
  new DayNight(CYCLE * 0.75).draw(ctx, 800, 600, 2);
  assert.equal(calls[0].name, 'save');
  assert.deepEqual(calls.find((c) => c.name === 'fillRect').args, [0, 0, 800, 600]);
  assert.equal(calls.at(-1).name, 'restore');
  assert.match(ctx.fillStyle, /^rgba\(10, 20, 60, 0\.450\)$/);
});
