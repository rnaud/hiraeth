import { Float32BufferAttribute } from 'three';

// Identify the connected dark scalp, rather than treating every dark pixel on
// the face (brows, eyes, lip ink) as hair. Weld UV seams for connectivity only.
export function markTripoHair(geometry, colors) {
  const p = geometry.attributes.position, count = p.count;
  const nodes = [], vertexNode = [], welded = new Map();
  for (let i = 0; i < count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = [x, y, z].map(v => Math.round(v * 100000)).join(',');
    let n = welded.get(key);
    if (n === undefined) { n = nodes.length; welded.set(key, n); nodes.push({ x, y, z, dark: false, edges: new Set(), hair: false }); }
    vertexNode.push(n);
    const c = colors[i];
    nodes[n].dark ||= (y > 1.59 || (y > 1.52 && z < -0.005)) && c[0] < 85 && c[1] < 75 && c[2] < 70;
  }
  const idx = geometry.index;
  for (let i = 0; i < (idx?.count ?? count); i += 3) {
    const face = [0, 1, 2].map(k => vertexNode[idx ? idx.getX(i + k) : i + k]);
    for (const a of face) for (const b of face) if (a !== b) nodes[a].edges.add(b);
  }
  const queue = [];
  nodes.forEach((n, i) => { if (n.dark && n.y > 1.685) { n.hair = true; queue.push(i); } });
  for (let q = 0; q < queue.length; q++) for (const j of nodes[queue[q]].edges) {
    const n = nodes[j];
    if (n.dark && !n.hair) { n.hair = true; queue.push(j); }
  }
  // Fill isolated light texels surrounded by hair, without growing into skin.
  const holes = nodes.map(n => !n.hair && n.y > 1.63 && n.edges.size > 2 && [...n.edges].filter(j => nodes[j].hair).length / n.edges.size >= 0.75);
  holes.forEach((fill, i) => { if (fill) nodes[i].hair = true; });
  // The generated texture leaves a narrow tan fringe on black locks. Bridge
  // that spill in surface distance, not texture space (UV islands aren't adjacent).
  // Only bridge the temples and nape: leave the thin forehead locks unchanged.
  let distances = nodes.map(n => n.hair ? 0 : Infinity);
  for (let pass = 0; pass < 6; pass++) {
    const next = distances.slice();
    nodes.forEach((n, i) => {
      if (n.y < 1.52 || (n.y < 1.59 && n.z >= -0.005)) return;
      for (const j of n.edges) {
        const a = nodes[j];
        next[i] = Math.min(next[i], distances[j] + Math.hypot(n.x - a.x, n.y - a.y, n.z - a.z));
      }
    });
    distances = next;
  }
  nodes.forEach((n, i) => { if (distances[i] < 0.004 && (Math.abs(n.x) > 0.055 || n.z < 0.025)) n.hair = true; });
  // Clean the complete head surface, including black painted shadows below
  // the jaw. A spatial neck boundary avoids mistaking the cream scarf for skin.
  const skin = nodes.map(n => {
    if (n.hair) return 0;
    if (n.y >= 1.555) return 1;
    const neckRadius = Math.hypot(n.x / 0.043, (n.z + 0.005) / 0.046);
    return Math.max(0, Math.min(1, (n.y - 1.485) / 0.018)) * Math.max(0, Math.min(1, (1.12 - neckRadius) / 0.15));
  });
  // Weld the generated skin normals across UV seams, then remove small scan
  // ripples from lighting. Positions/silhouette and the hair normals are untouched.
  const normal = geometry.attributes.normal;
  let smooth = nodes.map(() => [0, 0, 0]);
  for (let i = 0; i < count; i++) {
    const n = smooth[vertexNode[i]];
    n[0] += normal.getX(i); n[1] += normal.getY(i); n[2] += normal.getZ(i);
  }
  const unit = a => { const d = Math.hypot(...a) || 1; return a.map(v => v / d); };
  smooth = smooth.map(unit);
  for (let pass = 0; pass < 4; pass++) smooth = nodes.map((n, i) => {
    if (skin[i] < 0.85) return smooth[i];
    const sum = smooth[i].map(v => v * 2);
    for (const j of n.edges) if (skin[j] > 0.85) for (let k = 0; k < 3; k++) sum[k] += smooth[j][k];
    return unit(sum);
  });
  for (let i = 0; i < count; i++) if (skin[vertexNode[i]] > 0.85) normal.setXYZ(i, ...smooth[vertexNode[i]]);
  normal.needsUpdate = true;
  geometry.setAttribute('travellerSkin', new Float32BufferAttribute(vertexNode.map(n => skin[n]), 1));
  geometry.setAttribute('travellerHair', new Float32BufferAttribute(vertexNode.map(n => nodes[n].hair ? 1 : 0), 1));
}
