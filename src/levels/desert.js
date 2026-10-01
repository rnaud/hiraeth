import * as THREE from 'three';
import { Terrain, buildWorld } from '../world.js';
import { biomeAtmosphere } from '../biome.js';

// The original open desert: dunes, mesas, regions, hoverbike and wind.
export function createDesert(scene) {
  const terrain = new Terrain();
  const { floaters } = buildWorld(scene, terrain);
  // the heightfield has an exact lookup, so it stays out of the mesh collision
  terrain.mesh.userData.noCollide = true;
  return {
    id: 'desert',
    ground: terrain,
    spawn: new THREE.Vector3(0, terrain.heightAt(0, 0), 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { bike: true, wind: true, jetpack: false },
    defaults: { hour: 9.5 },
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
