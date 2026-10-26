// Elder-only audits must not load or select the Keeper's model inputs.
import {readFileSync,existsSync} from 'node:fs';
export function readElderSkin() {
 return readFileSync(existsSync(new URL('../../public/guardians/elder-v3/model.glb',import.meta.url))
  ? new URL('../../public/guardians/elder-v3/model.glb',import.meta.url)
  : new URL('../../data/guardians/elder-v3/model.glb',import.meta.url));
}
export function readElderModelUrl(url) {
 if(String(url).replace(/^\/+/, '')!=='guardians/elder-v3/model.glb')throw new Error(`Undeclared Elder model URL: ${url}`);
 return readElderSkin();
}
