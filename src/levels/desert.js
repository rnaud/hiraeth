import * as THREE from 'three';
import { Terrain, buildWorld } from '../world.js';
import { biomeAtmosphere } from '../biome.js';
import { Hoverbike } from '../bike.js';

// The original open desert: dunes, mesas, regions, hoverbike and wind.
export function createDesert(scene) {
  const terrain = new Terrain();
  const { floaters } = buildWorld(scene, terrain);
  return {
    id: 'desert',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => new Hoverbike(physics),
    mountName: 'hoverbike',
    defaults: { hour: 9.5, preset: 'Moebius' },
    killY: -Infinity,
    atmo: (x, z) => biomeAtmosphere(x, z),
    update(dt, t) {
      for (const f of floaters) {
        f.obj.position.y = f.baseY + Math.sin(t * 0.4 + f.phase) * f.amp;
        f.obj.rotation.y += f.spin * dt;
      }
    },
  };
}
