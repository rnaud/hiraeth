// The controller's layout, one table (docs/systems/controls.md, "The layout"): what each button does in
// each context. src/controller.js reads the pad by these rules, the Controls page (src/ui.js) and the
// prompts name the buttons by PAD, and tests/bindings.test.js drives a virtual pad through every row and
// checks that no button does two things in one context.
//
// Buttons by position, in Xbox / PlayStation form (native-pad.js prints them as the pad does: a Retroid's
// bottom button reads "B"). A chord is written 'View + D-pad ↑' (View held, then the other).
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
 * conversations' buttons: the way back is never lost. One job per button: no verb rides on another's button
 * (standing still, aiming), so a button always does what its row on the Controls page says.
 */
export const PAD_VERBS = {
  jump: 'A', evade: 'B', interact: 'X', whistle: 'Y', blade: 'RB', guard: 'LB', aim: 'LT', fire: 'RT',
  run: 'L3', lock: 'R3', pick: '↑', potion: '←', call: '↓', scout: '→',
};

/** The button names the prompts use for each verb (Xbox / PlayStation form), from PAD_VERBS. */
export const PAD = {
  ...Object.fromEntries(Object.entries(PAD_VERBS).map(([v, b]) => [v, BUTTON_NAME[b]])),
  mode: BUTTON_NAME[PAD_VERBS.pick], gadget: BUTTON_NAME[PAD_VERBS.fire], journal: 'View', menu: 'Menu', photo: 'View + D-pad ↑',
};

/**
 * The keyboard's verbs and their keys by default (KeyboardEvent.code: by position, so an AZERTY keyboard's Z is
 * KeyW). A player can move each to another key; the mouse buttons stay as they are.
 */
export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', jump: 'Space', interact: 'KeyE',
  blade: 'KeyF', guard: 'ControlLeft', evade: 'AltLeft', lock: 'Tab', aim: 'KeyR', fire: 'KeyG', mode: 'KeyX',
  scout: 'KeyQ', gadget: 'KeyT', gadgetNext: 'KeyB', whistle: 'KeyV', journal: 'KeyJ', menu: 'KeyO', controls: 'KeyH',
  photo: 'KeyP', mute: 'KeyM', potion: 'KeyC', spell: 'KeyY',
};
/** The spell's chord (src/spells/): the guard's and the blade's buttons pressed together, in Xbox / PlayStation form. */
export const SPELL_PAD = `${BUTTON_NAME[PAD_VERBS.guard]} + ${BUTTON_NAME[PAD_VERBS.blade]}`;

/**
 * Per context, [button, what it does]. Buttons: the face buttons by their Xbox letter (by position), the
 * shoulders, L3 / R3, the D-pad's ↑ ↓ ← →, View, Menu, the sticks; chords with ' + '. Context-held variants
 * (the same button doing something else under a condition) are written into the one entry.
 */
export const BINDINGS = {
  foot: [
    ['A', 'jump · again in the air: the double jump (the lift valve) · held in the air: the jets, or the wings (with L3: the wings) · locked on, with the stick back or to a side: the back flip, the side hop'],
    ['B', 'evade (the stick\'s way, or a backstep)'],
    ['X', 'interact: use, talk, pick up, get on'],
    ['Y', 'the bell-note whistle · the echo shell'],
    ['RB', 'the fluid sword (again: the next swing)'],
    ['LB', 'guard (held; at the blow: parry) · no foe near: with the right stick, zoom'],
    ['LT', 'aim the gadget in hand (the fluid gun, the hook, the bombs…) · locked on: on its centre, the right stick shifts the aim a little'],
    ['RT', 'use the gadget in hand: shoot, throw · while aiming: let fly'],
    ['L3', 'run, until the stick is let go'],
    ['R3', 'lock on, the next, let go (nothing else) · no foe in reach: the camera turns behind you'],
    ['↑', 'held: the wheel, the game waiting (every gadget, and each of the glove\'s modes; the right stick points, let go to take it) · a tap: the last pick back (push and fluid, a tap apart)'],
    ['↓', 'call the mount · hail a taxi (the Arena, the Arcade, the References: their list)'],
    ['←', 'drink a healing potion'],
    ['→', 'Plumb finds the objective · a guardian\'s fight, a makers\' house: a hint'],
    ['View', 'the game menu (items, quests, worlds)'],
    ['Menu', 'the Start menu (settings, controls)'],
    ['View + ↑', 'photo mode'],
    ['View + ↓', 'free'],
    ['View + ←', 'free · the Arena: the input display (F6)'],
    ['View + →', 'free'],
    ['LB + RB', 'the spell chosen (pressed together; won in four makers\' houses, chosen in the game menu\'s Items): then 30 s to recover'],
    ['L3 + R3', 'debug: the dev menu (F2, `): teleports, god mode, the FPS, cinematics, the quest\'s stage, items, the hitbox overlay'],
  ],
  ride: [
    ['A', 'jump off (moving: its speed carries you)'],
    ['B', 'get off (moving or high: jump off)'],
    ['X', 'the vehicle\'s hop / flap / rise'],
    ['RT', 'throttle'],
    ['LT', 'brake, reverse'],
    ['RB', 'boost'],
    ['L3', 'boost'],
    ['Y', 'the gadget in hand (the gust fan, into a skiff\'s sail)'],
    ['→', 'Plumb finds the objective'],
    ['View', 'the game menu'],
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
    ['View', 'close the game menu'],
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
export const PAD_SCHEME = 6;   // (6, v1.86: D-pad → is Plumb's, R3 only locks on, held D-pad ↑ the wheel with the glove's modes, the game waiting, a tap the last pick back; 5, v1.38: the triggers work the gadget in hand, Y whistles, A held flies the jets; 4, v1.11: one job per button; 3, v1.11's first build: double duties on L3 and D-pad ↑, the potion on ↓)
export const PAD_SCHEME_KEY = 'hiraeth.padScheme';
// (shown in the player's language: src/i18n.js teach.padScheme, the same words)
export const PAD_SCHEME_NOTE = 'D-pad → calls Plumb, R3 only locks on, hold D-pad ↑: gadgets, modes.';
