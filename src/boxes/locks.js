import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { tagMetal } from '../gadgets/metal.js';
import { hiddenWriting } from '../gadgets/hidden.js';

// The makers' small locks (v1.86, issue #518, the author: "Little chests should always be a rewards for puzzles
// completion. And I should have all the tools available at that moment in the game to open them."; the proposal on
// #481, option A). A little chest that stands out in a world on a climb (a spire's cap, a roof, a tree) is no longer a
// gift for the climb alone: beside it the makers left a small lock that one tool answers, a tool you have by the time
// you first reach that world (tests/boxes.test.js checks it against the route's order). Until the lock is answered the
// chest is shut and quiet (the placement's `ready`), and E on it says what it wants (`sealed`).
//
// A placement carries `lock: { tool, side }` (src/boxes/placements.js); src/boxes/index.js builds it beside the box:
//
//   ember    two iron braziers either side of it, lit with an ember glob (the fluid gun's ember mode)
//   hook     two pull-rings on posts either side: tug each with the grappling hook
//   stun     a pair of stone jaws snapping over its lid: a stilling glob holds them open
//   bubble   a lamp on a sheer pole beside it, over a double jump's reach: float up to it in a bubble
//   bloom    a budded seal on a stem in front of it: a bloom glob opens the bud
//   springs  a stomp plate in front of it: stomp it with the spring boots
//   bomb     a cracked stone cap over it: an ink bomb's blast breaks it
//   magnet   an iron disc on a post: the magnet glove pulls you to it, and the lock gives
//   lens     the chest itself shows only through the seeing lens: seen through it once, it stays
//   tether   a ring on a post: pull it with the tether mode
//
// Answered, the lock's flag is set (`lock.<box id>`, saved) and the chest wakes. The pieces are the shared code's own
// (targets, the lens's hidden things, metal), so the engines build and answer them as the page does.

/** A lock's saved flag. */
export const lockFlag = (id) => `lock.${id}`;

/** What each tool's lock asks for, said on E while it holds the chest shut (one line, issue #518). */
export const LOCK_SEALED = {
  ember: 'The makers’ chest sits shut between two cold braziers.',
  hook: 'The makers’ chest sits shut between two pull-rings on posts.',
  stun: 'Stone jaws snap shut over the makers’ chest. Something has to still them.',
  bubble: 'The makers’ chest sits shut under a dark lamp, high on a sheer pole.',
  bloom: 'A budded seal stands closed in front of the makers’ chest.',
  springs: 'The makers’ chest sits shut behind a plate set in the ground. A light step does nothing.',
  bomb: 'A cracked stone cap sits over the makers’ chest.',
  magnet: 'The makers’ chest sits shut beside an iron disc on a post.',
  lens: 'Something hums here, out of sight.',
  tether: 'The makers’ chest sits shut beside a ring on a post, pulled taut.',
};
/** The tool each lock wants: the item that answers it (the route's order checks it: tests/boxes.test.js). */
export const LOCK_ITEM = { ember: 'fire', hook: 'hook', stun: 'stun', bubble: 'bubble', bloom: 'bloom', springs: 'springs', bomb: 'bomb', magnet: 'magnet', lens: 'monocle', tether: 'tether' };

let M = null;
const mats = () => (M ??= {
  stone: makeMaterial({ color: '#e6d7b8', color2: '#d9c7a3', color3: '#c2ad88' }),
  iron: makeMaterial({ color: '#5d6672', flat: true, metal: 'iron' }),
  ink: makeMaterial({ color: '#2b211f', flat: true }),
  off: makeMaterial({ color: '#8d8371', flat: true }),
  on: makeMaterial({ color: '#ffe9a8', flat: true, glow: 1 }),
  fire: makeMaterial({ color: '#ff9a3c', flat: true, glow: 1 }),
  brass: makeMaterial({ color: '#d6a94a', flat: true, metal: 'brass' }),
  bud: makeMaterial({ color: '#6fae6a', flat: true }),
  petal: makeMaterial({ color: '#f0a8c8', flat: true, glow: 0.4 }),
  blue: makeMaterial({ color: '#3d6fa8', flat: true }),
  cracked: makeMaterial({ color: '#d8b98e', color2: '#c9a479', color3: '#b38b62', cracks: 1 }),
});

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.noCollide = true; return m; };

/**
 * Build a box's lock beside it. b: the box ({ id, pos, yaw, parts }); lock: { tool, side (1 right, -1 left) };
 * o: { scene, physics, game, sound, player }. → { solved(), update(dt, t), dispose() }
 */
export function buildLock(b, lock, { scene, physics = null, game, sound = null, player = null } = {}) {
  const tool = lock.tool, flag = lockFlag(b.id);
  const root = new THREE.Group();
  root.name = `Makers’ lock (${tool}) ${b.id}`;
  root.position.copy(b.pos);
  root.rotation.y = b.yaw;
  scene?.add(root);
  root.updateMatrixWorld(true);
  const W = (x, y, z) => root.localToWorld(V(x, y, z));
  const offs = [];
  const parts = [];   // each piece of the lock: { done, show(on) }
  const solved = () => !!game?.flag?.(flag);
  // (a piece answered: all of them, the lock gives, the chest wakes)
  const answer = (p) => {
    if (p.done || solved()) return false;
    p.done = true; p.show(true);
    sound?.boxAnswer?.(0.6);
    if (parts.every((x) => x.done)) { game?.set?.(flag, true); sound?.fragmentTaken?.({ pos: b.pos }); }
    return true;
  };
  const piece = (show) => { const p = { done: false, show }; parts.push(p); return p; };
  // a target the tool answers (registerTarget: the fluid gun's modes, the hook's tug, a stomp, the tether)
  const target = (p, at, radius, accepts, test) => offs.push(registerTarget({
    kind: 'lock', radius, accepts, position: () => at, enabled: () => !p.done && !solved(),
    onHit: (mode, point, dir, info) => (test(mode, info) ? answer(p) : false),
  }));
  const side = lock.side ?? 1, M = mats();

  if (tool === 'ember' || tool === 'hook') {
    // two of them, either side of the chest
    for (const s of [-1, 1]) {
      const x = s * 1.25;
      const g = new THREE.Group(); g.position.set(x, 0, 0.2); root.add(g);
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8).translate(0, 0.55, 0), M.ink));
      let lit;
      if (tool === 'ember') {
        g.add(mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.22, 10).translate(0, 1.2, 0), M.iron));
        lit = mesh(new THREE.ConeGeometry(0.17, 0.42, 8).translate(0, 1.5, 0), M.fire); lit.visible = false; g.add(lit);
      } else {
        g.add(mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 18).translate(0, 1.32, 0), M.brass));
        lit = mesh(new THREE.SphereGeometry(0.07, 8, 6).translate(0, 1.1, 0.1), M.off); g.add(lit);
      }
      const p = piece((on) => { if (tool === 'ember') lit.visible = on; else lit.material = on ? M.on : M.off; });
      if (tool === 'ember') target(p, W(x, 1.3, 0.2), 0.45, ['fire'], (mode) => mode === 'fire');
      else target(p, W(x, 1.32, 0.2), 0.4, [], (mode, info) => info?.mode === 'hook');
    }
  } else if (tool === 'stun') {
    // stone jaws over the lid, snapping while they are free
    const jaws = [-1, 1].map((s) => {
      const j = new THREE.Group(); j.position.set(0, 0.95, s * 0.5); root.add(j);
      const blk = mesh(new THREE.BoxGeometry(1.3, 0.18, 0.5).translate(0, 0, s * 0.25), M.stone); j.add(blk);
      for (let k = -2; k <= 2; k++) j.add(mesh(new THREE.ConeGeometry(0.07, 0.22, 4).rotateX(-s * Math.PI / 2).translate(k * 0.25, 0, -s * 0.02), M.ink));
      return { j, s };
    });
    const p = piece(() => {});
    p.tick = (t) => { const a = p.done ? 1.1 : 0.55 + 0.5 * Math.abs(Math.sin(t * 2.6)); for (const { j, s } of jaws) j.rotation.x = s * a; };
    target(p, W(0, 1.0, 0), 0.8, ['stun'], (mode) => mode === 'stun');
  } else if (tool === 'bubble') {
    // a lamp on a sheer pole beside it, over a double jump's reach (4.8 m): float up to it
    const H = 6.2, x = side * 1.6;
    const pole = mesh(new THREE.CylinderGeometry(0.12, 0.14, H, 10).translate(x, H / 2, -0.2), M.stone);
    pole.userData.noCollide = false; pole.userData.noClimb = true;
    root.add(pole);
    const lamp = mesh(new THREE.IcosahedronGeometry(0.26, 1).translate(x, H + 0.3, -0.2), M.off); root.add(lamp);
    const at = W(x, H + 0.3, -0.2);
    const p = piece((on) => { lamp.material = on ? M.on : M.off; });
    p.near = () => player?.pos && player.pos.distanceTo(at) < 1.9;
    // (solid: the pole stands, and can't be climbed: src/physics.js noClimb)
    if (physics?.addCollider) { pole.updateMatrixWorld(true); const h = physics.addCollider(pole, { noClimb: true }); offs.push(() => physics.removeCollider?.(h)); }
  } else if (tool === 'bloom') {
    const g = new THREE.Group(); g.position.set(0, 0, 1.15); root.add(g);
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6).translate(0, 0.45, 0), M.bud));
    const bud = mesh(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.4, 1).translate(0, 1.05, 0), M.bud); g.add(bud);
    const petals = new THREE.Group(); petals.position.y = 1.05; petals.visible = false; g.add(petals);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; petals.add(mesh(new THREE.SphereGeometry(0.16, 8, 6).scale(1, 0.35, 0.6).translate(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22), M.petal)); }
    const p = piece((on) => { bud.visible = !on; petals.visible = on; });
    target(p, W(0, 1.05, 1.15), 0.45, ['bloom'], (mode) => mode === 'bloom');
  } else if (tool === 'springs') {
    const plate = mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.12, 20).translate(0, 0.06, 1.6), M.iron); root.add(plate);
    const ring = mesh(new THREE.TorusGeometry(0.52, 0.04, 4, 24).rotateX(Math.PI / 2).translate(0, 0.13, 1.6), M.off); root.add(ring);
    const p = piece((on) => { ring.material = on ? M.on : M.off; plate.position.y = on ? -0.05 : 0; });
    target(p, W(0, 0.3, 1.6), 0.9, [], (mode, info) => info?.mode === 'stomp' || info?.source === 'stomp');
  } else if (tool === 'bomb') {
    const cap = mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.0, 1.25, 0.85), M.cracked); root.add(cap);
    const p = piece((on) => { cap.visible = !on; });
    if (solved()) cap.visible = false;
    const at = W(0, 0.5, 0);
    const off = game?.on?.('gadget:blast', (e) => { if (e?.at && e.at.distanceTo(at) < 3.6) answer(p); });
    if (off) offs.push(off);
  } else if (tool === 'magnet') {
    const x = side * 1.4;
    root.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.4, 8).translate(x, 0.7, 0), M.ink));
    const disc = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18).rotateX(Math.PI / 2).translate(x, 1.65, 0), M.iron); root.add(disc);
    tagMetal(disc, { points: [V(x, 1.65, 0)], radius: 0.45 });
    const eye = mesh(new THREE.SphereGeometry(0.08, 8, 6).translate(x, 1.65, 0.09), M.off); root.add(eye);
    const p = piece((on) => { eye.material = on ? M.on : M.off; });
    const off = game?.on?.('magnet:pull', (e) => { if (e?.object === disc) answer(p); });
    if (off) offs.push(off);
  } else if (tool === 'lens') {
    // the chest itself shows only through the seeing lens (a mark of the makers' writing on it, for the glass), and
    // stays once seen (src/gadgets/hidden.js: `lens.read.<id>` set when it is read)
    hiddenWriting(root, [0, 1.3, 0.9], 0, 'HERE', { width: 0.9, id: flag, message: 'Through the glass, a makers’ chest where there was nothing.', range: 16 });
    const p = piece(() => {});
    p.seen = () => !!game?.flag?.(`lens.read.${flag}`);
  } else if (tool === 'tether') {
    const x = side * 1.4;
    root.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 8).translate(x, 0.6, 0), M.ink));
    const ringM = mesh(new THREE.TorusGeometry(0.24, 0.05, 6, 18).translate(x, 1.4, 0), M.brass); root.add(ringM);
    const eye = mesh(new THREE.SphereGeometry(0.07, 8, 6).translate(x, 1.1, 0.1), M.off); root.add(eye);
    const p = piece((on) => { eye.material = on ? M.on : M.off; ringM.rotation.x = on ? 0.6 : 0; });
    target(p, W(x, 1.4, 0), 0.45, ['tether'], (mode) => mode === 'tether');
  }
  // answered already (a save): every piece shows it
  if (solved()) for (const p of parts) { p.done = true; p.show(true); }
  const hidden = tool === 'lens';
  const showBox = (on) => { if (b.parts?.root) b.parts.root.visible = on; };
  if (hidden) showBox(solved());

  return {
    tool, flag, root, solved,
    update(dt, t) {
      for (const p of parts) {
        p.tick?.(t);
        if (!p.done && p.near?.()) answer(p);
        if (!p.done && p.seen?.()) answer(p);
      }
      if (hidden) showBox(solved());
    },
    dispose() { for (const off of offs) off?.(); root.removeFromParent(); },
  };
}
