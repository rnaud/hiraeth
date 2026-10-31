// #800 family G: the ragdoll's particle sizes of a body (src/enemies/foe-ragdoll.js bodyShape), the rebuilt one beside its
// legacy builder, to see which limb the drawn mesh makes thick.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/shape-probe.mjs <kind> [legacyBuilderModule#name]
import { archetypeModel } from '../../../../src/enemies/plans/index.js';
import { skinOf } from '../../../../src/enemies/skins.js';
import { bodyShape } from '../../../../src/enemies/foe-ragdoll.js';
import { JOINTS } from '../../../../src/ragdoll.js';

const kind = process.argv[2] ?? 'hulk';
const show = (name, M) => { M.group.updateMatrixWorld(true); const s = bodyShape(M.joints, M.size ?? 1); console.log(name.padEnd(8), 'head', s.head?.toArray().map((q) => q.toFixed(2)), JOINTS.map(([n], i) => `${n}:${s.radii[i].toFixed(2)}`).join(' ')); };
show('tripo', archetypeModel(kind, 'desert'));
if (process.argv[3]) { const [mod, fn] = process.argv[3].split('#'); const m = await import(new URL(`../../../../${mod}`, import.meta.url).href); show('legacy', m[fn](skinOf(kind, 'desert'))); }
