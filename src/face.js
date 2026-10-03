import * as THREE from 'three';

// Rest-space ink follows the skinned head without a painted image or facial bones.
export const PORTRAIT_GLSL = `
uniform float uPortrait;
uniform vec4 uExpression; // blink, smile, mouth opening, brow lift
uniform vec2 uGaze;
float portraitLine(float d, float width, float aa) {
  return 1.0-smoothstep(width, width+aa, abs(d));
}
float portraitInk(vec3 p) {
  float aa = max(fwidth(p.x)+fwidth(p.y), .00035);
  float x = abs(p.x), y = p.y;
  float eyeX = p.x-sign(p.x)*.039-uGaze.x;
  float eyeY = y-1.843-uGaze.y;
  float open = 1.0-uExpression.x;
  float lid = portraitLine(eyeY-.003*open-.002*(eyeX/.013)*(eyeX/.013), .0009, aa)
    * (1.0-smoothstep(.011,.014,abs(eyeX)));
  float pupil = 1.0-smoothstep(1.0,1.0+aa/.003,
    length(vec2(eyeX/.003,eyeY/max(.001,.0045*open))));
  float ink = max(lid, pupil*open);
  float browY = 1.864+uExpression.w*.006-.08*(x-.039);
  ink=max(ink,portraitLine(y-browY,.0007,aa)*(1.0-smoothstep(.010,.014,abs(x-.039))));
  // A short nostril tick and a single curved mouth keep the face sparse.
  ink=max(ink,portraitLine(y-1.779,.0007,aa)*(1.0-smoothstep(.001,.003,abs(x-.010))));
  float mouthY=1.748+uExpression.y*.009*((p.x/.020)*(p.x/.020));
  float mouthWidth=.001+uExpression.z*.007;
  ink=max(ink,portraitLine(y-mouthY,mouthWidth,aa)*(1.0-smoothstep(.016,.021,abs(p.x))));
  return ink*smoothstep(.080,.105,p.z);
}
`;

export class FaceExpression {
  constructor() {
    this.time = 0;
    this.uniforms = { uPortrait: { value: 1 }, uExpression: { value: new THREE.Vector4() }, uGaze: { value: new THREE.Vector2() } };
  }
  update(dt, { speed = 0, climbing = false, blink, smile = 0, mouth, brow = 0 } = {}) {
    this.time += Math.max(0, dt);
    const phase = this.time % 4.3;
    const naturalBlink = phase < .18 ? Math.sin(Math.PI * phase / .18) ** 2 : 0;
    const effort = climbing ? .65 : THREE.MathUtils.clamp(speed / 7, 0, 1);
    const v = this.uniforms.uExpression.value;
    v.set(THREE.MathUtils.clamp(blink ?? naturalBlink, 0, 1), THREE.MathUtils.clamp(smile, -1, 1),
      THREE.MathUtils.clamp(mouth ?? effort * (.25 + .15 * Math.sin(this.time * 5)), 0, 1), THREE.MathUtils.clamp(brow, -1, 1));
    this.uniforms.uGaze.value.set(Math.sin(this.time * .53) * .0015, Math.sin(this.time * .31) * .0007);
  }
}

// The inspection viewer uses the identical ink function with its unlit material.
export function attachPortraitPreview(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vPortrait;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPortrait = position;');
    shader.fragmentShader = 'varying vec3 vPortrait;\n' + PORTRAIT_GLSL + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.10,.085,.09), portraitInk(vPortrait));');
  };
  material.customProgramCacheKey = () => 'traveller-portrait-v1';
}
