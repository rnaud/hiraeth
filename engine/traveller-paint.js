import * as THREE from 'three';

// The coral-shirt traveller's colours in an engine (engine/game.js engineColours, issue #264): his textures are JPEGs no
// engine VM decodes, so their colours go on as vertex colours; what the page's shaders then do to them is done here once.
/** Colours (rgb × n) of the vertices `has(i)` doesn't know, from their neighbours along the triangles, a ring at a time. */
export function fillUnfound(geometry, c, has) {
  const n = geometry.attributes.position.count, idx = geometry.index?.array;
  const known = new Uint8Array(n);
  for (let i = 0; i < n; i++) known[i] = has(i) ? 1 : 0;
  if (!idx) return;
  for (let pass = 0; pass < 24; pass++) {
    const sum = new Float32Array(n * 3), cnt = new Uint16Array(n);
    for (let t = 0; t < idx.length; t += 3) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const i = idx[t + a], j = idx[t + b];
      if (a === b || known[i] || !known[j]) continue;
      sum[i * 3] += c[j * 3]; sum[i * 3 + 1] += c[j * 3 + 1]; sum[i * 3 + 2] += c[j * 3 + 2]; cnt[i]++;
    }
    let left = 0;
    for (let i = 0; i < n; i++) if (!known[i]) { if (cnt[i]) { for (let k = 0; k < 3; k++) c[i * 3 + k] = sum[i * 3 + k] / cnt[i]; known[i] = 2; } else left++; }
    for (let i = 0; i < n; i++) if (known[i] === 2) known[i] = 1;
    if (!left) break;
  }
}
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * The portrait head's paint as the page's shader leaves it (src/characters/portrait-head.js wearPortraitHeadFace), done
 * once on its vertex colours for an engine (whose shaders don't carry that one, issue #264): the hair one dark ink, the
 * generator's black hatch patch under the chin and its baked shading taken off the neck and the face, one flat skin over
 * them, the painted eyes and brows kept. (Without it Unity's close-ups had ink blotches on his chin and neck and a darker
 * skin.) The colours are linear (the shader turns them to display values): worked in display values, put back linear.
 */
export function portraitPaint(head) {
  const g = head.geometry, P = g.attributes.position, C = g.attributes.color, H = g.attributes._portrait_hair;
  const F = head.userData.portraitHeadFit;
  if (!P || !C || C.itemSize !== 3 || !F) return false;
  const col = new THREE.Color(), skin = [0.79, 0.525, 0.37], hairInk = [0.022, 0.027, 0.03];
  const mix = (a, b, t) => { for (let k = 0; k < 3; k++) a[k] += (b[k] - a[k]) * t; };
  for (let i = 0; i < P.count; i++) {
    const x = (P.getX(i) - F.offset[0]) / F.scale, y = (P.getY(i) - F.offset[1]) / F.scale, z = (P.getZ(i) - F.offset[2]) / F.scale;
    col.setRGB(C.getX(i), C.getY(i), C.getZ(i)).convertLinearToSRGB();
    const a = [col.r, col.g, col.b], paint = a.slice();
    const hair = Math.min(1, Math.max(0, H ? H.getX(i) : 0));
    const front = smooth01(0.1, 0.18, z);
    const qx = x - (x < 0 ? -0.118 : 0.125), qy = y - 0.522;
    const inside = (1 - smooth01(0.78, 1, Math.hypot(qx / 0.052, qy / 0.024))) * front;
    const warm = smooth01(0.06, 0.17, a[0] - a[1]) * smooth01(0.12, 0.25, a[0] - a[2]) * smooth01(0.28, 0.62, a[0]);
    mix(a, skin, 0.65 * warm * (1 - hair) * (1 - inside));
    mix(a, skin, (1 - smooth01(0.14, 0.19, y)) * (1 - hair));   // (the hatch patch under the chin)
    const bx = Math.abs(x) - 0.12, by = y - 0.592;
    const keep = Math.max(1 - smooth01(0.8, 1, Math.hypot(qx / 0.074, qy / 0.04)), (1 - smooth01(0.085, 0.11, Math.abs(bx))) * (1 - smooth01(0.034, 0.05, Math.abs(by))));
    const face = front * (1 - hair) * (1 - smooth01(0.17, 0.2, Math.abs(x))) * smooth01(0.15, 0.2, y);
    const dark = 1 - smooth01(0.2, 0.42, paint[0]);
    // (the page draws the nose, the lips and the jaw again from its own pen lines, a texture the engines don't carry:
    // here the paint's own darker marks are kept there, so the face keeps a mouth)
    const lips = 1 - smooth01(0.8, 1, Math.hypot(x / 0.1, (y - F.mouthY) / 0.035)), nose = 1 - smooth01(0.8, 1, Math.hypot((x - 0.01) / 0.07, (y - 0.4) / 0.07));
    const marks = Math.max(lips, nose) * (1 - smooth01(0.42, 0.6, paint[0]));
    mix(a, skin, Math.max(face * (1 - inside) * (1 - Math.max(keep * dark, marks)), (1 - smooth01(0.28, 0.32, y)) * (1 - hair) * (1 - marks)));
    mix(a, hairInk, hair);
    col.setRGB(a[0], a[1], a[2]).convertSRGBToLinear();
    C.setXYZ(i, col.r, col.g, col.b);
  }
  C.needsUpdate = true;
  return true;
}
