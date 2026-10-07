import * as THREE from 'three';
import { colourScript } from '../timeofday.js';
import { makeMaterial, MODE_TERRAIN, sharedUniforms } from '../materials.js';
import { RoomKit } from './lab-kit.js';
import { REFERENCE_WORLDS, loadWorld, loadedWorld, loadAllWorlds, startOf, findView, firstView, totalViews, locateView, viewSearch } from './reference-worlds.js';
import { stepped } from '../load-steps.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { DESERT_LOOK } from '../desert-sites.js';
import { SKY_STONES_DAY, SKY_STONES_LOOK, SKY_STONES_FLAT } from './arzach2.js';
import { BURIED_DAY, BURIED_SPOTS } from './buried.js';
import { SPHERES_DAY, SPHERES_LOOK } from './spheres.js';
import { DEEP_WOOD_DAY, DEEP_WOOD_LOOK } from './perdide2.js';
import { MARKET_DAY, MARKET_LOOK } from './bazaar.js';
import { MANGROVE_DAY, MANGROVE_LOOK } from './mangrove-kit.js';
import { WATERFALL_DAY, WATERFALL_WORLD_LOOK } from './waterfall-kit.js';
import { SALT_DAY, SALT_LOOK } from './salt-harbour-kit.js';
import { ANTENNAS_DAY, ANTENNAS_LOOK } from './antennas-kit.js';
import { ECLIPSE_TOTAL, ECLIPSE_LOOK, eclipseUniforms } from './eclipse-kit.js';
import { RING_DAY, RING_LOOK } from './fallen-ring-kit.js';
import { MF_DAY, MF_LOOK } from './moon-foundry-kit.js';
import { ReferencePicker } from './reference-picker.js';
import { sheetSrc } from './reference-sheets.js';

// ---------------------------------------------------------------------------
// The references: a developer's level (?level=references, or the worlds list, L)
// that rebuilds the scenes of the reference pages (references/) with the game's
// own materials, sky, light and ink, each seen from a fixed camera framed like its
// panel, so the shaders can be checked against the look they are after.
//
//   a world     the views of one world's sheets (reference-worlds.js, the registry:
//               reference-<world>.js holds them). Only the world you are in is
//               loaded and built; going to another loads the page again at it, so
//               the one you leave goes with the page
//   a view      one panel (reference-views.js describes its fields): its ground, what
//               stands on it, its sky and shadow colours, its sun (beside / above the
//               camera) and its camera (eye, heading, field of view, where the
//               horizon sits in the frame)
//   [ and ]     the previous / next view (L3 / R3 on a pad), on into the next world at
//               a world's end; each switch frames the camera on the panel again. Walk
//               or look and the camera is yours (the traveller appears where the
//               view's camera stood)
//   { and }     the previous / next world (shift + [ ]; in the quick menu, Tab or
//               X / □: Page Up / Down, LB / RB, or a world's name)
//   \           the comparison (View on a pad): off → the panel in a corner →
//               the panel over the frame, half seen through → the panel over the
//               left half of the frame → off
//   the address ?level=references&world=<id>&view=<n> (the n-th view of that world),
//               &view=<n> alone (the n-th across the worlds, as the label numbers
//               them) or &view=<a view's id>
//
// The views lie far apart on a grid (VIEW_SPACING), each in the cell of its number,
// and only the one you are in is drawn, as with the Lab's rooms. Each is authored in
// its own frame, looking down -z from its camera; its group is turned about the
// vertical so the sun of the view's hour comes from the side the panel is lit from
// (sunTurn). Nothing here touches the renderer: the views are ordinary scenery, sky
// scripts, hours and ink presets.
// ---------------------------------------------------------------------------

/** The views' centres lie on a square grid this far apart (m): only the one you are in is drawn. */
export const VIEW_SPACING = 3300;
/**
 * Cells per side (even: no view at the origin, where the ship's site is). 14 × 14 cells: view n stands in
 * cell n - 1, and past the 196th the numbers go round the grid again (only one world is built at a time,
 * and no world has that many views: tests/reference-worlds.test.js), so the grid never grows and every
 * view keeps the place, and so the look, it has always had.
 */
const GRID = 14;
const CELLS = GRID * GRID;
/** How far out the grid reaches (m): its farthest centre on either axis. */
export const VIEW_EXTENT = ((GRID - 1) / 2) * VIEW_SPACING;
/** Past this far from a view's centre (m) you are put back at its camera. */
const VIEW_REACH = 1100;
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const PASS = { in: 0.18, out: 0.45 };   // s: the fade between views
const DEG = Math.PI / 180;

/** A view's centre in the world (i: its number across the worlds, 0-based). */
export const viewCentre = (i) => {
  const c = ((i % CELLS) + CELLS) % CELLS;
  return new THREE.Vector3(((c % GRID) - (GRID - 1) / 2) * VIEW_SPACING, 0, (Math.floor(c / GRID) - (GRID - 1) / 2) * VIEW_SPACING);
};

// the sun of timeofday.js: up from 6 to 18, at most 62° high, from azimuth 30° (6:00) round to 210° (18:00)
const SUN_MAX_EL = 62, AZ_OFFSET = 30;
/** The morning hour at which the sun stands `el` degrees high, and its azimuth then (deg, from +z towards +x). */
export function sunHour(el) {
  const phase = Math.asin(Math.min(el, SUN_MAX_EL - 0.01) / SUN_MAX_EL) / Math.PI;
  return { hour: 6 + 12 * phase, az: AZ_OFFSET + phase * 180 };
}
/**
 * How far a view's group turns (rad) so that, from its camera (heading `yaw`, deg, right of -z),
 * the sun of its hour stands `side` degrees to the right of the line of sight (negative: left;
 * 0 straight ahead, 180 behind).
 */
export function sunTurn(sun, yaw = 0) {
  const { az } = sunHour(sun.el);
  return (az + sun.side - 180 + yaw) * DEG;
}

/**
 * The camera of a view, in its own frame: eye, the point looked at and the vertical field of view.
 * cam: { eye: [x, y, z], yaw (deg, right of -z), horizon (0 top .. 1 bottom: where eye level
 * crosses the frame), fov (vertical, deg, for the panel's own proportions) }
 */
export function viewCamera(cam) {
  // horizon below the centre: looking up; or a pitch given outright (deg: steep views up or down a shaft);
  // or a shifted lens (cam.shift: looking level, the frame a window of a taller one: lensShift)
  const pitch = cam.shift ? 0 : cam.pitch !== undefined ? cam.pitch * DEG : Math.atan((cam.horizon - 0.5) * 2 * Math.tan((cam.fov * DEG) / 2));
  const yaw = (cam.yaw ?? 0) * DEG;
  const eye = new THREE.Vector3(...cam.eye);
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  return { eye, target: eye.clone().addScaledVector(dir, 50), pitch, fov: cam.fov, roll: (cam.roll ?? 0) * DEG };
}

/**
 * The frame on screen that stands for the panel (px): the largest box of its proportions, centred;
 * and the vertical field of view that puts the panel's view into that box.
 */
export function frameBox(W, H, aspect, fov) {
  if (W / H >= aspect) {
    const w = H * aspect;
    return { x: (W - w) / 2, y: 0, w, h: H, fov };
  }
  const h = W / aspect;
  return { x: 0, y: (H - h) / 2, w: W, h, fov: 2 * Math.atan(Math.tan((fov * DEG) / 2) * (H / h)) / DEG };
}

/**
 * A panel drawn with a shifted lens (camera.shift: its verticals upright though its horizon is far off the middle, as
 * the Moon Foundry's monumental sheets are): the camera looks level and the screen is a window of a taller frame
 * centred on eye level (setViewOffset), so eye level crosses the panel's box at its `horizon`. W × H the screen, box
 * its panel's frame (frameBox). Sets the camera's fov (the taller frame's) and offset; without shift, clears the offset.
 */
export function lensShift(camera, cam, W, H, box) {
  let fov = box.fov;
  if (cam.shift) {
    const hs = (box.y + cam.horizon * box.h) / H, k = Math.max(hs, 1 - hs), full = 2 * k * H, y = hs >= 0.5 ? 0 : full - H;
    fov = (2 * Math.atan(2 * k * Math.tan((box.fov * DEG) / 2))) / DEG;
    const v = camera.view;
    if (!v?.enabled || Math.abs(v.fullHeight - full) > 1e-3 || Math.abs(v.offsetY - y) > 1e-3 || v.fullWidth !== W || v.height !== H) { camera.fov = fov; camera.setViewOffset(W, full, 0, y, W, H); }
  } else if (camera.view?.enabled) camera.clearViewOffset();
  if (Math.abs(camera.fov - fov) > 1e-6) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/** A ground of rings round a point (local): fine under the camera, coarser out to the horizon. */
export function ringGround(height, { at = [0, 0], r0 = 0.6, r1 = 2200, rings = 170, seg = 288 } = {}) {
  const [cx, cz] = at;
  const n = rings + 1, pos = new Float32Array((n * seg + 1) * 3);
  pos.set([cx, height(cx, cz), cz], 0);
  for (let i = 0; i < n; i++) {
    const r = r0 * Math.pow(r1 / r0, i / rings);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, k = 1 + i * seg + j;
      pos[k * 3] = x; pos[k * 3 + 1] = height(x, z); pos[k * 3 + 2] = z;
    }
  }
  const idx = [];
  for (let j = 0; j < seg; j++) idx.push(0, 1 + j, 1 + ((j + 1) % seg));
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = 1 + i * seg + j, b = 1 + i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** The panel's crop of its sheet (sheets: the world's, by key) as CSS: a background on a box w × h px. */
export function cropStyle(view, w, h, sheets) {
  const sheet = sheets[view.sheet];
  const [x, y, cw, ch] = view.crop;
  const sx = w / cw, sy = h / ch;
  return {
    backgroundImage: `url("${sheetSrc(sheet.url)}")`,
    backgroundSize: `${sheet.size[0] * sx}px ${sheet.size[1] * sy}px`,
    backgroundPosition: `${-x * sx}px ${-y * sy}px`,
  };
}

/** A point of a view's own frame (x, z) in the world (i: the view's number, 0-based). */
function viewToWorld(i, def, x, z) {
  const c = viewCentre(i), a = sunTurn(def.sun, def.camera.yaw), cs = Math.cos(a), sn = Math.sin(a);
  return [c.x + x * cs + z * sn, c.z - x * sn + z * cs, a];
}
/** A world's panels' people (content.js), standing where their panel has them: small figures in the distance. */
export function worldPeople(world) {
  return world.views.flatMap((def, j) => (def.people ?? []).map((p) => {
    const [x, z, a] = viewToWorld(world.first + j, def, p.at[0], p.at[1]);
    return {
      at: [x, z], y: def.ground.height(p.at[0], p.at[1]), radius: 0, shy: false, facing: (p.facing ?? 0) + a, view: def.id,
      palette: p.palette, head: p.head, kind: p.kind ?? 'm',
      lines: ['~neutral~ I stand where the drawing put me.', '~curious~ From here, do I look the way I should?'],
    };
  }));
}
let peopleBuilt = [];
/** The people of the world built last (content.js: the level's npcs, read once the level is built). */
export const referencePeople = () => peopleBuilt;

const COMPARE = ['off', 'corner', 'overlay', 'half'];
const COMPARE_NAMES = { off: 'off', corner: 'the panel in a corner', overlay: 'the panel over the frame', half: 'the panel on the left half' };

/** The desert's own day palette (src/levels/desert.js): ?look=desert draws every view with it and the plain preset. */
export const DESERT_SKY = ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'];
/**
 * ?look=<world>: every view drawn in that world's own day palette and its touches on the print preset
 * (to see what the shaders and the world's look do unaided). Vael II prints its rock's shade flat per
 * material (SKY_STONES_FLAT); the views' materials don't say, so the look carries it.
 */
export const WORLD_LOOKS = {
  desert: { sky: DESERT_SKY, look: DESERT_LOOK },
  vael2: { sky: SKY_STONES_DAY, look: { ...SKY_STONES_LOOK, uShadowFlat: SKY_STONES_FLAT } },
  buried: { sky: BURIED_DAY, look: { ...BURIED_SPOTS } },
  spheres: { sky: SPHERES_DAY, look: { ...SPHERES_LOOK } },
  lorn2: { sky: DEEP_WOOD_DAY, look: { ...DEEP_WOOD_LOOK } },
  bazaar: { sky: MARKET_DAY, look: { ...MARKET_LOOK } },
  mangrove: { sky: MANGROVE_DAY, look: { ...MANGROVE_LOOK } },
  waterfall: { sky: WATERFALL_DAY, look: { ...WATERFALL_WORLD_LOOK } },
  saltharbour: { sky: SALT_DAY, look: { ...SALT_LOOK } },
  antennas: { sky: ANTENNAS_DAY, look: { ...ANTENNAS_LOOK } },
  eclipse: { sky: ECLIPSE_TOTAL, look: { ...ECLIPSE_LOOK, ...eclipseUniforms() } },
  fallenring: { sky: RING_DAY, look: { ...RING_LOOK } },
  moonfoundry: { sky: MF_DAY, look: { ...MF_LOOK } },
};

const pageParams = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());
const pageSearch = () => (typeof location !== 'undefined' ? location.search : '');
const pageGo = (search) => { if (typeof location !== 'undefined') location.assign(search); };

/**
 * One world's views, built (built in steps, src/load-steps.js: the game's load gives the main thread back
 * between them). Its module is imported first (a yielded promise: the async runner waits for it; the sync
 * one, createReferences, needs it loaded already: loadWorld).
 *   params     the address's query (?world=, ?view=, ?look=): where it opens
 *   go         (search) => going to another world's view: the page loads again at that address
 *   search     the address's query as text (what `go` keeps of it)
 */
export function* buildReferences(scene, { params = pageParams(), go = pageGo, search = pageSearch() } = {}) {
  // ?look=<world> (WORLD_LOOKS): the views in that world's own colours and ink, not the panels'
  const asWorld = WORLD_LOOKS[params.get('look')] ?? null;
  let start = startOf(params);
  if (start.id) start = (yield findView(start.id)) ?? { k: 0, local: 0 };
  const world = loadedWorld(start.k) ?? (yield loadWorld(start.k));
  const lights = [], noShadow = [], movers = [];
  const views = [];
  for (const [j, def] of world.views.entries()) {
    yield;
    const i = world.first + j;   // (the view's number across the worlds: its cell and its seeds, as they have always been)
    const centre = viewCentre(i);
    const group = new THREE.Group();
    group.name = `Reference: ${def.title}`;
    group.position.copy(centre);
    group.rotation.y = sunTurn(def.sun, def.camera.yaw);
    scene.add(group);
    const ground = ringGround(def.ground.height, { at: [def.camera.eye[0], def.camera.eye[2]], ...def.ground.rings });
    const groundMesh = new THREE.Mesh(ground, makeMaterial({ mode: MODE_TERRAIN, ...def.ground.material }));
    groundMesh.userData.noCollide = true;   // (the height is looked up exactly: level.ground)
    group.add(groundMesh);
    const H = (x, z) => def.ground.height(x, z);
    const kit = new RoomKit({ group, ground: { heightAt: H, baseAt: (x, z, r) => { let m = H(x, z); for (let k = 0; k < 8; k++) m = Math.min(m, H(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r)); return m; } }, centre, seed: 3775 + i * 17 });
    // sand banks against what stands on a sandy ground (sand-drifts.js: the kit's solids feed it)
    const sandy = def.ground.material.ripples || def.ground.material.sandInk;
    const sand = sandy ? SandDrifts.open({ heightAt: H, seed: 3775 + i }) : null;
    def.build(kit, def);
    kit.finish();
    const drifts = sand?.close().build(driftMaterial(makeMaterial, { mode: MODE_TERRAIN, ...def.ground.material }));
    if (drifts) group.add(drifts);
    noShadow.push(...kit.noShadow);
    // the view's local lights (glowing eggs, pools, lamps): kit.light puts them at the centre plus the
    // view's own frame, which the group turns (sunTurn)
    { const a = group.rotation.y, c = Math.cos(a), sn = Math.sin(a);
      for (const l of kit.lights) { const x = l.x - centre.x, z = l.z - centre.z; lights.push(new THREE.Vector4(centre.x + x * c + z * sn, l.y, centre.z - x * sn + z * c, l.w)); } }
    movers.push(...kit.movers.map((fn) => (t) => { if (group.visible) fn(t); }));
    group.updateMatrixWorld(true);
    const cam = viewCamera(def.camera);
    const toWorld = (v) => v.clone().applyMatrix4(group.matrixWorld);
    const { hour } = sunHour(def.sun.el);
    const sky = asWorld ? asWorld.sky : def.sky;
    const script = colourScript({ day: sky, dusk: sky, night: sky });   // (the same colours whatever the hour)
    const eye = toWorld(cam.eye), target = toWorld(cam.target);
    // where the traveller stands while the camera is held: on the ground under the eye, facing the view
    const stand = new THREE.Vector3(def.camera.eye[0], H(def.camera.eye[0], def.camera.eye[2]) + 0.05, def.camera.eye[2]);
    const fwd = target.clone().sub(eye).setY(0).normalize();
    views.push({
      def, i, local: j, centre, group, H, hour, cam, eye, target,
      stand: toWorld(stand), heading: Math.atan2(fwd.x, fwd.z),
      toLocal: (x, z) => {   // world x, z → the view's own frame
        const dx = x - centre.x, dz = z - centre.z, a = group.rotation.y, c = Math.cos(a), s = Math.sin(a);
        return [dx * c - dz * s, dx * s + dz * c];
      },
      zone: { name: `References · ${def.title}`, preset: def.preset ?? 'Moebius print', look: asWorld ? asWorld.look : def.look ?? {}, planets: [], hour },
      atmo: { tint: [1, 1, 1], fog: def.fog ?? 0.35, name: `References · ${def.title}`, script },
    });
  }
  peopleBuilt = worldPeople(world);
  const viewAt = (x, z) => {
    for (const v of views) if ((x - v.centre.x) ** 2 + (z - v.centre.z) ** 2 < 1500 * 1500) return v;
    return null;
  };
  const ground = {
    heightAt(x, z) {
      const v = viewAt(x, z);
      if (!v) return 0;
      const [lx, lz] = v.toLocal(x, z);
      return v.centre.y + v.H(lx, lz);
    },
    baseAt(x, z, r) {
      let m = this.heightAt(x, z);
      for (let k = 0; k < 8; k++) m = Math.min(m, this.heightAt(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r));
      return m;
    },
  };

  // what is drawn: the view you are in. The others are hidden and their matrices frozen (as the Lab's rooms).
  yield;
  for (const v of views) {
    yield;
    const g = v.group, base = g.updateMatrixWorld;
    g.updateMatrixWorld = function (force) { if (this.visible) base.call(this, force); };
  }
  let shown;
  const show = (view) => {
    if (view === shown) return;
    shown = view;
    for (const v of views) {
      if (v !== view && v.group.visible !== false) v.group.updateMatrixWorld(true);
      v.group.visible = v === view;
    }
  };
  const first = views[start.local] ?? views[0];
  show(first);

  // ---- the held camera, the switch between views and worlds, the comparison
  yield;
  const total = totalViews(), worlds = REFERENCE_WORLDS.length;
  let held = null;       // { view, pos, yaw, pitch, mouse }: the camera is the panel's until you move or look
  let pending = 0;       // a switch asked for ([ ], L3 / R3)
  let pendingTo = null;  // or a view by its number (goTo)
  let passing = null;    // the fade between two views
  let leaving = null;    // { k, local, t }: going to another world's view (a fade, then the page loads there)
  let compare = 0;       // COMPARE[compare]
  let baseFov = null;
  let ui = null;
  const keys = (e) => {
    if (e.repeat || e.target?.closest?.('input, textarea, select')) return;
    if (e.code === 'BracketRight') { if (e.shiftKey) level.jumpWorld(1); else pending = 1; }
    else if (e.code === 'BracketLeft') { if (e.shiftKey) level.jumpWorld(-1); else pending = -1; }
    else if (e.code === 'Backslash') level.compare();
  };
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', keys);

  function buildUi() {
    if (ui || typeof document === 'undefined' || !document.body?.appendChild || !document.createElement) return;
    const css = document.createElement('style');
    css.textContent = `
      #ref-frame { position: fixed; pointer-events: none; z-index: 4; box-shadow: 0 0 0 1px rgba(43,33,31,.55); }
      #ref-frame .ref { position: absolute; background-repeat: no-repeat; }
      #ref-frame.overlay .ref { inset: 0; opacity: .5; }
      #ref-frame.half .ref { inset: 0; clip-path: inset(0 50% 0 0); }
      #ref-frame.half::after { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 2px solid #f7ecd2; }
      #ref-frame.corner .ref { right: 10px; top: 10px; box-shadow: 0 0 0 2px #2b211f, 6px 6px 0 rgba(43,33,31,.35); }
      #ref-frame.off .ref { display: none; }
      #ref-label { position: fixed; left: 14px; bottom: 14px; z-index: 5; pointer-events: none; max-width: 70vw;
        font: 12px/1.45 ui-monospace, Menlo, monospace; color: #2b211f; background: rgba(247,236,210,.88);
        border: 1.5px solid #2b211f; padding: 6px 9px; box-shadow: 4px 4px 0 rgba(43,33,31,.35); }
      #ref-label b { letter-spacing: .04em; }
      #ref-label .pad { display: none; }
      body.controller #ref-label .pad { display: inline; }
      body.controller #ref-label .kb { display: none; }
    `;
    document.head.appendChild(css);
    const frame = document.createElement('div');
    frame.id = 'ref-frame';
    frame.innerHTML = '<div class="ref"></div>';
    const label = document.createElement('div');
    label.id = 'ref-label';
    document.body.append(frame, label);
    ui = { frame, ref: frame.firstElementChild, label, key: '' };
  }
  function updateUi(view, camera) {
    buildUi();
    if (!ui) return;
    const W = window.innerWidth, H = window.innerHeight, def = view.def;
    const box = frameBox(W, H, def.crop[2] / def.crop[3], def.camera.fov);
    const mode = COMPARE[compare];
    const key = `${view.i}|${mode}|${W}|${H}|${!!held}`;
    if (key === ui.key) return;
    ui.key = key;
    Object.assign(ui.frame.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, display: held ? '' : 'none' });
    ui.frame.className = mode;
    const rw = mode === 'corner' ? Math.round(box.w * 0.36) : box.w, rh = mode === 'corner' ? Math.round(rw * def.crop[3] / def.crop[2]) : box.h;
    Object.assign(ui.ref.style, cropStyle(def, rw, rh, world.sheets), mode === 'corner' ? { width: `${rw}px`, height: `${rh}px` } : { width: '', height: '' });
    const sheet = world.sheets[def.sheet];
    ui.label.innerHTML = `<b>REFERENCE ${view.i + 1} / ${total} · ${def.title}</b><br>${world.name}, ${view.local + 1} of ${views.length} · ${sheet.name.split(' / ').pop()}, panel ${def.panel} (${def.where})`
      + `<br><span class="kb">[ ] view · { } world · Tab all views · \\ compare: ${COMPARE_NAMES[mode]}</span><span class="pad">L3 / R3 view · X / □ all views · View compare:${COMPARE_NAMES[mode]}</span>`
      + (held ? '' : '<br><i>walking: [ or ] frames the panel again</i>');
    void camera;
  }

  /** Hold the camera on a view's panel (and hide the traveller, who stands where its camera is). */
  function frame(view, ctx) {
    const { player, rig } = ctx;
    player.teleport(view.stand, Y, Z);
    player.heading = view.heading;
    if (rig) { rig.yaw = view.heading + Math.PI; rig.target?.copy(view.stand); }
    held = { view, pos: view.stand.clone(), yaw: rig?.yaw, pitch: rig?.pitch, mouse: rig?._lastMouse };
    setHidden(player, true);
    show(view);
  }
  function setHidden(player, on) {
    if (player.object) player.object.visible = !on;
    player.hidden = on;
    if (player.cape?.mesh) player.cape.mesh.visible = !on;
  }
  function release(ctx) {
    held = null;
    setHidden(ctx.player, false);
    const cam = ctx.camera;
    if (cam?.view?.enabled) cam.clearViewOffset();   // (a shifted lens let go: lensShift)
    if (cam && baseFov !== null && cam.fov !== baseFov) { cam.fov = baseFov; cam.updateProjectionMatrix(); }
  }
  /** View i (its number across the worlds, 0-based): framed here if it is this world's, else the page goes to its world. */
  function toView(i) {
    const at = locateView(((i % total) + total) % total);
    if (!at) return;
    if (at.k === world.k) pendingTo = at.local;
    else leaving ??= { ...at, t: 0 };
  }

  const level = {
    id: 'references',
    ground,
    envGround: '#e9c27d',
    spawn: first.stand.clone(),
    spawnHeading: first.heading,
    camYaw: first.heading + Math.PI,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    // (the hour of the view you open on: it is framed on the first frame, before any zone change sets it)
    defaults: { hour: first.hour, preset: 'Moebius print', cloudShadows: 0 },
    killY: -Infinity,
    limit: VIEW_EXTENT + 1600,
    shipSite: { x: 0, z: 0, heading: 0 },   // at the origin, far from every view
    lights, noShadow,
    reactions: false,   // (no responsive flowers in the panels: reactive-world.js)
    /** This world's views (each with i, its number across the worlds, and local, its place in the world). */
    views,
    /** The world built: { k, id, name, first, count, views, sheets } (reference-worlds.js). */
    world,
    worlds: REFERENCE_WORLDS,
    viewAt,
    /** The previous (-1) or next (+1) view, framed on its panel ([ ], L3 / R3); past a world's end, the next world's. */
    jump: (d) => { pending = d; },
    /** The previous (-1) or next (+1) world's first view ({ }, the quick menu). */
    jumpWorld: (d) => { const k = (((world.k + d) % worlds) + worlds) % worlds; toView(firstView(k)); },
    /** Frame view i (its number across the worlds, 0-based; ?view=<n> in the address opens on view n, 1-based). */
    goTo: (i) => toView(i),
    /** Where the page goes for another world's view (?level=references&world=<id>&view=<n>). */
    address: (k, local) => viewSearch(search, k, local),
    /** Where the level is going (another world's view: { k, local }), or null. */
    get leaving() { return leaving ? { k: leaving.k, local: leaving.local } : null; },
    /** The next comparison mode (\, View): off, the panel in a corner, over the frame, over its left half. */
    compare: () => { compare = (compare + 1) % COMPARE.length; if (ui) ui.key = ''; return COMPARE[compare]; },
    get comparing() { return COMPARE[compare]; },
    get held() { return held?.view ?? null; },
    /** The quick menu of every view of every world, each with its panel's thumbnail (reference-picker.js: Tab, X / □, the views button). */
    quickMenu: new ReferencePicker({ load: loadAllWorlds, world: world.k, current: () => shown?.i ?? first.i, goTo: (i) => level.goTo(i) }),
    sky: { script: { day: asWorld?.sky ?? first.def.sky, dusk: asWorld?.sky ?? first.def.sky, night: asWorld?.sky ?? first.def.sky } },
    atmo: (x, z) => viewAt(x, z)?.atmo ?? first.atmo,
    zoneAt: (p) => viewAt(p.x, p.z)?.zone ?? first.zone,
    update(dt, t, ctx = {}) {
      for (const m of movers) m(t);
      const { player, camera, rig } = ctx;
      if (!player) return;
      const p = player.pos;
      let here = viewAt(p.x, p.z);
      if (camera && baseFov === null) baseFov = camera.fov;
      // the first frame: the panel of the view the address asks for (or the world's first)
      if (!held && !passing && !level._started) {
        level._started = true;
        frame(first, ctx);
        here = viewAt(p.x, p.z);
      }
      if (here) show(here);
      // a night view (def.night: the Signal Market's night sheets) holds the night on whatever its sun's hour
      const night = (held?.view ?? here)?.def.night;
      if (night) sharedUniforms.uNight.value = Math.max(sharedUniforms.uNight.value, night);
      if (leaving) {
        // to another world: a fade, then the page loads at its view (the world here goes with the page)
        if (!leaving.t) ctx.fade?.(0.95, PASS.in);
        leaving.t += dt;
        if (!leaving.gone && (leaving.t >= PASS.in || !ctx.fade)) { leaving.gone = true; go(level.address(leaving.k, leaving.local)); }
        return;
      }
      // between views: a quick fade, then the next panel's framing
      if (passing) {
        passing.t += dt;
        if (!passing.done && passing.t >= PASS.in) { passing.done = true; frame(passing.to, ctx); ctx.fade?.(0, PASS.out); }
        if (passing.t >= PASS.in + PASS.out) passing = null;
      } else if (pending || pendingTo !== null) {
        const n = views.length, j = pendingTo ?? (here ? here.local : 0) + pending;
        pending = 0; pendingTo = null;
        if (j < 0 || j >= n) toView(world.first + j);   // (past the world's first or last view: on into the world before or after)
        if (j >= 0 && j < n) {
          passing = { to: views[j], t: 0, done: false };
          ctx.fade?.(0.95, PASS.in);
          if (!ctx.fade) { passing.t = PASS.in; passing.done = true; frame(views[j], ctx); passing = null; }
        }
      } else if (here && (Math.hypot(p.x - here.centre.x, p.z - here.centre.z) > VIEW_REACH)) {
        frame(here, ctx);   // strayed off the view's ground: back at its camera
      }
      // the camera stays on the panel until you walk or look
      if (held && !passing) {
        const moved = Math.hypot(p.x - held.pos.x, p.z - held.pos.z) > 0.4;
        const looked = rig && (rig._lastMouse !== held.mouse || Math.abs(rig.yaw - held.yaw) > 1e-4 || Math.abs(rig.pitch - held.pitch) > 1e-4);
        if (moved || looked || player.riding) release(ctx);
      }
      if (held && camera) {
        const v = held.view, box = frameBox(window.innerWidth, window.innerHeight, v.def.crop[2] / v.def.crop[3], v.cam.fov);
        camera.position.copy(v.eye);
        camera.up.copy(Y);
        camera.lookAt(v.target);
        if (v.cam.roll) camera.rotateZ(v.cam.roll);   // (a panel drawn at a slant)
        lensShift(camera, v.def.camera, window.innerWidth, window.innerHeight, box);   // (the fov, and the shifted lens's window)
        setHidden(player, true);
      }
      if (camera && here) updateUi(held?.view ?? here, camera);
    },
  };
  yield;
  return level;
}
/** The level at once (tests): the world it opens on must be loaded already (await loadWorld(k)). */
export const createReferences = stepped(buildReferences);
