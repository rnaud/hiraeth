// First in every engine bundle (scripts/engine-bundle.mjs puts it before the game's modules, which
// may touch the page as they load): the browser stand-ins, from the host the engine set up.
import { installPlatform } from './platform.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { publicPath } from './platform.js';

const host = globalThis.__HIRAETH_HOST__ ?? {};
export const page = installPlatform(host);

// as the game (main.js): colours are authored as display values, not converted to linear
THREE.ColorManagement.enabled = false;

// the game loads its characters by URL (anim/*.glb under public/): read them through the host, as
// build-world.mjs reads them from disk in Node (three's FileLoader wants streams the VM lacks)
GLTFLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  if (ENCODED_PICTURES.some((f) => url.includes(f))) this.register(engineImages);
  try {
    const b = host.readFile?.(publicPath(url));
    if (!b) throw new Error(`not found: ${url}`);
    this.parse(b, '', onLoad, onError);
  } catch (e) { onError ? onError(e) : console.error(e); }
};

/** The models whose pictures go to the engine encoded: the father's (the guardians' go as vertex colours: skin-colours.js). */
export const ENCODED_PICTURES = ['characters/father-v1/'];

/**
 * A model's pictures (a glTF's images in its own buffer: the father's generated body, src/characters/father-v1.js) kept
 * encoded, as the VM decodes no JPEG or PNG (three's loader wants an Image or an ImageBitmap): a Texture whose
 * userData.encoded holds the bytes and their type, which the Unity backend hands to Unity to decode
 * (BridgeHost.TextureImage, issue #394). Pictures by URI still fail as before (none of the game's models has one); only
 * the models ENCODED_PICTURES names, as the others' textures were left out on purpose (the guardians': src/characters/skin-colours.js).
 */
export function engineImages(parser) {
  const own = parser.loadImageSource.bind(parser);
  parser.loadImageSource = function (sourceIndex, loader) {
    const def = this.json.images?.[sourceIndex];
    if (def?.bufferView === undefined) return own(sourceIndex, loader);
    return this.getDependency('bufferView', def.bufferView).then((bv) => {
      const t = new THREE.Texture();
      t.image = { width: 1, height: 1, data: null };
      t.userData.encoded = { bytes: new Uint8Array(bv.slice(0)), mime: def.mimeType ?? '' };
      return t;
    });
  };
  return { name: 'engine_images' };
}
