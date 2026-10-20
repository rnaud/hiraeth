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
  int2 p = int2(cs.xy * k);
  if (_GFlip > 0.5) { uint gw, gh; _GNormalTex.GetDimensions(gw, gh); p.y = (int)gh - 1 - p.y; }
  return _GNormalTex.Load(int3(p, 0));
}
#endif
