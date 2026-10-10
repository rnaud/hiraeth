import * as THREE from 'three';
import { makeMaterial, sharedUniforms, MODE_WATER } from './materials.js';
import { waterShared, RINGS, WATER_MARK } from './water-shader.js';

// ---------------------------------------------------------------------------
// The world's water (one per level, main.js): every body of water in it, for
// the look (water-shader.js) and for swimming (swim.js).
//
//   bodies     every MODE_WATER mesh in the scene (and any mesh with
//              userData.water = true: the desert cave's magic pool), each with
//              its own copy of the material (its own bed map), drawn from both
//              sides (you see the surface from under it). userData.water = false
//              and printed shapes (waterPrint) are left out.
//   surfaceAt  the water at (x, z) for something at height y: { y, body } (its
//              surface right there: streams slope) or null. floorAt is the
//              highest surface under y (the hoverbike skims on it).
//   bed maps   the shader's depth bands, foam and shallows come from a map of
//              the bed under each body, baked a few rows a frame from the
//              collision world (physics.groundAt), nearest body first; the
//              huge ones (Lorn's swamp) get a map round the player that is
//              baked again as you go (BED).
//   rings      ripples spreading round whatever touches the water: the player
//              wading and swimming, the strokes, splashes, a vehicle skimming,
//              creatures on the water (uWaterRings, a ring buffer)
//   splashes   white drops and a sound (audio.js) on going in and out, strokes,
//              wading steps
//   contact    renderGBuffer draws the G-buffer in two passes when water is in
//              view: the scene without the water, its view depth copied
//              (only the water's rectangle on screen), then the water over it,
//              reading that depth for the little waves round whatever stands in
//              it (water-shader.js CONTACT); `contact` false (a preset): one pass
//   underwater the camera never sits on the surface (keepCamera); under it, a
//              tinted pass with banded fog over the composite (renderOver: it
//              also paints the sun's sparkle on the water),
//              the sound muffled, and the breath meter (bubbles under the
//              health bar) while you hold your breath
// ---------------------------------------------------------------------------

/** m under the surface past which nothing splashes up there (a step, a stroke, going in: a sea's bed, swim.js seaWalk) */
export const DEEP_UNDER = 2.5;

export const BED = {
  texel: 0.3,          // m: the finest bed map texel (small pools)
  maxSize: 256,        // texels a side
  huge: 700,           // m: bodies wider than this get a moving map round the player
  span: 300,           // m: that map's width
  recentre: 70,        // m: bake it again once you are this far from its centre
  budget: 1.5,         // ms of baking a frame
};

const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _down = new THREE.Vector3(0, -1, 0), _hits = [];
const _c = new THREE.Color();

function shownInScene(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Half floats for the bed map (HalfFloat textures filter linearly everywhere WebGL2 runs). */
const toHalf = THREE.DataUtils.toHalfFloat;

export class Waters {
  /**
   * @param scene    the level (scanned now: add() any water made later)
   * @param o.physics  collision (groundAt) for the bed maps
   * @param o.sound    audio.js Sound (splashes), optional
   * @param o.drops    false: no splash drops (tests)
   */
  constructor(scene, { physics = null, sound = null, drops = true } = {}) {
    this.scene = scene;
    this.physics = physics;
    this.sound = sound;
    this.bodies = [];
    this.t = 0;
    this.rings = waterShared.uWaterRings.value;
    this.ringNext = 0;
    this._emit = new Map();     // per thing: seconds to its next ring
    this.camUnder = null;       // { y } while the camera is under the water
    this.contact = true;        // the contact foam (main.js: the preset's waterContact)
    if (scene) this.scan(scene);
    this.drops = drops && scene ? new Drops(scene) : null;
  }

  /** Find the water meshes in the scene. */
  scan(root) {
    root.updateMatrixWorld(true);
    const found = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.water === false) return;
      const water = o.material?.uniforms?.uMode?.value === MODE_WATER || o.userData.water === true;
      if (!water || o.material?.uniforms?.uWaterOpt?.value.y > 0.5) return;   // (printed shapes on the water are not water)
      found.push(o);
    });
    for (const o of found) this.add(o);
    return this;
  }

  /** Add a body of water (a mesh lying where its surface is). */
  add(mesh) {
    if (this.bodies.some((b) => b.mesh === mesh)) return null;
    let mat = mesh.material;
    if (mat?.defines?.WATER) {
      // its own copy: its own bed map (the shared uniforms stay shared)
      mat = mat.clone();
      Object.assign(mat.uniforms, sharedUniforms, waterShared);
      mat.side = THREE.DoubleSide;
      mesh.material = mat;
    }
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
    const body = { mesh, mat: mat?.defines?.WATER ? mat : null, box, top: box.max.y, flat: box.max.y - box.min.y < 0.05, huge: Math.max(sx, sz) > BED.huge, bake: null, baked: null, sea: mesh.userData.sea ?? null };
    this.bodies.push(body);
    return body;
  }

  /** The body's box again (a pool that rises: the desert cave). */
  refresh(body) {
    body.mesh.updateMatrixWorld(true);
    body.box.setFromObject(body.mesh);
    body.top = body.box.max.y;
  }

  /** The surface of one body right at (x, z), or null where it isn't. */
  surfaceOf(b, x, z) {
    if (x < b.box.min.x || x > b.box.max.x || z < b.box.min.z || z > b.box.max.z) return null;
    if (!shownInScene(b.mesh)) return null;
    if (b.huge && b.flat) return b.top;   // (a plane over the whole world)
    _o.set(x, b.top + 1, z);
    _ray.set(_o, _down);
    _ray.far = b.box.max.y - b.box.min.y + 2;
    _hits.length = 0;
    b.mesh.raycast(_ray, _hits);
    if (!_hits.length) return null;
    let y = -Infinity;
    for (const h of _hits) y = Math.max(y, h.point.y);
    return y;
  }

  /**
   * The water at (x, z) for something at height y: the lowest surface above y
   * - 0.6 (you are in it), else the highest one under y (you are over it, up to
   * `below` m). { y, body } or null.
   */
  surfaceAt(x, z, y = 0, below = 80, look = false) {
    let inY = Infinity, inB = null, overY = -Infinity, overB = null;
    for (const b of this.bodies) {
      // (a sea's surface may stand far overhead: the Underwater City's is 78 m up, over its Whale Gallery at -16)
      if (b.top < y - below || b.box.min.y > y + (b.sea ? 120 : 60)) continue;
      // (a sea's air pockets: a dome, a covered street; for the look, a sea seen through glass (`sea.glass`, the
      // Underwater City's halls since v1.40) keeps its water round the camera even in its pockets)
      if (b.sea?.air?.(x, y, z) && !(look && b.sea.glass)) continue;
      const s = this.surfaceOf(b, x, z);
      if (s === null) continue;
      if (s >= y - 0.6) { if (s < inY) { inY = s; inB = b; } }
      else if (s > overY) { overY = s; overB = b; }
    }
    if (inB) return { y: inY, body: inB };
    if (overB) return { y: overY, body: overB };
    return null;
  }

  /** The highest water surface under (x, y + 0.5, z), or -Infinity (the hoverbike's floor). */
  floorAt(x, y, z) {
    let best = -Infinity;
    for (const b of this.bodies) {
      if (b.box.min.y > y + 0.5 || b.top < y - 200) continue;
      if (b.sea?.air?.(x, y, z)) continue;
      const s = this.surfaceOf(b, x, z);
      if (s !== null && s <= y + 0.5 && s > best) best = s;
    }
    return best;
  }

  // ------------------------------------------------------------ bed maps
  /** Start a bed map for a body (centred on `at` for the huge ones). */
  beginBake(b, at) {
    const pad = 4;
    let x0, z0, w, d;
    if (b.huge) {
      w = d = BED.span;
      x0 = Math.round(at.x / 8) * 8 - w / 2; z0 = Math.round(at.z / 8) * 8 - d / 2;
    } else {
      x0 = b.box.min.x - pad; z0 = b.box.min.z - pad;
      w = b.box.max.x - b.box.min.x + pad * 2; d = b.box.max.z - b.box.min.z + pad * 2;
    }
    const texel = Math.max(BED.texel, Math.max(w, d) / BED.maxSize);
    const nx = Math.max(8, Math.min(BED.maxSize, Math.ceil(w / texel))), nz = Math.max(8, Math.min(BED.maxSize, Math.ceil(d / texel)));
    // rows from the middle outward, so a map in progress is useful early (huge maps: from the player's row)
    const order = [], mid = Math.floor(nz / 2);
    for (let k = 0; k < nz; k++) order.push(mid + (k % 2 ? (k + 1) / 2 : -k / 2));
    b.bake = { x0, z0, w, d, nx, nz, ref: b.top, row: 0, order: order.filter((r) => r >= 0 && r < nz), data: new Uint16Array(nx * nz), centre: { x: x0 + w / 2, z: z0 + d / 2 } };
    return b.bake;
  }

  /** The bed's height under (x, z) for a body with surface `surface` there. */
  bedAt(x, z, surface) {
    const g = this.physics ? this.physics.groundAt(x, surface + 1.5, z) : -Infinity;
    return Number.isFinite(g) ? g : surface - 40;
  }

  /** Bake rows of one body's map for up to `ms` milliseconds. Returns true when that map is done. */
  bakeRows(b, ms = BED.budget) {
    const B = b.bake;
    if (!B) return true;
    const t0 = performance.now(), dx = B.w / B.nx, dz = B.d / B.nz;
    while (B.row < B.order.length) {
      const j = B.order[B.row++], z = B.z0 + (j + 0.5) * dz;
      for (let i = 0; i < B.nx; i++) {
        const x = B.x0 + (i + 0.5) * dx;
        const s = b.flat ? B.ref : (this.surfaceOf(b, x, z) ?? B.ref);
        B.data[j * B.nx + i] = toHalf(THREE.MathUtils.clamp(this.bedAt(x, z, s) - B.ref, -60, 6));
      }
      if (performance.now() - t0 > ms) break;
    }
    if (B.row < B.order.length) return false;
    this.finishBake(b);
    return true;
  }

  finishBake(b) {
    const B = b.bake;
    b.bake = null;
    b.baked = B;
    if (!b.mat) return;
    const old = b.mat.uniforms.uBed.value;
    const tex = new THREE.DataTexture(B.data, B.nx, B.nz, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    b.mat.uniforms.uBed.value = tex;
    b.mat.uniforms.uBedBox.value.set(B.x0, B.z0, 1 / B.w, 1 / B.d);
    b.mat.uniforms.uBedRef.value.set(B.ref, 1);
    if (old?.image?.width > 1) old.dispose();
  }

  /** A frame of baking: the body nearest `at` that needs a map (or a fresh one round you). */
  bakeStep(at, ms = BED.budget) {
    let todo = this.bodies.find((b) => b.bake);
    if (!todo) {
      let bd = Infinity;
      for (const b of this.bodies) {
        if (!b.mat || b.sea) continue;   // (a sea is seen from below: its ceiling needs no bed)
        const stale = !b.baked || (b.huge && Math.hypot(at.x - b.baked.centre.x, at.z - b.baked.centre.z) > BED.recentre);
        if (!stale) continue;
        const d = b.huge ? 0 : Math.hypot(Math.max(b.box.min.x - at.x, 0, at.x - b.box.max.x), Math.max(b.box.min.z - at.z, 0, at.z - b.box.max.z));
        if (d < bd) { bd = d; todo = b; }
      }
      if (!todo) return false;
      this.beginBake(todo, at);
    }
    return this.bakeRows(todo, ms);
  }

  /** Bake every map now (tests, the Lab). */
  bakeAll(at = new THREE.Vector3()) {
    for (const b of this.bodies) if (b.mat) { this.beginBake(b, at); this.bakeRows(b, Infinity); }
  }

  // ------------------------------------------------------------ rings and splashes
  /** A ripple ring spreading from (x, z): k 0..2 (bigger rings for bigger things). */
  ring(x, z, k = 1) {
    const r = this.rings[this.ringNext];
    r.set(x, z, this.t, k);
    this.ringNext = (this.ringNext + 1) % RINGS;
  }

  /** Rings round a thing in the water every `every` s (key: the thing). */
  touch(key, x, z, k, every, dt) {
    const left = (this._emit.get(key) ?? 0) - dt;
    if (left > 0) { this._emit.set(key, left); return false; }
    this._emit.set(key, every * (0.8 + Math.random() * 0.4));
    this.ring(x, z, k);
    return true;
  }

  /** Water thrown up at `pos` (on the surface `surface`): drops, a ring and a sound. k 0..2. */
  splash(pos, surface, k = 1, { sound = true, ring = true } = {}) {
    const at = _o.set(pos.x, surface + 0.02, pos.z);
    if (ring) this.ring(at.x, at.z, Math.min(2, 0.6 + k));
    this.drops?.burst(at, k);
    if (sound) this.sound?.splash?.(k);
  }

  /** The player's water events (swim.js player.onSwim). */
  event(kind, info) {
    const s = info.surface;
    // deep under (a sea you walk the bed of): no splash up at the surface, only bubbles
    if (s - (info.pos?.y ?? s) > DEEP_UNDER) {
      if (kind === 'enter' || kind === 'dive') this.sound?.bubbles?.(0.6);
      else if (kind === 'stroke') this.sound?.bubbles?.(0.4);
      return;
    }
    if (kind === 'enter') this.splash(info.pos, s, Math.min(2, 0.5 + info.speed / 9));
    else if (kind === 'exit' || kind === 'hop') this.splash(info.pos, s, 0.45);
    else if (kind === 'stroke') {
      if (info.under) this.sound?.bubbles?.(0.6);
      else { this.splash(info.pos, s, info.crawl > 0.5 ? 0.55 : 0.35, { sound: false }); this.sound?.stroke?.(info.crawl); }
    } else if (kind === 'dive') this.sound?.bubbles?.(1);
    else if (kind === 'gasp') this.sound?.gasp?.();
    else if (kind === 'hurt') this.sound?.bubbles?.(1.4);
  }

  /** A footstep: in the water, a splash instead of a print (returns true then). */
  step(p, k = 1) {
    const w = this.surfaceAt(p.x, p.z, p.y);
    if (!w || w.y < p.y + 0.04 || w.y - p.y > DEEP_UNDER) return false;   // (on a sea's bed: an ordinary step)
    const deep = THREE.MathUtils.clamp((w.y - p.y) / 1.2, 0, 1);
    this.ring(p.x, p.z, 0.4 + 0.5 * deep);
    this.drops?.burst(_o.set(p.x, w.y + 0.02, p.z), 0.15 + 0.3 * deep * k, 0.6);
    this.sound?.wade?.(deep);
    return true;
  }

  // ------------------------------------------------------------ per frame
  /**
   * @param o.player   rings round the traveller wading and swimming
   * @param o.vehicles rings behind vehicles skimming over water
   * @param o.things   anything else with pos (creatures, people): rings where they stand in water
   * @param o.globs    the fluid tool's globs in flight: a splash where one goes in
   * @param o.sky      post.js uniforms (uSkyTop, uSkyHorizon): the sky the water mirrors
   */
  update(dt, t, { player = null, vehicles = [], things = [], globs = [], sky = null, bake = true } = {}) {
    this.t = t;
    for (const b of this.bodies) if (b.mesh.userData.waterMoves && shownInScene(b.mesh)) this.refresh(b);
    if (sky) { waterShared.uWaterSky.value[0].copy(sky.uSkyTop.value); waterShared.uWaterSky.value[1].copy(sky.uSkyHorizon.value); }
    if (bake && player) this.bakeStep(player.pos);
    if (player && !player.ride) {
      const w = player.inWater;
      if (player.swim) {
        const moving = player.swim.hs > 0.5;
        if (!player.swim.under) this.touch(player, player.pos.x, player.pos.z, moving ? 0.75 : 0.45, moving ? 0.45 : 1.3, dt);
      } else if (w && w.over > 0.08 && w.over < DEEP_UNDER && player.onGround) {
        this.touch(player, player.pos.x, player.pos.z, 0.35 + 0.4 * Math.min(w.over, 1), Math.hypot(player.vel.x, player.vel.z) > 0.5 ? 0.6 : 1.6, dt);
      }
    }
    for (const v of vehicles) {
      if (!v?.pos || v.dormant) continue;
      const sp = Math.hypot(v.vel?.x ?? 0, v.vel?.z ?? 0);
      if (sp < 2) continue;
      const s = this.floorAt(v.pos.x, v.pos.y, v.pos.z);
      if (s > -Infinity && v.pos.y - s < 2.2) this.touch(v, v.pos.x, v.pos.z, Math.min(1.6, 0.5 + sp / 20), Math.max(0.12, 0.5 - sp / 60), dt);
    }
    // creatures and people: a check now and then, a ring where they are in water
    for (const c of things) {
      const p = c?.pos;
      if (!p) continue;
      const key = c;
      const left = (this._emit.get(key) ?? Math.random()) - dt;
      if (left > 0) { this._emit.set(key, left); continue; }
      const s = this.surfaceAt(p.x, p.z, p.y, 1);
      if (s && Math.abs(s.y - p.y) < 0.9) { this.ring(p.x, p.z, 0.5); this._emit.set(key, 1.2 + Math.random() * 1.5); }
      else this._emit.set(key, 0.8 + Math.random());
    }
    // the fluid tool's globs: a splash where one goes into the water
    for (const g of globs) {
      if (g.state !== 'fly' && g._wy === undefined) continue;
      const prev = g._wy;
      g._wy = g.pos.y;
      if (prev === undefined || prev <= g.pos.y) continue;
      const s = this.surfaceAt(g.pos.x, g.pos.z, prev, 0.5);
      if (s && prev > s.y && g.pos.y <= s.y + 0.05) this.splash(_o.set(g.pos.x, s.y, g.pos.z), s.y, 0.5, { sound: true });
    }
    this.drops?.update(dt);
  }

  /**
   * After the camera is placed: keep it off the surface (it sees one side or
   * the other, not a half-and-half lens), and note whether it is under water
   * and whether any water is in view (the sparkle pass runs only then).
   * `prefer`: 'under' when the player is under (the camera follows them down).
   */
  keepCamera(camera, prefer = 'over') {
    const p = camera.position;
    const w = this.surfaceAt(p.x, p.z, p.y, 2, true);
    this.camUnder = null;
    if (w) {
      const band = 0.22;
      if (Math.abs(p.y - w.y) < band) p.y = prefer === 'under' ? w.y - band : w.y + band;
      // (glass: in a sea's air pocket behind glass, the sea's look on the view, its sound only a little muffled)
      if (p.y < w.y) this.camUnder = { y: w.y, body: w.body, glass: !!(w.body.sea?.glass && w.body.sea.air?.(p.x, p.y, p.z)) };
    }
    camera.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    // (only water that sparkles: the desert cave's magic pool is the fluid's own material, with no
    // glints for the pass to draw, so it never needs the full-screen pass)
    this.inView = this.bodies.some((b) => b.mat && shownInScene(b.mesh) && b.box.distanceToPoint(p) < WATER_PASS.reach && _frustum.intersectsBox(b.box));
    return this.camUnder;
  }

  /**
   * The G-buffer pass (main.js, title-world.js), into `target` (already bound and cleared): the scene, and with
   * the contact foam on and water in view, the water drawn last, over the scene's depth:
   *   1. the water's depth alone, sunk CONTACT_SINK m (what lies deeper stays hidden early: drawing the water last
   *      would otherwise shade every bed and wall under it, a whole frame of G-buffer work in the swamps);
   *   2. the scene without the water;
   *   3. the water, reading the scene's depth (uSceneDepth) and writing none of its own, so the depth buffer
   *      still holds the scene's at the end of the pass, and is copied then for the next frame (DepthCopy).
   * The water reads the last frame's copy, reprojected (uScenePrevVP): reading this frame's would end the pass
   * and store and reload the whole G-buffer, ~0.7 ms at High on a tiled GPU. When the camera has jumped (a cut,
   * a portrait, the first frame) it is copied in the middle of the pass instead, this frame's (ContactCopy.fresh).
   */
  renderGBuffer(renderer, scene, camera, target) {
    const shown = this.contact && !this.camUnder ? this.contactBodies(camera) : null;
    const rect = shown && screenRect(shown.map((b) => b.box), _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), target.width, target.height);
    if (!rect) { renderer.render(scene, camera); if (this.depthCopy) this.depthCopy.valid = false; return false; }
    const copy = (this.depthCopy ??= new DepthCopy());
    const sink = (this.sinkMat ??= sinkMaterial());
    for (const b of shown) { const m = b.mesh.material; b.mesh.material = sink; renderer.render(b.mesh, camera); b.mesh.material = m; }
    for (const b of shown) b.mesh.visible = false;
    renderer.render(scene, camera);
    for (const b of shown) b.mesh.visible = true;
    const fresh = !copy.reusable(target, camera, rect);
    if (fresh) { copy.render(renderer, target, rect, camera); renderer.setRenderTarget(target); }
    copy.bind(waterShared);
    waterShared.uWaterContact.value = 1;
    for (const b of shown) { b.mat.depthWrite = false; renderer.render(b.mesh, camera); b.mat.depthWrite = true; }
    waterShared.uWaterContact.value = 0;
    // (the depth buffer holds the scene's alone: for the next frame; only the blit needs no shader copy)
    if (!fresh) { copy.render(renderer, target, rect, camera); renderer.setRenderTarget(target); }
    return fresh ? 'fresh' : 'reused';
  }

  /** The bodies the contact pass draws: shown, of the water look, in the camera's frustum (null: none). */
  contactBodies(camera) {
    camera.updateMatrixWorld();
    _frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let out = null;
    for (const b of this.bodies) if (b.mat && shownInScene(b.mesh) && _frustum.intersectsBox(b.box)) (out ??= []).push(b);
    return out;
  }

  /** Free what the contact pass made (the level is left). */
  dispose() { this.depthCopy?.dispose(); this.depthCopy = null; this.sinkMat?.dispose(); this.sinkMat = null; }

  /**
   * Over the finished page (after post.js, before FXAA): under water, the tint
   * and the banded haze; above it, the sun's sparkle on the water (water-shader.js
   * marks it in the normals' length: drawn here it gets no ink outline).
   */
  renderOver(renderer, camera, { tNormal, tAlbedo, target, toon = 0.5 } = {}) {
    this.sound?.underwater?.(this.camUnder ? (this.camUnder.glass ? 0.3 : 1) : 0);
    const sun = sharedUniforms.uSunDir.value.y > 0.02 && waterShared.uWaterLite.value < 0.5;   // (no sparkle on the handheld's low detail)
    if (!this.camUnder && !(sun && this.inView)) return;
    (this.pass ??= new WaterPass()).render(renderer, camera, { tNormal, tAlbedo, target, toon, under: this.camUnder });
  }

  /** The over-the-page pass, made now if this world has water (so the loading screen compiles it: main.js). */
  warmPass() {
    return this.bodies.length ? (this.pass ??= new WaterPass()) : null;
  }
}

const _frustum = new THREE.Frustum(), _pm = new THREE.Matrix4();

/**
 * m: the water's depth is laid down this far under its surface before the scene (renderGBuffer). Deeper than the
 * contact band ever reaches: the view ray's run through the water is at least the depth under the surface, and the
 * band with its wavelets reaches at most ~1.4 m where its detail is drawn (tests/water-contact.test.js).
 */
export const CONTACT_SINK = 2;

/**
 * The last frame's depth is reused while the camera has moved under `move` m and turned under `turn` rad since,
 * and the water's rectangle on screen stays inside the one copied (copied `margin` px wider); else this frame's is copied.
 */
export const CONTACT_REUSE = { move: 1.5, turn: 0.12, margin: 48 };
const _fwd = new THREE.Vector3();

/** Depth only, the water mesh lowered CONTACT_SINK m. */
function sinkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSink: { value: CONTACT_SINK } },
    vertexShader: /* glsl */ `uniform float uSink;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); w.y -= uSink; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `void main() {}`,
    colorWrite: false, depthWrite: true, depthTest: true, side: THREE.DoubleSide,
  });
}

/**
 * The pixels of a w × h target that boxes cover on screen, for a view-projection matrix `vp`: { x, y, w, h }
 * (whole pixels, a pixel's margin, clamped), the whole target when a corner is behind the camera, null when
 * nothing shows.
 */
export function screenRect(boxes, vp, w, h) {
  const e = vp.elements;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? b.max.x : b.min.x, y = i & 2 ? b.max.y : b.min.y, z = i & 4 ? b.max.z : b.min.z;
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 1e-4) return { x: 0, y: 0, w, h };
      const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / cw, ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / cw;
      x0 = Math.min(x0, nx); x1 = Math.max(x1, nx); y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
    }
  }
  const px0 = Math.max(0, Math.floor((x0 * 0.5 + 0.5) * w) - 1), px1 = Math.min(w, Math.ceil((x1 * 0.5 + 0.5) * w) + 1);
  const py0 = Math.max(0, Math.floor((y0 * 0.5 + 0.5) * h) - 1), py1 = Math.min(h, Math.ceil((y1 * 0.5 + 0.5) * h) + 1);
  if (px1 <= px0 || py1 <= py0) return null;
  return { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
}

/**
 * The scene's depth before the water, for the water's contact foam (uSceneDepth, uSceneNearFar). A G-buffer with a
 * depth texture (main.js, title-world.js) has its depth buffer blitted, the scissored rectangle only (a hardware copy:
 * no shader, 24 bits, millimetres at 50 m; the water shader makes it a view depth); any other target, its RT1.w
 * copied by a shader (a half float: 1/32 m from 32 m on).
 */
class DepthCopy {
  constructor() {
    this.blit = null;    // a depth-only target the G-buffer's depth is blitted into
    this.copy = null;    // the shader copy of RT1.w (no depth texture)
    this.texture = null;
    this.nearFar = new THREE.Vector3();
    this.vp = new THREE.Matrix4();     // the view-projection it was taken with
    this.eye = new THREE.Vector3();    // and the camera's position
    this.fwd = new THREE.Vector3();
    this.rect = null;
    this.size = [0, 0];
    this.valid = false;
  }
  /** Is the last copy good for this frame: taken last frame, same target, the camera moved little, the water's rectangle inside its own? */
  reusable(gbuffer, camera, rect) {
    if (!this.valid || !gbuffer.depthTexture || this.size[0] !== gbuffer.width || this.size[1] !== gbuffer.height || this.nearFar.z < 0.5) return false;
    if (camera.position.distanceTo(this.eye) > CONTACT_REUSE.move) return false;
    camera.getWorldDirection(_fwd);
    if (_fwd.dot(this.fwd) < Math.cos(CONTACT_REUSE.turn)) return false;
    const r = this.rect;
    return rect.x >= r.x && rect.y >= r.y && rect.x + rect.w <= r.x + r.w && rect.y + rect.h <= r.y + r.h;
  }
  /** The water's uniforms: this copy and the camera it was taken with. */
  bind(U) {
    U.uSceneDepth.value = this.texture;
    U.uSceneNearFar.value.copy(this.nearFar);
    U.uScenePrevVP.value.copy(this.vp);
    U.uScenePrevEye.value.copy(this.eye);
  }
  render(renderer, gbuffer, rect, camera) {
    this.vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    camera.getWorldDirection(this.fwd);
    const w = gbuffer.width, h = gbuffer.height, m = CONTACT_REUSE.margin, r0 = rect ?? { x: 0, y: 0, w, h };
    // (a margin round the water's rectangle: next frame's reprojection may look a little outside it)
    const x0 = Math.max(0, r0.x - m), y0 = Math.max(0, r0.y - m), r = { x: x0, y: y0, w: Math.min(w, r0.x + r0.w + m) - x0, h: Math.min(h, r0.y + r0.h + m) - y0 };
    this.rect = r;
    this.size = [w, h];
    this.valid = true;
    if (gbuffer.depthTexture && camera?.isPerspectiveCamera) {
      if (!this.blit) {
        const depthTexture = new THREE.DepthTexture(w, h, gbuffer.depthTexture.type);
        this.blit = new THREE.WebGLRenderTarget(w, h, { format: THREE.RedFormat, depthBuffer: true, depthTexture });
      }
      if (this.blit.width !== w || this.blit.height !== h) this.blit.setSize(w, h);
      renderer.initRenderTarget?.(this.blit);
      (this._box ??= new THREE.Box2()).min.set(r.x, r.y); this._box.max.set(r.x + r.w, r.y + r.h);
      renderer.copyTextureToTexture(gbuffer.depthTexture, this.blit.depthTexture, this._box, (this._at ??= new THREE.Vector2()).set(r.x, r.y));
      this.texture = this.blit.depthTexture;
      this.nearFar.set(camera.near, camera.far, 1);
      return;
    }
    const c = (this.copy ??= makeCopy());
    if (c.rt.width !== w || c.rt.height !== h) c.rt.setSize(w, h);
    c.material.uniforms.tNormal.value = gbuffer.textures[1];
    c.rt.scissor.set(r.x, r.y, r.w, r.h);
    c.rt.scissorTest = true;
    renderer.setRenderTarget(c.rt);
    renderer.render(c.quad, c.camera);
    this.texture = c.rt.texture;
    this.nearFar.set(0, 0, 0);
  }
  dispose() {
    this.blit?.dispose(); this.blit?.depthTexture?.dispose();
    if (this.copy) { this.copy.rt.dispose(); this.copy.material.dispose(); this.copy.quad.geometry.dispose(); }
    this.blit = this.copy = this.texture = null;
  }
}

function makeCopy() {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthTest: false, depthWrite: false,
    uniforms: { tNormal: { value: null } },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform highp sampler2D tNormal;
      out vec4 outDepth;
      void main() { outDepth = vec4(texelFetch(tNormal, ivec2(gl_FragCoord.xy), 0).w, 0.0, 0.0, 1.0); }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  return { rt, material, quad, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}
/** The over-the-page pass: how far away water still sparkles (m). */
export const WATER_PASS = { reach: 600 };

// ---------------------------------------------------------------- splash drops
/** White drops thrown up from the water, falling back (instanced, inked like everything). */
class Drops {
  constructor(scene, max = 140) {
    const geo = new THREE.IcosahedronGeometry(1, 0).scale(1, 1.25, 1);
    this.mesh = new THREE.InstancedMesh(geo, makeMaterial({ color: '#ffffff', flat: true, key: 'water.drops' }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCollide = true;
    this.mesh.name = 'Splash drops';
    scene.add(this.mesh);
    this.max = max; this.list = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._y = new THREE.Vector3(0, 1, 0); this._v = new THREE.Vector3();
  }
  /** A burst at the surface point p: k 0..2, spread: how far out they fly. */
  burst(p, k = 1, spread = 1) {
    const n = Math.round(4 + 22 * Math.min(k, 2));
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * Math.PI * 2, out = (0.6 + Math.random() * 1.6) * (0.6 + 0.6 * k) * spread, up = (1.6 + Math.random() * 3.2) * (0.5 + 0.55 * k);
      this.list.push({ pos: new THREE.Vector3(p.x + Math.cos(a) * 0.25, p.y, p.z + Math.sin(a) * 0.25), vel: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        size: (0.018 + Math.random() * 0.03) * (0.7 + 0.4 * k), age: 0, life: 0.5 + Math.random() * 0.5, floor: p.y - 0.05 });
    }
  }
  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    this.list = this.list.filter((d) => (d.age += dt) < d.life && d.pos.y > d.floor - 0.01);
    let i = 0;
    for (const d of this.list) {
      d.vel.y -= 14 * dt;
      d.vel.multiplyScalar(Math.exp(-0.8 * dt));
      d.pos.addScaledVector(d.vel, dt);
      const sp = d.vel.length();
      this._q.setFromUnitVectors(this._y, this._v.copy(d.vel).divideScalar(Math.max(sp, 1e-4)));
      const s = d.size * Math.min(1, (1 - d.age / d.life) * 3);
      this._s.set(s, s * (1 + Math.min(sp / 5, 1.2)), s);
      this._m.compose(d.pos, this._q, this._s);
      this.mesh.setMatrixAt(i++, this._m);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- over the page
/**
 * A sea's look under water (a body's userData.sea: src/levels/underwater.js and its views), drawn by the
 * pass over the page while the camera is under it. Every field is optional:
 *   tint, deep       the water's colour near and far (looking level / looking down)
 *   density          how thick it is (1/m; the generic water's 0.085); bands: how many flat steps; min / max:
 *                    the veil's least and most (a flat tinted haze in layers); start: m of clear water first
 *   shafts           light from the surface as flat bands: { cell (m between them: a lattice round the
 *                    camera, each shaft world-anchored), width: [min, max] (m), lean (their slant away from
 *                    the sun: m across a metre down), reach (m down where they are gone), strength, tone, n (the share of cells
 *                    that carry one) }
 *   caustics         printed lines of light on what faces up: { scale (cells a metre), range (m), strength,
 *                    tone, speed }
 *   air(x, y, z)     true inside an air pocket (a dome, a covered street): no water there (surfaceAt)
 */
export const SEA_LOOK = { tint: '#3f8f95', deep: '#1f4f60', density: 0.085, bands: 3, min: 0.28, max: 0.9, start: 0 };
export const SEA_SHAFTS = 25;   // the lattice's cells round the camera (5 × 5)

const hash01 = (i, j, k) => { const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
/** The shafts round (cx, cz): [x, z, half width, strength] per lattice cell, world-anchored (a cell's shaft never moves). */
export function seaShafts(o, cx, cz, out = new Float32Array(SEA_SHAFTS * 4)) {
  const cell = o.cell ?? 30, [w0, w1] = o.width ?? [1.2, 4], n = o.n ?? 0.7;
  const ci = Math.floor(cx / cell), cj = Math.floor(cz / cell);
  let k = 0;
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++, k++) {
    const i = ci + di, j = cj + dj, on = hash01(i, j, 1) < n;
    out[k * 4] = (i + 0.15 + 0.7 * hash01(i, j, 2)) * cell;
    out[k * 4 + 1] = (j + 0.15 + 0.7 * hash01(i, j, 3)) * cell;
    out[k * 4 + 2] = (w0 + (w1 - w0) * hash01(i, j, 4)) / 2;
    out[k * 4 + 3] = on ? 0.55 + 0.45 * hash01(i, j, 5) : 0;
  }
  return out;
}

/**
 * Drawn with alpha over the finished page. Under water: everything sinks into
 * the water's colour in flat bands with distance, a little darker the deeper
 * you look (the surface overhead stays bright: the water shader draws it from
 * below); a sea (SEA_LOOK) has its own colours, its shafts and its caustics.
 * Above water: white dashes of sun where the water shader marked a glint, only
 * where the water is lit, fading with distance.
 */
class WaterPass {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: false, depthWrite: false, transparent: true,
      uniforms: {
        tNormal: { value: null },
        tAlbedo: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uUnder: { value: 0 },
        uSurf: { value: 0 },
        uToon: { value: 0.5 },
        uTint: { value: new THREE.Color('#3f8f95') },
        uDeep: { value: new THREE.Color('#1f4f60') },
        uFog: { value: new THREE.Vector4(SEA_LOOK.density, SEA_LOOK.bands, SEA_LOOK.min, SEA_LOOK.max) },   // density, bands, least, most
        uFogStart: { value: 0 },                                         // m of clear water before it
        uShafts: { value: Array.from({ length: SEA_SHAFTS }, () => new THREE.Vector4()) },                   // x, z, half width, strength
        uShaftDir: { value: new THREE.Vector4(0, -1, 0, 60) },          // their way down (unit), reach (m)
        uShaftTone: { value: new THREE.Vector4(0.92, 0.98, 0.96, 0) },  // colour; strength (0: the generic shafts, < 0: none)
        uCaustic: { value: new THREE.Vector4(0.5, 30, 0, 0.6) },        // cells a metre, range (m), strength, speed
        uCausticTone: { value: new THREE.Color('#e4fbf4') },
        uTime: sharedUniforms.uTime,
      },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tNormal, tAlbedo;
        uniform mat4 uInvProj, uCamWorld;
        uniform float uUnder, uSurf, uTime, uToon, uFogStart;
        uniform vec3 uTint, uDeep, uCausticTone;
        uniform vec4 uFog, uShaftDir, uShaftTone, uCaustic;
        uniform vec4 uShafts[${SEA_SHAFTS}];
        in vec2 vUv;
        out vec4 fragColor;
        // premultiplied layers, each over the ones before
        void over(inout vec4 acc, vec3 c, float a) { acc.rgb = c * a + acc.rgb * (1.0 - a); acc.a = a + acc.a * (1.0 - a); }
        vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        // the caustic net: how far (in cells) from the border of two cells (F2 - F1 over the 3 x 3 round x), the
        // cells' points wandering slowly
        float net(vec2 x) {
          vec2 n = floor(x), f = fract(x);
          float d1 = 8.0, d2 = 8.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = 0.5 + 0.42 * sin(uTime * uCaustic.w + 6.2831 * hash2(n + g));
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return sqrt(d2) - sqrt(d1);
        }
        // the brightest shaft the ray crosses before what it meets (far): each a slanted cylinder down from the
        // surface, seen as a flat band (the nearest approach of the ray to its axis inside its half width)
        float shaftsAlong(vec3 cam, vec3 rd, float far) {
          vec3 L = uShaftDir.xyz;
          float b = dot(rd, L), den = 1.0 - b * b;
          if (den < 1e-4) return 0.0;
          float best = 0.0;
          for (int i = 0; i < ${SEA_SHAFTS}; i++) {
            vec4 S = uShafts[i];
            if (S.w <= 0.0) continue;
            vec3 w0 = cam - vec3(S.x, uSurf, S.y);
            float d = dot(rd, w0), e = dot(L, w0);
            float t = (b * e - d) / den, s = (e - b * d) / den;
            if (t < 0.0 || t > far || s < 0.0) continue;
            float dist = length(w0 + rd * t - L * s);
            if (dist > S.z) continue;
            float across = 1.0 - smoothstep(S.z * 0.45, S.z, dist);
            float down = 1.0 - smoothstep(uShaftDir.w * 0.3, uShaftDir.w, s);
            best = max(best, across * down * S.w);
          }
          return best;
        }
        void main() {
          vec4 N = texture(tNormal, vUv);
          if (uUnder < 0.5) {
            // the sparkle: the water's mark in the normal's length (water-shader.js WATER_MARK)
            float len = length(N.xyz);
            float g = clamp((len - ${(1 + WATER_MARK.base).toFixed(4)}) / ${WATER_MARK.glint.toFixed(4)}, 0.0, 1.0);
            if (N.w <= 0.0 || g < 0.35) discard;
            float la = texture(tAlbedo, vUv).a; la = la < 0.0 ? -la - 1.0 : la;   // (the light term under a line step: materials.js LINE)
            float lit = smoothstep(uToon - 0.02, uToon + 0.02, la - 2.0 * floor(la * 0.5));
            float a = lit * (1.0 - smoothstep(180.0, 520.0, N.w));
            fragColor = vec4(vec3(1.0, 0.99, 0.94), a);
            return;
          }
          vec4 pv = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec3 rd = normalize(mat3(uCamWorld) * (pv.xyz / pv.w));
          vec3 cam = uCamWorld[3].xyz;
          float fwdK = max(dot(rd, -uCamWorld[2].xyz), 0.05);
          float dist = N.w > 0.0 ? N.w / fwdK : 400.0;
          vec4 acc = vec4(0.0);
          // ---- a sea's caustics: printed lines of light on what faces up, near, stronger in the light
          if (uCaustic.z > 0.0 && N.w > 0.0 && N.y > 0.4 && dist < uCaustic.y) {
            vec3 wp = cam + rd * dist;
            vec2 q = wp.xz * uCaustic.x;
            q += 0.35 * vec2(sin(q.y * 0.9 + uTime * 0.5), cos(q.x * 0.8 + uTime * 0.43));
            float fw = max(fwidth(q.x) + fwidth(q.y), 1e-4);
            float line = (1.0 - smoothstep(0.035, 0.035 + fw * 1.3, net(q))) * (1.0 - smoothstep(0.2, 0.5, fw));   // (gone once finer than a few px)
            // in drifting patches, as the light comes through the waves above (never one net over everything)
            float patchK = 0.5 + 0.5 * sin(wp.x * 0.43 + uTime * 0.13) * sin(wp.z * 0.37 - uTime * 0.09 + wp.x * 0.11);
            line *= smoothstep(0.55, 0.85, patchK);
            float la = texture(tAlbedo, vUv).a; la = la < 0.0 ? -la - 1.0 : la;
            float lit = smoothstep(uToon - 0.02, uToon + 0.02, la - 2.0 * floor(la * 0.5));
            over(acc, uCausticTone, line * uCaustic.z * smoothstep(0.4, 0.8, N.y) * mix(0.4, 1.0, lit) * (1.0 - smoothstep(uCaustic.y * 0.5, uCaustic.y, dist)));
          }
          // ---- the way through the water: to the thing seen, or up to the surface
          float toSurf = rd.y > 1e-3 ? (uSurf - cam.y) / rd.y : 1e5;
          float path = min(dist, toSurf);
          float f = 1.0 - exp(-max(path - uFogStart, 0.0) * uFog.x);
          float fb = f * uFog.y;
          f = (floor(fb) + smoothstep(0.4, 0.6, fract(fb))) / uFog.y;          // flat bands, like a printed haze
          float down = clamp(-rd.y, 0.0, 1.0);
          vec3 col = mix(uTint, uDeep, 0.35 + 0.5 * down);
          if (uShaftTone.a == 0.0) {
            // light from the surface: shafts drifting slowly, only looking up
            float shaft = smoothstep(0.55, 0.9, sin(rd.x * 9.0 + rd.z * 5.0 + uTime * 0.25) * 0.5 + 0.5) * clamp(rd.y + 0.4, 0.0, 1.0) * 0.18;
            col = mix(col, vec3(0.92, 0.98, 0.96), shaft);
          }
          over(acc, col, mix(uFog.z, uFog.w, f));
          // ---- a sea's shafts: flat pale bands down from the surface, in two printed steps
          if (uShaftTone.a > 0.0) {
            float sh = shaftsAlong(cam, rd, path);
            float fs = max(fwidth(sh), 1e-3);
            float q = 0.5 * smoothstep(0.12 - fs, 0.12 + fs, sh) + 0.5 * smoothstep(0.55 - fs, 0.55 + fs, sh);
            over(acc, uShaftTone.rgb, q * uShaftTone.a);
          }
          if (acc.a <= 0.002) discard;
          fragColor = vec4(acc.rgb / acc.a, acc.a);
        }
      `,
    });
    this.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._sh = new Float32Array(SEA_SHAFTS * 4);
  }
  /** The uniforms for the water the camera is under (`under`: keepCamera's { y, body }). */
  setUnder(camera, under) {
    const U = this.material.uniforms;
    U.uSurf.value = under.y;
    const sea = under.body?.sea, m = under.body?.mat?.uniforms;
    if (!sea) {
      U.uFog.value.set(SEA_LOOK.density, SEA_LOOK.bands, SEA_LOOK.min, SEA_LOOK.max);
      U.uFogStart.value = 0;
      U.uShaftTone.value.w = 0; U.uCaustic.value.z = 0;
      if (m) { U.uTint.value.copy(m.uColor.value); U.uDeep.value.copy(m.uColor.value).multiplyScalar(0.5); }
      else { U.uTint.value.set('#5aa6a8'); U.uDeep.value.set('#2a5560'); }
      return;
    }
    const o = { ...SEA_LOOK, ...sea };
    U.uTint.value.set(o.tint); U.uDeep.value.set(o.deep);
    U.uFog.value.set(o.density, o.bands, o.min, o.max);
    U.uFogStart.value = o.start;
    const sh = o.shafts;
    if (sh) {
      const v = seaShafts(sh, camera.position.x, camera.position.z, this._sh);
      U.uShafts.value.forEach((u, i) => u.fromArray(v, i * 4));
      // (they slant away from the sun: its way through the water, steeper than in the air)
      const sun = sharedUniforms.uSunDir.value, hl = Math.hypot(sun.x, sun.z) || 1, lean = sh.lean ?? 0.3;
      U.uShaftDir.value.set((-sun.x / hl) * lean, -1, (-sun.z / hl) * lean, 0).normalize();
      U.uShaftDir.value.w = sh.reach ?? 60;
      _c.set(sh.tone ?? '#eafbf6');
      U.uShaftTone.value.set(_c.r, _c.g, _c.b, sh.strength ?? 0.2);
    } else U.uShaftTone.value.w = -1;
    const ca = o.caustics;
    if (ca) {
      U.uCaustic.value.set(ca.scale ?? 0.5, ca.range ?? 30, ca.strength ?? 0.5, ca.speed ?? 0.6);
      U.uCausticTone.value.set(ca.tone ?? '#e4fbf4');
    } else U.uCaustic.value.z = 0;
  }
  render(renderer, camera, { tNormal, tAlbedo, target, toon, under }) {
    const U = this.material.uniforms;
    U.tNormal.value = tNormal;
    U.tAlbedo.value = tAlbedo;
    U.uToon.value = toon;
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(camera.matrixWorld);
    U.uUnder.value = under ? 1 : 0;
    if (under) this.setUnder(camera, under);
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}

/** The breath meter: little inked bubbles under the health bar, only while you hold your breath. */
export class BreathMeter {
  constructor(doc = typeof document !== 'undefined' ? document : null, n = 8) {
    this.n = n;
    this.shown = -1;
    if (!doc) return;
    const el = (this.el = doc.createElement('div'));
    el.id = 'breath';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { position: 'fixed', left: 'calc(16px + var(--safe-left, 0px))', top: 'calc(34px + var(--safe-top, 0px))', zIndex: 30, display: 'flex', gap: '4px',
      opacity: 0, transition: 'opacity .4s', pointerEvents: 'none' });
    for (let i = 0; i < n; i++) {
      const b = doc.createElement('i');
      Object.assign(b.style, { display: 'block', width: '11px', height: '11px', borderRadius: '50%', border: '2px solid #2b211f', background: '#bfe6ea', boxShadow: '1px 1px 0 #2b211f', transition: 'transform .2s, opacity .2s' });
      el.appendChild(b);
    }
    doc.body.appendChild(el);
  }
  /** breath 0..1; on: show it (holding your breath, or catching it back). */
  update(breath, on) {
    if (!this.el) return;
    const full = Math.ceil(breath * this.n - 1e-6);
    this.el.style.opacity = on ? 1 : 0;
    if (full === this.shown) return;
    this.shown = full;
    [...this.el.children].forEach((b, i) => { b.style.opacity = i < full ? 1 : 0.15; b.style.transform = i < full ? 'scale(1)' : 'scale(0.6)'; });
    this.el.classList.toggle('low', full <= 2);
  }
}

/** The water's tint at a point (the shallows' colour of its body), for the swim's drops and the HUD. */
export function waterTone(body, out = _c) {
  const u = body?.mat?.uniforms;
  return u ? out.copy(u.uColor2.value) : out.set('#bfe6ea');
}
