// Opt-in SFX graph diagnostics. No audio is generated or routed by this module.
// Music and spoken dialogue are excluded; this reports graph emission, not device audibility.
import { screen } from './platform.js';

export const TRACE_LIMIT = 12;
const NAMES = { jet: 'Backpack jets', roar: 'Ship flight air', hiss: 'Ship flight hiss', rumble: 'Ship rumble', rush: 'Ship passing air', engine: 'Ship engine', static: 'Radio static', rainRoof: 'Rain on roof', cloak: 'Clothing', 'blade-light': 'Light blade strike', 'blade-heavy': 'Heavy blade strike' };
export const traceName = name => NAMES[name] ?? String(name).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
export function recordedOrigin(manifest, file) {
  const m = manifest?.files?.[file.replace(/\.(mp3|wav)$/i, '')];
  if (!m) return 'Unknown recording';
  return /elevenlabs/i.test(m.from ?? m.provider ?? '') ? 'ElevenLabs' : 'Other recording';
}
export class SfxTrace {
  constructor(sound) { this.sound = sound; this.enabled = false; this.active = new Map(); this.recent = []; this.serial = 0; this.manifest = null; this.restore = []; this.beds = new Map(); }
  get now() { return this.sound.ctx?.currentTime ?? 0; }
  audible(bus = this.sound.fx, gain = 1) {
    const s = this.sound;
    return this.enabled && !s._disposed && !s.muted && !s.guard?.away() && gain > 0.00001 && (s.master?.gain?.value ?? 1) > 0.00001 && (bus?.gain?.value ?? 1) > 0.00001 && (bus === s.voices ? s.voiceVol : s.fxVol) !== 0;
  }
  begin({ name, source, when = this.now, loop = false, gain = 1, bus, until = Infinity, file = null, existing = false }) {
    if (!this.audible(bus, gain)) return null;
    const e = { id: ++this.serial, name: traceName(name), source, when, loop, gain, bus, until, file, ended: false, shown: existing };
    this.active.set(e.id, e); return e;
  }
  end(e, when = this.now) { if (e) { e.until = Math.min(e.until, when); this.refresh(); } }
  level(e, gain) { if (e) { e.gain = gain; this.refresh(); } }
  refresh() {
    if (!this.enabled || this.refreshing) return;
    this.refreshing = true;
    const s = this.sound;
    this.attach();
    for (const h of s.bank?.active ?? []) {
      if (!h.traceEvent && h.traceInfo) h.traceEvent = this.begin(h.traceInfo());
      if (h.traceEvent) h.traceEvent.gain = h.traceInfo().gain;
    }
    const beds = Object.entries(s.layers ?? {}).map(([name, l]) => [name, l.g]);
    if (s.engine) beds.push(['engine', s.engine.gain]);
    if (s.hum) beds.push(['signal hum', s.hum.gain]);
    for (const [name, l] of Object.entries(s._ship ?? {})) if (l.g) beds.push([`Ship ${name}`, l.g]);
    for (const [name, l] of Object.entries(s._pirateBeds ?? {})) beds.push([`Pirates ${name} ambience`, l.g]);
    if (s._canyonMotor) beds.push(['Hoverbike motor', s._canyonMotor]);
    const liveBeds = new Set(beds.map(([name]) => name));
    for (const [name, event] of this.beds) if (!liveBeds.has(name)) { event.until=this.now; this.beds.delete(name); }
    for (const [name, node] of beds) {
      const gain = node?.gain?.value ?? 0, old = this.beds.get(name);
      if (this.audible(s.fx, gain)) { if (!old) this.beds.set(name, this.begin({name, source:'Procedural', loop:true, bus:s.fx, gain, existing:!!this.seedExisting})); else old.gain=gain; }
      else if (old) { old.until=this.now; this.beds.delete(name); }
    }
    this.seedExisting = false;
    const now = this.now;
    for (const [id, e] of this.active) {
      if (e.layers) { e.until = Math.max(...e.layers.map(l => l.until)); e.gain = Math.max(...e.layers.map(l => l.gain), 0); }
      if (e.until <= e.when) { this.active.delete(id); continue; }
      if (!e.shown && now >= e.when && this.audible(e.bus, e.gain)) {
        e.shown = true; this.recent.unshift(e); this.recent.length = Math.min(this.recent.length, TRACE_LIMIT);
      }
      if (now >= e.until) { e.ended = true; this.active.delete(id); }
    }
    const label = e => `${e.name} · ${e.file ? recordedOrigin(this.manifest, e.file) : e.source}${e.layers?.length > 1 ? ` · ${e.layers.length} layers` : ''}`;
    const loops = [...this.active.values()].filter(e => e.loop && e.shown && now >= e.when && this.audible(e.bus, e.gain));
    const rows = this.recent.map(e => `${e.ended ? 'ended' : this.audible(e.bus, e.gain) ? 'playing' : 'silent'} · ${label(e)}`);
    const view = { title: 'Sound effects', scope: 'Music and spoken dialogue excluded', status: this.sound.muted ? 'Muted' : '', loopCount: loops.length, loops: loops.slice(0, 8).map(label), rows };
    screen.set('sfxTrace', view);
    if (this.el) this.el.textContent = `${view.title}\n${view.scope}\n${view.status}\n\nPlaying (${loops.length})\n${view.loops.join('\n') || 'None'}\n\nRecent\n${rows.join('\n') || 'None yet'}`;
    this.refreshing = false;
  }
  run(name, fn) {
    if (!this.enabled) return fn();
    const prior = this.scope;
    if (this.scope == null) this.scope = {name, event:null};
    try { return fn(); } finally { if (this.scope !== prior) this.flushScope(this.scope); this.scope = prior; }
  }
  flushScope(scope) { for (const accept of scope?.pending ?? []) accept(); }
  attach() {
    const s = this.sound;
    if (s.bank && s.bank.trace !== this) {
      s.bank.trace = this;
      for (const h of s.bank.active) if (h.traceInfo) h.traceEvent = this.begin({...h.traceInfo(), existing:true});
    }
    if (s.ctx && this.attachedContext !== s.ctx) { this.attachedContext = s.ctx; installProceduralTrace(this); }
  }
  async enable(on = true) {
    if (on === this.enabled) return;
    this.enabled = on;
    this.seedExisting = on;
    if (!on) { clearInterval(this.timer); this.restore.splice(0).reverse().forEach(f => f()); this.attachedContext = null; this.active.clear(); this.beds.clear(); this.recent = []; screen.set('sfxTrace', null); this.el?.remove(); this.el = null; if (this.sound.bank) this.sound.bank.trace = null; return; }
    const s = this.sound;
    this.attach();
    if (globalThis.document?.createElement && !globalThis.document.hudIsData) {
      this.el = document.createElement('pre'); this.el.id = 'sfx-source-trace';
      this.el.style.cssText = 'position:fixed;right:12px;top:68px;z-index:7800;max-width:min(400px,calc(100vw - 24px));max-height:70vh;overflow:auto;pointer-events:none;white-space:pre-wrap;background:#f7ecd2ee;color:#2b211f;border:2px solid #2b211f;padding:10px;font:12px/1.4 var(--face);margin:0';
      document.body.appendChild(this.el);
    }
    this.timer = setInterval(() => this.refresh(), 100);
    this.refresh();
    try { const r = await fetch(`${import.meta.env?.BASE_URL ?? './'}sfx/manifest.json`); if (r.ok) this.manifest = await r.json(); } catch { /* provenance stays explicitly unknown */ }
    this.refresh();
  }
  dispose() { void this.enable(false); }
}

// Music entry points suppress nested helper scopes. Other calls supply human-readable
// effect ownership, but only a successful AudioScheduledSourceNode.start creates an event.
const MUSIC = new Set('schedule playEvent pad bass combatSchedule menuSchedule menuPad playTitleTheme bandBeat solo soloPhrase soloDrone dum tek clap speak syllable utterance blip'.split(' '));
const CONTROL = new Set('constructor prepareEffects listenForInput start startIfAllowed dispose levels toggleMute setVolumes setVoices masterLevel _away setMusicMode musicCue setScore holdTheme musicMomentsUpdate combat menuMusic menuBusEnsure seated seatedK musicLevel noiseLayer set freq rand vary placeAt spot uiOut setBands makeBands band setBandMode listen follow update trace canSpeak holdFloor hush pauseActionAudio bodyVoice'.split(' '));
function installProceduralTrace(trace) {
  const s = trace.sound, ctx = s.ctx;
  if (!ctx) return;
  trace.scope = null;
  const patch = (o, k, fn) => { const own = Object.hasOwn(o, k), old = o[k]; o[k] = fn(old); trace.restore.push(() => { if (own) o[k] = old; else delete o[k]; }); };
  for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(s))) {
    if (CONTROL.has(name) || typeof s[name] !== 'function') continue;
    patch(s, name, old => function(...a) { const prior = trace.scope; if (MUSIC.has(name)) trace.scope = false; else if (trace.scope == null) trace.scope = { name: name === 'instrument' ? `${a[0]} note` : name, event: null }; try { return old.apply(this, a); } finally { if (trace.scope !== prior) trace.flushScope(trace.scope); trace.scope = prior; } });
  }
  const graph = new WeakMap();
  const visit = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return null; seen.add(node);
    if ([s.fx, s.voices, s.fxRoom, s._ui].includes(node)) return { bus: node, gain: 1 };
    if ([s.music, s.musicSend].includes(node)) return null;
    const m = graph.get(node); if (!m) return null;
    const gain = m.gainNode ? (m.peak ?? node.gain.value) : 1;
    for (const out of m.out) { const v = visit(out, new Set(seen)); if (v) return { bus: v.bus, gain: gain * v.gain }; }
    return null;
  };
  for (const kind of ['createGain','createBiquadFilter','createStereoPanner','createBufferSource','createOscillator']) {
    if (!ctx[kind]) continue;
    patch(ctx, kind, old => function(...a) {
      const node = old.apply(this, a), m = { out: [], peak: null, gainNode: kind === 'createGain' }; graph.set(node, m);
      const connect = node.connect.bind(node); node.connect = (to, ...rest) => { m.out.push(to); return connect(to, ...rest); };
      if (m.gainNode) for (const method of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime']) {
        const fn = node.gain[method]?.bind(node.gain); if (fn) node.gain[method] = (v, ...rest) => { m.peak = Math.max(m.peak ?? 0, v); return fn(v, ...rest); };
      }
      if (node.start) {
        const start = node.start.bind(node), stop = node.stop.bind(node); let event, layer;
        node.start = (...args) => {
          const result = start(...args);
          const scope = trace.scope;
          if (scope && !node._sfxRecorded && !['Ship engines','Ship hum','Ship alarm','Pirates bed'].includes(scope.name)) {
            const when = Math.max(ctx.currentTime, Number(args[0]) || 0);
            layer = { when, until: !node.loop && node.buffer ? when + Math.max(0, node.buffer.duration - (Number(args[1]) || 0)) / (node.playbackRate?.value || 1) : Infinity };
            // Some real effects start sources before connecting the final bus or setting
            // their envelope. Inspect the completed invocation, not that intermediate graph.
            (scope.pending ??= []).push(() => {
              const path = visit(node);
              if (!path || !trace.audible(path.bus, path.gain)) return;
              Object.assign(layer, path);
              event = scope.event ??= trace.begin({name:scope.name, source:'Procedural', when, loop:!!node.loop, ...path});
              if (event) { (event.layers ??= []).push(layer); event.when=Math.min(event.when,when); event.loop ||= !!node.loop; }
            });
          }
          return result;
        };
        node.stop = (when = ctx.currentTime) => { const result = stop(when); if (layer) layer.until = Math.min(layer.until, when); trace.refresh(); return result; };
        if (node.addEventListener) node.addEventListener('ended', () => { if (layer) layer.until = Math.min(layer.until, ctx.currentTime); trace.refresh(); });
      }
      return node;
    });
  }
}
