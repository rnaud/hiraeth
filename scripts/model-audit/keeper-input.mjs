// Keeper-only audits must not load or select the Elder's model inputs.
import {readFileSync,existsSync} from 'node:fs';
export function readKeeperSkin() {
 return readFileSync(existsSync(new URL('../../public/guardians/keeper-v1/model.glb',import.meta.url))
  ? new URL('../../public/guardians/keeper-v1/model.glb',import.meta.url)
  : new URL('../../data/guardians/keeper-v1/model.glb',import.meta.url));
}
export function readKeeperModelUrl(url) {
 if(String(url).replace(/^\/+/, '')!=='guardians/keeper-v1/model.glb')throw new Error(`Undeclared Keeper model URL: ${url}`);
 return readKeeperSkin();
}
