import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { ARCHETYPES, spawnKindOf } from '../enemies/archetypes.js';
import { FOES } from '../foes.js';
import { rosterOf } from '../foe-worlds.js';
import { hintsFor } from '../hint-level.js';
import { SITE, SITE_PURSE, sitesOf, layoutSite, siteFlag, cofferFlag } from './sites.js';
import { makeIdle, restPose, CALLS } from './idle.js';
import { buildProp, sleepMarks, SAND_TONES } from './props.js';

// The encounter sites at work (issue #722; docs/systems/foes.md, "Encounter sites"; the sites themselves are
// src/encounters/sites.js). One Encounters a world, made with the foes (src/host/game-host.js wireFight, the page's and
// the engines'):
//
//   - its things (the fire, the logs, the nest, the coffer, the sign) are made as you come within SITE.build m;
//   - its foes come out where they live as you come within SITE.near m (src/foes.js Foes.add, calm, in the world's skin),
//     each with its idle (src/encounters/idle.js): sitting, asleep, on guard, on the lookout, walking its beat; an
//     ambush's only as you step in to take its coffer, up round you out of the sand or the shadow;
//   - one of them noticing you wakes the rest, a moment apart (a lookout's, a guard's or a patrol's call at once);
//   - every one cut down: the site is cleared for good (its flag), and its coffer's lamp lights; opened (E), a purse of
//     chimes spills out (the game event 'site:cache': src/chimes.js connectDrops, once a save);
//   - left behind (SITE.drop m) before it is cleared, the foes still standing go with the packs (Foes.update) and come
//     back as you return; the ones cut down stay down for the visit;
//   - no wandering pack comes in round an uncleared site (Foes.packQuiet, SITE.quiet m).
// With the Enemies setting off (or before the sword is his) no foe comes out; the coffer opens at once.

const _v = new THREE.Vector3(), _top = new THREE.Vector3();
/** What a site's layout asks of its foes' bodies (src/encounters/sites.js layoutSite): does it fly, how wide is it. */
export const BODIES = { hovers: (a) => !!FOES[spawnKindOf(a)]?.hover, radius: (a) => FOES[spawnKindOf(a)]?.radius ?? 0.6 };

export class Encounters {
  constructor({ foes, scene = null, level = null, levelId, physics = null, player, game, sound = null, tool = null, toast = () => {}, teach = toast, rng = Math.random }) {
    Object.assign(this, { foes, scene, level, levelId, physics, player, game, sound, tool, toast, teach, rng });
    this.group = new THREE.Group(); this.group.name = 'Encounter sites'; this.group.userData.noCollide = true;
    scene?.add(this.group);
    const stage = rosterOf(levelId).stage ?? 1;
    this.sites = sitesOf(levelId).map((s, n) => ({
      ...s, n, pos: new THREE.Vector3(...s.at), lay: layoutSite(s, BODIES), out: [], killed: new Set(), props: null, coffer: null,
      sprung: false, purse: SITE_PURSE[Math.max(0, Math.min(SITE_PURSE.length - 1, stage))],
    }));
    this.marks = [];
    // (no wandering pack round a site still to clear: its foes are the life there)
    if (foes) foes.encounters = this;   // (the console's and the review scripts' way in: window.foes.encounters)
    if (foes) foes.packQuiet = (p) => this.sites.some((s) => !this.cleared(s) && Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < SITE.quiet);
  }

  cleared(s) { return !!this.game?.flag?.(siteFlag(this.levelId, s.id)); }
  opened(s) { return !!this.game?.flag?.(cofferFlag(this.levelId, s.id)); }
  /** The foes are about (the Enemies setting on, the blade his, this world not at peace). */
  live() { const F = this.foes; return !!F && F.on && !F.peaceful && F.armed(); }

  ground(x, y, z, up = 3, down = 6) {
    const g = this.physics?.groundAt?.(x, y + up, z, up + down);
    return Number.isFinite(g) ? g : this.level?.ground?.heightAt?.(x, z) ?? y;
  }

  /** The site's things, made as you come near. */
  build(s) {
    const y = this.ground(s.pos.x, s.pos.y, s.pos.z);
    s.pos.y = y;
    const G = (x, z) => this.ground(x, y, z);
    const at = (p) => new THREE.Vector3(p[0], G(p[0], p[1]), p[1]);
    s.props = s.lay.props.filter((p) => p.type !== 'bramble').map((p, i) => {
      const P = buildProp(p.type, { at: at(p.at), heading: p.heading, ground: G, r: p.r, seed: s.n * 31 + i + 1, tone: SAND_TONES[this.levelId] });
      this.group.add(P.group);
      return P;
    });
    s.sign = s.props.find((p) => p.signType);
    const C = buildProp('coffer', { at: at(s.lay.coffer.at), heading: s.lay.coffer.heading, ground: G, seed: s.n + 1 });
    this.group.add(C.group);
    s.coffer = C;
    C.open(this.opened(s) ? 1 : 0);
    const cAt = C.group.position.clone();
    s.offCoffer = registerInteractable({
      id: `site.${this.levelId}.${s.id}`, priority: PRIORITY.use, range: 2.6, prompt: 'open the coffer', at: () => _top.copy(cAt).setY(cAt.y + 1.1),
      enabled: () => !this.opened(s) && (this.cleared(s) || !this.live()),
      distance: (p) => Math.hypot(p.pos.x - cAt.x, p.pos.z - cAt.z) + Math.max(0, Math.abs(p.pos.y - cAt.y) - 1.5) * 4,
      use: () => this.openCoffer(s),
    });
  }

  openCoffer(s) {
    if (this.opened(s)) return false;
    const at = s.coffer.group.position.clone().setY(s.coffer.group.position.y + 0.9);
    this.sound?.critter?.('creak', 0.8); this.sound?.chime?.();
    this.game?.emit?.('site:cache', { world: this.levelId, id: s.id, pos: at, amount: s.purse });
    if (!this.game?.flag?.(cofferFlag(this.levelId, s.id))) this.game?.set?.(cofferFlag(this.levelId, s.id), true);   // (the drops' listener sets it; a host with none still keeps it shut)
    s.opening = 0.001;
    return true;
  }

  /** Its foes out where they live (those not cut down this visit; an ambush's provoked, out of the ground round you). */
  spawn(s, { sprung = false } = {}) {
    const F = this.foes;
    s.lay.foes.forEach((L, i) => {
      if (s.killed.has(i) || s.out[i]) return;
      const kind = spawnKindOf(L.archetype);
      if (!kind || !FOES[kind]) return;
      const at = new THREE.Vector3(L.at[0], 0, L.at[1]);
      at.y = this.ground(at.x, s.pos.y, at.z, 4, 8);
      if (F.roomAt && !F.roomAt(kind, at)) { const o = F.openSpot(kind, at, 0, 0.01, 4, 8); at.copy(o); }
      const f = F.add(kind, at, sprung ? { entrance: !FOES[kind].burrow, id: `site.${this.levelId}.${s.id}.${i}` } : { calm: true, id: `site.${this.levelId}.${s.id}.${i}` });
      f.site = s; f.siteIndex = i; f.heading = L.heading; f.home.copy(f.pos);
      if (!sprung) f.idle = makeIdle(L.idle, { face: L.face, path: L.path, heading: L.heading, rng: this.rng });
      else { f.provoked = true; f.state = 'chase'; }
      s.out[i] = f;
    });
  }

  /** Woken by its site's call: into the fight through its alert beat (Foe.noticed, src/enemies/fight.js ALERT: it rears and calls). */
  wake(f) {
    f.provoked = true;
    if (f.state !== 'idle') return;
    const ev = [];
    f.noticed(ev, this.foes.env);
    if (ev.some((e) => e?.type === 'gesture')) this.foes.gesture?.(f, 'alert');
  }

  /** One noticed you: the rest of the site wake, a moment apart (a lookout's, a guard's or a patrol's call: at once). */
  alarm(s, by) {
    const calls = CALLS.has(by.idle?.mode);
    for (const f of s.out) {
      if (!f || f === by || f.provoked || !f.alive) continue;
      f.wakeIn ??= calls ? 0.15 + this.rng() * 0.2 : SITE.wake[0] + this.rng() * (SITE.wake[1] - SITE.wake[0]) * (f.idle?.mode === 'sleep' ? 1.6 : 1);
    }
  }

  update(dt, t = 0, { quiet = false } = {}) {
    const P = this.player;
    if (!P?.pos) return;
    const live = this.live();
    if (quiet) { for (const s of this.sites) if (!s.props && Math.hypot(P.pos.x - s.pos.x, P.pos.z - s.pos.z) < SITE.build) this.build(s); return; }
    for (const s of this.sites) {
      const d = Math.hypot(P.pos.x - s.pos.x, P.pos.z - s.pos.z);
      if (d < SITE.build && !s.props) this.build(s);
      if (s.props) {
        const near = d < SITE.build * 0.75;
        for (const p of s.props) p.update(dt, t, near);
        s.coffer.awake = Math.min(1, Math.max(0, s.coffer.awake + ((this.cleared(s) || !live) && !this.opened(s) ? dt : -dt)));
        if (s.opening) { s.opening = Math.min(1, s.opening + dt / 0.8); s.coffer.open(s.opening * s.opening * (3 - 2 * s.opening)); if (s.opening >= 1) s.opening = 0; }
        s.coffer.update(dt, t);
        this.signs(s, d, dt, t, live);
      }
      if (!live || this.cleared(s)) continue;
      // the foes out: who fell, who was let go (left far behind), who noticed you
      let standing = 0, any = false;
      s.out.forEach((f, i) => {
        if (!f) return;
        any = true;
        if (f.sneakHit) { f.sneakHit = false; this.sneaked(); }
        if (!f.alive) { s.killed.add(i); s.out[i] = null; return; }   // (cut down: its mind is done, state 'dead', whatever its body still does)
        if (!this.foes.list.includes(f)) { s.out[i] = null; return; }   // (let go with the packs, Foes.update: out again as you come back)
        standing++;
        if (f.wakeIn != null && (f.wakeIn -= dt) <= 0) { f.wakeIn = null; if (!f.provoked) this.wake(f); }
        if (f.provoked && !f.called) { f.called = true; this.alarm(s, f); }
        // back home after you left it be: it settles back into its life there (sat by the fire, asleep again)
        if (f.provoked && f.state === 'idle' && f.idle && Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) > 25) { f.provoked = false; f.called = false; }
        // (a humanoid on clips sits and sleeps in its own clips: src/enemies/humanoid-rig.js; no lowering laid over them)
        f.restPose = f.model?.ownRest ? null : restPose(f, dt, f.restPose ?? {});
      });
      if (s.killed.size >= s.lay.foes.length) { this.clear(s); continue; }
      if (!any && s.sprung && d > SITE.drop) s.sprung = false;
      if (standing === 0 && !s.out.some(Boolean)) {
        if (s.kind === 'ambush') { if (!s.sprung && d < s.lay.trigger) { s.sprung = true; this.spring(s); } }
        else if (d < SITE.near) this.spawn(s);
      }
    }
    this.sleepers(t);
  }

  /** An ambush springs: up they come round its coffer, the sand bursting (or the shadow gathering). */
  spring(s) {
    this.spawn(s, { sprung: true });
    this.sound?.critter?.(s.sign?.signType === 'shadow' ? 'flutter' : 'poof', 1);
    const T = this.tool;
    if (T?.drops && s.sign?.signType !== 'shadow') for (let i = 0; i < 30; i++) T.drops.add({ pos: _v.copy(s.coffer.group.position).add(new THREE.Vector3((this.rng() - 0.5) * 6, 0.2, (this.rng() - 0.5) * 6)), vel: new THREE.Vector3((this.rng() - 0.5) * 3, 2 + this.rng() * 3, (this.rng() - 0.5) * 3), drag: 2, grav: 9, size: 0.06 + this.rng() * 0.05, life: 0.8, color: i % 3 ? '#e8c58f' : '#c98d4f' });
  }

  /** The ambush's sign: the sand heaving now and then as you come within 30 m (a hiss of grit), the shadow sliding about. */
  signs(s, d, dt, t, live) {
    const S = s.sign;
    if (!S) return;
    const armed = live && !this.cleared(s) && !s.sprung;
    S.group.visible = armed;
    if (!armed) return;
    S.next ??= 1 + this.rng() * 2;
    S.twitch = Math.max(0, (S.twitch ?? 0) - dt * 2.2);
    if (d < 30 && (S.next -= dt) <= 0) {
      S.next = 1.4 + this.rng() * 2.6; S.twitch = 1;
      this.sound?.critter?.(S.signType === 'shadow' ? 'flutter' : 'scribble', Math.max(0.15, 1 - d / 30));
      const T = this.tool, at = S.group.position;
      if (T?.drops && S.signType === 'sand') for (let i = 0; i < 6; i++) T.drops.add({ pos: _v.set(at.x + (this.rng() - 0.5) * 2, at.y + 0.3, at.z + (this.rng() - 0.5) * 1.6), vel: new THREE.Vector3((this.rng() - 0.5) * 1.2, 1.2 + this.rng() * 1.6, (this.rng() - 0.5) * 1.2), drag: 2.5, grav: 7, size: 0.05 + this.rng() * 0.04, life: 0.6, color: '#d9bf92' });
    }
  }

  /** The "z"s over the sleepers near you. */
  sleepers(t) {
    const P = this.player, list = [];
    for (const s of this.sites) for (const f of s.out) if (f?.alive && f.idle?.mode === 'sleep' && !f.provoked && f.idle.rest > 0.6 && Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) < 30) list.push(f);
    while (this.marks.length < Math.min(list.length, 8)) this.marks.push(sleepMarks(this.group));
    this.marks.forEach((m, i) => {
      const f = list[i];
      m.set(f ? _top.copy(f.pos).setY(f.pos.y + (f.def.height ?? 1) * 0.9 + 0.35) : _top, P.pos, t + i * 0.37, !!f);
    });
  }

  /** Every one cut down: cleared for good, its coffer's lamp lit; a word the first time. */
  clear(s) {
    this.game?.set?.(siteFlag(this.levelId, s.id), true);
    s.out = []; s.killed.clear();
    this.sound?.chime?.();
    this.toast?.(s.kind === 'camp' ? 'The camp is quiet. Its coffer is yours.' : s.kind === 'nest' ? 'The nest is empty. Its coffer is yours.' : 'They are beaten. Their coffer is yours.');
  }

  /** The first sneak strike on a sleeper: said once (hints full). */
  sneaked() {
    if (this.game?.flag?.('hint.sneak') || !hintsFor('tip')) return;
    this.game?.set?.('hint.sneak', true);
    this.teach?.('A sneak strike: asleep, it takes your cut three times over.');
  }

  dispose() {
    if (this.foes?.packQuiet) this.foes.packQuiet = null;
    if (this.foes?.encounters === this) this.foes.encounters = null;
    for (const s of this.sites) { s.offCoffer?.(); for (const p of s.props ?? []) p.dispose(); s.coffer?.dispose(); }
    for (const m of this.marks) m.dispose();
    this.group.removeFromParent();
  }
}

/**
 * The world's site fires and the dry brush round its camps, for src/flammable.js (flammableSpots): an ember flares a
 * camp's fire (the foes sitting round it catch it: src/chemistry.js), a lit foe or an ember sets the brush alight.
 */
export function siteFlammables(level) {
  const out = [];
  for (const s of sitesOf(level?.id)) {
    if (s.kind !== 'camp') continue;
    const L = layoutSite(s, BODIES), y = s.at[1];
    const fire = L.props.find((p) => p.type === 'fire');
    out.push({ at: new THREE.Vector3(fire.at[0], y + 1.5, fire.at[1]), kind: 'campfire', r: 1.6, lit: true });
    for (const p of L.props) if (p.type === 'bramble') {
      const g = level?.ground?.heightAt?.(p.at[0], p.at[1]);
      out.push({ at: new THREE.Vector3(p.at[0], Number.isFinite(g) && Math.abs(g - y) < 2 ? g : y, p.at[1]), kind: 'bramble', r: 1.1 });
    }
  }
  return out;
}

export { SITE, sitesOf, layoutSite, siteFlag, cofferFlag };
export const siteArchetypes = (s) => [...new Set([...s.foes, ...(s.lookout ? [s.lookout] : [])])].filter((a) => ARCHETYPES[a]);
