// The host for the game's VM inside Unity (engine/platform.js reads it), through Puerts' CS
// object: the files of the web game's public/ folder (BridgeHost.ReadFile: the repository's, or
// StreamingAssets/memento-js/public in a build), the save in PlayerPrefs, Unity's clock, the pads.
// First in the Unity bundle, before the game's modules load.
const H = globalThis.CS?.Memento?.Bridge?.BridgeHost;

/** The Gamepad-shaped pads (game.js fills it each frame from BridgeHost.Pad). */
export const pads = [];

globalThis.__MEMENTO_HOST__ = {
  engine: 'unity',
  now: () => H.Now(),
  readFile: (path) => H.ReadFile(path) ?? null,
  storage: {
    get: (k) => { const v = H.StorageGet(k); return v === null || v === undefined ? null : v; },
    set: (k, v) => H.StorageSet(k, v),
    remove: (k) => H.StorageRemove(k),
  },
  pads: () => pads,
};

export const host = H;
