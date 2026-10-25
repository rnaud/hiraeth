// The generated guardian inputs used by Node audits. Literal reads keep the
// dependency graph exact; the completeness test rejects newly unlisted skins.
import { readFileSync, existsSync } from 'node:fs';
import { readKeeperSkin } from './keeper-input.mjs';
const readers = {
  'keeper-v1': readKeeperSkin,
  'elder-v1': () => readFileSync(existsSync(new URL('../../public/guardians/elder-v1/model.glb', import.meta.url))
    ? new URL('../../public/guardians/elder-v1/model.glb', import.meta.url)
    : new URL('../../data/guardians/elder-v1/model.glb', import.meta.url)),
  'elder-v3': () => readFileSync(existsSync(new URL('../../public/guardians/elder-v3/model.glb', import.meta.url))
    ? new URL('../../public/guardians/elder-v3/model.glb', import.meta.url)
    : new URL('../../data/guardians/elder-v3/model.glb', import.meta.url)),
};
export const GUARDIAN_SKIN_INPUTS = Object.freeze(Object.keys(readers));
export function readGuardianSkin(name) {
  if (!Object.hasOwn(readers, name)) throw new Error(`Undeclared guardian audit input: ${name}`);
  return readers[name]();
}
// GLTFLoader's game-facing URL form. No arbitrary paths, traversal or schemes.
export function readGuardianModelUrl(url) {
  const match = /^guardians\/(keeper-v1|elder-v1|elder-v3)\/model\.glb$/.exec(String(url).replace(/^\/+/, ''));
  if (!match) throw new Error(`Undeclared guardian model URL: ${url}`);
  return readGuardianSkin(match[1]);
}
