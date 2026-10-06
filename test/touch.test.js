import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls, Buttons, buttonRects, buttonAt, stickKeys } from '../src/touch.js';
import { HOTBAR_RIGHT, HOTBAR_TOP } from '../src/inventory.js';
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

test('on a short window the buttons use three columns and stay below the minimap', () => {
  const rects = buttonRects(640, 360);
  assert.equal(new Set(rects.map((r) => r.x)).size, 3);
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.x + r.w <= 640 && r.y + r.h <= 360);
    // The minimap occupies y 12 to 174 at the top-right.
    assert.ok(r.y >= 174, `button ${r.label} at y=${r.y}`);
    assert.equal(buttonAt(r.x + 1, r.y + 1, 640, 360).code, r.code);
  }
  for (const a of rects) {
    for (const b of rects) {
      if (a !== b) assert.ok(a.x !== b.x || a.y !== b.y);
    }
  }
  // The tall layout also clears the minimap from its threshold up.
  assert.ok(buttonRects(360, 542).every((r) => r.y >= 174));
});

test('between the two, columns of four clear the minimap at every height', () => {
  for (let height = 0; height <= 700; height++) {
    const rects = buttonRects(640, height);
    if (height >= 386) assert.ok(rects.every((r) => r.y >= 174), `height ${height}`);
    if (height >= 386 && height < 542) assert.equal(new Set(rects.map((r) => r.x)).size, 2, `height ${height}`);
  }
});

test('no button touches the hotbar or the minimap, however narrow the window', () => {
  // Three rows above the hotbar need 382px of height.
  for (let width = 320; width <= 700; width += 4) {
    for (let height = 382; height <= 700; height += 2) {
      const rects = buttonRects(width, height);
      const at = `${width}x${height}`;
      assert.equal(new Set(rects.map((r) => r.x + ',' + r.y)).size, Buttons.length, at);
      for (const r of rects) {
        assert.ok(r.x >= 0 && r.x + r.w <= width && r.y + r.h <= height, at);
        assert.ok(r.y >= 174, at);
        assert.ok(r.x >= HOTBAR_RIGHT || r.y + r.h <= height - HOTBAR_TOP, at);
      }
    }
  }
});

test('a narrow window lifts the buttons above the hotbar; a wide one does not', () => {
  // 360x500 used to put the second column's bottom button on the last slot.
  const narrow = buttonRects(360, 500);
  assert.ok(narrow.every((r) => r.y + r.h <= 500 - HOTBAR_TOP));
  assert.equal(new Set(narrow.map((r) => r.x)).size, 2);
  const wide = buttonRects(640, 500);
  assert.equal(wide[0].y + wide[0].h, 500 - 12);
  // One column at 360 wide is already clear of the hotbar and stays put.
  const tall = buttonRects(360, 640);
  assert.equal(tall[0].y + tall[0].h, 640 - 12);
});

test('the Mute button sends the M key', () => {
  const { controls, fire, pressed } = setup();
  const mute = buttonRects(VIEW.width, VIEW.height).find((r) => r.label === 'Mute');
  fire('pointerdown', 1, mute.x + 5, mute.y + 5);
  assert.deepEqual(pressed, ['KeyM']);
  assert.equal(controls.stick, null);
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
