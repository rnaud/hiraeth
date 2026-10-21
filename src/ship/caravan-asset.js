import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { shipSetting } from './selection.js';
// Both hosts use the existing glTF loader/bridge resource adapter. No DOM or engine-specific geometry.
export const PLAYABLE_CARAVAN_PATH = 'models/ships/caravan-a/playable.glb';
let pending;
export function loadPlayableCaravan(base = '', { loader = new GLTFLoader(), timeoutMs = 60000, variant = shipSetting.get() } = {}) {
  // Null selects the retained procedural hull, rooms, collision and cinematic anchors in every consumer.
  // Check before the shared download: the original ship works even if the caravan asset is unavailable.
  if (variant === 'original') return Promise.resolve(null);
  if (!pending) {
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ship download timed out')), timeoutMs); });
    pending = Promise.race([Promise.resolve().then(() => loader.loadAsync(base + PLAYABLE_CARAVAN_PATH)), deadline]).then(({ scene }) => {
      for (const name of ['hull', 'cockpit', 'engines', 'entry-door', 'porch-panel', 'booster-port-upper', 'booster-port-lower', 'booster-starboard-upper', 'booster-starboard-lower']) {
        if (!scene.getObjectByName(name)) throw new Error(`Playable caravan is missing ${name}`);
      }
      return scene;
    }).catch(error => { pending = null; throw new Error(`The caravan could not be loaded: ${error.message}`, { cause: error }); }).finally(() => clearTimeout(timer));
  }
  return pending;
}
