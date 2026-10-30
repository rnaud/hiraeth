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
  // (once a loader: a loader that loads again would stack them; the parser's plugins are made as parse starts, with this url)
  this.engineUrl = url;
  if (!this.engineImages) { this.engineImages = true; this.register((parser) => engineImages(parser, this.engineUrl)); }
  try {
    const b = host.readFile?.(publicPath(url));
    if (!b) throw new Error(`not found: ${url}`);
    this.parse(b, '', onLoad, onError);
  } catch (e) { onError ? onError(e) : console.error(e); }
};

/**
 * A picture's encoded bytes on its texture (userData.encoded: { bytes, mime }), kept out of three's JSON copy of userData and
 * carried by reference to every clone instead: a material cloned with its map (tripo-material.js makeReviewInkMaterial, the v2
 * traveller's, issue #493) turned the bytes into an object of a million keys, and Unity had no picture to decode.
 */
export function keepEncoded(tex, encoded) {
  Object.defineProperty(tex.userData, 'encoded', { value: encoded, enumerable: false, configurable: true, writable: true });
  return tex;
}
const copyTexture = THREE.Texture.prototype.copy;
THREE.Texture.prototype.copy = function (source) {
  copyTexture.call(this, source);
  const e = source.userData?.encoded;
  if (e) keepEncoded(this, e);
  return this;
};

/** The models whose pictures go to the engine encoded: the father's, the v2 traveller's atlases (his base and each outfit's,
 * issue #493: their UVs are the clothes' own, no colours sampled a vertex); the guardians' go as vertex colours: skin-colours.js. */
export const ENCODED_PICTURES = ['characters/father-v1/', 'characters/traveller-v2/'];

/**
 * The models drawn in the engines by the colours sampled from their picture (colors.json beside each, put on as vertex
 * colours: engine/game.js, src/characters/skin-colours.js), their picture left out: the coral-shirt traveller's body and
 * his portrait head, the Keeper's and the Elder's skins, the shellback crab's body (its COLOR_0, #800). Their JPEG went to three's own image path, which the VM lacks
 * (no Blob, no Image decoder): it failed, as meant, but logged "Couldn't load texture [object Promise]" for each (issue #537).
 */
export const COLOURED_PICTURES = ['characters/traveller-b3/', 'characters/traveller-v1/head-v3/', 'guardians/keeper-v1/', 'guardians/elder-v3/', 'enemies/shellback/'];

/**
 * A picture file of the game's (under public/) kept encoded, for the engine to decode (BridgeHost.TextureImage): a Texture
 * whose userData.encoded holds its bytes, or null when the host has no such file. (The portrait head's eye paint, issue #473.)
 */
export function encodedPicture(path, mime = 'image/png') {
  let b = null;
  try { b = host.readFile?.(publicPath(path)) ?? null; } catch (e) { b = null; }
  if (!b) return null;
  const t = new THREE.Texture();
  t.image = { width: 1, height: 1, data: null };
  return keepEncoded(t, { bytes: (b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength)).slice(), mime });
}

/**
 * A model's pictures in the engines (a glTF's images in its own buffer), as the VM decodes no JPEG or PNG (three's loader
 * wants an Image or an ImageBitmap, and a Blob to get there, which the VM lacks). For the models ENCODED_PICTURES names
 * (the father's generated body, src/characters/father-v1.js): a Texture whose userData.encoded holds the bytes and their
 * type, which the Unity backend hands to Unity to decode (BridgeHost.TextureImage, issue #394). For the models
 * COLOURED_PICTURES names: left out, quietly (the material has no map, as before), as their colours are drawn instead.
 * Any other model's picture is left out too, with an error naming the model and the picture (three's own named a
 * Promise: the Blob it builds the picture's URL from failed before the URL was made, issue #537). Pictures by URI go
 * three's way, as before (none of the game's models has one).
 */
export function engineImages(parser, url = '') {
  const own = parser.loadImageSource.bind(parser);
  const encoded = ENCODED_PICTURES.some((f) => url.includes(f)), coloured = COLOURED_PICTURES.some((f) => url.includes(f));
  parser.loadImageSource = function (sourceIndex, loader) {
    const def = this.json.images?.[sourceIndex];
    if (def?.bufferView === undefined) return own(sourceIndex, loader);
    if (!encoded) {
      if (!coloured) console.error(`THREE.GLTFLoader: Couldn't load texture ${def.name ?? `image ${sourceIndex}`} (${def.mimeType ?? 'picture'}) of ${url || 'a model'}: the engines decode no picture; name the model in engine/boot.js ENCODED_PICTURES or COLOURED_PICTURES`);
      // (three's loadTexture takes a failed picture as none: the material goes on without its map)
      return Promise.reject(new Error(`picture ${sourceIndex} left out`));
    }
    return this.getDependency('bufferView', def.bufferView).then((bv) => {
      const t = new THREE.Texture();
      t.image = { width: 1, height: 1, data: null };
      return keepEncoded(t, { bytes: new Uint8Array(bv.slice(0)), mime: def.mimeType ?? '' });
    });
  };
  return { name: 'engine_images' };
}
