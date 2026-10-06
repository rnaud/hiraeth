// The engines' keys and pads in the page's terms (docs/systems/engine-bridge.md): keys by
// KeyboardEvent.code ('KeyW', 'Space', 'ShiftLeft'), pads as W3C standard-mapping Gamepads, so
// the game's own input code (main.js's key table, controller.js) reads them unchanged.

/** Godot 4 Key values (core/os/keyboard.h) → KeyboardEvent.code. Letters and digits are their ASCII codes. */
const GODOT_SPECIAL = {
  32: 'Space', 4194305: 'Escape', 4194306: 'Tab', 4194308: 'Backspace', 4194309: 'Enter', 4194310: 'NumpadEnter',
  4194319: 'ArrowLeft', 4194320: 'ArrowUp', 4194321: 'ArrowRight', 4194322: 'ArrowDown',
  4194325: 'Shift', 4194326: 'Control', 4194328: 'Alt', 4194329: 'Meta', 4194332: 'F1', 4194333: 'F2', 4194334: 'F3', 4194335: 'F4',
  4194336: 'F5', 4194337: 'F6', 4194338: 'F7', 4194339: 'F8', 4194340: 'F9', 4194341: 'F10', 4194342: 'F11', 4194343: 'F12',
  44: 'Comma', 46: 'Period', 47: 'Slash', 59: 'Semicolon', 39: 'Quote', 91: 'BracketLeft', 93: 'BracketRight', 92: 'Backslash', 45: 'Minus', 61: 'Equal', 96: 'Backquote',
};

/**
 * A Godot key (physical_keycode) as a KeyboardEvent.code; `location` 2 is the right-hand key
 * (Godot's KeyLocation), for Shift, Control, Alt and Meta. null for keys the game never reads.
 */
export function godotKeyCode(key, location = 1) {
  if (key >= 65 && key <= 90) return `Key${String.fromCharCode(key)}`;
  if (key >= 97 && key <= 122) return `Key${String.fromCharCode(key - 32)}`;
  if (key >= 48 && key <= 57) return `Digit${key - 48}`;
  const s = GODOT_SPECIAL[key];
  if (!s) return null;
  if (s === 'Shift' || s === 'Control' || s === 'Alt' || s === 'Meta') return s + (location === 2 ? 'Right' : 'Left');
  return s;
}

/**
 * Godot's JoyButton (SDL order) for each of the standard mapping's buttons 0..16 (A, B, X, Y, LB,
 * RB, LT, RT, View, Menu, LS, RS, up, down, left, right, Guide); null where it is an axis (the
 * triggers: JoyAxis 4 and 5).
 */
export const STANDARD_FROM_GODOT = [0, 1, 2, 3, 9, 10, null, null, 4, 6, 7, 8, 11, 12, 13, 14, 5];

/**
 * A Gamepad-shaped object from an engine's reads: button(i) (SDL / Godot JoyButton i pressed),
 * axis(i) (JoyAxis i, -1..1; the triggers 0..1). index: the pad's slot.
 */
export function standardPad(index, button, axis, id = 'engine pad') {
  const lt = Math.max(0, axis(4)), rt = Math.max(0, axis(5));
  const buttons = STANDARD_FROM_GODOT.map((g, i) => {
    if (i === 6) return { pressed: lt > 0.5, touched: lt > 0, value: lt };
    if (i === 7) return { pressed: rt > 0.5, touched: rt > 0, value: rt };
    const p = !!button(g);
    return { pressed: p, touched: p, value: p ? 1 : 0 };
  });
  return { id, index, connected: true, mapping: 'standard', timestamp: 0, buttons, axes: [axis(0), axis(1), axis(2), axis(3)], vibrationActuator: null };
}
