import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { HILT } from './fluid-sword.js';

// The fluid sword on the traveller's back (src/fluid-blade.js carries it; the author: "hide the sword at
// rest, like move it back to your back?"). Out of a fight the hilt (its blade withdrawn, as always at rest)
// sits in a leather frog behind his right shoulder, beside the flask's right upright, the pommel up over the
// shoulder and the cup down toward the shoulder blade, tilted a little out; the hands stay free. When a
// fight starts (the blade's own "drawn" moment: a swing, the guard, an evade, the lock-on, a blow taken) the
// right hand reaches back over the shoulder, takes it and brings it forward (DRAW, 0.34 s); when the fight
// is over (the same moment it used to be put away into the glove) it goes back (SHEATHE). A swing pressed
// with the sword on the back never waits: the swing starts that frame, as before, and the hilt comes to the
// hand within DRAW.quick (0.12 s), before the earliest cut opens (the riposte's wind-up, 0.12 s; a first swing's 0.22).
//
//   SHEATH               where it sits (the chest anchor's frame: y 0 at the hips, the collar at ~0.76, +z
//                        forward, the wearer's right at -x; fluid-tool.js TANK's frame)
//   sheathFrame()        { position, quaternion } of the hilt's frame on the back (src/fluid-sword.js: +y up
//                        the blade, here down toward the shoulder blade; the flat faces his back)
//   hiltPoints()         the hilt as balls along its axis (its frame): what may not touch the body or the flask
//   SheathState          back → drawing → hand → sheathing → back (and 'away': flown back with no reach, when
//                        the arms are busy): held (0 on the back .. 1 in the fist), reach (the arm to the back)
//   buildFrog()          the leather frog that holds it (the hilt's frame on the back): a strip against his
//                        back and two loops round the grip; it stays when the sword is drawn

/** Where the hilt sits on his back (chest anchor frame, m) and how it leans (rad off upright, the pommel out to his right). */
export const SHEATH = {
  at: [-0.205, 0.72, -0.215],   // the grip's middle: beside the flask's right upright, behind the shoulder blade
  tilt: 0.2,               // the pommel out over the right shoulder, the cup in toward the spine
};

/** The draw and the sheathe (s), and when in them the arm is at the back and the hilt changes hands (shares of the time). */
export const DRAW = {
  time: 0.34,               // reach back over the shoulder, take it, bring it round
  quick: 0.12,              // a swing pressed with the sword on the back: in the fist (at 0.8 of it) before any cut opens
  quickReach: 0.45,         // (and the arm only starts back toward it: the swing's own wind-up carries it)
  reach: [0, 0.38, 0.56, 1], // the arm: out to the back over [0, 0.38], held, back over [0.56, 1]
  take: [0.38, 0.56],       // the hilt from the frog to the fist (the hand there)
  quickTake: [0.1, 0.8],
};
export const SHEATHE = {
  time: 0.36,
  reach: [0, 0.42, 0.6, 1],
  give: [0.42, 0.6],        // the hilt from the fist to the frog (the hand there)
  away: 0.15,               // flown back with no reach (climbing, swimming, gliding, aiming, riding, a scene)
};

const smooth = (x, a, b) => (b <= a ? (x >= b ? 1 : 0) : THREE.MathUtils.smoothstep(x, a, b));
const reachCurve = (u, [a, b, c, d]) => smooth(u, a, b) * (1 - smooth(u, c, d));

/** The hilt's frame on the back: { position, quaternion } in the chest anchor's frame. */
export function sheathFrame(S = SHEATH) {
  // +y down the hilt toward the cup (in toward the spine as it goes down), z the flat (toward his back), x the edge (out to his right)
  const y = new THREE.Vector3(Math.sin(S.tilt), -Math.cos(S.tilt), 0);
  const z = new THREE.Vector3(0, 0, 1).applyAxisAngle(y, S.roll ?? 0);
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return { position: new THREE.Vector3(...S.at), quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
}

/**
 * The hilt as balls (the hilt's frame, src/fluid-sword.js HILT): [{ x, y, r }] every 1 cm from the pommel's end
 * to the cup's lip, each as wide as the hilt there; the oval cup (wider along the edge, x) as three across it.
 */
export function hiltPoints(step = 0.01) {
  const out = [];
  for (let y = HILT.pommel; y <= HILT.mouth + 1e-9; y += step) {
    if (y >= 0.084) { const r = 0.0276 * 0.85; for (const x of [-0.04 + r, 0, 0.04 - r]) out.push({ x, y, r }); continue; }
    out.push({ x: 0, y, r: y < -0.077 ? 0.023 : y < 0.049 ? HILT.radius + HILT.raise + 0.001 : 0.025 });
  }
  return out;
}

/**
 * Where the sword is between the frog and the fist. update(dt, want, { quick, ok }) each frame: `want` the
 * blade's drawn moment (fluid-blade.js bladeDrawn), `quick` a swing has started (draw fast), `ok` false
 * while the arms are busy (flown back to the frog at once, no reach). Returns 'draw' / 'sheathe' as one starts.
 *   state   'back' | 'drawing' | 'hand' | 'sheathing' | 'away'
 *   held    0 on the back .. 1 in the fist
 *   reach   0 .. 1, the right arm out to the back (Humanoid.reachBack)
 */
export class SheathState {
  constructor() { this.state = 'back'; this.t = 0; this.from = 0; this.held = 0; this.reach = 0; this.quick = false; this._reach = 0; }

  get inHand() { return this.held >= 1; }
  get onBack() { return this.held <= 0; }

  /** Jump straight to the fist (true) or the frog (false), as the studio and a scene's pose ask. */
  set(inHand) { this.state = inHand ? 'hand' : 'back'; this.t = 0; this.held = this.from = inHand ? 1 : 0; this.reach = this._reach = 0; this.quick = false; }

  /** Show `u` (0..1) of the draw (the studio's scrub). */
  scrub(u) { this.state = 'drawing'; this.quick = false; this.from = 0; this.t = u * DRAW.time; this.eval(); this.reach = this._reach; }

  update(dt, want, { quick = false, ok = true } = {}) {
    let said = null;
    const go = (state, q = false) => { this.state = state; this.t = 0; this.from = this.held; this.quick = q; };
    if (!ok) { if (this.held > 0 && this.state !== 'away') go('away'); else if (this.held <= 0) this.state = 'back'; }
    else if (want && (this.state === 'back' || this.state === 'away' || this.state === 'sheathing')) {
      // (taken back off the frog mid-sheathe: the hilt still in the fist, the same draw from where it is)
      if (this.state === 'sheathing' && this.held >= 1) { this.state = 'hand'; this.t = 0; }
      else { go('drawing', quick || this.state !== 'back'); said = 'draw'; }
    } else if (this.state === 'drawing' && quick && !this.quick && this.held < 1) {
      // (a swing pressed while the hand is still on its way back: no waiting for the slow draw)
      const u = this.t / DRAW.time;
      this.quick = true; this.from = this.held; this.t = 0; if (u > DRAW.take[1]) this.from = 1;
    } else if (!want && this.state === 'hand') { go('sheathing'); said = 'sheathe'; }
    this.t += dt;
    this.eval();
    // (the arm eases off a cut-short reach instead of dropping in one frame)
    const k = 1 - Math.exp(-30 * dt);
    this.reach = this._reach >= this.reach ? this._reach : this.reach + (this._reach - this.reach) * k;
    if (this.reach < 1e-3) this.reach = 0;
    return said;
  }

  /** held and the reach this state and time give (into this.held, this._reach), and the state's end. */
  eval() {
    const S = this.state;
    if (S === 'drawing') {
      const T = this.quick ? DRAW.quick : DRAW.time, u = Math.min(1, this.t / T);
      const take = this.quick ? DRAW.quickTake : DRAW.take;
      this.held = this.from + (1 - this.from) * smooth(u, take[0], take[1]);
      this._reach = reachCurve(u, DRAW.reach) * (this.quick ? DRAW.quickReach : 1) * (1 - this.from);
      if (u >= 1) { this.state = 'hand'; this.held = 1; this._reach = 0; }
    } else if (S === 'sheathing') {
      const u = Math.min(1, this.t / SHEATHE.time);
      this.held = this.from * (1 - smooth(u, SHEATHE.give[0], SHEATHE.give[1]));
      this._reach = reachCurve(u, SHEATHE.reach);
      if (u >= 1) { this.state = 'back'; this.held = 0; this._reach = 0; }
    } else if (S === 'away') {
      const u = Math.min(1, this.t / SHEATHE.away);
      this.held = this.from * (1 - smooth(u, 0, 1));
      this._reach = 0;
      if (u >= 1) { this.state = 'back'; this.held = 0; }
    } else { this.held = S === 'hand' ? 1 : 0; this._reach = 0; }
  }
}

const LEATHER = '#5e4b37', LEATHER_DARK = '#4a3a2b', BRASS = '#c99a4a';
/** The frog's parts in the hilt's frame on the back: [{ name, geometry, color }]. */
export function frogGeometry() {
  // the strip against his back (z: the flat toward his back), from under the pommel's collar to the grip's top
  const strip = new THREE.BoxGeometry(0.034, 0.15, 0.006).translate(0, -0.012, HILT.radius + HILT.raise + 0.006);
  // two loops round the grip (a little proud of its wrap), stitched to the strip
  const loop = (y) => new THREE.CylinderGeometry(0.021, 0.021, 0.016, 12, 1, true).translate(0, y, 0);
  const loops = mergeGeometries([loop(-0.058), loop(0.028)]);
  // a brass rivet on each loop's outer face and two at the strip's ends
  const rivet = (x, y, z) => new THREE.SphereGeometry(0.0038, 6, 4).translate(x, y, z);
  const rivets = mergeGeometries([rivet(0, -0.058, -0.021), rivet(0, 0.028, -0.021), rivet(0, -0.082, 0.02), rivet(0, 0.058, 0.02)]);
  return [
    { name: 'frog strip', geometry: strip, color: LEATHER_DARK },
    { name: 'frog loops', geometry: loops, color: LEATHER },
    { name: 'frog rivets', geometry: rivets, color: BRASS },
  ];
}

/** The frog's group (placed by the caller at sheathFrame on the chest anchor). */
export function buildFrog() {
  const g = new THREE.Group();
  g.name = 'sword frog';
  for (const { name, geometry, color } of frogGeometry()) {
    for (const k of Object.keys(geometry.attributes)) if (k !== 'position' && k !== 'normal') geometry.deleteAttribute(k);
    const m = new THREE.Mesh(geometry, makeMaterial({ color, key: `sword-frog-${name}` }));
    m.name = name; m.userData.noCollide = true; m.userData.dynamic = true;
    g.add(m);
  }
  g.userData.noCollide = true;
  return g;
}
