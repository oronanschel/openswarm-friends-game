import { TILE, Tiles } from './world.js';
import { ItemTypes } from './items.js';

const REACH = TILE * 1.5; // from the player to the centre of the tree's tile

// The nearest tree within the player's reach as { tx, ty }, or null.
export function treeInReach(world, player) {
  const ptx = Math.floor(player.x / TILE);
  const pty = Math.floor(player.y / TILE);
  let best = null;
  let bestDistance = REACH;
  for (let ty = pty - 2; ty <= pty + 2; ty++) {
    for (let tx = ptx - 2; tx <= ptx + 2; tx++) {
      const tile = world.tileAt(tx, ty);
      if (tile !== Tiles.TREE && tile !== Tiles.PINE) continue;
      const distance = Math.hypot((tx + 0.5) * TILE - player.x, (ty + 0.5) * TILE - player.y);
      if (distance <= bestDistance) {
        best = { tx, ty };
        bestDistance = distance;
      }
    }
  }
  return best;
}

// Turns the nearest tree within reach into a stump, if the player carries
// `axe` (an item type), and gives the player one Wood. The axe is not used up.
// Returns the tile changed as
// { tx, ty }, or null if nothing was chopped.
export function chop(world, player, inventory, axe) {
  if (!axe || !inventory.count(axe.id)) return null;
  const best = treeInReach(world, player);
  if (best) {
    world.setTile(best.tx, best.ty, Tiles.STUMP);
    inventory.add(ItemTypes.WOOD.id);
  }
  return best;
}
