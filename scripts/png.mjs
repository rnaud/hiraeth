// Minimal decoder for 8-bit, non-interlaced RGB/RGBA PNGs (used by the asset scripts).
import { inflateSync } from 'node:zlib';

export function decodePNG(bytes) {
  let width, height, channels;
  const data = [];
  for (let o = 8; o < bytes.length;) {
    const length = bytes.readUInt32BE(o), type = bytes.toString('latin1', o + 4, o + 8);
    const chunk = bytes.subarray(o + 8, o + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[12] !== 0 || ![2, 6].includes(chunk[9])) throw new Error('unsupported PNG format');
      channels = chunk[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') data.push(chunk);
    o += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data)), stride = width * channels;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = pixels.subarray(y * stride, (y + 1) * stride), prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = prev ? prev[x] : 0, c = prev && x >= channels ? prev[x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      row[x] = (src[x] + predictor) & 255;
    }
  }
  return { width, height, channels, pixels };
}
