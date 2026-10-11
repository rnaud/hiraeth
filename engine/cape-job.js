// The people's capes simulated by an engine (src/cape.js CAPE_HOST): what Cape.update hands over, packed for the
// engine, and the steps done on it in JavaScript as the engine's job does them (BridgeCape.cs is this, line for line,
// in a Burst job). The tests run a cape through this against the same cape simulated by cape.js itself.
//
//   packCapeDesc(cape)               once: its grid, its constraints (rest, stiffness; seated: theirs), each point's
//                                    side (the wings' spread), its triangles (for the normals)
//   writeCapePacket(w, id, gid, pk)  an update: op 20 into a CommandWriter (engine/unity/pack.js)
//   new CapeJob(desc)                its state (P, Q), .packet(u32, f32, o) → words read: the update's steps run
import { OP } from './unity/pack.js';

/** cape.js's constants the job uses (BridgeCape.cs has the same; tests/cape-job.test.js reads them there). */
export const CAPE_K = { fold: 0.6, fieldEdge: 0.1, lift: 0.03, reach: 0.1, ground: 0.03 };

/** The packet's flags. */
export const CAPE_FLAG = { push: 1, carry: 2, field: 4, fieldData: 8 };

/**
 * A cape's description: u32 cols, rows, nCons, nIdx, then f32 cons × 4 nCons, seatedK × nCons, seatRest × nCons, side × n,
 * u32 idx × nIdx, then f32 back × cols (1: a column of its back panel, cape.js backCol; an older description ends before it).
 */
export function packCapeDesc(cape) {
  const { cols, rows } = cape, n = cols * rows, C = cape.cons, nc = C.length / 4, idx = cape.geo.index.array;
  const buf = new ArrayBuffer((4 + nc * 6 + n + idx.length + cols) * 4), u = new Uint32Array(buf), f = new Float32Array(buf);
  u[0] = cols; u[1] = rows; u[2] = nc; u[3] = idx.length;
  let o = 4;
  f.set(C, o); o += nc * 4;
  f.set(cape.seatedK, o); o += nc;
  f.set(cape.seatRest, o); o += nc;
  for (let i = 0; i < n; i++) f[o++] = Math.sign(cape.local[i * 3]) || 0;
  u.set(idx, o); o += idx.length;
  for (let c = 0; c < cols; c++) f[o++] = cape.backCol?.[c] ?? 0;
  return buf;
}

/** Words an update's packet takes after its op (for a reader that skips it). */
export function capePacketWords(u32, o, n) {
  const flags = u32[o + 2], cols = u32[o + 6], nc = u32[o + 5];
  let w = 7 + 8 + 15 + 1 + (flags & CAPE_FLAG.carry ? 16 : 0) + cols * 12 + nc * 16 + (flags & CAPE_FLAG.push ? n * 6 : 0);
  if (flags & CAPE_FLAG.fieldData) { const fn = u32[o + w]; w += 10 + fn * fn; }
  return w;
}

/**
 * op 20: i32 cape, i32 geometry (0: not mirrored yet), u32 flags, u32 steps, u32 iters, u32 colliders, u32 cols;
 * f32 h, damp, kv0, time, gravity, drag, flutter, carry; up, air, lag, right, floor (3 each); spread;
 * [the carry's matrix 16]; the pins cols × 12; the colliders × 16 (from a, b; to a, b; r, rb − r, cone, over);
 * [P, Q 3n each: pushed]; [the seat's field: u32 n, f32 half, step, ox, oy, oz, fx, fz, rx, rz, heights n × n].
 */
export function writeCapePacket(w, id, gid, pk, cape) {
  const n = cape.cols * cape.rows, caps = pk.caps, nc = caps.length, F = pk.field;
  const fieldData = !!F && cape._sentField !== F;
  const flags = (pk.push ? CAPE_FLAG.push : 0) | (pk.carry > 0 ? CAPE_FLAG.carry : 0) | (F ? CAPE_FLAG.field : 0) | (fieldData ? CAPE_FLAG.fieldData : 0);
  w.reserve(31 + 16 + cape.cols * 12 + nc * 16 + n * 6 + (fieldData ? 10 + F.n * F.n : 0) + 1);
  w.u(OP.cape); w.i(id); w.i(gid); w.u(flags); w.u(pk.steps); w.u(pk.iters); w.u(nc); w.u(cape.cols);
  for (const v of [pk.h, pk.damp, pk.kv0, pk.time, pk.gravity, pk.drag, pk.flutter, pk.carry]) w.f(v);
  for (const v of [pk.up, pk.air, pk.lag, pk.right, pk.floor]) { w.f(v.x); w.f(v.y); w.f(v.z); }
  w.f(pk.spread);
  if (pk.carry > 0) for (let i = 0; i < 16; i++) w.f(pk.mc[i]);
  for (let i = 0; i < cape.cols * 12; i++) w.f(pk.pins[i]);
  const K = pk.from;
  for (let j = 0; j < nc; j++) {
    const c = caps[j], q = j * 6;
    if (K) for (let k = 0; k < 6; k++) w.f(K[q + k]);
    else { w.f(c.a.x); w.f(c.a.y); w.f(c.a.z); w.f(c.b.x); w.f(c.b.y); w.f(c.b.z); }
    w.f(c.a.x); w.f(c.a.y); w.f(c.a.z); w.f(c.b.x); w.f(c.b.y); w.f(c.b.z);
    w.f(c.r); w.f(c.rb === undefined ? 0 : c.rb - c.r); w.f(c.rb === undefined ? 0 : 1); w.f(c.over ? 1 : c.under ? -1 : 0);
  }
  if (pk.push) { for (let i = 0; i < n * 3; i++) w.f(pk.P[i]); for (let i = 0; i < n * 3; i++) w.f(pk.Q[i]); }
  if (fieldData) {
    w.u(F.n); for (const v of [F.half, F.step, F.ox, F.oy, F.oz, F.fx, F.fz, F.rx, F.rz]) w.f(v);
    for (let i = 0; i < F.n * F.n; i++) w.f(F.h[i]);
    cape._sentField = F;
  }
}

/** One cape's steps, as BridgeCape.cs does them (JavaScript: the tests', and an engine without jobs). */
export class CapeJob {
  constructor(desc) {
    const u = new Uint32Array(desc), f = new Float32Array(desc);
    this.cols = u[0]; this.rows = u[1]; const nc = u[2], ni = u[3];
    let o = 4;
    this.cons = f.slice(o, o + nc * 4); o += nc * 4;
    this.seatedK = f.slice(o, o + nc); o += nc;
    this.seatRest = f.slice(o, o + nc); o += nc;
    const n = this.cols * this.rows;
    this.side = f.slice(o, o + n); o += n;
    this.idx = u.slice(o, o + ni); o += ni;
    this.back = o + this.cols <= f.length ? f.slice(o, o + this.cols) : new Float32Array(this.cols);
    this.P = new Float32Array(n * 3); this.Q = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    this.K = new Float64Array(0); this.field = null;
  }

  /** The update at o (after the op): its steps run. Returns the words read. */
  packet(u, f, o) {
    const o0 = o;
    o += 2;   // (the cape's id and its geometry's: the reader's)
    const flags = u[o++], steps = u[o++], iters = u[o++], nc = u[o++], cols = u[o++], rows = this.rows, n = cols * rows;
    const h = f[o++], damp = f[o++], kv0 = f[o++], time = f[o++], gravity = f[o++], drag = f[o++], flutter = f[o++], carry = f[o++];
    const V = () => { const v = [f[o], f[o + 1], f[o + 2]]; o += 3; return v; };
    const up = V(), air = V(), lag = V(), right = V(), floor = V(), spread = f[o++];
    let mc = null;
    if (flags & CAPE_FLAG.carry) { mc = f.subarray(o, o + 16); o += 16; }
    const pin = f.subarray(o, o + cols * 12); o += cols * 12;
    const caps = f.subarray(o, o + nc * 16); o += nc * 16;
    const P = this.P, Q = this.Q;
    if (flags & CAPE_FLAG.push) { P.set(f.subarray(o, o + n * 3)); o += n * 3; Q.set(f.subarray(o, o + n * 3)); o += n * 3; }
    if (flags & CAPE_FLAG.fieldData) {
      const fn = u[o++], F = { n: fn, half: f[o], step: f[o + 1], ox: f[o + 2], oy: f[o + 3], oz: f[o + 4], fx: f[o + 5], fz: f[o + 6], rx: f[o + 7], rz: f[o + 8] };
      o += 9; F.h = f.slice(o, o + fn * fn); o += fn * fn;
      this.field = F;
    }
    const F = flags & CAPE_FLAG.field ? this.field : null;
    // carried along with the body since the last update
    if (mc) {
      const m = mc;
      for (let i = 0; i < P.length; i += 3) {
        for (const A of [P, Q]) {
          const x = A[i], y = A[i + 1], z = A[i + 2];
          const ax = m[0] * x + m[4] * y + m[8] * z + m[12], ay = m[1] * x + m[5] * y + m[9] * z + m[13], az = m[2] * x + m[6] * y + m[10] * z + m[14];
          A[i] += (ax - x) * carry; A[i + 1] += (ay - y) * carry; A[i + 2] += (az - z) * carry;
        }
      }
    }
    const K = this.K.length >= nc * 11 ? this.K : (this.K = new Float64Array(Math.max(nc, 16) * 11));
    for (let k = 0; k < steps; k++) {
      const fr = (k + 1) / steps;
      // the colliders this step: fr of the way from where they were to where they are
      for (let j = 0; j < nc; j++) {
        const c = j * 16, q = j * 11;
        const ax = caps[c] + (caps[c + 6] - caps[c]) * fr, ay = caps[c + 1] + (caps[c + 7] - caps[c + 1]) * fr, az = caps[c + 2] + (caps[c + 8] - caps[c + 2]) * fr;
        const ex = caps[c + 3] + (caps[c + 9] - caps[c + 3]) * fr, ey = caps[c + 4] + (caps[c + 10] - caps[c + 4]) * fr, ez = caps[c + 5] + (caps[c + 11] - caps[c + 5]) * fr;
        const bx = ex - ax, by = ey - ay, bz = ez - az;
        K[q] = ax; K[q + 1] = ay; K[q + 2] = az; K[q + 3] = bx; K[q + 4] = by; K[q + 5] = bz;
        K[q + 6] = 1 / Math.max(bx * bx + by * by + bz * bz, 1e-8); K[q + 7] = caps[c + 12]; K[q + 8] = caps[c + 13]; K[q + 9] = caps[c + 14]; K[q + 10] = caps[c + 15];
      }
      // the collar pinned, the second row softly
      for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) {
        const i = (r * cols + c) * 3, po = (r * cols + c) * 6, w = r === 0 ? 1 : 0.35;
        const x = pin[po] + pin[po + 3] * fr, y = pin[po + 1] + pin[po + 4] * fr, z = pin[po + 2] + pin[po + 5] * fr;
        P[i] += (x - P[i]) * w; P[i + 1] += (y - P[i + 1]) * w; P[i + 2] += (z - P[i + 2]) * w;
        if (r === 0) { Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2]; }
      }
      const kv = damp * (k === 0 ? kv0 : 1), pv = 1 / h;
      for (let r = 1; r < rows; r++) {
        const tr = r / (rows - 1);
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 3;
          const vx = (P[i] - Q[i]) * kv, vy = (P[i + 1] - Q[i + 1]) * kv, vz = (P[i + 2] - Q[i + 2]) * kv;
          Q[i] = P[i]; Q[i + 1] = P[i + 1]; Q[i + 2] = P[i + 2];
          const fl = 1 + flutter * Math.sin(time * 6 + c * 1.7 + r * 0.9), kd = drag * tr * fl;
          let ax = -up[0] * gravity + (air[0] - vx * pv) * kd - lag[0];
          let ay = -up[1] * gravity + (air[1] - vy * pv) * kd - lag[1];
          let az = -up[2] * gravity + (air[2] - vz * pv) * kd - lag[2];
          if (spread) { const sd = this.side[r * cols + c]; ax += right[0] * sd * 14 * spread * tr; ay += right[1] * sd * 14 * spread * tr; az += right[2] * sd * 14 * spread * tr; }
          P[i] += vx + ax * h * h; P[i + 1] += vy + ay * h * h; P[i + 2] += vz + az * h * h;
        }
      }
      for (let it = 0; it < iters; it++) {
        const C = this.cons, SK = F ? this.seatedK : null, SR = this.seatRest;
        for (let k2 = 0; k2 < C.length; k2 += 4) {
          const i = C[k2] * 3, j = C[k2 + 1] * 3;
          let rest = SK ? SR[k2 >> 2] : C[k2 + 2], st = SK ? SK[k2 >> 2] : C[k2 + 3];
          const dx = P[j] - P[i], dy = P[j + 1] - P[i + 1], dz = P[j + 2] - P[i + 2];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          if (st < 0) { rest *= CAPE_K.fold; if (d >= rest) continue; st = -st; }
          const diff = ((d - rest) / d) * 0.5 * st;
          const pinI = i < cols * 3, pinJ = j < cols * 3;
          const wi = pinI ? 0 : pinJ ? 2 : 1, wj = pinJ ? 0 : pinI ? 2 : 1;
          P[i] += dx * diff * wi; P[i + 1] += dy * diff * wi; P[i + 2] += dz * diff * wi;
          P[j] -= dx * diff * wj; P[j + 1] -= dy * diff * wj; P[j + 2] -= dz * diff * wj;
        }
        this.collide(K, nc, up, floor, F);
      }
    }
    this.normals();
    return o - o0;
  }

  collide(K, nc, up, floor, F) {
    const { cols, rows } = this, P = this.P;
    const ux = up[0], uy = up[1], uz = up[2], fx = floor[0], fy = floor[1], fz = floor[2], B = this.back;
    for (let i = cols * 3, n = rows * cols * 3; i < n; i += 3) {
      let x = P[i], y = P[i + 1], z = P[i + 2];
      const back = B[(i / 3) % cols] !== 0;
      for (let o = 0; o < nc * 11; o += 11) {
        const bx = K[o + 3], by = K[o + 4], bz = K[o + 5];
        let t = ((x - K[o]) * bx + (y - K[o + 1]) * by + (z - K[o + 2]) * bz) * K[o + 6];
        if (K[o + 9]) { if (t < 0 || t > 1) continue; } else t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = K[o] + bx * t, cy = K[o + 1] + by * t, cz = K[o + 2] + bz * t;
        const dx = x - cx, dy = y - cy, dz = z - cz, r = K[o + 7] + K[o + 8] * t;
        if (K[o + 10] !== 0 && !F && !(back && K[o + 10] > 0)) {
          let rx = cx - fx, ry = cy - fy, rz = cz - fz;
          const ru = rx * ux + ry * uy + rz * uz; rx -= ux * ru; ry -= uy * ru; rz -= uz * ru;
          const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
          if (rl < 1e-4) continue;
          rx /= rl; ry /= rl; rz /= rl;
          const dr = dx * rx + dy * ry + dz * rz, ex = dx - rx * dr, ey = dy - ry * dr, ez = dz - rz * dr, e2 = ex * ex + ey * ey + ez * ez;
          const R = r + CAPE_K.reach;
          if (e2 >= R * R || dr <= -rl * 0.85) continue;
          const e = Math.sqrt(e2), u = Math.min(Math.max((e - r - CAPE_K.reach * 0.5) / (CAPE_K.reach * 0.5), 0), 1);
          const out = r * (1 - u * u * (3 - 2 * u));
          if (K[o + 10] > 0) { if (dr < out) { x = cx + ex + rx * out; y = cy + ey + ry * out; z = cz + ez + rz * out; } }
          else if (dr > -out) { x = cx + ex - rx * out; y = cy + ey - ry * out; z = cz + ez - rz * out; }
          continue;
        }
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= r || d < 1e-5) continue;
        const k = r / d; x = cx + dx * k; y = cy + dy * k; z = cz + dz * k;
      }
      if (F) { P[i] = x; P[i + 1] = y; P[i + 2] = z; this.onField(F, i); continue; }
      const above = (x - fx) * ux + (y - fy) * uy + (z - fz) * uz;
      if (above < CAPE_K.ground) { const k = CAPE_K.ground - above; x += ux * k; y += uy * k; z += uz * k; }
      P[i] = x; P[i + 1] = y; P[i + 2] = z;
    }
  }

  /** cape.js onField. */
  onField(F, i) {
    const P = this.P, Q = this.Q, n = F.n, H = F.h, lift = CAPE_K.lift;
    const x = P[i], y = P[i + 1] - F.oy, z = P[i + 2], dx = x - F.ox, dz = z - F.oz;
    let u = (dx * F.rx + dz * F.rz + F.half) / F.step, v = (dx * F.fx + dz * F.fz + F.half) / F.step;
    u = u < 0 ? 0 : u > n - 1 ? n - 1 : u; v = v < 0 ? 0 : v > n - 1 ? n - 1 : v;
    const i0 = Math.min(u | 0, n - 2), j0 = Math.min(v | 0, n - 2), tu = u - i0, tv = v - j0;
    const a = H[j0 * n + i0], b = H[j0 * n + i0 + 1], c = H[(j0 + 1) * n + i0], d = H[(j0 + 1) * n + i0 + 1];
    let g;
    if (Math.max(a, b, c, d) - Math.min(a, b, c, d) < CAPE_K.fieldEdge) g = (a * (1 - tu) + b * tu) * (1 - tv) + (c * (1 - tu) + d * tu) * tv;
    else {
      const ci = Math.round(u), cj = Math.round(v);
      g = H[cj * n + ci];
      if (g - y > CAPE_K.fieldEdge) {
        let best = Infinity, du = 0, dv = 0;
        for (let k = 0; k < 4; k++) {
          const su = k === 0 ? -1 : k === 1 ? 1 : 0, sv = k === 2 ? -1 : k === 3 ? 1 : 0, ni = ci + su, nj = cj + sv;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n || H[nj * n + ni] > y) continue;
          const dist = su ? 0.5 - (u - ci) * su : 0.5 - (v - cj) * sv;
          if (dist < best) { best = dist; du = su * (dist + 0.02); dv = sv * (dist + 0.02); }
        }
        if (best < Infinity) {
          const ox = (du * F.rx + dv * F.fx) * F.step, oz = (du * F.rz + dv * F.fz) * F.step;
          P[i] += ox; P[i + 2] += oz; Q[i] += ox; Q[i + 2] += oz;
          return;
        }
      }
    }
    if (y - g < lift) { P[i + 1] = Q[i + 1] = F.oy + g + lift; }
  }

  /** three's computeVertexNormals on the grid's triangles. */
  normals() {
    const P = this.P, N = this.nrm, I = this.idx;
    N.fill(0);
    for (let t = 0; t + 2 < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const cbx = P[c] - P[b], cby = P[c + 1] - P[b + 1], cbz = P[c + 2] - P[b + 2], abx = P[a] - P[b], aby = P[a + 1] - P[b + 1], abz = P[a + 2] - P[b + 2];
      const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
      for (const v of [a, b, c]) { N[v] += nx; N[v + 1] += ny; N[v + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  }
}

/** An offload for cape.js (CAPE_HOST) that runs the jobs here at once: the tests', and the reference for an engine's. */
export function jsCapeOffload(CommandWriter) {
  let next = 0;
  return {
    init(cape) {
      const id = ++next, job = new CapeJob(packCapeDesc(cape)), w = new CommandWriter(1 << 14);
      return {
        id, job,
        frame(pk) { writeCapePacket(w, id, 0, pk, cape); const buf = w.take(); job.packet(new Uint32Array(buf), new Float32Array(buf), 1); this.words = buf.byteLength / 4; },
        state(c) { c.p.set(job.P); c.q.set(job.Q); return true; },
      };
    },
  };
}
