import * as THREE from 'three';
import { registerTarget } from './targets.js';
import { Flames } from './story/flames.js';
import { makeMaterial } from './materials.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Things an ember glob (the backpack's 'fire' mode, src/items.js) sets alight.
// The fire never hurts: lamps light, fires flare, dry brambles burn away and
// grow back later. A generic hook: a level lists
//   level.flammables = [{ at: Vector3, kind, r?, lit?, onFire?() }]
// and every spot becomes a target (kind: 'flammable', accepts: ['fire']; any
// other glob just splashes on it). Kinds:
//   'campfire'  already burning: it flares up tall for a moment
//   'lantern' / 'lamp' / 'brazier' / 'torch'   a little flame on it burns for a while (and lights the street)
//   'bramble'   a dry tangle (drawn here): it burns away and grows back a minute later
//   onFire()    a spot can bring its own reaction too (return false to skip the flame)
// The desert's camp fires come from level.qanat.fires, with a few dry brambles round
// each camp (flammableSpots); the Signal Market lists its hanging lamps.

const BURN = { lamp: 45, flare: 2.6, bramble: 2.2, regrow: 60, maxLit: 14 };
const LAMPS = new Set(['lantern', 'lamp', 'brazier', 'torch']);

/** Every flammable spot a level offers (its own list, plus the desert's camp fires and the brambles by them). */
export function flammableSpots(level) {
  const out = [...(level?.flammables ?? [])];
  const fires = level?.qanat?.fires ?? [];
  const H = level?.ground?.heightAt?.bind(level.ground);
  fires.forEach((f, i) => {
    out.push({ at: f.clone(), kind: 'campfire', r: 1.8, lit: true });
    // dry thorn brush at the edge of each camp, out past the benches
    for (let k = 0; k < 3; k++) {
      const a = i * 2.3 + k * 2.1, d = 8 + (k % 2) * 3;
      const x = f.x + Math.sin(a) * d, z = f.z + Math.cos(a) * d;
      const y = H ? H(x, z) : f.y - 1.5;
      if (Number.isFinite(y)) out.push({ at: new THREE.Vector3(x, y, z), kind: 'bramble', r: 1.1 });
    }
  });
  return out;
}

/** A dry tangle of thorny stems, one mesh (one draw). */
function brambleMesh(seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const mat = makeMaterial({ color: '#9a7448', key: `bramble.${seed}` });
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const pts = [];
    let x = (rnd() - 0.5) * 0.4, z = (rnd() - 0.5) * 0.4, y = 0;
    for (let j = 0; j < 5; j++) {
      pts.push(new THREE.Vector3(x, y, z));
      x += (rnd() - 0.5) * 0.7; z += (rnd() - 0.5) * 0.7; y += 0.12 + rnd() * 0.22;
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.025, 4);
    g.deleteAttribute('uv');
    parts.push(g);
  }
  const m = new THREE.Mesh(mergeGeometries(parts), mat);
  parts.forEach((g) => g.dispose());
  m.userData.noCollide = true;
  m.userData.mat = mat;
  return m;
}

export class Flammables {
  /**
   * @param spots   flammableSpots(level)
   * @param o.lights  the level's light list (Vector4s); a lit lamp adds one while it burns
   */
  constructor(scene, spots, { lights = null, sound = null } = {}) {
    this.root = new THREE.Group();
    this.root.name = 'Flammables';
    scene?.add(this.root);
    this.lights = lights; this.sound = sound;
    this.focus = new THREE.Vector3(1e9, 0, 0);
    this.burning = [];
    this.time = 0;
    this.spots = spots.map((sp, i) => {
      const s = { r: 0.7, ...sp, i, lit: !!sp.lit, until: 0, grow: 1 };
      s.centre = sp.kind === 'bramble' ? sp.at.clone().setY(sp.at.y + 0.4) : sp.at;
      if (s.kind === 'bramble') { s.mesh = brambleMesh(i + 1); s.mesh.position.copy(s.at); s.mesh.rotation.y = i * 1.7; this.root.add(s.mesh); }
      s.off = registerTarget({
        kind: 'flammable', flammable: s.kind, spot: s, radius: s.r, accepts: ['fire'],
        position: () => s.centre,
        enabled: () => s.at.distanceToSquared(this.focus) < 140 * 140 && !(s.kind === 'bramble' && s.grow < 0.9),
        onHit: (mode) => (mode === 'fire' ? this.ignite(s) : false),
      });
      return s;
    });
  }

  /** An ember glob landed on spot s. Returns true if it reacted. */
  ignite(s) {
    if (s.onFire && s.onFire() === false) return true;
    const t = this.time;
    if (s.kind === 'campfire') {
      this.flame(s, [{ at: new THREE.Vector3(0, -1.3, 0), h: 5, r: 1.1 }, { at: new THREE.Vector3(0.4, -1.3, 0.2), h: 3.6, r: 0.7, phase: 2 }, { at: new THREE.Vector3(-0.35, -1.3, -0.25), h: 4.2, r: 0.8, phase: 4 }], BURN.flare, 'flare');
      this.sound?.whoosh?.();
      return true;
    }
    if (s.kind === 'bramble') {
      if (s.burnt) return false;
      s.burnt = true; s.burnAt = t;
      this.flame(s, [{ at: new THREE.Vector3(0, 0, 0), h: 1.6, r: 0.6 }, { at: new THREE.Vector3(0.3, 0, -0.2), h: 1.1, r: 0.4, phase: 3 }], BURN.bramble, 'bramble');
      this.sound?.whoosh?.();
      return true;
    }
    if (LAMPS.has(s.kind) || !s.kind) {
      if (s.lit && s.until > t) { s.until = t + BURN.lamp; return true; }
      s.lit = true; s.until = t + BURN.lamp;
      this.flame(s, [{ at: new THREE.Vector3(0, s.top ?? s.r * 0.7, 0), h: 0.7, r: 0.16 }, { at: new THREE.Vector3(0, s.top ?? s.r * 0.7, 0), h: 0.4, r: 0.09, core: 1, phase: 1 }], BURN.lamp, 'lamp');
      if (this.lights) { s.light = new THREE.Vector4(s.at.x, s.at.y + 0.6, s.at.z, 8); this.lights.push(s.light); }
      this.sound?.chime?.();
      return true;
    }
    return false;
  }

  /** A burning: a little set of flame tongues at the spot for `life` seconds. */
  flame(s, tongues, life, kind) {
    while (this.burning.length >= BURN.maxLit) this.out(this.burning[0]);
    const g = new THREE.Group();
    g.position.copy(s.at);
    this.root.add(g);
    const f = new Flames(g, tongues, { seed: s.i * 3 });
    const b = { s, g, f, t: 0, life, kind };
    this.burning.push(b);
    return b;
  }

  out(b) {
    b.g.removeFromParent();
    b.f.geo.dispose();
    this.burning.splice(this.burning.indexOf(b), 1);
    if (b.s.light && this.lights) { const i = this.lights.indexOf(b.s.light); if (i >= 0) this.lights.splice(i, 1); b.s.light = null; }
    if (b.kind === 'lamp') b.s.lit = false;
  }

  update(dt, t, focus) {
    this.time += dt;
    if (focus) this.focus.copy(focus);
    for (const b of [...this.burning]) {
      b.t += dt;
      // flares leap up and settle; lamps catch, then gutter out at the end
      const k = b.kind === 'flare' ? Math.sin(Math.PI * Math.min(1, b.t / b.life)) : b.kind === 'lamp' ? Math.min(1, b.t * 3) * Math.min(1, (b.life - b.t) / 3) : Math.min(1, b.t * 4) * Math.min(1, (b.life - b.t) * 1.5);
      b.g.scale.setScalar(Math.max(0.02, k));
      b.f.intensity = k;
      if (b.s.light) b.s.light.w = 8 * k + Math.random() * 0.8;
      if (b.g.position.distanceToSquared(this.focus) < 200 * 200) b.f.update(dt, this.time);
      if (b.t >= b.life) this.out(b);
    }
    // brambles: burn to nothing, then a minute later sprout back
    for (const s of this.spots) {
      if (s.kind !== 'bramble') continue;
      if (s.burnt) {
        const a = this.time - s.burnAt;
        s.grow = a < BURN.bramble ? 1 - a / BURN.bramble : a > BURN.regrow ? Math.min(1, (a - BURN.regrow) / 6) : 0;
        if (a > BURN.regrow + 6) { s.burnt = false; s.grow = 1; }
        const col = a > BURN.regrow || a < 0.3 ? '#9a7448' : '#2b211f';   // charred while it burns, dry tan again as it regrows
        if (s.col !== col) { s.col = col; s.mesh.userData.mat.uniforms.uColor.value.set(col); }
      }
      s.mesh.visible = s.grow > 0.02 && s.at.distanceToSquared(this.focus) < 160 * 160;   // only drawn near
      s.mesh.scale.set(1, Math.max(0.02, s.grow), 1);
    }
  }

  dispose() {
    for (const s of this.spots) s.off();
    for (const b of [...this.burning]) this.out(b);
    this.root.removeFromParent();
  }
}
