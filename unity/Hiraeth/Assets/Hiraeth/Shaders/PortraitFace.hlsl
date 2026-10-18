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
#endif

// albedo in display values (after the head's linear colours are turned: as the page draws it, after its sRGB line)
float3 portraitFace(float3 albedo, float3 bind)
{
  float3 ph = (bind - _PhFit.xyz) / max(_PhFit.w, 1e-4);
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
