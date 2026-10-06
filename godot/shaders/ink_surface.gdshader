// The game's surface (src/materials.js makeMaterial), first port: flat albedo by mode, the
// two-tone light (half-lambert × cast shadow against the toon threshold), the shade tinted and
// hatched on the surface. Colours are the web's display values (source_color: Godot takes them
// to linear and back, so the screen shows them as they are).
shader_type spatial;
render_mode diffuse_lambert, specular_disabled, ambient_light_disabled;

uniform vec3 color : source_color = vec3(1.0);
uniform vec3 color2 : source_color = vec3(1.0);
uniform vec3 color3 : source_color = vec3(1.0);
uniform float mode = 0.0;           // 0 plain, 1 terrain, 2 strata, 3 water, 4 outfit, 5 ribbon, 6 eye
uniform float strata_size = 4.0;
uniform float glow = 0.0;
uniform float use_vertex_color = 0.0;
uniform float shade_lift = 0.0;   // (SHADE: how far a shaded pixel lifts toward its lit colour)
uniform float hatch_k = 1.0;      // this surface's strokes (metal 0.35, sand 0.55)
uniform float shade_hue = -1.0;   // (the hue kept in the shade, -1 the world's: not used yet)

// the frame's look (set on every ink material by the bridge's look op)
uniform vec3 shadow_tint : source_color = vec3(0.62, 0.64, 0.78);
uniform vec3 light_tint : source_color = vec3(1.0);
uniform vec3 ink : source_color = vec3(0.17, 0.13, 0.12);
uniform float toon = 0.5;
uniform float hatch = 1.0;
uniform float hatch_spacing = 5.5;

varying vec3 wpos;
varying vec3 opos;
varying vec3 onrm;
varying float oscale;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	opos = VERTEX;
	onrm = NORMAL;
	oscale = length(MODEL_MATRIX[0].xyz);
}

void fragment() {
	vec3 c = color;
	int m = int(mode + 0.5);
	if (m == 1) {
		// terrain: sand patches, rock on slopes (materials.js terrain albedo, simplified)
		vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
		float patches = smoothstep(0.45, 0.6, vnoise(wpos.xz * 0.012) * 0.7 + vnoise(wpos.xz * 0.05) * 0.3);
		c = mix(color, color2, patches);
		c = mix(c, color3, smoothstep(0.82, 0.7, wn.y));
	} else if (m == 2) {
		// strata: horizontal bands
		float b = floor(wpos.y / max(strata_size, 0.1));
		float k = hash(vec2(b, 7.0));
		c = k < 0.33 ? color : k < 0.66 ? color2 : color3;
	}
	if (use_vertex_color > 0.5) c *= COLOR.rgb;
	ALBEDO = c;
	if (glow > 0.0) EMISSION = c * glow;
}

// the strokes: a triplanar projection of the object-space position, by the object's scale,
// spacing in pixels from the screen derivatives snapped to powers of two (post.js / materials.js)
float strokes(vec3 p, vec3 n, float angle) {
	vec3 an = abs(n);
	vec2 uv = an.x > an.y && an.x > an.z ? p.zy : an.y > an.z ? p.xz : p.xy;
	float ca = cos(angle), sa = sin(angle);
	float s = dot(uv, vec2(ca, sa));
	float w = fwidth(s);
	float level = exp2(ceil(log2(max(w * hatch_spacing, 1e-4))));
	float x = fract(s / level);
	return smoothstep(0.5 - 0.18, 0.5, x) * (1.0 - smoothstep(0.5, 0.5 + 0.18, x));
}

void light() {
	float hl = clamp(dot(NORMAL, LIGHT) * 0.5 + 0.5, 0.0, 1.0);
	float shadow = ATTENUATION;
	float l = hl * mix(0.45, 1.0, shadow);       // (cast shadow just below the threshold)
	float lit = step(toon, l);
	vec3 shade = mix(shadow_tint, vec3(1.0), shade_lift);
	vec3 tone = mix(shade, light_tint, lit);
	// pen strokes in the shade, crossed where darkest
	float dark = 1.0 - lit;
	float h1 = strokes(opos * oscale, onrm, 0.785);
	float h2 = strokes(opos * oscale, onrm, -0.785);
	float marks = max(h1 * dark, h2 * dark * step(l, toon * 0.55)) * hatch * hatch_k * (1.0 - shade_lift);
	// ink in light units: the albedo multiplies DIFFUSE_LIGHT, so divide it back out
	vec3 a = max(ALBEDO, vec3(1e-3));
	vec3 col = mix(tone, ink / a, marks * 0.55);
	DIFFUSE_LIGHT += col * LIGHT_COLOR / PI;
}
