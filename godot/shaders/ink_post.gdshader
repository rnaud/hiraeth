// The ink composite (src/post.js), first port: a full-screen quad after the opaque pass reads the
// frame's depth, normals and colour and draws the lines (depth: the Laplacian of 1/z, exactly 0 on
// any plane; creases from normals; colour boundaries), thinner with distance, faded into the fog
// with the surfaces; the sky as the print's flat gradient where nothing was drawn.
shader_type spatial;
render_mode unshaded, depth_draw_never, depth_test_disabled, cull_disabled, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_nearest;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D normal_tex : hint_normal_roughness_texture, filter_nearest;

uniform vec3 ink : source_color = vec3(0.17, 0.13, 0.12);
uniform vec3 sky_top : source_color = vec3(0.45, 0.66, 0.82);
uniform vec3 sky_horizon : source_color = vec3(0.93, 0.86, 0.72);
uniform vec3 fog_color : source_color = vec3(0.93, 0.86, 0.72);
uniform float fog_near = 250.0;
uniform float fog_far = 2600.0;
uniform float line_width = 1.0;
uniform float depth_thresh = 0.08;
uniform float normal_thresh = 0.3;
uniform float albedo_edges = 0.6;
uniform float wobble = 1.0;

void vertex() {
	POSITION = vec4(VERTEX.xy * 2.0, 1.0, 1.0);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float rawDepth(vec2 uv) { return texture(depth_tex, uv).x; }
float viewZ(vec2 uv, mat4 invp) {
	float d = rawDepth(uv);
	vec4 v = invp * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}
vec3 nrm(vec2 uv) { return texture(normal_tex, uv).xyz * 2.0 - 1.0; }

// linear to the web's display values and back (the screen texture is linear here)
vec3 toDisplay(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = 1.0 / VIEWPORT_SIZE;
	float d0 = rawDepth(uv);
	vec3 col = toDisplay(texture(screen_tex, uv).rgb);
	vec4 wv = INV_VIEW_MATRIX * INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, max(d0, 1e-7), 1.0);
	vec3 wdir = normalize(wv.xyz / wv.w - CAMERA_POSITION_WORLD);
	if (d0 <= 0.0) {
		// the sky: the print's flat gradient (reversed z: nothing drawn is depth 0)
		float h = clamp(wdir.y, 0.0, 1.0);
		vec3 sky = mix(sky_horizon, sky_top, smoothstep(0.0, 0.35, h));
		ALBEDO = toLinear(sky);
	} else {
		float z = viewZ(uv, INV_PROJECTION_MATRIX);
		// lines thinner with distance, the sample offset by a wobble anchored on screen
		float w = line_width * clamp(1.6 - z / 220.0, 0.5, 1.6);
		vec2 j = (vec2(hash(floor(uv * 180.0)), hash(floor(uv * 180.0) + 3.1)) - 0.5) * wobble * px;
		vec2 o = px * w;
		float zc = 1.0 / z;
		float zl = 1.0 / max(viewZ(uv + j - vec2(o.x, 0.0), INV_PROJECTION_MATRIX), 1e-3);
		float zr = 1.0 / max(viewZ(uv + j + vec2(o.x, 0.0), INV_PROJECTION_MATRIX), 1e-3);
		float zu = 1.0 / max(viewZ(uv + j - vec2(0.0, o.y), INV_PROJECTION_MATRIX), 1e-3);
		float zd = 1.0 / max(viewZ(uv + j + vec2(0.0, o.y), INV_PROJECTION_MATRIX), 1e-3);
		// the Laplacian of 1/z, relative to 1/z: a plane gives 0 at any angle
		float lap = abs(zl + zr + zu + zd - 4.0 * zc) / zc;
		float depthLine = smoothstep(depth_thresh, depth_thresh * 2.0, lap);
		// creases
		vec3 n0 = nrm(uv);
		float nd = max(max(1.0 - dot(n0, nrm(uv + vec2(o.x, 0.0))), 1.0 - dot(n0, nrm(uv - vec2(o.x, 0.0)))),
		               max(1.0 - dot(n0, nrm(uv + vec2(0.0, o.y))), 1.0 - dot(n0, nrm(uv - vec2(0.0, o.y)))));
		float creaseLine = smoothstep(normal_thresh, normal_thresh * 1.6, nd);
		// colour boundaries (the flat areas outlined as an inker would)
		vec3 cr = toDisplay(texture(screen_tex, uv + vec2(o.x, 0.0)).rgb), cu = toDisplay(texture(screen_tex, uv + vec2(0.0, o.y)).rgb);
		float cd = max(length(col - cr), length(col - cu));
		float colourLine = smoothstep(0.22, 0.4, cd) * albedo_edges;
		float line = max(depthLine * 1.0, max(creaseLine * 0.8, colourLine * 0.7));
		// atmospheric perspective: toward the horizon colour, lines with it
		float fog = smoothstep(fog_near, fog_far, z);
		col = mix(col, ink, line * (1.0 - fog));
		col = mix(col, fog_color, fog * 0.85);
		ALBEDO = toLinear(col);
	}
}
