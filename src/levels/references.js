import * as THREE from 'three';
import { colourScript } from '../timeofday.js';
import { makeMaterial, MODE_TERRAIN } from '../materials.js';
import { RoomKit } from './lab-kit.js';
import { REFERENCE_VIEWS, REFERENCE_SHEETS } from './reference-views.js';
import { stepped } from '../load-steps.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { DESERT_LOOK } from '../desert-sites.js';
import { SKY_STONES_DAY, SKY_STONES_LOOK, SKY_STONES_FLAT } from './arzach2.js';
import { BURIED_DAY, BURIED_SPOTS } from './buried.js';

// ---------------------------------------------------------------------------
// The references: a developer's level (?level=references, or the worlds list, L)
// that rebuilds the scenes of the reference pages (references/) with the game's
// own materials, sky, light and ink, each seen from a fixed camera framed like its
// panel, so the shaders can be checked against the look they are after.
//
//   a view      one panel (src/levels/reference-views.js): its ground, what stands
//               on it, its sky and shadow colours, its sun (beside / above the
//               camera) and its camera (eye, heading, field of view, where the
//               horizon sits in the frame)
//   [ and ]     the previous / next view (L3 / R3 on a pad); each switch frames
//               the camera on the panel again. Walk or look and the camera is
//               yours (the traveller appears where the view's camera stood)
//   \           the comparison (View on a pad): off → the panel in a corner →
//               the panel over the frame, half seen through → the panel over the
//               left half of the frame → off
//
// The views lie far apart on a grid (VIEW_SPACING) and only the one you are in is
// drawn, as with the Lab's rooms. Each is authored in its own frame, looking
// down -z from its camera; its group is turned about the vertical so the sun of
// the view's hour comes from the side the panel is lit from (sunTurn). Nothing
// here touches the renderer: the views are ordinary scenery, sky scripts, hours
// and ink presets.
// ---------------------------------------------------------------------------

/** The views' centres lie on a square grid this far apart (m): only the one you are in is drawn. */
export const VIEW_SPACING = 3300;
/** Cells per side (even: no view at the origin, where the ship's site is). */
const GRID = 2 * Math.ceil(Math.sqrt(REFERENCE_VIEWS.length) / 2);
/** How far out the grid reaches (m): its farthest centre on either axis. */
export const VIEW_EXTENT = ((GRID - 1) / 2) * VIEW_SPACING;
/** Past this far from a view's centre (m) you are put back at its camera. */
const VIEW_REACH = 1100;
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const PASS = { in: 0.18, out: 0.45 };   // s: the fade between views
const DEG = Math.PI / 180;

/** A view's centre in the world. */
export const viewCentre = (i) => new THREE.Vector3(((i % GRID) - (GRID - 1) / 2) * VIEW_SPACING, 0, (Math.floor(i / GRID) - (GRID - 1) / 2) * VIEW_SPACING);

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
  // horizon below the centre: looking up; or a pitch given outright (deg: steep views up or down a shaft)
  const pitch = cam.pitch !== undefined ? cam.pitch * DEG : Math.atan((cam.horizon - 0.5) * 2 * Math.tan((cam.fov * DEG) / 2));
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

/** The panel's crop of its sheet as CSS (a background on a box w × h px). */
export function cropStyle(view, w, h) {
  const sheet = REFERENCE_SHEETS[view.sheet];
  const [x, y, cw, ch] = view.crop;
  const sx = w / cw, sy = h / ch;
  return {
    backgroundImage: `url("${sheet.url}")`,
    backgroundSize: `${sheet.size[0] * sx}px ${sheet.size[1] * sy}px`,
    backgroundPosition: `${-x * sx}px ${-y * sy}px`,
  };
}

/** A point of a view's own frame (x, z) in the world. */
function viewToWorld(i, x, z) {
  const c = viewCentre(i), a = sunTurn(REFERENCE_VIEWS[i].sun, REFERENCE_VIEWS[i].camera.yaw), cs = Math.cos(a), sn = Math.sin(a);
  return [c.x + x * cs + z * sn, c.z - x * sn + z * cs, a];
}
/** The panels' people (content.js), standing where their panel has them: small figures in the distance. */
export const REFERENCE_PEOPLE = REFERENCE_VIEWS.flatMap((def, i) => (def.people ?? []).map((p) => {
  const [x, z, a] = viewToWorld(i, p.at[0], p.at[1]);
  return {
    at: [x, z], y: def.ground.height(p.at[0], p.at[1]), radius: 0, shy: false, facing: (p.facing ?? 0) + a, view: def.id,
    palette: p.palette, head: p.head, kind: p.kind ?? 'm',
    lines: ['~neutral~ I stand where the drawing put me.', '~curious~ From here, do I look the way I should?'],
  };
}));

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
};

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildReferences(scene) {
  // ?look=<world> (WORLD_LOOKS): the views in that world's own colours and ink, not the panels'
  const asWorld = typeof location !== 'undefined' ? WORLD_LOOKS[new URLSearchParams(location.search).get('look')] ?? null : null;
  const lights = [], noShadow = [], movers = [];
  const views = REFERENCE_VIEWS.map((def, i) => {
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
    return {
      def, i, centre, group, H, hour, cam, eye, target,
      stand: toWorld(stand), heading: Math.atan2(fwd.x, fwd.z),
      toLocal: (x, z) => {   // world x, z → the view's own frame
        const dx = x - centre.x, dz = z - centre.z, a = group.rotation.y, c = Math.cos(a), s = Math.sin(a);
        return [dx * c - dz * s, dx * s + dz * c];
      },
      zone: { name: `References · ${def.title}`, preset: def.preset ?? 'Moebius print', look: asWorld ? asWorld.look : def.look ?? {}, planets: [], hour },
      atmo: { tint: [1, 1, 1], fog: def.fog ?? 0.35, name: `References · ${def.title}`, script },
    };
  });
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
  show(views[0]);

  // ---- the held camera, the switch between views, the comparison
  yield;
  let held = null;       // { view, pos, yaw, pitch, mouse }: the camera is the panel's until you move or look
  let pending = 0;       // a switch asked for ([ ], L3 / R3)
  let pendingTo = null;  // or a view by its index (goTo)
  let passing = null;    // the fade between two views
  let compare = 0;       // COMPARE[compare]
  let baseFov = null;
  let ui = null;
  const keys = (e) => {
    if (e.repeat || e.target?.closest?.('input, textarea, select')) return;
    if (e.code === 'BracketRight') pending = 1;
    else if (e.code === 'BracketLeft') pending = -1;
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
    Object.assign(ui.ref.style, cropStyle(def, rw, rh), mode === 'corner' ? { width: `${rw}px`, height: `${rh}px` } : { width: '', height: '' });
    const sheet = REFERENCE_SHEETS[def.sheet];
    ui.label.innerHTML = `<b>REFERENCE ${view.i + 1} / ${views.length} · ${def.title}</b><br>${sheet.name}, panel ${def.panel} (${def.where})`
      + `<br><span class="kb">[ ] view · \\ compare: ${COMPARE_NAMES[mode]}</span><span class="pad">L3 / R3 view · View compare: ${COMPARE_NAMES[mode]}</span>`
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
    if (player.gear?.device) player.gear.device.visible = !on;
    if (player.cape?.mesh) player.cape.mesh.visible = !on;
  }
  function release(ctx) {
    held = null;
    setHidden(ctx.player, false);
    const cam = ctx.camera;
    if (cam && baseFov !== null && cam.fov !== baseFov) { cam.fov = baseFov; cam.updateProjectionMatrix(); }
  }

  const level = {
    id: 'references',
    ground,
    envGround: '#e9c27d',
    spawn: views[0].stand.clone(),
    spawnHeading: views[0].heading,
    camYaw: views[0].heading + Math.PI,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    // (the hour of the view you open on: ?view=n frames it on the first frame, before any zone change sets it)
    defaults: { hour: (views[Number(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('view') : 0) - 1] ?? views[0]).hour, preset: 'Moebius print', cloudShadows: 0 },
    killY: -Infinity,
    limit: VIEW_EXTENT + 1600,
    shipSite: { x: 0, z: 0, heading: 0 },   // at the origin, far from every view
    lights, noShadow,
    reactions: false,   // (no responsive flowers in the panels: reactive-world.js)
    views,
    viewAt,
    /** The previous (-1) or next (+1) view, framed on its panel ([ ], L3 / R3). */
    jump: (d) => { pending = d; },
    /** Frame view i (0-based; ?view=<n> in the address opens on view n, 1-based). */
    goTo: (i) => { pendingTo = ((i % views.length) + views.length) % views.length; },
    /** The next comparison mode (\, View): off, the panel in a corner, over the frame, over its left half. */
    compare: () => { compare = (compare + 1) % COMPARE.length; if (ui) ui.key = ''; return COMPARE[compare]; },
    get comparing() { return COMPARE[compare]; },
    get held() { return held?.view ?? null; },
    sky: { script: { day: asWorld?.sky ?? views[0].def.sky, dusk: asWorld?.sky ?? views[0].def.sky, night: asWorld?.sky ?? views[0].def.sky } },
    atmo: (x, z) => viewAt(x, z)?.atmo ?? views[0].atmo,
    zoneAt: (p) => viewAt(p.x, p.z)?.zone ?? views[0].zone,
    update(dt, t, ctx = {}) {
      for (const m of movers) m(t);
      const { player, camera, rig } = ctx;
      if (!player) return;
      const p = player.pos;
      let here = viewAt(p.x, p.z);
      if (camera && baseFov === null) baseFov = camera.fov;
      // the first frame: the panel of the view you are in (or the first)
      if (!held && !passing && !level._started) {
        level._started = true;
        const asked = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('view')) : 0;
        frame(asked >= 1 && asked <= views.length ? views[asked - 1] : here ?? views[0], ctx);
        here = viewAt(p.x, p.z);
      }
      if (here) show(here);
      // between views: a quick fade, then the next panel's framing
      if (passing) {
        passing.t += dt;
        if (!passing.done && passing.t >= PASS.in) { passing.done = true; frame(passing.to, ctx); ctx.fade?.(0, PASS.out); }
        if (passing.t >= PASS.in + PASS.out) passing = null;
      } else if (pending || pendingTo !== null) {
        const n = views.length, i = here ? here.i : 0, j = pendingTo ?? (i + pending + n) % n;
        pending = 0; pendingTo = null;
        passing = { to: views[j], t: 0, done: false };
        ctx.fade?.(0.95, PASS.in);
        if (!ctx.fade) { passing.t = PASS.in; passing.done = true; frame(views[j], ctx); passing = null; }
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
        if (Math.abs(camera.fov - box.fov) > 1e-6) { camera.fov = box.fov; camera.updateProjectionMatrix(); }
        setHidden(player, true);
      }
      if (camera && here) updateUi(held?.view ?? here, camera);
    },
  };
  yield;
  return level;
}
export const createReferences = stepped(buildReferences);
