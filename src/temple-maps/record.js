// The temple maps (issue #396; docs/systems/dev-tools.md "The temple maps"): a makers' temple built as the game builds it
// (src/temples/runtime.js with its layout, no world round it, no outside), with what its layout placed recorded: every
// piece (its class and options, as scripts/temple-design/record.mjs records them for the design audit) and the kit's
// plan (src/temples/kit.js TempleKit.plan: its halls, round halls, corridors and walls with their doorways), plus the
// floors the plan has no entry for (slabs and ledges, stairs, ramps, bridges, shafts, the antechamber), all in the
// kit's local metres.
//
//   const { rt, scene, pieces, plan } = buildTemple(def)     (rt.dispose?.() when done)
import * as THREE from 'three';
import { TempleRuntime } from '../temples/runtime.js';
import { TempleKit, ANTE } from '../temples/kit.js';

let rec = null;   // { pieces, plans: Map(kit → [entries]), extra: Map(kit → [entries]) } while a temple is built
const planOf = (kit) => {
  // (the kit records its own plan while `plan` is an array: a house's skin may have set one already, kept as it is)
  if (!kit.plan) kit.plan = [];
  if (!rec.plans.has(kit)) rec.plans.set(kit, kit.plan);
  return rec.plans.get(kit);
};
const extraOf = (kit) => { if (!rec.extra.has(kit)) rec.extra.set(kit, []); return rec.extra.get(kit); };

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  const add = TempleRuntime.prototype.add;
  TempleRuntime.prototype.add = function (Piece, o) { rec?.pieces.push({ cls: Piece.name, o }); return add.call(this, Piece, o); };
  // (the kinds the kit records itself: only its plan switched on)
  for (const name of ['hall', 'rotunda', 'corridor', 'wall']) {
    const was = TempleKit.prototype[name];
    TempleKit.prototype[name] = function (...a) { if (rec) planOf(this); return was.apply(this, a); };
  }
  // (the rest, kept apart: a skin reads the kit's own plan, src/temples/skins/)
  const extra = (name, f) => {
    const was = TempleKit.prototype[name];
    TempleKit.prototype[name] = function (...a) { if (rec) { const e = f.apply(this, a); if (e) extraOf(this).push(e); } return was.apply(this, a); };
  };
  extra('slab', (x0, z0, x1, z1, y = 0) => ({ kind: 'slab', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y }));
  extra('stairs', (a, b, w) => ({ kind: 'stairs', a: a.slice(0, 3), b: b.slice(0, 3), w }));
  extra('ramp', (a, b, w) => ({ kind: 'ramp', a: a.slice(0, 3), b: b.slice(0, 3), w }));
  extra('bridge', (a, b, w) => ({ kind: 'bridge', a: a.slice(0, 3), b: b.slice(0, 3), w }));
  extra('shaft', (x, z, r, y0, y1) => ({ kind: 'shaft', x, z, r, y: y0, top: y1 }));
  extra('vestibule', (z0, y, { x = 0 } = {}) => ({ kind: 'slab', x0: x - ANTE.half, x1: x + ANTE.half, z0, z1: z0 + ANTE.len, y, ante: true }));
}

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };

/** Build a makers' temple's rooms (def: src/temples/<world>.js, its `…_TEMPLE`) and record its pieces and its plan. */
export function buildTemple(def, { scene = new THREE.Scene() } = {}) {
  install();
  rec = { pieces: [], plans: new Map(), extra: new Map() };
  try {
    const rt = quiet(() => new TempleRuntime({ scene, level: { lights: [] }, def: { ...def, exterior: null, change: null } }));
    const plan = [...(rec.plans.get(rt.kit) ?? []), ...(rec.extra.get(rt.kit) ?? [])];
    return { rt, scene, pieces: rec.pieces, plan };
  } finally { rec = null; }
}
