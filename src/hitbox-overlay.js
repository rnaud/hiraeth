import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { collectHitboxes, hitboxes } from './hitboxes.js';

// The hitbox overlay (docs/systems/foes.md, "Hitboxes"): src/hitboxes.js's shapes drawn on top of the finished
// frame, outside the game's scene (no G-buffer, no shadows, no collisions), in lines of a few pixels and see-through
// floors, with words over the foes. While off nothing is collected, built or drawn.
//
//   const overlay = new HitboxOverlay({ player, tool, foes, gadgets: () => gadgets })
//   overlay.render(renderer, camera, target)   after the frame's composite (main.js renderFrame)

const MAX_LINES = 6000, MAX_TRIS = 3000;
const _c = new THREE.Color(), _rgb = { r: 0, g: 0, b: 0 }, _p = new THREE.Vector3();

/** Lines and fills from shapes, into plain arrays (the tests read them too). */
export class HitboxBuilder {
  constructor() { this.reset(); }
  reset() { this.strong = { pos: [], col: [] }; this.faint = { pos: [], col: [] }; this.fill = { pos: [], col: [] }; this.labels = []; }
  rgb(hex) { _c.setStyle(hex); _c.getRGB(_rgb, THREE.SRGBColorSpace); return [_rgb.r, _rgb.g, _rgb.b]; }   // (the composite's target takes sRGB values as they are)
  line(a, b, color, faint = false) {
    const L = faint ? this.faint : this.strong, c = this.rgb(color);
    L.pos.push(a.x, a.y, a.z, b.x, b.y, b.z); L.col.push(...c, ...c);
  }
  tri(a, b, c, color, alpha) {
    const k = this.rgb(color);
    this.fill.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.fill.col.push(...k, alpha);
  }
  /** A polyline through pts (closed: back to the first); dashed: every other step. */
  poly(pts, color, { faint = false, dashed = false, closed = false } = {}) {
    const n = pts.length - (closed ? 0 : 1);
    for (let i = 0; i < n; i++) if (!dashed || i % 2 === 0) this.line(pts[i], pts[(i + 1) % pts.length], color, faint);
  }
  /** Points on a circle round c in the plane spanned by u, w. */
  ring(c, r, u, w, n = 40) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r)); }
    return out;
  }
  shape(s) {
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const o = { faint: !!s.faint, dashed: !!s.dashed, closed: true }, col = s.color;
    const steps = (r) => Math.max(24, Math.min(96, Math.round(r * 10)));
    switch (s.kind) {
      case 'sphere':
        for (const [u, w] of [[X, Z], [X, Y], [Z, Y]]) this.poly(this.ring(s.c, s.r, u, w, 28), col, o);
        break;
      case 'circle': {
        const c = s.c.clone(); c.y += 0.04;
        const pts = this.ring(c, s.r, X, Z, steps(s.r));
        this.poly(pts, col, o);
        if (s.fill) for (let i = 0; i < pts.length; i++) this.tri(c, pts[i], pts[(i + 1) % pts.length], col, s.fill);
        break;
      }
      case 'fan': {
        const c = s.c.clone(); c.y += 0.04;
        const n = Math.max(8, Math.round(s.angle * 16)), r0 = s.r0 ?? 0, arc = [], inner = [];
        for (let i = 0; i <= n; i++) {
          const a = s.h - s.angle + (2 * s.angle * i) / n, d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
          arc.push(c.clone().addScaledVector(d, s.range)); inner.push(c.clone().addScaledVector(d, r0));
        }
        this.poly(arc, col, { ...o, closed: false });
        if (r0 > 0) this.poly(inner, col, { ...o, closed: false, faint: true });
        if (s.angle < Math.PI - 1e-3) { this.line(inner[0], arc[0], col, o.faint); this.line(inner[n], arc[n], col, o.faint); }
        if (s.fill) for (let i = 0; i < n; i++) { this.tri(inner[i], arc[i], arc[i + 1], col, s.fill); if (r0 > 0) this.tri(inner[i], arc[i + 1], inner[i + 1], col, s.fill); }
        break;
      }
      case 'lane': {
        const c = s.c.clone(); c.y += 0.04;
        const f = new THREE.Vector3(Math.sin(s.h), 0, Math.cos(s.h)), side = new THREE.Vector3(f.z, 0, -f.x), hw = s.width / 2;
        const q = [[-(s.back ?? 0), -hw], [s.range, -hw], [s.range, hw], [-(s.back ?? 0), hw]].map(([a, b]) => c.clone().addScaledVector(f, a).addScaledVector(side, b));
        this.poly(q, col, o);
        if (s.fill) { this.tri(q[0], q[1], q[2], col, s.fill); this.tri(q[0], q[2], q[3], col, s.fill); }
        break;
      }
      case 'box': {
        // (its 8 corners through its world matrix, 12 edges)
        const b = s.box, P = [];
        for (let k = 0; k < 8; k++) P.push(new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(s.m));
        for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.line(P[i], P[j], col, o.faint);
        break;
      }
      case 'segment': this.line(s.a, s.b, col, o.faint); if (s.thick) { _p.set(0, 0.015, 0); this.line(s.a.clone().add(_p), s.b.clone().add(_p), col); } break;
      case 'sweep':
        this.line(s.a0, s.a1, col, true); this.line(s.b0, s.b1, col, true); this.line(s.a0, s.b0, col, true);
        if (s.fill) { this.tri(s.a0, s.b0, s.b1, col, s.fill); this.tri(s.a0, s.b1, s.a1, col, s.fill); }
        break;
      case 'column': {
        const feet = s.c.clone(), lo = feet.clone(), hi = feet.clone(); lo.y += s.h0; hi.y += s.h1;
        this.poly(this.ring(feet.clone().setY(feet.y + 0.04), s.r, X, Z, 24), col, o);
        this.poly(this.ring(hi, s.r * 0.6, X, Z, 16), col, { ...o, faint: true, dashed: true });
        this.poly(this.ring(lo, s.r * 0.6, X, Z, 16), col, { ...o, faint: true, dashed: true });
        this.line(lo, hi, col, true);
        this.line(feet.clone().add(new THREE.Vector3(-s.r, 0.04, 0)), feet.clone().add(new THREE.Vector3(s.r, 0.04, 0)), col);
        this.line(feet.clone().add(new THREE.Vector3(0, 0.04, -s.r)), feet.clone().add(new THREE.Vector3(0, 0.04, s.r)), col);
        break;
      }
      case 'diamond': {
        const c = s.c, r = s.r, P = [X, Y, Z, X.clone().negate(), Y.clone().negate(), Z.clone().negate()].map((d) => c.clone().addScaledVector(d, r * (d.y ? 1.4 : 1)));
        for (const a of [0, 2, 3, 5]) { this.line(P[1], P[a], col, o.faint); this.line(P[4], P[a], col, o.faint); }
        this.poly([P[0], P[2], P[3], P[5]], col, o);
        break;
      }
      case 'label': this.labels.push(s); break;
    }
  }
  build(shapes) { this.reset(); for (const s of shapes) this.shape(s); return this; }
}

/** A LineSegments2 with room for `max` segments, written in place each frame (no new GPU buffers). */
function lineLayer(width, opacity) {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(new Float32Array(MAX_LINES * 6)); geo.setColors(new Float32Array(MAX_LINES * 6));
  const mat = new LineMaterial({ linewidth: width, vertexColors: true, transparent: opacity < 1, opacity, depthTest: false, depthWrite: false });
  const mesh = new LineSegments2(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 10;
  return mesh;
}
function writeLines(mesh, L) {
  const geo = mesh.geometry, n = Math.min(MAX_LINES, L.pos.length / 6);
  const P = geo.attributes.instanceStart.data, C = geo.attributes.instanceColorStart.data;
  P.array.set(L.pos.length > MAX_LINES * 6 ? L.pos.slice(0, MAX_LINES * 6) : L.pos); C.array.set(L.col.length > MAX_LINES * 6 ? L.col.slice(0, MAX_LINES * 6) : L.col);
  P.needsUpdate = true; C.needsUpdate = true;
  geo.instanceCount = n;
  mesh.visible = n > 0;
}

export class HitboxOverlay {
  constructor({ player, tool = null, foes = null, gadgets = () => null } = {}) {
    Object.assign(this, { player, tool, foes, gadgets });
    this.scene = new THREE.Scene();
    this.strong = lineLayer(2.6, 1); this.faint = lineLayer(1.4, 0.55);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRIS * 9), 3).setUsage(THREE.DynamicDrawUsage));
    fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRIS * 12), 4).setUsage(THREE.DynamicDrawUsage));
    this.fill = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    this.fill.frustumCulled = false; this.fill.renderOrder = 5;
    this.scene.add(this.fill, this.faint, this.strong);
    this.builder = new HitboxBuilder(); this.prev = {};
    this.labelEls = [];
    this.off = hitboxes.listen((on) => { if (!on) this.hideLabels(); this.prev = {}; });
  }

  get on() { return hitboxes.on; }

  render(renderer, camera, target) {
    if (!hitboxes.on || !this.player) return;
    const shapes = collectHitboxes({ player: this.player, tool: this.tool, foes: this.foes, gadgets: this.gadgets?.() }, this.prev);
    const B = this.builder.build(shapes);
    writeLines(this.strong, B.strong); writeLines(this.faint, B.faint);
    const fg = this.fill.geometry, nt = Math.min(MAX_TRIS * 3, B.fill.pos.length / 3);
    fg.attributes.position.array.set(B.fill.pos.slice(0, nt * 3)); fg.attributes.color.array.set(B.fill.col.slice(0, nt * 4));
    fg.attributes.position.needsUpdate = true; fg.attributes.color.needsUpdate = true;
    fg.setDrawRange(0, nt); this.fill.visible = nt > 0;
    const w = target?.width ?? renderer.domElement.width, h = target?.height ?? renderer.domElement.height;
    this.strong.material.resolution.set(w, h); this.faint.material.resolution.set(w, h);
    renderer.render(this.scene, camera);
    this.placeLabels(B.labels, camera);
  }

  placeLabels(labels, camera) {
    if (typeof document === 'undefined') return;
    if (!this.labelRoot) {
      this.labelRoot = Object.assign(document.createElement('div'), { id: 'hitbox-labels' });
      this.labelRoot.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:23;overflow:hidden';
      document.body.appendChild(this.labelRoot);
    }
    let n = 0;
    for (const l of labels) {
      const p = _p.copy(l.c).project(camera);
      if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) continue;
      const el = this.labelEls[n] ?? (this.labelEls[n] = this.labelRoot.appendChild(document.createElement('div')));
      el.style.cssText = `position:absolute;left:${(p.x * 0.5 + 0.5) * 100}%;top:${(0.5 - p.y * 0.5) * 100}%;transform:translate(-50%,${l.lift ? '-190%' : '-100%'});white-space:nowrap;font:600 11px ui-monospace,Menlo,monospace;color:${l.color};background:rgba(20,16,24,.72);padding:1px 5px;border-radius:3px;letter-spacing:.02em`;
      if (el.textContent !== l.text) el.textContent = l.text;
      n++;
    }
    for (let i = n; i < this.labelEls.length; i++) this.labelEls[i].style.display = 'none';
  }

  hideLabels() { for (const el of this.labelEls) el.style.display = 'none'; }

  dispose() { this.off?.(); this.labelRoot?.remove(); for (const m of [this.strong, this.faint, this.fill]) { m.geometry.dispose(); m.material.dispose(); } }
}
