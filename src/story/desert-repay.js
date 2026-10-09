import * as THREE from 'three';

// Qanat repays the traveller (the desert's main quest, its last stage `ship`: docs/story-bible.md).
//
// The ship came down drained (the singing light passed it: src/ship/cinematics.js), and nothing he carries
// could fill it. He puts Qanat's tree right, its water and its fire, for the city's sake; and because he did,
// the city chooses to help him in return: every house carries what it can spare of the burning water to his
// ship (the camps' share of the Drinking, the well's first water, the lamps of a street, an oven's fire-water,
// Marrow's last cell) and pours it in together. That is what powers the ship, not the tree by itself.
//
//   - The tree catches (`desert.tree.lit`): a little after (LEAVE_AFTER), the ones who bring something (REPAY in
//     desert-data.js) go down to the ship and wait in a half ring on the city side of the ramp, facing it (they are far from the camera,
//     so they are simply there: src/npc.js walks a far follower straight to its spot).
//   - He comes to the ship (within START m of the ramp, or walks into it): one by one they step up to the
//     hull, say what they bring and pour it in (a balloon each, a chime and a splash), and step back; Nour
//     last. Then `desert.ship.fed` (the stage's flag): the quest ends and the ship wakes (desert.js onDone).
//   - Once he has gone (the ship powered and him far off) they go home, out of sight.
//
// The plan is pure (repayPlan: who, when, what); setupRepay drives the people. Nothing is staged that a skip
// could lose: if the beat can't play (nobody to bring anything), the flag is set at once.

/** Seconds from the start of the beat to the first gift, between gifts, and after the last before the ship wakes. */
export const REPAY_TIMING = { first: 2.6, gap: 3.4, step: 2.4, after: 1.8 };
/** Seconds after the tree catches before they set off for the ship (the lighting plays first, and Nour has her word). */
export const LEAVE_AFTER = 25;
/** Within this far of the ramp (m), the beat starts. */
export const START = 18;
/** The half ring they wait in (m from the ramp foot, toward the city), and the ring they pour from. */
export const RING = { wait: 9.5, pour: 4.2 };

/**
 * The beat as a timeline: [{ at, who, say, kind: 'call' | 'gift' | 'fed' }], `gifts` in order (REPAY), `call` the
 * line that opens it (said by the last giver, Nour). Pure.
 */
export function repayPlan(gifts, call = null, { first = REPAY_TIMING.first, gap = REPAY_TIMING.gap, after = REPAY_TIMING.after } = {}) {
  const out = [];
  if (call) out.push({ at: 0, who: gifts.at(-1)?.who ?? null, say: call, kind: 'call' });
  gifts.forEach((g, i) => out.push({ at: first + i * gap, who: g.who, say: g.say, kind: 'gift' }));
  const end = gifts.length ? first + (gifts.length - 1) * gap + gap * 0.6 + after : 0;
  out.push({ at: end, who: null, say: null, kind: 'fed' });
  return out;
}

/** The ship takes its power from Qanat's gift, not from the tree by itself: only once the tree burns and Qanat has brought it. */
export const repayDue = ({ lit, fed }) => !!lit && !fed;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * @param ctx      { game, sound }
 * @param o.people  who may bring something, by id (the desert's people and the villagers by their ids)
 * @param o.gifts   REPAY (desert-data.js); o.call: the opening line
 * @param o.ramp    () => the ramp foot (Vector3); o.hull: () => the hull's centre on the ground (Vector3)
 * @param o.onGround (v) => v on the ground; o.lit, o.fed: () => bool; o.feed: () => sets the stage's flag
 */
export function setupRepay(ctx, { people, gifts, call, ramp, hull, onGround = (v) => v, lit, fed, feed }) {
  const { sound } = ctx;
  const party = gifts.map((g) => ({ ...g, n: people[g.who] })).filter((g) => g.n);
  const st = { placed: false, t: -1, plan: null, i: 0, done: false, home: false, spots: null };
  const say = (n, text, secs = 3.2) => { if (n && text) n.shout = { text, until: (n.time ?? 0) + secs }; };

  /** Where each waits and pours: half rings on the city side of the ramp, facing the hull. */
  const spots = () => {
    const r = ramp(), h = hull();
    const out = V(r.x - h.x, 0, r.z - h.z);
    if (out.lengthSq() < 1e-4) out.set(0, 0, 1);
    out.normalize();
    const side = V(-out.z, 0, out.x), N = party.length;
    const at = (rad, k) => {
      const a = N > 1 ? (k / (N - 1) - 0.5) * 1.9 : 0;
      return onGround(r.clone().addScaledVector(out, Math.cos(a) * rad).addScaledVector(side, Math.sin(a) * rad));
    };
    return party.map((g, k) => ({ wait: at(RING.wait, k), pour: at(RING.pour, k) }));
  };
  const faceHull = (p) => { const h = hull(); return Math.atan2(h.x - p.x, h.z - p.z); };
  const go = (g, to, speed = 1.5) => {
    const n = g.n;
    n.seat = null;
    n.follow = () => ({ pos: to, speed, near: 0.4, max: speed + 0.6, face: faceHull(to) });
  };

  const place = () => {
    st.placed = true;
    st.spots = spots();
    party.forEach((g, k) => {
      g.home = { pos: g.n.route?.[0]?.clone?.() ?? g.n.pos.clone(), seat: g.n.seat ?? null, heading: g.n.heading };
      go(g, st.spots[k].wait, 2.2);
    });
  };

  const start = () => {
    if (!st.placed) place();
    st.t = 0; st.i = 0;
    st.plan = repayPlan(party, call);
    sound?.chime?.();
  };

  const goHome = () => {
    st.home = true;
    for (const g of party) {
      const h = g.home;
      if (!h) continue;
      g.n.follow = () => {
        if (flat(g.n.pos, h.pos) < 0.6) {
          g.n.follow = null; g.n.pos.copy(h.pos); g.n.seat = h.seat; g.n.heading = h.heading;
          return null;
        }
        return { pos: h.pos, speed: 1.6, near: 0.4, max: 2.2 };
      };
    }
  };

  /** Each frame: pp, where he is. */
  const update = (dt, pp) => {
    if (st.done) {
      if (!st.home && flat(pp, ramp()) > 90) goHome();
      return;
    }
    if (!repayDue({ lit: lit(), fed: fed() })) return;
    if (!party.length) { feed(); st.done = true; return; }   // (nobody to bring anything: never stuck)
    // they set off once the tree has caught and the city has seen it (Nour has her word at the well first),
    // or as soon as he heads for the ship
    st.litT = (st.litT ?? 0) + dt;
    if (!st.placed && (st.litT > LEAVE_AFTER || flat(pp, ramp()) < 120)) place();
    if (st.t < 0) {
      if (flat(pp, ramp()) < START) start();
      return;
    }
    st.t += dt;
    while (st.i < st.plan.length && st.t >= st.plan[st.i].at) {
      const b = st.plan[st.i++];
      const k = party.findIndex((g) => g.who === b.who);
      if (b.kind === 'call') say(party[k]?.n, b.say, 3);
      else if (b.kind === 'gift') {
        const g = party[k], s = st.spots[k];
        go(g, s.pour, 1.4);
        say(g.n, b.say, REPAY_TIMING.gap + 0.6);
        sound?.splash?.(0.35);
        sound?.chime?.();
        // and back to the ring, for the next one
        setTimeout(() => { if (!st.home) go(g, s.wait, 1.2); }, REPAY_TIMING.step * 1000 + 600);
      } else if (b.kind === 'fed') {
        st.done = true;
        feed();
      }
    }
  };

  /** Walked into the ship before it played: it plays at the ramp all the same. */
  const enter = () => { if (repayDue({ lit: lit(), fed: fed() }) && st.t < 0) start(); };

  return { update, enter, state: st, party, ramp };
}
