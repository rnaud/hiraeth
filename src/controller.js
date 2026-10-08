// Gamepads (Standard Gamepad mapping: Xbox / PlayStation / compatible controllers, and
// the Android handhelds through native-pad.js). The layout is by position, so the same
// thumb does the same thing on every pad (docs/systems/controls.md, "Controller"):
//
//   walking   bottom jump (again in the air: boost) · right interact, talk, get on
//             · left call the mount (whistle it, hail a taxi) · top: the scout finds the objective
//             · LT aim · RT shoots while LT is held, and without it is the jets' throttle
//             (analog; they fly like a plane: the stick forward tips the nose down, back
//             pulls it up, left / right bank and turn; LT in flight holds you to aim) · RB the blade
//             · L3 (click the left stick) run until you stop
//             · LB + right stick zoom · D-pad ←/→ gun mode, ↑ worlds, ↓ photo
//             · top (Y / △) the gadget in hand, if any (else the scout) · D-pad ↑ choose a gadget
//             (tap: the next; held: the wheel), once one is owned (else the bell-note whistle)
//             · R3 (click the right stick) the bell-note whistle, once found
//             · View the sketchbook (gear first) · Menu the settings
//   riding    RT throttle (analog) · LT brake / reverse · left stick steer, and on
//             flyers dive (forward) / climb (back) · left hop / flap / rise
//             · RB or L3 boost · bottom jump off (a hop; its speed carries you) · right get off
//             · top: the scout finds the objective, as on foot
//   menus     the button printed A confirms, B goes back (Xbox: bottom / right; a
//             Retroid, letters Nintendo-style: right / bottom) · View, Menu close
//             · LB / RB the game menu's panel before / after
//   talking   as menus; the interact button also goes on (so on Xbox, B talks and
//             B carries on rather than walking away)
//   photo     stick fly · LB / RB down / up · confirm saves · back or ↓ leaves
//
// Positions: 0 bottom, 1 right, 2 left, 3 top. A pad that reports its buttons by
// printed letter with Nintendo labels (Android, the Retroid: 0 is A on the right)
// is moved to positions first (faces().byLabel, see native-pad.js padFaces).
export const SOUTH = 0, EAST = 1, WEST = 2, NORTH = 3;
const LB = 4, RB = 5, LT = 6, RT = 7, VIEW = 8, MENU = 9, L3 = 10, R3 = 11, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

export function stick(x = 0, y = 0, deadzone = 0.18) {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return { x: x * scale, y: y * scale };
}

/** Letters (0 A, 1 B, 2 X, 3 Y) of a Nintendo-labelled pad → positions (0 bottom B, 1 right A, 2 left Y, 3 top X). */
export function toPositions(list) {
  const out = list.slice();
  [out[SOUTH], out[EAST], out[WEST], out[NORTH]] = [list[1], list[0], list[3], list[2]];
  return out;
}

const trigger = (v) => (v > 0.05 ? Math.min(1, (v - 0.05) / 0.9) : 0);

export class Controller {
  /**
   * @param o.context () => 'menu' | 'talk' | 'photo' | 'ride' | 'game'
   * @param o.faces   () => ({ faces: 'xbox' | 'nintendo', byLabel }) (native-pad.js padFaces)
   */
  constructor({ pads = () => navigator.getGamepads?.() ?? [], context, action, look, navigate, scroll, activity = () => {}, faces = () => ({ faces: 'xbox', byLabel: false }), combat = null }) {
    Object.assign(this, { pads, context, action, look, navigate, scroll, activity, faces, combat });   // (combat: a foe is near, LB blocks rather than zooms)
    this.previous = []; this.held = {}; this.index = null; this.repeat = 0;
    this.blocked = new Set(); this.lastContext = null; this.running = false;
  }
  update(dt, enabled = true) {
    // standard-mapped pads first; a pad without the mapping (an unrecognised handheld) is read as standard rather than ignored
    const all = enabled ? Array.from(this.pads()).filter(p => p?.connected && p.buttons?.length >= 12 && p.axes?.length >= 2) : [];
    const pads = all.some(p => p.mapping === 'standard') ? all.filter(p => p.mapping === 'standard') : all;
    const used = p => p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.22);
    const pad = pads.find(p => p.index === this.index && used(p)) ?? pads.find(used) ?? pads.find(p => p.index === this.index) ?? pads[0];
    this.held = {};
    if (!pad) { this.previous = []; this.index = null; this.lastContext = null; this.running = false; return this.held; }
    if (this.index !== pad.index) { this.previous = []; this.blocked.clear(); }
    this.index = pad.index;
    const { faces, byLabel } = this.faces();
    let buttons = pad.buttons.map((b, i) => b.pressed || b.value > (i === LT ? 0.3 : 0.5));   // LT aims from a light squeeze
    if (byLabel) buttons = toPositions(buttons);
    const value = i => { const b = pad.buttons[i]; return b ? (b.value > 0 ? b.value : b.pressed ? 1 : 0) : 0; };   // (the triggers: analog)
    const ctx = this.context();
    // A held confirm/jump must never leak through when a menu closes (nor RT fire as you step off a bike).
    if (ctx !== this.lastContext) {
      buttons.forEach((b, i) => { if (b && this.previous[i]) this.blocked.add(i); });
      this.repeat = 0; this.direction = '';
    }
    buttons.forEach((b, i) => { if (!b) this.blocked.delete(i); });
    const down = i => !!buttons[i] && !this.blocked.has(i);
    const press = i => down(i) && !this.previous[i];
    const left = stick(pad.axes[0], pad.axes[1]), right = stick(pad.axes[2], pad.axes[3]);
    if (used(pad)) this.activity();
    // menus: printed A confirms, B goes back (A is at the bottom on Xbox, on the right with Nintendo letters);
    // Menu / Start and View / Select open (or close) the full-screen menus from anywhere, over a
    // conversation or one of the ship's scenes too (main.js)
    const ok = faces === 'nintendo' ? EAST : SOUTH, no = faces === 'nintendo' ? SOUTH : EAST;
    if (ctx === 'menu' || ctx === 'talk') {
      const talkOn = ctx === 'talk' && press(EAST);   // the interact button carries a conversation on
      if (press(MENU)) this.action('start');
      else if (press(VIEW)) this.action('select');
      else if (press(LB)) this.action('tabPrev');   // the game menu's panels (main.js): the one before, the one after
      else if (press(RB)) this.action('tabNext');
      else if (press(no) && !(ctx === 'talk' && no === EAST)) this.action('back');
      else if (press(ok) || talkOn) this.action('confirm');
      const x = down(RIGHT) ? 1 : down(LEFT) ? -1 : Math.abs(left.x) > 0.5 ? Math.sign(left.x) : 0;
      const y = down(DOWN) ? 1 : down(UP) ? -1 : Math.abs(left.y) > 0.5 ? Math.sign(left.y) : 0;
      const direction = y ? `y${y}` : x ? `x${x}` : '';
      this.repeat -= dt;
      if (direction && (direction !== this.direction || this.repeat <= 0)) {
        this.navigate(y ? 0 : x, y); this.repeat = direction === this.direction ? 0.14 : 0.4;
      }
      this.direction = direction;
      if (right.y) this.scroll(right.y * dt * 650);
      this.running = false;
    } else {
      const h = this.held;
      // LB held: the right stick zooms (pull back: out) instead of looking
      // (in a fight LB blocks: the stick looks)
      if (down(LB) && ctx !== 'photo' && !this.combat?.()) { if (right.y) this.action(right.y > 0 ? 'zoomOut' : 'zoomIn', dt * Math.abs(right.y) * 1.6); }
      else this.look(right.x * dt * 900, right.y * dt * 900);
      h.stick = { x: left.x, y: -left.y };
      if (ctx === 'photo') {
        h.KeyW = left.y < -0.15; h.KeyS = left.y > 0.15;
        h.KeyA = left.x < -0.15; h.KeyD = left.x > 0.15;
        h.ShiftLeft = down(RT) || down(L3);
        h.KeyE = down(RB); h.KeyQ = down(LB);
        if (press(ok)) this.action('capture');
        if (press(no) || press(DOWN) || press(MENU)) this.action('photo');
      } else if (ctx === 'ride') {
        // RT is the throttle; the stick only steers (and pitches a flyer): pushing it never drives on
        h.PadRide = true;
        h.Throttle = trigger(value(RT)); h.Brake = trigger(value(LT));
        h.Boost = down(RB) || down(L3);
        // the bottom button jumps off (player.jumpOff); the vehicle's own hop / flap / rise is the left one's
        h.Space = down(WEST); h.JumpOff = down(SOUTH); h.KeyE = down(EAST); h.PadE = h.KeyE;
        this.running = false;
      } else {
        h.KeyW = left.y < -0.15; h.KeyS = left.y > 0.15;
        h.KeyA = left.x < -0.15; h.KeyD = left.x > 0.15;
        // run: click the left stick; you keep running until you let the stick go
        if (press(L3)) { this.running = true; this.action('l3'); }   // (the Lab: the previous world's room)
        else if (!left.x && !left.y) this.running = false;
        h.ShiftLeft = this.running;
        h.Space = down(SOUTH); h.PadJump = h.Space;   // (PadJump: this Space is the pad's, which climbs on the jets but never fires them)
        h.KeyE = down(EAST); h.PadE = h.KeyE;   // (the pad's interact never whistles: that's the left button's)
        // the fluid tool: hold LT to aim, RT shoots while aiming (the push too: a gun mode) and fires the jets
        // otherwise (triggers()); jump in the air boosts. The fluid blade (src/fluid-blade.js): RB swings, LB held blocks
        h.PadAim = down(LT); h.PadFire = down(RT);
        h.PadThrust = this.blocked.has(RT) ? 0 : trigger(value(RT));   // (the jets' throttle: analog, a light squeeze flies slowly)
        h.PadBlade = down(RB); h.PadGuard = down(LB);
        // D-pad right / left: the next / previous gun mode of the fluid tool (fluid-tool.js)
        h.PadModeNext = down(RIGHT); h.PadModePrev = down(LEFT);
        // the gadget in hand (src/gadgets/): the top button uses it (pressed, held, let go: with none in hand it
        // pings, below), D-pad up chooses one (a tap the next, held the wheel; with none owned it rings the bell)
        h.PadGadget = down(NORTH); h.PadGadgetPick = down(UP);
        if (press(WEST)) this.action('call');
      }
      // the top button sends the scout to find the objective, on foot and riding (flying too)
      if (ctx !== 'photo' && press(NORTH)) this.action('ping');
      if (ctx !== 'photo') {
        if (press(R3)) this.action('lock');   // lock on to the nearest foe, then the next (Tab on the keyboard: src/foes.js)
        if (press(MENU)) this.action('settings');
        else if (press(VIEW)) this.action('journal');
        else if (press(UP)) this.action('bell');   // the bell-note whistle, once found (V on the keyboard)
        else if (press(DOWN)) this.action('photo');
      }
    }
    this.previous = buttons; this.lastContext = ctx;
    return this.held;
  }
}

/**
 * The pad's riding controls (Controller, context 'ride'), or null for the keyboard and touch:
 * throttle / brake 0..1 from the triggers, x the stick's steer, y > 0 pushed forward (a flyer dives).
 */
export function padRide(input) {
  if (!input?.PadRide) return null;
  return { throttle: +input.Throttle || 0, brake: +input.Brake || 0, x: input.stick?.x ?? 0, y: input.stick?.y ?? 0, boost: !!input.Boost };
}

/**
 * What the aim and fire buttons do on foot (the pad's triggers, the mouse, the keys):
 *   aim    LT / L2, the right mouse button, R (touch: the ◎ toggle)
 *   shoot  RT / R2, the left mouse button or G, only while aiming (a fresh press: fluid-tool.js)
 *   jets   RT / R2 or the left mouse button while not aiming (player.js JET: they fly like a plane;
 *          Space held in the air, the keyboard's and touch's own jets key, too)
 *   thrust the jets' throttle 0..1: RT / R2's travel (PadThrust, analog), 1 for the mouse button
 *   quick  the touch ✺ button: a quick shot, aiming for you (touch has no trigger to hold)
 */
export function triggers(c = {}) {
  const aim = !!(c.KeyR || c.MouseRight || c.PadAim);
  const fire = !!(c.KeyG || c.MouseLeft || c.PadFire);
  const pad = c.PadThrust != null ? +c.PadThrust || (c.PadFire ? 1 : 0) : c.PadFire ? 1 : 0;
  const thrust = aim ? 0 : Math.max(pad, c.MouseLeft ? 1 : 0);
  return { aim, fire, shoot: aim && fire, jets: thrust > 0, thrust, quick: !!c.TouchFire };
}

export function mergeControls(keyboard, gamepad) {
  const merged = { ...keyboard };
  for (const [key, value] of Object.entries(gamepad)) {
    if (key === 'stick') { if (value.x || value.y) merged.stick = value; }
    else if (typeof value === 'number') merged[key] = Math.max(+keyboard[key] || 0, value);
    else merged[key] = !!keyboard[key] || value;
  }
  return merged;
}

export function menuNavigate(root, x, y) {
  // (and anything marked data-nav: the quests in the menu's quest log, chosen to track one)
  const elements = [...root.querySelectorAll('button, a[href], input, select, [data-nav]')].filter(e => !e.disabled && e.getClientRects().length);
  if (!elements.length) return;
  const current = document.activeElement;
  if (x && root.contains(current) && (current.type === 'range' || current.tagName === 'SELECT')) {
    if (current.type === 'range') current.value = Math.max(+current.min, Math.min(+current.max, +current.value + x * (+current.step || 1)));
    else current.selectedIndex = Math.max(0, Math.min(current.options.length - 1, current.selectedIndex + x));
    current.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    const index = elements.indexOf(current);
    const next = elements[index < 0 ? 0 : (index + (y || x) + elements.length) % elements.length];
    next.focus(); next.scrollIntoView({ block: 'nearest' });
  }
}
