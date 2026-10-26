// Filesystem command; binary transformations are shared with the tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FATHER_BUDGET, trimFather, slimFather } from './slim-father-core.mjs';
export { FATHER_BUDGET, trimFather, slimFather } from './slim-father-core.mjs';

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: slim-father.mjs full-rig.glb output.glb');
  const before=readFileSync(input),result=await slimFather(before);
  if(result.bytes.length>FATHER_BUDGET.maxBytes||result.triangles>FATHER_BUDGET.maxTriangles)throw Error('Father asset exceeds budget');
  writeFileSync(output,result.bytes);
  const {bytes,...counts}=result;delete counts.bytes;
  const report={...counts,beforeBytes:before.length,afterBytes:bytes.length,textureSize:FATHER_BUDGET.texture,textureGpuBytesWithMipmaps:Math.round(2048*2048*4*4/3)};
  writeFileSync('data/characters/father-v1/optimization.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}
