import * as THREE from 'three';
import { registerInteractable, PRIORITY } from '../interact.js';
import { ownMaterial } from './puffs.js';
import { THINGS } from './spheres-data.js';

// The Garden of Spheres' explorations alive (issue #190; the level builds them: src/levels/spheres-explorations.js).
//
//   the lake       once a sphere's sound has been played at the lake (the pearl's bell), the spheres hang in its
//                  reflected sky again round the middle stone (one line the first time); look into the lake from it
//   the craters    bowls that carry sound: down the terraces round the sphere west of the arch its far voices grow
//                  louder the lower you go (heard faintly before it is splashed, fully after); inside the cracked moon
//                  its last sound plays from within (hammers on a shell: one line the first time); its founders' mark
//   the pillars    splash a sphere high on the pillars and its note runs down the walkways to the lower ones, each
//                  ringing as it arrives; from the highest every one rings, one chord across the forest (one line, the
//                  first time; and one line the first time it stops short: notes run down, never up)
//   the belvedere  the first time up on its deck, one line: every furrow points back to the great sphere
//
//   setupSpheresExplorations(ctx, { G, motes }) → { hit(orb, soft), boost(id), update(dt, t), state } (null without them)

export const MOONS_CUE = 'In the lake the spheres hang in the sky again.';
export const MOON_CUE = 'Inside the shell its last sound still rings: hammers, far off, on a shell like this one.';
export const CHORD_CUE = 'Every high sphere answers down the walkways: one chord across the forest.';
export const DOWNHILL_CUE = 'The note runs down the walkways, never up.';
export const FURROWS_CUE = 'From up here every furrow points back to the great sphere.';
/** How fast a note runs along a walkway (m/s), and how often the cracked moon's sound comes round while you are inside (s). */
export const NOTE_SPEED = 24, MOON_EVERY = 7;

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function setupSpheresExplorations(ctx, { G, motes }) {
  const X = G?.explore;
  if (!X?.lake || !X?.cracked || !X?.pillars?.length) return null;
  const { game, toast, sound, player, scene, dialogue } = ctx;
  const flag = (k) => !!game.flag(k);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const look = (id, def, s, prompt, range = 3.4) => registerInteractable({
    id, priority: PRIORITY.use, range, prompt, at: () => s.stand,
    distance: (p) => (Math.abs(p.pos.y - s.stand.y) < 3.5 ? flat(p.pos, s.stand) : Infinity),
    use: () => dialogue.start(def, null, s.stand.clone(), s.look.clone()),
  });
  look('spheres.lake.look', THINGS.lake, X.lake.look, 'look into the lake', 3.6);
  look('spheres.mark.look', THINGS.mark, X.cracked.mark, 'look at the founders’ mark', 3.2);

  const st = { moonsShown: flag('spheres.lake.moons'), moonT: 0, inMoon: false, queue: [], cascade: null, runners: [] };

  // ---------------------------------------------------------------- the pillars' chord
  const P = X.pillars, highs = X.high ?? [];
  const walk = (i, j) => X.walkways.find((w) => (w.from === i && w.to === j) || (w.from === j && w.to === i));
  const glow = (c) => ownMaterial({ color: c, glow: 0, flat: true });
  // a ring of light round each cup, lit as its sphere rings
  const halos = P.map((p) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(p.R * 0.86, 0.12, 4, 48).rotateX(Math.PI / 2), glow('#fff3c4'));
    m.position.set(p.cup.x, p.top + 1.2, p.cup.z); m.visible = false; m.userData.noCollide = true; scene.add(m);
    return { m, k: 0 };
  });
  // the note running along a walkway: a bead of light
  const beadGeo = new THREE.SphereGeometry(0.45, 10, 8);
  const runner = () => { const m = new THREE.Mesh(beadGeo, glow('#fff6dc')); m.visible = false; m.userData.noCollide = true; scene.add(m); return m; };
  const ringHigh = (i, soft = false) => {
    const p = P[i], at = V(p.sphere.x, p.sphere.y + p.R, p.sphere.z);
    sound.orbNote?.(p.deg, at, { size: 0.35, soft });
    motes?.burst(at, { n: 4, rise: 1.6, size: 0.26, spread: 1, life: 2.4 });
    halos[i].k = 1;
  };
  /** A cascade from pillar i: it rings, and its note runs on down every walkway to a lower top. */
  const start = (i, soft) => {
    const c = { rang: new Set([i]), live: 0, from: i };
    st.cascade = c;
    ringHigh(i, soft);
    spread(c, i);
    if (!c.live) finish(c);
  };
  const spread = (c, i) => {
    for (const j of [i - 1, i + 1]) {
      if (j < 0 || j >= P.length || c.rang.has(j) || P[j].top >= P[i].top) continue;
      const w = walk(i, j);
      if (!w) continue;
      c.rang.add(j); c.live++;
      const a = i === w.from ? w.a : w.b, b = i === w.from ? w.b : w.a, len = a.distanceTo(b);
      const bead = st.runners.find((r) => !r.busy) ?? (st.runners.push({ m: runner() }), st.runners.at(-1));
      Object.assign(bead, { busy: true, a: a.clone().add(V(0, 0.6, 0)), b: b.clone().add(V(0, 0.6, 0)), t: 0, dur: len / NOTE_SPEED, c, j });
    }
  };
  const finish = (c) => {
    if (c !== st.cascade) return;
    st.cascade = null;
    if (c.rang.size === P.length) {
      if (!flag('spheres.pillars.chord')) { game.set('spheres.pillars.chord', true); toast(CHORD_CUE); }
    } else if (c.rang.size < P.length && !flag('spheres.pillars.chord') && !flag('spheres.pillars.downhill')) {
      game.set('spheres.pillars.downhill', true); toast(DOWNHILL_CUE);
    }
  };
  /** A splash on a sphere: the pillars' are this module's (true); every other goes on as it was (false). */
  const hit = (o, soft) => {
    const i = highs.indexOf(o);
    if (i < 0) return false;
    start(i, soft);
    return true;
  };

  // ---------------------------------------------------------------- the craters carry sound
  const chant = X.craters?.chant;
  /** How loud a crater carries its sphere's sound where you stand (0..1): the lower down its terraces, the louder. */
  const boost = (id) => {
    if (id !== 'chant' || !chant || !player?.pos) return 0;
    const p = player.pos, r = Math.hypot(p.x - chant.x, p.z - chant.z);
    if (r > chant.rings[3] + 4) return 0;
    const deep = THREE.MathUtils.clamp((chant.y0 + 0.5 - p.y) / (chant.drop * 3), 0, 1);
    return deep * (flag('spheres.heard.chant') ? 1 : 0.45);
  };

  // ---------------------------------------------------------------- per frame
  const C = X.cracked, moonAt = V(C.x, C.floor + 4, C.z);
  const update = (dt) => {
    const pp = player?.pos;
    // the lake's moons
    const moons = flag('spheres.heard.bell');
    X.lake.moons.visible = moons;
    if (moons && !st.moonsShown && pp && flat(pp, X.lake.mid) < 140) { st.moonsShown = true; game.set('spheres.lake.moons', true); toast(MOONS_CUE); }
    // inside the cracked moon: its last sound, coming round while you stay
    const inside = !!pp && C.inside(pp);
    if (inside) {
      if (!st.inMoon || (st.moonT -= dt) <= 0) { sound.remembered?.('foundry', moonAt, { vol: 0.9 }); st.moonT = MOON_EVERY; }
      if (!flag('spheres.moon.heard')) { game.set('spheres.moon.heard', true); toast(MOON_CUE); }
    }
    st.inMoon = inside;
    // the belvedere: the furrows seen
    if (pp && X.belvedere && !flag('spheres.furrows.seen') && flat(pp, X.belvedere) < 6 && Math.abs(pp.y - X.belvedere.y) < 3) { game.set('spheres.furrows.seen', true); toast(FURROWS_CUE); }
    // the notes running down the walkways
    for (const r of st.runners) {
      if (!r.busy) continue;
      r.t += dt / r.dur;
      r.m.visible = r.t < 1;
      r.m.position.lerpVectors(r.a, r.b, Math.min(1, r.t));
      if (r.t >= 1) {
        r.busy = false; r.m.visible = false;
        if (r.c === st.cascade) { ringHigh(r.j, true); spread(r.c, r.j); }
        r.c.live--;
        if (!r.c.live) finish(r.c);
      }
    }
    for (const h of halos) {
      h.k = Math.max(0, h.k - dt * 0.5);
      h.m.visible = h.k > 0.02;
      if (h.m.visible) { h.m.material.uniforms.uGlow.value = h.k; h.m.scale.setScalar(1 + 0.25 * (1 - h.k)); }
    }
  };
  return { hit, boost, update, state: st, ringHigh };
}
