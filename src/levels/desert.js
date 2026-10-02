import * as THREE from 'three';
import { Terrain, buildWorld } from '../world.js';
import { biomeAtmosphere } from '../biome.js';
import { Hoverbike } from '../bike.js';

// The original open desert: dunes, mesas, regions, hoverbike and wind.
export function createDesert(scene) {
  const terrain = new Terrain();
  const { floaters, banners, lights } = buildWorld(scene, terrain);
  return {
    id: 'desert',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => new Hoverbike(physics),
    mountName: 'hoverbike',
    defaults: { hour: 9.5, preset: 'Moebius print' },
    lights,
    life: {
      flocks: [{ count: 9, color: '#3a2f2a', size: 2.6, radius: 110, height: [40, 90], seed: 1 },
               { count: 6, color: '#3a2f2a', size: 2.8, radius: 70, height: [55, 110], speed: -0.09, seed: 4 }],
      motes: { count: 160, color: '#e6cf9f', size: 0.05, wind: [1.6, 0.6] },
      footprints: '#d8b884',
    },
    sky: {
      // the print: flat cerulean sky, cream sand, blue-grey shadows
      script: {
        day: ['#6f9fd3', '#c3d3dc', '#93a6cf', '#fff9ee', '#fff6dc'],
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
