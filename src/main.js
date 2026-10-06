import { World, TILE } from './world.js';
import { Player } from './player.js';
import { Npcs } from './npc.js';
import { Minimap } from './minimap.js';
import { Items, ItemById, ItemTypes } from './items.js';
import { Inventory } from './inventory.js';
import { Toasts } from './toasts.js';
import { Recipes, craft, alreadyHave, drawRecipes } from './crafting.js';
import { Quest, GOAL } from './quest.js';
import { save, load, clear } from './save.js';
import { chop, treeInReach } from './chop.js';
import { TouchControls, buttonRects } from './touch.js';
import { DayNight } from './daynight.js';
import { Sound } from './sound.js';
import { DarkMode } from './darkmode.js';
import { Zombies } from './zombies.js';
import { Help } from './help.js';
import { promptFor, drawPrompt } from './prompt.js';
import { groundColor, hasArt, drawTileArt } from './tileart.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(1337);
const spawn = world.findSpawn();
const player = new Player(spawn.x, spawn.y);
const npcs = new Npcs(world);
const minimap = new Minimap(world);
const items = new Items(world);
const inventory = new Inventory();
const toasts = new Toasts();
const quest = new Quest();
const dayNight = new DayNight();
const darkMode = new DarkMode();
const zombies = new Zombies(world);

// Progress is kept in localStorage; reading the property can itself throw.
let storage = null;
try {
  storage = window.localStorage;
} catch {
  // Play without saving.
}
const sound = new Sound(storage);
const help = new Help(storage);
// Picking up and crafting both add to the inventory.
inventory.onAdd = (id, n) => {
  toasts.push('+' + n + ' ' + ItemById[id].name);
  sound.play('pickup');
};
const state = { world, player, inventory, items, npcs, dayNight, darkMode };
load(storage, state);
// A saved dark mode wants its hum, but audio may only start after a gesture.
sound.wantDrone = darkMode.on;
const startHum = () => sound.syncDrone();
window.addEventListener('keydown', startHum, { once: true });
window.addEventListener('pointerdown', startHum, { once: true });
let resetting = false;
const autosave = () => {
  if (!resetting) save(storage, state);
};
setInterval(autosave, 5000);
window.addEventListener('pagehide', autosave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave();
});

const input = new Set();
// Every key handler goes through this. A press with Ctrl, Cmd or Alt held is
// a browser shortcut (Ctrl+F, Cmd+Shift+R, ...) and is left to the browser.
const onKey = (handler) =>
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) handler(e);
  });
onKey((e) => input.add(e.code));
// Shift+R wipes the save and starts over.
onKey((e) => {
  if (e.code !== 'KeyR' || !e.shiftKey) return;
  resetting = true;
  clear(storage);
  window.location.reload();
});
// Space chops the nearest tree, once the player has crafted a stone axe.
onKey((e) => {
  if (e.code !== 'Space' || e.repeat) return;
  if (!chop(world, player, inventory, ItemTypes.STONE_AXE)) return;
  minimap.invalidate();
  toasts.push('Chopped a tree');
  sound.play('chop');
});
// Number keys craft the matching recipe.
onKey((e) => {
  const recipe = Recipes.find((r) => r.key === e.code);
  if (!recipe || e.repeat) return;
  if (alreadyHave(inventory, recipe)) {
    toasts.push('You already have a ' + recipe.output.name);
    sound.play('nope');
  } else if (!craft(inventory, recipe)) {
    toasts.push('Need ' + recipe.inputs.map(([type, n]) => n + ' ' + type.name).join(' + '));
    sound.play('nope');
  }
});
// F eats a Berry Jam for a burst of speed.
onKey((e) => {
  if (e.code !== 'KeyF' || e.repeat) return;
  if (player.eat(inventory, ItemTypes.JAM)) {
    toasts.push('Yum! Speed boost');
    sound.play('eat');
  } else {
    toasts.push('Need Berry Jam');
    sound.play('nope');
  }
});
window.addEventListener('keyup', (e) => input.delete(e.code));
window.addEventListener('blur', () => input.clear());
// E gives a Shell Necklace to the villager you are talking to, making a friend.
onKey((e) => {
  if (e.code !== 'KeyE' || e.repeat) return;
  const npc = npcs.talkingTo(player);
  if (!npc || npc.friend) return;
  if (npcs.befriend(npc, inventory)) {
    toasts.push(npc.name + ' is now your friend!');
    sound.play('friend');
  } else {
    toasts.push(npc.name + ' wants a Shell Necklace');
    sound.play('nope');
  }
});
// M mutes or unmutes the sound effects.
onKey((e) => {
  if (e.code !== 'KeyM' || e.repeat) return;
  toasts.push(sound.toggleMute() ? 'Sound off' : 'Sound on');
  sound.play('pickup');
});
// N turns dark mode on or off.
onKey((e) => {
  if (e.code !== 'KeyN' || e.repeat) return;
  toasts.push(darkMode.toggle() ? 'The lights go out...' : 'Lights on');
  sound.setDrone(darkMode.on);
});
// H shows or hides the help panel; any other key, or a tap, closes it. The
// key still does its usual job.
onKey((e) => {
  if (e.code !== 'KeyH') help.dismiss();
  else if (!e.repeat) help.toggle();
});
// Whether the tap being handled closed the help: then a tap on the ? button
// has done its job, and must not open the help again.
let tapClosedHelp = false;
canvas.addEventListener('pointerdown', () => {
  tapClosedHelp = help.dismiss();
});

// Canvas backing store is in device pixels; drawing uses CSS pixels.
let viewW = 0;
let viewH = 0;
// On touch screens a drag steers and on-screen buttons stand in for the keys
// above, by sending the same keydown the keyboard would.
const touch = new TouchControls(
  canvas,
  input,
  (code) => {
    if (code === 'KeyH' && tapClosedHelp) return;
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  },
  () => ({ width: viewW, height: viewH })
);
let dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
}
window.addEventListener('resize', resize);
resize();

const art = []; // tile, tx, ty triples seen while filling the terrain
function draw() {
  // Camera in whole device pixels, so nothing lands between pixels.
  const camXd = Math.round((player.x - viewW / 2) * dpr);
  const camYd = Math.round((player.y - viewH / 2) * dpr);
  const camX = camXd / dpr;
  const camY = camYd / dpr;

  // Terrain is drawn in device pixels with rounded edges: at fractional dpr,
  // TILE * dpr is not whole and scaled fillRects would leave antialiased seams.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const x0 = Math.floor(camX / TILE);
  const y0 = Math.floor(camY / TILE);
  const x1 = Math.ceil((camX + viewW) / TILE);
  const y1 = Math.ceil((camY + viewH) / TILE);
  for (let ty = y0; ty < y1; ty++) {
    const top = Math.round(ty * TILE * dpr) - camYd;
    const bottom = Math.round((ty + 1) * TILE * dpr) - camYd;
    for (let tx = x0; tx < x1; tx++) {
      const left = Math.round(tx * TILE * dpr) - camXd;
      const right = Math.round((tx + 1) * TILE * dpr) - camXd;
      const tile = world.tileAt(tx, ty);
      ctx.fillStyle = groundColor(world, tx, ty);
      ctx.fillRect(left, top, right - left, bottom - top);
      if (hasArt(tile, tx, ty)) art.push(tile, tx, ty);
    }
  }

  ctx.setTransform(dpr, 0, 0, dpr, -camXd, -camYd);
  // Trees, pines, stumps and ripples are shapes on top of the ground fill.
  for (let i = 0; i < art.length; i += 3) drawTileArt(ctx, art[i], art[i + 1] * TILE, art[i + 2] * TILE);
  art.length = 0;
  items.draw(ctx);
  npcs.draw(ctx, darkMode.on);
  zombies.draw(ctx);
  player.draw(ctx);
  // Tint the world only; the HUD below stays readable at night.
  dayNight.draw(ctx, viewW, viewH, dpr);
  darkMode.draw(ctx, viewW, viewH, dpr);
  // Still in world coordinates: villagers' words show through the darkness.
  if (darkMode.on) npcs.drawBubbles(ctx);
  minimap.draw(ctx, viewW, dpr, player, npcs.all, items.all);
  inventory.draw(ctx, viewH, dpr, viewW);
  // Below this width the full recipe panel would run into the minimap.
  const narrow = viewW < 460;
  const hint = narrow || npcs.friends.size >= GOAL ? '' : ' (E: necklace)';
  const friends = quest.progressText() + hint;
  drawRecipes(ctx, inventory, dpr, friends, narrow);
  toasts.draw(ctx, viewH, dpr);
  // What a key would do where the player stands, shown just under them.
  const action = promptFor({
    npc: npcs.talkingTo(player),
    hasNecklace: inventory.count(ItemTypes.NECKLACE.id) > 0,
    tree: treeInReach(world, player),
    hasAxe: inventory.count(ItemTypes.STONE_AXE.id) > 0,
    touch: touch.active,
  });
  if (!help.visible) drawPrompt(ctx, action, viewW, viewH, dpr, touch.active ? buttonRects(viewW, viewH) : []);
  quest.draw(ctx, viewW, viewH, dpr);
  help.draw(ctx, viewW, viewH, dpr);
  // Last, so the buttons stay visible above the win banner and the help.
  touch.draw(ctx, viewW, viewH, dpr);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  player.sync(inventory);
  if (player.update(dt, input, world)) {
    toasts.push('Speed boost ended');
    sound.play('boostEnd');
  }
  npcs.update(dt, player, inventory, dayNight.day);
  // Zombies walk only in dark mode; one that reaches the player takes an item.
  for (const event of zombies.update(dt, player, darkMode.on, inventory)) {
    toasts.push(event.item ? 'A zombie took a ' + event.item.name + '!' : 'A zombie shoved you!');
    sound.play('groan');
  }
  items.update(player, inventory);
  toasts.update(dt);
  quest.update(dt, npcs.friends.size);
  dayNight.update(dt);
  darkMode.update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
