import * as THREE from 'three';
import { openingGrid } from './thresholds.js';

// The light of a way through (issue #391, the author: "it's not a very nice shader, can we do something nicer?"; of three
// looks tried, rays, glow and paper, he picked the glow): a body of light filling the opening, brightest round its frame
// in flat steps, the far side's colour faint in its middle (a room's lamp on the way in, the day on the way out), fading
// as you come close so you see into it; its sides a thin rim back into the frame, a pale pool on the floor before it.
// One mesh and one draw a door, one small program for them all, laid over the finished picture as the veils are
// (src/veil.js: on layer 31, its depth tested by hand against the G-buffer's, after the ink pass: no ink, no shadow),
// flat and banded as the pictures draw light, never a blur. In Unity: the bridge's Hiraeth/DoorLight (port 'doorlight').
//
// The door's frame: x across, y up, z out of the opening on the side it is walked into from (`side`), the sill at 0.
// Each vertex's colour says which part it is of: r its part / 4 (0 the opening, 1 the floor before it, 3 the body's
// sides), g how far out (0 at the opening, 1 at its end), b its distance to the opening's edge / 4 (m).

export const DOOR_LIGHT = {
  color: '#ffe3a6', pool: '#fff1c8',
  room: '#ffcf8f',        // the far side's colour: a room's lamp (the ways in) …
  sky: '#d8ecf0',         // … or the day outside (the ways out)
  edge: 0.8,              // m: how far in from the frame its glow reaches
  fill: 0.22, rim: 0.85,  // alphas: its middle (far off), its frame
  bands: 4,               // the frame's glow in this many flat steps
  near: [1.0, 4.5],       // m: its middle fades out as the eye comes from the far to the near
  depth: 0.6,             // m: its sides back into the frame at the least
  floor: 1.5,             // m: the pool before it, out from the sill (widening 0.45 m each side)
};

function quad(P, verts, parts, uvs) {
  const k = P.pos.length / 3;
  for (let i = 0; i < 4; i++) { P.pos.push(...verts[i]); P.col.push(...parts[i]); P.uv.push(...uvs[i]); }
  P.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
}
const part = (kind, along, edge = 0) => [kind / 4, along, Math.min(edge, 4) / 4, 1];

/** One mesh's geometry for a door's light (door: thresholds.js doorOf; side ±1 the way it is faced). */
export function doorLightGeometry(door, side = 1) {
  const C = DOOR_LIGHT, P = { pos: [], col: [], uv: [], idx: [] }, z = (v) => v * side;
  const { w } = door, g = openingGrid(door), front = Math.max(0, door.depth?.[1] ?? 0);
  // the opening (a grid: each point's distance to the edge, for the frame's glow), a hair back of the sill's plane
  for (const v of g.points) { P.pos.push(v.x, v.y, z(-0.02)); P.col.push(...part(0, 0, v.edge)); P.uv.push(v.u, v.v); }
  P.idx.push(...g.index);
  // the floor before it, widening out
  const out = front + C.floor, s = 0.45, f0 = z(0.02);
  quad(P, [[-w / 2, 0.03, f0], [w / 2, 0.03, f0], [w / 2 + s, 0.03, z(out)], [-w / 2 - s, 0.03, z(out)]],
    [part(1, 0), part(1, 0), part(1, 1), part(1, 1)], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // the body: the opening's sides and top, back into the frame from just out of its face
  const d = Math.max(C.depth, Math.min(1.6, (door.depth?.[0] ?? 0) + front));
  const za = z(Math.min(0.12, front)), zb = z(Math.min(0.12, front) - d);
  for (let i = 0; i < g.outline.length - 1; i++) {
    const p = g.outline[i], q = g.outline[i + 1];
    quad(P, [[p.x, p.y, za], [q.x, q.y, za], [q.x, q.y, zb], [p.x, p.y, zb]], [part(3, 0), part(3, 0), part(3, 1), part(3, 1)], [[p.u, p.v], [q.u, q.v], [q.u, q.v], [p.u, p.v]]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2));
  geo.setIndex(P.idx);
  geo.computeBoundingSphere();
  geo.userData.top = g.top;
  return geo;
}

const f3 = (x) => x.toFixed(3);
const vertexShader = /* glsl */ `
  out vec4 vPart;
  out float vDepth;
  void main() {
    vPart = color;
    vec4 v = viewMatrix * modelMatrix * vec4(position, 1.0);
    vDepth = -v.z;
    gl_Position = projectionMatrix * v;
  }
`;
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform vec3 uColor, uPool, uFar;
  uniform float uNight;
  uniform vec4 uDoor;    // x how strongly it shows (its fade, its breath, its flare), y the eye's distance from it (m)
  in vec4 vPart;
  in float vDepth;
  out vec4 outColor;
  float bands(float x, float n) { return floor(clamp(x, 0.0, 1.0) * n + 0.5) / n; }
  void main() {
    // by hand against the scene's depth: under anything nearer, nothing (src/veil.js)
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && scene < vDepth + 0.06) discard;
    float part = vPart.x * 4.0, along = vPart.y, edge = vPart.z * 4.0;
    float near = smoothstep(${f3(DOOR_LIGHT.near[0])}, ${f3(DOOR_LIGHT.near[1])}, uDoor.y);
    vec3 col = uColor; float a;
    if (part < 0.5) {
      // the opening: brightest at its frame, in flat steps; the far side's colour faint in its middle
      float k = bands(pow(1.0 - clamp(edge / ${f3(DOOR_LIGHT.edge)}, 0.0, 1.0), 1.6), ${f3(DOOR_LIGHT.bands)});
      col = mix(uFar, uColor, k);
      a = mix(${f3(DOOR_LIGHT.fill)} * near, ${f3(DOOR_LIGHT.rim)}, k) * mix(0.55, 1.0, near);
    } else if (part < 1.5) { a = 0.3 * bands(1.0 - along, 3.0); col = uPool; }
    else a = 0.35 * bands(1.0 - along, 2.0) * mix(0.5, 1.0, near);
    col *= 1.0 + 0.4 * uNight;
    outColor = vec4(col, clamp(a * uDoor.x, 0.0, 1.0));
  }
`;

/** A door's light's material (one program for every door; the light's shared uniforms bound by Veils.bind). */
export function doorLightMaterial({ far = DOOR_LIGHT.room } = {}) {
  const C = DOOR_LIGHT;
  return new THREE.ShaderMaterial({
    name: 'door light', glslVersion: THREE.GLSL3, vertexShader, fragmentShader, vertexColors: true,
    uniforms: {
      tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uColor: { value: new THREE.Color(C.color) }, uPool: { value: new THREE.Color(C.pool) }, uFar: { value: new THREE.Color(far) },
      uNight: { value: 0 }, uDoor: { value: new THREE.Vector4(0, 10, 0, 0) },
    },
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}
