// The Wardrobe (issue #571, src/wardrobe.js): the game menu's last panel, where the traveller is dressed. Its lists
// (the outfits, each with its unlocked flag, and the blade's colours won), saving the choice and putting it on him at
// once, the pad moving through it with the preview following the cursor, Back leaving him as he was; with B3 (the
// game's traveller until v2 is the default) the outfits' line says they need the new traveller. And the engines' menus,
// which draw the same page in Unity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const W = await import('../src/wardrobe.js');
const { OUTFITS, OUTFIT_KEY, outfitUnlocked, chosenOutfit, chooseOutfit, bladeColours, wardrobeData, previewOf, wireWardrobe, Turntable, TURN, wardrobeShot, SHOT, PageIdle, PAGE_IDLE } = W;
const { GameMenu, PANELS, wardrobePanel } = await import('../src/game-menu.js');
const { menuSources } = await import('../src/game-menu-data.js');
const { EngineMenus } = await import('../engine/menus.js');
const { Controller } = await import('../src/controller.js');
const { KIT_COLOURS, unlockColours, chosenColour } = await import('../src/kit-colours.js');

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** A save's state over memory (game.flag / set). */
const state = (flags = {}) => ({ data: { flags }, flag: (k) => flags[k], set: (k, v) => { flags[k] = v; }, flags });
/** The v2 traveller's dressing as characters/traveller-v2.js wearTravellerV2 returns it: wear(id) async, wardrobe.worn. */
function dresser(start = 'default') {
  const d = { worn: [], wardrobe: { worn: { id: start } }, async wear(id) { d.worn.push(id); d.wardrobe.worn = { id }; } };
  return d;
}
const settle = () => new Promise((r) => setTimeout(r, 0));
/** The page's host on a fake game: the save, the kit's paint counted, the sword owned, v2 drawn or not. */
function host({ flags = {}, v2 = true, sword = true } = {}) {
  const game = state(flags), dress = v2 ? dresser(chosenOutfit(game)) : null, kit = { painted: 0, paint() { this.painted++; } };
  const player = { object: new THREE.Group(), pos: new THREE.Vector3(), heading: 0, frame: null };
  new THREE.Scene().add(player.object);
  const w = wireWardrobe({ game, kit, tool: { swordOn: sword }, player, dress: () => dress });
  return { w, game, dress, kit, player };
}

test('the outfits: his own clothes and all fifteen outfits, the list outfits.json makes; each with its unlocked flag, all his from the start', () => {
  const list = JSON.parse(src('data/characters/traveller-v2/outfits.json'));
  assert.deepEqual(OUTFITS.map((o) => o.id), list.outfits.map((o) => o.id), 'the same outfits, in the same order');
  assert.equal(OUTFITS.length, 16);
  assert.equal(OUTFITS[0].id, 'default');
  const d = wardrobeData({ state: state(), v2: true });
  assert.ok(d.outfits.every((o) => o.unlocked), 'all available from day one (the author, 2026-10-20)');
  assert.deepEqual(d.outfits.filter((o) => o.worn).map((o) => o.id), ['default'], 'his own clothes worn on a new save');
  // later: an outfit won by progress, by a flag of the save
  const later = { id: 'x', unlock: { flag: 'temple.desert.done' } };
  assert.equal(outfitUnlocked(later, state()), false);
  assert.equal(outfitUnlocked(later, state({ 'temple.desert.done': true })), true);
  // the save's choice; one that isn't his (or no longer exists) is his own clothes
  assert.equal(chosenOutfit(state({ [OUTFIT_KEY]: 'lamplighter' })), 'lamplighter');
  assert.equal(chosenOutfit(state({ [OUTFIT_KEY]: 'tuxedo' })), 'default');
  const g = state();
  assert.equal(chooseOutfit(g, 'tuxedo'), false);
  assert.equal(chooseOutfit(g, 'pearl-diver'), true);
  assert.equal(g.flags[OUTFIT_KEY], 'pearl-diver');
  for (const outfit of OUTFITS) {
    assert.equal(chooseOutfit(g, outfit.id), true, `${outfit.id} can be worn`);
    assert.equal(chosenOutfit(g), outfit.id, `${outfit.id} persists in the wardrobe save`);
  }
});

test('the blade\'s colours: only those won (the makers\' jade always, one a fight temple cleared), the worn one marked; none without the sword', () => {
  assert.deepEqual(bladeColours(state()).map((b) => b.id), ['makers'], 'a new save: the makers\' jade alone');
  const g = state();
  unlockColours(g, 'slate', { wear: false }); unlockColours(g, 'ember', { wear: false });
  const b = bladeColours(g);
  assert.deepEqual(b.map((x) => x.id), ['makers', 'ember', 'slate'], 'in the table\'s order, whichever was won first');
  assert.equal(b[1].swatch, KIT_COLOURS.find((c) => c.id === 'ember').water.base, 'its swatch: the colour of its water');
  assert.equal(b[1].house, 'the Sunken Hall');
  g.set('kit.colour.sword', 'slate');
  assert.deepEqual(wardrobeData({ state: g }).blades.filter((x) => x.worn).map((x) => x.id), ['slate']);
  assert.deepEqual(wardrobeData({ state: g, sword: false }).blades, [], 'no sword yet: no colours to choose');
});

test('the page: the outfits then the blades, a row each, A / × wears all but the one worn; with B3 the outfits need the new traveller', () => {
  const g = state({ 'kit.colours.ember': true });
  const v2 = wardrobePanel(wardrobeData({ state: g, v2: true }));
  assert.deepEqual(v2.rows.map((r) => `${r[0].kind}:${r[0].id}`), [...OUTFITS.map((o) => `outfit:${o.id}`), 'blade:makers', 'blade:ember']);
  assert.ok(v2.rows.every((r) => r.length === 1 && r[0].col === 0), 'one column: ↑ ↓ go through both lists');
  assert.equal(v2.rows[0][0].act, null, 'his own clothes are on');
  assert.ok(v2.rows.slice(1, 6).every((r) => r[0].act === 'wear'));
  assert.deepEqual(v2.start, { r: 0, c: 0 }, 'the cursor starts on what he wears');
  assert.match(v2.html, /data-wardrobe-stage><canvas class="wd-view">/, 'the stage he is drawn on, at the right');
  assert.match(v2.html, /<em class="tag">wearing<\/em>/);
  assert.match(v2.html, /class="ico swatch" style="background:#e8703a"/, 'each colour its swatch');
  // a locked outfit (the list can lock them later): shown, not worn by A / ×
  const locked = wardrobePanel({ v2: true, sword: false, outfits: [{ id: 'default', name: 'His own clothes', unlocked: true, worn: true }, { id: 'x', name: 'X', unlocked: false, worn: false }] });
  assert.equal(locked.rows[1][0].act, null);
  assert.ok(locked.rows[1][0].locked);
  assert.match(locked.html, /line wd-outfit locked/);
  // B3: no outfit rows, the line that says why; the blades as before
  const b3 = wardrobePanel(wardrobeData({ state: g, v2: false }));
  assert.deepEqual(b3.rows.map((r) => r[0].kind), ['blade', 'blade']);
  assert.match(b3.html, /<p class="none">The outfits need the new traveller\.<\/p>/);
  assert.deepEqual(b3.start, { r: 0, c: 0 }, 'on the blade worn');
  // no sword: no colours, said so
  const bare = wardrobePanel(wardrobeData({ state: state(), v2: false, sword: false }));
  assert.deepEqual(bare.rows, []);
  assert.match(bare.html, /No sword yet\./);
  assert.equal(PANELS.at(-1).id, 'wardrobe', 'the menu\'s last panel: one LB / L1 from the Quests');
});

test('the preview: the choice saved with the highlighted one in its place (an outfit not his yet is not tried on)', () => {
  const d = { outfits: [{ id: 'default', unlocked: true, worn: true }, { id: 'lamplighter', unlocked: true }, { id: 'x', unlocked: false }], blades: [{ id: 'makers', worn: true }, { id: 'ember' }] };
  assert.deepEqual(previewOf(d, null), { outfit: 'default', blade: 'makers' });
  assert.deepEqual(previewOf(d, { kind: 'outfit', id: 'lamplighter' }), { outfit: 'lamplighter', blade: 'makers' });
  assert.deepEqual(previewOf(d, { kind: 'blade', id: 'ember' }), { outfit: 'default', blade: 'ember' });
  assert.deepEqual(previewOf(d, { kind: 'outfit', id: 'x' }), { outfit: 'default', blade: 'makers' });
});

test('saving the choice: A / × keeps it in the save and puts it on him at once (the outfit worn, the kit painted)', async () => {
  const { w, game, dress, kit } = host({ flags: { 'kit.colours.ember': true } });
  assert.equal(w.wear('outfit', 'glider-pilot'), true);
  await settle();
  assert.equal(game.flags[OUTFIT_KEY], 'glider-pilot', 'in the save');
  assert.equal(dress.wardrobe.worn.id, 'glider-pilot', 'and on him');
  assert.equal(w.wear('blade', 'ember'), true);
  assert.equal(chosenColour(game, 'sword'), 'ember');
  assert.equal(kit.painted, 1, 'the sword he carries in it at once (src/kit-colours.js applyKitColours)');
  assert.equal(w.wear('blade', 'neon'), false, 'a colour not won');
  assert.equal(chosenColour(game, 'sword'), 'ember');
  // B3: the colours still; the outfit saved for when the new traveller is drawn
  const b3 = host({ v2: false });
  assert.equal(b3.w.wear('outfit', 'lamplighter'), true);
  assert.equal(b3.w.data().v2, false);
  // main.js reads it as the world loads: the save's outfit, unless the address names one
  assert.match(src('src/main.js'), /if \(!query\.has\('outfit'\) && game\.flag\(OUTFIT_KEY\)\) travellerV2\.outfit = chosenOutfit\(game\);/);
});

test('the pad through the page: the preview follows the cursor, A / × wears, B / ○ leaves him as he was', async () => {
  const { w, game, dress, player } = host({ flags: { 'kit.colours.ember': true } });
  const m = new GameMenu(null, { sources: menuSources({ items: { owned: () => [] }, journal: { data: {} }, levels: [], order: [], wardrobe: () => w.data() }), wardrobe: w });
  m.open('wardrobe');
  assert.equal(m.panel, 'wardrobe');
  assert.deepEqual(m.state.cursor(), { r: 0, c: 0 });
  assert.ok(w.sword?.parent === player.object.parent, 'the sword stood beside him in the world while the page shows');
  m.navigate(0, 1); await settle();
  assert.equal(m.state.cell(m.rows).id, 'glider-pilot');
  assert.equal(dress.wardrobe.worn.id, 'glider-pilot', 'the highlighted outfit tried on');
  m.navigate(0, 1); m.navigate(0, 1); await settle();
  assert.equal(dress.wardrobe.worn.id, 'pearl-diver');
  assert.equal(game.flags[OUTFIT_KEY], undefined, 'nothing saved by looking');
  // down to the blades: the outfit back to his own, the sword in the colour highlighted
  for (let i = 0; i < OUTFITS.length - 2; i++) m.navigate(0, 1);
  await settle();
  assert.equal(m.state.cell(m.rows).id, 'ember');
  assert.equal(dress.wardrobe.worn.id, 'default');
  const U = w.sword.userData.material.uniforms.uFluidBase.value;
  assert.equal(`#${U.getHexString()}`, KIT_COLOURS.find((c) => c.id === 'ember').water.base, 'the sword beside him in Ember');
  assert.equal(m.verb(), 'wear');
  m.confirm();
  assert.equal(chosenColour(game, 'sword'), 'ember', 'A / ×: saved');
  assert.equal(m.state.cell(m.rows).act, null, 'worn now');
  // up to an outfit and out with B / ○ (the menu closes: Journal.toggle(false) → close): him as he was
  m.navigate(0, -1); m.navigate(0, -1); await settle();
  assert.equal(dress.wardrobe.worn.id, OUTFITS.at(-1).id);
  assert.equal(m.back(), false, 'B / ○ on the page closes the menu');
  m.close(); await settle();
  assert.equal(dress.wardrobe.worn.id, 'default', 'back in his own clothes');
  assert.equal(game.flags[OUTFIT_KEY], undefined);
  assert.equal(chosenColour(game, 'sword'), 'ember', 'what was worn with A / × stays');
  assert.equal(w.sword.parent, null, 'the sword beside him put away');
  // turning to another panel leaves it too
  m.open('wardrobe');
  assert.deepEqual(m.state.cursor(), { r: OUTFITS.length - 1, c: 0 }, 'the cursor where it was, as on every panel');
  m.navigate(0, -1); await settle();
  assert.equal(dress.wardrobe.worn.id, OUTFITS.at(-2).id);
  m.turn(1); await settle();
  assert.equal(m.panel, 'quests');
  assert.equal(dress.wardrobe.worn.id, 'default');
});

test('turning him: on his own after a moment, the right stick (the pad\'s, handed to the menu) and a drag turn him', () => {
  const t = new Turntable();
  assert.equal(t.yaw, TURN.start);
  t.tick(1); assert.ok(Math.abs(t.yaw - (TURN.start + TURN.rate)) < 1e-9, 'slowly, on his own');
  t.stick(1, 0.5); assert.ok(Math.abs(t.yaw - (TURN.start + TURN.rate + TURN.stick * 0.5)) < 1e-9);
  const y = t.yaw; t.tick(0.5); assert.ok(Math.abs(t.yaw - y) < 1e-9, 'held a moment after a hand turned him');
  t.stick(0.05, 1); assert.ok(Math.abs(t.yaw - y) < 1e-9, 'the stick at rest');
  const d = new Turntable(); d.drag(-50); assert.ok(Math.abs(d.yaw - (TURN.start - 50 * TURN.drag)) < 1e-9, 'a drag');
  // the pad's right stick reaches the menu's page (src/controller.js menuAnalog), the left one still moves the cursor
  const pad = { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0.9, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const got = [];
  const c = new Controller({ pads: () => [pad], context: () => 'menu', action() {}, look() {}, navigate() {}, scroll() {}, faces: () => ({ faces: 'xbox', byLabel: false }), menuAnalog: (a) => { got.push(a.rx); return false; } });
  c.update(0.016);
  assert.ok(got[0] > 0.5, 'the right stick\'s x');
  const m = new GameMenu(null, { sources: { wardrobe: () => wardrobeData({ state: state() }) } });
  m.open('wardrobe');
  const y0 = m.turntable.yaw;
  assert.equal(m.wardrobeAnalog({ rx: 1 }, 0.1), false, 'the left stick is the cursor\'s still');
  assert.ok(m.turntable.yaw > y0);
  assert.match(src('src/main.js'), /journal\.menu\.panel === 'map' \? journal\.menu\.mapAnalog\(a, dt\) : journal\.menu\.wardrobeAnalog\(a, dt\)/);
});

test('the camera on him: his whole height from `yaw` round his front, with room for the held blade', () => {
  const p = { pos: new THREE.Vector3(10, 2, -5), heading: 0, frame: null };
  const s = wardrobeShot(p, 0, 1.1);
  assert.equal(s.dist, SHOT.dist, 'a picture as wide as high: the usual distance');
  assert.ok(Math.abs(s.eye.x - 10) < 1e-9 && Math.abs(s.eye.z - (-5 + SHOT.dist)) < 1e-9, 'in front of him (+z his front)');
  assert.ok(Math.abs(s.eye.y - (2 + SHOT.eye)) < 1e-9 && Math.abs(s.look.y - (2 + SHOT.look)) < 1e-9);
  const side = wardrobeShot(p, Math.PI / 2, 1.1);
  assert.ok(Math.abs(side.eye.distanceTo(p.pos.clone().setY(2 + SHOT.eye)) - SHOT.dist) < 1e-9, 'round him at the same distance');
  assert.ok(wardrobeShot(p, 0, 0.75).dist > SHOT.dist + 1, 'a narrow picture (Unity\'s on 4:3): further off');

});

test('the engines\' menus: the same page, its preview following the cursor, A / × wearing, out of it him as he was', async () => {
  const { w, game } = host({ flags: { 'kit.colours.ember': true }, v2: false });
  const calls = [];
  const spy = { preview: (c) => { calls.push(['preview', c?.id ?? null]); return w.preview(c); }, wear: (k, id) => { calls.push(['wear', id]); return w.wear(k, id); }, leave: () => { calls.push(['leave']); w.leave(); } };
  const m = new EngineMenus({ sources: { wardrobe: () => w.data() }, wardrobe: spy });
  m.show('game', 'wardrobe');
  let v = m.view();
  assert.equal(v.panel, 'wardrobe');
  assert.equal(v.wardrobe.outfitNote, 'The outfits need the new traveller.', 'B3 in the engines: the outfits\' line');
  assert.equal(v.wardrobe.outfits, 0);
  assert.deepEqual(v.rows.map((r) => r[0].text), ['Makers’ jade', 'Ember']);
  assert.equal(v.rows[0][0].worn, true);
  assert.equal(v.rows[1][0].swatch, '#e8703a');
  assert.deepEqual(calls.at(-1), ['preview', 'makers']);
  m.navigate(0, 1);
  assert.deepEqual(calls.at(-1), ['preview', 'ember'], 'the preview follows');
  assert.match(m.view().hint, /A \/ × wear/);
  m.action('confirm');
  assert.deepEqual(calls.find((c) => c[0] === 'wear'), ['wear', 'ember']);
  assert.equal(chosenColour(game, 'sword'), 'ember');
  const y0 = m.turntable.yaw;
  assert.equal(m.analog({ rx: 1 }, 0.1), false); assert.ok(m.turntable.yaw > y0, 'the right stick turns him');
  m.action('back');
  assert.equal(m.mode, null);
  assert.deepEqual(calls.at(-1), ['leave'], 'closed: him as he was');
  // engine/game.js draws him into the page's picture each frame; the Unity bridge shows it (BridgeMenu.Wardrobe.cs)
  const eg = src('engine/game.js');
  assert.match(eg, /if \(onWardrobe\) wardrobeCapture\(wardrobeAt\);/);
  assert.match(src('engine/unity/backend.js'), /this\.host\.Wardrobe\?\.\(JSON\.stringify/);
  assert.match(src('engine/unity/game.js'), /menus\.wardrobe = game\.wardrobe;/);
});

/** A skeleton as humanoid.js names it (the bones the page's idle moves, and a hand it leaves), under his object. */
function skeleton() {
  const root = new THREE.Group(), b = {};
  const bone = (n, parent, y, x = 0) => { const o = new THREE.Bone(); o.name = n; o.position.set(x, y, 0); o.quaternion.setFromEuler(new THREE.Euler(0.1, 0.2 * x, 0.05)); parent.add(o); return (b[n] = o); };
  const pelvis = bone('pelvis', root, 1), s2 = bone('spine_02', bone('spine_01', pelvis, 0.1), 0.15), s3 = bone('spine_03', s2, 0.15);
  bone('Head', bone('neck_01', s3, 0.2), 0.1);
  bone('hand_l', bone('lowerarm_l', bone('upperarm_l', s3, 0.15, 0.2), 0.3), 0.25);
  bone('upperarm_r', s3, 0.15, -0.2);
  root.rotation.y = 0.8; root.position.set(3, 1, 2);
  root.updateMatrixWorld(true);
  return { root, b };
}
const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));

test('on the page he is not frozen: he breathes and looks about over the pose the menu opened on, gently, and is put back as he was', () => {
  const { root, b } = skeleton();
  const rest = Object.fromEntries(Object.entries(b).map(([n, o]) => [n, o.quaternion.clone()]));
  const idle = new PageIdle();
  const seen = { Head: [], spine_03: [], upperarm_l: [] };
  for (let t = 0; t < 12; t += 0.25) {
    idle.pose(b, root, t);
    for (const n of Object.keys(seen)) seen[n].push(b[n].quaternion.clone());
    for (const [n, o] of Object.entries(b)) assert.ok(angle(o.quaternion, rest[n]) < 0.2, `${n} only a little off the pose under it at ${t}`);
    for (const n of ['pelvis', 'spine_01', 'lowerarm_l', 'hand_l']) assert.ok(o_eq(b[n].quaternion, rest[n]), `${n} left alone (his feet planted)`);
  }
  for (const [n, qs] of Object.entries(seen)) assert.ok(Math.max(...qs.map((q) => angle(q, rest[n]))) > 0.01, `${n} moves`);
  idle.put();
  for (const [n, o] of Object.entries(b)) assert.ok(o_eq(o.quaternion, rest[n]), `${n} as he was once the page is left`);
  // the game ran between two visits (he was posed again): the pose under it taken again, not the old one put back
  b.Head.quaternion.setFromEuler(new THREE.Euler(0, 0.7, 0));
  const turned = b.Head.quaternion.clone();
  idle.pose(b, root, 3); idle.pose(b, root, 3.5);
  assert.ok(angle(b.Head.quaternion, turned) < 0.2, 'over the new pose');
  idle.put();
  assert.ok(o_eq(b.Head.quaternion, turned));
  assert.ok(PAGE_IDLE.look < 0.2 && PAGE_IDLE.breath < 0.05, 'gentle');
});
function o_eq(a, b) { return angle(a, b) < 1e-6; }

test('the page\'s host moves him each drawn frame and puts him back as he was when the page is left (web and engines: tick, leave)', () => {
  const { w, player } = host({ v2: false });
  const { root, b } = skeleton();
  player.object.add(root); player.humanoid = { b };
  const head = b.Head.quaternion.clone();
  w.preview(null);
  let most = 0;
  for (let i = 0; i < 40; i++) { w.tick(0.1); most = Math.max(most, angle(b.Head.quaternion, head)); }
  assert.ok(most > 0.01, 'not frozen');
  w.leave();
  assert.ok(o_eq(b.Head.quaternion, head), 'as he was');
  // (the tick that poses him runs before each picture of him: engine/game.js wardrobeCapture, main.js wardrobeFrame)
  assert.match(src('engine/game.js'), /wardrobe\.tick\(realDt\); wardrobe\.place\(wardrobeAt\);/);
  const main = src('src/main.js'), frame = main.slice(main.indexOf('function wardrobeFrame()'), main.indexOf('function wardrobeFrame()') + 1200);
  assert.ok(frame.indexOf('wardrobe.tick(dt)') > 0 && frame.indexOf('wardrobe.tick(dt)') < frame.indexOf('captureView('), 'the web: posed before the picture');
});

test('Unity: every fight-surface material (a foe, a crystal, the blade, the shield) is bound a buffer for the variant\'s _SkinData, so Metal draws it (issue #571: the Wardrobe\'s blade drew nothing)', () => {
  const loader = src('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs');
  const sites = [...loader.matchAll(/mat\.EnableKeyword\("HIRAETH_FIGHT"\);/g)];
  assert.ok(sites.length >= 3, 'the foes\', the crystal\'s and the blade\'s');
  for (const m of sites) {
    const block = loader.slice(loader.lastIndexOf('{', m.index), m.index);
    assert.match(block, /SetSkinData\(mat, /, `a buffer bound before: ${block.slice(0, 80)}`);
  }
  assert.match(loader, /_BladeOn", m\.I\("blade"\)\);\s*SetSkinData\(mat, NoSkinData\);/);
  // (the variant declares it: FoeSurface.hlsl's, which BladeSurface.hlsl's shares)
  assert.match(src('unity/Hiraeth/Assets/Hiraeth/Shaders/FoeSurface.hlsl'), /StructuredBuffer<float4> _SkinData;/);
});

test('the preview\'s light: the sun as in the world, none of the world\'s shadows on him wherever he stands, the same on the web and in Unity (issue #578)', () => {
  // the web: the Wardrobe's capture asks for its own light; its frame draws the shadow maps with him and the sword alone
  const main = src('src/main.js');
  const frame = main.slice(main.indexOf('function wardrobeFrame()'), main.indexOf('function wardrobeFrame()') + 1400);
  assert.match(frame, /captureView\([^;]*own: true[^;]*\);/, 'the Wardrobe asks for its own light');
  const cap = main.slice(main.indexOf('function captureView('), main.indexOf('function captureView(') + 3000);
  assert.match(cap, /if \(own && keep\) \{ ownShadows = keep; SU\.uCloudShadows\.value = 0; \}/, 'his and the sword\'s maps, no clouds\' shadows');
  assert.match(cap, /ownShadows = null; SU\.uCloudShadows\.value = clouds;/, 'and back as they were after the picture');
  const draw = main.slice(main.indexOf('function renderFrame()'), main.indexOf('// 2. G-buffer'));
  assert.match(draw, /if \(ownShadows\) ownShadowPass\(ownShadows\);\s*else \{\s*scene\.overrideMaterial = shadowOverride;/, 'the world\'s passes skipped for it');
  const own = main.slice(main.indexOf('function ownShadowPass('), main.indexOf('function shadowPass('));
  assert.match(own, /heroScene\.children = list;/, 'its maps drawn with his list alone (not the scene, not the still meshes\' batch)');
  assert.doesNotMatch(own, /statics|renderer\.render\(scene/, 'nothing of the world in them');
  assert.match(own, /c\.view = undefined;/, 'the world\'s next frame draws every map again');
  // Unity: the Wardrobe's camera draws the fine map of his renderers alone and reads no other map, no clouds' shadows
  const runner = src('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  const w = runner.slice(runner.indexOf('public void Wardrobe(string json)'), runner.indexOf('public void ScreenAs('));
  assert.match(w, /HiraethShadows\.OwnCam = pc;/);
  assert.match(w, /Shader\.SetGlobalFloat\("_CloudShadows", 0\);/);
  assert.ok(w.indexOf('HiraethShadows.Instance.EndOwn();') > w.indexOf('finally'), 'put back after the picture, whatever happens');
  const sh = src('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethShadows.cs');
  assert.match(sh, /if \(OwnCam && i > 0\) live = false;/, 'only the fine map read for him');
  assert.match(sh, /if \(cam == OwnCam \|\| !UseRendererLists/, 'own preview never gets world renderer-list casters');
  assert.match(sh, /public void EndOwn\(\)[\s\S]*?fine\.fresh = false;/, 'the world redraws the overwritten map after preview');
  const prep = sh.slice(sh.indexOf('public List<Plan> PrepareOwn()'), sh.indexOf('public void EndOwn()'));
  assert.match(prep, /foreach \(var r in Own\)/, 'his renderers alone');
  assert.doesNotMatch(prep, /detail\.|movers|flora\.Add/, 'nothing of the world');
  assert.match(src('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs'), /var plans = own \? HiraethShadows\.Instance\.PrepareOwn\(\) : HiraethShadows\.Instance\.Prepare\(/);
});
