// The game's sound rendered on a thread of its own in Unity (docs/systems/engine-bridge.md, "Sound"): a second V8
// (BridgeRunner's audio thread) holding only the Web Audio shim. The script's thread records what the game does to its
// graph (engine/webaudio.js, recorded) and hands it over a frame at a time (BridgeHost.AudioBatch); this makes the same
// graph again from it and renders the blocks the script asked for (AudioReplay), into the ring Unity plays
// (BridgeHost.AudioRendered), and says which sources ended (BridgeHost.AudioEnded: their onended, there).
import { AudioReplay } from '../webaudio.js';

const H = globalThis.CS?.Hiraeth?.Bridge?.BridgeHost;
const boxed = !!H?.BoxBuffers?.();
const toHost = boxed ? (b) => ({ b }) : (b) => b;
let R = null, batches = 0;
export let rendered = 0;
// (how many nodes the graph's map holds, now and then: what the script let go of is freed here, FinalizationRegistry)
const SAY = new Set([600, 6000, 36000]);

export function start(rate) { R = new AudioReplay(rate); }

/** Every batch waiting, applied and rendered in order. */
export function pump() {
  let buf;
  while ((buf = H.AudioTake())) {
    const { pcm, ended } = R.apply(new Float64Array(buf));
    // (the view itself, its bytes copied by Puerts at the call: a fresh ArrayBuffer a batch would be held by Puerts' handle on
    // its box until the managed collector lets it go, and pile up for V8's full collections; pack.js takeView, issue #113)
    if (pcm.length) { H.AudioRendered(toHost(pcm)); rendered += pcm.length / 2; }
    if (ended.length) H.AudioEnded(ended.join(','));
    if (SAY.has(++batches)) console.log(`[audio] after ${batches} batches: ${R.nodes.size} nodes, ${R.params.size} params, ${R.live.size} sources playing, ${R.freed ?? 0} freed`);
  }
}
