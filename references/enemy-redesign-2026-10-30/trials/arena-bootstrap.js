// #800 phase 2: the enemy rebuild's trial page (arena.html beside this), after #768's grunt trial. The real Arena, the
// game's renderer, light and ink; each of the four trial foes in a variant (current | direct | Tripo) or the three side
// by side 3 m apart on one clip clock (the same state, the same moment). Silent (muted when the Sound is built:
// characterReview, hiraeth.muted and every volume 0), the traveller invulnerable, saves in this page's memory only.
// The game's roster is untouched: the variants stand in for the archetype's builder in this page alone (variants.js).
const saved = new Map(); const memory = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, String(v)), removeItem: (k) => saved.delete(k), clear: () => saved.clear(), key: (i) => [...saved.keys()][i] ?? null, get length() { return saved.size; } };
Object.defineProperty(window, 'localStorage', { value: memory }); Object.defineProperty(window, 'sessionStorage', { value: { ...memory } });
const query = new URLSearchParams(location.search);
const want = { foe: query.get('foe') ?? 'crab', variant: query.get('variant') ?? 'side', mode: query.get('mode') ?? 'idle', cam: query.get('cam') ?? 'q', ui: query.get('ui') !== '0' };
query.set('level', 'arena'); query.set('characterReview', 'enemy-trial'); query.set('debugsave', '1'); history.replaceState(null, '', location.pathname + '?' + query);
memory.setItem('hiraeth.muted', '1');
memory.setItem('hiraeth.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
memory.setItem('hiraeth.settings.v1', JSON.stringify({ quality: query.get('quality') ?? 'high', showFps: false, music: 0, effects: 0, voices: 0, soundV: 1 }));
await import('/src/boot.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
while (!window.__hiraethBooted || !window.foes || !window.player) await sleep(100);
while (document.getElementById('loading')) await sleep(100);
const { THREE: T, foes, player, camera, sound } = window;
if (!sound.muted || sound.masterLevel() !== 0) throw Error('Review mute failed before the trial');
sound.setVolumes(0, 0); sound.setVoices?.(0); if (sound.master) sound.master.gain.value = 0;
const V = await import('./variants.js'); await V.preload();
player.hurt = () => {}; player.knockDown = () => false; player.flinch = () => {}; player.opts.health = false;
foes.updateWaves = () => {}; foes.setPractice?.(null);   // (no Arena run: only the trial's foes) foes.practice = { kind: null, rest: 999999 }; foes.updatePractice = () => {};

const SKIN = Object.fromEntries(Object.entries(V.TRIALS).map(([k, t]) => [k, t.skin]));
const ui = document.createElement('div'); ui.id = 'trial-panel';
ui.innerHTML = `<style>#trial-panel{position:fixed;z-index:9999;left:12px;top:12px;max-width:620px;background:#17201fee;color:#f7ecd2;padding:10px 12px;border:1px solid #c2aa72;border-radius:8px;font:13px system-ui}
#trial-panel h2{margin:0 0 6px;font-size:16px}#trial-panel select,#trial-panel button{padding:4px;margin:2px;font:inherit}#trial-report{max-height:220px;overflow:auto;white-space:pre;font:11px monospace;margin-top:6px}
#trial-panel label{margin-right:6px}</style>
<h2>Enemy rebuild · trials (#800)</h2>
<label>Foe <select id="t-foe">${Object.entries(V.TRIALS).map(([k, t]) => `<option value="${k}">${t.concept} · ${k}@${t.skin}${t.direct || t.tripo ? '' : ' (current only)'}</option>`).join('')}</select></label>
<label>Variant <select id="t-variant"><option value="current">current</option><option value="direct">direct</option><option value="tripo">Tripo</option><option value="side">side by side · current | direct | Tripo</option></select></label><br>
<label>Motion <select id="t-mode"><option value="idle">idle</option><option value="walk">walk (in place)</option><option value="turn">turn</option><option value="attack">attack cycle</option><option value="hurt">hurt</option><option value="death">death</option><option value="fight">fight · normal AI</option></select></label>
<label>Attack <select id="t-attack"></select></label>
<label>Skin <select id="t-skin"></select></label><br>
<label>Camera <select id="t-cam"><option value="q">three-quarter</option><option value="side">side</option><option value="front">front</option><option value="rear">rear</option><option value="close">close</option><option value="player">player's</option></select></label>
<button id="t-reset">Reset</button><button id="t-pause">Pause</button><button id="t-hit">Hit</button><button id="t-clay">Clay</button>
<div id="t-status">Loading…</div><pre id="trial-report"></pre>`;
document.body.append(ui);
for (const e of ['keydown', 'keyup', 'pointerdown', 'mousedown']) ui.addEventListener(e, (ev) => ev.stopPropagation());
const $ = (id) => document.getElementById(id);
$('t-foe').value = want.foe; $('t-variant').value = want.variant; $('t-mode').value = want.mode; $('t-cam').value = want.cam;
// (ui=0: the panel and the game's own HUD hidden, for pictures)
if (!want.ui) { const st = document.createElement('style'); st.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.append(st); }

// the stage: phase 1's spot, facing +z, the traveller to its left
const A = new T.Vector3(0, 0, -2), fwd = new T.Vector3(0, 0, 1), up = new T.Vector3(0, 1, 0);
const camAt = (yaw, dist, pitch, lookY) => { const d = fwd.clone().applyAxisAngle(up, yaw); return { d, eye: A.clone().addScaledVector(d, dist * Math.cos(pitch)).add(new T.Vector3(0, lookY + dist * Math.sin(pitch), 0)), at: A.clone().add(new T.Vector3(0, lookY, 0)) }; };
const side = () => $('t-variant').value === 'side';
const CAMS = () => { const far = side() ? 19 : 14; return { q: camAt(0.75, far, 0.12, 2), side: camAt(Math.PI / 2, far, 0.08, 2), front: camAt(0, 9, 0.1, 0.9), rear: camAt(Math.PI, 9, 0.1, 0.9), close: camAt(0.6, 5, 0.25, 0.7) }; };
const pin = { eye: new T.Vector3(), at: new T.Vector3(), on: true };
const baseUM = T.PerspectiveCamera.prototype.updateMatrixWorld, m4 = new T.Matrix4();
camera.updateMatrixWorld = function (force) { if (pin.on) { this.position.copy(pin.eye); this.quaternion.setFromRotationMatrix(m4.lookAt(pin.eye, pin.at, up)); if (this.fov !== 35) { this.fov = 35; this.updateProjectionMatrix(); } } return baseUM.call(this, force); };
const aim = () => { const v = $('t-cam').value; pin.on = v !== 'player'; if (!pin.on) { camera.fov = 50; camera.updateProjectionMatrix(); return; } const c = CAMS()[v]; pin.eye.copy(c.eye); pin.at.copy(c.at); };

let pack = [], time = 0, paused = false, clay = null;
const right = () => { const d = CAMS().q.d; return new T.Vector3(d.z, 0, -d.x); };
async function reset() {
  const kind = $('t-foe').value, line = side() ? ['current', 'direct', 'tripo'] : [$('t-variant').value], skin = $('t-skin').value || SKIN[kind];
  for (const f of [...foes.list]) foes.remove(f);
  pack = []; time = 0; clay = null;
  const r = right(), row = side() ? [-3, 0, 3] : [0];
  for (let i = 0; i < line.length; i++) {
    const ok = await V.use(kind, line[i]);
    const at = A.clone().addScaledVector(r, row[i]);
    const f = foes.add(`${kind}@${skin}`, at, { tier: 0, entrance: false });
    f.heading = 0; f.provoked = true; f.__A = at; f.__variant = ok ? line[i] : 'current (no ' + line[i] + ' yet)';
    foes.look(f, 0); pack.push(f);
  }
  await V.use(kind, 'current');   // (the stand-in only while these were built)
  player.teleport(A.clone().addScaledVector(r, side() ? -6.6 : -3.4).addScaledVector(CAMS().q.d, 0.4), up, CAMS().q.d.clone());
  const atk = $('t-attack'); const keep = atk.value; atk.innerHTML = pack[0].def.attacks.filter((a) => !a.chain).map((a) => `<option value="${a.id}">${a.id}</option>`).join(''); if ([...atk.options].some((o) => o.value === keep)) atk.value = keep;
  report();
}
// one clip clock for every foe of the pack (as the capture script poses them)
const oldUpdate = foes.update.bind(foes);
foes.update = function (dt, ...rest) {
  const mode = $('t-mode').value;
  if (mode === 'fight') { oldUpdate(dt, ...rest); return; }
  if (paused) dt = 0;
  if (mode === 'hurt' || mode === 'death') { oldUpdate(dt, ...rest); return; }
  time += dt;
  const sideCam = $('t-cam').value === 'side' && pack.length > 1;
  pack.forEach((f, i) => {
    if (!f.alive) return;
    const A0 = sideCam ? A.clone().addScaledVector(fwd, (1 - i) * 3.5) : f.__A;
    f.dist = 2; f.stunned = 0; f.alt = f.def.hover ?? 0;
    if (mode === 'idle' || mode === 'turn') { f.state = 'idle'; f.atk = null; f.k = 0; f.pos.copy(A0); f.heading = mode === 'turn' ? Math.min(1, (time % 3) / 1.5) * Math.PI : 0; }
    else if (mode === 'walk') { f.state = 'chase'; f.atk = null; f.k = 0; const u = time * 0.55; f.pos.copy(A0).add(new T.Vector3(Math.sin(u) * 1.6, 0, Math.cos(u) * 1.6 - 1.6)); f.heading = u + Math.PI / 2; }
    else if (mode === 'attack') {
      const a = f.def.attacks.find((x) => x.id === $('t-attack').value) ?? f.def.attacks[0];
      const st = a.strike ?? 0.3, rc = a.recover ?? f.def.recover, cyc = a.wind + st + rc + 0.6, u = time % cyc;
      if (f.atk !== a) { f.atk = a; f.heading = 0; foes.player.pos.copy(A0).addScaledVector(fwd, Math.max(3, Math.min(a.max ?? f.def.reach, 6))); f.attackH = 0; f.placeArea(a, foes.player); }
      const phase = u < a.wind ? 'wind' : u < a.wind + st ? 'strike' : u < a.wind + st + rc ? 'recover' : 'idle';
      f.state = phase; f.k = phase === 'wind' ? u / a.wind : phase === 'strike' ? (u - a.wind) / st : 0; f.timer = rc;
      f.pos.copy(A0); if (a.lunge && phase === 'strike') f.pos.addScaledVector(fwd, a.lunge * (1 - (1 - f.k) ** 2));
    }
    foes.look(f, dt);
  });
  // (the effects still run: the ground warnings, puffs and clouds a foe leaves, or they hang in the air)
  foes.gw?.update(dt); foes.shadePools?.update(dt); foes.slime?.update(dt); foes.puffs?.update(dt); foes.trails?.update(dt); foes.clouds?.update(dt);
};
function hurtAll(kill) { const dir = new T.Vector3(-1, 0, -0.4).normalize(); for (const f of pack) if (f.alive) { f.state = 'idle'; f.atk = null; foes.hurt(f, 'blade', dir, kill ? { damage: 99, source: 'charge', breaks: true } : { damage: Math.min(0.25, f.hp * 0.2), source: 'combo', combo: 0 }); } }
function toggleClay() {
  if (clay) { for (const [m, col, map, vc] of clay) { m.uniforms.uColor.value.copy(col); if (map !== undefined) m.uniforms.uHasMap.value = map; m.vertexColors = vc; m.needsUpdate = true; } clay = null; return; }
  clay = []; const seen = new Set(); for (const f of pack) f.model.group.traverse((o) => { if (!o.isMesh || !o.material.uniforms?.uColor || seen.has(o.material)) return; const m = o.material, U = m.uniforms; seen.add(m); clay.push([m, U.uColor.value.clone(), U.uHasMap?.value, m.vertexColors]); U.uColor.value.set('#c9c4ba'); if (U.uHasMap) U.uHasMap.value = 0; m.vertexColors = false; m.needsUpdate = true; });
}
function report() {
  const data = { foe: $('t-foe').value, variant: $('t-variant').value, mode: $('t-mode').value, time: +time.toFixed(2), muted: sound.muted, masterLevel: sound.masterLevel(), storage: 'page memory only',
    pack: pack.map((f) => ({ variant: f.__variant, built: f.model.trial ?? 'current', state: f.state, hp: f.hp, alive: f.alive, ...V.inventory(f.model.group) })),
    renderer: window.renderer?.info?.render ? { calls: window.renderer.info.render.calls, triangles: window.renderer.info.render.triangles } : null };
  $('trial-report').textContent = JSON.stringify(data, null, 1); $('trial-report').dataset.result = JSON.stringify(data);
  $('t-status').textContent = `${pack.map((f) => f.__variant).join(' | ')} · silent · invulnerable · temporary saves`;
  return data;
}
const skins = async () => { const { SKINS } = await import('/src/enemies/skins.js'); const k = $('t-foe').value; $('t-skin').innerHTML = Object.keys(SKINS[k] ?? {}).map((s) => `<option${s === SKIN[k] ? ' selected' : ''}>${s}</option>`).join(''); };
$('t-foe').onchange = async () => { await skins(); await reset(); aim(); };
$('t-variant').onchange = async () => { await reset(); aim(); };
$('t-skin').onchange = () => reset();
$('t-mode').onchange = async () => { const m = $('t-mode').value; time = 0; if (m === 'hurt' || m === 'death') { await reset(); hurtAll(m === 'death'); } };
$('t-attack').onchange = () => { time = 0; };
$('t-cam').onchange = aim;
$('t-reset').onclick = () => reset();
$('t-pause').onclick = () => { paused = !paused; $('t-pause').textContent = paused ? 'Resume' : 'Pause'; };
$('t-hit').onclick = () => hurtAll(false);
$('t-clay').onclick = toggleClay;
await skins(); await reset(); aim();
setInterval(report, 1500);
window.__enemyTrial = { reset, aim, report, hurtAll, toggleClay, pack: () => pack, setTime: (t) => { time = t; }, pause: (on) => { paused = on; }, set: (id, v) => { $(id).value = v; }, variants: V };
