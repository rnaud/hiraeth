// The galactic map for an engine (issue #264, docs/systems/engine-bridge.md "The galactic map"): the web's StarMap
// (src/ship/starmap.js), a page of its own over the game when the holo table is used, as plain state an engine draws
// (the Unity bridge: BridgeMenu.StarMap.cs). The same model: the chart's entries (mapEntries, from the options the ship
// gave its StarMap), the system laid out for the chart's field (chartDrawing: the star, the orbits, the route, the way on
// with its NEXT pennant, the relay's signal, the uncharted regions), the world picked as it opens (firstPick), the
// panel's words (worldTag, worldState, worldRelay, signatureReading), "Travel to …?" asked first. And the signature
// search (src/story/signature-search.js) as the page plays it: a scanner the left stick or W A S D moves over the chart,
// warming, quickening and singing nearer a world not charted yet (its cues, the pad's rumble in threes, the light's
// notes), the planet resolving when held over it half a second (o.onFound: the ship sets `map.found.<id>` and says so).
//
//   const map = new EngineStarMap({ o: ship.map.o, screen: () => ({ w: 1280, h: 720 }) });
//   menus.openStarMap(map);   // engine/menus.js: its pad, keys and view
//   map.update(dt, [x, y]);   // each frame: the search
//   map.view();               // what to draw (the chart's field in px, y down)

import { mapEntries, chartDrawing, scanColour, worldTag, worldState, worldRelay, chartSub, firstPick, chartToward, DIR_KEYS } from '../src/ship/starmap.js';
import { signatureReading, SIGNATURE, SIGNATURE_LEGEND, SIGNATURE_LEGEND_SHORT } from '../src/story/signature.js';
import { searchStep, searchArmed, cues, wander, WANDER, SEARCH, SEARCH_LABEL, SEARCH_LEGEND, SEARCH_LEGEND_SHORT, signatureNotes } from '../src/story/signature-search.js';
import { rumblePlay } from '../src/rumble.js';

/**
 * The page's chart on a screen of W x H (its CSS, src/ship/starmap.js: `#starmap .chart` min(1200px, 96vw) by
 * min(720px, 90vh) with a 2 px ink edge, the side column clamp(210px, 27%, 300px), the field the rest): where the
 * chart's box goes (its edge included), the side's width, the field's size.
 */
export function chartBox(W = 1280, H = 720) {
  const w = Math.min(1200, W * 0.96), h = Math.min(720, H * 0.9), side = Math.min(300, Math.max(210, w * 0.27));
  return { x: (W - w - 4) / 2, y: (H - h - 4) / 2, w, h, side, fw: w - side, fh: h };
}

/** The keys that move the scanner while there is a world to find (the page's SCAN_KEYS). */
const SCAN_KEYS = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => [r1(p[0]), r1(p[1])];
/** 'rgb(r, g, b)' as '#rrggbb' (scanColour's, for the engine). */
const hex = (rgb) => `#${(String(rgb).match(/\d+/g) ?? [0, 0, 0]).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('')}`;

export class EngineStarMap {
  /**
   * @param o.o       the StarMap's options (src/ship/ship.js attach: order, levels, flag, journal, current, powered, home,
   *                  relay, finale, tower, side, onTravel, onFound, sound)
   * @param o.screen  () → the menus' canvas { w, h } (its units: the page's px at 720 high)
   * @param o.pad     () → true when the pad is in hand (the prompts' keys: its buttons, else the keyboard's)
   * @param o.onClose () the map closed (the menus' mode)
   */
  constructor({ o, screen = () => ({ w: 1280, h: 720 }), pad = () => false, onClose = () => {} } = {}) {
    Object.assign(this, { o, screen, pad, onClose });
    this.isOpen = false;
    this.sel = 0;
    this.asking = null;      // the entry "Travel to …?" asks about; `yes` the answer the pad is on
    this.yes = true;
    this.held = new Set();   // W A S D held: the scanner moves
    this.search = { lock: {} };
    this.scan = null;
    this.cv = 0;             // (the chart's own version: the scanner moving alone leaves it)
  }

  /** Is there a world to find (and power to look)? */
  searching() { return this.isOpen && !!this.targets?.length && !!this.o.powered?.() && !this.resolving; }

  open() {
    this.isOpen = true;
    this.asking = null; this.held.clear(); this.search.lock = {}; this.still = false;
    this.pointerAt = null; this.scan = null; this.moved = 0; this.resolving = null; this.beatT = 0; this.pingT = -1; this.wPhase = 0; this.wAmp = 0;
    this.render();
    this.sel = firstPick(this.entries, this.o.flag ?? (() => undefined));
    if (!this.entries[this.sel]?.known) this.sel = Math.max(0, this.entries.findIndex((e) => e.known));
    this.cue = cues(0); this.lock = 0;
    this.cv++;
  }
  close() { if (!this.isOpen) return; this.isOpen = false; this.asking = null; this.held.clear(); this.onClose(); }

  /** The entries read again and the system laid out for the chart's field (the page's render and place). */
  render() {
    this.entries = mapEntries(this.o);
    const S = this.screen?.() ?? { w: 1280, h: 720 };
    this.viewport = { w: S.w, h: S.h };
    this.box = chartBox(S.w, S.h);
    this.D = chartDrawing(this.entries, this.box.fw, this.box.fh);
    this.targets = this.D.targets;
    if (!this.scan || this.scan[0] > this.box.fw || this.scan[1] > this.box.fh) this.scan = this.D.scanFrom;
    this.cv++;
  }

  /** The native canvas may settle after opening (1280 to 960 on a 4:3 handheld). */
  resize() {
    if (!this.isOpen || !this.box) return false;
    const S = this.screen?.() ?? { w: 1280, h: 720 };
    if (S.w === this.viewport?.w && S.h === this.viewport?.h) return false;
    const scan = this.scan?.map((v, i) => v / (i ? this.box.fh : this.box.fw));
    this.render();
    if (scan) this.scan = [scan[0] * this.box.fw, scan[1] * this.box.fh];
    // A layout change isn't a deliberate sweep or time held over a new target.
    this.pointerAt = null; this.moved = 0; this.search.lock = {}; this.lock = 0;
    if (this.resolving) {
      const entry = this.entries.find(e => e.id === this.resolving.id);
      if (entry) { const [x, y] = this.D.pos(entry); Object.assign(this.resolving, { x, y }); }
    }
    return true;
  }

  /** Pointer on the chart, normalized across/down. Initial hover is not a deliberate sweep (web issue #204). */
  pointer(x, y, pressed = false) {
    this.resize();
    if (!this.searching() || this.asking || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const to = [Math.max(0, Math.min(1, x)) * this.box.fw, Math.max(0, Math.min(1, y)) * this.box.fh];
    if (this.pointerAt) this.moved += Math.hypot(to[0] - this.pointerAt[0], to[1] - this.pointerAt[1]);
    else if (!pressed) { this.pointerAt = to; return false; }
    this.pointerAt = to;
    this.scan = to;
    return true;
  }

  /** The entries you can choose (known worlds, and home), as indices into entries. */
  choices() { return (this.entries ?? []).map((e, i) => (e.known ? i : -1)).filter((i) => i >= 0); }
  step(d) {
    const c = this.choices();
    if (!c.length || !d) return;
    const at = c.indexOf(this.sel);
    this.select(c[(Math.max(0, at) + Math.sign(d) + c.length) % c.length]);
  }
  select(i) { if (this.entries?.[i]?.known && this.sel !== i) { this.sel = i; this.cv++; } }
  /** The world that way on the chart (x right, y down): the nearest disc in that direction (the page's move). */
  move(dx, dy) {
    if (!this.entries || !this.D) return;
    const i = chartToward(this.entries, this.D, this.sel, dx, dy);
    if (i >= 0) this.select(i);
  }

  /** Travel to the chosen world: ask first. */
  go() {
    const e = this.entries?.[this.sel];
    if (!e || !e.known || e.current || !this.o.powered?.() || this.asking) return;
    this.asking = e; this.yes = true; this.cv++;
  }
  answer(yes) {
    const e = this.asking;
    if (!e) return;
    this.asking = null; this.cv++;
    if (!yes) return;
    this.close();
    this.o.onTravel?.(e.id);
  }

  // ------------------------------------------------------------------ input (engine/menus.js hands it over)

  /** A menu action (src/controller.js, context 'menu'): A / × travels or answers, B / ○ says no, then closes. */
  action(name) {
    if (this.asking) { if (name === 'confirm') this.answer(this.yes); else if (name === 'back') this.answer(false); return; }
    if (name === 'confirm') this.go();
    else if (name === 'back') this.close();
  }
  /** The D-pad, the arrows (and the stick when not searching): the world that way on the chart, or the other answer. */
  navigate(x, y) {
    if (!x && !y) return;
    if (this.asking) { this.yes = !this.yes; this.cv++; return; }
    this.move(x, y);
  }
  /** A key pressed (KeyboardEvent.code), as the page's keydown: true when the map took it. */
  key(code) {
    if (this.asking) {
      if (code === 'Escape' || code === 'Backspace') this.answer(false);
      else if (DIR_KEYS[code] || code === 'Tab') { this.yes = !this.yes; this.cv++; }
      else if (code === 'Enter' || code === 'Space' || code === 'KeyE' || code === 'NumpadEnter') this.answer(this.yes);
      return true;
    }
    if (this.searching() && SCAN_KEYS[code]) { this.held.add(code); return true; }
    if (code === 'Escape' || code === 'Backspace') this.close();
    else if (DIR_KEYS[code]) this.move(...DIR_KEYS[code]);
    else if (code === 'Enter' || code === 'Space' || code === 'KeyE' || code === 'NumpadEnter') this.go();
    else return false;
    return true;
  }
  keyUp(code) { this.held.delete(code); }

  /**
   * The search, once a frame while the map is open (`dt` s; `stick`: the pad's left stick [x, y]): the scanner moved
   * by the stick or W A S D, the cues for where it is, a world resolved when held over it (the page's searchUpdate).
   * Then a resolved planet's second, the chart drawn again with it. True when what is drawn moved.
   */
  update(dt, stick = null) {
    const resized = this.resize();
    if (!this.isOpen || this.still) return resized;
    if (this.resolving) {
      this.resolving.t += dt;
      if (this.resolving.t >= 1) {
        const id = this.resolving.id;
        this.resolving = null; this.search.lock = {};
        const keep = this.scan;
        this.render();
        this.scan = keep; this.cue = cues(0); this.lock = 0;
        const i = this.entries.findIndex((e) => e.id === id && e.known);
        if (i >= 0) this.select(i);
      }
      return true;
    }
    if (!this.searching() || this.asking) return resized;
    const W = this.box.fw, H = this.box.fh, diag = this.D.diag;
    let mx = 0, my = 0;
    for (const k of this.held) { const d = SCAN_KEYS[k]; if (d) { mx += d[0]; my += d[1]; } }
    if (stick) {
      const m = Math.hypot(stick[0], stick[1]);
      if (m > 0.2) { const k = Math.min(1, (m - 0.2) / 0.7) / m; mx += stick[0] * k; my += stick[1] * k; }
    }
    if (mx || my) {
      const v = SEARCH.speed * diag * dt, n = Math.max(1, Math.hypot(mx, my)), was = this.scan;
      this.scan = [Math.min(W, Math.max(0, this.scan[0] + (mx / n) * v)), Math.min(H, Math.max(0, this.scan[1] + (my / n) * v))];
      this.moved += Math.hypot(this.scan[0] - was[0], this.scan[1] - was[1]);
      // the scanner over a charted world picks it (the stick works as a cursor; A then travels)
      this.entries.forEach((e, i) => {
        if (!e.known || this.sel === i) return;
        const [x, y] = this.D.pos(e), r = this.D.boxOf(e).disc / 2;
        if (Math.hypot(this.scan[0] - x, this.scan[1] - y) < r) this.select(i);
      });
    }
    const r = searchStep(this.search, { at: this.scan, targets: this.targets, dt, diag, disc: this.D.L.box.disc, armed: searchArmed(this.moved, diag) });
    const c = cues(r.strength);
    this.cue = c; this.lock = r.lock;
    this.wPhase = (this.wPhase + dt * Math.PI * 2 * c.wander) % (Math.PI * 200);
    this.wAmp += (c.jitter - this.wAmp) * (1 - Math.exp(-WANDER.ease * dt));
    // the beat: the scanner pings (three rings), the pad rumbles the three pulses, the light's notes now and then
    this.beatT -= dt;
    if (this.pingT >= 0) this.pingT += dt;
    if (this.pingT > 1) this.pingT = -1;
    if (c.notes > 0 && this.beatT <= 0) {
      this.beatT = c.beat; this.pingT = 0;
      try { rumblePlay('search', { s: r.strength }); } catch { /* no pad */ }
      const t = Date.now();
      if (t - (this.notesT ?? -1e9) > 1700) { this.notesT = t; try { signatureNotes(this.o.sound?.(), c.notes); } catch { /* no sound */ } }
    }
    if (r.found) this.resolve(r.found);
    return true;
  }

  /** A world found: the planet resolves where it was, the ship charts it (o.onFound), the map is drawn again with it a second later. */
  resolve(id) {
    const t = this.targets.find((x) => x.id === id);
    if (!t || this.resolving) return;
    this.resolving = { id, t: 0, x: t.x, y: t.y };
    try { rumblePlay('found'); } catch { /* no pad */ }
    const sound = this.o.sound?.();
    if (sound?.discovery) sound.discovery(); else sound?.chime?.();
    this.o.onFound?.(id, t.title);
    this.cv++;
  }

  // ------------------------------------------------------------------ what to draw

  /** A prompt's key and its words: the pad's button (written "A / ×", the bundle names it), else the keyboard's key. */
  cap(role, text) {
    const pad = !!this.pad?.();
    const cap = { ok: pad ? 'A / ×' : 'Enter', back: pad ? 'B / ○' : 'Esc', dpad: pad ? 'D-pad' : 'arrows' }[role] ?? '';
    return { cap, text };
  }

  /**
   * The map to draw (BridgeMenu.StarMap.cs): the chart's box on the canvas and, in its field's px (y down), the system,
   * the worlds, the scanner, the meter, the resolving planet; the panel, the legend, the keys; the question; the lock.
   * `cv` moves when anything but the scanner, the meter and the resolving planet changed.
   */
  view() {
    this.resize();
    const D = this.D, L = D.L, B = this.box, E = this.entries, searching = this.searching() || !!this.resolving;
    const powered = !!this.o.powered?.();
    const worlds = E.map((e, i) => {
      if (!e.known) return null;
      const [x, y] = D.pos(e), bx = D.boxOf(e), sel = i === this.sel;
      const ring = sel ? 'sel' : e.next ? 'next' : e.current ? 'current' : e.visited ? '' : 'unvisited';
      const tagCol = e.current ? 'current' : e.home ? 'home' : e.next ? 'next' : e.signal ? 'signal' : '';
      return { id: e.id, pt: `star:${i}`, x: r1(x), y: r1(y), disc: bx.disc, w: bx.w, font: r1(bx.font), name: e.title, tag: worldTag(e), tagCol, ring, sel,
        done: !!e.done, sig: !!e.signature, next: !!e.next, home: !!e.home, signal: !!e.signal, moon: !!e.moon };
    }).filter(Boolean);
    const sc = searching && this.scan ? (() => {
      const still = !!globalThis.document?.documentElement?.classList?.contains?.('reduce-motion');
      const [jx, jy] = still ? [0, 0] : wander(this.wPhase, this.wAmp), c = this.cue ?? cues(0), lock = this.lock ?? 0;
      return { scanner: { x: r1(this.scan[0] + jx), y: r1(this.scan[1] + jy), col: hex(scanColour(c.warmth)), warm: +c.warmth.toFixed(3), lock: +lock.toFixed(3), ping: this.pingT >= 0 ? +this.pingT.toFixed(3) : -1 },
        meter: { bars: c.bars, word: lock > 0.05 ? 'locking' : c.word, col: hex(scanColour(c.warmth)) } };
    })() : { scanner: null, meter: null };
    const e = E[this.sel] ?? null;
    const sig = e ? signatureReading(e.id, { visited: e.visited }) : null;
    const panel = e ? { id: e.home ? '' : e.id, home: !!e.home, title: e.title, source: e.source ?? '', blurb: e.blurb ?? '', relay: worldRelay(e), sig: sig ? `SIGNATURE · ${sig}` : '',
      state: worldState(e), go: e.current ? { cap: '', text: 'you are here' } : this.cap('ok', 'Travel ▶'), off: !!e.current || !powered } : null;
    const short = (this.screen?.()?.h ?? 720) <= 760;   // (the page's @media (max-height: 760px): the legend's short words)
    const legend = searching ? { search: true, label: SEARCH_LABEL, text: short ? SEARCH_LEGEND_SHORT : SEARCH_LEGEND }
      : { search: false, label: SIGNATURE, text: short ? SIGNATURE_LEGEND_SHORT : SIGNATURE_LEGEND };
    const pad = !!this.pad?.();
    const keys = { pre: searching ? (pad ? 'touch or left stick: search · ' : 'mouse or W A S D: search · ') : '', ...this.cap('dpad', 'choose a world') };
    const a = this.asking;
    return {
      kind: 'starmap', cv: this.cv, chart: { x: r1(B.x), y: r1(B.y), w: r1(B.w), h: r1(B.h), side: r1(B.side) }, fw: r1(B.fw), fh: r1(B.fh),
      title: 'GALACTIC MAP', sub: chartSub(E), searching, locked: !powered,
      star: { x: r1(L.star.x), y: r1(L.star.y), r: r1(L.star.r) }, edge: r1(L.edge),
      orbits: D.orbits.map((o) => ({ r: r1(o.r), kind: o.kind, belt: o.belt })), moons: D.moons.map((m) => ({ x: r1(m.x), y: r1(m.y), r: r1(m.r) })),
      segs: D.segs.map((g) => ({ a: pt(g.a), b: pt(g.b), faint: g.faint })), trace: D.trace ? { a: pt(D.trace.a), b: pt(D.trace.b) } : null,
      wayon: D.wayon ? { a: pt(D.wayon.p0), b: pt(D.wayon.p1), head: D.wayon.head.map(pt) } : null,
      dots: D.dots.map((d) => ({ x: r1(d.x), y: r1(d.y), r: r1(d.r) })),
      regions: D.regions.map((g) => ({ x: r1(g.cx), y: r1(g.cy), r: r1(g.r), tagY: r1(g.tagY) })),
      relays: D.relays.map((g) => ({ x: r1(g.x), y: r1(g.y), r: r1(g.r), dot: r1(g.dot), tag: g.tag, tagY: r1(g.tagY), next: g.next, nextY: r1(g.nextY) })),
      worlds, ...sc,
      resolve: this.resolving ? { id: this.resolving.id, x: r1(this.resolving.x), y: r1(this.resolving.y), disc: L.box.disc, k: +Math.min(1, this.resolving.t).toFixed(3) } : null,
      panel, legend, line: keys, close: this.cap('back', 'close ✕'),
      ask: a ? { id: a.home ? '' : a.id, home: !!a.home, title: `Travel to ${a.title}?`, what: a.home ? 'The ship will take you home.' : 'The ship will take off and fly there.',
        yes: pad ? this.cap('ok', 'Yes, fly ▶') : { cap: '', text: 'Yes, fly ▶' }, no: this.cap('back', 'No'), on: this.yes ? 'yes' : 'no' } : null,
    };
  }
}

// ------------------------------------------------------------------ pictures of it

const done = (...ids) => Object.fromEntries(ids.map((w) => [`world.${w}.done`, true]));
const found = (...ids) => Object.fromEntries(ids.map((w) => [`map.found.${w}`, true]));
/**
 * The map's screens photographed side by side with the web's (the Unity bridge's `-starmap <scene,…>`, aboard in the
 * desert on the debug save): each scene's save flags over STARMAP_BASE, and what is done once it is open.
 *   search   the desert done: Vael and Lorn to find (the uncharted regions, the scanner by the ship, the meter silent)
 *   warm     the scanner just off Vael's spot: warm, the lock a little built (held still for the picture)
 *   found    held over Vael: resolved, charted, picked (the NEXT pennant on it), Lorn still to find
 *   system   four worlds done, two found: the system, the way on to the Underwater City, the relay's signal at the market
 *   ask      the same, "Travel to The Underwater City?"
 *   nopower  the desert done, the ship without power: NO POWER over the chart
 *   home     six worlds done and the call heard: Home by the star, NEXT on it, "they are waiting"
 *   up, down the system's, then the D-pad's up (or down) pressed once: the world that way picked (issue #371)
 */
export const STARMAP_BASE = { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.powered': true };
export const STARMAP_SCENES = {
  search: { flags: done('desert') },
  warm: { flags: done('desert'), warm: true },
  found: { flags: done('desert'), found: true },
  system: { flags: { ...done('desert', 'arzach', 'perdide', 'edena'), ...found('underwater', 'incal') } },
  ask: { flags: { ...done('desert', 'arzach', 'perdide', 'edena'), ...found('underwater', 'incal') }, ask: true },
  nopower: { flags: { ...done('desert'), 'ship.powered': false } },
  home: { flags: { ...done('desert', 'arzach', 'perdide', 'edena', 'underwater', 'incal'), ...found('glassdunes', 'buried'), 'calls.home': true } },
  up: { flags: { ...done('desert', 'arzach', 'perdide', 'edena'), ...found('underwater', 'incal') }, nav: [0, -1] },
  down: { flags: { ...done('desert', 'arzach', 'perdide', 'edena'), ...found('underwater', 'incal') }, nav: [0, 1] },
};
/** A scene's moment on an open map (the web's shot script does the same on the page's StarMap). */
export function poseStarMap(map, scene) {
  const S = STARMAP_SCENES[scene] ?? {};
  const t = map.targets?.find((x) => x.id === 'arzach') ?? map.targets?.[0];
  if (S.warm && t) {
    map.scan = [t.x + 34, t.y + 22]; map.moved = 1e4;
    for (let i = 0; i < 6; i++) map.update(0.016);
    map.lock = 0.4; map.still = true; map.cv++;
  }
  if (S.found && t) { map.scan = [t.x, t.y]; map.moved = 1e4; }
  if (S.nav) map.navigate(...S.nav);
  if (S.ask) map.go();
}
