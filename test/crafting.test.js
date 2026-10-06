import test from 'node:test';
import assert from 'node:assert/strict';
import { Recipes, canCraft, craft, drawRecipes, recipeInputs } from '../src/crafting.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes, ItemById, RawItems } from '../src/items.js';

const { BERRY, STONE, SHELL, STONE_AXE: AXE } = ItemTypes;
const axe = Recipes.find((r) => r.output === AXE);

test('crafting consumes exactly the inputs and adds the output', () => {
  const inventory = new Inventory();
  inventory.add(STONE.id, 3);
  inventory.add(BERRY.id, 1);
  const added = [];
  inventory.onAdd = (id, n) => added.push([id, n]);
  assert.equal(craft(inventory, axe), true);
  assert.equal(inventory.count(STONE.id), 1);
  assert.equal(inventory.count(BERRY.id), 0);
  assert.equal(inventory.count(AXE.id), 1);
  assert.deepEqual(added, [[AXE.id, 1]]);
});

test('unaffordable recipes are refused and change nothing', () => {
  const inventory = new Inventory();
  inventory.add(STONE.id, 2);
  assert.equal(canCraft(inventory, axe), false);
  assert.equal(craft(inventory, axe), false);
  assert.equal(inventory.count(STONE.id), 2);
  assert.equal(inventory.count(AXE.id), 0);
});

test('inventory.remove refuses to go negative and drops empty entries', () => {
  const inventory = new Inventory();
  inventory.add(SHELL.id, 2);
  assert.equal(inventory.remove(SHELL.id, 3), false);
  assert.equal(inventory.count(SHELL.id), 2);
  assert.equal(inventory.remove(SHELL.id, 2), true);
  assert.equal(inventory.counts.has(SHELL.id), false);
});

test('recipes have unique keys and outputs that are not raw items', () => {
  assert.equal(new Set(Recipes.map((r) => r.key)).size, Recipes.length);
  for (const recipe of Recipes) {
    assert.equal(ItemById[recipe.output.id], recipe.output);
    assert.ok(!RawItems.includes(recipe.output));
  }
});

test('the recipe panel restores context state', () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => calls.push(name)),
    set: (target, name, value) => ((target[name] = value), true),
  });
  drawRecipes(ctx, new Inventory(), 2);
  assert.equal(calls[0], 'save');
  assert.equal(calls.at(-1), 'restore');
  // The title, then per recipe its name, its inputs and the plus signs between.
  const pieces = Recipes.reduce((sum, r) => sum + r.inputs.length * 2, 0);
  assert.equal(calls.filter((c) => c === 'fillText').length, pieces + 1);
});

test('recipe inputs read as a count when held and as have/need when short', () => {
  const inventory = new Inventory();
  inventory.add(STONE.id, 1);
  inventory.add(BERRY.id, 4);
  assert.deepEqual(recipeInputs(inventory, axe), [
    { text: '1/2 Stone', missing: true },
    { text: '1 Berry', missing: false },
  ]);
  inventory.add(STONE.id, 1);
  assert.ok(recipeInputs(inventory, axe).every((input) => !input.missing));
});

test('the panel picks out only the inputs still to find', () => {
  const inventory = new Inventory();
  inventory.add(BERRY.id, 1);
  const drawn = []; // [text, fillStyle, globalAlpha]
  let end = 0; // furthest right any piece is allowed to reach
  const ctx = new Proxy({}, {
    get: (target, name) => {
      if (name === 'measureText') return (text) => ({ width: text.length * 7 });
      if (name === 'fillText') {
        return (text, x, y, maxWidth) => {
          drawn.push([text, target.fillStyle, target.globalAlpha]);
          if (maxWidth !== undefined) end = Math.max(end, x + maxWidth);
        };
      }
      return name in target ? target[name] : () => {};
    },
    set: (target, name, value) => ((target[name] = value), true),
  });
  drawRecipes(ctx, inventory, 1, 'Friends: 0');
  const find = (text) => drawn.find((d) => d[0] === text);
  const [, shortColor, shortAlpha] = find('0/2 Stone');
  assert.notEqual(shortColor, '#fff');
  assert.equal(shortAlpha, 1);
  // The berry is in hand, so it stays with the rest of the dimmed line.
  assert.deepEqual(find('1 Berry').slice(1), ['#fff', 0.4]);
  assert.deepEqual(find('Friends: 0').slice(1), ['#fff', 1]);
  // Every piece is held inside the panel, which spans 12 to 262.
  assert.ok(end > 12 && end <= 262, `pieces may reach ${end}`);
});
