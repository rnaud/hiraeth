import { buildDesertVistas } from '../desert-vistas.js';
import { buildDesertLandmarks, desertHeight } from '../desert-landmarks.js';
import * as THREE from 'three';
import { buildObservatory } from '../observatory.js';
import { Terrain, buildWorld } from '../world.js';
import { biomeAtmosphere } from '../biome.js';
import { Hoverbike } from '../bike.js';
import { makeMaterial } from '../materials.js';
const makeGlow = () => makeMaterial({ color: '#fffaf0', glow: 1 });
import { buildRoom, doorwayPortals } from '../interiors.js';

// The original open desert: dunes, mesas, regions, hoverbike and wind.
export function createDesert(scene) {
  const terrain = new Terrain({ height: desertHeight });
  const { floaters, banners, lights, doors } = buildWorld(scene, terrain);
  const vistas = buildDesertVistas(scene, terrain);
  const landmarks = buildDesertLandmarks(scene, terrain);
  // inside the masked head: a glyph-carved chamber under an oculus, built high above the map
  const portals = [];
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
    lights.push(...room.lights, new THREE.Vector4(mask.position.x, mask.position.y, mask.position.z, 9));
    portals.push(...doorwayPortals(scene, { at: d.at, heading: d.heading, room }));
  }
  const observatory = buildObservatory(scene, terrain);
  lights.push(...observatory.lights);
  return {
    id: 'desert',
    observatory,
    vistas,
    landmarks,
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => new Hoverbike(physics),
    mountName: 'hoverbike',
    defaults: { hour: 9.5, preset: 'Moebius print' },
    lights,
    portals,
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
    update(dt, t) {
      for (const b of banners) b.update(t);
      for (const f of floaters) {
        f.obj.position.y = f.baseY + Math.sin(t * 0.4 + f.phase) * f.amp;
        f.obj.rotation.y += f.spin * dt;
      }
    },
  };
}
