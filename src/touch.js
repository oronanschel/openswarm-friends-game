import { hotbarLayout } from './inventory.js';

const DEADZONE = 12; // CSS pixels the finger must travel before the player moves
const STICK_RADIUS = 48; // drawn size of the joystick ring
const BUTTON = 44;
const GAP = 8;
const MARGIN = 12;

// Bottom button first. `code` is the KeyboardEvent.code the button stands in for.
export const Buttons = [
  { label: 'Chop', code: 'Space' },
  { label: 'E', code: 'KeyE' },
  { label: 'Eat', code: 'KeyF' },
  { label: '3', code: 'Digit3' },
  { label: '2', code: 'Digit2' },
  { label: '1', code: 'Digit1' },
  { label: 'Mute', code: 'KeyM' },
];

const MINIMAP_BOTTOM = 174;
const ROWS = [Buttons.length, 4, 3, 2];

// Buttons stacked up the right edge, in CSS pixels, in the tallest columns that
// stay below the minimap: one column of seven from 542px of height, columns of
// four from 386px, then three (a phone on its side), then two. Where the
// columns would reach the hotbar (a narrow window) the block sits above it.
export function buttonRects(viewWidth, viewHeight) {
  const hotbar = hotbarLayout(viewWidth);
  let rows;
  let lift;
  for (rows of ROWS) {
    const columns = Math.ceil(Buttons.length / rows);
    const left = viewWidth - MARGIN - BUTTON - (columns - 1) * (BUTTON + GAP);
    lift = left < hotbar.right + GAP ? hotbar.top + GAP - MARGIN : 0;
    const top = viewHeight - MARGIN - lift - rows * (BUTTON + GAP) + GAP;
    if (top >= MINIMAP_BOTTOM) break;
  }
  return Buttons.map((button, i) => ({
    ...button,
    x: viewWidth - MARGIN - BUTTON - Math.floor(i / rows) * (BUTTON + GAP),
    y: viewHeight - MARGIN - lift - BUTTON - (i % rows) * (BUTTON + GAP),
    w: BUTTON,
    h: BUTTON,
  }));
}

export function buttonAt(x, y, viewWidth, viewHeight) {
  return buttonRects(viewWidth, viewHeight).find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || null;
}

// Arrow-key codes for a drag of (dx, dy) from where the finger went down:
// eight directions, none inside the dead zone.
export function stickKeys(dx, dy) {
  const length = Math.hypot(dx, dy);
  if (length < DEADZONE) return [];
  const keys = [];
  // An axis counts once the drag is within 67.5 degrees of it.
  const threshold = length * Math.cos((67.5 * Math.PI) / 180);
  if (dx <= -threshold) keys.push('ArrowLeft');
  if (dx >= threshold) keys.push('ArrowRight');
  if (dy <= -threshold) keys.push('ArrowUp');
  if (dy >= threshold) keys.push('ArrowDown');
  return keys;
}

// On-screen controls for touch screens. Dragging anywhere moves the player by
// holding arrow-key codes in `input`; tapping a button calls `press(code)`.
// `view()` returns the current { width, height } in CSS pixels.
export class TouchControls {
  constructor(target, input, press, view) {
    this.input = input;
    this.press = press;
    this.view = view;
    this.active = false; // stays hidden until the first touch
    this.stick = null; // { id, ox, oy, x, y } while a finger is steering
    this.held = []; // codes this object has put into `input`
    target.addEventListener('pointerdown', (e) => this.down(e));
    target.addEventListener('pointermove', (e) => this.move(e));
    target.addEventListener('pointerup', (e) => this.up(e));
    target.addEventListener('pointercancel', (e) => this.up(e));
  }

  down(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.active = true;
    const { width, height } = this.view();
    const button = buttonAt(e.clientX, e.clientY, width, height);
    if (button) this.press(button.code);
    else if (!this.stick) this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  }

  move(e) {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    e.preventDefault();
    this.stick.x = e.clientX;
    this.stick.y = e.clientY;
    this.hold(stickKeys(this.stick.x - this.stick.ox, this.stick.y - this.stick.oy));
  }

  up(e) {
    if (!this.stick || e.pointerId !== this.stick.id) return;
    this.stick = null;
    this.hold([]);
  }

  // Swap the codes held in `input` for a new list.
  hold(keys) {
    for (const key of this.held) this.input.delete(key);
    for (const key of keys) this.input.add(key);
    this.held = keys;
  }

  // In CSS pixels; all context state is restored afterwards.
  draw(ctx, viewWidth, viewHeight, dpr) {
    if (!this.active) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (const r of buttonRects(viewWidth, viewHeight)) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#ddd';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2);
    }
    if (this.stick) {
      const { ox, oy, x, y } = this.stick;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox, oy, STICK_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      // The knob follows the finger but stays inside the ring.
      const length = Math.hypot(x - ox, y - oy);
      const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(ox + (x - ox) * scale, oy + (y - oy) * scale, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
