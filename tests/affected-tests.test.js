import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {tempDir,removeTemp} from '../scripts/temp-dirs.mjs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {dependenciesOf,affectedTests,gitSelection,parseNameStatus,syntaxStore,analyzerFingerprint} from '../scripts/affected-tests.mjs';
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


test('lexical identities keep unrelated callback parameters and block locals independent',()=>{
 for(const source of [
  "const read=p=>readFileSync(`data/${p}.json`);read('a');other.map(p=>p.name);",
  "const p='data/a.json';{const p='data/b.json';readFileSync(p);}readFileSync(p);",
  "function read(p){readFileSync(`data/${p}.json`);}read('a');{function read(p){return p;}read(dynamic);}",
  "const read=p=>readFileSync(p);function outer(){const p='data/a.json';read(p);}outer();const p=dynamic;"
 ]){
  const d=dependenciesOf('tests/read.test.js',source);assert.equal(d.unknown,false,source);assert.ok(d.resources.includes('data/a.json'),source);
 }
});

test('finite loop inputs retain every resource and executable transitive dependency',()=>{
 for(const loop of ["for(const f of ['a','b'])", "const names=['a','b'];for(const f of names)"]){
  const source=loop+"{const read=p=>import(`../src/${p}.js`);read(f);}";
  const files={'tests/read.test.js':source,'src/a.js':"import './leaf.js';",'src/b.js':'export const x=1;','src/leaf.js':'export const x=1;','src/other.js':'export const x=1;','tests/other.test.js':"import '../src/other.js';"};
  assert.equal(dependenciesOf('tests/read.test.js',source).unknown,false);
  for(const changed of ['src/a.js','src/b.js','src/leaf.js'])assert.deepEqual(affectedTests([changed],fixture(files)),['tests/read.test.js']);
  assert.deepEqual(affectedTests(['src/other.js'],fixture(files)),['tests/other.test.js']);
 }
 const choice=dependenciesOf('tests/a.test.js',"const p=condition?'data/a.json':'data/b.json';readFileSync(p);");
 assert.equal(choice.unknown,false);assert.ok(choice.resources.includes('data/a.json'));assert.ok(choice.resources.includes('data/b.json'));
});

test('loop inference rejects mutable, escaped, exported and unknown collections',()=>{
 for(const prefix of [
  "const names=['a'];names.push(dynamic);", "const names=['a'];consume(names);",
  "const names=['a'];names[0]=dynamic;", "let names=['a'];names=dynamic;",
  "export const names=['a'];", "const names=[...dynamic];", "const names=[dynamic];"
 ])assert.equal(dependenciesOf('tests/read.test.js',prefix+"for(const f of names)readFileSync(`data/${f}.json`);").unknown,true,prefix);
 for(const source of [
  "const p='data/a.json';const C=class p{method(){readFileSync(p);}};",
  "function read(p){function mutate(){p=dynamic;}mutate();readFileSync(p);}read('data/a.json');",
  "function read(p){readFileSync(p);}export {read};read('data/a.json');",
  "const read=function recurse(p){if(p)recurse(external);readFileSync(p);};read('data/a.json');",
  "function read(p){arguments[0]=external;readFileSync(p);}read('data/a.json');",
  "const read=p=>readFileSync(p);const alias=read;read('data/a.json');alias(dynamic);",
  "const names=['a'];for(let f of names){f=dynamic;readFileSync(`data/${f}.json`);}",
  "const names=['a'];function read(names){for(const f of names)readFileSync(`data/${f}.json`);}read(dynamic);"
 ])assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
 assert.equal(affectedTests(['scripts/test-dependency-bindings.mjs'],fixture({'tests/a.test.js':'assert.ok(true);'})),'ALL');
});


test('path import identities distinguish unrelated shadows while rejecting namespace escapes',()=>{
 const d=dependenciesOf('tests/read.test.js',"import {join} from 'node:path';readFileSync(join('data','a.json'));const other=join=>join;");
 assert.equal(d.unknown,false);assert.ok(d.resources.includes('data/a.json'));
 for(const source of [
  "import path from 'node:path';consume(path);readFileSync(path.join('data','a.json'));",
  "import path from 'node:path';const alias=path;alias.join=custom;readFileSync(path.join('data','a.json'));",
  "import path from 'node:path';readFileSync(path[method]('data','a.json'));"
 ])assert.equal(dependenciesOf('tests/read.test.js',source).unknown,true,source);
});


test('literal awaited filesystem imports use the same finite edges as static imports',()=>{
 for(const code of [
  "const {readFileSync:read}=await import('node:fs');read('data/a.json');",
  "const fs=await import('node:fs');fs.readFileSync('data/a.json');",
  "(await import('node:fs')).readFileSync('data/a.json');",
  "await (await import('node:fs/promises')).readFile('data/a.json');",
  "const {readFile}=await import('node:fs/promises');await readFile('data/a.json');",
  "async function check(){const {readFileSync}=await import('node:fs');readFileSync(new URL('../data/a.json',import.meta.url));}check();"
 ]){
  const d=dependenciesOf('tests/read.test.js',code);assert.equal(d.unknown,false,code);assert.ok(d.resources.includes('data/a.json'));
  const files={'tests/read.test.js':code,'tests/other.test.js':"readFileSync('data/b.json');"};
  assert.deepEqual(affectedTests(['data/b.json'],fixture(files)),['tests/other.test.js']);
  assert.deepEqual(affectedTests(['data/a.json'],fixture(files)),['tests/read.test.js']);
 }
 for(const code of [
  "const fs=await import('node:fs');consume(fs);",
  "const {readFileSync:read}=await import('node:fs');consume(read);",
  "const {readFileSync:read}=await import('node:fs');read(dynamic);",
  "const {readFileSync,...rest}=await import('node:fs');",
  "const fs=await import(which);", "(await import('node:fs')).readFileSync(dynamic);", "consume((await import('node:fs')).readFileSync);", "consume(await import('node:fs'));",
  "const {default:fs}=await import('node:fs');consume(fs);",
  "const {readFileSync:read=fallback}=await import('node:fs');read('data/a.json');"
 ])assert.equal(dependenciesOf('tests/read.test.js',code).unknown,true,code);
});

test('finite conditional imports preserve correlated branches and transitive consumers',()=>{
 for(const condition of ["id==='legacy'","'legacy'===id","id!=='modern'"]){
  const source=`for(const id of ['legacy','modern'])await import(${condition}?'../src/old.js':\`../src/\${id}.js\`);`;
  const files={'tests/read.test.js':source,'src/old.js':"import './leaf.js';",'src/modern.js':'export const x=1;','src/leaf.js':'export const x=1;','src/other.js':'export const x=1;','tests/other.test.js':"import '../src/other.js';"};
  const d=dependenciesOf('tests/read.test.js',source);assert.equal(d.unknown,false);
  assert.deepEqual(d.imports.sort(),['src/modern.js','src/old.js']);
  assert.deepEqual(affectedTests(['src/other.js'],fixture(files)),['tests/other.test.js']);
  for(const path of ['src/old.js','src/modern.js','src/leaf.js'])assert.deepEqual(affectedTests([path],fixture(files)),['tests/read.test.js']);
 }
 assert.equal(dependenciesOf('tests/a.test.js',"const id=external;import(id==='legacy'?'../src/old.js':`../src/${id}.js`);").unknown,true);
 assert.equal(dependenciesOf('tests/a.test.js',"for(let id of ['legacy','modern']){id=external;import(id==='legacy'?'../src/old.js':`../src/${id}.js`);}").unknown,true);
});


test('shared analysis cache follows exact source bytes and diagnostic mode across snapshots',()=>{
 const files={'tests/a.test.js':"import '../src/a.js';",'src/a.js':"import './old.js';",'src/old.js':'export const x=1;','src/new.js':'export const x=2;', 'tests/b.test.js':"import '../src/new.js';"};
 const analysisCache=new Map(), select=(path,extra={})=>affectedTests([path],{...fixture(files),analysisCache,...extra});
 assert.deepEqual(select('src/old.js'),['tests/a.test.js']);
 const cached=analysisCache.get('src/a.js\0false');
 assert.deepEqual(select('src/old.js'),['tests/a.test.js']);assert.equal(analysisCache.get('src/a.js\0false'),cached);
 files['src/a.js']="import './new.js';";
 assert.deepEqual(select('src/new.js'),['tests/a.test.js','tests/b.test.js']);assert.notEqual(analysisCache.get('src/a.js\0false'),cached);
 const diagnostics={};select('src/new.js',{diagnostics});assert.ok(diagnostics.tests['tests/a.test.js']);assert.ok(analysisCache.get('src/a.js\0true').dependency.opaqueReasons);
 delete files['src/a.js'];assert.ok(select('src/new.js').includes('tests/a.test.js'),'missing input is opaque, never a cached success');
});


test('exact revision metadata query is bounded; content reads and alternate commands are not',()=>{
 const code="import {execFileSync} from 'node:child_process';execFileSync('git',['rev-parse','--short','HEAD'],{stdio:['ignore','pipe','ignore']});";
 assert.equal(dependenciesOf('tests/run.test.js',code).unknown,false);
 for(const changed of [code.replace("'rev-parse','--short','HEAD'","'show','HEAD:src/hud.js'"),code.replace("'git'","command"),code.replace("stdio:","shell:true,stdio:"),code.replace("stdio:","env:custom,stdio:")])assert.equal(dependenciesOf('tests/run.test.js',changed).unknown,true);
});


test('single graph propagation matches explanatory walks across cycles, globs, leaves and unknowns',()=>{
 const files={
  'tests/a.test.js':"import '../src/a.js';",
  'tests/b.test.js':"import '../src/b.js';",
  'tests/c.test.js':"import '../src/c.js';",
  'tests/opaque.test.js':"import(unknown);",
  'src/a.js':"import './b.js';readFileSync('data/a.json');",
  'src/b.js':"import './a.js';import.meta.glob('./parts/*.js');",
  'src/c.js':"readFileSync('src/a.js');",
  'src/parts/x.js':"import '../leaf.js';",
  'src/leaf.js':'export const x=1;',
 };
 for(const changed of [['src/a.js'],['src/leaf.js'],['data/a.json'],['src/c.js'],['new.bin'],['src/a.js','src/c.js']]){
  const options=fixture(files),diagnostics={};
  assert.deepEqual(affectedTests(changed,options),affectedTests(changed,{...options,diagnostics}),changed.join(','));
 }
 for(const change of ["import './missing.js';","readFileSync(dynamic);","existsSync(dynamic);","const = bad"]){
  files['src/leaf.js']=change;
  for(const modifiedRegularOnly of [true,false]){
   const options={...fixture(files),modifiedRegularOnly};
   assert.deepEqual(affectedTests(['src/c.js'],options),affectedTests(['src/c.js'],{...options,diagnostics:{}}),change);
  }
 }
});


test('dynamic URLs used only by builtin existsSync retain existence rather than content dependencies',()=>{
 for(const code of [
  "import {existsSync} from 'node:fs';existsSync(new URL(`../references/${name}.jpg`,import.meta.url));",
  "import {existsSync as present} from 'node:fs';present(new URL(`../references/${name}.jpg`,import.meta.url));",
  "import fs from 'node:fs';fs.existsSync(new URL(`../references/${name}.jpg`,import.meta.url));"
 ]){
  const d=dependenciesOf('tests/exists.test.js',code);assert.equal(d.unknown,false,code);assert.equal(d.unknownExistence,true,code);
  const files={'tests/exists.test.js':code,'tests/other.test.js':"import '../src/other.js';",'src/other.js':'export const x=1;'};
  assert.deepEqual(affectedTests(['src/other.js'],{...fixture(files),modifiedRegularOnly:true}),['tests/other.test.js']);
  assert.deepEqual(affectedTests(['src/other.js'],{...fixture(files),modifiedRegularOnly:false}),['tests/exists.test.js','tests/other.test.js']);
 }
 for(const code of [
  "existsSync(new URL(`../references/${name}.jpg`,import.meta.url));",
  "import {readFileSync} from 'node:fs';readFileSync(new URL(`../references/${name}.jpg`,import.meta.url));",
  "import {existsSync} from 'node:fs';const url=new URL(`../references/${name}.jpg`,import.meta.url);consume(url);existsSync(url);",
  "import {existsSync} from 'node:fs';function check(URL){existsSync(new URL(`../references/${name}.jpg`,import.meta.url));}check(custom);"
 ])assert.equal(dependenciesOf('tests/exists.test.js',code).unknown,true,code);
});


test('large known change sets follow reachability rather than the number of changed paths',()=>{
 const changed=Array.from({length:128},(_,i)=>`src/batch/f${i}.js`);
 const files=Object.fromEntries(changed.map(f=>[f,'export const value=1;']));
 files['tests/batch.test.js']=changed.map(f=>`import '../${f}';`).join('\n');
 files['tests/other.test.js']="import '../src/other.js';";
 files['src/other.js']='export const value=1;';
 files['tests/opaque.test.js']='import(name);';
 const options=fixture(files),expected=['tests/batch.test.js','tests/opaque.test.js'];
 assert.deepEqual(affectedTests(changed,options),expected);
 const diagnostics={};
 assert.deepEqual(affectedTests(changed,{...options,diagnostics}),expected,'explanation and fast graph agree');
 assert.deepEqual(diagnostics.fallbacks,[]);
 assert.equal(affectedTests([...changed,'unknown.config'],options),'ALL','one unowned input still fails closed');
 assert.equal(affectedTests([...changed,'package-lock.json'],options),'ALL','shared infrastructure still requires all tests');
 assert.equal(affectedTests([...changed,'../outside.js'],options),'ALL','outside-repository paths remain conservative');
});

test('large multi-commit Git ranges retain changed and deleted dependencies without unrelated tests',()=>{
 const r=repo();
 try{
  const changed=Array.from({length:48},(_,i)=>`src/batch/f${i}.js`);
  for(const path of changed)r.put(path,'export const value=1;');
  r.put('src/batch/removed.js','export const value=1;');
  r.put('tests/batch.test.js',[...changed,'src/batch/removed.js'].map(f=>`import '../${f}';`).join('\n'));
  r.put('tests/other.test.js',"import '../src/other.js';");r.put('src/other.js','export const value=1;');
  const base=r.commit();
  for(const path of changed.slice(0,24))r.put(path,'export const value=2;');r.commit();
  for(const path of changed.slice(24))r.put(path,'export const value=3;');
  r.git('rm','src/batch/removed.js');
  r.put('tests/batch.test.js',changed.map(f=>`import '../${f}';`).join('\n'));
  const head=r.commit();
  assert.deepEqual(gitSelection({root:r.root,base,head}),['tests/batch.test.js']);
 }finally{r.close();}
});

test('the persistent syntax cache reuses only exact bytes under one analyzer and never changes a selection',()=>{
 const dir=tempDir('hiraeth-syntax-cache-');
 try{
  const files={'tests/a.test.js':"import '../src/a.js';",'tests/leaf.test.js':"import '../src/leaf.js';",'tests/vm.test.js':"import vm from 'node:vm'; vm.runInNewContext(x);",'src/a.js':"import './leaf.js';",'src/b.js':'export const b=1;','src/leaf.js':'export const x=1;'};
  const plain=affectedTests(['src/leaf.js'],fixture(files));
  assert.deepEqual(plain,['tests/a.test.js','tests/leaf.test.js','tests/vm.test.js']);
  const first=syntaxStore({dir,fingerprint:'a'.repeat(64)});
  assert.deepEqual(affectedTests(['src/leaf.js'],{...fixture(files),syntax:first}),plain);first.save();
  // A warm store answers from disk, with the same selection.
  const warm=syntaxStore({dir,fingerprint:'a'.repeat(64)}),key=warm.key('src/a.js',files['src/a.js'],false);
  assert.deepEqual(warm.get(key),dependenciesOf('src/a.js',files['src/a.js']));
  assert.deepEqual(affectedTests(['src/leaf.js'],{...fixture(files),syntax:warm}),plain);
  // Changed bytes, another path or another mode are other keys: an edit dropping the import is analysed afresh.
  assert.notEqual(warm.key('src/a.js',files['src/a.js']+' ',false),key);
  assert.notEqual(warm.key('src/b.js',files['src/a.js'],false),key);
  assert.notEqual(warm.key('src/a.js',files['src/a.js'],true),key);
  assert.deepEqual(affectedTests(['src/leaf.js'],{...fixture({...files,'src/a.js':'export const a=1;'}),syntax:warm}),['tests/leaf.test.js','tests/vm.test.js']);
  // A poisoned or malformed entry is a miss, not an answer; a corrupt file is a cold start.
  writeFileSync(first.file,JSON.stringify({fingerprint:'a'.repeat(64),entries:{[key]:{imports:'src/b.js'}}}));
  assert.equal(syntaxStore({dir,fingerprint:'a'.repeat(64)}).get(key),undefined);
  writeFileSync(first.file,'{not json');
  assert.deepEqual(affectedTests(['src/leaf.js'],{...fixture(files),syntax:syntaxStore({dir,fingerprint:'a'.repeat(64)})}),plain);
  // Another analyzer neither reads the old file nor keeps it.
  const other=syntaxStore({dir,fingerprint:'b'.repeat(64)});assert.notEqual(other.file,first.file);assert.equal(other.get(key),undefined);
  affectedTests(['src/leaf.js'],{...fixture(files),syntax:other});other.save();
  assert.equal(existsSync(first.file),false);assert.equal(existsSync(other.file),true);
  // The analyzer's fingerprint follows its own bytes, the bindings, the parser and Node's version.
  const parser='/p/rolldown/dist/parse.mjs',read=f=>'bytes of '+f.split('/').pop();
  const base=analyzerFingerprint({read,parser,version:'v24'});
  assert.equal(analyzerFingerprint({read,parser,version:'v24'}),base);
  for(const edited of ['affected-tests.mjs','test-dependency-bindings.mjs','parse.mjs'])
   assert.notEqual(analyzerFingerprint({read:f=>f.endsWith(edited)?'edited':read(f),parser,version:'v24'}),base,edited);
  assert.notEqual(analyzerFingerprint({read,parser,version:'v25'}),base);
 }finally{removeTemp(dir);}
});

test('a deploy-only workflow selects the tests that read it; one that runs the unit suite selects everything',()=>{
 const files={
  'tests/deploy.test.js':"readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url));",
  'tests/other.test.js':"import '../src/a.js';",'src/a.js':'export const a=1;',
  '.github/workflows/deploy.yml':"on:\n  workflow_run:\n    workflows: [Tests]   # after tests.yml and node --test passed\n# node --test, in a comment, runs nothing\njobs:\n  deploy:\n    steps:\n      - run: npx wrangler deploy\n",
  '.github/workflows/tests.yml':'jobs:\n  unit:\n    steps:\n      - run: node scripts/run-test-shard.mjs 1/5\n',
  '.github/workflows/nightly-tests.yml':'jobs:\n  gameplay:\n    uses: ./.github/workflows/tests.yml\n',
  '.github/workflows/installer.yml':'jobs:\n  unit:\n    uses: ./.github/workflows/tests.yml\n  build:\n    steps:\n      - run: make\n',
  '.github/workflows/runs.yml':'jobs:\n  a:\n    steps:\n      - run: node --test --test-concurrency=2 tests/deploy.test.js\n',
  '.github/workflows/selector.yml':'jobs:\n  a:\n    steps:\n      - run: node scripts/affected-tests.mjs --all --json\n',
  '.github/workflows/unread.yml':'jobs:\n  a:\n    steps:\n      - run: make\n',
 };
 const f=fixture(files);
 assert.deepEqual(affectedTests(['.github/workflows/deploy.yml'],f),['tests/deploy.test.js'],'its readers only (comments that name the suite run nothing)');
 for(const w of ['tests','nightly-tests','installer','runs','selector'])assert.equal(affectedTests([`.github/workflows/${w}.yml`],f),'ALL',w+' runs the unit suite');
 assert.equal(affectedTests(['.github/workflows/unread.yml'],f),'ALL','a workflow no test reads is unowned');
 assert.equal(affectedTests(['.github/workflows/gone.yml'],f),'ALL','one that cannot be read (deleted, renamed away) stays test infrastructure');
});
