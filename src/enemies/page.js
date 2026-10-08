import * as T from 'three';
import { ItemViewer, dragOrbit, zoomOrbit } from '../items-page/viewer.js';
import { Foes } from '../foes.js';
import { GameState } from '../game-state.js';
import { ENEMY_ROSTER, WORLD_ENEMIES, ENEMY_BY_ID } from './roster.js';
import { lockAttack } from './attacks.js';

const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
let world=WORLD_ENEMIES[query.get('world')]?query.get('world'):'desert';
let chosen=ENEMY_BY_ID[query.get('enemy')]?.id??WORLD_ENEMIES[world][0].id;
world=ENEMY_BY_ID[chosen].world;
class EnemyViewer extends ItemViewer {
  constructor(){super();this.backdrop.material=this.backdrop.material.clone();this.backdrop.material.fragmentShader=this.backdrop.material.fragmentShader.replace('L = mix(L, 1.0, max(uGlow, emit));','L = 1.0;');this.backdrop.material.needsUpdate=true;this.mode='idle';this.fixed=null;this.orbit={yaw:.45,pitch:.15,zoom:1};this.cascade.configure(2048,16);this.cascade.prime(this.renderer);}
  model(id){
    let m=this.models.get(id);
    if(!m){
      for(const old of this.models.values()){old.owner.dispose();old.holder.removeFromParent();}this.models.clear();
      const owner=new Foes({level:{foes:{own:true}},levelId:'arena',scene:null,player:{pos:new T.Vector3(0,0,4)},physics:{groundAt:()=>0},game:new GameState(null)});
      const f=owner.add(id,new T.Vector3());f.heading=0;owner.look(f,0);
      const b=new T.Box3().setFromObject(f.model.group),centre=b.getCenter(new T.Vector3());
      const holder=new T.Group();holder.add(owner.group);
      m={holder,owner,f,centre,r:b.getBoundingSphere(new T.Sphere()).radius,height:b.max.y-b.min.y,fluids:[]};this.models.set(id,m);
    }
    m.holder.position.set(0,0,0);m.owner.group.position.set(0,0,0);m.holder.updateMatrixWorld(true);
    const f=m.f,dt=this.fixed?0:1/60;
    f.heading=0;f.pos.set(0,0,0);f.stunned=0;
    let phase=this.fixed?.state??this.mode,k=this.fixed?.k??0;
    if(this.mode.startsWith('attack')){
      const index=Number(this.mode.slice(-1)),a=f.attacks[index],u=this.time%(a.wind+a.strike+a.recover);
      f.selectAttack(index);lockAttack(f,m.owner.player);
      if(!this.fixed){phase=u<a.wind?'wind':u<a.wind+a.strike?'strike':'recover';k=phase==='wind'?u/a.wind:phase==='strike'?(u-a.wind)/a.strike:0;}
    }
    f.state=phase==='walk'?'chase':phase;f.k=k;f.timer=f.def.recover;
    if(phase==='strike'&&f.def.attack.lunge)f.pos.z=f.def.attack.lunge*(1-(1-k)**2);
    f.alt=f.def.hover?(phase==='strike'&&f.def.attack.dive?T.MathUtils.lerp(f.def.hover,.35,k):phase==='recover'?.35:f.def.hover):0;
    m.owner.look(f,dt);
    // Pose fitting includes all visible attack areas when showing a move.
    const b=new T.Box3().setFromObject(f.model.group);
    if(this.mode.startsWith('attack'))for(const zone of f.zones??[]){
      const a=zone.attack,o=zone.at,h=zone.heading;
      if(a.shape==='ring'){for(const x of [-1,1])for(const z of [-1,1])b.expandByPoint(new T.Vector3(o.x+x*a.radius,0,o.z+z*a.radius));}
      else if(a.shape==='cone'){b.expandByPoint(o);for(let i=0;i<=8;i++){const angle=h-a.angle+2*a.angle*i/8;b.expandByPoint(new T.Vector3(o.x+Math.sin(angle)*a.range,0,o.z+Math.cos(angle)*a.range));}}
      else for(const along of [0,a.range])for(const side of [-a.width/2,a.width/2])b.expandByPoint(new T.Vector3(o.x+Math.sin(h)*along+Math.cos(h)*side,0,o.z+Math.cos(h)*along-Math.sin(h)*side));
    }
    const centre=b.getCenter(new T.Vector3());m.owner.group.position.copy(centre).negate();
    m.r=b.getBoundingSphere(new T.Sphere()).radius;m.height=b.max.y-b.min.y;
    return m;
  }
}
const viewer=new EnemyViewer();$('stage').append(viewer.renderer.domElement);
$('world').innerHTML=Object.entries(WORLD_ENEMIES).map(([w,r])=>`<option value="${w}">${r[0].worldTitle}</option>`).join('');
function choose(id){
  chosen=id;const s=ENEMY_BY_ID[id];world=s.world;$('world').value=world;
  $('enemy').innerHTML=WORLD_ENEMIES[world].map(e=>`<option value="${e.id}">${e.name}</option>`).join('');$('enemy').value=id;
  $('name').textContent=s.name;$('kind').textContent=s.category==='possessed-machine'?'An ancient machine occupied by a hostile spirit':s.category==='shadow-spirit'?'A humanoid spirit in living shadow':'A creature of '+s.worldTitle;
  const f=viewer.model(id).f;
  $('moves').innerHTML=f.attacks.map((a,i)=>`<button data-attack="${i}">${a.name}</button><p>${describe(a)} Wind-up: ${a.wind}s. Recovery: ${a.recover}s.</p>`).join('');
  $('fight').href=`./?level=arena&enemy=${encodeURIComponent(id)}`;$('fightworld').href=`./?level=arena&enemyWorld=${world}`;
  $('calm').hidden=!['home','atelier','overnighttrain'].includes(world);
  viewer.time=0;viewer.mode=$('pose').value;history.replaceState(null,'',`?world=${world}&enemy=${encodeURIComponent(id)}`);
}
function describe(a){
  if(a.pull)return 'A marked fan draws you inward. Sidestep it or parry.';
  if(a.motion==='lob')return a.spread?'Three globs fall onto separated marked spots. Move between them.':'An arcing glob lands where you stood. Leave the marked circle.';
  if(a.lunge)return 'Commits to a straight rush along the marked lane. Dodge sideways, then punish the recovery.';
  if(a.shape==='cone')return a.contacts.length>1?'Two sweeps cross the marked fans. Stay outside both arcs or parry.':'A broad sweep strikes the marked fan. Move behind it or guard.';
  if(a.shape==='lane')return 'Fires down a narrow marked lane. Step out before it releases.';
  return 'A radial strike reaches the marked circle. Step clear during the wind-up.';
}
$('world').onchange=()=>choose(WORLD_ENEMIES[$('world').value][0].id);
$('enemy').onchange=()=>choose($('enemy').value);
$('pose').onchange=()=>{viewer.mode=$('pose').value;viewer.time=0;viewer.fixed=null;};
$('moves').onclick=e=>{const i=e.target.dataset.attack;if(i!==undefined){$('pose').value='attack'+i;$('pose').onchange();}};
let drag=null;$('stage').onpointerdown=e=>{drag=[e.clientX,e.clientY];$('stage').setPointerCapture(e.pointerId);};
$('stage').onpointermove=e=>{if(drag){dragOrbit(viewer.orbit,e.clientX-drag[0],e.clientY-drag[1]);drag=[e.clientX,e.clientY];}};
$('stage').onpointerup=()=>drag=null;
$('stage').addEventListener('wheel',e=>{e.preventDefault();zoomOrbit(viewer.orbit,Math.exp(e.deltaY*.001));},{passive:false});
choose(chosen);
let last=performance.now();
function frame(now){viewer.time+=Math.min(.05,(now-last)/1000);last=now;viewer.setSize($('stage').clientWidth,$('stage').clientHeight);viewer.render(chosen);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.enemyViewer={viewer,choose,roster:ENEMY_ROSTER,capture(id,{state='idle',k=0,attack=0,yaw=.45}={}){choose(id);viewer.mode=['wind','strike','recover'].includes(state)?'attack'+attack:state;viewer.fixed={state,k};viewer.orbit.yaw=yaw;viewer.time=1;viewer.setSize(900,800);viewer.render(id);return viewer.renderer.domElement.toDataURL('image/png');}};
