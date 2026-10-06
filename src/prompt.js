const OFFSET = 26; // CSS pixels from the player's centre down to the prompt
const HEIGHT = 22;
const PAD = 8;
const GAP = 6;
const MARGIN = 12;

// The one thing the player can do where they stand, as { key, text }, or null
// when there is nothing to prompt. `key` is the label of the key (or, with
// `touch`, of the on-screen button) that does it, or null for a plain hint.
// A villager comes before a tree: the talk is what the player walked up for.
export function promptFor({ npc = null, hasNecklace = false, tree = null, hasAxe = false, touch = false } = {}) {
  if (npc && !npc.friend) {
    if (hasNecklace) return { key: 'E', text: 'Give ' + npc.name + ' a Shell Necklace' };
    // Short, so it stays clear of the touch buttons on a phone.
    return { key: null, text: npc.name + ' wants a Shell Necklace' };
  }
  if (tree && hasAxe) return { key: touch ? 'Chop' : 'Space', text: 'Chop tree' };
  return null;
}

// A small pill just under the player (who is always at the centre of the
// view), in CSS pixels: the key in a light cap, then what it does. All context
// state is restored afterwards.
export function drawPrompt(ctx, prompt, viewWidth, viewHeight, dpr) {
  if (!prompt) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px sans-serif';
  const capW = prompt.key ? ctx.measureText(prompt.key).width + PAD : 0;
  ctx.font = '13px sans-serif';
  const textW = ctx.measureText(prompt.text).width;
  const w = Math.min(viewWidth - MARGIN * 2, PAD * 2 + capW + (capW ? GAP : 0) + textW);
  const x = (viewWidth - w) / 2;
  const y = viewHeight / 2 + OFFSET;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x, y, w, HEIGHT);
  let tx = x + PAD;
  if (prompt.key) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(tx, y + 3, capW, HEIGHT - 6);
    ctx.fillStyle = '#1b1b1b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(prompt.key, tx + PAD / 2, y + HEIGHT / 2);
    tx += capW + GAP;
  }
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  // maxWidth squeezes the text rather than letting it run out of the pill.
  ctx.fillText(prompt.text, tx, y + HEIGHT / 2, x + w - PAD - tx);
  ctx.restore();
}
