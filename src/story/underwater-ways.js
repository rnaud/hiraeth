import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';

// The Underwater City's way through, alive (issue #192; the pieces: src/underwater-seabed.js, src/underwater-canyon.js,
// src/underwater-song.js). The divers' rack in the Dock gives a helmet; the locks let you out to the sea only with one;
// out there it is on your head (the humanoid's head anchor carries it). The halls' great pipes: turn one's stop wheel and
// it plays in tune; all three, and the city is in tune but for the Whale-House (the main quest's step).
//
// Flags: underwater.helmet, underwater.pipe.gallery / .plaza / .crown, underwater.city.tuned.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const PIPE_FLAG = (id) => `underwater.pipe.${id}`;
export const HELMET_FLAG = 'underwater.helmet';
export const TUNED_FLAG = 'underwater.city.tuned';
/** What is said: once each, one line. */
export const LINES = {
  helmet: 'A brass helmet off the rack. Outside, its air runs down; the bells on the seabed give it back.',
  refuse: 'The lock won’t open without a helmet. The divers’ rack is by the long tube’s door.',
  pipe: { gallery: 'The stop opens. The Gallery’s pipe sounds low and even, and the pool goes still.', plaza: 'The stop opens. The Plaza’s great pipe sounds, and its rings run out round and even.', crown: 'The stop opens. The Crown’s pipe sounds up through the surface.' },
  tuned: 'The city plays in tune again. Only the north still hums the wrong note.',
};

export function setupUnderwaterWays(ctx) {
  const { level, game, sound, player, quests, toast = () => {} } = ctx;
  const U = level?.uw;
  if (!U) return null;
  const { ways, song } = U;

  // ---- the helmet: off the rack's peg, once
  const rack = V(...ways.rack.at);
  const has = () => !!game.flag(HELMET_FLAG);
  ways.rack.helmet.visible = !has();
  quests?.locate?.('diversRack', () => rack);
  const head = V(...U.canyon.head);
  quests?.locate?.('canyonHead', () => head);
  const offRack = registerInteractable({
    id: 'underwater.helmet', priority: PRIORITY.use, range: 3, prompt: 'take a diving helmet', at: () => rack.clone().setY(1.4),
    enabled: () => !has(),
    distance: (p) => (Math.abs(p.pos.y - rack.y) < 2 ? flat(p.pos, rack) : Infinity),
    use: () => { game.set(HELMET_FLAG, true); ways.rack.helmet.visible = false; sound?.chime?.(); toast(LINES.helmet); },
  });
  // the locks: out to the sea only with a helmet (in from it, always)
  for (const L of [ways.locks.dock, ways.locks.gallery]) { L.portals[0].when = has; L.portals[0].refuse = LINES.refuse; }

  // ---- the great pipes: a wheel each; the marker on the next one out of tune (the route's order)
  for (const p of song.pipes) if (game.flag(PIPE_FLAG(p.id))) song.setTuned(p.id, true, true);
  const next = () => song.pipes.find((p) => !song.tuned.has(p.id)) ?? song.pipes.at(-1);
  quests?.locate?.('greatPipe', () => V(...next().stand));
  quests?.locate?.('crownPipe', () => V(...song.pipes.find((p) => p.id === 'crown').stand));
  const offs = song.pipes.map((p) => {
    const at = V(...p.wheel.position.toArray());
    return registerInteractable({
      id: `underwater.pipe.${p.id}`, priority: PRIORITY.use, range: 3, prompt: 'turn the stop wheel', at: () => at,
      enabled: () => !song.tuned.has(p.id),
      distance: (pl) => (Math.abs(pl.pos.y - p.at[1]) < 2.5 ? flat(pl.pos, at) : Infinity),
      use: () => {
        game.set(PIPE_FLAG(p.id), true);
        song.setTuned(p.id, true);
        // (its note: low and long, then the fifth over it, as a horn into the sea)
        sound?.tune?.([[p.id === 'crown' ? 147 : p.id === 'plaza' ? 110 : 98, 3], [p.id === 'crown' ? 220 : p.id === 'plaza' ? 165 : 147, 4]], 0.32, 'reed', 0.14);
        if (song.isTuned()) { game.set(TUNED_FLAG, true); toast(LINES.tuned); } else toast(LINES.pipe[p.id]);
      },
    });
  });
  if (song.isTuned() && !game.flag(TUNED_FLAG)) game.set(TUNED_FLAG, true);

  // ---- the helmet on his head while he is out in the sea (on his head anchor, scaled to the world)
  let worn = null;
  const wear = (on) => {
    if (!worn && on) {
      // (the humanoid's head anchor: the skull's middle, +z the face; the Gear's bubble helmet hung there too)
      const head = player?.humanoid?.headAnchor;
      if (!head) return;
      const g = ways.rack.helmet.clone(true);
      g.name = 'The helmet he wears';
      g.visible = true;
      head.add(g);
      head.updateWorldMatrix(true, false);
      const s = new THREE.Vector3(); head.getWorldScale(s);
      g.scale.setScalar(0.92 / (s.x || 1));
      g.position.set(0, 0.03 / (s.y || 1), 0.0);
      // (turned in the anchor's frame so its visor looks the way he faces and its crown is up, whatever that frame's axes)
      player.object.updateWorldMatrix(true, false);
      const inv = new THREE.Matrix4().copy(head.matrixWorld).invert();
      const up = V(0, 1, 0).transformDirection(inv), fwd = V(0, 0, 1).transformDirection(player.object.matrixWorld).setY(0).normalize().transformDirection(inv);
      fwd.addScaledVector(up, -fwd.dot(up)).normalize();
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, fwd), up, fwd));
      g.traverse((o) => { o.userData.noCollide = true; o.castShadow = true; o.layers.mask = head.layers.mask || 1; });   // (drawn as he is)
      worn = g;
    }
    if (worn) worn.visible = on;
  };
  const update = () => {
    if (!player?.pos) return;
    wear(has() && !!player.inWater?.body?.sea?.helmet);
  };
  return { update, wear, dispose() { offRack(); for (const o of offs) o(); worn?.removeFromParent(); } };
}
