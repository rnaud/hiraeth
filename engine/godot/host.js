// The host for the game's VM inside Godot (engine/platform.js reads it): files from the
// repository's public/ folder (or the exported game's), the save in user://, Godot's clock.
// First in every Godot bundle, before the game's modules load.
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)

const PUBLIC = (() => {
  // (the repository: godot/ beside public/; an exported game carries public/ inside res://)
  const inRes = 'res://public/';
  if (godot.DirAccess.dir_exists_absolute(inRes)) return inRes;
  return godot.ProjectSettings.globalize_path('res://') + '../public/';
})();

const SAVE = 'user://memento-storage.json';
let saved = null;
const storage = () => {
  if (saved) return saved;
  saved = {};
  if (godot.FileAccess.file_exists(SAVE)) { try { saved = JSON.parse(godot.FileAccess.get_file_as_string(SAVE)) ?? {}; } catch { saved = {}; } }
  return saved;
};
const flush = () => { const f = godot.FileAccess.open(SAVE, godot.FileAccess.ModeFlags.WRITE); if (f) { f.store_string(JSON.stringify(saved)); f.close(); } };

/** The Gamepad-shaped pads (engine/godot/input.js fills it each frame). */
export const pads = [];

globalThis.__MEMENTO_HOST__ = {
  engine: 'godot',
  now: () => godot.Time.get_ticks_usec() / 1000,
  readFile(path) {
    const p = PUBLIC + path;
    if (!godot.FileAccess.file_exists(p)) return null;
    return godot.FileAccess.get_file_as_bytes(p).to_array_buffer();
  },
  storage: {
    get: (k) => storage()[k] ?? null,
    set: (k, v) => { storage()[k] = v; flush(); },
    remove: (k) => { delete storage()[k]; flush(); },
  },
  pads: () => pads,
};
