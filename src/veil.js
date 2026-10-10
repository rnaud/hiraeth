import * as THREE from 'three';
import { HAZE } from './post.js';

// ---------------------------------------------------------------------------
// See-through surfaces (docs/systems/rendering.md, "Half-transparent surfaces"): Lorn II's giant mushrooms, the
// sheets' pale glassy caps and stalks with the dark wood showing through them.
//
// The game's surfaces are opaque (one G-buffer, an ink pass over it), so a see-through one is drawn in two parts:
//   1. in the G-buffer, only its rim (makeMaterial({ veil }): where it faces the eye more squarely than `veil` it is
//      discarded, as the bubble helmet's glass is). The rim is a surface like any other: shaded, hatched, and inked
//      by the post pass (its outline, and a thin inner line where the rim gives way to what is behind it).
//   2. after the ink pass, over the finished picture, its body as a pale wash (this file): the surface again, sharing
//      the G-buffer mesh's geometry, flat-lit in the world's light and shade tints, softly glowing if it glows, hazed
//      by distance as the ink pass hazes the world, and laid over what is behind it at `alpha` a layer (a cap's two
//      skins, a stalk's near and far wall: about half). Its depth is tested by hand against the G-buffer's (the
//      motes' way): hidden by anything in front of it, and not laid over its own rim.
// Cost: one draw per G-buffer mesh that wears a veil (Lorn II: one per mushroom colour, ~12), a few ALU a pixel.
//
//   const veils = new Veils()
//   mesh.material = makeMaterial({ …, veil: VEIL.cap }); veils.add(mesh, { color, glow })
//   veils.bind({ tNormal: gbuffer.textures[1], uniforms: post.uniforms })   main.js, once
//   veils.render(renderer, camera, composeRT)                               main.js, after the composite
// ---------------------------------------------------------------------------

/**
 * The cut (makeMaterial's `veil`: |n·v| over it is see-through) for a cap and a stalk, and the wash: `alpha` a layer
 * (a stalk's, `stalkAlpha`: thicker, it reads as a body), more where it glows (`glowAlpha`), lit between the world's shade and light (`shade` .. 1 of the light by the sun).
 */
export const VEIL = { cap: 0.42, stalk: 0.5, alpha: 0.3, stalkAlpha: 0.4, glowAlpha: 0.4, shade: 0.35, depthEps: 0.08 };

const SHARED = ['uLightTint', 'uShadowTint', 'uNight', 'uSunDir', 'uSkyHorizon', 'uHaze', 'uFogDensity', 'uFogStart', 'uFogMul', 'uHazeLayers', 'uHazeTone', 'uHeightFog', 'uHeightFogTone'];

const vertexShader = /* glsl */ `
  out vec3 vWorld;
  out vec3 vN;
  out float vDepth;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 v = viewMatrix * w;
    vDepth = -v.z;
    gl_Position = projectionMatrix * v;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tNormal;
  uniform vec2 uRes;
  uniform vec3 uColor;
  uniform vec3 uWash;   // alpha, glow, and how near the eye it fades out (m: 0 never; the City-Shaft's air pillars, ridden)
  uniform vec3 uLightTint, uShadowTint, uSunDir, uSkyHorizon;
  uniform float uNight, uFogDensity, uFogStart, uFogMul;
  uniform vec4 uHaze, uHazeLayers, uHazeTone, uHeightFog, uHeightFogTone;
  in vec3 vWorld;
  in vec3 vN;
  in float vDepth;
  out vec4 outColor;
  void main() {
    // by hand against the scene's depth: under something nearer, or on its own rim (drawn in the G-buffer), nothing
    float scene = texture(tNormal, gl_FragCoord.xy / uRes).w;
    if (scene > 0.0 && scene < vDepth + ${VEIL.depthEps.toFixed(3)}) discard;
    vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
    float lit = smoothstep(0.0, 0.6, dot(n, normalize(uSunDir)) * 0.5 + 0.5) * (1.0 - uNight * 0.6);
    float glow = uWash.y;
    vec3 col = uColor * mix(uShadowTint, mix(uLightTint, vec3(1.12), glow), max(mix(${VEIL.shade.toFixed(2)}, 1.0, lit), glow));
    // hazed as the ink pass hazes the world (post.js 4, 4b): its layers by distance, the far fog, the low mist
    vec3 rd = vWorld - cameraPosition;
    float d = length(rd); rd /= max(d, 1e-4);
    vec3 skyC = uHaze.a > 0.0 ? mix(uSkyHorizon, uHaze.rgb, uHaze.a * (1.0 - uNight)) : uSkyHorizon;
    float fog = 1.0 - exp(-max(d - uFogStart, 0.0) * uFogDensity * uFogMul);
    vec3 hazeC = mix(skyC, uHazeTone.rgb, uHazeTone.a * (1.0 - 0.7 * uNight));
    if (uHazeLayers.w > 0.0) {
      float t = log2(max(d, 1.0) / uHazeLayers.x) / log2(uHazeLayers.y);
      float L = clamp(floor(t) + 1.0 + smoothstep(${(1 - HAZE.edge).toFixed(3)}, 1.0, fract(t)), 0.0, uHazeLayers.w);
      col = mix(col, hazeC, (1.0 - pow(1.0 - uHazeLayers.z, L)) * (1.0 - 0.6 * uNight));
    }
    col = mix(col, skyC, fog);
    if (uHeightFog.w > 0.0) {
      float b = 1.0 / uHeightFog.y;
      float base = exp(min(-(cameraPosition.y - uHeightFog.x) * b, 30.0));
      float x = max(rd.y * d * b, -30.0);
      float k = abs(x) > 1e-3 ? (1.0 - exp(-x)) / x : 1.0;
      col = mix(col, mix(hazeC, uHeightFogTone.rgb, uHeightFogTone.a * (1.0 - 0.7 * uNight)), (1.0 - exp(-uHeightFog.z * d * base * k)) * uHeightFog.w);
    }
    outColor = vec4(col, uWash.x * (uWash.z > 0.0 ? smoothstep(uWash.z, uWash.z * 2.0, vDepth) : 1.0));
  }
`;

export class Veils {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.matrixWorldAutoUpdate = false;
    this.uniforms = { tNormal: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } };
    this.list = [];
  }
  /**
   * The wash over `mesh` (a G-buffer mesh made with makeMaterial({ veil })): its colour, glow 0..1, alpha a layer, `near`
   * (m: it fades out within twice that of the eye, so riding inside it doesn't wash the view) and `side` (both by default).
   */
  add(mesh, { color, glow = 0, alpha = glow > 0 ? VEIL.glowAlpha : VEIL.alpha, near = 0, side = THREE.DoubleSide } = {}) {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader, fragmentShader,
      uniforms: { ...this.uniforms, uColor: { value: new THREE.Color(color) }, uWash: { value: new THREE.Vector3(alpha, glow, near) } },
      transparent: true, depthTest: false, depthWrite: false, side,
    });
    const wash = new THREE.Mesh(mesh.geometry, mat);
    mesh.updateMatrixWorld(true);
    wash.matrixAutoUpdate = false; wash.matrix.copy(mesh.matrixWorld); wash.matrixWorld.copy(mesh.matrixWorld);
    wash.userData.of = mesh;
    this.scene.add(wash);
    this.list.push(wash);
    return wash;
  }
  /** The G-buffer's normal + depth target and the ink pass's uniforms (the light, the shade, the haze: the same objects). */
  bind({ tNormal, uniforms }) {
    this.uniforms.tNormal.value = tNormal;
    for (const k of SHARED) if (uniforms[k]) for (const w of this.list) w.material.uniforms[k] = uniforms[k];
    for (const w of this.list) { w.material.uniforms.tNormal = this.uniforms.tNormal; w.material.uniforms.uRes = this.uniforms.uRes; }
    this.bound = true;
    return this;
  }
  /** Lay the washes over `target` (the composite), each only while its mesh is shown. */
  render(renderer, camera, target) {
    if (!this.bound || !this.list.length) return;
    let any = false;
    for (const w of this.list) { w.visible = shown(w.userData.of); any ||= w.visible; }
    if (!any) return;
    this.uniforms.uRes.value.set(target?.width ?? 1, target?.height ?? 1);
    renderer.setRenderTarget(target);
    renderer.render(this.scene, camera);
  }
}

function shown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return !!o.parent;
}
