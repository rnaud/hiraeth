// The push's rings and spray (RB / R1, keyboard C) are drawn in every world: in the open air and in every room
// off the map (temples, the cave, the Hearth), where the interior culler once hid them (DONE.md). The fluid tool
// fires through its own input path (the pad's and the keyboard's), and nothing the frame hides is the push.
// (Checked in the running game too, keyboard and a fake pad, every world and room: TODO.md, "Questions for the author".)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { Physics } from '../src/physics.js';
import { InteriorCuller } from '../src/perf.js';
import { LEVELS } from '../src/levels/index.js';
import { items } from '../src/items.js';

items.grant('backpack');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;
const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const WORLDS = ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'atelier', 'home'];

function stubPlayer(at) {
  const frame = { up: V(0, 1, 0), fwd: V(0, 0, 1), right: V(1, 0, 0), dir: (h, out) => out.set(Math.sin(h), 0, Math.cos(h)) };
  return { pos: at.clone(), vel: V(), heading: Math.PI, frame, vehicles: [], object: { visible: true }, ride: null, gliding: false, climbing: false, mantle: null, thrusting: false, onGround: true, aim: null, opts: {} };
}

test('in every world, in the open air and in every room off the map, the push’s rings and spray are made and drawn (pad and keyboard)', () => {
  const seen = [];
  for (const id of WORLDS) {
    const scene = new THREE.Scene();
    const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
    const ground = level.ground?.heightAt ? level.ground : null;
    const physics = new Physics(scene, ground);
    quiet(() => level.init?.(physics));
    // the rooms off the map, as main.js finds them
    const rooms = (level.portals ?? []).filter((p) => p.to && !p.toUp && p.to.y - (ground?.heightAt(p.to.x, p.to.z) ?? p.to.y) > 200).map((p) => p.to);
    const cull = new InteriorCuller(scene, rooms, { ground: (x, z) => ground?.heightAt(x, z) ?? 0 });
    const spots = [['open air', level.spawn ?? V()], ...rooms.map((r, k) => [`room ${k}`, r])];
    for (const [where, at] of spots) {
      const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2000);
      const player = stubPlayer(at);
      const tool = new FluidTool({ scene, player, physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
      tool.setMode('push');   // (the push is a gun mode: aimed and fired as a shot)
      for (const [how, ctl] of [['keyboard', { KeyR: true, KeyG: true }], ['pad', { PadAim: true, PadFire: true }]]) {
        camera.position.copy(at).add(V(0, 1.7, 3.4)); camera.lookAt(at.x, at.y + 1.4, at.z - 30); camera.updateMatrixWorld();
        tool.cooldown = 0; tool.reserve.level = tool.reserve.max;
        let rings = 0, drops = 0, hidden = new Set();
        for (let f = 0; f < 24; f++) {
          tool.update(DT, f < 12 ? ctl : {});
          rings = Math.max(rings, tool.rings.mesh.count); drops = Math.max(drops, tool.drops.mesh.count);
          scene.updateMatrixWorld();
          for (const o of cull.hide(camera, [])) { if (o === tool.rings.mesh || o === tool.drops.mesh) hidden.add(o === tool.rings.mesh ? 'rings' : 'spray'); o.visible = true; }
        }
        assert.ok(rings >= 3 && drops >= 30, `${id}, ${where}, ${how}: rings ${rings}, spray ${drops}`);
        assert.deepEqual([...hidden], [], `${id}, ${where}, ${how}: hidden at draw time`);
        for (let f = 0; f < 60; f++) tool.update(DT, {});
      }
      tool.dispose?.();
      seen.push(`${id} ${where}`);
    }
  }
  assert.ok(seen.filter((s) => s.includes('room')).length >= 10, `rooms checked: ${seen.length}`);
});
