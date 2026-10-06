import test from 'node:test';
import assert from 'node:assert/strict';
import { Recipes, canCraft, craft, drawRecipes } from '../src/crafting.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes, ItemById, RawItems } from '../src/items.js';

const { BERRY, STONE, SHELL, AXE } = ItemTypes;
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
  assert.equal(calls.filter((c) => c === 'fillText').length, Recipes.length + 1);
});
