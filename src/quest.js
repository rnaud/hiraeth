import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { slotStorage } from './save-slots.js';
import { GameMenu } from './game-menu.js';
import { inputKind } from './prompt-keys.js';

// Story, collectibles and the sketchbook journal (worlds are reached by the ship: src/ship/).
//  - Story: one quiet goal per level, marked by a beacon. A first visit and
//    arriving say the world's words as a toast (the closing moment is drawn
//    into the sketchbook).
//  - Relics: five per level, often on top of things you have to climb.
//    Picking one up sketches the moment into your journal.
//  - Journal: every relic and story page found, the errands and the observatory,
//    kept in localStorage (per save slot: src/save-slots.js); J, View / Select
//    open it as the game menu (src/game-menu.js: Items, Quests, Sketchbook, Worlds).
//  - A story with `manual: true` (the desert's) has no beacon and doesn't
//    finish on arrival: its quest calls story.complete() (src/story/).

const STORE = 'moebius.journal.v1';

export class Journal {
  constructor(levels) {
    this.levels = levels;
    try { this.data = JSON.parse(slotStorage.getItem(STORE)) ?? {}; } catch { this.data = {}; }
    this.data.relics ??= {};
    this.data.stories ??= {};
    this.data.seen ??= {};
    this.el = document.getElementById('journal');
    // the game menu draws itself into #journal; main.js gives it its sources (src/game-menu-data.js)
    this.menu = new GameMenu(this.el, { onClose: () => this.toggle(false) });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') this.toggle();
      else if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); this.toggle(false); }   // (not also opening the Start menu)
      else if (this.open && !e.repeat && this.menu.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
      else if (this.open && e.repeat && /^(Arrow|Key[WASD]$)/.test(e.code)) { e.preventDefault(); this.menu.key(e); }
    });
  }

  save() {
    try { slotStorage.setItem(STORE, JSON.stringify(this.data)); } catch (e) { console.warn('journal not saved', e); }
  }

  hasRelic(level, i) { return !!this.data.relics[level]?.[i]; }
  addRelic(level, i, entry) { (this.data.relics[level] ??= {})[i] = entry; this.save(); }
  relicCount(level) { return Object.keys(this.data.relics[level] ?? {}).length; }
  storyDone(level) { return !!this.data.stories[level]; }
  addStory(level, entry) { this.data.stories[level] = entry; this.save(); }
  errand(id) { return this.data.errands?.[id]; }
  setErrand(id, v) { (this.data.errands ??= {})[id] = v; this.save(); }
  seen(level) { return !!this.data.seen[level]; }
  markSeen(level) { this.data.seen[level] = 1; this.save(); }

  /**
   * Open (on a panel: 'items', 'quests', 'sketches', 'worlds'; else where it was left) or close the
   * game menu (src/game-menu.js), which since October 2026 shows what the sketchbook did.
   */
  toggle(on = !this.open, panel = null) {
    this.open = on;
    if (on) { this.menu.open(panel); document.exitPointerLock?.(); }
    else this.menu.close();
    this.el.classList.toggle('open', on);
  }

  /** Draw the open panel again (something in it changed). */
  render() { if (this.open) this.menu.render(); }
}

// ---------------------------------------------------------------------------

/** How long a toast stays up: 4.5 s, longer for a long line (a world's opening words), at most 9 s. */
export const toastSeconds = (text) => Math.min(9, Math.max(4.5, String(text ?? '').length / 16));

function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.style.animationDuration = `${toastSeconds(text)}s`;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

export class Relics {
  /**
   * @param spots [x, z] | { at: [x, y, z], snap? } (see levels/content.js)
   * @param names one name per spot
   */
  constructor(scene, physics, { levelId, spots, names, journal, sound, capture, lights }) {
    this.items = [];
    this.levelId = levelId;
    this.journal = journal;
    this.sound = sound;
    this.capture = capture;
    this.lights = lights;
    this.names = names;
    const shardMat = makeMaterial({ color: '#f2c54b', flat: true, glow: 0.9 });
    const ringMat = makeMaterial({ color: '#fff6dc', glow: 1 });
    spots.forEach((s, i) => {
      if (journal.hasRelic(levelId, i)) return;
      let pos;
      if (Array.isArray(s)) {
        const y = physics.groundAt(s[0], 1e4, s[1], 2e4);
        pos = new THREE.Vector3(s[0], (Number.isFinite(y) ? y : 0) + 1.1, s[1]);
      } else {
        pos = new THREE.Vector3(...s.at);
        if (s.snap) {
          const y = physics.groundAt(pos.x, pos.y + 3, pos.z, 6);
          if (Number.isFinite(y)) pos.y = y + 1.1;
        }
      }
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0).scale(0.8, 1.4, 0.8), shardMat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24), ringMat);
      grp.add(ring);
      grp.position.copy(pos);
      grp.userData.noCollide = true;
      scene.add(grp);
      const light = new THREE.Vector4(pos.x, pos.y, pos.z, 7);
      lights.push(light);
      this.items.push({ i, grp, ring, pos, light, base: pos.y });
    });
    this.total = spots.length;
  }

  update(dt, t, player) {
    for (const it of this.items) {
      if (it.done) continue;
      it.grp.position.y = it.base + Math.sin(t * 1.6 + it.i) * 0.18;
      it.grp.rotation.y += dt * 0.9;
      it.ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + it.i) * 0.5;
      if (player.pos.distanceTo(it.grp.position) < 2.3) this.collect(it, player);
    }
  }

  collect(it, player) {
    it.done = true;
    const name = this.names[it.i];
    // sketch the moment: a camera a few metres off, looking at the find
    const eye = it.grp.position.clone().add(new THREE.Vector3(3.2, 1.6, 3.2).applyAxisAngle(player.frame.up, player.heading + Math.PI * 0.75));
    const img = this.capture(eye, it.grp.position, 240, 170);
    it.grp.removeFromParent();
    const k = this.lights.indexOf(it.light);
    if (k >= 0) this.lights.splice(k, 1);
    this.journal.addRelic(this.levelId, it.i, { name, img, t: Date.now() });
    this.sound.chime();
    this.sound.pickup?.({ pos: it.grp.position });
    this.sound.musicCue?.('moment', { delay: 1.5 });   // (a find: the recorded theme comes back, src/music-moments.js)
    toast(`Found: ${name} · ${this.journal.relicCount(this.levelId)}/${this.total}`);
  }
}

// ---------------------------------------------------------------------------

export class Story {
  /**
   * @param def { title, intro, outro, goal: [x, y, z], radius, label }
   */
  constructor(scene, { levelId, def, journal, sound, capture, player, physics, ground, say = toast }) {
    this.def = def;
    this.say = say;   // a toast (main.js: the queued one, src/ship/cinema.js)
    this.levelId = levelId;
    this.journal = journal;
    this.sound = sound;
    this.capture = capture;
    this.physics = physics;
    const [gx, gy, gz] = def.goal;
    const y = gy === 'top' ? physics.groundAt(gx, 1e4, gz, 2e4)
      : gy === 'ground' ? (ground?.heightAt ? ground.heightAt(gx, gz) : physics.groundAt(gx, 1e4, gz, 2e4)) : gy;
    this.goal = new THREE.Vector3(gx, (Number.isFinite(y) ? y : 0) - (def.drop ?? 0), gz);
    this.done = journal.storyDone(levelId);
    this.pageOpen = false;   // (the comic pages are gone: nothing holds the screen any more)
    this.pending = null;     // words waiting for a conversation to end (showPage)
    // beacon: a tall thin column of light over the goal
    // from the ground below the goal to well above it, so it reads from far
    // below a high goal (Vael's tower) as well as across a plain
    const baseY = Math.min(this.goal.y, (physics.groundAt(gx, this.goal.y - 1, gz, 2e4) || this.goal.y));
    const top = this.goal.y + 260;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, top - baseY, 8, 1, true).translate(0, (top - baseY) / 2, 0),
      makeMaterial({ color: '#f2c54b', glow: 1, side: THREE.DoubleSide }));
    beam.position.set(gx, baseY, gz);
    beam.userData.noCollide = true;
    this.beam = beam;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 32), makeMaterial({ color: '#f2c54b', glow: 1 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.copy(this.goal).add(new THREE.Vector3(0, 0.4, 0));
    this.beacon = new THREE.Group();
    this.beacon.add(beam, halo);
    this._cam = null;
    this.beacon.userData.noCollide = true;
    this.beacon.visible = !this.done && !def.manual;
    scene.add(this.beacon);
    this.halo = halo;
    this.player = player;
    this.firstVisit = !journal.seen(levelId);
  }

  /** Called once the world is ready: the intro page on a first visit. */
  start() {
    if (this.firstVisit) {
      this.journal.markSeen(this.levelId);
      setTimeout(() => this.showPage('intro'), 600);
    }
  }

  update(dt, t, camera) {
    this.halo.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    // keep the beam at least ~4 px wide however far away you are
    if (camera) {
      const d = Math.hypot(camera.position.x - this.goal.x, camera.position.z - this.goal.z);
      const k = Math.max(1, d * 0.0038);
      this.beam.scale.set(k, 1, k);
    }
    // words held back by a conversation come once it has ended
    if (this.pending && !this.waitFor?.()) this.openPage(this.pending);
    if (this.done || this.def.manual) return;
    const r = this.def.radius ?? 12, p = this.player.pos;
    if (Math.hypot(p.x - this.goal.x, p.z - this.goal.z) < r && Math.abs(p.y - this.goal.y) < (this.def.verticalRadius ?? Math.max(r, 20))) {
      this.done = true;
      this.showPage('outro');
    }
  }

  /** Finish a manual story (its quest is done): the closing page. */
  complete() {
    if (this.done) return false;
    this.done = true;
    this.showPage('outro');
    return true;
  }

  hud() {
    if (this.done || this.def.manual) return null;
    const d = this.player.pos.distanceTo(this.goal);
    return `◆ ${this.def.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`;
  }

  /** Three panels rendered live: wide, close, and the goal. */
  shots(which) {
    const p = this.player.pos.clone(), g = this.goal.clone();
    const up = this.player.frame.up;
    const toG = g.clone().sub(p).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(toG, up).normalize();
    const face = p.clone().addScaledVector(up, 2.0);
    if (which === 'intro') return [
      { eye: p.clone().addScaledVector(toG, -22).addScaledVector(up, 14).addScaledVector(side, 8), look: g.clone().lerp(p, 0.6).addScaledVector(up, 4) },
      { eye: face.clone().addScaledVector(toG, 2.6).addScaledVector(side, 0.9).addScaledVector(up, -0.15), look: face },
      { eye: g.clone().addScaledVector(toG, -95).addScaledVector(up, 24).addScaledVector(side, 30), look: g.clone().addScaledVector(up, 10) },
    ];
    return [
      { eye: p.clone().addScaledVector(side, 3.5).addScaledVector(up, 0.6).addScaledVector(toG, 1.5), look: face },
      { eye: g.clone().addScaledVector(toG, -10).addScaledVector(up, 4).addScaledVector(side, -4), look: g.clone().addScaledVector(up, 3) },
      { eye: p.clone().addScaledVector(toG, -50).addScaledVector(up, 35).addScaledVector(side, 20), look: p },
    ];
  }

  /** Keep a panel's camera on the open side of anything solid between it and what it looks at (the ship's hull, a wall). */
  clear(shot) {
    const from = shot.look, to = shot.eye.clone().sub(from), d = to.length();
    const hit = d > 1 ? this.physics?.rayDistance?.(from, to.multiplyScalar(1 / d), d) : Infinity;
    if (!(hit < d)) return shot;
    return { ...shot, eye: from.clone().addScaledVector(to, Math.max(1.5, hit - 1.2)) };
  }

  /**
   * A world's opening or closing words, as a toast (until October 2026 a three-panel comic page that
   * held the screen). Never over a conversation: while `waitFor()` holds (main.js: someone is talking
   * to you) they wait, and come once the talk ends; a world's closing words come a moment after its
   * last line, often while that talk is still open. The closing moment is drawn into the sketchbook.
   */
  showPage(which) {
    const d = this.def;
    const text = which === 'intro' ? [d.title, d.intro].filter(Boolean).join(' · ') : d.outro;
    if (which === 'outro') {
      // kept in the sketchbook at once, even if the words are still waiting
      this.beacon.visible = false;
      const s = this.clear(this.shots('outro')[0]);
      this.journal.addStory(this.levelId, { img: this.capture(s.eye, s.look, 900, 380), t: Date.now() });
    }
    if (this.waitFor?.()) { this.pending = { which, text }; return; }
    this.openPage({ which, text });
  }

  openPage({ which, text }) {
    this.pending = null;
    if (text) this.say(text);
    if (which !== 'outro') return;
    this.sound.chime();
    this.sound.musicCue?.('moment', { delay: 1 });   // (a world's story done)
    // finishing a world names the next one on the ship's map (def.next: main.js, src/story/route.js)
    const next = this.done && (typeof this.def.next === 'function' ? this.def.next() : this.def.next);
    if (next) this.say(next);
  }

  closePage() {}
}

// ---------------------------------------------------------------------------

/**
 * Errands between worlds (levels/content.js ERRANDS). Watches this world's
 * villagers: greeting a giver hands you the parcel, greeting the receiver
 * while carrying it delivers it (with a sketch of them for the journal).
 */
/** What opens the game menu, for the errand's toast: View on a pad, the book on a touch screen, J on the keys. */
export const errandMenuKey = (kind = inputKind()) => (kind === 'pad' ? 'View' : kind === 'touch' ? 'The book' : 'J');

export class Errands {
  constructor({ levelId, defs, npcs, journal, titles, capture, sound }) {
    Object.assign(this, { levelId, defs, npcs, journal, titles, capture, sound });
    this.watch = [];
    for (const d of defs) {
      if (d.from[0] === levelId && npcs[d.from[1]]) this.watch.push({ d, npc: npcs[d.from[1]], role: 'give' });
      if (d.to[0] === levelId && npcs[d.to[1]]) this.watch.push({ d, npc: npcs[d.to[1]], role: 'take' });
    }
    for (const w of this.watch) w.base = w.npc.lines;
  }

  update() {
    for (const w of this.watch) {
      const { d, npc } = w, st = this.journal.errand(d.id);
      if (!npc.greeted) { w.handled = false; continue; }
      if (w.handled) continue;
      w.handled = true;
      const say = (line) => { npc.lines = [line]; npc.lineIdx = 0; };
      if (w.role === 'give') {
        if (!st) {
          say(d.ask);
          this.journal.setErrand(d.id, { item: d.item, to: d.to[0], toTitle: this.titles[d.to[0]] ?? d.to[0], done: false });
          toast(`Errand: carry ${d.item} to ${this.titles[d.to[0]] ?? d.to[0]}`);
          this.sound?.chime?.();
        } else if (!st.done) say(d.wait);
        else npc.lines = w.base;
      } else if (st && !st.done) {
        say(d.thanks);
        const P = npc.pos, h = npc.heading;
        let img = '';
        try {
          img = this.capture(new THREE.Vector3(P.x + Math.sin(h) * 3, P.y + 1.8, P.z + Math.cos(h) * 3), P.clone().add(new THREE.Vector3(0, 1.4, 0)), 240, 180);
        } catch { /* no sketch */ }
        this.journal.setErrand(d.id, { ...st, done: true, img });
        toast(`Delivered ${d.item} · ${errandMenuKey()} to see it in the Sketchbook`);
        this.sound?.chime?.();
      } else npc.lines = w.base;
    }
  }

  /** The parcels you're carrying, for the HUD. */
  hud() {
    const out = [];
    // (where it goes now: a parcel picked up before the errands followed the route names its new world)
    for (const [id, e] of Object.entries(this.journal.data.errands ?? {})) if (!e.done) {
      const to = this.defs.find((d) => d.id === id)?.to[0];
      out.push(`carrying ${e.item.replace(/^an? /, '')} → ${(to && this.titles[to]) ?? e.toTitle}`);
    }
    return out.slice(0, 1).join('');
  }
}
