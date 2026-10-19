// A light added to the finished picture as the web adds it (issue #502). three's AdditiveBlending adds a light's colour
// times its alpha to the page's sRGB values: display + c. Unity's target is linear (sRGB decoded as it is written), where
// the same add came out too dark over a lit wall and too bright over a black one; before #502 its alpha was brought down
// (a^1.5) for the black, and a temple's first room seen through its way in (the door's light filling the view) came out
// ΔE 10-15 darker than the web's. Here the add is matched over every base in two blends, an affine map of the linear
// value: L' = A + M L, fitted (least squares, display error) to the web's sRGB add for each c (per channel, 0..1):
//   M - 1 = 2.82 c + 4.39 c², at most 1 (the first blend: DstColor One, its source M - 1), and
//   A = 0.164 c + 1.065 c² (the second: One One).
// Within 1-8 of 255 rms against the web for c up to 0.3 (the door's middle, its pool, a way's rays), 12-15 past it (its
// frame's brightest bands, where the web's add clips to white anyway); the a^1.5 it replaces was 4-30 off.
// Each light draws twice: its first blend the shader's SRPDefaultUnlit pass, which URP's forward pass draws before its
// UniversalForward one (DrawObjectsPass: SRPDefaultUnlit, UniversalForward, UniversalForwardOnly), on the same pixels.
// The fit's twin: tests/unity-light-add.test.js.
#ifndef HIRAETH_LIGHT_ADD
#define HIRAETH_LIGHT_ADD
// (c: the light's colour times its alpha, in display values as the web's)
float3 LightAddMul(float3 c) { c = saturate(c); return min(2.82 * c + 4.39 * c * c, 1.0); }
float3 LightAddConst(float3 c) { c = saturate(c); return 0.164 * c + 1.065 * c * c; }
#endif
