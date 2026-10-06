import { World, TILE } from './world.js';
import { Player } from './player.js';
import { Npcs } from './npc.js';
import { Minimap } from './minimap.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(1337);
const spawn = world.findSpawn();
const player = new Player(spawn.x, spawn.y);
const npcs = new Npcs(world);
const minimap = new Minimap(world);

const input = new Set();
window.addEventListener('keydown', (e) => input.add(e.code));
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
  const camX = Math.round(player.x - viewW / 2);
  const camY = Math.round(player.y - viewH / 2);
  ctx.setTransform(dpr, 0, 0, dpr, -camX * dpr, -camY * dpr);

  const x0 = Math.floor(camX / TILE);
  const y0 = Math.floor(camY / TILE);
  const x1 = Math.ceil((camX + viewW) / TILE);
  const y1 = Math.ceil((camY + viewH) / TILE);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      ctx.fillStyle = world.tileAt(tx, ty).color;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  npcs.draw(ctx);
  player.draw(ctx);
  minimap.draw(ctx, canvas.width, player, npcs.all);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  player.update(dt, input, world);
  npcs.update(dt, player);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
