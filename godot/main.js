// The one Godot script: it loads the game's bundle (scripts/engine-bundle.mjs builds godot/js/*.js
// from the web game's modules) and hands it the frames. Which bundle: `-- --entry=spike` or the
// game (default).
const godot = require("godot");

function entryName() {
  const a = godot.OS.get_cmdline_user_args();
  for (let i = 0; i < a.size(); i++) { const m = String(a.get(i)).match(/^--entry=(.+)$/); if (m) return m[1]; }
  return "game";
}

class Main extends godot.Node3D {
  _ready() {
    const name = entryName();
    this.M = require(name === "spike" ? "js/memento-spike" : "js/memento");
    this.M.start(this);
  }
  _process(dt) { this.M?.frame(this, dt); }
  _input(e) { this.M?.input?.(this, e); }
}
exports.default = Main;
