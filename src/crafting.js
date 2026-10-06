import { ItemTypes } from './items.js';

const { BERRY, STONE, SHELL, STONE_AXE, NECKLACE, JAM } = ItemTypes;

// `key` is the KeyboardEvent.code that crafts the recipe.
export const Recipes = [
  { key: 'Digit1', output: STONE_AXE, inputs: [[STONE, 2], [BERRY, 1]] },
  { key: 'Digit2', output: NECKLACE, inputs: [[SHELL, 3]] },
  { key: 'Digit3', output: JAM, inputs: [[BERRY, 3]] },
];

export function canCraft(inventory, recipe) {
  return recipe.inputs.every(([type, n]) => inventory.count(type.id) >= n);
}

// Consumes the inputs and adds the output; returns false if unaffordable.
export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return false;
  for (const [type, n] of recipe.inputs) inventory.remove(type.id, n);
  inventory.add(recipe.output.id);
  return true;
}

const LINE = 18;
const MARGIN = 12;
const PAD = 8;
const WIDTH = 250;

// Recipe list at the top-left, in CSS pixels; all context state is restored.
export function drawRecipes(ctx, inventory, dpr) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(MARGIN, MARGIN, WIDTH, PAD * 2 + LINE * (Recipes.length + 1));
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText('Craft', MARGIN + PAD, MARGIN + PAD);
  Recipes.forEach((recipe, i) => {
    const inputs = recipe.inputs.map(([type, n]) => n + ' ' + type.name).join(' + ');
    const text = `[${i + 1}] ${recipe.output.name} = ${inputs}`;
    ctx.globalAlpha = canCraft(inventory, recipe) ? 1 : 0.4;
    ctx.fillText(text, MARGIN + PAD, MARGIN + PAD + LINE * (i + 1));
  });
  ctx.restore();
}
