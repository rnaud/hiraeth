// Keep the CLI's process, argument and artifact contract separate from measured game assertions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tempDir} from '../scripts/temp-dirs.mjs';
test('temple audit CLI selects the requested house and writes its report, plan, views and rules',()=>{
 const out=tempDir('temple-cli-');
 try {
  const log=execFileSync(process.execPath,['scripts/temple-design/audit.mjs',out,'--temples','bazaar'],{encoding:'utf8',timeout:120000});
  const report=JSON.parse(readFileSync(join(out,'report.json'),'utf8'));
  assert.deepEqual(report.temples.map(t=>t.id),['bazaar']);
  assert.ok(report.temples[0].solved);
  assert.deepEqual(JSON.parse(readFileSync(join(out,'rules.json'),'utf8')),{bazaar:report.temples[0].rules});
  assert.ok(Array.isArray(JSON.parse(readFileSync(join(out,'views.json'),'utf8')).views));
  assert.deepEqual(readdirSync(out).sort(),['bazaar-plan.svg','report.json','rules.json','views.json']);
  assert.match(readFileSync(join(out,'bazaar-plan.svg'),'utf8'),/<svg/);
  assert.match(log,/scores/);assert.ok(log.includes(out));
 } finally {rmSync(out,{recursive:true,force:true});}
});
