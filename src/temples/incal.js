import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Mark, Pit } from './pieces.js';
import { sentinelModel } from './guardians.js';
import { items } from '../items.js';
import { registerTarget } from '../targets.js';

// The City-Shaft's temple: the Warden's Well, the makers' tower on the rim,
// round from the ship. Nobody in the city goes in: the rim calls it a folly,
// the bottom says the makers built it to keep the shaft breathing. Inside it
// goes up, not down: a well of the makers turned on its end, room over room.
// Something still walks its top hall, round and round: the warden the makers
// left to keep the shaft's breath, broken since the night the sky rang. It is
// a machine: you may stop it for good.
//
// Inside (built far overhead, through its door), in order:
//   the Threshold          the first mark, the way back out
//   the Turning Floors     a drop crossed on two riding discs that wake when you splash the eye over
//                          the far door (teaches the shot)
//   the Climb              a round well: climb its wall to the balcony; roll the stone ball onto its
//                          plate with the push and the door there opens
//   the Jets' Chamber      the makers' chest: the FLUID JETS (src/items.js 'jetpack'). The only way
//                          on is up, through the oculus in its ceiling: the jets are the key
//   the Lamp Gallery       a tall drum over the chamber: three eyes on the walls, each hidden over a
//                          shelf, seen (and splashed) only by flying up to it; then the high door opens
//   the Warden's Hall      the sentinel (a robot: its meter is damage). It beams and slams; its side
//                          vents open after a beam: shoot them. Then it guards its sides and only the
//                          vent on its crown is open: fly above it, and shoot down
// After: the warden's hum stops, and the shaft's old breath comes back: a column of rising air from
// the bottom terrace to the rim, beside the Upward Shrine, that carries anyone up (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The tower on the rim (world x, z), its door toward the ship. */
export const SITE = { x: 322, z: -80, r: 22 };
SITE.heading = Math.atan2(274 - SITE.x, 0 - SITE.z);
/** The shaft's breath once the warden is stopped: a rising column from the bottom terrace to the rim. */
export const BREATH = { a: 2.85, r: 197, bottom: -290, top: 200, R: 260, radius: 4.5 };

export const PALETTE = {
  wall: '#f1e6cf', wall2: '#e6cfae', wall3: '#f6efe0', floor: '#d6c6a8', floor2: '#c9b596', trim: '#f3ead8',
  dark: '#34405e', stone: '#9fb2c6', accent: '#25386c', glow: '#9fdcef', lamp: '#f6c84e', sand: '#cdb38e', sand2: '#c9b596',
};

export const LOGIC = {
  id: 'incal', entry: 'threshold', gadget: 'jetpack',
  rooms: { threshold: { checkpoint: true }, turning: { checkpoint: true }, climb: { checkpoint: true }, jets: { checkpoint: true }, gallery: { checkpoint: true }, warden: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'turning' },
    { a: 'turning', b: 'climb', door: 'discs' },    // the riding discs, once the eye is splashed
    { a: 'climb', b: 'jets', door: 'd1' },
    { a: 'jets', b: 'gallery', needs: ['jetpack'] }, // up through the oculus
    { a: 'gallery', b: 'warden', door: 'd3' },
    { a: 'warden', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'turning' },
    discs: { type: 'bridge', opens: { lit: 's1' }, latch: true },
    ball1: { type: 'drum', room: 'climb', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'climb' },
    d1: { type: 'door', opens: { pressed: 'p1' }, latch: true },
    chest: { type: 'gadget', room: 'jets', item: 'jetpack' },
    s2: { type: 'switch', room: 'gallery', needs: ['jetpack'] },
    s3: { type: 'switch', room: 'gallery', needs: ['jetpack'] },
    s4: { type: 'switch', room: 'gallery', needs: ['jetpack'] },
    d3: { type: 'door', opens: { all: [{ lit: 's2' }, { lit: 's3' }, { lit: 's4' }] }, latch: true },
    warden: { type: 'boss', room: 'warden', needs: ['backpack', 'jetpack'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const WARDEN = {
  kind: 'robot', name: 'the warden', final: 'break', speed: 1.8, wakeTime: 2.6,
  wake: 'The machine in the hall unfolds on its three legs. Its lamp-eye finds you, and turns red.',
  openHint: 'Its vents open, glowing. Hit them.',
  resolved: 'The warden sags on its legs. Its eye goes dark, and the hum in the walls stops. Then, far below, a sound like breathing.',
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar'], pause: 1.6, hint: 'Its eye sweeps the floor: keep out of its line. When its side vents open, shoot them.' },
    { to: 1.0, attacks: ['slam', 'beam', 'mortar'], pause: 1.3, hint: 'It shuts its sides. Only the vent on its crown is open now: get above it, and shoot down.',
      openHint: 'The hatch on its crown swings up, glowing: its sides stay shut. Get above it, and shoot down into it.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, telegraph: 1.5, damage: 1, knock: 10, recover: 0.8, open: 2.8 },
    mortar: { shape: 'ring', at: 'player', radius: 3.6, telegraph: 1.6, track: 0.6, damage: 0.75, knock: 8, recover: 0.6 },
    slam: { shape: 'ring', at: 'self', radius: 8.5, telegraph: 1.4, damage: 1, knock: 13, recover: 1.0, open: 3.0 },
  },
};

/** The warden's vents: open, they take a shot (an eighth of it); guarded, only from above. */
function wardenHit(g, part, mode) {
  const rt = g.rt, P = rt.player;
  if (mode === 'push') { rt.notice('The shove only rings off its hull.', 'warden.push'); return true; }
  if (part !== 'mouth') { if (g.state === 'fight') rt.notice('The fluid splashes off its hull. Wait for its vents to open.', 'warden.hull'); return true; }
  if (g.state !== 'open') { rt.notice('Its vents are shut. Wait for them to open.', 'warden.shut'); return true; }
  if (g.phaseIndex >= 1 && P && P.pos.y < g.model.mouth.y - 1.2) { rt.notice('From down here you only hit its shut sides. Get above it.', 'warden.above'); return true; }
  g.add(0.125, 'vent');
  rt.sound?.critter?.('clank', 1);
  rt.rumble?.(0.4, 0.35);
  return true;
}

/** What the jets are for, said a moment after the box's card closes in the Jets' Chamber. */
export const JETS_NEXT = 'The jets hum on your back. Straight overhead the chamber’s ceiling is open: their thrust ({key:thrust}), without aiming, lifts you straight up through it. Tip the nose forward at the top to level out.';

/** Are you past the oculus? (in the gallery or beyond: its mark, an eye lit, the warden met, or simply up there) */
export function jetsUsed(rt) {
  const cp = rt.game.flag(`temple.${rt.id}.checkpoint`);
  if (cp === 'gallery' || cp === 'hall' || rt.logic.resolved || ['s2', 's3', 's4'].some((id) => rt.logic.isLit(id))) return true;
  const P = rt.player;
  return !!P?.pos && rt.inside(P.pos) && rt.kit.local(P.pos).y > 34;
}

/**
 * After the jets: the way on, shown. A column of pale rings rises from the chest's plinth up through
 * the oculus into the gallery, where the jets take you; a moment after the box's card a line says what
 * to do with them, and the drone flies up and points (main.js 'scout:ping'). It fades once you're up.
 */
class JetGuide {
  constructor(rt, { from, to, r }) {
    this.rt = rt;
    this.foot = rt.kit.world(...from);
    this.h = to - from[1];
    this.root = new THREE.Group();
    this.root.name = 'The way up (after the jets)';
    rt.root.add(this.root);
    this.mat = makeMaterial({ color: '#bfe6f2', flat: true, glow: 0.7, key: 'incal.temple.guide' });
    const g = new THREE.TorusGeometry(r, 0.07, 4, 36).rotateX(Math.PI / 2);
    this.rings = Array.from({ length: 10 }, (_, i) => { const m = new THREE.Mesh(g, this.mat); m.userData.noCollide = true; this.root.add(m); return { m, s: i / 10 }; });
    this.root.visible = false;
    this.k = 0; this.since = 0; this.told = false;
  }
  get wanted() { return this.rt.logic.gadget && !jetsUsed(this.rt); }
  update(dt, t) {
    const rt = this.rt, want = this.wanted;
    this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 1.2 : -dt / 0.8), 0, 1);
    this.root.visible = this.k > 0.01;
    // a moment after the chest (its card closes first): what the jets are for, and the drone shows where
    if (want && !this.told && rt.player?.pos && rt.inside(rt.player.pos)) {
      if ((this.since += dt) > 1.2) {
        this.told = true;
        rt.notice(JETS_NEXT, 'jets.next');
        rt.quests?.track?.(`temple.${rt.id}`);
        rt.game.emit('scout:ping', { why: 'jets' });
      }
    }
    if (!this.root.visible) return;
    for (const r of this.rings) {
      r.s = (r.s + dt * 0.22) % 1;
      r.m.position.set(this.foot.x, this.foot.y + r.s * this.h, this.foot.z);
      const fade = Math.min(1, r.s * 6, (1 - r.s) * 5) * this.k;
      r.m.scale.setScalar(Math.max(0.01, fade * (0.85 + 0.15 * Math.sin(t * 2.4 + r.s * 12))));
    }
    if (this.mat.uniforms?.uGlow) this.mat.uniforms.uGlow.value = (0.45 + 0.25 * Math.sin(t * 3)) * this.k;
  }
  dispose() { this.root.removeFromParent(); }
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const rotA = (a) => Math.PI / 2 - a;    // rotunda angle (0 = +z, toward +x) -> sector angle (0 = +x, toward +z)

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });

  // ---- the Turning Floors (z 12.6..46): a drop, an island, two riding discs, the eye over the far door
  K.wall(-13.2, 12.6, 13.2, 12.6, -14, 32, { t: 1.2, holes: [{ at: 13.2, w: 6, h: 7, y0: 14 }] });
  K.hall({ x: 0, z: 29.3, w: 24, d: 33.4, y: -14, h: 32, floor: false, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6, y0: 14 }] });
  K.slab(-12, 12.6, 12, 18, 0, 14);
  K.slab(-12, 40, 12, 46, 0, 14);
  K.both(M.stone, lathe([[2.4, -14], [2.4, -0.6], [2.8, -0.3], [2.8, 0.01], [0.01, 0.01]], 20).translate(0, 0, 29), new THREE.CylinderGeometry(2.6, 2.6, 14, 14).translate(0, -7, 29));
  K.both(M.dark, box(24, 1, 22, 0, -14.5, 29));
  add(Pit, { room: 'turning', min: [-13, -16, 18], max: [13, -4, 40] });
  add(Platform, { path: [[0, 0, 20.3], [0, 0, 24.3]], r: 2.2, speed: 1.6, pause: 1.4, when: { lit: 's1' } });
  add(Platform, { path: [[0, 0, 33.6], [0, 0, 37.8]], r: 2.2, speed: 1.6, pause: 1.4, when: { lit: 's1' } });
  add(Switch, { id: 's1', at: [0, 9.5, 45.9], yaw: Math.PI, size: 1.3 });
  add(Mark, { room: 'turning', at: [-4.8, 0, 15.2], yaw: Math.PI / 2 });
  for (let i = 0; i < 4; i++) K.glyph([-11.95, 4 + i * 2.6, 22 + i * 5], 1.2, Math.PI / 2);

  // ---- the corridor and the Climb (a round well, floor at 0, the balcony at 11)
  K.slab(-3.2, 46, 3.2, 48.4, 0, 0.8);
  K.wall(-3.2, 46.6, -3.2, 48.4, 0, 6.5, { t: 0.8 }); K.wall(3.2, 48.4, 3.2, 46.6, 0, 6.5, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.9, 47.4));
  const C2 = 58.6;
  K.rotunda({ x: 0, z: C2, y: 0, r: 9, h: 26, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6, y0: 11 }], oculus: 0.35 });
  // the north half of the well is a block of stone eleven metres high: climb its straight face to the top
  K.both(M.wallGlyph, T(sector(0.01, 9.2, rotA(0) - Math.PI / 2, rotA(0) + Math.PI / 2, 11), [0, 11, C2]));
  K.add(M.trim, box(18.2, 0.3, 0.5, 0, 11.05, C2 + 0.1));   // its lip
  for (let i = 0; i < 4; i++) K.add(M.trim, box(3.2, 0.22, 0.3, (i % 2 ? 1.6 : -1.6), 2.4 + i * 2.2, C2 - 0.12));   // handholds up the face
  // the ball's groove along the balcony, to the plate by the north door
  K.add(M.dark, box(6.6, 0.04, 0.9, -0.6, 11.02, C2 + 6.4));
  add(Ball, { id: 'ball1', a: [-3.8, 11.04, C2 + 6.4], b: [2.6, 11.04, C2 + 6.4], r: 0.9 });
  add(Plate, { id: 'p1', at: [2.6, 11, C2 + 6.4], r: 1.1 });
  add(Door, { id: 'd1', at: [0, 11, C2 + 9.7], w: 5, h: 6, lamps: [{ pressed: 'p1' }] });
  add(Mark, { room: 'climb', at: [5.5, 0, C2 - 4.5], yaw: -Math.PI * 0.8 });

  // ---- the corridor and the Jets' Chamber (floor 11, an oculus in its ceiling at 33)
  K.slab(-3.2, C2 + 9.6, 3.2, C2 + 12.4, 11, 0.8);
  K.wall(-3.2, C2 + 10.3, -3.2, C2 + 12.4, 11, 6.5, { t: 0.8 }); K.wall(3.2, C2 + 12.4, 3.2, C2 + 10.3, 11, 6.5, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 17.9, C2 + 11.4));
  const C3 = C2 + 22.8;   // 81.4
  K.rotunda({ x: 0, z: C3, y: 11, r: 10, h: 22, gaps: [{ a: Math.PI, w: 5, h: 6 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 11, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 11.31, C3));
  K.add(M.glyph, T(new THREE.TorusGeometry(2.75, 0.06, 4, 48), [0, 11.33, C3], [Math.PI / 2, 0, 0]));
  // the light falls down the oculus: a ring of glyphs round it on the floor
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.add(M.glyph, T(glyphGeometry(0.9, 0.04).rotateX(-Math.PI / 2), [Math.sin(a) * 5.2, 11.03, C3 + Math.cos(a) * 5.2], [0, a + Math.PI, 0])); }
  add(Mark, { room: 'jets', at: [6.2, 11, C3 - 5], yaw: -Math.PI * 0.75 });
  // once the jets are yours: the way on, shown (a column of rising rings up through the oculus, a line, the drone)
  add(JetGuide, { from: [0, 11.7, C3], to: 34.6 + 2.5, r: 2.5 });

  // ---- the Lamp Gallery: a tall drum over the chamber (floor 34.6, round the oculus below)
  const G0 = 34.6, GR = 14;
  K.rotunda({ x: 0, z: C3, y: G0, r: GR, h: 34, floor: false, seg: 32, gaps: [{ a: 0, w: 5, h: 6, y0: 28 }], oculus: 0.25 });
  K.both(M.floor, T(annulus(3.9, GR + 1.4, 0.6, 48), [0, G0, C3]));
  K.add(M.trim, T(annulus(3.6, 4.2, 0.8, 32), [0, G0 + 0.25, C3]));
  // three eyes, each over a shelf that hides it from the floor
  const eyes = [['s2', 2.2, G0 + 9], ['s3', -2.1, G0 + 16], ['s4', Math.PI, G0 + 23]];
  for (const [id, a, y] of eyes) {
    K.both(M.floor, T(sector(GR - 2.6, GR + 0.2, rotA(a) - 0.2, rotA(a) + 0.2, 0.6), [0, y - 1.25, C3]));
    add(Switch, { id, at: [Math.sin(a) * (GR - 0.15), y, C3 + Math.cos(a) * (GR - 0.15)], yaw: a + Math.PI, size: 1.0 });
  }
  // the high ledge by the north door
  K.both(M.floor, T(sector(GR - 4.5, GR + 0.2, rotA(0) - 0.32, rotA(0) + 0.32, 0.8), [0, G0 + 28, C3]));
  add(Door, { id: 'd3', at: [0, G0 + 28, C3 + GR + 0.7], w: 5, h: 6, lamps: [{ lit: 's2' }, { lit: 's3' }, { lit: 's4' }] });
  add(Mark, { room: 'gallery', at: [0, G0, C3 - 11.5], yaw: 0 });

  // ---- the Warden's Hall (floor 62.6, a great drum), its corridor from the high door
  const H0 = G0 + 28, CW = C3 + GR + 1.4 + 3 + 21.4;   // 121.2
  K.slab(-3.2, C3 + GR + 0.6, 3.2, CW - 20.6, H0, 0.8);
  K.wall(-3.2, C3 + GR + 1.4, -3.2, CW - 20.6, H0, 7, { t: 0.8 }); K.wall(3.2, CW - 20.6, 3.2, C3 + GR + 1.4, H0, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, CW - 20.6 - C3 - GR - 0.6, 0, H0 + 7.4, (C3 + GR + 0.6 + CW - 20.6) / 2));
  add(Mark, { room: 'hall', at: [2.2, H0, C3 + GR + 2.6], yaw: -Math.PI / 2 });
  const HR = 20;
  K.rotunda({ x: 0, z: CW, y: H0, r: HR, h: 30, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  K.both(M.stone, lathe([[6.5, 0], [6.5, 0.6], [5.8, 0.8], [0.01, 0.8]], 32).translate(0, H0, CW), new THREE.CylinderGeometry(6.3, 6.5, 0.8, 24).translate(0, H0 + 0.4, CW));
  K.add(M.glyph, T(new THREE.TorusGeometry(6.1, 0.08, 4, 56), [0, H0 + 0.83, CW], [Math.PI / 2, 0, 0]));
  // four stone discs on columns round the hall, eight metres up: somewhere to stand over it
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) / 4 * TAU, x = Math.sin(a) * 13, z = CW + Math.cos(a) * 13;
    K.column(x, z, H0, 8, 0.8);
    K.both(M.floor, T(new THREE.CylinderGeometry(2.6, 2.3, 0.7, 20), [x, H0 + 8.35, z]));
  }
  add(Door, { id: 'd5', at: [0, H0, CW + HR + 0.7], w: 5, h: 6 });
  // the way out: a corridor to a dark doorway
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, H0, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, H0, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, H0, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, H0, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, H0 + 7.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, H0, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, H0 + 2.5, CW + HR + 10.9));

  // the warden, standing still on its plinth
  const model = sentinelModel();
  model.pos.copy(K.world(0, H0 + 0.8, CW + 2));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, H0 + 0.8, CW);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, H0, CW), r: HR, y: K.world(0, H0, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-26, -17, -3), V(26, 100, CW + HR + 12)),
    gadget: { at: W(0, 11.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, H0 + 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 6, 18, 20], [0, 6, 40, 20], [0, 8, C2, 16], [0, 16, C2, 14], [0, 18, C3, 18], [0, G0 + 8, C3, 20], [0, G0 + 22, C3, 20], [0, H0 + 4, C3 + GR + 3, 9], [0, H0 + 12, CW, 30]],
    guardian: { def: { ...WARDEN, onHit: wardenHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the makers' tower on the rim
function exterior(scene, level, rt) {
  const TOP = 200, yaw = SITE.heading;
  const K = new TempleKit(rt.root, 'The Warden’s Well', V(SITE.x, TOP, SITE.z), yaw, rt.M);
  const M = rt.M, R = 16;
  const blue = makeMaterial({ color: PALETTE.accent, flat: true, key: 'incal.temple.blue' });
  const pale = makeMaterial({ color: '#9fbfdc', flat: true, glow: 0.25, key: 'incal.temple.carve' });
  // a stepped stone drum, a blue steel band at each step, and a dark blue crown with the glyph ring
  const tiers = [[R + 4, 0, 4], [R, 4, 34], [R - 3, 38, 22], [R - 6, 60, 16]];
  for (const [r, y, h] of tiers) {
    K.both(M.wall, new THREE.CylinderGeometry(r, r, h, 40).translate(0, y + h / 2, 0));
    K.add({ paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide }, new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.9, 40).translate(0, y + h - 0.45, 0));
  }
  K.both(blue, lathe([[R - 5, 76], [R - 3.5, 77.5], [R - 3.5, 80], [R - 6.5, 82], [3, 84], [1, 92], [0.01, 92.5]], 40));
  K.add(pale, T(new THREE.TorusGeometry(R - 3.3, 0.14, 4, 64), [0, 78.8, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.add(pale, T(glyphGeometry(2.2, 0.15), [Math.sin(a) * (R - 3.45), 78.8, Math.cos(a) * (R - 3.45)], [0, a, 0])); }
  // ribs up the drum, between them tall slit windows (dark), glyphs over each
  for (let i = 0; i < 16; i++) {
    const a = (i + 0.5) / 16 * TAU;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue;
    K.both(M.trim, T(new THREE.BoxGeometry(1.2, 34, 1.6), [Math.sin(a) * (R + 0.4), 4 + 17, Math.cos(a) * (R + 0.4)], [0, a, 0]));
    const b = a + TAU / 32;
    K.add(M.dark, T(new THREE.BoxGeometry(1.4, 9, 0.3), [Math.sin(b) * (R + 0.05), 24, Math.cos(b) * (R + 0.05)], [0, b, 0]));
    K.add(M.glyph, T(glyphGeometry(1.6, 0.12), [Math.sin(b) * (R + 0.08), 31, Math.cos(b) * (R + 0.08)], [0, b, 0]));
  }
  // the portico on the front, out past the plinth: steel-blue pylons, a lintel with the glyph, the dark doorway
  const P0 = R + 4, z0 = P0 - 0.4, z1 = P0 + 5;
  for (const s of [-1, 1]) {
    K.both(M.wall, box(4.4, 13, z1 - z0, s * 4.3, 6.5, (z0 + z1) / 2));
    K.add({ paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide }, box(4.8, 0.9, z1 - z0 + 0.4, s * 4.3, 13, (z0 + z1) / 2));
  }
  K.both(M.wall, box(4.2, 5.5, z1 - z0, 0, 7.5 + 2.75, (z0 + z1) / 2));
  K.add(blue, box(13.4, 1.6, 1.4, 0, 13.6, z1 + 0.1));
  K.add(pale, T(glyphGeometry(3.0, 0.15), [0, 10.4, z1 + 0.05], [0, 0, 0]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.3, 7.5).translate(0, 3.75, 0), [0, 0.3, P0 + 0.25]));
  K.solid(box(4.4, 7.5, 0.6, 0, 4.05, P0 - 0.05));
  K.both(M.floor, box(14, 0.3, 10, 0, 0.15, P0 + 4.5));
  K.flush();
  const at = K.world(0, 0.3, P0 + 1.6);
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), front = at.clone().addScaledVector(f, 9);
  return { door: { at, heading: yaw }, kit: K, base: TOP, doorY: TOP + 0.3, R, top: TOP + 92,
    clear: [{ x: SITE.x, z: SITE.z, r: R + 7 }, { x: front.x, z: front.z, r: 11 }] };
}

// ------------------------------------------------------------------ the world change: the shaft breathes again
/**
 * Once the warden is stopped, the shaft's old breath comes back: beside the
 * Upward Shrine a column of rising air (pale rings drifting up it, the
 * fluid's colours in its motes) carries anyone who steps into it from the
 * bottom terrace up past every level to the rim, and sets them down on it.
 * The tower's crown burns bright.
 */
function change(scene, level, rt) {
  const B = BREATH;
  const root = new THREE.Group();
  root.name = 'The shaft’s breath (the world change)';
  scene.add(root);
  root.visible = false;
  const ax = Math.cos(B.a), az = Math.sin(B.a);
  const foot = V(ax * B.r, B.bottom, az * B.r), crest = V(ax * B.r, B.top + 6, az * B.r), land = V(ax * (B.R + 9), B.top + 2.5, az * (B.R + 9));
  // the rings: pale, inked, drifting up the column (and along its crest to the rim)
  const ringM = makeMaterial({ color: '#e8f4f2', glow: 0.35, flat: true, key: 'incal.breath' });
  const rings = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(B.radius * 0.8, 0.09, 4, 32).rotateX(Math.PI / 2), ringM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m); rings.push({ m, s: i / N });
  }
  const pathAt = (s, out) => {
    // up the column (most of the way), then out over the rim
    const up = 0.88;
    if (s < up) return out.lerpVectors(foot, crest, s / up);
    return out.lerpVectors(crest, land, (s - up) / (1 - up));
  };
  // a stone ring on the bottom terrace where it rises, carved with the glyph, and one on the rim where it sets you down
  const stone = makeMaterial({ color: '#d6c6a8', flat: true });
  for (const [p, r] of [[foot, B.radius + 0.6], [land, 2.6]]) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 6, 40).rotateX(Math.PI / 2).translate(p.x, p.y + 0.12, p.z), stone);
    g.userData.noCollide = true;
    root.add(g);
  }
  const sign = new THREE.Mesh(glyphGeometry(2.2, 0.12).rotateX(-Math.PI / 2).translate(land.x, land.y - 2.35, land.z), makeMaterial({ color: '#9fdcef', glow: 0.8, flat: true }));
  sign.userData.noCollide = true;
  root.add(sign);
  const crown = rt.outside?.kit ? rt.outside : null;
  let k = 0, want = 0, rideT = 0;
  const _p = V(), _d = V();
  return {
    root, foot, crest, land,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; root.visible = k > 0.001 || want > 0; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 3);
      root.visible = k > 0.01;
      if (!root.visible) return;
      for (const r of rings) {
        r.s = (r.s + dt * 0.012) % 1;
        pathAt(r.s, r.m.position);
        const fade = Math.min(1, r.s * 12, (1 - r.s) * 12);
        r.m.scale.setScalar(Math.max(0.01, fade * k * (1 + 0.08 * Math.sin(t * 2 + r.s * 30))));
      }
      ringM.uniforms.uGlow.value = 0.25 + 0.15 * Math.sin(t * 1.3);
      // the ride: in the column you are lifted, steadied toward its middle; over the crest, carried out to the rim
      const P = rt.player;
      if (!P || P.riding || P.dead || k < 0.9) return;
      const flat = Math.hypot(P.pos.x - foot.x, P.pos.z - foot.z);
      const inColumn = flat < B.radius && P.pos.y > B.bottom - 1 && P.pos.y < crest.y;
      const toRim = _d.subVectors(land, crest).setY(0), along = Math.hypot(toRim.x, toRim.z);
      _p.subVectors(P.pos, crest).setY(0);
      const u = (_p.x * toRim.x + _p.z * toRim.z) / (along * along);
      const offLine = Math.hypot(_p.x - toRim.x * u, _p.z - toRim.z * u);
      const onCrest = u > -0.05 && u < 1 && offLine < B.radius && Math.abs(P.pos.y - (crest.y + (land.y - crest.y) * Math.max(0, u))) < 5;
      if (inColumn) {
        P.vel.y = Math.max(P.vel.y, 12) + (14 - P.vel.y) * Math.min(1, dt * 2);
        P.vel.x += (foot.x - P.pos.x) * dt * 2.5; P.vel.z += (foot.z - P.pos.z) * dt * 2.5;
        P.onGround = false; P.gliding = false;
        if ((rideT += dt) > 0.4) rt.notice('The shaft’s breath lifts you, up past every level.', 'breath');
      } else if (onCrest && !P.onGround) {
        _d.normalize();
        P.vel.x = _d.x * 9; P.vel.z = _d.z * 9; P.vel.y = Math.max(P.vel.y, -1.5);
      } else rideT = 0;
      if (crown) void crown;
    },
  };
}

export const INCAL_TEMPLE = {
  id: 'incal', levelId: 'incal', name: 'The Warden’s Well', doorLabel: 'door of the makers’ tower',
  gadget: 'jetpack', gadgetBox: 'incal.temple.jetpack', arenaDoor: 'd3',
  origin: [420, 1400, 140], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'vell', out: 7, side: 6 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the tower it is cool and very tall, and something far overhead hums, round and round.',
  // you can't get about the City-Shaft without the jets, and they are in here: the quest starts when you land
  startsOnArrival: () => !items.has('jetpack'),
  arrivalLine: 'The jets the makers left for this city are in their tower on the rim, round from the ship.',
  used: jetsUsed,   // (the temple quest's 'use' stage: src/temples/index.js)
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below the rim, by the Upward Shrine, the shaft has begun to breathe again.', 'resolved.out'); },
  // its side vents: each a target while they are open in the first phase (the guardian's own weak point is
  // the one at its front: a shot into one round its side or back counts the same)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G?.model.vent) return;
    for (let i = 0; i < 3; i++) {
      const at = V();
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.8, position: () => G.model.vent(i, at), enabled: () => G.state === 'open' && G.phaseIndex === 0,
        onHit: (mode, point, dir, info) => G.hit('mouth', mode, dir, info) }));
    }
  },
};
