// A temple's rooms built in node as the game builds them (src/temples/runtime.js with its layout, no world round it),
// with what the layout placed recorded: every piece (its class and options) and every room of the kit (its halls,
// round halls, vestibules and corridors, in the kit's local metres). The temple design audit (audit.mjs) and the
// redesign's rules (rules.mjs, tests/temple-rules.test.js) read them.
//
//   const { rt, pieces, spaces } = recordTemple(def)     (rt.dispose() when done)
import { TempleRuntime } from '../../src/temples/runtime.js';
import { TempleKit, ANTE } from '../../src/temples/kit.js';
import * as THREE from 'three';

let pieces = null, spaces = null;
const add = TempleRuntime.prototype.add;
TempleRuntime.prototype.add = function (Piece, o) { pieces?.push({ cls: Piece.name, o }); return add.call(this, Piece, o); };
// (the kit's rooms: what the rules measure a room by)
const wrap = (name, f) => {
  const was = TempleKit.prototype[name];
  TempleKit.prototype[name] = function (...a) { if (spaces) { const s = f.apply(this, a); if (s) spaces.push(s); } return was.apply(this, a); };
};
wrap('hall', ({ x = 0, z = 0, w, d, y = 0, h }) => ({ shape: 'box', x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y, top: y + h }));
// (a shaft is a well, not a room; but a well whose balconies are rooms, `well: true`, is measured as one: the Footprint's
// Heel Well, issue #401)
wrap('rotunda', ({ x = 0, z = 0, y = 0, r, h, oculus = 0.38, well = false }) => (oculus < 0 && !well ? null : { shape: 'round', x, z, r, y, top: y + h }));
wrap('vestibule', (z0, y, { x = 0 } = {}) => ({ shape: 'box', x0: x - ANTE.half, x1: x + ANTE.half, z0, z1: z0 + ANTE.len, y, top: y + ANTE.h, passage: true }));
wrap('corridor', (a, b, y, { w = 5, h = 6.4 } = {}) => {
  const alongZ = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]), s = w / 2 + 0.3;
  return alongZ ? { shape: 'box', x0: a[0] - s, x1: a[0] + s, z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]), y, top: y + h, passage: true }
    : { shape: 'box', x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: a[1] - s, z1: a[1] + s, y, top: y + h, passage: true };
});

const quiet = (f) => { const w = console.warn, l = console.log; console.warn = console.log = () => {}; try { return f(); } finally { console.warn = w; console.log = l; } };

/** Build def's rooms (no world, no outside, no change) and record its pieces and spaces. */
export function recordTemple(def) {
  pieces = []; spaces = [];
  try {
    const scene = new THREE.Scene();
    const rt = quiet(() => new TempleRuntime({ scene, level: { lights: [] }, def: { ...def, exterior: null, change: null } }));
    return { rt, scene, pieces, spaces };
  } finally { pieces = null; spaces = null; }
}
