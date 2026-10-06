import { ItemTypes } from './items.js';

const { BERRY, STONE, SHELL, STONE_AXE, NECKLACE, JAM, WOOD, RAFT } = ItemTypes;

// `key` is the KeyboardEvent.code that crafts the recipe.
export const Recipes = [
  { key: 'Digit1', output: STONE_AXE, inputs: [[STONE, 2], [BERRY, 1]] },
  { key: 'Digit2', output: NECKLACE, inputs: [[SHELL, 3]] },
  { key: 'Digit3', output: JAM, inputs: [[BERRY, 3]] },
  // `unique`: one is all anyone needs, so a second is refused.
  { key: 'Digit4', output: RAFT, inputs: [[WOOD, 6]], unique: true },
];

export function canCraft(inventory, recipe) {
  return recipe.inputs.every(([type, n]) => inventory.count(type.id) >= n);
}

export function alreadyHave(inventory, recipe) {
  return Boolean(recipe.unique) && inventory.count(recipe.output.id) > 0;
}

// Consumes the inputs and adds the output; returns false, changing nothing, if
// unaffordable or if a unique output is already held.
export function craft(inventory, recipe) {
  if (alreadyHave(inventory, recipe) || !canCraft(inventory, recipe)) return false;
  for (const [type, n] of recipe.inputs) inventory.remove(type.id, n);
  inventory.add(recipe.output.id);
  return true;
}

const LINE = 18;
const MARGIN = 12;
const PAD = 8;
const WIDTH = 250;

const COMPACT_WIDTH = 140;
const MISSING = '#ffcc66'; // an input the player is still short of

// A recipe's inputs as panel text, in order: `{ text, missing }` per input.
// An input the player has enough of reads "2 Stone"; one they are short of
// reads "1/2 Stone", what they hold out of what it takes.
export function recipeInputs(inventory, recipe) {
  return recipe.inputs.map(([type, n]) => {
    const have = inventory.count(type.id);
    return have >= n ? { text: n + ' ' + type.name, missing: false } : { text: have + '/' + n + ' ' + type.name, missing: true };
  });
}

// Recipe list at the top-left, in CSS pixels, with an optional `footer` line
// (e.g. the friend count); all context state is restored. `compact` (for
// narrow windows) replaces the recipe lines with one short line per recipe.
export function drawRecipes(ctx, inventory, dpr, footer = null, compact = false) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lines = Recipes.length + 1 + (footer ? 1 : 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(MARGIN, MARGIN, compact ? COMPACT_WIDTH : WIDTH, PAD * 2 + LINE * lines);
  ctx.font = compact ? '12px sans-serif' : '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText('Craft', MARGIN + PAD, MARGIN + PAD);
  Recipes.forEach((recipe, i) => {
    const y = MARGIN + PAD + LINE * (i + 1);
    const held = alreadyHave(inventory, recipe);
    const dim = canCraft(inventory, recipe) && !held ? 1 : 0.4;
    const head = `[${i + 1}] ${recipe.output.name}`;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = dim;
    if (compact) {
      ctx.fillText(head, MARGIN + PAD, y);
      return;
    }
    // Piece by piece, so the inputs still to find stand out from the dimmed
    // line: those are the next thing to go and pick up.
    let x = MARGIN + PAD;
    const put = (text) => {
      // maxWidth squeezes a piece rather than letting it run out of the panel.
      ctx.fillText(text, x, y, Math.max(1, MARGIN + WIDTH - PAD - x));
      x += ctx.measureText(text).width;
    };
    put(head + ' = ');
    recipeInputs(inventory, recipe).forEach((input, j) => {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = dim;
      if (j) put(' + ');
      if (input.missing && !held) {
        ctx.fillStyle = MISSING;
        ctx.globalAlpha = 1;
      }
      put(input.text);
    });
  });
  ctx.fillStyle = '#fff';
  if (footer) {
    ctx.globalAlpha = 1;
    ctx.fillText(footer, MARGIN + PAD, MARGIN + PAD + LINE * (Recipes.length + 1));
  }
  ctx.restore();
}
