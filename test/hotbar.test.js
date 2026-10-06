import test from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, hotbarLayout } from '../src/inventory.js';
import { ItemById } from '../src/items.js';

const MARGIN = 12;
const GAP = 6;

test('slots are 40px wherever they fit', () => {
  for (const slots of [6, 7, 8, 9]) {
    const full = MARGIN + slots * 46 - GAP;
    for (const width of [full + MARGIN, 800, 1920, Infinity]) {
      assert.deepEqual(hotbarLayout(width, slots), { slot: 40, right: full, top: 52 }, `${slots} slots at ${width}`);
    }
  }
  // No width given: full size, for the real number of item types.
  assert.equal(hotbarLayout().slot, 40);
  assert.equal(hotbarLayout().right, MARGIN + ItemById.length * 46 - GAP);
});

test('the bar fits every width from 320px for 6 to 9 item types', () => {
  for (const slots of [6, 7, 8, 9]) {
    for (let width = 320; width <= 500; width++) {
      const { slot, right, top } = hotbarLayout(width, slots);
      const at = `${slots} slots at ${width}`;
      assert.ok(right <= width - MARGIN, at);
      assert.ok(slot >= 24 && slot <= 40, at);
      assert.equal(right, MARGIN + slots * (slot + GAP) - GAP, at);
      assert.equal(top, MARGIN + slot, at);
      // As large as will fit: one pixel more per slot would not.
      if (slot < 40) assert.ok(MARGIN + slots * (slot + 1 + GAP) - GAP > width - MARGIN, at);
    }
  }
});

test('slots never shrink below 24px, even where the bar then cannot fit', () => {
  assert.equal(hotbarLayout(100, 8).slot, 24);
  assert.equal(hotbarLayout(0, 8).slot, 24);
});

// Records fillRect and fillText calls with their arguments.
function recorder() {
  const rects = [];
  const texts = [];
  const names = [];
  const ctx = new Proxy(
    {
      fillRect: (...args) => (names.push('fillRect'), rects.push(args)),
      fillText: (...args) => (names.push('fillText'), texts.push(args)),
    },
    { get: (target, name) => (name in target ? target[name] : () => names.push(name)), set: () => true }
  );
  return { ctx, rects, texts, names };
}

test('drawing on a narrow window keeps every slot and count on screen', () => {
  const inventory = new Inventory();
  inventory.add(ItemById[0].id, 12);
  const { ctx, rects, texts, names } = recorder();
  inventory.draw(ctx, 568, 2, 320);
  const { slot, right } = hotbarLayout(320);
  // Slot backgrounds are the squares of side `slot`.
  const slots = rects.filter(([, , w, h]) => w === slot && h === slot);
  assert.equal(slots.length, ItemById.length);
  for (const [x, y, w, h] of slots) assert.ok(x >= MARGIN && x + w <= right && y + h === 568 - MARGIN);
  assert.equal(texts.length, ItemById.length);
  assert.equal(texts[0][0], '12');
  // Counts are right-aligned inside their slot.
  texts.forEach(([, x, y], i) => {
    const left = MARGIN + i * (slot + GAP);
    assert.ok(x > left && x <= left + slot && y <= 568 - MARGIN);
  });
  assert.equal(names[0], 'save');
  assert.equal(names.at(-1), 'restore');
});

test('drawing without a width is the full-size bar, as before', () => {
  const { ctx, rects } = recorder();
  new Inventory().draw(ctx, 600, 1);
  const slots = rects.filter(([, , w, h]) => w === 40 && h === 40);
  assert.equal(slots.length, ItemById.length);
  assert.deepEqual(slots[0].slice(0, 2), [12, 548]);
  assert.equal(slots[1][0], 58);
});
