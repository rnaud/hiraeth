// The outfits gallery (outfits-gallery.html, issue #549): every outfit of data/characters/traveller-v2/outfits.json
// on the v2 traveller, side by side, live: each one the game's own traveller (Player's rig, the Animator on the
// game's clips, B3's skeleton and the portrait head) with his B3 body put away and the outfit worn as the outfits
// test page wears it (src/characters/outfit-page.js v2Wardrobe: the game's ink material, the robe's swing), drawn by
// the game's pipeline (the items viewer: G-buffer, ink pass, the sun's shadow) on the pages' paper. They stand,
// walk, run or sprint on the spot and turn slowly on their own; dragging sideways turns them all (each on its
// spot, so the row never hides itself), up and down tilts the view, scrolling zooms. Dev server
// only: the models live in data/, which the build leaves out; the built page says so.
import * as T from 'three';
import { ItemViewer, dragOrbit, zoomOrbit } from '../items-page/viewer.js';
import { loadAnimationLibrary, Animator } from '../animator.js';
import { loadTraveller, createTraveller } from '../characters/traveller.js';
import { buildCharacter } from '../player.js';
import { ROOT, json, loadParts, v2Wardrobe } from '../characters/traveller-v2.js';
import { galleryRows, MOTIONS, motionSpeed } from './rows.js';

const $ = (id) => document.getElementById(id);
const BASE = import.meta.env.BASE_URL;
const query = new URLSearchParams(location.search);
const HEIGHT = 1.9;   // (the row's height for the framing: his hair's top)
const UP = new T.Vector3(0, 1, 0);

class RowViewer extends ItemViewer {
  constructor() {
    super();
    // (the paper behind them plain, as the creatures gallery's)
    this.backdrop.material = this.backdrop.material.clone();
    this.backdrop.material.fragmentShader = this.backdrop.material.fragmentShader.replace('L = mix(L, 1.0, max(uGlow, emit));', 'L = 1.0;');
    this.backdrop.material.needsUpdate = true;
    this.row = new T.Group();       // the travellers, their feet at y = 0
    this.holder = new T.Group();
    this.holder.add(this.row);
    this.row.position.y = -(HEIGHT / 2 + 0.02);
    this.halfWidth = 1;
    this.orbit = { yaw: 0, pitch: 0.1, zoom: 0.62 };
  }
  setWidth(half) {
    this.halfWidth = half;
    this.cascade.configure(2048, half + 1.6);   // (one shadow map over the whole row)
    this.cascade.prime(this.renderer);
  }
  model() { return { holder: this.holder, r: Math.hypot(this.halfWidth + 0.45, HEIGHT / 2), height: HEIGHT, fluids: [] }; }
  shadowCentre() { return (this._centre ??= new T.Vector3()); }
}

function note(text) {
  const n = $('note');
  n.hidden = false;
  n.textContent = text;
}

async function start() {
  const [list, baseManifest, lib, asset] = await Promise.all([
    json(ROOT + 'outfits.json'), json(ROOT + 'manifest.json'),
    loadAnimationLibrary(`${BASE}anim/ual.glb`), loadTraveller(BASE),
  ]);
  const rows = galleryRows(list);
  const viewer = new RowViewer();
  $('stage').prepend(viewer.renderer.domElement);
  viewer.setWidth(Math.abs(rows[0]?.x ?? 0));
  const shared = { materials: new Map(), parts: new Map() };
  let base = null;
  const people = [];
  for (const row of rows) {
    const char = buildCharacter();
    if (char.jetpack) char.jetpack.visible = false;
    const character = createTraveller(char, asset);
    character.humanoid.ownMaterials?.();
    base ??= await loadParts(ROOT + list.base, character.humanoid.body.skeleton.bones);
    const { wardrobe, load } = v2Wardrobe(character, { list, baseManifest, base }, shared);
    await load(row.id);
    wardrobe.wear(row.id);
    char.root.position.set(row.x, 0, 0);
    viewer.row.add(char.root);
    const label = document.createElement('div');
    label.className = 'label';
    label.dataset.outfit = row.id;
    label.textContent = row.name;
    $('labels').append(label);
    people.push({ row, char, character, h: character.humanoid, animator: new Animator(lib, char), wardrobe, label });
    $('status').textContent = `${people.length} of ${rows.length} dressed…`;
  }
  $('status').textContent = `${rows.length} outfits`;

  // ---- the controls
  let motion = MOTIONS.some((m) => m.id === query.get('motion')) ? query.get('motion') : 'idle';
  let turning = query.get('turn') !== '0', turn = Number(query.get('yaw') ?? 0) || 0;
  const buttons = $('motions');
  buttons.innerHTML = MOTIONS.map((m) => `<button data-motion="${m.id}" aria-pressed="${m.id === motion}">${m.label}</button>`).join('');
  buttons.onclick = (e) => {
    const b = e.target.closest('button[data-motion]');
    if (!b) return;
    motion = b.dataset.motion;
    for (const x of buttons.children) x.setAttribute('aria-pressed', String(x.dataset.motion === motion));
    remember();
  };
  $('turn').checked = turning;
  $('turn').onchange = (e) => { turning = e.target.checked; remember(); };
  const remember = () => {
    const n = new URLSearchParams(location.search);
    n.set('motion', motion); if (turning) n.delete('turn'); else n.set('turn', '0');
    history.replaceState(null, '', `${location.pathname}?${n}`);
  };
  // dragging sideways turns them (each on its spot: the turn stops), up and down tilts the view; scroll zooms
  const canvas = viewer.renderer.domElement;
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    if (dx && turning) { turning = false; $('turn').checked = false; remember(); }
    turn += dx * 0.01;
    dragOrbit(viewer.orbit, 0, dy);
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomOrbit(viewer.orbit, Math.exp(e.deltaY * 0.001)); }, { passive: false });

  // ---- each frame: the game's blend held at the motion's speed, on the spot (as the character studio drives it)
  const N = lib.native, _p = new T.Vector3();
  function pose(p, dt) {
    const { char, character, h, animator: a } = p, root = char.root;
    const speed = motionSpeed(motion, N);
    root.quaternion.setFromAxisAngle(UP, turn);
    root.updateMatrixWorld(true);
    a.update(dt, { speed, onGround: true, mode: 'ground', walkAt: N.walk * 1.3, jogAt: N.jog, sprintAt: N.sprint * 1.2, strideScale: 1.05 });
    a.apply(root, { legScale: 1.04 });
    root.updateMatrixWorld(true);
    const wrists = character.poseArms?.({ animator: a, onGround: true });
    h.update();
    if (character.poseHands) character.poseHands(a, wrists);
    else { h.poseHands(a); if (wrists) character.poseWrists?.(wrists); }
    h.resetFeet();
    h.updateEyes?.(dt, null);
    h.hands?.update(dt, { mode: 'ground', speed });
    character.updateHands?.();
    root.updateMatrixWorld(true);
  }
  function place(p, w, hgt) {
    p.char.root.getWorldPosition(_p);
    _p.y -= 0.12;   // (under his feet: the paper's horizon runs behind their heads)
    _p.project(viewer.camera);
    const on = _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
    p.label.hidden = !on;
    if (on) p.label.style.transform = `translate(${((_p.x + 1) / 2) * w}px, ${((1 - _p.y) / 2) * hgt}px) translate(-50%, 0)`;
  }
  let last;
  const frame = (t) => {
    const dt = Math.min((t - (last ?? t)) / 1000, 0.05); last = t;
    viewer.time += dt;
    if (turning) turn += dt * 0.35;
    for (const p of people) pose(p, dt);
    const host = $('stage'), dpr = Math.min(devicePixelRatio || 1, 2);
    viewer.setSize(host.clientWidth * dpr, host.clientHeight * dpr);
    viewer.render('row', viewer.orbit);
    for (const p of people) place(p, host.clientWidth, host.clientHeight);
    window.__outfitsGallery = { ready: true, ids: people.map((p) => p.row.id), motion, turning, turn, worn: people.map((p) => p.wardrobe.worn?.id) };
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

start().catch((e) => {
  console.error('outfits gallery', e);
  note(`Outfits gallery: ${e.message ?? e}`);
  $('status').textContent = '';
  window.__outfitsGallery = { ready: false, error: String(e.message ?? e) };
});
