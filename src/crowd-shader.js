import * as THREE from 'three';
import { EYE_WHITE } from './eyes.js';

// GPU-animated crowd figures: the vertex shader poses each instance from a few
// per-instance attributes, so hundreds of people walk, talk, lean and sit
// without any CPU skinning. Used by the G-buffer material (makeMaterial({ crowd: true }))
// and by the crowd's own shadow-depth material, so shadows match the pose.
//
// Figure space: feet at y = 0, facing +z, the character's left at +x.
// Per vertex (geometry):
//   aRig.x  part   0 torso · 1 head · 2/3 thigh L/R · 4/5 shin L/R · 6/7 upper arm L/R · 8/9 forearm L/R · 10 cape · 11 robe
//   aRig.y  colour zone (see CROWD_ZONES)
//   aRig.z  costume piece: slot * 64 + id. Slots: 0 always · 1 headwear (HEAD_IDS) · 2 mask (MASK_IDS)
//           · 3 shoulder / chest piece (BODY_IDS) · 4 held prop (PROP_IDS) · 5 cape and its collar
//           · 6 robe · 7 short hair under the headwear (costumes.js has the ids)
//   aRig.w  cape / robe: 0 at the collar / belt → 1 at the hem (their shape comes from the lengths)
// Per instance:
//   aAnim   gait phase at upload (cycles), cadence (cycles / s, 0 standing), seed 0..1, pose (CROWD_POSES)
//   aReact  head yaw (rad, relative to the body), head pitch, talk 0..1, startle time (uTime; stumbling: when the shove landed, the pose's frozen time)
//   aLook0  cloak, cloth, legs, skin as 0xRRGGBB packed in floats (exact up to 2^24)
//   aLook1  hat, accent, hair, body = bulk (0..3) + 4 * sleeveless + 8 * cloth pattern (TRIM_IDS) + 128 * robe hem radius (cm)
//   aDress  headwear + 64 * the hair cap under it (costumes.js HEAD_ID_LIMIT), mask + 16 * chest piece + 256 * prop (MASK_ID_LIMIT, BODY_ID_LIMIT),
//           cape length (m) + 2 * cape width (tenths), robe length (m below the belt, 0 none) — costumes.js packDress
//   aBody   female (0 / 1), shoulder width, girth (costumes.js packBody: the build), iris colour 0xRRGGBB; the height is the instance scale
// A piece that isn't worn collapses to a point (zero-area triangles): every world bakes only its own
// pieces into its figure (crowd.js figureGeometry), so the vertex count stays small.

export const CROWD_POSES = { stand: 0, walk: 1, rail: 2, sit: 3, kerb: 4, stumble: 5, wall: 6 };
export const CROWD_ZONES = { skin: 0, cloak: 1, cloth: 2, legs: 3, boots: 4, hat: 5, accent: 6, hair: 7, lining: 8, belt: 9, cuff: 10, dark: 11, metal: 12, wood: 13, lamp: 14, eye: 15 };
export const CROWD_PARTS = { torso: 0, head: 1, thighL: 2, thighR: 3, shinL: 4, shinR: 5, armL: 6, armR: 7, foreL: 8, foreR: 9, cape: 10, robe: 11 };
/** aRig.z slots (see above). */
export const CROWD_SLOTS = { always: 0, head: 1, mask: 2, body: 3, prop: 4, cape: 5, robe: 6, hairCap: 7 };
/**
 * The figure's body against the full ones it stands in for (docs/makehuman.md): a woman's shoulders and
 * chest this much narrower than a man's (the MakeHuman woman's shoulder joints are 0.168 m out at her
 * height, the man's 0.201; the Quaternius ones narrower still), the hip joints this much wider than
 * CROWD_JOINTS.hipX (MakeHuman's 0.102-0.111 m, the Quaternius 0.111-0.114). Heights: the instance's scale
 * (crowd.js: the full bodies stand as tall, profile.heightFix).
 */
export const CROWD_BODY = { shoulderF: 0.12, chestF: 0.1, hips: 1.17 };
/**
 * The figures' cape against the full people's cloth (npc.js, cape.js: its drape, measured on them):
 * half-width at the collar, over the shoulders (from 16 cm below the collar) and a little wider than
 * the cut's hem at the bottom (`spread`), depth against width, how far it streams back walking (m at
 * the hem, at a stride's amplitude of 1) and the arms' clearance under it (m round the arm's line).
 */
export const CROWD_CAPE = { collar: 0.19, shoulders: 0.29, spread: 0.04, depth: 0.82, stream: 0.06, arm: 0.06 };
/** The figures' cape half-width (m, before the build's width) `t` of the way down a cape `len` long (the shader's, standing still). */
export function crowdCapeHalfWidth(t, len, wide = 1) {
  const C = CROWD_CAPE, lerp = (a, b, k) => a + (b - a) * k, k = Math.pow(t, 0.8);
  const s = Math.min(1, Math.max(0, (t * len) / 0.16)), sm = s * s * (3 - 2 * s);
  return Math.max(lerp(C.collar, (0.25 + len * 0.17) * wide, k) + C.spread * t, lerp(C.collar, C.shoulders, sm));
}
/** The figures' robe on the thighs' swing (crowdRobeTurn): how much of it, and of a thigh's swing back. */
export const CROWD_ROBE = { follow: 0.65, back: 0.7 };
/** Joint pivots in figure space (metres, scale 1). */
export const CROWD_JOINTS = { hip: 0.95, hipX: 0.09, knee: 0.5, shoulder: 1.43, shoulderX: 0.2, elbow: 1.13, neck: 1.5, collar: 1.45 };

const eyeWhite = (() => { const c = new THREE.Color(EYE_WHITE); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; })();
export const CROWD_GLSL = /* glsl */ `
  in vec4 aRig;
  in vec4 aAnim;
  in vec4 aReact;
  in vec4 aLook0;
  in vec4 aLook1;
  in vec4 aDress;
  in vec4 aBody;
  uniform float uTime;
  flat out vec4 vCrowdTrim;   // the tunic's printed pattern: accent colour, pattern id (0 none)
  flat out vec4 vCrowdEye;    // the eyes: iris colour, w = 1 (open; the fragment shader draws them, eyes.js), 0 not an eye

  vec3 crowdRGB(float f) {
    float r = floor(f / 65536.0); f -= r * 65536.0;
    float g = floor(f / 256.0);
    return vec3(r, g, f - g * 256.0) / 255.0;
  }
  mat3 crowdRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 crowdRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 crowdRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  void crowdTurn(inout vec3 p, inout vec3 n, vec3 pivot, mat3 R) { p = pivot + R * (p - pivot); n = R * n; }
  // how far the robe turns with the thighs (hip: their swing) at side x (-1..1 round the body) and t (belt 0 → hem 1):
  // as the full people's skinned robe does on their captured walk (it swung out behind like a skirt in the wind)
  float crowdRobeTurn(vec2 hip, float x, float t) {
    float a = mix(hip.y, hip.x, smoothstep(-0.7, 0.7, x));
    return (a > 0.0 ? a : a * ${CROWD_ROBE.back.toFixed(3)}) * ${CROWD_ROBE.follow.toFixed(3)} * smoothstep(0.0, 0.5, t);
  }

  // Poses p (out: the joint angles) — all in radians.
  //   hip / knee per leg (hip > 0 swings the thigh forward, knee > 0 folds the shin back)
  //   shoulder fwd / abduction, elbow per arm; torso pitch / yaw / roll; head pitch / yaw; root offset
  void crowdAnimate(inout vec3 p, inout vec3 n, out vec3 col) {
    int part = int(aRig.x + 0.5), zone = int(aRig.y + 0.5), code = int(aRig.z + 0.5);
    int slot = code / 64, pid = code - slot * 64;
    int pose = int(aAnim.w + 0.5);
    float seed = aAnim.z;
    // the costume (costumes.js packDress)
    int headId = int(mod(aDress.x, 64.0) + 0.5);
    bool hairCap = aDress.x > 63.5;
    int maskId = int(mod(aDress.y, 16.0) + 0.5), bodyId = int(mod(floor(aDress.y / 16.0 + 0.01), 16.0) + 0.5), propId = int(floor(aDress.y / 256.0 + 0.01) + 0.5);
    float capeWide = floor(aDress.z / 2.0 + 0.001);
    float capeLen = aDress.z - capeWide * 2.0;
    capeWide *= 0.1;
    float robeLen = aDress.w;
    float bulk = mod(aLook1.w, 4.0);
    bool sleeveless = mod(floor(aLook1.w / 4.0 + 0.01), 2.0) > 0.5;
    float trim = mod(floor(aLook1.w / 8.0 + 0.01), 16.0);
    float flare = floor(aLook1.w / 128.0 + 0.01) * 0.01;
    float capeShow = capeLen;                 // worn at all
    if (pose == 3 || pose == 4) capeLen = min(capeLen, 0.62);   // seated: it pools on the seat behind

    // costume pieces that aren't worn collapse to a point (zero-area triangles)
    bool show = slot == 0 || (slot == 1 && pid == headId) || (slot == 2 && pid == maskId) || (slot == 3 && pid == bodyId)
      || (slot == 4 && pid == propId) || (slot == 5 && capeShow > 0.01) || (slot == 6 && robeLen > 0.01) || (slot == 7 && hairCap);

    // a stumbling person is caught mid-flail (frozen in time); everybody else lives on uTime
    float tt = pose == 5 ? aReact.w : uTime;
    float ph = 6.2831853 * (aAnim.x + uTime * aAnim.y);
    float amp = clamp(aAnim.y / 0.85, 0.0, 1.3);
    float talk = aReact.z;

    vec2 hip = vec2(0.0), knee = vec2(0.06);
    vec2 shF = vec2(0.0), shA = vec2(0.07), elb = vec2(0.18), elbIn = vec2(0.1);
    float tP = 0.0, tY = 0.0, tR = 0.0, hP = aReact.y, hY = aReact.x;
    vec3 root = vec3(0.0);
    float tilt = 0.0;   // whole body pitch about the feet

    if (pose == 1) {
      // walking: legs and opposite arms swing, the body bobs and twists a little
      float s = sin(ph), c = cos(ph);
      hip = vec2(s, -s) * 0.42 * amp;
      knee = vec2(max(0.0, c), max(0.0, -c)) * 0.75 * amp + 0.06;
      shF = vec2(-s, s) * 0.36 * amp;
      elb = vec2(0.3 + 0.15 * amp);
      root.y = (0.5 + 0.5 * cos(2.0 * ph)) * 0.03 * amp;
      tY = s * 0.09 * amp; tP = 0.05 * amp;
      hY -= tY;
    } else {
      // weight shift from one leg to the other, breathing
      float sway = sin(tt * 0.45 + seed * 40.0);
      root.x = 0.025 * sway;
      tR = -0.035 * sway;
      knee = vec2(sway > 0.0 ? 0.04 : 0.16 * -sway, sway > 0.0 ? 0.16 * sway : 0.04);
      hip = knee * 0.45;
      tP = 0.012 * sin(tt * 1.3 + seed * 9.0);
      // listeners: hands behind the back, on the hips, arms crossed, or hanging
      vec2 lF = vec2(0.0), lA = vec2(0.07), lE = vec2(0.18), lI = vec2(0.1);
      if (seed < 0.22) { lF = vec2(-0.3); lA = vec2(0.08); lE = vec2(0.9); lI = vec2(2.3); }
      else if (seed < 0.42) { lF = vec2(-0.15); lA = vec2(0.62); lE = vec2(1.45); lI = vec2(1.6); }
      else if (seed < 0.58) { lF = vec2(0.42); lA = vec2(0.12); lE = vec2(1.4); lI = vec2(0.95); }
      // the speaker: hands up, explaining, with a rhythm of their own
      float g1 = sin(tt * 3.1 + seed * 9.0), g2 = sin(tt * 1.7 + seed * 5.0);
      float other = smoothstep(0.2, 0.8, sin(tt * 0.9 + seed * 13.0));
      vec2 kF = vec2(0.25 + 0.5 * other + 0.15 * g2, 0.45 + 0.2 * g2);
      vec2 kA = vec2(0.12 + 0.15 * other, 0.22 + 0.1 * g1);
      vec2 kE = vec2(0.3 + 1.0 * other, 1.15 + 0.35 * g1);
      vec2 kI = vec2(0.35 * other, 0.3 + 0.2 * g2);
      shF = mix(lF, kF, talk); shA = mix(lA, kA, talk); elb = mix(lE, kE, talk); elbIn = mix(lI, kI, talk);
      // talkers bob their heads; listeners nod now and then
      hP += talk * 0.06 * sin(tt * 2.7 + seed * 3.0) + (1.0 - talk) * 0.14 * pow(max(0.0, sin(tt * 1.1 + seed * 31.0)), 8.0);
      hY += 0.12 * sin(tt * 0.31 + seed * 17.0);
      if (pose == 2) {
        // leaning on a railing, forearms on the top, one foot crossed behind
        tP = 0.42; shF = vec2(1.05, 0.95); shA = vec2(0.12); elb = vec2(1.0, 1.1); elbIn = vec2(0.35);
        hip = vec2(-0.12, 0.05); knee = vec2(0.35, 0.05); hP -= 0.32;
        root.x = 0.0; tR = 0.0;
      } else if (pose == 3) {
        // sitting on the edge, legs dangling and swinging over the drop
        float kick = sin(tt * 1.6 + seed * 20.0);
        hip = vec2(1.5); knee = vec2(1.5 + 0.25 * kick, 1.5 - 0.25 * kick);
        root = vec3(0.0, 0.03 - ${0.95}, -0.22);
        tP = 0.12; shF = mix(vec2(0.25), shF, talk); shA = mix(vec2(0.22), shA, talk); elb = mix(vec2(0.35), elb, talk);
      } else if (pose == 4) {
        // sitting on a kerb, knees up, feet on the street below
        hip = vec2(1.85, 1.75); knee = vec2(1.85, 1.75);
        root = vec3(0.0, 0.05 - ${0.95}, -0.12);
        tP = 0.22; shF = mix(vec2(0.65), shF, talk); shA = mix(vec2(0.15), shA, talk); elb = mix(vec2(0.9), elb, talk);
      } else if (pose == 6) {
        // leaning back on a wall, arms crossed, one sole against it
        tilt = -0.06; hip = vec2(0.0, 0.32); knee = vec2(0.04, 0.75);
        shF = vec2(0.42); shA = vec2(0.12); elb = vec2(1.4); elbIn = vec2(0.95); root.x = 0.0; tR = 0.0;
      } else if (pose == 5) {
        // stumbling back from a shove: arms flung up, one knee raised, leaning back, wobbling
        float wob = sin((uTime - aReact.w) * 9.0) * exp(-(uTime - aReact.w) * 2.0);
        hip = vec2(0.65, -0.05); knee = vec2(1.05, 0.05);
        shF = vec2(0.25, -0.15); shA = vec2(2.35, 2.55); elb = vec2(0.45, 0.25); elbIn = vec2(0.0);
        tP = -0.2 + 0.06 * wob; tR = 0.12 + 0.1 * wob; hP = -0.22; hY = 0.25;
      }
    }
    // startled: a little jump, arms flailing, head back
    float st = uTime - aReact.w;
    if (pose != 5 && st > 0.0 && st < 0.8) {
      float k = sin(3.14159 * clamp(st / 0.8, 0.0, 1.0));
      root.y += 0.3 * sin(3.14159 * clamp(st / 0.45, 0.0, 1.0));
      shA += vec2(1.5 * k); elb += vec2(0.6 * k); hP -= 0.25 * k; knee += vec2(0.5 * k);
    }

    // ---- skeleton, children first
    const float HIP = ${0.95}, HIPX = ${0.09}, KNEE = ${0.5}, SHY = ${1.43}, SHX = ${0.2}, ELB = ${1.13}, NECK = ${1.5}, COLLAR = ${1.45};
    float side = (part % 2 == 0) ? 1.0 : -1.0;   // even parts are the left (+x) side
    float fem = aBody.x, bw = aBody.y, bg = aBody.z;
    // where the shoulders and hips now are (CROWD_BODY: the full bodies' joints, MakeHuman's and the Quaternius ones', at the figure's height)
    float shx = SHX * bw * (1.0 - ${CROWD_BODY.shoulderF.toFixed(3)} * fem), hipx = HIPX * ${CROWD_BODY.hips.toFixed(3)};
    if (part == 10) {
      // the cape, rebuilt from its parameters: the open-fronted bell the full people's cloth hangs in
      // (npc.js: its hem as wide as theirs, over the shoulders and the arms hanging under it; a slim
      // cone here had the arms out through its sides, and the cloth jump wider as people came near)
      float t = aRig.w;
      float k = pow(t, 0.8), below = t * capeLen;
      float wx = max(mix(${CROWD_CAPE.collar.toFixed(3)}, (0.25 + capeLen * 0.17) * capeWide, k) + ${CROWD_CAPE.spread.toFixed(3)} * t,
        mix(${CROWD_CAPE.collar.toFixed(3)}, ${CROWD_CAPE.shoulders.toFixed(3)}, smoothstep(0.0, 0.16, below)));
      vec2 rad = vec2(wx, wx * ${CROWD_CAPE.depth.toFixed(3)}) * vec2(bw * (1.0 - ${CROWD_BODY.chestF.toFixed(3)} * fem), mix(1.0, bg, 0.5));
      vec3 dir = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 0.0, 1e-5));
      p = vec3(dir.x * rad.x, COLLAR - below, dir.z * rad.y - 0.02);
      n = normalize(vec3(dir.x / rad.x, 0.0, dir.z / rad.y));
      // heavy wool: barely streams out behind when walking, sways with the steps (it flew out like a flag)
      p.z -= t * t * ${CROWD_CAPE.stream.toFixed(3)} * amp;
      p.x += sin(ph) * 0.035 * t * amp;
      p.y += t * t * 0.02 * amp;
      if (pose == 3 || pose == 4) p.z -= t * t * 0.3;
      // the arms under it: a point of the cloth at an arm's height, on its side, is pushed out round
      // the body to clear it (as the full people's cloth lies over theirs: they swing, gesture, cross
      // or rest on the hips under it), unless the arm is out through the opening in front
      float sd = p.x >= 0.0 ? 1.0 : -1.0;
      bool lft = sd > 0.0;
      vec3 sh = vec3(sd * shx, SHY, 0.0);
      mat3 Rs = crowdRotZ(sd * (lft ? shA.x : shA.y)) * crowdRotX(-(lft ? shF.x : shF.y));
      mat3 Re = crowdRotY(-sd * (lft ? elbIn.x : elbIn.y)) * crowdRotX(-(lft ? elb.x : elb.y));
      vec3 el = sh + Rs * vec3(0.0, ELB - SHY, 0.0);
      vec3 ha = sh + Rs * (vec3(0.0, ELB - SHY, 0.0) + Re * vec3(0.0, -0.3, 0.0));
      float ar = ${CROWD_CAPE.arm.toFixed(3)} * (1.0 + (bg - 1.0) * 0.45);
      vec2 q = p.xz - vec2(0.0, -0.02);
      float L = max(length(q), 1e-4), want = L, av = atan(q.x, q.y);
      for (int i = 0; i < 4; i++) {
        vec3 s = i == 0 ? mix(sh, el, 0.5) : i == 1 ? el : i == 2 ? mix(el, ha, 0.5) : ha;
        vec2 qs = s.xz - vec2(0.0, -0.02);
        float aS = atan(qs.x, qs.y), da = abs(atan(sin(av - aS), cos(av - aS)));
        float w = (1.0 - smoothstep(0.55, 0.95, da)) * (1.0 - smoothstep(0.25, 0.5, abs(s.y - p.y))) * smoothstep(0.75, 1.1, abs(aS));
        want = max(want, mix(L, min(length(qs) + ar, L + 0.15), w));
      }
      // and over the robe, where it swings back with the legs (the full people's cloth lies on theirs: humanoid.js robeCones)
      float tr = (HIP + 0.01 - p.y) / max(robeLen, 1e-3);
      if (robeLen > 0.01 && pose != 3 && pose != 4 && tr > 0.0 && tr < 1.0) {
        vec2 rr = mix(vec2(0.165, 0.14), vec2(flare, flare * 0.86), pow(tr, 0.85)) * (1.0 + (bg - 1.0) * 0.7 + 0.08 * fem);
        vec3 pr = vec3(dir.x * rr.x, p.y, dir.z * rr.y - 0.01);
        pr = vec3(0.0, HIP, 0.0) + crowdRotX(-crowdRobeTurn(hip, dir.x, tr)) * (pr - vec3(0.0, HIP, 0.0));
        want = max(want, length(pr.xz - vec2(0.0, -0.02)) + 0.03);
      }
      p.xz = vec2(0.0, -0.02) + q * (want / L);
    }
    if (part == 11) {
      // the robe: a bell from the belt to its hem, swinging with the thighs
      float t = aRig.w;
      vec3 dir = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 0.0, 1e-5));
      vec2 rad = mix(vec2(0.165, 0.14), vec2(flare, flare * 0.86), pow(t, 0.85)) * (1.0 + (bg - 1.0) * 0.7 + 0.08 * fem);
      p = vec3(dir.x * rad.x, HIP + 0.01 - t * robeLen, dir.z * rad.y - 0.01);
      n = normalize(vec3(dir.x / rad.x, 0.25, dir.z / rad.y));
      crowdTurn(p, n, vec3(0.0, HIP, 0.0), crowdRotX(-crowdRobeTurn(hip, dir.x, t)));
    }
    // a padded suit: the clothes swell along their normals (not the head, hands or costume pieces)
    if (bulk > 0.0 && slot == 0 && part != 1 && part < 10 && (zone == 2 || zone == 3 || zone == 9 || zone == 10)) p += n * bulk * 0.014;
    // the body (costumes.js BUILDS, packBody): a woman's narrower shoulders, fuller hips and bust;
    // a build's shoulder width and girth (the belly most, forward). Heads, hands and feet keep their size.
    if (part == 0 && slot != 5) {
      float y = p.y;
      float belly = exp(-pow((y - 1.06) / 0.16, 2.0)), bust = exp(-pow((y - 1.29) / 0.08, 2.0)), hips = exp(-pow((y - 0.93) / 0.09, 2.0));
      p.x *= mix(1.0, bw * (1.0 - ${CROWD_BODY.chestF.toFixed(3)} * fem), smoothstep(1.12, 1.38, y)) * (1.0 + (bg - 1.0) * 0.8 * belly) * (1.0 + 0.1 * fem * hips);
      p.z *= p.z > 0.0 ? 1.0 + (bg - 1.0) * 1.5 * belly + 0.3 * fem * bust : 1.0 + (bg - 1.0) * 0.5 * belly + 0.12 * fem * hips;
    } else if (part == 0) {
      p.x *= bw * (1.0 - ${CROWD_BODY.chestF.toFixed(3)} * fem);   // the cape's collar sits on the shoulders
    } else if (part >= 2 && part <= 5) {
      float k = slot == 0 ? 1.0 + (bg - 1.0) * (part <= 3 ? 0.6 : 0.3) + (part <= 3 ? 0.05 * fem : 0.0) : 1.0;
      p.x = side * hipx + (p.x - side * HIPX) * k;
      p.z *= k;
    } else if (part >= 6 && part <= 9) {
      float k = slot == 0 ? 1.0 + (bg - 1.0) * 0.45 : 1.0;
      p.x = side * shx + (p.x - side * SHX) * k;
      p.z *= k;
    }
    if (part == 4 || part == 5) {
      int i = part - 4;
      crowdTurn(p, n, vec3(side * hipx, KNEE, 0.0), crowdRotX(i == 0 ? knee.x : knee.y));
      crowdTurn(p, n, vec3(side * hipx, HIP, 0.0), crowdRotX(-(i == 0 ? hip.x : hip.y)));
    } else if (part == 2 || part == 3) {
      crowdTurn(p, n, vec3(side * hipx, HIP, 0.0), crowdRotX(-(part == 2 ? hip.x : hip.y)));
    } else if (part != 0 && part != 10 && part != 1) {
      bool left = part == 6 || part == 8;
      vec3 sh = vec3(side * shx, SHY, 0.0);
      if (part >= 8) crowdTurn(p, n, vec3(side * shx, ELB, 0.0), crowdRotY(-side * (left ? elbIn.x : elbIn.y)) * crowdRotX(-(left ? elb.x : elb.y)));
      crowdTurn(p, n, sh, crowdRotZ(side * (left ? shA.x : shA.y)) * crowdRotX(-(left ? shF.x : shF.y)));
    } else if (part == 1) {
      crowdTurn(p, n, vec3(0.0, NECK, 0.0), crowdRotY(clamp(hY, -1.3, 1.3)) * crowdRotX(hP));
    }
    // the upper body (torso, head, arms, cape) leans, twists and rolls over the hips
    if (part < 2 || (part >= 6 && part != 11)) crowdTurn(p, n, vec3(0.0, HIP, 0.0), crowdRotY(tY) * crowdRotZ(tR) * crowdRotX(tP));
    if (tilt != 0.0) crowdTurn(p, n, vec3(0.0), crowdRotX(tilt));
    p += root;
    if (!show) { p = vec3(0.0, HIP, 0.0); }

    // ---- printed colour zones
    vec3 cloak = crowdRGB(aLook0.x), cloth = crowdRGB(aLook0.y), legs = crowdRGB(aLook0.z), skin = crowdRGB(aLook0.w);
    if (sleeveless && zone == 2 && part >= 6 && part <= 9) zone = 0;   // bare arms
    col = zone == 0 ? skin : zone == 1 ? cloak : zone == 2 ? cloth : zone == 3 ? legs
      : zone == 4 ? vec3(0.431, 0.247, 0.172) : zone == 5 ? crowdRGB(aLook1.x) : zone == 6 ? crowdRGB(aLook1.y)
      : zone == 7 ? crowdRGB(aLook1.z) : zone == 8 ? vec3(0.169, 0.129, 0.122) : zone == 9 ? legs * 0.6 + vec3(0.33, 0.24, 0.1)
      : zone == 10 ? cloak * 0.75 : zone == 11 ? vec3(0.169, 0.129, 0.122) : zone == 12 ? vec3(0.663, 0.643, 0.576)
      : zone == 13 ? vec3(0.541, 0.376, 0.251) : zone == 15 ? ${eyeWhite} : vec3(1.0, 0.851, 0.541);
    // the eyes: a white almond with the iris on it, or shut (skin) while they blink, every few seconds
    float blinkT = mod(uTime + seed * 37.0, 2.6 + seed * 3.4);
    bool shut = zone == 15 && blinkT < 0.13;
    if (shut) col = skin;
    vCrowdEye = vec4(aBody.w > 0.5 ? crowdRGB(aBody.w) : vec3(0.37, 0.23, 0.14), zone == 15 && !shut ? 1.0 : 0.0);
    // the pattern on the tunic (drawn by the fragment shader: TRIM_GLSL)
    vCrowdTrim = vec4(crowdRGB(aLook1.y), zone == 2 && part == 0 && slot == 0 ? trim : 0.0);
  }
`;

/**
 * Printed cloth patterns (costumes.js TRIM_IDS), in rest-pose body space (metres, feet at 0, facing +z):
 * shared by the full NPCs' outfit material and the crowd figures, so both print the same tunic.
 */
export const TRIM_GLSL = /* glsl */ `
  vec3 outfitTrim(vec3 base, vec3 trim, float kind, vec3 b) {
    int k = int(kind + 0.5);
    float ax = abs(b.x);
    bool on = false;
    if (k == 1) on = fract(b.y / 0.09) < 0.32;                                     // stripes
    else if (k == 2) on = abs((b.y - 1.2) + b.x * 0.95) < 0.035;                   // a sash, shoulder to hip
    else if (k == 3) on = b.y > 1.31 || (ax < 0.012 && b.z > 0.0);                 // a uniform's yoke and placket
    else if (k == 4) on = (b.y < 1.27 && ax < 0.11 && b.z > 0.0) || (abs(ax - 0.075) < 0.018 && b.y > 1.26);   // overall bib, straps
    else if (k == 5) on = mod(floor(b.x * 14.0 + b.y * 14.0) + floor(b.x * 14.0 - b.y * 14.0), 2.0) < 0.5;   // diamonds
    else if (k == 6) on = fract(sin(dot(floor(vec2(b.x * 7.0 + b.z * 3.0, b.y * 7.0)), vec2(12.9898, 78.233))) * 43758.5453) > 0.74;   // patches
    else if (k == 7) on = length(fract(vec2(b.x + b.z * 0.5, b.y) * 9.0) - 0.5) < 0.2;   // dots
    else if (k == 8) on = abs(b.y - 1.03) < 0.022 || b.y > 1.4;                 // a band above the belt, a collar
    return on ? trim : base;
  }
`;
