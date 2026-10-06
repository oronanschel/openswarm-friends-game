import { World, TILE } from './world.js';
import { Player } from './player.js';
import { Npcs } from './npc.js';
import { Minimap } from './minimap.js';
import { Items } from './items.js';
import { Inventory } from './inventory.js';
import { save, load, clear } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(1337);
const spawn = world.findSpawn();
const player = new Player(spawn.x, spawn.y);
const npcs = new Npcs(world);
const minimap = new Minimap(world);
const items = new Items(world);
const inventory = new Inventory();

// Progress is kept in localStorage; reading the property can itself throw.
let storage = null;
try {
  storage = window.localStorage;
} catch {
  // Play without saving.
}
const state = { world, player, inventory, items, npcs };
load(storage, state);
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
window.addEventListener('keydown', (e) => input.add(e.code));
// Shift+R wipes the save and starts over.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || !e.shiftKey) return;
  resetting = true;
  clear(storage);
  window.location.reload();
});
window.addEventListener('keyup', (e) => input.delete(e.code));
window.addEventListener('blur', () => input.clear());

// Canvas backing store is in device pixels; drawing uses CSS pixels.
let viewW = 0;
let viewH = 0;
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
      ctx.fillStyle = world.tileAt(tx, ty).color;
      ctx.fillRect(left, top, right - left, bottom - top);
    }
  }

  ctx.setTransform(dpr, 0, 0, dpr, -camXd, -camYd);
  items.draw(ctx);
  npcs.draw(ctx);
  player.draw(ctx);
  minimap.draw(ctx, viewW, dpr, player, npcs.all);
  inventory.draw(ctx, viewH, dpr);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  player.update(dt, input, world);
  npcs.update(dt, player);
  items.update(player, inventory);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
