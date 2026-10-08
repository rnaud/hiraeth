import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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
await server.listen();const c=await chrome();mkdirSync(OUT,{recursive:true});const travellerOnly=process.argv.includes('--traveller-only');const manifest=travellerOnly?JSON.parse(readFileSync(join(OUT,'coverage.json'),'utf8')).captures.filter(m=>m.category!=='traveller'):[];
const worlds=['desert','home','incal','arzach','arzach2','garage','buried','edena','spheres','perdide','perdide2','bazaar'];
try {
 await c.send('Emulation.setDeviceMetricsOverride',{width:1740,height:1000,deviceScaleFactor:1,mobile:false});
 for(const world of travellerOnly?[]:worlds) {
  await c.send('Page.navigate',{url:`http://127.0.0.1:5488/studio.html?who=npc&world=${world}&lineup=cast&source=makehuman&view=full&anim=game:idle`});
  let ready=false;for(let i=0;i<240;i++){if(await c.ev('!!window.studio && window.studio.people().length>0').catch(()=>false)){ready=true;break;}await sleep(250);}
  if(!ready)throw Error('No cast loaded: '+world);
  for(const [pose,yaw] of [['idle',0],['walk',1.57],['sit',3.14],['talk',-.7]]) {
   await c.ev(`studio.set({anim:'game:${pose}'});studio.orbit.yaw=${yaw};`);await sleep(1100);
   const data=await c.ev(`studio.sheet({cols:3,w:400,h:620,view:'full'})`);
   const file=`${world}-${pose}.png`;writeFileSync(join(OUT,file),Buffer.from(data.split(',')[1],'base64'));
   manifest.push({world,pose,yaw,file,people:await c.ev('studio.people().map(p=>({name:p.name,reference:p.h.look?.reference}))')});
  }
  console.log(world,'captured');
 }
 // Screen a reproducible sample of all 25 world costume families and the actual traveller.
 const allWorlds=[...worlds,'mangrove','saltharbour','waterfall','antennas','atelier','glassdunes','underwater','eclipse','fallenring','moonfoundry','underside','spacecity','overnighttrain'];
 for(const world of travellerOnly?[]:allWorlds){
  await c.send('Page.navigate',{url:`http://127.0.0.1:5488/studio.html?who=crowd&world=${world}&lineup=crowd&count=4&seed=1&source=makehuman&view=full&anim=game:walk`});
  for(let i=0;i<240;i++){if(await c.ev('!!window.studio && studio.people().length>=4').catch(()=>false))break;await sleep(250);}
  await sleep(1100);
  const data=await c.ev("studio.sheet({cols:4,w:350,h:620,view:'full'})");
  const file=`crowd-${world}.png`;writeFileSync(join(OUT,file),Buffer.from(data.split(',')[1],'base64'));
  manifest.push({world,pose:'walk',category:'crowd sample',seeds:[1,2,3,4],file});
 }
 await c.send('Page.navigate',{url:'http://127.0.0.1:5488/studio.html?who=traveller&world=desert&view=full'});
 for(let i=0;i<240;i++){if(await c.ev('!!window.studio').catch(()=>false))break;await sleep(250);}
 for(const [pose,yaw] of [['idle',0],['walk',1.57],['run',-.7]]){
  await c.ev(`studio.set({anim:'game:${pose}'});studio.orbit.yaw=${yaw}`);await sleep(1100);
  const data=await c.ev("studio.sheet({cols:1,w:600,h:800,view:'full'})");const file=`traveller-${pose}.png`;
  writeFileSync(join(OUT,file),Buffer.from(data.split(',')[1],'base64'));manifest.push({world:'desert',category:'traveller',pose,yaw,file});
 }
 writeFileSync(join(OUT,'coverage.json'),JSON.stringify({captures:manifest,errors:c.errors},null,2));
 writeFileSync(join(OUT,'index.html'),`<!doctype html><meta charset="utf-8"><title>Character quality pass</title><style>body{background:#eee6d8;font:16px sans-serif;margin:30px}img{max-width:100%}article{margin-bottom:40px}</style><h1>Character quality pass</h1><p>Captured views, not an automatic visual pass. Idle front, walk side, sit back, talk three-quarter.</p>`+manifest.map(m=>`<article><h2>${m.world} · ${m.pose}</h2><img loading="lazy" src="${m.file}"></article>`).join(''));
 if(c.errors.length)throw Error(c.errors.join('\n'));
}finally{await c.close();await server.close();}
