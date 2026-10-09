import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The worlds' own foes (docs/systems/foes.md, "Each world's foes"): the drawing's loose ink takes the shape of
// what is round it. Their tuning (KINDS, merged into foes.js FOES), what the game says the first time you meet
// each (NOTES), and how each looks and moves (kindModel: a model with its own anim(f, c), called by Foes.look).
//
// An attack (foes.js Foe; src/temples/boss.js inArea for the shapes):
//   id, shape 'ring' | 'cone' | 'lane', radius / range / angle / width, damage, wind (s), strike (s), contact (0..1)
//   at        'self' (round it) | 'target' (where you stand: lobbed, drawn on the floor) | 'behind' (past you);
//             unset: a ring lands `ahead` of it, a cone or a lane starts at it
//   min, max  the distances it is used at (max: the kind's reach); weight: how often; chain: only as a `then`
//   instant   resolved as the wind-up ends (no strike phase): lobs, flashes, blinks
//   tele      drawn on the floor while it winds up (area and ranged attacks; plain melee reads from the body)
//   lunge     m travelled through the strike; dive: a flyer comes down along it; sweep: hits whatever it
//             touches on the way (a charge: within half the lane's width of its body), not one area at the contact
//   track     the drawn area follows you over this share of the wind-up, then holds
//   then      the id of a quick follow-up wound at once (a combo), unless it was blocked
//   knock     knocks you down; tether / grab { time, pull }: pulls you in; blind: s of white; wave: a ground
//             shockwave running out (jump it); leave: burning slag ('ring' | 'cone'); surface / blink: the foe
//             comes up at the area / steps through the shadow to it
//   onParry   'chip' (a perfect parry breaks a piece off), 'cut' (the line is cut), 'flip' (on its back)
//
// A kind may say: takes { shoot, fire, push, bloom } (what each glob does: damage, or 'hold'), weak { source: × },
// heavy (sturdy: light cuts don't stop it, it shoves less), metal (the magnet glove lifts it), light (a gust ends
// it), shell (the blade glances off its front), burrow (swims under the ground), phase (a shadow while it runs),
// trail (burning slag where it walks), splits (what it breaks into), group (how many come together), noWild,
// clamber (it leaps up ledges to 2.4 m: src/foe-height.js), perch (it climbs to the high ground to shoot down).

const S = (o) => ({ recover: 1.2, cool: [1.3, 2.3], hit: 0.4, sight: 17, giveUp: 40, ...o });

export const KINDS = {
  // the Desert, the Buried Machine: swims under the sand, a fin and a ripple; its ring follows you, then it bursts up
  ray: S({
    name: 'dune ray', hp: 3, radius: 0.8, height: 0.3, speed: 4.4, sight: 20, giveUp: 45, reach: 9, burrow: true, breaks: true,
    tone: '#b0562c', takes: { shoot: 1, fire: 1 },
    attacks: [
      { id: 'erupt', shape: 'ring', at: 'target', track: 0.6, radius: 1.8, damage: 0.17, wind: 1.25, knock: 5, surface: true, instant: true, max: 9, weight: 2 },
      { id: 'glide', shape: 'lane', width: 2.2, range: 8, tele: true, damage: 0.15, wind: 0.85, strike: 0.5, contact: 0.05, lunge: 8, sweep: true, min: 3.5, max: 7.5 },
    ],
    recover: 1.9, cool: [1.2, 2.2],
  }),
  // the Glass Dunes: a slow walker of fused green glass; bombs crack it deep, and it breaks into splinters
  golem: S({
    name: 'glass golem', hp: 6, radius: 0.95, height: 1.5, speed: 1.9, sight: 15, giveUp: 30, reach: 12, heavy: true, breaks: true,
    tone: '#3f9a72', sound: 'machine', takes: { shoot: 0, fire: 0 }, weak: { bomb: 2 }, splits: { kind: 'splinter', n: 3 }, pack: 2,
    attacks: [
      { id: 'slam', shape: 'cone', range: 3.2, angle: 0.75, damage: 0.21, wind: 1.1, strike: 0.3, contact: 0.55, knock: 6.5, max: 2.9, weight: 1.5, onParry: 'chip' },
      { id: 'shards', shape: 'ring', at: 'self', radius: 3.4, tele: true, damage: 0.14, wind: 1.3, strike: 0.25, contact: 0.4, max: 3.2 },
      { id: 'hurl', shape: 'ring', at: 'target', instant: true, radius: 1.6, damage: 0.16, wind: 1.35, min: 4.5, max: 12 },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  }),
  // what a glass golem breaks into: quick little shards that lunge
  splinter: S({
    name: 'glass splinter', hp: 1, radius: 0.3, height: 0.3, speed: 5.4, sight: 18, reach: 1.4, flinchy: true, noWild: true, breaks: true,
    tone: '#5fbf8f', takes: { shoot: 1, fire: 0, push: 1 },
    attacks: [{ id: 'lunge', shape: 'ring', radius: 0.9, ahead: 0.6, damage: 0.05, wind: 0.45, strike: 0.22, contact: 0.55, lunge: 1.2 }],
    recover: 0.7, cool: [0.7, 1.5], hit: 0.2,
  }),
  // the Signal Market: moths of neon tube; their wings flare and blind whoever faces them
  moth: S({
    name: 'sign moth', hp: 1, radius: 0.4, height: 0.35, hover: 1.3, speed: 4.2, sight: 18, reach: 6.5, flinchy: true, light: true, group: 3, breaks: true,
    tone: '#ff5fa2', takes: { shoot: 1, fire: 1, push: 1 },
    attacks: [
      { id: 'flash', shape: 'cone', at: 'self', instant: true, tele: true, range: 6.5, angle: 0.5, damage: 0.04, blind: 1.5, wind: 1.0, min: 1.8, max: 6.5, weight: 2 },
      { id: 'dart', shape: 'lane', width: 1.2, range: 5, damage: 0.07, wind: 0.6, strike: 0.3, contact: 0.8, dive: true, max: 4.5 },
    ],
    recover: 1.2, cool: [1.4, 2.6], hit: 0.25,
  }),
  // the Sealed Hangar, the City-Shaft, the Moon Foundry: a rusted makers' drone that fires a harpoon on a line
  drone: S({
    name: 'rust drone', hp: 3, radius: 0.55, height: 0.3, hover: 2.1, speed: 3.2, sight: 20, reach: 9, keep: 3.6, metal: true, breaks: true,
    tone: '#c0582e', sound: 'machine', takes: { shoot: 0, fire: 0 },
    attacks: [
      { id: 'harpoon', shape: 'lane', width: 1.1, range: 9.5, tele: true, damage: 0.1, wind: 1.1, strike: 0.3, contact: 0.7, tether: { time: 0.9, pull: 7.5 }, min: 3, max: 9, weight: 2, onParry: 'cut' },
      { id: 'ram', shape: 'lane', width: 1.4, range: 6, tele: true, damage: 0.12, wind: 0.8, strike: 0.35, contact: 0.8, dive: true, max: 6 },
    ],
    recover: 1.4, cool: [1.6, 2.6], hit: 0.35,
  }),
  // the White Mangrove, Lorn: a walking knot of white roots; its roots run along the ground and drag you in
  stalker: S({
    name: 'root stalker', hp: 4, radius: 0.65, height: 1.3, speed: 2.7, sight: 16, giveUp: 35, reach: 6.5, breaks: true, clamber: true,
    tone: '#7fcfc0', takes: { shoot: 1, fire: 2, bloom: 'hold' },
    attacks: [
      { id: 'grab', shape: 'lane', width: 1.2, range: 6.5, tele: true, damage: 0.08, wind: 1.0, strike: 0.35, contact: 0.7, grab: { time: 1.1, pull: 6 }, then: 'lash', min: 2.6, max: 6.5, weight: 1.5, onParry: 'cut' },
      { id: 'lash', shape: 'cone', range: 2.8, angle: 1.0, damage: 0.14, wind: 0.75, strike: 0.26, contact: 0.5, max: 2.6 },
    ],
    recover: 1.3,
  }),
  // the Salt Harbour, the Underwater City: a shell crusted with salt; the blade glances off its front
  crab: S({
    name: 'salt crab', hp: 4, radius: 0.75, height: 0.55, speed: 3.0, sight: 15, giveUp: 30, reach: 8, heavy: true, shell: true, breaks: true,
    tone: '#b8553a', sound: 'machine', takes: { shoot: 0, fire: 1 }, weak: { bomb: 1.5 },
    attacks: [
      { id: 'snap', shape: 'cone', range: 2.3, angle: 0.7, damage: 0.13, wind: 0.6, strike: 0.2, contact: 0.5, max: 2.2, weight: 1.5 },
      { id: 'spin', shape: 'lane', width: 2.4, range: 8, tele: true, damage: 0.17, wind: 1.1, strike: 0.7, contact: 0.05, lunge: 8, sweep: true, knock: 5, min: 3, max: 8, onParry: 'flip' },
    ],
    recover: 1.4, cool: [1.3, 2.4],
  }),
  // the Moon Foundry: a hunched walker of cooling slag, leaving burning patches where it treads
  slag: S({
    name: 'slag walker', hp: 5, radius: 0.8, height: 1.35, speed: 2.0, sight: 15, giveUp: 30, reach: 4.4, heavy: true, pack: 2, breaks: true,
    trail: { every: 1.3, r: 0.75, life: 4.5 }, douse: 2.5,
    tone: '#ff7a2e', takes: { shoot: 1, fire: 0 },
    attacks: [
      { id: 'stomp', shape: 'ring', at: 'self', radius: 2.7, tele: true, damage: 0.18, wind: 0.95, strike: 0.25, contact: 0.5, leave: 'ring', max: 2.5, weight: 1.3 },
      { id: 'pour', shape: 'cone', range: 4.6, angle: 0.5, tele: true, damage: 0.16, wind: 1.15, strike: 0.5, contact: 0.4, leave: 'cone', min: 1.5, max: 4.4 },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  }),
  // the City During the Eclipse: a long dog of shadow; running, it is only a shadow on the ground
  hound: S({
    name: 'shadow hound', hp: 3, radius: 0.5, height: 0.55, speed: 5.6, sight: 22, giveUp: 45, reach: 7, phase: true, group: 2, clamber: true,
    tone: '#6c4fa0', takes: { shoot: 0, fire: 2 },
    attacks: [
      { id: 'pounce', shape: 'ring', radius: 1.6, ahead: 1.6, damage: 0.14, wind: 0.6, strike: 0.28, contact: 0.55, lunge: 3.2, max: 3.4, weight: 1.5 },
      { id: 'step', shape: 'ring', at: 'behind', instant: true, tele: true, radius: 1.3, track: 0.5, damage: 0, blink: true, wind: 0.9, then: 'bite', min: 2.5, max: 7 },
      { id: 'bite', chain: true, shape: 'cone', range: 2.3, angle: 0.8, damage: 0.12, wind: 0.45, strike: 0.2, contact: 0.5 },
    ],
    recover: 1.2, cool: [1.1, 2.0],
  }),
};

/** Said once, the first time each kind comes for you (prompts in pad form: src/native-pad.js rewrites them). */
export const NOTES = {
  ray: 'A dune ray swims under the sand. When a ripple ring closes round your feet, move: it bursts up there, and stays up a while to fight. Cut its fin, or drop a bomb or a stomp, to flush it out.',
  golem: 'A glass golem: slow and hard, glass turns a fluid shot. A bomb cracks it twice as deep, a perfect parry chips it, and when it falls its splinters keep coming.',
  moth: 'Sign moths: when their wings flare, turn away or guard (LB / L1), or the flash blinds you. One cut, one shot or a gust ends each.',
  drone: 'A rust drone hangs out of the blade’s reach. Guard (LB / L1) its harpoon to cut the line and stun it; stilled, or pulled down with the magnet glove, it can be cut.',
  stalker: 'A root stalker: its roots run along the ground to grab you. Step out of their path, or cut it to break the hold. Embers burn it; a bloom glob puts it to sleep.',
  crab: 'A salt crab: its shell turns the blade from the front. Get round it, guard (LB / L1) its spinning charge to flip it on its back, or crack the shell with a bomb.',
  slag: 'A slag walker leaves burning slag where it treads: keep off the glow. A plain fluid shot cools its crust, and cooled it cuts twice as deep.',
  hound: 'Shadow hounds: running at a distance they are only shadows and the blade passes through; close in, they are solid. Cut when they come near or rise to strike, or light them with an ember. A pool behind you means one is stepping through.',
};

// ------------------------------------------------------------------ how they look
const M_ = (key, o) => makeMaterial({ flat: true, key: `foe-${key}`, ...o });
const _v = new THREE.Vector3();
const lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const pair = (fn) => [-1, 1].map(fn);
function add(g, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; }
const eyeColor = (f, base, wind = '#f05a3c') => (f.state === 'wind' ? wind : f.stunned > 0 ? '#bfe9ff' : base);

/** The look of a world's own foe kind: { group, parts, eyeMat, base, size, anim(f, c) }, or null (not one of these). */
export function kindModel(kind) {
  const make = MODELS[kind];
  return make ? make() : null;
}

const MODELS = {
  ray() {
    // a flat diamond of sand-coloured hide, dark ink spots, a whip tail; buried, only the fin and a mound of sand
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const hide = M_('ray-hide', { color: '#c98d4f', color2: '#e1b077' }), ink = M_('ray-ink', { color: '#2b211f' });
    const sand = M_('ray-sand', { color: '#b98a55' }), eye = M_('ray-eye', { color: '#f6e7b0', glow: 0.6 });
    const disc = add(body, new THREE.SphereGeometry(1, 16, 8).scale(1.15, 0.16, 0.85), hide, 0, 0.2, 0);
    const wings = pair((s) => { const w = add(body, new THREE.ConeGeometry(0.42, 0.9, 4).rotateZ(-s * Math.PI / 2).scale(1, 0.25, 1), hide, s * 1.25, 0.2, -0.1); return w; });
    const tail = add(body, new THREE.ConeGeometry(0.07, 1.8, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.9), ink, 0, 0.22, -0.7);
    const barb = add(tail, new THREE.ConeGeometry(0.1, 0.3, 4).rotateX(-Math.PI / 2), ink, 0, 0, -1.8);
    for (let i = 0; i < 6; i++) add(body, new THREE.CircleGeometry(0.09 + (i % 3) * 0.04, 8).rotateX(-Math.PI / 2), ink, Math.sin(i * 2.1) * 0.6, 0.37, Math.cos(i * 1.7) * 0.4);
    const eyes = pair((s) => add(body, new THREE.SphereGeometry(0.07, 8, 6), eye, s * 0.22, 0.34, 0.5));
    // buried it still reads (playtest 2026-10-08, no invisible foes: src/foe-presence.js): a tall dark fin with a
    // white contour (it reads on noon sand and on night sand; cut it and the ray is flushed out), a mound of
    // darker, turned sand, and a thick ink ripple ring round it that pulses as it swims
    const fin = add(g, new THREE.ConeGeometry(0.42, 1.3, 4).scale(0.4, 1, 1), M_('ray-fin', { color: '#2b211f', lineWhite: true }), 0, 0.55, 0);
    const mound = add(g, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 0.22, 1.1), sand, 0, 0, 0);
    const ripple = add(g, new THREE.RingGeometry(0.84, 1, 28).rotateX(-Math.PI / 2), M_('ray-ripple', { color: '#5a3a26', side: THREE.DoubleSide }), 0, 0.05, 0);
    return {
      group: g, parts: [disc, ...wings, tail, ...eyes], eyeMat: eye, base: '#f6e7b0', size: 1,
      anim(f, c) {
        const under = f.buried;
        // buried: the body under the sand, the fin cutting along it; it rises as it surfaces
        f._rise = lerp(f._rise ?? 0, under ? 0 : 1, 1 - Math.exp(-10 * c.dt));
        const r = f._rise;
        body.position.y = lerp(-0.6, 0, r); body.visible = r > 0.05;
        fin.visible = mound.visible = ripple.visible = r < 0.95;
        // (winding up its burst it swims at you, src/foes.js: the fin stands up taller and throws a wake; it never
        // sinks out of sight before it comes up)
        fin.position.y = 0.55 * (1 - r) + (f.state === 'wind' && f.atk?.surface ? 0.12 * c.wind : 0);
        fin.rotation.z = Math.sin(c.now / 160) * 0.15;
        ripple.scale.setScalar((1.1 + 0.18 * Math.sin(c.now / 180)) * (1 - r));
        mound.scale.setScalar(1 - r); mound.position.y = -0.02;
        const flap = Math.sin(c.now / (f.state === 'strike' ? 70 : 180)) * (under ? 0 : 0.35);
        wings[0].rotation.z = flap; wings[1].rotation.z = -flap;
        tail.rotation.y = Math.sin(c.now / 220) * 0.4; tail.rotation.x = f.state === 'recover' ? Math.sin(c.now / 90) * 0.3 : 0;
        disc.rotation.z = flap * 0.15;
        g.position.y += (f.state === 'strike' && !under ? 0.4 * Math.sin(Math.PI * f.k) : 0) + (f.state === 'wind' && f.atk?.id === 'glide' ? 0.25 * c.wind : 0);
        eye.uniforms.uColor.value.set(eyeColor(f, '#f6e7b0'));
        // sand sprays where it swims, and where it is about to come up
        if (under && (c.moving || (f.state === 'wind' && f.atk?.surface)) && Math.random() < 0.6) c.dust(f.pos, '#e8c58f', 2, 0.9);
        if (f.state === 'wind' && f.atk?.surface && Math.random() < 0.3 + c.wind) c.dust(f.attackAt, '#e1b077', 1 + c.wind * 2, (f.atk.radius ?? 1.5) * (1 - c.wind * 0.6));
      },
    };
  },

  golem() {
    // a heap of fused green glass on short legs: faceted chunks, a lit core, shards along its back
    const g = new THREE.Group();
    const glass = M_('golem-glass', { color: '#7fd6a8', color2: '#bfe8c4', glow: 0.15 }), dark = M_('golem-dark', { color: '#2d4a3e' });
    const core = M_('golem-core', { color: '#d8ff9a', glow: 0.95 }), pale = M_('golem-pale', { color: '#d7f3d9', glow: 0.25 });
    const torso = add(g, new THREE.IcosahedronGeometry(0.75, 0).scale(1.1, 1, 0.85), glass, 0, 1.45, 0);
    const head = add(g, new THREE.OctahedronGeometry(0.34, 0).scale(1, 1.2, 0.9), pale, 0, 2.25, 0.15);
    const heart = add(g, new THREE.OctahedronGeometry(0.18, 0), core, 0, 1.5, 0.55);
    const eyes = pair((s) => add(head, new THREE.BoxGeometry(0.1, 0.05, 0.05), core, s * 0.12, 0.02, 0.3));
    const arms = pair((s) => {
      const a = new THREE.Group(); a.position.set(s * 0.9, 1.75, 0); g.add(a);
      add(a, new THREE.IcosahedronGeometry(0.3, 0).scale(1, 1.6, 1).translate(0, -0.45, 0), glass);
      add(a, new THREE.IcosahedronGeometry(0.36, 0).translate(0, -1.0, 0.08), dark);
      return a;
    });
    const legs = pair((s) => add(g, new THREE.CylinderGeometry(0.22, 0.3, 0.75, 5).translate(0, -0.38, 0), dark, s * 0.38, 0.8, 0));
    const shards = [];
    for (let i = 0; i < 5; i++) {
      const s = add(g, new THREE.ConeGeometry(0.12, 0.7 + (i % 2) * 0.3, 4), i % 2 ? pale : glass, (i - 2) * 0.22, 2.0, -0.45);
      s.rotation.x = -0.5; s.rotation.z = (i - 2) * 0.25; s.userData.y0 = s.position.y; shards.push(s);
    }
    const chunk = add(arms[1], new THREE.IcosahedronGeometry(0.3, 0), pale, 0, -1.2, 0.1); chunk.visible = false;
    return {
      group: g, parts: [torso, head, heart, ...arms, ...legs, ...shards], eyeMat: core, base: '#d8ff9a', size: 1, chunk,
      anim(f, c) {
        const id = f.atk?.id, w = c.wind;
        legs.forEach((l, k) => { l.rotation.x = c.moving ? Math.sin(c.t * 7 + k * Math.PI) * 0.35 : 0; });
        g.position.y += c.moving ? Math.abs(Math.sin(c.t * 7)) * 0.08 : 0;
        let arm = -0.2 * c.recovery;
        if (id === 'slam') arm = f.state === 'wind' ? -2.7 * w : f.state === 'strike' ? lerp(-2.7, -0.3, c.release) : arm;
        arms[0].rotation.x = arm; arms[1].rotation.x = id === 'hurl' && f.state === 'wind' ? -2.9 * w : arm;
        // its shards rise along its back and burn bright before they burst out
        const rise = id === 'shards' && f.state === 'wind' ? w : id === 'shards' && f.state === 'strike' ? 1 - c.release : 0;
        shards.forEach((s, i) => { s.position.y = s.userData.y0 + rise * (0.35 + (i % 2) * 0.2); s.scale.setScalar(1 + rise * 0.4); });
        chunk.visible = id === 'hurl' && f.state === 'wind' && f.k < 0.55;
        g.rotation.x = id === 'slam' ? (f.state === 'wind' ? -0.12 * w : f.state === 'strike' ? 0.3 * c.release : 0) : 0;
        core.uniforms.uColor.value.set(eyeColor(f, '#d8ff9a', '#fff4b0'));
        core.uniforms.uGlow.value = 0.7 + (f.state === 'wind' ? 0.3 * w : 0);
        // the hurled chunk: in the air over the second half of the wind-up, onto the drawn ring
        if (id === 'hurl' && f.state === 'wind' && f.k > 0.5) c.lob(f, (f.k - 0.5) / 0.5, '#d7f3d9');
        else c.lob(f, -1);
        if (id === 'shards' && f.state === 'strike' && !f._shardsOut) { f._shardsOut = true; c.spray(f.chest, ['#bfe8c4', '#7fd6a8', '#2d4a3e'], 30, 7); }
        if (f.state !== 'strike') f._shardsOut = false;
      },
    };
  },

  splinter() {
    const g = new THREE.Group(), glass = M_('golem-glass', { color: '#7fd6a8', color2: '#bfe8c4', glow: 0.15 }), core = M_('splinter-eye', { color: '#d8ff9a', glow: 0.9 });
    const body = add(g, new THREE.OctahedronGeometry(0.3, 0).scale(0.6, 1.3, 0.6), glass, 0, 0.35, 0);
    const eye = add(g, new THREE.OctahedronGeometry(0.06, 0), core, 0, 0.42, 0.15);
    return {
      group: g, parts: [body, eye], eyeMat: core, base: '#d8ff9a', size: 1.3,   // (drawn a little bigger than it was: a shard you can see coming)
      anim(f, c) {
        body.rotation.y += c.dt * (f.state === 'wind' ? 14 : 4);
        body.rotation.z = f.state === 'strike' ? -1.3 : f.state === 'wind' ? -0.5 * c.wind : 0;
        g.position.y += 0.1 + Math.abs(Math.sin(c.now / 140 + f.home.x)) * (c.moving ? 0.25 : 0.06);
        core.uniforms.uColor.value.set(eyeColor(f, '#d8ff9a'));
      },
    };
  },

  moth() {
    // a moth bent from neon tube: dark wings outlined in glowing pink and cyan, the tubes flaring before a flash
    const g = new THREE.Group();
    const dark = M_('moth-dark', { color: '#241a2e' }), pink = M_('moth-neon-pink', { color: '#ff5fa2', glow: 0.8 }), cyan = M_('moth-neon-cyan', { color: '#5ff0e8', glow: 0.8 });
    add(g, new THREE.CapsuleGeometry(0.08, 0.45, 3, 6).rotateX(Math.PI / 2), dark, 0, 0.35, 0);
    const head = add(g, new THREE.SphereGeometry(0.1, 8, 6), dark, 0, 0.38, 0.3);
    const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.04, 6, 4), cyan, s * 0.06, 0.03, 0.07));
    pair((s) => { const a = add(head, new THREE.CylinderGeometry(0.008, 0.008, 0.35, 3), pink, s * 0.07, 0.17, 0.05); a.rotation.z = -s * 0.5; a.rotation.x = 0.5; });
    const wing = (s, back) => {
      const w = new THREE.Group(); w.position.set(s * 0.06, 0.38, back ? -0.12 : 0.06); g.add(w);
      const sh = new THREE.Shape(); const L = back ? 0.45 : 0.62, H = back ? 0.32 : 0.4;
      sh.moveTo(0, 0); sh.bezierCurveTo(s * L * 0.3, H, s * L, H * 0.9, s * L, back ? -H * 0.2 : H * 0.1); sh.bezierCurveTo(s * L * 0.9, -H * 0.5, s * L * 0.3, -H * 0.4, 0, 0);
      add(w, new THREE.ShapeGeometry(sh, 10).rotateX(-Math.PI / 2), dark).material.side = THREE.DoubleSide;
      const pts = sh.getPoints(18).map((p) => new THREE.Vector3(p.x, 0.012, -p.y));
      add(w, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 32, 0.018, 4, true), back ? cyan : pink);
      return w;
    };
    const wings = [wing(-1, false), wing(1, false), wing(-1, true), wing(1, true)];
    return {
      group: g, parts: [head, ...eyes, ...wings], eyeMat: cyan, base: '#5ff0e8', size: 1,
      anim(f, c) {
        const flash = f.atk?.id === 'flash' && f.state === 'wind' ? c.wind : 0;
        // wings flutter; winding a flash they spread flat toward you and the tubes burn white
        const flap = Math.sin(c.now / (f.state === 'wind' ? 45 : 70) + f.home.x) * (0.9 - flash * 0.8);
        wings.forEach((w, i) => { w.rotation.z = (i % 2 ? -1 : 1) * (flap + 0.2) * (i < 2 ? 1 : 0.8); w.rotation.x = -flash * 1.2; });
        g.position.y += f.alt + Math.sin(c.now / 300 + f.home.z) * 0.12;
        g.rotation.x = -flash * 0.4;
        pink.uniforms.uColor.value.set(flash > 0.6 ? '#fff4fb' : '#ff5fa2'); pink.uniforms.uGlow.value = 0.8 + flash * 0.2;
        cyan.uniforms.uColor.value.set(flash > 0.75 ? '#ffffff' : f.stunned > 0 ? '#bfe9ff' : '#5ff0e8');
      },
    };
  },

  drone() {
    // a rusted makers' drone: a riveted barrel, one amber lens, three rotors, a harpoon gun slung under it
    const g = new THREE.Group();
    const rust = makeMaterial({ color: '#8a4b2e', metal: 'iron', key: 'foe-drone-rust' }), plate = makeMaterial({ color: '#b0683c', metal: 'copper', key: 'foe-drone-plate' });
    const dark = M_('foe-dark-iron', { color: '#2e2a28' }), lens = M_('drone-lens', { color: '#ffb347', glow: 0.9 });
    const hull = add(g, new THREE.CylinderGeometry(0.42, 0.36, 0.5, 10).rotateX(Math.PI / 2), rust, 0, 0.35, 0);
    const band = add(g, new THREE.TorusGeometry(0.4, 0.04, 5, 16), plate, 0, 0.35, 0.1);
    const eye = add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12).rotateX(Math.PI / 2), lens, 0, 0.38, 0.28);
    const rotors = [0, 1, 2].map((k) => {
      const a = (k / 3) * Math.PI * 2, arm = new THREE.Group(); arm.position.set(Math.sin(a) * 0.55, 0.62, Math.cos(a) * 0.4 - 0.05); g.add(arm);
      add(arm, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), dark, 0, -0.12, 0);
      const blade = add(arm, new THREE.BoxGeometry(0.5, 0.015, 0.06), dark);
      return blade;
    });
    const gun = add(g, new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6).rotateX(Math.PI / 2), dark, 0, 0.05, 0.15);
    const harpoon = new THREE.Group(); g.add(harpoon);
    add(harpoon, new THREE.ConeGeometry(0.07, 0.3, 4).rotateX(Math.PI / 2), plate, 0, 0, 0.15);
    const line = add(g, new THREE.CylinderGeometry(0.012, 0.012, 1, 3).translate(0, 0.5, 0).rotateX(Math.PI / 2), dark, 0, 0.05, 0.4);
    line.visible = false;
    return {
      group: g, parts: [hull, band, eye, ...rotors.map((r) => r.parent), gun], eyeMat: lens, base: '#ffb347', size: 1, line, harpoon,
      anim(f, c) {
        const id = f.atk?.id;
        rotors.forEach((r, k) => { r.rotation.y += c.dt * (f.stunned > 0 ? 4 : 30 + k * 3); });
        g.position.y += f.alt + Math.sin(c.now / 260 + f.home.x) * 0.08;
        g.rotation.z = Math.sin(c.now / 400 + f.home.z) * 0.08;
        // the harpoon: aimed through its wind-up (the gun tips down at you), out along the lane as it strikes
        const aim = id === 'harpoon' && f.state === 'wind' ? c.wind : 0;
        g.rotation.x = aim * 0.35 + (f.state === 'strike' && id === 'ram' ? 0.6 : 0);
        let reach = 0;
        if (id === 'harpoon' && f.state === 'strike') reach = (f.atk.range ?? 9) * Math.min(1, f.k / 0.7);
        const held = c.tethered(f);
        if (held) reach = held;
        harpoon.position.set(0, 0.05, 0.4 + reach);
        line.visible = reach > 0.2; line.scale.set(1, 1, Math.max(0.01, reach));
        lens.uniforms.uColor.value.set(eyeColor(f, '#ffb347', '#ff4a2a'));
      },
    };
  },

  stalker() {
    // a knot of bone-white roots on four arching root-legs, two long root-arms, a pale lamp of an eye
    const g = new THREE.Group();
    const bone = M_('stalker-bone', { color: '#e8e2d0', color2: '#d4ccb4' }), dark = M_('stalker-dark', { color: '#3a332c' }), lamp = M_('stalker-lamp', { color: '#9fe8d8', glow: 0.9 });
    const knot = add(g, new THREE.DodecahedronGeometry(0.45, 0).scale(1, 1.15, 0.9), bone, 0, 1.25, 0);
    const eye = add(g, new THREE.SphereGeometry(0.11, 10, 8), lamp, 0, 1.35, 0.38);
    add(g, new THREE.TorusGeometry(0.14, 0.03, 4, 12), dark, 0, 1.35, 0.36);
    const root = (pts, r = 0.06) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 14, r, 5, false);
    const legs = [0, 1, 2, 3].map((k) => {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, l = new THREE.Group(); l.position.set(0, 1.1, 0); l.rotation.y = a; g.add(l);
      add(l, root([[0, 0, 0], [0, 0.35, 0.45], [0, 0.1, 0.95], [0, -1.1, 1.15]], 0.055), bone);
      return l;
    });
    const arms = pair((s) => {
      const a = new THREE.Group(); a.position.set(s * 0.38, 1.4, 0.15); g.add(a);
      add(a, root([[0, 0, 0], [s * 0.3, 0.1, 0.3], [s * 0.25, -0.3, 0.8], [s * 0.1, -0.6, 1.1]], 0.045), bone);
      for (let i = 0; i < 3; i++) add(a, new THREE.ConeGeometry(0.025, 0.3, 3).rotateX(Math.PI / 2 + 0.6), dark, s * 0.1 + (i - 1) * 0.06, -0.65, 1.2);
      return a;
    });
    // the grab: roots running out along the ground toward you
    const reach = new THREE.Group(); g.add(reach);
    const tendrils = [-0.25, 0, 0.25].map((x) => add(reach, root([[0, 0, 0], [x * 0.5, 0.15, 0.33], [x, 0.05, 0.66], [x * 0.6, 0.1, 1]], 0.04), bone));
    reach.visible = false;
    return {
      group: g, parts: [knot, eye, ...legs, ...arms], eyeMat: lamp, base: '#9fe8d8', size: 1,
      anim(f, c) {
        const id = f.atk?.id;
        legs.forEach((l, k) => { l.rotation.x = c.moving ? Math.sin(c.t * 6 + k * Math.PI / 2) * 0.22 : 0; });
        g.position.y += c.moving ? Math.abs(Math.sin(c.t * 6)) * 0.06 : 0;
        const sweep = id === 'lash' ? (f.state === 'wind' ? -1.1 * c.wind : f.state === 'strike' ? lerp(-1.1, 1.2, c.release) : 0) : 0;
        arms[0].rotation.y = sweep; arms[1].rotation.y = sweep;
        const grabWind = id === 'grab' && f.state === 'wind' ? c.wind : 0;
        arms.forEach((a, i) => { a.rotation.x = -grabWind * 0.9 + (id === 'grab' && f.state === 'strike' ? 0.5 : 0); });
        knot.scale.set(1 + grabWind * 0.12, 1 - grabWind * 0.1, 1);
        // the roots run out along the drawn lane while it strikes, and stay round you while it holds
        let len = 0;
        if (id === 'grab' && f.state === 'strike') len = (f.atk.range ?? 6) * Math.min(1, f.k / 0.7);
        const held = c.tethered(f);
        if (held) len = held;
        reach.visible = len > 0.2; reach.position.y = 0.05; reach.scale.set(1, 1, Math.max(0.01, len));
        tendrils.forEach((t, i) => { t.rotation.z = Math.sin(c.now / 120 + i) * 0.1; });
        lamp.uniforms.uColor.value.set(eyeColor(f, f.sleep > 0 ? '#f2b8d8' : '#9fe8d8', '#e8ff7a'));
        if (f.sleep > 0) { g.rotation.x = 0.25; knot.scale.set(1.05, 0.95, 1.05); }
      },
    };
  },

  crab() {
    // a wide shell crusted with salt crystals, a rust-brown underside, two great claws, six legs, eyes on stalks
    const g = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.55; g.add(body);
    const salt = M_('crab-salt', { color: '#efe9dc', color2: '#d9cdb4' }), under = M_('crab-under', { color: '#9a4f34' });
    const dark = M_('crab-dark', { color: '#3a2a24' }), eye = M_('crab-eye', { color: '#f2d34b', glow: 0.7 }), flesh = M_('crab-flesh', { color: '#d77a5e' });
    const shell = add(body, new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 0.8), salt, 0, 0, 0);
    const belly = add(body, new THREE.SphereGeometry(0.78, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.3, 0.78), under, 0, 0, 0);
    const crystals = [];
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.2 + (i % 3) * 0.17; const cr = add(body, new THREE.BoxGeometry(0.12, 0.16, 0.12), salt, Math.sin(a) * r, 0.36 - r * 0.25, Math.cos(a) * r * 0.8); cr.rotation.set(i, i * 0.7, 0); crystals.push(cr); }
    const meat = add(body, new THREE.SphereGeometry(0.6, 12, 6).scale(1, 0.35, 0.8), flesh, 0, 0.05, 0); meat.visible = false;
    const eyes = pair((s) => { const st = add(body, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4), dark, s * 0.18, 0.4, 0.55); add(st, new THREE.SphereGeometry(0.06, 8, 6), eye, 0, 0.17, 0); return st; });
    const claws = pair((s) => {
      const c = new THREE.Group(); c.position.set(s * 0.65, -0.05, 0.5); body.add(c);
      add(c, new THREE.CylinderGeometry(0.07, 0.06, 0.4, 5).rotateX(Math.PI / 2).translate(0, 0, 0.2), under);
      add(c, new THREE.SphereGeometry(0.2, 8, 6).scale(0.8, 0.7, 1.2), salt, 0, 0, 0.5);
      const pin = add(c, new THREE.ConeGeometry(0.07, 0.35, 4).rotateX(Math.PI / 2), dark, s * 0.06, -0.05, 0.8);
      return { c, pin };
    });
    const legs = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const l = new THREE.Group(); l.position.set(s * 0.6, -0.05, 0.2 - k * 0.3); l.rotation.y = s * (Math.PI / 2 - (k - 1) * 0.4); body.add(l);
      add(l, new THREE.CylinderGeometry(0.035, 0.02, 0.75, 4).translate(0, -0.37, 0).rotateX(0.9), dark);
      legs.push(l);
    }
    return {
      group: g, parts: [shell, belly, ...crystals, ...eyes, ...claws.map((x) => x.c), ...legs], eyeMat: eye, base: '#f2d34b', size: 1,
      anim(f, c) {
        const id = f.atk?.id;
        const tuck = id === 'spin' ? (f.state === 'wind' ? c.wind : f.state === 'strike' ? 1 : 0) : 0;
        legs.forEach((l, k) => { l.rotation.z = (c.moving ? Math.sin(c.t * 14 + k) * 0.3 : 0) + (f.flipped > 0 ? Math.sin(c.now / 60 + k) * 0.6 : 0); l.scale.y = 1 - tuck * 0.6; });
        eyes.forEach((e) => { e.scale.y = 1 - tuck * 0.8; });
        claws.forEach(({ c: cl, pin }, i) => {
          const snap = id === 'snap' ? (f.state === 'wind' ? c.wind : f.state === 'strike' ? 1 - c.release : 0) : 0;
          cl.rotation.y = (i ? -1 : 1) * (snap * 0.6 - tuck * 0.9); cl.rotation.x = -snap * 0.5; pin.rotation.y = (i ? 1 : -1) * snap * 0.4;
          cl.scale.setScalar(1 - tuck * 0.5);
        });
        // the spin: tucked into its shell, turning faster and faster through the wind-up, a top along the lane
        f._spin = (f._spin ?? 0) + c.dt * (tuck > 0 ? 4 + tuck * 26 : 0);
        body.rotation.y = tuck > 0 ? f._spin : 0;
        body.position.y = 0.55 - tuck * 0.2;
        // flipped by a guard: on its back, legs waving; the shell cracked by a bomb shows what is under it
        body.rotation.z = lerp(body.rotation.z, f.flipped > 0 ? Math.PI : 0, 1 - Math.exp(-12 * c.dt));
        crystals.forEach((x) => { x.visible = f.shelled; });
        meat.visible = !f.shelled;
        shell.scale.set(f.shelled ? 1 : 0.92, f.shelled ? 1 : 0.7, f.shelled ? 1 : 0.92);
        if (tuck > 0.5 && f.state === 'strike' && Math.random() < 0.6) c.dust(f.pos, '#efe9dc', 2);
        eye.uniforms.uColor.value.set(eyeColor(f, '#f2d34b'));
      },
    };
  },

  slag() {
    // a hunched lump of dark crust on two thick legs, molten orange showing through its cracks, a lip to pour from
    const g = new THREE.Group();
    const crust = M_('slag-crust', { color: '#3b2a26', color2: '#2a1d1a' }), melt = M_('slag-melt', { color: '#ff7a2e', glow: 0.95 }), hot = M_('slag-hot', { color: '#ffd36a', glow: 1 });
    const cool = M_('slag-cool', { color: '#6f7f8a' });
    const body = add(g, new THREE.SphereGeometry(0.75, 12, 9).scale(1, 0.9, 1.1), crust, 0, 1.25, -0.05);
    const blobs = [];
    for (let i = 0; i < 7; i++) { const a = i * 2.3, y = 0.95 + (i % 3) * 0.25; blobs.push(add(g, new THREE.SphereGeometry(0.15 + (i % 2) * 0.06, 8, 6), melt, Math.sin(a) * 0.62, y, Math.cos(a) * 0.7)); }
    const head = add(g, new THREE.SphereGeometry(0.36, 10, 8).scale(1, 0.8, 1.1), crust, 0, 1.75, 0.55);
    const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.06, 6, 4), hot, s * 0.14, 0.06, 0.32));
    const lip = add(head, new THREE.TorusGeometry(0.16, 0.05, 5, 12, Math.PI).rotateX(Math.PI / 2), crust, 0, -0.16, 0.34);
    const legs = pair((s) => { const l = new THREE.Group(); l.position.set(s * 0.42, 0.85, 0); g.add(l); add(l, new THREE.CylinderGeometry(0.22, 0.3, 0.85, 7).translate(0, -0.42, 0), crust); add(l, new THREE.SphereGeometry(0.14, 6, 4), melt, 0, -0.45, 0.2); return l; });
    const stream = add(g, new THREE.CylinderGeometry(0.1, 0.22, 1, 6).translate(0, -0.5, 0), hot, 0, 1.55, 1.0); stream.visible = false;
    return {
      group: g, parts: [body, head, ...blobs, ...legs], eyeMat: hot, base: '#ffd36a', size: 1,
      anim(f, c) {
        const id = f.atk?.id, w = c.wind;
        // stomp: one leg raised high through the wind-up, down hard; pour: it leans and tips its lip at you
        const lift = id === 'stomp' ? (f.state === 'wind' ? w : f.state === 'strike' ? 1 - c.release : 0) : 0;
        legs.forEach((l, k) => { l.rotation.x = (c.moving ? Math.sin(c.t * 5 + k * Math.PI) * 0.3 : 0) - (k === 1 ? lift * 1.3 : 0); l.position.y = 0.85 + (k === 1 ? lift * 0.4 : 0); });
        const lean = id === 'pour' ? (f.state === 'wind' ? w : f.state === 'strike' ? 1 : 0) : 0;
        g.rotation.x = lean * 0.45 - lift * 0.1;
        g.position.y += c.moving ? Math.abs(Math.sin(c.t * 5)) * 0.07 : 0;
        stream.visible = id === 'pour' && f.state === 'strike';
        if (stream.visible) { stream.scale.set(1, 1.6 + Math.sin(c.now / 50) * 0.1, 1); if (Math.random() < 0.7) c.spray(_v.set(f.pos.x + Math.sin(f.heading) * 2.2, f.pos.y + 0.2, f.pos.z + Math.cos(f.heading) * 2.2), ['#ffd36a', '#ff7a2e'], 3, 3); }
        // doused with a fluid shot its glow goes out under a grey crust (it cuts twice as deep)
        const crusted = f.crust > 0;
        for (const b of blobs) { b.material = crusted ? cool : melt; b.scale.setScalar(1 + Math.sin(c.now / 200 + b.position.x * 9) * 0.12); }
        melt.uniforms.uGlow.value = 0.8 + 0.2 * Math.sin(c.now / 150) + (f.state === 'wind' ? 0.2 * w : 0);
        hot.uniforms.uColor.value.set(eyeColor(f, crusted ? '#a9b6bf' : '#ffd36a', '#ffffff'));
        if (!crusted && Math.random() < 0.08) c.spray(_v.copy(f.pos).setY(f.pos.y + 1.4), ['#ff7a2e'], 1, 1.2, -2);
      },
    };
  },

  hound() {
    // a long low dog of living shadow, ears up, a whip of a tail; running, it melts into a shadow on the ground
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    // (its ink is drawn with a white contour, as the shade's: black on the Eclipse's dark streets it would be
    // only a hole; playtest 2026-10-08, no invisible foes: src/foe-presence.js)
    const ink = M_('hound-ink', { color: '#15121c', lineWhite: true }), rim = M_('hound-rim', { color: '#3b2a5c', lineWhite: true }), eye = M_('hound-eye', { color: '#d6c2ff', glow: 0.95 });
    const torso = add(body, new THREE.SphereGeometry(0.4, 12, 8).scale(0.7, 0.75, 1.6), ink, 0, 0.62, 0);
    const neck = add(body, new THREE.CylinderGeometry(0.12, 0.18, 0.45, 6).rotateX(-0.9), ink, 0, 0.82, 0.55);
    const head = add(body, new THREE.SphereGeometry(0.17, 10, 8).scale(0.9, 0.85, 1.1), ink, 0, 0.95, 0.78);
    add(head, new THREE.ConeGeometry(0.09, 0.4, 6).rotateX(Math.PI / 2), ink, 0, -0.04, 0.27);
    pair((s) => add(head, new THREE.ConeGeometry(0.06, 0.22, 4), rim, s * 0.09, 0.17, -0.05));
    const eyes = pair((s) => add(head, new THREE.SphereGeometry(0.035, 6, 4), eye, s * 0.08, 0.04, 0.15));
    const legs = [];
    for (const z of [0.42, -0.42]) for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.17, 0.5, z); body.add(l); add(l, new THREE.CylinderGeometry(0.05, 0.03, 0.55, 4).translate(0, -0.27, 0), ink); legs.push(l); }
    const tail = add(body, new THREE.ConeGeometry(0.05, 0.8, 4).rotateX(-Math.PI / 2 - 0.4).translate(0, 0.1, -0.35), ink, 0, 0.7, -0.6);
    // its shadow form: a dark pool sliding along the ground, a low hump of shadow rising out of it with a
    // lavender glow round its edge, and the two eyes lit over it (before: a flat pool and two 4 cm eyes, all
    // but invisible on a dark street)
    const pool = add(g, new THREE.CircleGeometry(0.55, 14).scale(0.8, 1.5, 1).rotateX(-Math.PI / 2), ink, 0, 0.03, 0);
    const hump = add(g, new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.75, 1.15, 1.5), ink, 0, 0, 0);
    const glowRim = add(g, new THREE.RingGeometry(0.62, 0.74, 24).scale(0.8, 1.5, 1).rotateX(-Math.PI / 2), M_('hound-glow', { color: '#d6c2ff', glow: 0.8, side: THREE.DoubleSide }), 0, 0.04, 0);
    const poolEyes = pair((s) => add(g, new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.6, 1), eye, s * 0.12, 0.4, 0.42));
    return {
      group: g, parts: [], eyeMat: eye, base: '#d6c2ff', size: 1, shadowy: true,
      anim(f, c) {
        f._solid = lerp(f._solid ?? 1, f.phased ? 0 : 1, 1 - Math.exp(-(f.phased ? 6 : 14) * c.dt));
        const s = f._solid;
        body.visible = s > 0.08; body.scale.set(1, Math.max(0.05, s), 1); body.position.y = -(1 - s) * 0.3;
        pool.visible = s < 0.9; pool.scale.setScalar(1.2 - s * 0.5); poolEyes.forEach((e) => { e.visible = s < 0.6; });
        hump.visible = glowRim.visible = s < 0.6;
        hump.scale.set(1, 1 - s * 0.6 + Math.sin(c.now / 140) * 0.06, 1);
        glowRim.scale.setScalar(1 + Math.sin(c.now / 200) * 0.06);
        const run = c.moving || f.state === 'strike';
        legs.forEach((l, k) => { l.rotation.x = run ? Math.sin(c.t * 16 + (k % 2) * Math.PI + (k > 1 ? 0.6 : 0)) * 0.7 : 0; });
        // the pounce: it crouches back on its haunches, then stretches out flat through the leap
        const crouch = f.state === 'wind' && f.atk?.id === 'pounce' ? c.wind : 0;
        torso.rotation.x = crouch * 0.25 - (f.state === 'strike' ? 0.15 : 0);
        body.rotation.x = -crouch * 0.2;
        g.position.y += f.state === 'strike' && f.atk?.lunge ? Math.sin(Math.PI * f.k) * 0.6 : 0;
        head.rotation.x = f.state === 'strike' && f.atk?.id === 'bite' ? -0.4 * Math.sin(Math.PI * f.k) : 0;
        tail.rotation.y = Math.sin(c.now / 110) * 0.5;
        neck.scale.y = 1 + crouch * 0.1;
        eye.uniforms.uColor.value.set(eyeColor(f, f.lit > 0 ? '#ffe2a8' : '#d6c2ff', '#ff6a8a'));
        if (s > 0.5 && Math.random() < 0.15) c.drip(f, '#15121c');
      },
    };
  },
};
