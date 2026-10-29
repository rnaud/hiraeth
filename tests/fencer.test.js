import test from 'node:test';
import { POISE } from '../src/enemies/fight.js';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, FOES } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { SKINS } from '../src/enemies/skins.js';
import { WORLDS } from '../src/foe-worlds.js';
import { ORDER } from '../src/levels/names.js';
import { archetypeModel } from '../src/enemies/plans/index.js';
import { windMin } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

// The makers' fencer (issue #665; docs/design/combat-botw-study.md ranked changes 5-8; docs/systems/foes.md "The makers'
// fencer"): a sword-and-shield duelist that mirrors the traveller's kit. Fought in the Arena, headless: its shield turns
// the light combo from the front; the charged cut throws it wide; behind it, it is open; hide behind your guard and it
// bashes it aside; a perfect parry of its sword knocks the sword away, and it fights shield-only while it runs for it;
// its leap hangs in the air a second. A traveller who plays the answers beats it; one who spams the combo is turned away
// and punished, but never stalled for good.

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function duel(o = {}) {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurts: 0, staggers: 0, guardUp: false, parry: false,
    hurt() { this.hurts++; }, knockDown() { return true; }, stagger() { this.staggers++; }, flinch() {},
    guarding() { return this.guardUp || this.parry; }, guard() { return this.parry ? 'perfect' : this.guardUp ? true : false }, ...o };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  const f = foes.add(o.kind ?? 'fencer', v(0, 0, o.at ?? 2.6)); f.heading = Math.PI;
  return { foes, f, P, done: () => { foes.dispose(); clearTargets(); } };
}
const FRONT = v(0, 0, 1), BACK = v(0, 0, -1);
const raise = (foes, f) => { for (let i = 0; i < 100 && f.guardK < 1; i++) { f.cool = Math.max(f.cool, 3); foes.update(DT); } return f.guardK; };
const CHARGED = { damage: 2, combo: 2, breaks: true, charged: false };

test('the fencer on the roster: a machine duelist of its own plan, in three late route worlds, every wind-up fair', () => {
  const A = ARCHETYPES.fencer, D = FOES.fencer;
  assert.equal(A.family, 'machine'); assert.equal(A.role, 'mirror'); assert.equal(A.art, 'pending', 'no design sheet was picked');
  const worlds = Object.keys(WORLDS).filter((w) => WORLDS[w].roster.fencer);
  assert.deepEqual(worlds.sort(), ['bazaar', 'moonfoundry', 'spacecity']);
  for (const w of worlds) assert.ok(ORDER.indexOf(w) >= ORDER.indexOf('moonfoundry'), `${w}: a later world`);
  for (const w of Object.keys(SKINS.fencer)) assert.ok(worlds.includes(w), `${w}: a skin where it fights`);
  for (const a of D.attacks) assert.ok(a.wind >= windMin(a), `${a.id}: ${a.wind} s ≥ ${windMin(a)} s`);
  for (const a of D.attacks) assert.ok(a.tell && a.counter, `${a.id}: its tell and its answer`);
  assert.equal(D.attacks.find((a) => a.id === 'overhead').dodge, 'side');
  assert.equal(D.attacks.find((a) => a.id === 'sweep').dodge, 'back');
});

test('its body: built in each skin, sword and shield, a few draws', () => {
  for (const w of Object.keys(SKINS.fencer)) {
    const m = archetypeModel('fencer', w);
    let meshes = 0; m.group.traverse((o) => { if (o.isMesh) meshes++; });
    assert.ok(meshes >= 6 && meshes <= 12, `${w}: ${meshes} meshes`);
    for (const n of ['grip', 'shield', 'dropped sword']) assert.ok(m.group.getObjectByName(n), `${w}: ${n}`);
    m.dispose();
  }
});

test('its shield turns the light combo and shots from the front; the charged cut throws it wide; its back is open to the dash cut', () => {
  const { foes, f, done } = duel();
  assert.equal(raise(foes, f), 1);
  const hp = f.hp;
  foes.hurt(f, 'blade', FRONT, { damage: 1, combo: 0 });
  foes.hurt(f, 'shoot', FRONT, {});
  assert.equal(f.hp, hp, 'combo and shot ring off');
  foes.hurt(f, 'blade', BACK, { damage: 2, combo: 2, dash: true, source: 'dash' });
  assert.equal(f.hp, hp - 4, 'the dash cut through its back: double');
  done();
  const B = duel();
  raise(B.foes, B.f);
  B.foes.hurt(B.f, 'blade', FRONT, CHARGED);
  assert.equal(B.f.reel, 'guardbroken');
  assert.ok(B.f.stunned >= 0.9 && B.f.stunned <= POISE.down + 0.05, `open ${B.f.stunned} s (the charged cut breaks its poise too: down, issue #722)`);
  B.done();
});

test('hide behind your guard in its reach and it bashes it aside; a perfect parry of the bash holds it', () => {
  const { foes, f, P, done } = duel({ guardUp: true });
  let t = 0;
  let chased = 0;
  for (; t < 5 && !(f.state === 'wind' && f.atk.id === 'bash'); t += DT) { const was = f.state; foes.update(DT); chased = was === 'chase' ? chased + DT : 0; }
  assert.ok(f.state === 'wind' && f.atk.id === 'bash', 'it bashes a turtle');
  assert.ok(chased >= FOES.fencer.turtle.after - 0.05 && chased < 1.5, `after ${chased.toFixed(2)} s of guarding in its reach`);
  for (let i = 0; i < 90 && f.state !== 'recover'; i++) foes.update(DT);
  assert.ok(P.hurts >= 1 && P.staggers >= 1, 'a plain block is knocked aside: staggered and hurt');
  done();
  const B = duel({ guardUp: true });
  // it may leap or close in first (it varies its moves): wait, as above, for the bash itself
  for (let i = 0; i < 300 && !(B.f.state === 'wind' && B.f.atk.id === 'bash'); i++) B.foes.update(DT);
  assert.ok(B.f.state === 'wind' && B.f.atk.id === 'bash', 'it bashes a turtle');
  B.P.parry = true;
  for (let i = 0; i < 90 && B.f.state !== 'recover'; i++) B.foes.update(DT);
  assert.equal(B.P.hurts, 0, 'parried: no harm');
  assert.ok(B.f.stunned > 1, 'and it is stunned');
  B.done();
});

test('a perfect parry of its sword knocks it away: shield-only it runs for it, bends to pick it up (the long opening), and is armed again', () => {
  const { foes, f, P, done } = duel({ parry: true });
  // Exercise the sword-parry contract, not the randomized attack chooser: a
  // sequence of unarmed choices could otherwise consume the four-second window.
  f.state = 'chase'; f.cool = 0;
  f.beginWind(FOES.fencer.attacks.find((a) => a.id === 'overhead'), P);
  for (let i = 0; i < 240 && !f.disarmed; i++) foes.update(DT);
  assert.ok(f.disarmed, 'disarmed');
  const at = f.disarmed.at.clone();
  assert.ok(at.distanceTo(f.pos) > 2, `the sword lands ${at.distanceTo(f.pos).toFixed(1)} m off`);
  P.parry = false; P.pos.set(0, 0, -30);   // (stand back: it runs for its sword)
  const can = f.attacksAt(2, 0).map((a) => a.id);
  assert.ok(!can.includes('overhead') && !can.includes('sweep') && can.includes('shove'), `shield only: ${can}`);
  let picked = -1;
  for (let i = 0; i < 600; i++) { foes.update(DT); if (f.reel === 'pickup' && f.state === 'recover' && picked < 0) picked = i * DT; if (picked >= 0 && !f.disarmed) break; }
  assert.ok(picked >= 0, 'it bends to pick it up');
  assert.ok(f.pos.distanceTo(at) < 1.2, 'where it fell');
  assert.equal(f.disarmed, null, 'armed again');
  assert.ok(FOES.fencer.disarm.pickup >= 1.2, 'the pick-up is the long opening');
  done();
});

test('its leap slam hangs in the air about a second before it comes down', () => {
  const { foes, f, P, done } = duel({ at: 5.5 });
  const leap = FOES.fencer.attacks.find((a) => a.id === 'leap');
  f.state = 'chase'; f.cool = 0; f.beginWind(leap, P);
  let air = 0;
  for (let i = 0; i < 240; i++) { foes.update(DT); if (f.alt > 0.3) air += DT; if (f.state === 'recover') break; }
  assert.ok(air >= 0.85 && air <= 1.3, `in the air ${air.toFixed(2)} s`);
  assert.ok(P.hurts >= 1, 'it lands on a traveller who stood still');
  done();
});

/**
 * A duel, headless: the traveller stands his ground and plays by `bot` each frame ({ f, t, d } → 'charged' | 'light' |
 * 'parry' | 'guard' | null); a blow lands as the game's own Foes.hurt. Returns the time to win (s, Infinity), the hearts'
 * worth of hits taken, the blows the guard turned and the blows that told.
 */
function fight(bot, secs = 60) {
  const { foes, f, P, done } = duel({ at: 3 });
  let t = 0, next = 0, turned = 0, told = 0;
  for (; t < secs && f.alive; t += DT) {
    const d = Math.hypot(f.pos.x, f.pos.z), act = bot({ f, t, d });
    P.parry = act === 'parry'; P.guardUp = act === 'guard';
    if ((act === 'charged' || act === 'light') && t >= next && d < 3.2 && f.alt < 0.6) {   // (not at its leap, in the air out of reach)
      next = t + (act === 'charged' ? 1.6 : 0.42);
      const dir = new THREE.Vector3(f.pos.x, 0, f.pos.z).normalize(), hp = f.hp;
      foes.hurt(f, 'blade', dir, act === 'charged' ? { ...CHARGED } : { damage: 1, combo: 0 });
      if (f.hp < hp) told++; else turned++;
    }
    foes.update(DT);
  }
  const r = { t: f.alive ? Infinity : t, hurts: P.hurts, turned, told };
  done();
  return r;
}
/** Sword blows it is about to land (its wind-up's last part, its strike): when the answering traveller parries. */
const landing = (f) => (f.state === 'wind' && f.k > 0.82) || (f.state === 'strike' && (f.atk?.leap ? f.k > 0.75 : f.k < 0.6));   // (the leap comes down at the end of its strike)

test('played with its answers it falls: the charged cut into its shield, a parry at every blow, cuts while it is open', () => {
  const r = fight(({ f }) => {
    if (landing(f)) return 'parry';
    if (f.stunned > 0 || f.state === 'recover' || f.disarmed) return 'light';
    if (f.guardK >= 0.6) return 'charged';
    return null;
  });
  assert.ok(r.t < 40, `won in ${r.t.toFixed(1)} s`);
  assert.ok(r.hurts <= 2, `${r.hurts} blows taken`);
  assert.ok(r.told >= 3);
});

test('spamming the combo at its front is turned away and punished, but never stalls: the blows get in between its own', () => {
  const r = fight(() => 'light');
  assert.ok(r.turned >= 3, `${r.turned} cuts rang off the shield`);
  // (#722: the cuts that get in wear its poise down, so the spam ends sooner than it did: at least its bash still lands)
  assert.ok(r.hurts >= 1, `${r.hurts} blows taken for it (the bash, its sword)`);
  assert.ok(r.told >= 1, `${r.told} cuts told: no unexplained invulnerability`);
  const answered = fight(({ f }) => (landing(f) ? 'parry' : f.guardK >= 0.6 ? 'charged' : 'light'));
  assert.ok(answered.hurts < r.hurts, `the answers cost fewer blows (${answered.hurts}, won in ${answered.t.toFixed(1)} s) than the spam (${r.hurts}, ${r.t.toFixed(1)} s)`);
  assert.ok(Number.isFinite(r.t), 'and the spam still wins in the end: no stalemate');
});
