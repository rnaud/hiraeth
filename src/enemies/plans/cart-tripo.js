import * as THREE from 'three';
import { PLANS } from '../../motion-kit/plans.js';
import { SecondOrder } from '../../motion-kit/spring.js';
import { materials, add, pivot, finish, plate, shellPlate, plateMat, shade, eyeColor, ease, lerp, V } from './kit.js';
import { gazePart } from '../gaze.js';
import { RigidSkin, kitLegs, rolesOf, skinColours, raw } from './tripo-rigid.js';

// The crucible walker (issue #800, family D: the cart's approved redesign, references/enemy-redesign-2026-10-30/keep-cart/
// 13ed7341-…-3.png, "a four-legged crucible alternative to the welding cart"): Tripo task 9d5f38fe-… from that image (the
// untouched export in keep-cart/tripo/), made into the game's asset by the trial's prepare.mjs
// (references/enemy-redesign-2026-10-30/trials/cart-tripo/: 2 m to the rim, 12,000 triangles cut into parts by geometry, the reference's flat colours
// sampled into the vertex colours, the weights blended across the knees, ankles and hips; public/enemies/cart/, loaded by
// src/enemies/foe-assets.js). The archetype keeps its id, def, attacks and windows (src/enemies/archetypes.js `cart`);
// today's tracked welding cart (plans/tracked.js legacyCartModel) stands in where the mesh is not loaded, and can come
// back as a foe of its own.
//
// A machine's rig (the wood cutter's route, plans/tripo-rigid.js): the pot, its brew, its eye unit and each leg's thigh,
// shin and foot rigid, blended across the cuts; the legs the motion kit's (the crucible plan: a trot on diagonal pairs,
// its feet planted), their bones in each leg's bend plane. Its look at you (#508, the author's rule): the eye unit is cut
// out of the pot's side and turns about the pot's own axis, so it slides round the pot (a surface of revolution: no gap)
// to look at you; its lens is its own part (the eye's colour tells its state).
//
// Its attacks read from the body (nothing on the ground):
//   pour   it sits on its hind legs and tips its rim toward you, the spout glowing, the brew rising to the lip; then a
//          stream of burning slag that stays a while (foes.js leaveSlag)
//   ram    it backs up squatting, its feet scrabbling and spitting gravel; then charges in a line (a wall stalls it)
//   trail  it drips slag behind it as it goes (def.trail)
// A plain shot cools its brew to a grey crust (cuts double); a bomb on its legs jams them (it can't turn: sparks off the
// knees). Its armour (#722, #754): two riveted plates strapped round the pot's flanks; knocked off, the bare pot shows.
// Each world's skin recolours the same roles and wears its dress: the Hangar's two welding-torch arms, the Buried
// Machine's iron hoops, the Moon Foundry's ember-bright brew, the Overnight Train's luggage strapped on.

/** The crucible walker's asset parts (its triangles grouped in this order: landmarks.parts) and bones (the same order). */
export const CART_PARTS = ['hull', 'brew', 'head', ...[0, 1, 2, 3].flatMap((k) => [`thigh${k}`, `shin${k}`, `foot${k}`])];
/** The reference's flat colours (keep-cart/13ed7341-…-3.png, sampled): the home skin's (the Sealed Hangar's). */
export const CART_HOME = { body: '#98a88b', band: '#40573c', dark: '#1d241b', brew: '#d09770', vent: '#121612', brass: '#a8854e' };
const BI = Object.fromEntries(CART_PARTS.map((p, i) => [p, i]));
const _v = new THREE.Vector3();

/** A part of the asset alone (its triangles, non-indexed), in its colours: the brew, drawn by its own material. */
function partGeometry(src, name) {
  const geo = src.geometry, [first, count] = src.rig.parts[name], I = geo.index.array, out = new THREE.BufferGeometry();
  for (const [k, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const A = geo.attributes[k], arr = new Float32Array(count * 3 * size);
    for (let t = 0; t < count * 3; t++) for (let c = 0; c < size; c++) arr[t * size + c] = A.getComponent(I[first * 3 + t], c);
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/** The crucible walker's body (the model contract of plans/index.js), from its loaded source (src/enemies/foe-assets.js). */
export function tripoCartModel(skin, src) {
  const L = src.rig, home = skin.id === 'garage', props = new Set(skin.props), PL = PLANS.crucible;
  const P = { ...skin.palette, ...(home ? { body: CART_HOME.body, pot: CART_HOME.body, brew: CART_HOME.brew, dark: CART_HOME.dark, band: CART_HOME.band, eye: '#1f271e' } : {}) };
  const M = materials('cart', skin);
  const g = new THREE.Group(); g.name = `${skin.name} · crucible walker (Tripo)`;
  const body = pivot(g, 0, 0, 0, 'body');
  // (the pot turns about its middle, PIVOT m up: a blow's tip, a pour's tilt; its parts hang in the frame under it)
  const PIVOT = 1.1, hullTurn = pivot(body, 0, PIVOT, 0, 'pot'), hull = pivot(hullTurn, 0, -PIVOT, 0, 'pot frame');
  // ---------------------------------------------------------------- the bones: the pot's, the brew's, the eye unit's, the legs'
  const BREW_Y = L.pot.rim - 0.3, brewB = pivot(hull, 0, BREW_Y, 0, 'brew');
  const headPivot = pivot(hull, 0, L.head.centre[1], 0, 'eye unit'), headB = pivot(headPivot, 0, -L.head.centre[1], 0, 'eye unit part');
  const K = kitLegs({ plan: PL, g, body, hipParent: hull, legs: L.legs });
  const bones = [hull, brewB, headB, ...K.bones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  // ---------------------------------------------------------------- the skin's colours over the asset's roles
  const want = home ? null : { body: P.pot ?? P.body, band: P.brass ?? P.dark, dark: P.dark, brew: P.brew, black: shade(P.dark, 0.6) };
  const colour = want ? skinColours(src, rolesOf(src), want) : null;
  const S = new RigidSkin(src, colour, (part) => part !== 'brew');
  const sw = (key) => L.swatches[key] ?? L.swatches.body;
  // (the pot's patch behind the eye unit: its own surface, 1.5 mm inside (deeper, the ink drew the hole's rim as a slot), so the unit slides round it over no hole)
  const profile = L.pot.profile.map(([y, r]) => [r, y]).filter(([, y]) => y > L.head.lo - 0.05 && y < L.head.hi + 0.05);
  g.updateMatrixWorld(true);
  S.own(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r - 0.0015, y)), 32, -0.7, 1.4), hull, BI.hull, raw(want?.body ?? CART_HOME.body), sw('body'));
  // (a dark ball inside each knee and ankle: as a joint bends, it fills what opens)
  for (const [name, c] of Object.entries(L.cuts)) { const k = +name.slice(-1), part = name.startsWith('knee') ? `thigh${k}` : `shin${k}`; S.own(new THREE.SphereGeometry(c.inner * 0.85, 10, 7).translate(...c.at), g, BI[part], raw(want?.band ?? CART_HOME.band), sw('band')); }
  // the dress built in the body's mesh: the Buried Machine's iron hoops round the pot; the Hangar's torch arms (their own bones)
  const extra = [];
  if (props.has('bucket')) for (const y of [1.05, 1.72]) {
    const r = L.pot.profile.reduce((best, [py, pr]) => (Math.abs(py - y) < Math.abs(best[0] - y) ? [py, pr] : best), [0, 1])[1];
    S.own(new THREE.TorusGeometry(r + 0.02, 0.035, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0), hull, BI.hull, raw(P.brass), sw('brass'));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; S.own(new THREE.SphereGeometry(0.03, 5, 4).translate(Math.sin(a) * (r + 0.05), y, Math.cos(a) * (r + 0.05)), hull, BI.hull, raw(P.dark), sw('dark')); }
  }
  const torches = [];
  if (props.has('torches')) {
    for (const s of [-1, 1]) {
      const r = 1.03, sh = pivot(hull, s * r, 1.55, -0.15, 'torch arm'), el = pivot(sh, 0, 0.5, 0, 'torch elbow');
      sh.rotation.set(-0.4, 0, -s * 0.5); el.rotation.x = 1.0;
      g.updateMatrixWorld(true);
      const bs = bones.length; bones.push(sh, el);
      S.own(new THREE.SphereGeometry(0.1, 10, 8), sh, bs, raw(P.brass), sw('brass'));
      S.own(new THREE.CylinderGeometry(0.045, 0.05, 0.5, 8).translate(0, 0.25, 0), sh, bs, raw(P.brass), sw('brass'));
      S.own(new THREE.SphereGeometry(0.07, 8, 6), el, bs + 1, raw(P.dark), sw('dark'));
      S.own(new THREE.CylinderGeometry(0.04, 0.045, 0.42, 8).translate(0, 0.21, 0), el, bs + 1, raw(P.dark), sw('dark'));
      S.own(new THREE.CylinderGeometry(0.06, 0.04, 0.14, 8).translate(0, 0.48, 0), el, bs + 1, raw(P.dark), sw('dark'));
      torches.push({ sh, el, s });
    }
    const flameM = M.own('flame', P.flame ?? '#ffd27a', { glow: 1 });
    for (const t of torches) t.fl = add(t.el, new THREE.ConeGeometry(0.05, 0.2, 8), flameM, 0, 0.64, 0);
  }
  if (props.has('trolley')) {
    // the luggage strapped round its back: two cases on the pot's rear, a strap over each
    for (const [x, y, w, h] of [[-0.35, 1.25, 0.62, 0.42], [0.38, 1.36, 0.5, 0.34]]) {
      const z = -Math.sqrt(Math.max(0, 1.04 ** 2 - x * x)) - 0.12;
      S.own(new THREE.BoxGeometry(w, h, 0.3).rotateY(Math.atan2(-x, -z)).translate(x, y, z), hull, BI.hull, raw(P.canvas), sw('body'));
      S.own(new THREE.BoxGeometry(0.06, h + 0.04, 0.33).rotateY(Math.atan2(-x, -z)).translate(x, y, z), hull, BI.hull, raw(P.brass), sw('brass'));
    }
  }
  // ---------------------------------------------------------------- the mesh (one draw), the brew, the eye's lens, the spout
  const bodyM = M.mat('crucible', '#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const sm = S.make(bodyM, bones, 'tripo skin'); g.add(sm);
  const brewM = M.own('brew', P.brew, { glow: props.has('ember') ? 0.55 : 0.25 }), brew = add(brewB, partGeometry(src, 'brew'), brewM, 0, -BREW_Y, 0); brew.name = 'brew';
  const E = L.eye, eyeM = M.own('eye', P.eye ?? '#f8f4ff', { glow: 0.5 });
  const lens = add(headB, new THREE.SphereGeometry(E.r * 0.95, 16, 10).scale(1, 1, 0.4), eyeM, E.at[0], E.at[1], E.at[2] - 0.035); lens.name = 'eye';
  const lipY = L.pot.rim - 0.04, lipR = L.pot.rimR;
  const lip = pivot(hull, 0, lipY, lipR, 'lip');
  const lipM = M.own('lip', P.lip ?? '#ff9a3e', { glow: 0.45 });
  add(lip, new THREE.CylinderGeometry(0.2, 0.15, 0.24, 12, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2 - 0.3).translate(0, 0, 0.08), lipM);
  const streamM = M.own('stream', P.slag ?? '#ff8a2e', { glow: 0.95 });
  const stream = add(lip, new THREE.CylinderGeometry(0.08, 0.2, 1, 8).translate(0, -0.5, 0), streamM, 0, 0, 0.2); stream.visible = false;
  // its armour (#722): two riveted plates strapped round the pot's flanks, its darker shade; knocked off, the bare pot shows
  const plateM = plateMat(M, P.plate ?? shade(P.pot ?? P.body, 0.72));
  const flank = L.pot.profile.map(([y, r]) => [r, y]).filter(([, y]) => y > 0.82 && y < 1.32);
  const plates = [-1, 1].map((s) => plate(hull, shellPlate(flank, s * Math.PI / 2 - 0.5, 1.0, { out: 0.01, thick: 0.05, segs: 10 }), plateM, 0, 0, 0, `flank plate ${s > 0 ? 'left' : 'right'}`));
  // its look: the eye unit round the pot's axis toward you (it turns; its lens is on it)
  const gaze = [gazePart(g, headPivot, { mode: 'turn', yaw: 1.2, up: 0.06, down: 0.06 })];
  finish(g);
  g.updateMatrixWorld(true);
  S.bind();
  const parts = [hullTurn, headPivot, ...K.bones.flatMap((b) => [b.thigh, b.shin, b.foot])];
  const tip = new SecondOrder(2.2, 0.6, 0), slosh = new SecondOrder(3, 0.3, 0);
  let phase = Math.random() * 6, crusted = 0, prevPitch = 0;
  return {
    group: g, gaze, body: hullTurn, rig: K.rig, parts, eyeMat: eyeM, base: P.eye, size: skin.scale, skin: skin.id, tones: [P.pot ?? P.body, P.brass, P.brew],
    plates, weak: { obj: lens, r: 0.3, name: 'its eye' }, body3d: 'tripo', cartJoints: { legs: K.legs, legBones: K.bones, head: headPivot, lip },
    tell: (id) => (id === 'ram' ? headPivot : lip),
    anim(f, c) {
      if (f.dying) S.letGo();
      const id = f.atk?.id, dt = Math.max(c.dt, 1e-4), wind = f.state === 'wind', strike = f.state === 'strike';
      const o = K.rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: (at, len) => { c.touch(at, len); c.thump?.(at, 0.2); }, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0 });
      // the pour: the whole pot on its legs tips its rim at you (the plan's pose), its brew sloshing up to the lip; calm, it
      // now and then tips into moulds that are no longer there
      const pour = id === 'pour' ? (wind ? c.wind : strike ? 1 : 0) : 0;
      phase += dt * 0.4;
      const calmTip = f.state === 'idle' ? Math.max(0, Math.sin(phase * 0.7) - 0.85) * 3 : 0;
      const extraTip = tip.update(dt, calmTip * 0.25);
      hullTurn.position.set(o.x, o.y + PIVOT, o.z);
      hullTurn.rotation.set(o.pitch + extraTip, o.yaw, o.roll);
      // (the brew: level-ish as the pot tips, lagging; it rises to the lip for the pour)
      const sl = slosh.update(dt, -(hullTurn.rotation.x - prevPitch) / dt * 0.05); prevPitch = hullTurn.rotation.x;
      brewB.rotation.x = -hullTurn.rotation.x * 0.6 + sl;
      brewB.position.y = BREW_Y + pour * 0.12;
      lipM.uniforms.uGlow.value = 0.45 + pour * 0.55; lipM.uniforms.uColor.value.set(pour > 0.2 ? P.slag : P.lip ?? '#ff9a3e');
      stream.visible = id === 'pour' && strike;
      if (stream.visible) { stream.rotation.x = -hullTurn.rotation.x; stream.scale.set(1, 1.5 + Math.sin(c.now / 50) * 0.1, 1); if (Math.random() < 0.6) c.spray(V(f.pos.x + Math.sin(f.heading) * 2.2, f.pos.y + 0.2, f.pos.z + Math.cos(f.heading) * 2.2), [P.slag, P.slag2 ?? '#ffd36a'], 2, 3); }
      // the ram's wind-up: backing up, its feet scrabbling, gravel off its heels
      if (id === 'ram' && wind && c.wind > 0.3 && Math.random() < 0.5) c.spray(V(f.pos.x - Math.sin(f.heading) * 1.1, f.pos.y + 0.15, f.pos.z - Math.cos(f.heading) * 1.1), [P.dust ?? '#9a8a72', '#5a5048'], 2, 3, 9);
      // smoke off the brew now and then; the torches lit, swaying, raised as it pours
      if (Math.random() < 0.06) c.spray(brew.getWorldPosition(_v).setY(f.pos.y + L.pot.rim + 0.2), [P.smoke ?? '#2a2228', P.smoke2 ?? '#5a4a4a'], 1, 0.4, -1.4);
      torches.forEach((t, i) => { t.sh.rotation.x = -0.4 - pour * 0.5 + Math.sin(c.now / 700 + i) * 0.08; t.el.rotation.x = 1.0 - pour * 0.4; t.fl.scale.setScalar(0.85 + Math.random() * 0.3); });
      // doused by a shot, its brew goes grey and cold; jammed by a bomb, its legs can't turn it (sparks off the knees)
      crusted = ease(crusted, f.crust > 0 ? 1 : 0, 6, dt);
      brewM.uniforms.uColor.value.set(crusted > 0.5 ? P.crust : P.brew); brewM.uniforms.uGlow.value = lerp(props.has('ember') ? 0.55 : 0.25, 0, crusted);
      if (f.jammed > 0 && Math.random() < 0.2) c.spray(K.legs[Math.floor(Math.random() * 4)].shin.getWorldPosition(_v), ['#ffe7a0', '#ff9a3e'], 2, 2.5);
      eyeM.uniforms.uColor.value.set(eyeColor(f, P.eye ?? '#f8f4ff', '#ffb36a'));
      g.position.y += f.alt;   // (lifted by the magnet glove)
      K.rig.write(); K.skinLegs.write(f.heading, { air: f.alt > 0.05 ? 1 : 0 });
    },
    // (its geometries are its kind's, shared: src/foes.js lets its own go, disposeOwnShapes)
    dispose() { M.dispose(); K.hide.dispose(); },
  };
}
