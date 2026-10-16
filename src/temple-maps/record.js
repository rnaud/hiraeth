// The temple maps (issue #396; docs/systems/dev-tools.md "The temple maps"): a makers' temple built as the game builds it
// (src/temples/runtime.js with its layout, no world round it, no outside), with what its layout placed: every piece (its
// class and options, rt.placed, as scripts/temple-design/record.mjs records them for the design audit) and the kit's
// chart (src/temples/kit.js TempleKit.chart, the same the house's map in the game reads: its halls, round halls,
// corridors and walls with their doorways, then the floors: slabs and ledges, stairs, ramps, bridges, shafts, the
// antechamber), all in the kit's local metres.
//
//   const { rt, scene, pieces, plan } = buildTemple(def)     (rt.dispose?.() when done)
import * as THREE from 'three';
import { TempleRuntime } from '../temples/runtime.js';
import { chartPlan } from '../temples/house-plan.js';

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };

/** Build a makers' temple's rooms (def: src/temples/<world>.js, its `…_TEMPLE`) and read its pieces and its plan. */
export function buildTemple(def, { scene = new THREE.Scene() } = {}) {
  const rt = quiet(() => new TempleRuntime({ scene, level: { lights: [] }, def: { ...def, exterior: null, change: null } }));
  return { rt, scene, pieces: rt.placed, plan: chartPlan(rt.kit.chart) };
}
