import { Tiles } from './world.js';

// Tiles drawn as a shape on top of another tile's ground colour.
const Ground = new Map([
  [Tiles.TREE, Tiles.GRASS],
  [Tiles.PINE, Tiles.SNOW],
]);

const TRUNK = '#6b4a2b';

// The colour to fill a tile's square with before any art goes on top.
export function baseColor(tile) {
  return (Ground.get(tile) || tile).color;
}

export function hasArt(tile) {
  return Ground.has(tile);
}

// Draws the shape for a tile whose top-left corner is at (x, y), in world
// pixels. Everything stays inside the tile, so what blocks the player matches
// what is drawn. Returns false, drawing nothing, for tiles without art.
export function drawTileArt(ctx, tile, x, y) {
  if (tile === Tiles.TREE) {
    ctx.fillStyle = TRUNK;
    ctx.fillRect(x + 13, y + 20, 6, 11);
    ctx.fillStyle = tile.color;
    ctx.beginPath();
    ctx.arc(x + 16, y + 13, 12, 0, Math.PI * 2);
    ctx.fill();
    // A lighter patch towards the top-left, as if lit from there.
    ctx.fillStyle = '#3a7d36';
    ctx.beginPath();
    ctx.arc(x + 12, y + 9, 5, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (tile === Tiles.PINE) {
    ctx.fillStyle = TRUNK;
    ctx.fillRect(x + 14, y + 25, 4, 6);
    ctx.fillStyle = tile.color;
    triangle(ctx, x + 16, y + 10, x + 4, y + 27, x + 28, y + 27);
    triangle(ctx, x + 16, y + 1, x + 7, y + 17, x + 25, y + 17);
    // Snow on the tip.
    ctx.fillStyle = Tiles.SNOW.color;
    triangle(ctx, x + 16, y + 1, x + 12.5, y + 7, x + 19.5, y + 7);
    return true;
  }
  return false;
}

function triangle(ctx, ax, ay, bx, by, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}
