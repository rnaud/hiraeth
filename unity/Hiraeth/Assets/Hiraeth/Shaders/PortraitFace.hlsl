// The traveller's portrait head, what moves on it (src/characters/portrait-head.js wearPortraitHeadFace; issue #264,
// surfaces D): at a complete blink the collapsed eye replaced by one fine closed-lid line, and the mouth's dark opening
// as he speaks, bounded to the head's measured lips. The blink, smile, brows and the jaw's drop are the head's morph
// targets (blend shapes: engine/unity/backend.js morphKeys); the paint is its vertex colours (engine/traveller-paint.js).
// Measured in the head's fit: ph = (bind - offset) / scale, the bind three's rest position (Surface.shader's I_BIND).
#ifndef HIRAETH_PORTRAIT_FACE_INCLUDED
#define HIRAETH_PORTRAIT_FACE_INCLUDED

#ifndef HIRAETH_PER_MATERIAL   // (in Surface.shader's UnityPerMaterial buffer there: the SRP Batcher's)
float4 _PhFit;      // the fit: offset (three, bind space), scale
float4 _PhFit2;     // x the mouth's height (fit space)
float4 _PhSpeech;   // uHeadSpeech: the mouth's opening, the smile (live)
float4 _PhBlink;    // x uPortraitBlink: the lids' key, 0 open .. 1 shut (live)
float4 _PhEyeBox;   // the eye paint's box in the fit (x0, y0, x1, y1; zero: none, his vertex colours as they are)
float4 _PhEye;      // uHeadEye: zw the iris's offset with his look (fit units, live)
#endif
#ifndef HIRAETH_EYE_PAINT_DECLARED   // (Surface.shader declares it beside its other maps)
TEXTURE2D(_EyePaint); SAMPLER(sampler_EyePaint);
#endif

// His painted eyes and brows at the texture's own detail (issue #473; scripts/tripo/bake-eye-paint.mjs, eye-paint.png: the
// head's JPEG front-projected into the fit, the hair's share in alpha), worked as the page's shader works its uMap there
// (portrait-head.js wearPortraitHeadFace): the iris moved with his look, the warm blotches and the face's baked marks put
// to the one skin, the brows and lash lines kept, the patch one warm tone from afar (PORTRAIT_EYES_FAR), the hair inked.
// Before it the paint was his vertex colours alone (engine/traveller-paint.js), a few vertices across an iris: blurred.
// The bind position stands in for the page's UV (it rides each vertex as a UV does: the blink's blend shapes move the lids
// and their paint with them). Display values.
float3 portraitEyePaint(float3 albedo, float3 ph)
{
  float2 size = _PhEyeBox.zw - _PhEyeBox.xy;
  float2 uv = (ph.xy - _PhEyeBox.xy) / size;
  // (derivatives first, the sampling by them: its mips as the page's, whatever the branch)
  float2 duvx = ddx(uv), duvy = ddy(uv);
  float faceR = 0.47 / max(max(fwidth(ph.x), fwidth(ph.y)), 1e-6);   // (PORTRAIT_FACE_INK.faceHeight in render px)
  float2 e = abs(uv * 2.0 - 1.0);
  float inBox = (1.0 - smoothstep(0.9, 1.0, e.x)) * (1.0 - smoothstep(0.88, 1.0, e.y)) * step(e.x, 1.0) * step(e.y, 1.0);
  float front = smoothstep(0.10, 0.18, ph.z);
  if (inBox * front <= 0.0) return albedo;
  const float3 SKIN = float3(0.79, 0.525, 0.37);
  float4 pa = SAMPLE_TEXTURE2D_GRAD(_EyePaint, sampler_EyePaint, uv, duvx, duvy);
  float3 paint = pa.rgb;
  float hair = pa.a;
  float2 q = ph.xy - float2(ph.x < 0.0 ? -0.118 : 0.125, 0.522);
  float inside = (1.0 - smoothstep(0.78, 1.0, length(q / float2(0.052, 0.024)))) * front;
  // the painted iris moved within its own eye, the lids where they are
  float2 shift = clamp(_PhEye.zw, -0.04, 0.04) / size;
  float3 eyeP = SAMPLE_TEXTURE2D_GRAD(_EyePaint, sampler_EyePaint, uv - shift, duvx, duvy).rgb;
  float3 a = lerp(paint, eyeP, inside);
  float warm = smoothstep(0.06, 0.17, a.r - a.g) * smoothstep(0.12, 0.25, a.r - a.b) * smoothstep(0.28, 0.62, a.r);
  a = lerp(a, SKIN, 0.65 * warm * (1.0 - hair) * (1.0 - inside));
  float2 b = float2(abs(ph.x) - 0.12, ph.y - 0.592);
  float browBox = (1.0 - smoothstep(0.085, 0.11, abs(b.x))) * (1.0 - smoothstep(0.034, 0.05, abs(b.y)));
  float keep = max(1.0 - smoothstep(0.8, 1.0, length(q / float2(0.074, 0.040))), browBox);
  float face = front * (1.0 - hair) * (1.0 - smoothstep(0.17, 0.2, abs(ph.x))) * smoothstep(0.15, 0.2, ph.y);
  float dark = 1.0 - smoothstep(0.2, 0.42, paint.r);
  a = lerp(a, SKIN, face * (1.0 - inside) * (1.0 - keep * dark));
  // from afar the eye's patch one warm tone and the brows one shade (PORTRAIT_EYES_FAR: face 14..26 px, its zone and tones)
  float farK = 1.0 - smoothstep(14.0, 26.0, faceR);
  float far = farK * front * (1.0 - hair) * (1.0 - smoothstep(0.8, 1.0, length(q / float2(0.074, 0.040))));
  a = lerp(a, float3(0.72, 0.475, 0.335), far);
  a = lerp(a, float3(0.6, 0.4, 0.28), farK * front * (1.0 - hair) * browBox * (1.0 - far));
  a = lerp(a, float3(0.022, 0.027, 0.03), hair);   // (the hair one dark ink, as traveller-paint.js leaves it)
  return lerp(albedo, a, inBox * front);
}

// albedo in display values (after the head's linear colours are turned: as the page draws it, after its sRGB line)
float3 portraitFace(float3 albedo, float3 bind)
{
  float3 ph = (bind - _PhFit.xyz) / max(_PhFit.w, 1e-4);
  if (_PhEyeBox.z > _PhEyeBox.x) albedo = portraitEyePaint(albedo, ph);   // (issue #473)
  float front = smoothstep(0.10, 0.18, ph.z);
  float2 eye = float2(ph.x < 0.0 ? -0.118 : 0.125, 0.522);
  float2 q = ph.xy - eye;
  const float3 SKIN = float3(0.79, 0.525, 0.37);
  // the closed eye: one fine line where the lids meet
  float shut = (1.0 - smoothstep(0.052, 0.063, abs(q.x))) * (1.0 - smoothstep(0.024, 0.033, abs(q.y))) * front * smoothstep(0.82, 0.99, _PhBlink.x);
  float closedInk = 1.0 - smoothstep(0.0015, 0.0030, abs(q.y));
  albedo = lerp(albedo, lerp(SKIN, float3(0.16, 0.085, 0.045), closedInk), shut);
  // the mouth's opening (uHeadSpeech.x), a dark oval between the lips
  float ho = _PhSpeech.x, ha = max(fwidth(ph.y), 0.0008), hx = ph.x / (0.087 - 0.013 * ho);
  float hh = 0.022 * ho * sqrt(max(0.0, 1.0 - hx * hx));
  float oral = (1.0 - smoothstep(hh - ha, hh + ha, abs(ph.y - _PhFit2.x))) * (1.0 - smoothstep(0.92, 1.0, abs(hx))) * front * smoothstep(0.02, 0.08, ho);
  return lerp(albedo, float3(0.14, 0.055, 0.045), oral);
}

#endif
