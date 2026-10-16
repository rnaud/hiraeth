// The generous cut drawn (issue #368; the fight temples: fluid-blade.js WIDE_CUT). The cut there takes every foe a
// crescent round him reaches, wider and further than the sword itself; v1.77 hit that far with nothing drawn, so foes
// fell well past the blade. Now the crescent is drawn: a flat sweep of the sword's own water at his waist, laid as
// the swing goes (its leading edge where the cut has reached), its outer edge a bright line exactly at the reach,
// thinning from its inner edge out once the cut is through. What it covers is what the cut takes: the hits read the
// same state (FluidBlade.slash: the sweep, how far through it, the reach, his place and the cut's way).
//
//   const arc = new SlashArc(tool.fx);
//   arc.tint([body, edge]);           the sword's water (a fight temple's colours worn), or the fury's ember
//   arc.update(dt, blade.slash);      each frame (null: nothing drawn)

import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { WAKE_TONES } from './fluid-sword.js';

/**
 * The look: `segments` along the sweep; `width` m in from the outer edge at the leading edge (its tail `tail` of
 * that), its bright edge `edge` m wide, at `height` m over his feet; `linger` s it stays once the cut is through,
 * thinning to its outer edge.
 */
export const SLASH_LOOK = { segments: 28, width: 0.8, tail: 0.45, edge: 0.1, height: 0.75, linger: 0.2 };

/** Offset `o` rad off the flat way `dir` (+ his left: about +y), as a flat unit vector. */
export const sweepDir = (dir, o, out = new THREE.Vector3()) => {
  const c = Math.cos(o), s = Math.sin(o);
  return out.set(dir.x * c + dir.z * s, 0, -dir.x * s + dir.z * c).normalize();
};

/**
 * The crescent's rings at sample `s` (0 its start .. 1 the whole sweep) laid `u` of the way, `fade` (0 fresh .. 1 gone)
 * after the cut is through: [inner, outer] m from his axis, or null where nothing is drawn (not reached yet).
 * The outer is the reach itself, always; the width grows toward the leading edge and thins out as it fades.
 */
export function slashBand(s, u, reach, fade = 0, L = SLASH_LOOK) {
  if (!(u > 0) || s > u + 1e-6) return null;
  const lead = u > 1e-4 ? s / u : 1;
  const w = L.width * (L.tail + (1 - L.tail) * lead) * Math.max(0, 1 - fade) ** 1.5;
  return [Math.max(0.25, reach - w), reach];
}

/** A flat strip of `n` segments (two rings of points), its own material: { mesh, pos }. */
function strip(n, color, glow, name, order) {
  const pos = new Float32Array((n + 1) * 2 * 3), nrm = new Float32Array((n + 1) * 2 * 3);
  for (let i = 0; i < (n + 1) * 2; i++) nrm[i * 3 + 1] = 1;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const idx = [];
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, makeMaterial({ color, flat: true, glow, side: THREE.DoubleSide, key: `slash-arc-${name}` }));
  mesh.name = `slash arc ${name}`; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = order;
  mesh.userData.noCollide = true; mesh.userData.dynamic = true;
  return { mesh, pos, geo: g };
}

export class SlashArc {
  constructor(parent, L = SLASH_LOOK) {
    this.L = L;
    this.body = strip(L.segments, WAKE_TONES[0], 0.75, 'body', 3);
    this.edge = strip(L.segments, '#fff6dc', 0.95, 'edge', 4);
    this.pos = this.body.pos;   // (the checks: the body's points, outer at odd places)
    this.group = new THREE.Group();
    this.group.name = 'slash arc'; this.group.userData.noCollide = true;
    this.group.add(this.body.mesh, this.edge.mesh);
    parent?.add(this.group);
    this._d = new THREE.Vector3();
    this.drawn = null;   // (the last frame's: { from, to, u, reach, inner } for the checks)
  }

  /** The body's and the edge's colours ([body, edge]: colours or css strings). */
  tint(tones) {
    if (!tones?.length) return;
    const set = (m, c) => { const u = m.material.uniforms?.uColor?.value; if (!u || !c) return; if (c.isColor) u.copy(c); else u.set(c); };
    set(this.body.mesh, tones[0]); set(this.edge.mesh, tones[1] ?? tones[0]);
  }

  /**
   * `slash` (FluidBlade.slash): { sweep: { from, to }, u (0..1 through the cut), reach, at (his feet), dir (the cut's
   * flat way), done (s since the cut went through, or -1) }, or null.
   */
  update(dt, slash) {
    const L = this.L, S = slash;
    const fade = S && S.done >= 0 ? S.done / L.linger : 0;
    if (!S || fade >= 1 || !(S.u > 0)) { this.body.mesh.visible = this.edge.mesh.visible = false; this.drawn = null; return; }
    const N = L.segments, { from, to } = S.sweep, y = S.at.y + L.height;
    const head = slashBand(S.u, S.u, S.reach, fade, L);
    let inner = Infinity;
    const put = (P, o, d, r0, r1) => {
      P[o * 3] = S.at.x + d.x * r0; P[o * 3 + 1] = y; P[o * 3 + 2] = S.at.z + d.z * r0;
      P[o * 3 + 3] = S.at.x + d.x * r1; P[o * 3 + 4] = y + 0.01; P[o * 3 + 5] = S.at.z + d.z * r1;
    };
    for (let i = 0; i <= N; i++) {
      const s = i / N, b = slashBand(s, S.u, S.reach, fade, L);
      // (past the leading edge: folded onto it, nothing drawn)
      const at = b ? s : S.u, band = b ?? head;
      if (b) inner = Math.min(inner, b[0]);
      const d = sweepDir(S.dir, from + (to - from) * at, this._d), o = i * 2;
      put(this.body.pos, o, d, b ? band[0] : band[1], band[1]);
      const e = Math.min(L.edge, band[1] - band[0]);
      put(this.edge.pos, o, d, b ? band[1] - e : band[1], band[1]);
    }
    for (const P of [this.body, this.edge]) { P.geo.attributes.position.needsUpdate = true; P.geo.computeBoundingSphere(); P.mesh.visible = true; }
    this.drawn = { from, to: from + (to - from) * S.u, u: S.u, reach: S.reach, inner };
  }

  dispose() { this.group.removeFromParent(); this.body.geo.dispose(); this.edge.geo.dispose(); }
}
