import * as THREE from 'three';
import { makeMaterial } from '../materials.js';

// The reference architecture has stone, glazed ceramic, cast metal and actual
// glazing. Keep these in the game's ink/flat-reflection pipeline; the glass wash
// is composed after the ink, so objects behind a window remain visible.
const stones = new Map();
/** Cut stone in metres: staggered joints, slight differences between blocks and worn edges.
 * Kept in the existing ink shader, with pixel-filtered joints rather than a repeating image. */
export function stone(color, { course = 2.8, width = 6.4, wear = .3 } = {}) {
  const key = `${color}/${course}/${width}/${wear}`;
  if (stones.has(key)) return stones.get(key);
  const m = makeMaterial({ color, weathered: .15, shadeFlat: 0, shade: .22, hatch: .45, key: `landmark.stone.${key}` });
  m.fragmentShader = m.fragmentShader.replace('vec3 albedo = uColor;', `
    vec3 stoneN = abs(normalize(vNormal));
    vec2 stoneP = stoneN.y > .7 ? vWorldPos.xz : vec2(stoneN.x > stoneN.z ? vWorldPos.z : vWorldPos.x, vWorldPos.y);
    float stoneRow = floor(stoneP.y / ${course.toFixed(3)});
    float stoneOffset = hash(vec2(stoneRow, 19.3)) * .65;
    vec2 stoneQ = stoneP / vec2(${width.toFixed(3)}, ${course.toFixed(3)}) + vec2(stoneOffset, 0.0);
    vec2 stoneCell = floor(stoneQ), stoneF = fract(stoneQ);
    vec2 stoneFW = max(fwidth(stoneQ), vec2(.0001));
    vec2 stoneEdge = min(stoneF, 1.0 - stoneF);
    float stoneJoints = max(1.0 - smoothstep(.006, .006 + stoneFW.y, stoneEdge.y), 1.0 - smoothstep(.004, .004 + stoneFW.x, stoneEdge.x));
    stoneJoints *= 1.0 - smoothstep(.3, .8, max(stoneFW.x, stoneFW.y));
    float stoneGrain = vnoise(stoneP * 1.7) - .5;
    float stoneTone = (hash(stoneCell + 23.8) - .5) * .065 + stoneGrain * ${(wear * .08).toFixed(3)};
    float stoneVein = (1.0 - smoothstep(.0, .035, abs(vnoise(stoneP * .23) - .48))) * ${wear.toFixed(3)};
    vec3 albedo = uColor * (1.0 + stoneTone - stoneJoints * .055 - stoneVein * .08);
  `).replace('float detail = 0.0;', 'float detail = stoneJoints * .075 + stoneVein * .045;');
  m.userData.landmarkStone = { course, width, wear };
  stones.set(key, m); return m;
}
export const ceramic = (color, options = {}) => makeMaterial({ color, metal: 'painted', refl: .5, highlight: .2, shadeFlat: .1, shade: .2, hatch: .4, ...options });
export const metal = (color, kind = 'brass') => makeMaterial({ color, metal: kind, brushed: true, refl: kind === 'iron' ? .4 : .8, shade: .2, shadeFlat: .1, hatch: .35 });
export const pearl = (color) => makeMaterial({ color, detail: 'organic', detailDensity: .12, patches: 0, shadeFlat: 0, shade: .55, glow: .12, hatch: .2 });
/** Fine sutures in the shell's skin, avoiding narrow meshes intersecting its curved surface. */
export function nacre(color, center) {
  const m = makeMaterial({color, shadeFlat:0, shade:.55, glow:.12, hatch:.2, key:`landmark.nacre.${center.toArray()}`});
  if(m.userData.nacre)return m;
  m.uniforms.uShellCenter={value:center};
  m.fragmentShader='uniform vec3 uShellCenter;\n'+m.fragmentShader;
  m.fragmentShader=m.fragmentShader.replace('vec3 albedo = uColor;', `
    vec2 shellP=(vWorldPos.xy-uShellCenter.xy)/vec2(20.0,25.0);
    float shellR=length(shellP),shellA=atan(shellP.y,shellP.x);
    float shellTurn=(shellA+4.5*log(max(shellR,.045)))/6.283185;
    float shellCell=(shellA+shellR*.8)*24.0/6.283185;
    float shellFw=max(fwidth(shellTurn),.0001),cellFw=max(fwidth(shellCell),.0001);
    float shellSeam=1.0-smoothstep(.001,.001+shellFw,abs(fract(shellTurn)-.5));
    float shellChamber=(1.0-smoothstep(.003,.003+cellFw,abs(fract(shellCell)-.5)))*smoothstep(.2,.35,shellR);
    float shellInk=max(shellSeam,shellChamber*.48)*smoothstep(.04,.09,shellR);
    vec3 albedo=uColor*(1.0-shellInk*.17);
  `).replace('float detail = 0.0;', 'float detail = shellInk*.13;');
  m.userData.nacre=true;return m;
}
export const glazing = (color, center = new THREE.Vector3()) => makeMaterial({ color, glass: true, glassCenter: center, side: THREE.DoubleSide, line: .35, lineTint: .8, glow: .12, hatch: 0 });

/** Attach the pale body of the panes after K.flush; their rims stay in the ink pass. */
export function glaze(K, veils, mat, { color = '#83bac4', alpha = .17, glow = .08 } = {}) {
  const washes = [];
  for (const mesh of K.group.children) if (mesh.material === mat) {
    // Veils follows this mesh's world matrix/visibility, so it must not be hidden
    // inside a static batch later. Collision still comes from K's solid proxy.
    mesh.userData.noBatch = true;
    washes.push(veils.add(mesh, { color, alpha, glow, side: THREE.FrontSide }));
  }
  return washes;
}
