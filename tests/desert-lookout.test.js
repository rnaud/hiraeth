// The desert's walk from the roots to Marrow's hollow (level design audit v1.66, issue #278): 263 m with nobody on it and
// no sight of where it went. Zahir stands on the dune's crest over the hollow, on that way, and sees the red rag's tarp
// from where he stands, as the audit's own rays see it (the collision, then the terrain under the ray); what he says
// points at it, never at somebody else to ask.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

await import('./register-gadgets.js');
const A = await import('./playthrough-agent.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { STORY } = await import('../src/desert-sites.js');

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function blocker(W, a, b, { near = 3 } = {}) {
  const d = a.distanceTo(b), dir = b.clone().sub(a).normalize();
  const hit = W.physics.rayHit(a, dir, d);
  if (hit && hit.distance < d - near) return hit.point;
  const H = (x, z) => W.level.ground.heightAt(x, z);
  for (let s = 6; s < d - near; s += 6) { const p = a.clone().addScaledVector(dir, s); if (p.y < H(p.x, p.z) - 0.3) return p; }
  return null;
}

test('Zahir on the dune over Marrow’s hollow: on the way from the roots to the tarp, the tarp in sight from where he stands (issue #278)', () => {
  globalThis.location = { search: '?level=desert' };
  const W = A.loadWorld('desert');
  try {
    const z = W.npcs.find((n) => n.def?.id === 'zahir');
    assert.ok(z, 'Zahir is in the desert');
    assert.ok(flat(z.pos, V(STORY.lookout.x, 0, STORY.lookout.z)) < 1.5, 'at his lookout');
    const roots = A.objectiveAt(W, 'roots'), tarp = A.objectiveAt(W, 'bikeHollow');
    // on the leg: within 25 m of the straight way from the roots to the tarp, between a quarter and nine tenths along it
    const ab = tarp.clone().sub(roots).setY(0), ap = z.pos.clone().sub(roots).setY(0), t = ap.dot(ab) / ab.lengthSq();
    const off = ap.clone().sub(ab.clone().multiplyScalar(t)).length();
    assert.ok(t > 0.25 && t < 0.9 && off < 25, `on the way (${(t * 100).toFixed(0)} % along it, ${off.toFixed(0)} m off it)`);
    // up on the crest, and the tarp in sight: his eye to a man's height over it
    assert.ok(z.pos.y > tarp.y - 4, `on the crest (${z.pos.y.toFixed(1)} m; the tarp at ${tarp.y.toFixed(1)} m)`);
    const eye = V(z.pos.x, z.pos.y + 1.6, z.pos.z);
    assert.equal(blocker(W, eye, V(tarp.x, tarp.y + 1.5, tarp.z)), null, 'he sees the tarp');
    assert.ok(eye.distanceTo(tarp) < 90, `close enough to point at it (${eye.distanceTo(tarp).toFixed(0)} m)`);
    // he faces it
    const face = Math.atan2(tarp.x - z.pos.x, tarp.z - z.pos.z);
    assert.ok(Math.abs(Math.atan2(Math.sin(z.heading - face), Math.cos(z.heading - face))) < 0.3, 'looking down at it');
  } finally { W.dispose(); }
});

test('what Zahir says points at the hollow, and sends you to nobody (issue #278)', () => {
  const lines = PEOPLE.zahir.talk.listen.map((e) => (typeof e === 'string' ? e : e.say)).flat();
  assert.ok(lines.some((l) => /red rag/.test(l) && /hollow/.test(l)), 'the red rag, the hollow: where the tarp is');
  for (const l of lines) assert.doesNotMatch(l, /\b(ask|talk to|go and see|find)\b/i, `no hand-off: ${l}`);
});

// (issue #561) Zahir stood on the way, but from the roots the leg was still blind: 263 m with neither the hollow nor anything
// by it in sight (the level design audit's ray, the collision then the terrain under it). The red rag now flies from a tall
// mast on the hollow's north-west lip, and from the roots it stands in the arch of Qanat's main gate.
test('the red rag’s mast: by the hollow, in sight from the drinking roots through the city’s gate, a landmark the audit reads (issue #561)', async () => {
  globalThis.location = { search: '?level=desert' };
  const W = A.loadWorld('desert');
  try {
    const beacons = typeof W.level.beacons === 'function' ? W.level.beacons() : W.level.beacons;
    const mast = beacons.find((b) => b.name === 'the red rag’s mast');
    assert.ok(mast, 'the audit reads the mast as a beacon');
    const roots = A.objectiveAt(W, 'roots'), tarp = A.objectiveAt(W, 'bikeHollow'), top = V(...mast.top);
    // by the goal (the audit's 80 m), and tall over the sand
    assert.ok(flat(top, tarp) < 80 * 0.6, `by the tarp (${flat(top, tarp).toFixed(0)} m)`);
    assert.ok(top.y - W.level.ground.heightAt(top.x, top.z) >= STORY.rag.h - 0.1, 'as tall as it says');
    // the audit's aim, a fifth of its height down from its top, from the roots' eye; and so is the rag's head itself
    const eye = V(roots.x, roots.y + 1.7, roots.z);
    assert.equal(blocker(W, eye, V(top.x, top.y - 0.2 * mast.height, top.z)), null, 'the mast in sight from the roots');
    assert.equal(blocker(W, eye, V(top.x, top.y - 2, top.z)), null, 'and its rag');
    // with a margin: the same seen from a step either side of the roots
    for (const s of [-2, 2]) assert.equal(blocker(W, V(eye.x + s, eye.y, eye.z), V(top.x, top.y - 0.2 * mast.height, top.z)), null, `from ${s} m beside the roots`);
    // the rag is the hollow's own: the story's rag flies at the mast's head
    const hollow = W.story?.hollow ?? null;
    if (hollow?.rag) assert.ok(flat(hollow.rag.mesh.position, top) < 1.5, 'the red rag at its head');
    // (issue #567) and it reads from there, not a speck among the camps' banners: at 1280 x 720 and the camera's 60°, the
    // rag stands at least 22 px tall and 10 px wide (2.2 x 7 m on a 20 m mast before: 5 x 17 px), its middle in sight too
    const px = 720 / (2 * Math.tan(THREE.MathUtils.degToRad(30))), d = eye.distanceTo(top);
    const R = STORY.rag;
    assert.ok((R.fh / d) * px >= 22 && (R.w / d) * px >= 10, `the rag ${((R.w / d) * px).toFixed(0)} x ${((R.fh / d) * px).toFixed(0)} px from the roots`);
    assert.equal(blocker(W, eye, V(top.x, top.y - 1.4 - R.fh / 2, top.z)), null, 'the rag’s middle in sight');
  } finally { W.dispose(); }
});

test('the level design audit sees the main route into the rival hollow guided by a landmark by it (issue #561)', async () => {
  const {measureWorlds} = await import('../scripts/level-design/measure.mjs');
  const {report:rep}=await measureWorlds({worlds:['desert']});
  const leg = rep.worlds[0].metrics.guidance.legs.find((l) => l.to === 'The race in the red-rag hollow');
  assert.ok(leg && ['Nour, the eldest', 'The roots, drinking'].includes(leg.from), 'the incoming leg starts at the actual main-route sending point');
  assert.ok(leg && leg.seen && leg.how !== 'blind', `the leg is guided (${leg?.how})`);
});
