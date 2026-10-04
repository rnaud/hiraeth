import * as THREE from 'three';
import { game } from '../game-state.js';
import { polar } from './geo.js';
import { R, DECK, HATCH_A } from './hull.js';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { callTimeline } from './prologue.js';
import * as sfx from './sfx.js';
import { choiceList, chooseKeepsake, reactionLines, credits, creditsHtml, KIND_LABEL } from '../story/ending.js';
import { HOME_SPOTS } from '../levels/home.js';
import { CONTENT, ORDER } from '../levels/content.js';

// The homecoming (src/story/ending.js): the ship's last scene, played in the
// home level (src/levels/home.js) when you arrive there by ship.
//
//   approach  out of the jump, in orbit over home (the prologue's ship in space)
//   choose    "Cargo check before descent": a panel lists every keepsake, with
//             its words and its kind, and nothing; you choose one (ending.keepsake)
//   dive      into the air, a white flash
//   descend   the ship comes down over the house; the parents look up
//   hatch     it opens
//   walk      you walk down the ramp to the door
//   reaction  the father (by the kind you chose), the mother (always the same),
//             a closing line
//   credits   a paper page of the worlds and the people met
//
// Hold Esc to skip ahead a scene (never past the choice). At the end
// `ending.done` is set and the game goes on: the ship is parked on its ring and
// the map flies anywhere.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
const GRASS = ['#eebd8e', '#e3a97c', '#f2c49a', '#d9a37f'];
const SKIP_HOLD = 0.9;
const _aim = new THREE.Vector3();

const CSS = `
#homeward { position: fixed; right: 4vw; top: calc(11vh + 14px); bottom: calc(11vh + 66px); width: min(470px, 46vw); z-index: 8100; display: none; flex-direction: column;
  background: #f7ecd2; color: #2b211f; border: 2px solid #2b211f; box-shadow: 7px 7px 0 #2b211f; font: 13px/1.4 ui-monospace, Menlo, monospace; }
#homeward.open { display: flex; }
#homeward header { padding: 12px 16px 8px; border-bottom: 2px solid #2b211f; }
#homeward h2 { margin: 0; font-size: 17px; letter-spacing: .14em; }
#homeward header p { margin: 4px 0 0; font-size: 12px; opacity: .75; }
#homeward .list { flex: 1; overflow-y: auto; padding: 8px 10px; }
#homeward button.k { display: block; width: 100%; text-align: left; margin: 0 0 8px; padding: 8px 10px; font: inherit; color: inherit; cursor: pointer;
  background: #fff6dc; border: 1.5px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; }
#homeward button.k.sel { background: #f2c54b; box-shadow: 4px 4px 0 #2b211f; transform: translate(-2px, -2px); }
#homeward button.k:focus { outline: none; }
#homeward .k b { font-size: 14px; }
#homeward .k .kind { float: right; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; padding: 1px 6px; border: 1px solid #2b211f; background: #f7ecd2; }
#homeward .k .kind.thing { background: #e6875f; } #homeward .k .kind.song { background: #a99be0; } #homeward .k .kind.word { background: #9fe0d6; }
#homeward .k .kind.person { background: #f2a7b5; } #homeward .k .kind.knowing { background: #c8d65a; } #homeward .k .kind.nothing { background: #f7ecd2; }
#homeward .k .from { display: block; font-size: 10px; opacity: .6; letter-spacing: .06em; margin-top: 1px; }
#homeward .k .text { display: block; margin-top: 4px; font-size: 12px; }
#homeward footer { padding: 10px 14px; border-top: 2px solid #2b211f; display: flex; gap: 12px; align-items: center; }
#homeward footer button { font: inherit; padding: 6px 14px; background: #f2c54b; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; cursor: pointer; }
#homeward footer span { font-size: 11px; opacity: .65; }
#credits { position: fixed; inset: 0; z-index: 8200; pointer-events: none; opacity: 0; transition: opacity 1.4s; overflow: hidden;
  background: linear-gradient(rgba(43, 33, 31, .55), rgba(43, 33, 31, .35)); }
#credits.on { opacity: 1; }
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

const hasDOM = () => typeof document !== 'undefined' && !!document.body;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The cockpit panel: every keepsake, one to bring home. */
class ChoicePanel {
  constructor({ items, titles, onChoose }) {
    Object.assign(this, { items, titles, onChoose, sel: 0, open: false });
    if (!hasDOM()) return;
    if (!document.getElementById('homeward-css')) { const s = document.createElement('style'); s.id = 'homeward-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'homeward';
    this.el.innerHTML = `<header><h2>WHAT WILL YOU BRING HOME?</h2><p>Cargo check before descent. Choose one; the rest stay aboard.</p></header>
      <div class="list">${items.map((k, i) => `<button class="k" data-i="${i}"><span class="kind ${esc(k.kind)}">${esc(KIND_LABEL[k.kind] ?? k.kind)}</span>
        <b>${esc(k.name)}</b><span class="from">${esc(k.id === 'nothing' ? 'empty hands' : titles[k.level] ?? k.level ?? '')}</span><span class="text">${esc(k.text ?? '')}</span></button>`).join('')}</div>
      <footer><button class="go">Bring this home ▶</button><span>↑ ↓ choose · ENTER bring</span></footer>`;
    document.body.appendChild(this.el);
    for (const b of this.el.querySelectorAll('button.k')) {
      b.addEventListener('click', () => this.select(+b.dataset.i));
      b.addEventListener('dblclick', () => { this.select(+b.dataset.i); this.choose(); });
    }
    this.el.querySelector('.go').addEventListener('click', () => this.choose());
    this.onKey = (e) => {
      if (!this.open) return;
      const n = this.items.length;
      if (['ArrowDown', 'KeyS'].includes(e.code)) { this.select((this.sel + 1) % n); e.preventDefault(); }
      else if (['ArrowUp', 'KeyW'].includes(e.code)) { this.select((this.sel + n - 1) % n); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'Space' || (e.code === 'KeyE' && !e.repeat && this.armed)) { this.choose(); e.preventDefault(); }
      else return;
      e.stopPropagation();
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
    this.select(0);
    document.exitPointerLock?.();
  }
  select(i) {
    this.sel = i;
    if (!this.el) return;
    for (const b of this.el.querySelectorAll('button.k')) b.classList.toggle('sel', +b.dataset.i === i);
    this.el.querySelector(`button.k[data-i="${i}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }
  choose() {
    if (!this.open) return;
    this.open = false;
    this.el?.classList.remove('open');
    this.onChoose(this.items[this.sel]);
  }
  /** Gamepad: up / down, A to bring. */
  pad() {
    if (!this.open || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find(Boolean);
    if (!gp) return;
    const b = (i) => gp.buttons[i]?.pressed;
    const y = (b(13) ? 1 : 0) - (b(12) ? 1 : 0) || Math.round(gp.axes[1] ?? 0);
    const now = performance.now();
    if (y && now - (this._padT ?? 0) > 220) { this._padT = now; this.select((this.sel + y + this.items.length) % this.items.length); }
    if (b(0) && this._padA === false) this.choose();
    this._padA = b(0);
  }
  remove() {
    if (!this.el) return;
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onUp);
    this.el.remove();
  }
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
    this.items = choiceList(game.keepsakes());
    this.stages = [
      { id: 'approach', dur: 7.5 },
      { id: 'choose', until: () => !!this.chosen && this.t > (this.chosenAt ?? 0) + 2.6 },
      { id: 'dive', dur: 2.6 },
      { id: 'descend', dur: 6.2 },
      { id: 'hatch', dur: 3.0 },
      { id: 'walk', until: () => !ship.auto },
      { id: 'reaction', until: () => this.t > (this.tl?.total ?? 0) + 1.2 },
      { id: 'credits', until: () => this.credits?.done },
    ];
  }

  get stage() { return this.stages[this.i]?.id; }
  /** The player's input reaches the player only while walking down on the autopilot. */
  interactive() { return this.stage === 'walk' && !!this.s.auto; }
  get skippable() { return this.stage !== 'choose'; }

  W(v) { return this.s.world(this.sp, v); }
  npc(i) { return (this.s.npcs ?? [])[i] ?? null; }
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

  /** Hold Esc: jump to the next scene that matters (never past the choice). */
  skip() {
    const id = this.stage;
    if (id === 'approach') return this.goTo('choose');
    if (id === 'choose') return;
    if (id === 'dive' || id === 'descend' || id === 'hatch' || id === 'walk') { this.settle(); return this.goTo('reaction'); }
    if (id === 'reaction') return this.goTo('credits');
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
        if (planet) planet.material = makeMaterial({ color: '#eebd8e', color2: '#7f8fc8', color3: '#f2c49a', mode: MODE_STRATA, strataSize: 44 });
        for (const n of [this.npc(0), this.npc(1)]) if (n) n.talkTo = { speaking: false };   // waiting at the door, turned to the sky
        break;
      }
      case 'choose':
        C.say({ who: 'ship', text: 'Cargo check before descent. What are we bringing home?' });
        this.panel = new ChoicePanel({ items: this.items, titles: this.titles, onChoose: (k) => this.choose(k) });
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
        const meet = HOME_SPOTS.meet;
        s.autopilot([s.hinge.clone().addScaledVector(s.outDir, 0.6), s.rampFoot.clone(), this.at(meet.x, 0, meet.z - 4), this.at(meet.x, 0, meet.z)]);
        break;
      }
      case 'reaction': {
        const k = this.chosen ?? this.items[this.items.length - 1];
        this.lines = reactionLines(k, { ilen: !!(game.flag('clue.bazaar.home') || game.flag('world.bazaar.done')), ilenTold: !!game.flag('calls.ilen.told') });
        this.tl = callTimeline(this.lines);
        s.auto = null;
        const m = HOME_SPOTS.meet;
        if (s.player.pos.distanceTo(this.at(m.x, 0, m.z)) > 2.5) s.placePlayer(this.at(m.x, 0, m.z), 0, true);
        s.player.heading = 0;
        s.showPlayer(true);
        this._line = null;
        sfx.engines(s.sound, 0);
        break;
      }
      case 'credits':
        C.say(null);
        for (const n of [this.npc(0), this.npc(1)]) if (n) n.talkTo = null;
        this.credits = new Credits(credits({ order: this.s.order ?? ORDER, titles: this.titles, storyTitles: this.storyTitles, flag: (q) => game.flag(q), keepsake: this.chosen }));
        s.sound?.chime?.();
        break;
    }
  }

  choose(k) {
    this.chosen = chooseKeepsake(game, k);
    this.chosenAt = this.t;
    this.panel?.remove();
    this.panel = null;
    sfx.beep(this.s.sound);
    this.s.cinema.say({ who: 'ship', text: k.id === 'nothing' ? 'Nothing in the hold. Understood. Beginning descent.' : `${k.name}: stowed by the hatch. Beginning descent.` });
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
    const m = HOME_SPOTS.meet;
    s.placePlayer(this.at(m.x, 0, m.z), 0, true);
    C.fade(0, false, 0.3);
    if (!this.chosen) this.choose(this.items[this.items.length - 1]);
  }

  frame(id, t, dt) {
    const s = this.s, C = s.cinema, sp = this.sp, pk = this.pk;
    const U = s.post?.uniforms;
    if (U && s.spaceCopy && ['approach', 'choose', 'dive'].includes(id)) U.uFogMul.value = 0;   // no haze in space
    switch (id) {
      case 'approach':
      case 'choose':
      case 'dive': {
        const k = id === 'approach' ? smooth(t / 7.5) : 1;
        const dive = id === 'dive' ? smooth(t / 2.6) : 0;
        if (s.spaceCopy) s.spaceCopy.space.rotation.x = 0.12 * k + 0.5 * dive;
        const back = id === 'choose' ? 0.6 : 0;
        s.shot({ pos: this.W(V(-0.5 - back * 0.6, DECK + 1.8, -7.6 + (1 - k) * 1.2 + back)), look: this.W(V(0.4, DECK + 1.3 - dive * 0.5, -14)), fov: 60 - k * 4, roll: dive * 0.06 * Math.sin(t * 3) });
        s.player.heading = s.worldHeading(sp, Math.PI);
        if (id === 'approach') {
          if (t > 1.6 && !this.said) { this.said = true; C.say({ who: 'ship', text: 'Out of the jump. Home is below us.' }); }
          if (t > 5.4 && !this.said2) { this.said2 = true; C.say(null); }
        }
        if (id === 'choose') {
          this.panel?.pad();
          if (t > 3.6 && !this.chosen && !this.quiet) { this.quiet = true; C.say(null); }   // the panel asks the rest
        }
        if (dive) s.shake(0.4 * dive);
        break;
      }
      case 'descend': {
        const k = 1 - Math.pow(1 - Math.min(1, t / 6.0), 3);
        pk.group.position.copy(this.top).lerp(s.restPos, k);
        const cam = this.at(3.4, 3.0, HOME_SPOTS.door.z - 1.2);   // behind the parents at the door, looking out over the ring
        _aim.copy(pk.group.position).setY(Math.min(pk.group.position.y * 0.5, s.restPos.y * 0.5 + 24));   // the parents' heads stay in the frame
        this.look.lerp(_aim, t < 0.05 ? 1 : 1 - Math.exp(-5 * dt));
        s.shot({ pos: cam, look: this.look, fov: 56 });
        const h = pk.group.position.y - s.restPos.y;
        if (h < 26 && Math.random() < 0.45) {   // a little dust off the ring: home is grass, not sand
          const a = Math.random() * Math.PI * 2, r = R * (0.6 + Math.random() * 0.6);
          const at = s.restPos.clone().add(V(Math.sin(a) * r, 0, Math.cos(a) * r));
          at.y = s.groundAt(at.x, at.z) + 0.8;
          s.dust.emit(at, V(Math.sin(a) * 11, 2 + Math.random() * 3, Math.cos(a) * 11), 0.8 + Math.random(), 2.0, new THREE.Color(GRASS[Math.floor(Math.random() * GRASS.length)]));
        }
        if (t > 5.8 && !this.thud) { this.thud = true; s.shake(0.6); sfx.rumble(s.sound, 0.8, 0.4); sfx.engines(s.sound, 0); pk.mats.thrust.uniforms.uGlow.value = 0; }
        break;
      }
      case 'hatch': {
        const cam = this.at(-7.5, 1.7, HOME_SPOTS.door.z - 7);
        s.shot({ pos: cam, look: s.hinge.clone().lerp(s.rampFoot, 0.4).add(V(0, 1.2, 0)), fov: 46 });
        s.setDoor(pk, smooth(seg(t, 0, 1)));
        s.setRamp(pk, smooth(seg(t, 0.8, 2.8)));
        break;
      }
      case 'walk': {
        const cam = this.at(8.5, 2.1, 5.5);
        this.look.lerp(s.player.pos.clone().add(V(0, 1.3, 0)), t < 0.05 ? 1 : 1 - Math.exp(-4 * dt));
        s.shot({ pos: cam, look: this.look, fov: 48 });
        break;
      }
      case 'reaction': {
        const cur = this.tl.lines.find((l) => t >= l.t0 && t < l.t1) ?? null;
        if (cur !== this._line) { this._line = cur; C.say(cur ? cur.line : null); this.shotT = 0; }
        this.shotT = (this.shotT ?? 0) + dt;
        const who = cur?.line.who ?? 'scene';
        const talk = cur && t < cur.t0 + (cur.t1 - cur.t0) * 0.9;
        const F = this.npc(0), M = this.npc(1);
        if (F) F.talkTo = { speaking: talk && who === 'father' };
        if (M) M.talkTo = { speaking: talk && who === 'mother' };
        s.player.heading = 0;
        const p = s.player.pos, [fx, fz] = HOME_SPOTS.father, [mx, mz] = HOME_SPOTS.mother;
        const fHead = F ? F.object.position.clone().add(V(0, 1.6, 0)) : this.at(fx, 1.6, fz);
        const mHead = M ? M.object.position.clone().add(V(0, 1.55, 0)) : this.at(mx, 1.55, mz);
        const push = Math.min(this.shotT * 0.05, 0.4);
        let shot;
        if (cur === this.tl.lines[this.tl.lines.length - 1]) {
          // the closing line: wide, the house, the lamp, the three of them small in front of it
          const k = smooth(this.shotT / 6);
          shot = { pos: this.at(-7 + k * 1.5, 3.4 + k * 1.2, p.z - 9 - k * 2), look: this.at(0, 2.6, HOME_SPOTS.door.z - 2), fov: 44 };
        } else if (who === 'father' || who === 'mother') {
          // over the traveller's shoulder, from the speaker's side so the traveller is only an edge of the frame
          const head = who === 'father' ? fHead : mHead, side = Math.sign(head.x - p.x) || 1;
          shot = { pos: p.clone().add(V(side * 2.1, 1.9, -2.3 + push)), look: head, fov: 36 };
        } else shot = { pos: this.at(6.5 - push * 2, 2.2, p.z - 3.5), look: fHead.clone().lerp(mHead, 0.5).lerp(p.clone().add(V(0, 1.4, 0)), 0.45), fov: 44 };
        s.shot(shot);
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

  finish() {
    if (this.done) return;
    this.done = true;
    const s = this.s, C = s.cinema;
    if (!this.chosen) this.choose(this.items[this.items.length - 1]);
    if (this.stage !== 'credits' && !this.credits) this.settle();
    this.panel?.remove();
    this.credits?.remove();
    for (const n of [this.npc(0), this.npc(1)]) if (n) n.talkTo = null;
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
