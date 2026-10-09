import * as T from 'three';
import { ItemViewer, dragOrbit, zoomOrbit } from '../items-page/viewer.js';
import { Foes, FOES } from '../foes.js';
import { GameState } from '../game-state.js';
import { ARCHETYPES, ARCHETYPE_IDS, archetypeOfKind, parseKind, skinned } from './archetypes.js';
import { SKINS, HOME_SKIN, skinOf } from './skins.js';
import { WORLDS, worldArchetypes } from '../foe-worlds.js';
import { TITLES } from '../levels/names.js';
import { sharedUniforms } from '../materials.js';
import { fitShadowExtent, FINE_CASCADE } from '../shadows.js';

// The creatures and spirits gallery (enemies.html): the enemy roster's archetypes (src/enemies/archetypes.js), each in
// every world's skin (src/enemies/skins.js), turning, standing, walking on the locomotion kit or winding up each of
// its attacks; with what tells each attack and what answers it, and links to fight it in the Arena. The archetypes
// not built yet show the old kind standing in for them.

const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const worldName = (w) => (w === 'roster' ? 'The roster (each in its own skin)' : TITLES[w] ?? w);
/** The rows of a world: { id (the kind to add, in its skin), archetype, name }. 'roster': each archetype in its own skin. */
function rowsOf(w) {
  const list = w === 'roster' ? ARCHETYPE_IDS : worldArchetypes(w);
  return list.map((a) => {
    const A = ARCHETYPES[a];
    if (!A.kind || !FOES[A.kind]) return null;
    const built = A.status === 'built', skin = built ? skinOf(a, w === 'roster' ? HOME_SKIN[a] : w) : null;
    return { id: built ? skinned(A.kind, skin.id) : A.kind, archetype: a, name: skin ? `${skin.name} (${A.name})` : `${A.name} (stand-in: ${FOES[A.kind].name})` };
  }).filter(Boolean);
}
const WORLD_LIST = ['roster', ...Object.keys(WORLDS)];
const ALL = WORLD_LIST.flatMap((w) => rowsOf(w));
let world = WORLD_LIST.includes(query.get('world')) ? query.get('world') : 'roster';
let chosen = rowsOf(world).find((r) => r.id === query.get('enemy'))?.id ?? (ALL.find((r) => r.id === query.get('enemy')) ? query.get('enemy') : rowsOf(world)[0].id);

class EnemyViewer extends ItemViewer {
  constructor() { super(); this.backdrop.material = this.backdrop.material.clone(); this.backdrop.material.fragmentShader = this.backdrop.material.fragmentShader.replace('L = mix(L, 1.0, max(uGlow, emit));', 'L = 1.0;'); this.backdrop.material.needsUpdate = true; this.mode = 'idle'; this.fixed = null; this.orbit = { yaw: 0.45, pitch: 0.15, zoom: 1 }; }
  // The shadow window: the game's own fine map (FINE_CASCADE: 2048 px over ±12 m, its bias and normal offset), wider only
  // for a creature whose shadow would not fit in it, centred on the creature's foot.
  fitShadow(m) { const e = m.shadowExtent; if (this.cascade.extent !== e || this.cascade.size !== FINE_CASCADE.size) { this.cascade.configure(FINE_CASCADE.size,e); this.cascade.prime(this.renderer); } }
  shadowCentre(m) { return m.f.model.group.getWorldPosition(this._foot ??= new T.Vector3()).setY(0); }
  model(id) {
    let m = this.models.get(id);
    if (!m) {
      for (const old of this.models.values()) { old.owner.dispose(); old.holder.removeFromParent(); }
      this.models.clear();
      const owner = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new T.Vector3(0, 0, 4), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null) });
      const f = owner.add(id, new T.Vector3()); f.heading = 0; owner.look(f, 0);
      const b = new T.Box3().setFromObject(f.model.group), centre = b.getCenter(new T.Vector3());
      const holder = new T.Group(); holder.add(owner.group);
      const size = b.getSize(new T.Vector3()), shadowExtent = fitShadowExtent(1.3 * Math.hypot(size.x, size.z) / 2, 1.15 * size.y + (f.def.hover ?? 0), sharedUniforms.uSunDir.value.y, {min:FINE_CASCADE.extent,max:2*FINE_CASCADE.extent});
      m = { holder, owner, f, centre, r: b.getBoundingSphere(new T.Sphere()).radius, height: b.max.y - b.min.y, fluids: [], shadowExtent };
      this.models.set(id, m);
    }
    this.fitShadow(m);
    m.holder.position.set(0, 0, 0); m.owner.group.position.set(0, 0, 0); m.holder.updateMatrixWorld(true);
    const f = m.f, dt = this.fixed ? 0 : 1 / 60, P = m.owner.player;
    f.heading = 0; f.stunned = 0; f.dist = 2;   // (close by: a hound is solid, a tripod aims its lamp at you)
    // walking, it really walks (its feet are planted by the locomotion kit: src/motion-kit/), and the view follows it
    const walking = this.mode === 'walk' && !this.fixed; m.walkZ = walking ? (m.walkZ ?? 0) + f.def.speed * dt : 0; f.pos.set(0, 0, m.walkZ);
    let phase = this.fixed?.state ?? this.mode, k = this.fixed?.k ?? 0, a = null;
    if (this.mode.startsWith('attack')) {
      a = movesOf(f)[Number(this.mode.slice(6))] ?? f.def.attack;
      const cycle = a.wind + (a.strike ?? 0.3) + (a.recover ?? f.def.recover), u = this.time % cycle;
      if (f.atk !== a) { f.atk = a; P.pos.set(0, 0, Math.max(3, Math.min(a.max ?? f.def.reach, 6))); f.attackH = f.heading + (a.back ? Math.PI : 0); f.placeArea(a, P); }
      if (!this.fixed) { phase = u < a.wind ? 'wind' : u < a.wind + (a.strike ?? 0.3) ? 'strike' : 'recover'; k = phase === 'wind' ? u / a.wind : phase === 'strike' ? (u - a.wind) / (a.strike ?? 0.3) : 0; }
    } else f.atk = null;
    f.state = phase === 'walk' ? 'chase' : phase; f.k = k; f.timer = f.def.recover * (1 - (phase === 'recover' ? Math.min(1, (this.time % 2) / 2) : 0));
    if (phase === 'strike' && a?.lunge) f.pos.z = a.lunge * (1 - (1 - k) ** 2);
    f.alt = f.def.hover ? (phase === 'strike' && a?.dive ? T.MathUtils.lerp(f.def.hover, 0.35, k) : phase === 'recover' ? 0.35 : f.def.hover) : 0;
    m.owner.look(f, dt);
    // the view is fitted to the body and, showing a move, to the ground it covers
    const b = new T.Box3().setFromObject(f.model.group);
    if (a) {
      const o = a.at === 'target' || a.at === 'behind' ? f.attackAt : f.pos, h = f.attackH ?? 0;
      if (a.shape === 'ring') { for (const x of [-1, 1]) for (const z of [-1, 1]) b.expandByPoint(new T.Vector3(o.x + x * a.radius, 0, o.z + z * a.radius)); }
      else if (a.shape === 'cone') { b.expandByPoint(o); for (let i = 0; i <= 8; i++) { const an = h - a.angle + 2 * a.angle * i / 8; b.expandByPoint(new T.Vector3(o.x + Math.sin(an) * Math.min(a.range, 7), 0, o.z + Math.cos(an) * Math.min(a.range, 7))); } }
      else for (const along of [0, Math.min(a.range, 8)]) for (const side of [-a.width / 2, a.width / 2]) b.expandByPoint(new T.Vector3(o.x + Math.sin(h) * along + Math.cos(h) * side, 0, o.z + Math.cos(h) * along - Math.sin(h) * side));
    }
    const centre = b.getCenter(new T.Vector3()); if (walking) { centre.x = m.centre.x + f.pos.x; centre.z = m.centre.z + f.pos.z; }
    m.owner.group.position.copy(centre).negate();
    m.r = b.getBoundingSphere(new T.Sphere()).radius; m.height = b.max.y - b.min.y;
    return m;
  }
}
/** A foe's moves to show (not a combo's quick follow-up). */
const movesOf = (f) => f.def.attacks.filter((a) => !a.chain);

const viewer = new EnemyViewer(); $('stage').append(viewer.renderer.domElement);
$('world').innerHTML = WORLD_LIST.map((w) => `<option value="${w}">${worldName(w)}</option>`).join('');
function choose(id, w = null) {
  if (w) world = w;
  if (!rowsOf(world).some((r) => r.id === id)) world = WORLD_LIST.find((x) => rowsOf(x).some((r) => r.id === id)) ?? 'roster';
  chosen = id; $('world').value = world;
  const { kind, skin } = parseKind(id), rows = rowsOf(world);
  // (a skin met only in the Arena, the ink lizard of the Atelier: shown on its own)
  let row = rows.find((r) => r.id === id);
  if (!row) { row = { id, archetype: archetypeOfKind(kind), name: id }; rows.push(row); }
  const A = ARCHETYPES[row.archetype];
  $('enemy').innerHTML = rows.map((r) => `<option value="${r.id}">${r.name}</option>`).join(''); $('enemy').value = id;
  const S = skin ? skinOf(row.archetype, skin) : null;
  $('name').textContent = S?.name ?? A.name;
  const family = A.family === 'machine' ? `An old makers’ machine with a dark spirit inside (${A.possession})` : A.family === 'spirit' ? `A spirit: ${A.manifestation}` : 'A creature: wildlife that fights only when provoked';
  $('kind').innerHTML = `<b>${A.name}</b> · ${A.role} · tier ${A.tier}. ${family}. <i>${A.idle}.</i>${A.status === 'built' ? '' : ` <br>Not built yet: the ${FOES[kind].name} stands in for it.`}${A.art === 'pending' ? ' <br><span class="hint">Art match pending its fresh reference sheet.</span>' : ''}`;
  const f = viewer.model(id).f;
  $('pose').innerHTML = `<option value="idle">Standing</option><option value="walk">Moving</option>${movesOf(f).map((a, i) => `<option value="attack${i}">${a.name ?? a.id}</option>`).join('')}`;
  $('moves').innerHTML = movesOf(f).map((a, i) => `<button data-attack="${i}">${a.name ?? a.id}</button><p>${a.tell ? `Tell: ${a.tell}. ` : ''}${a.counter ? `Answer: ${a.counter}. ` : ''}Wind-up: ${a.wind}s.${a.skins ? ` (Only in ${a.skins.map((x) => TITLES[x] ?? x).join(' and ')}.)` : ''}</p>`).join('')
    + `<p><b>Best answers:</b> ${A.answers.join('; ')}.</p>`;
  $('fight').href = `./?level=arena&enemy=${encodeURIComponent(id)}`;
  $('fightworld').hidden = world === 'roster'; $('fightworld').href = `./?level=arena&enemyWorld=${world}`;
  $('calm').hidden = !S?.arena;
  viewer.time = 0; viewer.mode = 'idle'; $('pose').value = 'idle';
  history.replaceState(null, '', `?world=${world}&enemy=${encodeURIComponent(id)}`);
}
$('world').onchange = () => { world = $('world').value; choose(rowsOf(world)[0].id, world); };
$('enemy').onchange = () => choose($('enemy').value, world);
$('pose').onchange = () => { viewer.mode = $('pose').value; viewer.time = 0; viewer.fixed = null; };
$('moves').onclick = (e) => { const i = e.target.dataset.attack; if (i !== undefined) { $('pose').value = 'attack' + i; $('pose').onchange(); } };
let drag = null; $('stage').onpointerdown = (e) => { drag = [e.clientX, e.clientY]; $('stage').setPointerCapture(e.pointerId); };
$('stage').onpointermove = (e) => { if (drag) { dragOrbit(viewer.orbit, e.clientX - drag[0], e.clientY - drag[1]); drag = [e.clientX, e.clientY]; } };
$('stage').onpointerup = () => drag = null;
$('stage').addEventListener('wheel', (e) => { e.preventDefault(); zoomOrbit(viewer.orbit, Math.exp(e.deltaY * 0.001)); }, { passive: false });
choose(chosen, world);
let last = performance.now();
function frame(now) { viewer.time += Math.min(0.05, (now - last) / 1000); last = now; viewer.setSize($('stage').clientWidth, $('stage').clientHeight); viewer.render(chosen); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
window.enemyViewer = {
  viewer, choose, roster: ALL, skins: SKINS,
  capture(id, { state = 'idle', k = 0, attack = 0, yaw = 0.45 } = {}) {
    choose(id); viewer.mode = ['wind', 'strike', 'recover'].includes(state) ? 'attack' + attack : state; viewer.fixed = { state, k }; viewer.orbit.yaw = yaw; viewer.time = 1; viewer.setSize(900, 800); viewer.render(id);
    return viewer.renderer.domElement.toDataURL('image/png');
  },
};
