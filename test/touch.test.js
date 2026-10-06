import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls, Buttons, buttonRects, buttonAt, stickKeys } from '../src/touch.js';
import { Player } from '../src/player.js';
import { TILE } from '../src/world.js';

const VIEW = { width: 360, height: 640 };

function setup() {
  const handlers = {};
  const target = { addEventListener: (name, fn) => (handlers[name] = fn) };
  const input = new Set();
  const pressed = [];
  const controls = new TouchControls(target, input, (code) => pressed.push(code), () => VIEW);
  const fire = (name, pointerId, clientX, clientY, pointerType = 'touch') =>
    handlers[name]({ pointerId, clientX, clientY, pointerType, preventDefault() {} });
  return { controls, input, pressed, fire };
}

test('the stick gives eight directions and nothing inside the dead zone', () => {
  assert.deepEqual(stickKeys(0, 0), []);
  assert.deepEqual(stickKeys(5, -5), []);
  assert.deepEqual(stickKeys(40, 0), ['ArrowRight']);
  assert.deepEqual(stickKeys(-40, 3), ['ArrowLeft']);
  assert.deepEqual(stickKeys(2, -40), ['ArrowUp']);
  assert.deepEqual(stickKeys(0, 40), ['ArrowDown']);
  assert.deepEqual(stickKeys(30, 30), ['ArrowRight', 'ArrowDown']);
  assert.deepEqual(stickKeys(-30, -25), ['ArrowLeft', 'ArrowUp']);
  // Opposite directions are never held together.
  for (let a = 0; a < 360; a += 5) {
    const keys = stickKeys(Math.cos((a * Math.PI) / 180) * 50, Math.sin((a * Math.PI) / 180) * 50);
    assert.ok(keys.length === 1 || keys.length === 2, `angle ${a}`);
    assert.ok(!(keys.includes('ArrowLeft') && keys.includes('ArrowRight')));
    assert.ok(!(keys.includes('ArrowUp') && keys.includes('ArrowDown')));
  }
});

test('buttons sit on screen, do not overlap, and are found by position', () => {
  const rects = buttonRects(VIEW.width, VIEW.height);
  assert.equal(rects.length, Buttons.length);
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= VIEW.width && r.y + r.h <= VIEW.height);
    assert.equal(buttonAt(r.x + r.w / 2, r.y + r.h / 2, VIEW.width, VIEW.height).code, r.code);
  }
  for (let i = 1; i < rects.length; i++) assert.ok(rects[i].y + rects[i].h <= rects[i - 1].y);
  // Clear of the 6-slot hotbar at the bottom-left, which ends at 288px.
  assert.ok(rects[0].x >= 288);
  assert.equal(buttonAt(10, 10, VIEW.width, VIEW.height), null);
});

test('dragging holds arrow codes and lifting releases them', () => {
  const { controls, input, fire } = setup();
  fire('pointerdown', 1, 100, 300);
  assert.equal(controls.active, true);
  assert.deepEqual([...input], []);
  fire('pointermove', 1, 150, 300);
  assert.deepEqual([...input], ['ArrowRight']);
  fire('pointermove', 1, 100, 250);
  assert.deepEqual([...input], ['ArrowUp']);
  // Another finger moving does not steer.
  fire('pointermove', 2, 0, 600);
  assert.deepEqual([...input], ['ArrowUp']);
  fire('pointerup', 2, 0, 600);
  assert.deepEqual([...input], ['ArrowUp']);
  fire('pointerup', 1, 100, 250);
  assert.deepEqual([...input], []);
});

test('lifting the finger leaves keys held on a real keyboard alone', () => {
  const { input, fire } = setup();
  input.add('KeyD');
  fire('pointerdown', 1, 100, 300);
  fire('pointermove', 1, 100, 360);
  assert.deepEqual([...input].sort(), ['ArrowDown', 'KeyD']);
  fire('pointercancel', 1, 100, 360);
  assert.deepEqual([...input], ['KeyD']);
});

test('tapping a button presses its code without starting a drag, even mid-drag', () => {
  const { controls, input, pressed, fire } = setup();
  const [chop, give] = buttonRects(VIEW.width, VIEW.height);
  fire('pointerdown', 1, chop.x + 5, chop.y + 5);
  assert.deepEqual(pressed, ['Space']);
  assert.equal(controls.stick, null);
  fire('pointerdown', 2, 100, 300);
  fire('pointermove', 2, 60, 300);
  fire('pointerdown', 3, give.x + 5, give.y + 5);
  assert.deepEqual(pressed, ['Space', 'KeyE']);
  assert.deepEqual([...input], ['ArrowLeft']);
});

test('a mouse is ignored and the controls stay hidden', () => {
  const { controls, input, pressed, fire } = setup();
  const [chop] = buttonRects(VIEW.width, VIEW.height);
  fire('pointerdown', 1, chop.x + 5, chop.y + 5, 'mouse');
  fire('pointerdown', 1, 100, 300, 'mouse');
  fire('pointermove', 1, 200, 300, 'mouse');
  assert.equal(controls.active, false);
  assert.deepEqual(pressed, []);
  assert.deepEqual([...input], []);
  const calls = [];
  controls.draw(new Proxy({}, { get: () => () => calls.push(1) }), 360, 640, 1);
  assert.equal(calls.length, 0);
});

test('a drag actually moves the player', () => {
  const { input, fire } = setup();
  const world = { isSolid: () => false };
  const player = new Player(TILE, TILE);
  fire('pointerdown', 1, 100, 300);
  fire('pointermove', 1, 140, 340);
  player.update(0.1, input, world);
  assert.ok(player.x > TILE && player.y > TILE);
});

test('drawing restores context state', () => {
  const { controls, fire } = setup();
  fire('pointerdown', 1, 100, 300);
  fire('pointermove', 1, 300, 300);
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : (...args) => calls.push({ name, args })),
    set: (target, name, value) => ((target[name] = value), true),
  });
  controls.draw(ctx, 360, 640, 2);
  assert.equal(calls[0].name, 'save');
  assert.equal(calls.at(-1).name, 'restore');
  assert.equal(calls.filter((c) => c.name === 'fillText').length, Buttons.length);
  // The knob is clamped to the ring: 48px right of where the finger went down.
  const knob = calls.filter((c) => c.name === 'arc').at(-1);
  assert.deepEqual(knob.args.slice(0, 2), [148, 300]);
});
