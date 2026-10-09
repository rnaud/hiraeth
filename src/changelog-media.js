// What the interactive changelog (changelog.html, src/changelog-page/) shows beside a line of
// src/changelog.js: before / after pictures, performance numbers, or how to see a change that has no
// picture (docs/systems/changelog.md). The game never imports this: its changelog panel (N), the
// release notes and changelog.md stay text only.
//
// By version, a list of the lines that have something to show. `match` is the line's opening words
// (it must match exactly one line of that version: tests/changelog-media.test.js), then any of
//   shots: [{ name, caption, commit, before?, view, only? }]
//          pictures in changelog-media/<version>/<name>-before.webp and -after.webp, taken by
//          scripts/changelog-shots.mjs at `before` (default: the commit's parent) and `commit`, from
//          `view` (see the script: a References view `ref`, or `level` + camera `eye`/`target`/`fov`,
//          the hour, weather, preset, size, a `setup` script; `foe` for a creature of the gallery, enemies.html);
//          only: 'after' for a picture with no before
//          reference: { sheet, caption } the design sheet the change was drawn to (a path in the repository,
//          references/…), shown as its own picture beside the pair (changelog-media/<version>/<name>-ref.webp,
//          made from the sheet by the script): never stitched into the game's pictures
//   numbers: [{ title, unit, better: 'lower' | 'higher', device, rows: [{ where, before, after }], source, note? }]
//          measurements before and after (frame times, fps, draws, the contact audit's counts…); a value
//          is a number or a range written as text ('17–25'), drawn as bars by its middle
//   see:   how to see it in the game, for what a picture can't show (sound, feel, solid ground…)
//   tags:  extra filters beyond the ones read from the words (tagsOf)
// A line of src/changelog.js may also be an object { text, shots?, numbers?, see?, tags? }: the same
// fields, written with the line itself.

import { lineText } from './changelog.js';

export const MEDIA_DIR = 'changelog-media';
export { lineText };

/** The files of a shot (paths from the site's root): before is null for an after-only picture; sheet, the design
 *  sheet shown beside the pair (null without a `reference`). */
export function shotFiles(v, s) {
  const at = (side) => `${MEDIA_DIR}/${v}/${s.name}-${side}.webp`;
  return { before: s.only === 'after' ? null : at('before'), after: s.only === 'before' ? null : at('after'), sheet: s.reference ? at('ref') : null };
}

/** The worlds by the words lines use for them (the most specific first). */
export const WORLDS = [
  ['vael2', 'Vael II', /Vael II|Sky Stones/],
  ['vael', 'Vael', /\bVael\b(?! II)/],
  ['lorn2', 'Lorn II', /Lorn II|Deep Wood/],
  ['lorn', 'Lorn', /\bLorn\b(?! II)|Hush-House/],
  ['desert', 'The Desert', /desert|Qanat|dune|camps|pilgrim|Givers|sand\b|leviathan|petal station|radio dish|salt lagoon|Bako|Sefa|Marrow|Nour|Speaker|Ama\b|Hessa/i],
  ['shaft', 'The City-Shaft', /City-Shaft|Wren/],
  ['market', 'The Signal Market', /Signal Market/],
  ['buried', 'The Buried Machine', /Buried Machine|rust canyon|great wheel|Engine-House/],
  ['spheres', 'The Garden of Spheres', /Garden of Spheres|the Garden|olive|android wood|umbrella trees|round plaza/],
  ['home', 'Home', /at home|houses at home/],
  ['viridel', 'Viridel', /Viridel/],
  ['garage', 'The Sealed Hangar', /First Garage|Sealed Hangar/],
  ['mangrove', 'The White Mangrove', /White Mangrove/],
  ['saltharbour', 'The Salt Harbour', /Salt Harbour/],
  ['antennas', 'The Forest of Antennas', /Forest of Antennas/],
  ['moonfoundry', 'The Moon Foundry', /Moon Foundry/],
  ['references', 'References', /References level/],
  ['fallenring', 'The Fallen Ring', /Fallen Ring/],
  ['spacecity', 'The City Floating in Space', /City Floating in Space/],
  ['overnighttrain', 'The Overnight Train', /Overnight Train/],
];

/** The kinds of change, by their words. */
export const KINDS = [
  ['perf', 'Performance', /smoother|lighter on handhelds|frames a second|runs a little|costs? less|automatic resolution|graphics setting|loading screen/i],
  ['characters', 'Characters', /traveller|people|person|cloak|cape|robe|Bako|Sefa|Marrow|Nour|Speaker|Wren is|keepers|bird|face/i],
  ['devices', 'Devices', /Steam Deck|handheld|Retroid|Android/i],
  ['menus', 'Menus & controls', /menu|Sketchbook|Quests|Items shows|panel|\bE \(|prompt|scout|screen on the dash|charms/i],
  ['contact', 'Solid as drawn', /solid|stand on|your feet|hold you up|climb|invisible|sink into/i],
];

/** A line's filters: its worlds and kinds from its words, and any it names itself. */
export function tagsOf(text, extra = []) {
  const tags = new Set(extra);
  for (const [id, , re] of WORLDS) if (re.test(text)) tags.add(id);
  if (tags.has('vael2')) tags.delete('vael');
  if (tags.has('lorn2') && !/\bLorn’s\b|Lorn’s Hush/.test(text)) tags.delete('lorn');
  for (const [id, , re] of KINDS) if (re.test(text)) tags.add(id);
  if ([...tags].some((t) => WORLDS.some(([w]) => w === t))) tags.add('worlds');
  return [...tags];
}


/** The media entry of a line: written with the line, or matched by its opening words here. */
export function mediaFor(v, item, media = CHANGELOG_MEDIA) {
  const text = lineText(item);
  const found = (media[v] ?? []).find((m) => text.startsWith(m.match));
  const inline = typeof item === 'string' ? null : item;
  if (!found && !inline) return null;
  return { ...(found ?? {}), ...(inline ?? {}), text };
}

/**
 * Every version with its lines, each line with its text, tags and media (null when it has none).
 * @param changelog src/changelog.js CHANGELOG
 */
export function changelogEntries(changelog, media = CHANGELOG_MEDIA) {
  return changelog.map((e) => ({
    v: e.v, date: e.date,
    lines: e.items.map((item, i) => {
      const m = mediaFor(e.v, item, media);
      const text = lineText(item);
      return { v: e.v, i, text, tags: tagsOf(text, m?.tags), shots: (m?.shots ?? []).map((s) => ({ ...s, ...shotFiles(e.v, s) })), numbers: m?.numbers ?? [], see: m?.see ?? null };
    }).reverse(),   // (newest first, as the game shows them: src/changelog.js newestFirst)
  }));
}

// ------------------------------------------------------------------ the views the pictures are taken from
// (scripts/changelog-shots.mjs: the same for the before and the after; hour 10, clear, High, 1280 × 720 unless said)
const RETROID = 'Retroid Pocket (GeckoView), Handheld preset, render scale held at 0.75';
const MAC_X4 = 'Mac, headless Chrome, Handheld preset, CPU slowed ×4';
const AUDIT = 'the contact audit (samples where the drawn shape and the solid one disagree)';
const desertAt = (eye, target, o = {}) => ({ level: 'desert', player: o.player ?? [eye[0], 2, eye[2]], eye, target, fov: o.fov ?? 55, ...o });
const SAVE_DESERT = { flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] };
const studio = (query, size = [960, 720]) => ({ page: 'studio.html', query: `${query}&paused=true`, size, wait: 3000 });
const people = (list, o = {}) => ({ level: 'desert', people: list, size: [1280, 720], wait: 1500, ...o });
// (a dune ray held buried a few steps ahead of the traveller, side on to a camera pinned close, so its fin and ripple show)
const RAY_AHEAD = `for (let i = 0; i < 40 && !foes.list.some((f) => f.kind === 'ray'); i++) await new Promise((r) => setTimeout(r, 250));
  const f = foes.list.find((x) => x.kind === 'ray'), P = player.pos, d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize();
  f.pos.set(P.x + d.x * 5 + d.z * 3, f.pos.y, P.z + d.z * 5 - d.x * 3); f.buried = true; f.state = 'chase'; f.heading = Math.atan2(-d.z, d.x); f.update = () => [];
  const eye = f.pos.clone().addScaledVector(d, -3.6).add(new THREE.Vector3(0, 2, 0)), at = f.pos.clone(), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new THREE.Vector3(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };`;
const cx = (z) => 28 * Math.sin((z + 40) / 95);   // the Buried Machine's canyon centreline (buried.js canyonX)

// (the story's second pass, v0.83: a save six worlds along the route, everything charted and heard so far)
const ROUTE = ['desert', 'arzach', 'arzach2', 'perdide', 'perdide2', 'edena', 'incal', 'garage', 'buried', 'spheres', 'bazaar'];
const saveAlong = (n, flags = {}) => ({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'ship.powered': true, 'charge.given': true, 'charge.card': true,
  ...Object.fromEntries(ROUTE.slice(0, n).map((w) => [`world.${w}.done`, true])), ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`calls.${i + 1}`, true])),
  ...(n >= 6 ? { 'calls.home': true } : {}), ...flags }, keepsakes: [] });
const GIFTS = ['stun', 'fire', 'cell', 'coil', 'lantern', 'lens', 'bell', 'shell', 'echo', 'star'];

/** A world of the colour pass: the same view before and after, then the pass's own picture of before, after and the reference. */
const colourShots = (name, commit, view, caption, ref) => [
  { name: `${name}-colours`, caption, commit, view },
  { name: `${name}-reference`, only: 'after', caption: `Before, after and the reference (${ref}), side by side`, from: 'headless Chrome against this branch’s own dev server and the commit before the colour pass, High, laid beside the reference picture (8 October)' },
];
const SEE_COLOURS = 'Open ?level=references and go to the world (Tab: all views), then press \\ to lay the picture over the view; or walk the world itself.';

// ------------------------------------------------------------------ v0.98 to v1.0's views (set up in the page: `setup`)
const SAVE_ON = { flags: { ...SAVE_DESERT.flags, 'charge.given': true, 'charge.card': true }, keepsakes: [] };   // (no charge card over the view)
const sleepJs = (ms) => `await new Promise((r) => setTimeout(r, ${ms}));`;
/** Hide some of the page's overlays (the toasts, the Arena's input panel…), the rest of the HUD kept. */
const HIDE = (sel) => `{ const st = document.createElement('style'); st.textContent = '${sel} { visibility: hidden !important; }'; document.head.appendChild(st); }`;
/**
 * The camera pinned on a spot of the ground (x, z): `dist` m away at the angle `a` (round the spot), `h` m up, looking
 * at the spot `ty` m up; the traveller set down `pd` m from the spot at the angle `pa` (so the world round it is built).
 */
const pinAt = (x, z, { a = 0, dist = 8, h = 2.5, ty = 1, pd = 3, pa = a + 0.6, fov = 55, settle = 3000 } = {}) => `
  const V = THREE.Vector3, gy = (px, pz) => terrain.heightAt(px, pz);
  const at = new V(${x}, gy(${x}, ${z}) + ${ty}, ${z});
  const pp = new V(${x} + Math.sin(${pa}) * ${pd}, 0, ${z} + Math.cos(${pa}) * ${pd}); pp.y = gy(pp.x, pp.z) + 0.1;
  player.teleport(pp, new V(0, 1, 0), new V(0, 0, 1));
  const eye = new V(${x} + Math.sin(${a}) * ${dist}, 0, ${z} + Math.cos(${a}) * ${dist}); eye.y = Math.max(gy(eye.x, eye.z) + 0.5, at.y - ${ty} + ${h});
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== ${fov}) { this.fov = ${fov}; this.updateProjectionMatrix(); } return base.call(this, force); };
  ${sleepJs(settle)}`;
/** The Arena's first foe held 6 m ahead of the traveller in a given state (`props`), locked on, the camera pinned beside him. */
const LOCKED = (props) => `
  for (let i = 0; i < 40 && !foes.list.length; i++) ${sleepJs(250)}
  const V = THREE.Vector3, f = foes.list[0], P = player.pos, d = new V(); camera.getWorldDirection(d); d.y = 0; d.normalize().negate(); player.heading = Math.atan2(d.x, d.z);
  f.pos.set(P.x + d.x * 6, f.pos.y, P.z + d.z * 6); f.heading = Math.atan2(-d.x, -d.z); f.update = () => [];
  Object.assign(f, ${JSON.stringify(props)});
  foes.cycleLock();
  const eye = P.clone().addScaledVector(d, 1.5).add(new V(-d.z * 2.4, 1.7, d.x * 2.4)), at = f.pos.clone().add(new V(0, 0.6, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
  ${sleepJs(1500)}`;
/** Talk to the story person nearest the start. */
const TALK = `const n = npcs.filter((x) => x.def).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
  player.pos.copy(n.pos).add(new THREE.Vector3(1.6, 0, 1.6)); ${sleepJs(1200)}
  storyRt.dialogue.start(n.def, n);`;
const MENU = `menu.toggle(true); ${sleepJs(500)}`;
// the ride to the Hearth's three stops (src/desert-sites.js wayPlaces: by the 2nd, 5th and 8th marked stones)
const WAY = { bowl: [646.27, 141.38], camp: [1028.02, -97.03], bell: [1442.76, -315.37] };

// ------------------------------------------------------------------ v1.1's views
// (a foe held still a few steps ahead of the traveller, side on to a camera pinned close: `prep` puts it in the
// state to see, in the page, with f the foe)
const FOE_HELD = (kind, prep, { dist = 5, eye = 4, h = 1.6 } = {}) => `const P = player.pos, d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize();
  const f = foes.spawnKind('${kind}', { n: 1, dist: 1 })[0];
  f.pos.set(P.x + d.x * ${dist}, P.y, P.z + d.z * ${dist}); { const g = physics.groundAt(f.pos.x, P.y + 4, f.pos.z, 12); if (Number.isFinite(g)) f.pos.y = g; }
  f.heading = Math.atan2(-d.z, d.x); f.home.copy(f.pos);
  ${prep}
  const keep = { state: f.state, atk: f.atk, k: f.k, timer: f.timer, buried: f.buried }; f.update = () => { Object.assign(f, keep); f.dist = 10; return []; };
  const eye = f.pos.clone().addScaledVector(d, -${eye}).add(new THREE.Vector3(-d.z * 1.2, ${h}, d.x * 1.2)), at = f.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new THREE.Vector3(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };`;
// (the stone hand on Vael from in front of its palm, looking up at the knuckles)
const HAND_VIEW = `const H = level.arzach.hand, n = new THREE.Vector3(H.normal.x, 0, H.normal.z).normalize();
  const mid = H.knuckles.reduce((s, k) => s.add(k.pos), new THREE.Vector3()).divideScalar(4);
  const foot = H.palm.clone().addScaledVector(n, 30); foot.y = physics.groundAt(foot.x, H.palm.y + 20, foot.z, 80);
  player.teleport(foot.clone(), new THREE.Vector3(0, 1, 0), n.clone().negate());
  const eye = foot.clone().add(new THREE.Vector3(0, 6, 0)), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, mid, new THREE.Vector3(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 50) { this.fov = 50; this.updateProjectionMatrix(); } return base.call(this, force); };`;

/**
 * A makers' run played through in the page (docs/systems/challenges.md): its card, Start, its gates, (its bank), the results at a
 * plausible time. (A run with no bank ends at its last gate: the clock is set before it, `last` seconds short of the time.)
 */
const RUN_THROUGH = (id, time, last = 0) => `const w = window.trials.byId('${id}'), V = window.THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  w.try(); await wait(900); document.querySelector('button[data-act="start"]').click(); await wait(4300);
  for (const [i, g] of w.gates.entries()) { if (${last} && i === w.gates.length - 1) window.minigame.clock = ${time - last}; window.player.teleport(new V(g.x, g.y - 1.6, g.z), new V(0, 1, 0), new V(0, 0, 1)); await wait(700); }
  if (!${last}) window.minigame.clock = ${time};
  const b = w.course.bank; if (b) { b.hit(0); b.hit(1); b.hit(2); }
  await wait(2600);`;
// ------------------------------------------------------------------ v1.3's blade views
// (the Arena's first blot held still 2.4 m ahead of the traveller, the camera pinned at his side `side` m off and
// `h` m up; then `go` plays the buttons in the page and the game is frozen on that frame: window.cinematicReview.paused)
const BLADE_VIEW = (go, { side = 3.6, h = 2.0, ty = 1.5 } = {}) => `for (let i = 0; i < 60 && !foes.list.length; i++) ${sleepJs(250)}
  const V = THREE.Vector3, f = foes.list[0], P = player.pos, d = new V(); camera.getWorldDirection(d); d.y = 0; d.normalize();
  player.heading = Math.atan2(d.x, d.z);
  for (const g of foes.list.slice(1)) g.pos.set(P.x + 40, g.pos.y, P.z + 40);
  f.pos.set(P.x + d.x * 2.4, f.pos.y, P.z + d.z * 2.4); f.heading = Math.atan2(-d.x, -d.z); f.hp = 999; f.update = () => { f.state = 'idle'; return []; };
  const eye = P.clone().addScaledVector(d, 1.0).add(new V(-d.z * ${side}, ${h}, d.x * ${side})), at = P.clone().addScaledVector(d, 1.2).add(new V(0, ${ty}, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); return base.call(this, force); };
  ${HIDE('#toast, #inputs, #foe-spawner')}
  ${sleepJs(1500)}
  ${go}
  window.cinematicReview = { paused: true };`;
const ARENA_BLADE = { level: 'arena', query: 'foe=blot', quality: 'high', save: SAVE_ON, wait: 400 };
/** The Arena's ledge from its side: the field cleared, the traveller up on the ledge facing out; `go` adds the foe (V: THREE.Vector3). */
const LEDGE_VIEW = (go) => `for (let i = 0; i < 60 && !foes.list.length; i++) ${sleepJs(250)}
  const V = THREE.Vector3;
  foes.setPractice('');
  player.teleport(new V(4, 2.1, -43.5), new V(0, 1, 0), new V(0, 0, 1)); player.heading = 0;
  ${HIDE('#toast, #inputs, #foe-spawner')}
  ${sleepJs(600)}
  ${go}`;
const ARENA_LEDGE = { level: 'arena', query: 'foe=blot', quality: 'high', save: SAVE_ON, eye: [16, 4.5, -35], target: [3, 1.2, -40], fov: 55 };


/** A makers' run with balls played through for its results card: the gates walked, the balls set on their plates. */
const ROLL_THROUGH = (id, time) => `const w = window.trials.byId('${id}'), V = window.THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  w.try(); await wait(900); document.querySelector('button[data-act="start"]').click(); await wait(4300);
  for (const g of w.gates) { window.player.teleport(new V(g.x, g.y - 1.6, g.z), new V(0, 1, 0), new V(0, 0, 1)); await wait(700); }
  window.minigame.clock = ${time};
  for (const R of w.course.rollers) { R.ball.t = 1; R.ball.place(); w.course.rt.logic.moveDrum(R.id, 1); }
  await wait(2600);`;
/** The echo relay played through for its results card: the walls walked, then the horns woken (as their notes played back would). */
const ECHO_THROUGH = (id, time) => `const w = window.trials.byId('${id}'), V = window.THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  w.try(); await wait(900); document.querySelector('button[data-act="start"]').click(); await wait(4300);
  for (const g of w.gates) { window.player.teleport(new V(g.x, g.y - 1.6, g.z), new V(0, 1, 0), new V(0, 0, 1)); await wait(700); }
  window.minigame.clock = ${time};
  for (const e of w.course.ears) e.ear.lit = true;
  await wait(2600);`;
/** The vine walk played through for its results card: the seeds and the door bloomed, the decks walked (the clock set before the last gate). */
const VINE_THROUGH = (id, time) => `const w = window.trials.byId('${id}'), V = window.THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  w.try(); await wait(900); document.querySelector('button[data-act="start"]').click(); await wait(4300);
  for (const v of w.course.vines) v.seed.hit('bloom');
  w.course.bud.bud.hit('bloom'); await wait(800);
  for (const [i, g] of w.gates.entries()) { if (i === w.gates.length - 1) window.minigame.clock = ${time}; window.player.teleport(new V(g.x, g.y - 1.6, g.z), new V(0, 1, 0), new V(1, 0, 0)); await wait(700); }
  await wait(2600);`;
const SAVE_ECHO = { flags: { 'prologue.done': true, 'item.backpack': true, 'item.echo': true, 'items.v': 2 }, keepsakes: [] };
/** A makers' run with bell-tuned pieces played through: every bridge and the door rung down (rt.lit, as their ears do), the gates walked. */
const BELL_THROUGH = (id, time) => `const w = window.trials.byId('${id}'), V = window.THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  w.try(); await wait(900); document.querySelector('button[data-act="start"]').click(); await wait(4300);
  for (const b of w.course.bells) w.course.rt.lit.add(b.id);
  w.course.rt.lit.add(w.course.door.id + '.bell'); await wait(800);
  for (const [i, g] of w.gates.entries()) { if (i === w.gates.length - 1) window.minigame.clock = ${time}; window.player.teleport(new V(g.x, g.y - 1.6, g.z), new V(0, 1, 0), new V(0, 0, 1)); await wait(700); }
  await wait(2600);`;
const SAVE_BELL = { flags: { 'prologue.done': true, 'item.backpack': true, 'item.bell': true, 'items.v': 2 }, keepsakes: [] };
const SAVE_BLOOM ={ flags: { 'prologue.done': true, 'item.backpack': true, 'item.bloom': true, 'items.v': 2 }, keepsakes: [] };

/** The hearts' pictures (v1.5): the health at `k` (the old bar's share; 1.5 hearts at 0.5) and the tank at 1.4 of 3, held there, the notices hidden. */
const HEARTS_SETUP = (k) => `${HIDE('#toast, #cue, #prompt, #objective')} const hold = () => { player.hurtAt = 1e12; player.health = ${k}; if (tool.reserve) { tool.reserve.level = 1.4; tool.reserve.since = -1e9; } }; hold(); setInterval(hold, 100);`;
/** The chimes' pictures (v1.5): a foe called in still, then cut down (Foes.burst) where the camera looks; the traveller out of the magnet's reach. */
const CHIME_DROP = (kind, where) => `const V = THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  foes.setPractice?.(''); for (const f of [...foes.list]) foes.remove(f); foes.waveRest = 1e9; foes.packRest = 1e9;
  await wait(600);
  const at = ${where}; at.y = physics.groundAt(at.x, at.y + 30, at.z, 80);
  const f = foes.add('${kind}', at); f.state = 'idle'; f.cool = 99; f.heading = 0.6;
  await wait(1200); foes.burst(f);`;
const FROM_ROSTER = 'headless Chrome against this branch’s dev server, the Arena at High, 1280 × 720, the four set in a row and held still (9 October)';
const FROM_ATTACK = 'headless Chrome against this branch’s dev server, the Arena at High, 1280 × 720: the enemy set striking with its attack locked on the traveller, held still (9 October)';

/**
 * The first shop's pictures (v1.5): the traveller set down inside Haddu's shop by the counter, the camera pinned in the
 * room's corner by the door looking at the counter and the keeper (the interior kit: level.shops, src/interior-kit.js);
 * `then` runs after (the panel opened, a card chosen).
 */
const SHOP_IN = (then = '') => `${HIDE('#toast, #cue, #prompt, #objective')}
  const V = THREE.Vector3, it = level.shops[0].interior, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  player.teleport(it.local(-1.0, 0.05, 1.3), new V(0, 1, 0), new V(0, 0, 1)); player.heading = Math.PI;
  const eye = it.local(1.8, 1.8, 3.1), at = it.local(-0.4, 1.2, -1.6);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 55) { this.fov = 55; this.updateProjectionMatrix(); } return base.call(this, force); };
  resources.addChimes(160);
  await wait(3000);
  ${then}`;
const SHOP_OPEN = (then = '') => SHOP_IN(`game.emit('shop:open', { shop: 'qanat' }); await wait(900); ${then}`);
const SHOP_DOOR = [203.67, 319.94, -1.62];   // Haddu's door (x, z) and its heading: src/levels/desert.js

// ------------------------------------------------------------------ v1.7's views
/** The camera pinned close behind the traveller's right shoulder (the kit's hose: there before, gone after). */
const BEHIND_RIGHT = `${HIDE('#toast, #cue, #prompt, #objective')}
  const V = THREE.Vector3, up = new V(0, 1, 0), f = new V(); player.object.getWorldDirection(f); f.y = 0; f.normalize();
  const right = f.clone().cross(up), P = player.pos.clone();
  const eye = P.clone().addScaledVector(f, -1.7).addScaledVector(right, 0.9).add(new V(0, 1.75, 0)), at = P.clone().addScaledVector(right, 0.15).add(new V(0, 1.2, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, up));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 45) { this.fov = 45; this.updateProjectionMatrix(); } return base.call(this, force); };`;
/** Twelve chimes (two fives, two ones) dropped in the Arena's middle, scattered the same way before and after (a seeded rng), the foes away. */
const FROM_CHIME_SHADER = 'headless Chrome against a dev server, High, 1280 × 720, hour 10: the chimes dropped from a seeded rng and laid out in a ring, the camera pinned (the same scatter before and after); before at main before the change, after with it';
/** An enemy's design sheet, shown beside its pair (n 1: the main skin's sheet, 2: the alternate's). */
const REF = (id, n, skin) => ({ sheet: `references/enemy-archetypes/${id}/sheet-${n}.jpg`, caption: `${n === 1 ? 'The main' : 'The alternate'} design sheet: ${skin}` });
/** The roster's procedural surfaces: taken with the foe views below at the commit before them and at theirs (made
 *  before the branch was rebased: hence `from`, not `commit`). */
const SURF = { from: 'node scripts/changelog-shots.mjs (view.foe, the creatures gallery) at 3ea3e8f7, the commit before the surfaces, and at the surfaces’ own commit, before rebasing' };
/** Batch 1's art pass: from before compare.mjs (7dd178f7) to its last commit. */
const ART = { commit: 'afc7dfb0', before: '7dd178f7^' };
const CHIME_SEEDED = `const V = THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  foes.setPractice?.(''); for (const f of [...foes.list]) foes.remove(f); foes.waveRest = 1e9; foes.packRest = 1e9;
  let s0 = 11; chimes.rng = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646;
  await wait(600);
  const at = new V(0, 0, 0); at.y = physics.groundAt(0, 30, 0, 80); chimes.drop(at, 12);`;

// v1.9's chimes floating: the same seeded scatter, no foes, never picked up (drops: [x, z, chimes] on the Arena's floor)
/**
 * Inside the parked ship (the Glass Dunes, lamps on): the traveller placed at `player` and the camera pinned at `eye`
 * looking at `look`, all in the ship's own metres (src/ship/hull.js: x to starboard, y over the deck, z aft).
 */
const SAVE_SHIP = { flags: { ...SAVE_DESERT.flags, 'ship.powered': true }, keepsakes: [] };
const SHIP_ROOM = (eye, look, fov = 70, player = [-1.2, 0, 0.9]) => `const s = window.ship, m = s.parked, V = THREE.Vector3;
  const L = (a) => s.world(m, new V(a[0], a[1], a[2]));
  s.placePlayer(L(${JSON.stringify(player)}), s.worldHeading(m, 3.1), true);
  const e = L(${JSON.stringify(eye)}), t = L(${JSON.stringify(look)});
  const up = new V(0, 1, 0).applyQuaternion(m.group.getWorldQuaternion(new THREE.Quaternion()));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e, t, up));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (f) { this.position.copy(e); this.quaternion.copy(q); if (this.fov !== ${fov}) { this.fov = ${fov}; this.updateProjectionMatrix(); } return base.call(this, f); };
  await new Promise((r) => setTimeout(r, 1500))`;
const SHIP_FROM = 'headless Chrome against a dev server (the Glass Dunes, High, 10:00, the ship powered), the camera pinned at the same spot in the ship before and after';
const CHIME_FLOAT = (drops) => `const V = THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  foes.setPractice?.(''); for (const f of [...foes.list]) foes.remove(f); foes.waveRest = 1e9; foes.packRest = 1e9;
  { const u = chimes.update.bind(chimes); chimes.update = (dt) => u(dt, null); }
  let s0 = 11; chimes.rng = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646; chimes.clear();
  await wait(600);
  for (const [x, z, n] of ${JSON.stringify(drops)}) { const at = new V(x, 0, z); at.y = physics.groundAt(x, 30, z, 80); chimes.drop(at, n); }`;

// v1.10's chimes redrawn (the author's picks, references/Core Objects/Currency/Floating Chime/): on the desert's sand
// by the ship, a seeded scatter, no foes, never picked up unless `who` is set; `frozen` holds the field still
const CHIME_P = [29, 24.456, 132], CHIME_H = 0.6435, CHIME_F = [Math.sin(CHIME_H), Math.cos(CHIME_H)], CHIME_R = [CHIME_F[1], -CHIME_F[0]];
/** A spot `fw` m ahead of the traveller and `rt` m to the side ([x, z]). */
const chimeAt = (fw, rt) => [+(CHIME_P[0] + CHIME_F[0] * fw + CHIME_R[0] * rt).toFixed(3), +(CHIME_P[2] + CHIME_F[1] * fw + CHIME_R[1] * rt).toFixed(3)];
const chimeEye = (back, up, side = 0) => { const [x, z] = chimeAt(-back, side); return [x, CHIME_P[1] + up, z]; };
const chimeAway = [chimeAt(-6, 0)[0], CHIME_P[1], chimeAt(-6, 0)[1]];
const CHIME_SAND = (drops, then = '') => `const V = THREE.Vector3, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  foes.setPractice?.(''); for (const f of [...foes.list]) foes.remove(f); foes.waveRest = 1e9; foes.packRest = 1e9;
  const U = chimes.update.bind(chimes); let frozen = false, who = null; chimes.update = (dt) => frozen ? [] : U(dt, who);
  let s0 = 11; chimes.rng = () => ((s0 = (s0 * 16807) % 2147483647) - 1) / 2147483646; chimes.clear();
  await wait(400);
  for (const [x, z, n] of ${JSON.stringify(drops)}) { const at = new V(x, 0, z); at.y = physics.groundAt(x, 60, z, 120); chimes.drop(at, n); }
  ${then}`;
/** The pieces laid in a row across the view, `fw` m ahead, by worth; then the camera pinned `back` m behind the middle one, looking at it. */
const CHIME_ROW = (fw, gap, back, up, fov = 40) => `await wait(1500);
  const L = chimes.list.sort((a, b) => a.value - b.value);
  L.forEach((p, i) => { const k = i - (L.length - 1) / 2, x = ${CHIME_P[0] + CHIME_F[0] * fw} + ${CHIME_R[0]} * k * ${gap}, z = ${CHIME_P[2] + CHIME_F[1] * fw} + ${CHIME_R[1]} * k * ${gap};
    p.to.set(x, physics.groundAt(x, 60, z, 120), z); });
  await wait(600);
  const m = L[Math.floor((L.length - 1) / 2)].pos.clone().lerp(L[Math.ceil((L.length - 1) / 2)].pos, 0.5);
  const e = m.clone().add(new V(${-CHIME_F[0]} * ${back}, ${up}, ${-CHIME_F[1]} * ${back})), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(e, m.clone().add(new V(0, -0.05, 0)), new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(e); this.quaternion.copy(q); if (this.fov !== ${fov}) { this.fov = ${fov}; this.updateProjectionMatrix(); } return base.call(this, force); };`;
const CHIME_FIELD_DROPS = [[...chimeAt(3.2, -1.6), 1], [...chimeAt(4.0, 0.9), 1], [...chimeAt(5.2, -0.5), 5], [...chimeAt(5.8, 2.2), 1], [...chimeAt(6.6, -2.4), 1], [...chimeAt(7.6, 0.4), 10], [...chimeAt(8.2, 2.9), 1], [...chimeAt(9.2, -1.3), 1], [...chimeAt(10.2, 1.5), 1], [...chimeAt(11.4, -0.1), 20], [...chimeAt(12.2, 3.2), 1], [...chimeAt(6.8, -3.8), 1], [...chimeAt(9.6, -3.4), 1]];
const CHIME_TGT = (fw, up) => [+(CHIME_P[0] + CHIME_F[0] * fw).toFixed(3), CHIME_P[1] + up, +(CHIME_P[2] + CHIME_F[1] * fw).toFixed(3)];
const FROM_CHIME_LOOK = 'headless Chrome against a dev server, High, 1280 × 720, hour 10, the desert’s sand by the ship: the chimes dropped from a seeded rng (the same scatter before and after), the camera pinned; before at main before the change, after with it (9 October)';

// ------------------------------------------------------------------ v1.6's views: the body telegraphs
// (a foe held at 85 % of a wind-up, three-quarters on: before, its lane or ring on the floor; after, its pose and its glow)
const FOE_WIND = (kind, atk) => `foes.setPractice('');
  ${sleepJs(300)}
  ${FOE_HELD(kind, `f.heading = Math.atan2(-d.x, -d.z) + 1.0; f.over = 0; f.alt = f.def.hover ?? 0; f.state = 'wind'; f.atk = f.def.attacks.find((a) => a.id === '${atk}'); f.k = 0.85; f.timer = f.atk.wind * 0.85; f.attackH = f.heading; f.attackAt.copy(f.pos);`, { dist: 5, eye: 5.5, h: 2.2 })}`;
/**
 * A temple guardian called into a ring in the Arena (src/arena-guardians.js) and held at 85 % of a move's wind-up (its
 * meter at `meter`: its phase), seen from the side with the traveller in front of it; driven by the page each frame.
 * Written for both sides: the old Guardian (telegraph, a floor shape) and the new (wind, the body's tells).
 */
const GUARD_WIND = (id, atk, { meter = 0, k = 0.85, side = 15, back = 9, h = 6, look = 0.35 } = {}) => `foes.setPractice('');
  ${sleepJs(300)}
  const V = THREE.Vector3, { ArenaGuardians } = await import('/src/arena-guardians.js');
  const A = new ArenaGuardians({ scene, player, physics, sound: null, notice() {} });
  const g = A.call('${id}'), m = g.model, f = new V(Math.sin(m.heading), 0, Math.cos(m.heading)), r = new V(f.z, 0, -f.x);
  player.teleport(m.pos.clone().addScaledVector(f, 9).setY(m.pos.y), new V(0, 1, 0), f.clone().negate());
  g.meter = ${meter}; g.floor = ${meter}; g.state = 'fight'; g.t = 0;
  const a = { id: '${atk}', ...g.def.attacks['${atk}'] }, w = a.wind ?? a.telegraph;
  g.attack = a; g.at = w * ${k}; g.struck = false; g.windFor = w; g.view = { ...a, id: a.pose ?? '${atk}' }; g.attackK = ${k};
  g.attackH = m.heading; g.attackAt.copy(m.pos).addScaledVector(f, 6).setY(g.arena.y);
  if (a.lob && a.volley > 1 && g.spreadMarks) { g.attackAt.copy(player.pos).setY(g.arena.y); g.spreadMarks(a); }
  const fight = g.fight.bind(g); g.fight = (dt, t, P) => fight(0, t, P);
  const tick = () => { A.update(1 / 60, performance.now() / 1000); requestAnimationFrame(tick); }; tick();
  const H = m.height ?? 4, eye = m.pos.clone().addScaledVector(r, ${side}).addScaledVector(f, ${back}).add(new V(0, ${h}, 0)), at = m.pos.clone().addScaledVector(f, 3).add(new V(0, H * ${look}, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, at, new V(0, 1, 0)));
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) { this.position.copy(eye); this.quaternion.copy(q); if (this.fov !== 55) { this.fov = 55; this.updateProjectionMatrix(); } return base.call(this, force); };`;
const TELL_VIEW = (setup, player = null) => ({ level: 'arena', query: 'foe=blot', quality: 'high', save: SAVE_ON, wait: 2500, setup, ...(player ? { player, heading: Math.PI * 0.75 } : {}) });
const TELLS = { commit: '3a635fa8', before: '8312cf69' };

// (v1.11, the controller's quick buttons, one job each: a pad in hand, held as the setup says; the camera stays put)
const FAKE_PAD = `const pad = { index: 0, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', connected: true, mapping: 'standard', timestamp: 1, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })) };
  navigator.getGamepads = () => [pad];
  const set = (i, on) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0, touched: on }; pad.timestamp++; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.rig.look = () => {};
  set(9, true); await wait(150); set(9, false); await wait(300); window.menu.toggle(false); await wait(300);`;
const PAD_SAVE = { flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, 'item.hook': true, 'item.bomb': true, 'item.fan': true, 'item.lens': true, 'item.magnet': true, 'item.fire': true, 'item.stun': true, 'gadget.equipped': 'hook' }, keepsakes: [] };
const PAD_VIEW = (setup) => ({ level: 'arena', hud: true, save: PAD_SAVE, wait: 1200, setup: `${FAKE_PAD}\n${setup}` });
const PADS = { commit: 'cc087bd4' };

export const CHANGELOG_MEDIA = {
  '1.11': [
    { match: 'While Qanat’s tree stands cold, the pilgrims’ camps keep a column of smoke', shots: [
      { name: 'desert-landing-smoke', caption: 'The desert from the landing, toward Qanat: before, a dune and nothing over it; after, the camps’ smoke rising beyond it', commit: 'b5786bb4',
        view: { level: 'desert', player: [0, 1.8, 0], eye: [-2.5, 4.2, -4.3], target: [195, 31.2, 339], fov: 60 } },
      { name: 'desert-dry-channel', caption: 'From Qanat’s east side: after, the Givers’ dry channel running up the dune to the Givers’ House', commit: 'b5786bb4',
        view: { level: 'desert', player: [300, 1.2, 395], eye: [296, 5.2, 395.3], target: [517, 37.6, 378], fov: 60 } },
    ] },
    { match: 'The long ride out to the Givers’ Hearth has company', shots: [
      { name: 'desert-ride-shade', caption: 'A third of the way to the Hearth: after, Yara under her sunshade, its red pennant up', commit: 'b5786bb4',
        view: { level: 'desert', player: [580.7, 17.4, -14.6], eye: [580.7, 20.4, -14.6], target: [590.7, 21.6, -21.6], fov: 60 } },
      { name: 'desert-ride-wreck', caption: 'Two thirds of the way: after, the sand-skiff on its side, its mast and a rag of sail, the Hearth’s chimney beyond', commit: 'b5786bb4',
        view: { level: 'desert', player: [1037.6, -5, -218.2], eye: [1037.6, -0.5, -218.2], target: [1053.6, -2.4, -227.2], fov: 60 } },
    ], see: 'Once Nour has sent you for the spark-stone, ride from Marrow’s hollow straight for the Hearth’s chimney: the pennant and the wreck’s mast come up ahead, and each is named as you near it. Ride home to Qanat along the marked stones.' },
    // Vael
    { match: 'In Vael, Senn now listens at the foot of the capped needle spire', shots: [
      { name: 'vael-senn-spire', caption: 'Out on the plain, halfway to the lone tower: after, Senn with her ear to the capped spire’s foot (the box and a feather on its cap, far overhead)', commit: 'c573fa1b',
        view: { level: 'arzach', player: [150, 17.5, -250], eye: [146, 21, -244], target: [166, 22, -276], fov: 60, hour: 12 } },
      { name: 'vael-stones', caption: 'From the landing, west up the slope: after, a line of standing stones climbing toward the Aerie on the plateau', commit: 'c573fa1b',
        view: { level: 'arzach', player: [6, 0, 1], eye: [10, 3.5, 2], target: [-80, 16, -2], fov: 60, hour: 12 } },
    ] },
    { match: 'The doorway in the sand before the desert’s masked head', shots: [
      { name: 'desert-mask-doorway', caption: 'The doorway before the masked head: before, a flat dark panel in its frame; after, a short passage into the dark', commit: 'ced314df',
        view: { level: 'desert', player: [9, 9, -360], eye: [10, 11.5, -357], target: [7, 10.5, -371], fov: 50 } },
    ] },
    { match: 'On a controller every button now has one job', shots: [
      { name: 'controls-pad-list', caption: 'The Controls page with a controller in hand, at the controller’s list, v1.10 against now: before, the potion on View + D-pad ↓ and the gun mode on D-pad ← / →; after, the potion on D-pad ←, the gun mode on D-pad →, the mount still on D-pad ↓', ...PADS, before: 'bbc5a982',
        view: PAD_VIEW(`window.menu.toggle(true, 'controls'); await wait(400); const li = [...document.querySelectorAll('#settings li')].find((e) => /^Gun mode \\(/.test(e.textContent.trim())); li?.scrollIntoView({ block: 'center' }); await wait(300);`) },
    ], see: 'With a controller, take a hit so a heart is missing and press D-pad ←: the traveller drinks, the flask by the hearts tips and the hearts come back. With the backpack and a gun mode found, press D-pad → a few times: the tank changes colour and comes round to the fluid. In the Arena (?level=arena) D-pad ↓ opens the FOES list.' },
    { match: 'If you played v1.11’s first build', shots: [
      { name: 'controls-pad', caption: 'The Controls page’s “Your buttons (controller)”, v1.11’s first build against now: before, Run (standing still: call your mount) on L3, the gun mode folded into Choose a gadget, Drink a potion on D-pad ↓; after, one row each: Drink a potion on D-pad ←, Call your mount on D-pad ↓, Next gun mode on D-pad →', ...PADS,
        view: PAD_VIEW(`window.menu.toggle(true, 'controls'); await wait(500);`) },
    ], see: 'With a controller, stand still and click the left stick: nothing but a run (the mount comes with D-pad ↓). Hold LT / L2 and tap D-pad ↑: the next gadget, not a gun mode. Hold D-pad ↑: the wheel has the gadgets only.' },
    { match: 'Inside the ship the main room is laid out anew', shots: [
      { name: 'ship-layout-aft', caption: 'From the back of the main room toward the cockpit, the view of the picked sheet: before, the holo table at the front, the galley on the right, the entry lockers on the left; after, the galley along the left wall, the holo table in the middle in the crook of the curved console with the voicemail on its near end, the bunk’s arched alcove and the lockers on the right, two seats in the cockpit', commit: 'f64c722a', before: '70309935',
        view: { level: 'glassdunes', save: SAVE_SHIP, wait: 3000, setup: SHIP_ROOM([0.3, 1.75, 2.3], [0, 1.1, -8], 78) }, from: SHIP_FROM },
      { name: 'ship-layout-sheet', only: 'after', caption: 'The picked sheet (left: references/The Travellers Ship/Interior - Lab, chosen for its layout) beside the game’s room from the same end, in the game’s own ink and colours', from: 'the reference-lab sheet beside the after picture of the view above, side by side (sips, cwebp)' },
      { name: 'ship-layout-port', caption: 'Across to the port side: before, the entry bench and lockers by the hatch; after, the galley from the hatch to the cockpit, a board of tools and cupboards over it, the console’s tail with the voicemail button, the projector and the little screen', commit: 'f64c722a', before: '70309935',
        view: { level: 'glassdunes', save: SAVE_SHIP, wait: 3000, setup: SHIP_ROOM([2.2, 1.65, 0.4], [-3.2, 1.0, -3.4]) }, from: SHIP_FROM },
      { name: 'ship-layout-starboard', caption: 'Across to the starboard side: before, the galley under its window; after, the bunk in its arched alcove under the window, books and photographs inside, kit on hooks, the lockers', commit: 'f64c722a', before: '70309935',
        view: { level: 'glassdunes', save: SAVE_SHIP, wait: 3000, setup: SHIP_ROOM([-1.8, 1.65, -0.6], [3.2, 1.0, -3.6]) }, from: SHIP_FROM },
      { name: 'ship-layout-cockpit', caption: 'Into the cockpit: before, one pilot’s seat, the projector, the voicemail and the round screen on the dash; after, two seats side by side and the panel overhead', commit: 'f64c722a', before: '70309935',
        view: { level: 'glassdunes', save: SAVE_SHIP, wait: 3000, setup: SHIP_ROOM([0.2, 1.8, -4.8], [0, 1.2, -9.5]) }, from: SHIP_FROM },
    ], see: 'Go aboard your ship and stand at the back of the main room, by the lockers: the cockpit straight ahead, the galley on the left, the holo table and its curved console in the middle, the bunk’s arched alcove on the right. Debug → Cinematics → Recording 1 plays a recording at the console’s end.' },
    // the chimes, redrawn
    { match: 'Chimes have a new look: each is a long, blunt crystal', shots: [
      { name: 'chimes-look-field', caption: 'A scatter of chimes on the desert’s sand from behind the traveller, at play distance: before, 27.5 cm shards leaning well over, the drops of five and more as ones and pale clusters, a dark smudge under each; after, smaller crystals floating upright, lower, each over a small lavender shadow, a jade five, an amber ten and a coral twenty among the cyan ones', commit: '36ec0024',
        view: { level: 'desert', player: CHIME_P, heading: CHIME_H, eye: chimeEye(4.6, 3.3, 0.9), target: CHIME_TGT(7.5, -0.6), fov: 50, save: SAVE_ON, wait: 2500, setup: CHIME_SAND(CHIME_FIELD_DROPS) } },
      { name: 'chimes-look-close', caption: 'Three ones close up: before, broad leaning six-sided shards with chisel ends, high over a brown smudge; after, the reference’s long blunt crystal, broad uneven facets, a flat little cap, a blunt point, the lavender seam and the warm heart, upright and lower over a small lavender shadow', commit: '36ec0024',
        view: { level: 'desert', player: chimeAway, heading: CHIME_H, save: SAVE_ON, wait: 2500, setup: CHIME_SAND([[...chimeAt(4, 0), 3]], CHIME_ROW(4.2, -0.32, 1.25, 0.14)) } },
      { name: 'chimes-look-pull', caption: 'The nearest drawn in (held mid-flight): before, it shoots straight in, spinning fast; after, it drifts in on a curve, glowing, a trail of little lights behind it', commit: '36ec0024',
        view: { level: 'desert', player: CHIME_P, heading: CHIME_H, eye: chimeEye(2.6, 1.9, 1.4), target: CHIME_TGT(1.6, 0.5), fov: 50, save: SAVE_ON, wait: 300,
          setup: CHIME_SAND([[...chimeAt(4.5, 1.5), 1], [...chimeAt(5.5, -1), 1]], `await wait(2500); { const p = chimes.list[0], [x, z] = ${JSON.stringify(chimeAt(1.3, 1.0))}; p.to.set(x, physics.groundAt(x, 60, z, 120), z); }
            await wait(300); who = player.pos; const t0 = performance.now();
            while (!chimes.list.some((q) => q.phase === 'pull' && q.pos.distanceTo(q.to.clone().setY(q.to.y + q.lift)) > 0.4) && performance.now() - t0 < 3000) await wait(2);
            frozen = true;`) } },
      { name: 'chimes-look-reference', only: 'after', caption: 'The author’s pick (left, references/Core Objects/Currency/Floating Chime/field/sheet-1.jpg) beside the game after the change (right), from behind the traveller at play distance: the same upright crystals over small lavender shadows, a few of other worths among them, at the smaller size the author asked for (the picture draws them about as long as a leg)', from: 'the reference picture and the after picture of chimes-look-field, side by side (ImageMagick), 9 October' },
    ], numbers: [
      { title: 'Draw calls a field of chimes adds to a frame (thirty on the desert’s sand)', unit: 'draws', better: 'lower', device: 'MacBook (Apple GPU), headless Chrome, High, 1280 × 720 (each chime mesh counted as it is drawn, every pass)',
        rows: [{ where: 'the G-buffer pass (instanced)', before: 4, after: 3 }, { where: 'the shadow passes', before: 0, after: 0 }],
        source: 'before: the ones, the fives’ clusters, the glints and the shade (28 ones and 2 fives); after: every worth in one mesh, the glints (and the trails), the shade (28 ones, a jade, an amber)' },
      { title: 'Thirty chimes in view: the frame with them and without them (renderFrame timed, synced by a readPixels, median of 8 × 11 × 24 frames)', unit: 'ms added', better: 'lower', device: 'MacBook (Apple GPU), headless Chrome, High, 1280 × 720, a shared machine',
        rows: [{ where: 'desert’s sand by the ship, play distance', before: 0.31, after: -0.2 }],
        source: 'both within the run-to-run noise (about ±0.5 ms here): 56 triangles a crystal instead of 28, about 1,700 for the thirty, and one draw fewer' },
    ], see: 'Cut down a few foes on the desert’s sand and walk toward their chimes: they float upright over small lavender shadows; come within a couple of steps and the nearest curves in to you, glowing, with a trail of light.' },
    { match: 'Chimes now come in six worths', shots: [
      { name: 'chimes-tiers', only: 'after', caption: 'The six worths side by side on the sand: cyan 1, jade 5, amber 10, coral 20, violet 50 and pearl 100, each the same crystal, larger and brighter the more it is worth', from: FROM_CHIME_LOOK,
        view: { level: 'desert', player: chimeAway, heading: CHIME_H, save: SAVE_ON, wait: 2500, setup: CHIME_SAND([1, 5, 10, 20, 50, 100].map((n) => [...chimeAt(4, 0), n]), CHIME_ROW(4.2, -0.36, 2.3, 0.3)) }, commit: '36ec0024' },
    ], see: 'In the Arena, call a guardian into the ring and calm it: its purse falls as two coral twenties. A foe that leaves eight chimes drops a jade five and three cyan ones; pick up a big one and it rings with more notes.' },
  ],
  '1.10': [
    // the controller's quick buttons, rearranged (docs/systems/controls.md, "Why each is where it is")
    // the enemy roster (docs/systems/changelog.md, "Enemies"): the game's body alone, large, before and after from the
    // same camera (scripts/changelog-shots.mjs view.foe: the creatures gallery), its design sheet beside the pair
    { match: 'Five more foes of the new roster', see: 'In Vael II, walk past a lantern jelly drifting over the cliffs without fighting anything: it lets you be. Start a fight with a cliff crab nearby and the jelly comes over to ward it. In the Buried Machine, a ring centipede lies coiled on its rock until you come within a few metres.' },
    { match: 'The mound worm swims under the sand', shots: [
      { name: 'roster2-worm', caption: 'Before: the dune ray, standing in for it. After: the mound worm up out of its hole, a stack of banded rings with a tall ivory fin down its back, rearing to spit', commit: '5e506359', before: '1c129458^',
        view: { foe: { id: 'worm@desert', pose: 'spit', at: 0.35, yaw: 0.6, pitch: 0.1 }, before: { foe: { id: 'ray', yaw: 0.6, pitch: 0.25, pose: 'walk' } } }, reference: REF('worm', 1, 'the dune worm (the Desert)') },
      { name: 'roster2-skins-worm', only: 'after', caption: 'The mound worm under the sand in its three worlds: the dune worm, the drill grub, the glass worm; the mound and the humps of its wake follow the fin’s own path', from: 'headless Chrome, the creatures gallery, each skin walking (node scripts/enemy-roster/skins.mjs)' },
    ] },
    { match: 'The sky ray glides overhead', shots: [
      { name: 'roster2-ray', caption: 'Before: the winged blot, the air foe. After: the sky ray (Vael’s storm ray), its broad red wings rimmed in pale blue, its jointed whip tail', commit: '5e506359', before: '1c129458^',
        view: { foe: { id: 'ray@arzach', pose: 'walk', yaw: 0.5, pitch: 0.45 }, before: { foe: { id: 'flyer', pose: 'walk', yaw: 0.5, pitch: 0.45 } } }, reference: REF('ray', 1, 'the storm ray (Vael)') },
      { name: 'roster2-skins-ray', only: 'after', caption: 'The sky ray in its worlds: the storm ray, the cloud ray trailing mist, the scrap ray, the glass manta, the porcelain ray with ribbon fins, the abyss ray', from: 'headless Chrome, the creatures gallery, each skin flying' },
    ] },
    { match: 'The signal moth flies in threes', shots: [
      { name: 'roster2-moth', caption: 'Before: the sign moth of neon tube. After: the signal moth (the Deep Wood’s lamp moth), a ribbed paper lantern with a hooded face, kite wings on rods with red eye-spots, six hooked legs', commit: '5e506359', before: '1c129458^',
        view: { foe: { id: 'moth@perdide2', pose: 'walk', yaw: 0.55, pitch: 0.1 }, before: { foe: { id: 'moth', pose: 'walk', yaw: 0.55, pitch: 0.1 } } }, reference: REF('moth', 1, 'the lamp moth (the Deep Wood)') },
      { name: 'roster2-moth-flash', only: 'after', caption: 'The signal moth winding up its flash: both wings snapped open toward you, the eye-spots burning white', from: 'headless Chrome, the creatures gallery, its flash at 90 % of the wind-up, seen from in front' },
      { name: 'roster2-skins-moth', only: 'after', caption: 'The signal moth in its worlds: the lamp moth, the glass wasp, the neon sign moth, the Antennas’ moth with dish antennae, the space moth', from: 'headless Chrome, the creatures gallery, each skin flying' },
    ] },
    { match: 'The ring centipede: a long tube', shots: [
      { name: 'roster2-centipede', only: 'after', caption: 'The ring centipede (the Buried Machine’s drill-head): grey plates with orange bands, crab-claw jaws round a drill, its legs stepping in a ripple down the body', commit: '5e506359',
        view: { foe: { id: 'centipede@buried', pose: 'walk', yaw: 0.9, pitch: 0.3 } }, reference: REF('centipede', 1, 'the drill-head centipede (the Buried Machine)') },
      { name: 'roster2-skins-centipede', only: 'after', caption: 'The ring centipede in its worlds: drill-head, pearl, orbital, crescent, drain, wire-wound', from: 'headless Chrome, the creatures gallery, each skin walking' },
    ] },
    { match: 'The lantern jelly drifts high', shots: [
      { name: 'roster2-jelly', only: 'after', caption: 'The lantern jelly (Vael II’s cloud jelly): a broad puffy bell, three paper lanterns, long pale threads', commit: '5e506359',
        view: { foe: { id: 'jelly@arzach2', pose: 'walk', yaw: 0.5, pitch: 0.05 } }, reference: REF('jelly', 1, 'the cloud jelly (Vael II)') },
      { name: 'roster2-skins-jelly', only: 'after', caption: 'The lantern jelly in its worlds: the cloud jelly, the lamp jelly, the halo jelly, the porcelain jelly, the sun jelly', from: 'headless Chrome, the creatures gallery, each skin drifting' },
    ] },
    // the roster painted as on its sheets (src/foe-surface.js): each archetype before and after its surface, the sheet beside it
    { match: 'The foes of the new roster are painted', shots: [
      { name: 'surf-crab', title: 'Cliff crab', caption: 'Vael II’s cliff crab: lichen stars and specks painted on its slate dome, specks on its ivory legs and claws', ...SURF, view: { foe: { id: 'crab@arzach2', zoom: 0.58, ...{ yaw: 0.75, pitch: 0.25 } } }, reference: REF('crab', 1, 'the cliff crab (Vael II)') },
      { name: 'surf-crab-alt', title: 'Anchor crab', caption: 'The Salt Harbour’s anchor crab: cream barnacle rosettes and ochre stains over its turquoise shell (five raised crusts of thirteen left)', ...SURF, view: { foe: { id: 'crab@saltharbour', zoom: 0.58, ...{ yaw: 0.75, pitch: 0.25 } } }, reference: REF('crab', 2, 'the anchor crab (the Salt Harbour)') },
      { name: 'surf-lizard', title: 'Pipe lizard', caption: 'The City-Shaft’s pipe lizard: mottled bands and fine scales over pale belly plates', ...SURF, view: { foe: { id: 'lizard@incal', zoom: 0.58, ...{ yaw: 1.05, pitch: 0.3 } } }, reference: REF('lizard', 1, 'the pipe lizard (the City-Shaft)') },
      { name: 'surf-lizard-alt', title: 'Coin lizard', caption: 'The Signal Market’s coin lizard: amber rosettes on its teal scales', ...SURF, view: { foe: { id: 'lizard@bazaar', zoom: 0.58, ...{ yaw: 1.05, pitch: 0.3 } } }, reference: REF('lizard', 2, 'the coin lizard (the Signal Market)') },
      { name: 'surf-hound', title: 'Halo hound', caption: 'The Garden of Spheres’ halo hound: gold glints scattered through its ink and on its antlers', ...SURF, view: { foe: { id: 'hound@spheres', zoom: 0.58, ...{ yaw: 1.0, pitch: 0.12 } } }, reference: REF('hound', 1, 'the halo hound (the Garden of Spheres)') },
      { name: 'surf-tripod', title: 'Inspection tripod', caption: 'The City-Shaft’s inspection tripod: pink rust streaks down the ivory boiler, rust on its legs, a shine on the enamel', ...SURF, view: { foe: { id: 'tripod@incal', zoom: 0.58, ...{ yaw: 0.7, pitch: 0.1 } } }, reference: REF('tripod', 1, 'the inspection tripod (the City-Shaft)') },
      { name: 'surf-tripod-alt', title: 'Diving bell', caption: 'The Underwater City’s diving bell: mottled coral copper with rust and verdigris', ...SURF, view: { foe: { id: 'tripod@underwater', zoom: 0.58, ...{ yaw: 0.7, pitch: 0.1 } } }, reference: REF('tripod', 2, 'the diving bell (the Underwater City)') },
      { name: 'surf-blot', title: 'Ink blot', caption: 'The Desert’s ink blot: a crisp wet highlight off its smooth form and violet light moving in the ink', ...SURF, view: { foe: { id: 'blot@desert', zoom: 0.58, ...{ yaw: 0.6, pitch: 0.15 } } }, reference: REF('blot', 1, 'the sand-edged blot (the Desert)') },
      { name: 'surf-worm', title: 'Drill grub', caption: 'The Buried Machine’s drill grub: slate-violet rings mottled with ash, rust flecks', ...SURF, view: { foe: { id: 'worm@buried', zoom: 0.58, ...{ yaw: 0.6, pitch: 0.1, pose: 'spit', at: 0.35 } } }, reference: REF('worm', 2, 'the drill grub (the Buried Machine)') },
      { name: 'surf-ray', title: 'Storm ray', caption: 'Vael’s storm ray: a fine net of veins over its red wings, darker blooms', ...SURF, view: { foe: { id: 'ray@arzach', zoom: 0.58, ...{ yaw: 0.5, pitch: 0.6, pose: 'walk' } } }, reference: REF('ray', 1, 'the storm ray (Vael)') },
      { name: 'surf-moth', title: 'Lamp moth', caption: 'The Deep Wood’s lamp moth: its paper lantern ribbed and glowing brighter at its heart, veins across its wings', ...SURF, view: { foe: { id: 'moth@perdide2', zoom: 0.58, ...{ yaw: 0.55, pitch: 0.1, pose: 'walk' } } }, reference: REF('moth', 1, 'the lamp moth (the Deep Wood)') },
      { name: 'surf-centipede', title: 'Ring centipede', caption: 'The Buried Machine’s ring centipede: pitted, rust-flecked plates with a dull shine', ...SURF, view: { foe: { id: 'centipede@buried', zoom: 0.58, ...{ yaw: 0.9, pitch: 0.3, pose: 'walk' } } }, reference: REF('centipede', 1, 'the drill-head centipede (the Buried Machine)') },
      { name: 'surf-jelly', title: 'Porcelain jelly', caption: 'The Underwater City’s porcelain jelly: cobalt bands and medallions on white glaze, coral-red threads, yellow glass lanterns in brass nets', ...SURF, view: { foe: { id: 'jelly@underwater', zoom: 0.58, ...{ yaw: 0.5, pitch: 0.05, pose: 'walk' } } }, reference: REF('jelly', 2, 'the porcelain jelly (the Underwater City)') },
    ], numbers: [
      { title: 'A pack of twelve foes in the Arena, drawn', unit: '', better: 'lower', device: 'Mac (M4 Pro), headless Chrome on the GPU, 1280 × 720, the pack held still in view; medians of three runs each (scripts/enemy-roster/bench.mjs)', rows: [
        { where: 'draw calls, Steam Deck preset', before: 3655, after: 3507 },
        { where: 'GPU ms a frame, High', before: 7.93, after: 6.75 },
        { where: 'GPU ms a frame, Steam Deck preset', before: 4.71, after: 4.21 },
        { where: 'CPU ms a frame, High', before: 8.4, after: 8.1 },
      ], source: 'scripts/enemy-roster/bench.mjs, before 3ea3e8f7 and after the surfaces; GPU times vary ±2 ms run to run on a shared machine: no cost measurable', note: '148 draws fewer: the cliff crab’s 26 lichen stars and 48 of the anchor crab’s barnacles, each drawn in the view and the shadow' },
    ] },
    // the first five redrawn to their sheets: each its main skin and its alternate, before the art pass and after it
    { match: 'The shellback crab is redrawn', shots: [
      { name: 'art-crab', title: 'Vael II', caption: 'Vael II’s cliff crab, three-quarter, before and after the art pass', ...ART, view: { foe: { id: 'crab@arzach2', yaw: 0.75, pitch: 0.16 } }, reference: REF('crab', 1, 'the cliff crab (Vael II)') },
      { name: 'art-crab-alt', title: 'Salt Harbour', caption: 'The Salt Harbour’s anchor crab, three-quarter, before and after', ...ART, view: { foe: { id: 'crab@saltharbour', yaw: 0.75, pitch: 0.16 } }, reference: REF('crab', 2, 'the anchor crab (the Salt Harbour)') },
    ] },
    { match: 'The horn lizard now hugs the ground', shots: [
      { name: 'art-lizard', title: 'City-Shaft', caption: 'The City-Shaft’s pipe lizard from its side, before and after the art pass', ...ART, view: { foe: { id: 'lizard@incal', yaw: 1.05, pitch: 0.22 } }, reference: REF('lizard', 1, 'the pipe lizard (the City-Shaft)') },
      { name: 'art-lizard-alt', title: 'Signal Market', caption: 'The Signal Market’s coin lizard, before and after', ...ART, view: { foe: { id: 'lizard@bazaar', yaw: 1.05, pitch: 0.22 } }, reference: REF('lizard', 2, 'the coin lizard (the Signal Market)') },
    ] },
    { match: 'The antler hound stands taller', shots: [
      { name: 'art-hound', title: 'Garden of Spheres', caption: 'The Garden of Spheres’ halo hound from its side, before and after the art pass', ...ART, view: { foe: { id: 'hound@spheres', yaw: 1.15, pitch: 0.1 } }, reference: REF('hound', 1, 'the halo hound (the Garden of Spheres)') },
      { name: 'art-hound-alt', title: 'White Mangrove', caption: 'The White Mangrove’s driftwood hound, before and after', ...ART, view: { foe: { id: 'hound@mangrove', yaw: 1.15, pitch: 0.1 } }, reference: REF('hound', 2, 'the driftwood hound (the White Mangrove)') },
    ] },
    { match: 'The lamp tripod stands on three long', shots: [
      { name: 'art-tripod', title: 'City-Shaft', caption: 'The City-Shaft’s inspection tripod, three-quarter, before and after the art pass', ...ART, view: { foe: { id: 'tripod@incal', yaw: 0.7, pitch: 0.08 } }, reference: REF('tripod', 1, 'the inspection tripod (the City-Shaft)') },
      { name: 'art-tripod-alt', title: 'Underwater City', caption: 'The Underwater City’s diving bell, before and after', ...ART, view: { foe: { id: 'tripod@underwater', yaw: 0.7, pitch: 0.08 } }, reference: REF('tripod', 2, 'the diving bell (the Underwater City)') },
    ] },
    { match: 'The ink blot is a glossy drop now', shots: [
      { name: 'art-blot', title: 'Desert', caption: 'The Desert’s sand-edged blot, three-quarter, before and after the art pass', ...ART, view: { foe: { id: 'blot@desert', yaw: 0.6, pitch: 0.15 } }, reference: REF('blot', 1, 'the sand-edged blot (the Desert)') },
      { name: 'art-blot-alt', title: 'Sealed Hangar', caption: 'The Sealed Hangar’s oil-edged blot, gunmetal and rust, before and after', ...ART, view: { foe: { id: 'blot@garage', yaw: 0.6, pitch: 0.15 } }, reference: REF('blot', 2, 'the oil-edged blot (the Sealed Hangar)') },
    ] },
    // the worlds, reworked from the level design audit (docs/audits/level-design-v1.9.md): the desert

  ],
  '1.9': [
    { match: 'An 8BitDo SN30 Pro (and the other 8BitDo pads', see: 'Connect an 8BitDo SN30 Pro to a computer (Bluetooth, its D-input mode) and open the game: the title screen\'s prompts read B at the bottom and A on the right, as printed on the pad, and A (the right button) confirms.' },
    // the chimes float
    { match: 'Chimes float now: every crystal hovers well clear of the ground', shots: [
      { name: 'chimes-float-close', caption: 'Three ones and two fives in the Arena, close up (the same scatter in both): before, their lowest points 15–22 cm off the sand and no shadow, so they seem to lie on it; after, 40 cm of air under each, a soft patch of shade on the sand below', commit: '47d28ed2',
        view: { level: 'arena', player: [-14, 0, -14], eye: [-0.8, 1.0, 2.6], target: [0, 0.35, 0], fov: 55, save: SAVE_ON, wait: 2500, setup: CHIME_FLOAT([[0, 0, 3], [0, 0, 10]]) } },
      { name: 'chimes-float-play', caption: 'At play distance, behind the traveller: before, crystals sitting on the sand; after, floating over their shade', commit: '47d28ed2',
        view: { level: 'arena', player: [0, 0, 6.5], heading: Math.PI, eye: [-1, 2.8, 6], target: [0, 0.35, 0], fov: 55, save: SAVE_ON, wait: 2500, setup: CHIME_FLOAT([[0, 0, 4], [0, 0, 3], [0, 0, 10]]) } },
      { name: 'chimes-float-five', caption: 'A guardian’s purse, eight fives: before, the clusters’ small shards almost touching the sand; after, each well clear of it, its shade a little wider than a one’s', commit: '47d28ed2',
        view: { level: 'arena', player: [-14, 0, -14], eye: [-1.0, 1.1, 3.4], target: [0, 0.35, 0], fov: 55, save: SAVE_ON, wait: 2500, setup: CHIME_FLOAT([[0, 0, 40]]) } },
    ] },
    // the temples, reworked from the temple design audit (docs/audits/temple-design-v1.8.md)
    { match: 'The Founders’ Belfry is rebuilt round one idea', shots: [
      { name: 'belfry-hub', caption: 'The Hall of Stones from its south end: before, the two balls in their grooves in the hall itself, beside the door; after, two archways into the stone stores and a line inlaid from each to the door', commit: 'b3647461',
        view: { level: 'arzach2', player: [80, 1600, 158], eye: [80, 1610, 163], target: [80, 1600, 180], fov: 70 } },
      { name: 'belfry-store', caption: 'Through the hall’s west wall: before, plain wall; after, the archway into the west store, its ball and plate inside', commit: 'b3647461',
        view: { level: 'arzach2', player: [82, 1600, 173], eye: [76, 1603.5, 173], target: [60, 1601, 173], fov: 70 } },
      { name: 'belfry-stair-eye', caption: 'From the Stone Stair’s ledge: after, the high door shut, its eye on the landing’s face below it', commit: 'b3647461',
        view: { level: 'arzach2', player: [80, 1608, 203.5], eye: [80, 1609.7, 204.9], target: [82.6, 1612, 211.8], fov: 70 } },
    ] },
    { match: 'In the Founders’ Belfry the door out of the Bell Chamber', shots: [
      { name: 'belfry-echoes', caption: 'The Hall of Echoes from its near edge, the stones hanging: after, the ball waiting in its groove that runs over the bridge to the far door’s plate', commit: 'b3647461',
        view: { level: 'arzach2', player: [78, 1616, 238.5], eye: [78, 1619.5, 240.7], target: [81, 1616, 260.2], fov: 70 } },
    ], see: 'In the Founders’ Belfry, take the bell from the chest and ring by the door: it sinks, then rises again after about eight seconds. In the Hall of Echoes ring at the edge: the stones come down for ten seconds. Push the ball first and it stops at the edge; ring, then push it at once, and it rolls across onto the far plate and the bridge stays.' },
    { match: 'The Hush-House’s first crystal now stands by the door', shots: [
      { name: 'hush-threshold', caption: 'The Hush-House’s Threshold, looking toward the Choir: after, the smallest crystal on its ring by the way in', commit: '8fd3e8c9',
        view: { level: 'perdide', player: [-105, 1700, 301], eye: [-103, 1703, 301.5], target: [-96, 1701, 308], fov: 70 } },
      { name: 'hush-well', caption: 'The Bog Well from its near landing: after, the eye on the root-wall’s face and the shut door at its top', commit: '8fd3e8c9',
        view: { level: 'perdide', player: [-100, 1700, 346.5], eye: [-100, 1702.5, 348.2], target: [-102.6, 1704.5, 360], fov: 70 } },
    ] },
    { match: 'In the Hush-House’s Pendulum Gallery', shots: [
      { name: 'hush-gallery', caption: 'The Pendulum Gallery from its near ledge: before, three alike pendulums and a gate of jaws at the end; after, three crystals of three sizes and a door with three lamps', commit: '8fd3e8c9',
        view: { level: 'perdide', player: [-100, 1709, 390], eye: [-100, 1712, 391.7], target: [-100, 1714, 410], fov: 70 } },
    ], see: 'In the Hush-House, take the stilling mode and still the three pendulums as you cross: only the smallest one’s note takes, the others ring flat. From the far side still the middle-sized one, then the biggest: the door’s three lamps wake and it opens.' },
    { match: 'The Lamp-House’s Hall of Dark Pools has two pools', shots: [
      { name: 'lamp-loft', caption: 'The Hall of Dark Pools from its east side: before, three pools on the floor; after, two on the floor and the loft of roots against the west wall, its pool hidden behind its edge', commit: 'bfecbed3',
        view: { level: 'perdide2', player: [-136, 1800, -268], eye: [-136, 1804, -270], target: [-149, 1806, -280], fov: 70 } },
    ] },
    { match: 'In the Lamp-House’s Dark Gallery the far door’s lamp', shots: [
      { name: 'lamp-niche', caption: 'The Dark Gallery’s far ledge: after, the pool-orb in its groove and the niche in the west wall with its dark lamp', commit: 'bfecbed3',
        view: { level: 'perdide2', player: [-139, 1809, -185], eye: [-138, 1811.5, -183], target: [-153, 1809.5, -179.3], fov: 70 } },
    ], see: 'In the Lamp-House, cross the Dark Gallery with the lantern. Push the orb straight into the niche: it settles dark and is tipped back out. Stand still beside it until it glows, then push it in: the niche’s lamp catches and the far door opens.' },
  ],
  '1.8': [
    { match: 'The hundred look-alike world enemies are gone', shots: [
      { name: 'roster-crab', caption: 'Before: the salt crab. After: the shellback crab (its Vael II skin, the cliff crab) on six jointed legs, its pincers raised', from: 'headless Chrome against a dev server, the creatures gallery (enemies.html), each walking, before (the old foe) and after' },
      { name: 'roster-tripod', caption: 'Before: a possessed inspection tripod, one of the look-alike machines with a blob of smoke on its shoulder. After: the lamp tripod, its searchlight sweeping, the face at its porthole', from: 'headless Chrome against a dev server, the creatures gallery (enemies.html), each walking, before (the old foe) and after' },
    ] },
    { match: 'The shellback crab: a low wide shell', shots: [
      { name: 'roster-skins-crab', only: 'after', caption: 'The shellback crab in its seven worlds: the cliff crab, the oil beetle, the stall crab under its awning, the anchor crab, the glass crab, the coral crab, the copper beetle', from: 'headless Chrome, the creatures gallery, each skin walking (node scripts/enemy-roster/skins.mjs)' },
    ] },
    { match: 'The horn lizard: long and low', shots: [
      { name: 'roster-lizard', caption: 'Before: the coin lizard, one of the world enemies. After: the horn lizard in the Signal Market’s skin, its trumpet hung with coins, its tail curled up on a chain', from: 'headless Chrome against a dev server, the creatures gallery (enemies.html), each walking, before (the old foe) and after' },
      { name: 'roster-skins-lizard', only: 'after', caption: 'The horn lizard in its worlds: pipe, ash, coin, night, ember, and the Atelier’s ink lizard (the Arena only)', from: 'headless Chrome, the creatures gallery, each skin walking' },
    ] },
    { match: 'The antler hound: a lean shadow', shots: [
      { name: 'roster-hound', caption: 'Before: the shadow hound. After: the antler hound (the Eclipse’s night hound), its crown of antlers, smoke trailing off its back', from: 'headless Chrome against a dev server, the creatures gallery (enemies.html), each walking, before (the old foe) and after' },
      { name: 'roster-skins-hound', only: 'after', caption: 'The antler hound in its worlds: the night hound’s crescent, the driftwood hound’s bleached antlers, the halo hound with a ring caught in them, the alley hound’s tangle of wire', from: 'headless Chrome, the creatures gallery, each skin walking' },
    ] },
    { match: 'The lamp tripod: a tall boiler', shots: [
      { name: 'roster-skins-tripod', only: 'after', caption: 'The lamp tripod in its worlds: the City-Shaft’s inspection tripod, the mining tripod, the diving bell, the gyroscope tripod, the Desert’s cistern pump', from: 'headless Chrome, the creatures gallery, each skin walking' },
    ] },
    { match: 'The ink blot hops now', shots: [
      { name: 'roster-blot', caption: 'Before and after: the ink blot, squat now, hopping, a rim of the ground’s colour at its foot (the Desert’s sand)', from: 'headless Chrome against a dev server, the creatures gallery (enemies.html), each walking, before (the old foe) and after' },
      { name: 'roster-skins-blot', only: 'after', caption: 'The ink blot in eight worlds, its edge each world’s ground', from: 'headless Chrome, the creatures gallery, each skin walking' },
    ] },
    { match: 'Out in the worlds, creatures keep to themselves', see: 'In the Signal Market or the City-Shaft, walk past a pair of horn lizards basking on their stones without going near: they let you be. Step within a few metres, or cut one, and both come for you. A crab in Vael II backs away as you come near.' },
    { match: 'The traveller’s ship is the family’s angular ship now', shots: [
      { name: 'ship-ref34', caption: 'From the front left, as in the selected reference: the round ship on its four legs before; after, the angular ship, its wedge nose and windshield, the coral stripe, the lavender panels, the pods and the stair-ramp', from: 'headless Chrome against a dev server (the Glass Dunes, High, 10:00), the same view from the ship’s site before and after' },
      { name: 'ship-side', caption: 'The port side, square on: the hatch, the slot window, the scorch the light left', from: 'headless Chrome against a dev server (the Glass Dunes, High, 10:00), the same view from the ship’s site before and after' },
      { name: 'ship-rear', caption: 'From behind and above: the stern, the two pods raked up off it, the roof', from: 'headless Chrome against a dev server (the Glass Dunes, High, 10:00), the same view from the ship’s site before and after' },
    ] },
    { match: 'Inside, real rooms you walk through', shots: [
      { name: 'ship-room', caption: 'In from the hatch: the round deck before; after, the main room, the holo table, the galley under its window, the cockpit through its frame', from: "headless Chrome against a dev server (the Glass Dunes, High), from the hatch's inside point toward the holo table, before and after" },
      { name: 'ship-cockpit', caption: 'Behind the pilot at the dash: the projector, the voicemail button, the round screen, the windshield', from: 'headless Chrome against a dev server, from behind the cockpit point toward the projector, before and after' },
      { name: 'ship-bunk', caption: 'From beside the bed: the bunk corner before; after, the sleeping cabin, the bed in its alcove', from: 'headless Chrome against a dev server, from the bunk point toward the pillow, before and after' },
    ] },
    { match: 'The ship’s scenes are filmed for the new ship', see: 'Start a new game: you wake in the cabin and walk through the main room to the dash; the light passes the cockpit on the left and the ship comes down nose first and slews round in the sand. Then fly anywhere from the holo table and watch it land on its jets and fold the stair-ramp out.' },
    { match: 'The child’s drawing on the dash shows the striped ship', numbers: [
      { title: 'The parked ship: meshes drawn (draw calls), outside and with the rooms shown', unit: 'draws', better: 'lower', device: 'the model as built (buildShipModel, node)',
        rows: [{ where: 'outside, near', before: 23, after: 29 }, { where: 'outside, past 130 m', before: 23, after: 22 }, { where: 'the rooms shown (within 48 m)', before: 61, after: 62 }],
        source: 'meshes of a parked ship with its ramp, the rooms hidden and shown as Ship.update does (docs/systems/ship.md, "Performance")' },
      { title: 'The parked ship: triangles', unit: 'triangles', better: 'lower', device: 'the model as built (buildShipModel, node)',
        rows: [{ where: 'outside', before: 32744, after: 7598 }, { where: 'the rooms shown', before: 59916, after: 15822 }],
        source: 'the same count' },
    ] },
    { match: 'Chimes are as big again as the brass coins were', shots: [
      { name: 'chimes-shader-arena-play', caption: 'Thirty chimes (28 ones, two fives) lying in the Arena, seen from a play distance, about five metres: before, 3.4 cm splinters, dots of ink with a spark; after, crystals as tall as the coins were, cyan with bright edges and a lavender seam, each one readable', from: FROM_CHIME_SHADER },
      { name: 'chimes-shader-arena-close', caption: 'Seven of them close up in the Arena: before, thumb-sized splinters; after, the facets lit by the sun, the edges catching the light, the paler heart, the faint inner lines and the rainbow at a grazing rim; the outline drawn clean, no ink between the facets', from: FROM_CHIME_SHADER },
      { name: 'chimes-shader-arena-five', caption: 'A five close up: before, a 5 cm cluster; after, a cluster as big as the coin’s five, its two small shards at its foot', from: FROM_CHIME_SHADER },
      { name: 'chimes-shader-desert-play', caption: 'The same thirty on the desert’s sand near the ship, at play distance: before, specks; after, crystals', from: FROM_CHIME_SHADER },
      { name: 'chimes-shader-desert-close', caption: 'And close up on the sand: before, splinters a few pixels long; after, the crystals', from: FROM_CHIME_SHADER },
    ], numbers: [
      { title: 'Thirty chimes in view: the frame with them and without them (renderFrame timed, synced by a readPixels, median of 11 × 24 frames, render scale 2)', unit: 'ms added', better: 'lower', device: 'MacBook (Apple GPU), headless Chrome, High, 1280 × 720',
        rows: [{ where: 'Arena, play distance', before: 0.025, after: 0.033 }, { where: 'Arena, close (2–3 m)', before: 0.025, after: -0.037 }, { where: 'desert by the ship, play distance', before: -0.021, after: 0.013 }],
        source: 'both within the run-to-run noise (±0.05 ms): the shader costs nothing measurable on the Mac' },
      { title: 'Draw calls the thirty chimes add to a frame', unit: 'draws', better: 'lower', device: 'the same runs (renderer.info per pass)',
        rows: [{ where: 'the G-buffer pass (ones, fives, glints: instanced)', before: 3, after: 3 }, { where: 'the two near shadow maps', before: 4, after: 0 }],
        source: 'a crystal gives light rather than blocking it: they are left out of the shadow passes, where, drawn unculled, they were drawn in each' },
    ], see: 'Cut down a foe (in the Arena, call one from the FOES list): its chimes pop out and hover, crystals as big as the old coins, turning slowly; walk round them to see the lines inside shift and a facet flash as it catches the sun. At night or indoors they keep their colour and glow softly.' },
  ],
  '1.7': [
    { match: 'Your father’s recordings now use', see: 'Open Debug → Cinematics → Recording 1 · Home to see the new father in the ship’s projector.' },
    { match: 'Out of a fight the fluid sword now rides on your back', shots: [
      { name: 'sword-back', caption: 'At rest, from behind: before, nothing on his back (the hilt was shrunk into the glove); after, the hilt in its leather holder behind the right shoulder, beside the tank, the pommel over the shoulder', from: 'the character studio (studio.html?backpack=true&bg=flat&view=bust&pitch=0.1&yaw=3.0&paused=true), headless Chrome against this branch’s own dev server, 900 × 700 (9 October)' },
      { name: 'sword-front', caption: 'From the front: after, the brass pommel just over his right shoulder', from: 'the character studio (the same, yaw=0.45, pitch=0.08), headless Chrome against this branch’s own dev server, 900 × 700 (9 October)' },
      { name: 'sword-draw', only: 'after', caption: 'The draw, about half-way: the right hand back over the shoulder, taking the hilt from its holder', from: 'the character studio (view=arms&yaw=-0.6&draw=0.45: the new Draw from the back slider), headless Chrome against this branch’s own dev server, 900 × 700 (9 October)' },
      { name: 'sword-title', only: 'after', caption: 'The title screen: the hilt on his back as he stands on the bridge', from: 'the title screen, headless Chrome against this branch’s own dev server, 900 × 700 (9 October)' },
    ], see: 'In the Arena (?level=arena) stand still: the hilt is on your back. Press RB / R1 or hold LB / L1 and watch the right hand reach back for it; leave the fight a few seconds and it goes back. In the studio (studio.html?backpack=true) slide “Draw from the back”.' },
    { match: 'The fluid blade is the chosen sword now', shots: [
      { name: 'sword-hand', caption: 'In hand (the studio, Blade and shield): the slim glowing blade and plain hilt before; after, the broad turquoise blade out of a brass cup, cream currents up it', from: 'headless Chrome against a dev server (studio.html?backpack=true&sword=true&view=arms), the same pose before and after' },
      { name: 'sword-hilt', caption: 'The hilt close up: before a bar guard and a ball pommel; after the brass collar opening into an oval cup, the wrapped grip and the pommel with its curled tail', from: 'headless Chrome against a dev server (studio.html, view Hands), the same pose before and after' },
      { name: 'sword-swing', caption: 'The first swing at its cut, in the Arena: before a string of sparks; after ribbons of the fluid trailing off the edge and drops flying', from: 'headless Chrome against a dev server (the Arena, High), the swing caught on its first cut frame' },
      { name: 'sword-charged', caption: 'The charged cut let go: a wider, fuller wake and more drops', from: 'headless Chrome against a dev server (the Arena, High), the charge held to full, caught on its cut' },
      { name: 'sword-air', caption: 'The air cut: the fluid thrown down with the blade', from: 'headless Chrome against a dev server (the Arena, High), caught on its cut' },
    ], numbers: [
      { title: 'The sword lit mid-swing: what it draws (every pass), High', unit: 'draws', better: 'lower', device: 'M4 Pro, Chrome (ANGLE Metal), 1280 × 720 at render scale 1.5',
        rows: [{ where: 'The Arena, the first swing', before: 14, after: 13 }],
        source: 'renderFrame() with the sword shown and hidden in turns in one page, medians of 6 (docs/systems/foes.md, "The look")' },
      { title: 'The sword lit mid-swing: triangles (every pass), High', unit: 'triangles', better: 'lower', device: 'M4 Pro, Chrome (ANGLE Metal), 1280 × 720 at render scale 1.5',
        rows: [{ where: 'The Arena, the first swing', before: 456, after: 7572 }],
        source: 'as above (the mesh is 2,500 triangles: blade 792, grip 816, brass 816, the bead 80)' },
      { title: 'The sword’s work a frame, High', unit: 'ms', better: 'lower', device: 'M4 Pro, Chrome (ANGLE Metal), 1280 × 720 at render scale 1.5',
        rows: [{ where: 'Placing it (CPU)', before: 0.001, after: 0.011 }, { where: 'The wake (CPU)', before: 0, after: 0.011 }, { where: 'The frame, swinging in the Arena (median)', before: 16.6, after: 16.7 }],
        source: '300 calls timed in the page; the frame at 60 fps either way (vsync)' },
    ], see: 'Swing the blade (F, RB / R1): watch its edge through a cut, hold the button for a charged cut, cut in the air, after an evade or a perfect parry. Debug → Character studio → Fluid backpack, Blade and shield shows it in hand.' },
    { match: 'Little waves lap at whatever stands in the water', shots: [
      { name: 'water-contact-lorn2', caption: 'Lorn II: a great tree standing in the water, before with no edge where it meets it, after with the band of foam lapping round its foot and the far shore', from: 'headless Chrome against a dev server (captureView), the contact foam off and on in the same page' },
      { name: 'water-contact-viridel', caption: 'Viridel’s lake from above: the near shore before and after (a pale lapping band with an inked ripple off it)', from: 'headless Chrome against a dev server (captureView), the contact foam off and on in the same page' },
      { name: 'water-contact-waterfall', caption: 'The traveller swimming in the waterfall city’s basin: foam and flecks round him after (his stroke differs between the two)', from: 'headless Chrome against a dev server (captureView), the contact foam off and on in the same page' },
    ], numbers: [
      { title: 'Frame time with water in view, High', unit: 'ms', better: 'lower', device: 'M4 Pro, Chrome (ANGLE Metal), 1728 × 1117 at render scale 1.5 (2592 × 1676)',
        rows: [{ where: 'Viridel, the lake', before: 9.92, after: 10.18 }, { where: 'Lorn II, the tree in the water', before: 9.78, after: 10.26 }, { where: 'The waterfall city, the basin', before: 7.51, after: 7.98 }, { where: 'The White Mangrove, the roots', before: 8.74, after: 8.70 }],
        source: 'each renderFrame() of 16 closed by a readPixels, medians of 24, the foam off and on in turns in one page (docs/systems/water.md, "Contact foam")' },
      { title: 'Frame time with water in view, Handheld preset if it were on (it is off there)', unit: 'ms', better: 'lower', device: 'M4 Pro, Chrome (ANGLE Metal), 1280 × 720 at render scale 0.75',
        rows: [{ where: 'Viridel, the lake', before: 2.55, after: 2.60 }, { where: 'Lorn II, the tree in the water', before: 1.60, after: 1.70 }, { where: 'The waterfall city, the basin', before: 1.02, after: 1.06 }, { where: 'The White Mangrove, the roots', before: 1.16, after: 1.25 }],
        source: 'as above' },
    ], see: 'Walk into any water (Lorn, Lorn II, the White Mangrove, Viridel’s lake, the waterfall city’s basin, the desert’s pools) and look where it meets a rock, a wall or your own legs: a pale band of foam breathes against it with small gaps moving along it and broken ripples off it. Graphics: Handheld keeps the plain shore foam.' },
    { match: 'Debug: an Audits page gathers every review', shots: [
      { name: 'audits-page', only: 'after', caption: 'Debug → Audits at the Steam Deck’s size: a card a report, its overall score, the change since the last of its kind and its criteria as small bars', size: [1280, 800], from: 'headless Chrome against a dev server (audits.html)' },
      { name: 'audits-compare', only: 'after', caption: 'Two combat reviews compared: 3.75 → 4.01, each foe’s total before (the dashed ghost) and after', size: [1280, 800], from: 'headless Chrome against a dev server (audits.html#/combat-v1.6/compare)' },
    ], see: 'Title → Debug → Audits. With a controller: the D-pad across the cards, A opens a report, LB / RB its tabs (Scores, Findings, Edits, TODO, Report, Compare), X / Y the report before or after, A on a picture shows it full size, B goes back.' },
    // foes walk on jointed legs (the locomotion kit, src/motion-kit/)
    { match: 'Crabs, the salt crab and the other six-legged creatures', shots: [
      { name: 'walk-crab', caption: 'The salt crab walking, 8 frames over 2 s: before, six stiff stick legs under the shell barely moving; after, knees up and out, three feet down and three swinging', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
      { name: 'walk-skitter', caption: 'The dune skitter walking: before, straight legs swung from the hip on a clock; after, jointed legs in a tripod, feet planted', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
    ], numbers: [{ title: 'Foot slide while on the ground (motion audit, 4 s straight walk)', unit: 'm per m walked', better: 'lower', device: 'node, scripts/motion-audit/run.mjs', rows: [{ where: 'salt crab', before: 1.02, after: 0 }, { where: 'dune skitter', before: 0.42, after: 0 }, { where: 'seashell crawler', before: 0.41, after: 0 }], source: 'docs/systems/procedural-animation.md, “What was built”' }] },
    { match: 'Shadow hounds and the lizards trot', shots: [
      { name: 'walk-hound', caption: 'A shadow hound running: before, four sticks swinging without knees; after, a trot on diagonal pairs, front knees forward, hocks back', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
      { name: 'walk-lizard', caption: 'The coin lizard walking: before, two legs and two dangling arms; after, four jointed legs in a trot', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
    ] },
    { match: 'The makers’ machines and the possessed machines walk', shots: [
      { name: 'walk-machine', caption: 'The makers’ machine walking: before, three rigid legs swinging together; after, piston legs set down one at a time', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
      { name: 'walk-tripod', caption: 'A possessed inspection tripod walking: before, stiff legs on a clock; after, jointed legs in a wave, a piston at each thigh', from: 'scripts/motion-audit/strips.mjs: the enemies viewer (the game’s own models and foe animation, as the Arena draws them), the commit before (a530a46a) and this one, seen three-quarters from above' },
    ] },
    { match: 'Foes step quicker when they run', numbers: [
      { title: 'Two of a kind side by side: how alike their steps are', unit: 'correlation (1 = in step)', better: 'lower', device: 'node, run.mjs --pack', rows: [{ where: 'salt crab', before: 0.97, after: -0.27 }, { where: 'shadow hound', before: 0.96, after: -0.01 }, { where: 'makers’ machine', before: 1, after: -0.28 }], source: 'docs/systems/procedural-animation.md' },
      { title: 'The legs’ cost a frame (10 foes of a kind, near)', unit: 'µs per foe', better: 'lower', device: 'MacBook (M4), node', rows: [{ where: 'salt crab (6 legs)', before: 0, after: 3.1 }, { where: 'shadow hound (4 legs)', before: 0, after: 2.1 }, { where: 'makers’ machine (3 legs)', before: 0, after: 2.3 }], source: 'scripts/motion-audit/cost.mjs', note: 'Before, the rigid legs cost next to nothing (a sine each). About 0.5 µs a leg now; 40 foes cost 0.1 ms a frame here, an estimated 0.5–0.8 ms on a Retroid Pocket.' },
    ], see: 'In the Arena (?level=arena), call a salt crab, shadow hounds or a machine from the FOES list and watch them come at you, then wind up: the feet brace wide and hold still before the blow. Or open the creatures gallery (enemies.html), pick the dune skitter, the coin lizard or a tripod and choose Moving.' },
    // the traveller's fingers
    { match: 'The traveller’s fingers curl gently in toward his palms', shots: [
      { name: 'traveller-fingers-motion', caption: 'Standing, 10 s into the idle (the Motion page), each hand from the front and from its side (the knuckles’ line toward the camera), close: before, the fingers straight, bent back and fanned, crossing at the tips; after, each finger curled a little more than the last toward the palm, by the thigh', size: [1280, 992], from: 'headless Chrome against a dev server, motion.html?mode=solo, stepped 600 frames at 60 Hz, the camera pinned 2.2 m off each hand (fov 6.5°); the before from origin/main as it was (9 October); four views on one sheet' },
      { name: 'traveller-fingers-title', caption: 'The title screen’s traveller (?shot=E3), each hand from the front and from its side: before, the bare left hand’s fingers straight and splayed down his thigh; after, curled in toward the palm (the right hand is in the fluid glove)', size: [1280, 992], from: 'headless Chrome against a dev server, ?shot=E3, the camera pinned 2.2 m off each hand (fov 6.5°); the before from origin/main as it was (9 October); four views on one sheet' },
    ], see: 'Open Debug → Motion and turn the view round to his front (drag), close in: his fingers curl toward his palms by his thighs; walk and run (W A S D, Shift): they open a little as he runs. On the title screen, look at the hand by his side.' },
    // the traveller's kit: no hose
    { match: 'The hose from the backpack’s tank to your glove is gone', shots: [
      { name: 'kit-hose-studio', caption: 'The traveller from behind his right shoulder in the character studio: before, the ribbed hose from the flask’s collar over the shoulder and down the arm into the glove; after, none: the glove’s cuff holds a small lit vial of the tank’s fluid', commit: '84bd9dfc', view: studio('backpack=true&view=arms&yaw=2.5&pitch=0.15') },
      { name: 'kit-hose-glove', caption: 'The glove close up in the studio: before, the hose coming into the brass fitting on the cuff; after, the capped fitting and its vial, lit in the fluid’s tone like the knuckles', commit: '84bd9dfc', view: studio('backpack=true&view=hands&yaw=-2&pitch=0.2') },
      { name: 'kit-hose-play', caption: 'In the desert, the camera close behind the traveller’s right shoulder: before, the hose arcing from the tank over his shoulder to the hand; after, a clean shoulder and arm, the glove’s vial glowing', commit: '84bd9dfc', view: { level: 'desert', save: SAVE_ON, wait: 1500, setup: BEHIND_RIGHT } },
    ], see: 'Find the backpack (or start a new journey and open its box), then turn the camera round the traveller: no hose over his shoulder any more; on the back of his right wrist the glove’s little vial glows in the tank’s colours, dimmer as the tank empties, flashing as you shoot. Also on the title screen, in the character studio (backpack on) and in the Items page’s picture of the tank.' },
    // the chimes become small floating crystals
    { match: 'Chimes are now small floating crystals instead of brass discs', shots: [
      { name: 'chimes-crystal-drop', caption: 'Twelve chimes dropped in the Arena, two seconds after, the camera low and close (the same scatter in both): before, brass discs a hand wide turning on their edges; after, small cyan crystals about 3 cm long, tilted and turning, each with its small spark, a five as a little cluster', commit: 'cdc9eb02', view: { level: 'arena', player: [-14, 0, -14], eye: [-1.9, 0.9, -1.7], target: [0, 0.32, 0], fov: 38, save: SAVE_ON, wait: 2200, setup: CHIME_SEEDED } },
    ], see: 'Cut down any foe: its chimes pop out and hover, small cyan crystals tilted and turning a hand above the ground, a glint catching one now and then; come within a couple of steps and they fly to you. In the Arena, call a shade or a machine from the FOES list for a bigger drop (fives: little clusters).' },
    { match: 'Picking up chimes rings like struck glass', see: 'With the sound on, cut down a foe and walk into its chimes: each rings like a small glass struck, a shimmering ting a step higher for each in a quick run; a five rings twice. The drop scatters with a few glassy tings, and buying at Haddu’s counts them onto the counter the same way before his brass bell.' },
    { match: 'The chimes’ coin beside your hearts', shots: [
      { name: 'chimes-crystal-hud', caption: 'Thirty-seven chimes picked up, at the top left (shown at 2×): before, the pierced brass disc beside the potion; after, the small cyan crystal', commit: 'cdc9eb02', view: { level: 'desert', hud: true, save: SAVE_ON, wait: 1800, clip: [0, 0, 640, 360], setup: `${HEARTS_SETUP(0.5)} window.resources?.addChimes?.(37);` } },
      { name: 'chimes-crystal-shop', caption: 'Haddu’s shop panel: before, brass discs by every price and the wallet; after, the crystal', commit: 'cdc9eb02', view: { level: 'desert', hud: true, save: SAVE_ON, setup: SHOP_OPEN(), wait: 800 } },
      { name: 'chimes-crystal-shopfront', caption: 'Inside Haddu’s shop: before, a pierced brass disc on the back wall; after, a big cyan crystal on its brass plate (the strings by the door, behind the camera, are crystals too)', commit: 'cdc9eb02', view: { level: 'desert', save: SAVE_ON, setup: SHOP_IN(), wait: 800 } },
    ], see: 'Pick up a few chimes: the crystal and the count come up beside the potion. Open the menu (View, or J): the crystal and the count are by the Gear heading. At Haddu’s, by the way up to Qanat’s main gate: every price shows the crystal; ask him “Chimes?” for his new words.' },
    // the family, as their chosen drawings (src/characters/family.js, family-pieces.js; references/Home/characters)
    { match: 'Your family now looks as their chosen drawings do', shots: [
      { name: 'family-home-cast', caption: 'Lou and Aunt Tove standing, from the front: before, a dotted yellow smock with two topknots and a purple cape over blue; after, Lou’s golden tunic with its coral pockets, striped collar, rust trousers and tan boots, her two bunches and the drawing in her hand; Tove’s lavender shawl, apron and dusty-blue tunic', from: 'headless Chrome against a dev server (studio.html, MakeHuman bodies, the home cast), the family’s looks off and on (src/characters/family.js)' },
      { name: 'family-home-walk', caption: 'Both of them walking, from the side', from: 'headless Chrome against a dev server (studio.html, MakeHuman bodies, the home cast), the family’s looks off and on (src/characters/family.js)' },
      { name: 'family-ref-lou', only: 'after', caption: 'Lou beside her chosen drawing: front, side, back, walking and talking', from: 'headless Chrome against a dev server (studio.html, the home cast, MakeHuman bodies), beside references/Home/characters/Lou/reference-3.jpeg' },
      { name: 'family-ref-tove', only: 'after', caption: 'Aunt Tove beside her chosen drawing: front, side, back, walking and talking', from: 'headless Chrome against a dev server (studio.html, the home cast, MakeHuman bodies), beside references/Home/characters/Aunt Tove/reference-3.jpeg' },
    ], see: 'Fly home (or open Debug → Studio, Who: a story person, World: Home): Lou runs down to meet you, Tove sits on the garden bench. Talk to either and open the People page (the menu, People): their portraits show the new looks.' },
    { match: 'Ilen, at the Lantern and later at home', shots: [
      { name: 'family-ref-ilen', only: 'after', caption: 'Ilen beside her chosen drawing: front, side, back, walking and talking', from: 'headless Chrome against a dev server (studio.html, the home cast, MakeHuman bodies), beside references/Home/characters/Ilen/reference-1.jpeg' },
    ], see: 'At the Lantern, walk the sand bar to its foot: Ilen is waiting there in her teal coat; after the last homecoming she is at home with the others.' },
    { match: 'On the recordings your parents are the old couple', shots: [
      { name: 'family-recording', caption: 'Recording 3 on the dash, ten seconds in (the mother has joined): before, a bearded brown-haired father in a red shirt and a dark-haired mother in lilac; after, the grey-haired father in his slate coat and rust vest and the silver-haired mother in her teal scarf', from: 'headless Chrome against a dev server (index.html?cinematicReview=call.3), the old hologram file and the new one' },
      { name: 'family-ref-father', only: 'after', caption: 'The father on the people’s body beside his chosen drawing: front, side, back, walking and talking (the recordings show him as a bust)', from: 'headless Chrome against a dev server (studio.html, the home cast, MakeHuman bodies), beside references/Home/characters/Father/reference-1.jpeg' },
      { name: 'family-ref-mother', only: 'after', caption: 'The mother beside her chosen drawing: front, side, back, walking and talking', from: 'headless Chrome against a dev server (studio.html, the home cast, MakeHuman bodies), beside references/Home/characters/Mother/reference-4.jpeg' },
    ], see: 'At the ship’s console after a world, play a recording (E): your parents rise over the projector. Or Debug → Cinematics → Recordings.' },
    { match: 'Moustache is an old, lean, long-legged wire terrier now', shots: [
      { name: 'family-dog-walk', caption: 'Moustache trotting after someone at a walk, eight frames a tenth of a second apart, from the side: before, a stocky brown dog with stick legs swinging on a clock; after, the lean sandy terrier on jointed legs, the diagonal pairs stepping, each paw held where it landed', from: 'headless Chrome against a dev server (the Lab, a dog made beside the traveller and led along a line; captureView), the old dog and the new' },
      { name: 'family-dog-poses', caption: 'Sitting, sniffing, lying down and wagging from behind: before and after', from: 'headless Chrome against a dev server (the Lab, the same dog held in each state; captureView), the old dog and the new' },
    ], numbers: [
      { title: 'Moustache’s paws while they are on the ground, following a walker (motion audit, 4 s straight)', unit: 'm slid per m walked', better: 'lower', device: 'node, scripts/motion-audit/run.mjs moustache moustache-hurry (before: the old dog through the same walk)',
        rows: [{ where: 'at a walk, 1.6 m/s', before: 0.43, after: 0.01 }, { where: 'hurrying, 4.2 m/s', before: 0.19, after: 0.0 }, { where: 'at half pace, 0.8 m/s', before: 0.35, after: 0.02 }],
        source: 'scripts/motion-audit/walk.mjs dogSubject: the lowest point under each leg, slide while within 3 cm of its lowest; the knees bend 26–31 % of the leg’s length now (before 1–2 cm: stiff sticks)' },
    ], see: 'At home, walk about: Moustache follows a little off your shoulder; stand still and he noses about, then sits and looks up at you, his tail going; pet him (A / ×) and he wags hard; sit at the stone and he lies down beside you.' },
  ],
  '1.6': [
    // the fights: told by the body, not the ground
    { match: 'Foes no longer draw their attacks on the ground', shots: [
      { name: 'tell-drone', caption: 'A rust drone at 85 % of its harpoon’s wind-up: before, a lane filling on the floor; after, the gun tipped at you, the drone rocked back and a spark burning on the harpoon’s tip', ...TELLS, view: TELL_VIEW(FOE_WIND('drone', 'harpoon'), [-14, 0, -14]) },
      { name: 'tell-crab', caption: 'A salt crab winding up its spinning charge: before, its lane on the sand; after, tucked into its shell and spinning, the spark on its shell', ...TELLS, view: TELL_VIEW(FOE_WIND('crab', 'spin'), [-14, 0, -14]) },
      { name: 'tell-slag', caption: 'A slag walker raising its foot to stamp: before, a ring on the floor round it; after, the raised leg alone, glowing at the foot', ...TELLS, view: TELL_VIEW(FOE_WIND('slag', 'stomp'), [-14, 0, -14]) },
    ], see: 'In the Arena (?level=arena), call any foe from the FOES list and watch it wind up: nothing appears on the ground; its body moves into its own wind-up, a spark grows on the part that will strike and turns white, the rising sound ends in a tick, and it holds still for a beat before the blow. Turn on the hitbox overlay (debug) to see the zones.' },
    { match: 'Only what is thrown or lobbed still marks the ground', shots: [
      { name: 'tell-keeper-spit', only: 'after', caption: 'The Keeper of the cistern spitting three clods of sand: the clods in the air and their three landing marks round the traveller', ...TELLS, view: TELL_VIEW(GUARD_WIND('desert', 'spit', { meter: 0.6, k: 0.8 })) },
    ], see: 'Fight a spitting blot, a glass golem (its hurled chunk) or a guardian that throws (the Keeper’s clods, the Mother Snapper’s seeds, the Foreman’s cogs, a warden’s mortars, the Cloud-Mother’s hail): only these mark the ground, a ring where each will land.' },
    { match: 'A few wind-ups are longer, so they can be read', see: 'Fight shadow hounds (the Arena, or the City During the Eclipse): the pounce now crouches for 0.8 s, and one that melts into its own shadow is about to come up behind you (the warning marker at the screen’s edge shows it). A dune ray’s fin grows tall as it races at you before it bursts up.' },
    { match: 'The eleven temple guardians each fight a staged fight', shots: [
      { name: 'tell-keeper-stamp', caption: 'The Keeper of the cistern at 85 % of its stamp: before, a ring filling on the floor where the traveller stood; after, reared up on its hind legs, its forefeet glowing over the spot they will come down on', ...TELLS, view: TELL_VIEW(GUARD_WIND('desert', 'stamp', { meter: 0.4, side: 18, back: 10, h: 6, look: 0.5 })) },
      { name: 'tell-snapper-lunge', caption: 'The Mother Snapper about to lunge: before, a long lane on the floor; after, her head reared high, jaws agape, the spark in her mouth', ...TELLS, view: TELL_VIEW(GUARD_WIND('perdide', 'lunge', { side: 24, back: 6, h: 6, look: 0.9 })) },
      { name: 'tell-warden-phase', only: 'after', caption: 'The warden in its third phase: cracks glowing along its hull, its crown hatch up and its glow climbing out before it vents straight up at whoever hangs over it', ...TELLS, commit: 'c704cb68', view: TELL_VIEW(GUARD_WIND('incal', 'flare', { meter: 0.75, side: 20, back: 8, h: 6, look: 0.6 })) },
    ], see: 'Call a guardian in the Arena (FOES list > Temple guardians) or fight one in its temple: each has its own moves and combos; at each change of phase it staggers for a couple of seconds and lights up with cracks (a machine) or glyph veins (a living one), and its moves change.' },
    { match: 'Their openings are read from their bodies', see: 'Let a guardian’s stamp, charge, dive or spin miss you: it stays stuck a moment (the Keeper’s forefeet in the stone, the Foreman spinning dizzy, its face open), and that counts as its opening. A slam that sends a ring along the floor is jumped (or flown over with the jets).' },
    { match: 'Among the new moves:', see: 'The Keeper (the desert’s Givers’ House), the Elder (Vael’s Aerie), the Mother Snapper (Lorn’s Hush-House), the warden (the City-Shaft), the Clockwork Foreman (the First Garage) and the First Sign (the Signal Market’s Undertower): each in its temple, or in the Arena’s ring.' },

    // the galactic map's signature search
    { match: 'The galactic map has a signature search', shots: [
      { name: 'map-search', caption: 'The map on a new journey (1280 × 720): before, Vael and Lorn named outright; after, two uncharted regions and the scanner warming near Vael (four bars, “strong”)', from: 'headless Chrome against this branch’s own dev server and main before it, a new save in the desert with the ship powered, Medium' },
      { name: 'map-search-found', only: 'after', caption: 'Held over it: the lock ring fills, Vael resolves where it was, and the ship says “Signature locked. Vael is on the chart.”', from: 'headless Chrome against this branch’s own dev server and main before it, a new save in the desert with the ship powered, Medium' },
      { name: 'map-search-phone', caption: 'On a phone held upright (390 × 844): the scanner near Vael, the signal meter at the foot of the chart', from: 'headless Chrome against this branch’s own dev server and main before it, a new save in the desert with the ship powered, Medium' },
    ], see: 'Start a new journey (or reach a world you have not charted yet) and open the map at the holo table with power: move the mouse, push the left stick, hold W A S D or drag a finger over the uncharted regions. The meter in the corner and the scanner’s colour say how near you are, the light’s three notes play faintly and the controller rumbles; stay on the spot half a second.' },
    { match: 'The worlds still open in the same order as before', see: 'Load a save from before this version: every world it had on the map is still there; only the next world the route opens is searched for.' },
    // rumble
    { match: 'Controllers rumble:', shots: [
      { name: 'rumble-settings', caption: 'Settings with a controller that can rumble: Controller rumble and Rumble strength under Controls', from: 'headless Chrome against this branch’s own dev server and main before it, a simulated Xbox pad (its dual-rumble actuator), Medium' },
    ], see: 'With a controller (Xbox, PlayStation, a Steam Deck, the Android app on a handheld): take a hit, drink a potion (View + D-pad ↓), let go of a charged cut, pick up chimes, lift off in the ship, or search the galactic map. Settings > Controls has Controller rumble and Rumble strength.' },
    // the title screen
    { match: 'The title screen’s menu is much smaller', shots: [
      { name: 'title-menu-waterfall', caption: 'The city behind the waterfall (1280 × 720): before, six big entries down the middle of the picture; after, two small buttons and four icons low at the left (the menu takes 2.8 % of the screen, was 10.4 %)', from: 'headless Chrome (1280 × 720, Medium) against this branch’s own dev server and main before it, the title asked for its shot (?shot=…)' },
      { name: 'title-menu-desert', caption: 'The desert under the ringed planet: the ribs, the mesa and the planet all clear of the menu now', from: 'headless Chrome (1280 × 720, Medium) against this branch’s own dev server and main before it, the title asked for its shot (?shot=…)' },
      { name: 'title-menu-focus', only: 'after', caption: 'With a controller (shown at 2×): What’s new reached along the row, A in its corner, its name beside the row; Continue says which world it goes back to', from: 'headless Chrome at 2× against this branch’s own dev server, a save in slot 1, the controller’s glyphs shown' },
      { name: 'title-menu-phone', only: 'after', caption: 'On a phone held upright (375 × 812): the same small menu at the bottom left, every button still a 40 px touch target', from: 'headless Chrome (1280 × 720, Medium) against this branch’s own dev server and main before it, the title asked for its shot (?shot=…)' },
    ], see: 'Open the game: the menu is at the bottom left. Point at an icon (or reach it with the D-pad: down from Saves into the row, then left and right) to see its name; Enter or A opens it.' },
    { match: 'On the title screen the traveller now stands still', shots: [
      { name: 'title-stance', caption: 'The Sky Stones, close on the traveller: before, the game’s idle, one arm swung out, the weight on one leg; after, upright, arms at his sides, hands by his thighs', from: 'headless Chrome (1280 × 720, Medium) against this branch’s own dev server and main before it, the title asked for its shot (?shot=…), cropped round him' },
    ], see: 'Open the game a few times and watch him for a while: he no longer looks about or shifts his weight; he breathes, and his coat stirs.' },
    // the opening, the singing light and the father's message
    { match: 'Your father’s first message now makes the years away plain', shots: [
      { name: 'voicemail-charge', caption: 'The charge on the voicemail: before, “Bring back something of value.” in plain letters; after, “something of value” in gold with its ✦, and the condition: “Until then, don’t come home.”', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
    ], see: 'Start a new game (or open the game with ?level=desert&prologue=1), walk to the cockpit and press the blinking voicemail button: the father’s four lines, then the cut. The gold words come back on the last recording on the reel, in the mother’s recording about Ilen, at the Lantern, and in the answers “I’m looking for something of value” in Viridel, the Buried Machine and Lorn.' },
    { match: 'The singing light has a song of its own', see: 'With the sound on, play the opening: the five notes come three times under the father’s message, each nearer, then alone when you pause it, then loud as the light goes by, falling in pitch. The game sings them itself for now; a recorded version will take their place.' },
    { match: 'The opening is restaged', shots: [
      { name: 'opening-light', caption: 'Just after the message: before, the strike (“Impact. Hull breach.”, red alarm light); after, the singing light coming past the cockpit window, the father’s picture held still', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
      { name: 'opening-pause', only: 'after', caption: 'The pause: the father held mid-word over the dash, the traveller listening, and the light coming out of the dark in the window', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
      { name: 'opening-pass', only: 'after', caption: 'Outside: the light brushes past the ship’s hull and rushes away; the ship goes dark as it passes', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
      { name: 'opening-landing', caption: 'The arrival: before, ploughing a long furrow through the dunes in a storm of dust and fire; after, down on its belly at the end of a short skid', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
    ], see: 'Start a new game and press the voicemail button: let the message play to the cut (the pause), then watch the light pass, the drain and the landing. Hold Esc (B) to skip as before.' },
    { match: 'As the emergency power comes on, the ship says', shots: [
      { name: 'landing-line', caption: 'The hatch opens: before, “The impact left a magnetic signature in our hull”; after, “Whatever passed us drained the core and left a magnetic signature on the hull”', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
      { name: 'follow-line', only: 'after', caption: 'Stepping out: “Then track it. When we can fly, we follow it. I want to hear it again.”', from: 'headless Chrome against this branch’s own dev server and main before it, a new game at High, 1280 × 720 (9 October)' },
    ], see: 'At the end of the opening, as the hatch opens: the ship’s line, then his. Skipping the opening still plays them, once the father’s card has gone.' },
    { match: 'Nobody talks about your ship being struck any more', see: 'In the desert ask Oum about the light, or Nour why you fell; at the Lantern, ask Ilen why the light came to your ship. The map’s note reads “LIGHT SIGNATURE”.' },
    // Qanat repays you
    { match: 'In the desert, Qanat now repays you for its tree', shots: [
      { name: 'qanat-gift', only: 'after', caption: 'At the ship once the tree burns: Nour last at the hull, “You gave us back our light, child. So Qanat gives your ship its own.”, the others in a half ring by the ramp', from: 'headless Chrome against this branch’s own dev server, a save at the desert’s last stage, at High, 1280 × 720, the camera held (9 October)' },
      { name: 'qanat-well', only: 'after', caption: 'Hessa pours the well’s first water into the ship', from: 'headless Chrome against this branch’s own dev server, a save at the desert’s last stage, at High, 1280 × 720, the camera held (9 October)' },
    ], see: 'Light Qanat’s tree with the spark-stone, then walk back to your ship: the villagers are waiting by the ramp. Each steps up in turn and says what they pour in; then the ship hums awake.' },
    // the creatures' gallery
    { match: 'In the creatures and spirits gallery, the creatures’ shadows', shots: [
      { name: 'gallery-shadow', caption: 'The dune skitter in the gallery, standing (shown at 2×): before, its shadow’s edge torn and speckled, pale streaks between the legs; after, one smooth shadow, each leg’s outline clear', from: 'headless Chrome against this branch’s own dev server and main before it, enemies.html, the creature held at one moment, cropped round it' },
      { name: 'gallery-shadow-motion', caption: 'Eight frames over two seconds of its idle: before, the edges crawl from frame to frame; after, they hold still', from: 'headless Chrome against this branch’s own dev server and main before it, enemies.html, the page’s own animation stepped a quarter of a second between frames' },
    ], see: 'Open the creatures and spirits gallery (enemies.html), pick the Desert’s dune skitter, and watch its shadow while it stands, moves and attacks, dragging to turn it.' },
    // the traveller's hands
    { match: 'The traveller’s hands stay joined to his arms', shots: [
      { name: 'traveller-hands', caption: 'Standing, 10 s into the idle, from the front and close (the Motion page): before, his left hand across the front of the coat at the hip, the wrist bent in, his right hand turned on a thin wrist under the sleeve; after, both hands hang at the ends of his forearms, by his thighs', from: 'headless Chrome against this branch’s own dev server, motion.html?mode=solo&yaw=1.9&pitch=0.05&zoom=0.3, stepped 600 frames at 60 Hz; the before with the old forearm swing, wrist and belt hook switched back on in the page; cropped to the view, 930 × 720 (9 October)' },
    ], see: 'Open Debug → Motion, One toggled, and turn the view round to his front (drag), close in: stand for ten seconds, then walk and run (W A S D, Shift). The hands stay at the ends of the arms; the wrists keep their thickness.' },
    // the debug pages
    { match: 'Every page reached from Debug', shots: [
      { name: 'debug-back', only: 'after', caption: 'The Items page with its ◀ Debug button at the top left, the Esc key’s glyph in it (B with a controller in hand); the title moved beside it', from: 'headless Chrome against this branch’s own dev server, items.html, 1280 × 720 (9 October)' },
    ], see: 'Title → Debug (the beetle), open any page at the top (Motion, Items, Creatures & spirits…): press Esc or B, or click ◀ Debug, and you are back at the list. With an item open on the Items page, Esc first closes the item.' },
    { match: 'On the Motion page, motion matching', shots: [
      { name: 'motion-page', only: 'after', caption: 'The Motion page: what motion matching is, and why the game keeps its own animation, at the top of the panel', from: 'headless Chrome against this branch’s own dev server, motion.html?mode=solo, 1280 × 720 (9 October)' },
    ], numbers: [
      { title: 'Motion matching on the traveller: how far a foot slides while down (mean), on each test run', unit: 'm', better: 'lower', device: 'any (the gait harness, Node, 60 Hz)', rows: [
        { where: 'walk → run → 180° turn → stop', before: 0.083, after: 0.074 },
        { where: 'walk, 90° turn, stop', before: 0.094, after: 0.065 },
        { where: 'turn round on the spot', before: 0.065, after: 0.035 },
        { where: 'up the ramp, stand', before: 0.060, after: 0.032 },
        { where: 'stairs up, stand, down', before: 0.093, after: 0.054 },
        { where: 'slow walk (half stick), stop', before: 0.054, after: 0.041 },
        { where: 'jog, 45° and back, stop', before: 0.097, after: 0.093 },
        { where: 'stand still 6 s', before: 0.024, after: 0.003 },
      ], source: 'BODY=v1 WAYS=mm node scripts/mocap/compare.mjs before and after (the game’s default, the loops with the captured moves: 0.000–0.051)', note: 'the worst slide on the first run rose (0.25 → 0.38 m), and a held foot on the 90° turn drifts 6 cm (was 0.6): matching stays off in the game' },
    ], see: 'Debug → Motion: the two travellers side by side, or One toggled with Motion matching, and a run from the list (walk → run → 180° turn); the matcher’s panel says which clip it plays.' },
  ],
  '1.5': [
    // the first shop
    { match: 'The first shop has opened in the desert', shots: [
      { name: 'shop-front', caption: 'Beside the way from the camps up to Qanat’s main gate: before, open sand; after, Haddu’s shop, its door under a striped awning, the name board over it and a brass chime hanging by the door', commit: 'b1fff179',
        view: { level: 'desert', save: SAVE_ON, setup: pinAt(SHOP_DOOR[0], SHOP_DOOR[1], { a: SHOP_DOOR[2] - 0.55, dist: 15, h: 3.4, ty: 2, pd: 7, pa: SHOP_DOOR[2] - 0.3, fov: 50 }), wait: 800 } },
      { name: 'shop-inside', only: 'after', caption: 'Inside: Haddu behind his counter, the wares laid out on it (three flasks, two hearts, two magic cells), shelves of jars behind, the sun through a lattice window on the floor', commit: 'b1fff179',
        view: { level: 'desert', save: SAVE_ON, setup: SHOP_IN(), wait: 800 } },
    ], see: 'From the pilgrims’ camps, walk toward Qanat’s main gate: the shop is on your left before the gate. Walk into its door; walk out of the room’s door to be back in the street. Save inside (wait a few seconds) and reload: you are still in the shop.' },
    { match: 'Haddu, a broad, slow chime-weigher', shots: [
      { name: 'shop-panel', only: 'after', caption: 'The shop open (1280 × 720): Haddu and what he says, the wallet, a card for each ware with its picture, effect, stock and price', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, setup: SHOP_OPEN(), wait: 800 } },
      { name: 'shop-panel-deck', only: 'after', caption: 'On the Steam Deck’s screen (1280 × 800)', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, size: [1280, 800], setup: SHOP_OPEN(), wait: 800 } },
      { name: 'shop-panel-side', only: 'after', caption: 'On a phone held sideways (812 × 375): the same row of cards, smaller', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, size: [812, 375], setup: `document.body.classList.add('touch'); ${SHOP_OPEN()}`, wait: 800 } },
      { name: 'shop-panel-phone', only: 'after', caption: 'On a phone held upright (375 × 812): one card a row, the picture beside the words', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, size: [375, 812], setup: `document.body.classList.add('touch'); ${SHOP_OPEN()}`, wait: 800 } },
    ], see: 'In the shop, talk to Haddu (X / □, E) and answer “Show me what you have”, or stand at the middle of the counter and look at the wares. The D-pad or the arrows move between the cards, A / × or Enter chooses, B / ○ or Esc backs out.' },
    { match: 'He sells healing potions', shots: [
      { name: 'shop-ask', only: 'after', caption: 'A heart container chosen: “Buy a heart container for 50 chimes?”, Buy with A and Not now with B', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, setup: SHOP_OPEN(`document.querySelector('#shop [data-ware="heart"]').click(); await wait(500);`), wait: 600 } },
    ], see: 'Buy a heart container: the price on its card goes from 50 to 80, “1 left”, and a fourth heart comes up at the top left, full. Buy both: the card says Sold out, and Haddu says so if you choose it again. A card you can’t afford shows its price in red.' },
    { match: 'Potions now run out', shots: [
      { name: 'potions-hud', caption: 'Half the hearts gone, at the top left: before, the flask said ∞; after, a save from before the shop has a full five', commit: 'b1fff179',
        view: { level: 'desert', hud: true, save: SAVE_ON, wait: 1500, setup: HEARTS_SETUP(0.5) } },
    ], see: 'Drink a potion (C, View + D-pad ↓, or tap the flask): the count by the flask goes down. With none left, a notice says a shop sells more.' },
    // hearts, potions and the magic bar (the HUD shot in both commits with the same setup: half the health gone, the bar at 1.4 of 3, held there)
    { match: 'Your health is now hearts', shots: [
      { name: 'hearts-hud', caption: 'Half the health gone, at the top left: before, the thin red bar; after, a heart and a half of three in ink, the potion beside them and the magic bar under them, spent to under half', commit: 'fdaa8144', before: '40356176',
        view: { level: 'desert', hud: true, save: SAVE_ON, wait: 1500, setup: HEARTS_SETUP(0.5) } },
      { name: 'hearts-deck', caption: 'The same on the Steam Deck’s screen (1280 × 800)', commit: 'fdaa8144', before: '40356176',
        view: { level: 'desert', hud: true, save: SAVE_ON, size: [1280, 800], wait: 1500, setup: HEARTS_SETUP(0.5) } },
      { name: 'hearts-phone', caption: 'And on a phone held sideways (812 × 375): the hearts, the potion and the bar stay readable, clear of the view (on a touch screen the flask is the potion button)', commit: 'fdaa8144', before: '40356176',
        view: { level: 'desert', hud: true, save: SAVE_ON, size: [812, 375], wait: 1500, setup: `document.body.classList.add('touch'); ${HEARTS_SETUP(0.5)}` } },
    ], see: 'Let a foe hit you, or take a long fall: the hearts come up at the top left, a quarter at a time, and stay until you drink.' },
    { match: 'Hearts no longer come back by themselves', see: 'Get hurt, wait: the hearts stay down. Press C (View + D-pad ↓ on a controller, or tap the flask by the hearts): the flask tilts, a swig, and two hearts come back in a warm glow. At full hearts it says so and keeps the potion.' },
    { match: 'The backpack’s three charges are now a magic bar', shots: [
      { name: 'magic-bar', caption: 'Two shots spent, whole hearts: before, nothing on the screen (only the backpack’s glass showed it); after, the magic bar at the top left with a tick per shot, refilling', commit: 'fdaa8144', before: '40356176',
        view: { level: 'desert', hud: true, save: SAVE_ON, wait: 1500, setup: HEARTS_SETUP(1) } },
    ], see: 'Aim (LT / L2, right mouse) and shoot three times: the bar under your hearts empties a third a shot; stop, and a second later it fills back up, full in about four seconds.' },
    // chimes, the currency
    { match: 'Foes now leave chimes when they fall', shots: [
      { name: 'chimes-arena', caption: 'A shade cut down in the Arena, two seconds after: before, only its ink on the sand; after, its chimes too, brass discs hovering and turning round where it fell', commit: 'aa81c3f0',
        view: { level: 'arena', player: [-14, 0, -14], eye: [-3.4, 1.6, -3.2], target: [0, 0.3, 0.2], fov: 48, save: SAVE_ON, wait: 2200, setup: CHIME_DROP('shade', 'new V(0, 0, 0)') } },
      { name: 'chimes-desert', caption: 'The Desert: a spitting blot cut down by the dunes outside Qanat, its ink stain on the sand; after, its chimes beside the stain', commit: 'aa81c3f0',
        view: { level: 'desert', player: [-190, 22, 290], eye: [-201.5, 23.6, 301.5], target: [-204, 21.6, 304.2], fov: 45, save: SAVE_ON, wait: 2200, setup: CHIME_DROP('spitter', 'new V(-204, 22, 304)') } },
    ], see: 'In any world, cut down an ink blot: two or three brass chimes pop out round it and hover, turning; walk over them or come within a couple of steps and they fly to you with a ting. In the Arena, open the FOES list, pick a machine or a guardian: they drop chimes too (a guardian bout in the ring, a purse of forty).' },
    { match: 'Your chimes show beside your hearts and potion', shots: [
      { name: 'chimes-hud', caption: 'Thirty-seven chimes picked up, half the hearts gone, at the top left: before, the hearts, the potion and the magic bar; after, a brass chime and the count beside the potion', commit: 'aa81c3f0',
        view: { level: 'desert', hud: true, save: SAVE_ON, wait: 1800, setup: `${HEARTS_SETUP(0.5)} window.resources?.addChimes?.(37);` } },
    ], see: 'Pick up a few chimes: the hearts come up at the top left with a brass disc and the count beside the potion, counting up. Open the menu (View, or J): the count is by the Gear heading on the Items page.' },
    // the title screen: before, the drifting view over the cloud and the thin name; after, a cover's world and the drawn name (the same opening forced to one shot with ?shot=)
    { match: 'A new title screen', shots: [
      { name: 'title-waterfall', caption: 'The title on a desktop screen: before, thin capitals over a sweep above the clouds; after, the ivory HIRAETH over the city behind the waterfall, framed as its cover', commit: 'b43643dd',
        view: { query: 'shot=H1', hud: true, ready: "!!window.title?.root?.classList.contains('vista-on')", settle: 600, wait: 2500 } },
      { name: 'title-sky-stones', caption: 'Another opening: the Sky Stones from a rose ledge, the monastery’s table and its needle over the cloud', commit: 'b43643dd',
        view: { query: 'shot=E3', hud: true, ready: "!!window.title?.root?.classList.contains('vista-on')", settle: 600, wait: 2500 } },
      { name: 'title-salt-harbour', caption: 'And the Salt Harbour: the two beached ships and the street between them', commit: 'b43643dd',
        view: { query: 'shot=G4', hud: true, ready: "!!window.title?.root?.classList.contains('vista-on')", settle: 600, wait: 2500 } },
    ], see: 'Open the game a few times: each time a different world behind the name. On a phone, turn it upright: the menu moves to the bottom in two columns.' },
    { match: 'Spines and flames now bite a quarter heart', see: 'In the desert, walk into a sand candelabra’s spines: a quarter heart, a shove, and no second prick if you step straight back in. In the Arena, pick Second wind between waves.' },
    { match: 'The Arena’s waves now come round to every foe', shots: [
      { name: 'arena-waves', only: 'after', caption: 'Wave 144 in the Arena: the Glass Dunes’ pair, a glass crab and the possessed furnace walker, the wave said at the top with its world', from: 'headless Chrome against this branch’s dev server, the Arena at High, 1280 × 720, the waves started at the Glass Dunes’ pairs (9 October)' },
    ], see: 'In the Arena, open the FOES list and choose “Waves from here” beside a world: its four come one by one, then in pairs, then together.' },
    { match: 'The Arena’s FOES list is easier to find', shots: [
      { name: 'foe-list', caption: 'The Arena’s FOES list opened: before, a narrow column of the ink and the worlds’ kinds; after, every foe grouped by world, a search, world filters and “Waves from here”', commit: '50d41c3c',
        view: { level: 'arena', quality: 'medium', hud: true, save: SAVE_ON, wait: 1200, setup: `${HIDE('#inputs, .input-display, #toast')} document.querySelector('#foe-spawner .tab')?.click(); level.quickMenu?.toggle?.(true);` } },
    ], see: 'In the Arena, press K (or D-pad ↓ on a controller), or click the FOES tab on the left: type in the search, or turn the world filters with LB / RB.' },
    { match: 'The Arena can call the temples’ guardians', shots: [
      { name: 'arena-guardian', only: 'after', caption: 'The Elder of Vael called into the Arena’s ring: woken as the traveller stepped in, its cone drawn on the sand before it strikes', from: 'headless Chrome against this branch’s dev server, the Arena at High, 1280 × 720 (9 October)' },
    ], see: 'In the Arena, open the FOES list, turn to Guardians and choose one: step into the ring ahead to wake it.' },
    { match: 'The hundred new enemies can always be seen', see: 'In the Arena, choose “Waves from here” beside the City During the Eclipse: the spirits’ white outlines and the glowing eyes show on the sand; set the hour to night in the dev menu to see them against the dark.' },
    { match: 'A People page in the menu', shots: [
      { name: 'people-cards', only: 'after', caption: 'The menu’s new People page partway through the route: a card for everyone met, world by world, each with the portrait their last conversation took (the desert’s people here; the others not yet talked to since the portraits began show their initial)', from: 'headless Chrome against this branch’s dev server, 1440 × 900, a save at the City-Shaft (9 October)' },
      { name: 'people-page', only: 'after', caption: 'Dov’s page on the Steam Deck’s screen: what you know of him (each part only once heard), where he is now, the token you gave back, and the quests and the ration tin between you; ◀ ▶ to the people either side', from: 'headless Chrome against this branch’s dev server, 1280 × 800 (9 October)' },
      { name: 'people-phone', only: 'after', caption: 'The same page on a phone held upright (375 × 812): the portrait beside the name, one column to scroll', from: 'headless Chrome against this branch’s dev server, 375 × 812 (9 October)' },
    ], see: 'Open the menu (View, or J) and turn to People with RB / R1: the D-pad moves over the cards, A / × opens one, B / ○ goes back.' },
  ],
  '1.4': [
    { match: 'Creatures and spirits: 100 reference-based enemies', shots: [
      { name: 'roster-desert', only: 'after', caption: "The Desert in the Arena: dune skitter, cistern beast, possessed cistern pump, dune wanderer shade", from: FROM_ROSTER },
      { name: 'roster-arzach', only: 'after', caption: "Vael in the Arena: ridge runner, storm ray, possessed aerie sentinel, feather-cowled shade", from: FROM_ROSTER },
      { name: 'roster-arzach2', only: 'after', caption: "Vael II: The Sky Stones in the Arena: cliff crab, cloud spitter, possessed monastery bell, cloud monk shade", from: FROM_ROSTER },
      { name: 'roster-perdide', only: 'after', caption: "Lorn in the Arena: marsh snapper, spore toad, possessed marsh harvester, shell-masked shade", from: FROM_ROSTER },
      { name: 'roster-perdide2', only: 'after', caption: "Lorn II: The Deep Wood in the Arena: root crawler, fungal spitter, possessed wood cutter, hollow woodsman shade", from: FROM_ROSTER },
      { name: 'roster-edena', only: 'after', caption: "Viridel in the Arena: seedpod artillery, glass wasp, possessed pruning machine, garden keeper shade", from: FROM_ROSTER },
      { name: 'roster-incal', only: 'after', caption: "The City-Shaft in the Arena: pipe lizard, pressure toad, possessed inspection tripod, city vagrant shade", from: FROM_ROSTER },
      { name: 'roster-garage', only: 'after', caption: "The Sealed Hangar in the Arena: oil beetle, scrap ray, possessed welding automaton, hooded mechanic shade", from: FROM_ROSTER },
      { name: 'roster-buried', only: 'after', caption: "The Buried Machine in the Arena: drill grub, ash lizard, possessed mining tripod, pressure-suited shade", from: FROM_ROSTER },
      { name: 'roster-spheres', only: 'after', caption: "The Garden of Spheres in the Arena: pearl rolling hunter, prism spitter, possessed ring machine, halo garden shade", from: FROM_ROSTER },
      { name: 'roster-bazaar', only: 'after', caption: "The Signal Market in the Arena: stall crab, coin lizard, possessed sign automaton, parcel-backed shade", from: FROM_ROSTER },
      { name: 'roster-mangrove', only: 'after', caption: "The White Mangrove in the Arena: root wader, salt mollusk, possessed surveyor, driftwood shade", from: FROM_ROSTER },
      { name: 'roster-glassdunes', only: 'after', caption: "The Glass Dunes in the Arena: glass crab, crystal manta, possessed furnace walker, mirrored nomad shade", from: FROM_ROSTER },
      { name: 'roster-waterfall', only: 'after', caption: "The City Behind the Waterfall in the Arena: drain crawler, pressure-jet toad, possessed turbine guardian, aqueduct keeper shade", from: FROM_ROSTER },
      { name: 'roster-saltharbour', only: 'after', caption: "The Salt Harbour in the Arena: anchor crab, brine mollusk, possessed dock winch, drowned sailor shade", from: FROM_ROSTER },
      { name: 'roster-antennas', only: 'after', caption: "The Forest of Antennas in the Arena: copper beetle, signal moth, possessed relay sentinel, static wanderer shade", from: FROM_ROSTER },
      { name: 'roster-underwater', only: 'after', caption: "The Underwater City in the Arena: coral crawler, porcelain ray, possessed diving bell, drowned diver shade", from: FROM_ROSTER },
      { name: 'roster-eclipse', only: 'after', caption: "The City During the Eclipse in the Arena: crescent crawler, night lizard, possessed observatory machine, eclipse pilgrim shade", from: FROM_ROSTER },
      { name: 'roster-fallenring', only: 'after', caption: "The Fallen Ring in the Arena: orbital crab, solar ray, possessed gyroscope drone, orbital worker shade", from: FROM_ROSTER },
      { name: 'roster-moonfoundry', only: 'after', caption: "The Moon Foundry in the Arena: furnace beetle, ember lizard, possessed crucible automaton, foundry worker shade", from: FROM_ROSTER },
      { name: 'roster-underside', only: 'after', caption: "The Underside in the Arena: bridge crawler, abyss ray, possessed cable crane, suspended humanoid shade", from: FROM_ROSTER },
      { name: 'roster-spacecity', only: 'after', caption: "The City Floating in Space in the Arena: magnetic mollusk, space moth, possessed airlock inspector, void wanderer shade", from: FROM_ROSTER },
      { name: 'roster-overnighttrain', only: 'after', caption: "The Overnight Train in the Arena: luggage beetle, lantern moth, possessed luggage porter, shadow conductor", from: FROM_ROSTER },
      { name: 'roster-home', only: 'after', caption: "Home in the Arena: seashell crawler, bulb toad, possessed watering automaton, attic wanderer shade", from: FROM_ROSTER },
      { name: 'roster-atelier', only: 'after', caption: "The Atelier in the Arena: paint beetle, ink lizard, possessed drawing machine, paper mannequin shade", from: FROM_ROSTER },
      { name: 'attack-lob', only: 'after', caption: 'A spore toad of Lorn lobs a glob: the glob in flight, and the ring where it lands drawn on the sand under the traveller, the same ring that hits', from: FROM_ATTACK },
      { name: 'attack-beam', only: 'after', caption: 'The possessed aerie sentinel of Vael fires its focused beam: the lane drawn on the ground from it through the traveller is exactly what it hits', from: FROM_ATTACK },
      { name: 'attack-volley', only: 'after', caption: 'The Garden of Spheres’ prism spitter fires its three-shot barrage: three rings across the line to the traveller, struck one after the other', from: FROM_ATTACK },
      { name: 'creatures-page', only: 'after', caption: 'Worlds → Creatures & spirits: every world’s four to turn round, watch walking and play both attacks, with links to fight one or a whole world in the Arena', from: 'headless Chrome against this branch’s dev server, enemies.html, 1280 × 720 (9 October)' },
    ] },
    { match: 'The quest characters beyond the Desert wear their reference designs', shots: [
      { name: 'quest-vael', caption: 'Oïa, Tam and Senn in Vael, in the running game: before, the seeded clothes of every world’s people; after, their reference designs, the beaked cowls, the toy bird and the ear-horn', commit: '5b19b845', before: '592f0e7a',
        view: people([{ id: 'oia' }, { id: 'tam' }, { id: 'senn' }], { level: 'arzach' }) },
      { name: 'quest-buried', caption: 'Hask, Wen and Dun in the Buried Machine: before, seeded clothes; after, the padded machine suits, the porthole helmet, the abacus and the breather', commit: '5b19b845', before: '592f0e7a',
        view: people([{ id: 'hask.buried' }, { id: 'wen' }, { id: 'dun' }], { level: 'buried' }) },
    ] },
    { match: 'A perfect parry now opens a moment for a riposte', shots: [
      { name: 'blade-riposte', caption: 'A blot’s lunge parried with a fresh guard, then the blade button a moment later in the Arena: before, he is only stepping out of the guard (the light swing barely begun); after, the riposte’s overhead chop coming down on the stunned blot, a gold ring round him', commit: 'dc9642b2',
        view: { ...ARENA_BLADE, setup: BLADE_VIEW(`input.KeyZ = true; ${sleepJs(120)} foes.strike(f); ${sleepJs(150)} input.KeyZ = false; input.KeyF = true; ${sleepJs(60)} input.KeyF = false; ${sleepJs(150)}`) } },
    ], numbers: [
      { title: 'The traveller’s captured moves (moves.glb), with the Sword and Shield pack’s slash 4 (the riposte) and attack 2 (the dash cut) added', unit: 'KB', better: 'lower', device: 'any (downloaded once, after the game starts)', rows: [
        { where: 'the file', before: 607.1, after: 630.8 },
        { where: 'gzipped, as the site serves it', before: 403.2, after: 417.1 },
      ], source: 'public/anim/moves.glb before and after (621 644 → 645 908 bytes; gzip -9c: 412 874 → 427 094); the two clips trimmed to the 1.8 s and 1.05 s the game plays' },
    ], see: 'In the Arena, raise the guard (LB / L1) just as a blot lunges, then press RB / R1 straight away: he turns into an overhead chop.' },
    { match: 'Press the blade button during an evade', shots: [
      { name: 'blade-dash-cut', caption: 'An evade back from a blot with the blade button pressed during it: before, a light swing on the spot where the evade ended; after, the dash cut carrying him past the blot’s side, the sweep crossing it', commit: 'dc9642b2',
        view: { ...ARENA_BLADE, setup: BLADE_VIEW(`input.AltLeft = true; ${sleepJs(60)} input.AltLeft = false; ${sleepJs(80)} input.KeyF = true; ${sleepJs(60)} input.KeyF = false; ${sleepJs(310)}`, { side: 6, h: 2.4, ty: 1.2 }) } },
    ], see: 'In the Arena, evade (B / ○) away from a blot and press RB / R1 while you slide: he springs back in past it with a sweep.' },
    { match: 'Foes now follow you up and down', shots: [
      { name: 'foe-climb', caption: 'Up on the Arena’s ledge with an ink blot coming from below: before, it is stuck against the foot of the ledge, pressing at the wall; after, it has leapt up and stands beside him', commit: 'bcdd52a1',
        view: { ...ARENA_LEDGE, setup: LEDGE_VIEW(`const f = foes.add('blot', new V(4, 0, -35)); f.state = 'chase'; setInterval(() => { f.cool = 99; }, 50);`), wait: 2600 } },
      { name: 'foe-dais', caption: 'Standing on the makers’ box on the dais of the desert temple’s third room, its machine woken: before, it stands at the foot of the dais, stopped by its first step; after, it has climbed the dais to him', commit: 'bcdd52a1',
        view: { level: 'desert', quality: 'high', save: SAVE_ON, eye: [158, 2411.5, -139], target: [150.5, 2408, -146], fov: 55, wait: 3200,
          setup: `const V = THREE.Vector3, top = foes.env.ground(150, 2412, -144, 12);
            player.teleport(new V(150, top + 0.1, -144), new V(0, 1, 0), new V(0, 0, 1)); ${sleepJs(800)}
            const m = foes.list.find((f) => Math.abs(f.pos.z + 150) < 3); m.state = 'chase'; setInterval(() => { m.cool = 99; }, 50);` } },
    ], see: 'In the Arena, stand on the ledge at the far side (the ramp goes up to it) and pick an ink blot from the FOES list: it crouches at the foot of the ledge and leaps up. A machine from the list comes round by the ramp instead.' },
    { match: 'A spitting blot now climbs steps and ramps', see: 'In the Arena, pick a spitting blot from the FOES list and lead it near the ledge at the far side, staying on the sand below: it walks up the ramp and lobs down at you from up there. Walk up the ramp after it.' },
    { match: 'Knock a foe off a ledge', shots: [
      { name: 'foe-knock-off', caption: 'An ink blot cut off the edge of the Arena’s ledge, a second later: before, it has landed and is already coming on along the foot of the ledge; after, it lies dazed where it fell, pale stars turning over it', commit: 'f544f600', before: '6ecedb75',
        view: { ...ARENA_LEDGE, eye: [10.5, 3.2, -32.5], target: [5, 0.9, -38.6], setup: LEDGE_VIEW(`const f = foes.add('blot', new V(5, 2, -40.4)); f.state = 'chase'; setInterval(() => { f.cool = 99; }, 50); ${sleepJs(300)} f.pos.set(5, 2, -40.3); foes.hurt(f, 'blade', new V(0, 0, 1), { damage: 1, combo: 2 });`), wait: 1300 } },
    ], see: 'In the Arena, get a blot up on the ledge at the far side and cut it toward the edge (the third swing, the charged cut or the push): it lands dazed below, stars over it.' },
    { match: 'A new optional challenge in the Signal Market, the Echo relay', shots: [
      { name: 'echo-relay', caption: 'The Echo relay down the first side street west of the Signal Market’s avenue: the low and middle stones at the near end, the three walls hung with old dishes, and the arch at the far end with the high stone and the horns', commit: '59249565',
        view: { level: 'bazaar', save: SAVE_ECHO, player: [-39.5, 0.4, 78.5], heading: -Math.PI / 2, eye: [-35, 8.5, 71], target: [-68, 1, 76], fov: 55, wait: 3000 } },
      { name: 'echo-relay-results', only: 'after', caption: 'The Echo relay finished: the time, the makers’ mark, and a word from Oyo, who sells lanterns on the avenue', commit: '59249565',
        view: { level: 'bazaar', hud: true, hour: 10, save: SAVE_ECHO, player: [-39.5, 0.4, 78.5], setup: ECHO_THROUGH('kit-bazaar', 30.6), wait: 600 } },
    ] },
    { match: 'And one in Viridel, the Vine walk', shots: [
      { name: 'vine-walk', caption: 'The Vine walk on the slope east of Mira’s water clock: four white decks in a line, higher over the meadow the further they go, a seed at the edge of each gap, and the wall with the flower-door on the third deck', commit: '7f245a39',
        view: { level: 'edena', save: SAVE_BLOOM, player: [55, -3.1, 1], heading: Math.PI / 2, eye: [60, 9, -28], target: [98, -4, 2], fov: 55, wait: 3000 } },
      { name: 'vine-walk-grown', only: 'after', caption: 'The Vine walk in a run: the first two seeds bloomed from the start and their vines grown across the gaps, the flower-door ahead still shut', commit: '7f245a39',
        view: { level: 'edena', save: SAVE_BLOOM, player: [55, -3.1, 1], heading: Math.PI / 2, eye: [53, 3.1, 4.5], target: [95, -3.2, 0], fov: 55, wait: 600,
          setup: `const w = window.trials.byId('kit-edena'), wait = (ms) => new Promise((r) => setTimeout(r, ms)); for (const v of w.course.vines.slice(0, 2)) v.seed.hit('bloom'); await wait(3500);` } },
      { name: 'vine-walk-results', only: 'after', caption: 'The Vine walk finished: the time, the makers’ mark, and a word from Mira, who keeps the water clock', commit: '7f245a39',
        view: { level: 'edena', hud: true, hour: 10, save: SAVE_BLOOM, player: [55, -3.1, 1], setup: VINE_THROUGH('kit-edena', 24.9), wait: 600 } },
    ] },
    { match: 'Knock a foe into deep water', shots: [
      { name: 'foe-swept', caption: 'An ink blot pushed off a crystal rock in Lorn’s swamp into water deeper than a man, as it comes down: before, it has gone under without a splash and lies on the bottom out of sight, to wade out again; after, a great splash where it went in, and it is gone', commit: 'a88286bf',
        view: { level: 'perdide', quality: 'high', save: SAVE_ON, eye: [173, 3.4, 216.5], target: [168.2, -0.6, 208.7], fov: 50, wait: 640,
          setup: `const V = THREE.Vector3; for (const f of foes.list.slice()) foes.remove(f); foes.packRest = 1e9;
            player.teleport(new V(176.5, -0.6, 208.7), new V(0, 1, 0), new V(0, 0, 1)); player.heading = -Math.PI / 2;
            ${HIDE('#toast')} ${sleepJs(1500)}
            const f = foes.add('blot', new V(171.28, 0.99, 208.72)); f.state = 'chase'; setInterval(() => { f.cool = 99; }, 50); ${sleepJs(400)}
            foes.hurt(f, 'push', new V(-1, 0, 0), { shove: 3 });` } },
    ], see: 'In Lorn, get a stalker or a blot onto the bank of the swamp where it drops into deep water and push it in (or cut it toward the water): it goes under in a big splash and is gone. Push one into the shallows and it only wades.' },
    { match: 'A temple’s crystal pendulum that you have stilled', shots: [
      { name: 'foe-crystal', caption: 'The Hush-House’s pendulum bridge with its middle crystal stilled and an ink blot coming along the bridge through it: before, it has passed the frosted crystal as if it were air and is at the traveller; after, it stands held against the crystal, its eyes pale', commit: 'a88286bf',
        view: { level: 'perdide', quality: 'high', save: SAVE_ON, eye: [-92.5, 1712.6, 403.2], target: [-100, 1710, 407.2], fov: 55, wait: 2200,
          setup: `const V = THREE.Vector3, sw = level.temple.pieces.filter((p) => p.stillFor != null);
            for (const s of sw.slice(0, 2)) { s.s = 0; s.update(0); s.hit('stun'); s.stillFor = 60; s.still = 60; }
            const c = sw[1].center.clone();
            for (const f of foes.list.slice()) foes.remove(f); foes.packRest = 1e9;
            player.teleport(new V(c.x, 1709.1, c.z - 3.2), new V(0, 1, 0), new V(0, 0, 1)); player.heading = 0;
            ${HIDE('#toast')} ${sleepJs(800)}
            const f = foes.add('blot', new V(c.x, 1709, c.z + 2.6)); f.state = 'chase'; setInterval(() => { f.cool = 99; }, 50);` } },
    ], see: 'In Lorn’s Hush-House, still a pendulum over the bridge with a stilling glob and let a foe come at you along the bridge through it: it stops dead against the frosted crystal, its eyes pale, for a few seconds.' },
    { match: 'And one in the Sky Stones, the Bell crossing', shots: [
      { name: 'bell-crossing', caption: 'The Bell crossing off the south rim of the Sky Stones’ starting plateau: four stone decks floating in a line over the sea of cloud, a bell on a post at each gap’s edge, the stones of each bridge hanging high over its gap, and the wall with the bell-tuned door on the last deck', commit: 'a443e0fb',
        view: { level: 'arzach2', save: SAVE_BELL, player: [-3, 40.6, 80], heading: 0, eye: [-34, 50, 98], target: [0, 39, 126], fov: 55, wait: 3000 } },
      { name: 'bell-crossing-stones', only: 'after', caption: 'The Bell crossing: the whistle sounded by the first bell, and the fallen-up stones coming down into a bridge across the gap', commit: 'a443e0fb',
        view: { level: 'arzach2', save: SAVE_BELL, player: [-3, 40.6, 80], heading: 0, eye: [5.5, 43.5, 88], target: [0, 41, 104], fov: 55, wait: 400,
          setup: `const w = window.trials.byId('kit-arzach2'), wait = (ms) => new Promise((r) => setTimeout(r, ms)); await wait(2500); w.course.rt.lit.add('stones1'); await wait(1100);` } },
      { name: 'bell-crossing-results', only: 'after', caption: 'The Bell crossing finished: the time, the makers’ mark, and a word from Sister Aube, the hermit of the edge', commit: 'a443e0fb',
        view: { level: 'arzach2', hud: true, hour: 10, save: SAVE_BELL, player: [-3, 40.6, 80], setup: BELL_THROUGH('kit-arzach2', 24.8), wait: 600 } },
    ] },
  ],
  '1.3': [
    { match: 'Two new optional challenges built from the temples’ own pieces', shots: [
      { name: 'wind-hall', caption: 'The Wind hall on the dune crest west of the desert’s landing, its sign by the steps: gusts blow down it, four screens to shelter behind, three eyes under the porch at its far end', commit: '33271faa',
        view: { level: 'desert', player: [-129, 19.6, -73.5], heading: 3.6, eye: [-118, 30, -86], target: [-135, 22, -46], fov: 55, wait: 3000 } },
      { name: 'hush-walk', caption: 'The Hush walk on Lorn’s south shore: a causeway out over the deep lake under three arches, a crystal of the Hush swinging across from each', commit: '33271faa',
        view: { level: 'perdide', player: [0, 1.6, 19], heading: 0, eye: [20, 8, 12], target: [3, 3, 48], fov: 55, wait: 3000 } },
      { name: 'wind-hall-results', only: 'after', caption: 'The Wind hall finished: the time, the makers’ mark, and a word from Pell, who lives at the foot of the dune (his line comes up over his head too)', commit: '33271faa',
        view: { level: 'desert', hud: true, hour: 10, player: [-129, 19.6, -73.5], setup: RUN_THROUGH('kit-desert', 38.4), wait: 600 } },
    ] },
    { match: 'Opening a makers’ box now ends with a moment', shots: [
      { name: 'box-beat-try', caption: 'The grappling hook’s box in the plain of Arzach: before, the item flew into his chest; after, he holds it out and fires it once, a spray of light ahead of him', from: 'frames from scripts/cinematics-qc.mjs (the review page’s staging, headless Chrome, 960 × 540) before and after on this branch (9 October)' },
      { name: 'box-beat-wear', caption: 'The pale star in Qanat: before, it flew into his chest; after, it is pinned on, and a close look at it worn on his lapel', from: 'frames from scripts/cinematics-qc.mjs (the review page’s staging, headless Chrome, 960 × 540) before and after on this branch (9 October)' },
      { name: 'box-beat-play', caption: 'The bell-note whistle in the Sky Stones’ temple: after, at his lips, its note playing and notes of light rising', from: 'frames from scripts/cinematics-qc.mjs (the review page’s staging, headless Chrome, 960 × 540) before and after on this branch (9 October)' },
    ], see: 'Open any makers’ box (Debug → Cinematics lists them all) and press A / × on the card: the hook or a gadget is tried, the star worn, a charm pocketed, the coil fitted to the pack, the lens or the shell points the way, the whistle plays.' },
    { match: 'A box also takes its time from what it holds', see: 'Open a gadget’s box (the grappling hook in Arzach) and a charm’s (the soft-fall soles in the City-Shaft): the first rocks three times, the last the hardest; the second twice, and comes apart sooner.' },
    { match: 'Two more of them. In Vael, the Feather leap', shots: [
      { name: 'feather-leap', caption: 'The Feather leap in Vael, north-west of the landing, by the stone hand: the lower ledge across the gulf (left), the tower with its terrace’s screens, and the column of wind rising at its foot beyond', commit: 'f51e0acc',
        view: { level: 'arzach', player: [-97, 24, -208], heading: 0, eye: [-34, 44, -150], target: [-104, 29, -160], fov: 55, wait: 3000 } },
      { name: 'furnace-steps', caption: 'The Furnace steps in the Buried Machine, east of the landing: eight iron pillars over the glowing grate, and the door of four eyes at the far end', commit: 'f51e0acc',
        view: { level: 'buried', player: [45, 6, 59], heading: 0, eye: [60, 18, 72], target: [40, 6, 94], fov: 55, wait: 3000 } },
      { name: 'feather-leap-results', only: 'after', caption: 'The Feather leap finished: the time, the makers’ mark, and a word from Kesh, who keeps the stone hand nearby', commit: 'f51e0acc',
        view: { level: 'arzach', hud: true, hour: 10, save: { flags: { 'prologue.done': true, 'item.backpack': true, 'item.glider': true, 'items.v': 2 }, keepsakes: [] }, player: [-97, 24, -208], setup: RUN_THROUGH('kit-arzach', 41.2, 0.1), wait: 600 } },
    ] },
    { match: 'Hold the blade button (RB / R1)', shots: [
      { name: 'blade-charge', caption: 'The blade button held for a second in the Arena: before, one light cut and he is back on guard; after, the sword drawn back over his shoulder and held, the charge full', commit: 'bf70463a',
        view: { ...ARENA_BLADE, setup: BLADE_VIEW(`input.KeyF = true; ${sleepJs(1000)}`) } },
      { name: 'blade-charged-cut', caption: 'A moment after letting go: before, nothing more (the light cut was over); after, the great-sword sweep cutting through the blot, its trail over the arc', commit: 'bf70463a',
        view: { ...ARENA_BLADE, setup: BLADE_VIEW(`input.KeyF = true; ${sleepJs(1000)} input.KeyF = false; ${sleepJs(170)}`) } },
    ], numbers: [
      { title: 'The traveller’s captured moves (moves.glb), with the Great Sword pack’s slash and jump attack added', unit: 'KB', better: 'lower', device: 'any (downloaded once, after the game starts)', rows: [
        { where: 'the file', before: 583.4, after: 607.1 },
        { where: 'gzipped, as the site serves it', before: 391.3, after: 404.8 },
      ], source: 'public/anim/moves.glb before and after (597 424 → 621 644 bytes; gzip -c: 400 686 → 414 522); the jump attack trimmed to the 1.5 s the game plays' },
    ], see: 'In the Arena (?level=arena), hold RB / R1 (F) near a blot: he draws the sword back and holds it; wait for the ring and let go. A tap still swings the light cut.' },
    { match: 'A swing in the air is now a leaping overhead cleave', shots: [
      { name: 'blade-air-cut', caption: 'A swing a moment after jumping, beside a blot: before, the first light cut with the arms alone; after, the overhead cleave coming down onto it', commit: 'bf70463a',
        view: { ...ARENA_BLADE, setup: BLADE_VIEW(`input.Space = true; ${sleepJs(80)} input.Space = false; ${sleepJs(230)} input.KeyF = true; ${sleepJs(60)} input.KeyF = false; ${sleepJs(230)}`, { side: 5, h: 2.4, ty: 1.9 }) } },
    ], see: 'In the Arena, jump (A / ×) toward a blot and press RB / R1 (F) at the top: he hangs, lifts the sword and drops onto it.' },
    { match: 'Going from one sword swing into the next', see: 'In the Arena, press RB / R1 three times quickly, then raise the guard (LB / L1) and walk off: each change of pose flows into the next instead of jumping.' },
    { match: 'The blade’s spark trail sweeps through the cut itself', see: 'Swing the blade slowly in the Arena (one press at a time): the sparks only fill the arc where the edge actually cuts.' },
    { match: 'And two more, with the temples’ stone balls', shots: [
      { name: 'sphere-court', caption: 'The Sphere court on the meadow south of the Garden of Spheres’ mirror lake: the slalom of stone spheres, the dais with its two plates between the grooves, a white sphere at the head of each, and the arch at the far end', commit: '1274815e',
        view: { level: 'spheres', player: [136, 1, -27], heading: 1.57, eye: [126, 11, -38], target: [160, 0, -20], fov: 55, wait: 3000 } },
      { name: 'long-look', caption: 'The Long look in the City-Shaft: a makers’ balcony from the rim out over the shaft, three stones with a gap between each, the ball’s rail across them, and the frame round the view at the far end with the plate', commit: '1274815e',
        view: { level: 'incal', player: [269.2, 200.5, 65.3], heading: -1.8, eye: [265.7, 209.3, 44.95], target: [244.56, 200.3, 56.49], fov: 55, wait: 3000 } },
      { name: 'long-look-results', only: 'after', caption: 'The Long look finished: the time, the makers’ mark, and a word from Tobin, who sells views along the rim', commit: '1274815e',
        view: { level: 'incal', hud: true, hour: 10, player: [269.2, 200.5, 65.3], setup: ROLL_THROUGH('kit-incal', 33.6), wait: 600 } },
    ] },
  ],
  '1.2': [
    { match: 'The dark masses in shaded corners', shots: [
      { name: 'spot-cave', caption: 'The cave under the giant, High: before, the dark masses between the ribs came in stacked rectangles; after, brushed shapes that stay put as you turn', commit: 'c58cbcaa',
        view: { level: 'desert', save: SAVE_DESERT, player: [-1250, 1000, 1272], heading: Math.PI, eye: [-1249.3, 1001.8, 1274.5], target: [-1250, 999.6, 1250], fov: 55, wait: 3000 } },
      { name: 'spot-stairs', caption: 'The stairs to the great tree in Qanat, Handheld: the risers and the terrace faces keep the same dark masses from every side (before, they came and went in blocks as the camera swung)', commit: 'c58cbcaa',
        view: { level: 'desert', save: SAVE_DESERT, quality: 'handheld', player: [219.1, 4.6, 382.0], heading: 2.6, eye: [213.62, 8.85, 372.51], target: [219.1, 3.85, 382.04], fov: 55, wait: 3000 } },
    ], see: 'Climb the stairs round the great tree in Qanat, or go down into the cave under the giant, and swing the camera round: the dark masses stay where they are.' },
    { match: 'On a phone the touch buttons now size themselves', shots: [
      { name: 'touch-sideways', caption: 'A phone held sideways (812 × 375), every button showing (a foe near, the gun’s modes): before, the cluster reached the top edge and halfway across; after, it keeps to the lower right corner', from: 'headless Chrome with touch emulation (mobile viewport, DPR 3) against this branch’s own dev server, the same view before and after (9 October)' },
      { name: 'touch-upright', caption: 'The same phone held upright (375 × 812): the buttons used to span the whole width; now the left side is free for the stick', from: 'headless Chrome with touch emulation (mobile viewport, DPR 3) against this branch’s own dev server, the same view before and after (9 October)' },
    ], see: 'On a phone, hold it sideways in any world: the buttons sit in the lower right corner, clear of the middle of the view. On a tablet or the Steam Deck they are as before.' },
    { match: 'No more bright line of sunlight', shots: [
      { name: 'cave-seam', caption: 'The Givers’ Hearth: before, a line of sunlight round the foot of the cave’s wall; after, the floor is in shade all the way to the wall', commit: 'c58cbcaa',
        view: { level: 'desert', save: SAVE_DESERT, player: [1250, 1000, -1242], heading: Math.PI, eye: [1250.7, 1001.8, -1239.4], target: [1249, 1000.6, -1262], fov: 55, wait: 3000 } },
    ] },
    { match: 'Every menu shows its buttons inside the buttons themselves', shots: [
      { name: 'menu-glyphs', caption: 'The journal with an Xbox pad: before, a line of hints at the bottom; after, B in the ✕, LB and RB on the side tabs', from: 'headless Chrome against this branch’s own dev server and the commit before, a simulated Xbox pad, 1280 × 720 (9 October)' },
      { name: 'pause-glyphs', caption: 'The pause menu with an Xbox pad: B in Resume, A beside the entry the pad is on', from: 'headless Chrome against this branch’s own dev server and the commit before, a simulated Xbox pad, 1280 × 720 (9 October)' },
    ], see: 'With a controller, press Menu (the pause menu) or View (the journal); on the title, open Saves. Then press a key on the keyboard: the same buttons show Enter, Esc, Q and E.' },
    { match: 'The buttons shown match the controller in your hands', shots: [
      { name: 'ps-glyphs', caption: 'The journal with a DualSense: before, Xbox / PlayStation pairs (“LB / L1”, “A / ×”); after, L1, R1, × and ○ alone', from: 'headless Chrome against this branch’s own dev server and the commit before, a simulated DualSense, 1280 × 720 (9 October)' },
    ], see: 'Connect an Xbox, PlayStation or Switch pad and press a button: every menu, conversation and prompt names that pad’s buttons. On a Retroid, its own letters as before.' },
    { match: 'A Switch Pro Controller or Joy-Cons on a computer', see: 'On a computer with a Switch Pro Controller, open the title’s Saves: the right button (A) opens a save, the bottom one (B) goes back. Settings → Controller buttons still changes it.' },
    { match: 'Debug: the worlds list is a grid of small cards', shots: [
      { name: 'worlds-grid', caption: 'The worlds list with a pad: before, large cards in three columns; after, a grid of small cards, the focused one framed in red with its description at the foot', from: 'headless Chrome against this branch’s own dev server and the commit before, a simulated Xbox pad, 1280 × 720 (9 October)' },
    ], see: 'Title → Debug with a controller: the D-pad moves left, right, up and down across the cards; A opens the world.' },
    { match: 'Debug: the Items page works with a controller', shots: [
      { name: 'items-pad', only: 'after', caption: 'The Items page with a pad: the card the pad is on lifted in a red frame, A on its picture', from: 'headless Chrome against this branch’s own dev server, a simulated Xbox pad, 1280 × 720 (9 October)' },
    ], see: 'Title → Debug → Items with a controller: move to a card and press A, then LB / RB, Y, X and B.' },
    { match: 'Debug: an item full screen shows one short line', shots: [
      { name: 'item-viewer', caption: 'An item full screen at 730 × 410 CSS px (a Retroid Pocket’s 1920 × 1080 screen): before, its words covered the item; after, one line under it', from: 'headless Chrome against this branch’s own dev server and the commit before, 730 × 410 (9 October)' },
    ], see: 'Title → Debug → Items, open any item full screen on a handheld or a small window, then press A (or I) for the rest.' },
    { match: 'The desert gets you moving sooner', numbers: [
      { title: 'From stepping out of the ship to the giant’s mouth: talks on the way', unit: 'talks', better: 'lower', device: 'any (the story played in Node, the shortest answers that move it on)', rows: [
        { where: 'talks before the way down (Marrow, Nour, Ama, the Speaker)', before: 4, after: 3 },
        { where: 'talks in a row after the chest opens', before: 3, after: 2 },
        { where: 'pages said', before: 24, after: 15 },
        { where: 'pages said after the chest opens', before: 20, after: 11 },
        { where: 'answers to choose', before: 10, after: 6 },
      ], source: 'the desert story played in Node on the game’s own modules (tests/playthrough-agent.js loadWorld), choosing the answers a player in a hurry would' },
      { title: 'From stepping out of the ship to the giant’s mouth: time', unit: 's', better: 'lower', device: 'any (estimate: words at the dialogue’s 48 letters a second, 1.2 s a page, 1.5 s an answer; walking 6 m/s in straight lines; the climb and the chest’s scene left out)', rows: [
        { where: 'talking', before: 102, after: 66 },
        { where: 'walking (1040 m before, the Speaker at an average place round the walls; 865 m after)', before: 173, after: 144 },
        { where: 'in all', before: 275, after: 210 },
      ], source: 'the same play-through; the walk from the map’s positions (ship, gate, ledge, Nour, Ama, the procession’s loop, the skull)' },
    ], see: 'Start a new game: open the chest on the tree’s ledge and talk to Nour. She says the verse about the giant’s mouth; after Ama’s jar the quest goes straight to the skull beyond the back gate.' },
    { match: 'Stop at Ama’s fire on your way into Qanat', numbers: [
      { title: 'Talks after the chest opens, with the jar taken on the way in', unit: 'talks', better: 'lower', device: 'any (the story played in Node)', rows: [
        { where: 'after the chest: Nour (and before, Ama and the Speaker)', before: 3, after: 1 },
      ], source: 'the desert story played in Node: Marrow, Ama on the way in, the chest, Nour' },
      { title: 'From stepping out of the ship to the giant’s mouth, with the jar taken on the way in', unit: 's', better: 'lower', device: 'any (the same estimate as the line above)', rows: [
        { where: 'walking (1040 m before; 625 m after: the camps lie on the way in, the back gate beside the tree)', before: 173, after: 104 },
        { where: 'in all', before: 275, after: 174 },
      ], source: 'the desert story played in Node: Marrow, Ama on the way in, the chest, Nour' },
    ], see: 'Start a new game and talk to Ama at the camp fires on the way to the city: tell her your ship has no power, then that you’ll go to the city. She gives you the jar, and Nour later sends you straight to the giant’s mouth.' },
    { match: 'On the ride to the Givers’ Hearth', see: 'Once Nour has sent you for the spark-stone, ride Marrow’s hoverbike along the marked stones: about 130 m before the bronze bowl, the keepers’ camp and the bell (320 m before the Hearth) a line under the view says what is ahead. Each is said once, and not once it is done (the bowl filled, the camp looked at, the bell rung). The ride is 1.6 km, about 48 s each way at the bike’s top speed.' },
    { match: 'The makers’ boxes in the temples of the Garden of Spheres', shots: [
      { name: 'temple-box', caption: 'The Footprint’s chest in the Garden of Spheres, two seconds into the opening: before, the box sunk into the dais and his head off the top of the frame', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → Makers’ box · lens (or open the chest in the Footprint’s round chamber).' },
    { match: 'The City-Shaft: when the Lodestar lights again', shots: [
      { name: 'look-up', caption: 'The third shot, across the shaft: before, a blank billboard far off; after, LOOK UP in light', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
      { name: 'lodestar-handback', caption: 'A second and a half after the moment ends, on the palace’s crown: before, the camera pressed against his head; after, behind him', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → the Lodestar lights again over the shaft.' },
    { match: 'In Vael, the bird’s arrival keeps the horizon', shots: [
      { name: 'vael-sky', caption: 'The second shot, the long lens up at her: before, plain sky and a speck; after, the haze’s towers at its foot', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → the bird comes down out of the haze and bows.' },
    { match: 'The Lantern: the light coming down out of the dusk', shots: [
      { name: 'lantern-dusk', caption: 'Two seconds in, from behind him: before, the light still above the frame (the dark disc is the dusk’s moon); after, the light beside the crown', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → The light returns to the Lantern.' },
    { match: 'The recordings at the ship’s console cut between angles', shots: [
      { name: 'recording-bust', caption: 'The third recording, 19 s in: before, the same push-in over his shoulder for 40 s; after, the two of them close', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
      { name: 'recording-face', caption: 'The same recording, 27 s in, as he says “I’m listening now”: his face in the hologram’s light', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → any recording (the long last ones show the most angles).' },
    { match: 'Opening a makers’ box comes in four ways now', shots: [
      { name: 'box-side', caption: 'The pale star’s box in Qanat, as it rises: before, over his shoulder as for every box; after, from the box’s side', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
      { name: 'box-reveal', caption: 'The same box, the reveal: before, beside him; after, from where the box stood, the star in front of his face', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Open boxes in different worlds (or Debug → Cinematics → Makers’ box ·): four openings, the same one for a box every time.' },
    { match: 'At the stone at home, laying everything down cuts', see: 'Debug → Cinematics → First homecoming (or Final homecoming), from the moment the tokens go down.' },
    { match: 'Lou’s window seat at home has a second shot', shots: [
      { name: 'window-seat', caption: 'The window seat, six seconds in: before, the same angle from the start; after, beside him, the window and the land beyond', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'At home, sit in Lou’s window seat (or Debug → Cinematics → The window seat).' },
  ],
  '1.1': [
    { match: 'Notices no longer pop up over a scene', shots: [
      { name: 'scene-notices', caption: 'Opening the makers’ box in Qanat: the desert quest’s card used to sit across the top of the scene', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Start a new game in the desert and open the box on the ledge as the first quest’s card comes up: the card waits until the box is open. The same for the recordings at the ship’s table.' },
    { match: 'The pale star from the makers’ box is pinned', shots: [
      { name: 'lapel-star', caption: 'Vael II, the bell’s moment, his face: the star used to float by his head', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'With the pale star found (the desert’s second box), watch any filmed moment’s last shot, or stand close in front of the traveller.' },
    { match: 'The Lantern: the light’s arrival is filmed again', shots: [
      { name: 'lantern-light', caption: 'The Lantern, the second shot of the light settling into the crown: before, the camera pressed up against the crown', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → The light returns to the Lantern.' },
    { match: 'At home, kneeling at the stone', shots: [
      { name: 'home-stone', caption: 'At the stone at home, six seconds in: from behind him, then from beside the stone', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'At home, pay your respects at the stone, then sit in Lou’s window seat (or Debug → Cinematics → At the stone / The window seat).' },
    { match: 'Filling the tank for the first time in Qanat', shots: [
      { name: 'tank-fill', caption: 'The first fill in the giant’s basin, the third shot', from: 'headless Chrome against this branch’s own dev server (scripts/cinematics-qc.mjs, the cinematics QC pass), the same cinematic before and after the fix (9 October)' },
    ], see: 'Debug → Cinematics → “the empty tank fills”.' },
    { match: 'In Vael, the bird’s arrival no longer opens', see: 'Debug → Cinematics → “the bird comes down out of the haze and bows”: the first shot is behind you on the open plain, not inside the sand. Open any makers’ box: the camera moves in smoothly as it comes apart.' },
    { match: 'People no longer leave a pale, person-shaped ghost', shots: [
      { name: 'person-ghost', caption: 'Climbing the stairs to the great tree in Qanat, Handheld, 9:30: before, a pale wedge the shape of him lightens the dark risers below his feet', from: 'headless Chrome against this branch’s own dev server, Handheld preset, the same pinned camera before and after the fix (9 October)' },
    ], see: 'In Qanat, climb the stairs round the great tree with the camera close behind: the risers beside you stay as dark as the rest.' },
    { match: 'Heading to space now opens onto the night', shots: [
      { name: 'space-jump', caption: 'The jump to space after take-off, 1280 × 720', from: 'headless Chrome against this branch’s own dev server: the old warp drawing and the new, the same moment of the jump (9 October)' },
    ], see: 'Take off from the ship’s galactic map to any world.' },
    { match: 'The pause menu fits on a phone held sideways', shots: [
      { name: 'pause-phone', caption: 'The pause menu on a phone held sideways (812 × 375): Quit to title at the bottom now shows', commit: '140c19c7',
        view: { level: 'desert', size: [812, 375], hud: true, save: SAVE_ON, setup: `${HIDE('#toast')} ${MENU}`, wait: 1500 } },
    ], see: 'On a phone, open the pause menu held sideways and upright; checked at 812 × 375, 375 × 812, 1080 × 2400, 1280 × 720, 1280 × 800, 1920 × 1080 and 2560 × 1440.' },
    { match: 'No more invisible shadow hounds', shots: [
      { name: 'hound-running', caption: 'A shadow hound running in the City During the Eclipse: before, a flat dark pool and two specks; after, a hump of shadow with a white outline, a glowing rim and lit eyes', commit: 'b9348a44',
        view: { level: 'eclipse', player: [2, 0, 26], heading: Math.PI, setup: FOE_HELD('hound', `f.state = 'chase'; f.dist = 10;`), wait: 1500 } },
    ] },
    { match: 'A dune ray about to burst up', shots: [
      { name: 'ray-erupt', caption: 'A dune ray winding up its burst under the sand: before, its fin had sunk out of sight; after, the fin stands high with its white outline, the sand thrown up', commit: 'b9348a44',
        view: { level: 'desert', save: SAVE_DESERT, setup: FOE_HELD('ray', `f.buried = true; f.state = 'wind'; f.atk = f.def.attacks.find((a) => a.id === 'erupt'); f.k = 0.8; f.timer = f.atk.wind * 0.8; f.attackAt.copy(P);`, { dist: 4.5, eye: 3.6, h: 2 }), wait: 1500 } },
    ] },
    { match: 'A foe winding up behind a wall', see: 'In a temple or among the Desert’s rocks, let a foe wind up on the other side of a wall while it is on the screen: a round marker fills over where it is. Foes no longer appear inside rocks or walls.' },
    { match: 'Blot swarms have bigger eyes', see: 'In the Arena (FOES tab), call a blot swarm and a glass golem, and break the golem: the swarm’s eyes and the splinters show from further off.' },
    { match: 'The stone hand on Vael is fairer', shots: [
      { name: 'stone-hand', caption: 'The stone hand on Vael from in front of its palm: the fingers now rise clearly from little to middle, the knuckle stones grow with them, and each carries one to four dots', commit: 'd0869704', before: '140c19c7',
        view: { level: 'arzach', save: SAVE_ON, setup: HAND_VIEW, wait: 1500 } },
    ], see: 'On Vael, shoot the stone hand’s knuckles in the wrong order twice: the knuckles flash rust, Kesh calls out the order and the journal writes it down; a third miss makes the next knuckle glint.' },
  ],
  '1.0': [
    { match: 'In conversations the traveller holds still', numbers: [
      { title: 'The traveller standing 30 s, idle and in a conversation', better: 'lower', device: 'the real rig and clips in Node (tests/talk-still.test.js)', source: 'tests/talk-still.test.js, 8 October', rows: [
        { where: 'the head’s turn, widest to widest (°)', before: 133, after: 0.4 },
        { where: 'the hips’ sway side to side (cm)', before: 4.3, after: 0.9 },
        { where: 'captured looking-about and breathing idles played', before: 2, after: 0 },
      ] },
    ], see: 'Talk to anyone and wait on a long line: when the camera comes in close on the traveller he stays still, his eyes on the one speaking.' },
    { match: 'Picking an answer in a conversation no longer plays', see: 'In the desert, talk to Nour and pick any answer: her reply starts at once, and your answer is not shown or voiced again.' },
    { match: 'When Nour tells you to stand in water', see: 'Open the makers’ chest in Qanat, talk to Nour, ask what is on your back: the answers after “Stand in water to fill the backpack” ask where there is water, or whether it could wake the ship.' },
    { match: 'Talking to Ama by the camp fire', shots: [
      { name: 'ama-fire', caption: 'Talking to Ama beside the main camp fire: the camera used to stand in the flames', commit: '21bd507b', before: 'e35f5da4',
        view: { level: 'desert', save: SAVE_DESERT, wait: 2500, setup: `
  const V = THREE.Vector3, n = npcs.find((x) => x.def?.id === 'ama'), F = level.qanat.fires[0];
  const gy = (x, z) => { const g = physics.groundAt(x, F.y + 5, z); return Number.isFinite(g) ? g : F.y - 1.5; };
  const A = new V(F.x + 2.6, 0, F.z); A.y = gy(A.x, A.z);
  const P = new V(A.x, 0, A.z + 1.5); P.y = gy(P.x, P.z);
  player.teleport(P, new V(0, 1, 0), new V(0, 0, -1)); player.heading = Math.PI;
  n.pos.copy(A); ${sleepJs(2500)}
  n.pos.copy(A); storyRt.dialogue.start(n.def, n); n.pos.copy(A);
  storyRt.dialogue._side = 1;   // (the fire's side of the line between them: where the camera starts)
  ${sleepJs(900)}`, wait: 300 } },
    ] },
    { match: 'Fewer speech balloons', see: 'Walk through the pilgrims’ camps after talking to everyone there: nobody greets you with a balloon unless your quest points to them or they have news; shouts still show.' },
    { match: 'Nobody talks while the ship is still crashing', shots: [
      { name: 'crash-balloon', caption: 'The ship ploughing into the dunes in a new game', from: 'headless Chrome against this branch’s own dev server and the commit before, the prologue from the voicemail on, Medium (8 October)' },
    ] },
    { match: 'Marrow no longer stands right under your ship', shots: [
      { name: 'crash-marrow', caption: 'The dust settling after the crash: Marrow is the small figure by the hull', from: 'headless Chrome against this branch’s own dev server and the commit before, the prologue from the voicemail on, Medium (8 October)' },
    ] },
    { match: 'Stepping out of the ship no longer offers', shots: [
      { name: 'step-out', caption: 'The first second with the controls after stepping out of the ship', from: 'headless Chrome against this branch’s own dev server and the commit before, the prologue from the voicemail on, Medium (8 October)' },
    ] },
    { match: 'Notices are quieter', shots: [
      { name: 'hud-notices', caption: 'A long notice while hurt, 1280 × 720', from: 'headless Chrome against this branch’s own dev server and the commit before, in the Desert hurt to half health, Low (8 October)' },
      { name: 'hud-notices-phone', caption: 'The same notice on a phone held sideways (812 × 375, touch)', from: 'headless Chrome against this branch’s own dev server and the commit before, in the Desert hurt to half health, Low (8 October)' },
    ] },
    { match: 'Starting a quest or an errand shows its ', shots: [
      { name: 'quest-card', caption: 'A quest begins, 1280 × 720', from: 'headless Chrome against this branch’s own dev server and the commit before, in the Desert hurt to half health, Low (8 October)' },
      { name: 'quest-card-phone', caption: 'A quest begins on a phone held sideways (812 × 375, touch)', from: 'headless Chrome against this branch’s own dev server and the commit before, in the Desert hurt to half health, Low (8 October)' },
    ] },
    { match: 'The touch buttons stay as you left them ', shots: [
      { name: 'touch-new-world', caption: 'A new world loads on a phone after playing with a controller (812 × 375, touch)', from: 'headless Chrome against this branch’s own dev server and the commit before, the pad remembered from the world before, Low (8 October)' },
    ] },
    { match: 'The traveller’s backpack is now a flat', shots: [
      { name: 'backpack', caption: 'The traveller from behind in the character studio: the reservoir on his back, its ivory frame and jade fluid', commit: '0bc4b9fd', view: studio('backpack=true&view=arms&yaw=2.8&pitch=0.1') },
    ] },
    { match: 'The fallen giant has deep eye sockets', shots: [
      { name: 'giant', caption: 'The fallen giant beyond Qanat’s back gate, from in front of its face: the deep sockets, the teeth and the jaw into its throat', commit: '0bc4b9fd',
        view: { level: 'desert', save: SAVE_ON, setup: pinAt(318, 530, { a: Math.atan2(88, 130), dist: 42, h: 7, ty: 5, pd: 30, pa: Math.atan2(88, 130) + 0.25, fov: 55 }), wait: 500 } },
      { name: 'ship-room', caption: 'The ship’s central room in the prologue: the coral floor and the oval light overhead', commit: '0bc4b9fd',
        view: { level: 'desert', query: 'prologue=1', hour: null, save: { flags: { 'items.v': 2 }, keepsakes: [] },
          setup: `for (let i = 0; i < 240 && window.ship?.prologue?.stage !== 'walk'; i++) ${sleepJs(250)} ${sleepJs(1500)}`, wait: 300 } },
    ] },
    { match: 'The Debug button is back on the title screen', shots: [
      { name: 'debug-title', caption: 'The title screen, as a player’s build shows it', commit: 'c31a73b9',
        view: { prod: true, hud: true, hour: null, weather: '', save: SAVE_ON, ready: '!!document.querySelector(\'[data-a="news"]\')', wait: 2500 } },
    ] },
    { match: 'A Cinematics review page gathers', shots: [
      { name: 'cinematics', only: 'after', caption: 'The Cinematics review page: all 91 films, recordings and journeys, to choose one and play it', commit: 'e35f5da4', view: { page: 'cinematics.html', wait: 2500 } },
    ] },
    { match: 'A last, small world at the end of the light’s trace', shots: [
      { name: 'lantern', only: 'after', caption: 'The last world from the ship’s ramp: the sand bar out to the tower', commit: 'e80fc41d', view: { level: 'lantern', hour: null, save: SAVE_ON, wait: 4000 } },
    ] },
    { match: 'Game updates are about 100 MB smaller too', numbers: [{ title: 'An over-the-air update', unit: 'MB', better: 'lower', device: 'the update for Android and the Steam Deck',
      note: 'after: estimated, the 99 MB of recorded themes taken out of the 129 MB update', rows: [{ where: 'download', before: 129, after: 30 }],
      source: 'the update zip measured at 129 MB on 8 October (the Worker’s download fix); scripts/web-update.mjs leaves the music out' }] },
    { match: 'The Sketchbook has a Sightings page', shots: [
      { name: 'sightings', caption: 'The game menu’s Sketchbook after the desert’s first talks: the Sightings first, a ? for each still to find', commit: '9ba725ea',
        view: { level: 'desert', hud: true, save: { flags: { ...SAVE_ON.flags, 'world.desert.done': true, 'sight.desert.oum': true, 'sight.desert.dalia': true, 'sight.desert.nour': true, 'sight.desert.hull': true, 'sight.desert.givers': true }, keepsakes: [] },
          setup: `${HIDE('#toast')} journal.toggle(true); ${sleepJs(400)} journal.menu?.open?.('sketches');`, wait: 2500 } },
    ] },
    { match: 'Each of the twelve worlds off the route', shots: [
      { name: 'fallenring-mark', caption: 'The Fallen Ring: the makers’ sign burned into the tilted piece’s foot', commit: '9ba725ea',
        view: { level: 'fallenring', save: SAVE_ON, player: [127.5, 0.5, -41], heading: 2.2, eye: [129.6, 3.6, -43.2], target: [139.6, 2.2, -51.85], fov: 55, wait: 3000 } },
    ] },
    { match: 'The galactic map charts only finished worlds', see: 'Open the galactic map at the ship’s holo table: the route’s worlds and Home are there, the detours off the route are not. The Debug worlds list still opens them.' },
    { match: 'Every setting works on a controller', see: 'With a controller, open the Settings (Menu), move down to Graphics and press A / ×: the row turns red and the dropdown yellow; press down twice and A / × to keep it, or B / ○ to leave it as it was.' },
    { match: 'The language no longer changes by itself', see: 'With a controller, open the Settings and hold right from the menu’s last button: the focus stops on Language and it stays English. Press A / ×, down, A / × to switch it.' },
    { match: 'People wave properly when they greet you', shots: [
      { name: 'wave', caption: 'A baker in Qanat waving as you come near, 0.7 to 1.2 s into the greeting', from: 'headless Chrome against this branch’s own dev server, before with the commit’s earlier files, High (9 October)' },
    ] },
    { match: 'The traveller no longer wrings his neck', shots: [
      { name: 'head-turn', caption: 'Standing still, the captured looking-about idle at its widest turn (10.9 to 11.7 s)', from: 'headless Chrome against this branch’s own dev server, before with the commit’s earlier files, High (9 October)' },
    ] },
    { match: 'People standing in a crowd step out of your way', shots: [
      { name: 'brush-past', caption: 'Walking past a group in the Signal Market, 0.5 m from one of them, at 1.4 m/s', from: 'headless Chrome against this branch’s own dev server, before with the commit’s earlier files, High (9 October)' },
    ], see: 'In the Signal Market, walk straight through a group standing together: each steps aside or back with their feet, and returns.' },
    { match: 'Looking into the dry well in Qanat', shots: [
      { name: 'well-look', caption: 'Asking to look into the well from between the rim and the terrace beside it', from: 'headless Chrome against this branch’s own dev server, before with the commit’s earlier files, High (9 October)' },
    ] },
  ],
  '0.99': [
    { match: 'You can choose your own keys', shots: [
      { name: 'controls', caption: 'Menu → Controls, on a keyboard: every action with its key, to press a new one', commit: '83d364a9',
        view: { level: 'desert', hud: true, save: SAVE_ON, setup: `${HIDE('#toast')} ${MENU} document.querySelector('[data-a=page][data-page=controls]').click();`, wait: 1500 } },
    ] },
    { match: 'A Text size setting', shots: [
      { name: 'text-larger', caption: 'A conversation in the desert, Text size Larger and the solid speech background', commit: '83d364a9',
        view: { level: 'desert', hud: true, save: SAVE_ON, settings: { textSize: 'larger', speechBg: true }, setup: `${HIDE('#toast')} ${TALK}`, wait: 4500 } },
    ] },
    { match: 'The lock-on ring changes shape', shots: [
      { name: 'lock-open', caption: 'Locked on to a stunned ink blot in the Arena: open to a cut', commit: '83d364a9',
        view: { level: 'arena', query: 'foe=blot', quality: 'medium', hud: true, save: SAVE_ON, setup: HIDE('#toast, #inputs, #foe-spawner') + LOCKED({ stunned: 99 }), wait: 300 } },
      { name: 'lock-wind', caption: 'The same ink blot winding up its strike', commit: '83d364a9',
        view: { level: 'arena', query: 'foe=blot', quality: 'medium', hud: true, save: SAVE_ON, setup: HIDE('#toast, #inputs, #foe-spawner') + LOCKED({ state: 'wind', k: 0.75 }), wait: 300 } },
    ] },
    { match: 'Menus, settings and prompts can be in French', shots: [
      { name: 'menu-french', caption: 'The Settings with Langue / Language set to Français', commit: '83d364a9',
        view: { level: 'desert', hud: true, save: SAVE_ON, settings: { lang: 'fr' }, setup: `${HIDE('#toast')} ${MENU}`, wait: 1500 } },
    ] },
    { match: 'The gadgets are now in the worlds', shots: [
      { name: 'court-vael', caption: 'Vael: the makers’ court on the rise west of the landing, the hook’s box at its front', commit: '220b8d5e',
        view: { level: 'arzach', save: SAVE_ON, setup: pinAt(-124, -16, { a: 1.44, dist: 24, h: 9, ty: 1, pd: 14, pa: 1.2 }), wait: 500 } },
    ] },
    { match: 'Every route world has an optional trial', shots: [
      { name: 'trial-sign', caption: 'The desert: the Dune line’s glowing sign by the dunes east of the landing', commit: '220b8d5e',
        view: { level: 'desert', save: SAVE_ON, setup: pinAt(26, 18, { a: -2.2, dist: 7, h: 2.2, ty: 1.4, pd: 3, pa: -1.6 }), wait: 500 } },
    ] },
    { match: 'Columns of rising air stand over Vael’s plain', shots: [
      { name: 'wind-column', caption: 'Vael’s plain: the first column of rising air, its rings drifting up', commit: '220b8d5e',
        view: { level: 'arzach', save: SAVE_ON, setup: pinAt(-60, -100, { a: 0.25, dist: 45, h: 8, ty: 14, pd: 40, pa: 0.4, fov: 60 }), wait: 500 } },
    ] },
  ],
  '0.98': [
    { match: 'The title screen’s Debug button', shots: [
      { name: 'title', caption: 'The title screen, as a player’s build shows it', commit: 'c1d0dc13',
        view: { prod: true, hud: true, hour: null, weather: '', save: SAVE_ON, ready: '!!document.querySelector(\'[data-a="news"]\')', wait: 2500 } },
    ] },
    { match: 'In the ship, if you stand still', shots: [
      { name: 'ship-nudge', caption: 'The prologue’s walk, 22 seconds standing still by the bunk', commit: 'c1d0dc13',
        view: { level: 'desert', query: 'prologue=1', hud: true, hour: null, save: { flags: { 'items.v': 2 }, keepsakes: [] },
          setup: `for (let i = 0; i < 240 && window.ship?.prologue?.stage !== 'walk'; i++) ${sleepJs(250)} ${sleepJs(22500)}`, wait: 300 } },
    ] },
    { match: 'Your first steps in the desert say once', shots: [
      { name: 'first-look', caption: 'Out of the ship, eight seconds without touching the camera', commit: 'c1d0dc13',
        view: { level: 'desert', hud: true, save: { flags: { 'prologue.done': true, 'items.v': 2, 'charge.given': true, 'charge.card': true }, keepsakes: [] },
          setup: `${HIDE('#toast')} for (let i = 0; i < 48 && !/Look around/.test(document.getElementById('cue')?.textContent ?? ''); i++) ${sleepJs(250)}`, wait: 1200 } },
    ] },
    { match: 'On the ride to the Givers’ Hearth', shots: [
      { name: 'way-bowl', caption: 'The keepers’ bowl at the second marked stone, filled: the stone’s mark awake', commit: 'c1d0dc13',
        view: { level: 'desert', save: { flags: { ...SAVE_ON.flags, 'desert.way.bowl': true }, keepsakes: [] }, setup: pinAt(...WAY.bowl, { a: 2.2, dist: 7, h: 2.2, ty: 1.5 }), wait: 500 } },
      { name: 'way-camp', caption: 'The keepers’ cold camp, halfway', commit: 'c1d0dc13',
        view: { level: 'desert', save: SAVE_ON, setup: pinAt(...WAY.camp, { a: 2.0, dist: 7, h: 3, ty: 0.3, pa: 0.5, pd: 4 }), wait: 500 } },
      { name: 'way-bell', caption: 'The bell glinting in the sand near the end of the way', commit: 'c1d0dc13',
        view: { level: 'desert', save: SAVE_ON, setup: pinAt(...WAY.bell, { a: 2.4, dist: 1.6, h: 0.9, ty: 0.1, pa: 4.2, pd: 4, fov: 45 })
          + `for (let i = 0; i < 40 && !(level.hearth?.way?.bell.glint.scale.x > 0.9); i++) ${sleepJs(40)}`, wait: 0 } },
    ] },
    { match: '“Your father’s charge” is lettered small', shots: [
      { name: 'charge-card', caption: 'The father’s charge on arriving in the desert, two and a half seconds in', commit: 'c1d0dc13',
        view: { level: 'desert', hud: true, save: SAVE_ON, setup: `${HIDE('#toast')} const m = await import('/src/story/charge.js'); m.showChargeCard({ sound: null });`, wait: 2600 } },
    ] },
  ],
  '0.97': [
    { match: 'The traveller has a new face and wavy hair', shots: [
      { name: 'traveller-face', caption: 'The traveller’s face in the character studio, three quarters', commit: '06cea791', view: studio('view=face&yaw=0.5') },
    ], see: 'Open studio.html, choose the traveller and Face. Drag from the front to the side to see the new hair, level eye corners and neck fit; try neutral, delighted and worried, then enable Blinking and Talking.' },
    { match: 'The traveller’s chin keeps the shape', shots: [
      { name: 'traveller-jaw', caption: 'The traveller’s face from the side, his jaw over the scarf, in the character studio', commit: '06cea791', view: studio('view=face&yaw=1.5') },
    ], see: 'In Character Studio, choose the traveller and Bust, then rotate to a side view. The jaw keeps its original profile while the neck still meets the scarf.' },
  ],
  '0.96': [
    { match: 'The dune ray is easier to read', shots: [
      { name: 'ray-fin', caption: 'A dune ray under the Arena’s sand, close: what shows of it where it swims', commit: '99ad894a', view: { level: 'arena', query: 'foe=ray', quality: 'medium', wait: 1500, setup: RAY_AHEAD } },
    ] },
    { match: 'The lock-on has a new reticle', shots: [
      { name: 'lock-reticle', caption: 'Locked on to a makers’ machine in the Arena', from: 'headless Chrome in the Arena against this branch’s own dev server, Medium, 1280 × 720 (8 October); the before draws v0.95’s circle, with its own style, at the same place' },
    ], see: 'Lock on to any foe (R3 / Tab), in the Arena or the wilds: the gold chevrons ring it, and the pips over them go out as it is hurt.' },
    { match: 'The reticle reads the foe', shots: [
      { name: 'lock-windup', caption: 'The machine three quarters through winding up its slam: the chevrons red and closing in', from: 'headless Chrome in the Arena against this branch’s own dev server, Medium, 1280 × 720 (8 October); the before draws v0.95’s circle, with its own style, at the same place' },
    ], see: 'Lock on to a foe and parry its strike: the reticle spreads pale blue while it reels. A dune ray under the sand dims it.' },
  ],
  '0.95': [
    // (each world: before / after from the same view, then the picture made for the pass: before, after and the reference side by side)
    ...[
      ['The Desert’s golden dunes', 'desert', 'df0b4aca', { level: 'desert', hour: 9.5 }, 'The Desert from the start at 9:30', 'IMG_3775’s bones in the dunes'],
      ['The Glass Dunes: the sand', 'glassdunes', 'df0b4aca', { ref: 'glass-1-wall-camp', query: 'world=glassdunes', hour: null }, 'The References’ view of the wall and the west camp', 'the Glass Dunes’ first plate'],
      ['The Buried Machine’s dunes', 'buried', 'df0b4aca', { level: 'buried', hour: 10.5 }, 'The Buried Machine from the start at 10:30', 'IMG_3790’s domes and pipes'],
      ['The Sealed Hangar is painted', 'hangar', 'df0b4aca', { level: 'garage', hour: 10.5 }, 'The Sealed Hangar from the start at 10:30', 'its people’s sheets (Ottla, Ambroise)'],
      ['The City-Shaft’s shade is one steel blue', 'shaft', 'df0b4aca', { level: 'incal', hour: 12.5 }, 'The City-Shaft from the start at 12:30', 'IMG_3780'],
      ['On the Overnight Train the night sky glows', 'train', 'df0b4aca', { ref: 'overnighttrain-4-dust', query: 'world=overnighttrain', hour: null }, 'The References’ view of the rear deck at night', 'the fourth picture'],
      ['Lorn’s long evening shadows', 'lorn', 'df0b4aca', { level: 'perdide', hour: 18.4 }, 'Lorn from the start at 18:24', 'its people’s sheets (Sedge, Saba)'],
      ['Lorn II, the Deep Wood', 'lorn2', 'df0b4aca', { level: 'perdide2', hour: 17.7 }, 'The Deep Wood from the start at 17:42', 'IMG_3797'],
      ['The City During the Eclipse is darker and bluer', 'eclipse', 'f1084eef', { ref: 'eclipse-2-terraces', query: 'world=eclipse', hour: null }, 'The References’ view 2 of the City During the Eclipse: the left houses in shade, their shade a deep indigo', 'its second picture'],
      ['The City Floating in Space is pinker', 'spacecity', 'f1084eef', { ref: 'spacecity-1-bridge', query: 'world=spacecity', hour: null }, 'The City Floating in Space from the balcony (References view 1): the walls salmon, fewer stars', 'its first picture'],
      ['The Fallen Ring’s sky is a deeper blue', 'fallenring', 'f1084eef', { ref: 'fallenring-2-ends', query: 'world=fallenring', hour: null }, 'The broken tubes and the great cumulus (References view 2): white clouds, soft lines, a deeper sky', 'its second picture'],
      ['In the Moon Foundry the moons turn from the light', 'moonfoundry', 'f1084eef', { ref: 'moonfoundry-2-cradle', query: 'world=moonfoundry', hour: null }, 'The great hung moon and the cutaway shell (References view 2): the pillars’ turned sides dark, the sky greyer', 'its second picture'],
      ['The Underside’s town hangs darker', 'underside', 'f1084eef', { ref: 'underside-1-stair', query: 'world=underside', hour: null }, 'From the stair in the cliff’s shade (References view 1): the timber darker, the banners deeper, the rock’s shade warm', 'its first picture'],
      ['Vael II: the shade under the great caps', 'vael2', 'f1084eef', { ref: '3783-mushroom-plain', query: 'world=vael2', hour: null }, 'Under the great cap, the plain and its tower (References view): the stalk’s shade blue-grey, no longer near black', 'IMG_3783'],
      ['The Forest of Antennas: the masts', 'antennas', 'ae5f14c7', { ref: 'antennas-4-egg', query: 'world=antennas', hour: null }, 'The great saucer and the egg (References view 4)', 'its fourth picture'],
      ['The City Behind the Waterfall: the cavern', 'waterfall', 'ae5f14c7', { ref: 'waterfall-1-arch', query: 'world=waterfall', hour: null }, 'The arch and the falls (References view 1): the rock deeper, the houses warm in the shade', 'its first picture'],
      ['The Salt Harbour: the shadows on the salt', 'saltharbour', 'ae5f14c7', { ref: 'saltharbour-1-street', query: 'world=saltharbour', hour: null }, 'The street between the hulls (References view 1): the shadow on the salt cerulean, the terracotta hull rust in its shade', 'its first picture'],
      ['The Underwater City: the coral towers', 'underwater', 'ae5f14c7', { ref: 'underwater-1-cafes', query: 'world=underwater', hour: null }, 'The two cafés and the towers of pods (References view 1)', 'its first picture'],
      ['The White Mangrove: the great trees', 'mangrove', 'ae5f14c7', { ref: 'mangrove-2-colonnade', query: 'world=mangrove', hour: null }, 'The colonnade of root arches (References view 2): the trees whiter, the creatures brighter', 'its second picture'],
      ['The Garden of Spheres: the white stone', 'spheres', 'ae5f14c7', { ref: '3793-grove-pyramid', query: 'world=spheres', hour: null }, 'The grove and the pyramid (IMG_3793): the pyramid’s shade sea-green, the trunks blue-grey', 'the sheet'],
    ].map(([match, name, commit, view, caption, ref]) => ({ match, shots: colourShots(name, commit, view, caption, ref), see: SEE_COLOURS })),
    { match: 'Vael’s shadows are a cooler, paler lilac-grey', shots: [
      ...colourShots('vael', 'f1084eef', { level: 'arzach', hour: 15.5 }, 'Vael where you land, at 15:30: the flowers’ shadows on the dune a paler, cooler grey', 'Oïa’s sheet'),
      ...colourShots('viridel', 'f1084eef', { level: 'edena', hour: 10.5 }, 'Viridel by the ship at 10:30, a warmer light and a softer shade', 'Mira’s sheet'),
    ], see: 'Land in Vael and look at the shadows on the dunes; in Viridel, the meadow by the ship.' },
    { match: 'The Signal Market: the street’s shade', shots: [
      ...colourShots('market', 'ae5f14c7', { ref: '3808-long-street', query: 'world=market', hour: null }, 'The Signal Market’s long street (IMG_3808): the far end paler, the shade bluer', 'the sheet'),
      ...colourShots('marketnight', 'ae5f14c7', { ref: 'marketnight-1-lane', query: 'world=marketnight', hour: null }, 'The night market’s screen lane (References view 1): the walls and casings a slate blue', 'its first picture'),
    ], see: SEE_COLOURS },
  ],
  '0.93': [
    { match: 'The shade has a new look: a cartoon drawn in negative', shots: [
      { name: 'shade-desert', caption: 'A shade standing in the Arena at 10:00: the violet body with its head and eyes before; after, the black figure in its white outline, its head a black flame of three tips', from: 'headless Chrome against this branch’s own dev server and the commit before the new look, High, 1280 × 720, the camera 3.4 m from it (8 October)' },
      { name: 'shade-night', caption: 'The same in the Signal Market at 22:00: before, it was lost against the dark street; after, the white outline holds it', from: 'headless Chrome against this branch’s own dev server and the commit before the new look, High, 1280 × 720 (8 October)' },
      { name: 'shade-moves', only: 'after', caption: 'Its flame in the Arena: at rest, running (streaming back), winding up (flared), the cut (whipping), stunned (guttered) and dying (torn into licks as the body pours away)', from: 'headless Chrome against this branch’s own dev server, High, the shade posed by a script (8 October)' },
      { name: 'shade-moves-night', only: 'after', caption: 'The same moments in the night market (a passer-by walks in front of the last)', from: 'headless Chrome against this branch’s own dev server, High, the shade posed by a script (8 October)' },
      { name: 'shade-strike', only: 'after', caption: 'In real play, from the side: its arm raised as it winds up, the cut, the follow-through', from: 'headless Chrome against this branch’s own dev server, High, the shade’s own mind against the traveller (8 October)' },
    ], see: 'Open the Arena (?level=arena) and wait for wave six, or meet a lone shade in a later pack in the wilds: watch its flame as it runs at you, winds up and swings; stun it or cut it down.' },
    { match: 'Hitboxes, to study a fight', shots: [
      { name: 'hitboxes-swing', only: 'after', caption: 'The heavy third cut on its live frames: the blade’s edge and sweep in red, its cone, the blot’s body and its blade ring', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena, frozen on the frame the blade cuts' },
      { name: 'hitboxes-strike', only: 'after', caption: 'A machine’s slam landing: its cone filled red, the traveller’s feet inside it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena, frozen as the strike goes live' },
      { name: 'hitboxes-parry', only: 'after', caption: 'A fresh guard in its parry window (white), the machine’s wind-up in orange', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Arena' },
    ], see: 'In the Arena (?level=arena) walk to the board left of the way in and press X / □ (E), or press F4 anywhere; fight a wave and watch the colours change as the cuts and strikes go live.' },
    { match: 'The Arcade (Debug worlds, next to the Gadget Yard)', shots: [
      { name: 'arcade-plaza', only: 'after', caption: 'The Arcade from above the way in: a sign for every game round the basin, the games board by the entrance', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-sign', only: 'after', caption: 'At a sign: its name and best on the plate, "play" on the interact button', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-board', only: 'after', caption: 'The games board: every game, its line and its best, to jump straight into one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
      { name: 'arcade-pause', only: 'after', caption: 'A game from the Arcade, paused: Previous game, Next game, Back to the Arcade', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by a script' },
    ], see: 'Open ?level=arcade (or the Debug worlds list). Walk to a sign and press the interact button, or press Tab (D-pad ↓) for the games board; in a game press Menu / Esc, then Next game, or LB / RB ([ ]) on any of its cards.' },
    { match: 'The shield is a device now', shots: [
      { name: 'shield-guard', caption: 'The guard held: before, a spoked disc of opaque fluid hiding the traveller; after, a see-through blob of the fluid, its rippling edge a bright wavy rim and a few swirling strokes inside, round a collar of brass petals, swung on its brass arm in front of the chest', from: 'the character studio (studio.html?backpack=true&sword=true&shield=1&anim=clip:mixamo_ss_block_idle&paused=true&view=arms&yaw=0.7&pitch=0.12&bg=flat), headless Chrome against this branch’s own dev server, 900 × 700 (8 October)' },
      { name: 'shield-front', only: 'after', caption: 'From the front: the shield in the middle of the chest, its arm reaching back to the bracer on the left hand; in the block pose it now covers about 52° either side of facing (left 53°, right 50°; it was 63° and 28°)', from: 'the character studio (the same, yaw=0), headless Chrome, 900 × 700 (8 October)' },
      { name: 'shield-bracer', only: 'after', caption: 'Folded: the brass disc on the back of the left hand, its ribs closed like an iris round a bead of the fluid', from: 'the character studio (view=bracer&yaw=1.2&pitch=0.2), headless Chrome, 900 × 700 (8 October)' },
    ], see: 'In the Arena (?level=arena) hold LB / L1 (Z or Ctrl) and let go; take a blow with it raised, and raise it just as a blot strikes for the parry; with ?hitboxes=1 the guard’s arc shows it even both ways. Or open studio.html?backpack=true&shield=1&view=arms and slide “Shield open”.' },
    { match: 'The evade (B / ○) now has a moment of invulnerability', shots: [
      { name: 'evade-iframes', only: 'after', caption: 'The Arena with the hitboxes on, mid-dodge through an ink blot’s lunge: the pale disc and the label “I-FRAMES 0.11s · DODGED” over the traveller (it said “no i-frames” before), the blot’s strike red round him', from: 'headless Chrome against this branch’s own dev server, ?level=arena&hitboxes=1, an evade pressed toward a blot as its lunge came, 1280 × 720 (8 October)' },
    ], see: 'Open ?level=arena&hitboxes=1, let a blot wind up and press B / ○ (Alt) just as it lunges: the label over you says I-FRAMES while they last, then DODGED; press it again at once and the next evade has none.' },
    { match: 'In the Arena you always have the backpack', see: 'Start a new save, open the worlds list (Debug) and pick the Arena: the tank is on your back, RB / R1 (a left click) swings the blade and LB / L1 raises the shield.' },
    { match: 'The sword sits in your fist', shots: [
      { name: 'blade-grip', caption: 'The first cut at the moment it lands: before, the grip floated past the knuckles; after, it is closed in the fist, the guard over the thumb, the pommel below', from: 'the character studio (studio.html?backpack=true&sword=true&anim=clip:mixamo_ss_slash_1&paused=true&view=arms&yaw=0.7&pitch=0.12&bg=flat, scrubbed to the hit), headless Chrome against this branch’s own dev server, 900 × 700 (8 October)' },
    ], see: 'Swing in the Arena (RB / R1) and watch the right hand; or open studio.html?backpack=true&sword=true&view=hands with any clip scrubbed (the Blade and shield view shows both hands).' },
    { match: 'Each world now has foes of its own', see: 'Walk out into the wilds of the Salt Harbour, the Moon Foundry or the City During the Eclipse (away from people and the ship) and wait for a pack: crabs, slag walkers, shadow hounds. A relic there is guarded by them too.' },
    { match: 'Dune rays swim under the Desert', shots: [
      { name: 'foes-ray', only: 'after', caption: 'The Desert: a dune ray’s ring closing round the traveller’s feet, sand spraying where it will burst up', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), a ray called in with foes.spawnKind' },
      { name: 'foes-golem', only: 'after', caption: 'The Glass Dunes: a glass golem with both arms up for its slam', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-crab', only: 'after', caption: 'The Salt Harbour: a salt crab tucked into its shell, its spinning charge drawn along the ground', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'Sign moths of neon tube', shots: [
      { name: 'foes-moth', only: 'after', caption: 'The Signal Market: sign moths flaring, the flash’s cone drawn at the traveller', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-drone', only: 'after', caption: 'The Sealed Hangar: a rust drone aiming its harpoon down the drawn lane', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-stalker', only: 'after', caption: 'The White Mangrove: a root stalker winding up its grab, its roots’ path drawn on the planks', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'Slag walkers in the Moon Foundry', shots: [
      { name: 'foes-slag', only: 'after', caption: 'The Moon Foundry: a slag walker’s leg raised for its stomp, the ring it will leave burning drawn round it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-hound', only: 'after', caption: 'The City During the Eclipse: two shadow hounds, and the pool behind the traveller where one will step out', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'The old foes have new attacks', shots: [
      { name: 'foes-quake', only: 'after', caption: 'The Arena: a machine with both arms high for its ground slam', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'foes-volley', only: 'after', caption: 'The Arena: a spitter’s volley of three globs in the air, their three rings across the traveller’s way', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'In the Arena a FOES tab on the left', see: 'Open ?level=arena, click FOES on the left edge and choose a kind; press F4 for the hitboxes and let a machine slam to see its shockwave run out.' },
    { match: 'Controls: the controller now follows the big action games', see: 'With a controller: walk up to someone and press X / □ to talk, B / ○ to dodge a blow, D-pad ↓ to call your mount, and click the right stick (R3) away from any foe to send the scout. Menu, then Controls, lists the whole layout.' },
    { match: 'The bell-note whistle and the echo shell have a controller button again', shots: [
      { name: 'controls-whistle', only: 'after', caption: 'No gadget in hand: the card in the corner holds the whistle (and the shell), on Y / △', from: 'headless Chrome with a virtual Xbox pad against this branch’s own dev server, Low, 1280 × 720 (8 October), the Gadget Yard with every item' },
    ], see: 'Own the whistle and a gadget, put the gadget away (the wheel’s top slot, D-pad ↑ held), and press Y / △: the boxes nearby chime.' },
    { match: 'Controllers the browser does not know now work in full', see: 'Connect an 8BitDo SN30 Pro in D-input mode (hold B and Start to turn it on) on a Mac, open the Arena (?level=arena) and press each button: the input display lights the same button on its drawing, and the bottom one jumps.' },
    { match: 'An input display, to check a controller', shots: [
      { name: 'inputs-arena', only: 'after', caption: 'The Arena with a raw 8BitDo SN30 Pro (mapping empty): the bottom button, RB, L3 and the D-pad’s ↓ held, the sticks pushed, the last presses listed with their raw numbers', from: 'headless Chrome against this branch’s own dev server, Low, 1280 × 720 (8 October), navigator.getGamepads() replaced by a fake SN30 Pro in D-input as Chrome on a Mac reports it' },
      { name: 'inputs-close', only: 'after', caption: 'The display close up: the pad’s id, its mapping and the profile chosen, the raw buttons and axes, and each press as raw number → button → what it does (raw 5 is not mapped)', from: 'the same, the panel at twice the size' },
    ], see: 'Open the Arena (?level=arena) with a controller connected and press every button; View + D-pad ← or F6 hides it. Anywhere else: F6, the dev menu (`) or ?inputs=1.' },
    { match: 'Photo mode moved off the D-pad', see: 'Hold View and press D-pad ↑ for photo mode (View again, B / ○ or Menu leaves); on any screen, Menu (or the gear), then Photo mode.' },
    { match: 'Keyboard and mouse: a left click swings the fluid blade', see: 'Click into the game to capture the mouse and left-click: the blade swings. Hold the right button and left-click: it shoots.' },
    { match: 'The Controls page shows the new layout', shots: [
      { name: 'controls-page', only: 'after', caption: 'The Controls page with a pad in hand: X / □ uses and talks, B / ○ evades, R3 finds the objective with no foe near', from: 'headless Chrome with a virtual Xbox pad against this branch’s own dev server, Low, 1280 × 720 (8 October), the Start menu over the Gadget Yard' },
    ] },
    { match: 'Ink tide: from wave 7 the worlds’ own foes', shots: [
      { name: 'tide-hounds', only: 'after', caption: 'Wave 17: shadow hounds among the pillars’ shadows, with moths, stalkers, a golem and the old blots', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?game=waves, the waves before cut down by a script' },
      { name: 'tide-steady', only: 'after', caption: 'The breather after wave 7: the new Steady eyes boon on its plinth beside two of the old ones', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?game=waves' },
    ], see: 'Play Ink tide (?game=waves) past wave 6: the moths come on wave 7, the rays on 8, the stalkers on 9, then crabs, drones, slag walkers, golems and, on wave 17, the hounds.' },
    { match: 'A dune ray’s glide and a salt crab’s spinning charge', shots: [
      { name: 'hitboxes-charge', only: 'after', caption: 'A salt crab’s spin with the hitboxes on: the red circle round its body is what hits, the lane it charges along drawn faint', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=arena&foe=crab&hitboxes=1' },
    ], see: 'Open ?level=arena&foe=crab&hitboxes=1 (or foe=ray) and stand a few steps off: watch the lane while it winds up, then the circle round its body as it charges.' },
    { match: 'The bubble wand says what its bubble burst on', see: 'With the bubble wand (D-pad up to choose it), open ?level=arena&foe=golem (or foe=crab, foe=slag) and blow a bubble (Y / △) at it: the note says what it burst on.' },
  ],
  '0.92': [
    { match: 'Games: the worlds list (Debug) has a row of small games', shots: [
      { name: 'games-row', only: 'after', caption: 'The worlds list: the ten games under the pages, each one’s best under its name', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), a save with eight bests' },
      { name: 'ski-card', only: 'after', caption: 'A game’s start card: its rules, its controls (here a pad’s), the best so far', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-results', only: 'after', caption: 'The results: the score, how it was made, a new best stamped', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: 'Open the worlds list (Debug on the title, or L in play) and pick a game in the Games row, or open ?game=ski or ?game=platformer.' },
    { match: 'Dune skiing: the traveller on sand-skis', shots: [
      { name: 'ski-carve', only: 'after', caption: 'Carving through a gate, its pennants turned teal as you pass', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'ski-air', only: 'after', caption: 'Off a lip at 120 km/h, the ink streaks of the speed at the edges', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'ski-results', only: 'after', caption: 'The time, the gates, the top speed and the longest jump', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: '?game=ski: hold the tuck on the straights, let it go to turn; press A / × at a lip for the biggest air.' },
    { match: 'Sky steps: a side-on run across stones', shots: [
      { name: 'steps-card', only: 'after', caption: 'The start card, with a pad', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-spring', only: 'after', caption: 'Thrown up by a spring, the jump held', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-run', only: 'after', caption: 'On a drifting stone of the makers', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
      { name: 'steps-crumble', only: 'after', caption: 'Over the cracked stones: they shake and fall a moment after you land', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October), played by a script' },
    ], see: '?game=platformer: run off an edge and press jump a moment late, or press it just before you land: both still jump.' },
    { match: 'Canyon run: the hoverbike round the Rose Canyon', shots: [
      { name: 'canyon-arch', only: 'after', caption: 'Under a stone arch, through a checkpoint’s pennants, the jets’ trails behind', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider (window.__canyonBot)' },
      { name: 'canyon-kicker', only: 'after', caption: 'Off the first kicker at 180 km/h: the bike over the middle of the chasm, its floor far below (seen from the canyon’s side)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider, paused over the gap and drawn from beside it (the game’s captureView)' },
      { name: 'canyon-drift', only: 'after', caption: 'A sand drift across most of the floor, its fence along the crest: round it on the open side, or hop it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider' },
      { name: 'canyon-results', only: 'after', caption: 'Three laps, the fastest, the top speed and a clean run', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), driven by the game’s own rider' },
    ], see: '?game=canyon, or the sign under the lavender cliffs by the desert’s rope bridge. Each checkpoint flashes your split against your best run once you have one.' },
    { match: 'Fishing: three quiet minutes at the end of a pier', shots: [
      { name: 'fishing-cast', only: 'after', caption: 'The cast held: the rod over the shoulder, the meter at 15 m, fish shadows on the water', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
      { name: 'fishing-red', only: 'after', caption: 'A sky-eye ray running left with the reel held: the line glows red, ease off, pull against it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
      { name: 'fishing-catch', only: 'after', caption: 'Landed and held up on the line: new in the journal', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script (keys)' },
    ], see: '?game=fishing, or the sign on the shore of the desert’s mineral basin. Cast near a shadow for a quicker bite; the deep middle holds the heavy kinds.' },
    { match: 'Ring race: the jets, tuned for racing', shots: [
      { name: 'rings-card', only: 'after', caption: 'The start card on the mesa, the first ring glowing among the needles', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-climb', only: 'after', caption: 'Climbing out of the needles to ring 7, the gold arrow at the top of the view on it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-ghost', only: 'after', caption: 'The best run’s teal ghost through ring 6 ahead of you, and the split: 1.5 s behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'rings-results', only: 'after', caption: 'Twenty rings, no crashes, a new best', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=rings: hold RT / R2, keep the arrow ahead of you, and let go of the trigger on the dives to save the tank.' },
    { match: 'Wing drop: three drops from high', shots: [
      { name: 'wingdrop-thermals', only: 'after', caption: 'The first drop: the thermals’ ink swirls round the way down, the Painted Mesa ahead', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-approach', only: 'after', caption: 'Gliding in at 100 m, the bullseye ahead, a star gate low on the left', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-landed', only: 'after', caption: 'Down in the bull: the drop’s aim, style and stars', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
      { name: 'wingdrop-results', only: 'after', caption: 'Three drops and their scores', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=wingdrop: circle in a thermal to climb to the high star, and hold the stick back for the last metre or two above the target.' },
    { match: 'Both new games have an arcade sign in the desert', shots: [
      { name: 'desert-signs', only: 'after', caption: 'The ring race’s sign on the east shelf by the hanging bridge (the wing drop’s is on the far shelf)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ], see: 'In the desert, ride out to the hanging bridge between the two lilac rock shelves, far out from the start (?level=desert, about x −430, z −470), and climb onto either shelf.' },
    { match: 'The shooting gallery, a fairground stall', shots: [
      { name: 'gallery-play', only: 'after', caption: 'The last fifteen seconds: golds on the rails, the stallkeeper calling, the booth splashed', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'gallery-results', only: 'after', caption: 'A minute’s score: hits, misses, the best run, golds, bells and plates', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'gallery-sign', only: 'after', caption: 'The gallery’s sign on the Signal Market’s pavement, a few steps from where you arrive', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=gallery, or walk left from where you arrive in the Signal Market to the glowing sign. Hold LT / L2 the whole round and tap RT / R2.' },
    { match: 'Ink tide: a basin of sand in a sea of ink', shots: [
      { name: 'tide-boons', only: 'after', caption: 'A breather: three boons rise on the sigil; walk onto one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'tide-wave', only: 'after', caption: 'Wave seven closing in on the sigil: a shade, a machine, a winged blot and a swarm, the sea of ink all round', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=waves, or the sign by the way into the Arena (Debug worlds list). Guard just as a blow lands to parry: it counts for style.' },
    { match: 'Drum circle: a night round a fire in the dunes', shots: [
      { name: 'drums-card', only: 'after', caption: 'The start card: the four glyphs, the difficulty and the Timing setting', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'drums-play', only: 'after', caption: '77 in a row on Normal: the fire up, the dancers’ arms in the air, glyphs rolling in to the ring', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'drums-results', only: 'after', caption: 'The results: the rank, the perfects, the longest combo and whether your timing sits on the beat', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), played by a script' },
    ], see: '?game=drums (or the sign by the small fire south of the big one in the Desert’s pilgrim camp): try Easy first; if your hits feel late, the results suggest a Timing.' },
    { match: 'Sketch hunt: three minutes in the Signal Market', shots: [
      { name: 'hunt-list', only: 'after', caption: 'The list of six, drawn fresh each time, and three minutes on the clock', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'hunt-view', only: 'after', caption: 'Through the sketchbook: a ticket finch in the frame, and how good a sketch it would make', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
      { name: 'hunt-results', only: 'after', caption: 'The results: the page of sketches, one not found', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), played by a script' },
    ], see: '?game=sketchhunt (or the sign on the left pavement near the market’s gate): hold LT / L2 (right mouse, R), fill the frame with the subject and keep it in the middle.' },
    { match: 'Arcade signs in the worlds', see: 'In the Desert, walk to the pilgrim camp’s small fire south of the big one; in the Signal Market, look left from the gate. Press B / ○ (E) by the sign.' },
    { match: 'Games, a polish pass', shots: [
      { name: 'touch-ski', only: 'after', caption: 'Dune skiing on a phone held sideways: only the stick, the jump (pop) and run (the tuck)', from: 'headless Chrome against this branch’s own dev server, High, 844 × 390, Handheld, touch emulated (8 October), played by a script' },
    ], see: 'Finish a game with no score: no stamp; beat your best: “New best!”. The worlds list (Debug) shows the bests in the Games row.' },
    { match: 'Ring race: hold Shift or RB / R1', see: '?game=rings: hold RT / R2 (Space) and add RB / R1 (Shift): about 31 m/s becomes 40, the tank lasting about 5 s instead of 11.' },
    { match: 'Wing drop: after each landing', shots: [
      { name: 'wingdrop-landing', caption: 'The last drop landed: before, the camera low over the mesa behind the card; after, up behind you, the bullseye beyond, you left of the card', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), landings set by a script' },
      { name: 'wingdrop-star', only: 'after', caption: 'A scripted pilot (wingdrop.js starPilot) through the high star of the first thermal, flying the virtual pad', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), flown by a script' },
    ], see: '?game=wingdrop: circle up in the first thermal past its star, swing out and fly back through it along the way to the mesa.' },
    { match: 'Ink tide’s longer blade is drawn longer', shots: [
      { name: 'gallery-bells', caption: 'The shooting gallery, aiming: the bells up by the valance before, down over the rails after', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), played by a script' },
    ], see: '?game=waves: take the Longer blade boon after the first wave and watch the blade; ?game=sketchhunt: raise the sketchbook at someone with a passer-by in between.' },
    { match: 'Arcade signs for the last two games', shots: [
      { name: 'sign-ski', only: 'after', caption: 'Dune skiing’s sign on the golden dune’s crest, the Desert’s skeletons and mesas beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
      { name: 'sign-steps', only: 'after', caption: 'Sky steps’ sign on the start plateau’s west rim, a mushroom table and the monastery cliff beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ], numbers: [{ title: 'Ring race: a scripted pilot’s time round the course (the boost ×1.22 for ×2 the burn before, ×1.28 for ×2.1 after)', unit: 's', better: 'lower', device: 'any (Node, 60 fps)', rows: [
      { where: 'no boost', before: 53.9, after: 53.9 },
      { where: 'boost on the straights, a quarter of the tank kept (never dry)', before: 50.7, after: 50.0 },
      { where: 'boost every straight to the last drop (dry 5 s before, 4.5 after)', before: 52.5, after: 51.5 },
    ], source: 'tests/rings.test.js (flyCourse with a boost policy)' }],
      see: 'In the Desert, climb the tall dune north-west of the start (?level=desert, about x −108, z 124); in the Sky Stones (?level=arzach2), walk to the start plateau’s west rim.' },
  ],
  '0.91': [
    { match: 'Gadgets: things to carry besides the backpack', shots: [
      { name: 'wheel', only: 'after', caption: 'D-pad up (B) held: the wheel, nothing in hand, the grappling hook, the ink bombs; the stick points at one', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'Open the Gadget Yard from the Debug worlds list (?level=gadgetyard): both gadgets are yours. Y / △ (T) uses the one in hand, D-pad up (B) changes it, held it opens the wheel.' },
    { match: 'The grappling hook: hold Y / △ to aim', shots: [
      { name: 'hook-aim', only: 'after', caption: 'Aiming at the ring on the pole in the hook’s bay: the reticle turns into a red diamond on a ring, 15 m away', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-reel', only: 'after', caption: 'Reeled up the pole on the line, a moment before hauling over the top', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-crate', only: 'after', caption: 'A crate caught and dragged in across the yard', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'hook-market', only: 'after', caption: 'In the Signal Market: hooked to a tower’s wall 20 m away from the street, reeled up and holding on', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=bazaar' },
    ], see: 'In the Gadget Yard, the bay with the red banner: hold T (Y / △), point at a ring and let go.' },
    { match: 'Ink bombs: hold Y / △ and a dotted arc', shots: [
      { name: 'bomb-arc', only: 'after', caption: 'Aiming a bomb at the cracked wall in the middle of the yard: the dotted arc and the red ring of its blast', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bomb-blast', only: 'after', caption: 'The blast: the cloud, the speed strokes and the wall coming apart', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bomb-wall', only: 'after', caption: 'A moment later: the wall gone, a star of ink on the sand (in the yard it grows back after a while)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the dark blue banner: throw one at the cracked wall in front of the alcove, or into the pen of ink blots.' },
    { match: 'The recall hourglass: point it at something', shots: [
      { name: 'recall-trail', only: 'after', caption: 'A crate knocked off the high ledge in the hourglass’s bay: its fall drawn as a dotted line back up to the ledge, its outline along it, 1.9 s to send back', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'recall-ride', only: 'after', caption: 'Standing on it as it goes back up its own path (the gold ring turns round it), a moment before it lands on the ledge again with the traveller aboard', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the teal banner: pull the crate off the high ledge with the hook (or blow it off with a bomb), stand on it, point the hourglass at it and press T (Y / △).' },
    { match: 'The ink bridge pen: hold Y / △', shots: [
      { name: 'bridge-draw', only: 'after', caption: 'Drawing: the dotted line runs out from the traveller’s feet to the far tower, the pen at its tip, 8.6 m', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-walk', only: 'after', caption: 'Set: walking across the hand-inked plank between the towers of the pen’s bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-wall', only: 'after', caption: 'Aimed up steeply: a short wall of ink, hatched in long diagonals and cross-hatched at its foot', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bridge-shaft', only: 'after', caption: 'In the City-Shaft: a plank drawn out from the upper terraces, 150 m over the town below', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=incal' },
    ], see: 'In the Gadget Yard, the bay with the night-blue banner: climb the steps, hold T (Y / △) aimed at the far tower’s top, let go and walk across.' },
    { match: 'The seeing lens: hold Y / △', shots: [
      { name: 'lens-false', only: 'after', caption: 'Without the lens: a plank bridge between the two towers in the lens’s bay. Step on it and you fall: it is not there', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'lens-yard', only: 'after', caption: 'Through the lens: the false bridge is gone, the true path of glass shows behind it, and writing on the far tower is marked', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'lens-path', only: 'after', caption: 'Crossing the path of glass with the lens up (it holds you only while you look)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the blue-green banner: walk up the steps of the near tower and hold T (Y / △) before you cross.' },
    { match: 'Secrets for the glass in two worlds', shots: [
      { name: 'lens-qanat', only: 'after', caption: 'Inside Qanat’s main gate, words on the pylon for the glass only', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Desert, Qanat (hour 10.5)' },
      { name: 'lens-stair', only: 'after', caption: 'The stair of glass climbing over the avenue onto the gate’s lintel', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Desert, Qanat (hour 10.5)' },
      { name: 'lens-canyon', only: 'after', caption: 'The Buried Machine: walking the bridge of glass across the canyon, 38 m over its floor', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=buried' },
    ], see: 'Walk into Qanat through its main gate and turn round with the lens up; in the Buried Machine, follow the canyon’s rim to the two stone abutments between the cross-walls.' },
    { match: 'Spring boots: hold Y / △ to crouch', shots: [
      { name: 'springs-wind', only: 'after', caption: 'Wound fully: the ring of dashes round the feet turns gold', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-bounce', only: 'after', caption: 'A bounce on: the coils thrown out under the boots', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-stomp', only: 'after', caption: 'A stomp from fourteen metres: the ring of dust, the shock running out in ink, a star of ink stamped on the sand', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'springs-floor', only: 'after', caption: 'About to stomp through the cracked roof of the little room in the springs’ bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the orange banner: wind them fully under the 4 m block, then climb to the 12 m one and bounce three times to the 20 m tower; stomp through the cracked roof to the lamp inside.' },
    { match: 'The Gadget Yard, a new world', shots: [
      { name: 'yard', only: 'after', caption: 'The Gadget Yard from where you arrive: the hook’s bay and its pole, the plate and its gate, the targets, the bombs’ bay beyond', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October)' },
    ] },
    { match: 'The bubble wand: hold Y / △ to aim', shots: [
      { name: 'bubble-crate', only: 'after', caption: 'A crate caught in a bubble, floating up beside the ledge in the bubble wand’s bay', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bubble-float', only: 'after', caption: 'Floating in your own bubble up to the lamp on the pole, the stick drifting you across', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'bubble-ledge', only: 'after', caption: 'The lift puzzle done: the crate dropped onto the plate up on the ledge, the alcove’s gate sunk and its lamp in view', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard, the bay with the lavender banner: hold T (Y / △), aim at a crate and let go; look down at your feet (or jump) and press it to float yourself.' },
    { match: 'The gust fan: press Y / △ to swing it', shots: [
      { name: 'fan-gust', only: 'after', caption: 'A gust from the side: ink speed lines, curls and the wind’s fronts racing out over the sand, dust thrown up', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-fire', only: 'after', caption: 'The fire in the hut’s doorway blown out in a puff of smoke', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-hover', only: 'after', caption: 'Wings open, the fan swung at the ground: lifted up onto the ledge (the pips: gusts left before landing)', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
      { name: 'fan-skiff', only: 'after', caption: 'In Perdide: on the skiff, a swing of the fan fills its own sail; over the water the gust throws up spray', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=perdide' },
    ], see: 'In the Gadget Yard, the bay with the teal banner: press T (Y / △) at the crates, the pinwheels, the fire; jump, open the wings and swing it at the ground.' },
    { match: 'In the Gadget Yard the bubble wand’s bay', shots: [
      { name: 'fan-pinwheels', only: 'after', caption: 'The three pinwheels turning together, their lamps lit, and the gate they hold sunk', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ] },
    { match: 'The gadgets are in the game menu’s Items', see: 'Open the game menu (View / Select, J) on its Items: the hook and the bombs are drawn among the gear; choose one to take it in hand.' },
    { match: 'The boomerang: hold Y / △ and a dotted line', shots: [
      { name: 'boomerang-aim', only: 'after', caption: 'Aiming in its bay: locked on to two ropes and a pot of ink up on a block, the dotted path through them and home', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'boomerang-fetch', only: 'after', caption: 'A moment later: both ropes cut and their crates on the sand, the boomerang over the block with the pot, its ink trail behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'boomerang-market', only: 'after', caption: 'In the Signal Market with an ember on the backpack: thrown at two hanging lamps, the first already alight', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=bazaar' },
    ], see: 'In the Gadget Yard, the bay with the brass banner: hold T (Y / △), sweep the reticle over the three targets and let go. Switch the backpack to ember (X / D-pad →) and throw it at the lanterns.' },
    { match: 'The magnet glove: hold Y / △ near metal', shots: [
      { name: 'magnet-hold', only: 'after', caption: 'The metal crate lifted off its tower, the field’s wavy strokes between the glove and the crate', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'magnet-gap', only: 'after', caption: 'Pulled across 11 m of air to the iron block on its pillar, taking hold of it before hauling over the top', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
      { name: 'magnet-machine', only: 'after', caption: 'In the Sealed Hangar: a makers’ machine lifted off its feet', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), ?level=garage' },
      { name: 'magnet-hangar', only: 'after', caption: 'Pulled up to the signal board’s iron face by the path from the start, holding on', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=garage' },
    ], see: 'In the Gadget Yard, the bay with the grey banner: hold T (Y / △) on the metal crate up on the tower; W and S bring it nearer and further. From the ledge up the steps, tap it at the iron block across the gap.' },
    { match: 'The Gadget Yard has two more bays', see: 'In the magnet’s bay, lift the crate off the tower, over the wall of the pit beside it and onto the plate inside: the gate of the alcove sinks, and a pot of ink waits there.' },
    { match: 'The ten gadgets play well together', shots: [
      { name: 'wheel-ten', only: 'after', caption: 'All ten in the wheel, each with its own picture, round a wider ring; holding B no longer raises the fluid shield behind it', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), the Gadget Yard' },
    ], see: 'In the Gadget Yard hold an aiming gadget (the hook, the magnet, the lens), then tap B, or start a conversation: nothing of it is left on the screen. Wear the spring boots and open photo mode: you stay on the ground.' },
    { match: 'Gadget fixes: lower the seeing lens', shots: [
      { name: 'lens-fade', only: 'after', caption: 'The lens lowered halfway across the Buried Machine’s bridge of glass: it holds a moment longer, flickering, before it goes', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (8 October), ?level=buried' },
      { name: 'magnet-field', only: 'after', caption: 'The magnet holding a metal crate: its field in fine dashed pen lines bowing round the line, thinner toward the glove', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 633 (8 October), the Gadget Yard' },
    ], see: 'In the Buried Machine raise the lens on the bridge of glass, walk out and lower it: you have a moment and a half to raise it again. In the Gadget Yard draw a plank, stand on it and draw on along it: it runs past its end.' },
  ],
  '0.89': [
    { match: 'The Glass Dunes’ glass glows from within', shots: [
      { name: 'glass-giants', caption: 'The cliff of the giants from the valley at 16:30: the giants held in the glass are crisp dark shapes, the lobes’ thin edges glow mint', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'glass-breaker', caption: 'The breaking wave from the valley at 16:30, looking toward the sun: its lip and crest let the light through in lime, the tree inside cut clean', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'glass-plate3', caption: 'The References’ view of the third picture: the giants in the cliffs, before soft smudges, now printed shapes', from: 'the References level, ?level=references&world=glassdunes&view=3, headless Chrome, High, 1456 × 816 (7 October)' },
    ], see: 'Open the Glass Dunes (?level=glassdunes) in the late afternoon and look at the walls toward the sun: their thin edges and the lips of the waves glow; the giants stand dark inside the cliffs west of the valley.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a tight loop of renderFrame() synced by a one-pixel read, 3 × 20 frames a sample, median of 5 rounds, 16:30, the crowd off (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720', source: 'docs/systems/worlds.md, “The Glass Dunes”', rows: [
          { where: 'by the ship', before: 1.52, after: 1.55 },
          { where: 'the valley', before: 1.51, after: 1.52 },
          { where: 'the west camp', before: 1.43, after: 1.48 },
          { where: 'the breaking wave', before: 1.36, after: 1.41 },
          { where: 'the cliff of the giants', before: 1.33, after: 1.40 },
          { where: 'the Signal Market (the budget, docs/systems/worlds.md)', before: '2.23–2.28', after: null },
        ] },
      ] },
    { match: 'In the Glass Dunes the light that comes through the glass', shots: [
      { name: 'pools-spawn', caption: 'From the ship at 17:36, the sun going: the walls’ shade on the sand an emerald, not a grey teal', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'pools-westcamp', caption: 'The west camp at 17:36: the light through the cliff pooled mint and lime at its foot', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
    ], see: 'In the Glass Dunes, late in the afternoon, walk to the foot of a wall on its side away from the sun: the sand there takes the glass’s mint and lime.' },
    { match: 'Two archways in the Glass Dunes go through now', shots: [
      { name: 'passage-giants', caption: 'The archway at the foot of the cliff of the giants: before a lit panel, now a vault of glass you walk through', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'passage-wave', caption: 'The frozen wave in the valley’s middle: its archway goes through to the north', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720 (7 October); the before at the commit before the change' },
      { name: 'passage-inside', only: 'after', caption: 'Inside the cliff of the giants’ passage, 70 m of green vault, the sand beyond at its end', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 16:30 (7 October)' },
    ], see: 'From the ship walk north up the valley: the frozen wave’s archway is straight ahead; the giants’ is in the west cliff, north of the west camp.',
      numbers: [
        { title: 'The contact audit (what you stand on and walk into is what is drawn)', unit: 'problems', better: 'lower', device: 'node, tests/glass-dunes.test.js', source: 'docs/systems/worlds.md, “The Glass Dunes”', rows: [
          { where: 'climbs inside (the arches’ drawn-only rims)', before: 5, after: 1 },
          { where: 'walks through', before: 1, after: 2 },
        ] },
      ] },
    { match: 'In the References level the Glass Dunes’ fourth picture', shots: [
      { name: 'wave-plate4', caption: 'The fourth picture’s view: the wave rises steep over the camp, curls over its hollow and sweeps down to the sand', from: 'the References level, ?level=references&world=glassdunes&view=4, headless Chrome, High, 1456 × 816 (7 October)' },
    ], see: 'Open ?level=references&world=glassdunes&view=4; the backslash key lays the picture over the view.' },
    { match: 'A world picked from the Debug worlds list now opens in a separate debug save', shots: [
      { name: 'debug-save-list', only: 'after', caption: 'The worlds list (Debug on the title): a line says what picking a world does, and each card which save it opens in', from: 'headless Chrome against this branch’s own dev server, 1280 × 720 (7 October)' },
      { name: 'debug-save-items', only: 'after', caption: 'The Buried Machine picked from the list: the gear of the eight worlds before it (the wings, the jets, the cab pass…) and their keepsakes', from: 'headless Chrome against this branch’s own dev server, the game menu’s Items page, 1280 × 720 (7 October)' },
    ], see: 'On the title, choose Debug and pick a late world (the Buried Machine): open the game menu (View / Select, or J). Its Quests page lists the earlier worlds’ quests as done, the Items page holds their gear and keepsakes, the Worlds page shows their boxes opened; the Start menu reads “Debug save”. Choose a save on the title to go back to your own.' },
    { match: 'The jets fly like a plane', shots: [
      { name: 'jets-climb', only: 'after', caption: 'A second and a bit of RT / R2 from the sand in the desert: straight up, the camera looking up after you', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'The jets from standing, RT / R2 held all the way, the stick at rest (the flight model run headless, 60 steps a second, on flat ground)', unit: 'm', better: 'higher', device: 'node, src/player.js (the old model at the commit before)', source: 'docs/systems/movement-and-camera.md, “The jets fly like a plane”', rows: [
        { where: 'height after 3 s', before: 2.4, after: 58.6 },
      ] },
      { title: 'Seconds to 30 m up from standing (before: RT with A / × held, its straight climb; now: RT alone)', unit: 's', better: 'lower', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'to 30 m up', before: 3.1, after: 1.7 },
      ] },
    ], see: 'With the jets found, stand anywhere in the open and hold RT / R2 (the left mouse button): you go straight up, fast; a light squeeze rises slowly.' },
    { match: 'On the jets the left stick flies the nose', shots: [
      { name: 'jets-bank', only: 'after', caption: 'Banked into a right turn over the desert, flat out, the camera swinging round behind', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
      { name: 'jets-dive', only: 'after', caption: 'Stick forward: a dive straight down, head first, the camera looking down it', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'Top speeds on the jets (the flight model run headless, on flat ground)', unit: 'm/s', better: 'higher', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'level, full throttle', before: 8, after: 22 },
        { where: 'level, L3 / Shift', before: 14, after: 30.8 },
        { where: 'diving straight down', before: 12.3, after: 28.8 },
      ] },
    ], see: 'Lift off, push the left stick forward to level out, then left and right to bank round, forward to dive and back to pull up. Settings → Invert the jets’ pitch swaps forward and back.' },
    { match: 'Let go of the jets in the air', shots: [
      { name: 'jets-hold', only: 'after', caption: 'LT / L2 in flight: the jets hold him in the air, sinking slowly, the arm up to shoot', from: 'headless Chrome against this branch’s own dev server, a simulated pad driving the jets, High, 1280 × 720, 10:00 (7 October)' },
    ], numbers: [
      { title: 'Letting go of the throttle about 105–115 m up after flying level (the flight model run headless, on flat ground)', unit: 'm', better: 'higher', device: 'node, src/player.js', source: 'docs/systems/movement-and-camera.md', rows: [
        { where: 'carried on before touching down (before: a fall, and a knock-down)', before: 5.5, after: 416 },
      ] },
    ], see: 'Fly level and let go of RT / R2: you glide down a long way; let go climbing steeply and the nose drops over into a glide. Hold LT / L2 while flying to hang there and shoot.' },
    { match: 'With a keyboard the jets are the left mouse button', see: 'With a keyboard and mouse: click the game to capture the pointer, then hold the left mouse button (or jump and keep SPACE held): W / S tip the nose, A / D turn, SHIFT is faster. On a phone hold ⤒ in the air and drag on the left.' },
    { match: 'The scout drone goes up and down now', see: 'In the Antennas (?level=antennas) walk to the foot of the observation deck’s stairs and press Q (Y / △): the drone climbs toward the deck and hovers there nose up; from the deck, ask it for something on the field below and it sinks over the edge.',
      numbers: [
        { title: 'Where the drone hovers when it finds the goal: its height over your feet (headless Chrome against the dev server, the drone’s position logged every 0.1 s)', unit: 'm', better: 'higher', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'the Desert: Marrow on the ridge, 21 m up, 131 m off', before: 3.2, after: 6.6 },
          { where: 'the Antennas: at the foot of the observation deck, 10 m up, 27 m off', before: 3.3, after: 6.7 },
          { where: 'Incal’s Jets’ Chamber: the gallery 24 m overhead', before: 2.6, after: 19.4 },
        ] },
        { title: 'Toward a goal below: the Antennas’ deck, the field 12 m under it (its height over your feet)', unit: 'm', better: 'lower', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'from the observation deck', before: 3.2, after: -3.5 },
        ] },
        { title: 'scout.update while the drone is out (median of 4 pings, µs a frame; the machine shared with other agents)', unit: 'µs', better: 'lower', device: 'Mac, headless Chrome, High', source: 'docs/systems/scout.md, “Up and down”', rows: [
          { where: 'the Antennas, at the deck’s foot', before: 106.9, after: 107.2 },
          { where: 'Incal’s Jets’ Chamber', before: 131.3, after: 118.6 },
          { where: 'the Overnight Train', before: 90.0, after: 105.7 },
        ] },
      ] },
    { match: 'Indoors the drone keeps under the ceiling', see: 'On the Overnight Train or in a temple’s room, press Q (Y / △): the drone looks out from under the ceiling and short of the walls, and goes round to it instead of grinding along the ceiling.' },
    { match: 'When what the drone finds is well above or below you', see: 'At the foot of the Antennas’ observation deck press Q (Y / △): the line reads “the observation deck · 27 m, 10 m above”.' },
    { match: 'Old walls no longer carry dark dirt streaks', shots: [
      { name: 'cracks-qanat-house', caption: 'A block house in Qanat, 7 m off: the dirt streaks and blotches over its windows gone; its cracks keep clear of the windows and the door', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: eye [207.4, 4.2, 418.8], target [202.2, 4.2, 423.5]' },
      { name: 'cracks-qanat-street', caption: 'Inside Qanat’s gate: the tower and the house on the right, before streaked and blotched, now a few faint hairline cracks', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: eye [209.1, 4, 363.6], target [178.8, 4, 381]' },
      { name: 'cracks-market-alley', caption: 'A back alley off the Signal Market’s street: drops of grime and patches of plaster gone, fine cracks on the green wall', from: 'headless Chrome against this branch’s own dev server, High, 1280 × 720, 10:00 (7 October); the before at the commit before the change. View: the market-alley view of v0.80' },
    ], see: 'Walk up to an old house in Qanat or a shop in the Signal Market: the walls are clean but for the odd fine crack, and none comes near a window or a door. Not every building has them.' },
    { match: 'The darker smudges round the doors are gone', shots: [
      { name: 'doors-eclipse-street', caption: 'The street of lit doors off the Eclipse’s Lantern Square: the dark fans round each doorway gone, every house, table and lantern where it was', commit: '8a70f407',
        view: { level: 'eclipse', player: [2, 0, 26], eye: [4, 2.6, 24], target: [16, 2, 12], fov: 55 } },
      { name: 'doors-eclipse-town', caption: 'The Lantern Square and the wall under the upper city from above: the town laid out as before, the cellar doors clean', commit: '8a70f407',
        view: { level: 'eclipse', player: [0, 0, 30], eye: [-8, 9, 34], target: [6, 2, -30], fov: 55 } },
      { name: 'doors-qanat', caption: 'A block house in Qanat: its door in clean plaster', commit: '8a70f407',
        view: { level: 'desert', player: [209, 8, 417], eye: [207.4, 4.2, 418.8], target: [202.2, 4.2, 423.5], fov: 55 } },
    ], see: 'Walk up to a door in Qanat, at home, in the Signal Market, at Vael II’s monastery or in the City During the Eclipse: the plaster round it is the wall’s own colour.' },
    { match: 'After a dive on the jets the camera', see: 'Fly the jets high, push the left stick forward to dive head first and come down on your feet: the view eases back from looking at the ground to its usual height over the shoulder within a second. Move the right stick as you land and it stays where you put it.' },
    { match: 'People seen close, in a conversation', shots: [
      { name: 'shade-closeup', caption: 'The traveller close up in the shade on the City-Shaft’s rim at 17:00: the lit patches on his neck, cheek and coat are gone', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720, the camera 1 m from his face (7 October)' },
      { name: 'shade-profile', caption: 'The same, from his side: the cheek and the collar stay in the shade', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720 (7 October)' },
    ], see: 'Talk to someone standing in a building’s shadow (the City-Shaft’s rim late in the afternoon): faces and coats stay evenly shaded, no lit flecks along their folds.' },
    { match: 'Climbing, the traveller no longer drags', shots: [
      { name: 'climb-halo', caption: 'Climbing a villa’s shaded wall on the City-Shaft’s rim at 17:00: no dark ragged mass round his outline', from: 'headless Chrome against this branch’s own dev server and the commit before it, High, 1280 × 720, the game’s own camera (7 October)' },
    ], see: 'Climb any wall in the shade and look at the wall round the traveller; in the City-Shaft’s shaded terraces, watch people’s feet as you turn the camera.' },
    { match: 'Turning the camera quickly no longer makes distant shadows', see: 'At the City-Shaft’s rim, look across the pit and turn the camera quickly: the towers keep their shade through the turn.',
      numbers: [
        { title: 'The first frame after a quick 100° turn at the City-Shaft’s rim, 10:00, against the same view a few frames later (the light term)', unit: 'px changed', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720, Handheld preset', source: 'docs/systems/rendering.md, “Shadows close up, on climbers and after a quick turn”', rows: [
          { where: 'the frame after the turn (worst of four frame phases)', before: 35148, after: 0 },
        ] },
        { title: 'What it costs: average draw calls a frame over 12 frames (the shadow maps kept over frames now hold a little more)', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome on Metal, 1280 × 720', source: 'docs/systems/rendering.md, “Shadows close up, on climbers and after a quick turn”', rows: [
          { where: 'High, the rim across the pit', before: 1409, after: 1435 },
          { where: 'High, a terrace along its street', before: 983, after: 1015 },
          { where: 'Handheld, the rim across the pit', before: 952, after: 1012 },
          { where: 'Handheld, a terrace along its street', before: 571, after: 622 },
        ] },
      ] },
  ],
  '0.88': [
    { match: 'Blows land with weight', see: 'In the Arena, cut an ink blot: a brief catch and a jolt as the blade connects; the third swing of the combo sends it flying.' },
    { match: 'A foe winding up out of sight', see: 'In the Arena, turn the camera away from a blot as it comes: a round marker appears at the screen’s edge on its side.' },
    { match: 'Cut-down foes leave ink', shots: [
      { name: 'blade-whirl', only: 'after', caption: 'The whirl: the third swing, grown from the ink, the blade longer', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'Cut blots down: the count shows every 5 ink, and each step is announced as it is reached. Then press F three times quickly, or press it while running.' },
    { match: 'New controls for the blade', see: 'In the Arena: RB / R1 (F) swings, hold LB / L1 (Ctrl) to guard, click the right stick (Tab) to lock on.' },
    { match: 'Locked on, the camera keeps the foe ahead', shots: [
      { name: 'lock-spitter', only: 'after', caption: 'Locked on to a spitting blot (the gold ring), a blot lunging behind the traveller', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, press Tab (R3) as a wave comes in.' },
    { match: 'The push is a gun mode now', see: 'Press X (or the D-pad) until the readout says push, then aim and shoot at a crate or a blot.' },
    { match: 'Three new foes', see: 'In the Arena, waves 3, 4 and 6; out in the wilds, the later packs; winged blots in Vael and the other open-sky worlds.' },
    { match: 'A perfect parry', see: 'In the Arena, hold LB / L1 just as a blot’s ring fills: it costs no charge and the blot is stunned.' },
    { match: 'The frame freezes for an instant', see: 'In the Arena, cut a blot: the world stops dead for a few hundredths of a second as the blade connects.' },
    { match: 'The makers’ machines are rebuilt', shots: [
      { name: 'machine-breaks', only: 'after', caption: 'A machine coming apart: its shell, belt, arms and glowing glyph flying off', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena’s fifth wave, or any temple’s rooms: break a machine with the blade.' },
    { match: 'Locked on, the traveller faces the foe and strafes', shots: [
      { name: 'strafe', only: 'after', caption: 'Locked on (the gold ring), side-stepping round a blot in a sword stance', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, lock on (Tab, R3) and move the stick left, right or back.' },
    { match: 'The fluid blade is a real sword now', shots: [
      { name: 'sword', only: 'after', caption: 'The sword mid-swing: the slim fluid blade on its brass guard and hilt', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'Swing the blade (F, RB / R1).' },
    { match: 'An items page, linked from the worlds list', shots: [
      { name: 'items-page', only: 'after', caption: 'The items page: each item’s picture, what it does and where it is found', from: 'headless Chrome against the dev server (7 October)' },
    ], see: 'On the title screen, choose Debug, then Items at the top. Drag an item to turn it; click it for full screen.' },
    { match: 'Fights have their own music', see: 'In the Arena, as a wave comes in: the drum starts; it fades once the wave is down.' },
    { match: 'Where a blot falls, its ink stains the ground', see: 'Cut a blot down: dark stains on the sand where it was.' },
    { match: 'In the temples the makers’ machines meet the rooms’ workings', see: 'In a temple with gusts (Vael’s Aerie), lead a machine into the hall as it blows.' },
    { match: 'On a touch screen the blade has one button again', see: 'On a phone or tablet: tap ⚔, then hold it.' },
    { match: 'A new foe, the shade', shots: [
      { name: 'shade', only: 'after', caption: 'A shade: living shadow running down a person’s body, its feet melting into print dots, the pools it left behind', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena’s sixth wave; out in the wilds, a later pack now and then.' },
    { match: 'The Enemies setting has a Gentle choice', see: 'Settings → Enemies: Normal, Gentle or Off.' },
    { match: 'Relics out in the wilds are guarded', see: 'In the desert, walk toward a relic out in the dunes: two blots gather round it.' },
    { match: 'Foes take turns', see: 'In the Arena’s second wave, three blots come: two wind up at most while the third circles.' },
  ],
  '0.87': [
    { match: 'The fluid blade: the glove draws', shots: [
      { name: 'blade-swing', only: 'after', caption: 'The blade mid-swing, among three ink blots in the Arena', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'Anywhere with the backpack, press F (LB / L1 on a controller, ⚔ on a touch screen); press again quickly to chain the three swings.' },
    { match: 'Ink blots gather in the wilds', shots: [
      { name: 'blots-lunge', only: 'after', caption: 'Ink blots winding up: their rings drawn on the sand before they lunge, their eyes gone red', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'In the desert, walk out into the dunes well away from the camps and the ship: a few seconds later the first blot comes in.' },
    { match: 'The makers’ machines stand guard', shots: [
      { name: 'machine', only: 'after', caption: 'A makers’ machine closing in, in the Arena’s third wave', from: 'headless Chrome against the dev server, High, 10:00 (7 October)' },
    ], see: 'Go into any world’s temple: a machine stands by each room’s checkpoint stone past the first.' },
    { match: 'No blow from a foe empties a healthy bar', see: 'Settings → Enemies (on by default). Take a hit at full health: the bar never goes below a sliver.' },
    { match: 'The frame readout moved from F to F3', see: 'Press F3 in the game: the frame readout shows in the corner.' },
    { match: 'The Arena, in the worlds list', see: 'On the title screen, choose Debug, then The Arena.' },
    { match: 'The References level has the Overnight Train’s four pictures', shots: [
      { name: 'overnighttrain-refs', only: 'after', size: [1608, 448], caption: 'The fourth picture (left) and its view in the game (right): the plum carriages along the track, their windows lit, the balcony, the dust at the wheels, the two moons', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'overnighttrain-refs-dusk', only: 'after', size: [1608, 448], caption: 'The third: the train coming on at dusk, its lounge lit through the round nose, the moons low on the right, a bank of cloud on the left', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=overnighttrain and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'A new world off the route, the Overnight Train', shots: [
      { name: 'overnighttrain-arrival', only: 'after', caption: 'The train waiting at its station by night: the lounge lit at the nose, the ship on the landing wagon behind, the telegraph wires', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-lounge', only: 'after', caption: 'The observation lounge: armchairs and lamps down both rows of windows, the balcony at the end', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-dining', only: 'after', caption: 'The dining car, its tables laid and lit, the plain running past the windows', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-sleeper', only: 'after', caption: 'A sleeping car’s corridor, the compartments’ doors along it', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-library', only: 'after', caption: 'The library: shelves under the windows, sofas and lamps, the door on through to the landing wagon', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-balcony', only: 'after', caption: 'On the balcony at the nose: the track and the poles coming at you out of the dark', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-deck', only: 'after', caption: 'The landing wagon: the ship on its deck, the railing, people come to look', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-moons', only: 'after', caption: 'From the plain beside it: the lit carriages, the two moons ahead of the train', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Overnight Train on the galactic map (or open the game with ?level=overnighttrain). From the ship walk forward through the porches and the carriages to the lounge at the front.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 12 synced frames a sample, median of 3 rounds (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Overnight Train”', rows: [
          { where: 'the Signal Market’s start (the budget)', before: 2.26, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.19, after: null },
          { where: 'by the ship', before: null, after: 1.77 },
          { where: 'the lounge', before: null, after: 1.77 },
          { where: 'the dining car', before: null, after: 1.67 },
          { where: 'on the roofs', before: null, after: 1.91 },
          { where: 'the landing wagon', before: null, after: 1.69 },
          { where: 'the balcony', before: null, after: 1.73 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Overnight Train”', rows: [
          { where: 'the Signal Market, three views (the budget)', before: '334–693', after: null },
          { where: 'the Overnight Train, six views', before: null, after: '116–273' },
        ] },
      ] },
    { match: 'On the Overnight Train the land runs past', shots: [
      { name: 'overnighttrain-station', only: 'after', caption: 'Halted at a station: its house and lamps, the waiting people, the platform along the carriages', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'Open ?level=overnighttrain and wait by a window: the train leaves its station after half a minute, runs at speed for two and a half minutes, and brakes into the next. Off the train is the running land: step off and you are put back aboard.' },
    { match: 'Climb the ladder on any porch of the Overnight Train', shots: [
      { name: 'overnighttrain-roofs', only: 'after', caption: 'Along the roofs toward the nose: the walk over the crowns, the gardens either side, the plain racing past', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
      { name: 'overnighttrain-terrace', only: 'after', caption: 'The library carriage’s roof terrace, the sky lounge’s door, its pennants', from: 'the world’s own screenshots, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'On a porch between two carriages, climb the ladder beside the door (or the end wall itself); the plank bridges join the roofs from the lounge back to the library, whose terrace carries the sky lounge.' },
    { match: 'The Overnight Train sounds like a train', see: 'Turn the effects up and stand at a window while the train runs: the beat of the joints keeps time with its speed, slows as it brakes into a station and stops; go out on the balcony or the roofs and the rush of the air comes up; listen for the whistle as it pulls out.' },
    { match: 'The fluid blade swings like a sword', see: 'In the Arena, press F three times quickly: the three cuts, one after another.' },
    { match: 'Hold the blade button to raise your guard', shots: [
      { name: 'guard-block', only: 'after', caption: 'The guard up, an ink blot’s lunge landing on the shield of fluid', from: 'headless Chrome against the dev server, High, 9:30 (7 October)' },
    ], see: 'In the Arena, hold F (LB / L1) as a blot winds up in front of you.' },
    { match: 'A foe’s strike that lands makes the traveller flinch', see: 'In the Arena, let an ink blot’s lunge land without your guard up.' },
    { match: 'The Arena is bright now', see: 'On the title screen, choose Debug, then The Arena.' },
    { match: 'On the Overnight Train the carriages’ ceilings have round lamps', shots: [
      { name: 'overnighttrain-ceiling', caption: 'The dining car from its aisle: the long lamp strip’s beam down the ceiling (before), the round lamps (after)', from: 'the world’s own screenshots of the same view, headless Chrome, High, 22:00 (7 October)' },
    ], see: 'Open ?level=overnighttrain, walk forward from the ship into the library and on to the dining car, and look down the aisle.' },
  ],
  '0.86': [
    { match: 'A new world off the route, the City Floating in Space', shots: [
      { name: 'spacecity-arrival', only: 'after', caption: 'Out of the ship on the Pier: the bridge to the Gate Quarter, the islands round it, the planet two-thirds lit over the roofs', from: 'the world’s own screenshots, headless Chrome, High, 8:30 (7 October)' },
      { name: 'spacecity-bridge', only: 'after', caption: 'On the Market Bridge, the islands’ machinery hanging into the void below it', from: 'the world’s own screenshots, headless Chrome, High, 9:00 (7 October)' },
      { name: 'spacecity-plaza', only: 'after', caption: 'The Market’s plaza: the stalls under their awnings, the tables, the crowd, the houses heaped round it', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'spacecity-towers', only: 'after', caption: 'The Towers’ lane, the houses stacked storey on storey', from: 'the world’s own screenshots, headless Chrome, High, 15:00 (7 October)' },
      { name: 'spacecity-garden', only: 'after', caption: 'The Garden terrace and its dark trees, the far islands past its parapet', from: 'the world’s own screenshots, headless Chrome, High, 16:00 (7 October)' },
      { name: 'spacecity-balcony', only: 'after', caption: 'From the Balcony’s railing with Madame Sel: the far islands and their bridges, the planet behind them', from: 'the world’s own screenshots, headless Chrome, High, 8:30 (7 October)' },
      { name: 'spacecity-underside', only: 'after', caption: 'Off the side of a bridge: the tanks, pipes and cables under an island, the stars below (a moment later you are back on the bridge)', from: 'the world’s own screenshots, headless Chrome, High, 10:00 (7 October)' },
      { name: 'spacecity-night', only: 'after', caption: 'The Balcony at night, the planet nearly full, the windows and lamps lit', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the City Floating in Space on the galactic map (or open the game with ?level=spacecity). Walk north off the Pier, through the Gate Quarter and over the Market Bridge; from the plaza the bridges go east to the Towers, west to the Garden and north to the Balcony.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 90 synced frames a round, median of 7 rounds (the machine shared with other agents: compare within the run)', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Floating in Space”', rows: [
          { where: 'the Signal Market’s start (the budget)', before: 9.9, after: null },
          { where: 'the Signal Market’s crowd (the budget)', before: 8.2, after: null },
          { where: 'by the ship', before: null, after: 9.1 },
          { where: 'the Gate’s lane', before: null, after: 9.0 },
          { where: 'on the Market Bridge', before: null, after: 5.9 },
          { where: 'the plaza', before: null, after: 6.5 },
          { where: 'the Balcony', before: null, after: 7.8 },
          { where: 'looking back over the whole city', before: null, after: 5.2 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Floating in Space”', rows: [
          { where: 'the Signal Market, start and crowd (the budget)', before: '329–366', after: null },
          { where: 'the City Floating in Space, six views', before: null, after: '182–401' },
        ] },
      ] },
    { match: 'The References level has the City Floating in Space’s four pictures', shots: [
      { name: 'spacecity-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): from the balcony, the arched bridge over the void, the heaped quarters, the planet’s edge', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'spacecity-refs-arches', only: 'after', size: [1928, 538], caption: 'The third: the two arches under the towers, the city running on under the great planet, its dark side mauve', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=spacecity and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'Space is drawn the way the drawings draw it', shots: [
      { name: 'spacecity-sky', only: 'after', caption: 'Under the crescent: the stars printed all round, the planet’s lit edge, its dark side as black as the sky', from: 'the References’ second view of the City Floating in Space, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=spacecity&view=2; walk off the balcony’s edge with the camera and look down: the stars go on under the islands.' },
    { match: 'The References level has the Signal Market at night', shots: [
      { name: 'marketnight-refs', only: 'after', size: [1464, 408], caption: 'The first picture (left) and its view in the game (right): the screen lane at midnight, the violet face, the scarlet portrait, the planet and the desert', from: 'the views\u2019 own contact sheets, headless Chrome, High (7 October)' },
      { name: 'marketnight-refs-awning', only: 'after', size: [1464, 408], caption: 'The third: under the diagonal awning, the great scarlet portrait, the round planet, the white glyphs', from: 'the views\u2019 own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=marketnight and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'The Signal Market has its night', shots: [
      { name: 'marketnight-street', caption: 'The avenue at 23:00 from the cab stop: the towers\u2019 signs and the shop signs lit as screens, the black sky', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [0, 0, 88], heading: 3.1416, eye: [0, 1.99, 97.5], target: [0, 1.79, 87.5], fov: 55 } },
      { name: 'marketnight-square', caption: 'Signal Square at 23:00: the screens round the silent tower, which stays dark under its covers, and a thinner crowd', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [8, 0, -150], heading: 3.1416, eye: [6, 2.4, -140], target: [2, 6, -200], fov: 55 } },
      { name: 'marketnight-stalls', caption: 'Along the stalls at 23:00: a lantern\u2019s warm pool on the sidewalk and the shop front, a shop sign lit lemon', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 23, player: [-20, 0.3, 30], eye: [-18, 3, 30], target: [-24, 4, 0], fov: 55 } },
      { name: 'marketnight-day', caption: 'And at 10:00 the same avenue as it was (only the walkers differ)', commit: '6083d8e2',
        view: { level: 'bazaar', hour: 10, player: [0, 0, 88], heading: 3.1416, eye: [0, 1.99, 97.5], target: [0, 1.79, 87.5], fov: 55 } },
    ], see: 'In the Signal Market (?level=bazaar), set the hour past 21:00 in the developer panel\u2019s Time of day, or wait for the night. The signs light up from dusk; half the crowd is gone by midnight, only out of your sight.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), 60 frames \u00d7 7 rounds, the day and the night alternated four times at each place, the median', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', source: 'docs/systems/worlds.md, \u201cThe Signal Market at night\u201d', rows: [
          { where: 'the spawn: by day (before) and by night (after)', before: 1.51, after: 1.48 },
          { where: 'the wide view from 27 m up', before: 1.24, after: 1.19 },
          { where: 'in the crowd', before: 1.29, after: 1.3 },
          { where: 'along the stalls', before: 1.37, after: 1.39 },
          { where: 'Signal Square', before: 1.62, after: 1.58 },
        ] },
      ] },
  ],
  '0.85': [
    { match: 'A new world off the route, the City During the Eclipse', shots: [
      { name: 'eclipse-arrival', only: 'after', caption: 'Out of the ship on the esplanade at noon: the gate, the Lantern Square, the bowl and its house under the black sun', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-square', only: 'after', caption: 'The Lantern Square: the tables by lantern light, the west wall’s terraces and its pale figures, the street of lit doors', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-bowl', only: 'after', caption: 'Up the Great Stair: the bowl, its tiers climbing to the eclipse house, the great dome on the right', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-overlook', only: 'after', caption: 'The overlook: the lane of tables along the parapet, the lower city lit to the rose horizon', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-dusk', only: 'after', caption: 'The bowl at dusk, the sun back and setting', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'eclipse-night', only: 'after', caption: 'The square at night', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the City During the Eclipse on the galactic map (or open the game with ?level=eclipse). Walk north through the gate into the Lantern Square; the Great Stair at its far end climbs to the bowl; the overlook is along the upper city’s west parapet. Mira sits by the west wall’s tables, Mother Ysolde in the bowl, Wen at the overlook.' },
    { match: 'Eclipses are drawn the way the drawings draw them', shots: [
      { name: 'eclipse-total', only: 'after', caption: 'Totality at noon: the black disc ringed with light, its corona in rays and dots, a few stars, the lamps lit', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'eclipse-partial', only: 'after', caption: 'An hour before: the moon’s bite out of the sun, the light dimming, the lamps’ pools coming up', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
    ], see: 'In the City During the Eclipse (?level=eclipse), the hour is noon, the middle of the eclipse. The developer panel’s Time of day (the hour) shows its phases: partial from 10:00, total from 11:15 to 12:45, the sun back by 14:00.' },
    { match: 'The References level has the City During the Eclipse’s four pictures', shots: [
      { name: 'eclipse-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): the square under the eclipse, the tables by the walls, the stair, the round tower', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'eclipse-refs-street', only: 'after', size: [1928, 538], caption: 'The fourth: down the street, the city falling away to the horizon, the corona in long fine rays', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ] },
    { match: 'A new world off the route, the Fallen Ring', shots: [
      { name: 'fallenring-arrival', only: 'after', caption: 'Out of the ship: the great arch over the plain, the long tube and its village, the segment leaning on its crushed vermilion foot', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'fallenring-village', only: 'after', caption: 'The village built into the long tube’s side, under its overhang, a service stair climbing to the crest', from: 'the world’s own screenshots, headless Chrome, High, 15:30 (7 October)' },
      { name: 'fallenring-end', only: 'after', caption: 'The tube’s broken end: the old street inside, lamplit and planted, Oro in the garden, the ramp up from the grass', from: 'the world’s own screenshots, headless Chrome, High, 13:00 (7 October)' },
      { name: 'fallenring-crest', only: 'after', caption: 'On the crest with Emrys: the arch’s leg with its storeys bared, the plain, the cumulus', from: 'the world’s own screenshots, headless Chrome, High, 16:30 (7 October)' },
      { name: 'fallenring-band', only: 'after', caption: 'Under the low segment on its posts: the street between the two rings of houses', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'fallenring-night', only: 'after', caption: 'The village at night, its windows lit under the tube', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Fallen Ring on the galactic map (or open the game with ?level=fallenring). Follow the path north to the long tube’s village; its stairs climb to the crest, and its broken end is east, past the last houses. Walk toward a herd and the beasts trot off.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 3 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome on Metal, 1280 × 720', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.19, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.3, after: null },
          { where: 'by the ship (spawn)', before: null, after: 1.61 },
          { where: 'the path, toward the tube', before: null, after: 1.96 },
          { where: 'the tube’s village', before: null, after: 2.01 },
          { where: 'the crest', before: null, after: 1.83 },
          { where: 'under the low segment', before: null, after: 2.33 },
        ] },
      ] },
    { match: 'The References level has the Fallen Ring’s four pictures', shots: [
      { name: 'fallenring-refs', only: 'after', size: [1608, 448], caption: 'The first picture (left) and its view in the game (right): the long tube and its village, the arch’s leg behind, the tilted segment', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'fallenring-refs-arch', only: 'after', size: [1608, 448], caption: 'The third: the arch swooping to its broken vermilion end, the slanted segment over the village', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=fallenring and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'A new world off the route, the Moon Foundry', shots: [
      { name: 'foundry-arrival', only: 'after', caption: 'Out of the ship on the apron: the hangar\u2019s mouth, the hung moons, the broken moon at the end of the aisle, the moon in its claws', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-gantry', only: 'after', caption: 'On the gantry, 13 m up: the way straight into the broken moon, the bowl garden on the left, the moon on its pillar', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-court', only: 'after', caption: 'Over the lip into the courtyard: the houses stacked under the shell\u2019s curve, mint trees, Wen counting moons', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-quarter-dusk', only: 'after', caption: 'The workers\u2019 quarter at dusk: homes made in the old machinery, the polishing drum with its lit windows, the bowl garden beyond', from: 'the world\u2019s own screenshots, headless Chrome, High, 18:24 (7 October)' },
    ], see: 'At the ship\u2019s holo table, choose the Moon Foundry on the galactic map (or open the game with ?level=moonfoundry). Walk north through the hangar\u2019s mouth; the gantry\u2019s stair rises on the right of the aisle, and the gantry goes straight into the broken moon, with a branch west to the bowl garden. Dun waits at the furnace, Wen in the courtyard, Emrys on the bowl.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of 60 frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', source: 'docs/systems/worlds.md, \u201cThe Moon Foundry\u201d', rows: [
          { where: 'the Signal Market\u2019s start (the budget)', before: 1.66, after: null },
          { where: 'the Signal Market\u2019s crowd', before: 1.51, after: null },
          { where: 'by the ship (spawn)', before: null, after: 1.51 },
          { where: 'the hangar\u2019s mouth, the widest view', before: null, after: 1.47 },
          { where: 'the gantry', before: null, after: 1.63 },
          { where: 'the courtyard', before: null, after: 1.33 },
          { where: 'the furnace', before: null, after: 1.44 },
        ] },
        { title: 'Draw calls, same views', unit: 'draws', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 \u00d7 720', rows: [
          { where: 'the Signal Market\u2019s start (the budget)', before: '361\u2013692', after: null },
          { where: 'the Moon Foundry, six views', before: null, after: '281\u2013391' },
        ] },
      ] },
    { match: 'In the Moon Foundry the last furnace still pours', shots: [
      { name: 'foundry-furnace', only: 'after', caption: 'The last furnace: the ladle tipped over the mould, the pour in bands of hot colour, the mouth glowing', from: 'the world\u2019s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'foundry-furnace-night', only: 'after', caption: 'The furnace at night', from: 'the world\u2019s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'In the Moon Foundry, walk east from the aisle near the hangar\u2019s mouth to the furnace and stand by the mould: the bands march down the stream, and the drone rises as you come close.' },
    { match: 'The References level has the Moon Foundry’s four pictures', shots: [
      { name: 'moonfoundry-refs-hung', only: 'after', size: [1938, 540], caption: 'The first picture (left) and its view in the game (right): the hung moon, the moon broken open round its courtyard, the bowl in its cradle', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'moonfoundry-refs-claws', only: 'after', size: [1938, 540], caption: 'The third: two moons in their claws, the far moon between the pillars, the bridge across', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=moonfoundry (or the worlds list, L, then the References and Tab to the Moon Foundry) and press \\ to set each picture beside its view.' },
    { match: 'A new world off the route, the Underside', shots: [
      { name: 'underside-arrival', only: 'after', caption: 'Out of the ship on the shelf’s top: its meadow, the white houses on it, the mountain’s face, the cloud beyond the edge', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-stair', only: 'after', caption: 'Down the great stair cut into the cliff: the shelf’s face beside it, its houses on the ledges, the town hung under it, the banners', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-walk', only: 'after', caption: 'The rope walk along the stair’s rock into the town under the shelf', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-bell', only: 'after', caption: 'The Bell Deck under the middle of the rock: its stalls, the houses hung from the rock down to it, the lamps', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-tip', only: 'after', caption: 'The deck at the tip of the shelf, looking out over the cloud at the far rocks and another shelf’s town', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-north', only: 'after', caption: 'The timber stair up the north face, the north gallery below it', from: 'the world’s own screenshots, headless Chrome, High, 7:36 (7 October)' },
      { name: 'underside-dusk', only: 'after', caption: 'The south gallery at dusk, the sun low under the shelf', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'underside-night', only: 'after', caption: 'The Bell Deck at night, by its lamps', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Underside on the galactic map (or open the game with ?level=underside). From the ship, walk to the top’s south-west corner and down the great stair; the rope walk at its foot goes north in under the shelf. Zazie is on the south gallery, Kip on the basket deck below it, Tiv at the tip. The timber stair up the north face brings you back to the top.' },
    { match: 'The References level has the Underside’s four pictures', shots: [
      { name: 'underside-refs', only: 'after', size: [1608, 448], caption: 'The third picture (left) and its view in the game (right): the nests under the shelf, the banners, the baskets on their long ropes, the cloud to the edge', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'underside-refs-dusk', only: 'after', size: [1608, 448], caption: 'The fourth: at dusk, the shelf’s face lit rose, its town, the flat cloud to the horizon, the stair up the cliff', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=underside (or the worlds list, L, then the References and Tab to the Underside) and press \\ to set each picture beside its view.' },
  ],
  '0.84': [
    { match: 'A new world off the route, the Glass Dunes', shots: [
      { name: 'glass-camp', caption: 'The Glass Dunes: the west camp under its ramp of sand, the cliff of the giants behind (16:30, the Handheld preset)', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', quality: 'handheld', hour: 16.5, player: [-100, 2, 40], heading: -1.571, eye: [-80, 5, 55], target: [-140, 10, 25], fov: 55 } },
      { name: 'glass-billows', caption: 'The billows in the morning, a glass flow over the sand and an archway at their foot', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', hour: 9, player: [120, 2, 60], eye: [100, 5, 110], target: [180, 20, 20], fov: 60 } },
      { name: 'glass-night', caption: 'The west camp at night: the kiln and the floats lit, an archway glowing in the glass', commit: 'ac98118a', only: 'after',
        view: { level: 'glassdunes', hour: 22, player: [-100, 2, 40], heading: -1.571, eye: [-85, 6, 55], target: [-140, 8, 25], fov: 60 } },
    ], see: 'On the ship, use the galactic map: the Glass Dunes are charted after the route from the start, tagged “a detour”. Or open ?level=glassdunes.' },
    { match: 'In the References level (the worlds list), the Glass Dunes’ four plates', shots: [
      { name: 'glass-ref-1', caption: 'The References: the Glass Dunes’ first plate, the green wall and the camp at the foot of its ramp (\\ compares it with the plate)', commit: 'ac98118a', only: 'after',
        view: { ref: 'glass-1-wall-camp', query: 'world=glassdunes', hour: null } },
      { name: 'glass-ref-4', caption: 'The fourth plate: the wave breaking over the camp, the walls and their silhouettes behind', commit: 'ac98118a', only: 'after',
        view: { ref: 'glass-4-wave', query: 'world=glassdunes', hour: null } },
    ], see: 'Open ?level=references&world=glassdunes and step through its four views with [ and ]; \\ lays the plate over the view.' },
    { match: 'A new world off the route, the City Behind the Waterfall', shots: [
      { name: 'falls-promenade', caption: 'The promenade along the falls, the lower town climbing the back wall, the small fall at the deep end', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'falls-balcony', caption: 'From a balcony behind the water: the terraces of rounded houses, the cafés on the promenade', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'falls-night', caption: 'The deep quarter at night: the falls glowing, the houses’ lamps and lit doors', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'Open the ship’s galactic map: the City Behind the Waterfall is charted beside the route. Walk from the landing into the cavern, along the promenade, out onto a balcony, and down the quay’s stair to the pool.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The City Behind the Waterfall”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.03, after: null },
          { where: 'the landing (spawn)', before: null, after: 1.1 },
          { where: 'the promenade', before: null, after: 1.24 },
          { where: 'the deep quarter', before: null, after: 1.12 },
        ] },
      ] },
    { match: 'Waterfalls are drawn the way the drawings draw them', shots: [
      { name: 'falls-curtain', caption: 'The curtain from the cavern mouth: the bands, the pen streaks and the slits of light', only: 'after', from: 'the world’s own screenshots, headless Chrome, High (7 October)' },
    ], see: 'Stand by the parapet on the promenade and watch the water: the bands keep their places while their breaks stream down; walk toward the falls and back to hear the roar rise and fall.' },
    { match: 'The References level has the City Behind the Waterfall’s four pictures', shots: [
      { name: 'refs-waterfall-terraces', caption: 'The picture (left) and its view (right): the terraces of domes beside the great fall', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'refs-waterfall-pink', caption: 'The picture (left) and its view (right): the city’s slope at the pink hour, the falls on the left', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open the References (?level=references&world=waterfall) and press Tab for the quick menu: the City Behind the Waterfall’s four views; the backslash key (View on a pad) compares each with its picture.' },
    { match: 'A new world off the route, the Salt Harbour', shots: [
      { name: 'saltharbour-arrival', only: 'after', caption: 'Out of the ship on the open salt: the street between the hulls, the houses on the first hull, the stair tower, the terracotta hull', from: 'the world’s own screenshots, headless Chrome, High, 10:30 (7 October)' },
      { name: 'saltharbour-street', only: 'after', caption: 'Up the street: the stair tower, the houses over the shops, the sailcloth, the ship stood on its stern at the end', from: 'the world’s own screenshots, headless Chrome, High, 10:00 (7 October)' },
      { name: 'saltharbour-deck', only: 'after', caption: 'At the top of the stair: the bridge onto the first hull’s deck, the gangway across to the terracotta hull, the street far below', from: 'the world’s own screenshots, headless Chrome, High, 14:00 (7 October)' },
      { name: 'saltharbour-upright', only: 'after', caption: 'At the street’s end: the ship that stands on its stern, its ropes staked all round it, Pip and the harbour folk', from: 'the world’s own screenshots, headless Chrome, High, 12:00 (7 October)' },
      { name: 'saltharbour-dusk', only: 'after', caption: 'The street at dusk', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'saltharbour-night', only: 'after', caption: 'The street at night, the houses’ windows lit', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Salt Harbour on the galactic map (or open the game with ?level=saltharbour). Walk north up the street; the stair tower stands against the first hull on the left, and the gangway further north along its deck crosses to the terracotta hull. Marrow waits by the ship, Corvin on the terracotta hull’s deck, Pip under the standing ship.' },
    { match: 'The References level has the Salt Harbour’s four pictures', shots: [
      { name: 'saltharbour-refs', only: 'after', size: [1928, 538], caption: 'The first picture (left) and its view in the game (right): the market in the cleft, the gangway, the terracotta hull and its ropes', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'saltharbour-refs-curtains', only: 'after', size: [1928, 538], caption: 'The third: the curtains hung from the high gangway, the arcade along the hull’s foot', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=saltharbour (or the worlds list, L, then the References and Tab to the Salt Harbour) and press \\ to set each panel beside its view.' },
    { match: 'A new world off the route, the Forest of Antennas', shots: [
      { name: 'antennas-arrival', only: 'after', caption: 'Out of the ship: the path winding north through the masts, the great nest saucers, the dishes on their lattices, Teb by the ship', from: 'the world’s own screenshots, headless Chrome, High, 15:30 (7 October)' },
      { name: 'antennas-plaza', only: 'after', caption: 'The plaza among the workshops, under the immense receiver; the maintenance bridge crossing to its balcony; Ottla by her lamp', from: 'the world’s own screenshots, headless Chrome, High, 16:30 (7 October)' },
      { name: 'antennas-deck', only: 'after', caption: 'On the observation deck with Lune at the end of the afternoon: the forest of masts to the haze, the bridge to the receiver', from: 'the world’s own screenshots, headless Chrome, High, 17:12 (7 October)' },
      { name: 'antennas-night', only: 'after', caption: 'The workshops at night, their windows lit under the receiver', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the Forest of Antennas on the galactic map (or open the game with ?level=antennas). Follow the path north to the workshops; the observation tower’s stair rises from the grass west of the receiver, and Lune waits on its deck. The fallen dish by the path can be walked into.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 3 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Forest of Antennas”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 2.31, after: null },
          { where: 'the Signal Market’s street (the budget)', before: 2.42, after: null },
          { where: 'by the ship (spawn)', before: null, after: 2.16 },
          { where: 'the path, toward the receiver', before: null, after: 2.17 },
          { where: 'the plaza', before: null, after: 2.39 },
          { where: 'the observation deck', before: null, after: 2.15 },
        ] },
      ] },
    { match: 'The Forest of Antennas hums', see: 'In the Forest of Antennas, walk from the ship toward the receiver: the hum rises as the masts close in and is loudest on the plaza and the balcony; listen for the crackle of static and, now and then, a thin whistle tuning in.' },
    { match: 'In the Forest of Antennas, far-off masts, wires and lattice struts stay steady', numbers: [
      { title: 'The motion check’s pan from the ship over the masts: pixels that flicker, per 10 000 a frame', unit: 'px', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720 (scripts/motion-check, the world frozen, a third of a pixel a frame)', source: 'docs/systems/rendering.md, “Thin bars at any distance”', rows: [
        { where: 'Handheld preset, the pan', before: 62.1, after: 20.0 },
        { where: 'Handheld preset, the drift', before: 8.9, after: 7.6 },
        { where: 'Handheld preset, looking far through the haze', before: 34.3, after: 31.5 },
        { where: 'High preset, the pan', before: 59.0, after: 39.0 },
      ], note: 'Before: the same world with every bar drawn at its own thickness. The masts, struts, wires and vines are pushed out to 1.5 pixels wide wherever they would be thinner; what still flickers is leaves, bushes and grass.' },
    ], see: 'Walk along the path and turn slowly: the thin struts of the far masts and the wires between them hold as lines instead of breaking into dots.' },
    { match: 'The References level has the Forest of Antennas’ four pictures', shots: [
      { name: 'antennas-refs', only: 'after', size: [1608, 448], caption: 'The first picture (left) and its view in the game (right): the path to the workshops under the immense receiver', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'antennas-refs-egg', only: 'after', size: [1608, 448], caption: 'The fourth: the great saucer over the egg and the domes, the stair to the platform', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=antennas and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'The References level has the Underwater City’s four pictures', shots: [
      { name: 'refs-underwater-cafes', caption: 'The first picture (left) and its view (right): the two cafés under their domes, the towers of pods, the manta', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'refs-underwater-terrace', caption: 'The fourth: the great café lit warm through its window, the lamps along the drop, the open sea', only: 'after', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=underwater (or the worlds list, L, then the References and Tab to the Underwater City) and step through its four views with [ and ]; \\ lays the picture over the view.' },
    { match: 'Under a sea, the water is drawn the way the drawings draw it', shots: [
      { name: 'sea-look', caption: 'The terrace view: the haze in steps with distance, the shafts from the surface, the ripples of light on the street', only: 'after', from: 'the References’ fourth Underwater City view, headless Chrome, High (7 October)' },
    ], see: 'In the References’ Underwater City views, or under any sea: walk and look about; the shafts stay where they are in the water as you move, and the lines of light drift slowly over what faces up.' },
    { match: 'A new world off the route, the Underwater City', shots: [
      { name: 'sea-avenue', caption: 'The avenue at dusk: the shell house and the glass café, the towers of pods, the glass columns, light falling in shafts', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 18:36 (7 October)' },
      { name: 'sea-over-city', caption: 'Over the avenue, sinking back down: the canal’s bridge, the cafés, the towers and their columns', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'sea-cafe', caption: 'The glass café: dry and lit warm inside, the sea outside', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 11:00 (7 October)' },
      { name: 'sea-night', caption: 'The avenue at night: the shafts gone, the lamps and the cafés lit', only: 'after', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'Open the ship’s galactic map: the Underwater City is charted beside the route (or open ?level=underwater). Walk up from the ship along the lamps, into a café, over the canal’s bridge to the plaza, up the terrace’s stairs to the edge; jump and swim up among the towers.',
      numbers: [
        { title: 'The Handheld preset (render scale 0.75, no dynamic resolution), a synced loop of frames, median of 7 rounds', unit: 'ms', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Underwater City”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 1.51, after: null },
          { where: 'the Signal Market’s street', before: 1.6, after: null },
          { where: 'the landing (spawn)', before: null, after: 1.53 },
          { where: 'the avenue', before: null, after: 1.62 },
          { where: 'swimming among the towers', before: null, after: 1.37 },
          { where: 'in a café', before: null, after: 1.49 },
        ] },
        { title: 'Draw calls a frame, the same places', unit: 'draws', better: 'lower', device: 'Mac (M4 Pro), headless Chrome, 1280 × 720', source: 'docs/systems/worlds.md, “The Underwater City”', rows: [
          { where: 'the Signal Market’s spawn (the budget)', before: 596, after: null },
          { where: 'the landing (spawn)', before: null, after: 301 },
          { where: 'the avenue', before: null, after: 241 },
          { where: 'swimming among the towers', before: null, after: 128 },
        ] },
      ] },
    { match: 'Deep under a sea you walk its floor', shots: [
      { name: 'sea-swim', caption: 'Holding jump: rising off the avenue', only: 'after', from: 'the world’s own screenshots, headless Chrome, High (7 October)' },
    ], see: 'In the Underwater City, walk the avenue, then jump (A / ×) and hold it to rise toward a tower’s pods; let go over a pod’s deck to land on it. Walk into a café’s door: you are out of the water.' },
  ],
  '0.83': [
    { match: 'Once four worlds are behind you, a faint signal pulses', shots: [
      { name: 'relay-signal', caption: 'The galactic map six worlds along: the Signal Market, not charted yet, pulses as “a signal” (home’s panel says where it is)', commit: '1af87675',
        view: { level: 'edena', hud: true, save: saveAlong(6), setup: 'window.ship.map.toggle(true)', wait: 2500 } },
      { name: 'relay-charted', caption: 'Nine worlds along, the market charted: its panel says what the receiver hears from it', commit: '1af87675',
        view: { level: 'buried', hud: true, save: saveAlong(9), setup: "window.ship.map.toggle(true); window.ship.map.select(window.ship.map.entries.findIndex((e) => e.id === 'bazaar'))", wait: 2500 } },
    ], see: 'From four worlds done, open the galactic map at the ship’s holo table: the Signal Market’s place pulses, named or not. With no message waiting, the cockpit’s voicemail says where the signal comes from, and its screen reads RELAY SIGNAL. After the market, step out of the ship and back in: the held recording waits at the voicemail, and after it the father’s own.' },
    { match: 'Your mother’s note in the ship’s galley', see: 'Aboard the ship, the note pinned to the rib by the galley.' },
    { match: 'At the stone at home, the listening shell and the echo shell', shots: [
      { name: 'stone-shells', caption: 'The slab after the ending, every gift on it: the listening shell (white) and the echo shell (brass) among them now', commit: 'f333d23b',
        view: { level: 'home', eye: [-6.22, 1.25, 14.96], target: [-6.47, 0.3, 16.41], fov: 50, hour: 16, player: [-9, 0, 12],
          save: saveAlong(11, { 'ending.done': true, 'ending.keepsake': 'all', ...Object.fromEntries(GIFTS.map((g) => [`item.${g}`, true])), 'home.stone': GIFTS.map((g) => `item.${g}`) }) } },
    ], see: 'Find the listening shell and the echo shell in the makers’ boxes before you go home; or, after the ending, carry them to the stone and pay your respects.' },
    { match: 'What happened at Esk’s terraces in Viridel', see: 'The game menu’s Quests page after the terraces have gone (“What happened”). Then leave Viridel, come back, and talk to Esk on the bottom terrace.' },
    { match: 'Viridel closes with a few words of its own', see: 'Tell Mira what was under the flowers on Odile and Talo’s ship: the toast as the world’s quest ends.' },
    { match: 'In the Buried Machine, Wen has thought about the old story', see: 'After Tooth Day, talk to Wen by the great dome and ask about the last tooth; then talk to Hask on his bench.' },
    { match: 'Everyone has a name of their own now', see: 'The Hangar’s girl with the ball (Zazie), Viridel’s climbing child (Rue), the seller of views on the City-Shaft’s rim (Tobin), the Buried Machine’s listener (Ket) and boy (Jot), the keeper of Vael’s stone hand (Kesh), the spheres’ listener (Linnet) and hill-climber (Emrys), the Undertower’s guide (Hobb), Vael II’s bridge keeper (Agathe), the desert’s dune walker (Rima), stone listener (Dalia) and sketcher (Naji). The credits list them.' },
    { match: 'Vael II’s people sound more like themselves', see: 'In Vael II, talk to Brother Calix, Mother Ysolde, Ondine on the plain, Tiv at the cairn, and Agathe on the founders’ bridge once the stones come down.' },
    { match: 'Halfway down the City-Shaft, by the middle levels’ cab stop', shots: [
      { name: 'halfway-stall', caption: 'The middle levels’ promenade, ten metres from the cab stop: Perrine’s halfway tea stall, the mirror on its pole, a relic on the awning', commit: 'dab14faa',
        view: { level: 'incal', eye: [211.93, -22.0, 27.45], target: [213.92, -22.5, 33.01], fov: 55, player: [212.98, -23.7, 23.16], save: saveAlong(6, { 'item.jetpack': true }) } },
    ], see: 'Take a cab to the middle levels (or fly down to the terrace at −24 m) and walk along the promenade: talk to Perrine, wash the mirror (shoot) and push its frame round from the side until it faces up the shaft. With the Lodestar lit, its glass glows, and Ossa at the bottom has something to say.' },
    { match: 'A few quiet places have something to say now', see: 'In Vael, walk up to the fallen giant’s face on the plain; in the desert, look up at the lintel of the Givers’ Hearth’s door, look at the little mask inside the masked head in the southern dunes, and read the slate by the hut at the crashed hull, then meet Marrow again.' },
    { match: 'The City-Shaft’s terraces go all the way round the shaft now', shots: [
      { name: 'shaft-rings-above', caption: 'The shaft from above the high terrace, looking down: before, each level’s sectors sat on top of each other and most of every ring was empty; after, they go round the pit', size: [1024, 768],
        from: 'the fix’s own screenshots, the two builds side by side in headless Chrome, Handheld, the same camera and hour (7 October)' },
      { name: 'shaft-rings-across', caption: 'From the far side of the rim, across the shaft toward the spire', size: [1024, 768],
        from: 'the fix’s own screenshots, the two builds side by side in headless Chrome, Handheld, the same camera and hour (7 October)' },
    ], numbers: [
      { title: 'Draws a frame', unit: 'draws', better: 'lower', device: 'Mac, headless Chrome, Handheld preset, render scale 0.75 (averaged over 12 frames)', source: 'docs/systems/performance.md, “The City-Shaft’s terraces round the ring”', rows: [
        { where: 'the rim, where you arrive', before: 841, after: 950 },
        { where: 'the wide view down the shaft from the rim', before: 1113, after: 1201 },
      ], note: 'More of the town is in view now that the rings are whole; the railings drawn with the terraces’ iron took back 55–90 of the draws it added.' },
      { title: 'JavaScript a frame, the CPU slowed ×4', unit: 'ms', better: 'lower', device: 'Mac, headless Chrome, Handheld preset (six alternating runs, medians)', source: 'docs/systems/performance.md', rows: [
        { where: 'the rim, where you arrive', before: 23.2, after: 25.2 },
        { where: 'the wide view down the shaft from the rim', before: 25.4, after: 27.3 },
      ], note: 'A second run: 22.7 → 24.3 and 27.0 → 28.8. The city’s crowd is about as large as before (1 373 → 1 505 people), spread round the whole ring.' },
    ], see: 'In the City-Shaft, look down into the pit from the rim, or fly out over the middle on the jets: every level’s terrace now rings the shaft, with only narrow gaps between its stretches.' },
    { match: 'A new world off the route, the White Mangrove', shots: [
      { name: 'mangrove-arrival', only: 'after', caption: 'Out of the ship on the White Mangrove’s landing island at dusk: the landing stage, Bram, the walk to the great tree', from: 'the world’s own screenshots, headless Chrome, High, 17:48 (7 October)' },
      { name: 'mangrove-deck', only: 'after', caption: 'From the deck round the great tree: a house, the ring walk and a spoke, the next tree’s stair and its deck', from: 'the world’s own screenshots, headless Chrome, High, 17:48 (7 October)' },
      { name: 'mangrove-water', only: 'after', caption: 'Swimming in the black lake among the roots, the bridges and stairs overhead', from: 'the world’s own screenshots, headless Chrome, High, 18:12 (7 October)' },
      { name: 'mangrove-night', only: 'after', caption: 'The walk from the landing stage at night', from: 'the world’s own screenshots, headless Chrome, High, 22:30 (7 October)' },
    ], see: 'At the ship’s holo table, choose the White Mangrove on the galactic map (or open the game with ?level=mangrove). Walk north from the landing stage to the great tree and climb its stair; Oyo is on the deck, Fen by the stair of a tree to the north-west, Bram at the landing.' },
    { match: 'The References level has the White Mangrove’s four pictures', shots: [
      { name: 'mangrove-refs', only: 'after', size: [2920, 816], caption: 'The first picture (left) and its view in the game (right): the landing stage, the lit roots, the long walk', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
      { name: 'mangrove-refs-causeway', only: 'after', size: [2920, 816], caption: 'The fourth: the pale causeway and the tree towers', from: 'the views’ own contact sheets, headless Chrome, High (7 October)' },
    ], see: 'Open ?level=references&world=mangrove (or the worlds list, L, then the References and Tab to the White Mangrove) and press \\ to set each panel beside its view.' },
  ],
  '0.82': [
    { match: 'The camera follows closer', shots: [
      { name: 'camera-desert', caption: 'Open desert, the camera as it starts: before 9.5 m back and high; after 6.4 m back, lower, the traveller a quarter of the view', from: 'the camera work’s own screenshots, before and after, the same spot, heading and hour (7 October)' },
      { name: 'camera-qanat', caption: 'Qanat, inside the main gate', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
      { name: 'camera-market', caption: 'The Signal Market’s street, where you arrive', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
    ], numbers: [{ title: 'The open camera, as a world starts', unit: 'm', better: 'lower', device: 'any', rows: [
      { where: 'arm (look point to camera)', before: 9.5, after: 6.4 },
      { where: 'camera height over the feet', before: 3.9, after: 3.0 },
    ], source: 'docs/systems/movement-and-camera.md' }] },
    { match: 'In closed spaces (the ship, temples', shots: [
      { name: 'camera-ship', caption: 'Inside the ship, by the hatch: before 2.6 m back over the right shoulder; after 1.9 m, at shoulder height', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
      { name: 'camera-temple', caption: 'The desert temple’s first hall', from: 'the camera work’s own screenshots, before and after, the same spot and heading (7 October)' },
    ], see: 'Walk up the ship’s ramp, or into a corridor with a wall close on your right: the camera eases in over your left shoulder and stays there; hold LT / L2 (or the right mouse button) to aim and it moves over the right.' },
    { match: 'The traveller moves more like a person at the moments that used to look mechanical', shots: [
      { name: 'captured-start', caption: 'Setting off at a walk (the stick half way), a frame every tenth of a second from the side: before, the jog loop hunches him forward; after, Mixamo’s captured start keeps him upright, arms swinging', size: [1280, 237], from: 'the Motion page’s frame strips (motionPage.sheet), the same scripted run before and after (7 October)' },
      { name: 'captured-stop', caption: 'Letting go of the stick at a walk, seen from in front: after, the captured stop throws his arms out to brake; the feet land in the same places', size: [1280, 237], from: 'the Motion page’s frame strips, the same run before and after (7 October)' },
      { name: 'captured-pivot', caption: 'Doubling back at a run: after, the head and shoulders turn into it first', size: [1280, 237], from: 'the Motion page’s frame strips, the same run before and after (7 October)' },
    ], numbers: [
      { title: 'Foot sliding (the worst contact)', unit: 'm', better: 'lower', device: 'Node, the gait harness on the coral-shirt traveller (scripts/mocap/compare.mjs)', source: 'docs/systems/animation.md, “Captured starts, stops and turns over the loops”', rows: [
        { where: 'walk, run, turn back, stop', before: 0.11, after: 0.11 },
        { where: 'walk, quarter turn, stop', before: 0.08, after: 0.08 },
        { where: 'turn round on the spot', before: 0.09, after: 0.09 },
        { where: 'slow walk, stop', before: 0.05, after: 0.05 },
        { where: 'the same with motion matching instead (not used)', before: 0.11, after: 0.25 },
      ] },
      { title: 'How fast the pose answers the stick', unit: 's', better: 'lower', device: 'Node, the gait harness on the coral-shirt traveller', source: 'docs/systems/animation.md', rows: [
        { where: 'from standing, the stick pushed: a foot off the ground', before: 0.13, after: 0.13 },
        { where: 'slow walk: a foot off the ground', before: 0.17, after: 0.17 },
        { where: 'letting go at a walk: both feet held', before: 0.9, after: 0.9 },
        { where: 'facing back after turning at a run', before: 0.3, after: 0.3 },
      ] },
      { title: 'The traveller’s animation a frame (walking, stopping, turning, jumping about the desert)', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/animation.md, “The traveller’s captured moves”: two runs each, the captured moves off (before) and on', rows: [
        { where: 'the player’s whole update, run 1', before: 1.64, after: 1.43 },
        { where: 'the player’s whole update, run 2', before: 1.76, after: 1.71 },
        { where: 'the Animator', before: '0.22–0.26', after: '0.21–0.25' },
      ], note: 'within the run-to-run noise: the moves cost nothing measurable' },
    ], see: 'Walk with the stick half way and let go, tap back to turn round on the spot, or run and pull back: the body above the legs follows the capture. The dev menu’s Motion section switches it off to compare.' },
    { match: 'Knocked down, the traveller gets up as a person does', shots: [
      { name: 'getup-stomach', caption: 'Knocked forward onto his face: before, the kneel; after, Mixamo’s get-up from the stomach, placed where he lies', size: [1280, 143], from: 'the Motion page’s frame strips, the same knockdown before and after (7 October)' },
      { name: 'getup-back', caption: 'Knocked back: after, he sits up and rises from his back', size: [1280, 143], from: 'the Motion page’s frame strips, the same knockdown before and after (7 October)' },
    ], numbers: [
      { title: 'Lying to standing', unit: 's', better: 'lower', device: 'the game’s timing (src/ragdoll.js GET_UP, KNOCK)', source: 'docs/systems/animation.md, “The traveller’s captured moves”', rows: [
        { where: 'from the back', before: 1.25, after: 1.45 },
        { where: 'from the stomach', before: 1.25, after: 2.05 },
      ], note: 'the captured get-ups play at twice their pace; the kneel was quicker, but the same for every fall' },
    ] },
    { match: 'Jumps and landings look caught from life', shots: [
      { name: 'running-jump', caption: 'A running jump, from behind: before, a frog-legged tuck with the arms straight out; after, the captured stride through the air', size: [1280, 216], from: 'the Motion page’s frame strips, the same jump before and after (7 October)' },
      { name: 'drop', caption: 'Walking off a 1.44 m ledge toward the camera: after, the captured landing’s deep crouch', size: [1280, 216], from: 'the Motion page’s frame strips, the same drop before and after (7 October)' },
    ], see: 'Run and jump, walk off a ledge, fall from a roof at a run, or climb a wall and jump off it (A / × while climbing). The flight itself is as before: the same height, the same time in the air, the same place to land.' },
    { match: 'Standing still a while, he now and then looks about him', see: 'Stand still: after 7 s he looks about him (Mixamo’s look-around), later breathes a while, then the old look-around, ten seconds apart. Only the body above the legs moves: the feet stay planted to the millimetre (tests/idle-legs.test.js stands him 36 s).' },
    { match: 'Picking something up off the ground he goes down on one knee', shots: [
      { name: 'kneel', caption: 'Picking something up: down on one knee, a look at it, and up again (E pressed at 0.5 s)', only: 'after', size: [1280, 216], from: 'the Motion page’s frame strip (7 October)' },
      { name: 'pet', caption: 'Petting Moustache: kneeling, a hand reached out to him', only: 'after', size: [1280, 216], from: 'the Motion page’s frame strip (7 October)' },
    ], see: 'Pick up a feather in Vael, a flower at home, or pet Moustache at home: walking off stands him up at once.' },
  ],
  '0.81': [
    { match: 'What’s new (N) has a See what changed button', shots: [
      { name: 'see-what-changed', caption: 'This page: a line of v0.77 with its before and after, the split dragged to the left', only: 'after', size: [1440, 900], from: 'a screenshot of changelog.html (7 October)' },
    ] },
  ],
  '0.80': [
    { match: 'Crowded places run smoother on handhelds', numbers: [
      { title: 'A frame at the camps and in the Signal Market’s crowd', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/performance.md, “The people posed without recomputing what was current”', rows: [
        { where: 'the camps: the whole frame', before: 25.7, after: 22.8 },
        { where: 'the camps: the people’s update', before: 6.1, after: 4.9 },
        { where: 'the Signal Market’s crowd: the whole frame', before: 14.0, after: 13.2 },
        { where: 'the Signal Market’s crowd: the people’s update', before: 3.6, after: 2.9 },
      ] },
      { title: 'On the device: the people’s update a frame (round 1 → 7 October, with v0.77–0.80 in)', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the camps', before: 5.34, after: 3.88 },
        { where: 'Qanat', before: 4.79, after: 3.94 },
        { where: 'the walk through the camps', before: 5.61, after: 4.01 },
      ] },
      { title: 'On the device: frames a second (round 1 → 7 October)', unit: 'fps', better: 'higher', device: RETROID, rows: [
        { where: 'the camps', before: 45, after: 56 },
        { where: 'Qanat', before: 49, after: 57 },
        { where: 'the walk through the camps', before: 44, after: 51 },
      ] },
    ], see: 'Nothing looks different: the people are posed to the same float as before (checked bone by bone, frame by frame); it is the time each frame takes that went down.' },
    { match: 'On the Handheld and Steam Deck settings the grass grows further', see: 'On the Handheld or Steam Deck setting, walk into the Garden of Spheres’ meadows or the dry grass round home: the blades reach well ahead of the traveller instead of stopping a few steps in front of him. (A still picture barely shows it: the numbers say how far.)', numbers: [
      { title: 'How far the grass grows round you', unit: 'm', better: 'higher', device: 'the Handheld and Steam Deck settings', source: 'docs/systems/performance.md, “What the Handheld and the Deck lose next to High”', rows: [
        { where: 'Handheld: the full grass', before: 11.5, after: 14 },
        { where: 'Handheld: the far, thinner grass', before: 26, after: 36 },
        { where: 'Steam Deck: the full grass', before: 13.5, after: 16 },
        { where: 'Steam Deck: the far, thinner grass', before: 30, after: 40 },
      ] },
      { title: 'What it costs, walking the Garden’s bench path', unit: 'ms', better: 'lower', device: MAC_X4, rows: [
        { where: 'the processor a frame', before: 11.6, after: 11.5 },
        { where: 'the graphics a frame', before: 7.3, after: 7.3 },
      ] },
    ] },
    { match: 'On the Steam Deck, a game that closes unexpectedly after you have been playing', see: 'Nothing to see while it works: if the game ever closes by itself after you have played a while (or something closes it), Steam returns to its library, and the next launch draws the way it did before instead of switching to a slower one.' },
  ],
  '0.79': [
    { match: 'Cloaks hang over people’s arms now', shots: [
      { name: 'cloak-arms', caption: 'Bako and the Speaker from in front and from three-quarters, in the running game', commit: 'a526f2e', view: people([{ id: 'bako' }, { id: 'bako', yaw: 0.8 }, { id: 'speaker' }, { id: 'speaker', yaw: -0.8 }]) },
    ], numbers: [
      { title: 'Of each person’s hands and forearms, the share the cloak covered (idle / walking / talking)', unit: '%', better: 'lower', device: 'the character studio, MakeHuman bodies', rows: [
        { where: 'Bako', before: '51–84', after: 0 },
        { where: 'the Speaker', before: '51–65', after: 0 },
        { where: 'Nour', before: '31–41', after: 0 },
        { where: 'Ama, talking', before: 42, after: 0 },
        { where: 'Hessa, talking', before: 31, after: 0 },
      ] },
    ] },
    { match: 'Bako’s bag hangs over his cloak', shots: [
      { name: 'bako-bag', caption: 'Bako from in front, three-quarters and the side', commit: '3221594', before: '27ffa13^', view: people([{ id: 'bako' }, { id: 'bako', yaw: 0.8 }, { id: 'bako', yaw: 1.57 }]) },
    ] },
    { match: 'Sefa slings her oud on her back', shots: [
      { name: 'sefa-walk', caption: 'Sefa walking, from behind and from the side, in the character studio', commit: 'df5f5c4', view: studio('who=npc&world=desert&npc=sefa&source=makehuman&anim=game:walk&time=0.6&yaw=2.6', [1280, 720]) },
      { name: 'marrow-walk', caption: 'Marrow walking, in the character studio', commit: 'df5f5c4', view: studio('who=npc&world=desert&npc=marrow&source=makehuman&anim=game:walk&time=0.6&yaw=2.2', [1280, 720]) },
    ] },
    { match: 'In Vael II the needle spires and the mushroom tables', shots: [
      { name: 'vael2-needles', caption: 'The References’ view of the needles against the peach sky', commit: 'bb521ba', view: { ref: '3783-spires' } },
      { name: 'vael2-tables', caption: 'The References’ view under the mushroom, the plain and its tower', commit: 'bb521ba', view: { ref: '3783-mushroom-plain' } },
    ] },
    { match: 'The cracks in Vael II’s peach plain', shots: [
      { name: 'vael2-crevasse', caption: 'The References’ view of the crevasse, the tower and the far sea of cloud', commit: 'cdb7daa', view: { ref: '3785-crevasse' } },
    ] },
    { match: 'Vael II’s sea of cloud is printed flat', shots: [
      { name: 'vael2-cloud', caption: 'Vael II from over its start at 9 in the morning, the sea of cloud below', commit: 'a5a6b41', view: { level: 'arzach2', hour: 9, player: [0, 41.13, 22], eye: [0, 70, 31.27], target: [-48.35, 40.65, 11.66] } },
      { name: 'vael2-cloud-afternoon', caption: 'The same at 4 in the afternoon', commit: 'a5a6b41', view: { level: 'arzach2', hour: 16, player: [0, 41.13, 22], eye: [0, 70, 31.27], target: [-48.35, 40.65, 11.66] } },
    ] },
    { match: 'At dusk and at night Vael II’s shadows', shots: [
      { name: 'vael2-dusk', caption: 'Vael II’s start at dusk', commit: '02974b3', view: { level: 'arzach2', hour: 18.6, player: [0, 41.13, 22], eye: [0, 45, 31.27], target: [0, 42.82, 21.51] } },
      { name: 'vael2-night', caption: 'The same at night', commit: '02974b3', view: { level: 'arzach2', hour: 22, player: [0, 41.13, 22], eye: [0, 45, 31.27], target: [0, 42.82, 21.51] } },
    ] },
    { match: 'The game menu’s Quests panel lists everything', see: 'Finish the desert’s first quest, travel to Vael and open the game menu (View / Select, or J): Quests lists the desert’s quest under Done instead of “None yet”.' },
    { match: 'In the Sketchbook, a story you told on an older save', see: 'Load a save from before the story pages (v0.6x) whose story you had told, open the game menu’s Sketchbook: that world’s story reads as told.' },
    { match: 'The Buried Machine’s drum is lined', shots: [
      { name: 'buried-drum', caption: 'The References’ view of the traveller in the drum', commit: '27255e7', before: '6de2ddd^', view: { ref: '3791-oculus-traveller' } },
      { name: 'buried-teal-hall', caption: 'The References’ view of the porthole in the teal hall', commit: '27255e7', before: '6de2ddd^', view: { ref: '3790-teal-porthole' } },
    ] },
    { match: 'Under the City-Shaft’s terraces', see: 'In the City-Shaft, look up from a lower terrace at the blue underside of the one above: pipes, casings and plates hang between its ribs.' },
    { match: 'The undersides of Vael II’s mushroom tables', shots: [
      { name: 'vael2-caps', caption: 'The References’ view up under the giant cap', commit: '87d6195', view: { ref: '3787-giant-cap' } },
      { name: 'vael2-under-cap', caption: 'The References’ view under the great cap, the birds and the traveller', commit: '87d6195', view: { ref: '3786-under-cap' } },
    ] },
    { match: 'The Signal Market’s back alleys', shots: [
      { name: 'market-alley', caption: 'Into a back alley off the Signal Market’s street', commit: 'dfa7e07', view: { level: 'bazaar', player: [-24, 0, 73], eye: [-26, 5, 73], target: [-52, 9, 73], fov: 60 } },
    ] },
    { match: 'Stepping out of a cab beside a building', see: 'In the Signal Market or the City-Shaft, ride a cab to a stop beside a wall and step out (E, or B / ○): the camera stays outside the cab.' },
    { match: 'E (B / ○) uses what you are facing', shots: [
      { name: 'cab-prompt', caption: 'Facing a parked cab with people about: the prompt over it says what E will do', only: 'after', size: [1280, 633], from: 'the interaction work’s own screenshot (7 October)' },
    ], see: 'Walk up to a parked cab with someone standing at your shoulder: the prompt over the cab says it will get you in, and E (B / ○) does.' },
  ],
  '0.78': [
    { match: 'The City-Shaft looks more like its drawings', shots: [
      { name: 'shaft-wide', caption: 'Across and down the shaft to its lake', commit: '0bb9a0a', view: { level: 'incal', player: [274, 200, 0], eye: [283.27, 228.87, 0], target: [2.6, -46.8, 8.11] } },
    ] },
    { match: 'The Signal Market’s stalls are full now', shots: [
      { name: 'market-stalls-ref', caption: 'The References’ view of the long street of stalls', commit: '17d2e92', before: 'af8e8c6^', view: { ref: '3808-long-street' } },
    ] },
    { match: 'In the Buried Machine the trench walls are a mass of pipes', shots: [
      { name: 'buried-trench', caption: 'The References’ view of the domes on the ridge and the pipes in the trench', commit: '86c6ee4', view: { ref: '3789-domes-trench' } },
      { name: 'buried-city', caption: 'The References’ view of the ring and the city hanging over it', commit: '86c6ee4', view: { ref: '3789-city-ring' } },
    ] },
    { match: 'The desert’s canyon walls and violet cliffs', shots: [
      { name: 'violet-cliffs', caption: 'The References’ view of the turquoise pool in the violet cliffs', commit: '74f6ff6', view: { ref: '3774-violet-pool' } },
    ] },
    { match: 'A wall turned away from the sun now stays in full shadow', see: 'In the Signal Market or Qanat, look at a wall turned from the sun with another building between it and the sun: it is one even shadow, not a lighter half-tone patch.' },
    { match: 'Where sand has banked against an old wall', see: 'Walk along Qanat’s outer wall where the sand banks against it: the pale band of dust at the wall’s foot follows the top of the sand.' },
    { match: 'The plaster is stained darker round the doors', see: 'Walk up to a door in Qanat, at home, in the Signal Market or at Vael II’s monastery: the plaster round it is darker, worn by hands.' },
    { match: 'In the References level the gorge under the rope bridges', shots: [
      { name: 'gorge-shadow', caption: 'The References’ view of the rope bridges over the gorge', commit: '22c1b63', view: { ref: 'bridges' } },
    ] },
    { match: 'In the References level the Signal Market’s panels', shots: [
      { name: 'ref-market-crowd', caption: 'The crowded skybridge and the round towers', commit: 'af8e8c6', view: { ref: '3804-crowded-bridge' } },
      { name: 'ref-market-cabs', caption: 'The bridge between the towers, cabs under it', commit: 'af8e8c6', view: { ref: '3807-bridge-cabs' } },
      { name: 'ref-shaft-balcony', caption: 'The balcony over the slot in the City-Shaft', commit: '0bb9a0a', view: { ref: '3782-balcony' } },
    ] },
    { match: 'Looking across the City-Shaft is lighter on handhelds', numbers: [
      { title: 'Draw calls in close views of the towers', better: 'lower', device: 'headless Chrome, Handheld preset', source: 'docs/systems/performance.md, “Round 3, on the Mac”', rows: [
        { where: 'a tower close by', before: 313, after: 141 },
        { where: 'another', before: 328, after: 110 },
        { where: 'a third', before: 547, after: 115 },
      ] },
      { title: 'The processor’s work a frame', unit: 'ms', better: 'lower', device: MAC_X4, rows: [
        { where: 'the rim', before: 35.6, after: 31.3 },
        { where: 'the wide view across the shaft', before: 39.8, after: 37.3 },
      ] },
      { title: 'On the device: draw calls (the Retroid’s second round → 7 October)', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the wide view', before: 1326, after: 1140 },
        { where: 'the rim', before: 960, after: 868 },
      ] },
      { title: 'On the device: the G-buffer’s work on the processor a frame (round 1 → 7 October)', unit: 'ms', better: 'lower', device: RETROID, rows: [
        { where: 'the wide view', before: 8.45, after: 5.92 },
        { where: 'the rim', before: 6.67, after: 4.69 },
      ] },
    ], see: 'The towers look exactly as before (0.001–0.16 % of the pixels apart, the moving things; on the Retroid too, the same views merged and unmerged differ only where cabs, people and the airship moved): the gain is in how they are drawn.' },
  ],
  '0.77': [
    { match: 'The traveller’s face moves now', see: 'Talk to anyone and watch the traveller in the conversation’s close-up: he smiles, frowns or looks worried with what is said, blinks, glances about, and his mouth moves as he speaks.' },
    { match: 'The fluid tank is the glass jar', shots: [
      { name: 'flask', caption: 'The traveller from behind, the tank on his back', commit: 'c3cceb8', view: people([{ id: 'traveller', yaw: 2.6, dist: 2.6, height: 1.2 }, { id: 'traveller', yaw: 3.14, dist: 2.2, height: 1.3 }], { player: [29, 24.456, 132], heading: 0.6435 }) },
    ] },
    { match: 'On handhelds every world runs a little smoother around the traveller', numbers: [
      { title: 'The traveller’s shirt: its work on the processor a frame', unit: 'ms', better: 'lower', device: MAC_X4, source: 'docs/systems/performance.md, “The traveller’s overshirt on the GPU”', rows: [
        { where: 'the shirt’s update (median 0.2–0.5)', before: 3.5, after: 0.5 },
        { where: 'positions and normals sent to the graphics chip a frame (kB)', before: 260, after: 16 },
      ] },
      { title: 'On the device: the traveller’s whole update a frame, shirt and all (round 1 → 7 October)', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the desert’s spawn', before: 2.81, after: 1.11 },
        { where: 'the dunes', before: 3.5, after: 1.33 },
        { where: 'the City-Shaft, wide', before: 2.99, after: 1.11 },
      ] },
    ] },
    { match: 'In the Garden of Spheres the white hill is carved', shots: [
      { name: 'garden-white-hill', caption: 'The References’ view of the white hill and the stepped pyramid on top', commit: '8d8a6e4', before: '702658c^', view: { ref: '3793-white-hill' } },
    ] },
    { match: 'The Garden’s olives and shrubs', shots: [
      { name: 'garden-olives', caption: 'The References’ view of the olive grove round the plaza', commit: '8d8a6e4', before: '702658c^', view: { ref: '3793-olive-plaza' } },
      { name: 'garden-hedges', caption: 'The round plaza between the fruit hedges', commit: '8d8a6e4', before: '702658c^', view: { ref: '3795-plaza-hedges' } },
    ] },
    { match: 'The undersides of the great umbrella trees', shots: [
      { name: 'garden-umbrellas', caption: 'The References’ view under the canopies, the pyramids beyond', commit: '8d8a6e4', before: '702658c^', view: { ref: '3794-canopies-pyramids' } },
    ] },
    { match: 'The round plaza is paved', shots: [
      { name: 'garden-plaza', caption: 'The References’ view of the golden sphere setting behind the plaza', commit: '8d8a6e4', before: '702658c^', view: { ref: '3796-golden-sphere-plaza' } },
    ] },
    { match: 'The robot statue in the android wood', shots: [
      { name: 'garden-robot', caption: 'The References’ view of the white ruins in the wood', commit: '8d8a6e4', before: '702658c^', view: { ref: '3794-wood-ruins' } },
    ] },
    { match: 'In Lorn II the great roots are tangles', shots: [
      { name: 'lorn2-arches', caption: 'The References’ view under the root arches, the stream', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-root-arches' } },
      { name: 'lorn2-cave', caption: 'The traveller before the root cave', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-cave-traveller' } },
    ] },
    { match: 'Lorn II’s roots and the bushes on its banks', shots: [
      { name: 'lorn2-hatching', caption: 'The References’ view down the stream between the trunks', commit: '799d4df', before: 'c04f540^', view: { ref: '3798-stream-trunks' } },
    ] },
    { match: 'Look up near the start of Lorn II’s path', shots: [
      { name: 'lorn2-nest', caption: 'The References’ view of the nest of eggs in the great mushroom', commit: '799d4df', before: 'c04f540^', view: { ref: '3797-nest-shroom' } },
    ] },
    { match: 'The desert’s people carry the rest', shots: [
      { name: 'nour-marrow', caption: 'Nour and Marrow from in front and three-quarters, in the running game', commit: 'c69e864', view: people([{ id: 'nour' }, { id: 'nour', yaw: 0.8 }, { id: 'marrow' }, { id: 'marrow', yaw: 0.8 }]) },
      { name: 'sefa-speaker', caption: 'Sefa and the Speaker', commit: 'c69e864', view: people([{ id: 'sefa' }, { id: 'sefa', yaw: -0.8 }, { id: 'speaker' }, { id: 'speaker', yaw: 0.8 }]) },
    ] },
    { match: 'Sefa’s oud no longer pokes through her cloak', see: 'In the desert, follow Sefa as she walks between the camps and Qanat: her cloak swings round the oud instead of the oud showing through it.' },
    { match: 'The desert sand no longer looks bare at noon', shots: [
      { name: 'noon-pebbles', caption: 'The sand at your feet on a dune’s crest at half past twelve', commit: 'e2b43ad', view: desertAt([-203, 23.5, 303], [-208, 21.2, 308], { fov: 28, hour: 12.5, player: [-198, 22, 298] }) },
    ], numbers: [
      { title: 'Pebbles on open sand (dark spots in 10 000 pixels)', better: 'higher', device: 'Mac, the clock fixed, cloud shadows and wind off', source: 'the commit’s measurements (e2b43ad)', rows: [
        { where: 'noon, looking ahead', before: 30, after: 46 },
        { where: 'noon, looking down', before: 23, after: 35 },
        { where: '10 in the morning', before: 33, after: 35 },
        { where: 'for comparison: 8 in the morning', before: 44, after: 44 },
      ] },
    ] },
    { match: 'Lorn II’s bank bushes keep their leafy look', see: 'In Lorn II, look along the stream at the bushes on the far bank: their outline stays broken by leaves and their hatching stays strokes, instead of turning into smooth dark lumps.' },
    { match: 'The Garden of Spheres’ olive trees have rounder', shots: [
      { name: 'olive-crowns', caption: 'The References’ view of the olive grove round the plaza', commit: '2b81b29', view: { ref: '3793-olive-plaza' } },
    ] },
    { match: 'The Garden’s round plaza reads pale', shots: [
      { name: 'plaza-pale', caption: 'The References’ view of the round plaza between the fruit hedges', commit: 'afc17bc', view: { ref: '3795-plaza-hedges' } },
    ] },
    { match: 'The floor of the Buried Machine’s rust canyon', shots: [
      { name: 'canyon-floor', caption: 'Down the Buried Machine’s rust canyon toward the first cross-wall', commit: '37f6603', view: { level: 'buried', player: [cx(-170), -33.9, -170], eye: [cx(-170), -24, -170], target: [cx(-250), -34, -250], fov: 60 } },
    ], numbers: [
      { title: 'Sand over 10 cm deep on the canyon floor', unit: 'samples of 3 502', better: 'lower', source: 'the commit’s measurements (37f6603)', rows: [{ where: 'the rust canyon’s floor', before: 133, after: 40 }] },
    ] },
    { match: 'Climbing a wall where sand is banked', see: 'Walk up to a wall where the sand banks against its foot (Qanat’s, or the Buried Machine’s canyon) and climb: you take hold from the top of the bank, and climbing down you step off onto it.' },
    { match: 'Cabs are solid just as they are drawn', numbers: [
      { title: 'Where a cab’s solid and drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (9098d88)', rows: [{ where: 'the City-Shaft’s cabs (share of samples, %)', before: 47, after: 2.9 }] },
    ], see: 'In the Signal Market, climb onto a parked cab: you stand on its nose, tail or striped canopy where they are drawn.' },
    { match: 'Climbing an olive tree in the Garden of Spheres', see: 'In the Garden of Spheres, climb an olive’s trunk: you stop under the crown, or climb round its leaves and stand on top.' },
  ],
  '0.76': [
    { match: 'The Steam Deck gets its own Graphics setting', numbers: [
      { title: 'What the Deck drew before, on High, against its own setting', device: 'Steam Deck OLED, SteamOS 3.8', source: 'docs/systems/performance.md, “The Steam Deck”', note: 'the spawn on High was read once in Desktop Mode (v0.73); on its own setting it was measured in Gaming Mode’s X11 under gamescope at 90 Hz (v0.80); High at 1.5× is still to be measured the same way', rows: [
        { where: 'pixels drawn (thousands)', before: 2304, after: 1024 },
        { where: 'props drawn out to (m)', before: 520, after: 380 },
        { where: 'the fine shadow map (px)', before: 2048, after: 1024 },
        { where: 'the desert’s spawn (fps)', before: '17–22', after: 48 },
      ] },
    ] },
    { match: 'On handhelds the City-Shaft runs smoother', numbers: [
      { title: 'Looking across the City-Shaft', better: 'higher', unit: 'fps', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [
        { where: 'the wide view', before: '42–43', after: 45 },
        { where: 'the rim', before: '50–51', after: 52 },
      ] },
      { title: 'Draw calls', better: 'lower', device: RETROID, rows: [
        { where: 'the wide view', before: 1492, after: 1326 },
        { where: 'the rim', before: 1025, after: 960 },
      ] },
    ] },
    { match: 'On handhelds the picture no longer goes soft for nothing', numbers: [
      { title: 'The resolution the game keeps in Qanat, the camps and the City-Shaft', unit: '× the screen', better: 'higher', device: RETROID.replace(', render scale held at 0.75', ', automatic resolution'), source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [
        { where: 'Qanat, the camps, the City-Shaft', before: '0.6–0.75', after: 0.75 },
      ] },
    ], see: 'On a handheld, stand in Qanat or the camps with the frame readout on (F): the picture stays sharp; it softens only where the graphics, not the processor, are behind.' },
    { match: 'The desert’s camps and other crowded places run a little smoother', numbers: [
      { title: 'The processor’s work a frame at the camps', unit: 'ms', better: 'lower', device: RETROID, source: 'docs/systems/performance.md, “The Retroid, second round”', rows: [{ where: 'the camps', before: 20.2, after: 19.6 }] },
    ] },
    { match: 'The loading screen’s turning pen', see: 'Open a world on a handheld and watch the pen on the loading screen: it turns without stopping. (On a busy Mac it stopped 100–240 ms at a time before. On the Retroid it turned smoothly through every load, before the change and after, with no stop over 50 ms: the stutter measured was the Mac’s.)', numbers: [
      { title: 'The pen’s longest stop through a load (a refresh is 17 ms)', unit: 'ms', better: 'lower', device: 'Retroid Pocket Nova (GeckoView 157), a screen recording of the load', source: 'docs/systems/performance.md, “The Retroid, round 4”', rows: [
        { where: 'the desert', before: 33, after: 49 },
        { where: 'the City-Shaft', before: 32, after: 32 },
      ] },
    ] },
    { match: 'The Buried Machine’s great wheel is solid', numbers: [
      { title: 'Where the wheel’s solid and drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (48b995e)', rows: [
        { where: 'feet sinking into it', before: 69, after: 37 },
        { where: 'climbing off it into nothing', before: 102, after: 11 },
        { where: 'standing on an unseen floor', before: 18, after: 0 },
      ] },
    ], see: 'In the Buried Machine, climb onto the great wheel in the dunes and wait for it to turn: it carries you round, and a spoke sweeps you aside.' },
    { match: 'In the Buried Machine’s rust canyon, the heavy rims', shots: [
      { name: 'cross-wall', caption: 'The first cross-wall’s oval opening in the rust canyon', commit: 'ce7febb', view: { level: 'buried', player: [cx(-232), -33.9, -232], eye: [cx(-232), -30.5, -232], target: [cx(-262), -29, -262], fov: 60 } },
    ] },
    { match: 'In Lorn II’s Deep Wood every root is solid', see: 'In Lorn II, walk into the gnarled roots along the banks or the thin ones round the great arches: you climb them and stand on them instead of walking through.' },
    { match: 'In the Garden of Spheres the olive trees’ trunks', numbers: [
      { title: 'Climbs that came off a tree into nothing', better: 'lower', device: AUDIT, source: 'the commit’s measurements (ba26446)', rows: [{ where: 'the Garden’s olives and cypresses', before: 234, after: 10 }] },
    ], see: 'Walk into a cypress in the Garden of Spheres: it stops you where it is drawn.' },
    { match: 'In Lorn’s Hush-House the gates of jaws', see: 'In Lorn’s Hush-House, walk up to a shut gate of jaws: it stops you at its two halves, and still won’t let you by until it is stilled.' },
    { match: 'You no longer sink into banked sand', numbers: [
      { title: 'Places where you walked through the drawn sand', better: 'lower', device: AUDIT, source: 'the commit’s measurements (ba26446)', rows: [
        { where: 'the desert', before: 46, after: 6 },
        { where: 'Vael', before: 80, after: 28 },
      ] },
    ], see: 'Walk along a drift of sand banked against a wall or a rock: your feet stay on the sand as it is drawn.' },
  ],
  '0.75': [
    { match: 'The sketchbook is now a game menu', shots: [
      { name: 'game-menu', caption: 'View / Select (J) in the desert: the sketchbook before, the game menu after', commit: '74fc72e', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: 'window.journal.toggle(true)', wait: 2500 } },
    ] },
    { match: 'Items shows what you have found as pictures', shots: [
      { name: 'menu-items', caption: 'The game menu’s Items, everything found', commit: '11001bf', only: 'after', view: { level: 'desert', query: 'items=all', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('items')", wait: 4000 } },
    ] },
    { match: 'Quests shows only what matters now', shots: [
      { name: 'menu-quests', caption: 'The game menu’s Quests in the desert', commit: '11001bf', only: 'after', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('quests')", wait: 2500 } },
    ] },
    { match: 'Sketchbook keeps every story page', shots: [
      { name: 'menu-worlds', caption: 'The game menu’s Worlds', commit: '11001bf', only: 'after', view: { level: 'desert', hud: true, save: SAVE_DESERT, setup: "window.journal.toggle(true); window.journal.menu?.open?.('worlds')", wait: 2500 } },
    ] },
    { match: 'When the scout finds your objective', see: 'Press the top button (Y / △, or the scout’s key) in a world with a quest under way: the line at the bottom gives the goal over its next step.' },
    { match: 'The charms that came out of their boxes', see: 'Open the game menu’s Items with the charms found: each is drawn as what it is (the soles, the scarf, the shell…), not a gold gem.' },
    { match: 'Standing still, the traveller’s legs hold still', shots: [
      { name: 'idle-legs', caption: 'The traveller standing for 16 seconds, a frame a second: before, his right foot steps about; after, it stays put', commit: '14d32a5', size: [2400, 700], from: 'the idle work’s own sheets, before and after, the same spot and clock (6 October)' },
    ], numbers: [
      { title: 'Standing for 20 seconds', better: 'lower', device: 'tests/idle-legs.test.js, the shipped traveller', rows: [
        { where: 'steps taken', before: '20–40', after: 0 },
        { where: 'the fastest a leg bone turned (rad/s)', before: 52, after: '≤ 2' },
      ] },
    ] },
    { match: 'The traveller stands as he is drawn', see: 'Stop anywhere and look at the traveller from the side: his feet are under his hips, a little apart, not in a stride.', numbers: [
      { title: 'How much of the idle clip’s split stance is kept', unit: '%', better: 'lower', device: 'the commit’s numbers (a0c6af7, IDLE_STANCE)', rows: [
        { where: 'front to back', before: 100, after: 30 },
        { where: 'outward', before: 100, after: 40 },
      ] },
    ] },
    { match: 'Standing about, the traveller holds his head up', see: 'Stand still, then run: he looks ahead both times, not down at the ground or at his feet.', numbers: [
      { title: 'Where his face points (degrees below level)', unit: '°', better: 'lower', device: 'the commits’ measurements (ef9c221, 3790374)', rows: [
        { where: 'standing', before: '9–21', after: '0–12' },
        { where: 'jogging', before: 35, after: 20 },
        { where: 'sprinting', before: 48, after: 20 },
      ] },
    ] },
    { match: 'Cabs drive themselves now', shots: [
      { name: 'cab-ride', caption: 'Riding a cab in the Signal Market: before, you drove it yourself (the throttle and steering prompts); after, it flies itself to the stop with you seated inside', commit: 'c872cf4', from: 'the cab work’s own screenshots, before and after (6 October), not one fixed view' },
    ] },
    { match: 'The Signal Market’s cabs stop at', shots: [
      { name: 'cab-dash', caption: 'Getting into a cab: the screen on its dash asks where to', only: 'after', from: 'the cab work’s own screenshots (6 October)' },
    ], see: 'Get into a cab in the Signal Market or the City-Shaft: the screen on its dash lists the stops; pick one with the mouse, a number key or the stick and A / ×.' },
    { match: 'Wren is the old cab itself now', see: 'In the City-Shaft, light the call-lamp at the bottom terrace and get in: Wren talks to you from its dash.' },
    { match: 'On the Steam Deck the settings have the same Updates section', shots: [
      { name: 'deck-updates', caption: 'The settings’ Updates section in the Deck’s app (the Deck runtime on the Mac), a new build waiting', only: 'after', size: [2000, 1200], from: 'the Deck work’s own screenshot (6 October)' },
    ], see: 'On the Steam Deck, open the settings (Menu): the Updates section shows what you are playing, Check for updates, and Download and restart.' },
  ],
  '0.74': [
    { match: 'Seated people’s capes rest on what they sit on', shots: [
      { name: 'seated-capes', caption: 'Bako and Sefa seated, from behind and from the side, in the running game', commit: '7a8806f', view: people([{ id: 'bako', yaw: 2.4 }, { id: 'bako', yaw: 1.57 }, { id: 'sefa', yaw: 2.4 }, { id: 'sefa', yaw: -1.57 }]) },
    ] },
    { match: 'In the City-Shaft the shade is printed flat', shots: [
      { name: 'dish-city-shadows', caption: 'The References’ view of the pink dishes over the blue domes: the dish’s shadow on the sand, hatched before, one solid dark mass after', commit: '001f401', view: { ref: '3774-dish-city' } },
    ] },
    { match: 'No more filter stuck to the screen', shots: [
      { name: 'no-filter', caption: 'Qanat from the plinth’s stair (look at the corners and the sky)', commit: '997e28a', view: desertAt([213.052, 3.246, 370.525], [231.495, 21.846, 402.601], { player: [215.544, 2.346, 374.86], fov: 60 }) },
    ], numbers: [
      { title: 'What stayed on the screen when the camera turned', device: 'Mac, Qanat’s gate, the clock frozen', source: 'the commit’s measurements (997e28a)', rows: [
        { where: 'the corners darkened (%)', before: 19, after: 0 },
        { where: 'the paper grain left on the same pixels (correlation)', before: 0.94, after: 0 },
      ] },
    ] },
    { match: 'Old walls no longer shimmer', see: 'Shimmer only shows in motion: turn the camera slowly in front of Qanat’s gate; the far walls’ grime and hatching stay still instead of crawling.', numbers: [
      { title: 'Shimmer as the camera pans (flickering pixels in 10 000)', better: 'lower', device: 'the motion check: a slow pan, the world frozen', source: 'the commit’s measurements (4d24ba7)', rows: [
        { where: 'Qanat, Medium', before: 22.8, after: 15.8 },
        { where: 'Qanat, Handheld', before: 28.1, after: 19.2 },
        { where: 'the Signal Market', before: 17.8, after: 14.3 },
      ] },
    ] },
    { match: 'The spots on the desert sand are pebbles', shots: [
      { name: 'pebbles', caption: 'The sand at your feet on a dune’s crest at 8 in the morning', commit: '4a16479', view: desertAt([-203, 23.5, 303], [-208, 21.2, 308], { fov: 28, hour: 8, player: [-198, 22, 298] }) },
      { name: 'pebbles-far', caption: 'The open dunes from a crest', commit: '4a16479', view: desertAt([-200, 39.852, 300], [-420, 2.804, 520], { hour: 9, player: [-205.657, 21.133, 305.657] }) },
    ] },
    { match: 'The Steam Deck version updates all of itself', see: 'On the Steam Deck, Check for updates in the settings: a new version of the app around the game comes from the game’s site too, not only the game.' },
    { match: 'On the Steam Deck the game has its own pictures', shots: [
      { name: 'steam-art', caption: 'Memento in the Steam Deck’s library, its banner drawn from the game itself', only: 'after', size: [1280, 800], from: 'the Deck work’s own screenshot of the Deck (7 October)' },
    ] },
    { match: 'The game runs smoothly on handhelds again', numbers: [
      { title: 'Frames a second, every view of every world', unit: 'fps', better: 'higher', device: RETROID, source: 'docs/systems/performance.md, “Every world on the Retroid, in GeckoView”', rows: [
        { where: 'the desert', before: '17–25', after: '44–60' },
        { where: 'the City-Shaft', before: '18–20', after: '44–60' },
        { where: 'the Signal Market', before: '18–24', after: '59–60' },
        { where: 'Vael', before: '18–24', after: '59–60' },
        { where: 'Vael II', before: '18–23', after: '57–60' },
        { where: 'the Buried Machine', before: '21–22', after: '59–60' },
        { where: 'the Garden of Spheres', before: '22–24', after: '59–60' },
        { where: 'Lorn II', before: '22–25', after: '59–60' },
        { where: 'home', before: '17–22', after: '59–60' },
      ] },
      { title: 'The shirt’s work on the processor a frame', unit: 'ms', better: 'lower', device: RETROID, rows: [{ where: 'every world', before: '33–43', after: 1.8 }] },
    ] },
  ],
  '0.73': [
    { match: 'In the Buried Machine your feet and hands meet the metal', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'feet sinking into something drawn', before: 270, after: 69 },
        { where: 'climbing inside something', before: 833, after: 49 },
      ] },
    ], see: 'In the Buried Machine, climb the trench’s pipes and tanks or the Engine-House’s gantry: your hands and feet meet the metal where it is drawn.' },
    { match: 'In the Garden of Spheres the hill’s boulders', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'feet sinking into something drawn', before: 91, after: 6 },
        { where: 'climbing inside something', before: 120, after: 6 },
      ] },
    ], see: 'In the Garden of Spheres, walk onto the singing spheres in the Footprint: they are round underfoot.' },
    { match: 'In Lorn the Hush-House’s dome', numbers: [
      { title: 'Where the solid and the drawn shapes disagree', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'Lorn: feet sinking', before: 61, after: 13 },
        { where: 'Lorn: climbing inside', before: 35, after: 7 },
        { where: 'Lorn II: feet sinking', before: 97, after: 8 },
        { where: 'Lorn II: climbing inside', before: 5, after: 1 },
      ] },
    ] },
    { match: 'Things you can stand on are the things you see', numbers: [
      { title: 'Feet sinking into something drawn', better: 'lower', device: AUDIT, source: 'the commit’s measurements (8a6ca7f)', rows: [
        { where: 'home', before: 23, after: 0 },
        { where: 'the Signal Market', before: 7, after: 4 },
        { where: 'Viridel', before: 18, after: 3 },
        { where: 'the Sealed Hangar', before: 5, after: 0 },
      ] },
    ] },
    { match: 'In the desert the radio dishes’ bowls', numbers: [
      { title: 'Where the solid and the drawn shapes disagree in the desert', better: 'lower', device: AUDIT, source: 'the commit’s measurements (e43d3c2)', rows: [
        { where: 'walking through something drawn', before: 79, after: 54 },
        { where: 'climbing inside something', before: 35, after: 23 },
      ] },
    ], see: 'At the salt lagoons, step onto a floating salt plate: it holds you now.' },
    { match: 'Every temple’s halls lose the invisible ledge', see: 'In any temple, climb the wall of a round room: at the top you meet the stone cornice’s overhang where it is drawn.' },
    { match: 'The desert’s people carry what their drawings give them', shots: [
      { name: 'desert-props', caption: 'Bako, Sefa, Marrow and the Speaker, in the running game', commit: 'f818c22', view: people([{ id: 'bako' }, { id: 'sefa' }, { id: 'marrow' }, { id: 'speaker' }]) },
    ] },
    { match: 'A few clouds drift over the desert again', shots: [
      { name: 'desert-clouds', caption: 'The open dunes from a crest', commit: 'bdd268d', view: desertAt([-200, 39.852, 300], [-420, 22, 520], { player: [-205.657, 21.133, 305.657] }) },
    ] },
    { match: 'Your footprints in the sand no longer vanish', see: 'Walk across the sand, then turn the camera right round: your footprints stay where you walked.' },
    { match: 'The stone half-arch that hung in the sky', shots: [
      { name: 'qanat-arch', caption: 'From the pilgrims’ camps toward Qanat’s main gate', commit: '1d45790', view: desertAt([120, 8, 225], [181, 16, 318], { player: [122, 2, 228], fov: 30 }) },
    ] },
    { match: 'Vael’s bird stands tall', shots: [
      { name: 'vael-bird', caption: 'The References’ view under the mushroom, the plain and its tower: the bird on the ground', commit: 'f7aedd2', view: { ref: '3783-mushroom-plain' } },
    ] },
    { match: 'In Vael II the mushroom tables lean', shots: [
      { name: 'vael2-stacks', caption: 'The References’ view of the stacked discs and stones', commit: 'f7aedd2', view: { ref: '3784-stacks' } },
      { name: 'vael2-mushrooms', caption: 'Mushrooms in the cloud, the arched cliff', commit: 'f7aedd2', view: { ref: '3784-mushrooms-arches' } },
    ] },
    { match: 'Vael II’s monastery has a cloister', shots: [
      { name: 'vael2-monastery', caption: 'The References’ view of the monastery on the rose cliff', commit: 'f7aedd2', view: { ref: '3784-cliff-monastery' } },
    ] },
    { match: 'The traveller no longer holds a phone', shots: [
      { name: 'no-phone', caption: 'The traveller walking in the character studio, his right hand', commit: 'ff2217c', view: studio('view=hands&yaw=-0.9') },
    ] },
    { match: 'With the tank on your back you now wear a dark leather glove', shots: [
      { name: 'glove', caption: 'The traveller’s right hand with the tank on his back', commit: '2e5a866', view: people([{ id: 'traveller', yaw: -0.9, dist: 1.6, height: 1.0 }, { id: 'traveller', yaw: -1.6, dist: 1.4, height: 0.95 }], { player: [29, 24.456, 132], heading: 0.6435 }) },
    ] },
    { match: 'People sitting on benches, stones and kerbs wear their robes', shots: [
      { name: 'seated-robes', caption: 'Bako and Sefa seated, from in front and the side', commit: '651d9fe', view: people([{ id: 'bako' }, { id: 'bako', yaw: 1.2 }, { id: 'sefa' }, { id: 'sefa', yaw: -1.2 }]) },
    ] },
    { match: 'On the Steam Deck the game starts in Gaming Mode', see: 'On the Steam Deck, start Memento from Gaming Mode: it opens instead of staying on a black screen, and Exit Game closes it at once.' },
  ],
};
