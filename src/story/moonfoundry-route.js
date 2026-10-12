import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';

// The Moon Foundry's way up through the broken moon and on by the cranes (issue #193; the pieces: src/foundry-street.js,
// src/foundry-cranes.js, src/foundry-pour.js). The signal box's lever and the bell-pull at the lookout's jetty: the
// moon-carrier comes when called, or goes at once when it is already there.

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function setupMoonFoundryRoute(ctx) {
  const { level, sound, toast = () => {} } = ctx;
  const B = level?.signalBox, C = level?.cranes;
  if (!B || !C) return null;
  const offs = [];
  const pull = (end) => {
    const what = C.call(end);
    sound?.chime?.();
    toast(what === 'sent' ? 'The lever goes over. Chains run, and the moon-carrier swings away.' : 'A bell rings up under the roof. The moon-carrier is on its way.');
  };
  // (stood in the box, by the levers; stood at the jetty's end, by the bell)
  const lever = B.lever.clone(), bell = B.bell.clone().add(new THREE.Vector3(0, 1.1, 0));
  offs.push(registerInteractable({ id: 'moonfoundry.lever', priority: PRIORITY.use, range: 2.6, prompt: 'pull the lever',
    at: () => lever, distance: (p) => (Math.abs(p.pos.y - B.y) < 2 ? flat(p.pos, lever) : Infinity), use: () => pull(0) }));
  offs.push(registerInteractable({ id: 'moonfoundry.bell', priority: PRIORITY.use, range: 2.4, prompt: 'pull the bell-cord',
    at: () => bell, distance: (p) => (Math.abs(p.pos.y - bell.y + 1.1) < 2 ? flat(p.pos, bell) : Infinity), use: () => pull(1) }));
  return { dispose() { for (const o of offs) o?.(); } };
}
