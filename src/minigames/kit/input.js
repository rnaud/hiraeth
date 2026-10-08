// A minigame's controls, the same from the keyboard, a pad and the touch buttons: the game's merged
// input (main.js: the keys by their codes, the pad's held buttons from src/controller.js, the touch
// stick) read into a few plain values. Pure (tests/minigames.test.js).
//
//   x, y        the left stick or WASD / the arrows, -1..1 (y > 0: forward / up)
//   jump        A / × or Space, held;  jumpPressed / jumpReleased: this frame
//   action      B / ○ or E, held;      actionPressed
//   tuck        RT / R2 (analog, 0..1) or Shift
//   brake       LT / L2 or the stick pulled back hard (0..1)

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

export const NO_INPUT = Object.freeze({ x: 0, y: 0, jump: false, jumpPressed: false, jumpReleased: false, action: false, actionPressed: false, tuck: 0, brake: 0 });

/** The input of this frame, from the merged controls and the last frame's reading (for the presses). */
export function readInput(c = {}, prev = NO_INPUT) {
  let x = (c.KeyD || c.ArrowRight ? 1 : 0) - (c.KeyA || c.ArrowLeft ? 1 : 0);
  let y = (c.KeyW || c.ArrowUp ? 1 : 0) - (c.KeyS || c.ArrowDown ? 1 : 0);
  if (c.stick && (c.stick.x || c.stick.y)) { x = c.stick.x; y = c.stick.y; }   // (analog wins: a half push is half)
  x = clamp1(x); y = clamp1(y);
  const jump = !!(c.Space || c.PadJump);
  const action = !!(c.KeyE || c.PadE);
  const tuck = Math.max(c.ShiftLeft || c.ShiftRight ? 1 : 0, +c.PadThrust || 0, c.PadFire ? 1 : 0);
  const brake = Math.max(c.PadAim ? 1 : 0, y < -0.6 ? (-y - 0.6) / 0.4 : 0);
  return {
    x, y, jump, action, tuck: Math.min(1, tuck), brake: Math.min(1, brake),
    jumpPressed: jump && !prev.jump, jumpReleased: !jump && prev.jump, actionPressed: action && !prev.action,
  };
}
