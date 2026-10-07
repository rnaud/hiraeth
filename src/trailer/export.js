// Offline WebCodecs export: every frame gets an exact timestamp, regardless of GPU speed.
// Minimal WebM muxer (VP9 + Opus); one-second clusters keep seeking inexpensive.
const bytes = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; } return out;
};
function uint(value) {
  const a = []; do { a.unshift(value % 256); value = Math.floor(value / 256); } while (value); return new Uint8Array(a);
}
function size(value) {
  let n = 1; while (value >= 2 ** (7 * n) - 1) n++;
  const a = new Uint8Array(n); for (let i = n - 1; i >= 0; i--) { a[i] = value % 256; value = Math.floor(value / 256); }
  a[0] |= 1 << (8 - n); return a;
}
const element = (id, data) => bytes(uint(id), size(data.length), data);
const number = (id, n) => element(id, uint(n));
const string = (id, s) => element(id, new TextEncoder().encode(s));
const float = (id, n) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, n); return element(id, b); };
function mux(video, audio, description, width, height, duration, fps) {
  const header = element(0x1a45dfa3, bytes(number(0x4286, 1), number(0x42f7, 1), number(0x42f2, 4), number(0x42f3, 8), string(0x4282, 'webm'), number(0x4287, 4), number(0x4285, 2)));
  const info = element(0x1549a966, bytes(number(0x2ad7b1, 1000000), string(0x4d80, 'Hiraeth'), string(0x5741, 'Hiraeth'), float(0x4489, duration * 1000)));
  const skip = description[10] + description[11] * 256;
  const tracks = element(0x1654ae6b, bytes(
    element(0xae, bytes(number(0xd7, 1), number(0x73c5, 1), number(0x83, 1), string(0x86, 'V_VP9'), number(0x23e383, Math.round(1e9 / fps)), element(0xe0, bytes(number(0xb0, width), number(0xba, height))))),
    element(0xae, bytes(number(0xd7, 2), number(0x73c5, 2), number(0x83, 2), string(0x86, 'A_OPUS'), element(0x63a2, description), number(0x56aa, Math.round(skip / 48000 * 1e9)), number(0x56bb, 80000000), element(0xe1, bytes(float(0xb5, 48000), number(0x9f, 2)))))
  ));
  const packets = [...video.map(p => ({ ...p, track: 1 })), ...audio.map(p => ({ ...p, track: 2 }))].sort((a, b) => a.timestamp - b.timestamp);
  const clusters = []; let base = -1, blocks = [];
  const flush = () => { if (blocks.length) clusters.push(element(0x1f43b675, bytes(number(0xe7, base), ...blocks))); };
  for (const p of packets) {
    const time = Math.max(0, Math.round(p.timestamp / 1000));
    if (base < 0 || time - base >= 1000) { flush(); base = time; blocks = []; }
    const delta = time - base;
    blocks.push(element(0xa3, bytes(new Uint8Array([0x80 | p.track, delta >> 8, delta & 255, p.key ? 0x80 : 0]), p.data)));
  }
  flush();
  const body = bytes(info, tracks, ...clusters);
  return new Blob([header, uint(0x18538067), size(body.length), body], { type: 'video/webm' });
}
export async function exportFilm({ canvas, draw, schedule, duration, progress }) {
  const fps = 30, video = [], audio = []; let failure, description;
  const save = list => (chunk, metadata) => {
    const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
    list.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' });
    if (metadata?.decoderConfig?.description) description = new Uint8Array(metadata.decoderConfig.description);
  };
  const ve = new VideoEncoder({ output: save(video), error: e => { failure = e; } });
  const ae = new AudioEncoder({ output: save(audio), error: e => { failure = e; } });
  try {
    ve.configure({ codec: 'vp09.00.50.08', width: canvas.width, height: canvas.height, bitrate: 24000000, framerate: fps, latencyMode: 'quality' });
    draw(0);
    for (let i = 0; i < duration * fps; i++) {
      draw(i / fps, 1 / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      ve.encode(frame, { keyFrame: i % fps === 0 }); frame.close();
      if (i % 8 === 7) { await ve.flush(); progress((i + 1) / (duration * fps)); await new Promise(r => setTimeout(r, 0)); }
      if (failure) throw failure;
    }
    await ve.flush();
    const offline = new OfflineAudioContext(2, duration * 48000, 48000);
    schedule(offline, offline.destination, 0);
    const pcm = await offline.startRendering();
    ae.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
    for (let i = 0; i < pcm.length; i += 960) {
      const data = new Float32Array(1920);
      for (let c = 0; c < 2; c++) data.set(pcm.getChannelData(c).subarray(i, i + 960), c * 960);
      const frame = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: 960, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data });
      ae.encode(frame); frame.close(); if (i % 48000 === 0) await new Promise(r => setTimeout(r, 0));
    }
    await ae.flush(); if (failure) throw failure;
    if (!description) throw new Error('The Opus encoder did not provide its stream header.');
    return mux(video, audio, description, canvas.width, canvas.height, duration, fps);
  } finally { if (ve.state !== 'closed') ve.close(); if (ae.state !== 'closed') ae.close(); }
}
