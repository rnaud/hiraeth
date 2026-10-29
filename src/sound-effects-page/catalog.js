// Site-only inventory: gameplay callbacks remain owned by the music catalogue.
import { EFFECTS } from '../music-page/catalog.js';
import { gameSfx } from '../minigames/kit/sfx.js';
import { motor } from '../minigames/canyon.js';
import { courtSounds } from '../minigames/cistern.js';
import { skySounds } from '../minigames/elderflight.js';
import { raceSounds } from '../minigames/rings.js';
import { dropSounds } from '../minigames/wingdrop.js';
import { SFX } from '../sfx.js';
import { FOE_VOICES } from '../foe-voices.js';
import { FOE_CALLS } from '../foe-sounds.js';
import { ACTION_SFX } from '../action-sfx.js';
import { recordedOrigin } from '../sfx-trace.js';

export const EXCLUDED_GROUPS = new Set(['Voices', 'Instruments', 'Building blocks']);
const record = (groups, mixed = false, note = 'Assigned recordings load before playback; missing files stop this preview.') => ({ groups: groups.split(' ').filter(Boolean), mixed, note });
// Explicit runtime routing, audited against audio.js and the shared ship controllers.
export const ROUTES = {
  grab: record('grab cloth'),
  boxOpen: record('chest-open'), keyTurn: record('key-unlock'),
  doorway: record('temple-slide-open'), doorOpen: record('temple-slide-open'),
  hologramOn: record('hologram-crt'), 'layer:temple': record('temple-ambience'),
  'layer:bike': record('hoverbike-glide', true, 'Recorded glide with the separate cloak/wind movement texture.'),
  knockdown: record('fall hurt'), hurt: record('land hurt'), effort: record('effort'),
  wings: record('flap', true), flap: record('flap'), jets: record('swing-heavy', true),
  boxCreak: record('creak', true), boxWobble: record('knock', true),
  pickup: record('small-pickup'),
  potion: record('cloth', true), fragmentTaken: record('small-pickup', true),
  fluidShoot: record('fluid-shot'), fluidWindup: record('cloth', true),
  fluidBlock: record('splat knock', true), shield: record('shield-bloom'),
  fluidRefill: record('fluid-refill'), splash: record('splash', true), stroke: record('stroke'),
  quest: record('quest-important'), fanfare: record('treasure-reveal'),
  'ship:ring': record('voicemail-ready'), 'ship:beep': record('ship-confirm'), toss: record('cloth effort', true, 'Cloth and a synthesized swish; a recorded effort is included on 40% of throws.'), underwater: record('splash', true),
  'pirates:engine': record('ship-thrust'), 'ship:hum': record('ship-idle'), 'ship:engines': record('ship-thrust'), 'ship:deck': record('deck-open deck-close'),
};
const extra = (id, name, group, variants, route) => ({ id, name, group, variants, where: 'Shared action routing; not a temple-specific sound.', route });
const vocalNames = { 'attack-light':'Light attack effort','attack-heavy':'Heavy attack effort','attack-follow':'Follow-through effort','jump-standing':'Standing jump effort','jump-running':'Running jump effort','land-soft':'Soft landing effort','land-heavy':'Heavy landing effort', mantle:'Ledge pull-up effort',run:'Running breath',recover:'Sprint recovery' };
const VOCALS = Object.entries(vocalNames).map(([id,name]) => extra('effort:'+id,name,'Character efforts', [['Play',(s)=>s.actionVocal(id)]], record('vox-'+id,false,'One nonverbal effort; assigned takes load before playback.')));
const NEXT = [
  extra('bladeForm','Blade forming','The blade and the shield',[['Play',s=>s.bladeForm()]],record('blade-form',false,'Assigned recording; loading errors stop the preview.')),
  extra('discovery','A new place discovered','Quests and moments',[['Play',s=>s.discovery()]],record('discovery-reveal')),
  extra('low-fluid','Fluid running low','The fluid gun',[['Threshold crossing',s=>{s.fluidLevel(.8);s.fluidLevel(.2);}]],record('low-fluid',false,'One recorded warning per low-fluid episode.')),
  extra('templeLocked','A locked temple mechanism','Temple interactions',[['Play',s=>s.templeLocked()]],record('temple-locked',false,'Assigned locked-mechanism recording.')),
  extra('templeMechanism','A mechanical switch','Temple interactions',[['Play',s=>s.templeMechanism()]],record('temple-mechanism')),
];
const procedural = { groups: [], mixed: false, note: 'Synthesized directly; no recording request.' };
export const DELEGATED_FACTORIES = [
  ['arcade', gameSfx, ['tick','coin','gate','miss','jump','spring','land','crumble','checkpoint','hurt','finish','lose','whoosh']],
  ['cistern', courtSounds, ['grind','thunk','fill','spout','trough','spill']],
  ['elderflight', skySounds, ['cry','gate','mult','gust']],
  ['rings', raceSounds, ['chime','fill','crash','low']],
  ['wingdrop', dropSounds, ['open','star','lift','bull']],
];
const ARCADE = DELEGATED_FACTORIES.flatMap(([id,make,names])=>names.map(name=>extra(`${id}:${name}`,`${id} · ${name}`,'Arcade games', [['Play',s=>make(s)[name](1,1)]],name==='finish'?record('treasure-reveal'):procedural)));
ARCADE.push(extra('canyon:motor','Canyon hoverbike motor','Arcade games',[['Cruise and boost',(s,e)=>{const m=motor(s);e.hold(4,()=>m?.set(18,e.phase()>.5?1:0,true),()=>m?.stop());}]],record('hoverbike-glide')));
NEXT.push(extra('templeDoor','Sliding temple door','Temple interactions', [true,false].map(open=>[open?'Open':'Close',(s,e)=>{
  const piece={rt:{},id:'preview',k:open?0:1};s.templeDoor(piece,open);
  e.hold(1.8,()=>{piece.k=open?e.phase():1-e.phase();s.templeDoorUpdate(piece);},()=>{piece.k=open?1:0;s.templeDoorUpdate(piece);});
}]),record('temple-slide-open')));
export const ACTIONS = [...EFFECTS.filter(e=>!EXCLUDED_GROUPS.has(e.group)&&!e.id.startsWith('sample:')), ...VOCALS,...NEXT,...ARCADE];
export const RECORDINGS = EFFECTS.filter(e=>e.id.startsWith('sample:')).map(e=>({...e,where:'Raw recording bank; one group, with shuffled takes. All takes load before this isolated preview.'}));
export const INVENTORY = [...ACTIONS,...RECORDINGS];
export const filesFor = groups => groups.flatMap(g=>Array.from({length:SFX[g]?.n??0},(_,i)=>`${g}-${i}.${SFX[g].ext??'mp3'}`));
export const PROCEDURAL = new Set(`grunt heartbeat wade bubbles gasp waterRise fluidMode fluidSplash fluidPush fluidBoost fluidEmpty fluidDock lockOn fluidCharge fluidRiposte fluidDash flurry drone whistle packCall tune psst boxLatch boxOpen boxBurst keyGet keyTurn templeTick boxAnswer boxHum potionPickup chimePickup chimeScatter shopBell purchase chime doorOpen ui toolClick shutter fail whoosh rumble page doorway bell fragmentSong finderBeep orbNote remembered instrument:skybell foeWarn guardianWarn foeGlance foeArmour foeKill fireball critter bark chirp horn croak tuning trainWhistle clack ring drip moan creak ship:impact ship:staticBurst ship:rumble ship:roar ship:hatch ship:approach ship:reentry ship:descent ship:alarm`.split(' '));
// These controller cues were reviewed individually. New named cues fail coverage until classified.
export const PIRATE_PROCEDURAL = new Set('shot enemy tell hit boom clank deflect roll charge lock missile dry pickup rearm hull warning incoming combo comms tally boost brake spent upgrade gunLost arrive bed thunder'.split(' '));
export const AMBIENT_PROCEDURAL = new Set('wind storm high rain rainRoof cloak jet roar hum bike rails'.split(' '));
// (each foe's hurt and burst, and its calls, movement and blows: issue #771, all synthesised)
const foeIds = new Set([...Object.keys(FOE_VOICES).map(kind=>'foe:'+kind), ...Object.keys(FOE_CALLS).map(k=>'foecall:'+k), 'foemove', 'foeblow']);
export function routeFor(entry, variant = 0) {
  if(entry.id.startsWith('sample:')) return record(entry.id.slice(7),false,'Raw recording group; missing files stop this preview.');
  if(entry.route) return entry.route;
  const id=entry.id, label=entry.variants[variant]?.[0]??'';
  if(id==='fluidSlashHit'&&variant===0)return {groups:[],mixed:false,silent:true,note:'No hit: the game intentionally emits no impact sound.'};
  // The isolated shared player starts on sand, stationary, with a fresh voice controller.
  if(id==='jump')return record('step-sand belt vox-jump-standing');
  if(id==='mantle')return record('cloth belt step-sand vox-mantle');
  if(id==='getUp')return record(variant===0?'cloth belt':'cloth belt sigh');
  if(id==='evade')return record('swing-heavy cloth step-sand');
  if(id==='hurt'&&variant===2)return record('hurt');
  if(id==='land')return variant===0?record('step-sand vox-land-soft'):record(`step-sand vox-land-heavy ${variant===1?'land':'land-heavy'} cloth`,true);
  if(id==='fluidSlash')return record(`${variant===2?'blade-heavy':'blade-light'} vox-attack-${['light','follow','heavy'][variant]}`,true);
  if(id==='fluidSlashHit'&&variant>0)return record(`splat ${variant===2?'land-heavy':'land'}`,true);
  if(id==='underwater'&&variant===1)return {groups:[],mixed:false,silent:true,note:'Changes the mix filter without creating a sound.'};
  if(id==='ship:deck')return record(variant===0?'deck-open':'deck-close');
  if(id==='step') return record('step-'+label.split(' ')[0]);
  if(id==='fluidShoot' && variant>0 || id==='fluidRefill'&&variant===1 || id==='shield'&&variant>0 || id==='effort'&&variant===1 || id==='quest'&&variant<2 || id==='potion'&&variant>0 || id==='ship:beep'&&variant===0) return {groups:[],mixed:false,note:'Synthesized directly; no recording request.'};
  if(id==='fluidBlock'&&variant===1) return record('shield-parry');
  if(ROUTES[id])return ROUTES[id];
  if(PROCEDURAL.has(id)||foeIds.has(id)||(id.startsWith('pirates:')&&PIRATE_PROCEDURAL.has(id.slice(8)))||(id.startsWith('layer:')&&AMBIENT_PROCEDURAL.has(id.slice(6))))return procedural;
  return ROUTES[id]??{groups:[],mixed:false,unclassified:true,note:'This action has no reviewed source mapping. Playback is unavailable.'};
}
export function sourceInfo(entry, variant, manifest) {
  const route=routeFor(entry,variant),files=filesFor(route.groups),origins=[...new Set(files.map(f=>recordedOrigin(manifest,f)))];
  const labels=origins.map(o=>o==='ElevenLabs'?'Recorded — ElevenLabs':o==='Other recording'?'Recorded — other':'Unknown recording');
  const badge=route.unclassified?'Unclassified':route.silent?'Silent variant':route.context?'Context-dependent':route.mixed?'Mixed':labels.length?labels.join(' + '):'Procedural';
  return {...route,files,origins,labels,badge,display:route.mixed?`${labels.join(' + ') || 'Recording'} + procedural layers`:badge};
}
export function matchesSource(entry,variant,source,manifest) {
  const info=sourceInfo(entry,variant,manifest);
  return !source||info.badge===source||info.labels.includes(source);
}
export function filterInventory(entries,{query='',source='',group=''}={},manifest) {
  const q=query.trim().toLowerCase();return entries.filter(e=>{
    const info=e.variants.map((_,i)=>sourceInfo(e,i,manifest));
    return (!group||e.group===group)&&(!source||info.some(x=>x.badge===source||x.labels.includes(source)))&&(!q||[e.name,e.group,e.where,e.id,...info.flatMap(x=>[x.badge,...x.groups,...x.files])].join(' ').toLowerCase().includes(q));
  });
}
/** Mutually exclusive bins: each gameplay variant contributes exactly once, never raw bank cards. */
export function variantCoverage(manifest, actions=ACTIONS) {
  const bins={
    'Recorded — ElevenLabs':0,
    'Recorded — other':0,
    'Recorded — ElevenLabs + other':0,
    'Mixed — recording + procedural':0,
    'Procedural':0,
    'Silent variant':0,
    'Unknown recording':0,
    'Unclassified':0,
  };
  for(const entry of actions)for(let i=0;i<entry.variants.length;i++) {
    const info=sourceInfo(entry,i,manifest);
    const key=info.unclassified?'Unclassified':info.silent?'Silent variant':info.mixed?'Mixed — recording + procedural':
      !info.groups.length?'Procedural':info.origins.includes('Unknown recording')?'Unknown recording':
      info.origins.length>1?'Recorded — ElevenLabs + other':info.labels[0];
    bins[key]++;
  }
  return bins;
}
export function inventoryCounts(manifest) {
  return {coverage:variantCoverage(manifest),actions:ACTIONS.length,variants:ACTIONS.reduce((n,e)=>n+e.variants.length,0),recordingGroups:RECORDINGS.length,recordingFiles:filesFor(Object.keys(SFX)).length,selectedActionTakes:filesFor(Object.keys(ACTION_SFX)).length,characterEfforts:VOCALS.length,missingProvenance:filesFor(Object.keys(SFX)).filter(f=>recordedOrigin(manifest,f)==='Unknown recording').length};
}
