import { buildDesertVistas, BASIN } from '../desert-vistas.js';
import { buildDesertLandmarks, desertHeight } from '../desert-landmarks.js';
import * as THREE from 'three';
import { buildObservatory } from '../observatory.js';
import { Terrain, buildWorld, prepareRelief } from '../world.js';
import { stepped } from '../load-steps.js';
import { biomeAtmosphere } from '../biome.js';
import { Hoverbike } from '../bike.js';
import { makeMaterial } from '../materials.js';
const makeGlow = () => makeMaterial({ color: '#fffaf0', glow: 1 });
import { buildRoom, doorwayPortals } from '../interiors.js';
import { buildDesertCity, desertCrowdSpots } from '../desert-city.js';
import { LINES } from '../story/desert-data.js';
import { attachTemple } from '../temples/index.js';
import { buildDesertHearth } from '../desert-hearth.js';
import { SandDrifts, driftMaterial } from '../sand-drifts.js';
import { STORY, DESERT_WORLD_LOOK } from '../desert-sites.js';
import { smoothstep } from '../noise.js';
import { placeGameMarker } from '../minigames/kit/marker.js';
import { gameById } from '../minigames/index.js';

// The original open desert: dunes, mesas, regions, hoverbike and wind.
// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildDesert(scene) {
  yield* prepareRelief();
  const terrain = yield* Terrain.make({ height: desertHeight });
  const { floaters, banners, lights, doors, floraAvoid } = buildWorld(scene, terrain);
  yield;
  const vistas = buildDesertVistas(scene, terrain);
  yield;
  // sand banked against what stands on it: the landmarks', the city's and the camps' solids feed it
  // (none inside Qanat's walls: its streets and plaza are paved)
  const inQanat = (x, z) => Math.hypot(x - STORY.city.x, z - STORY.city.z);
  const sand = SandDrifts.open({ heightAt: (x, z) => terrain.heightAt(x, z), seed: 3, mask: (x, z) => smoothstep(57, 61, inQanat(x, z)) });
  const landmarks = buildDesertLandmarks(scene, terrain);
  yield;
  // inside the masked head: a glyph-carved chamber under an oculus, built high above the map
  const portals = [], maskRooms = [];
  for (const d of doors) {
    const room = buildRoom(scene, {
      pos: new THREE.Vector3(0, 1500, 0), w: 14, d: 14, h: 8, oculus: 3,
      wall: { color: '#e6cfae', color2: '#d9a477', glyphs: true, grid: 1.4 }, floor: '#c98f5f',
      furniture: [['pedestal', 0, 0, 0, '#f3ead8'], ['bench', -4.5, 0, Math.PI / 2, '#c9a27a'], ['bench', 4.5, 0, Math.PI / 2, '#c9a27a'], ['rug', 0, 3, 0, '#c8483a', '#c8483a']],
      lamp: '#f2c54b',
    });
    // a little glowing mask on the pedestal
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10).scale(0.9, 1.15, 0.5), makeGlow());
    mask.position.copy(room.group.localToWorld(new THREE.Vector3(0, 1.6, 0)));
    scene.add(mask);
    maskRooms.push({ mask: mask.position.clone(), floor: room.group.localToWorld(new THREE.Vector3(0, 0, 2.2)) });
    lights.push(...room.lights, new THREE.Vector4(mask.position.x, mask.position.y, mask.position.z, 9));
    portals.push(...doorwayPortals(scene, { at: d.at, heading: d.heading, room }));
  }
  yield;
  const observatory = buildObservatory(scene, terrain);
  lights.push(...observatory.lights);
  yield;
  // the story: the old city of Qanat round its burning tree, the pilgrims'
  // camps, the fallen giant and the cave in its chest (src/desert-city.js,
  // src/story/desert.js)
  const qanat = buildDesertCity(scene, terrain);
  yield;
  lights.push(...qanat.lights);
  portals.push(...qanat.portals);
  // the main fire's first benches belong to the musicians and Teo (and Oum, once she's home)
  for (const s of qanat.seats) if (s.fire.big && s.i <= 3) s.reserved = true;
  // the Givers' Hearth far out in the red rocks, where the spark-stone waits (src/desert-hearth.js),
  // and the fire-bearers' marked stones on the way to it
  const hearth = buildDesertHearth(scene, terrain);
  lights.push(...hearth.lights);
  portals.push(...hearth.portals);
  yield;
  const drifts = sand.close().build(driftMaterial(makeMaterial, terrain.materialOptions));
  if (drifts) scene.add(drifts);
  sand.raise(terrain);   // (from here on the ground's height is the sand's, drifts and all)
  // the arcade signs of two games, out of the story's way (src/minigames/): Fishing on the basin's shore,
  // the Canyon run under the lavender cliffs by the rope bridge
  for (const [id, x, z, heading] of [['fishing', BASIN.x + BASIN.rx * 0.74, BASIN.z + 6, Math.PI / 2], ['canyon', -398, -446, 2.6]]) {
    if (gameById(id)) placeGameMarker({ scene, levelId: 'desert', lights }, id, new THREE.Vector3(x, terrain.heightAt(x, z), z), { heading });
  }
  // the Givers' House in the eastern dunes, and its rooms far overhead (src/temples/desert.js)
  return attachTemple('desert', scene, {
    id: 'desert',
    floraAvoid,
    observatory,
    qanat,
    hearth,
    vistas,
    landmarks,
    maskRooms,
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => new Hoverbike(physics),
    mountName: 'hoverbike',
    // (as the desert's plates: no cloud bank, the far dunes a pale warm band; a few clouds drifting over)
    defaults: { hour: 9.5, preset: 'Moebius print', look: DESERT_WORLD_LOOK },
    lights,
    portals,
    // the procession, the camps and the people waiting at the gate (crowd.js)
    crowdSpots: () => desertCrowdSpots(terrain, { ...qanat, lines: LINES }),
    crowdLines: LINES.camp,
    life: {
      flocks: [{ count: 12, color: '#665c50', size: .8, radius: 65, height: [22, 48], seed: 1 },
               { count: 8, color: '#665c50', size: .9, radius: 90, height: [40, 75], speed: -0.09, seed: 4 }],
      motes: { count: 160, color: '#e6cf9f', size: 0.05, wind: [1.6, 0.6] },
      footprints: '#d8b884',
    },
    sky: {
      // the print: flat cerulean sky, cream sand, blue-grey shadows
      script: {
        day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ az: 300, el: 24, size: 3.5, color: '#ece4d2' }],
    },
    killY: -Infinity,
    atmo: (x, z) => biomeAtmosphere(x, z),
    update(dt, t, o = {}) {
      if (o.camera) { qanat.update(dt, t, o); hearth.update(dt, t, o); }
      for (const b of banners) b.update(t);
      for (const f of floaters) {
        f.obj.position.y = f.baseY + Math.sin(t * 0.4 + f.phase) * f.amp;
        f.obj.rotation.y += f.spin * dt;
      }
    },
  });
}
export const createDesert = stepped(buildDesert);
