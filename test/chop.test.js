import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Tiles, TileById, TILE, CHUNK } from '../src/world.js';
import { Player } from '../src/player.js';
import { Npcs } from '../src/npc.js';
import { Items } from '../src/items.js';
import { Inventory } from '../src/inventory.js';
import { chop } from '../src/chop.js';
import { serialize, apply } from '../src/save.js';

const AXE = { id: 99, name: 'Stone Axe' };

// A tree with a walkable tile directly to its left, searching outwards from the origin.
function findTree(world) {
  for (let r = 0; r < 100; r++) {
    for (let ty = -r; ty <= r; ty++) {
      for (let tx = -r; tx <= r; tx++) {
        if (world.tileAt(tx, ty) === Tiles.TREE && !world.tileAt(tx - 1, ty).solid) return { tx, ty };
      }
    }
  }
  throw new Error('no tree found');
}

// Standing against the tree's left edge, so no other tree can be nearer.
const beside = (tree) => ({ x: tree.tx * TILE - 11, y: (tree.ty + 0.5) * TILE });

test('setTile changes a tile and survives chunk eviction', () => {
  const world = new World(7, 4);
  const tree = findTree(world);
  world.setTile(tree.tx, tree.ty, Tiles.STUMP);
  assert.equal(world.tileAt(tree.tx, tree.ty), Tiles.STUMP);
  for (let i = 1; i <= 10; i++) world.tileAt(tree.tx + i * CHUNK, tree.ty);
  assert.ok(world.chunks.size <= 4);
  assert.equal(world.tileAt(tree.tx, tree.ty), Tiles.STUMP);
  // Neighbours are untouched.
  assert.equal(world.tileAt(tree.tx - 1, tree.ty), world.generate(tree.tx - 1, tree.ty));
});

test('setTile works on a chunk that has never been loaded, at negative coordinates', () => {
  const world = new World(7);
  world.setTile(-70, -3, Tiles.STUMP);
  assert.equal(world.tileAt(-70, -3), Tiles.STUMP);
  assert.deepEqual(world.changedTiles(), [[-70, -3, Tiles.STUMP.id]]);
});

test('changed tiles round-trip and unknown ids are skipped', () => {
  const a = new World(7);
  a.setTile(5, 6, Tiles.STUMP);
  a.setTile(-40, 90, Tiles.GRASS);
  const b = new World(7);
  b.tileAt(5, 6); // loaded before the restore
  b.restoreTiles([...a.changedTiles(), [1, 1, 200]]);
  assert.equal(b.tileAt(5, 6), Tiles.STUMP);
  assert.equal(b.tileAt(-40, 90), Tiles.GRASS);
  assert.equal(b.tileAt(1, 1), b.generate(1, 1));
  assert.equal(b.changedTiles().length, 2);
  assert.equal(TileById[Tiles.STUMP.id], Tiles.STUMP);
});

test('chopping needs an axe and a tree within reach', () => {
  const world = new World(1337);
  const tree = findTree(world);
  const inventory = new Inventory();
  const player = beside(tree);

  assert.equal(chop(world, player, inventory, AXE), null);
  assert.equal(chop(world, player, inventory, undefined), null);
  assert.equal(world.tileAt(tree.tx, tree.ty), Tiles.TREE);

  inventory.add(AXE.id);
  assert.deepEqual(chop(world, player, inventory, AXE), tree);
  assert.equal(world.tileAt(tree.tx, tree.ty), Tiles.STUMP);
  assert.equal(world.isSolid((tree.tx + 0.5) * TILE, (tree.ty + 0.5) * TILE), false);
  assert.equal(inventory.count(AXE.id), 1);
});

test('chopping picks the nearest tree and ignores ones out of reach', () => {
  const flat = new World(1);
  flat.generate = () => Tiles.GRASS;
  flat.setTile(2, 0, Tiles.TREE);
  flat.setTile(0, 1, Tiles.TREE);
  const inventory = new Inventory();
  inventory.add(AXE.id);
  const player = { x: 0.5 * TILE, y: 0.5 * TILE };
  // (2, 0) is two tiles away, beyond reach; (0, 1) is adjacent.
  assert.deepEqual(chop(flat, player, inventory, AXE), { tx: 0, ty: 1 });
  assert.equal(chop(flat, player, inventory, AXE), null);
  assert.equal(flat.tileAt(2, 0), Tiles.TREE);
});

test('chopping every tree in a region does not change which NPCs spawn there', () => {
  const snapshot = (world) => {
    const npcs = new Npcs(world);
    npcs.update(1 / 60, { x: 0, y: 0 });
    return npcs.all.map((npc) => [npc.key, npc.name, npc.x, npc.y].join());
  };
  const before = snapshot(new World(1337));
  const cleared = new World(1337);
  for (let ty = -48; ty < 48; ty++) {
    for (let tx = -48; tx < 48; tx++) {
      if (cleared.tileAt(tx, ty) === Tiles.TREE) cleared.setTile(tx, ty, Tiles.STUMP);
    }
  }
  assert.ok(before.length > 0);
  assert.deepEqual(snapshot(cleared), before);
});

test('a chopped tree is saved, and the player can be restored standing on the stump', () => {
  const state = (world) => ({
    world,
    player: new Player(0, 0),
    inventory: new Inventory(),
    items: new Items(world),
    npcs: new Npcs(world),
  });
  const a = state(new World(1337));
  const tree = findTree(a.world);
  a.world.setTile(tree.tx, tree.ty, Tiles.STUMP);
  a.player.x = (tree.tx + 0.5) * TILE;
  a.player.y = (tree.ty + 0.5) * TILE;
  const data = JSON.parse(JSON.stringify(serialize(a)));

  const b = state(new World(1337));
  assert.equal(apply(data, b), true);
  assert.equal(b.world.tileAt(tree.tx, tree.ty), Tiles.STUMP);
  assert.deepEqual([b.player.x, b.player.y], [a.player.x, a.player.y]);

  // A save from before tiles could change still loads, with no changes.
  delete data.tiles;
  const c = state(new World(1337));
  assert.equal(apply(data, c), true);
  assert.equal(c.world.tileAt(tree.tx, tree.ty), Tiles.TREE);
});
