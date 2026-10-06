const SPEED = 160; // pixels per second
const RADIUS = 10;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  update(dt, input, world) {
    let dx = 0;
    let dy = 0;
    if (input.has('ArrowLeft') || input.has('KeyA')) dx -= 1;
    if (input.has('ArrowRight') || input.has('KeyD')) dx += 1;
    if (input.has('ArrowUp') || input.has('KeyW')) dy -= 1;
    if (input.has('ArrowDown') || input.has('KeyS')) dy += 1;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    // Move each axis separately so the player slides along walls.
    const nx = this.x + dx * SPEED * dt;
    if (!this.collides(nx, this.y, world)) this.x = nx;
    const ny = this.y + dy * SPEED * dt;
    if (!this.collides(this.x, ny, world)) this.y = ny;
  }

  collides(x, y, world) {
    return (
      world.isSolid(x - RADIUS, y - RADIUS) ||
      world.isSolid(x + RADIUS, y - RADIUS) ||
      world.isSolid(x - RADIUS, y + RADIUS) ||
      world.isSolid(x + RADIUS, y + RADIUS)
    );
  }

  draw(ctx) {
    ctx.fillStyle = '#f2e14c';
    ctx.beginPath();
    ctx.arc(this.x, this.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2f00';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
