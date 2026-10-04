import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { Terrain, jitter, soften } from '../world.js';
import { textGeometry } from '../story/sign-text.js';
import { colourScript } from '../timeofday.js';
import { WILDLIFE } from '../wildlife/species.js';
import { RoomKit } from './lab-kit.js';
import { ROOMS } from './lab-rooms.js';

// ---------------------------------------------------------------------------
// The Lab: a developer's world for looking at the game's surfaces, faces and
// worlds, away from any story (?level=lab, or the worlds list, L). The hub is
// a pale grey floor under a plain sky with two galleries and a row of doors:
//
//   the materials row  pedestals along -z, each with a sphere, a cube and a knot
//                      in one surface (LAB_MATERIALS), its name cut in the plinth;
//                      a water pool and a cloud at the end of the row
//   the faces row      giant villagers (4x) in a ring along +z, standing still,
//                      so the faces' ink can be studied close up (content.js)
//   the doors          an arc of little doorways behind the faces, one per world,
//                      its name over the lintel (LAB_DOORS)
//
// Each door leads to a biome room (src/levels/lab-rooms.js): a compact sample
// of that world, its ground, sky, light and ink, its rocks, buildings, plants,
// creatures and people. The rooms lie far apart on a ring round the hub
// (ROOM_RING), so only the one you are in is drawn: the others' groups are
// hidden, their plants and creatures are past their drawing distance, their
// people past theirs. Walking into a door is a quick fade and you come out at
// your own pace; inside a room the sky, haze, planets, hour and ink style
// switch to its world's (atmo and zoneAt), and a door behind you leads home.
//
// Add a surface to LAB_MATERIALS to see it beside the others in every light
// (the time of day still runs: the sun and the shadows move over the row).
// ---------------------------------------------------------------------------

const FLOOR = '#d9d6cf';

/** The surfaces on show: a name and makeMaterial options. */
export const LAB_MATERIALS = [
  { name: 'flat', o: { color: '#e6875f', flat: true } },
  { name: 'smooth', o: { color: '#e6875f' } },
  { name: 'rock strata', o: { color: '#c98f64', color2: '#b0714e', color3: '#8f5a3e', mode: MODE_STRATA, strataSize: 0.8 } },
  { name: 'cracked', o: { color: '#25386c', flat: true, pattern: 'cracks' } },
  { name: 'facade', o: { color: '#f3ead8', color2: '#d8cfbd', flat: true, pattern: 'facade' } },
  { name: 'tiles', o: { color: '#c8673f', flat: true, pattern: 'tiles' } },
  { name: 'leaves', o: { color: '#5e7a3a', flat: true, pattern: 'leaves' } },
  { name: 'brush', o: { color: '#8a6fb8', scrub: true } },
  { name: 'grid', o: { color: '#f4f0e6', grid: 1 } },
  { name: 'glyphs', o: { color: '#9fbfdc', flat: true, glyphs: true } },
  { name: 'glow', o: { color: '#70e7df', flat: true, glow: 1 } },
  { name: 'metal', o: { color: '#9aa6b2', color2: '#5d6b78', flat: true } },
  { name: 'dissolve', o: { color: '#25386c', flat: true, dissolve: '#fff4d6' } },
];

const SPACING = 9;

/** Where the giant faces stand: a gentle arc behind the spawn. */
export const LAB_FACES = [-27, -9, 9, 27].map((x) => [x, 26 + Math.abs(x) * 0.12]);

// ---------------------------------------------------------------------------- the rooms' layout
/** The biome rooms lie on a ring this far from the hub (m): ~1.5 km apart, well past what is drawn. */
export const ROOM_RING = 2600;
/** A room's centre in the world. */
export const roomCentre = (i) => {
  const a = (i / ROOMS.length) * Math.PI * 2;
  return new THREE.Vector3(Math.sin(a) * ROOM_RING, 0, Math.cos(a) * ROOM_RING);
};
const ROOM_SIZE = 420, ROOM_REACH = 160;   // the room's ground (m), and how far from its centre you may stray
const arriveOf = (room) => room.arrive ?? [0, 74];
/** You come out of a door this far in front of it, so the camera behind you clears its frame. */
const DOOR_BACK = 11;
/** The doors of the hub: an arc behind the faces, one per world (centre of the threshold, and the way it faces). */
export const LAB_DOORS = ROOMS.map((room, i) => {
  const a = THREE.MathUtils.degToRad(-95 + (190 * i) / (ROOMS.length - 1)), R = 64;
  return { id: room.id, title: room.title, x: Math.sin(a) * R, z: Math.cos(a) * R, heading: a + Math.PI };   // its front faces the hub's centre
});
const hubHeight = (x, z) => Math.max(0, Math.hypot(x, z) - 160) * 0.08;   // a shallow bowl beyond the galleries
/** A room's people, in the world (content.js puts them in the Lab, dressed for their world). */
export const LAB_PEOPLE = ROOMS.flatMap((room, i) => {
  const c = roomCentre(i);
  return room.people.map((p) => ({
    at: [c.x + p.at[0], c.z + p.at[1]], y: c.y + (p.y ?? room.ground?.height(p.at[0], p.at[1]) ?? room.floor ?? 0), world: room.id,
    radius: p.radius ?? 3, palette: p.palette ?? {}, head: p.head, lines: p.lines,
  }));
});

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const PASS = { in: 0.18, out: 0.45 };   // s: the fade into a door, and out of it
const HUB_ZONE = { name: 'The Lab', preset: 'Viridel', hour: 11 };
const HUB_ATMO = { tint: [1, 1, 1], fog: 0.35, name: 'The Lab' };

export function createLab(scene) {
  const hub = new THREE.Group();
  hub.name = 'Lab hub';
  scene.add(hub);
  const terrain = new Terrain({
    size: 1200, seg: 60, height: hubHeight,
    material: { color: FLOOR, color2: '#cfccc4', color3: '#c4c0b6', mode: MODE_TERRAIN },
  });
  hub.add(terrain.mesh);
  const ink = makeMaterial({ color: '#2b211f', flat: true });
  const stone = makeMaterial({ color: '#efece6', flat: true });
  const movers = [];
  const lights = [], noShadow = [];

  // ---- the materials row: a pedestal, a sphere, a cube and a knot each, the name on the plinth
  const shapes = [
    new THREE.SphereGeometry(1, 32, 20).translate(0, 1, 0),
    new THREE.BoxGeometry(1.5, 1.5, 1.5).translate(0, 0.75, 0),
    new THREE.TorusKnotGeometry(0.62, 0.22, 96, 12).translate(0, 1.1, 0),
  ];
  const dissolving = [];
  LAB_MATERIALS.forEach((m, i) => {
    const x = (i - (LAB_MATERIALS.length - 1) / 2) * SPACING, z = -24;
    const mat = makeMaterial({ ...m.o, key: `lab.${m.name}` });
    if (mat.uniforms.uDissolve) dissolving.push(mat);
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 3.2).translate(0, 0.3, 0), stone);
    base.position.set(x, 0, z);
    hub.add(base);
    shapes.forEach((g, k) => {
      const s = new THREE.Mesh(g, mat);
      s.position.set(x + (k - 1) * 2.4, 0.6, z);
      hub.add(s);
      if (k === 2) movers.push((t) => { s.rotation.y = t * 0.3 + i; });
    });
    const label = new THREE.Mesh(textGeometry(m.name, { width: Math.min(6.4, m.name.length * 0.62), depth: 0.03 }), ink);
    label.position.set(x, 0.3, z + 1.62);
    hub.add(label);
  });
  // the dissolve sample comes apart and back, over and over
  movers.push((t) => { for (const m of dissolving) m.uniforms.uDissolve.value.set(0.5 + 0.5 * Math.sin(t * 0.7), 0.09, 0.6, 2.6); });

  // ---- water: a pool at the end of the row
  {
    const endX = ((LAB_MATERIALS.length + 1) / 2) * SPACING + 4;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.6, 0.5, 40).translate(0, 0.25, 0), stone);
    rim.position.set(endX, 0, -24);
    const water = new THREE.Mesh(new THREE.CircleGeometry(6, 40).rotateX(-Math.PI / 2), makeMaterial({ color: '#4c8fb0', color2: '#8fc7d9', mode: MODE_WATER, key: 'lab.water' }));
    water.position.set(endX, 0.42, -24);
    water.userData.noCollide = true;
    hub.add(rim, water);
    const label = new THREE.Mesh(textGeometry('water', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(endX, 0.3, -24 + 6.7);
    hub.add(label);
  }
  // ---- a cloud: lobes in flat white, floating over the start of the row
  {
    const lobes = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.39996, r = 1.2 + (k % 3) * 1.1;
      lobes.push(new THREE.IcosahedronGeometry(1.6 + (k % 2) * 0.9, 1).translate(Math.cos(a) * r * 1.6, (k % 3) * 0.5, Math.sin(a) * r * 0.7).toNonIndexed());
    }
    const g = soften(jitter(mergeGeometries(lobes), 0.12, 1.3, 4), 0.06);
    g.computeVertexNormals();
    const cloud = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', color2: '#e3e8ee', key: 'lab.cloud' }));
    const startX = -((LAB_MATERIALS.length + 1) / 2) * SPACING - 4;
    cloud.position.set(startX, 7, -24);
    cloud.userData.noCollide = true;
    hub.add(cloud);
    movers.push((t) => { cloud.position.y = 7 + Math.sin(t * 0.4) * 0.4; });
    const label = new THREE.Mesh(textGeometry('cloud', { width: 3.2, depth: 0.03 }), ink);
    label.position.set(startX, 0.05, -21);
    label.rotation.x = -Math.PI / 2;
    hub.add(label);
  }
  // ---- the faces row: plinths where the giant villagers stand (content.js puts them on them)
  for (const [x, z] of LAB_FACES) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.4, 24).translate(0, 0.2, 0), stone);
    p.position.set(x, 0, z);
    hub.add(p);
  }

  // ---- doorways: posts, a lintel and a glowing veil, the name on a board above (front faces local +z).
  // A set of doors is merged into a few meshes (frames, boards, names, veils), so the hub's eleven
  // cost four draw calls, not forty-four.
  const frameMat = makeMaterial({ color: '#e9dcc0', color2: '#d8c7a6', color3: '#c9b8a0', mode: MODE_STRATA, strataSize: 0.8, flat: true, grid: 0.6, glyphs: true });
  const boardMat = makeMaterial({ color: '#f6f1e6', flat: true });
  const veilMat = makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.85, side: THREE.DoubleSide });
  const W = 2.2, H = 3.4;
  const _dm = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _dc = new THREE.Color();
  const doors = () => ({ frame: [], board: [], text: [], veil: [] });
  function doorway(set, x, y, z, heading, label, veil) {
    _dm.compose(new THREE.Vector3(x, y, z), _dq.setFromAxisAngle(Y, heading), new THREE.Vector3(1, 1, 1));
    const at = (g) => (g.index ? g.toNonIndexed() : g).applyMatrix4(_dm);
    for (const g of [
      new THREE.BoxGeometry(0.6, H, 0.8).translate(-W / 2 - 0.3, H / 2, 0),
      new THREE.BoxGeometry(0.6, H, 0.8).translate(W / 2 + 0.3, H / 2, 0),
      new THREE.BoxGeometry(W + 1.6, 0.6, 1).translate(0, H + 0.3, 0),
      new THREE.BoxGeometry(W + 2.2, 0.3, 2.4).translate(0, 0.05, 0),   // the doorstep
    ]) set.frame.push(at(g));
    const v = at(new THREE.PlaneGeometry(W, H).translate(0, H / 2, 0));
    _dc.set(veil);
    v.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: v.attributes.position.count }, () => [_dc.r, _dc.g, _dc.b]).flat(), 3));
    set.veil.push(v);
    const tw = Math.max(1.2, label.length * 0.34), bw = Math.max(W + 1.6, tw + 0.7);
    set.board.push(at(new THREE.BoxGeometry(bw, 0.95, 0.16).translate(0, H + 1.1, 0.1)));
    set.text.push(at(textGeometry(label, { width: tw, depth: 0.04 }).translate(0, H + 1.1, 0.2)));
  }
  function buildDoors(set, parent) {
    const strip = (list, keep = []) => list.map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !keep.includes(k)) g.deleteAttribute(k); return g; });
    parent.add(new THREE.Mesh(mergeGeometries(strip(set.frame)), frameMat), new THREE.Mesh(mergeGeometries(strip(set.board)), boardMat));
    const text = new THREE.Mesh(mergeGeometries(strip(set.text)), ink), v = new THREE.Mesh(mergeGeometries(strip(set.veil, ['color'])), veilMat);
    text.userData.noCollide = v.userData.noCollide = true;
    parent.add(text, v);
  }
  const hubDoors = doors();

  // ---- the biome rooms, far out on their ring, and the doors between them and the hub
  const rooms = [], portals = [], flora = [], wildlife = [];
  // a point k m behind a hub door's threshold (negative: in front of it, toward the hub's centre)
  const hubDoorAt = (d, k) => new THREE.Vector3(d.x - Math.sin(d.heading) * k, 0, d.z - Math.cos(d.heading) * k);
  ROOMS.forEach((def, i) => {
    const centre = roomCentre(i);
    const group = new THREE.Group();
    group.name = `Lab room: ${def.title}`;
    group.position.copy(centre);
    scene.add(group);
    const ground = def.ground ? new Terrain({ size: ROOM_SIZE, seg: 120, height: def.ground.height, material: def.ground.material }) : null;
    if (ground) group.add(ground.mesh);
    const kit = new RoomKit({ group, ground, centre, seed: 7001 + i * 31 });
    def.build(kit, def);
    kit.finish();
    lights.push(...kit.lights);
    noShadow.push(...kit.noShadow);
    movers.push(...kit.movers.map((fn) => (t) => { if (group.visible) fn(t); }));
    const H = (x, z) => (ground ? ground.heightAt(x, z) : def.floor ?? 0);
    // the way in (you arrive facing into the room) and the door home behind you
    const [ax, az] = arriveOf(def);
    const floorAt = (x, z) => (def.stands || !ground ? def.floor ?? 0 : H(x, z));
    const doorY = floorAt(ax, az + DOOR_BACK) - (def.stands || !ground ? 0.4 : 0.05);
    const homeDoor = doors();
    doorway(homeDoor, ax, doorY, az + DOOR_BACK, Math.PI, 'The Lab', '#e9edf0');
    buildDoors(homeDoor, group);
    const sky = def.sky?.script;
    const room = {
      def, i, centre, group, ground, H,
      arrive: new THREE.Vector3(centre.x + ax, centre.y + floorAt(ax, az) + (def.stands || !ground ? 1.2 : 0.3), centre.z + az),
      heading: Math.PI,
      zone: { name: `The Lab · ${def.title}`, preset: 'Moebius print', look: def.look, planets: def.sky?.planets ?? [], hour: def.hour },
      atmo: { tint: def.atmo.tint, fog: def.atmo.fog, name: `The Lab · ${def.title}`, script: sky ? colourScript(sky) : undefined },
      killY: def.killY ?? -60,
    };
    rooms.push(room);
    // the hub's door to it, and its own door home
    const d = LAB_DOORS[i];
    doorway(hubDoors, d.x, 0, d.z, d.heading, def.title, sky?.day[0] ?? '#e9edf0');
    const home = new THREE.Vector3(centre.x + ax, room.arrive.y, centre.z + az + DOOR_BACK + 0.3);
    portals.push(
      { at: hubDoorAt(d, 0.3).setY(1), pos: hubDoorAt(d, 0.3).setY(1), to: room.arrive.clone(), toUp: Y.clone(), heading: room.heading, label: `door to ${def.title}`, room },
      { at: home.clone(), pos: home.clone(), to: hubDoorAt(d, -DOOR_BACK).setY(0.3), toUp: Y.clone(), heading: d.heading, label: 'door to the Lab', room: null },
    );
    // its world's plants over the room's disc (flora.js) and two or three of its creatures (wildlife.js)
    if (def.flora) {
      const f = def.flora;
      const regions = f.rects ? f.rects.map(([x0, x1, z0, z1]) => ({ x0: centre.x + x0, x1: centre.x + x1, z0: centre.z + z0, z1: centre.z + z1, w: 1, band: f.band }))
        : [{ x: centre.x, z: centre.z, r0: f.r0 ?? 12, r: f.r ?? 94, w: 1, band: f.band }];
      flora.push({ world: def.id, seed: 900 + i, patches: f.patches, sparse: f.sparse, water: f.water, ray: !!f.band, regions });
    }
    const anchorY = def.stands || !ground ? (def.floor ?? 0) : H(0, 0);
    for (const sp of WILDLIFE[def.id] ?? []) {
      const p = new THREE.Vector3(centre.x, centre.y + anchorY, centre.z + (def.stands ? 18 : 0));
      wildlife.push({ ...sp, count: Math.min(sp.count, 4), anchors: () => [{ p, r: def.id === 'incal' ? [50, 88] : [10, def.stands ? 55 : 80], w: 1 }] });
    }
  });

  buildDoors(hubDoors, hub);

  // which room a point is in (null: the hub)
  const roomAt = (x, z) => {
    if (x * x + z * z < 1000 * 1000) return null;
    for (const r of rooms) if ((x - r.centre.x) ** 2 + (z - r.centre.z) ** 2 < 700 * 700) return r;
    return null;
  };
  const ground = {
    mesh: terrain.mesh,
    heightAt(x, z) {
      const r = roomAt(x, z);
      if (!r) return terrain.heightAt(x, z);
      return r.ground ? r.centre.y + r.ground.heightAt(x - r.centre.x, z - r.centre.z) : -Infinity;
    },
  };
  const floraAvoid = (x, z, rad) => {
    const r = roomAt(x, z);
    if (!r) return false;
    const lx = x - r.centre.x, lz = z - r.centre.z, [ax, az] = arriveOf(r.def);
    if (Math.abs(lx - ax) < 9 + rad && lz > az - 14 && lz < az + DOOR_BACK + 6) return true;   // the way in, and the door home
    return !!r.def.avoid?.(lx, lz, rad);
  };

  // what is drawn: the room you are in, or the hub
  let shown;
  const show = (room) => {
    if (room === shown) return;
    shown = room;
    hub.visible = !room;
    for (const r of rooms) r.group.visible = r === room;
  };
  show(null);

  let passing = null, cooldown = 0;
  return {
    id: 'lab',
    ground,
    spawn: new THREE.Vector3(0, 0, 4),
    spawnHeading: Math.PI,   // facing the materials
    camYaw: 0,
    features: { mount: false, wind: false, jetpack: true, climb: true },
    defaults: { hour: 11, preset: 'Viridel', cloudShadows: 0 },
    killY: -Infinity,
    limit: ROOM_RING + 600,
    shipSite: { x: 0, z: -78, heading: 0 },   // behind the materials row, clear of the doors
    lights, noShadow,
    rooms,
    navigationPortals: portals,
    flora,
    wildlife,
    floraAvoid,
    roomAt,
    unsafe: (p) => { const r = roomAt(p.x, p.z); return !!r?.def.unsafe?.(new THREE.Vector3(p.x - r.centre.x, p.y - r.centre.y, p.z - r.centre.z), (x, z) => r.H(x, z)); },
    sky: {
      script: {
        day: ['#e9edf0', '#f6f7f8', '#c9ccd0', '#ffffff', '#fff6dc'],
        dusk: ['#e6dccb', '#f2e6d2', '#b8ab96', '#fff0d6', '#ffe6c0'],
        night: ['#2e3238', '#4a5058', '#2e3238', '#c8c4bc', '#f2f0e6'],
      },
    },
    atmo: (x, z) => roomAt(x, z)?.atmo ?? HUB_ATMO,
    zoneAt: (p) => roomAt(p.x, p.z)?.zone ?? HUB_ZONE,
    update(dt, t, ctx) {
      for (const m of movers) m(t);
      const player = ctx?.player;
      if (!player) return;
      const p = player.pos, here = roomAt(p.x, p.z);
      show(here);
      cooldown = Math.max(cooldown - dt, 0);
      // through a door: a quick fade, then out the other side at your own pace, the camera behind you
      if (passing) {
        passing.t += dt;
        if (!passing.done && passing.t >= PASS.in) {
          passing.done = true;
          const { to, heading } = passing;
          player.teleport(to, Y, Z);
          player.heading = heading;
          player.vel.set(Math.sin(heading) * passing.speed, 0, Math.cos(heading) * passing.speed);
          if (ctx.rig) { ctx.rig.yaw = heading + Math.PI; ctx.rig.target?.copy(to); }
          show(roomAt(to.x, to.z));
          ctx.fade?.(0, PASS.out);
        }
        if (passing.t >= PASS.in + PASS.out) passing = null;
        return;
      }
      const go = (to, heading, speed = 0) => {
        passing = { to, heading, t: 0, done: false, speed };
        ctx.fade?.(0.95, PASS.in);
        if (!ctx.fade) passing.t = PASS.in;   // (no screen to fade: straight through)
        cooldown = 1.4;
      };
      if (cooldown === 0 && !player.riding) {
        for (const po of portals) {
          if (Math.hypot(p.x - po.at.x, p.z - po.at.z) < 1.3 && Math.abs(p.y - po.at.y) < 2.6) {
            go(po.to, po.heading, Math.min(4, Math.max(2, Math.hypot(player.vel.x, player.vel.z))));
            break;
          }
        }
      }
      // strayed off a room (over its banks, or off its edge into the cloud): back at its door
      if (!passing && here && (Math.hypot(p.x - here.centre.x, p.z - here.centre.z) > ROOM_REACH || p.y - here.centre.y < here.killY)) go(here.arrive, here.heading);
    },
  };
}
