// The talk prompt beside the person (issue #241: "Button prompts to talk to people should be right next to them just
// below shoulder level, not above their heads"). The floating "A talk to Ilen" tag (src/story/index.js placePrompt)
// hangs from a point just below their shoulders and out to the side the camera sees on its right, the tag reading
// outward from it, so it never covers the face nor floats over the head; where the screen's edge is near, the other
// side. Pure (plain { x, y, z } points, the camera's right as a vector), so the tests need no page.
//
//   shoulders(npc, up, tmp)            → { l, r } (the rig's upper arms, just below them) or { mid, half } (no rig)
//   besideAnchor(body, right, side)    → { x, y, z }: the point the tag hangs from, `side` 1 the camera's right, −1 its left
//   tagPlace(x, y, w, h, view, side)   → { left, top, side }: the tag's box on the screen, flipped off an edge
//
// Tests: tests/talk-prompt.test.js.

export const TALK = {
  below: 0.1,     // m (× their scale) under the shoulder joint: "just below shoulder level"
  half: 0.2,      // m (× scale): the least half-width of a body, side to side, when its shoulders line up with the view
  out: 0.08,      // m (× scale) out past the shoulder before the tag starts
  gap: 6,         // px between the anchor and the tag's edge
  margin: 8,      // px kept from the screen's edge
  stand: 1.3,     // m (× scale): a body with no rig, its shoulders' height standing
  seat: 0.95,     //   and seated
};

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Where a person's shoulders are: their rig's upper arms (a humanoid's bones, `npc.humanoid.b`), a little below the
 * joints; without a rig (a crowd person, an alien), the middle of their shoulders by their height (an alien: under its
 * face, as wide as it is). `npc` needs `pos` and `object.scale.y`; `up` the world's up; `tmp` two vectors the bones'
 * getWorldPosition writes into (THREE.Vector3s in the game). Plain objects out.
 */
export function shoulders(npc, up = { x: 0, y: 1, z: 0 }, tmp = [{}, {}]) {
  const s = npc?.object?.scale?.y ?? 1, B = npc?.humanoid?.b, drop = TALK.below * s;
  const down = (p) => ({ x: p.x - up.x * drop, y: p.y - up.y * drop, z: p.z - up.z * drop });
  if (B?.upperarm_l?.getWorldPosition && B?.upperarm_r?.getWorldPosition && npc.object?.visible !== false) {
    const l = B.upperarm_l.getWorldPosition(tmp[0]), r = B.upperarm_r.getWorldPosition(tmp[1]);
    return { l: down(l), r: down(r), half: TALK.half * s };
  }
  if (npc?.faceAt && npc?.S) {   // (an alien: just under its face, its body's width out)
    const f = npc.faceAt();
    const k = 0.3 * s;
    return { mid: { x: f.x - up.x * k, y: f.y - up.y * k, z: f.z - up.z * k }, half: Math.max(TALK.half * s, (npc.S.radius ?? 0.5) * 0.8) };
  }
  const h = (npc?.seat ? TALK.seat : TALK.stand) * s, p = npc?.pos ?? { x: 0, y: 0, z: 0 };
  return { mid: { x: p.x + up.x * h, y: p.y + up.y * h, z: p.z + up.z * h }, half: TALK.half * s };
}

/**
 * The point the tag hangs from: the middle of the shoulders moved along the camera's `right` (a unit vector) by half
 * the body's width as the camera sees it (the shoulders' spread along `right`, at least `half`) and `out` more, on
 * `side` (1: the camera's right, −1: its left).
 */
export function besideAnchor(body, right, side = 1, scale = 1) {
  let c, w = body.half ?? TALK.half * scale;
  if (body.l && body.r) {
    c = { x: (body.l.x + body.r.x) / 2, y: (body.l.y + body.r.y) / 2, z: (body.l.z + body.r.z) / 2 };
    const d = { x: body.l.x - body.r.x, y: body.l.y - body.r.y, z: body.l.z - body.r.z };
    w = Math.max(w, Math.abs(dot(d, right)) / 2);
  } else c = body.mid;
  const k = side * (w + TALK.out * scale);
  return { x: c.x + right.x * k, y: c.y + right.y * k, z: c.z + right.z * k };
}

/**
 * The tag's box on the screen: from the anchor (x, y) in CSS px, reading outward (side 1: its left edge just right of
 * the anchor; −1: its right edge just left of it), its middle on the anchor's height. Off the screen's edge on that
 * side, the other side (`side` says which it took); kept inside the screen top to bottom.
 */
export function tagPlace(x, y, w, h, view = { w: 1280, h: 720 }, side = 1) {
  const { gap, margin } = TALK;
  const at = (s) => (s > 0 ? x + gap : x - gap - w);
  let sd = side, left = at(sd);
  if (left + w > view.w - margin || left < margin) {
    const other = at(-sd);
    if (other >= margin && other + w <= view.w - margin) { sd = -sd; left = other; }
    else left = Math.min(view.w - margin - w, Math.max(margin, left));
  }
  const top = Math.min(view.h - margin - h, Math.max(margin, y - h / 2));
  return { left, top, side: sd };
}
