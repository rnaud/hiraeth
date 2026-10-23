import { SFX } from '../sfx.js';
// One action bank for every temple. No house ID selects a recording.
export class TempleAudio {
  constructor(sound) { this.sound = sound; this.doors = new Map(); this.cues = new Map(); this.paused = !!sound._actionPaused; }
  get now() { return this.sound.ctx?.currentTime ?? 0; }
  allowed() { const s=this.sound; return !!s.ctx && !s._disposed && !s.muted && !s.guard?.away() && !this.paused; }
  slots(rt) { let m=this.doors.get(rt); if (!m) this.doors.set(rt,m=new Map()); return m; }
  stop(slot) { slot?.handle?.stop(0); if (slot) slot.handle=null; }
  door(piece, open, instant = false) {
    const m=this.slots(piece.rt), old=m.get(piece.id);
    if (instant) { this.stop(old); m.delete(piece.id); return true; }
    // Twin leaves have the same logical ID: one movement, one cue.
    if (old?.open===open) return true;
    this.stop(old);
    const slot={piece,open,handle:null};m.set(piece.id,slot);
    if (!this.allowed()) return true;
    return this.start(slot);
  }
  start(slot) {
    const s=this.sound, offset=Math.min(1.799,Math.max(0,(slot.open ? slot.piece.k : 1-slot.piece.k)*1.8));
    const h=s.bank?.start('temple-slide-open',{dest:s.fx,offset});
    if (!h) return true;
    slot.handle=h;slot.started=this.now;slot.offset=offset;return true;
  }
  update(piece) {
    const m=this.doors.get(piece.rt), slot=m?.get(piece.id);
    if (!slot || slot.piece!==piece) return;
    const target=slot.open?1:0;
    if (Math.abs(piece.k-target)<1e-7) { this.stop(slot);m.delete(piece.id);return; }
    if (!this.allowed()) return;
    const physical=(slot.open ? piece.k : 1-piece.k)*1.8;
    // Resume only a cue stopped by pause; never attach a late-decoded recording
    // after a failed or unavailable start for this movement.
    if (slot.resume || (slot.handle && Math.abs(slot.offset+this.now-slot.started-physical)>.2)) {
      this.stop(slot);slot.resume=false;this.start(slot);
    }
  }
  cue(group, gap = .3) {
    if (!this.allowed()) return true;
    if (this.now-(this.cues.get(group)?.at??-1e9)<gap) return true;
    // A chest reward may also finish a quest in the same frame. One selected
    // reward cue is enough; do not stack two celebratory recordings.
    const reward = group === 'treasure-reveal' || group === 'quest-important' || group === 'chest-open';
    if (reward && this.now < (this.rewardUntil ?? 0)) return true;
    const h=this.sound.bank?.start(group,{dest:this.sound.fx});
    if (!h) return Object.hasOwn(SFX, group);
    if (reward) this.rewardUntil = this.now + h.duration;
    this.cues.get(group)?.handle.stop(0);
    this.cues.set(group,{at:this.now,handle:h});return true;
  }
  pause(on = true) {
    if (on && !this.paused) {
      for (const m of this.doors.values()) for (const slot of m.values()) { slot.resume=!!slot.handle;this.stop(slot); }
      for (const c of this.cues.values()) c.handle.stop(0);
    }
    this.paused=on;
  }
  release(rt) { for (const s of this.doors.get(rt)?.values()??[]) this.stop(s);this.doors.delete(rt); }
  dispose() { this.pause(true);this.doors.clear();this.cues.clear(); }
}
export function templeAudio(sound) { return sound ? (sound._templeAudio??=new TempleAudio(sound)) : null; }
