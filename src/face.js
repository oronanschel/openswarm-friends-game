const EYE_GAP = 3.5; // from the centre of the face to each eye
const LOOK = 3; // how far the eyes shift towards where the character faces
const EYE_W = 2;
const EYE_H = 4;

// Where the two eyes sit for a character at (x, y) facing (fx, fy), as their
// centres. (fx, fy) need not be a unit vector; (0, 0) looks straight out.
export function eyes(x, y, fx, fy) {
  const length = Math.hypot(fx, fy);
  const cx = x + (length ? (fx / length) * LOOK : 0);
  const cy = y - 1 + (length ? (fy / length) * LOOK : 0);
  return [
    { x: cx - EYE_GAP, y: cy },
    { x: cx + EYE_GAP, y: cy },
  ];
}

// Two small eyes on a character's body, shifted towards where it faces. They
// stay within 10px of (x, y), the body radius of the player and villagers.
export function drawFace(ctx, x, y, fx, fy) {
  ctx.fillStyle = '#1b1b1b';
  for (const eye of eyes(x, y, fx, fy)) ctx.fillRect(eye.x - EYE_W / 2, eye.y - EYE_H / 2, EYE_W, EYE_H);
}
