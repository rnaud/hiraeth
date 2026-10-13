// Explicit live-game QA URL; boot.js seeds in-memory progress before loading.
export function startCharacterReview({player,sound,rig,input}){
 sound.muted=true;sound.setVolumes(0,0);sound.setVoices(0);
 if(sound.master)sound.master.gain.setValueAtTime(0,sound.ctx.currentTime);
 player.opts.health=false;
 const spawn=player.pos.clone(),heading=player.heading;
 const panel=document.createElement('section');panel.id='character-review';
 panel.style.cssText='position:fixed;top:10px;left:10px;z-index:10000;max-width:350px;padding:10px;background:#fff8e9ed;color:#302b25;font:13px system-ui;border-radius:8px';
 panel.innerHTML='<b>B3 · playable traveller</b><p>Temporary progress · silent</p><button data-act="idle">Idle</button> <button data-act="walk">Walk</button> <button data-act="run">Run</button> <button data-act="reset">Reset position</button><p><button data-angle="front">Front</button> <button data-angle="side">Side</button> <button data-angle="back">Back</button></p><output></output>';
 let stopTimer;
 const stop=()=>{input.KeyW=false;input.ShiftLeft=false;clearTimeout(stopTimer)};
 panel.addEventListener('click',e=>{
  const {act,angle}=e.target.dataset;
  if(act){stop();if(act==='reset'){player.pos.copy(spawn);player.vel.set(0,0,0);player.heading=heading;}
   if(act==='walk'||act==='run'){input.KeyW=true;input.ShiftLeft=act==='run';stopTimer=setTimeout(stop,3000);}}
  if(angle){stop();rig.yaw=player.heading+({front:0,side:Math.PI/2,back:Math.PI}[angle]);rig.pitch=.16;rig.dist=5.5;}
 });
 document.body.append(panel);
 const timer=setInterval(()=>{const c=player.character;panel.querySelector('output').textContent=`${c?.mesh.name??'fallback body'} · ${c?.cloth.gpu?'GPU cloth':'CPU cloth'}${c?.cloth.threaded?' + worker':''} · master ${sound.master?.gain.value??0} · music ${sound.musicVol} · effects ${sound.fxVol} · voices ${sound.voiceVol}`;},250);
 addEventListener('pagehide',()=>{stop();clearInterval(timer)},{once:true});
}
