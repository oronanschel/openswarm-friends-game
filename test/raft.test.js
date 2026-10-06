import test from 'node:test';
import assert from 'node:assert/strict';
import { World, Tiles, TILE } from '../src/world.js';
import { Player, RADIUS } from '../src/player.js';
import { Inventory } from '../src/inventory.js';
import { ItemTypes } from '../src/items.js';
import { Recipes, craft, alreadyHave } from '../src/crafting.js';
import { serialize, apply } from '../src/save.js';
import { Npcs } from '../src/npc.js';
import { Items } from '../src/items.js';

// A world where x < 2 tiles is land, 2 <= x < 4 water, and x >= 4 is a tree.
const world = {
  tileAt: (tx) => (tx < 2 ? Tiles.GRASS : tx < 4 ? Tiles.WATER : Tiles.TREE),
  isSolid(px) {
    return this.tileAt(Math.floor(px / TILE)).solid;
  },
};
const right = new Set(['ArrowRight']);

function walk(player, seconds) {
  for (let i = 0; i < seconds * 60; i++) player.update(1 / 60, right, world);
}

test('four crafts a raft from six wood', () => {
  const recipe = Recipes.find((r) => r.key === 'Digit4');
  const inventory = new Inventory();
  inventory.add(ItemTypes.WOOD.id, 5);
  assert.equal(craft(inventory, recipe), false);
  inventory.add(ItemTypes.WOOD.id);
  assert.equal(craft(inventory, recipe), true);
  assert.equal(inventory.count(ItemTypes.WOOD.id), 0);
  assert.equal(inventory.count(ItemTypes.RAFT.id), 1);
});

test('a second raft is refused and the wood is kept', () => {
  const recipe = Recipes.find((r) => r.key === 'Digit4');
  const inventory = new Inventory();
  inventory.add(ItemTypes.WOOD.id, 12);
  assert.equal(alreadyHave(inventory, recipe), false);
  assert.equal(craft(inventory, recipe), true);
  assert.equal(alreadyHave(inventory, recipe), true);
  assert.equal(craft(inventory, recipe), false);
  assert.equal(inventory.count(ItemTypes.WOOD.id), 6);
  assert.equal(inventory.count(ItemTypes.RAFT.id), 1);
  // Ordinary recipes are not unique.
  const jam = Recipes.find((r) => r.key === 'Digit3');
  inventory.add(ItemTypes.BERRY.id, 6);
  assert.equal(craft(inventory, jam), true);
  assert.equal(craft(inventory, jam), true);
});

// Records the rectangles drawn; every other canvas method is a no-op.
function rectsDrawn(player) {
  const rects = [];
  const ctx = new Proxy(
    { fillRect: (...args) => rects.push(args), strokeRect: () => {} },
    { get: (target, name) => (name in target ? target[name] : () => {}), set: () => true }
  );
  player.draw(ctx);
  return rects;
}

test('a raft is drawn under the player only while on water with one', () => {
  const player = new Player(TILE * 2.5, TILE / 2); // on the water tile
  const inventory = new Inventory();
  player.update(0, new Set(), world);
  assert.equal(player.sailing, false);
  const bare = rectsDrawn(player).length;

  inventory.add(ItemTypes.RAFT.id);
  player.sync(inventory);
  player.update(0, new Set(), world);
  assert.equal(player.sailing, true);
  assert.equal(rectsDrawn(player).length, bare + 1);

  // Back on land with the raft in the bag: nothing under the player.
  player.x = TILE / 2;
  player.update(0, new Set(), world);
  assert.equal(player.sailing, false);
  assert.equal(rectsDrawn(player).length, bare);
});

test('without a raft, water blocks the player', () => {
  const player = new Player(TILE, TILE / 2);
  walk(player, 2);
  assert.ok(player.x + RADIUS < TILE * 2);
});

test('with a raft, the player crosses water but trees still block', () => {
  const player = new Player(TILE, TILE / 2);
  const inventory = new Inventory();
  inventory.add(ItemTypes.RAFT.id);
  player.sync(inventory);
  assert.equal(player.raft, true);
  walk(player, 2);
  assert.ok(player.x > TILE * 2 + RADIUS, 'got onto the water');
  assert.ok(player.x + RADIUS < TILE * 4, 'stopped at the tree');
  // The raft is not used up.
  assert.equal(inventory.count(ItemTypes.RAFT.id), 1);
});

test('a player saved on the water is restored there when carrying a raft', () => {
  const real = new World(1337);
  let water = null;
  for (let r = 0; r < 200 && !water; r++) {
    for (let ty = -r; ty <= r && !water; ty++) {
      for (let tx = -r; tx <= r; tx++) {
        const ok = [-1, 0, 1].every((dx) => [-1, 0, 1].every((dy) => real.tileAt(tx + dx, ty + dy) === Tiles.WATER));
        if (ok) {
          water = { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
          break;
        }
      }
    }
  }
  assert.ok(water, 'found open water');
  const make = () => ({
    world: real,
    player: new Player(real.findSpawn().x, real.findSpawn().y),
    inventory: new Inventory(),
    items: new Items(real),
    npcs: new Npcs(real),
  });
  const a = make();
  a.inventory.add(ItemTypes.RAFT.id);
  a.player.x = water.x;
  a.player.y = water.y;
  const data = JSON.parse(JSON.stringify(serialize(a)));

  const b = make();
  assert.equal(apply(data, b), true);
  assert.deepEqual([b.player.x, b.player.y], [water.x, water.y]);

  // Without the raft in the save, the spot is rejected and the spawn kept.
  const c = make();
  data.inventory = [];
  const spawn = [c.player.x, c.player.y];
  assert.equal(apply(data, c), true);
  assert.deepEqual([c.player.x, c.player.y], spawn);
});
