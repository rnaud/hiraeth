import { ImageLoader, DataTexture, RedFormat, UnsignedByteType, LinearFilter, LinearMipmapLinearFilter } from 'three';

// A single-channel mask: 5.33 MiB including mipmaps at 2048², instead of
// another 21.33 MiB RGBA colour atlas. Shared by body and moving overshirt.
export async function loadClothInk(url) {
  // Native engine VMs use sampled vertex colours and do not decode browser images.
  // Their stub Image never dispatches load/error: do not leave traveller loading pending.
  if (globalThis.location?.protocol === 'engine:') return null;
  const image = await new ImageLoader().loadAsync(url);
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const red = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < red.length; i++) red[i] = rgba[i * 4];
  const texture = new DataTexture(red, canvas.width, canvas.height, RedFormat, UnsignedByteType);
  // DataTexture uses the GLTF UV orientation (flipY=false) and no colour conversion.
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  canvas.width = canvas.height = 0;
  return texture;
}
