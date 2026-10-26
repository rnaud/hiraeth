// Tripo outfit trial (#682, #684): tools/tripo-outfits-review.html. Side by side, same height, same angle, same finish:
//   left   the Blender outfit as #680 left it (data/characters/tripo-outfits/<id>/blender-680/, kept for this page)
//   middle the Blender outfit the game wears (data/characters/traveller-v2): since #684 drawn to the Tripo figure's
//          shape and repainted in flat colour. Both worn by the game's own traveller as the outfits gallery dresses him
//          (Player's rig, the Animator's standing blend, B3's skeleton, the portrait head, its ink material)
//   right  the Tripo model (data/characters/tripo-outfits/<id>/preview.glb), untouched apart from 1024² textures,
//          turned to face the same way and scaled to his height, given the ink material the wardrobe gives a garment
//          (characters/tripo-material.js makeReviewInkMaterial)
// "Game ink" draws them with the outfits gallery's own pipeline (items-page/viewer.js: G-buffer, ink pass, the sun's
// shadow); "Unlit", "Clay" and "Neutral light" with a plain three.js renderer. No audio is created.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ItemViewer } from '../src/items-page/viewer.js';
import { makeReviewInkMaterial } from '../src/characters/tripo-material.js';
import { loadAnimationLibrary, Animator } from '../src/animator.js';
import { loadTraveller, createTraveller } from '../src/characters/traveller.js';
import { buildCharacter } from '../src/player.js';
import { ROOT as V2_ROOT, json, loadParts, v2Wardrobe } from '../src/characters/traveller-v2.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const BASE = import.meta.env.BASE_URL;
const OUTFITS = { 'void-navigator': 'Void navigator', 'gravity-ranger': 'Gravity ranger' };
const id = OUTFITS[q.get('outfit')] ? q.get('outfit') : 'void-navigator';
const other = id === 'void-navigator' ? 'gravity-ranger' : 'void-navigator';
const TRIPO = `${BASE}data/characters/tripo-outfits/${id}/`;
/** The camera's angle round the figures: 0 their fronts, π/2 their left sides (the sheet's side view). */
const ANGLES = { front: 0, quarter: 0.65, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI };
const GAP = 1.05;   // (the side figures' distance from the middle, m)

for (const [k, v] of [['outfit', id], ['angle', q.get('angle')], ['finish', q.get('finish')]]) if (v && [...$(k).options].some((o) => o.value === v)) $(k).value = v;
$('turn').checked = q.get('turn') !== '0';
const remember = () => {
  const n = new URLSearchParams({ outfit: id, angle: $('angle').value, finish: $('finish').value });
  if (!$('turn').checked) n.set('turn', '0');
  history.replaceState(null, '', `${location.pathname}?${n}`);
};
$('outfit').onchange = () => { location.search = new URLSearchParams({ outfit: $('outfit').value, angle: $('angle').value, finish: $('finish').value }).toString(); };
$('finish').onchange = remember;
$('turn').onchange = remember;
$('live-toggle').onclick = () => {
  const on = !document.body.classList.contains('live');
  document.body.classList.toggle('live', on);
  $('live-toggle').setAttribute('aria-pressed', String(on));
  if (on) $('live').src = `${BASE}outfits-gallery.html?only=${id}&motion=idle`;
  else $('live').removeAttribute('src');   // (its renderer stops with it)
};

const tri = (g) => (g.index?.count ?? g.attributes.position.count) / 3;
const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

/** The Blender outfit on the game's traveller, dressed as the outfits gallery dresses him. */
async function dressBlender(which) {
  const [game, baseManifest, lib, asset] = await Promise.all([
    json(V2_ROOT + 'outfits.json'), json(V2_ROOT + 'manifest.json'),
    loadAnimationLibrary(`${BASE}anim/ual.glb`), loadTraveller(BASE, { v2: { on: false } }),
  ]);
  // (#680's outfit from its kept copy, the game's from its own list)
  const list = which === '680' ? { ...game, outfits: game.outfits.map((o) => (o.id === id ? { ...o, dir: `../tripo-outfits/${id}/blender-680/` } : o)) } : game;
  const char = buildCharacter();
  if (char.jetpack) char.jetpack.visible = false;
  const character = createTraveller(char, asset);
  character.humanoid.ownMaterials?.();
  const base = await loadParts(V2_ROOT + list.base, character.humanoid.body.skeleton.bones);
  const { wardrobe, load } = v2Wardrobe(character, { list, baseManifest, base }, { materials: new Map(), parts: new Map() });
  await load(id);
  wardrobe.wear(id);
  return { char, character, animator: new Animator(lib, char) };
}

/** One frame of the game's standing blend, on the spot (the gallery's pose() at speed 0). */
function poseIdle({ char, character, animator: a }, dt) {
  const h = character.humanoid, root = char.root;
  root.updateMatrixWorld(true);
  a.update(dt, { speed: 0, onGround: true, mode: 'ground', walkAt: 1.8, jogAt: 3.5, sprintAt: 7 });
  a.apply(root, { legScale: 1.04 });
  root.updateMatrixWorld(true);
  const wrists = character.poseArms?.({ animator: a, onGround: true });
  h.update();
  if (character.poseHands) character.poseHands(a, wrists);
  else { h.poseHands(a); if (wrists) character.poseWrists?.(wrists); }
  h.resetFeet();
  h.updateEyes?.(dt, null);
  h.hands?.update(dt, { mode: 'ground', speed: 0 });
  character.updateHands?.();
  root.updateMatrixWorld(true);
}

/** The outfits gallery's viewer for the pair: plain paper, the two figures' feet on its floor. */
class PairViewer extends ItemViewer {
  constructor(pair, height) {
    super();
    this.backdrop.material = this.backdrop.material.clone();
    this.backdrop.material.fragmentShader = this.backdrop.material.fragmentShader.replace('L = mix(L, 1.0, max(uGlow, emit));', 'L = 1.0;');
    this.backdrop.material.needsUpdate = true;
    this.holder = new T.Group();
    this.holder.add(pair);
    pair.position.y = -(height / 2 + 0.02);
    this.height = height;
    this.cascade.configure(2048, GAP + 2);
    this.cascade.prime(this.renderer);
  }
  model() { return { holder: this.holder, r: Math.hypot(GAP + 0.5, this.height / 2), height: this.height, fluids: [] }; }
  shadowCentre() { return (this._centre ??= new T.Vector3()); }
}

try {
  const [oldRig, blenderRig, tripo, inventory] = await Promise.all([
    dressBlender('680'), dressBlender('game'), new GLTFLoader().loadAsync(`${TRIPO}preview.glb`), fetch(`${TRIPO}inventory.json`).then((r) => r.json()),
  ]);
  for (let i = 0; i < 90; i++) { poseIdle(oldRig, 1 / 30); poseIdle(blenderRig, 1 / 30); }   // (settled into his standing pose)
  const blender = blenderRig.char.root, oldBlender = oldRig.char.root;
  const tripoFig = new T.Group();
  tripo.scene.traverse((o) => { if (o.isMesh) tripoFig.add(new T.Mesh(o.geometry, o.material)); });
  const sizeOf = (o) => { o.updateMatrixWorld(true); const b = new T.Box3(); o.traverse((m) => { if (m.isMesh && shown(m)) b.expandByObject(m, true); }); return b; };
  const bb = sizeOf(blender), H = bb.max.y - bb.min.y;
  // (Tripo exports face +X: turned to face +Z as the traveller does, scaled to his height, feet on his floor)
  const tripoInner = new T.Group(), tripoPlaced = new T.Group();
  tripoInner.add(tripoFig);
  tripoPlaced.add(tripoInner);
  tripoFig.rotation.y = -Math.PI / 2;
  const tb = sizeOf(tripoInner);
  tripoInner.scale.setScalar(H / (tb.max.y - tb.min.y));
  const tb2 = sizeOf(tripoInner), tc = tb2.getCenter(new T.Vector3());
  tripoInner.position.set(-tc.x, -tb2.min.y, -tc.z);
  blender.position.y -= bb.min.y;
  oldBlender.position.y -= sizeOf(oldBlender).min.y;
  const left = new T.Group(), middle = new T.Group(), right = new T.Group(), pair = new T.Group();
  left.add(oldBlender); middle.add(blender); right.add(tripoPlaced);
  left.position.x = -GAP; right.position.x = GAP;
  pair.add(left, middle, right);

  // ---- the finishes
  const meshes = [], own = new Map(), ink = new Map(), unlit = new Map(), matte = new Map();
  const clay = new T.MeshStandardMaterial({ color: '#b9ac96', roughness: 1, metalness: 0, side: T.DoubleSide });
  const stats = { old: 0, blender: 0, tripo: 0 };
  for (const [fig, key] of [[oldBlender, 'old'], [blender, 'blender'], [tripoFig, 'tripo']]) fig.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    const map = src.map ?? src.uniforms?.uMap?.value ?? null;
    const color = src.isMaterial && src.color?.isColor ? src.color : new T.Color(0xffffff);
    if (key === 'tripo') o.userData.inkShade = { hatch: 0.2 };   // (as the wardrobe inks a garment)
    own.set(o, src);
    ink.set(o, key === 'tripo' ? makeReviewInkMaterial(o) : src);
    matte.set(o, new T.MeshStandardMaterial({ map, color, side: T.DoubleSide, roughness: 1, metalness: 0 }));
    unlit.set(o, new T.MeshBasicMaterial({ map, color, side: T.DoubleSide }));
    meshes.push(o);
    stats[key] += tri(o.geometry);
  });
  const viewer = new PairViewer(pair, H);
  const plainCanvas = $('view'), inkCanvas = viewer.renderer.domElement;
  inkCanvas.id = 'ink-view';
  plainCanvas.after(inkCanvas);
  const plain = new T.WebGLRenderer({ canvas: plainCanvas, antialias: true, preserveDrawingBuffer: true });
  plain.setPixelRatio(Math.min(devicePixelRatio, 2));
  const plainScene = new T.Scene();
  plainScene.background = new T.Color('#f3e7cc');
  plainScene.add(new T.HemisphereLight(0xffffff, 0x87818a, 0.9));
  const sun = new T.DirectionalLight(0xffffff, 2.0);
  sun.position.set(2, 4, 3);
  plainScene.add(sun);
  const plainCamera = new T.PerspectiveCamera(28, 1, 0.01, 200);

  // ---- the controls: the camera keeps its place, the figures turn (each on its own spot, as in the gallery)
  const ZOOM = 0.6;   // (head to sole filling the panel for three figures)
  const view = { yaw: 0, pitch: 0.08, zoom: ZOOM };
  let turn = 0;
  const frameView = () => { turn = 0; view.yaw = ANGLES[$('angle').value] ?? 0; view.pitch = 0.08; view.zoom = ZOOM; remember(); };
  $('angle').onchange = frameView;
  $('reset').onclick = frameView;
  frameView();
  let drag = null;
  for (const c of [plainCanvas, inkCanvas]) {
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      if (dx && $('turn').checked) { $('turn').checked = false; remember(); }
      turn -= dx * 0.01;
      view.pitch = Math.max(-0.6, Math.min(1.1, view.pitch + dy * 0.005));
    });
    c.addEventListener('pointerup', () => { drag = null; });
    c.addEventListener('wheel', (e) => { e.preventDefault(); view.zoom = Math.max(0.2, Math.min(2, view.zoom * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  }

  // the reference: the cropped sheet view nearest the camera's angle (front, left, back), else the whole sheet
  const nearest = () => {
    const a = (((view.yaw + turn) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const pick = [[0, 'front'], [Math.PI / 2, 'left'], [Math.PI, 'back'], [1.5 * Math.PI, 'sheet'], [2 * Math.PI, 'front']];
    return pick.reduce((b, p) => (Math.abs(p[0] - a) < Math.abs(b[0] - a) ? p : b))[1];
  };
  let refShown = '';
  const showRef = () => {
    const r = nearest();
    if (r === refShown) return;
    refShown = r;
    $('reference').src = r === 'sheet' ? `${BASE}references/characters/traveller-outfits/${id}/approved-reference.png` : `${TRIPO}reference/${r}.png`;
    $('reference-label').textContent = r === 'sheet' ? `${OUTFITS[id]} · the picked sheet (it has no right view)` : `${OUTFITS[id]} · the picked sheet's ${r} view (a Tripo input)`;
  };

  const src = inventory.source;
  $('cap-old').textContent = `Blender outfit before (#680) · ${Math.round(stats.old).toLocaleString()} triangles drawn`;
  $('cap-blender').textContent = `Blender outfit now (#684): Tripo's garments, flat paint · the game's · ${Math.round(stats.blender).toLocaleString()} triangles drawn`;
  $('cap-tripo').textContent = `Tripo H3.1 smart mesh · whole figure, one mesh · ${src.triangles.toLocaleString()} triangles`;
  $('status').textContent = `Tripo task ${inventory.tripo.task} · ${inventory.tripo.credits} credits · untouched export ${(src.bytes / 1e6).toFixed(1)} MB, three ${src.images[0].width}² textures (colour, metal-rough, normal; ${Math.round(src.decodedTextureMiB)} MiB decoded) · shown here at 1024²`;
  $('links').innerHTML = `<a href="${inventory.tripo.studio}" target="_blank" rel="noopener">Tripo task</a><a href="${BASE}outfits-gallery.html?only=${id}&amp;motion=idle" target="_blank">Outfits gallery: ${OUTFITS[id]}</a><a href="?outfit=${other}">${OUTFITS[other]}</a>`;

  const r = Math.hypot(GAP + 0.5, H / 2);
  let last;
  function frame(time) {
    const dt = Math.min((time - (last ?? time)) / 1000, 0.05);
    last = time;
    viewer.time += dt;
    if ($('turn').checked) turn += dt * 0.5;
    for (const m of meshes) m.material = own.get(m);   // (his head sets its face's uniforms on its own material)
    poseIdle(oldRig, dt);
    poseIdle(blenderRig, dt);
    left.rotation.y = middle.rotation.y = right.rotation.y = -(view.yaw + turn);
    const finish = $('finish').value, inked = finish === 'ink';
    inkCanvas.style.display = inked ? 'block' : 'none';
    plainCanvas.style.display = inked ? 'none' : 'block';
    const host = inked ? inkCanvas : plainCanvas, w = host.clientWidth, h = host.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (inked) {
      for (const m of meshes) m.material = ink.get(m);
      viewer.scene.add(viewer.holder);
      viewer.setSize(w * dpr, h * dpr);
      viewer.render('pair', { yaw: 0, pitch: view.pitch, zoom: view.zoom });
    } else {
      for (const m of meshes) m.material = finish === 'clay' ? clay : finish === 'unlit' ? unlit.get(m) : matte.get(m);
      plainScene.add(viewer.holder);
      viewer.holder.position.set(0, H / 2 + 0.02, 0);
      if (plainCanvas.width !== Math.round(w * plain.getPixelRatio()) || plainCanvas.height !== Math.round(h * plain.getPixelRatio())) plain.setSize(w, h, false);
      // (the gallery viewer's framing: the same distance and angle)
      const d = (r * 1.2 * view.zoom) / Math.sin(T.MathUtils.degToRad(14)), c = viewer.holder.position;
      plainCamera.aspect = w / h;
      plainCamera.updateProjectionMatrix();
      plainCamera.position.set(c.x, c.y + Math.sin(view.pitch) * d, c.z + Math.cos(view.pitch) * d);
      plainCamera.lookAt(c);
      plain.render(plainScene, plainCamera);
    }
    showRef();
    window.__tripoOutfits = { ready: true, id, turn, yaw: view.yaw, finish, reference: refShown, triangles: { old: Math.round(stats.old), blender: Math.round(stats.blender), tripo: src.triangles } };
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (e) {
  $('status').textContent = `Could not load: ${e.message ?? e}`;
  window.__tripoOutfits = { ready: false, error: String(e.message ?? e) };
  console.error(e);
}
