// Shared decoded effects, prepared without constructing a playback graph.
// Browser decoding uses an OfflineAudioContext; the native shim has no device sink
// until a source is created and started. No sources or connections are made here.
import { SampleBank, SFX, RoundRobin } from './sfx.js';
const prepared = new Map();
const baseUrl = () => `${import.meta.env?.BASE_URL ?? './'}sfx/`;
function decoderContext(win = globalThis.window ?? globalThis) {
  const Offline = win.OfflineAudioContext ?? win.webkitOfflineAudioContext;
  if (Offline) return new Offline(1, 1, 48000);
  const Native = win.AudioContext ?? win.webkitAudioContext;
  if (!Native) throw new Error('Sound effects couldn’t load.');
  // A native-only context may decode without a browser OfflineAudioContext.
  // Do not fall back to a browser realtime context: preparation must not unlock it.
  if (globalThis.document && !globalThis.document.hudIsData) throw new Error('Sound effects couldn’t load.');
  return new Native({ sampleRate: 48000 });
}
export async function prepareEffectAssets({ base = baseUrl(), table = SFX, retry = false, onProgress = null, makeDecoder = decoderContext, fetcher = globalThis.fetch?.bind(globalThis) } = {}) {
  let byTable = prepared.get(table); if (!byTable) prepared.set(table, byTable = new Map());
  let entry = byTable.get(base);
  if (!entry) {
    const ctx = makeDecoder();
    entry = { bank: new SampleBank(ctx, { base, table, fetcher }), promise: null, ready: false, failed: false };
    byTable.set(base, entry);
  }
  if (!entry.promise || (retry && entry.failed)) {
    entry.failed = false;
    entry.promise = entry.bank.preload(4, { retry, onProgress }).then(() => { entry.ready = true; return entry; }, error => { entry.failed = true; throw error; });
  }
  return entry.promise;
}
/** Independent playback ownership; the decoded AudioBuffers themselves are shared. */
export function preparedBank(ctx, assets, options = {}) {
  const bank = new SampleBank(ctx, { ...options, table: assets?.bank.table ?? options.table ?? SFX });
  return adoptEffectAssets(bank, assets);
}
export function adoptEffectAssets(bank, assets) {
  if (assets?.ready) for (const [name, group] of assets.bank.groups) {
    const copy = { ...group, rr: new RoundRobin(group.buffers.length, bank.rand) };
    bank.groups.set(name, copy);
  }
  return bank;
}
