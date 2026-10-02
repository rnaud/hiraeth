import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';

// Small inked interiors. Rooms are real geometry (walls with door and window
// openings, so the sun's shadow map throws light patches through them), with
// a little furniture and a glowing lamp. Rooms that can't fit inside their
// building (the desert's masked head, Edena's crashed ship) are built high
// above the map and reached through a doorway portal.

const Y = new THREE.Vector3(0, 1, 0);

/** Boxes for a wall of length L, height H and thickness T with rectangular holes {x0,x1,y0,y1} (x along the wall). */
function wallWithHoles(L, H, T, holes) {
  const xs = [0, L, ...holes.flatMap((h) => [h.x0, h.x1])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 1e-3) continue;
    const mid = (a + b) / 2;
    const cut = holes.filter((h) => h.x0 <= mid && h.x1 >= mid).sort((p, q) => p.y0 - q.y0);
    let y = 0;
    for (const h of [...cut, { y0: H, y1: H }]) {
      if (h.y0 - y > 1e-3) out.push(new THREE.BoxGeometry(b - a, h.y0 - y, T).translate(mid - L / 2, (y + h.y0) / 2, 0));
      y = Math.max(y, h.y1);
    }
  }
  return out;
}

/**
 * Build a room. Local frame: floor at y = 0, centred on `pos`, door in the +z wall.
 * @returns { inside, doorOut, doorIn, lights }  world-space points
 */
export function buildRoom(scene, {
  pos, rot = 0, w = 9, d = 8, h = 4.5, t = 0.35,
  door = { w: 1.6, h: 2.6, x: 0 }, windows = [], oculus = 0,
  wall = { color: '#f1e6cf' }, floor = '#c9a27a', ceiling = null,
  furniture = [], lamp = '#f2c54b',
}) {
  const grp = new THREE.Group();
  grp.position.copy(pos);
  grp.rotation.y = rot;
  const W = [], F = [], C = [];
  // walls: +z (door), -z, +x, -x; holes in metres along each wall from its left end (seen from inside)
  const holesFor = (side) => windows.filter((v) => v.side === side).map((v) => ({ x0: v.x - v.w / 2, x1: v.x + v.w / 2, y0: v.y, y1: v.y + v.h }));
  const doorHole = { x0: w / 2 + door.x - door.w / 2, x1: w / 2 + door.x + door.w / 2, y0: 0, y1: door.h };
  for (const g of wallWithHoles(w, h, t, [doorHole, ...holesFor('front')])) W.push(g.translate(0, 0, d / 2));
  for (const g of wallWithHoles(w, h, t, holesFor('back'))) W.push(g.rotateY(Math.PI).translate(0, 0, -d / 2));
  for (const g of wallWithHoles(d, h, t, holesFor('right'))) W.push(g.rotateY(-Math.PI / 2).translate(w / 2, 0, 0));
  for (const g of wallWithHoles(d, h, t, holesFor('left'))) W.push(g.rotateY(Math.PI / 2).translate(-w / 2, 0, 0));
  F.push(new THREE.BoxGeometry(w + t, 0.3, d + t + 2.4).translate(0, -0.15, 1.2));   // with a doorstep outside
  // ceiling, optionally with a square oculus letting a shaft of sun in
  if (oculus > 0) {
    const o = oculus / 2;
    C.push(new THREE.BoxGeometry(w + t, 0.3, d / 2 - o + t / 2).translate(0, h + 0.15, (d / 2 + o) / 2 + t / 4));
    C.push(new THREE.BoxGeometry(w + t, 0.3, d / 2 - o + t / 2).translate(0, h + 0.15, -(d / 2 + o) / 2 - t / 4));
    C.push(new THREE.BoxGeometry(w / 2 - o, 0.3, oculus).translate((w / 2 + o) / 2, h + 0.15, 0));
    C.push(new THREE.BoxGeometry(w / 2 - o, 0.3, oculus).translate(-(w / 2 + o) / 2, h + 0.15, 0));
  } else C.push(new THREE.BoxGeometry(w + t, 0.3, d + t).translate(0, h + 0.15, 0));
  const wallMat = wall.mode ? makeMaterial(wall) : makeMaterial({ color: wall.color, color2: wall.color2 ?? wall.color, color3: wall.color3 ?? '#e6cfae', mode: MODE_STRATA, strataSize: 1.2, flat: true, grid: wall.grid ?? 1.0, glyphs: wall.glyphs });
  grp.add(new THREE.Mesh(mergeGeometries(W), wallMat));
  grp.add(new THREE.Mesh(mergeGeometries(F), makeMaterial({ color: floor, grid: 0.8, flat: true })));
  grp.add(new THREE.Mesh(mergeGeometries(C), ceiling ? makeMaterial({ color: ceiling, flat: true }) : wallMat));
  // furniture: [type, x, z, rotY, colour]
  const byColor = new Map();
  const add = (c, g) => { if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push(g); };
  for (const [type, x, z, ry = 0, c = '#8a5a3c', c2 = '#c8483a'] of furniture) {
    const P = (g) => g.rotateY(ry).translate(x, 0, z);
    if (type === 'table') { add(c, P(new THREE.BoxGeometry(1.8, 0.1, 1).translate(0, 0.78, 0))); for (const [a, b] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) add(c, P(new THREE.BoxGeometry(0.08, 0.78, 0.08).translate(a, 0.39, b))); }
    if (type === 'chair') { add(c, P(new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.46, 0))); add(c, P(new THREE.BoxGeometry(0.5, 0.6, 0.06).translate(0, 0.76, -0.22))); for (const [a, b] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) add(c, P(new THREE.BoxGeometry(0.05, 0.46, 0.05).translate(a, 0.23, b))); }
    if (type === 'bed') { add(c, P(new THREE.BoxGeometry(1.2, 0.45, 2.1).translate(0, 0.22, 0))); add(c2, P(new THREE.BoxGeometry(1.15, 0.14, 1.6).translate(0, 0.52, 0.22))); add('#f3ead8', P(new THREE.BoxGeometry(0.8, 0.14, 0.4).translate(0, 0.54, -0.75))); }
    if (type === 'shelf') { add(c, P(new THREE.BoxGeometry(1.6, 2.2, 0.35).translate(0, 1.1, 0))); for (let k = 0; k < 6; k++) add(['#c8483a', '#5fb7ad', '#d8a24a', '#f3ead8'][k % 4], P(new THREE.BoxGeometry(0.18, 0.32, 0.25).translate(-0.55 + k * 0.22, 1.5, 0.08))); }
    if (type === 'rug') add(c2, P(new THREE.BoxGeometry(2.4, 0.02, 1.6).translate(0, 0.01, 0)));
    if (type === 'pot') { add('#c8673f', P(new THREE.CylinderGeometry(0.25, 0.18, 0.45, 10).translate(0, 0.22, 0))); add('#4f6b34', P(new THREE.ConeGeometry(0.3, 1.4, 8).translate(0, 1.1, 0))); }
    if (type === 'bench') add(c, P(new THREE.BoxGeometry(2.6, 0.45, 0.6).translate(0, 0.22, 0)));
    if (type === 'pedestal') { add(c, P(new THREE.CylinderGeometry(0.6, 0.8, 1.1, 10).translate(0, 0.55, 0))); }
    if (type === 'seat') { add(c, P(new THREE.BoxGeometry(0.7, 0.5, 0.7).translate(0, 0.25, 0))); add(c, P(new THREE.BoxGeometry(0.7, 0.9, 0.12).translate(0, 0.9, -0.3))); }
    if (type === 'bunk') { add(c, P(new THREE.BoxGeometry(0.9, 0.1, 2).translate(0, 0.5, 0))); add(c, P(new THREE.BoxGeometry(0.9, 0.1, 2).translate(0, 1.6, 0))); add(c2, P(new THREE.BoxGeometry(0.85, 0.12, 1.9).translate(0, 0.6, 0))); }
    if (type === 'panel') { add(c, P(new THREE.BoxGeometry(2.2, 1, 0.5).rotateX(-0.4).translate(0, 0.9, 0))); }
  }
  for (const [c, geos] of byColor) grp.add(new THREE.Mesh(mergeGeometries(geos), makeMaterial({ color: c, flat: true })));
  // a glowing lamp hanging from the ceiling (or panels that glow)
  const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), makeMaterial({ color: lamp, glow: 1 }));
  lampMesh.position.set(0, h - 0.6, 0);
  lampMesh.userData.noCollide = true;
  grp.add(lampMesh);
  scene.add(grp);
  grp.updateMatrixWorld(true);
  const wp = (x, y, z) => grp.localToWorld(new THREE.Vector3(x, y, z));
  const lp = wp(0, h - 0.6, 0);
  return {
    group: grp,
    inside: wp(door.x, 0.05, d / 2 - 1.6),
    doorIn: wp(door.x, 0, d / 2 - 0.3),
    doorOut: wp(door.x, 0, d / 2 + 1.1),
    lights: [new THREE.Vector4(lp.x, lp.y, lp.z, Math.max(w, d) * 0.9)],
    facingOut: rot,               // heading that walks out of the door
  };
}

/**
 * A free-standing doorway in the world that leads into a room elsewhere.
 * Returns portal entries for the level: [{ at, r, to, heading }].
 */
export function doorwayPortals(scene, { at, heading, room, frame = '#e9dcc0', void: voidC = '#2b211f', w = 2.2, h = 3.4 }) {
  const grp = new THREE.Group();
  grp.position.copy(at);
  grp.rotation.y = heading;
  const m = makeMaterial({ color: frame, color2: '#d8c7a6', color3: '#c9b8a0', mode: MODE_STRATA, strataSize: 0.8, flat: true, grid: 0.6, glyphs: true });
  grp.add(new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(0.6, h, 0.8).translate(-w / 2 - 0.3, h / 2, 0),
    new THREE.BoxGeometry(0.6, h, 0.8).translate(w / 2 + 0.3, h / 2, 0),
    new THREE.BoxGeometry(w + 1.6, 0.6, 1).translate(0, h + 0.3, 0),
  ]), m));
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), makeMaterial({ color: voidC, side: THREE.DoubleSide }));
  veil.userData.noCollide = true;
  grp.add(veil);
  scene.add(grp);
  const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  return [
    // stepping into the doorway from outside: inside the room, facing in
    { at: at.clone().addScaledVector(fwd, -0.2), r: 1.2, to: room.inside, heading: room.facingOut + Math.PI },
    // walking back out of the room's door: in front of the doorway, facing away
    { at: room.doorOut.clone().addScaledVector(Y, 0.5), r: 1.4, to: at.clone().addScaledVector(fwd, 2.6), heading },
  ];
}
