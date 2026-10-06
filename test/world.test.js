import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Tiles, TileById, TILE, CHUNK } from '../src/world.js';
import { Player, RADIUS } from '../src/player.js';

test('tile ids are unique and round-trip', () => {
  for (const tile of Object.values(Tiles)) assert.equal(TileById[tile.id], tile);
  assert.equal(new Set(Object.values(Tiles).map((t) => t.id)).size, Object.keys(Tiles).length);
});

test('chunked tiles match direct generation, including negative coords', () => {
  const world = new World(1337);
  for (let ty = -40; ty < 40; ty += 3) {
    for (let tx = -40; tx < 40; tx += 3) {
      assert.equal(world.tileAt(tx, ty), world.generate(tx, ty));
    }
  }
});

test('chunk cache stays bounded and regenerates identically', () => {
  const world = new World(7, 4);
  const first = world.tileAt(5, 5);
  for (let i = 1; i <= 10; i++) world.tileAt(i * CHUNK, 0);
  assert.ok(world.chunks.size <= 4);
  assert.equal(world.chunks.has('0,0'), false);
  assert.equal(world.tileAt(5, 5), first);
});

test('spawn is walkable and not boxed in across seeds', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const world = new World(seed);
    const { x, y } = world.findSpawn();
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    assert.equal(world.tileAt(tx, ty).solid, false, `seed ${seed}`);
    assert.ok(world.hasRoom(tx, ty, 64), `seed ${seed}`);
  }
});

test('player stops flush against a wall', () => {
  // Wall everywhere at tile x >= 1; open elsewhere.
  const world = { isSolid: (px) => Math.floor(px / TILE) >= 1 };
  const player = new Player(TILE / 2, TILE / 2);
  const input = new Set(['KeyD']);
  for (let i = 0; i < 20; i++) player.update(0.1, input, world);
  assert.ok(Math.abs(player.x + RADIUS - TILE) < 0.01, `x=${player.x}`);
  input.clear();
  input.add('KeyA');
  player.update(0.05, input, world);
  assert.ok(player.x < TILE - RADIUS - 1);
});
