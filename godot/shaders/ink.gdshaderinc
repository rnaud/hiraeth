// The game's surface (src/materials.js makeMaterial) for Godot, ported by hand: the albedo by mode
// (plain, terrain, strata, outfit), the light term (half-lambert × cast shadow, the cast shadow
// clamped below the toon threshold), the two tones (the surface's own shade: its lift, the
// half-tone of a form turned from the sun, the ground's bounce, the hue kept), and the pen strokes
// on the surface (object-space triplanar, spacing from the derivatives snapped to powers of two,
// crossed where darkest). Colours are the web's display values: the shading is done in them and
// the result taken to Godot's linear light. Included by ink_surface.gdshader and ink_skinned.gdshader (SKINNED).

uniform vec3 color = vec3(1.0);       // (display values, as the web's: the albedo is made in them, then taken to linear)
uniform vec3 color2 = vec3(1.0);
uniform vec3 color3 = vec3(1.0);
uniform float mode = 0.0;            // 0 plain, 1 terrain, 2 strata, 3 water, 4 outfit, 5 ribbon, 6 eye
uniform float strata_size = 4.0;
uniform float flat_shade = 0.0;      // faceted: the facet's normal from the derivatives
uniform float glow = 0.0;
uniform float use_vertex_color = 0.0;
uniform float sand_ink = 0.0;
uniform float shade_lift = 0.0;      // (materials.js shadeOf: uShade.x)
uniform float shade_hue = -1.0;      // (uShade.y: -1 the world's tint, 0..1 its own hue kept)
uniform float hatch_k = 1.0;         // (uShade.z: this surface's strokes; metal 0.35, sand 0.55)
uniform vec4 outfit = vec4(0.13, 0.97, 1.47, 0.64);   // (uOutfit: boots top, waist, neck, wrists)
uniform vec3 skin = vec3(0.91, 0.78, 0.66);
uniform vec4 glove = vec4(0.0);
uniform float hero = 0.0;
uniform float biomes = 0.0;          // (uBiomes: the ground's tones by region, biome.js)
uniform vec3 biome_d0 = vec3(0.937, 0.824, 0.608);
uniform vec3 biome_d1 = vec3(0.961, 0.882, 0.714);
uniform vec3 biome_d2 = vec3(0.863, 0.647, 0.478);
uniform vec3 biome_r0 = vec3(0.918, 0.718, 0.620);
uniform vec3 biome_r1 = vec3(0.953, 0.804, 0.722);
uniform vec3 biome_r2 = vec3(0.788, 0.514, 0.435);
uniform vec3 biome_s0 = vec3(0.922, 0.902, 0.847);
uniform vec3 biome_s1 = vec3(0.965, 0.949, 0.910);
uniform vec3 biome_s2 = vec3(0.725, 0.714, 0.776);
uniform vec4 metal = vec4(-1.0);
uniform float grid = 0.0;            // (uGrid: object-space grid lines every this many metres, drawn as detail)     // (uMetal: kind, brushed, reflectivity, highlight; kind < 0: not metal)

// the frame's look: Godot's global shader parameters, set by the bridge once a frame they change
// (engine/ink-params.js GLOBALS; display values, as the web's uniforms)
global uniform vec3 g_shadow_tint;
global uniform vec3 g_light_tint;
global uniform vec3 g_ink;
global uniform float g_toon;
global uniform float g_hatch;
global uniform float g_hatch_spacing;
global uniform float g_halftone;
global uniform float g_bounce;
global uniform float g_shade_keep;
global uniform float g_night;
global uniform vec3 g_sky_top;
global uniform vec3 g_sky_horizon;
global uniform vec3 g_env_ground;
#define shadow_tint g_shadow_tint
#define light_tint g_light_tint
#define ink g_ink
#define toon g_toon
#define hatch g_hatch
#define hatch_spacing g_hatch_spacing
#define halftone g_halftone
#define bounce g_bounce
#define shade_keep g_shade_keep
#define night g_night
const float pixel_ratio = 1.0;

// the web's display values and Godot's linear light
vec3 toDisplay(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

#ifdef SKINNED
// the frame's bone atlas (the bridge's backend: every skinned mesh a row, 4 texels a bone: the columns of
// bindInverse × bone × bind, engine/skin.js) and this mesh's row
global uniform sampler2D g_bones : filter_nearest, repeat_disable;
uniform float bone_row = 0.0;
#endif

varying vec3 v_world;
varying vec3 v_obj;      // the object-space position, the object's scale in it (strokes keep a metric size)
varying vec3 v_onrm;
varying vec3 v_bind;     // the rest pose (outfit zones)
varying float v_depth;
varying vec2 v_strokes;  // (fragment → light) the single and the cross strokes, before the darkness
varying vec3 v_wn;       // (fragment → light) the world normal
varying float v_detail;  // (fragment → light) drawn detail: grid lines (post.js draws gHatch.b in ink)

const float SHADE_BAND = 0.42;
const vec3 SHADE_WARM = vec3(1.06, 0.98, 0.9);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.31)); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

#ifdef SKINNED
mat4 boneAt(int i) {
	int r = int(bone_row + 0.5);
	return mat4(texelFetch(g_bones, ivec2(i * 4, r), 0), texelFetch(g_bones, ivec2(i * 4 + 1, r), 0), texelFetch(g_bones, ivec2(i * 4 + 2, r), 0), texelFetch(g_bones, ivec2(i * 4 + 3, r), 0));
}
#endif

void vertex() {
	v_bind = VERTEX;
#ifdef SKINNED
	ivec4 bi = ivec4(CUSTOM0 + 0.5);
	vec4 bw = CUSTOM1;
	mat4 sk = boneAt(bi.x) * bw.x + boneAt(bi.y) * bw.y + boneAt(bi.z) * bw.z + boneAt(bi.w) * bw.w;
	VERTEX = (sk * vec4(VERTEX, 1.0)).xyz;
	NORMAL = normalize((sk * vec4(NORMAL, 0.0)).xyz);
#endif
	vec3 scl = vec3(length(MODEL_MATRIX[0].xyz), length(MODEL_MATRIX[1].xyz), length(MODEL_MATRIX[2].xyz));
	v_obj = VERTEX * scl;
	v_onrm = NORMAL / scl;
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_depth = -(VIEW_MATRIX * vec4(v_world, 1.0)).z;
}

vec3 strataBand(float band) {
	float t = fract(sin(band * 12.9898) * 43758.5453);
	return t < 0.4 ? color : (t < 0.75 ? color2 : color3);
}
vec3 strata(vec3 wp) {
	float t = (wp.y + (vnoise(wp.xz * 0.04) - 0.5) * strata_size * 0.9) / strata_size;
	float gt = max(length(vec2(dFdx(t), dFdy(t))), 1e-6);
	vec3 c = strataBand(floor(t));
	vec3 mean = color * 0.4 + color2 * 0.35 + color3 * 0.25;
	return mix(mean, c, smoothstep(2.5, 5.0, 1.0 / gt));
}
float blobs(vec2 p, vec2 fwp, float cell, float radius, float density, float seed) {
	vec2 g = p / cell;
	vec2 id = floor(g);
	vec2 h = hash2(id + seed);
	float r = radius / cell * (0.55 + 0.9 * h.y);
	vec2 c = 0.5 + (h - 0.5) * (0.9 - 2.0 * r);
	vec2 d2 = (fract(g) - c) * vec2(1.0, 1.0 + 0.8 * h.x);
	float d = length(d2) + (vnoise(p / radius * 1.4 + seed) - 0.5) * r * 0.9;
	float aa = max(fwp.x, fwp.y) / cell;
	float m = 1.0 - smoothstep(r - aa, r + aa, d);
	float present = step(hash(id + seed + 3.1), density);
	float vis = smoothstep(1.2, 2.5, radius / max(max(fwp.x, fwp.y), 1e-6) / pixel_ratio);
	return m * present * vis;
}

// the strokes (materials.js strokeCoord / strokesLevel / strokes)
vec2 strokeCoord(vec3 w, vec2 dir, vec3 p) {
	vec2 perp = vec2(-dir.y, dir.x);
	vec2 a = p.zy, b = p.xz, c = p.xy;
	return w.x * vec2(dot(a, dir), dot(a, perp)) + w.y * vec2(dot(b, dir), dot(b, perp)) + w.z * vec2(dot(c, dir), dot(c, perp));
}
float strokesLevel(float c, float fw, float s, float wob, float widthPx) {
	float v = c / s + wob;
	float f = fw / s;
	float d = abs(fract(v + 0.5) - 0.5);
	float hw = 0.5 * widthPx * f;
	return 1.0 - smoothstep(hw - 0.6 * f, hw + 0.6 * f, d);
}
float strokes(vec2 ce, float fw, float spacingPx, float widthPx) {
	float lvl = log2(max(fw * spacingPx * pixel_ratio, 1e-5));
	float s0 = exp2(floor(lvl));
	float t = fract(lvl);
	float s1 = s0 * 2.0;
	widthPx *= pixel_ratio;
	vec2 q = ce / s1;
	float wob = (vnoise(q * vec2(0.3, 0.12)) - 0.5) * 0.3;
	float press = 0.75 + 0.5 * vnoise(q * vec2(0.5, 0.6) + 31.0);
	float a = strokesLevel(ce.x, fw, s0, wob * 2.0, widthPx * press);
	float b = strokesLevel(ce.x, fw, s1, wob, widthPx * press);
	return mix(a, b, t);
}

// the desert's regions (biome.js BIOME_GLSL)
float biomeField(vec2 p) { return sin(p.x * 0.0021) * cos(p.y * 0.0017 - 0.7) + 0.5 * sin((p.x + p.y) * 0.0011); }
vec2 biomeWeights(vec2 p) { float f = biomeField(p); return vec2(smoothstep(0.3, 0.6, f), smoothstep(-0.3, -0.6, f)); }
float lum3(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
// metal: its colour in three tones by what the reflection sees (materials.js metalAlbedo, without the highlight and brushing)
vec3 metalAlbedo(vec3 base, vec3 n, vec3 V) {
	vec3 R = reflect(-V, n);
	float kind = metal.x, refl = metal.z;
	float ry = R.y + (vnoise(R.xz * 2.6 + vec2(kind * 3.1)) - 0.5) * 0.09;
	float fy = max(fwidth(ry), 1e-4) * 0.75;
	float up = smoothstep(0.32 - fy, 0.32 + fy, ry);
	float down = 1.0 - smoothstep(-0.04 - fy, -0.04 + fy, ry);
	vec3 skyC = mix(g_sky_horizon, g_sky_top, 0.85);
	vec3 env = mix(mix(g_sky_horizon, skyC, up), g_env_ground, down);
	if (kind > 1.5 && kind < 2.5) {
		float band = down * smoothstep(-0.24 - fy, -0.24 + fy, ry);
		env = mix(env, g_env_ground * 0.78, down);
		env = mix(env, mix(g_env_ground, vec3(0.16, 0.15, 0.21), 0.72), band);
		return mix(base, env * mix(vec3(1.0), base / max(lum3(base), 0.05), 0.12), refl);
	}
	bool warm = kind > 2.5 && kind < 4.5;
	float m = mix(mix(warm ? 1.3 : 1.22, warm ? 1.08 : 1.04, up), warm ? 0.66 : 0.74, down);
	vec3 tone = base * m;
	vec3 seen = env * lum3(base) / max(lum3(env), 0.05) * m;
	return mix(base, mix(tone, seen, warm ? 0.14 : 0.42), refl);
}

float gridLines(vec3 q, vec3 fq, vec3 w) {
	vec3 d = abs(fract(q + 0.5) - 0.5) / max(fq, vec3(1e-6));
	vec3 res = 1.0 - smoothstep(0.07, 0.15, fq);
	vec3 l = mix(vec3(0.1), 1.0 - smoothstep(0.4 * pixel_ratio, 0.4 * pixel_ratio + 1.0, d), res);
	return max(w.x * max(l.y, l.z), max(w.y * max(l.x, l.z), w.z * max(l.x, l.y)));
}

void fragment() {
	int m = int(mode + 0.5);
	vec3 wn = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	if (flat_shade > 0.5) {
		vec3 fn = normalize(cross(dFdx(v_world), dFdy(v_world)));
		if (dot(fn, wn) < 0.0) fn = -fn;
		wn = fn;
		NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
	}
	float slope = 1.0 - wn.y;
	vec3 albedo = color;
	if (m == 1) {
		// sand with flat patches of a second tone, rock on steep slopes; the sand's blobs
		vec3 c1 = color, c2 = color2, c3 = color3;
		if (biomes > 0.5) {
			vec2 bw = biomeWeights(v_world.xz);
			c1 = mix(mix(biome_d0, biome_r0, bw.x), biome_s0, bw.y);
			c2 = mix(mix(biome_d1, biome_r1, bw.x), biome_s1, bw.y);
			c3 = mix(mix(biome_d2, biome_r2, bw.x), biome_s2, bw.y);
		}
		float patches = vnoise(v_world.xz * 0.011) * 0.65 + vnoise(v_world.xz * 0.045) * 0.35;
		albedo = patches > 0.6 ? c2 : c1;
		if (slope > 0.42) albedo = c3;
		else if (slope > 0.30 && patches < 0.45) albedo = mix(c1, c3, 0.5);
		vec2 fwp = fwidth(v_world.xz);
		float b = max(blobs(v_world.xz, fwp, 2.2, 0.28, 0.45, 0.0), max(blobs(v_world.xz, fwp, 11.0, 1.3, 0.35, 41.0), blobs(v_world.xz, fwp, 34.0, 3.2, 0.22, 97.0)));
		if (sand_ink < 0.5) albedo *= mix(vec3(1.0), vec3(0.945, 0.935, 0.965), b);
	} else if (m == 2) {
		albedo = strata(v_world);
	} else if (m == 4) {
		// boots / trousers / belt / tunic / skin at the neck and hands, by the rest pose
		vec3 b = v_bind;
		float ax = abs(b.x);
		if (ax > outfit.w && glove.a > 0.5) albedo = glove.rgb;
		else if ((b.y > outfit.z && ax < 0.16) || ax > outfit.w) albedo = skin;
		else if (b.y < outfit.x) albedo = color3;
		else if (abs(b.y - outfit.y) < 0.03 && ax < 0.25) albedo = color2 * 0.6 + vec3(0.33, 0.24, 0.1);
		else if (b.y < outfit.y) albedo = color2;
		else if (ax > outfit.w - 0.05) albedo = color * 0.75;
		else albedo = color;
	}
	if (use_vertex_color > 0.5) albedo *= COLOR.rgb;
	if (metal.x >= 0.0) albedo = metalAlbedo(albedo, wn, normalize(CAMERA_POSITION_WORLD - v_world));
	ALBEDO = toLinear(albedo);
	// (the albedo's value for the ink pass's colour boundaries: the normal buffer's roughness channel is ours)
	ROUGHNESS = clamp(dot(albedo, vec3(0.3, 0.55, 0.15)), 0.0, 1.0);

	// the strokes, in uniform control flow (derivatives)
	vec3 on = flat_shade > 0.5 ? cross(dFdx(v_obj), dFdy(v_obj)) : v_onrm;
	vec3 tw = pow(abs(normalize(on)), vec3(m == 2 ? 8.0 : 3.0));
	tw /= (tw.x + tw.y + tw.z);
	if (flat_shade > 0.5) { vec3 a = abs(on); tw = a.x > a.y && a.x > a.z ? vec3(1, 0, 0) : (a.y > a.z ? vec3(0, 1, 0) : vec3(0, 0, 1)); }
	if (m == 1) tw = vec3(0.0, 1.0, 0.0);
	vec2 ce1 = strokeCoord(tw, m == 2 ? vec2(0.99, 0.14) : vec2(0.766, 0.643), v_obj);
	vec2 ce2 = strokeCoord(tw, vec2(0.83, -0.56), v_obj);
	float fw1 = fwidth(ce1.x), fw2 = fwidth(ce2.x);
	float hsp = hatch_spacing * mix(0.78, 1.4, smoothstep(6.0, 260.0, v_depth));
	float s1 = strokes(ce1, fw1, hsp, 1.5);
	vec2 ceY = vec2(v_obj.y, dot(v_obj.xz, vec2(0.7071)));
	float fwY = fwidth(v_obj.y);
	if (m == 1) s1 = mix(s1, strokes(ceY, fwY, hsp, 1.5), smoothstep(0.1, 0.3, slope));
	bool rings = flat_shade < 0.5 && m != 1 && abs(wn.y) < 0.6;
	float s2 = rings ? strokes(ceY, fwY, hsp * 1.2, 1.1) : strokes(ce2, fw2, hsp * 1.2, 1.1);
	v_strokes = vec2(s1, s2);
	float detail = 0.0;
	if (grid > 0.0) {
		vec3 gw = pow(abs(normalize(on)), vec3(6.0)); gw /= (gw.x + gw.y + gw.z);
		vec3 gq = v_obj / grid;
		detail = gridLines(gq, fwidth(gq), gw);
	}
	v_detail = detail;
	v_wn = wn;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float lambert = ndl * 0.5 + 0.5;
	float sh = ndl > 0.0 ? ATTENUATION : 1.0;
	float L = mix(min(lambert, 0.38), lambert, sh);
	L = mix(L, 1.0, glow);
	float lit = smoothstep(toon - 0.01, toon + 0.01, L);
	vec3 albedoL = max(ALBEDO, vec3(1e-4));
	vec3 albedo = toDisplay(albedoL);   // (the math in display values, as post.js does it)
	// the surface's own shade: lifted toward its light (its lift, the half-tone of a form turned
	// from the sun, the ground's bounce under faces turned down), its hue kept as it says
	float turned = ndl < 0.0 ? (ndl > -SHADE_BAND ? 1.0 : 0.6) : 0.0;
	float lift = 1.0 - (1.0 - shade_lift) * (1.0 - halftone * turned) * (1.0 - bounce * smoothstep(-0.1, -0.7, v_wn.y));
	float hue = shade_hue < 0.0 ? shade_keep : min(shade_hue, 1.0);
	float tintV = dot(shadow_tint, vec3(0.3, 0.55, 0.15));
	vec3 tint = mix(shadow_tint, tintV * SHADE_WARM, hue * (1.0 - 0.6 * night));
	vec3 shadeC = mix(albedo * tint, albedo * light_tint, L < toon ? lift : 0.0);
	vec3 col = mix(shadeC, albedo * mix(light_tint, vec3(1.12), glow), lit);
	// pen strokes in the shade, crossed where darkest, fewer on a lifted shade, faded with distance
	float dark = clamp((toon - L) / toon, 0.0, 1.0);
	float liftK = L < toon ? lift : 0.0;
	float h1 = v_strokes.x * smoothstep(0.02, 0.12, dark) * (1.0 - 0.8 * liftK);
	float h2 = dark > 0.5 ? v_strokes.y * smoothstep(0.5, 0.65, dark) * max(1.0 - 2.5 * liftK, 0.0) : 0.0;
	float hFade = (1.0 - smoothstep(150.0, 700.0, v_depth)) * hatch * mix(1.0, 0.12, hero);
	col = mix(col, ink, clamp(max(h1, h2) * hatch_k, 0.0, 1.0) * hFade * 0.55);
	// drawn detail (grids): pen lines whatever the light, gone far off
	col = mix(col, ink, clamp(v_detail, 0.0, 1.0) * 0.6 * (1.0 - smoothstep(120.0, 600.0, v_depth)));
	// (back to linear light; the light is white, energy 1, and Godot multiplies DIFFUSE_LIGHT by the albedo: divide it out)
	DIFFUSE_LIGHT += toLinear(col) / albedoL * LIGHT_COLOR / PI;
}
