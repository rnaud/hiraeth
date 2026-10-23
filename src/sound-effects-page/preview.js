import { Player } from '../music-page/player.js';
import { recordedOrigin } from '../sfx-trace.js';

/** One preview owns one disposable music-page player. Stop also cancels pending load/ready work. */
export class EffectPreview {
  constructor({ muted=false, manifest=null, changed=()=>{}, makePlayer=o=>new Player(o) }={}) { Object.assign(this,{muted,manifest,changed,makePlayer});this.epoch=0; }
  stop() {
    this.epoch++; clearInterval(this.timer); this.player?.dispose();this.player=null;
    this.changed({state:'stopped',text:'Stopped. No preview is playing.'});
  }
  async play(entry,variant,{volume=.6,retry=false}={}) {
    this.stop();const token=this.epoch;
    const p=this.player=this.makePlayer({muted:this.muted});p.vol=volume;
    this.changed({state:'loading',id:entry.id,text:'Preparing preview…'});
    try {
      const sound=await p.preparePreview({effects:true,retry,current:()=>token===this.epoch,onProgress:progress=>{
        if(token===this.epoch)this.changed({state:'loading',id:entry.id,text:'Loading assigned recordings…',progress});
      }});
      if(!sound||token!==this.epoch)return;
      sound.musicCue=()=>{}; // This page excludes the background music triggered by rewards.
      const trace=sound.sfxTrace;
      if(!trace)throw Error('Source tracing is unavailable in this build. Preview stopped.');
      await trace.enable(true,{manifest:this.manifest,hud:false});if(token!==this.epoch)return;
      trace.recent=[];trace.active.clear();
      const from=trace.serial;
      trace.run(entry.name,()=>p.play(entry.variants[variant][1]));
      const refresh=()=>{
        if(token!==this.epoch)return;
        trace.refresh();const events=[...trace.active.values(),...trace.recent].filter(e=>e.id>from&&e.shown);
        const sources=[...new Set(events.map(e=>e.file?recordedOrigin(this.manifest,e.file):e.source))];
        const text=this.muted?'Review muted: no audible-source claim.':sources.length?'This preview: '+sources.join(' + '):'No effect emitted yet (loading, suppressed, or silent variant).';
        this.changed({state:'playing',id:entry.id,text,events,sources});
      };
      refresh();this.timer=setInterval(refresh,100);
    } catch(error) { if(token===this.epoch){this.stop();this.changed({state:'error',id:entry.id,text:error.message,details:error.failures??error.details??null});} }
  }
}
