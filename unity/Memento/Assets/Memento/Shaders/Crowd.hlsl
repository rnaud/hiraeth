// The crowd's instanced figures (src/crowd-shader.js CROWD_GLSL, ported): the vertex shader poses
// each instance from a few numbers, so a hundred far people walk, talk, lean and sit with no
// skinning. Figure space as on the web (three space: feet at 0, facing +z, the left at +x); the
// pose is built there and mirrored into Unity's frame afterwards (Surface.shader, MEMENTO_CROWD).
#ifndef MEMENTO_CROWD_INCLUDED
#define MEMENTO_CROWD_INCLUDED

struct CrowdInst
{
    float4 at;      // Unity position, w: yaw (rad, Unity)
    float4 anim;    // aAnim: gait phase at upload, cadence (cycles / s), seed, pose
    float4 react;   // aReact: head yaw, head pitch, talk, startle time
    float4 look0;   // cloak, cloth, legs, skin (0xRRGGBB in floats)
    float4 look1;   // hat, accent, hair, body bits
    float4 dress;   // headwear, mask / chest / prop, cape, robe (costumes.js packDress)
    float4 body;    // female, shoulder width, girth, iris
    float4 scale;   // x: height scale
};
StructuredBuffer<CrowdInst> _CrowdInst;
float _CrowdTime;

float cmod(float x, float y) { return x - y * floor(x / y); }
float3 crowdRGB(float f)
{
    float r = floor(f / 65536.0); f -= r * 65536.0;
    float g = floor(f / 256.0);
    return float3(r, g, f - g * 256.0) / 255.0;
}
float3x3 RX(float a) { float c = cos(a), s = sin(a); return float3x3(1, 0, 0, 0, c, -s, 0, s, c); }
float3x3 RY(float a) { float c = cos(a), s = sin(a); return float3x3(c, 0, s, 0, 1, 0, -s, 0, c); }
float3x3 RZ(float a) { float c = cos(a), s = sin(a); return float3x3(c, -s, 0, s, c, 0, 0, 0, 1); }
void crowdTurn(inout float3 p, inout float3 n, float3 pivot, float3x3 R) { p = pivot + mul(R, p - pivot); n = mul(R, n); }

// how far the robe turns with the thighs at side x and t (belt 0 to hem 1): crowd-shader.js crowdRobeTurn, CROWD_ROBE
float crowdRobeTurn(float2 hip, float x, float t)
{
    float a = lerp(hip.y, hip.x, smoothstep(-0.7, 0.7, x));
    return (a > 0.0 ? a : a * 0.7) * 0.65 * smoothstep(0.0, 0.5, t);
}

void crowdAnimate(CrowdInst I, float4 aRig, inout float3 p, inout float3 n, out float3 col, out float4 trimOut)
{
    float uTime = _CrowdTime;
    float4 aAnim = I.anim, aReact = I.react, aLook0 = I.look0, aLook1 = I.look1, aDress = I.dress, aBody = I.body;
    int part = (int)(aRig.x + 0.5), zone = (int)(aRig.y + 0.5), code = (int)(aRig.z + 0.5);
    int slot = code / 64, pid = code - slot * 64;
    int pose = (int)(aAnim.w + 0.5);
    float seed = aAnim.z;
    int headId = (int)(cmod(aDress.x, 64.0) + 0.5);
    bool hairCap = aDress.x > 63.5;
    // (costumes.js packDress: mask + 16 x chest piece + 512 x prop; the old packing, 8 / 128, showed the wrong pieces, several at once)
    int maskId = (int)(cmod(aDress.y, 16.0) + 0.5), bodyId = (int)(cmod(floor(aDress.y / 16.0 + 0.01), 32.0) + 0.5), propId = (int)(floor(aDress.y / 512.0 + 0.01) + 0.5);
    float capeWide = floor(aDress.z / 2.0 + 0.001);
    float capeLen = aDress.z - capeWide * 2.0;
    capeWide *= 0.1;
    float robeLen = aDress.w;
    float bulk = cmod(aLook1.w, 4.0);
    bool sleeveless = cmod(floor(aLook1.w / 4.0 + 0.01), 2.0) > 0.5;
    float trim = cmod(floor(aLook1.w / 8.0 + 0.01), 16.0);
    float flare = floor(aLook1.w / 128.0 + 0.01) * 0.01;
    float capeShow = capeLen;
    if (pose == 3 || pose == 4) capeLen = min(capeLen, 0.62);
    bool show = slot == 0 || (slot == 1 && pid == headId) || (slot == 2 && pid == maskId) || (slot == 3 && pid == bodyId)
      || (slot == 4 && pid == propId) || (slot == 5 && capeShow > 0.01) || (slot == 6 && robeLen > 0.01) || (slot == 7 && hairCap);
    float tt = pose == 5 ? aReact.w : uTime;
    float ph = 6.2831853 * (aAnim.x + uTime * aAnim.y);
    float amp = clamp(aAnim.y / 0.85, 0.0, 1.3);
    float talk = aReact.z;
    float2 hip = 0, knee = 0.06, shF = 0, shA = 0.07, elb = 0.18, elbIn = 0.1;
    float tP = 0.0, tY = 0.0, tR = 0.0, hP = aReact.y, hY = aReact.x;
    float3 root = 0;
    float tilt = 0.0;
    if (pose == 1)
    {
        float s = sin(ph), c = cos(ph);
        hip = float2(s, -s) * 0.42 * amp;
        knee = float2(max(0.0, c), max(0.0, -c)) * 0.75 * amp + 0.06;
        shF = float2(-s, s) * 0.36 * amp;
        elb = 0.3 + 0.15 * amp;
        root.y = (0.5 + 0.5 * cos(2.0 * ph)) * 0.03 * amp;
        tY = s * 0.09 * amp; tP = 0.05 * amp;
        hY -= tY;
    }
    else
    {
        float sway = sin(tt * 0.45 + seed * 40.0);
        root.x = 0.025 * sway;
        tR = -0.035 * sway;
        knee = float2(sway > 0.0 ? 0.04 : 0.16 * -sway, sway > 0.0 ? 0.16 * sway : 0.04);
        hip = knee * 0.45;
        tP = 0.012 * sin(tt * 1.3 + seed * 9.0);
        float2 lF = 0, lA = 0.07, lE = 0.18, lI = 0.1;
        if (seed < 0.22) { lF = -0.3; lA = 0.08; lE = 0.9; lI = 2.3; }
        else if (seed < 0.42) { lF = -0.15; lA = 0.62; lE = 1.45; lI = 1.6; }
        else if (seed < 0.58) { lF = 0.42; lA = 0.12; lE = 1.4; lI = 0.95; }
        float g1 = sin(tt * 3.1 + seed * 9.0), g2 = sin(tt * 1.7 + seed * 5.0);
        float other = smoothstep(0.2, 0.8, sin(tt * 0.9 + seed * 13.0));
        float2 kF = float2(0.25 + 0.5 * other + 0.15 * g2, 0.45 + 0.2 * g2);
        float2 kA = float2(0.12 + 0.15 * other, 0.22 + 0.1 * g1);
        float2 kE = float2(0.3 + 1.0 * other, 1.15 + 0.35 * g1);
        float2 kI = float2(0.35 * other, 0.3 + 0.2 * g2);
        shF = lerp(lF, kF, talk); shA = lerp(lA, kA, talk); elb = lerp(lE, kE, talk); elbIn = lerp(lI, kI, talk);
        hP += talk * 0.06 * sin(tt * 2.7 + seed * 3.0) + (1.0 - talk) * 0.14 * pow(max(0.0, sin(tt * 1.1 + seed * 31.0)), 8.0);
        hY += 0.12 * sin(tt * 0.31 + seed * 17.0);
        if (pose == 2)
        {
            tP = 0.42; shF = float2(1.05, 0.95); shA = 0.12; elb = float2(1.0, 1.1); elbIn = 0.35;
            hip = float2(-0.12, 0.05); knee = float2(0.35, 0.05); hP -= 0.32;
            root.x = 0.0; tR = 0.0;
        }
        else if (pose == 3)
        {
            float kick = sin(tt * 1.6 + seed * 20.0);
            hip = 1.5; knee = float2(1.5 + 0.25 * kick, 1.5 - 0.25 * kick);
            root = float3(0.0, 0.03 - 0.95, -0.22);
            tP = 0.12; shF = lerp(0.25, shF, talk); shA = lerp(0.22, shA, talk); elb = lerp(0.35, elb, talk);
        }
        else if (pose == 4)
        {
            hip = float2(1.85, 1.75); knee = float2(1.85, 1.75);
            root = float3(0.0, 0.05 - 0.95, -0.12);
            tP = 0.22; shF = lerp(0.65, shF, talk); shA = lerp(0.15, shA, talk); elb = lerp(0.9, elb, talk);
        }
        else if (pose == 6)
        {
            tilt = -0.06; hip = float2(0.0, 0.32); knee = float2(0.04, 0.75);
            shF = 0.42; shA = 0.12; elb = 1.4; elbIn = 0.95; root.x = 0.0; tR = 0.0;
        }
        else if (pose == 5)
        {
            float wob = sin((uTime - aReact.w) * 9.0) * exp(-(uTime - aReact.w) * 2.0);
            hip = float2(0.65, -0.05); knee = float2(1.05, 0.05);
            shF = float2(0.25, -0.15); shA = float2(2.35, 2.55); elb = float2(0.45, 0.25); elbIn = 0;
            tP = -0.2 + 0.06 * wob; tR = 0.12 + 0.1 * wob; hP = -0.22; hY = 0.25;
        }
    }
    float st = uTime - aReact.w;
    if (pose != 5 && st > 0.0 && st < 0.8)
    {
        float k = sin(3.14159 * saturate(st / 0.8));
        root.y += 0.3 * sin(3.14159 * saturate(st / 0.45));
        shA += 1.5 * k; elb += 0.6 * k; hP -= 0.25 * k; knee += 0.5 * k;
    }
    const float HIP = 0.95, HIPX = 0.09, KNEE = 0.5, SHY = 1.43, SHX = 0.2, ELB = 1.13, NECK = 1.5, COLLAR = 1.45;
    float side = (part % 2 == 0) ? 1.0 : -1.0;
    float fem = aBody.x, bw = aBody.y, bg = aBody.z;
    // (crowd-shader.js CROWD_BODY: the full bodies' joints, MakeHuman's and the Quaternius ones')
    float shx = SHX * bw * (1.0 - 0.12 * fem), hipx = HIPX * 1.17;
    if (part == 10)
    {
        // the cape: the open-fronted bell the full people's cloth hangs in (crowd-shader.js CROWD_CAPE)
        float t = aRig.w;
        float k = pow(t, 0.8), below = t * capeLen;
        float wx = max(lerp(0.19, (0.25 + capeLen * 0.17) * capeWide, k) + 0.04 * t, lerp(0.19, 0.29, smoothstep(0.0, 0.16, below)));
        float2 rad = float2(wx, wx * 0.82) * float2(bw * (1.0 - 0.1 * fem), lerp(1.0, bg, 0.5));
        float3 dir = normalize(float3(p.x, 0.0, p.z) + float3(0.0, 0.0, 1e-5));
        p = float3(dir.x * rad.x, COLLAR - below, dir.z * rad.y - 0.02);
        n = normalize(float3(dir.x / rad.x, 0.0, dir.z / rad.y));
        p.z -= t * t * 0.06 * amp;
        p.x += sin(ph) * 0.035 * t * amp;
        p.y += t * t * 0.02 * amp;
        if (pose == 3 || pose == 4) p.z -= t * t * 0.3;
        // the arms under it: the cloth at an arm's height on its side pushed out round the body to clear it
        float sd = p.x >= 0.0 ? 1.0 : -1.0;
        bool lft = sd > 0.0;
        float3 sh = float3(sd * shx, SHY, 0.0);
        float3x3 Rs = mul(RZ(sd * (lft ? shA.x : shA.y)), RX(-(lft ? shF.x : shF.y)));
        float3x3 Re = mul(RY(-sd * (lft ? elbIn.x : elbIn.y)), RX(-(lft ? elb.x : elb.y)));
        float3 el = sh + mul(Rs, float3(0.0, ELB - SHY, 0.0));
        float3 ha = sh + mul(Rs, float3(0.0, ELB - SHY, 0.0) + mul(Re, float3(0.0, -0.3, 0.0)));
        float ar = 0.06 * (1.0 + (bg - 1.0) * 0.45);
        float2 q = p.xz - float2(0.0, -0.02);
        float L = max(length(q), 1e-4), want = L, av = atan2(q.x, q.y);
        [unroll] for (int ia = 0; ia < 4; ia++)
        {
            float3 sp = ia == 0 ? lerp(sh, el, 0.5) : ia == 1 ? el : ia == 2 ? lerp(el, ha, 0.5) : ha;
            float2 qs = sp.xz - float2(0.0, -0.02);
            float aS = atan2(qs.x, qs.y), da = abs(atan2(sin(av - aS), cos(av - aS)));
            float w = (1.0 - smoothstep(0.55, 0.95, da)) * (1.0 - smoothstep(0.25, 0.5, abs(sp.y - p.y))) * smoothstep(0.75, 1.1, abs(aS));
            want = max(want, lerp(L, min(length(qs) + ar, L + 0.15), w));
        }
        // and over the robe, where it swings back with the legs
        float tr = (HIP + 0.01 - p.y) / max(robeLen, 1e-3);
        if (robeLen > 0.01 && pose != 3 && pose != 4 && tr > 0.0 && tr < 1.0)
        {
            float2 rr = lerp(float2(0.165, 0.14), float2(flare, flare * 0.86), pow(tr, 0.85)) * (1.0 + (bg - 1.0) * 0.7 + 0.08 * fem);
            float3 pr = float3(dir.x * rr.x, p.y, dir.z * rr.y - 0.01);
            pr = float3(0.0, HIP, 0.0) + mul(RX(-crowdRobeTurn(hip, dir.x, tr)), pr - float3(0.0, HIP, 0.0));
            want = max(want, length(pr.xz - float2(0.0, -0.02)) + 0.03);
        }
        p.xz = float2(0.0, -0.02) + q * (want / L);
    }
    if (part == 11)
    {
        // the robe: a bell from the belt to its hem, swinging with the thighs; seated, snug over the lap (ROBE_SEAT)
        float t = aRig.w;
        float3 dir = normalize(float3(p.x, 0.0, p.z) + float3(0.0, 0.0, 1e-5));
        bool seated = pose == 3 || pose == 4;
        float yr = HIP + 0.01 - t * robeLen, hemY = HIP + 0.01 - robeLen;
        float kk = seated ? saturate((KNEE - hemY) / 0.35) * pow(saturate((KNEE - 0.05 - yr) / max(KNEE - 0.05 - hemY, 0.05)), 0.85) : pow(t, 0.85);
        float2 rad = lerp(float2(0.165, 0.14), float2(flare, flare * 0.86), kk) * (1.0 + (bg - 1.0) * 0.7 + 0.08 * fem);
        if (seated && dir.z < 0.0) rad.y *= lerp(1.0, 0.4, smoothstep(0.0, 0.14, HIP - yr) * (1.0 - smoothstep(-0.05, 0.07, KNEE - yr)));
        p = float3(dir.x * rad.x, yr, dir.z * rad.y - 0.01);
        n = normalize(float3(dir.x / rad.x, 0.25, dir.z / rad.y));
        if (seated)
        {
            float wl = smoothstep(-0.12, 0.12, p.x);
            float f = smoothstep(0.0, 0.14, HIP - p.y), c = smoothstep(-0.05, 0.07, KNEE - p.y);
            float3 lt = p, ltn = n, ls = p, lsn = n, rt = p, rtn = n, rs = p, rsn = n;
            crowdTurn(lt, ltn, float3(hipx, HIP, 0.0), RX(-hip.x));
            crowdTurn(ls, lsn, float3(hipx, KNEE, 0.0), RX(knee.x)); crowdTurn(ls, lsn, float3(hipx, HIP, 0.0), RX(-hip.x));
            crowdTurn(rt, rtn, float3(-hipx, HIP, 0.0), RX(-hip.y));
            crowdTurn(rs, rsn, float3(-hipx, KNEE, 0.0), RX(knee.y)); crowdTurn(rs, rsn, float3(-hipx, HIP, 0.0), RX(-hip.y));
            float3 legsP = lerp(lerp(rt, rs, c), lerp(lt, ls, c), wl), legN = lerp(lerp(rtn, rsn, c), lerp(ltn, lsn, c), wl);
            p = lerp(p, legsP, f); n = normalize(lerp(n, legN, f));
        }
        else crowdTurn(p, n, float3(0.0, HIP, 0.0), RX(-crowdRobeTurn(hip, dir.x, t)));
    }
    if (bulk > 0.0 && slot == 0 && part != 1 && part < 10 && (zone == 2 || zone == 3 || zone == 9 || zone == 10)) p += n * bulk * 0.014;
    if (part == 0 && slot != 5)
    {
        float y = p.y;
        float belly = exp(-pow((y - 1.06) / 0.16, 2.0)), bust = exp(-pow((y - 1.29) / 0.08, 2.0)), hips = exp(-pow((y - 0.93) / 0.09, 2.0));
        p.x *= lerp(1.0, bw * (1.0 - 0.1 * fem), smoothstep(1.12, 1.38, y)) * (1.0 + (bg - 1.0) * 0.8 * belly) * (1.0 + 0.1 * fem * hips);
        p.z *= p.z > 0.0 ? 1.0 + (bg - 1.0) * 1.5 * belly + 0.3 * fem * bust : 1.0 + (bg - 1.0) * 0.5 * belly + 0.12 * fem * hips;
    }
    else if (part == 0) p.x *= bw * (1.0 - 0.1 * fem);
    else if (part >= 2 && part <= 5)
    {
        float k = slot == 0 ? 1.0 + (bg - 1.0) * (part <= 3 ? 0.6 : 0.3) + (part <= 3 ? 0.05 * fem : 0.0) : 1.0;
        p.x = side * hipx + (p.x - side * HIPX) * k;
        p.z *= k;
    }
    else if (part >= 6 && part <= 9)
    {
        float k = slot == 0 ? 1.0 + (bg - 1.0) * 0.45 : 1.0;
        p.x = side * shx + (p.x - side * SHX) * k;
        p.z *= k;
    }
    if (part == 4 || part == 5)
    {
        int i = part - 4;
        crowdTurn(p, n, float3(side * hipx, KNEE, 0.0), RX(i == 0 ? knee.x : knee.y));
        crowdTurn(p, n, float3(side * hipx, HIP, 0.0), RX(-(i == 0 ? hip.x : hip.y)));
    }
    else if (part == 2 || part == 3)
    {
        crowdTurn(p, n, float3(side * hipx, HIP, 0.0), RX(-(part == 2 ? hip.x : hip.y)));
    }
    else if (part >= 6 && part <= 9)
    {
        bool left = part == 6 || part == 8;
        float3 sh = float3(side * shx, SHY, 0.0);
        if (part >= 8) crowdTurn(p, n, float3(side * shx, ELB, 0.0), mul(RY(-side * (left ? elbIn.x : elbIn.y)), RX(-(left ? elb.x : elb.y))));
        crowdTurn(p, n, sh, mul(RZ(side * (left ? shA.x : shA.y)), RX(-(left ? shF.x : shF.y))));
    }
    else if (part == 1)
    {
        crowdTurn(p, n, float3(0.0, NECK, 0.0), mul(RY(clamp(hY, -1.3, 1.3)), RX(hP)));
    }
    if (part < 2 || (part >= 6 && part != 11)) crowdTurn(p, n, float3(0.0, HIP, 0.0), mul(mul(RY(tY), RZ(tR)), RX(tP)));
    if (tilt != 0.0) crowdTurn(p, n, float3(0, 0, 0), RX(tilt));
    p += root;
    if (!show) p = float3(0.0, HIP, 0.0);

    float3 cloak = crowdRGB(aLook0.x), cloth = crowdRGB(aLook0.y), legs = crowdRGB(aLook0.z), skin = crowdRGB(aLook0.w);
    if (sleeveless && zone == 2 && part >= 6 && part <= 9) zone = 0;
    col = zone == 0 ? skin : zone == 1 ? cloak : zone == 2 ? cloth : zone == 3 ? legs
      : zone == 4 ? float3(0.431, 0.247, 0.172) : zone == 5 ? crowdRGB(aLook1.x) : zone == 6 ? crowdRGB(aLook1.y)
      : zone == 7 ? crowdRGB(aLook1.z) : zone == 8 ? float3(0.169, 0.129, 0.122) : zone == 9 ? legs * 0.6 + float3(0.33, 0.24, 0.1)
      : zone == 10 ? cloak * 0.75 : zone == 11 ? float3(0.169, 0.129, 0.122) : zone == 12 ? float3(0.663, 0.643, 0.576)
      : zone == 13 ? float3(0.541, 0.376, 0.251) : zone == 15 ? float3(0.957, 0.925, 0.863) : float3(1.0, 0.851, 0.541);
    // the eyes, small at this distance: the iris as one dark mark (eyes.js), shut (skin) while they blink
    float blinkT = cmod(uTime + seed * 37.0, 2.6 + seed * 3.4);
    if (zone == 15) col = blinkT < 0.13 ? skin : lerp(aBody.w > 0.5 ? crowdRGB(aBody.w) : float3(0.37, 0.23, 0.14), float3(0.10, 0.085, 0.09), 0.7);
    trimOut = float4(crowdRGB(aLook1.y), zone == 2 && part == 0 && slot == 0 ? trim : 0.0);
}
#endif
