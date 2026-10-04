import * as THREE from 'three';
import { buildSpace } from './model.js';
import { PLANETS } from './planets.js';

// The approach from space at the start of an arrival by ship: the destination
// planet, drawn the way the galactic map draws it (src/ship/planets.js: its
// body colour, a flat shadow crescent hatched in ink, its own mark: dune
// stripes, cloud bands, craters, continents, a ring, a moon, lit windows), and
// a thin rim of atmosphere. The planet is a prop that always faces the camera
// (so its lit side and crescent stay put on screen) while its markings turn
// slowly; the cinematic grows it by bringing it nearer.
//
// The planet writes the G-buffer itself (flat colours, self-lit), so the post
// pass inks its outline like everything else, at any distance.

const INK = '#2b211f', CREAM = '#f7ecd2';
const DEFAULT = { body: '#9aa3c7', shade: '#6b739a', ink: CREAM, mark: 'craters' };
export const MARK_IDS = { dunes: 1, bands: 2, craters: 3, lands: 4, lights: 5, ring: 6, moon: 7 };

/** The world's planet colours and mark (as on the galactic map). */
export const planetLook = (id) => PLANETS[id] ?? DEFAULT;

const vertexShader = /* glsl */ `
  out vec3 vObj;
  out vec3 vN;
  out float vDepth;
  void main() {
    vObj = normalize(position);
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uBody, uShade, uMark, uInk, uCream;
  uniform int uKind;
  uniform float uSpin;
  uniform vec3 uLight;     // planet-local (its +z faces the camera)
  in vec3 vObj;
  in vec3 vN;
  in float vDepth;
  layout(location = 0) out highp vec4 gAlbedoLight;
  layout(location = 1) out highp vec4 gNormalDepth;
  layout(location = 2) out highp vec4 gHatch;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }
  float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
  // a crisp edge of a field f at level th, anti-aliased by its screen rate
  float cut(float f, float th) { float w = fwidth(f) * 0.75 + 1e-4; return smoothstep(th - w, th + w, f); }
  float line(float f, float th, float px) { float w = fwidth(f) + 1e-4; return 1.0 - smoothstep(px * 0.5 * w, (px * 0.5 + 1.0) * w, abs(f - th)); }

  void main() {
    vec3 n = normalize(vObj);
    // the markings turn with the planet (about its own axis, tipped a little toward us)
    float c = cos(uSpin), s = sin(uSpin);
    vec3 q = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
    vec3 col = uBody;
    float ink = 0.0;
    if (uKind == 1) {           // dunes: wavy stripes along the latitudes
      float lon = atan(q.z, q.x);
      float v = q.y * 5.5 + 0.22 * sin(lon * 5.0 + q.y * 4.0) + 0.1 * sin(lon * 11.0);
      float st = fract(v);
      col = mix(col, uMark, cut(st, 0.62) * (1.0 - cut(st, 0.86)));
      ink = max(ink, line(st, 0.62, 1.2) * 0.6);
    } else if (uKind == 2) {    // cloud bands
      float v = q.y + 0.05 * sin(atan(q.z, q.x) * 3.0 + q.y * 9.0) + (fbm(q * 3.0) - 0.5) * 0.08;
      float b = cut(v, -0.52) * (1.0 - cut(v, -0.34)) + cut(v, -0.06) * (1.0 - cut(v, 0.04)) + cut(v, 0.28) * (1.0 - cut(v, 0.5));
      col = mix(col, uMark, clamp(b, 0.0, 1.0));
    } else if (uKind == 3 || uKind == 7) {   // craters (a moon world shows a few too)
      for (int i = 0; i < 9; i++) {
        vec3 cdir = normalize(vec3(hash(vec3(float(i), 1.0, 2.0)), hash(vec3(float(i), 3.0, 5.0)), hash(vec3(float(i), 7.0, 11.0))) * 2.0 - 1.0);
        float r = 0.12 + 0.16 * hash(vec3(float(i), 13.0, 17.0));
        float d = acos(clamp(dot(q, cdir), -1.0, 1.0));
        col = mix(col, uMark, 1.0 - cut(d, r));
        ink = max(ink, line(d, r, 1.6));
      }
    } else if (uKind == 4) {    // continents with inked coasts
      float f = fbm(q * 2.1 + 3.0);
      col = mix(col, uMark, cut(f, 0.53));
      ink = max(ink, line(f, 0.53, 1.6));
    } else if (uKind == 5) {    // lit windows: small squares scattered over the surface
      vec3 g = q * 9.0, cell = floor(g), fr = fract(g) - 0.5;
      float on = step(0.72, hash(cell));
      float sq = (1.0 - cut(max(abs(fr.x), max(abs(fr.y), abs(fr.z))), 0.16)) * on;
      col = mix(col, uMark, sq);
    }
    // the crescent in shadow, flat, hatched in ink across the disc
    float lit = dot(n, normalize(uLight));
    float shadow = 1.0 - cut(lit, 0.1);
    col = mix(col, uShade * mix(vec3(1.0), col / max(uBody, vec3(0.05)), 0.35), shadow);
    float hv = (n.x - n.y) * 34.0;
    float hatch = line(fract(hv), 0.5, 1.1) * cut(-lit, 0.08);
    ink = max(ink, hatch * 0.8);
    // the highlight arc near the lit limb (as the map draws it)
    float rim = length(n.xy), ang = atan(n.y, n.x);
    float hl = cut(rim, 0.78) * (1.0 - cut(rim, 0.84)) * cut(ang, 1.75) * (1.0 - cut(ang, 2.55));
    col = mix(col, uCream, hl * 0.9);
    col = mix(col, uInk, clamp(ink, 0.0, 1.0));
    gAlbedoLight = vec4(col, 1.0);
    gNormalDepth = vec4(normalize(vN), vDepth);
    gHatch = vec4(0.0, 0.0, 0.0, 1.0);    // self-lit: it keeps its colours whatever the level's sun does
  }`;

/** The planet's own material (flat colours in the world's palette, written straight to the G-buffer). */
export function planetMaterial(id) {
  const p = planetLook(id);
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader, fragmentShader,
    uniforms: {
      uBody: { value: new THREE.Color(p.body) }, uShade: { value: new THREE.Color(p.shade) }, uMark: { value: new THREE.Color(p.ink) },
      uInk: { value: new THREE.Color(INK) }, uCream: { value: new THREE.Color(CREAM) },
      uKind: { value: MARK_IDS[p.mark] ?? 3 }, uSpin: { value: 0 }, uLight: { value: new THREE.Vector3(-0.55, 0.5, 0.68) },
      uGlow: { value: 1 },   // (read by the shadow pass: self-lit things cast no shadow)
    },
  });
}

function flatMaterial(color) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `out float vDepth; out vec3 vN;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `precision highp float; uniform vec3 uColor; in float vDepth; in vec3 vN;
      layout(location = 0) out highp vec4 gAlbedoLight; layout(location = 1) out highp vec4 gNormalDepth; layout(location = 2) out highp vec4 gHatch;
      void main() { gAlbedoLight = vec4(uColor, 1.0); gNormalDepth = vec4(normalize(vN), vDepth); gHatch = vec4(0.0, 0.0, 0.0, 1.0); }`,
  });
}

/**
 * Space round the ship for the approach: the prologue's dome of stars (src/ship/model.js buildSpace,
 * its own planet put away) and the destination planet (a unit sphere: scale it to its radius).
 * @returns { group, planet, update(dt) }
 */
export function buildApproach(id, { radius = 1700 } = {}) {
  const group = buildSpace({ radius });
  group.userData.planet.visible = false;
  for (const o of group.children) if (o !== group.userData.planet && o.geometry?.type === 'SphereGeometry' && o.geometry.parameters.radius < 100) o.visible = false;   // the prologue's moon
  const look = planetLook(id);
  const planet = new THREE.Group();
  planet.name = 'approach-planet';
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), planetMaterial(id));
  body.userData.noCollide = true;
  planet.add(body);
  // a thin rim of air round the limb, in the planet's light colour
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.035, 96), flatMaterial(new THREE.Color(look.ink).lerp(new THREE.Color(CREAM), 0.5)));
  rim.position.z = -0.02;
  planet.add(rim);
  if (look.mark === 'ring') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.62, 128), flatMaterial(look.ink));
    ring.rotation.set(-1.25, 0.2, -0.32);
    planet.add(ring);
  }
  if (look.mark === 'moon') {
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), flatMaterial(look.ink));
    moon.position.set(1.05, 0.95, -0.6);
    planet.add(moon);
  }
  group.add(planet);
  group.userData.noCollide = true;
  return {
    group, planet, body,
    update(dt) { body.material.uniforms.uSpin.value += dt * 0.05; },
  };
}
