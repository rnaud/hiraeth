import { ImageLoader, DataTexture, RedFormat, RGFormat, UnsignedByteType, LinearFilter, LinearMipmapLinearFilter } from 'three';

// A single-channel mask: 5.33 MiB including mipmaps at 2048², instead of
// another 21.33 MiB RGBA colour atlas. Shared by body and moving overshirt.
// channels 2: a red/green mask (the face's two weights of line, portrait-head.js).
export async function loadClothInk(url, channels = 1) {
  // Native engine VMs use sampled vertex colours and do not decode browser images.
  // Their stub Image never dispatches load/error: do not leave traveller loading pending.
  if (globalThis.location?.protocol === 'engine:') return null;
  const image = await new ImageLoader().loadAsync(url);
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height, mask = new Uint8Array(n * channels);
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) mask[i * channels + c] = rgba[i * 4 + c];
  const texture = new DataTexture(mask, canvas.width, canvas.height, channels === 2 ? RGFormat : RedFormat, UnsignedByteType);
  if (channels === 2) texture.unpackAlignment = 2;
  // DataTexture uses the GLTF UV orientation (flipY=false) and no colour conversion.
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  canvas.width = canvas.height = 0;
  return texture;
}
