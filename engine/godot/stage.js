// The Godot stage the mirrored world is drawn on: the environment (no ambient: the ink shader
// lights everything itself), the sun with its shadows, the camera, and the ink composite on a
// full-screen quad in front of it. Shared by the spike and the game (engine/godot/*.js).
import godot from 'godot';   // (the default import: GodotJS's module is a lazy proxy, a namespace copy of it would be empty)

export function makeStage(owner, { width = 1280, height = 720 } = {}) {
  const env = new godot.Environment();
  env.background_mode = godot.Environment.BGMode.BG_COLOR;
  env.background_color = new godot.Color(0.8, 0.85, 0.9, 1);
  env.ambient_light_source = godot.Environment.AmbientSource.AMBIENT_SOURCE_DISABLED;
  env.reflected_light_source = godot.Environment.ReflectionSource.REFLECTION_SOURCE_DISABLED;
  env.tonemap_mode = godot.Environment.ToneMapper.TONE_MAPPER_LINEAR;
  const we = new godot.WorldEnvironment();
  we.environment = env;
  owner.add_child(we);

  const sun = new godot.DirectionalLight3D();
  sun.shadow_enabled = true;
  sun.light_energy = 1.0;
  sun.light_color = new godot.Color(1, 1, 1, 1);
  sun.directional_shadow_max_distance = 600;
  sun.directional_shadow_mode = godot.DirectionalLight3D.ShadowMode.SHADOW_PARALLEL_4_SPLITS;
  owner.add_child(sun);

  const cam = new godot.Camera3D();
  cam.current = true;
  owner.add_child(cam);

  const post = new godot.MeshInstance3D();
  const quad = new godot.QuadMesh();
  post.mesh = quad;
  post.extra_cull_margin = 16384;
  post.cast_shadow = godot.GeometryInstance3D.ShadowCastingSetting.SHADOW_CASTING_SETTING_OFF;
  const postMat = new godot.ShaderMaterial();
  postMat.shader = godot.ResourceLoader.load('res://shaders/ink_post.gdshader');
  post.material_override = postMat;
  cam.add_child(post);
  post.position = new godot.Vector3(0, 0, -1);

  const root = new godot.Node3D();
  root.name = 'World';
  owner.add_child(root);
  // the ink surface by side and skinning (makeMaterial's side: 0 front, 1 back, 2 both)
  const load = (n) => godot.ResourceLoader.load(`res://shaders/${n}.gdshader`);
  const shaders = { 0: load('ink_surface'), 1: load('ink_surface_back'), 2: load('ink_surface_double'), skinned: load('ink_skinned'), skinned2: load('ink_skinned_double') };
  return { env, sun, cam, post, postMat, root, shaders };
}

/** Point the sun along -dir (dir: toward the sun, three's uSunDir). */
export function aimSun(sun, dir) {
  const d = new godot.Vector3(dir[0], dir[1], dir[2]).normalized();
  const up = Math.abs(d.y) > 0.99 ? new godot.Vector3(1, 0, 0) : new godot.Vector3(0, 1, 0);
  // looking at -dir from the origin: the light shines along its -z
  sun.transform = new godot.Transform3D(godot.Basis.looking_at(new godot.Vector3(-d.x, -d.y, -d.z), up), new godot.Vector3(0, 0, 0));
}

/** The viewport as a PNG at an absolute path. */
export function savePng(owner, path) {
  const img = owner.get_viewport().get_texture().get_image();
  return img.save_png(path);
}

/** `--key=value` after `--` on Godot's command line. */
export function userArgs() {
  const out = {};
  const a = godot.OS.get_cmdline_user_args();
  for (let i = 0; i < a.size(); i++) {
    const m = String(a.get(i)).match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? '1';
  }
  return out;
}

/**
 * Leave at once, after a batch run: quit() deadlocks on macOS when a window was open (NSApplication's
 * terminate waits on a thread the V8 platform holds), so the process is killed once the log is out.
 */
export function batchExit(owner) {
  if (godot.OS.has_feature('macos') && godot.DisplayServer.get_name() !== 'headless') godot.OS.kill(godot.OS.get_process_id());
  else owner.get_tree().quit();
}
