import * as THREE from 'three';

// The sun's shadow maps: orthographic cascades that follow the player
// (fine: crisp character shadows, near: the street around you, far: mesas
// shadowing the dunes a kilometre off). Sampled in materials.js getShadow().
//
// Stable shadows (no shimmer while you walk, ride or turn the camera):
//  - each cascade has a fixed size (not fitted to the view), so a texel is
//    always the same number of metres
//  - its window moves in whole texels across the light plane and in whole
//    depth steps along the light, so a wall's shadow lands on exactly the
//    same texels, with exactly the same stored depth, from frame to frame
//  - the light direction is quantised (shadowDirection): a moving sun turns
//    every cascade together in rare tiny steps, never a little every frame
//
// Cheap shadows (ShadowCuller): a pass skips casters whose shadow cannot
// fall inside the camera's view, and casters smaller than about a texel.

const DEG = Math.PI / 180;

/**
 * The direction the shadow maps are rendered from: `dir` rounded to a fixed
 * grid of elevation and azimuth (stepDeg). Between two steps the maps keep
 * their orientation, so the texel grid never rotates under a static scene.
 */
export function shadowDirection(dir, out = new THREE.Vector3(), stepDeg = 0.25) {
  const s = stepDeg * DEG;
  const el = Math.round(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / s) * s;
  const az = Math.round(Math.atan2(dir.x, dir.z) / s) * s;
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

/**
 * Snap a light-space position (x, y across the light, z along it) to the
 * cascade's grid: x and y to whole texels, z to whole depth steps. Pure; the
 * window centred there has its texel edges on the grid.
 */
export function snapLightSpace(ls, texel, zStep, out = new THREE.Vector3()) {
  return out.set(Math.round(ls.x / texel) * texel, Math.round(ls.y / texel) * texel, Math.round(ls.z / zStep) * zStep);
}

/**
 * One cascade. Bias and normal offset are given in texels (so a smaller map,
 * the handheld preset's, scales them with its bigger texels).
 * uniforms: { map, matrix, bias, offset } shared uniform objects.
 */
export class Cascade {
  constructor({ size, extent, depth, bias = 2.2, offset = 3, uniforms, name = '' }) {
    this.name = name;
    this.extent = extent;
    this.depth = depth;
    this.biasTexels = bias;
    this.offsetTexels = offset;
    this.U = uniforms;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
    this.cam.matrixAutoUpdate = false;
    this.dir = new THREE.Vector3(0, 0, 0);
    this.ls = new THREE.Vector3();
    this.snapped = new THREE.Vector3();
    this.enabled = true;
    this.rt = null;
    this.configure(size, extent);
  }

  /** One texel, in metres. */
  get texel() { return (this.extent * 2) / this.size; }

  /** Map size (px) and half-width (m); bias and normal offset follow the texel. */
  configure(size, extent = this.extent) {
    this.enabled = true;
    this.extent = extent;
    if (this.size !== size || !this.rt) {
      this.size = size;
      this.rt?.dispose();
      const depthTexture = new THREE.DepthTexture(size, size);
      // hardware comparison + linear filtering: each lookup is a bilinear 2x2 PCF (sampler2DShadow)
      depthTexture.compareFunction = THREE.LessEqualCompare;
      depthTexture.minFilter = depthTexture.magFilter = THREE.LinearFilter;
      this.rt = new THREE.WebGLRenderTarget(size, size, { format: THREE.RedFormat, depthBuffer: true, depthTexture });
      this.U.map.value = depthTexture;
    }
    this.U.bias.value = (this.biasTexels * this.texel) / this.depth;   // depth-buffer units
    this.U.offset.value = this.offsetTexels * this.texel;              // metres along the normal
    this.dir.set(0, 0, 0);   // re-aim and re-place on the next update
  }

  /** Point the cascade along a (quantised) light direction; true if it turned. */
  aim(dir) {
    if (this.dir.equals(dir)) return false;
    this.dir.copy(dir);
    const cam = this.cam;
    cam.position.set(0, 0, 0);
    cam.up.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.99) cam.up.set(0, 0, 1);
    cam.lookAt(-dir.x, -dir.y, -dir.z);   // looking along the light, from the sun's side
    cam.updateMatrix();
    cam.updateMatrixWorld(true);
    return true;
  }

  /** Centre the window on `center`, snapped to the texel / depth grid. */
  place(center) {
    const cam = this.cam, texel = this.texel, half = this.extent;
    this.ls.copy(center).applyMatrix4(cam.matrixWorldInverse);
    const s = snapLightSpace(this.ls, texel, this.depth / 32, this.snapped);
    cam.left = s.x - half; cam.right = s.x + half;
    cam.bottom = s.y - half; cam.top = s.y + half;
    cam.near = -s.z - this.depth / 2; cam.far = -s.z + this.depth / 2;
    cam.updateProjectionMatrix();
    this.U.matrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  }

  update(center, dir) { this.aim(dir); this.place(center); }

  /** Turn the cascade off: every lookup falls outside it (its matrix maps everything off the map). */
  disable() {
    this.enabled = false;
    this.U.matrix.value.set(0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
  }

  /** Allocate the map now (cleared: no shadow): a shadow sampler must never see an unallocated texture. */
  prime(renderer) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.setRenderTarget(prev);
  }

  render(renderer, scene) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.cam);
  }
}

// ------------------------------------------------------------------ caster culling
const _s = new THREE.Vector3(), _sph = new THREE.Sphere(), _pm = new THREE.Matrix4(), _fr = new THREE.Frustum();

/**
 * Which meshes each shadow pass draws. Per frame, every candidate's world
 * bounding sphere is swept away from the sun (the volume its shadow can
 * darken); a pass skips the caster if that volume misses the camera's view
 * frustum (cut at the distance the cascade serves), or if the caster is
 * smaller than `minTexels` texels of that cascade (a person in the km-wide
 * map, a cup in the street-sized one).
 *
 * Only meshes with trustworthy bounds take part: frustum-culled meshes and
 * InstancedMeshes with computed bounds (perf.js fitBounds). Skinned people
 * use their rest-pose sphere, padded. Everything else is always drawn.
 */
export class ShadowCuller {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.n = -1;
    this.frustum = new THREE.Frustum();
    this.sweepTo = -Infinity;   // the lowest geometry (y): no shadow falls further
    this.stats = {};
  }

  /** (Re)collect candidates; cheap enough to call every second or when the scene changes. */
  collect() {
    const items = [], ground = [];
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      // anything (culled or not: water planes, unculled ground) can receive a shadow; not the sky-sized
      if (g.boundingSphere && g.boundingSphere.radius < 2500 && !o.isInstancedMesh) ground.push(o);
      if (o.material?.allowOverride === false) return;
      let local;
      if (o.isInstancedMesh) {
        if (!o.frustumCulled || !o.boundingSphere) return;
        local = o.boundingSphere;
      } else {
        local = g.boundingSphere;
        if (!local || !Number.isFinite(local.radius)) return;
        if (!o.frustumCulled && !o.isSkinnedMesh) return;
      }
      items.push({ o, local, pad: o.isSkinnedMesh ? 1.4 : 1, c: new THREE.Vector3(), r: 0 });
    });
    this.items = items;
    this.ground = ground;
    this.floorAt = null;
    this.n = this.scene.children.length;
  }

  /** The lowest surface within 3 km of the camera (parked, pooled things far below don't count). */
  updateFloor(cam) {
    let floor = Infinity;
    for (const o of this.ground) {
      if (!o.visible) continue;
      _sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      if (_sph.center.distanceToSquared(cam) < 3000 * 3000) floor = Math.min(floor, _sph.center.y - _sph.radius);
    }
    this.floor = floor;
    this.floorAt = cam.clone();
  }

  /**
   * Once a frame, before the shadow passes.
   * @param camera the view camera
   * @param lightDir towards the sun (normalised)
   * @param opts.vertical  false for worlds whose "down" is not -y (planets): shadows sweep the full length
   */
  begin(camera, lightDir, { vertical = true } = {}) {
    if (this.n !== this.scene.children.length || !this.items.length) this.collect();
    camera.updateMatrixWorld();
    this.cam = camera;
    this.light = lightDir;
    if (!this.floorAt || this.floorAt.distanceToSquared(camera.position) > 200 * 200) this.updateFloor(camera.position);
    this.vertical = vertical && lightDir.y > 0.05;
    for (const it of this.items) {
      const o = it.o;
      if (!o.visible) { it.r = -1; continue; }
      it.c.copy(it.local.center).applyMatrix4(o.matrixWorld);
      it.r = it.local.radius * o.matrixWorld.getMaxScaleOnAxis() * it.pad + (it.pad > 1 ? 0.3 : 0);
    }
    this.sweepTo = this.floor - 1;   // nothing lies lower to receive a shadow
  }

  /**
   * Hide this pass's needless casters; returns them (show them again after the pass).
   * @param reach  how far from the camera this cascade's shadows are seen (m)
   * @param texel  the cascade's texel (m)
   * @param maxSweep  the longest shadow worth following (m), e.g. the cascade's depth
   */
  hide(reach, texel, maxSweep, minTexels = 0.75, out = []) {
    const cam = this.cam, L = this.light;
    _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    // cut the far plane at the cascade's reach
    const fwd = cam.getWorldDirection(_s);
    const far = _fr.planes[4];
    far.normal.copy(fwd).negate();
    far.constant = fwd.dot(cam.position) + reach;
    const minR = texel * minTexels;
    let tested = 0, culled = 0;
    for (const it of this.items) {
      if (it.r < 0) continue;
      tested++;
      const c = it.c, r = it.r;
      let skip = r < minR;
      if (!skip) {
        // sweep: from the caster away from the sun, down to the lowest ground (or maxSweep)
        let len = maxSweep;
        if (this.vertical) len = Math.min(len, Math.max(0, c.y + r - this.sweepTo) / L.y);
        for (let k = 0; k < 6; k++) {
          const p = _fr.planes[k];
          const d0 = p.distanceToPoint(c), d1 = d0 - len * p.normal.dot(L);
          if (d0 < -r && d1 < -r) { skip = true; break; }
        }
      }
      if (skip) { it.o.visible = false; out.push(it.o); culled++; }
    }
    this.stats[`${Math.round(texel * 1000)}`] = { tested, culled };
    return out;
  }
}
