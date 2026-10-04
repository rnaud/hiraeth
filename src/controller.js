// Standard Gamepad mapping (Xbox / PlayStation / compatible controllers).
export function stick(x = 0, y = 0, deadzone = 0.18) {
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const scale = Math.min(1, (length - deadzone) / (1 - deadzone)) / length;
  return { x: x * scale, y: y * scale };
}

export class Controller {
  constructor({ pads = () => navigator.getGamepads?.() ?? [], context, action, look, navigate, scroll, activity = () => {}, swapAB = () => false }) {
    Object.assign(this, { pads, context, action, look, navigate, scroll, activity, swapAB });
    this.previous = []; this.held = {}; this.index = null; this.repeat = 0;
    this.blocked = new Set(); this.lastContext = null;
  }
  update(dt, enabled = true) {
    // standard-mapped pads first; a pad without the mapping (an unrecognised handheld) is read as standard rather than ignored
    const all = enabled ? Array.from(this.pads()).filter(p => p?.connected && p.buttons?.length >= 12 && p.axes?.length >= 2) : [];
    const pads = all.some(p => p.mapping === 'standard') ? all.filter(p => p.mapping === 'standard') : all;
    const used = p => p.buttons.some(b => b.pressed) || p.axes.some(a => Math.abs(a) > 0.22);
    const pad = pads.find(p => p.index === this.index && used(p)) ?? pads.find(used) ?? pads.find(p => p.index === this.index) ?? pads[0];
    this.held = {};
    if (!pad) { this.previous = []; this.index = null; this.lastContext = null; return this.held; }
    if (this.index !== pad.index) { this.previous = []; this.blocked.clear(); }
    this.index = pad.index;
    const buttons = pad.buttons.map((b, i) => b.pressed || b.value > (i === 6 ? 0.3 : 0.5));   // LT aims from a light squeeze
    if (this.swapAB()) [buttons[0], buttons[1]] = [buttons[1], buttons[0]];   // the setting "Swap A/B": B confirms and jumps, A goes back
    const ctx = this.context();
    // A held confirm/jump must never leak through when a menu closes.
    if (ctx !== this.lastContext) {
      buttons.forEach((b, i) => { if (b && this.previous[i]) this.blocked.add(i); });
      this.repeat = 0; this.direction = '';
    }
    buttons.forEach((b, i) => { if (!b) this.blocked.delete(i); });
    const down = i => !!buttons[i] && !this.blocked.has(i);
    const press = i => down(i) && !this.previous[i];
    const left = stick(pad.axes[0], pad.axes[1]), right = stick(pad.axes[2], pad.axes[3]);
    if (used(pad)) this.activity();
    if (ctx === 'menu') {
      if (press(1) || press(9) || press(8)) this.action('back');
      else if (press(0) || press(2)) this.action('confirm');
      const x = down(15) ? 1 : down(14) ? -1 : Math.abs(left.x) > 0.5 ? Math.sign(left.x) : 0;
      const y = down(13) ? 1 : down(12) ? -1 : Math.abs(left.y) > 0.5 ? Math.sign(left.y) : 0;
      const direction = y ? `y${y}` : x ? `x${x}` : '';
      this.repeat -= dt;
      if (direction && (direction !== this.direction || this.repeat <= 0)) {
        this.navigate(y ? 0 : x, y); this.repeat = direction === this.direction ? 0.14 : 0.4;
      }
      this.direction = direction;
      if (right.y) this.scroll(right.y * dt * 650);
    } else {
      this.look(right.x * dt * 900, right.y * dt * 900);
      const h = this.held;
      h.stick = { x: left.x, y: -left.y };
      h.KeyW = left.y < -0.15; h.KeyS = left.y > 0.15;
      h.KeyA = left.x < -0.15; h.KeyD = left.x > 0.15;
      h.ShiftLeft = down(7) || down(10);
      if (ctx === 'photo') {
        h.KeyE = down(5); h.KeyQ = down(4);
        if (press(0)) this.action('capture');
        if (press(1) || press(13) || press(9)) this.action('photo');
      } else {
        h.Space = down(0); h.KeyE = down(2);
        // the fluid tool: hold LT to aim, RT shoots while aiming (instead of running), B pushes; A in the air boosts (it's jump)
        h.PadAim = down(6);
        if (h.PadAim) { h.PadFire = down(7); h.ShiftLeft = down(10); }
        h.PadPush = down(1);
        // D-pad right / left: the next / previous gun mode of the fluid tool (fluid-tool.js)
        h.PadModeNext = down(15); h.PadModePrev = down(14);
        if (down(4) || down(5)) this.action(down(4) ? 'zoomOut' : 'zoomIn', dt);
        if (press(3)) this.action('ping');
        if (press(9)) this.action('settings');
        else if (press(8)) this.action('journal');
        else if (press(12)) this.action('worlds');
        else if (press(13)) this.action('photo');
      }
    }
    this.previous = buttons; this.lastContext = ctx;
    return this.held;
  }
}

export function mergeControls(keyboard, gamepad) {
  const merged = { ...keyboard };
  for (const [key, value] of Object.entries(gamepad)) {
    if (key === 'stick') { if (value.x || value.y) merged.stick = value; }
    else merged[key] = !!keyboard[key] || value;
  }
  return merged;
}

export function menuNavigate(root, x, y) {
  const elements = [...root.querySelectorAll('button, a[href], input, select')].filter(e => !e.disabled && e.getClientRects().length);
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
