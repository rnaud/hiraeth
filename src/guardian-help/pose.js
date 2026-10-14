// A guardian posed by hand for a frame (issue #339's helper prototypes: src/guardian-help/), in place of its fight.

import * as THREE from 'three';

/**
 * Pose a guardian by hand for a frame (the tail of boss.js Guardian.update, without its fight): `state` and `phase` for
 * its body's poses, its speed for its feet; `place` puts it on its floor (else where pos says, turned by heading and
 * `bank`); `solid` false takes its body out of the traveller's way (the Elder aloft).
 */
export function poseGuardian(G, dt, t, { state = 'fight', phase = 0, speed = 0, place = true, bank = 0, solid = true } = {}) {
  const m = G.model, P = G.rt.player;
  G.t += dt; G._dt = dt; G.frame = (G.frame ?? 0) + 1;
  if (place) G.place();
  else {
    G.solid.pos = m.pos;
    m.group.position.copy(m.pos);
    m.group.rotation.set(0, m.heading, bank);
  }
  if (!solid) { G.solid.bottom = 1e6; G.solid.top = 1e6; }
  else if (!place) { G.solid.bottom = m.pos.y; G.solid.top = m.pos.y + (m.height ?? 3); }
  G.solid.vel.subVectors(m.pos, G.prev).divideScalar(Math.max(dt, 1e-4));
  G.prev.copy(m.pos);
  G.poseRig(dt, t);
  const kit = (G.motionKit ??= { eye: null, ground: (x, y, z) => { const g = G.rt.physics?.groundAt?.(x, y, z, 6); return Number.isFinite(g) ? g : null; } });
  kit.eye = P?.pos ?? null;
  m.animate(dt, t, { state, attack: null, k: 0, speed, meter: G.meter, phase, kit, pushed: false });
  (G._posed ??= new THREE.Vector3()).copy(m.pos);
  G.ground.update();
  G._meshFrame = G._mesh = null;
  G.blast.draw(false);
  G.marks.set(0, t, 'fight');   // (no phase marks: there is no fight to mark)
}
