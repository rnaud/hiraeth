import * as THREE from 'three';

// Day / night cycle. Like Sable, the palette (sky, fog, shadow and light tints)
// carries the mood of each time of day, and at night the moon takes over as
// the shadow-casting light so the player stays readable on the ground.

const KEYS = [
  // hour, sky top, sky horizon, shadow tint, light tint, sun/moon disc
  [0.0, '#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
  [4.5, '#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
  [5.6, '#4c5f96', '#d39a96', '#6a5f9e', '#c7b4c8', '#fff0d6'],
  [6.8, '#9fb7d6', '#f6c9a8', '#9a8cc4', '#ffe4c8', '#fff0d6'],
  [9.0, '#8ccfd2', '#f7ecd2', '#a59bd0', '#ffffff', '#fff6dc'],
  [16.0, '#8ccfd2', '#f7ecd2', '#a59bd0', '#ffffff', '#fff6dc'],
  [18.2, '#7f9fcc', '#f4b48a', '#8d7bb8', '#ffd2a8', '#ffe2b8'],
  [19.4, '#3d4f86', '#c98a8e', '#5a5390', '#a9a3cf', '#f2f0e6'],
  [20.6, '#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
  [24.0, '#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
];
// Built lazily: main.js disables colour management after modules are evaluated.
const cache = new Map();
const toColors = (keys) => keys.map(([h, ...c]) => [h, ...c.map((x) => new THREE.Color(x))]);

/**
 * A level's colour script: day / dusk / night palettes, each
 * [skyTop, skyHorizon, shadowTint, lightTint, sunColour], expanded into the
 * same keyframes as the default cycle (dawn mirrors dusk).
 */
export function colourScript({ day, dusk, night }) {
  const mixHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const twilight = dusk.map((c, i) => mixHex(c, night[i], 0.55));
  return [
    [0.0, ...night], [4.5, ...night], [5.6, ...twilight], [6.8, ...dusk],
    [9.0, ...day], [16.0, ...day], [18.2, ...dusk], [19.4, ...twilight], [20.6, ...night], [24.0, ...night],
  ];
}

const SUN_MAX_EL = 62;
const MOON_MAX_EL = 48;
const AZ_OFFSET = 30; // degrees; chosen so the default morning light is side-on

function dirFrom(elDeg, azDeg, out) {
  const el = THREE.MathUtils.degToRad(elDeg), az = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

const SWITCH_EL = 3;  // sun elevation at which the moon takes over the lighting
const FADE_EL = 5;    // shadows fade out / in over this many degrees around the switch

/**
 * Applies the time of day to the shared light direction and post uniforms.
 * @param {number} hour 0..24
 * @param {{ tint: number[], fog: number }} [atmo] region atmosphere (biome.js)
 */
export function applyTimeOfDay(hour, lightDir, U, atmo, script = KEYS) {
  hour = ((hour % 24) + 24) % 24;

  // Sun: up from 6 to 18. Moon: up from 18 to 6 (opposite side of the sky).
  const sunPhase = (hour - 6) / 12;
  const sunEl = Math.sin(sunPhase * Math.PI) * SUN_MAX_EL;
  const sunAz = AZ_OFFSET + sunPhase * 180;
  const moonPhase = (((hour - 18) + 24) % 24) / 12;
  const moonEl = Math.sin(moonPhase * Math.PI) * MOON_MAX_EL;
  const moonAz = AZ_OFFSET + moonPhase * 180;
  dirFrom(sunEl, sunAz, U.uSunDisc.value);
  dirFrom(moonEl, moonAz, U.uMoonDisc.value);

  // The light source switches from sun to moon at SWITCH_EL. Around that
  // moment the shadow tone converges to the light tone (uFlatten -> 1), so
  // shadows fade out and back in instead of jumping across the ground.
  if (sunEl > SWITCH_EL) dirFrom(sunEl, sunAz, lightDir);
  else dirFrom(Math.max(moonEl, 4), moonAz, lightDir);
  U.uFlatten.value = 1 - THREE.MathUtils.smoothstep(Math.abs(sunEl - SWITCH_EL), 0, FADE_EL);
  U.uNight.value = THREE.MathUtils.smoothstep(-sunEl, -2, 8);
  U.uMoonVis.value = THREE.MathUtils.smoothstep(moonEl, -1, 4) * THREE.MathUtils.smoothstep(-sunEl, -6, 2);

  if (!cache.has(script)) cache.set(script, toColors(script));
  const K = cache.get(script);
  let i = 0;
  while (i < K.length - 2 && K[i + 1][0] <= hour) i++;
  const a = K[i], b = K[i + 1];
  const t = THREE.MathUtils.smoothstep(hour, a[0], b[0]);
  U.uSkyTop.value.copy(a[1]).lerp(b[1], t);
  U.uSkyHorizon.value.copy(a[2]).lerp(b[2], t);
  if (atmo) {
    U.uSkyHorizon.value.r *= atmo.tint[0];
    U.uSkyHorizon.value.g *= atmo.tint[1];
    U.uSkyHorizon.value.b *= atmo.tint[2];
    U.uFogMul.value = atmo.fog;
  }
  U.uShadowTint.value.copy(a[3]).lerp(b[3], t);
  U.uLightTint.value.copy(a[4]).lerp(b[4], t);
  U.uSunColor.value.copy(a[5]).lerp(b[5], t);
  U.uSunDir.value.copy(lightDir);
}
