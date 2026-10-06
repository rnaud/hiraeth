// makeMaterial's options (engine/ink-spec.js) as the Godot ink shader's parameters
// (godot/shaders/ink_surface.gdshader). The mapping itself is plain data (inkParams, tested in
// Node); godotParams wraps the colours for Godot.
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)
import { inkParams } from '../ink-params.js';

export function godotParams(spec) {
  const p = inkParams(spec);
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    // (vectors, not Colors: the shader takes the display values as they are and makes them linear itself)
    out[k] = Array.isArray(v) ? (v.length === 3 ? new godot.Vector3(v[0], v[1], v[2]) : new godot.Vector4(v[0], v[1], v[2], v[3])) : v;
  }
  return out;
}
