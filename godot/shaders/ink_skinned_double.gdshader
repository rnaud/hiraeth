// The skinned ink surface, both sides drawn (capes, robes): ink.gdshaderinc, SKINNED.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled, ambient_light_disabled, cull_disabled;
#define SKINNED
#include "res://shaders/ink.gdshaderinc"
