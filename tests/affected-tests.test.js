import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {tempDir,removeTemp} from '../scripts/temp-dirs.mjs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {dependenciesOf,affectedTests,gitSelection,parseNameStatus} from '../scripts/affected-tests.mjs';
const NO_GIT_ENV=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
const fixture=files=>({files:Object.keys(files),tests:Object.keys(files).filter(f=>f.endsWith('.test.js')),read:f=>{if(!(f in files))throw Error(f);return files[f];},exists:f=>f in files});
test('imports execute transitively but reading source text is a leaf; comments and string examples are not imports',()=>{
 const files={'tests/read.test.js':"const text=readFileSync(new URL('../src/a.js',import.meta.url)); // import '../src/b.js'\nconst example=\"import '../src/b.js'\";",'tests/run.test.js':"import '../src/a.js';",'src/a.js':"export {x} from './b.js';",'src/b.js':'export const x=1;'};
 assert.deepEqual(affectedTests(['src/b.js'],fixture(files)),['tests/run.test.js']);
 assert.deepEqual(affectedTests(['src/a.js'],fixture(files)),['tests/read.test.js','tests/run.test.js']);
});
test('literal assets and dynamically patterned resources affect consumers without a code-extension gate',()=>{
 const files={'tests/a.test.js':"readFileSync(new URL('../public/skin.glb',import.meta.url));",'tests/b.test.js':"readFileSync(new URL(`../data/${name}.json`,import.meta.url));"};
 assert.deepEqual(affectedTests(['public/skin.glb'],fixture(files)),['tests/a.test.js','tests/b.test.js']);
 assert.equal(affectedTests(['data/new.json'],fixture(files)),'ALL','unresolved path supplies no ownership proof');
});
test('literal executable globs follow modules transitively while unresolved imports stay opaque',()=>{
 const files={'tests/a.test.js':"import.meta.glob('../src/worlds/*.js');",'src/worlds/a.js':"import '../shared.js';",'src/shared.js':'export const a=1;','tests/b.test.js':'assert.ok(true);'};
 assert.deepEqual(affectedTests(['src/shared.js'],fixture(files)),['tests/a.test.js']);
 const d=dependenciesOf('tests/a.test.js',"import.meta.glob('../src/worlds/*.js');");assert.ok(d.patterns.some(p=>p.executable));
});
test('opaque evaluated text and unknown imports fail closed without executing repository code',()=>{
 const files={'tests/vm.test.js':"import vm from 'node:vm'; const text=readFileSync(new URL('../src/a.js',import.meta.url)); vm.runInNewContext(text);",'tests/direct.test.js':"import '../src/b.js';",'src/a.js':"import './b.js';",'src/b.js':'export const x=1;'};
 assert.deepEqual(affectedTests(['src/b.js'],fixture(files)),['tests/direct.test.js','tests/vm.test.js']);
 assert.equal(dependenciesOf('src/a.js','import(path);').unknown,true);
 assert.equal(dependenciesOf('tests/a.js',"const {spawn}=await import('node:child_process'); spawn(cmd);").unknown,true);
 assert.equal(dependenciesOf('src/a.js','const = invalid').unknown,true);
 assert.equal(dependenciesOf('src/a.js',"const result=/a/.exec(x); obj.build();").unknown,false,'unrelated methods are not VM APIs');
});
test('aliased filesystem reads and mutated path bindings are conservative',()=>{
 assert.equal(dependenciesOf('tests/a.test.js',"import {readFileSync as load} from 'node:fs'; load(dynamicPath);").unknown,true);
 const d=dependenciesOf('tests/a.test.js',"let p='../a.json'; p=other; readFileSync(p);");assert.equal(d.unknown,true);
});
test('unknown changes, shared configuration and unreadable consumers cannot silently select nothing',()=>{
 const f=fixture({'tests/a.test.js':"import '../src/a.js';",'src/a.js':'export const a=1;'});
 assert.equal(affectedTests(['public/unregistered.glb'],f),'ALL');
 assert.equal(affectedTests(['package-lock.json'],f),'ALL');
 assert.deepEqual(affectedTests([],f),[]);
 assert.equal(affectedTests(['src/a.js'],{...f,read:()=>{throw Error('denied');}}),'ALL');
});
test('NUL name-status retains both rename/copy paths and deletion paths including spaces',()=>{
 assert.deepEqual(parseNameStatus('R100\0src/old name.js\0src/new name.js\0D\0data/old.json\0'),['src/old name.js','src/new name.js','data/old.json']);
 assert.throws(()=>parseNameStatus('R100\0one\0'));
});
function repo(){const root=tempDir('hiraeth-selection-');const git=(...a)=>execFileSync('git',a,{cwd:root,env:NO_GIT_ENV,encoding:'utf8'}).trim();const put=(p,t)=>{mkdirSync(join(root,p,'..'),{recursive:true});writeFileSync(join(root,p),t);};git('init','-q');git('config','user.name','Selector fixture');git('config','user.email','fixture@example.invalid');git('config','core.hooksPath','/dev/null');const commit=()=>{git('add','.');git('commit','-qm','fixture');return git('rev-parse','HEAD');};return{root,git,put,commit,close:()=>removeTemp(root)};}
test('git ranges union old/new graphs, retain deleted dependencies and exclude deleted test paths',()=>{
 const r=repo();try{r.put('tests/a.test.js',"import '../src/a.js';");r.put('tests/b.test.js',"import '../src/b.js';");r.put('src/a.js',"import './gone.js';");r.put('src/b.js','export const b=1;');r.put('src/gone.js','export const x=1;');const base=r.commit();r.put('src/a.js','export const a=1;');r.git('rm','src/gone.js');r.git('rm','tests/b.test.js');const head=r.commit();assert.deepEqual(gitSelection({root:r.root,base,head}),['tests/a.test.js']);assert.throws(()=>gitSelection({root:r.root,base:'f'.repeat(40),head}));}finally{r.close();}
});
test('staged selection reads the index, not an unrelated working-tree replacement',()=>{
 const r=repo();try{r.put('tests/a.test.js',"import '../src/a.js';");r.put('tests/b.test.js',"import '../src/b.js';");r.put('src/a.js','export const a=1;');r.put('src/b.js','export const b=1;');r.commit();r.put('src/a.js','export const a=2;');r.git('add','src/a.js');r.put('tests/a.test.js',"import '../src/b.js';");assert.deepEqual(gitSelection({root:r.root,staged:true}),['tests/a.test.js']);}finally{r.close();}
});

test('filesystem cwd paths differ from module URL paths and nested URL executable imports retain dependencies',()=>{
 const d=dependenciesOf('tests/a.test.js',"readFileSync('./src/a.js'); readFileSync(new URL('./fixture.json',import.meta.url));");
 assert.ok(d.resources.includes('src/a.js'));assert.ok(d.resources.includes('tests/fixture.json'));
 const files={'tests/a.test.js':"const dir=new URL('../src/gadgets/',import.meta.url); for(const f of readdirSync(dir)) import(new URL(f,dir));",'src/gadgets/a.js':"import '../shared.js';",'src/shared.js':'export const x=1;'};
 assert.equal(affectedTests(['src/shared.js'],fixture(files)),'ALL','unknown directory iteration is not a finite literal contract');
 const glob=dependenciesOf('src/minigames/index.js',"import.meta.glob(['./*.js','!./index.js'],{eager:true});");
 assert.equal(glob.unknown,false);assert.ok(glob.patterns.some(p=>p.executable&&p.pattern==='src/minigames/*.js'));
});
test('full main suite enumerates only top-level tests, keeping nightly tools separate',()=>{
 const r=repo();try{r.put('tests/a.test.js','assert.ok(true);');r.put('tests/nightly/slow.test.js','assert.ok(true);');r.commit();assert.deepEqual(gitSelection({root:r.root,all:true}),['tests/a.test.js']);}finally{r.close();}
});

test('full staged selection includes new indexed tests rather than only HEAD',()=>{
 const r=repo();try{r.put('tests/a.test.js','assert.ok(true);');r.commit();r.put('tests/new.test.js','assert.ok(true);');r.git('add','tests/new.test.js');assert.deepEqual(gitSelection({root:r.root,staged:true,all:true}),['tests/a.test.js','tests/new.test.js']);assert.deepEqual(gitSelection({root:r.root,all:true}),['tests/a.test.js']);}finally{r.close();}
});
test('known process inventory and exact git metadata calls are not repository execution',()=>{
 for(const source of ["import {spawnSync as probe} from 'node:child_process'; probe('pgrep',['-f',pattern],{encoding:'utf8'});","import {execFileSync} from 'node:child_process'; execFileSync('git',['rev-list','--count','HEAD']);"]){assert.equal(dependenciesOf('tests/a.js',source).unknown,false);}
 for(const source of ["import {execFileSync as run} from 'node:child_process'; run('git',['show','HEAD:src/a.js']);","import {spawnSync} from 'node:child_process'; spawnSync(command,args);","import * as cp from 'node:child_process'; cp.spawnSync('pgrep',args,{shell:true});","import {spawnSync as probe} from 'node:child_process'; const escaped=probe; escaped('pgrep',args);","import {spawnSync} from 'node:child_process'; spawnSync('pgrep',args,options);","import {spawnSync} from 'node:child_process'; spawnSync('pgrep',args,{env:custom});"]){assert.equal(dependenciesOf('tests/a.js',source).unknown,true,source);}
});
test('path helpers and unescaped private read arguments retain resources, exported or escaped helpers stay broad',()=>{
 const prefix="import {readFileSync} from 'node:fs'; import {fileURLToPath} from 'node:url'; import {join} from 'node:path'; ";
 const d=dependenciesOf('tests/a.js',prefix+"const dir=fileURLToPath(new URL('../public/',import.meta.url)); const read=(f)=>readFileSync(join(dir,f)); read('a.glb'); read('a.glb');");
 assert.equal(d.unknown,false);assert.ok(d.resources.includes('public/a.glb'));
 for(const body of ["export const read=(f)=>readFileSync(f); read('public/a.glb');","const read=(f)=>readFileSync(f); consume(read); read('public/a.glb');"]){assert.equal(dependenciesOf('tests/a.js',prefix+body).unknown,true);}
});
test('only unchanged-mode regular modifications can ignore unknown existsSync; stat/access stay broad',()=>{
 const files={'tests/direct.test.js':"import '../src/a.js';",'src/a.js':'export const a=1;','tests/exists.test.js':"import {existsSync} from 'node:fs'; existsSync(dynamic);",'tests/stat.test.js':"import {statSync} from 'node:fs'; statSync(dynamic);",'tests/access.test.js':"import {accessSync} from 'node:fs'; accessSync(dynamic);"};
 assert.deepEqual(affectedTests(['src/a.js'],{...fixture(files),modifiedRegularOnly:true}),['tests/access.test.js','tests/direct.test.js','tests/stat.test.js']);
 assert.ok(affectedTests(['src/a.js'],fixture(files)).includes('tests/exists.test.js'));
});
test('Git modifications to symlink targets and executable modes retain existence consumers',()=>{
 const r=repo();try{
  r.put('tests/a.test.js',"import '../src/a.js';");r.put('tests/exists.test.js',"import {existsSync} from 'node:fs'; existsSync(dynamic);");r.put('src/a.js','export const a=1;');const base=r.commit();
  r.put('src/a.js','export const a=2;');const head=r.commit();assert.deepEqual(gitSelection({root:r.root,base,head}),['tests/a.test.js']);
  r.git('update-index','--chmod=+x','src/a.js');r.git('commit','-qm','mode');const mode=r.git('rev-parse','HEAD');assert.ok(gitSelection({root:r.root,base:head,head:mode}).includes('tests/exists.test.js'));
  r.git('rm','-f','src/a.js');mkdirSync(join(r.root,'src'),{recursive:true});execFileSync('ln',['-s','target1','src/a.js'],{cwd:r.root});const symlink=r.commit();r.git('rm','-f','src/a.js');mkdirSync(join(r.root,'src'),{recursive:true});execFileSync('ln',['-s','target2','src/a.js'],{cwd:r.root});const changed=r.commit();assert.ok(gitSelection({root:r.root,base:symlink,head:changed}).includes('tests/exists.test.js'));
 }finally{r.close();}
});

test('unresolved interpolations may traverse outside a literal prefix and therefore remain opaque',()=>{
 for(const source of ["readFileSync(new URL(`../data/${name}.json`,import.meta.url));","import(`../src/worlds/${name}.js`);","const p='../data/'+name; readFileSync(p);"]){assert.equal(dependenciesOf('tests/a.test.js',source).unknown,true);}
 assert.equal(dependenciesOf('src/index.js',"import.meta.glob('./worlds/*.js');").unknown,false,'literal glob semantics remain bounded');
});

test('filesystem namespace escapes, absolute paths and quoted process options fail closed',()=>{
 for(const source of [
  "import * as fs from 'node:fs'; const load=fs.readFileSync; load(dynamic);",
  "import * as fs from 'node:fs'; pass(fs.readFileSync);",
  "import {resolve} from 'node:path'; readFileSync(resolve('src','/outside/file'));",
  "readFileSync('/src/a.js');",
  "import {execFileSync} from 'node:child_process'; execFileSync('pgrep',[],{'env': custom});",
  "import {execFileSync} from 'node:child_process'; execFileSync('pgrep',[],{'shell': true});"
 ])assert.equal(dependenciesOf('tests/a.test.js',source).unknown,true,source);
});


test('private literal callsites preserve exact finite resources through paths, templates and concatenation',()=>{
 const d=dependenciesOf('tests/a.test.js',`import {readFileSync} from 'node:fs'; import {join} from 'node:path';
 const read=(dir,name)=>readFileSync(join(dir, name+'.json'));
 read('data/one','a');read('data/two','b');`);
 assert.equal(d.unknown,false);assert.deepEqual(d.patterns,[]);
 for(const p of ['data/one/a.json','data/one/b.json','data/two/a.json','data/two/b.json'])assert.ok(d.resources.includes(p),p);
 const url=dependenciesOf('tests/a.test.js',"import {readFileSync} from 'node:fs'; const read=(name)=>readFileSync(new URL(`../data/${name}.json`,import.meta.url)); read('a');read('b');");
 assert.equal(url.unknown,false);assert.ok(url.resources.includes('data/a.json'));assert.ok(url.resources.includes('data/b.json'));assert.deepEqual(url.patterns,[]);
});
test('finite helper executable alternatives keep each transitive import without prefix overreach',()=>{
 const files={'tests/read.test.js':"const load=(name)=>import(`../src/${name}.js`);load('a');load('b');",'src/a.js':"import './leaf.js';",'src/b.js':'export const b=1;', 'src/leaf.js':'export const x=1;', 'src/abc.js':'export const x=2;', 'tests/abc.test.js':"import '../src/abc.js';"};
 assert.deepEqual(affectedTests(['src/leaf.js'],fixture(files)),['tests/read.test.js']);
 assert.deepEqual(affectedTests(['src/abc.js'],fixture(files)),['tests/abc.test.js']);
});
test('finite propagation stays opaque for unknown, escaped, mutable or overflowing alternatives',()=>{
 const prefix="import {readFileSync} from 'node:fs'; ";
 for(const body of [
  "const read=(f)=>readFileSync(`data/${f}`);read('a');read(dynamic);",
  "const read=(f)=>readFileSync(`data/${f}`);read('a');consume(read);",
  "export const read=(f)=>readFileSync(`data/${f}`);read('a');",
  "export default function read(f){return readFileSync(`data/${f}`);}read('a');",
  "function read(f){f=dynamic;return readFileSync(`data/${f}`);}read('a');",
  "function read(f){({f}=dynamic);return readFileSync(`data/${f}`);}read('a');",
  "function read(f){for(f of dynamic)readFileSync(`data/${f}`);}read('a');",
  "const f='a';function read(f=dynamic){return readFileSync(`data/${f}`);}read();",
  "function read(f){return read(f);}read('a');readFileSync(read('b'));",
  "const read=(f)=>readFileSync(`data/${f}`);"+Array.from({length:65},(_,i)=>`read('p${i}');`).join(''),
  "const read=(a,b)=>readFileSync(`data/${a}/${b}`);"+Array.from({length:9},(_,i)=>`read('a${i}','b${i}');`).join('')
 ])assert.equal(dependenciesOf('tests/a.test.js',prefix+body).unknown,true,body);
});

test('finite module-relative alternatives cannot clamp traversal outside the repository root',()=>{
 for(const source of [
  "import {readFileSync} from 'node:fs'; const read=f=>readFileSync(new URL(f,import.meta.url));read('../../outside.json');",
  "import {readFileSync} from 'node:fs'; import {resolve} from 'node:path'; const read=f=>readFileSync(resolve(f));read('../outside.json');",
  "import {readFileSync} from 'node:fs'; import {join} from 'node:path'; import {fileURLToPath} from 'node:url'; const root=fileURLToPath(new URL('../',import.meta.url)); const read=f=>readFileSync(join(root,f));read('../outside.json');"
 ])assert.equal(dependenciesOf('tests/a.test.js',source).unknown,true,source);
});

test('spread call arguments cannot be indexed as runtime helper parameters',()=>{
 const files={'tests/read.test.js':"import {readFileSync} from 'node:fs';const read=(unused,f)=>readFileSync(f);read(...paths,'data/known.json');",'tests/direct.test.js':"readFileSync('data/other.json');"};
 assert.equal(dependenciesOf('tests/read.test.js',files['tests/read.test.js']).unknown,true);
 assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
});

test('destructured and loop mutations invalidate constant arguments before private helper propagation',()=>{
 for(const mutation of ["({path}=external);","for(path of dynamic){}","for(path in dynamic){}"]){
  const source="import {readFileSync} from 'node:fs';let path='data/a.json';"+mutation+"const read=p=>readFileSync(p);read(path);";
  const files={'tests/read.test.js':source,'tests/direct.test.js':"readFileSync('data/other.json');"};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,mutation);
  assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
 }
});

test('shadowed or mutated path imports cannot prove finite resource locations',()=>{
 for(const source of [
  "import {join} from 'node:path'; function read(join){readFileSync(join('data','a'));}read(custom);",
  "import {join as combine} from 'node:path'; function read(combine){readFileSync(combine('data','a'));}read(custom);",
  "import path from 'node:path'; function read(path){readFileSync(path.join('data','a'));}read(custom);",
  "import * as path from 'node:path'; function read(path){readFileSync(path.join('data','a'));}read(custom);",
  "import path from 'node:path'; path.join=custom;readFileSync(path.join('data','a'));",
  "import {join} from 'node:path'; function read(){const join=custom;readFileSync(join('data','a'));}read();"
 ]){
  const files={'tests/read.test.js':source,'tests/direct.test.js':"readFileSync('data/other.json');"};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
  assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
 }
});

test('catch bindings and shadowed URL constructors cannot borrow outer constants or built-in semantics',()=>{
 for(const source of [
  "const p='data/a.json';try{}catch(p){readFileSync(p);}",
  "const p='data/a.json';function f(){function p(){} readFileSync(p);}f();",
  "const URL=custom;readFileSync(new URL('../data/a.json',import.meta.url));",
  "function read(URL){readFileSync(new URL('../data/a.json',import.meta.url));}read(custom);",
  "import URL from './custom.js';readFileSync(new URL('../data/a.json',import.meta.url));",
  "readFileSync(new custom.URL('../data/a.json',import.meta.url));"
 ]){
  const files={'tests/read.test.js':source,'tests/direct.test.js':"readFileSync('data/other.json');",'tests/custom.js':'export default function custom(){}'};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
  assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
 }
});

test('destructured local bindings invalidate outer constants and imported helpers',()=>{
 for(const source of [
  "import {join} from 'node:path'; function read(){const {join}=custom;readFileSync(join('data','a'));}read();",
  "const p='data/a.json';function read(){const {p}=custom;readFileSync(p);}read();",
  "function read(){const {URL}=custom;readFileSync(new URL('../data/a.json',import.meta.url));}read();",
  "const p='data/a.json';function read(){const [p]=custom;readFileSync(p);}read();"
 ]){
  const files={'tests/read.test.js':source,'tests/direct.test.js':"readFileSync('data/other.json');"};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
  assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
 }
});

test('file and unknown URI resources fail closed instead of becoming synthetic repository paths',()=>{
 for(const source of [
  "readFileSync(new URL('file:///absolute/data/other.json',import.meta.url));",
  "readFileSync('file:///absolute/data/other.json');",
  "readFileSync(new URL('custom+asset:somewhere',import.meta.url));"
 ]){
  const files={'tests/read.test.js':source,'tests/direct.test.js':"readFileSync('data/other.json');"};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
  assert.deepEqual(affectedTests(['data/other.json'],fixture(files)),['tests/direct.test.js','tests/read.test.js']);
 }
});

test('optional provenance preserves selection and explains shortest import, resource and opaque roots',()=>{
 const files={
  'tests/a.test.js':"import '../src/long.js'; import '../src/leaf.js'; import '../src/opaque.js'; readFileSync('data/a.json');",
  'tests/b.test.js':'assert.ok(true);',
  'src/long.js':"import './middle.js';",'src/middle.js':"import './leaf.js';",
  'src/leaf.js':'export const x=1;', 'src/opaque.js':"readFileSync(dynamicPath);"
 };
 for(const changed of [['src/leaf.js'],['data/a.json'],['unowned.bin']]){
  const diagnostics={};assert.deepEqual(affectedTests(changed,{...fixture(files),diagnostics}),affectedTests(changed,fixture(files)));
  const reasons=diagnostics.tests['tests/a.test.js'].reasons;
  assert.ok(reasons.some(r=>r.reason==='opaque-consumer'&&r.root==='src/opaque.js'&&r.opaqueReasons.some(x=>x.reason==='unresolved-path-expression'&&x.line===1)));
  if(changed[0]==='src/leaf.js')assert.deepEqual(reasons.find(r=>r.reason==='changed-module').chain,['tests/a.test.js','src/leaf.js']);
  if(changed[0]==='data/a.json')assert.ok(reasons.some(r=>r.reason==='resource'&&r.changed==='data/a.json'));
  if(changed[0]==='unowned.bin')assert.deepEqual(diagnostics.unmatched,['unowned.bin']);
 }
});

test('provenance reports global fallback and preserves opaque parse and glob decisions',()=>{
 const diagnostics={};assert.equal(affectedTests(['package.json'],{...fixture({}),diagnostics}),'ALL');
 assert.deepEqual(diagnostics.fallbacks[0].shared,['package.json']);
 const files={'tests/a.test.js':"import.meta.glob('../src/*.js');",'src/bad.js':'const = broken;'};
 const d={};assert.deepEqual(affectedTests(['src/bad.js'],{...fixture(files),diagnostics:d}),affectedTests(['src/bad.js'],fixture(files)));
 assert.ok(d.tests['tests/a.test.js'].reasons.some(r=>r.reason==='pattern'));
 assert.ok(d.tests['tests/a.test.js'].reasons.some(r=>r.opaqueReasons?.some(x=>x.reason==='parse-failure')));
});

test('test helpers select transitive consumers and opaque loaders, not unrelated tests',()=>{
 const files={'tests/a.test.js':"import './middle.js';",'tests/middle.js':"import './helper.js';",'tests/helper.js':'export const x=1;', 'tests/b.test.js':'assert.ok(true);','tests/opaque.test.js':'import(dynamic);'};
 assert.deepEqual(affectedTests(['tests/helper.js'],fixture(files)),['tests/a.test.js','tests/opaque.test.js']);
 assert.equal(affectedTests(['tests/new-helper.js'],fixture(files)),'ALL');
 for(const path of ['package.json','.github/workflows/tests.yml','.githooks/pre-commit','scripts/affected-tests.mjs','scripts/test-shards.mjs'])assert.equal(affectedTests([path],fixture(files)),'ALL');
});

test('helper rename and deletion retain old-graph consumers and omit unrelated tests',()=>{
 const r=repo();try{
  r.put('tests/a.test.js',"import './helper.js';");r.put('tests/helper.js','export const x=1;');r.put('tests/b.test.js','assert.ok(true);');const base=r.commit();
  r.git('mv','tests/helper.js','tests/renamed.js');r.put('tests/a.test.js',"import './renamed.js';");const moved=r.commit();
  assert.deepEqual(gitSelection({root:r.root,base,head:moved}),['tests/a.test.js']);
  r.git('rm','tests/renamed.js');r.put('tests/a.test.js','assert.ok(true);');const deleted=r.commit();
  assert.deepEqual(gitSelection({root:r.root,base:moved,head:deleted}),['tests/a.test.js']);
 }finally{r.close();}
});

test('two-snapshot ownership handles moved sources and tests while unowned new assets still fail closed',()=>{
 const r=repo();try{
  r.put('tests/a.test.js',"import '../src/a.js';");r.put('src/a.js','export const x=1;');r.put('tests/b.test.js','assert.ok(true);');const base=r.commit();
  r.git('mv','src/a.js','src/moved.js');r.git('mv','tests/a.test.js','tests/moved.test.js');r.put('tests/moved.test.js',"import '../src/moved.js';");const moved=r.commit();
  assert.deepEqual(gitSelection({root:r.root,base,head:moved}),['tests/moved.test.js']);
  r.put('public/unowned.bin','x');const asset=r.commit();assert.deepEqual(gitSelection({root:r.root,base:moved,head:asset}),['tests/b.test.js','tests/moved.test.js']);
 }finally{r.close();}
});

test('helper rename across directories keeps old consumers and global policy destinations remain global',()=>{
 const r=repo();try{
  r.put('tests/a.test.js',"import './helper.js';");r.put('tests/helper.js','export const x=1;');r.put('tests/b.test.js','assert.ok(true);');r.put('scripts/.keep','');const base=r.commit();
  r.git('mv','tests/helper.js','scripts/helper.mjs');r.put('tests/a.test.js',"import '../scripts/helper.mjs';");const moved=r.commit();assert.deepEqual(gitSelection({root:r.root,base,head:moved}),['tests/a.test.js']);
  r.git('mv','scripts/helper.mjs','scripts/test-shards.mjs');r.put('tests/a.test.js',"import '../scripts/test-shards.mjs';");const shared=r.commit();assert.deepEqual(gitSelection({root:r.root,base:moved,head:shared}),['tests/a.test.js','tests/b.test.js']);
 }finally{r.close();}
});

test('literal directory resources own descendants with one boundary, not similarly named siblings',()=>{
 const files={'tests/a.test.js':"readdirSync(new URL('../changelog-media/',import.meta.url));",'tests/b.test.js':'assert.ok(true);'};
 assert.deepEqual(affectedTests(['changelog-media/2.19/picture.webp'],fixture(files)),['tests/a.test.js']);
 assert.equal(affectedTests(['changelog-media-other/picture.webp'],fixture(files)),'ALL');
 const root=dependenciesOf('tests/a.test.js',"readdirSync(new URL('../',import.meta.url));");
 assert.equal(root.unknown,true,'repository root traversal stays conservative');
});

test('Vite BASE_URL fallback is an HTTP base hint, while real filesystem and URL sinks remain conservative',()=>{
 for(const base of ['import.meta.env.BASE_URL','import.meta.env?.BASE_URL']){
  const text=`export const base = () => ${base} ?? './';`;
  const d=dependenciesOf('src/music.js',text);assert.deepEqual(d.resources,[]);assert.equal(d.unknown,false);
  const files={'tests/music.test.js':"import '../src/music.js';",'src/music.js':text,'tests/hud.test.js':"import '../src/hud.js';",'src/hud.js':'export const x=1;'};
  assert.deepEqual(affectedTests(['src/hud.js'],fixture(files)),['tests/hud.test.js']);
  assert.equal(dependenciesOf('src/music.js',`readFileSync(${base} ?? './');`).unknown,true);
  assert.equal(dependenciesOf('src/music.js',`const base=${base} ?? './';readFileSync(base+'data.json');`).unknown,true);
  assert.equal(dependenciesOf('src/music.js',`readFileSync(new URL(${base} ?? './',import.meta.url));`).unknown,true);
 }
 const real={'tests/root.test.js':"readdirSync('./');",'tests/url.test.js':"readdirSync(new URL('./',import.meta.url));",'tests/owner.test.js':"readFileSync('tests/data.json');"};
 assert.deepEqual(affectedTests(['tests/data.json'],fixture(real)),['tests/owner.test.js','tests/root.test.js','tests/url.test.js']);
 assert.equal(dependenciesOf('tests/root.test.js',"readdirSync('./');").unknown,true);
 assert.ok(dependenciesOf('src/a.js',"const local='./'; const f='public/a.bin';").resources.includes('src/'));
 assert.ok(dependenciesOf('src/a.js',"const f='public/a.bin';").resources.includes('public/a.bin'));
 assert.ok(dependenciesOf('src/a.js',"const base=other.env.BASE_URL ?? './';").resources.includes('src/'));
 assert.ok(dependenciesOf('src/a.js',"const base=import.meta.env?.OTHER ?? './';").resources.includes('src/'));
});
