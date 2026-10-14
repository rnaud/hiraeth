import {createElderCreature, loadElderV3} from '../characters/elder-v3-creature.js';
import * as THREE from 'three';
import { keeperModel, elderModel } from './guardians.js';
import { createKeeperCreature, loadKeeperV1, KEEPER_GAIT } from '../characters/keeper-creature.js';

// A temple guardian drawn by a generated, fitted skin (docs/systems/characters.md "The Keeper in the Rose House"), with
// its old procedural body (src/temples/guardians.js) standing in until the skin has loaded, and for good if it never
// does (an old app, a file the Unity bridge did not copy, no network). The temple is built at once, the skin comes a
// moment later, so the fight (src/temples/boss.js Guardian) holds this one model throughout: its pos, heading and mouth
// are this wrapper's own; its group, tellRig, kit and poses are the body's of the moment (the skin's group takes the
// old one's place in the temple); its gameplay sizes
// (radius, height, mouthR…) are fixed, the same for either body, so the fight's rules and hit spots never change.
//
//   const m = keeperGuardian();      // what desert.js and the Arena put in the Rose House's cistern
//   m.ready                          // a promise: true once the skin is in, false if it fell back
//   m.generated                      // which body it has now

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/**
 * fallback(): the procedural model; load(): a promise of the GLB; make(gltf): the generated model; sizes: the gameplay
 * numbers (radius, height, mouthR, bodyR, touchR).
 */
export function generatedGuardian({ name, fallback, load, make, sizes }) {
  const pos = V(), mouth = V();
  let inner = null, own = null, disposed = false, pending = null;
  // (the body's own group is the one the fight places and the temple holds: the motion kit plans its feet in the world
  // through that group's own matrix, so it is never nested in another)
  const adopt = (m) => {
    m.pos = pos; m.heading = W.heading; m.home = W.home; m.rest = W.rest; m.restHeading = W.restHeading;
    m.group.name = `${name} · ${m.group.name}`;
    own = new Set(m.tellRig?.children ?? []);
    inner = m;
  };
  const W = {
    pos, mouth, heading: 0, home: null, rest: null, restHeading: 0, ...sizes, generated: false,
    get group() { return inner.group; },
    get tellRig() { return inner.tellRig; },
    get kit() { return inner.kit; },
    get body() { return inner.body; },
    get inner() { return inner; },
    get floats() { return !!inner.floats; },
    get hover() { return inner.hover; },
    get rooted() { return inner.rooted; },
    get marks() { return inner.marks; },
    part(n, out, side) { return inner.part?.(n, out, side) ?? null; },
    // (the body's own: its blows on its bones and its weak point for the lock, src/temples/boss.js, src/foes.js GuardianLock;
    // a body without them is struck and locked as before, by its moves' shapes and its middle)
    get hitParts() { return inner.hitParts ? (n, out) => inner.hitParts(n, out) : undefined; },
    get lockAt() { return inner.lockAt ? (out) => inner.lockAt(out) : undefined; },
    get shadow() { return inner.shadow; },
    animate(dt, t, opts) {
      if (pending && inner.group.parent) { const next = pending; pending = null; W.swap(next); }
      inner.heading = W.heading;
      inner.animate(dt, t, opts);
      mouth.copy(inner.mouth);
    },
    /** The generated body in place of the procedural one: what the fight added to the old tell rig moves over with it. */
    swap(next) {
      const old = inner, parent = old.group.parent;
      if (!parent) { pending = next; return; }   // (not in the temple yet: at its first frame there)
      const rig = old.tellRig, foreign = rig ? rig.children.filter((c) => !own.has(c)) : [];
      const a = old.marks, b = next.marks;
      // (its turn as a yaw: a quaternion copied in reads back past a quarter turn as a half turn on x and z, issue #319)
      next.group.position.copy(old.group.position); next.group.rotation.set(0, W.heading, 0);
      adopt(next);
      parent.add(next.group);
      if (rig && next.tellRig) {
        next.tellRig.position.copy(rig.position); next.tellRig.quaternion.copy(rig.quaternion); next.tellRig.scale.copy(rig.scale);
        for (const c of foreign) {
          next.tellRig.add(c);
          // (the phase marks were laid round the old body's ellipsoid, boss.js PhaseMarks: mapped onto the new one's)
          if (a && b) for (let k = 0; k < 3; k++) {
            const s = b.r[k] / a.r[k];
            c.scale.setComponent(k, c.scale.getComponent(k) * s);
            c.position.setComponent(k, b.c[k] - a.c[k] * s + c.position.getComponent(k) * s);
          }
        }
      }
      old.group.removeFromParent();
      old.group.traverse((o) => { if (o.isMesh && !foreign.includes(o)) o.geometry?.dispose(); });
      old.dispose?.();
      W.generated = true;
      next.group.updateMatrixWorld(true);
      mouth.copy(next.mouth);
    },
    dispose() { disposed = true; pending?.dispose?.(); pending = null; inner.dispose?.(); inner.group.removeFromParent(); },
  };
  adopt(fallback());
  W.ready = Promise.resolve().then(load).then((gltf) => {
    if (disposed) return false;
    W.swap(make(gltf));
    return true;
  }).catch((e) => {
    if (typeof window !== 'undefined') console.warn(`${name}: the generated body did not load, the old one stays`, e?.message ?? e);
    return false;
  });
  return W;
}

/** The Cistern-Keeper as the Rose House fights it: the fitted Tripo skin (keeper-v1), the procedural body until then. */
export function keeperGuardian({ load = loadKeeperV1 } = {}) {
  return generatedGuardian({
    name: 'Cistern-Keeper',
    fallback: () => keeperModel(),
    load,
    make: (gltf) => createKeeperCreature(gltf, { gameMaterial: true }),
    // (the fitted body's: its shell 3 m across and 7.8 long, the mouth's hit sphere as generous as the old one's)
    // (turnRate, rad/s: the fastest it turns, issue #315: past it its six feet can't step it round, src/characters/keeper-creature.js KEEPER_GAIT.turn)
    sizes: { radius: 2.9, height: 4.4, mouthR: 1.3, turnRate: KEEPER_GAIT.turn },
  });
}

/** The approved natural-wing Elder, in the Aerie, on its crown and in the Arena. */
export function elderGuardian({load=loadElderV3}={}) {
 return generatedGuardian({name:'Elder of Vael',fallback:()=>elderModel(),load,
  make:gltf=>createElderCreature(gltf,{gameMaterial:true}),
  sizes:{radius:3,height:7,mouthR:1.1,bodyR:2.6,touchR:1}});
}
