import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=join(ROOT,'output/character-local/quality-pass');
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', CDP=5489;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function chrome() {
  const profile = mkdtempSync(join(tmpdir(), 'memento-shots-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
    '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  if (!tabs) throw new Error('Chrome did not start');
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(); const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description ?? 'exception');
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`${expression.slice(0, 90)}…: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const close = async () => {   // (the profile goes with it: Chrome's caches are hundreds of MB)
    try { ws.close(); } catch { /* gone */ }
    const gone = new Promise((r) => proc.once('exit', r));
    proc.kill('SIGTERM');
    await Promise.race([gone, sleep(5000)]);
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, ev, errors, close };
}


const server=await createServer({root:ROOT,cacheDir:join(tmpdir(),'hiraeth-quality-vite'),server:{host:'127.0.0.1',port:5488,strictPort:true,hmr:false},logLevel:'error'});
await server.listen();const c=await chrome();mkdirSync(OUT,{recursive:true});
try {
 await c.send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
 await c.send('Page.navigate',{url:'http://127.0.0.1:5488/studio.html?who=npc&world=desert&source=makehuman&view=full&bg=flat'});
 for(let i=0;i<240;i++){if(await c.ev('!!window.studio').catch(()=>false))break;await sleep(250);}
 await c.ev(`(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');
 const {Foes}=await import('/src/foes.js');const guardians=await import('/src/temples/guardians.js');
 const S=window.studio;S.set({bg:'flat',gaze:'free'});S.applyLight();
 const foes=new Foes({scene:S.scene,level:{},levelId:'arena',physics:{groundAt:()=>0},player:{pos:new T.Vector3()},lib:S.assets.lib,humans:[S.assets.humans.m]});
 const subjects=[];for(const kind of ['blot','spitter','swarm','flyer','machine','shade']){const f=foes.add(kind,new T.Vector3());subjects.push({id:kind,group:f.model.group,pose:(state,k)=>{f.state=state;f.k=k;if(f.model.shade)f.model.shade.melt=0;foes.look(f,1/60);}});}
 for(const [name,build] of Object.entries(guardians)){if(!name.endsWith('Model'))continue;const m=build();S.scene.add(m.group);subjects.push({id:name,group:m.group,pose:(state,k,attackId)=>{for(let i=0;i<50;i++)m.animate(1/60,i/60,{state:state==='idle'?'fight':state,attack:attackId?{id:attackId}:null,k,speed:2,meter:.4,phase:1});if(m.floats)m.group.position.y=m.hover;}});}
 window.enemyAudit={T,subjects,capture:(id,state,k,yaw,attackId)=>{
 for(const p of S.people()){p.root.visible=false;if(p.npc?.cape)p.npc.cape.mesh.visible=false;}
 for(const q of subjects)q.group.visible=q.id===id;
 const q=subjects.find(q=>q.id===id);q.pose(state,k,attackId);q.group.updateMatrixWorld(true);q.group.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
 const b=new T.Box3().setFromObject(q.group,true),centre=b.getCenter(new T.Vector3()),radius=b.getSize(new T.Vector3()).length()*.5;
 const d=radius/Math.sin(T.MathUtils.degToRad(S.camera.fov)*.5)*1.12;
 S.camera.position.copy(centre).add(new T.Vector3(Math.sin(yaw)*d,d*.15,Math.cos(yaw)*d));S.camera.lookAt(centre);S.render();return S.renderer.domElement.toDataURL('image/png');
 }};
 })()`);
 const manifest=[];
 const names=await c.ev('enemyAudit.subjects.map(q=>q.id)');
 const attacks={keeperModel:'stamp',whaleModel:'dive',echoModel:'pulse',mothModel:'swoop',elderModel:'buffet',snapperModel:'lunge',sentinelModel:'beam',foremanModel:'hammer',gardenerModel:'roots',signModel:'cry'};
 for(const id of names){
  const guardian=id.endsWith('Model');
  const states=guardian?[['idle',0,.3],['fight',.95,1.5],['fight',1.15,3.14],['open',0,-.7]]:[['idle',0,.3],['wind',.95,1.5],['strike',.6,3.14]];
  for(const [n,[state,k,yaw]] of states.entries()){
   const attack=guardian&&state==='fight'?attacks[id]:null;
   const data=await c.ev(`enemyAudit.capture('${id}','${state}',${k},${yaw},${JSON.stringify(attack)})`);
   const file=`enemy-${id}-${n}-${state}.png`;
   writeFileSync(join(OUT,file),Buffer.from(data.split(',')[1],'base64'));manifest.push({id,state,k,yaw,attack,file});
  }
 }
 writeFileSync(join(OUT,'enemy-coverage.json'),JSON.stringify({captures:manifest,errors:c.errors},null,2));
 writeFileSync(join(OUT,'enemies.html'),`<!doctype html><meta charset="utf-8"><title>Enemy quality review</title><style>body{background:#eee6d8;font:16px sans-serif;margin:30px}img{max-width:100%}</style><h1>Enemy quality review</h1><p>Six foe families and ten guardian builders. Representative attacks and open states; not every move or animation phase.</p>`+manifest.map(m=>`<h2>${m.id} · ${m.state} · ${m.attack||''} · ${m.k}</h2><img loading="lazy" src="${m.file}">`).join(''));
 if(c.errors.length)throw Error(c.errors.join('\n'));
 console.log('captured',names);console.log('errors',c.errors);
}finally{await c.close();await server.close();}
