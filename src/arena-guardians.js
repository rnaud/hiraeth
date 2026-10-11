import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from './materials.js';
import { Guardian } from './temples/boss.js';
import { game as sharedGame } from './game-state.js';
import { keeperModel, elderModel, whaleModel, signModel, sentinelModel, gardenerModel, foremanModel, snapperModel, mothModel, echoModel } from './temples/guardians.js';
import { KEEPER } from './temples/desert.js';
import { ELDER } from './temples/arzach.js';
import { MOTHER as CLOUD_MOTHER } from './temples/arzach2.js';
import { FIRST_SIGN } from './temples/bazaar.js';
import { TOOTH_WARDEN } from './temples/buried.js';
import { GARDENER } from './temples/edena.js';
import { FOREMAN } from './temples/garage.js';
import { WARDEN } from './temples/incal.js';
import { MOTHER as SNAPPER } from './temples/perdide.js';
import { LAMPLESS } from './temples/perdide2.js';
import { ECHO } from './temples/spheres.js';
// (the three guardians that joined the route in v1.40)
import { LISTENER } from './temples/underwater.js';
import { LAST_FOUNDER } from './temples/moonfoundry.js';
import { ANCHOR_WARDEN } from './temples/spacecity.js';
import { listenerModel } from './temples/guardian-listener.js';
import { founderModel } from './temples/guardian-founder.js';
import { anchorModel } from './temples/guardian-anchor.js';
import { TITLES } from './levels/names.js';

// The Arena's guardians (docs/systems/foes.md "The Arena"): the FOES list's Guardians section calls the thing at
// the heart of a temple (src/temples/boss.js Guardian, its body from src/temples/guardians.js) into a temporary
// ring on the sand, to spar with outside its temple. It fights as in its temple (its staged fight: moves, combos and
// phases, each move told by its body, a knock-down that never takes the last of a healthy bar); its temple's puzzle is not there, so a
// sparring rule stands in for it (sparHit): when it opens (pants, vents open) a fluid shot (water for a living
// guardian, a shot at a machine's core) counts a step; a push frightens a living one back a little. Its final
// moment is its own (lay a hand on a living one; a machine breaks).
//
//   const g = new ArenaGuardians({ scene, player, physics, sound, notice });
//   g.call('desert')  ·  g.dismiss()  ·  g.update(dt, t)  ·  g.solids() (level.dynamic)

/** Every temple's guardian, in the order the temples are met: its world, its words (the temple's own def) and its body. */
export const GUARDIANS = [
  { id: 'desert', def: KEEPER, model: () => keeperModel() },
  { id: 'incal', def: WARDEN, model: () => sentinelModel() },
  { id: 'arzach', def: ELDER, model: () => elderModel() },
  { id: 'arzach2', def: CLOUD_MOTHER, model: () => whaleModel() },
  { id: 'perdide', def: SNAPPER, model: () => snapperModel({ reach: 12 }) },
  { id: 'perdide2', def: LAMPLESS, model: () => mothModel() },
  { id: 'edena', def: GARDENER, model: () => gardenerModel() },
  { id: 'underwater', def: LISTENER, model: () => listenerModel() },
  { id: 'garage', def: FOREMAN, model: () => foremanModel() },
  // (the Tooth-Warden's targets in its temple are its four vents, rt.volley: in the ring, its body is)
  { id: 'buried', def: TOOTH_WARDEN, model: () => Object.assign(sentinelModel({ hull: '#c4553a', hull2: '#8e3a2b', dark: '#33485a', brass: '#e2b552', eye: '#f6c84e', vents: 4, legs: 4, guarded: false }), { mouthR: 0.01, bodyR: 2.0 }) },
  { id: 'moonfoundry', def: LAST_FOUNDER, model: () => founderModel() },
  { id: 'spheres', def: ECHO, model: () => echoModel() },
  { id: 'spacecity', def: ANCHOR_WARDEN, model: () => anchorModel() },
  { id: 'bazaar', def: FIRST_SIGN, model: () => signModel() },
].map((g) => ({ ...g, name: g.def.name.replace(/^the /, 'The '), world: TITLES[g.id] ?? g.id, kind: g.def.kind }));
export const GUARDIAN_BY_ID = Object.fromEntries(GUARDIANS.map((g) => [g.id, g]));

/** The ring: its radius (m, as a temple's hall: 19–21) and how far ahead of you its middle is. */
export const RING = { r: 20, ahead: 12, step: 0.12, fright: 0.05 };

/** The sparring rule in place of the temple's puzzle (see the top). */
export function sparHit(g, part, mode) {
  const rt = g.rt, robot = g.def.kind === 'robot';
  if (mode === 'push' && !robot) {
    g.add(-RING.fright, 'push');
    rt.notice('It flinches from the shove, more frightened than before. Gently.', 'spar.push');
    return true;
  }
  if (g.state !== 'open') {
    rt.notice(robot ? 'Wait until it opens, then shoot its core.' : 'Wait until it pants, open, then give it water: a fluid shot.', 'spar.wait');
    return true;
  }
  if (robot ? mode === 'shoot' || mode === 'fire' : mode === 'shoot' || mode === 'stun') {
    g.add(RING.step, robot ? 'break' : 'water');
    rt.sound?.critter?.(robot ? 'whirr' : 'splash', 1);
    if (g.state === 'open') { g.enter('fight'); g.cool = 1.4; }
  }
  return true;
}

export class ArenaGuardians {
  constructor({ scene, player = null, physics = null, sound = null, notice = () => {}, game = sharedGame } = {}) {
    Object.assign(this, { scene, player, physics, sound, say: notice, game });
    this.current = null;   // { id, guardian, root, ring }
  }

  /** Call guardian `id` into a ring just ahead of the traveller (the one already out goes). Returns the Guardian. */
  call(id) {
    const G = GUARDIAN_BY_ID[id], P = this.player;
    if (!G || !P) return null;
    this.dismiss();
    const told = new Set(), h = P.heading ?? 0;
    const center = new THREE.Vector3(P.pos.x + Math.sin(h) * RING.ahead, P.pos.y, P.pos.z + Math.cos(h) * RING.ahead);
    const y = this.physics?.groundAt?.(center.x, center.y + 20, center.z, 60);
    if (Number.isFinite(y)) center.y = y;
    const root = new THREE.Group(); root.name = `Arena guardian: ${G.name}`;
    this.scene?.add(root);
    // the ring drawn on the sand: where it fights, and where it keeps
    const mat = makeMaterial({ color: G.kind === 'robot' ? '#c4553a' : '#d8a24a', flat: true, glow: 0.4, key: `arena-ring.${id}` });
    const ring = new THREE.Mesh(new THREE.RingGeometry(RING.r - 0.35, RING.r, 96).rotateX(-Math.PI / 2), mat);
    ring.position.copy(center).setY(center.y + 0.04); ring.userData.noCollide = true;
    root.add(ring);
    const rt = {
      def: { id: `arena-${id}` }, root, player: P, sound: this.sound, physics: this.physics, logic: { resolved: false },
      notice: (text, key = null) => { if (!text) return; if (key) { if (told.has(key)) return; told.add(key); } this.say(text); },
      rumble: () => {},
      onBossResolved: (g) => { this.say(`${G.name} is done. Call another, or the waves, from the list.`); this.game?.emit?.('guardian:spar', { id, pos: (g?.model?.pos ?? center).clone() }); },   // (its purse, as training: src/chimes.js)
    };
    const model = G.model();
    // asleep at the far side of the ring, facing you
    model.pos.set(center.x + Math.sin(h) * RING.r * 0.45, center.y, center.z + Math.cos(h) * RING.r * 0.45);
    model.home = model.pos.clone();
    model.heading = h + Math.PI;
    model.rest = center.clone(); model.restHeading = h + Math.PI;
    // its temple's hints name the temple's puzzle (braziers, resonators…): in the ring, the sparring rule's
    const hint = G.kind === 'robot' ? 'It comes for you. When it opens, shoot its core.' : 'It is afraid of you. When it pants, open, give it water: a fluid shot.';
    const phases = G.def.phases.map((p, i) => (p.weary ? p : { ...p, hint: i ? `${G.name} again. ${hint}` : hint, openHint: undefined }));
    const openHint = G.kind === 'robot' ? 'It opens: shoot it now.' : 'It pants, open: water now.';
    const guardian = new Guardian(rt, { def: { ...G.def, phases, openHint, wake: `${G.name} stirs in the ring, unfolds, and sees you.`, onHit: sparHit, onStrike: G.id === 'desert' ? (g, a) => { if (a.id === 'burrow') { g.model.pos.x = g.attackAt.x; g.model.pos.z = g.attackAt.z; } } : undefined }, model, arena: { center, r: RING.r, y: center.y } });
    root.add(model.group);
    this.current = { id, G, guardian, root, ring, mat };
    this.say(`${G.name}, from ${G.world}, waits in the ring ahead. Step in to wake it.`);
    return guardian;
  }

  /** Send the guardian back and take the ring away. */
  dismiss() {
    const c = this.current;
    if (!c) return;
    c.guardian.dispose();
    c.root.traverse((o) => o.geometry?.dispose());
    c.root.removeFromParent();
    releaseMaterial(c.mat);
    this.current = null;
  }

  update(dt, t) { this.current?.guardian.update(dt, t); }
  /** The guardian's body, solid for the traveller (level.dynamic, as a temple's: src/temples/runtime.js solids()). */
  solids() { return this.current ? [this.current.guardian] : []; }
  get id() { return this.current?.id ?? null; }
}
