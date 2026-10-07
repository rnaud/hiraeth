import { loadAllWorlds } from './reference-worlds.js';

// ---------------------------------------------------------------------------
// The references' views (src/levels/references.js): one per panel of a reference
// sheet, rebuilt with the game's own materials. Each world's views live in its
// own module, reference-<world>.js, listed in the registry (reference-worlds.js);
// the level loads only the world it opens on. This module is every world's views
// at once (the tests, the trailer's scenes, tools): it waits for all of them.
//
// A view is authored in its own frame, its camera looking down -z (yaw turns it
// to the right), ground near y = 0.
//
//   sheet, panel, where, crop   the panel on its sheet (crop: x, y, w, h in the
//                               sheet's pixels, inside its inked border)
//   camera   { eye, yaw, fov (vertical, deg), horizon (where eye level crosses
//            the frame: 0 top, 1 bottom) }
//   sun      { side (deg right of the line of sight; negative: left; 180:
//            behind), el (deg) }: the level picks the hour and turns the view
//   sky      [sky top, sky horizon, shadow tint, light tint, sun] (the colour
//            script's five colours, the same at every hour)
//   preset, look   the ink preset and the view's own touches on it (post.js
//            PRESETS uniforms); fog: the haze multiplier
//   ground   { height(x, z), material (makeMaterial, terrain mode), rings }
//   people   [{ at: [x, z], facing (rad), palette, head }] (local; content.js)
//   build(kit, view)   what stands on the ground (lab-kit.js RoomKit)
//
// Colours were read off the sheet (lit and shaded patches of each surface); the
// shadow tints are the shaded colour over the lit one of the panel's main surface.
// ---------------------------------------------------------------------------

const WORLDS = await loadAllWorlds();
/** The reference sheets of every world: the image (bundled by Vite, a file URL under node), its size, a name. */
export const REFERENCE_SHEETS = Object.assign({}, ...WORLDS.map((w) => w.sheets));
/** Every world's views, numbered across the worlds as the level numbers them (view n is REFERENCE_VIEWS[n - 1]). */
export const REFERENCE_VIEWS = WORLDS.flatMap((w) => w.views);
