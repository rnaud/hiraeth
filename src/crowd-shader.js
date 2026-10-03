// GPU-animated crowd figures: the vertex shader poses each instance from a few
// per-instance attributes, so hundreds of people walk, talk, lean and sit
// without any CPU skinning. Used by the G-buffer material (makeMaterial({ crowd: true }))
// and by the crowd's own shadow-depth material, so shadows match the pose.
//
// Figure space: feet at y = 0, facing +z, the character's left at +x.
// Per vertex (geometry):
//   aRig.x  part   0 torso · 1 head · 2/3 thigh L/R · 4/5 shin L/R · 6/7 upper arm L/R · 8/9 forearm L/R · 10 cape
//   aRig.y  colour zone (see CROWD_ZONES)
//   aRig.z  variant: 0 always · 1 hood · 2 hat · 3 wrap · 4 hair · 5 hair under a hat/wrap/hair · 6 cape and collar
//   aRig.w  cape: 0 at the collar → 1 at the hem (its position is computed from the length)
// Per instance:
//   aAnim   gait phase at upload (cycles), cadence (cycles / s, 0 standing), seed 0..1, pose (CROWD_POSES)
//   aReact  head yaw (rad, relative to the body), head pitch, talk 0..1, startle time (uTime; stun: frozen time)
//   aLook0  cloak, cloth, legs, skin as 0xRRGGBB packed in floats (exact up to 2^24)
//   aLook1  hat, accent, hair, style = head kind (0 hood, 1 hat, 2 wrap, 3 hair) + 4 * cape length (decimetres)

export const CROWD_POSES = { stand: 0, walk: 1, rail: 2, sit: 3, kerb: 4, stunned: 5, wall: 6 };
export const CROWD_ZONES = { skin: 0, cloak: 1, cloth: 2, legs: 3, boots: 4, hat: 5, accent: 6, hair: 7, lining: 8, belt: 9, cuff: 10 };
export const CROWD_PARTS = { torso: 0, head: 1, thighL: 2, thighR: 3, shinL: 4, shinR: 5, armL: 6, armR: 7, foreL: 8, foreR: 9, cape: 10 };
/** Joint pivots in figure space (metres, scale 1). */
export const CROWD_JOINTS = { hip: 0.95, hipX: 0.09, knee: 0.5, shoulder: 1.43, shoulderX: 0.2, elbow: 1.13, neck: 1.5, collar: 1.45 };

export const CROWD_GLSL = /* glsl */ `
  in vec4 aRig;
  in vec4 aAnim;
  in vec4 aReact;
  in vec4 aLook0;
  in vec4 aLook1;
  uniform float uTime;

  vec3 crowdRGB(float f) {
    float r = floor(f / 65536.0); f -= r * 65536.0;
    float g = floor(f / 256.0);
    return vec3(r, g, f - g * 256.0) / 255.0;
  }
  mat3 crowdRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 crowdRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
  mat3 crowdRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  void crowdTurn(inout vec3 p, inout vec3 n, vec3 pivot, mat3 R) { p = pivot + R * (p - pivot); n = R * n; }

  // Poses p (out: the joint angles) — all in radians.
  //   hip / knee per leg (hip > 0 swings the thigh forward, knee > 0 folds the shin back)
  //   shoulder fwd / abduction, elbow per arm; torso pitch / yaw / roll; head pitch / yaw; root offset
  void crowdAnimate(inout vec3 p, inout vec3 n, out vec3 col) {
    int part = int(aRig.x + 0.5), zone = int(aRig.y + 0.5), variant = int(aRig.z + 0.5);
    int pose = int(aAnim.w + 0.5);
    float seed = aAnim.z;
    float headKind = mod(aLook1.w, 4.0);
    float capeLen = floor(aLook1.w / 4.0 + 0.01) * 0.1;
    float capeShow = capeLen;                 // worn at all
    if (pose == 3 || pose == 4) capeLen = min(capeLen, 0.62);   // seated: it pools on the seat behind

    // costume variants that aren't worn collapse to a point (zero-area triangles)
    bool show = variant == 0 || (variant == 1 && headKind < 0.5) || (variant == 2 && abs(headKind - 1.0) < 0.5)
      || (variant == 3 && abs(headKind - 2.0) < 0.5) || (variant == 4 && headKind > 2.5)
      || (variant == 5 && headKind > 0.5) || (variant == 6 && capeShow > 0.01);

    // stunned people freeze in time; everybody else lives on uTime
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
        // stunned: frozen mid-flail, arms flung up, one knee raised, a little zapped jitter
        hip = vec2(0.65, -0.05); knee = vec2(1.05, 0.05);
        shF = vec2(0.25, -0.15); shA = vec2(2.35, 2.55); elb = vec2(0.45, 0.25); elbIn = vec2(0.0);
        tP = -0.14; tR = 0.12; hP = -0.22; hY = 0.25;
        root = vec3(0.012 * sin(uTime * 61.0), 0.0, 0.0);
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
    if (part == 10) {
      // the cape, rebuilt from its parameters: a flared, open-fronted cone hanging from the shoulders
      float t = aRig.w;
      // shoulders are wider than deep; the cloth falls a little behind the body
      float k = pow(t, 0.8);
      vec2 rad = mix(vec2(0.2, 0.135), vec2(0.25, 0.2) + capeLen * 0.05, k);
      vec3 dir = normalize(vec3(p.x, 0.0, p.z) + vec3(0.0, 0.0, 1e-5));
      p = vec3(dir.x * rad.x, COLLAR - t * capeLen, dir.z * rad.y - 0.02 - 0.05 * t);
      n = normalize(vec3(dir.x / rad.x, 0.0, dir.z / rad.y));
      // flares out behind when walking, sways with the steps
      p.z -= t * t * 0.28 * amp;
      p.x += sin(ph) * 0.035 * t * amp;
      p.y += t * t * 0.08 * amp;
      if (pose == 3 || pose == 4) p.z -= t * t * 0.3;
    }
    if (part == 4 || part == 5) {
      int i = part - 4;
      crowdTurn(p, n, vec3(side * HIPX, KNEE, 0.0), crowdRotX(i == 0 ? knee.x : knee.y));
      crowdTurn(p, n, vec3(side * HIPX, HIP, 0.0), crowdRotX(-(i == 0 ? hip.x : hip.y)));
    } else if (part == 2 || part == 3) {
      crowdTurn(p, n, vec3(side * HIPX, HIP, 0.0), crowdRotX(-(part == 2 ? hip.x : hip.y)));
    } else if (part != 0 && part != 10 && part != 1) {
      bool left = part == 6 || part == 8;
      vec3 sh = vec3(side * SHX, SHY, 0.0);
      if (part >= 8) crowdTurn(p, n, vec3(side * SHX, ELB, 0.0), crowdRotY(-side * (left ? elbIn.x : elbIn.y)) * crowdRotX(-(left ? elb.x : elb.y)));
      crowdTurn(p, n, sh, crowdRotZ(side * (left ? shA.x : shA.y)) * crowdRotX(-(left ? shF.x : shF.y)));
    } else if (part == 1) {
      crowdTurn(p, n, vec3(0.0, NECK, 0.0), crowdRotY(clamp(hY, -1.3, 1.3)) * crowdRotX(hP));
    }
    // the upper body (torso, head, arms, cape) leans, twists and rolls over the hips
    if (part < 2 || part >= 6) crowdTurn(p, n, vec3(0.0, HIP, 0.0), crowdRotY(tY) * crowdRotZ(tR) * crowdRotX(tP));
    if (tilt != 0.0) crowdTurn(p, n, vec3(0.0), crowdRotX(tilt));
    p += root;
    if (!show) { p = vec3(0.0, HIP, 0.0); }

    // ---- printed colour zones
    vec3 cloak = crowdRGB(aLook0.x), cloth = crowdRGB(aLook0.y), legs = crowdRGB(aLook0.z), skin = crowdRGB(aLook0.w);
    col = zone == 0 ? skin : zone == 1 ? cloak : zone == 2 ? cloth : zone == 3 ? legs
      : zone == 4 ? vec3(0.431, 0.247, 0.172) : zone == 5 ? crowdRGB(aLook1.x) : zone == 6 ? crowdRGB(aLook1.y)
      : zone == 7 ? crowdRGB(aLook1.z) : zone == 8 ? vec3(0.169, 0.129, 0.122) : zone == 9 ? legs * 0.6 + vec3(0.33, 0.24, 0.1)
      : cloak * 0.75;
  }
`;
