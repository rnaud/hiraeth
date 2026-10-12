import * as THREE from 'three';
import { kit, tint } from './market-kit.js';
import { glyphGeometry } from './story/sign-text.js';

// The screen lanes (issue #191, the author's picked direction A: references/levels/The Signal Market/environment/
// explorations/screen-lanes/). Behind the east towers' feet, a warren of narrow lanes walled with second-hand screens
// stacked to the first floors, each lit its own colour by day as by night (a face, a planet, a glyph, a test pattern),
// under awnings and cables, with dead ends off it and the screen-mender's bench in a little court. It runs from the
// stair up out of the old market (src/market-old.js) through the alley, up the back street and back west through
// another alley to the lantern market by the ship: the way home. A picture is passed from screen to screen ahead of
// you, the market's mark, white: before the tower speaks it leads toward the square, after it toward home; and once
// the tower has spoken every screen in the lanes shows the same face. No rng (a hash of each column's place).
//
//   LANES, LANE, BRANCHES (world [x, z])
//   buildScreenLanes(scene, M) → { group, line, sights, places, slots, picture, crowd, setOnAir(on), update(dt, t, player) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** The lanes' middle: from the old market's stair head in the alley east, up the back street, west to the avenue. */
export const LANES = [[56, -105], [72, -105], [82, -97], [84, -80], [94, -70], [94, -48], [86, -38], [86, -14], [94, -4], [90, 10], [78, 15], [60, 15], [41, 15]];
/** The lane: half its width between the screens' faces, the screens' depth. */
export const LANE = { half: 2.2, depth: 0.9 };
/** The dead ends off it, by how far along the lanes they open (m), on which side (+1 the left hand going home), how long; the mender's court is one. */
export const BRANCHES = [{ s: 30, side: -1, len: 8 }, { s: 92, side: 1, len: 7, half: 3.2, court: true }, { s: 146, side: -1, len: 9, big: true }, { s: 168, side: -1, len: 3.5 }];
/** The screens' colours (the night sheets' and the lane sheet's: violet, emerald, cobalt, lemon, scarlet, pink, aqua, orange). */
const HUES = ['#b89be0', '#4fb08a', '#4a78c8', '#f2d65a', '#d8524a', '#e88ab8', '#62c3c9', '#f09a4a', '#8f6fd0', '#7fc8e8'];
const FACE = '#c9b3ec', FACE_SKIN = '#ece2f6', FACE_DARK = '#7d62a8';

const hash = (a, b) => { let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** The lanes' middle as segments: { a, b, dir, n (the left hand), s0 (m along), len }. */
export function laneSegments(points = LANES) {
  const out = [];
  let s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = new THREE.Vector2(...points[i]), b = new THREE.Vector2(...points[i + 1]), len = a.distanceTo(b);
    const dir = b.clone().sub(a).divideScalar(len);
    out.push({ a, b, dir, n: new THREE.Vector2(-dir.y, dir.x), s0: s, len });
    s += len;
  }
  return out;
}
/** How far along the lanes a point is, and how far off their middle: { s, off }. */
export function alongLanes(x, z, segs = laneSegments()) {
  let best = { s: 0, off: Infinity };
  for (const g of segs) {
    const t = Math.max(0, Math.min(g.len, (x - g.a.x) * g.dir.x + (z - g.a.y) * g.dir.y));
    const off = Math.hypot(g.a.x + g.dir.x * t - x, g.a.y + g.dir.y * t - z);
    if (off < best.off) best = { s: g.s0 + t, off };
  }
  return best;
}

export function buildScreenLanes(scene, M) {
  const K = kit('The screen lanes'), segs = laneSegments(), total = segs.at(-1).s0 + segs.at(-1).len;
  const faces = kit('The screen lanes: the screens'), after = kit('The screen lanes: the face');
  const slots = [];
  let col = 0;
  /** A column of stacked screens: centre (x, z), facing (fx, fz) into the lane, w wide; the screens on its face. */
  const column = (x, z, fx, fz, w, s) => {
    const k = col++, n = 2 + Math.floor(hash(k, 7) * 3), yaw = Math.atan2(fx, fz);
    let y = 0;
    const hs = Array.from({ length: n }, (_, i) => 0.8 + hash(k, i + 11) * 0.5);
    const H = hs.reduce((a, b) => a + b, 0);
    K.box(x, H / 2, z, w, H, LANE.depth, M.casing, true, yaw);
    // a bezel band between the screens, and the cables down its side
    hs.forEach((h, i) => {
      const cy = y + h / 2, hue = HUES[Math.floor(hash(k, i + 31) * HUES.length)], motif = Math.floor(hash(k, i + 47) * 4);
      const fw = w - 0.2, fh = h - 0.2, front = LANE.depth / 2 + 0.012;
      const place = (g, dz = 0) => g.translate(0, 0, front + dz).rotateY(yaw).translate(x, cy, z);
      faces.add(place(tint(new THREE.PlaneGeometry(fw, fh), hue)), M.screens, false);
      // what it shows: a test card's bars, a planet, a head, a glyph
      if (motif === 0) for (let j = 0; j < 3; j++) faces.add(place(tint(new THREE.PlaneGeometry(fw * 0.26, fh * 0.7).translate((j - 1) * fw * 0.3, 0, 0), HUES[(Math.floor(hash(k, i) * 9) + j * 3) % HUES.length]), 0.004), M.screens, false);
      else if (motif === 1) {
        faces.add(place(tint(new THREE.CircleGeometry(Math.min(fw, fh) * 0.34, 12).translate(fw * 0.08, -fh * 0.05, 0), HUES[(Math.floor(hash(k, i + 5) * 10) + 3) % HUES.length]), 0.004), M.screens, false);
        faces.add(place(tint(new THREE.RingGeometry(Math.min(fw, fh) * 0.4, Math.min(fw, fh) * 0.45, 14).scale(1.4, 0.35, 1).translate(fw * 0.08, -fh * 0.05, 0), '#f5ead2'), 0.006), M.screens, false);
      } else if (motif === 2) {
        faces.add(place(tint(new THREE.CircleGeometry(fh * 0.24, 12).scale(0.8, 1, 1).translate(0, fh * 0.08, 0), '#f1e4f6'), 0.004), M.screens, false);
        faces.add(place(tint(new THREE.CircleGeometry(fh * 0.34, 12, 0, Math.PI).translate(0, -fh * 0.5, 0), '#8e74bb'), 0.004), M.screens, false);
      } else {
        for (const [gx, gy] of [[-0.18, 0.12], [0, 0.2], [0.18, 0.12]]) faces.add(place(tint(new THREE.CircleGeometry(fh * 0.07, 8).translate(gx * fw, gy * fh, 0), '#fff6d8'), 0.004), M.screens, false);
        faces.add(place(tint(new THREE.PlaneGeometry(fw * 0.5, fh * 0.08).translate(0, -fh * 0.12, 0), '#fff6d8'), 0.004), M.screens, false);
      }
      // the same screen once the tower has spoken: the face (the lane sheet's wall of one face, screen after screen)
      after.add(place(tint(new THREE.PlaneGeometry(fw, fh), FACE)), M.screens, false);
      after.add(place(tint(new THREE.CircleGeometry(fh * 0.26, 14).scale(0.78, 1, 1).translate(0, fh * 0.06, 0), FACE_SKIN), 0.004), M.screens, false);
      after.add(place(tint(new THREE.CircleGeometry(fh * 0.4, 14, 0, Math.PI).translate(0, -fh * 0.5, 0), FACE_DARK), 0.004), M.screens, false);
      for (const ex of [-0.07, 0.07]) after.add(place(tint(new THREE.PlaneGeometry(fh * 0.07, fh * 0.018).translate(ex * fh, fh * 0.1, 0), FACE_DARK), 0.008), M.screens, false);
      if (cy > 1.1 && cy < 2.4) slots.push({ s, at: V(x + fx * (front + 0.02), cy, z + fz * (front + 0.02)), yaw, w: fw, h: fh });
      y += h;
    });
    // a little set on top, now and then
    if (hash(k, 3) < 0.3) K.box(x, H + 0.28, z, w * 0.55, 0.56, 0.6, M.casing, true, yaw);   // (solid: you climb onto these walls)
    return H;
  };
  // ---------------------------------------------------------------- the walls of screens along both sides
  const off = LANE.half + LANE.depth / 2;
  const gapAt = (s, side) => BRANCHES.some((b) => b.side === side && Math.abs(s - b.s) < (b.half ?? LANE.half) + 0.25);
  for (const g of segs) for (const side of [-1, 1]) {
    const nx = g.n.x * side, nz = g.n.y * side;
    let t = 0.7;
    while (t < g.len - 0.7) {
      const s = g.s0 + t, w = 1.0 + hash(Math.round(s * 10), side) * 0.6;
      if (t + w > g.len - 0.4) break;
      const cs = t + w / 2;
      if (!gapAt(g.s0 + cs, side)) column(g.a.x + g.dir.x * cs + nx * off, g.a.y + g.dir.y * cs + nz * off, -nx, -nz, w, g.s0 + cs);
      t += w + 0.04;
    }
  }
  // ---------------------------------------------------------------- the dead ends and the mender's court
  const places = {};
  const segAt = (s) => segs.find((g) => s >= g.s0 && s <= g.s0 + g.len) ?? segs.at(-1);
  for (const b of BRANCHES) {
    const g = segAt(b.s), t = b.s - g.s0, h = b.half ?? LANE.half;
    const o = V(g.a.x + g.dir.x * t, 0, g.a.y + g.dir.y * t), out = V(g.n.x * b.side, 0, g.n.y * b.side), along = V(g.dir.x, 0, g.dir.y);
    // its two walls from the lane's wall out, and the end wall
    for (const k of [-1, 1]) for (let u = LANE.half + 0.6; u < LANE.half + b.len; u += 1.3) {
      const p = o.clone().addScaledVector(out, u + 0.65).addScaledVector(along, k * (h + LANE.depth / 2));
      column(p.x, p.z, -along.x * k, -along.z * k, 1.25, b.s);
    }
    for (let v = -h + 0.6; v < h - 0.3; v += 1.3) {
      const p = o.clone().addScaledVector(out, LANE.half + b.len + LANE.depth / 2 + 0.1).addScaledVector(along, v + 0.6);
      column(p.x, p.z, -out.x, -out.z, 1.25, b.s);
    }
    if (b.big) {
      // at the dead end's end, the biggest set in the lanes on a stack of crates, its own picture (a planet over a horizon)
      const c = o.clone().addScaledVector(out, LANE.half + b.len - 0.9), yaw = Math.atan2(-out.x, -out.z);
      K.box(c.x, 0.4, c.z, 2.6, 0.8, 1.4, M.wood, true, yaw);
      K.box(c.x, 1.85, c.z, 2.4, 2.1, 1.3, M.casing, true, yaw);
      const face = (g, hex, dz = 0) => faces.add(tint(g, hex).translate(0, 0, 0.66 + dz).rotateY(yaw).translate(c.x, 1.85, c.z), M.screens, false);
      face(new THREE.PlaneGeometry(2.0, 1.7), '#4a78c8');
      face(new THREE.CircleGeometry(0.5, 16).translate(0.25, 0.2, 0), '#f09a4a', 0.004);
      face(new THREE.PlaneGeometry(2.0, 0.45).translate(0, -0.62, 0), '#4fb08a', 0.006);
      after.add(tint(new THREE.PlaneGeometry(2.0, 1.7), FACE).translate(0, 0, 0.66).rotateY(yaw).translate(c.x, 1.85, c.z), M.screens, false);
      after.add(tint(new THREE.CircleGeometry(0.42, 16).scale(0.78, 1, 1).translate(0, 0.1, 0), FACE_SKIN).translate(0, 0, 0.664).rotateY(yaw).translate(c.x, 1.85, c.z), M.screens, false);
      places.bigSet = c.clone().addScaledVector(out, -1.6).setY(0);
    }
    if (b.court) {
      // the mender's bench: a workbench with a set opened up on it, a lamp, a stool; the mender at it (drawn)
      const c = o.clone().addScaledVector(out, LANE.half + b.len - 1.2), yaw = Math.atan2(out.x, out.z);
      K.box(c.x, 0.45, c.z, 2.4, 0.9, 1.0, M.wood, true, yaw);
      K.box(c.x, 0.93, c.z, 2.5, 0.06, 1.1, M.brass, true, yaw);
      K.box(c.x + along.x * 0.5, 1.21, c.z + along.z * 0.5, 0.7, 0.5, 0.55, M.casing, false, yaw);
      faces.add(tint(new THREE.PlaneGeometry(0.5, 0.36), '#e88ab8').translate(0, 0, -0.29).rotateY(yaw).translate(c.x + along.x * 0.5, 1.21, c.z + along.z * 0.5), M.screens, false);
      after.add(tint(new THREE.PlaneGeometry(0.5, 0.36), FACE).translate(0, 0, -0.29).rotateY(yaw).translate(c.x + along.x * 0.5, 1.21, c.z + along.z * 0.5), M.screens, false);
      K.add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4).translate(c.x - along.x * 0.8, 1.26, c.z - along.z * 0.8), M.ink, false);
      K.add(new THREE.IcosahedronGeometry(0.13, 0).translate(c.x - along.x * 0.8, 1.6, c.z - along.z * 0.8), M.lamp, false);
      const m = c.clone().addScaledVector(out, -1.2);
      K.add(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8).translate(m.x, 0.25, m.z), M.wood);
      K.add(new THREE.SphereGeometry(1, 10, 8).scale(0.42, 0.55, 0.36).translate(m.x, 0.95, m.z), M.overalls, false);
      K.add(new THREE.SphereGeometry(0.2, 10, 8).translate(m.x + out.x * 0.12, 1.62, m.z + out.z * 0.12), M.skin, false);
      for (const k of [-1, 1]) K.add(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8).rotateX(Math.PI / 2).rotateY(yaw).translate(m.x + out.x * 0.3 + along.x * k * 0.08, 1.66, m.z + out.z * 0.3 + along.z * k * 0.08), M.brass, false);
      places.mender = m.clone().setY(0);
      places.bench = c.clone().setY(0.96);
    }
  }
  // ---------------------------------------------------------------- awnings and cables over the lanes, paper lamps
  const lamps = [];
  for (let s = 6; s < total - 4; s += 9) {
    const g = segAt(s), t = s - g.s0, p = V(g.a.x + g.dir.x * t, 0, g.a.y + g.dir.y * t), yaw = Math.atan2(-g.n.y, g.n.x);   // (its length across the lane)
    const k = Math.round(s), hue = M.cloth[k % M.cloth.length];
    K.add(new THREE.BoxGeometry(2 * off + 1.2, 0.08, 2.2).rotateZ(0.12 * (k % 2 ? 1 : -1)).rotateY(yaw).translate(p.x, 4.55 + (k % 3) * 0.25, p.z), hue);
    K.tube([[p.x + g.n.x * off, 5.3, p.z + g.n.y * off], [p.x + g.dir.x * 2, 4.9, p.z + g.dir.y * 2], [p.x - g.n.x * off + g.dir.x * 4, 5.4, p.z - g.n.y * off + g.dir.y * 4]], 0.025, M.ink);
    if (k % 2 === 0) {
      const lp = p.clone().addScaledVector(V(g.dir.x, 0, g.dir.y), 4.5);
      K.add(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 3).translate(lp.x, 4.0, lp.z), M.ink, 'floats');
      K.add(new THREE.IcosahedronGeometry(0.24, 0).scale(1, 1.3, 1).translate(lp.x, 3.2, lp.z), M.lamp);
      lamps.push(lp.clone().setY(3.2));
    }
  }
  const group = K.done(scene), screens = faces.done(scene), face = after.done(scene);
  face.visible = false;
  // ---------------------------------------------------------------- the picture passed from screen to screen
  const picture = new THREE.Group();
  picture.name = 'The screen lanes: the picture';
  {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.pictureLit);
    const mark = new THREE.Mesh(glyphGeometry(0.62, 0.01).translate(0, 0.02, 0.01), M.ink);
    plate.userData.noCollide = mark.userData.noCollide = true;
    picture.add(plate, mark);
    picture.userData.noCollide = true;
  }
  scene.add(picture);
  const P = { slot: null, pop: 0, toward: -1 };
  const place = (slot) => {
    P.slot = slot; P.pop = 0.25;
    picture.position.copy(slot.at);
    picture.rotation.set(0, slot.yaw, 0);
    picture.scale.set(slot.w, slot.h, 1);
    picture.visible = true;
  };
  place(slots.reduce((b, q) => (Math.abs(q.s - total) < Math.abs(b.s - total) ? q : b), slots[0]));
  const line = [...LANES.map(([x, z]) => [x, 0, z]), [36, 0, 9], [24, 0, 6], [12, 0, 40], [4, 0, 79]];
  const sights = [{ name: 'the screen-mender’s bench', at: places.bench.clone() }, { name: 'the biggest set in the lanes', at: places.bigSet.clone() }];
  const crowd = {
    walks: [{ path: [V(LANES[1][0], 0, LANES[1][1]), V(LANES[3][0], 0, LANES[3][1]), V(LANES[5][0], 0, LANES[5][1])], n: 2, pair: 0.3, lateral: 0.2 },
      { path: [V(LANES[7][0], 0, LANES[7][1]), V(LANES[9][0], 0, LANES[9][1]), V(LANES[11][0], 0, LANES[11][1])], n: 2, pair: 0.3, lateral: 0.2 }],
    groups: [], edges: [],
  };
  return {
    group, screens, face, picture, slots, line, sights, places, lamps, crowd, total, segs,
    /** Once the tower has spoken: every screen the same face, and the picture leads home. */
    setOnAir(on) { face.visible = !!on; screens.visible = !on; P.toward = on ? 1 : -1; },
    get toward() { return P.toward; },
    /** The picture: a screen some ten metres ahead of you along the lanes, the way it leads. */
    update(dt, t, player) {
      if (P.pop > 0) { P.pop = Math.max(0, P.pop - dt); const k = 1 + P.pop * 0.6; picture.scale.set(P.slot.w * k, P.slot.h * k, 1); }
      const p = player?.pos;
      if (!p || p.y > 6 || p.y < -2) return;
      const { s, off: d } = alongLanes(p.x, p.z, segs);
      if (d > 9) return;
      const want = s + P.toward * 11;
      const ahead = (q) => (P.toward > 0 ? q.s > s + 5 : q.s < s - 5);
      if (P.slot && ahead(P.slot) && Math.abs(P.slot.s - want) < 5) return;
      let best = null;
      for (const q of slots) if (ahead(q) && (!best || Math.abs(q.s - want) < Math.abs(best.s - want))) best = q;
      if (best && best !== P.slot) place(best);
    },
  };
}
