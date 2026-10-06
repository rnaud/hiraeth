// An ink spec (engine/ink-spec.js) as the engines' ink surface parameters: the same names in the
// Godot shader (godot/shaders/ink_surface.gdshader) and the Unity bridge's materials. Colours are
// [r, g, b] display values; numbers stay numbers.


export function inkParams(spec) {
  const u = spec.u ?? {};
  const num = (k, d = 0) => (typeof u[k] === 'number' ? u[k] : d);
  const p = {
    color: u.uColor ?? [1, 1, 1],
    color2: u.uColor2 ?? u.uColor ?? [1, 1, 1],
    color3: u.uColor3 ?? u.uColor ?? [1, 1, 1],
    mode: num('uMode'),
    strata_size: num('uStrataSize', 4),
    glow: num('uGlow'),
    use_vertex_color: spec.vertexColors ? 1 : 0,
  };
  // the surface's own shade and strokes (materials.js shadeOf: uShade = [lift, hue, hatch, strata strokes])
  const shade = u.uShade;
  if (Array.isArray(shade)) {
    p.shade_lift = shade[0] ?? 0;
    p.shade_hue = shade[1] ?? -1;
    p.hatch_k = shade[2] ?? 1;
  }
  return p;
}
