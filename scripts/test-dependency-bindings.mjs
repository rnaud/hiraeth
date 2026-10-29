// Lexical identities for the affected-test analyzer. Unknown values stay unknown;
// sharing a spelling in unrelated callbacks must not conflate two bindings.
const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
// Own enumerable keys in insertion order (as Object.entries), one array level, typed nodes only.
// A plain loop: this runs for every node of every file and dominated the selector's time.
const children = n => {
  const out = [];
  for (const k of Object.keys(n)) {
    if (k === 'start' || k === 'end' || k === 'loc') continue;
    const v = n[k];
    if (Array.isArray(v)) { for (const x of v) if (x?.type) out.push(x); }
    else if (v && typeof v === 'object' && v.type) out.push(v);
  }
  return out;
};
const patternIds = p => !p ? [] : p.type === 'Identifier' ? [p] : p.type === 'RestElement' ? patternIds(p.argument) : p.type === 'AssignmentPattern' ? patternIds(p.left) : p.type === 'ArrayPattern' ? p.elements.flatMap(patternIds) : p.type === 'ObjectPattern' ? p.properties.flatMap(x => patternIds(x.type === 'RestElement' ? x.argument : x.value)) : [];

export function lexicalBindings(ast) {
  const scopes = new Map(), parents = new Map(), declarations = new Set(), all = [], functionBindings = new Map();
  const makeScope = (parent, kind) => ({parent, kind, bindings:new Map()});
  const root = makeScope(null, 'function');
  function bind(scope, id, facts) {
    declarations.add(id);
    const old = scope.bindings.get(id.name);
    if(old) { old.ambiguous=true; return old; }
    const b={name:id.name,id,scope,refs:[],writes:false,exported:false,...facts}; scope.bindings.set(id.name,b); all.push(b); return b;
  }
  function pattern(scope,p,facts) { for(const id of patternIds(p))bind(scope,id,{...facts,simple:p.type==='Identifier'}); }
  function visit(n, scope, parent=null) {
    parents.set(n,parent);
    if(n.type==='FunctionDeclaration' && n.id)functionBindings.set(n,bind(scope,n.id,{kind:'function',fn:n}));
    if(n.type==='ClassDeclaration' && n.id)bind(scope,n.id,{kind:'unsupported'});
    if(functions.has(n.type)) {
      const outer=scope; scope=makeScope(scope,'function');
      if(n.type==='FunctionExpression'&&n.id)bind(scope,n.id,{kind:'unsupported'});
      n.params.forEach((p,index)=>pattern(scope,p,{kind:'parameter',fn:n,index}));
      if(n.type!=='FunctionDeclaration'&&parent?.type==='VariableDeclarator'&&parent.id.type==='Identifier'){
        // Its outer binding is installed before the initializer is traversed.
        functionBindings.set(n,outer.bindings.get(parent.id.name));
      }
    } else if(n.type==='ClassExpression'){
      scope=makeScope(scope,'block');if(n.id)bind(scope,n.id,{kind:'unsupported'});
    } else if(n.type==='StaticBlock')scope=makeScope(scope,'function');
    else if(n.type==='BlockStatement'||n.type==='CatchClause'||['ForStatement','ForOfStatement','ForInStatement','SwitchStatement'].includes(n.type))scope=makeScope(scope,'block');
    scopes.set(n,scope);
    if(n.type==='CatchClause')pattern(scope,n.param,{kind:'unsupported'});
    if(n.type==='ImportDeclaration')for(const p of n.specifiers)bind(scope,p.local,{kind:'import',source:n.source.value,imported:p.imported?.name??'*'});
    if(n.type==='VariableDeclaration')for(const d of n.declarations){
      let target=scope;if(n.kind==='var')while(target.parent&&target.kind!=='function')target=target.parent;
      const loop=parent?.type==='ForOfStatement'&&parent.left===n?parent:null;
      pattern(target,d.id,{kind:loop?'iteration':'variable',init:d.init,loop,declaration:n});
    }
    for(const c of children(n))visit(c,scope,n);
  }
  visit(ast,root);
  const lookup=(n,name=n.name)=>{for(let s=scopes.get(n);s;s=s.parent)if(s.bindings.has(name))return s.bindings.get(name);return null;};
  function reference(n) {
    if(n.type!=='Identifier'||declarations.has(n))return false;
    const p=parents.get(n);
    if(p?.type==='MemberExpression'&&p.property===n&&!p.computed)return false;
    if(['Property','MethodDefinition','PropertyDefinition'].includes(p?.type)&&p.key===n&&!p.computed&&!p.shorthand)return false;
    if(['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier','ExportSpecifier','LabeledStatement','BreakStatement','ContinueStatement','MetaProperty'].includes(p?.type))return false;
    return true;
  }
  for(const [n,p] of parents){
    if(reference(n))lookup(n)?.refs.push(n);
    let target=n.type==='AssignmentExpression'?n.left:n.type==='UpdateExpression'?n.argument:['ForOfStatement','ForInStatement'].includes(n.type)&&n.left.type!=='VariableDeclaration'?n.left:null;
    if(target){
      if(target.type==='MemberExpression'){let object=target.object;while(object.type==='MemberExpression')object=object.object;if(object.type==='Identifier'){const b=lookup(object);if(b)b.writes=true;}}
      else for(const id of patternIds(target)){const b=lookup(id);if(b)b.writes=true;}
    }
    if(n.type==='ExportNamedDeclaration'||n.type==='ExportDefaultDeclaration'){
      const d=n.declaration;
      for(const b of all)if(d&&(d===b.fn||d===b.declaration))b.exported=true;
      for(const s of n.specifiers??[]){const b=lookup(n,s.local?.name);if(b)b.exported=true;}
    }
  }
  const stable=b=>b&&!b.ambiguous&&!b.writes&&b.simple!==false;
  function privateCalls(fn){
    // Named expressions can recurse through a second binding. Non-arrow
    // functions can also alias parameters through sloppy-mode arguments.
    if(fn.type==='FunctionExpression'&&fn.id)return null;
    const usesArguments=n=>n.type==='Identifier'&&n.name==='arguments'||children(n).some(usesArguments);
    if(fn.type!=='ArrowFunctionExpression'&&usesArguments(fn.body))return null;
    const b=functionBindings.get(fn);
    if(!stable(b)||b.exported)return null;
    // Reject every escape, alias, callback, shadow, property access and spread call.
    const calls=[];
    for(const ref of b.refs){const p=parents.get(ref);if(p?.type!=='CallExpression'||p.callee!==ref||p.arguments.some(a=>a.type==='SpreadElement'))return null;calls.push(p);}
    return calls.length?calls:null;
  }
  function iterationValues(b,values,seen){
    let n=b.loop?.right;
    if(n?.type==='Identifier'){
      const array=lookup(n);
      if(!stable(array)||array.exported||array.refs.some(ref=>parents.get(ref)?.type!=='ForOfStatement'||parents.get(ref).right!==ref))return null;
      n=array.init;
    }
    if(n?.type!=='ArrayExpression'||n.elements.some(e=>!e||e.type==='SpreadElement'))return null;
    const sets=n.elements.map(e=>values(e,seen));return sets.some(s=>s===null)?null:sets.flat();
  }
  return {
    valueOf(n,values,seen,union){
      const b=lookup(n);
      if(!stable(b)||seen.has(b))return null;
      const next=new Set([...seen,b]);
      if(b.kind==='variable')return values(b.init,next);
      if(b.kind==='parameter'){
        const calls=privateCalls(b.fn);if(!calls)return null;
        return union(calls.map(c=>values(c.arguments[b.index],next)));
      }
      if(b.kind==='iteration'){const set=iterationValues(b,values,next);return set===null?null:union([set]);}
      return null;
    },
    importMethod(callee, sourcePattern){
      const id=callee?.type==='Identifier'?callee:callee?.type==='MemberExpression'?callee.object:null;
      if(id?.type!=='Identifier')return null;
      const b=lookup(id);
      if(!stable(b)||b.kind!=='import'||!sourcePattern.test(b.source))return null;
      if(callee===id)return b.imported==='*'?null:b.imported;
      if(b.imported!=='*'||b.refs.some(ref=>parents.get(ref)?.type!=='MemberExpression'||parents.get(ref).object!==ref))return null;
      return callee.computed?callee.property?.type==='Literal'?callee.property.value:null:callee.property?.name;
    },
    lookup, parents, nodes:[...parents.keys()],
  };
}

// A literal awaited Node filesystem import has the same dependency bindings as
// its static form. Normalize only complete, simple const declarations; escaped
// namespaces/methods are still checked by the ordinary filesystem analysis.
export function normalizeBuiltinImports(ast) {
  const names=new Set(), extra=[];let counter=0;
  const collect=n=>{if(n.type==='Identifier')names.add(n.name);for(const c of children(n))collect(c);};collect(ast);
  function visit(n,parent=null) {
    if(n.type==='MemberExpression'&&!n.computed&&parent?.type==='CallExpression'&&parent.callee===n){
      const load=n.object?.type==='AwaitExpression'?n.object.argument:null;
      if(load?.type==='ImportExpression'&&load.source?.type==='Literal'&&/^(?:node:)?fs(?:\/promises)?$/.test(load.source.value)&&!load.options){
        let name;do{name='__affectedFs'+counter++;}while(names.has(name));names.add(name);
        extra.push({type:'ImportDeclaration',source:{...load.source},specifiers:[{type:'ImportNamespaceSpecifier',local:{type:'Identifier',name}}]});
        n.object={type:'Identifier',name};
      }
    }
    if(n.type==='VariableDeclaration'&&n.kind==='const'&&n.declarations.length===1){
      const d=n.declarations[0], load=d.init?.type==='AwaitExpression'?d.init.argument:null;
      if(load?.type==='ImportExpression'&&load.source?.type==='Literal'&&/^(?:node:)?fs(?:\/promises)?$/.test(load.source.value)&&!load.options){
        let specifiers=null;
        if(d.id.type==='Identifier')specifiers=[{type:'ImportNamespaceSpecifier',local:d.id}];
        if(d.id.type==='ObjectPattern'&&d.id.properties.every(p=>p.type==='Property'&&!p.computed&&p.key.type==='Identifier'&&p.key.name!=='default'&&p.value.type==='Identifier'))
          specifiers=d.id.properties.map(p=>({type:'ImportSpecifier',imported:p.key,local:p.value}));
        if(specifiers){delete n.declarations;delete n.kind;Object.assign(n,{type:'ImportDeclaration',source:load.source,specifiers});}
      }
    }
    for(const c of children(n))visit(c,n);
  }
  visit(ast);ast.body.push(...extra);return ast;
}
