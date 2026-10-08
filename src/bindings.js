// The controller's layout, one table (docs/systems/controls.md, "The layout"): what each button does in
// each context. src/controller.js reads the pad by these rules, the Controls page (src/ui.js) and the
// prompts name the buttons by PAD, and tests/bindings.test.js drives a virtual pad through every row and
// checks that no button does two things in one context.
//
// Buttons by position, in Xbox / PlayStation form (native-pad.js prints them as the pad does: a Retroid's
// bottom button reads "B"). A chord is written 'View + D-pad ↓' (View held, then the other).
//
// These are the defaults. A player can move the verbs to other buttons and keys (the Controls page, saved with
// the settings: src/remap.js); the controller reads through that, and the prompts are renamed as they show
// (native-pad.js). The tables here never change.

/** The pad's buttons by position, in the Standard Gamepad's order (index = the button's index there). */
export const PAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→'];
/** Each button as a prompt names it (Xbox / PlayStation form). */
export const BUTTON_NAME = {
  A: 'A / ×', B: 'B / ○', X: 'X / □', Y: 'Y / △', LB: 'LB / L1', RB: 'RB / R1', LT: 'LT / L2', RT: 'RT / R2',
  View: 'View', Menu: 'Menu', L3: 'L3', R3: 'R3', '↑': 'D-pad ↑', '↓': 'D-pad ↓', '←': 'D-pad ←', '→': 'D-pad →',
};
/**
 * The verbs a player can move to another button, and their buttons by default (the foot rows of BINDINGS below;
 * riding, the same buttons follow them). View and Menu stay where they are, and so do the menus' and the
 * conversations' buttons: the way back is never lost.
 */
export const PAD_VERBS = {
  jump: 'A', evade: 'B', interact: 'X', gadget: 'Y', blade: 'RB', guard: 'LB', aim: 'LT', fire: 'RT',
  run: 'L3', lock: 'R3', pick: '↑', call: '↓', modePrev: '←', modeNext: '→',
};

/** The button names the prompts use for each verb (Xbox / PlayStation form), from PAD_VERBS. */
export const PAD = {
  ...Object.fromEntries(Object.entries(PAD_VERBS).filter(([v]) => !v.startsWith('mode')).map(([v, b]) => [v, BUTTON_NAME[b]])),
  mode: 'D-pad ← / →', journal: 'View', menu: 'Menu', photo: 'View + D-pad ↑',
};

/**
 * The keyboard's verbs and their keys by default (KeyboardEvent.code: by position, so an AZERTY keyboard's Z is
 * KeyW). A player can move each to another key; the mouse buttons stay as they are.
 */
export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', jump: 'Space', interact: 'KeyE',
  blade: 'KeyF', guard: 'ControlLeft', evade: 'AltLeft', lock: 'Tab', aim: 'KeyR', fire: 'KeyG', mode: 'KeyX',
  scout: 'KeyQ', gadget: 'KeyT', gadgetNext: 'KeyB', whistle: 'KeyV', journal: 'KeyJ', menu: 'KeyO', controls: 'KeyH',
  photo: 'KeyP', mute: 'KeyM',
};

/**
 * Per context, [button, what it does]. Buttons: the face buttons by their Xbox letter (by position), the
 * shoulders, L3 / R3, the D-pad's ↑ ↓ ← →, View, Menu, the sticks; chords with ' + '. Context-held variants
 * (the same button doing something else under a condition) are written into the one entry.
 */
export const BINDINGS = {
  foot: [
    ['A', 'jump · again in the air: boost · held: the wings'],
    ['B', 'evade (the stick\'s way, or a backstep)'],
    ['X', 'interact: use, talk, pick up, get on'],
    ['Y', 'the gadget in hand (hold to aim, let go) · none in hand: the bell-note whistle'],
    ['RB', 'the fluid blade (again: the next swing)'],
    ['LB', 'guard (held; at the blow: parry) · no foe near: with the right stick, zoom'],
    ['LT', 'aim the fluid tool'],
    ['RT', 'shoot while aiming · else the jets\' throttle'],
    ['L3', 'run, until the stick is let go'],
    ['R3', 'lock on, the next, let go · no foe in reach: the scout finds the objective'],
    ['↑', 'gadget: tap the next · hold the wheel'],
    ['↓', 'call the mount · hail a taxi'],
    ['←', 'the gun mode before'],
    ['→', 'the next gun mode'],
    ['View', 'the sketchbook (items, quests, worlds)'],
    ['Menu', 'the Start menu (settings, controls)'],
    ['View + ↑', 'photo mode'],
    ['View + ↓', 'free'],
    ['View + ←', 'free · the Arena: the input display (F6)'],
    ['View + →', 'free'],
    ['L3 + R3', 'debug: the hitbox overlay (F4)'],
  ],
  ride: [
    ['A', 'jump off (moving: its speed carries you)'],
    ['B', 'get off (moving or high: jump off)'],
    ['X', 'the vehicle\'s hop / flap / rise'],
    ['RT', 'throttle'],
    ['LT', 'brake, reverse'],
    ['RB', 'boost'],
    ['L3', 'boost'],
    ['R3', 'the scout finds the objective'],
    ['View', 'the sketchbook'],
    ['Menu', 'the Start menu'],
    ['View + ↑', 'photo mode'],
  ],
  cab: [
    ['A', 'choose the stop (on the way: jump off)'],
    ['B', 'get out at the stop'],
    ['X', 'where to (again)'],
  ],
  menu: [
    ['A', 'confirm (the button printed A: on the right on a Retroid)'],
    ['B', 'back, close (printed B)'],
    ['LB', 'the panel before'],
    ['RB', 'the panel after'],
    ['View', 'close the sketchbook'],
    ['Menu', 'close the Start menu'],
  ],
  talk: [
    ['A', 'carry on, choose'],
    ['X', 'carry on (the button you talked with)'],
    ['B', 'leave the conversation'],
    ['Menu', 'the Start menu'],
  ],
  photo: [
    ['A', 'save the picture'],
    ['B', 'leave'],
    ['View', 'leave'],
    ['Menu', 'leave'],
    ['LB', 'down'],
    ['RB', 'up'],
    ['RT', 'faster'],
  ],
};

/** The chords nothing uses yet: the controller sends `padchord` events for them (main.js). */
export const FREE = ['View + ↓', 'View + ←', 'View + →'];

/** The layout's version, kept on the device so a player from before is told once what moved (main.js). */
export const PAD_SCHEME = 2;
export const PAD_SCHEME_KEY = 'moebius.padScheme';
export const PAD_SCHEME_NOTE = 'The controller layout changed: X / □ uses and talks, B / ○ evades, D-pad ↓ calls your mount, R3 finds your objective, and Y / △ with no gadget in hand sounds the whistle. Menu, then Controls, lists them all.';
