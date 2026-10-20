// The Wardrobe (issue #571): the game menu's page where the traveller is dressed. On the left two lists, his outfits
// and his blade's colours; on the right the traveller himself, drawn live by the game's own renderer (lit as in the
// world, alone against the paper), turning slowly, turned by the right stick or a drag, in what the cursor is on.
// A / × wears it (saved, worn in the world at once); B / ○ leaves him as he was.
//
// - The outfits are the v2 traveller's (src/characters/outfits.js, data/characters/traveller-v2/outfits.json): his
//   own clothes and five others. Each has an `unlock`: null is his from the start (all of them, for now); a flag of the
//   save later (`{ flag }`), so they can be won by progress. B3 (the game's traveller until v2 is the default) has
//   none: the list says the outfits need the new traveller.
// - The blade's colours are the kit's (src/kit-colours.js): the makers' jade always, and one more for each fight temple
//   cleared (its reward, worn on the backpack, the sword and the shield); the Wardrobe chooses the sword's, the Items
//   panel's Colours strip still goes round all three pieces.
// - The preview is the choice saved with the highlighted one in its place (previewOf): the outfit worn on him (v2's
//   Wardrobe swaps it live), the blade's colour on a sword of its own held in his right fist (the gameplay sword is hidden
//   for the preview), so the real one changes only when the colour is chosen.
//
//   const w = wireWardrobe({ game, kit, tool, player, dress: () => travellerV2.dress })
//   w.data()                 the page's lists (game-menu.js wardrobePanel)
//   w.preview(cell)          the highlighted cell (or null): him and the sword in it
//   w.wear(kind, id)         A / × on a cell: saved and worn in the world
//   w.leave()                the page left (another panel, the menu closed): him as he was, the sword put away
//   w.place(shot) · w.tick(dt) · w.keep()   each drawn frame: the sword held in his fist, its breath and his
//                            (PageIdle: the world is still under the menu, he is not), what the preview draws (him, the sword)
//   wardrobeShot(player, yaw) → { eye, look, fov }: the camera on him, `yaw` round him from his front

import * as THREE from 'three';
import { KIT_COLOURS, wonColours, chosenColour, chooseColour, colourById, paintWater } from './kit-colours.js';
import { buildSword } from './fluid-sword.js';
import { fistGrip } from './blade-grip.js';
import { HAND_POSES } from './hands.js';
import { BLADE_LOOK, BLADE_QUALITY } from './blade-shader.js';

/**
 * The outfits, in the list's order (their ids are outfits.json's). `unlock`: null, his from the start; `{ flag }` once the
 * save has that flag (none yet: the author's "all available from day one today; in the future we will make them unlockable").
 */
export const OUTFITS = [
  { id: 'default', name: 'His own clothes', unlock: null },
  { id: 'glider-pilot', name: 'Glider pilot', unlock: null },
  { id: 'lamplighter', name: 'Lamplighter', unlock: null },
  { id: 'pearl-diver', name: 'Pearl diver', unlock: null },
  { id: 'moss-gardener', name: 'Moss gardener', unlock: null },
  { id: 'salt-pilgrim', name: 'Salt pilgrim', unlock: null },
];
/** The save's flag that keeps the outfit chosen. */
export const OUTFIT_KEY = 'wardrobe.outfit';
export const outfitUnlocked = (o, state) => !!o && (!o.unlock || !!state?.flag?.(o.unlock.flag));
/** The outfit he wears: the one chosen, if it is his; else his own clothes. */
export function chosenOutfit(state) {
  const id = state?.flag?.(OUTFIT_KEY), o = OUTFITS.find((x) => x.id === id);
  return outfitUnlocked(o, state) ? id : 'default';
}
/** Choose an outfit (false: no such outfit, or not his yet). */
export function chooseOutfit(state, id) {
  if (!outfitUnlocked(OUTFITS.find((x) => x.id === id), state)) return false;
  state.set(OUTFIT_KEY, id);
  return true;
}

/** The blade's colours he has won (the makers' first), each { id, name, house, swatch (its water) }. */
export function bladeColours(state) {
  return wonColours(state).map((id) => { const c = colourById(id); return { id, name: c.name, house: c.house ?? '', swatch: c.water.base }; });
}

/**
 * The page's lists: { v2 (his outfits can be worn: the v2 traveller is drawn), sword (he has it), outfits: [{ id, name,
 * unlocked, worn }], blades: [{ id, name, house, swatch, worn }] } (no blades without the sword).
 */
export function wardrobeData({ state, v2 = false, sword = true } = {}) {
  const outfit = chosenOutfit(state), blade = chosenColour(state, 'sword');
  return {
    v2: !!v2, sword: !!sword,
    outfits: OUTFITS.map((o) => ({ id: o.id, name: o.name, unlocked: outfitUnlocked(o, state), worn: o.id === outfit })),
    blades: sword ? bladeColours(state).map((b) => ({ ...b, worn: b.id === blade })) : [],
  };
}

/** What the preview shows with the cursor on `cell` ({ kind: 'outfit' | 'blade', id } or null): the choice saved, the
 * highlighted one in its place (an outfit not his yet is not tried on). */
export function previewOf(data, cell) {
  const sel = { outfit: data?.outfits?.find((o) => o.worn)?.id ?? 'default', blade: data?.blades?.find((b) => b.worn)?.id ?? 'makers' };
  if (cell?.kind === 'outfit' && data?.outfits?.find((o) => o.id === cell.id)?.unlocked) sel.outfit = cell.id;
  if (cell?.kind === 'blade' && data?.blades?.some((b) => b.id === cell.id)) sel.blade = cell.id;
  return sel;
}

// ------------------------------------------------------------------ the turning

/**
 * How he turns on the page: `start` rad round from his front (a three-quarter view), `rate` rad/s on his own, `hold` s
 * after a hand turned him before he goes on by himself; the right stick `stick` rad/s at full tilt, a drag `drag` rad a
 * CSS px.
 */
export const TURN = { start: 0.55, rate: 0.32, hold: 2, stick: 2.4, drag: 0.012, dead: 0.15 };
export class Turntable {
  constructor(T = TURN) { this.T = T; this.reset(); }
  reset() { this.yaw = this.T.start; this.idle = Infinity; }
  /** A hand turned him by `d` rad (the stick, a drag): he waits `hold` s before turning by himself again. */
  turn(d) { if (d) { this.yaw += d; this.idle = 0; } }
  /** The right stick's x this frame. */
  stick(x, dt) { if (Math.abs(x) > this.T.dead) this.turn(x * this.T.stick * dt); }
  /** A drag `px` CSS px across. */
  drag(px) { this.turn(px * this.T.drag); }
  tick(dt) {
    this.idle += dt;
    if (this.idle >= this.T.hold) this.yaw += this.T.rate * dt;
    this.yaw = ((this.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }
}

// ------------------------------------------------------------------ the camera on him

/**
 * The preview's framing: his whole height, `fov` degrees, the eye `dist` m off (further on a narrow picture, so the sword
 * beside him stays in it: `room` m either side of him), `eye` m over his feet, looking at `look`.
 */
export const SHOT = { fov: 28, dist: 4.4, eye: 1.05, look: 0.9, room: 1.08, depth: 0.3 };
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
/**
 * The camera on the traveller for the preview: `yaw` rad round him from his front, about his up (player: { pos, heading,
 * frame: { up, dir(heading, out) } }), for a picture `aspect` wide over high. → { eye, look, fov, dist } (new vectors).
 */
export function wardrobeShot(player, yaw = TURN.start, aspect = 1, S = SHOT) {
  const dist = Math.max(S.dist, S.room / (Math.tan((S.fov * Math.PI) / 360) * Math.max(0.3, aspect)) + S.depth);
  const up = _u.copy(player.frame?.up ?? THREE.Object3D.DEFAULT_UP).normalize();
  const fwd = player.frame?.dir ? player.frame.dir(player.heading ?? 0, _f) : _f.set(Math.sin(player.heading ?? 0), 0, Math.cos(player.heading ?? 0));
  const side = _r.crossVectors(up, fwd).normalize();
  const dir = fwd.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(side, Math.sin(yaw));
  const feet = player.pos;
  return {
    eye: feet.clone().addScaledVector(up, S.eye).addScaledVector(dir, dist),
    look: feet.clone().addScaledVector(up, S.look),
    fov: S.fov, dist,
  };
}
/** The paper behind him (the menu's sheet, a shade darker so his light parts stand off it). */
export const BACKDROP = '#ece0c2';

// ------------------------------------------------------------------ the preview sword

/** A sword of its own for the preview (src/fluid-sword.js buildSword in a material of its own). */
export function previewSword() {
  const s = buildSword({ key: 'wardrobe.sword' });
  const g = new THREE.Group();
  g.name = 'wardrobe sword';
  g.add(s.group);
  g.traverse((o) => { o.userData.noCollide = true; o.userData.noSplat = true; });
  g.userData.material = s.material;
  return g;
}
// ------------------------------------------------------------------ him at rest on the page

/**
 * The world stands still under the menu, so he would too, frozen in the frame the menu opened on: on the page he breathes
 * and looks about a little instead, over that pose, his upper body only (his feet stay planted). The chest `breath` rad at
 * `breathRate` rad/s and `sway` rad side to side at `swayRate`; the head `look` rad round at `lookRate`, `nod` rad down
 * and up; the shoulders `arms` rad in and out with the breath.
 */
export const PAGE_IDLE = { breath: 0.022, breathRate: 1.7, sway: 0.03, swayRate: 0.41, look: 0.13, lookRate: 0.27, nod: 0.03, arms: 0.03 };
// (his skeleton's bones it moves: humanoid.js's names; each turned about an axis of his own frame, x across, y up, z ahead)
const IDLE_BONES = ['spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'upperarm_r'];
const _ax = new THREE.Vector3(), _iq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _bq = new THREE.Quaternion();
/**
 * The page's idle (wireWardrobe's): `pose(bones, root, t)` each frame the page draws him (`bones` humanoid.b, by name;
 * `root` his object), `put()` him as he was when the page is left. The pose under it is taken again whenever something
 * else moved him since (the game ran between two visits to the page).
 */
export class PageIdle {
  constructor(P = PAGE_IDLE) { this.P = P; this.held = null; this.wrote = null; }
  /** The bones' turns at time t (s), by name: [axis (his frame), rad]s. */
  turns(t) {
    const P = this.P, breath = Math.sin(t * P.breathRate), sway = Math.sin(t * P.swayRate + 0.6);
    const look = Math.sin(t * P.lookRate) * Math.min(1, Math.abs(Math.sin(t * P.lookRate * 0.5 + 1)) * 1.6);   // (dwells, then glances)
    return {
      spine_02: [[1, 0, 0, -0.5 * P.breath * breath], [0, 0, 1, 0.5 * P.sway * sway]],
      spine_03: [[1, 0, 0, -0.5 * P.breath * breath], [0, 0, 1, 0.5 * P.sway * sway]],
      neck_01: [[0, 1, 0, 0.4 * P.look * look]],
      Head: [[0, 1, 0, 0.6 * P.look * look], [1, 0, 0, P.nod * Math.sin(t * P.lookRate * 1.7 + 2)]],
      upperarm_l: [[0, 0, 1, P.arms * (0.5 + 0.5 * breath)]],
      upperarm_r: [[0, 0, 1, -P.arms * (0.5 + 0.5 * breath)]],
    };
  }
  pose(bones, root, t) {
    if (!bones || !root) return;
    const list = IDLE_BONES.map((n) => [n, bones[n]]).filter(([, b]) => b?.quaternion);
    if (!list.length) return;
    // (the pose under it: taken when the page first draws him, and again if anything else posed him since)
    const moved = !this.held || this.held.bones !== bones || list.some(([n, b]) => !this.wrote?.[n]?.equals(b.quaternion));
    if (moved) this.held = { bones, q: Object.fromEntries(list.map(([n, b]) => [n, b.quaternion.clone()])) };
    for (const [n, b] of list) b.quaternion.copy(this.held.q[n]);
    root.updateMatrixWorld(true);
    const T = this.turns(t), rootQ = root.getWorldQuaternion(_rq);
    for (const [n, b] of list) {
      // (about his frame's axis, through the bone's own turn in the world: the same on any rig's bone axes)
      const inv = b.parent ? b.parent.getWorldQuaternion(_bq).multiply(b.quaternion).invert() : _bq.copy(b.quaternion).invert();
      for (const [x, y, z, a] of T[n] ?? []) b.quaternion.multiply(_iq.setFromAxisAngle(_ax.set(x, y, z).applyQuaternion(rootQ).applyQuaternion(inv).normalize(), a));
    }
    root.updateMatrixWorld(true);
    this.wrote = Object.fromEntries(list.map(([n, b]) => [n, b.quaternion.clone()]));
  }
  /** Him as he was under it (the page left). */
  put() {
    const H = this.held;
    if (H) for (const [n, q] of Object.entries(H.q)) H.bones[n]?.quaternion.copy(q);
    this.held = null; this.wrote = null;
  }
}

/** A preview-only right arm and fist. Restore before PageIdle runs again, and before leaving the page. */
export class PageGrip {
  constructor() { this.saved = null; this.mount = null; this.body = null; }
  put() {
    if (!this.saved) return;
    for (const [bone, q] of this.saved.bones) bone.quaternion.copy(q);
    for (const [side, cur, goal, lag, lagV, tight] of this.saved.hands) {
      side.cur.set(cur); side.goal.set(goal); side.lag = lag; side.lagV = lagV; side.tight = tight;
    }
    this.saved = null;
  }
  pose(H, root, sword) {
    const B = H?.b;
    if (!B?.hand_r || !H.solveTwoBone || !root || !sword) return false;
    // Include the fingers: the hand driver poses both hands when applying a right-hand change.
    this.saved = {
      bones: Object.entries(B).filter(([n]) => /^(upperarm_r|lowerarm_r|hand_r|(?:thumb|index|middle|ring|pinky)_)/.test(n))
        .map(([, b]) => [b, b.quaternion.clone()]),
      hands: (H.hands?.sides ?? []).map((s) => [s, s.cur.slice(), s.goal.slice(), s.lag, s.lagV, s.tight]),
    };
    if (this.body !== H) { this.mount = fistGrip(H); this.body = H; }
    const g = this.mount;
    if (!g) return false;
    const right = H.hands?.sides.find((s) => s.s === 'r');
    if (right) {
      right.cur.set(H.hands.poses?.fist ?? HAND_POSES.fist); right.goal.set(right.cur);
      right.lag = right.lagV = 0; right.tight = 1;
      H.hands.apply();
    }
    root.updateMatrixWorld(true);
    const rq = root.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rq);
    const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(rq);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rq);
    const target = root.getWorldPosition(new THREE.Vector3()).addScaledVector(up, 1.04)
      .addScaledVector(side, 0.42).addScaledVector(forward, 0.18);
    const y = up.clone().negate().addScaledVector(side, 0.22).normalize();
    const x = new THREE.Vector3().crossVectors(y, forward).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const swordQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const handQ = swordQ.clone().multiply(g.quaternion.clone().invert());
    const pole = B.upperarm_r.getWorldPosition(new THREE.Vector3()).addScaledVector(side, 0.45).addScaledVector(up, -0.6);
    // Orient the wrist and solve for the actual grip centre, not the wrist origin.
    for (let i = 0; i < 3; i++) {
      B.hand_r.quaternion.copy(B.hand_r.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
      root.updateMatrixWorld(true);
      const wrist = B.hand_r.getWorldPosition(new THREE.Vector3());
      const contact = g.position.clone().applyMatrix4(B.hand_r.matrixWorld);
      H.solveTwoBone(B.upperarm_r, B.lowerarm_r, B.hand_r, target.clone().add(wrist).sub(contact), pole, 1);
    }
    B.hand_r.quaternion.copy(B.hand_r.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(handQ));
    root.updateMatrixWorld(true);
    const world = new THREE.Matrix4().compose(g.position.clone().applyMatrix4(B.hand_r.matrixWorld),
      B.hand_r.getWorldQuaternion(new THREE.Quaternion()).multiply(g.quaternion), new THREE.Vector3(1, 1, 1));
    if (sword.parent) world.premultiply(sword.parent.matrixWorld.clone().invert());
    world.decompose(sword.position, sword.quaternion, sword.scale);
    sword.updateMatrixWorld(true);
    return true;
  }
}

// ------------------------------------------------------------------ the page's host

/**
 * The Wardrobe on the running game (main.js, engine/game.js): `game` the save's state (flag, set), `kit` wireKit's (its
 * paint: the kit's colours put on him), `tool` the fluid tool (swordOn: he has the sword), `player`, `dress()` the v2
 * traveller's dressing (characters/traveller-v2.js wearTravellerV2: { wardrobe, wear(id) }) or null while B3 is drawn.
 */
export function wireWardrobe({ game, kit = null, tool = null, player = null, dress = () => null }) {
  let sword = null, shown = null, time = 0;
  const idle = new PageIdle();
  const grip = new PageGrip();
  let carried = null;
  // the outfit on him: the one wanted, put on one at a time (v2's first wear of an outfit loads it)
  let want = null, on = null, busy = false;
  const dressed = () => dress?.() ?? null;
  const wornNow = () => dressed()?.wardrobe?.worn?.id ?? chosenOutfit(game);
  const putOn = async () => {
    const d = dressed();
    if (!d || busy) return;
    busy = true;
    try {
      while (want && want !== (on ?? wornNow())) {
        const id = want;
        try { await d.wear(id); on = id; } catch (e) { console.warn('wardrobe: could not wear', id, e); on = wornNow(); want = on; }
      }
    } finally { busy = false; }
  };
  const wearOutfit = (id) => { if (!dressed()) return; want = id; putOn(); };
  const blade = (id) => {
    if (!sword || shown === id) return;
    shown = id;
    paintWater(sword.userData.material, (colourById(id) ?? KIT_COLOURS[0]).water);
  };
  const data = () => wardrobeData({ state: game, v2: !!dressed(), sword: !!tool?.swordOn });
  const host = {
    data,
    /** The separate held sword (null until the page shows, or without the sword). */
    get sword() { return sword; },
    preview(cell) {
      const d = data(), sel = previewOf(d, cell);
      if (!carried && d.sword && tool?.blade?.group) {
        carried = { object: tool.blade.group, visible: tool.blade.group.visible };
        carried.object.visible = false;
      }
      if (d.sword && player?.object && !sword) { sword = previewSword(); shown = null; }
      // (a separate world root following the fitted hand, included once in both renderers)
      const world = player?.object?.parent;
      if (sword && d.sword && world && sword.parent !== world) world.add(sword);
      if (sword && !d.sword && sword.parent) sword.parent.remove(sword);
      blade(sel.blade);
      wearOutfit(sel.outfit);
      return sel;
    },
    wear(kind, id) {
      if (kind === 'outfit') { if (!chooseOutfit(game, id)) return false; wearOutfit(id); return true; }
      if (kind === 'blade') { if (!chooseColour(game, 'sword', id)) return false; kit?.paint?.(); blade(id); return true; }
      return false;
    },
    leave() {
      grip.put();
      idle.put();
      if (carried) { carried.object.visible = carried.visible; carried = null; }
      if (sword?.parent) sword.parent.remove(sword);
      if (dressed()) wearOutfit(chosenOutfit(game));
    },
    /** Attachment is updated by tick, after the preview pose. Both hosts call this camera hook. */
    place() {},
    tick(dt) {
      time += dt;
      grip.put();
      idle.pose(player?.humanoid?.b, player?.object, time);   // (him breathing, looking about: PageIdle)
      if (sword?.parent) grip.pose(player?.humanoid, player?.object, sword);
      const U = sword?.userData.material?.uniforms;
      if (!U?.uBlade) return;
      U.uBlade.value.set(0, 1, time * BLADE_LOOK.breathRate, BLADE_QUALITY.lite ? 1 : 0);   // (its breath, as the box's sword)
      // (and its currents flowing up it, as the one in his hand: fluid-blade.js; an engine is sent the fluid as it moves)
      if (U.uFluidA) U.uFluidA.value.z = time;
    },
    /** What the preview draws: him and the separate sword following his fist. */
    keep: () => [player?.object, sword?.parent ? sword : null].filter(Boolean),
  };
  return host;
}
