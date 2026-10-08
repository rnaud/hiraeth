import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OUT=join(ROOT,'output/character-local/world-enemies');
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


const server=await createServer({root:ROOT,cacheDir:join(tmpdir(),'hiraeth-enemy-vite'),server:{host:'127.0.0.1',port:5488,strictPort:true,hmr:false},logLevel:'error'});
await server.listen();const c=await chrome();mkdirSync(OUT,{recursive:true});
try {
 await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await c.send('Page.navigate',{url:'http://127.0.0.1:5488/?level=arena&enemyWorld=desert'});
 let ready=false;for(let i=0;i<480;i++){if(await c.ev('!!window.foes && !!window.player').catch(()=>false)){ready=true;break;}await sleep(250);}
 if(!ready)throw Error('Game failed to load: '+c.errors.join('\n'));
 await sleep(4500);
 const result=await c.ev(`(()=>{const roster=foes.level.foes.roster;foes.waveRest=0;foes.updateWaves(1);return {roster,enemies:foes.list.map(f=>({species:f.species,name:f.def.name,state:f.state})),level:level.id,health:player.health};})()`);console.log(JSON.stringify(result));
 if(result.roster!=='desert'||!result.enemies.some(f=>f.species?.startsWith('desert/')))throw Error('Arena did not spawn world enemies');
 const lineup=await c.ev(`(async()=>{
 const {WORLD_ENEMIES}=await import('/src/enemies/roster.js');const {lockAttack}=await import('/src/enemies/attacks.js');
 for(const f of [...foes.list])foes.remove(f);
 const p=player.pos.clone();
 for(const [i,e] of WORLD_ENEMIES.desert.entries()){
  const at=p.clone().add(new THREE.Vector3((i-1.5)*3,0,-5));at.y=physics.groundAt(at.x,at.y+5,at.z,20);
  const f=foes.add(e.id,at);f.heading=0;lockAttack(f,player);f.state='wind';f.k=.6;foes.look(f,.016);
 }
 return captureView(p.clone().add(new THREE.Vector3(6,5,12)),p.clone().add(new THREE.Vector3(0,1.1,-5)),1400,900,{fov:45});
 })()`);writeFileSync(join(OUT,'arena-lineup.jpg'),Buffer.from(lineup.split(',')[1],'base64'));
 const frame=await c.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(OUT,'arena-live.png'),Buffer.from(frame.data,'base64'));
 await c.send('Page.navigate',{url:'http://127.0.0.1:5488/enemies.html?world=arzach'});
 for(let i=0;i<240;i++){if(await c.ev('!!window.enemyViewer').catch(()=>false))break;await sleep(250);}
 await c.ev(`document.getElementById('enemy').value='arzach/storm-ray';document.getElementById('enemy').dispatchEvent(new Event('change'));document.getElementById('pose').value='attack0';document.getElementById('pose').dispatchEvent(new Event('change'));`);
 await sleep(1500);const gallery=await c.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(OUT,'gallery-live.png'),Buffer.from(gallery.data,'base64'));
 console.log('Gallery UI',await c.ev(`({title:document.getElementById('name').textContent,fight:document.getElementById('fight').href,mode:enemyViewer.viewer.mode})`));
 console.log('Errors',c.errors);if(c.errors.length)throw Error(c.errors.join('\n'));
}finally{await c.close();await server.close();}
