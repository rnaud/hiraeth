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
//   Wardrobe swaps it live), the blade's colour on a sword of its own standing beside him (the one he carries is
//   sheathed: only its hilt shows), so the real one changes only when the colour is chosen.
//
//   const w = wireWardrobe({ game, kit, tool, player, dress: () => travellerV2.dress })
//   w.data()                 the page's lists (game-menu.js wardrobePanel)
//   w.preview(cell)          the highlighted cell (or null): him and the sword in it
//   w.wear(kind, id)         A / × on a cell: saved and worn in the world
//   w.leave()                the page left (another panel, the menu closed): him as he was, the sword put away
//   w.place(shot) · w.tick(dt) · w.keep()   each drawn frame: the sword beside him for the shot, its breath and his
//                            (PageIdle: the world is still under the menu, he is not), what the preview draws (him, the sword)
//   wardrobeShot(player, yaw) → { eye, look, fov }: the camera on him, `yaw` round him from his front

import * as THREE from 'three';
import { KIT_COLOURS, wonColours, chosenColour, chooseColour, colourById, paintWater } from './kit-colours.js';
import { buildSword } from './fluid-sword.js';
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
export const SHOT = { fov: 28, dist: 4.4, eye: 1.05, look: 0.9, room: 1.08 };
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3();
/**
 * The camera on the traveller for the preview: `yaw` rad round him from his front, about his up (player: { pos, heading,
 * frame: { up, dir(heading, out) } }), for a picture `aspect` wide over high. → { eye, look, fov, dist } (new vectors).
 */
export function wardrobeShot(player, yaw = TURN.start, aspect = 1, S = SHOT) {
  const dist = Math.max(S.dist, S.room / (Math.tan((S.fov * Math.PI) / 360) * Math.max(0.3, aspect)) + PLANTED.front);
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

// ------------------------------------------------------------------ the sword beside him

/**
 * The sword stood beside him on the stage, point down, its broad face to the camera: `side` m to the picture's right of
 * his feet and `front` m toward the camera, its grip `grip` m up, leaning `lean` rad, its face turned `turn` rad off the
 * camera. It stays where the camera sees it as he turns (placed for each frame's shot: placeSword).
 */
export const PLANTED = { side: 0.78, front: 0.3, grip: 0.92, lean: 0.1, turn: 0.35 };
/** A sword of its own for the preview (src/fluid-sword.js buildSword in a material of its own). */
export function plantedSword() {
  const s = buildSword({ key: 'wardrobe.sword' });
  const g = new THREE.Group();
  g.name = 'wardrobe sword';
  g.add(s.group);
  g.traverse((o) => { o.userData.noCollide = true; o.userData.noSplat = true; });
  g.userData.material = s.material;
  return g;
}
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
/** The sword placed for a shot (wardrobeShot's eye and look; `feet` and `up` his): beside him on the picture's right. */
export function placeSword(g, { eye, look }, feet, up, P = PLANTED) {
  const toward = _z.subVectors(eye, look);
  toward.addScaledVector(up, -toward.dot(up)).normalize();
  const right = _x.crossVectors(up, toward).normalize();   // (the picture's right, seen from the eye)
  g.position.copy(feet).addScaledVector(right, P.side).addScaledVector(toward, P.front).addScaledVector(up, P.grip);
  // the hilt's frame (+y up the blade, z its flat) turned over: the blade down, its flat to the camera, then leant and turned
  _y.copy(up).negate();
  _x.crossVectors(_y, toward).normalize();
  g.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, toward));
  g.quaternion.multiply(_q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, P.turn)).multiply(_q.setFromAxisAngle(_z.set(0, 0, 1), -P.lean));
  g.updateMatrixWorld(true);
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

// ------------------------------------------------------------------ the page's host

/**
 * The Wardrobe on the running game (main.js, engine/game.js): `game` the save's state (flag, set), `kit` wireKit's (its
 * paint: the kit's colours put on him), `tool` the fluid tool (swordOn: he has the sword), `player`, `dress()` the v2
 * traveller's dressing (characters/traveller-v2.js wearTravellerV2: { wardrobe, wear(id) }) or null while B3 is drawn.
 */
export function wireWardrobe({ game, kit = null, tool = null, player = null, dress = () => null }) {
  let sword = null, shown = null, time = 0;
  const idle = new PageIdle();
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
    /** The sword beside him (null until the page shows, or without the sword). */
    get sword() { return sword; },
    preview(cell) {
      const d = data(), sel = previewOf(d, cell);
      if (d.sword && player?.object && !sword) { sword = plantedSword(); shown = null; }
      // (in the world beside him, while the page shows: placed for each frame's shot, place)
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
      idle.put();
      if (sword?.parent) sword.parent.remove(sword);
      if (dressed()) wearOutfit(chosenOutfit(game));
    },
    /** The sword placed for this frame's shot (wardrobeShot), before it is drawn. */
    place(shot) {
      if (sword?.parent && player) placeSword(sword, shot, player.pos, player.frame?.up ?? THREE.Object3D.DEFAULT_UP);
    },
    tick(dt) {
      time += dt;
      idle.pose(player?.humanoid?.b, player?.object, time);   // (him breathing, looking about: PageIdle)
      const U = sword?.userData.material?.uniforms;
      if (!U?.uBlade) return;
      U.uBlade.value.set(0, 1, time * BLADE_LOOK.breathRate, BLADE_QUALITY.lite ? 1 : 0);   // (its breath, as the box's sword)
      // (and its currents flowing up it, as the one in his hand: fluid-blade.js; an engine is sent the fluid as it moves)
      if (U.uFluidA) U.uFluidA.value.z = time;
    },
    /** What the preview draws: him, and the sword beside him. */
    keep: () => [player?.object, sword?.parent ? sword : null].filter(Boolean),
  };
  return host;
}
