// #800 family H: the warlord's (the resonator chief's) rigged Tripo export (../../warlord/tripo/rigged.glb, untouched:
// Tripo's biped rig, Mixamo names, 23 joints) made into the game's asset (public/enemies/warlord/body.glb + skeleton.json)
// and the trial's (warlord-lod.glb, warlord-texture.png), by prep-biped.mjs's steps. Its own:
//
// - HEIGHT: the egg's top in the T-pose (m at size 1): the warlord's 2.5 m (its def's height);
// - the parts: the brick red-orange egg that is its head and body, its arms and legs; the cream throat chamber and the
//   cream gloved hands; the plum shoes; the salmon belly under the throat chamber, which Tripo's texture lost (a lighter
//   orange smudge at most) and the T-pose sheets and the approved picture draw: painted by place, an oval on the egg's
//   front (BELLY); Tripo's darker and lighter oranges folded into the one body colour;
// - the painted eyes (two heavy-lidded black slits high on the egg's front, either side) painted out: the game gives it
//   real eyes on its head's bone, measured here (skeleton.json eyes).
//
//   node references/enemy-redesign-2026-10-30/trials/familyH-tripo/prepare-warlord.mjs
import { prepare } from './prep-biped.mjs';

const HEIGHT = 2.5;
/** The k-means' clusters (K 6, deterministic; the nearest within 16 of these) and the part each one is ('ink' the plum shoes and the painted slits; the cream's orange-edged border the body). */
const CLUSTERS = { '#612b41': 'ink', '#aa3920': 'body', '#ce4a24': 'body', '#ca4b24': 'body', '#d8572e': 'body', '#e09963': 'body', '#efc387': 'cream' };
/** One flat colour a part, the reference's own (measured off the approved image; the belly the T-pose sheets' salmon). */
export const PALETTE = { body: '#c75c3f', belly: '#dc7a54', cream: '#e4c89b', shoe: '#51304a' };
/** The salmon belly: an oval on the egg's front (m: its middle's x and y, its half width and height), in front of `z`. */
export const BELLY = { x: -0.03, y: 1.02, w: 0.42, h: 0.34, z: 0.16 };
/** Its edge's field (negative inside): the mesh is cut exactly on it (prep-biped.mjs cutAlong), so the salmon stops on a clean oval. */
const belly = (p) => (p[2] > BELLY.z ? ((p[0] - BELLY.x) / BELLY.w) ** 2 + ((p[1] - BELLY.y) / BELLY.h) ** 2 - 1 : 1);
/** The painted eyes: the ink this high (m). */
const EYE_Y = 2.2;

const { report } = await prepare({
  id: 'warlord', concept: 'warlord', rigged: 'references/enemy-redesign-2026-10-30/warlord/tripo/rigged.glb', height: HEIGHT, target: 12000, K: 6,
  tasks: { generation: '3216cc93-6b2d-44f7-8801-4b402b85455d', rig: '7a282536-4587-4df4-91f2-d265dfb2f3d7' },
  clusters: CLUSTERS, palette: PALETTE,
  // (the belly's oval; the cream's and the shoes' own borders, smoothed through Tripo's ragged edges)
  cuts: [{ name: 'belly', field: belly }, { name: 'cream', roles: ['cream'], smooth: 6 }, { name: 'shoe', roles: ['ink'], smooth: 3, only: (p) => p[1] < 0.3 }],
  partAt: (role, group, p, L, inside) => (inside.cream ? 'cream' : inside.shoe ? 'shoe' : inside.belly ? 'belly' : 'body'),
  eyes: (p, role) => (role === 'ink' && p[1] > EYE_Y && Math.abs(p[0] + 0.03) > 0.04 ? (p[0] > -0.03 ? 1 : 2) : 0), eyePaint: 'body',
});
console.log(JSON.stringify(report));
