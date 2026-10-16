// The serendipity map (issue #381; docs/systems/dev-tools.md "The serendipity map"): one world at a time (?world=<id>),
// built with the game's own level code (world.js), drawn in a light, cheap look (flat shaded, no ink), with every
// thing of interest on it by kind (collect.js), rings at walking distances round the landing, and a few numbers: how
// many of each, and how far the walkable ground gets from anything.
//
// The save is sandboxed first: the story's set-up writes flags, never to the player's slots.
import { slots, debugSaveHref } from '../save-slots.js';
slots.sandbox();

const THREE = await import('three');
const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
await import('../gadgets/all.js');   // (the gadgets become items before anything reads ITEMS: as main.js)
const { buildWorld, mapWorlds } = await import('./world.js');
const C = await import('./collect.js');
const { GAMES } = await import('../minigames/index.js');

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const worlds = mapWorlds();
const params = new URLSearchParams(location.search);
const id = worlds.some((w) => w.id === params.get('world')) ? params.get('world') : 'desert';
const meta = worlds.find((w) => w.id === id);

// ---- the header: the world picker, the way into the game
$('#world').innerHTML = worlds.map((w) => `<option value="${w.id}"${w.id === id ? ' selected' : ''}>${esc(w.title)}${w.route ? '' : ' (off the route)'}</option>`).join('');
$('#world').addEventListener('change', (e) => { const q = new URLSearchParams(location.search); q.set('world', e.target.value); location.search = q.toString(); });
document.title = `Hiraeth — serendipity map: ${meta?.title ?? id}`;
// (the game has no position parameter: the world opens on its debug save, where its dev menu's teleports are)
$('#play').href = debugSaveHref(id);

// ---- the renderer
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const camera = new THREE.PerspectiveCamera(50, 1, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI * 0.495;
let dirty = true;
controls.addEventListener('change', () => { dirty = true; });
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); dirty = true;
}
addEventListener('resize', resize);
resize();

await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));   // (the "building" card drawn first)
const t0 = performance.now();
let W;
try { W = buildWorld(id); } catch (e) { $('#busy').textContent = `could not build ${id}: ${e.message}`; throw e; }
const { markers, landing, hidden } = C.collectMarkers(W, { games: GAMES });
const E = C.emptiness(W, markers, { landing });
const built = performance.now() - t0;
const scene = W.scene;

// ---- the cheap look: every mesh flat shaded in its own colour; the people, the sky and the rooms off the map hidden
const terrain = (x, z) => { const h = W.level.ground?.heightAt?.(x, z); return Number.isFinite(h) ? h : null; };
const temples = (W.level.temples?.length ? W.level.temples : [W.level.temple]).filter(Boolean);
const mats = new Map();
function cheap(m, geo) {
  const key = `${m.uuid}|${!!geo.attributes.color}`;
  if (mats.has(key)) return mats.get(key);
  const c = m.uniforms?.uColor?.value ?? m.color ?? null;
  const col = c?.isColor ? c.clone() : new THREE.Color('#d9ccb0');
  // (the makers' glass and whatever was drawn see-through, water and haze: faint, never hiding what is under it)
  const glass = m.uniforms?.uGlass?.value > 0, clear = glass || !!m.transparent;
  const n = new THREE.MeshLambertMaterial({ color: col, vertexColors: !!geo.attributes.color, side: m.side ?? THREE.FrontSide,
    transparent: clear, opacity: glass ? 0.16 : clear ? Math.min(0.4, m.opacity ?? 1) : 1, depthWrite: !clear });
  mats.set(key, n);
  return n;
}
const box = new THREE.Box3(), mid = new THREE.Vector3(), landingY = landing[1];
scene.updateMatrixWorld(true);
const drop = [];
scene.traverse((o) => {
  if (o.isSkinnedMesh || o.isPoints || o.isLine || o.isSprite) { drop.push(o); return; }
  if (!o.isMesh) return;
  const g = o.geometry;
  if (!g?.attributes?.position) { drop.push(o); return; }
  g.boundingSphere ?? g.computeBoundingSphere();
  // the sky's dome and planes far bigger than any world
  if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() > 12000 || (o.material?.side === THREE.BackSide && g.boundingSphere.radius > 1500)) { drop.push(o); return; }
  if (!o.isInstancedMesh) {
    box.setFromObject(o).getCenter(mid);
    const t = terrain(mid.x, mid.z);
    // (the rooms built far from the ground, the temples' insides: they would float over the map)
    if (mid.y > 1200 || (t !== null && Math.abs(mid.y - t) > 400) || temples.some((T) => { try { return T.inside?.(mid); } catch { return false; } })) { drop.push(o); return; }
    // (a sea's surface or a ceiling of cloud far over the landing: a wide flat sheet that would hide the world under it)
    const size = box.getSize(new THREE.Vector3());
    if (size.y < 3 && Math.max(size.x, size.z) > 300 && mid.y > landingY + 25) { drop.push(o); return; }
  }
  o.material = Array.isArray(o.material) ? o.material.map((m) => cheap(m, g)) : cheap(o.material, g);
  o.castShadow = o.receiveShadow = false;
  o.frustumCulled = true;
});
for (const o of drop) o.visible = false;
scene.fog = null;
scene.background = new THREE.Color('#efe6d2');
scene.add(new THREE.HemisphereLight('#fffaf0', '#8a7a62', 2.2));
const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(0.5, 1, 0.3); scene.add(sun);

// ---- the markers: a dot over each thing, a stem down to it, a layer a kind
const dotTex = new Map();
function dot(color, ring = false) {
  const k = color + ring;
  if (dotTex.has(k)) return dotTex.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2);
  if (ring) { g.lineWidth = 9; g.strokeStyle = color; g.stroke(); } else { g.fillStyle = color; g.fill(); }
  g.lineWidth = 5; g.strokeStyle = '#2b211f'; g.beginPath(); g.arc(32, 32, ring ? 31 : 28, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  dotTex.set(k, t);
  return t;
}
const LIFT = { landing: 10, temple: 9, fight: 9, main: 7, errand: 6, person: 4, poi: 5, game: 5, shard: 3, box: 4, chest: 4, foe: 3 };
const SIZE = { landing: 0.04, temple: 0.032, fight: 0.032, main: 0.026 };
const layers = {}, sprites = [];
for (const k of C.KINDS) {
  const group = new THREE.Group(); group.name = k.key;
  const stems = [];
  for (const m of markers.filter((x) => x.kind === k.key)) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(k.color, k.key === 'landing'), depthTest: false, sizeAttenuation: false }));
    const lift = LIFT[k.key] ?? 4;
    s.position.set(m.pos[0], m.pos[1] + lift, m.pos[2]);
    const z = SIZE[k.key] ?? 0.019; s.scale.set(z, z, 1);
    s.renderOrder = 10 + C.KINDS.indexOf(k);
    s.userData.marker = m;
    group.add(s); sprites.push(s);
    stems.push(m.pos[0], m.pos[1], m.pos[2], m.pos[0], m.pos[1] + lift, m.pos[2]);
  }
  if (stems.length) {
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(stems, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: k.color, depthTest: false, transparent: true, opacity: 0.8 })));
  }
  scene.add(group);
  layers[k.key] = group;
}

// ---- the rings round the landing, on the ground, at walking distances (and the time at a run)
function label(text, color = '#2b211f', scale = 0.05) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = '600 30px ui-monospace, Menlo, monospace';
  const w = Math.ceil(g.measureText(text).width) + 20; c.width = w; c.height = 44;
  g.fillStyle = 'rgba(251,244,226,0.9)'; g.fillRect(0, 0, w, 44); g.strokeStyle = color; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, 41);
  g.font = '600 30px ui-monospace, Menlo, monospace'; g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 10, 23);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, sizeAttenuation: false }));
  s.scale.set(scale * w / 44, scale, 1); s.renderOrder = 30;
  return s;
}
const top = Math.max(...markers.map((m) => m.pos[1])) + 200;
const groundY = (x, z, y0 = landing[1]) => { const g = W.physics.groundAt(x, top, z, top - y0 + 400); return Number.isFinite(g) ? g : y0; };
const extent = Math.max(...markers.map((m) => Math.hypot(m.pos[0] - landing[0], m.pos[2] - landing[2])), 100);
const rings = new THREE.Group(); rings.name = 'rings';
for (const [i, r] of C.RINGS.filter((r, i) => r <= extent * 1.15 || i === 0).entries()) {
  const pts = [];
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2, x = landing[0] + Math.sin(a) * r, z = landing[2] + Math.cos(a) * r; pts.push(new THREE.Vector3(x, groundY(x, z) + 1.5, z)); }
  rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#2b211f', dashSize: r / 40, gapSize: r / 60, depthTest: false, transparent: true, opacity: 0.75 })).computeLineDistances());
  // (each ring's label a little further round than the last: never on top of each other)
  const l = label(`${r < 1000 ? `${r} m` : `${r / 1000} km`} · ${Math.round(r / C.RUN)} s run`, '#2b211f', 0.022), a = Math.PI * 0.6 + i * 0.45, lx = landing[0] + Math.sin(a) * r, lz = landing[2] + Math.cos(a) * r;
  l.position.set(lx, groundY(lx, lz) + 6, lz);
  rings.add(l);
}
scene.add(rings);

// ---- the empty ground: the cells reached more than E.far m from anything, and the emptiest spot
const emptyLayer = new THREE.Group(); emptyLayer.name = 'empty';
{
  const pos = [], col = [], c0 = new THREE.Color('#f2b8a0'), c1 = new THREE.Color('#c8282a'), c = new THREE.Color();
  for (let i = 0; i < E.nx * E.nz; i++) {
    if (E.empty[i] < E.far) continue;
    const x = E.x0 + ((i % E.nx) + 0.5) * E.cell, z = E.z0 + (Math.floor(i / E.nx) + 0.5) * E.cell;
    pos.push(x, E.h[i] + 0.8, z);
    c.copy(c0).lerp(c1, Math.min(1, (E.empty[i] - E.far) / (E.far * 2))); col.push(c.r, c.g, c.b);
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    emptyLayer.add(new THREE.Points(g, new THREE.PointsMaterial({ size: E.cell * 0.7, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false })));
  }
  if (E.worst) {
    const [x, y, z] = E.worst.pos, r = E.worst.metres, pts = [];
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r; pts.push(new THREE.Vector3(px, groundY(px, pz, y) + 2, pz)); }
    emptyLayer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#c8282a', depthTest: false })));
    const l = label(`emptiest: ${r} m from anything`, '#c8282a', 0.024); l.position.set(x, y + 12, z); emptyLayer.add(l);
  }
}
scene.add(emptyLayer);

// ---- the legend: a toggle a kind (its colour, how many), the rings, the empty ground
const counts = C.countByKind(markers);
const extra = [['rings', 'Rings round the landing', rings, '#2b211f', true], ['empty', `Empty ground (> ${E.far} m from anything)`, emptyLayer, '#c8282a', true]];
const KEY = 'hiraeth.serendipity.off';
let off = new Set();
try { off = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { off = new Set(); }
$('#legend').innerHTML = `<h2>Show</h2>${C.KINDS.map((k) => `<label><input type="checkbox" data-k="${k.key}"${off.has(k.key) ? '' : ' checked'}><span class="sw${k.key === 'landing' ? ' ring' : ''}" style="background:${k.color};border-color:${k.key === 'landing' ? k.color : '#2b211f'}"></span>${esc(k.name)}<span class="n">${counts[k.key]}</span></label>`).join('')}
  <hr>${extra.map(([k, name, , color]) => `<label><input type="checkbox" data-k="${k}"${off.has(k) ? '' : ' checked'}><span class="sw" style="background:${color}"></span>${esc(name)}</label>`).join('')}
  <div class="row"><button data-all="1">all</button><button data-all="0">none</button></div>`;
const layerOf = (k) => layers[k] ?? extra.find((e) => e[0] === k)?.[2];
function apply() {
  for (const inp of document.querySelectorAll('#legend input')) { const L = layerOf(inp.dataset.k); if (L) L.visible = inp.checked; }
  off = new Set([...document.querySelectorAll('#legend input')].filter((i) => !i.checked).map((i) => i.dataset.k));
  try { localStorage.setItem(KEY, JSON.stringify([...off])); } catch { /* private mode */ }
  dirty = true;
}
$('#legend').addEventListener('change', apply);
$('#legend').addEventListener('click', (e) => { const b = e.target.closest('[data-all]'); if (!b) return; for (const i of document.querySelectorAll('#legend input')) i.checked = b.dataset.all === '1'; apply(); });
apply();

// ---- the numbers
const interest = markers.filter((m) => !C.NOT_INTEREST.has(m.kind));
const walks = interest.map((m) => C.walkTo(E, m.pos)).filter((w) => w !== null);
const within = (r) => interest.filter((m) => Math.hypot(m.pos[0] - landing[0], m.pos[2] - landing[2]) <= r).length;
const area = E.reached * E.cell * E.cell;
$('#stats').innerHTML = `<h2>${esc(meta?.title ?? id)} in numbers</h2>
  <p><span class="big">${interest.length}</span> things of interest${hidden ? `, and ${hidden} in rooms with no door on the map` : ''}</p>
  <table>${C.KINDS.map((k) => `<tr><td><span style="color:${k.color}">●</span> ${esc(k.name)}</td><td>${counts[k.key]}</td></tr>`).join('')}</table>
  <h2>Empty stretches</h2>
  ${E.worst ? `<p>The emptiest walkable spot is <b>${E.worst.metres} m</b> from anything of interest: a stretch about <b>${E.worst.metres * 2} m</b> across (${Math.round(E.worst.metres * 2 / C.RUN)} s at a run), ${E.worst.walk} m walk from the landing.</p>
  <p><b>${Math.round(E.share * 100)} %</b> of the ground walkable from the landing (${area > 1e6 ? `${(area / 1e6).toFixed(2)} km²` : `${Math.round(area / 1e3) / 1000} km²`}) is more than ${E.far} m from anything.</p>` : '<p>No walkable ground found from the landing.</p>'}
  <h2>From the landing</h2>
  <p>${C.RINGS.slice(0, 4).map((r) => `within ${r} m: <b>${within(r)}</b>`).join(' · ')}</p>
  ${walks.length ? `<p>Walk to the farthest thing reached: <b>${Math.max(...walks)} m</b> (${Math.round(Math.max(...walks) / C.RUN / 60)} min at a run); ${interest.length - walks.length} not reached on foot over the grid (heights, water, mounts).</p>` : ''}
  <p style="color:#8a5a3c">grid ${E.cell} m · built in ${(built / 1000).toFixed(1)} s</p>`;

// ---- hover and click: what it is, its quest, where
const tip = $('#tip'), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const KIND_NAME = Object.fromEntries(C.KINDS.map((k) => [k.key, k]));
function hit(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const vis = sprites.filter((s) => s.parent.visible);
  const hits = ray.intersectObjects(vis, false);
  return hits[0]?.object.userData.marker ?? null;
}
const describe = (m) => {
  const k = KIND_NAME[m.kind], walk = C.walkTo(E, m.pos), d = Math.round(Math.hypot(m.pos[0] - landing[0], m.pos[2] - landing[2]));
  return `<div class="k" style="color:${k.color}">${esc(k.name)}</div><b>${esc(m.name)}</b>${m.quest ? `<div class="q">quest: ${esc(m.quest)}</div>` : ''}${m.note ? `<div>${esc(m.note)}</div>` : ''}${m.inside ? `<div>inside ${esc(m.inside)}: shown at its door</div>` : ''}
    <div class="q">${m.pos.map((v) => Math.round(v)).join(', ')} · ${d} m from the landing${walk !== null ? `, ${walk} m walk` : ''}</div>`;
};
canvas.addEventListener('pointermove', (e) => {
  const m = hit(e);
  if (!m) { tip.style.display = 'none'; return; }
  tip.innerHTML = describe(m); tip.style.display = 'block';
  const r = $('#app').getBoundingClientRect();
  tip.style.left = `${Math.min(e.clientX + 14, r.width - 330)}px`; tip.style.top = `${Math.min(e.clientY + 14, r.height - 120)}px`;
});
canvas.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
  const m = hit(e);
  if (!m) return;
  $('#pick .body').innerHTML = `${describe(m)}<p style="margin-top:6px"><a class="btn" href="${debugSaveHref(id)}">Play this world</a> <span class="q">the game has no position parameter: teleport there from its dev menu (F2)</span></p>`;
  $('#pick').classList.add('open');
  controls.target.set(m.pos[0], m.pos[1], m.pos[2]); dirty = true;
});
$('#pick .close').addEventListener('click', () => $('#pick').classList.remove('open'));

// ---- the view: from the south over the landing and most of its world (the nearest nine tenths of its things)
const dists = interest.map((m) => Math.hypot(m.pos[0] - landing[0], m.pos[2] - landing[2])).sort((a, b) => a - b);
const span = Math.max(150, 2.1 * (dists[Math.floor(dists.length * 0.9)] ?? 100));
const cx = landing[0], cz = landing[2];
const cy = groundY(cx, cz);
function view(fromAbove = false) {
  controls.target.set(cx, cy, cz);
  if (fromAbove) camera.position.set(cx, cy + span * 1.15, cz + 0.01);
  else camera.position.set(cx + span * 0.35, cy + span * 0.75, cz + span * 0.75);
  camera.far = span * 8 + 4000; camera.updateProjectionMatrix();
  controls.update(); dirty = true;
}
view();
$('#reset').addEventListener('click', () => view(false));
$('#top').addEventListener('click', () => view(true));
$('#status').textContent = `${interest.length} things · ${markers.length - interest.length} foes placed`;
$('#busy').hidden = true;

(function frame() {
  requestAnimationFrame(frame);
  if (controls.update()) dirty = true;
  if (!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
})();
// (for the screenshots and the tests in a browser: what the page found)
// (screenOf: where a marker's dot is on the page, CSS px, for a hover in a test)
const screenOf = (m) => { const s = sprites.find((x) => x.userData.marker === m); if (!s) return null; const v = s.position.clone().project(camera), r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
window.serendipity = { id, markers, landing, hidden, worst: E.worst, share: E.share, counts, built, screenOf };
