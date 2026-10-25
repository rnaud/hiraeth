// A guardian's reach against its body (the combat review's hitboxes, .claude/skills/combat-review/SKILL.md "Guardians,
// played"; issue #319, and #558 when it came back unseen): each move at its strike, the floor its hit takes (the game's
// own test, Guardian.wouldHit: its bones' or posed mesh's spheres for a move with `parts`, its `blast`'s beam or front,
// else its shape) against the floor its posed body and its drawn blow (Guardian.blast.meshes()) sweep at a traveller's
// height over the blow, on its hall's floor. Over `phantom` of the hit more than 1 m from its body, or any hit more than
// `far` m from it, fails. Node only, no browser: .claude/skills/combat-review/guardian.mjs reports it, and
// tests/guardian-reach.test.js holds every guardian to it.
//
//   const S = await stageGuardian(G)     G from src/arena-guardians.js GUARDIANS: in its own temple (or the Arena's ring)
//   const rows = hitboxes(S, { grid, dt })   per move: { id, hitM2, bodyM2, phantom, missed, farthest, reach, hit }
//   reachFails(rows)                     the FAIL lines
import { readGuardianModelUrl } from '../model-audit/guardian-inputs.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import '../../tests/register-gadgets.js';
import { Guardian, inArea } from '../../src/temples/boss.js';
import { templeOf, templeWorld } from '../../src/temples/index.js';
import { buildableById } from '../../src/levels/buildable.js';
import { Physics } from '../../src/physics.js';

/** The limits: the share of a hit more than 1 m from its body, and the furthest any of it may be (m). */
export const REACH = { phantom: 0.15, far: 1.5, near: 1 };

// (the game loads its skins by URL: here from public/, without textures: node has no image decoder)
globalThis.ProgressEvent ??= class { constructor(type, v) { this.type = type; Object.assign(this, v); } };
if (!GLTFLoader.prototype.load.fromPublic) {
  GLTFLoader.prototype.load = Object.assign(function (url, onLoad, onProgress, onError) {
    try {
      const bytes = readGuardianModelUrl(url), len = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + len));
      for (const m of json.meshes) for (const p of m.primitives) delete p.material;
      delete json.materials; delete json.textures; delete json.images;
      json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + len).toString('base64');
      this.parse(JSON.stringify(json), '', onLoad, onError);
    } catch (e) { onError?.(e); }
  }, { fromPublic: true });
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/**
 * A traveller's footprint round a point of its body (his column, 0.45 m round: its middle, its edge each way and between):
 * the body counts as touching him there. (Until v1.87 the offsets were -0.45 and 0.05 m on each axis, a grid step
 * apart: the body reached 0.45 m out on two sides and 0.05 on the other two, and the same blow measured 0.4 m further
 * from its body facing one way than the other.)
 */
const FOOT = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45], [0.32, 0.32], [0.32, -0.32], [-0.32, 0.32], [-0.32, -0.32]];
export const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

/** A still traveller who counts what reaches him. */
export const stillTraveller = () => ({ pos: V(), heading: 0, vel: V(), dead: false, down: null, hearts: 3, maxHearts: 3, health: 1, hurts: [], knocks: 0,
  hurt(d) { this.hurts.push(d); }, knockDown() { this.knocks++; }, guard: null, untouchable: null });

/** The guardian in its temple (the real def and hooks), or in the Arena's ring (its sparring rule) if that can't be built. */
export async function stageGuardian(G) {
  const P = stillTraveller();
  try {
    const scene = new THREE.Scene();
    const level = await quiet(() => buildableById(templeWorld(G.id)).create(scene));
    const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
    level.init?.(physics);
    const rt = templeOf(level, G.id);
    if (!rt?.guardian) throw new Error('no guardian in its temple');
    await quiet(async () => { rt.connect({ player: P }); await rt.guardian.model.ready; });
    return { g: rt.guardian, P, where: 'temple', rt, scene, level };
  } catch (e) {
    const rt = { def: { id: `arena-${G.id}` }, root: new THREE.Group(), logic: { resolved: false }, physics: { groundAt: () => 0 }, player: P, notice() {}, rumble() {} };
    const model = G.model();
    model.pos.set(0, 0, 9); model.home = model.pos.clone(); model.heading = Math.PI;
    rt.root.add(model.group);
    const g = new Guardian(rt, { def: G.def, model, arena: { center: V(), r: 20, y: 0 } });
    await model.ready;
    return { g, P, where: `ring (${String(e.message ?? e).slice(0, 60)})`, rt };
  }
}

/** The body's drawn points (world), posed now: skinned vertices (every `step`th), else each mesh's vertices. */
export function bodyPoints(model, step = 7) {
  const out = [], v = V();
  model.group.updateMatrixWorld(true);
  model.group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData.noBody) return;
    const p = o.geometry?.attributes?.position;
    if (!p || /glyph|marks|tele|glow/i.test(o.name)) return;
    if (o.isSkinnedMesh) { o.skeleton.update(); for (let i = 0; i < p.count; i += step) out.push(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld).clone()); }
    else for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 900))) out.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  });
  return out;
}

/** Its drawn blow's points (world) now (boss.js Blast: a beam's cylinder, a front's bands), every vertex: what it is drawn as. */
export function blowPoints(g) {
  const out = [], v = V();
  for (const o of g.blast?.meshes?.() ?? []) {
    o.updateMatrixWorld(true);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) out.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  }
  return out;
}

/** The game's own test of a strike reaching a traveller standing at p (Guardian.wouldHit, else its area). */
export const reaches = (g, a, p) => (g.wouldHit ? g.wouldHit(a, p) : g.points(a).some((o) => inArea(a, o, g.attackH, p)));

/**
 * Each move at its strike: the floor its hit takes against the floor its body sweeps over, played at `dt` s a frame.
 * `cells` (optional, a Map): per move id, { hit: [[x, z]], body: [[x, z]] } on the floor (for drawing them).
 */
export function hitboxes(S, { grid = 0.5, dt = 1 / 60, ids = null, cells = null } = {}) {
  const { g, P } = S, A = g.arena, def = g.def, rows = [], GRID = grid, DT = dt;
  for (const [id, a0] of Object.entries(def.attacks)) {
    if (ids && !ids.includes(id)) continue;
    if (a0.lob) { rows.push({ id, lob: true }); continue; }
    g.reset?.(); g.stop(); g.enter('fight'); g.meter = g.floor = 0; g.answered = new Set([0, 1, 2, 3]);
    // (on its hall's floor, where it fights: its home may be a perch over it, the Elder's)
    if (!g.model.rooted) g.model.pos.set(A.center.x, A.y, A.center.z);
    const h = g.model.heading, off = (g.model.radius ?? 2.6) + 3;
    P.pos.set(g.model.pos.x + Math.sin(h) * off, A.y + 50, g.model.pos.z + Math.cos(h) * off);   // (out of its way: nothing lands)
    let t = 100;
    for (let f = 0; f < 0.5 / DT; f++) g.update(DT, (t += DT));
    // (here no floor holds it up: a body that hung in the air in its last phase stays up there without this)
    if (!g.model.floats) g.model.pos.y = A.y;
    g.stop(); g.cool = 99; g.begin(P, null, id);
    g.attackAt.set(g.model.pos.x + Math.sin(g.model.heading) * off, A.y, g.model.pos.z + Math.cos(g.model.heading) * off);
    const zone = new Map(), body = new Set(), cell = (x, z) => `${Math.round(x / GRID)},${Math.round(z / GRID)}`, c = g.model.pos.clone();
    const R = 16;
    let hitAny = false, frames = 0;
    while (g.attack?.id === id && frames++ < 10 / DT) {
      const wasStruck = g.struck;
      g.update(DT, (t += DT));
      if (!g.attack || g.attack.id !== id) break;
      if (g.struck) {
        const since = g.at - g.windFor;
        if ((!wasStruck || g.live) && since >= (g.attack.late ?? 0)) {   // (a.late: its body blow live a moment after the strike, Guardian.contact)
          // the game's test, at every cell of the floor round it (a traveller standing there, on the floor)
          for (let x = -R; x <= R; x += GRID) for (let z = -R; z <= R; z += GRID) {
            const p = V(c.x + x, A.y, c.z + z);
            if (reaches(g, g.attack, p)) { zone.set(cell(p.x, p.z), p); hitAny = true; }
          }
        }
        // (what it strikes with: its posed body, and what it draws of its blow: v1.70, a beam, a front)
        if (since < (g.live?.for ?? g.attack.active ?? 0.3)) for (const q of [...bodyPoints(g.model), ...blowPoints(g)]) {
          if (q.y - A.y > 1.9 + 0.3 || q.y - A.y < -1) continue;
          for (const [dx, dz] of FOOT) body.add(cell(q.x + dx, q.z + dz));
        }
        if (since > Math.max(0.35, (g.live?.for ?? g.attack.active ?? 0) + 0.05) && !g.live) break;
      }
    }
    const pts = [...zone.values()], bodyCells = [...body].map((k) => k.split(',').map((n) => +n * GRID));
    const nearBody = (p) => { let best = Infinity; for (const [x, z] of bodyCells) best = Math.min(best, Math.hypot(p.x - x, p.z - z)); return best; };
    const far = pts.map(nearBody), phantom = far.filter((d) => d > REACH.near).length;
    const touchedNotHit = [...body].filter((k) => !zone.has(k)).length;
    cells?.set(id, { hit: pts.map((p, i) => [p.x, p.z, far[i]]), body: bodyCells, y: A.y, c: [c.x, c.z], h: g.model.heading });
    rows.push({ id, hitM2: +(pts.length * GRID * GRID).toFixed(1), bodyM2: +(body.size * GRID * GRID).toFixed(1), phantom: pts.length ? +(phantom / pts.length).toFixed(2) : 0,
      missed: body.size ? +(touchedNotHit / body.size).toFixed(2) : 0, farthest: far.length ? (bodyCells.length ? +Math.max(...far).toFixed(1) : `${R}+ (no body at his height)`) : 0, reach: pts.length ? +Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.z - c.z))).toFixed(1) : 0, hit: hitAny });
  }
  return rows;
}

/** The FAIL lines of a guardian's hitboxes (REACH). */
export const reachFails = (rows) => rows.filter((r) => !r.lob && r.hit && (r.phantom > REACH.phantom || !(r.farthest <= REACH.far)))
  .map((r) => `${r.id}: its hit takes ${Math.round(r.phantom * 100)} % of its floor more than ${REACH.near} m from its body, up to ${r.farthest} m`);
