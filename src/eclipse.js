import * as THREE from 'three';
import { sharedUniforms } from './materials.js';

// ---------------------------------------------------------------------------
// An eclipse world's sky by the hour (the City During the Eclipse, src/levels/eclipse.js; the shader's
// side is post.js drawEclipse, docs/systems/rendering.md "The eclipse"). A level that says
// `sky.eclipse` has its sun on a path of its own (lower, toward its city), and round the middle of
// the day the moon slides over it: the light dims through the partial phase, and in totality the
// corona, the rose band round the horizon and the stars come out, the light leaning up off the
// black sun (lit from the whole sky's glow more than from the corona). The colours by the hour are
// the level's own colour script (eclipseScript); this sets the rest after applyTimeOfDay each time
// the sky is updated (main.js updateSky).
//
//   cfg  { mid: the hour of mid-eclipse, total: half the totality (h), partial: half the whole
//          eclipse (h), el: the sun's height at noon (deg), az: its azimuth at noon (deg, from +z
//          toward +x), size: the discs' radius (deg), reach: the corona's reach (× the radius),
//          style: 0 rays … 1 dots, corona: its colour, glow: the horizon band's colour, glowH: its
//          height (as rd.y), stars: how many show in totality (0 … 1), lift: how far the light leans
//          up toward the zenith in totality (0 … 1), night: how night-like totality is (uNight: the
//          windows lit, the glows' halos wider) }
// ---------------------------------------------------------------------------

export const ECLIPSE_DEFAULTS = { mid: 12, total: 0.75, partial: 2, el: 26, az: 180, size: 4.2, reach: 1.6, style: 0.5, corona: '#ffe6cc', glow: '#d99ccf', glowH: 0.07, stars: 0.75, lift: 0.6, night: 0.5 };

const SUN_MAX_EL = 62;   // (timeofday.js's own)
const DEG = Math.PI / 180;

/** How far the moon covers the sun at an hour (0 … 1, 1 through totality), and how total it is (the corona's share). */
export function eclipsePhase(hour, cfg = ECLIPSE_DEFAULTS) {
  const c = { ...ECLIPSE_DEFAULTS, ...cfg };
  const d = Math.abs((((hour - c.mid) % 24) + 36) % 24 - 12);
  const cover = d <= c.total ? 1 : d >= c.partial ? 0 : 1 - (d - c.total) / (c.partial - c.total);
  const total = THREE.MathUtils.smoothstep(cover, 0.93, 1);
  return { cover, total };
}

/** The sun's direction at an hour on the world's own path: up from 6 to 18, at its highest (el) at noon from az. */
export function eclipseSun(hour, cfg = ECLIPSE_DEFAULTS, out = new THREE.Vector3()) {
  const c = { ...ECLIPSE_DEFAULTS, ...cfg };
  const phase = (hour - 6) / 12, el = Math.sin(phase * Math.PI) * c.el * DEG, az = (c.az + (phase - 0.5) * 180) * DEG;
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
}

const _sun = new THREE.Vector3(), _up = new THREE.Vector3(), _c = new THREE.Color(), _g = new THREE.Color();
/**
 * After applyTimeOfDay: the sun's disc and (while it is up) the light on the world's own path, the eclipse's
 * uniforms for the hour. U: post's uniforms; lightDir: the shared light direction (materials.js uSunDir).
 */
export function applyEclipse(hour, cfg, U, lightDir) {
  const c = { ...ECLIPSE_DEFAULTS, ...cfg };
  hour = ((hour % 24) + 24) % 24;
  const { cover, total } = eclipsePhase(hour, c);
  eclipseSun(hour, c, _sun);
  U.uSunDisc.value.copy(_sun);
  // (timeofday's sun is up when ours is: the same phase, so its moon hand-over and night stand as they are)
  const sunEl = Math.asin(_sun.y) / DEG;
  if (sunEl * (SUN_MAX_EL / c.el) > 3) {
    lightDir.copy(_sun);
    if (total > 0) {
      // in totality the light leans up off the black sun: the sky's glow all round lights the tops
      _up.set(_sun.x * 0.35, 1, _sun.z * 0.35).normalize();
      lightDir.lerp(_up, c.lift * total).normalize();
    }
    U.uSunDir.value.copy(lightDir);
  }
  _c.set(c.corona); _g.set(c.glow);
  U.uEclipse.value = [cover, c.size * DEG, c.reach, c.style];
  U.uCorona.value = [_c.r, _c.g, _c.b, c.stars * total];
  U.uEclipseGlow.value = [_g.r, _g.g, _g.b, c.glowH];
  U.uEclipseDir.value = [0, 0, 0];   // (at the sun itself)
  if (U.uNight) U.uNight.value = Math.max(U.uNight.value, c.night * total);
  // the lamps' warm pools: as the moon's shadow comes on, and from dusk to dawn (in full day they are only lamps)
  sharedUniforms.uLampsOn.value = Math.max(THREE.MathUtils.smoothstep(cover, 0.55, 1), 1 - THREE.MathUtils.smoothstep(sunEl, -1, 7));
}

/**
 * The colour script of an eclipse world (timeofday.js keys: hour, sky top, horizon, shadow, light, sun), from its
 * palettes: night, dusk (dawn mirrors it), day, and the eclipse's: dim (the partial phase, deepening) and total.
 */
export function eclipseScript({ day, dusk, night, dim, total }, cfg = ECLIPSE_DEFAULTS) {
  const c = { ...ECLIPSE_DEFAULTS, ...cfg };
  const mixHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
  const twilight = dusk.map((x, i) => mixHex(x, night[i], 0.55));
  const m = c.mid, t0 = c.total, p = c.partial;
  return [
    [0.0, ...night], [4.5, ...night], [5.6, ...twilight], [6.8, ...dusk], [9.0, ...day],
    [m - p, ...day], [m - (p + t0) / 2, ...dim], [m - t0, ...total], [m + t0, ...total], [m + (p + t0) / 2, ...dim], [m + p, ...day],
    [16.0, ...day], [18.2, ...dusk], [19.4, ...twilight], [20.6, ...night], [24.0, ...night],
  ];
}
