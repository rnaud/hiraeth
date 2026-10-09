import * as THREE from 'three';
import { makeMaterial } from './materials.js';

// The worlds' old kinds (docs/systems/foes.md, "Each world's foes"): since the enemy roster (docs/design/enemy-roster.md,
// src/enemies/archetypes.js) they run as the stand-in bodies of archetypes not built yet (the glass golem for the
// furnace brute, the rust drone for the ring drone, the slag walker for the crucible cart); each goes when its
// archetype lands (the dune ray, the sign moth and the winged blot went with batch 2: the mound worm, the signal moth
// and the sky ray; the root stalker with batch 3: the root knot, as the spitting blot and the blot swarm in foes.js
// went for the bellows toad and the skitters). Their tuning (KINDS, merged into foes.js FOES), what the game says
// the first time you meet each (NOTES), and how each looks and moves (kindModel: a model with its own anim(f, c),
// called by Foes.look). The built archetypes' own are in src/enemies/archetypes.js and src/enemies/plans/.
//
// An attack (foes.js Foe; src/temples/boss.js inArea for the shapes):
//   id, shape 'ring' | 'cone' | 'lane', radius / range / angle / width, damage, wind (s), strike (s), contact (0..1)
//   at        'self' (round it) | 'target' (where you stand) | 'behind' (past you);
//             unset: a ring lands `ahead` of it, a cone or a lane starts at it
//   min, max  the distances it is used at (max: the kind's reach); weight: how often; chain: only as a `then`
//   instant   resolved as the wind-up ends (no strike phase): lobs, flashes, blinks
//   lob       a lobbed or thrown projectile: the only attack with a mark on the ground (where it lands); every
//             other attack is read from the body alone (src/telegraph.js: the pose, the glow, the rising sound)
//   lunge     m travelled through the strike; dive: a flyer comes down along it; sweep: hits whatever it
//             touches on the way (a charge: within half the lane's width of its body), not one area at the contact
//   track     its aim (a lob's mark) follows you over this share of the wind-up, then holds
//   then      the id of a quick follow-up wound at once (a combo), unless it was blocked
//   knock     knocks you down; tether / grab { time, pull }: pulls you in; blind: s of white; wave: a ground
//             shockwave running out (jump it); leave: burning slag ('ring' | 'cone'); surface / blink: the foe
//             comes up at the area / steps through the shadow to it
//   onParry   'chip' (a perfect parry breaks a piece off), 'cut' (the line is cut), 'flip' (on its back),
//             'reflect' (a perfect parry sends the bolt back)
//   the archetypes' (src/enemies/archetypes.js): skins, below, rear / back, flank, far, shove
//
// A kind may say: takes { shoot, fire, push, bloom } (what each glob does: damage, or 'hold'), weak { source: × },
// heavy (sturdy: light cuts don't stop it, it shoves less), metal (the magnet glove lifts it), light (a gust ends
// it), shell (the blade glances off its front), burrow (swims under the ground), phase (a shadow while it runs),
// trail (burning slag where it walks), splits (what it breaks into), group (how many come together), noWild,
// clamber (it leaps up ledges to 2.4 m: src/foe-height.js), perch (it climbs to the high ground to shoot down).

const S = (o) => ({ recover: 1.2, cool: [1.3, 2.3], hit: 0.4, sight: 17, giveUp: 40, ...o });

export const KINDS = {
  golem: S({
    name: 'glass golem', hp: 6, radius: 0.95, height: 1.5, speed: 1.9, sight: 15, giveUp: 30, reach: 12, heavy: true, breaks: true,
    tone: '#3f9a72', sound: 'machine', takes: { shoot: 0, fire: 0 }, weak: { bomb: 2 }, pack: 2,
    attacks: [
      { id: 'slam', shape: 'cone', range: 3.2, angle: 0.75, damage: 0.75, wind: 1.1, strike: 0.3, contact: 0.55, knock: 6.5, max: 2.9, weight: 1.5, onParry: 'chip' },
      { id: 'shards', shape: 'ring', at: 'self', radius: 3.4, damage: 0.5, wind: 1.3, strike: 0.25, contact: 0.4, max: 3.2 },
      { id: 'hurl', shape: 'ring', at: 'target', instant: true, lob: true, radius: 1.6, damage: 0.75, wind: 1.35, min: 4.5, max: 12 },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  }),
  drone: S({
    name: 'rust drone', hp: 3, radius: 0.55, height: 0.3, hover: 2.1, speed: 3.2, sight: 20, reach: 9, keep: 3.6, metal: true, breaks: true,
    tone: '#c0582e', sound: 'machine', takes: { shoot: 0, fire: 0 },
    attacks: [
      { id: 'harpoon', shape: 'lane', width: 1.1, range: 9.5, damage: 0.5, wind: 1.1, strike: 0.3, contact: 0.7, tether: { time: 0.9, pull: 7.5 }, min: 3, max: 9, weight: 2, onParry: 'cut' },
      { id: 'ram', shape: 'lane', width: 1.4, range: 6, damage: 0.5, wind: 0.8, strike: 0.35, contact: 0.8, dive: true, max: 6 },
    ],
    recover: 1.4, cool: [1.6, 2.6], hit: 0.35,
  }),
  // the Moon Foundry: a hunched walker of cooling slag, leaving burning patches where it treads
  slag: S({
    name: 'slag walker', hp: 5, radius: 0.8, height: 1.35, speed: 2.0, sight: 15, giveUp: 30, reach: 4.4, heavy: true, pack: 2, breaks: true,
    trail: { every: 1.3, r: 0.75, life: 4.5 }, douse: 2.5,
    tone: '#ff7a2e', takes: { shoot: 1, fire: 0 },
    attacks: [
      { id: 'stomp', shape: 'ring', at: 'self', radius: 2.7, damage: 0.75, wind: 0.95, strike: 0.25, contact: 0.5, leave: 'ring', max: 2.5, weight: 1.3 },
      { id: 'pour', shape: 'cone', range: 4.6, angle: 0.5, damage: 0.75, wind: 1.15, strike: 0.5, contact: 0.4, leave: 'cone', min: 1.5, max: 4.4 },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  }),
};

/** Said once, the first time each kind comes for you (prompts in pad form: src/native-pad.js rewrites them). */
export const NOTES = {
  golem: 'A glass golem: slow and hard, glass turns a fluid shot. A bomb cracks it twice as deep, and a perfect parry chips it.',
  drone: 'A rust drone hangs out of the blade’s reach. Guard (LB / L1) its harpoon to cut the line and stun it; stilled, or pulled down with the magnet glove, it can be cut.',
  slag: 'A slag walker leaves burning slag where it treads: keep off the glow. A plain fluid shot cools its crust, and cooled it cuts twice as deep.',
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
      tell: (id) => (id === 'slam' ? arms[0].children[1] : id === 'shards' ? shards[2] : arms[1].children[1]),
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
        g.rotation.x = id === 'slam' ? (f.state === 'wind' ? -0.12 * w : f.state === 'strike' ? 0.3 * c.release : 0) : id === 'shards' && f.state === 'wind' ? 0.12 * w : 0;
        if (id === 'shards' && f.state === 'wind') g.position.y -= 0.25 * w;   // (it hunches down as its shards rise)
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
      tell: (id) => (id === 'harpoon' ? harpoon : eye),
      anim(f, c) {
        const id = f.atk?.id;
        rotors.forEach((r, k) => { r.rotation.y += c.dt * (f.stunned > 0 ? 4 : 30 + k * 3); });
        g.position.y += f.alt + Math.sin(c.now / 260 + f.home.x) * 0.08;
        g.rotation.z = Math.sin(c.now / 400 + f.home.z) * 0.08;
        // the harpoon: aimed through its wind-up (the gun tips down at you), out along the lane as it strikes
        const aim = id === 'harpoon' && f.state === 'wind' ? c.wind : 0;
        const rear = id === 'ram' && f.state === 'wind' ? c.wind : 0;   // (the ram: it rocks back and rises, rotors screaming, then drops at you)
        g.rotation.x = aim * 0.35 - rear * 0.55 + (f.state === 'strike' && id === 'ram' ? 0.6 : 0);
        g.position.y += rear * 0.4;
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
    const legs = pair((s) => { const l = new THREE.Group(); l.position.set(s * 0.42, 0.85, 0); g.add(l); add(l, new THREE.CylinderGeometry(0.22, 0.3, 0.85, 7).translate(0, -0.42, 0), crust); add(l, new THREE.SphereGeometry(0.14, 6, 4), melt, 0, -0.45, 0.2); const foot = new THREE.Object3D(); foot.position.set(0, -0.85, 0.15); l.add(foot); l.userData.foot = foot; return l; });
    const stream = add(g, new THREE.CylinderGeometry(0.1, 0.22, 1, 6).translate(0, -0.5, 0), hot, 0, 1.55, 1.0); stream.visible = false;
    return {
      group: g, parts: [body, head, ...blobs, ...legs], eyeMat: hot, base: '#ffd36a', size: 1, tell: (id) => (id === 'stomp' ? legs[1].userData.foot : lip),
      anim(f, c) {
        const id = f.atk?.id, w = c.wind;
        // stomp: one leg raised high through the wind-up, down hard; pour: it leans and tips its lip at you
        const lift = id === 'stomp' ? (f.state === 'wind' ? w : f.state === 'strike' ? 1 - c.release : 0) : 0;
        legs.forEach((l, k) => { l.rotation.x = (c.moving ? Math.sin(c.t * 5 + k * Math.PI) * 0.3 : 0) - (k === 1 ? lift * 1.6 : 0); l.position.y = 0.85 + (k === 1 ? lift * 0.6 : 0); });
        const lean = id === 'pour' ? (f.state === 'wind' ? w : f.state === 'strike' ? 1 : 0) : 0;
        g.rotation.x = lean * 0.45 - lift * 0.22;   // (it leans back on its other leg, the raised foot high in front)
        g.rotation.z = lift * 0.12;
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
};
