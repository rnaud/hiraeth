// First in every engine bundle (scripts/engine-bundle.mjs puts it before the game's modules, which
// may touch the page as they load): the browser stand-ins, from the host the engine set up.
import { installPlatform } from './platform.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { publicPath } from './platform.js';

const host = globalThis.__MEMENTO_HOST__ ?? {};
export const page = installPlatform(host);

// as the game (main.js): colours are authored as display values, not converted to linear
THREE.ColorManagement.enabled = false;

// the game loads its characters by URL (anim/*.glb under public/): read them through the host, as
// build-world.mjs reads them from disk in Node (three's FileLoader wants streams the VM lacks)
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  try {
    const b = host.readFile?.(publicPath(url));
    if (!b) throw new Error(`not found: ${url}`);
    this.parse(b, '', onLoad, onError);
  } catch (e) { onError ? onError(e) : console.error(e); }
};
