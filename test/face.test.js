import test from 'node:test';
import assert from 'node:assert/strict';
import { eyes, drawFace } from '../src/face.js';
import { Player, RADIUS } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { World } from '../src/world.js';

const open = { isSolid: () => false };

// Records fillRect() calls; every other canvas method is a no-op.
function rects(draw) {
  const calls = [];
  const ctx = new Proxy(
    { fillRect: (...args) => calls.push(args), measureText: () => ({ width: 0 }) },
    { get: (target, name) => (name in target ? target[name] : () => {}), set: () => true }
  );
  draw(ctx);
  return calls;
}

test('the eyes shift towards where the character faces, whatever the vector length', () => {
  const [left, right] = eyes(100, 50, 0, 0);
  assert.ok(left.x < 100 && right.x > 100);
  assert.equal(left.y, right.y);
  assert.equal(left.x + right.x, 200);

  assert.ok(eyes(100, 50, 1, 0)[0].x > left.x);
  assert.ok(eyes(100, 50, -1, 0)[0].x < left.x);
  assert.ok(eyes(100, 50, 0, 1)[0].y > left.y);
  assert.ok(eyes(100, 50, 0, -1)[0].y < left.y);
  assert.deepEqual(eyes(100, 50, 40, 0), eyes(100, 50, 1, 0));
});

test('both eyes stay inside the body in every direction', () => {
  for (let a = 0; a < 360; a += 5) {
    const fx = Math.cos((a * Math.PI) / 180);
    const fy = Math.sin((a * Math.PI) / 180);
    const drawn = rects((ctx) => drawFace(ctx, 0, 0, fx, fy));
    assert.equal(drawn.length, 2);
    for (const [x, y, w, h] of drawn) {
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        assert.ok(Math.hypot(cx, cy) <= RADIUS, `angle ${a}: ${cx},${cy}`);
      }
    }
  }
});

test('the player faces the last direction moved and keeps it when stopping', () => {
  const player = new Player(0, 0);
  assert.deepEqual([player.faceX, player.faceY], [0, 1]);
  player.update(0.1, new Set(['ArrowLeft']), open);
  assert.deepEqual([player.faceX, player.faceY], [-1, 0]);
  player.update(0.1, new Set(), open);
  assert.deepEqual([player.faceX, player.faceY], [-1, 0]);
  player.update(0.1, new Set(['KeyW', 'KeyD']), open);
  assert.ok(player.faceX > 0 && player.faceY < 0);
  // Facing a wall still turns the face, though the body cannot move.
  const boxed = { isSolid: () => true };
  player.update(0.1, new Set(['ArrowDown']), boxed);
  assert.deepEqual([player.faceX, player.faceY], [0, 1]);
  assert.equal(rects((ctx) => player.draw(ctx)).length, 2);
});

test('a villager looks at the player while talking and where it walks otherwise', () => {
  const world = new World(1337);
  const spawn = world.findSpawn();
  const far = new Player(spawn.x, spawn.y);
  const npcs = new Npcs(world);
  npcs.update(1 / 60, far);
  const npc = npcs.all[0];

  // Wander with the player out of earshot until this villager is walking.
  far.x = npc.x + 100000;
  for (let i = 0; i < 600 && !(npc.dx || npc.dy); i++) npc.update(1 / 60, far, world);
  assert.ok(npc.dx || npc.dy);
  assert.ok(Math.abs(npc.faceX) === Math.abs(npc.dx) && Math.abs(npc.faceY) === Math.abs(npc.dy));

  // Standing right above it: the villager looks up.
  const near = new Player(npc.x, npc.y - 30);
  npc.update(1 / 60, near, world);
  assert.equal(npc.talking, true);
  assert.ok(npc.faceY < 0);
  assert.equal(npc.faceX, 0);
  assert.equal(rects((ctx) => npc.draw(ctx)).length >= 2, true);
});

test('villagers still wander the same way on every run', () => {
  const world = new World(7);
  const spawn = world.findSpawn();
  const player = new Player(spawn.x, spawn.y);
  const run = () => {
    const npcs = new Npcs(world);
    for (let i = 0; i < 600; i++) npcs.update(1 / 60, player);
    return npcs.all.map((npc) => [npc.name, npc.x, npc.y].join());
  };
  assert.deepEqual(run(), run());
});
