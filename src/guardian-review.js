import * as T from 'three';
import {slots} from './save-slots.js';

// Explicit review URL only. Progress and encounter writes stay in memory.
export async function seedGuardianReview() {
 slots.sandbox();
 const {game}=await import('./game-state.js');
 game.data={flags:{'prologue.done':true,'ship.powered':true,'ship.launched':true,
  ...Object.fromEntries(['backpack','gun','sword','shield','lift','glider'].map(id=>[`item.${id}`,1]))},keepsakes:[]};
 game.save();
}
export function startGuardianReview({level,player,sound,rig,kind='keeper'}) {
 const elder=kind==='elder';
 const rt=level.temples?.find(t=>t.id===(elder?'arzach':'desert')),g=rt?.guardian;if(!g)return;
 sound.muted=true;sound.setVolumes(0,0);sound.setVoices(0);
 if(sound.master)sound.master.gain.setValueAtTime(0,sound.ctx.currentTime);
 player.opts.health=false;
 const panel=document.createElement('section');panel.style.cssText='position:fixed;top:12px;left:12px;z-index:1000;max-width:390px;padding:10px;background:#fff8e9ed;color:#302b25;font:13px system-ui;border-radius:8px';
 panel.innerHTML='<b>'+ (elder?'Elder of Vael':'Cistern-Keeper') +' · live temple review</b><p style="margin:5px 0">Temporary progress · silent · invulnerable</p><button data-act="arena">Enter cistern</button> <button data-act="reset">Reset encounter</button> <button data-act="open">Water opening</button> <button data-act="weary">Final touch</button><p data-status style="margin:5px 0"></p>';
 const enter=()=>{const at=g.arena.center.clone().add(new T.Vector3(0,0,-10));player.teleport(at,new T.Vector3(0,1,0),new T.Vector3(0,0,1));player.heading=Math.atan2(g.model.pos.x-at.x,g.model.pos.z-at.z);rig.yaw=player.heading+Math.PI;rig.pitch=-.12;};
 panel.addEventListener('click',e=>{
  const act=e.target.dataset.act;if(!act)return;
  if(act==='arena')enter();
  if(act==='reset'){g.floor=g.meter=0;g.reset();enter();}
  if(act==='open'){g.stop();g.floor=g.meter=elder?.46:.4;g.enter('open');g.openFor=20;}
  if(act==='weary'){g.stop();g.meter=.8;g.floor=.8;g.enter('weary');}
 });
 if(elder){panel.querySelector('[data-act=arena]').textContent='Enter roost';panel.querySelector('[data-act=open]').textContent='Flight opening';}
 document.body.append(panel);enter();
 const timer=setInterval(()=>{panel.querySelector('[data-status]').textContent=`${g.model.group.name} · ${g.state} · calm ${Math.round(g.meter*100)}% · master ${sound.master?.gain.value??0} · mouth ${(g.model.mouth.y-g.arena.y).toFixed(1)} m`;},250);
 addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
