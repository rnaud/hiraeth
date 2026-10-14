import * as THREE from 'three';
import { Veils } from './veil.js';

// ---------------------------------------------------------------------------
// The deadly drop's look (issue #312, the author: "Make it clearer when the pit is deadly when I fall"): every drop
// that puts you back at a mark or where you last stood (a temple's pit, src/temples/pieces.js Pit; a world's void,
// level.deadlyPits) fills with the makers' dark from below. What lies in it (its walls, its floor, a pier standing
// in it, the traveller falling) sinks into a deep ink as it goes down, in a few flat steps as the pictures shade,
// and at the bottom slow pale rings turn in the dark, so the eye reads "no floor down there" from the lip. A drop
// with a floor to land on (a stair well, Vael's cleft round the lone tower) has none of it.
//
// Drawn as a wash over the finished picture (src/veil.js: after the ink pass, the scene's depth read by hand): the
// pit's box, its inside faces only (so it draws from outside it and from within), each pixel finding where its ray
// meets the scene inside the box and darkening it by how far under the box's top that is. One draw a pit, a few ALU
// a pixel, only where the box is on the screen; in the washes' own scene (never in the G-buffer: no ink, no shadow).
//
//   const v = pitVoid(veils, { min, max, frame, color, ring })   min/max: the box in `frame`'s local metres
//   v.update(t)                                                  the rings' clock (s)
// ---------------------------------------------------------------------------

/**
 * The look: `fade` m under the box's top it is all but black (`dark` of the way), in `steps` flat tones; the rings
 * `ring` m apart turning at `turn` rad/s, `line` their strength, on what lies flat in it (a floor, water: all dark).
 */
export const PIT_VOID = { fade: 7, dark: 0.94, steps: 4, ring: 3.2, turn: 0.45, line: 0.32, color: '#120b18', glow: '#70e7df' };

const vertexShader = /* glsl */ `
  out vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform mat4 uInv;        // world -> the box's frame
  uniform vec3 uMin, uMax;  // the box, in its frame
  uniform vec3 uColor, uRing;
  uniform vec4 uLook;       // fade (m), dark, steps, clock (s)
  uniform vec4 uRings;      // apart (m), turn (rad/s), line
  uniform vec2 uMid;        // the rings' middle, in the box's frame (x, z)
  in vec3 vWorld;
  out vec4 outColor;
  void main() {
    vec3 rdW = normalize(vWorld - cameraPosition);
    vec3 ro = (uInv * vec4(cameraPosition, 1.0)).xyz, rd = normalize(mat3(uInv) * rdW);
    // the ray through the box (its slabs)
    vec3 inv = vec3(rd.x < 0.0 ? -1.0 : 1.0, rd.y < 0.0 ? -1.0 : 1.0, rd.z < 0.0 ? -1.0 : 1.0) / max(abs(rd), vec3(1e-5));
    vec3 a = (uMin - ro) * inv, b = (uMax - ro) * inv;
    vec3 lo = min(a, b), hi = max(a, b);
    float t0 = max(max(max(lo.x, lo.y), lo.z), 0.0), t1 = min(min(hi.x, hi.y), hi.z);
    if (t1 <= t0) discard;
    // where it meets the scene (the G-buffer's view depth; 0: nothing, the sky, as deep as the box goes)
    vec4 g = texture(tNormal, gl_FragCoord.xy / uRes);
    float s = g.w;
    vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    float ts = s > 0.0 ? s / max(dot(rdW, fwd), 1e-4) : 1e9;
    if (ts < t0) discard;   // (in front of the box: a ledge, the traveller on the lip)
    vec3 q = ro + rd * min(ts, t1);
    float depth = uMax.y - q.y;
    // what lies flat in it (a floor, water: whatever you would land on is where it puts you back) all dark; the walls
    // darker the deeper; past everything, the box's bottom, the dark softened toward its sides there (no hard box in
    // the stars of a void)
    bool none = ts >= t1;
    float side = min(min(q.x - uMin.x, uMax.x - q.x), min(q.z - uMin.z, uMax.z - q.z));
    float lies = none ? step(q.y, uMin.y + 0.05) : smoothstep(0.6, 0.9, normalize(mat3(uInv) * g.xyz).y) * smoothstep(0.0, 0.3, depth);
    float k = max(smoothstep(0.0, uLook.x, depth), lies);
    // flat steps, as the pictures shade (softened a touch at each step's edge)
    float st = k * uLook.z, f = fract(st);
    k = (floor(st) + smoothstep(0.82, 1.0, f)) / uLook.z;
    // the slow rings on what lies down there, round their middle
    vec2 c = q.xz - uMid;
    float r = length(c), ang = atan(c.y, c.x), T = uLook.w;
    float band = sin(6.2832 * r / uRings.x - T * uRings.y * 2.0 + ang * 2.0 + 0.8 * sin(T * 0.31 + r * 0.21));
    float line = smoothstep(0.9, 0.985, band) * lies * uRings.z;
    float alpha = max(k * uLook.y, line) * (none ? smoothstep(0.0, 8.0, side) : 1.0);
    outColor = vec4(mix(uColor, uRing, line), alpha);
  }
`;

const _c = new THREE.Vector3(), _s = new THREE.Vector3();

/**
 * One deadly drop's look. o: { min, max ([x, y, z] or Vector3, in `frame`'s local metres), frame (a Matrix4 local ->
 * world: a temple's kit.frame; the world's by default), color, ring (colours), fade (m), dark (0..1), apart (m between the rings), rings (0..1, how strong), mid
 * ([x, z] their middle, in the frame; the box's by default), of (an object: shown only while it is), name }. veils null
 * (a test): the mesh alone, not drawn.
 */
export function pitVoid(veils, { min, max, frame = new THREE.Matrix4(), color = PIT_VOID.color, ring = PIT_VOID.glow, fade = PIT_VOID.fade, dark = PIT_VOID.dark, apart = PIT_VOID.ring, rings = 1, mid = null, of = null, name = 'A deadly drop (wash)' } = {}) {
  const lo = Array.isArray(min) ? new THREE.Vector3(...min) : min.clone(), hi = Array.isArray(max) ? new THREE.Vector3(...max) : max.clone();
  const m = mid ? new THREE.Vector2(mid[0], mid[1]) : new THREE.Vector2((lo.x + hi.x) / 2, (lo.z + hi.z) / 2);
  const ringC = new THREE.Color(color).lerp(new THREE.Color(ring), PIT_VOID.line);
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader, fragmentShader,
    uniforms: {
      tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uInv: { value: frame.clone().invert() }, uMin: { value: lo }, uMax: { value: hi },
      uColor: { value: new THREE.Color(color) }, uRing: { value: ringC },
      uLook: { value: new THREE.Vector4(Math.min(fade, Math.max(1, hi.y - lo.y)), dark, PIT_VOID.steps, 0) },
      uRings: { value: new THREE.Vector4(apart, PIT_VOID.turn, rings, 0) }, uMid: { value: m },
    },
    transparent: true, depthTest: false, depthWrite: false, side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name;
  mesh.userData.noCollide = true; mesh.userData.pitVoid = true; mesh.castShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.matrix.compose(_c.addVectors(lo, hi).multiplyScalar(0.5), new THREE.Quaternion(), _s.subVectors(hi, lo)).premultiply(frame);
  mesh.matrixWorld.copy(mesh.matrix);
  mesh.renderOrder = 2;
  const box = new THREE.Box3(lo, hi);
  if (veils) veils.addWash(mesh, of);
  return {
    mesh, box, frame,
    /** the rings' clock (s) */
    update(t) { material.uniforms.uLook.value.w = t; },
    /** Is the world point p in the drop (its box)? */
    contains(p) { return box.containsPoint(_c.copy(p).applyMatrix4(material.uniforms.uInv.value)); },
    dispose() { veils?.remove(mesh); mesh.geometry.dispose(); material.dispose(); },
  };
}

/**
 * A world's deadly void (its kill height: level.voidY, else a finite level.killY): under it, past everything the world
 * has, its rings over a lighter dark (`dark`: a void's own stars still show through), only where you look down into
 * nothing (a world with ground under every drop shows none of it). A box `depth` m deep under that height, as wide as
 * the world's reach; the rings `apart` m apart round the landing. Null where the world has no such height (a fall there always lands).
 *
 *   const v = worldVoid(level)   main.js, before the washes are bound (level.veils made if it has none); v?.update(t)
 */
export const WORLD_VOID = { depth: 3, apart: 9, margin: 400, dark: 0.35, rings: 0.5 };
export function worldVoidY(level) {
  const y = level?.voidY ?? level?.killY;
  return Number.isFinite(y) ? y : null;
}
export function worldVoid(level, veils = null) {
  const y = worldVoidY(level);
  if (y === null) return null;
  veils ??= (level.veils ??= new Veils());
  const R = (level.limit ?? 1900) + WORLD_VOID.margin, at = level.spawn ?? { x: 0, z: 0 };
  return pitVoid(veils, { min: [-R, y - WORLD_VOID.depth, -R], max: [R, y, R], fade: WORLD_VOID.depth, dark: WORLD_VOID.dark, rings: WORLD_VOID.rings, apart: WORLD_VOID.apart, mid: [at.x, at.z], name: 'The world\u2019s deadly void (wash)' });
}
