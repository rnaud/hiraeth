import * as THREE from 'three';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { HEARTH } from '../desert-hearth.js';
import { THINGS, ITEMS } from './desert-data.js';

// The spark-stone's errand in the Givers' Hearth (src/desert-hearth.js builds the
// place; src/story/desert.js sets this up and lights the tree with the stone).
//
// The hall is dark. The stone breathes light behind a stone grille in a hollow
// up on the back wall's shelf; each breath washes the hall and lights old marks
// in the floor that lead round to a plinth. On the plinth a stone ball sits in a
// groove, a chain running from the hole at the groove's end up the wall and over
// to the grille. Hands can't move it (E: a look); a shove of fluid (push: the
// tank was filled at the giant's pool) rolls it down the groove and into the
// hole: the chain runs and the grille grinds up into the rock. Climb the shelf
// (the wall's face is plain rock) and take the stone: it goes into your pack
// (the gear page lists it: the quest items you carry), glowing faintly through
// it in the dark of the hall, and comes out again in your hand at Qanat's well.
//
// Flags: desert.hearth.seen (you reached it), desert.hearth.open (the ball has
// dropped: the grille is up), desert.stone.taken (+ the item 'stone' while you
// carry it). A save restores each: the ball gone, the grille up, the stone with
// you (or, once the tree burns, nowhere).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ROLL = 1.3, DROP = 0.45, LIFT = 2.4;   // s: the ball rolls, drops, the grille rises

/** ctx: the desert story's context; hasPush: () => the tank can push (full); lit: () => the tree burns. */
export function setupHearth(ctx, { hasPush = () => true, lit = () => false } = {}) {
  const { level, player, quests, dialogue, game, sound, toast } = ctx;
  const H = level.hearth;
  if (!H) return null;
  const opened = () => !!game.flag('desert.hearth.open');
  const taken = () => !!game.flag('desert.stone.taken');
  const carrying = () => quests.has('stone');
  const st = { roll: opened() ? Infinity : -1, wobble: 0, hintT: -1e9, t: 0, pulse: 0 };
  const inside = () => player.pos.distanceTo(H.origin) < 200;
  const hint = (text, gap = 6) => { if (st.t - st.hintT > gap) { st.hintT = st.t; toast(text); } };

  // ---------------------------------------------------------------- the ball: a shove rolls it
  if (opened()) H.ball.userData.gone = true;
  const roll = () => {
    if (opened() || st.roll >= 0) return;
    st.roll = 0;
    sound.whoosh?.();
  };
  // the frieze on the porch, beside the door (src/desert-hearth.js)
  if (H.carving) registerInteractable({ id: 'hearth.carving', priority: PRIORITY.use, range: 3.2, at: () => H.carvingFoot, prompt: 'look at the carved frieze',
    distance: (p) => (Math.abs(p.pos.y - H.carvingFoot.y) < 3 ? flat(p.pos, H.carvingFoot) : Infinity),
    use: () => dialogue.start(THINGS.carving, null, H.carvingFoot.clone(), H.carving.clone()) });
  registerTarget({ kind: 'weight', radius: 0.95, position: () => H.ball.position, enabled: () => !opened() && st.roll < 0 && inside(),
    onHit: (mode) => {
      if (mode === 'push') { roll(); return true; }
      st.wobble = 1;
      hint('The ball rocks in its groove, and settles. It wants a shove: push (C, middle click, or RB / R1).');
      return true;
    } });
  registerInteractable({ id: 'hearth.weight', priority: PRIORITY.use, range: 3, at: () => H.ball.position, enabled: () => !opened() && st.roll < 0,
    prompt: 'look at the stone ball',
    distance: (p) => (inside() && Math.abs(p.pos.y - H.ball.position.y) < 3 ? flat(p.pos, H.ball.position) : Infinity),
    use: () => {
      dialogue.start(THINGS.weight, null, H.ball.position.clone());
      if (!hasPush()) setTimeout(() => hint('Your tank is empty: fill it where the water is (the giant’s pool, past Qanat’s back gate).', 0), 600);
    } });
  registerInteractable({ id: 'hearth.grille', priority: PRIORITY.use, range: 3, at: () => H.stone.position, enabled: () => !opened() && st.roll < 0,
    prompt: 'look at the grille', distance: (p) => (inside() && Math.abs(p.pos.y - H.stone.position.y) < 2.5 ? flat(p.pos, H.stone.position) : Infinity),
    use: () => dialogue.start(THINGS.grille, null, H.stone.position.clone()) });

  // ---------------------------------------------------------------- the stone: take it
  const take = () => {
    if (taken()) return;
    quests.give('stone');
    game.set('desert.stone.taken', true);
    sound.chime?.();
    toast(`You lift ${ITEMS.stone} out of its cup, warm and breathing light, and stow it in your pack. Bring it to Qanat’s well.`);
  };
  registerInteractable({ id: 'hearth.stone', priority: PRIORITY.use, range: 2.9, at: () => H.stone.position, enabled: () => opened() && !taken() && st.roll === Infinity,
    prompt: 'take the spark-stone',
    distance: (p) => (inside() && Math.abs(p.pos.y - (H.stone.position.y - 0.4)) < 1.4 ? flat(p.pos, H.stone.position) : Infinity),
    use: take });

  quests.locate('hearth', () => H.door);
  quests.locate('sparkStone', () => (taken() ? player.pos : H.stoneRest));

  // ---------------------------------------------------------------- per frame
  const _r = V(0, 0, 0), _f = V(0, 0, 0);
  const update = (dt, t) => {
    st.t += dt;
    const pp = player.pos;
    if (!game.flag('desert.hearth.seen') && (flat(pp, H.door) < 45 || inside())) game.set('desert.hearth.seen', true);
    // the ball rolls along the groove, drops into the hole; the chain runs and the grille rises
    if (st.roll >= 0 && st.roll !== Infinity) {
      st.roll += dt;
      const k = Math.min(st.roll / ROLL, 1), e = k * k;
      H.ball.position.lerpVectors(H.ballRest, H.ballEnd, e);
      H.ball.rotation.x = -e * (H.ballRest.distanceTo(H.ballEnd) / HEARTH.ball.r);
      if (st.roll > ROLL) {
        const d = Math.min((st.roll - ROLL) / DROP, 1);
        H.ball.position.y = H.ballEnd.y - d * d * HEARTH.ball.drop;
        H.ball.scale.setScalar(1 - d * 0.3);
        if (d >= 1 && !H.ball.userData.gone) {
          H.ball.userData.gone = true;
          game.set('desert.hearth.open', true);
          sound.chime?.();
          toast('The ball drops into the hole. Somewhere a chain runs, and the grille in front of the glow grinds up into the rock.');
        }
      }
      const g = THREE.MathUtils.clamp((st.roll - ROLL - DROP) / LIFT, 0, 1);
      H.grille.position.copy(H.grilleRest).setY(H.grilleRest.y + THREE.MathUtils.smoothstep(g, 0, 1) * HEARTH.grille.rise);
      if (g >= 1) st.roll = Infinity;
    } else if (st.roll === Infinity) {
      H.grille.position.copy(H.grilleRest).setY(H.grilleRest.y + HEARTH.grille.rise);
    } else if (st.wobble > 0) {
      st.wobble = Math.max(0, st.wobble - dt * 2);
      H.ball.rotation.x = Math.sin(st.wobble * 18) * 0.08 * st.wobble;
    }
    // the stone breathes: its light, the floor marks, the slit in the chimney (only while it sits in its hollow)
    const home = !taken();
    st.pulse = 0.5 + 0.5 * Math.sin((t / HEARTH.pulse) * Math.PI * 2);
    const b = st.pulse * st.pulse;
    const M = H.materials;
    if (M.marks.uniforms?.uGlow) M.marks.uniforms.uGlow.value = home ? 0.12 + 0.88 * b : 0.08;
    if (M.slit.uniforms?.uGlow) M.slit.uniforms.uGlow.value = home ? 0.35 + 0.65 * b : 0.05;
    H.slitLight.w = home ? 12 + 26 * b : 0;
    H.plinthLight.w = home && !opened() ? 1.5 + 6.5 * b : 2;
    if (home) {
      H.stone.visible = H.group.visible !== false;   // (only drawn while the hall is: src/desert-hearth.js)
      H.stone.position.copy(H.stoneRest);
      H.stoneLight.set(H.stoneRest.x, H.stoneRest.y + 0.6, H.stoneRest.z + 1.2, (opened() ? 10 : 5) + (opened() ? 8 : 15) * b);
      H.stone.scale.setScalar(0.92 + 0.12 * b);
    } else if (carrying() && !lit() && inside()) {
      // in your pack: nothing floats about you; in the dark of the hall it glows through the cloth a little,
      // enough to find the way out (out under the sky it is only in your gear)
      H.stone.visible = false;
      const f = player.frame?.dir ? player.frame.dir(player.heading, _f) : _f.set(Math.sin(player.heading), 0, Math.cos(player.heading));
      _r.copy(pp).addScaledVector(f, -0.3);
      H.stoneLight.set(_r.x, _r.y + 1.3, _r.z, 7 + 2 * b);
    } else if (H.stone.userData.placing) {
      // (out of your pack and on its way into the well: src/story/desert.js updateLighting moves it)
    } else {
      H.stone.visible = false;
      H.stoneLight.w = 0;
    }
  };
  return { update, state: st, roll, take, opened, taken, carrying };
}
