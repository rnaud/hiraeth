import * as THREE from 'three';
import { game } from '../game-state.js';
import { polar } from './geo.js';
import { R, DECK, HATCH_A } from './hull.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { callTimeline } from './prologue.js';
import * as sfx from './sfx.js';
import { padIndex } from '../native-pad.js';
import { exhaust, footPuffs } from './exhaust.js';
import { tokenList, leaveTokens, tombLines, credits, creditsHtml, KIND_LABEL } from '../story/ending.js';
import { HOME_SPOTS, tokenModel, REEL_AT } from '../levels/home.js';
/** The last recording's busts over the reel (1: life size). */
const REEL_HOLO = 0.6;
import { items as ownedItems } from '../items.js';
import { CONTENT, ORDER } from '../levels/content.js';

// The homecoming (src/story/ending.js): the ship's last scene, played in the
// home level (src/levels/home.js) when you arrive there by ship.
//
//   approach  out of the jump, in orbit over home (the prologue's ship in space)
//   cargo     "Cargo check before descent": a panel lists everything in the hold,
//             the keepsakes and the makers' gifts (tokenList); all of it goes down
//   dive      into the air, a white flash
//   descend   the ship comes down over the house; the window is dark
//   hatch     it opens
//   walk      you walk down the ramp and across the yard to the stone
//   tomb      you set the tokens on it one by one (tombLines), last the reel, which
//             plays its oldest recording as a hologram over the stone (src/ship/hologram.js)
//   card      an end card
//   credits   a paper page of the worlds, the people met, what was left on the stone
//
// Hold Esc to skip ahead a scene. At the end `ending.done` is set and the game
// goes on: the ship is parked on its ring, the map flies anywhere, and the
// stone keeps its tokens.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
const GRASS = ['#eebd8e', '#e3a97c', '#f2c49a', '#d9a37f'];
const SKIP_HOLD = 0.9;
const _aim = new THREE.Vector3();

const CSS = `
#homeward { position: fixed; right: 4vw; top: calc(11vh + 14px); bottom: max(calc(11vh + 66px), var(--cine-sub-clear, 0px)); width: min(470px, 46vw); z-index: 8100; display: none; flex-direction: column;
  background: #f7ecd2; color: #2b211f; border: 2px solid #2b211f; box-shadow: 7px 7px 0 #2b211f; font: 13px/1.4 ui-monospace, Menlo, monospace; }
#homeward.open { display: flex; }
#homeward header { padding: 12px 16px 8px; border-bottom: 2px solid #2b211f; }
#homeward h2 { margin: 0; font-size: 17px; letter-spacing: .14em; }
#homeward header p { margin: 4px 0 0; font-size: 12px; opacity: .75; }
#homeward .list { flex: 1; overflow-y: auto; padding: 8px 10px; }
#homeward .k { display: block; box-sizing: border-box; width: 100%; text-align: left; margin: 0 0 8px; padding: 8px 10px; font: inherit; color: inherit;
  background: #fff6dc; border: 1.5px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; }
#homeward button.k.sel { background: #f2c54b; box-shadow: 4px 4px 0 #2b211f; transform: translate(-2px, -2px); }
#homeward button.k:focus { outline: none; }
#homeward .k b { font-size: 14px; }
#homeward .k .kind { float: right; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; padding: 1px 6px; border: 1px solid #2b211f; background: #f7ecd2; }
#homeward .k .kind.thing { background: #e6875f; } #homeward .k .kind.song { background: #a99be0; } #homeward .k .kind.word { background: #9fe0d6; }
#homeward .k .kind.person { background: #f2a7b5; } #homeward .k .kind.knowing { background: #c8d65a; } #homeward .k .kind.nothing { background: #f7ecd2; } #homeward .k .kind.item { background: #dcecf2; }
#homeward .k .from { display: block; font-size: 10px; opacity: .6; letter-spacing: .06em; margin-top: 1px; }
#homeward .k .text { display: block; margin-top: 4px; font-size: 12px; }
#homeward footer { padding: 10px 14px; border-top: 2px solid #2b211f; display: flex; gap: 12px; align-items: center; }
#homeward footer button { font: inherit; padding: 6px 14px; background: #f2c54b; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; cursor: pointer; }
#homeward footer span { font-size: 11px; opacity: .65; }
#credits { position: fixed; inset: 0; z-index: 8200; pointer-events: none; opacity: 0; transition: opacity 1.4s; overflow: hidden;
  background: linear-gradient(rgba(43, 33, 31, .55), rgba(43, 33, 31, .35)); }
#credits.on { opacity: 1; }
#endcard { position: fixed; inset: 0; z-index: 8150; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #2b211f; color: #f7ecd2; font: 14px/1.6 ui-monospace, Menlo, monospace; text-align: center; opacity: 0; transition: opacity 1.6s; }
#endcard.on { opacity: 1; }
#endcard h1 { margin: 0 0 14px; font-size: 30px; letter-spacing: .3em; font-weight: normal; }
#endcard .glyph { font-size: 22px; line-height: .7; margin: 0 0 22px; color: #9fe0d6; }
#endcard p { margin: 0; opacity: .8; font-style: italic; }
/* a phone held upright: the panel across the screen, clear of the subtitles; no keyboard hint on touch */
@media (max-width: 600px) { #homeward { left: 4vw; right: 4vw; width: auto; top: calc(11vh + 8px); bottom: max(calc(11vh + 150px), var(--cine-sub-clear, 0px)); } }
body.touch #homeward footer span { display: none; }
#credits .roll { position: absolute; left: 50%; top: 0; width: min(560px, 86vw); margin-left: calc(min(560px, 86vw) / -2); padding: 48px 40px 70px; box-sizing: border-box;
  background: #f7ecd2; color: #2b211f; border-left: 2px solid #2b211f; border-right: 2px solid #2b211f; box-shadow: 8px 0 0 #2b211f;
  font: 13px/1.5 ui-monospace, Menlo, monospace; text-align: center; will-change: transform;
  background-image: repeating-linear-gradient(transparent 0 27px, rgba(43, 33, 31, .05) 27px 28px); }
#credits h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .26em; }
#credits .glyph { font-size: 20px; line-height: .7; margin: 10px 0 18px; }
#credits .lead { font-style: italic; margin: 0 0 30px; }
#credits section { margin: 0 0 30px; }
#credits h3 { margin: 0; font-size: 16px; letter-spacing: .14em; text-transform: uppercase; }
#credits .story { font-size: 11px; letter-spacing: .1em; color: #8a5a3c; margin-top: 2px; }
#credits ul { list-style: none; padding: 0; margin: 10px 0 0; }
#credits li { margin: 3px 0; }
#credits li i { display: block; font-size: 11px; opacity: .7; }
#credits li.unmet { opacity: .32; }
#credits .home h3 { color: #c8483a; }
#credits .brought { margin: 30px 0 10px; }
#credits .end { margin-top: 40px; letter-spacing: .1em; }
`;

/**
 * The stone's timeline: as callTimeline (src/ship/prologue.js), but the tokens go down
 * briskly (a couple of seconds each), however many there are.
 */
export function tombTimeline(lines) {
  const tl = callTimeline(lines.map((l) => (l.token ? { ...l, cut: false } : l)));
  let t = tl.lines[0]?.t0 ?? 0;
  for (const e of tl.lines) {
    const d = e.line.token ? Math.min(3.2, Math.max(1.8, (e.t1 - e.t0) * 0.6)) : e.t1 - e.t0;
    e.t0 = t; e.t1 = t + d; t += d + (e.line.token ? 0.15 : 0.35);
  }
  tl.total = t;
  return tl;
}

const hasDOM = () => typeof document !== 'undefined' && !!document.body;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The cockpit panel: everything in the hold, all of it going down. */
class CargoPanel {
  constructor({ items, titles, onGo }) {
    Object.assign(this, { items, titles, onGo, open: false });
    if (!hasDOM()) return;
    if (!document.getElementById('homeward-css')) { const s = document.createElement('style'); s.id = 'homeward-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'homeward';
    const list = items.length ? items.map((k) => `<div class="k"><span class="kind ${esc(k.kind)}">${esc(KIND_LABEL[k.kind] ?? k.kind)}</span>
        <b>${esc(k.name)}</b><span class="from">${esc(k.kind === 'item' ? 'a makers’ gift' : titles[k.level] ?? k.level ?? '')}</span><span class="text">${esc(k.text ?? '')}</span></div>`).join('')
      : '<div class="k"><b>Nothing</b><span class="text">The hold is empty. Just you.</span></div>';
    this.el.innerHTML = `<header><h2>CARGO CHECK</h2><p>Before descent. Everything in the hold goes down with you.</p></header>
      <div class="list">${list}</div>
      <footer><button class="go">Take it all down ▶</button><span>A / × or ENTER</span></footer>`;
    document.body.appendChild(this.el);
    this.el.querySelector('.go').addEventListener('click', () => this.go());
    this.onKey = (e) => {
      if (!this.open) return;
      if (e.code === 'Enter' || e.code === 'Space' || (e.code === 'KeyE' && !e.repeat && this.armed)) { this.go(); e.preventDefault(); e.stopPropagation(); }
    };
    this.onUp = (e) => { if (e.code === 'KeyE') this.armed = true; };
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onUp);
  }
  show() {
    this.open = true;
    this.armed = false;
    if (!this.el) return;
    this.el.classList.add('open');
    document.exitPointerLock?.();
  }
  go() {
    if (!this.open) return;
    this.open = false;
    this.el?.classList.remove('open');
    this.onGo();
  }
  /** Gamepad: A to go. */
  pad() {
    if (!this.open || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find(Boolean);
    if (!gp) return;
    const A = gp.buttons[padIndex('ok')]?.pressed;   // printed A (native-pad.js)
    if (A && this._padA === false) this.go();
    this._padA = A;
  }
  remove() {
    if (!this.el) return;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onUp);
    this.el.remove();
  }
}

/** The end card: the title on dark paper, a moment, before the credits. */
class EndCard {
  constructor() {
    if (!hasDOM()) return;
    if (!document.getElementById('homeward-css')) { const s = document.createElement('style'); s.id = 'homeward-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'endcard';
    this.el.innerHTML = '<h1>SOMETHING OF VALUE</h1><div class="glyph">· · ·<br>⌒</div><p>for the two of them, on the hill</p>';
    document.body.appendChild(this.el);
    void this.el.offsetWidth;
    this.el.classList.add('on');
  }
  fade() { this.el?.classList.remove('on'); }
  remove() { this.el?.remove(); }
}

/** The credits: a paper page rolling up the screen. */
class Credits {
  constructor(data) {
    this.t = 0;
    this.done = false;
    if (!hasDOM()) { this.done = true; return; }
    if (!document.getElementById('homeward-css')) { const s = document.createElement('style'); s.id = 'homeward-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'credits';
    this.el.innerHTML = creditsHtml(data);
    document.body.appendChild(this.el);
    this.roll = this.el.querySelector('.roll');
    void this.el.offsetWidth;
    this.el.classList.add('on');
  }
  update(dt) {
    if (!this.el || this.done) return;
    this.t += dt;
    const vh = innerHeight, h = this.roll.offsetHeight;
    const dur = THREE.MathUtils.clamp((h + vh) / 70, 30, 75);       // ~70 px/s, 30-75 s
    const k = Math.min(1, this.t / dur);
    this.roll.style.transform = `translateY(${(vh * 0.92 - k * (h + vh * 0.35)).toFixed(1)}px)`;
    if (k >= 1 && !this.ending) { this.ending = this.t; }
    if (this.ending && this.t - this.ending > 3) this.done = true;
  }
  remove() { this.el?.remove(); }
}

export class HomecomingDirector {
  constructor(ship) {
    this.s = ship;
    this.sp = ship.spaceCopy.model;
    this.pk = ship.parked;
    this.done = false;
    this.skipT = 0;
    this.i = -1;
    this.t = 0;
    this.look = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    const order = ship.order ?? ORDER;
    this.titles = ship.titles ?? {};
    this.storyTitles = Object.fromEntries(order.map((id) => [id, (CONTENT[id]?.story?.title ?? '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())]));
    this.items = tokenList(game.keepsakes() ?? [], ownedItems.owned());
    this.stages = [
      { id: 'approach', dur: 7.5 },
      { id: 'cargo', until: () => !!this.chosen && this.t > (this.chosenAt ?? 0) + 2.6 },
      { id: 'dive', dur: 2.6 },
      { id: 'descend', dur: 6.2 },
      { id: 'hatch', dur: 3.0 },
      { id: 'walk', until: () => !ship.auto },
      { id: 'tomb', until: () => this.t > (this.tl?.total ?? 0) + 1.2 },
      { id: 'card', dur: 6.5 },
      { id: 'credits', until: () => this.credits?.done },
    ];
  }

  get stage() { return this.stages[this.i]?.id; }
  /** The player's input reaches the player only while walking down on the autopilot. */
  interactive() { return this.stage === 'walk' && !!this.s.auto; }
  get skippable() { return true; }

  W(v) { return this.s.world(this.sp, v); }
  ground(x, z) { const h = this.s.heightAt?.(x, z); return Number.isFinite(h) ? h : this.s.groundAt(x, z); }   // the terrain, never the ship's roof
  at(x, y, z) { return V(x, this.ground(x, z) + y, z); }

  start() { this.next(); }

  next() {
    this.i++; this.t = 0;
    if (this.i >= this.stages.length) return this.finish();
    this.enter(this.stage);
  }

  goTo(id) {
    const j = this.stages.findIndex((s) => s.id === id);
    if (j < 0) return;
    this.i = j - 1;
    this.next();
  }

  /** Hold Esc: jump to the next scene that matters. */
  skip() {
    const id = this.stage;
    if (id === 'approach') return this.goTo('cargo');
    if (id === 'cargo') { if (!this.chosen) this.choose(); this.settle(); return this.goTo('tomb'); }
    if (id === 'dive' || id === 'descend' || id === 'hatch' || id === 'walk') { this.settle(); return this.goTo('tomb'); }
    if (id === 'tomb') { this.placeAll(); return this.goTo('card'); }
    if (id === 'card') return this.goTo('credits');
    if (id === 'credits') return this.finish();
  }

  update(dt, skipHeld) {
    if (this.done) return;
    if (!skipHeld) this._released = true;
    this.skipT = skipHeld && this._released !== false && this.skippable ? this.skipT + dt : 0;
    if (this.skipT > SKIP_HOLD) { this.skipT = 0; this._released = false; this.skip(); if (this.done) return; }
    this.t += dt;
    this.frame(this.stage, this.t, dt);
    const st = this.stages[this.i];
    if (this.done || !st) return;
    if (st.until ? st.until() : this.t >= st.dur) this.next();
  }

  // ------------------------------------------------------------------ scenes
  enter(id) {
    const s = this.s, C = s.cinema, sp = this.sp, pk = this.pk;
    switch (id) {
      case 'approach': {
        C.hud(false); C.bars(true); C.fade(1, false, 0);
        setTimeout(() => C.fade(0, false, 1.8), 80);
        s.placePlayer(this.W(sp.interior.points.cockpit), s.worldHeading(sp, Math.PI), true);
        pk.group.visible = false;
        pk.lightsOff = true; s.syncLights(pk);
        s.setDoor(pk, 0); s.setRamp(pk, 0);
        s.setPower('on', sp);
        sp.callScreen?.set({ who: 'map' });
        sfx.hum(s.sound, 1);
        // the planet outside is home: peach hills under a dusk-blue sea
        const planet = s.spaceCopy?.space.userData.planet;
        if (planet) planet.material = makeMaterial({ color: '#eebd8e', color2: '#7f8fc8', color3: '#f2c49a', mode: MODE_STRATA, strataSize: 44, strataObject: true });
        this.tomb?.clear();   // (?ending=1 again: the stone starts bare)
        break;
      }
      case 'cargo':
        C.say({ who: 'ship', text: this.items.length ? 'Cargo check before descent. Everything in the hold is going down with you.' : 'Cargo check before descent. The hold is empty.' });
        this.panel = new CargoPanel({ items: this.items, titles: this.titles, onGo: () => this.choose() });
        this.panel.show();
        sfx.beep(s.sound, true);
        break;
      case 'dive':
        C.say(null);
        sfx.roar(s.sound, 2.8); sfx.hum(s.sound, 0.3);
        setTimeout(() => C.fade(1, true, 0.9), 1300);
        break;
      case 'descend': {
        s.removeSpaceCopy();
        pk.group.visible = true;
        pk.lightsOff = false;
        s.setPower('on', pk);
        s.placePlayer(s.world(pk, pk.interior.points.hatchIn), s.worldHeading(pk, HATCH_A), false);
        s.setDoor(pk, 0); s.setRamp(pk, 0);
        pk.mats.thrust.uniforms.uGlow.value = 1;
        sfx.engines(s.sound, 0.8);
        C.fade(0, true, 1.1);
        this.top = s.restPos.clone().add(V(0, 170, 0));
        pk.group.position.copy(this.top);
        break;
      }
      case 'hatch':
        sfx.hatch(s.sound);
        pk.group.position.copy(s.restPos);
        break;
      case 'walk': {
        s.placePlayer(s.world(pk, polar(9.0, HATCH_A, DECK)), s.site.heading, true);
        const meet = HOME_SPOTS.meet, st = this.standAt();
        s.autopilot([s.hinge.clone().addScaledVector(s.outDir, 0.6), s.rampFoot.clone(), this.at(meet.x, 0, meet.z - 6), this.at(st.x * 0.5, 0, st.z - 2.2), st]);
        break;
      }
      case 'tomb': {
        this.lines = tombLines(this.items, { ilenTold: !!game.flag('calls.ilen.told') });
        this.tl = tombTimeline(this.lines);
        s.auto = null;
        const st = this.standAt();
        if (s.player.pos.distanceTo(st) > 1.2) s.placePlayer(st, this.faceTomb(), true);
        s.player.heading = this.faceTomb();
        s.showPlayer(true);
        this._line = null;
        this.placed = 0;
        this.flying = [];
        this.tomb?.clear();
        sfx.engines(s.sound, 0);
        break;
      }
      case 'card':
        C.say(null);
        this.s.holo?.hide();
        this.card = new EndCard();
        break;
      case 'credits':
        C.say(null);
        this.s.holo?.clear();
        this.card?.fade();
        setTimeout(() => { this.card?.remove(); this.card = null; }, 1800);
        this.credits = new Credits(credits({ order: this.s.order ?? ORDER, titles: this.titles, storyTitles: this.storyTitles, flag: (q) => game.flag(q), keepsake: this.chosen, tokens: this.items }));
        s.sound?.chime?.();
        break;
    }
  }

  /** The stone (src/levels/home.js buildTomb), if this level has it. */
  get tomb() { return this.s.level?.tomb ?? null; }
  /** Where the traveller stands to set things down, and which way he faces. */
  standAt() {
    const t = this.tomb, p = t?.stand ?? HOME_SPOTS.meet;
    return this.at(p.x, 0, p.z);
  }
  faceTomb() { const p = this.standAt(), c = HOME_SPOTS.tomb; return Math.atan2(c.x - p.x, c.z - p.z); }

  /** Everything goes down: keep it (ending.keepsake = 'all'). */
  choose() {
    if (this.chosen) return;
    this.chosen = leaveTokens(game, this.items);
    this.chosenAt = this.t;
    this.panel?.remove();
    this.panel = null;
    sfx.beep(this.s.sound);
    this.s.cinema.say({ who: 'ship', text: this.items.length ? `${this.items.length === 1 ? 'One thing' : `${this.items.length} things`} for the hold door. Beginning descent.` : 'Nothing in the hold. Understood. Beginning descent.' });
  }

  /** Set token i down: from the traveller's hands to its place on the slab. */
  setDown(i) {
    const T = this.tomb, tok = this.items[i];
    if (!T || !tok) return;
    const mesh = T.add(tokenModel(tok), i, this.items.length);
    const to = mesh.position.clone();
    T.group.updateMatrixWorld(true);
    const hands = T.group.worldToLocal(this.standAt().add(V(0, 1.05, 0)).lerp(HOME_SPOTS.tomb.clone().setY(this.ground(HOME_SPOTS.tomb.x, HOME_SPOTS.tomb.z) + 1.05), 0.3));
    mesh.position.copy(hands);
    this.flying.push({ mesh, from: hands, to, t: 0 });
    sfx.beep(this.s.sound);
  }

  /** Skipping the stone: everything already on it. */
  placeAll() {
    this.tomb?.fill(this.items);
    this.flying = [];
    this.placed = this.items.length;
  }

  /** Everything where it would be after the landing (skipping ahead). */
  settle() {
    const s = this.s, pk = this.pk, C = s.cinema;
    s.removeSpaceCopy();
    pk.group.visible = true; pk.lightsOff = false; s.setPower('on', pk);
    pk.group.position.copy(s.restPos); pk.group.quaternion.copy(s.restQuat);
    s.setDoor(pk, 1); s.setRamp(pk, 1);
    pk.mats.thrust.uniforms.uGlow.value = 0;
    sfx.engines(s.sound, 0); sfx.hum(s.sound, 0);
    s.auto = null;
    s.placePlayer(this.standAt(), this.faceTomb(), true);
    C.fade(0, false, 0.3);
    if (!this.chosen) this.choose();
  }

  frame(id, t, dt) {
    const s = this.s, C = s.cinema, sp = this.sp, pk = this.pk;
    const U = s.post?.uniforms;
    if (U && s.spaceCopy && ['approach', 'cargo', 'dive'].includes(id)) U.uFogMul.value = 0;   // no haze in space
    switch (id) {
      case 'approach':
      case 'cargo':
      case 'dive': {
        const k = id === 'approach' ? smooth(t / 7.5) : 1;
        const dive = id === 'dive' ? smooth(t / 2.6) : 0;
        if (s.spaceCopy) s.spaceCopy.space.rotation.x = 0.12 * k + 0.5 * dive;
        const back = id === 'cargo' ? 0.6 : 0;
        s.shot({ pos: this.W(V(-0.5 - back * 0.6, DECK + 1.8, -7.6 + (1 - k) * 1.2 + back)), look: this.W(V(0.4, DECK + 1.3 - dive * 0.5, -14)), fov: 60 - k * 4, roll: dive * 0.06 * Math.sin(t * 3) });
        s.player.heading = s.worldHeading(sp, Math.PI);
        if (id === 'approach') {
          if (t > 1.6 && !this.said) { this.said = true; C.say({ who: 'ship', text: 'Out of the jump. Home is below us.' }); }
          if (t > 5.4 && !this.said2) { this.said2 = true; C.say(null); }
        }
        if (id === 'cargo') {
          this.panel?.pad();
          if (t > 3.6 && !this.chosen && !this.quiet) { this.quiet = true; C.say(null); }   // the panel asks the rest
        }
        if (dive) s.shake(0.4 * dive);
        break;
      }
      case 'descend': {
        const k = 1 - Math.pow(1 - Math.min(1, t / 6.0), 3);
        pk.group.position.copy(this.top).lerp(s.restPos, k);
        const cam = this.at(3.4, 3.0, HOME_SPOTS.door.z - 1.2);   // by the shut door, looking out over the ring
        _aim.copy(pk.group.position).setY(Math.min(pk.group.position.y * 0.5, s.restPos.y * 0.5 + 24));   // the stone stays in the frame
        this.look.lerp(_aim, t < 0.05 ? 1 : 1 - Math.exp(-5 * dt));
        s.shot({ pos: cam, look: this.look, fov: 56 });
        const h = pk.group.position.y - s.restPos.y;
        // the jets out of the bells, a little dust blown off the ring from under them: home is grass, not sand (src/ship/exhaust.js)
        if (!this.thud) exhaust(s, pk, dt, { power: 0.8, palette: GRASS, rate: 18 });
        if (t > 5.8 && !this.thud) { this.thud = true; footPuffs(s, pk, { palette: GRASS, n: 4 }); s.shake(0.6); sfx.rumble(s.sound, 0.8, 0.4); sfx.engines(s.sound, 0); pk.mats.thrust.uniforms.uGlow.value = 0; }
        break;
      }
      case 'hatch': {
        const cam = this.at(-7.5, 1.7, HOME_SPOTS.door.z - 7);
        s.shot({ pos: cam, look: s.hinge.clone().lerp(s.rampFoot, 0.4).add(V(0, 1.2, 0)), fov: 46 });
        s.setDoor(pk, seg(t, 0, 1.1));      // (each eases itself: it unseals and slides up, then the ramp slides out,
        s.setRamp(pk, seg(t, 1.05, 2.95));  // tips down and telescopes to the ground)
        break;
      }
      case 'walk': {
        const cam = this.at(8.5, 2.1, 5.5);
        this.look.lerp(s.player.pos.clone().add(V(0, 1.3, 0)), t < 0.05 ? 1 : 1 - Math.exp(-4 * dt));
        s.shot({ pos: cam, look: this.look, fov: 48 });
        break;
      }
      case 'tomb': {
        const cur = this.tl.lines.find((l) => t >= l.t0 && t < l.t1) ?? null;
        if (cur !== this._line) {
          this._line = cur; C.say(cur ? cur.line : null); this.shotT = 0;
          if (cur?.line.token) this.setDown(this.placed++);
          if (cur?.line.reel) this.reel();
        }
        this.shotT = (this.shotT ?? 0) + dt;
        // the tokens on their way down, in a little arc
        for (const f of this.flying) {
          f.t = Math.min(1, f.t + dt / 0.85);
          const e = smooth(f.t);
          f.mesh.position.lerpVectors(f.from, f.to, e).y += Math.sin(e * Math.PI) * 0.12;
        }
        this.flying = this.flying.filter((f) => f.t < 1);
        const who = cur?.line.who;
        const talking = !!cur && t < cur.t0 + (cur.t1 - cur.t0) * 0.9 && (who === 'father' || who === 'mother');
        s.holo?.speak(talking ? who : null);
        s.player.heading = this.faceTomb();
        const T = this.tomb, L = (x, y, z) => (T ? T.group.localToWorld(V(x, y, z)) : this.at(x, y, z));
        let shot;
        if (cur === this.tl.lines[this.tl.lines.length - 1]) {
          // the closing line: wide, the house, the stone, the traveller small beside it
          const k = smooth(this.shotT / 6);
          shot = { pos: L(5.5 + k * 1.5, 2.6 + k * 1.4, 7 + k * 2), look: L(0, 1.0, -1.5), fov: 46 };
        } else if (this.reeled) {
          // the oldest recording: low, over his shoulder and the slab, the three busts over the reel
          // in front of the stone, looking up at him (their faces: REEL_HOLO over the reel)
          const push = Math.min(this.shotT * 0.03, 0.25);
          shot = { pos: L(0.72, 1.2, 2.55 - push), look: L(-0.12, REEL_AT.y + REEL_HOLO * 0.55, REEL_AT.z - 0.05), fov: 36 };
        } else {
          // setting them down: over his right shoulder, onto the slab
          shot = { pos: L(2.0, 2.2, 3.5), look: L(-0.15, 0.5, 0), fov: 42 };
        }
        s.shot(shot);
        break;
      }
      case 'card': {
        const T = this.tomb, L = (x, y, z) => (T ? T.group.localToWorld(V(x, y, z)) : this.at(x, y, z));
        s.shot({ pos: L(7, 4, 9), look: L(0, 1.0, -1.5), fov: 46 });
        break;
      }
      case 'credits': {
        this.credits?.update(dt);
        const k = smooth(t / 30);
        s.shot({ pos: this.at(-8 + k * 3, 3.6 + k * 6, -2 - k * 8), look: this.at(0, 3 + k * 3, HOME_SPOTS.door.z), fov: 46 });
        break;
      }
    }
  }

  /** The reel set down: the oldest recording rises over the stone, the three of them. */
  reel() {
    this.reeled = true;
    const T = this.tomb;
    if (!T) return;
    T.addReel();
    // the three of them as busts over the reel, turned up to him (he stands over the slab)
    const head = new THREE.Vector3();
    this.s.holo?.show({ parent: T.group, at: REEL_AT.clone().setY(REEL_AT.y + 0.03), scale: REEL_HOLO, who: 'three', lens: 0.085, face: () => this.s.player.humanoid?.b?.Head?.getWorldPosition(head) ?? head.copy(this.s.player.pos).setY(this.s.player.pos.y + 1.55) });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const s = this.s, C = s.cinema;
    if (!this.chosen) this.choose();
    if (this.stage !== 'credits' && !this.credits) this.settle();
    this.placeAll();
    s.holo?.clear();
    this.panel?.remove();
    this.credits?.remove();
    this.card?.remove();
    s.auto = null;
    s.removeSpaceCopy();
    this.pk.group.visible = true;
    this.pk.group.position.copy(s.restPos);
    this.pk.mats.thrust.uniforms.uGlow.value = 0;
    s.setDoor(this.pk, 1); s.setRamp(this.pk, 1);
    sfx.engines(s.sound, 0); sfx.hum(s.sound, 0);
    s.showPlayer(true);
    s.rig.yaw = s.player.heading + Math.PI; s.rig.pitch = 0.2;
    s.rig.target.copy(s.player.pos);
    s.release(1.2);
    C.clear();
    game.set('ending.done', true);
    game.set('ship.launched', true);
    s.journal?.markSeen?.('home');
    game.emit('ending', { keepsake: this.chosen });
    setTimeout(() => C.objective('The ship is ready whenever you are.'), 1200);
    s.onReady?.();
  }
}
