#!/usr/bin/env node
// Shared local/CI selection. Unknown dependencies fail closed; nightly runs are not an excuse to omit them.
// --base SHA --head SHA --json, --staged --json, --all --json; legacy positional paths print ALL/list.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, normalize, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst'; // Vite's version is pinned by package-lock.json.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_CHANGED = 40;
const SHARED = /^(package(?:-lock)?\.json$|\.githooks\/|\.github\/workflows\/|scripts\/(?:affected-tests|test-loader-contract|test-shards|test-file-times)\.mjs$)/;
const JS = /\.(?:js|mjs|cjs)$/;
const clean = f => posix.normalize(f.replaceAll('\\', '/'));
const local = f => !f.startsWith('../') && !posix.isAbsolute(f);
const walk = (n, fn) => { if (!n || typeof n !== 'object') return; if (n.type) fn(n); for (const [k,v] of Object.entries(n)) if (!['start','end','loc'].includes(k)) { if (Array.isArray(v)) v.forEach(x=>walk(x,fn)); else if (v && typeof v==='object') walk(v,fn); } };
const called = n => n?.type === 'Identifier' ? n.name : n?.type === 'MemberExpression' ? n.property?.name ?? n.property?.value : null;
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** AST edges distinguish executable imports from data/source-text reads. Never parse comments as imports. */
export function dependenciesOf(file, text, {explain=false}={}) {
  let ast;
  try { ast = parseAst(text); } catch { return { imports: [], resources: [], patterns: [], unknown: true,...(explain?{opaqueReasons:[{reason:'parse-failure',offset:null,line:null}]}:{}) }; }
  const imports = new Set(), resources = new Set(), patterns = [], constants = new Map();
  let unknown = false, unknownExistence = false, contextNode = null;
  const opaqueReasons = [], reasonKeys = new Set();
  const markUnknown = (reason, node=contextNode) => {
    unknown = true;
    if (!explain) return;
    const offset = node?.start ?? null, key = reason+':'+offset;
    if(reasonKeys.has(key))return; reasonKeys.add(key);
    if(opaqueReasons.length<64)opaqueReasons.push({reason,offset,line:offset===null?null:text.slice(0,offset).split('\n').length});
  };
  const opaqueBindings = new Set(), fsBindings = new Map(), pathBindings = new Map(), processBindings = new Map();
  const parents=new Map(), nodes=[];
  const index=(n,parent)=>{if(!n||typeof n!=='object')return;if(n.type){parents.set(n,parent);nodes.push(n);}for(const [k,v] of Object.entries(n))if(!['start','end','loc'].includes(k)){if(Array.isArray(v))v.forEach(x=>index(x,n));else if(v&&typeof v==='object')index(v,n);}};index(ast,null);
  walk(ast,n=>{if(n.type!=='ImportDeclaration')return;const source=n.source.value;
    for(const x of n.specifiers){const method=x.imported?.name;
      if(/^(?:node:)?child_process$/.test(source)){processBindings.set(x.local.name,method??'*');continue;}
      if(/^(?:node:)?vm$|^(?:esbuild|rolldown|vite)(?:\/|$)/.test(source))opaqueBindings.add(x.local.name);
      if(/^(?:node:)?fs(?:\/promises)?$/.test(source))fsBindings.set(x.local.name,method??'*');
      if(/^(?:node:)?(?:path|url)$/.test(source))pathBindings.set(x.local.name,method??'*');
    }
  });
  // Unique immutable bindings only; duplicate names or writes remain unknown (no scope guesses).
  walk(ast,n=>{if(n.type==='VariableDeclarator'){if(n.id.type==='Identifier')constants.set(n.id.name,constants.has(n.id.name)?null:n.init);else walk(n.id,x=>{if(x.type==='Identifier')constants.set(x.name,null);});}});
  walk(ast,n=>{const target=n.type==='AssignmentExpression'?n.left:n.type==='UpdateExpression'?n.argument:['ForOfStatement','ForInStatement'].includes(n.type)?n.left:null;if(target)walk(target,x=>{if(x.type==='Identifier')constants.set(x.name,null);});});
  walk(ast,n=>{if(n.type==='CatchClause')walk(n.param,x=>{if(x.type==='Identifier')constants.set(x.name,null);});if(['FunctionDeclaration','FunctionExpression','ClassDeclaration','ClassExpression'].includes(n.type)&&n.id&&constants.has(n.id.name))constants.set(n.id.name,null);});
  const functionNode=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
  const MAX_ALTERNATIVES = 64;
  // null means unresolved. Never approximate a finite set with a prefix wildcard.
  const union = sets => {
    if (!sets.length || sets.some(x => x === null)) return null;
    const out = [...new Set(sets.flat())];
    if (out.some(x => typeof x !== 'string')) return null;
    return out.length <= MAX_ALTERNATIVES ? out : null;
  };
  const product = (sets, combine) => {
    if (sets.some(x => x === null)) return null;
    let rows = [[]];
    for (const set of sets) {
      if (rows.length * set.length > MAX_ALTERNATIVES) return null;
      rows = rows.flatMap(row => set.map(x => [...row, x]));
    }
    return union([rows.map(combine)]);
  };
  // Infer only private, uniquely named, unescaped helper parameters from every lexical call site.
  // Exported functions, callbacks, reassignment and recursion remain unresolved.
  const mentions=(tree,name)=>{let found=false;walk(tree,x=>{if(x.type==='Identifier'&&x.name===name)found=true;});return found;};
  // Import-name lookup is valid only without a competing binding or mutation.
  // No lexical scope guessing: one shadowed alias/namespace makes this consumer opaque.
  for(const name of pathBindings.keys())if(constants.has(name)||nodes.some(n=>
    functionNode(n)&&(n.id?.name===name||n.params.some(p=>mentions(p,name))) ||
    n.type==='CatchClause'&&mentions(n.param,name) ||
    ['ClassDeclaration','ClassExpression'].includes(n.type)&&n.id?.name===name
  )){pathBindings.delete(name);markUnknown('shadowed-path-binding');}
  const parameter=(n,seen)=>{
    for(let fn=parents.get(n);fn;fn=parents.get(fn))if(functionNode(fn)){
      const i=fn.params.findIndex(p=>p.type==='Identifier'&&p.name===n.name);if(i<0){if(fn.params.some(p=>mentions(p,n.name)))return null;continue;}
      if(nodes.some(x=>x.type==='VariableDeclarator'&&mentions(x.id,n.name) || x.type==='AssignmentExpression'&&mentions(x.left,n.name) || x.type==='UpdateExpression'&&mentions(x.argument,n.name) || ['ForOfStatement','ForInStatement'].includes(x.type)&&mentions(x.left,n.name)))return null;
      const owner=parents.get(fn), id=fn.id??(owner?.type==='VariableDeclarator'?owner.id:null);
      if(!id||id.type!=='Identifier'||seen.has(fn))return null;
      if(nodes.some(x=>x!==id&&x.type==='Identifier'&&x.name===id.name&&!(parents.get(x)?.type==='CallExpression'&&parents.get(x).callee===x)))return null;
      if(nodes.some(x=>['ExportNamedDeclaration','ExportDefaultDeclaration'].includes(x.type)&&(x.declaration===fn||x.declaration===parents.get(owner))))return null;
      const calls=nodes.filter(x=>x.type==='CallExpression'&&x.callee.type==='Identifier'&&x.callee.name===id.name);
      if(calls.some(c=>c.arguments.some(a=>a.type==='SpreadElement')))return null;
      return union(calls.map(c=>values(c.arguments[i],new Set([...seen,fn]))));
    }
    return undefined;
  };
  // Preserve traversal above the synthetic repository root instead of silently clamping it.
  const rootedPath=(parts, absolute)=>{
    const marker='/__affected_test_repository__';
    const mapped=parts.map(p=>p.startsWith('/')?marker+p:p);
    const p=absolute?posix.resolve(marker,...mapped):posix.join(...mapped);
    if(p===marker)return '/';
    if(p.startsWith(marker+'/'))return p.slice(marker.length);
    if(p.startsWith('/'))return null;
    return p;
  };
  const values = (n, seen=new Set()) => {
    if(n&&text.slice(n.start,n.end)==='import.meta.url')return ['/'+file];
    if(n?.type==='Literal' && typeof n.value==='string'){if(n.value.startsWith('/'))markUnknown('absolute-path-literal');return [n.value];}
    if(n?.type==='Identifier') {const p=parameter(n,seen);if(p!==undefined)return p;if(seen.has(n.name))return null;return values(constants.get(n.name),new Set([...seen,n.name]));}
    if(n?.type==='CallExpression'){
      const method=n.callee.type==='Identifier'?pathBindings.get(n.callee.name):pathBindings.get(n.callee.object?.name)==='*'?called(n.callee):null;
      if(method==='fileURLToPath')return values(n.arguments[0],seen);
      if(method==='join'||method==='resolve')return product(n.arguments.map(a=>values(a,seen)),parts=>{const p=rootedPath(parts,method==='resolve');return p===null?null:p+(parts.at(-1)?.endsWith('/')?'/':'');});
      if(method==='dirname')return product([values(n.arguments[0],seen)],([p])=>p==='/'?null:posix.dirname(p));
    }
    if(n?.type==='TemplateLiteral')return product(n.expressions.map(x=>values(x,seen)),parts=>n.quasis.map((q,i)=>q.value.cooked+(i<parts.length?parts[i]:'')).join(''));
    if(n?.type==='BinaryExpression' && n.operator==='+')return product([values(n.left,seen),values(n.right,seen)],([a,b])=>a+b);
    if(n?.type==='NewExpression' && called(n.callee)==='URL') {
      if(n.callee.type!=='Identifier'||constants.has('URL')||nodes.some(x=>functionNode(x)&&(x.id?.name==='URL'||x.params.some(p=>mentions(p,'URL'))) || ['ClassDeclaration','ClassExpression'].includes(x.type)&&x.id?.name==='URL' || ['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(x.type)&&x.local.name==='URL'))return null;
      const base=n.arguments[1], meta=text.slice(base?.start,base?.end)==='import.meta.url';
      const parts=values(n.arguments[0],seen), bases=meta?['/'+file]:values(base,seen);
      if(parts===null||bases===null||bases.some(p=>!p.startsWith('/')))return null;
      return product([parts,bases],([part,parent])=>{if(/^[a-z][a-z0-9+.-]*:/i.test(part))return part;const p=rootedPath([parent.endsWith('/')?parent:posix.dirname(parent),part],false);return p===null?null:p+(part.endsWith('/')?'/':'');});
    }
    return null;
  };
  // Process exemptions require one exact command/argument, never a set of possible programs.
  const value = n => { const set=values(n); return set?.length===1?set[0]:null; };
  const add = (v, executable=false, relativeOnly=false) => {
    if(typeof v!=='string') {markUnknown('unresolved-resource');return;}
    if(/^(?:node:|https?:|data:)/.test(v))return;
    if(/^[a-z][a-z0-9+.-]*:/i.test(v)){markUnknown('unsupported-uri');return;}
    if(executable && !v.startsWith('.') && !v.startsWith('/')) {if(v.includes('*'))markUnknown('unresolved-package-pattern');return;} // external packages covered by lockfile
    if(relativeOnly && !v.startsWith('.') && !v.startsWith('/'))return;
    const p=clean(v.startsWith('.')?posix.join(posix.dirname(file),v):v.replace(/^\//,''));
    if(!local(p)){markUnknown('outside-repository-path');return;}
    if(p==='*' || !p.includes('/') && p.includes('*')){markUnknown('unbounded-pattern');return;}
    if(p.includes('*'))patterns.push({pattern:p,executable});
    else (executable?imports:resources).add(p.split(/[?#]/)[0]);
  };
  const addValues=(set,executable=false)=>{if(set===null){markUnknown('unresolved-path-expression');return;}for(const v of set)add(v,executable);};
  const processCalls=new Set();
  const safeProcessCall=n=>{
    const method=n.callee.type==='Identifier'?processBindings.get(n.callee.name):processBindings.get(n.callee.object?.name)==='*'?called(n.callee):null;
    if(!method)return false;processCalls.add(n.callee.type==='Identifier'?n.callee:n.callee.object);
    if(!['spawnSync','execFileSync','spawn','execFile'].includes(method))return false;
    const command=value(n.arguments[0]);const options=n.arguments[2];
    if(options && (options.type!=='ObjectExpression'||options.properties.some(p=>p.type!=='Property'||p.computed||(p.key.name??p.key.value)==='env'||(p.key.name??p.key.value)==='shell'&&!(p.value.type==='Literal'&&p.value.value===false))))return false;
    if(command==='pgrep')return true; // OS process inventory, no repository program or file contents.
    if(command!=='git'||n.arguments[1]?.type!=='ArrayExpression')return false;
    const args=n.arguments[1].elements.map(x=>value(x));
    return JSON.stringify(args)===JSON.stringify(['rev-parse','--is-shallow-repository'])||JSON.stringify(args)===JSON.stringify(['rev-list','--count','HEAD']);
  };
  const unwrap = n => n?.type==='ChainExpression' ? unwrap(n.expression) : n;
  const baseUrlFallback = n => {
    const p=parents.get(n), ref=unwrap(p?.left), env=unwrap(ref?.object), meta=env?.object;
    return n.value==='./' && p?.type==='LogicalExpression' && p.operator==='??' && p.right===n &&
      ref?.type==='MemberExpression' && !ref.computed && ref.property?.name==='BASE_URL' &&
      env?.type==='MemberExpression' && !env.computed && env.property?.name==='env' &&
      meta?.type==='MetaProperty' && meta.meta?.name==='import' && meta.property?.name==='meta';
  };
  walk(ast,n=>{
    contextNode=n;
    if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type) && n.source)add(value(n.source),true);
    if(n.type==='ImportExpression'){const set=values(n.source);addValues(set,true);if(set?.some(v=>/^(?:node:)?(?:fs(?:\/promises)?|vm|child_process)$|^(?:esbuild|rolldown|vite)(?:\/|$)/.test(v)))markUnknown('dynamic-io-import');}
    if(n.type==='NewExpression' && called(n.callee)==='URL') {const set=values(n);if(text.slice(n.arguments[1]?.start,n.arguments[1]?.end)==='import.meta.url'||set?.some(v=>v.startsWith('/')))addValues(set);}
    if(n.type==='CallExpression') {
      const name=called(n.callee);
      if(processBindings.has(n.callee.type==='Identifier'?name:n.callee.object?.name)&&!safeProcessCall(n))markUnknown('unresolved-subprocess');
      if(name==='require'){const set=values(n.arguments[0]);addValues(set,true);if(set?.some(v=>/^(?:node:)?(?:fs|vm|child_process)(?:\/|$)|^(?:esbuild|rolldown|vite)(?:\/|$)/.test(v)))markUnknown('required-io-module');}
      const importGlob=n.callee?.type==='MemberExpression' && name==='glob' && text.slice(n.callee.object.start,n.callee.object.end)==='import.meta';
      if(importGlob)for(const x of n.arguments[0]?.type==='ArrayExpression'?n.arguments[0].elements:[n.arguments[0]]) {const set=values(x);if(set===null)markUnknown('unresolved-import-glob');else for(const v of set)if(!v.startsWith('!'))add(v,true);}
      if(!importGlob && (['readFile','readFileSync','readdir','readdirSync','glob','globSync','access','accessSync','stat','statSync','existsSync'].includes(name) || n.callee.type==='Identifier' && ['readFile','readFileSync','readdir','readdirSync','glob','globSync','access','accessSync','stat','statSync','existsSync'].includes(fsBindings.get(name)))) {
        const a=n.arguments[0];
        const set=values(a);const method=fsBindings.get(name)??name;
        if(method==='existsSync'&&set===null)unknownExistence=true;else if(set?.some(v=>['.','./','/','/./'].includes(v)))markUnknown('repository-root-read');else addValues(set?.map(v=>v.startsWith('.')?'/'+v:v)??null);
      }
      // Code/dataflow cannot safely be inferred across eval, bundlers, spawned programs or VM loaders.
      if(n.callee.type==='Identifier' && (name==='eval'||opaqueBindings.has(name)) || n.callee.type==='MemberExpression' && opaqueBindings.has(n.callee.object?.name))markUnknown('executable-evaluation');
    }
    if(n.type==='NewExpression' && ['Function','Script','SourceTextModule'].includes(called(n.callee)))markUnknown('dynamic-code-constructor');
    // Literal repository paths used through local read/assert helpers are resources, not executable edges.
    if(n.type==='Literal' && typeof n.value==='string' && !baseUrlFallback(n) && /^(?:\.\.?\/|(?:src|engine|scripts|tests|docs|public|data|references|changelog-media|\.github|\.githooks)\/|changelog\.md$)/.test(n.value) && !/[\n\r]/.test(n.value))add(n.value);
  });
  for(const n of nodes)if(n.type==='Identifier'&&fsBindings.has(n.name)){
    contextNode=n;
    const parent=parents.get(n),method=fsBindings.get(n.name);
    if(['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(parent?.type))continue;
    if(method==='*') {const call=parents.get(parent);if(parent?.type!=='MemberExpression'||parent.object!==n||parent.computed||call?.type!=='CallExpression'||call.callee!==parent)markUnknown('escaped-fs-namespace');}
    else if(['readFile','readFileSync','readdir','readdirSync','existsSync','stat','statSync','access','accessSync'].includes(method)&&!(parent?.type==='CallExpression'&&parent.callee===n))markUnknown('escaped-fs-method');
  }
  for(const n of nodes)if(n.type==='Identifier'&&processBindings.has(n.name)&&!processCalls.has(n)&&!['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(parents.get(n)?.type))markUnknown('escaped-process-binding',n);
  if(explain)for(const n of nodes)if(n.type==='ImportDeclaration'&&n.specifiers.some(x=>opaqueBindings.has(x.local.name)))markUnknown('opaque-loader-import',n);
  return {imports:[...imports],resources:[...resources],patterns,unknownExistence,unknown:unknown||opaqueBindings.size>0,...(explain?{opaqueReasons,opaqueReasonsTruncated:reasonKeys.size>64}: {})};
}
export function refsOf(file,text) {const d=dependenciesOf(file,text);return [...new Set([...d.imports,...d.resources])];}

/** Unknown/unowned changes select all. An opaque consumer selects that consumer's tests, not unrelated tests. */
export function affectedTests(changed,{root=ROOT,read=f=>readFileSync(join(root,f),'utf8'),exists=f=>existsSync(join(root,f)),tests=null,files=null,modifiedRegularOnly=false,diagnostics=null,ownership=null,deferUnowned=false}={}) {
  const touched=[...new Set(changed.map(clean))];
  if(diagnostics)Object.assign(diagnostics,{changed:touched,tests:{},fallbacks:[],unmatched:[]});
  if(!touched.length)return [];
  if(touched.some(f=>!local(f)) || touched.length>MAX_CHANGED || touched.some(f=>SHARED.test(f))){if(diagnostics)diagnostics.fallbacks.push({reason:'global-policy',outside:touched.filter(f=>!local(f)),overLimit:touched.length>MAX_CHANGED,shared:touched.filter(f=>SHARED.test(f))});return 'ALL';}
  const all=tests??readdirSync(join(root,'tests')).filter(f=>f.endsWith('.test.js')).map(f=>'tests/'+f);
  const cache=new Map(),matched=new Set();
  const dependency=f=>{if(!cache.has(f)){let d;try{d=dependenciesOf(f,read(f),{explain:!!diagnostics});}catch{d={imports:[],resources:[],patterns:[],unknown:true};}cache.set(f,d);}return cache.get(f);};
  const matches=(pattern,path)=>new RegExp('^'+pattern.split('*').map(escape).join('.*')+'(?:/.*)?$').test(path);
  const selected=all.filter(test=>{
    let hit=false;const stack=[test],seen=new Set(),chains=diagnostics?new Map([[test,[test]]]):null, reasons=[];
    const note=(reason,root,extra={})=>{if(diagnostics&&reasons.length<128)reasons.push({reason,root,chain:chains.get(root)??[test,root],...extra});};
    const enqueue=(r,f)=>{if(chains&&!chains.has(r))chains.set(r,[...chains.get(f),r]);stack.push(r);};
    while(stack.length){const f=diagnostics?stack.shift():stack.pop();if(seen.has(f))continue;seen.add(f);
      if(touched.includes(f)){matched.add(f);hit=true;note('changed-module',f);}
      if(!JS.test(f))continue;
      const d=dependency(f);if(d.unknown||d.unknownExistence&&!modifiedRegularOnly){hit=true;note(d.unknown?'opaque-consumer':'existence-query',f,{opaqueReasons:d.opaqueReasons??[],opaqueReasonsTruncated:d.opaqueReasonsTruncated??false});}
      for(const r of d.resources)for(const t of touched)if(t===r||t.startsWith(r.replace(/\/+$/,'')+'/')){matched.add(t);hit=true;note('resource',f,{changed:t});}
      for(const p of d.patterns){for(const t of touched)if(matches(p.pattern,t)){matched.add(t);hit=true;note('pattern',f,{changed:t,pattern:p.pattern});}
        if(p.executable){if(!files){hit=true;note('missing-file-inventory',f,{pattern:p.pattern});continue;}for(const r of files)if(matches(p.pattern,r))enqueue(r,f);}}
      for(let r of d.imports){
        if(!exists(r) && !touched.includes(r)) {const options=[r+'.js',r+'.mjs',r+'/index.js'].filter(exists);if(options.length===1)r=options[0];else {hit=true;note('unresolved-import',f,{import:r});continue;}}
        enqueue(r,f);
      }
    }if(diagnostics&&hit)diagnostics.tests[test]={reasons,truncated:reasons.length>=128};return hit;
  });
  // No ownership proof is not proof of no effect (new asset, deleted module, custom loader, changed config).
  if(ownership)for(const f of matched)ownership.add(f);
  if(!deferUnowned&&touched.some(f=>!matched.has(f))){if(diagnostics){diagnostics.unmatched=touched.filter(f=>!matched.has(f));diagnostics.fallbacks.push({reason:'unowned-paths',paths:diagnostics.unmatched});}return 'ALL';}
  return selected.sort();
}

const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
export function parseNameStatus(raw) {
  const parts=raw.split('\0'),out=[];let i=0;
  while(i<parts.length && parts[i]){const status=parts[i++];if(!/^[ACDMRTUXB][0-9]*$/.test(status))throw Error('Malformed git name-status');
    const n=/^[RC]/.test(status)?2:1;for(let j=0;j<n;j++){const f=parts[i++];if(!f)throw Error('Missing git path');out.push(f);}}
  return [...new Set(out)];
}
export function gitSelection({root=ROOT,base,head,staged=false,all=false,diagnostics=null}) {
  const check=ref=>git(root,['rev-parse','--verify',ref+'^{commit}']).trim();
  const before=check(staged?'HEAD':base??'HEAD');const after=staged?null:check(head??'HEAD');
  const snapshot=ref=>{
    const files=git(root,ref?['ls-tree','-r','--name-only','-z',ref]:['ls-files','--cached','-z']).split('\0').filter(Boolean),set=new Set(files);
    // One object read per snapshot, not thousands of git processes. Git's byte lengths delimit content.
    let texts;
    const read=f=>{
      if(!texts){
        texts=new Map(); // Cache failure too: never repeat a failed bulk read for each test.
        const paths=files.filter(f=>JS.test(f));
        if(paths.some(f=>/[\r\n]/.test(f)))throw Error('Unsupported newline in source path');
        const specs=paths.map(f=>ref?ref+':'+f:':'+f);
        const out=execFileSync('git',['cat-file','--batch'],{cwd:root,input:specs.join('\n')+'\n',maxBuffer:256*1024*1024});
        let offset=0;
        for(const path of paths){
          const end=out.indexOf(10,offset);if(end<0)throw Error('Truncated git object header');
          const header=out.subarray(offset,end).toString('utf8'),m=/^[0-9a-f]+ blob (\d+)$/.exec(header);
          if(!m)throw Error('Unavailable source object: '+path);
          const size=Number(m[1]);offset=end+1;
          if(!Number.isSafeInteger(size)||offset+size>=out.length||out[offset+size]!==10)throw Error('Invalid git object size');
          texts.set(path,out.subarray(offset,offset+size).toString('utf8'));offset+=size+1;
        }
        if(offset!==out.length)throw Error('Unexpected git object output');
      }
      if(!texts.has(f))throw Error('Missing source '+f);return texts.get(f);
    };
    return {files,tests:files.filter(f=>/^tests\/[^/]+\.test\.js$/.test(f)),exists:f=>set.has(f),read};
  };
  const a=snapshot(before),b=snapshot(after);if(all)return b.tests.sort();
  const raw=git(root,staged?['diff','--cached','--name-status','-z','--find-renames',before]:['diff','--name-status','-z','--find-renames',before,after]);
  const changed=parseNameStatus(raw);if(!changed.length)return [];
  // existsSync observes only existence for an unchanged-mode regular file modification.
  // Symlink target edits, permissions, additions/deletions/renames and unknown statuses stay conservative.
  const rawModes=git(root,staged?['diff','--cached','--raw','-z','--find-renames',before]:['diff','--raw','-z','--find-renames',before,after]);
  const fields=rawModes.split('\0').filter(Boolean);let modifiedRegularOnly=fields.length>0;
  for(let i=0;i<fields.length;){const m=/^:(\d+) (\d+) [0-9a-f]+ [0-9a-f]+ ([A-Z][0-9]*)$/.exec(fields[i++]);if(!m){modifiedRegularOnly=false;break;}i+=/^[RC]/.test(m[3])?2:1;if(m[3]!=='M'||m[1]!==m[2]||!/^100(?:644|755)$/.test(m[1]))modifiedRegularOnly=false;}
  if(diagnostics)Object.assign(diagnostics,{before,after:after??'index',old:{},current:{}});
  const ownership=new Set();
  const old=affectedTests(changed,{root,...a,modifiedRegularOnly,diagnostics:diagnostics?.old,ownership,deferUnowned:true}),now=affectedTests(changed,{root,...b,modifiedRegularOnly,diagnostics:diagnostics?.current,ownership,deferUnowned:true});
  const unmatched=changed.filter(f=>!ownership.has(f));
  if(diagnostics)diagnostics.unmatched=unmatched;
  if(old==='ALL'||now==='ALL'||unmatched.length)return b.tests.sort();
  const current=new Set(b.tests);return [...new Set([...old,...now])].filter(f=>current.has(f)).sort();
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);let result;
    if(args.some(x=>x.startsWith('--'))){const opts={};let json=false,explain=false;
      for(let i=0;i<args.length;i++){const x=args[i];if(x==='--json')json=true;else if(x==='--explain')explain=true;else if(x==='--all')opts.all=true;else if(x==='--staged')opts.staged=true;else if(x==='--base'||x==='--head'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing ref');opts[x.slice(2)]=args[++i];}else throw Error('Unknown option '+x);}
      if(opts.staged&&(opts.base||opts.head))throw Error('Staged cannot mix with commit range');
      if(!opts.staged&&!opts.all&&(!opts.base||!opts.head))throw Error('Both base and head required');
      const diagnostics=explain?{}:null;result=gitSelection({...opts,diagnostics});process.stdout.write(explain?JSON.stringify({tests:result,diagnostics})+'\n':json?JSON.stringify(result)+'\n':result.map(t=>t+'\n').join(''));
    } else {result=affectedTests(args.map(f=>relative(ROOT,resolve(f))));process.stdout.write(result==='ALL'?'ALL\n':result.map(t=>t+'\n').join(''));}
  }catch(e){console.error('Test selection failed closed: '+e.message);process.exitCode=1;}
}
