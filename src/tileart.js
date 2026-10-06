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

// The colour to fill the square at (tx, ty) with. A stump sits on whatever its
// tree stood on, which the generator still knows.
export function groundColor(world, tx, ty) {
  const tile = world.tileAt(tx, ty);
  if (tile !== Tiles.STUMP) return baseColor(tile);
  const grew = world.generate(tx, ty);
  return grew === Tiles.STUMP ? Tiles.GRASS.color : baseColor(grew);
}

const RIPPLES = 0.2; // share of water tiles that carry ripple marks

// Deterministic [0, 1) per tile, so the same water tiles ripple every frame.
function pick(tx, ty) {
  let h = (Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663)) | 0;
  h = Math.imul(h ^ (h >>> 15), 1540483477);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// Whether the tile at (tx, ty) gets a shape drawn on top of its fill.
export function hasArt(tile, tx, ty) {
  if (tile === Tiles.WATER) return pick(tx, ty) < RIPPLES;
  return tile === Tiles.STUMP || Ground.has(tile);
}

// Draws the shape for a tile whose top-left corner is at (x, y), in world
// pixels. Everything stays inside the tile, so what blocks the player matches
// what is drawn. Returns false, drawing nothing, for tiles that never have art;
// hasArt decides which water tiles to call this for.
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
  if (tile === Tiles.STUMP) {
    ctx.fillStyle = tile.color;
    ctx.beginPath();
    ctx.arc(x + 16, y + 18, 8, 0, Math.PI * 2);
    ctx.fill();
    // The cut top, lighter than the bark around it.
    ctx.fillStyle = '#c9a26b';
    ctx.beginPath();
    ctx.arc(x + 16, y + 17, 5.5, 0, Math.PI * 2);
    ctx.fill();
    return true;
  }
  if (tile === Tiles.WATER) {
    ctx.fillStyle = '#6f9bd6';
    ctx.fillRect(x + 6, y + 11, 11, 2);
    ctx.fillRect(x + 15, y + 20, 9, 2);
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
