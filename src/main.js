import { World, TILE } from './world.js';
import { Player } from './player.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const world = new World(1337);
const spawn = world.findSpawn();
const player = new Player(spawn.x, spawn.y);

const input = new Set();
window.addEventListener('keydown', (e) => input.add(e.code));
window.addEventListener('keyup', (e) => input.delete(e.code));
window.addEventListener('blur', () => input.clear());

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function draw() {
  const camX = Math.round(player.x - canvas.width / 2);
  const camY = Math.round(player.y - canvas.height / 2);
  ctx.setTransform(1, 0, 0, 1, -camX, -camY);

  const x0 = Math.floor(camX / TILE);
  const y0 = Math.floor(camY / TILE);
  const x1 = Math.ceil((camX + canvas.width) / TILE);
  const y1 = Math.ceil((camY + canvas.height) / TILE);
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      ctx.fillStyle = world.tileAt(tx, ty).color;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  player.draw(ctx);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  player.update(dt, input, world);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
