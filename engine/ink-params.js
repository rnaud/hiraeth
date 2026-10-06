// An ink spec (engine/ink-spec.js) as the engines' ink surface parameters: the same names in the
// Godot shader (godot/shaders/ink.gdshaderinc) and the Unity bridge's materials. Colours are
// [r, g, b] display values; numbers stay numbers.
import { BIOMES } from '../src/biome.js';

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export function inkParams(spec) {
  const u = spec.u ?? {};
  const num = (k, d = 0) => (typeof u[k] === 'number' ? u[k] : d);
  const p = {
    color: u.uColor ?? [1, 1, 1],
    color2: u.uColor2 ?? u.uColor ?? [1, 1, 1],
    color3: u.uColor3 ?? u.uColor ?? [1, 1, 1],
    mode: num('uMode'),
    strata_size: num('uStrataSize', 4),
    flat_shade: num('uFlat'),
    glow: num('uGlow'),
    sand_ink: num('uSandInk'),
    use_vertex_color: spec.vertexColors ? 1 : 0,
    hero: num('uHero'),
    grid: num('uGrid'),
  };
  // the surface's own shade and strokes (materials.js shadeOf: uShade = [lift, hue, hatch, strata strokes])
  const shade = u.uShade;
  if (Array.isArray(shade)) {
    p.shade_lift = shade[0] ?? 0;
    p.shade_hue = shade[1] ?? -1;
    p.hatch_k = shade[2] ?? 1;
  }
  // the desert's ground by region (biome.js BIOMES: golden dunes, rose canyons, salt flats), three tones each
  if (num('uBiomes') > 0.5) {
    p.biomes = 1;
    for (const [key, name] of [['dunes', 'd'], ['rose', 'r'], ['salt', 's']]) BIOMES[key].ground.forEach((hex, i) => { p[`biome_${name}${i}`] = rgb(hex); });
  }
  // metal (materials.js METALS: uMetal = kind, brushed, reflectivity, highlight)
  if (spec.defines?.METAL && Array.isArray(u.uMetal)) p.metal = u.uMetal;
  // people: the outfit's zones by the rest pose, the skin, gloves
  if (Array.isArray(u.uOutfit)) p.outfit = u.uOutfit;
  if (Array.isArray(u.uSkin)) p.skin = u.uSkin;
  if (Array.isArray(u.uGlove)) p.glove = u.uGlove;
  return p;
}

/**
 * The frame's look (engine/game.js lookParams: post.js's and the shared uniforms) as the engines'
 * global shader parameters: colours as display values (the shaders take them to linear). Godot
 * declares them in godot/project.godot [shader_globals] (shaderGlobalsIni writes that section).
 * name: [type, the uniform it comes from, its default]
 */
export const GLOBALS = {
  g_shadow_tint: ['vec3', 'uShadowTint', [0.62, 0.64, 0.78]], g_light_tint: ['vec3', 'uLightTint', [1, 1, 1]], g_ink: ['vec3', 'uInk', [0.17, 0.13, 0.12]],
  g_sky_top: ['vec3', 'uSkyTop', [0.45, 0.66, 0.82]], g_sky_horizon: ['vec3', 'uSkyHorizon', [0.93, 0.86, 0.72]], g_haze: ['vec4', 'uHaze', [1, 1, 1, 0]],
  g_env_ground: ['vec3', 'uEnvGround', [0.86, 0.72, 0.52]], g_sun_dir: ['vec3', 'uSunDir', [0.5, 0.6, 0.3]], g_sun_disc: ['vec3', 'uSunDisc', [0.5, 0.6, 0.3]],
  g_toon: ['float', 'uToon', 0.5], g_hatch: ['float', 'uHatch', 1], g_hatch_spacing: ['float', 'uHatchSpacing', 5.5],
  g_halftone: ['float', 'uHalftone', 0], g_bounce: ['float', 'uBounce', 0], g_shade_keep: ['float', 'uShadeKeep', 0], g_night: ['float', 'uNight', 0],
  g_fog_density: ['float', 'uFogDensity', 0.0011], g_fog_start: ['float', 'uFogStart', 0], g_fog_mul: ['float', 'uFogMul', 1], g_aerial: ['float', 'uAerial', 0],
  g_line_width: ['float', 'uLineWidth', 1], g_line_vary: ['float', 'uLineVary', 1], g_depth_thresh: ['float', 'uDepthThresh', 0.07], g_normal_thresh: ['float', 'uNormalThresh', 0.22],
  g_albedo_edges: ['float', 'uAlbedoEdges', 1], g_shadow_edges: ['float', 'uShadowEdges', 1], g_wobble: ['float', 'uWobble', 1],
  g_sky_flat: ['float', 'uSkyFlat', 0], g_sky_bands: ['float', 'uSkyBands', 0], g_haze_bands: ['float', 'uHazeBands', 0], g_flatten: ['float', 'uFlatten', 0],
};

export function lookGlobals(look) {
  const out = {};
  for (const [name, [type, key, def]] of Object.entries(GLOBALS)) {
    let v = look[key] ?? def;
    if (type === 'float') v = typeof v === 'number' ? v : def;
    else if (!Array.isArray(v)) v = def;
    else if (type === 'vec3') v = v.slice(0, 3);
    out[name] = v;
  }
  return out;
}

/** GLOBALS as project.godot's [shader_globals] section (tests/engine-bridge.test.js checks the project has it). */
export function shaderGlobalsIni() {
  const val = (type, d) => (type === 'float' ? String(d) : `${type === 'vec3' ? 'Vector3' : 'Vector4'}(${d.join(', ')})`);
  // (and the bone atlas the skinned meshes read: engine/godot/backend.js bones)
  const sampler = 'g_bones={\n"type": "sampler2D",\n"value": ""\n}';
  return ['[shader_globals]', '', sampler, ...Object.entries(GLOBALS).map(([n, [type, , d]]) => `${n}={\n"type": "${type}",\n"value": ${val(type, d)}\n}`)].join('\n') + '\n';
}
