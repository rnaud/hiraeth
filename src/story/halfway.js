import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { textGeometry } from './sign-text.js';
import { PEOPLE, THINGS } from './incal-data.js';

// The halfway stall (the City-Shaft's middle levels, by the cab stop: docs/systems/story.md,
// "The halfway stall"). Most players pass the middle levels in a cab or on the jets; this is the
// small place there to stop at.
//
//   Perrine's tea stall   a counter under a flat awning, a kettle, a bench, a board: HALFWAY TEA
//   the halfway mirror    a round mirror on a pole beside it, in a frame that turns on eight notches.
//                         Her mother set it to catch the Lodestar and throw a coin of its light down
//                         to the bottom terraces; the smog greased it, and someone at the top had it
//                         turned to a billboard. Wash it (shoot), then push the frame from the side,
//                         a notch at a time, until it faces up the shaft (notch 0). Once the Lodestar
//                         burns too, the glass glows with it, and Ossa at the bottom sees the coin.
//   a relic               on the awning's flat roof (the Smog lantern: levels/content.js)
//
// Flags: incal.mirror.washed, incal.mirror.notch (0..7), incal.mirror.turned, incal.mirror.done;
// quest incal.mirror (incal-data.js). Pure helpers (halfwayFrame) are used by the tests.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const TAU = Math.PI * 2;
/** Where it stands: along the middle terrace from the cab stop (rad), out from the terrace's inner edge (m). */
export const HALFWAY = { da: -0.048, r: 7.8 };   // (the stretch of the promenade the houses leave clearest, ~10 m from the stop)
/** The mirror's notch at the start: turned to a billboard, three notches round from facing up the shaft. */
export const MIRROR_START = 3;
const NOTCH = TAU / 8;
/** The awning's flat roof, over the stall's floor (m): the relic sits 1.1 m over its middle. */
export const AWNING_TOP = 2.62;

/**
 * The stall's frame on the middle terrace: origin on the terrace at the stall, +x along the
 * terrace, +z toward the void (and the shaft's middle). Pure: the tests and content.js's relic use it.
 * @param terrace the middle level's terrace ({ y, r0, a0, a1 }), ground (x, z) => y
 */
export function halfwayFrame(terrace, ground = () => terrace.y) {
  const a = (terrace.a0 + terrace.a1) / 2 + HALFWAY.da, r = terrace.r0 + HALFWAY.r;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const g = new THREE.Group();
  g.position.set(x, ground(x, z), z);
  g.rotation.y = -a - Math.PI / 2;   // local +x along the terrace, local +z inward
  g.updateMatrixWorld(true);
  return g;
}

export function setupHalfway(ctx, { terrace, ground, onGround }) {
  const { player, quests, game, sound, scene, toast, spawn, physics, dialogue } = ctx;
  if (!terrace) return null;
  const frame = halfwayFrame(terrace, ground);
  scene.add(frame);
  const W = (x, y, z) => frame.localToWorld(V(x, y, z));
  const wood = makeMaterial({ color: '#8a5a3c', flat: true });
  const cloth = makeMaterial({ color: '#c8483a', flat: true, side: THREE.DoubleSide });
  const cream = makeMaterial({ color: '#f3ead8', flat: true });
  const ink = makeMaterial({ color: '#34405e', flat: true });
  const brass = makeMaterial({ color: '#d8a24a', flat: true, metal: 'brass' });
  const grime = makeMaterial({ color: '#4f5a52', flat: true });
  const glass = makeMaterial({ color: '#cfe6ec', flat: true, glow: 0.12, refl: 0.6 });
  const shining = makeMaterial({ color: '#fff3c8', flat: true, glow: 0.9 });
  const solid = new THREE.Group();   // (what you stand on and bump into: one collider)
  frame.add(solid);
  const noIdx = (g) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); return g; };
  // the stall: a counter, four posts, a flat awning over it (its roof holds the relic), a bench, the board
  const woodGeo = [
    new THREE.BoxGeometry(2.6, 1.0, 0.9).translate(0, 0.5, 0),
    ...[[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]].map(([x, z]) => new THREE.BoxGeometry(0.12, 2.5, 0.12).translate(x, 1.25, z)),
    new THREE.BoxGeometry(1.8, 0.12, 0.5).translate(-2.7, 0.46, 0.4),   // the bench
    ...[-0.75, 0.75].map((x) => new THREE.BoxGeometry(0.12, 0.42, 0.42).translate(-2.7 + x, 0.21, 0.4)),
    new THREE.BoxGeometry(1.7, 0.5, 0.04).translate(0, 0.66, 0.47),   // the board on the counter's front
    new THREE.CylinderGeometry(0.07, 0.09, 3.1, 8).translate(2.25, 1.55, 0.75),   // the mirror's pole (poleAt)
  ];
  solid.add(new THREE.Mesh(mergeGeometries(woodGeo.map(noIdx)), wood));
  solid.add(new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 1.7).translate(0, AWNING_TOP - 0.06, 0.05), cloth));
  const board = new THREE.Mesh(textGeometry('HALFWAY TEA', { width: 1.45, depth: 0.02 }).translate(0, 0.66, 0.5), ink);
  board.userData.noCollide = true;
  frame.add(board);
  // the kettle and three cups on the counter
  const kettle = new THREE.Mesh(mergeGeometries([
    new THREE.SphereGeometry(0.16, 10, 6).scale(1, 0.85, 1).translate(0.55, 1.14, 0), new THREE.CylinderGeometry(0.02, 0.035, 0.22, 6).rotateZ(-1.0).translate(0.73, 1.2, 0),
  ].map(noIdx)), brass);
  const cups = new THREE.Mesh(mergeGeometries([-0.6, -0.3, 0].map((x) => noIdx(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 8).translate(x, 1.045, 0.2)))), cream);
  for (const m of [kettle, cups]) { m.userData.noCollide = true; frame.add(m); }
  // the mirror: a pole, and the head that turns on it (a yoke, the frame, the glass, tilted up the shaft)
  const poleAt = V(2.25, 0, 0.75);
  const head = new THREE.Group();
  head.position.set(poleAt.x, 3.1, poleAt.z);
  frame.add(head);
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.6;   // (it looks up as well as in)
  tilt.position.set(0, 0.55, 0);
  head.add(tilt);
  // (the frame, its stem down to the yoke, and a brass back so the glass reads from behind too)
  const rim = new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(0.62, 0.05, 6, 24), new THREE.BoxGeometry(0.08, 0.6, 0.08).translate(0, -0.85, 0).rotateX(0.6),
    new THREE.CircleGeometry(0.6, 24).rotateY(Math.PI).translate(0, 0, -0.02)].map(noIdx)), brass);
  rim.userData.noCollide = true;
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24).translate(0, 0, 0.01), grime);
  face.userData.noCollide = true;
  tilt.add(rim, face);
  frame.updateMatrixWorld(true);
  physics?.addCollider?.(solid);

  const notch = () => ((((game.flag('incal.mirror.notch') ?? MIRROR_START) % 8) + 8) % 8);
  const washed = () => !!game.flag('incal.mirror.washed');
  const up = () => notch() === 0;
  head.rotation.y = notch() * NOTCH;
  const glassAt = () => face.getWorldPosition(V(0, 0, 0));
  /** Which way the glass faces, level (world). */
  const facing = () => { const d = V(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())); d.y = 0; return d.normalize(); };
  const lookAt = W(poleAt.x, 2.2, poleAt.z);

  // Perrine, behind her counter, looking out over it
  const perrine = spawn(PEOPLE.perrine, { route: [onGround(W(-0.3, 0, -1.0)), onGround(W(0.5, 0, -1.0))], heading: frame.rotation.y, speed: 0.3 });
  quests.locate('perrine', () => perrine?.pos ?? W(0, 0, -1));
  quests.locate('mirror', () => lookAt);

  registerInteractable({ id: 'incal.mirror', priority: PRIORITY.use, range: 2.8, prompt: 'look at the halfway mirror', at: () => lookAt,
    distance: (p) => (Math.abs(p.pos.y - frame.position.y) < 3 ? flat(p.pos, lookAt) : Infinity),
    use: () => dialogue.start(THINGS.mirror, null, lookAt) });

  const st = { turnT: 0, from: head.rotation.y, splashed: false, jam: false, shown: true };
  const show = () => { face.material = !washed() ? grime : up() && game.flag('incal.lit') ? shining : glass; };
  show();
  const turn = (by) => {
    game.set('incal.mirror.notch', (((notch() + by) % 8) + 8) % 8);
    st.turnT = 0.45;
    sound?.critter?.('clack', 0.7);
    if (up()) {
      game.set('incal.mirror.turned', true);
      toast(washed() ? 'The frame clicks into its notch. The mirror looks up the shaft, at the Lodestar.' : 'The frame clicks into its notch, facing up the shaft. The glass is still greased with smog.');
    } else if (!st.turned) { st.turned = true; toast('The frame grinds round one notch on its ring. Not facing up the shaft yet.'); }
    show();
  };
  registerTarget({ kind: 'mirror', radius: 0.8, position: glassAt, enabled: () => flat(player.pos, frame.position) < 40,
    onHit: (mode, point, dir) => {
      if (mode === 'push') {
        // pushed side-on it turns a notch (the way it was shoved); straight at the glass it only rocks
        const r = facing(), d = V(dir?.x ?? 0, 0, dir?.z ?? 0).normalize();
        const side = r.x * d.z - r.z * d.x;
        if (Math.abs(side) < 0.3) { if (!st.jam) { st.jam = true; toast('The mirror rocks on its pole. Shoved straight at the glass it won’t turn: push the frame from the side.'); } return true; }
        turn(side > 0 ? -1 : 1);
        return true;
      }
      if (!washed()) {
        game.set('incal.mirror.washed', true);
        show();
        sound?.chime?.();
        toast(up() ? 'The smog runs off the glass. Clean, and already facing up the shaft.' : 'The smog runs off in grey streaks. Clean glass, showing a billboard: it faces the wrong way.');
      } else if (!st.splashed) { st.splashed = true; toast('Clean already. It wants turning now: push the frame from the side.'); }
      return true;
    } });
  game.on('flag:incal.lit', () => show());

  function update(dt, t, pp) {
    // far above or below, the little place is not drawn (its colliders stay)
    const near = Math.abs(pp.y - frame.position.y) < 160 && flat(pp, frame.position) < 320;
    if (near !== st.shown) { st.shown = near; frame.visible = near; }
    if (!near) return;
    const want = notch() * NOTCH, d = Math.atan2(Math.sin(want - head.rotation.y), Math.cos(want - head.rotation.y));
    head.rotation.y += d * Math.min(1, dt * 6);
    if (st.turnT > 0) { st.turnT = Math.max(0, st.turnT - dt); head.position.y = 3.1 + Math.sin(st.turnT * 40) * 0.01; }
    if (face.material === shining) shining.uniforms && (shining.uniforms.uGlow.value = 0.8 + 0.15 * Math.sin(t * 1.7));
  }

  return { frame, head, face, perrine, update, notch, turn, glassAt, facing, poleAt: W(poleAt.x, 0, poleAt.z), awning: W(0, AWNING_TOP, 0.05), shown: () => frame.visible };
}
