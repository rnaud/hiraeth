// The G-buffer's normal + view depth at this pixel, for what is laid over the finished picture after the ink composite
// (the washes, the deadly void's dark, a way's light, the motes, the wind's wisps, a recording's figure: each tests itself
// against the scene's depth by hand). _GNormalTex is the G-buffer's own (HiraethFeature: kept bound after its pass).
// The pixel is the target's, scaled to the G-buffer's (_GPixelScale, set by the composite: the G-buffer's size over the
// target's). On the screen they are the same size; a camera drawn into a picture (the bench's and the batch's shots, the
// portraits, the wardrobe) at a render scale under 1 has its G-buffer at that scale but its target, which URP draws into
// without a smaller copy of its own, at the picture's: there the pixel read was the target's, and the Retroid's and the
// Xbox's shots came out with a rectangle of the screen (the render scale's share of its width, up to the horizon as the
// G-buffer has it) drawn one way and the rest the other: the world's deadly void laid over all the ground outside it
// (issue #575). Unset (0) it is 1.
// (HiraethFeature _GFlip: drawn straight into a player's back buffer, which is the other way up from the G-buffer's
// texture, its row read from the bottom; issue #420 / #425)
#ifndef HIRAETH_GAT
#define HIRAETH_GAT
Texture2D _GNormalTex;
float _GFlip;
float4 _GPixelScale;
float4 GAt(float4 cs)
{
  float2 k = _GPixelScale.x > 0.0 ? _GPixelScale.xy : float2(1.0, 1.0);
  float2 q = cs.xy;
  #ifdef UNITY_PRETRANSFORM_TO_DISPLAY_ORIENTATION
    // (a back buffer the display rotates (Vulkan's swap-chain pre-transform, the AYN Odin 3's portrait panel; issue #725):
    // SV_Position is the panel's pixel, a quarter (or half) turn from the picture's; turned back here, in the sense the
    // composite's _TargetFlip and this _GFlip fix on a screen that is not rotated. 0 into a texture and on other screens)
    if (UNITY_DISPLAY_ORIENTATION_PRETRANSFORM != UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_0)
    {
      uint rw, rh; _GNormalTex.GetDimensions(rw, rh);
      float2 L = float2(rw, rh) / k;   // (the target's own size, the picture's way round)
      bool halfTurn = UNITY_DISPLAY_ORIENTATION_PRETRANSFORM == UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_180;
      float2 n = q / (halfTurn ? L : L.yx);
      q = (halfTurn ? 1.0 - n : UNITY_DISPLAY_ORIENTATION_PRETRANSFORM == UNITY_DISPLAY_ORIENTATION_PRETRANSFORM_90 ? float2(n.y, 1.0 - n.x) : float2(1.0 - n.y, n.x)) * L;
    }
  #endif
  int2 p = int2(q * k);
  if (_GFlip > 0.5) { uint gw, gh; _GNormalTex.GetDimensions(gw, gh); p.y = (int)gh - 1 - p.y; }
  return _GNormalTex.Load(int3(p, 0));
}
#endif
