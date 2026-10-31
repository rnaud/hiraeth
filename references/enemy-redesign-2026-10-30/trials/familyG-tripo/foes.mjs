// #800 family G: each foe's numbers for prepare.mjs (its concept folder, its height, its k-means clusters' roles, the
// reference's flat colours a part, how each texel's part is told, its hands' widening, its landmarks). The colours are
// measured off the approved image (a 7 × 7 median at a lit point of each part); the clusters' roles written by looking
// at prepare.mjs --probe (the cluster's colour and where its vertices are), never guessed.
//
// partAt(role, group, p, ctx, joint, normal, rgb): the texel's part. role: its cluster's (CLUSTERS); group: its
// triangle's limb (arm, leg, head, body: from the weights); p: its place on the mesh (m, the game's frame at size 1,
// centred on the hips); ctx.at: Tripo's joints by name; rgb: the texel's own (median'd) colour, for the small painted
// features no cluster holds (eyes, a lens).
export const FOES = {};

const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
/** A tracked spot's landmark: its centre, breadth, height and how far forward its face is (m). */
const spot = (s) => s && { centre: s.centre, w: +(s.max[0] - s.min[0]).toFixed(4), h: +(s.max[1] - s.min[1]).toFixed(4), front: s.max[2], texels: s.texels };

// ------------------------------------------------------------------ the mummer king
// keep-mummerking/71c2e792-…-1.png: a teal pear (lit #728b7e), darker teal below the knee, a cream mask with two black
// eyes, three ochre crown rods, a terracotta belly patch and knee pads, huge cream gauntlets, cream boots with terracotta
// cuffs. The paddle club is built (src/enemies/plans/mummer-king-tripo.js), not in the mesh.
FOES.mummerking = {
  concept: 'keep-mummerking', height: 2.7, k: 10,
  clusters: { '#476456': 'tealDark', '#638373': 'teal', '#658475': 'teal', '#7c866f': 'grey', '#947753': 'orangeShade', '#b97a3a': 'orange',
    '#b2a67a': 'creamShade', '#d4c089': 'cream', '#e7ce92': 'cream', '#e9d690': 'cream' },
  palette: { body: '#728b7e', shin: '#4a6a5e', mask: '#dfd6a7', eye: '#dfd6a6', crown: '#c38337', patch: '#b96d4a', knee: '#b96e4b', glove: '#dfd7a7', boot: '#dfd6a8', cuff: '#a26a54' },
  track: ['eye'],
  // (the mask drawn as the reference's clean oval on the mesh's front, by geometry: Tripo's texture had it ragged; its
  //  size and place measured off the approved image, scaled by its eyes' spacing to the mesh's: 1 px = 3.4 mm)
  partAt(role, group, p, { at }, joint, n, rgb) {
    const [x, y, z] = p, knee = at.LeftLeg[1], front = n[2] > 0.15, cream = role === 'cream' || role === 'creamShade', orange = role === 'orange' || role === 'orangeShade';
    if (z > 0.1 && front && ((x + 0.01) / 0.235) ** 2 + ((y - 2.13) / 0.265) ** 2 < 1) return lum(rgb) < 70 && y > 2.05 && y < 2.3 && Math.abs(Math.abs(x + 0.01) - 0.122) < 0.06 ? 'eye' : 'mask';
    if (y > 2.35 && orange) return 'crown';
    if (group === 'arm' || Math.abs(x) > at.LeftArm[0] + 0.2) return cream || orange ? 'glove' : 'body';
    // (the belly patch and the knee pads are parts of their own, clean discs (plans/mummer-king-tripo.js): the vertex
    //  colours at 12k triangles drew them blurred; painted over in the body's colours here)
    if (group === 'leg') {
      if (cream) return y < 0.45 ? 'boot' : y < knee ? 'shin' : 'body';
      if (orange) return y < 0.45 && y > 0.12 ? 'cuff' : y < 0.12 ? 'boot' : y < knee ? 'shin' : 'body';
      return y < knee - 0.06 ? 'shin' : 'body';
    }
    return 'body';
  },
  landmarks: ({ spots }) => ({ eyes: { left: spot(spots['eye+x']), right: spot(spots['eye-x']) } }),
};

// ------------------------------------------------------------------ the sentinel
// sentinel/395884ff-…-0.png (the cistern keeper): pale pink ceramic (lit #e5c7b4) for the barrel, its head and the limbs'
// cylinders, purple-black ball joints (#524d5b), a dark slate pelvis band, slate-blue shins and pointed feet (#819696),
// dark grey fists, a black visor slit with one amber eye (the lens is built: plans/sentinel-tripo.js). The shield and the
// blade are built too, not in the mesh.
FOES.sentinel = {
  concept: 'sentinel', height: 2.0, k: 10, spotY: 0.85, spotZ: 0.1,
  clusters: { '#191919': 'black', '#2f3236': 'dark', '#43444b': 'dark', '#566466': 'slate', '#637c7f': 'slate', '#6d888b': 'slate',
    '#8f8277': 'ceramic', '#b5a495': 'ceramic', '#cfbba8': 'ceramic', '#e0c5b0': 'ceramic' },
  palette: { ceramic: '#e5c7b4', joint: '#524d5b', fist: '#3f4a48', pelvis: '#3f5753', shin: '#819696', visor: '#141414' },
  track: ['visor'],
  partAt(role, group, p, { at }) {
    const [x, y, z] = p, knee = at.LeftLeg[1], wrist = at.LeftHand[0] - 0.03;
    if (role === 'black' && y > 1.78 && z > 0.12 && Math.abs(x) < 0.2) return 'visor';
    if (group === 'arm' && Math.abs(x) > wrist) return 'fist';
    if (role === 'black' || role === 'dark') return 'joint';
    if (role === 'slate') return group === 'leg' && y < knee - 0.05 ? 'shin' : group === 'arm' ? 'joint' : 'pelvis';
    return 'ceramic';
  },
  landmarks: ({ spots }) => {
    const a = spots['visor+x'], b = spots['visor-x'];
    const box = { min: [0, 1, 2].map((q) => Math.min(a?.min[q] ?? 9, b?.min[q] ?? 9)), max: [0, 1, 2].map((q) => Math.max(a?.max[q] ?? -9, b?.max[q] ?? -9)) };
    return { visor: { centre: box.min.map((m, q) => +((m + box.max[q]) / 2).toFixed(4)), w: +(box.max[0] - box.min[0]).toFixed(4), h: +(box.max[1] - box.min[1]).toFixed(4), front: box.max[2], texels: (a?.texels ?? 0) + (b?.texels ?? 0) } };
  },
};

// ------------------------------------------------------------------ the hulk
// hulk/69ae4d9f-…-2.png (the root crusher): muted teal skin (lit #799689), a cream chest and belly (#d6cea3), rust-red
// knuckled fists (#ae775b), terracotta toes, two short black slit eyes (rebuilt as parts: plans/hulk-tripo.js) and a dark
// mouth on its small low head. Its rig: Tripo's v1.0 biped rig crossed its arms and set its feet behind it, so its v2.5
// rig (the generic 'tripo' skeleton: Spine_0, Head_0, the …_Limb_n chains) named here as the Mixamo ones (rename), by
// where each joint is: the arm chains by the side they are on (v2.5 named the arms' sides the other way round).
const HULK_NAMES = { 'tripo::Root': 'Root', 'tripo::Spine_0': 'Hips', 'tripo::Head_0': 'Spine2', bone_3: 'LeftShoulder', 'tripo::Head_1': 'RightShoulder', bone_18: 'Neck', bone_19: 'Head', bone_30: 'Pelvis0', bone_31: 'Pelvis1', bone_32: 'Pelvis2' };
FOES.hulk = {
  concept: 'hulk', height: 2.6, k: 10, spotY: 0.6, spotZ: 0.4,
  rename(j) {
    if (HULK_NAMES[j.name]) return HULK_NAMES[j.name];
    const arm = j.name.match(/^tripo::1_(?:Left|Right)_Limb_(\d)$/), leg = j.name.match(/^tripo::0_(Left|Right)_Limb_(\d)$/), s = j.at[0] > 0 ? 'Left' : 'Right';
    if (arm) return `${s}${['Arm', 'ForeArm', 'Hand', 'HandMid', 'HandEnd'][+arm[1]]}`;
    if (leg) return `${leg[1]}${['LegRoot', 'UpLeg', 'Leg', 'Foot', 'ToeBase'][+leg[2]]}`;
    if (/^bone_(9|10|11|17)$/.test(j.name)) return `${s}Thumb${j.name.slice(5)}`;
    throw new Error(`the hulk's joint ${j.name} has no name`);
  },
  fold: (name) => (/^Pelvis|LegRoot$/.test(name) ? 'torso' : /^(Left|Right)(HandMid|HandEnd|Thumb)/.test(name) ? `hand${name.startsWith('Left') ? 1 : 0}` : null),
  clusters: { '#0f100b': 'ink', '#996d4e': 'rust', '#86735d': 'rust', '#455244': 'skin', '#6d7b6c': 'skin', '#648779': 'skin', '#65897b': 'skin', '#67887a': 'skin', '#adad8a': 'belly', '#e4d29b': 'belly' },
  palette: { skin: '#799689', belly: '#d6cea3', fist: '#ae775b', toe: '#ad7b60', mouth: '#141414', eye: '#799688' },
  track: ['eye'],
  partAt(role, group, p, { at }) {
    const [x, y, z] = p, wrist = at.LeftHand[0] - 0.12;
    if (role === 'ink' && z > 0.5 && Math.abs(x) < 0.3) return y > 2.08 ? 'eye' : y > 1.75 ? 'mouth' : 'skin';
    if (group === 'arm' && Math.abs(x) > wrist && role === 'rust') return 'fist';
    if (group === 'leg' && y < 0.25 && role === 'rust') return 'toe';
    if (role === 'belly') return group === 'arm' ? 'skin' : 'belly';
    return 'skin';
  },
  landmarks: ({ spots }) => ({ eyes: { left: spot(spots['eye+x']), right: spot(spots['eye-x']) } }),
};
