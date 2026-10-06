// The ink surface for skinned meshes: three's skinning in the vertex shader, from a texture of
// the bone matrices the mirror sends each frame (ink.gdshaderinc, SKINNED).
shader_type spatial;
render_mode diffuse_lambert, specular_disabled, ambient_light_disabled;
#define SKINNED
#include "res://shaders/ink.gdshaderinc"
