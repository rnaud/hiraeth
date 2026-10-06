// The ink composite (src/post.js), ported for Godot's Forward+: a full-screen quad after the opaque
// pass reads the frame's depth, normals and lit colour. The surfaces have shaded and hatched
// themselves (ink.gdshaderinc light()); here, as post.js does:
//  - the lines: depth (the Laplacian of 1/z: exactly 0 on any plane), creases (normals), colour
//    boundaries (the albedo's value, passed in the normal buffer's roughness channel by the
//    surfaces) and shadow boundaries (lit or not: the lit colour against that albedo), silhouettes
//    heavier, thinner with distance, a hand wobble, pen pressure; faded into the fog;
//  - the sky: the print's gradient (bands, the flat sky, the sun's side paler);
//  - the atmosphere: fog toward the sky's horizon (the far ground's haze), aerial perspective,
//    the haze in flat bands.
shader_type spatial;
render_mode unshaded, depth_draw_never, depth_test_disabled, cull_disabled, fog_disabled, shadows_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D normal_tex : hint_normal_roughness_texture, filter_nearest;

global uniform vec3 g_ink;
global uniform vec3 g_sky_top;
global uniform vec3 g_sky_horizon;
global uniform vec4 g_haze;
global uniform vec3 g_sun_disc;
global uniform vec3 g_light_tint;
global uniform vec3 g_shadow_tint;
global uniform float g_toon;
global uniform float g_night;
global uniform float g_fog_density;
global uniform float g_fog_start;
global uniform float g_fog_mul;
global uniform float g_aerial;
global uniform float g_line_width;
global uniform float g_line_vary;
global uniform float g_depth_thresh;
global uniform float g_normal_thresh;
global uniform float g_albedo_edges;
global uniform float g_shadow_edges;
global uniform float g_wobble;
global uniform float g_sky_flat;
global uniform float g_sky_bands;
global uniform float g_haze_bands;
global uniform float g_flatten;

void vertex() {
	POSITION = vec4(VERTEX.xy * 2.0, 1.0, 1.0);
}

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
vec3 toDisplay(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

// the view depth (m) at uv, 0 for the sky (reversed z: nothing drawn is depth 0)
float viewDepth(vec2 uv, mat4 invp) {
	float d = texture(depth_tex, uv).x;
	if (d <= 0.0) return 0.0;
	vec4 v = invp * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}
float invDepth(float d) { return d > 0.0 ? 1.0 / d : 0.0; }
// the normal (view space) and the albedo's value the surface left in the roughness (7 bits, Godot's packing)
vec4 normalValue(vec2 uv) {
	vec4 nr = texture(normal_tex, uv);
	float r = nr.w;
	if (r > 0.5) r = 1.0 - r;
	r /= (127.0 / 255.0);
	return vec4(normalize(nr.xyz * 2.0 - 1.0), r);
}
float luma(vec3 c) { return dot(c, vec3(0.3, 0.55, 0.15)); }
// lit (1) or in the shade (0): the lit colour against its albedo's value
float litOf(vec3 col, float albedoV) { return step(0.82, luma(col) / max(albedoV, 0.02)); }

vec3 skyBase(vec3 rd) {
	float h = clamp(rd.y, 0.0, 1.0);
	float t = smoothstep(0.0, 0.6, h);
	float tb = (floor(t * 5.0) + smoothstep(0.46, 0.54, fract(t * 5.0))) / 5.0;
	vec3 c = mix(g_sky_horizon, g_sky_top, mix(t, tb, g_sky_bands));
	c = mix(c, mix(g_sky_horizon, g_sky_top, mix(0.45, 1.0, smoothstep(0.0, 0.03, h))), g_sky_flat);
	float sd = max(dot(rd, normalize(g_sun_disc)), 0.0);
	c = mix(c, g_sky_horizon * vec3(1.03, 1.0, 0.96), pow(sd, 8.0) * 0.5 * (1.0 - h) * (1.0 - g_night));
	return c;
}

// the four edge signals at uv, w pixels out (post.js inkLines)
vec4 inkLines(vec2 uv, float w, bool interior, mat4 invp, vec2 res, out float minDepth) {
	vec2 px = max(w, 1.0) / res;
	vec2 o1 = vec2(px.x, 0.0), o2 = vec2(0.0, px.y);
	float c = viewDepth(uv, invp), d1 = viewDepth(uv + o1, invp), d2 = viewDepth(uv - o1, invp), d3 = viewDepth(uv + o2, invp), d4 = viewDepth(uv - o2, invp);
	float big = 1e7;
	minDepth = min(min(c > 0.0 ? c : big, min(d1 > 0.0 ? d1 : big, d2 > 0.0 ? d2 : big)), min(d3 > 0.0 ? d3 : big, d4 > 0.0 ? d4 : big));
	float ic = invDepth(c), i1 = invDepth(d1), i2 = invDepth(d2), i3 = invDepth(d3), i4 = invDepth(d4);
	float mx = max(max(max(ic, i1), max(i2, i3)), i4);
	float lap = abs(i1 + i2 - 2.0 * ic) + abs(i3 + i4 - 2.0 * ic);
	float dEdge = smoothstep(g_depth_thresh, g_depth_thresh * 1.6, lap / max(mx, 1e-7));
	float nEdge = 0.0, aEdge = 0.0, sEdge = 0.0;
	if (c > 0.0 && interior) {
		vec4 n0 = normalValue(uv), n1 = normalValue(uv + o1), n2 = normalValue(uv - o1), n3 = normalValue(uv + o2), n4 = normalValue(uv - o2);
		float e1 = d1 > 0.0 ? 1.0 - dot(n0.xyz, n1.xyz) : 0.0, e2 = d2 > 0.0 ? 1.0 - dot(n0.xyz, n2.xyz) : 0.0;
		float e3 = d3 > 0.0 ? 1.0 - dot(n0.xyz, n3.xyz) : 0.0, e4 = d4 > 0.0 ? 1.0 - dot(n0.xyz, n4.xyz) : 0.0;
		nEdge = smoothstep(g_normal_thresh, g_normal_thresh * 1.5, max(max(e1, e2), max(e3, e4)));
		float da = max(max(abs(n0.w - n1.w), abs(n0.w - n2.w)), max(abs(n0.w - n3.w), abs(n0.w - n4.w)));
		aEdge = smoothstep(0.05, 0.09, da) * g_albedo_edges;
		float s = litOf(toDisplay(texture(screen_tex, uv).rgb), n0.w);
		float ds = max(max(abs(s - litOf(toDisplay(texture(screen_tex, uv + o1).rgb), n1.w)), abs(s - litOf(toDisplay(texture(screen_tex, uv - o1).rgb), n2.w))),
		               max(abs(s - litOf(toDisplay(texture(screen_tex, uv + o2).rgb), n3.w)), abs(s - litOf(toDisplay(texture(screen_tex, uv - o2).rgb), n4.w))));
		sEdge = ds * g_shadow_edges * (1.0 - g_flatten);
	}
	return vec4(dEdge, nEdge, aEdge, sEdge);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 res = VIEWPORT_SIZE;
	vec2 fc = FRAGCOORD.xy;
	float depth = viewDepth(uv, INV_PROJECTION_MATRIX);
	bool isSky = depth <= 0.0;
	vec4 vr = INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, 0.5, 1.0);
	vec3 rd = normalize((INV_VIEW_MATRIX * vec4(vr.xyz / vr.w, 0.0)).xyz);
	vec3 col = toDisplay(texture(screen_tex, uv).rgb);

	// ---- 1. the lines, with the hand's wobble
	vec2 wob = vec2(vnoise(fc * 0.06), vnoise(fc * 0.06 + 31.7)) - 0.5;
	vec2 euv = uv + wob * g_wobble * 2.0 / res;
	float probeD = depth;
	if (isSky) {
		vec2 o = 2.0 / res;
		vec4 s = vec4(viewDepth(uv + vec2(o.x, 0), INV_PROJECTION_MATRIX), viewDepth(uv - vec2(o.x, 0), INV_PROJECTION_MATRIX), viewDepth(uv + vec2(0, o.y), INV_PROJECTION_MATRIX), viewDepth(uv - vec2(0, o.y), INV_PROJECTION_MATRIX));
		s = mix(vec4(1e7), s, step(1e-6, s));
		probeD = min(min(s.x, s.y), min(s.z, s.w));
	}
	float weight = mix(g_line_width, g_line_width * 0.6, smoothstep(15.0, 400.0, probeD));
	float press = mix(1.0, 0.65 + 0.7 * vnoise(fc * 0.045), g_line_vary);
	float silW = weight * mix(1.0, 1.35, g_line_vary) * press;
	float inW = weight * mix(1.0, 0.75, g_line_vary) * mix(1.0, 0.85 + 0.3 * vnoise(fc * 0.06 + 9.0), g_line_vary);
	float nearD, nearD2;
	vec4 eS = inkLines(euv, silW, false, INV_PROJECTION_MATRIX, res, nearD);
	vec4 eI = inkLines(euv, inW, true, INV_PROJECTION_MATRIX, res, nearD2);
	// interior lines break into short strokes (gaps anchored on the page)
	float gapN = vnoise(fc * 0.09);
	float broken = mix(1.0, smoothstep(0.22, 0.34, gapN), g_line_vary * smoothstep(3.0, 12.0, probeD));
	float ink = clamp(max(eS.x, max(max(eI.y, eI.z * 0.85) * broken, eI.w * 0.8)), 0.0, 1.0);
	float fogLine = 1.0 - exp(-max(nearD - g_fog_start, 0.0) * g_fog_density * g_fog_mul * 1.4);
	ink *= 1.0 - fogLine;

	if (isSky) {
		col = skyBase(rd);
	} else {
		// ---- 4. atmospheric perspective, in flat layers like a printed background
		float fog = 1.0 - exp(-max(depth - g_fog_start, 0.0) * g_fog_density * g_fog_mul);
		float fb = fog * 4.0;
		float fogQ = (floor(fb) + smoothstep(0.42, 0.58, fract(fb))) / 4.0;
		fog = mix(fog, fogQ, g_haze_bands);
		vec3 skyC = skyBase(rd);
		if (g_haze.a > 0.0) skyC = mix(skyC, g_haze.rgb, g_haze.a * (1.0 - g_night));
		float aer = smoothstep(0.0, 0.55, fog) * g_aerial;
		float l = luma(col);
		col = mix(col, mix(vec3(l), skyC, 0.35) * 1.04, aer * 0.4);
		col = mix(col, skyC, fog);
	}
	col = mix(col, g_ink, ink);
	ALBEDO = toLinear(col);
}
