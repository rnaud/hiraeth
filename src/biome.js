// Regions of the world. Each one has its own ground palette, terrain shape and
// fog, the way Sable gives each area its own mood. The same field is
// evaluated on the CPU (terrain height, fog around the player) and in GLSL
// (ground colours, cracks), so both versions live here.

const field = (x, z) =>
  Math.sin(x * 0.0021) * Math.cos(z * 0.0017 - 0.7) + 0.5 * Math.sin((x + z) * 0.0011);

const smooth = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** @returns {{ rose: number, salt: number }} weights in 0..1 (golden dunes = remainder) */
export function biomeWeights(x, z) {
  const f = field(x, z);
  return { rose: smooth(0.3, 0.6, f), salt: smooth(-0.3, -0.6, f) };
}

export const BIOMES = {
  // (the golden dunes in the plates' ochre: IMG_3772–3775 print the sand a warm orange-gold, not a cream; October 2026)
  dunes: { name: 'Golden dunes', ground: ['#eec07c', '#f4d6a2', '#d9955e'], horizon: [1, 1, 1], fog: 1.0 },
  rose: { name: 'Rose canyons', ground: ['#eab79e', '#f3cdb8', '#c9836f'], horizon: [1.0, 0.93, 0.91], fog: 1.35 },
  salt: { name: 'Salt flats', ground: ['#ebe6d8', '#f6f2e8', '#b9b6c6'], horizon: [0.95, 1.0, 1.03], fog: 0.65 },
};

const v3 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `vec3(${((n >> 16) & 255) / 255}, ${((n >> 8) & 255) / 255}, ${(n & 255) / 255})`;
};

export const BIOME_GLSL = /* glsl */ `
  float biomeField(vec2 p) {
    return sin(p.x * 0.0021) * cos(p.y * 0.0017 - 0.7) + 0.5 * sin((p.x + p.y) * 0.0011);
  }
  // x = rose canyons, y = salt flats (golden dunes = remainder)
  vec2 biomeWeights(vec2 p) {
    float f = biomeField(p);
    return vec2(smoothstep(0.3, 0.6, f), smoothstep(-0.3, -0.6, f));
  }
  void biomeGround(vec2 w, out vec3 c1, out vec3 c2, out vec3 c3) {
    c1 = mix(mix(${v3(BIOMES.dunes.ground[0])}, ${v3(BIOMES.rose.ground[0])}, w.x), ${v3(BIOMES.salt.ground[0])}, w.y);
    c2 = mix(mix(${v3(BIOMES.dunes.ground[1])}, ${v3(BIOMES.rose.ground[1])}, w.x), ${v3(BIOMES.salt.ground[1])}, w.y);
    c3 = mix(mix(${v3(BIOMES.dunes.ground[2])}, ${v3(BIOMES.rose.ground[2])}, w.x), ${v3(BIOMES.salt.ground[2])}, w.y);
  }
`;

/** Blended fog multiplier and horizon tint for a position. */
export function biomeAtmosphere(x, z) {
  const w = biomeWeights(x, z);
  const d = 1 - w.rose - w.salt;
  const tint = [0, 1, 2].map((i) => BIOMES.dunes.horizon[i] * d + BIOMES.rose.horizon[i] * w.rose + BIOMES.salt.horizon[i] * w.salt);
  const fog = BIOMES.dunes.fog * d + BIOMES.rose.fog * w.rose + BIOMES.salt.fog * w.salt;
  const name = w.rose > 0.5 ? BIOMES.rose.name : w.salt > 0.5 ? BIOMES.salt.name : BIOMES.dunes.name;
  return { tint, fog, name, w };
}
