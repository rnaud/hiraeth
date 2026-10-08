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
 await c.send('Page.navigate',{url:'http://127.0.0.1:5488/enemies.html'});
 let ready=false;for(let i=0;i<240;i++){if(await c.ev('!!window.enemyViewer').catch(()=>false)){ready=true;break;}await sleep(250);}
 if(!ready)throw Error('Enemy viewer did not load: '+c.errors.join('\n'));
 const entries=await c.ev('enemyViewer.roster.map(e=>({id:e.id,world:e.world}))');const manifest=[];
 for(const e of entries){
  if(process.argv[2]&&e.world!==process.argv[2])continue;
  for(const [label,pose] of [['idle',{}],['walk',{state:'walk',yaw:1.6}],['attack1',{state:'strike',k:.5,attack:0,yaw:.6}],['attack2',{state:'wind',k:.9,attack:1,yaw:-.6}]]){
   const data=await c.ev(`enemyViewer.capture(${JSON.stringify(e.id)},${JSON.stringify(pose)})`);
   const file=e.id.replaceAll('/','--')+'--'+label+'.png';writeFileSync(join(OUT,file),Buffer.from(data.split(',')[1],'base64'));manifest.push({...e,pose:label,file});
  }
  console.log(e.id);
 }
 writeFileSync(join(OUT,process.argv[2]?'coverage-'+process.argv[2]+'.json':'coverage.json'),JSON.stringify({captures:manifest,errors:c.errors},null,2));
 if(c.errors.length)throw Error(c.errors.join('\n'));
}finally{await c.close();await server.close();}
