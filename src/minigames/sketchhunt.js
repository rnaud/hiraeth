// The sketch hunt (docs/systems/minigames.md): three minutes in the Signal Market with the sketchbook, and a list
// of six things to draw: an animal, a strange plant, someone doing something, a landmark from a given side, a
// cab in the air… drawn from a pool, so every hunt's list is new. Walk the market as ever (the game is played on
// foot: drives: false); hold the sketchbook up (LT / L2, the right mouse button, R) to look through its frame,
// and sketch (RT / R2, a click, G). Each sketch is scored by how well its subject fills and centres the frame
// (src/minigames/framing.js), and the whole list done early is worth the time left. The results are the page.
//
// The subjects are the world's own: its creatures (src/wildlife.js), its plants (src/flora.js), its crowd and
// what each of them is doing (src/crowd.js: sitting on the kerb, leaning on a counter, looking down from a
// bridge, talking in a circle), its cabs (src/taxi.js), its screens, and the silent tower.

import * as THREE from 'three';
import { bestTarget, pickList, huntScore, verdict, stars, FRAMING } from './framing.js';
import { CROWD_POSES } from '../crowd-shader.js';
import { BRIDGES } from '../levels/bazaar.js';
import { inputKind, escapeHtml } from '../prompt-keys.js';
import { padText } from '../native-pad.js';

export const HUNT = { seconds: 180, n: 6, fov: { min: 18, max: 62, start: 46 } };
const INK = '#2b211f', PAPER = '#f7ecd2';
const h = escapeHtml;

// ------------------------------------------------------------------ the pool
// Each subject: { id, kind, name, hint, targets(W) => [{ c: Vector3, r }], fill?, from?, eye? }; W is the world:
// { wildlife, crowd, flora, level, vehicles }. A subject whose targets come back empty is left off the list.
const up = (p, y) => new THREE.Vector3(p.x, p.y + y, p.z);
const creatures = (id, lift, r) => (W) => (W.wildlife?.creatures ?? []).filter((c) => c.species?.id === id && !c.hidden).map((c) => ({ c: up(c.wpos ?? c.pos, lift * (c.size ?? 1)), r: r * (c.size ?? 1) }));
const plants = (id) => (W) => (W.flora?.plants ?? []).filter((p) => p.sp?.id === id).map((p) => ({ c: new THREE.Vector3(p.x, p.y + p.height * 0.5, p.z), r: p.height * 0.55, own: 0.22 }));
const posed = (pose, lift, r) => (W) => (W.crowd?.people ?? []).filter((p) => p.pose === CROWD_POSES[pose] && p.speed < 0.05 && !p._gone).map((p) => ({ c: up(p.pos, lift * (p.scale ?? 1)), r: r * (p.scale ?? 1) }));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const POOL = [
  // animals
  { id: 'finch', kind: 'animal', name: 'A ticket finch', hint: 'small birds that hop along the avenue', targets: creatures('ticketFinch', 0.18, 0.3), fill: 0.5 },
  { id: 'signbug', kind: 'animal', name: 'A sign bug', hint: 'they scuttle about under the shop signs', targets: creatures('signBug', 0.12, 0.35), fill: 0.5 },
  // strange plants
  { id: 'lampflower', kind: 'plant', name: 'A street lamp flower', hint: 'a tall flower that lights the kerb', targets: plants('bazaar.lampflower'), fill: 0.6 },
  { id: 'strappalm', kind: 'plant', name: 'A strap palm', hint: 'its leaves hang down like straps', targets: plants('bazaar.strappalm'), fill: 0.6 },
  { id: 'pipebloom', kind: 'plant', name: 'A pipe blossom', hint: 'a flower grown out of pipes', targets: plants('bazaar.pipebloom'), fill: 0.55 },
  { id: 'tinstar', kind: 'plant', name: 'A tin star', hint: 'a little metal-looking plant by the walls', targets: plants('bazaar.tinstar'), fill: 0.45 },
  // people doing something
  { id: 'kerb', kind: 'person', name: 'Someone sitting on the kerb', hint: 'along the pavements by the shops', targets: posed('kerb', 0.55, 0.75) },
  { id: 'counter', kind: 'person', name: 'Someone leaning on a counter', hint: 'at the shop fronts', targets: posed('wall', 0.95, 0.95) },
  { id: 'rail', kind: 'person', name: 'Someone on a skybridge, seen from below', hint: 'they lean on the rails up there', targets: posed('rail', 0.95, 1.0), fill: 0.3,
    from: { dir: V(0, -1, 0), within: 62 } },
  { id: 'talk', kind: 'person', name: 'A circle of people talking', hint: 'groups stand between the lanes', fill: 0.62, targets: (W) => {
    const groups = new Map();
    for (const p of W.crowd?.people ?? []) if (p.group && p.speed < 0.05) { if (!groups.has(p.group)) groups.set(p.group, []); groups.get(p.group).push(p); }
    const out = [];
    for (const g of groups.values()) {
      if (g.length < 3) continue;
      const c = new THREE.Vector3();
      for (const p of g) c.add(p.pos);
      c.divideScalar(g.length);
      let r = 0; for (const p of g) r = Math.max(r, Math.hypot(p.pos.x - c.x, p.pos.z - c.z));
      out.push({ c: c.add(new THREE.Vector3(0, 0.9, 0)), r: r + 0.7, own: 1.05 });
    }
    return out;
  } },
  // landmarks, from a given side
  { id: 'tower-square', kind: 'landmark', name: 'The silent tower, from Signal Square', hint: 'walk the avenue to its end', targets: () => [{ c: V(0, 48, -250), r: 50 }], fill: 1.05,
    eye: (e) => e.z < -192 && e.z > -335 && Math.abs(e.x) < 34 && e.y < 12 },
  { id: 'tower-far', kind: 'landmark', name: 'The silent tower, from far down the avenue', hint: 'it stands at the avenue’s end', targets: () => [{ c: V(0, 48, -250), r: 50 }], fill: 0.55,
    eye: (e) => e.z > -110 },
  { id: 'bridge', kind: 'landmark', name: 'A skybridge, from the street right under it', hint: 'four of them cross the avenue', fill: 0.75,
    targets: () => BRIDGES.map(({ z, y }) => ({ c: V(0, y, z), r: 9 })), from: { dir: V(0, -1, 0), within: 40 } },
  { id: 'oldsign', kind: 'landmark', name: 'The old sign by the skybridge', hint: 'high on a wall, half-way down the avenue', fill: 0.55,
    targets: (W) => { const p = W.level?.signal?.places?.oldSign; return p ? [{ c: V(p.x, p.y, p.z), r: 4.5 }] : []; } },
  // things
  { id: 'cab', kind: 'thing', name: 'A cab in flight', hint: 'they cruise up and down above the avenue', fill: 0.4,
    targets: (W) => (W.vehicles ?? []).filter((v) => v.kind === 'taxi' && v.mode !== 'parked' && v.pos.y > 6).map((v) => ({ c: v.pos.clone(), r: 2.4, own: 0.8 })) },
  { id: 'screen', kind: 'thing', name: 'A shop screen, seen square on', hint: 'the painted signs over the shops', fill: 0.62,
    targets: (W) => (W.level?.reactiveScreens ?? []).map((s) => ({ c: s.pos.clone(), r: Math.max(s.w, s.h) * 0.55, n: screenNormal(s) })), from: 'normal' },
  { id: 'lantern', kind: 'thing', name: 'A paper lantern', hint: 'they hang along the shop fronts', fill: 0.4,
    targets: (W) => (W.level?.flammables ?? []).filter((f) => f.kind === 'lantern').map((f) => ({ c: V(f.at.x, f.at.y, f.at.z), r: 0.75 })) },
];
/** A screen faces the avenue: its yaw's way, turned toward the middle of the street. */
function screenNormal(s) {
  const n = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));
  if (n.x * -s.pos.x < 0) n.negate();
  return n;
}

// ------------------------------------------------------------------ the sketch: the frame drawn as on the page
/** A frame grabbed (a JPEG data URL) turned to the sketchbook's: sepia ink on cream, a pencil border. */
async function toSketch(url, w = 360, hgt = 240) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hgt;
  const g = cv.getContext('2d');
  g.fillStyle = PAPER; g.fillRect(0, 0, w, hgt);
  g.filter = 'grayscale(1) sepia(0.55) contrast(1.35) brightness(1.08)';
  g.globalAlpha = 0.92;
  g.drawImage(img, 0, 0, w, hgt);
  g.filter = 'none'; g.globalAlpha = 1;
  // the page's grain, and a hand-drawn edge
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(247,236,210,0.35)'; g.fillRect(0, 0, w, hgt);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = INK; g.lineWidth = 2;
  g.beginPath();
  const j = (k) => Math.sin(k * 12.9) * 1.2;
  g.moveTo(4 + j(1), 4); g.lineTo(w - 4, 4 + j(2)); g.lineTo(w - 4 + j(3), hgt - 4); g.lineTo(4, hgt - 4 + j(4)); g.closePath();
  g.stroke();
  return cv.toDataURL('image/jpeg', 0.8);
}

// ------------------------------------------------------------------ the screens: the list, the viewfinder
const CSS = `
#hunt-list { position: fixed; left: 14px; top: 64px; z-index: 79; width: 248px; padding: 10px 12px 8px; background: ${PAPER}; color: ${INK};
  border: 2px solid ${INK}; box-shadow: 4px 4px 0 ${INK}; transform: rotate(-0.7deg); font: 12px/1.35 ui-monospace, Menlo, monospace; pointer-events: none; transition: opacity .25s; }
#hunt-list h2 { margin: 0 0 6px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #8a5a3c; }
#hunt-list li { list-style: none; margin: 0 0 5px; padding-left: 20px; position: relative; }
#hunt-list ol { margin: 0; padding: 0; }
#hunt-list li::before { content: ''; position: absolute; left: 0; top: 1px; width: 11px; height: 11px; border: 1.5px solid ${INK}; background: #fbf4e2; }
#hunt-list li.done::before { background: #71d7cf; }
#hunt-list li.done::after { content: '✓'; position: absolute; left: 1px; top: -3px; font-weight: 900; font-size: 14px; }
#hunt-list li b { display: block; font-weight: 700; }
#hunt-list li small { color: #6b5a4e; font-size: 10.5px; }
#hunt-list li .st { color: #d9643a; letter-spacing: .1em; }
#hunt-list.dim { opacity: .38; }
#hunt-view { position: fixed; inset: 0; z-index: 78; pointer-events: none; opacity: 0; transition: opacity .15s; }
#hunt-view.on { opacity: 1; }
#hunt-view .edge { position: absolute; inset: 0; box-shadow: inset 0 0 0 14px ${PAPER}, inset 0 0 0 16px ${INK}; }
#hunt-view .corner { position: absolute; width: 40px; height: 40px; border: 0 solid ${INK}; }
#hunt-view .c1 { left: 34px; top: 34px; border-left-width: 4px; border-top-width: 4px; }
#hunt-view .c2 { right: 34px; top: 34px; border-right-width: 4px; border-top-width: 4px; }
#hunt-view .c3 { left: 34px; bottom: 34px; border-left-width: 4px; border-bottom-width: 4px; }
#hunt-view .c4 { right: 34px; bottom: 34px; border-right-width: 4px; border-bottom-width: 4px; }
#hunt-view .mid { position: absolute; left: 50%; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 2px solid ${INK}; border-radius: 50%; opacity: .7; }
#hunt-view .third { position: absolute; border: 0 dashed rgba(43,33,31,.25); }
#hunt-view .tv { top: 30px; bottom: 30px; border-left-width: 1.5px; }
#hunt-view .th { left: 30px; right: 30px; border-top-width: 1.5px; }
#hunt-view .read { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%) rotate(-0.5deg); min-width: 300px; padding: 6px 14px 7px; background: ${PAPER};
  border: 2px solid ${INK}; box-shadow: 3px 3px 0 ${INK}; color: ${INK}; font: 700 13px/1.35 ui-monospace, Menlo, monospace; text-align: center; }
#hunt-view .read small { display: block; font-weight: 400; font-size: 11px; color: #6b5a4e; }
#hunt-view .meter { height: 7px; margin: 4px 0 1px; border: 1.5px solid ${INK}; background: #fbf4e2; }
#hunt-view .meter i { display: block; height: 100%; background: #71d7cf; }
#hunt-view .zoom { position: absolute; right: 52px; top: 50%; transform: translateY(-50%); font: 700 11px/1 ui-monospace, Menlo, monospace; color: ${INK}; background: ${PAPER}; border: 2px solid ${INK}; padding: 4px 6px; }
#hunt-flash { position: fixed; inset: 0; z-index: 81; pointer-events: none; background: ${PAPER}; opacity: 0; }
#hunt-flash.go { animation: huntflash .45s ease-out; }
@keyframes huntflash { 0% { opacity: .9; } 100% { opacity: 0; } }
#hunt-hint { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 79; padding: 3px 10px; background: rgba(247,236,210,.85); border: 1.5px solid ${INK};
  font: 11px/1.3 ui-monospace, Menlo, monospace; color: ${INK}; pointer-events: none; white-space: nowrap; }
#minigame .hunt-page { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 4px 0 12px; background: #fbf4e2; border: 2px solid ${INK}; box-shadow: 4px 4px 0 ${INK}; }
#minigame .hunt-page .leaf { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 10px; }
#minigame .hunt-page .leaf + .leaf { border-left: 2px dashed rgba(43,33,31,.45); }
#minigame .hunt-page figure { margin: 0; display: grid; grid-template-columns: 132px 1fr; gap: 8px; align-items: center; }
#minigame .hunt-page img, #minigame .hunt-page .blank { width: 132px; height: 88px; object-fit: cover; border: 1.5px solid ${INK}; background: ${PAPER}; transform: rotate(-0.8deg); }
#minigame .hunt-page figure:nth-child(2n) img { transform: rotate(0.9deg); }
#minigame .hunt-page .blank { display: grid; place-items: center; font: 900 30px/1 ui-monospace, Menlo, monospace; color: rgba(43,33,31,.3); }
#minigame .hunt-page figcaption { font-size: 11px; line-height: 1.35; }
#minigame .hunt-page figcaption b { display: block; font-size: 11.5px; }
#minigame .hunt-page figcaption .st { color: #d9643a; letter-spacing: .1em; }
`;

function installCss() {
  if (document.getElementById('hunt-css')) return;
  const s = document.createElement('style');
  s.id = 'hunt-css'; s.textContent = CSS;
  document.head.appendChild(s);
}
const starText = (q) => '★★★'.slice(0, stars(q)) + '☆☆☆'.slice(0, 3 - stars(q));

// ------------------------------------------------------------------ the game
const _dir = new THREE.Vector3(), _eye = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _sd = new THREE.Vector3();

function start(ctx) {
  const { player, camera, level, physics, sound } = ctx;
  installCss();
  const W = { wildlife: ctx.wildlife, crowd: ctx.crowd, flora: ctx.flora, level, vehicles: level.dynamic?.() ?? player.vehicles ?? [] };
  // the list: six from the pool, of what this world shows now
  const list = pickList(POOL, Math.random, HUNT.n, (s) => s.targets(W).length > 0).map((s) => ({ s, best: null }));
  const view = { raised: false, fov: HUNT.fov.start, k: 0, cool: 0, last: null, wasFire: false, wasAim: false, toggled: false };
  let pending = 0, ended = false;

  // the traveller at the market's gate, facing down the avenue
  const sp = level.spawn ?? new THREE.Vector3(0, 0, 88);
  player.teleport?.(sp.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  player.heading = 0;   // (in the world's frame: down the avenue, toward the tower)
  if (ctx.rig) { ctx.rig.yaw = Math.PI; ctx.rig.pitch = ctx.rig.pitch0 ?? 0.13; }

  // the list on the page's left
  const listEl = document.createElement('div');
  listEl.id = 'hunt-list';
  const drawList = () => {
    listEl.innerHTML = `<h2>To sketch · ${list.filter((x) => x.best).length} of ${list.length}</h2><ol>${list.map(({ s, best }) =>
      `<li class="${best ? 'done' : ''}"><b>${h(s.name)}</b>${best ? `<span class="st">${starText(best.q)}</span> <small>${h(verdict(best.q))}</small>` : `<small>${h(s.hint)}</small>`}</li>`).join('')}</ol>`;
  };
  drawList();
  document.body.appendChild(listEl);
  // the viewfinder
  const viewEl = document.createElement('div');
  viewEl.id = 'hunt-view';
  viewEl.innerHTML = `<div class="edge"></div><div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
    <div class="third tv" style="left:33.3%"></div><div class="third tv" style="left:66.6%"></div><div class="third th" style="top:33.3%"></div><div class="third th" style="top:66.6%"></div>
    <div class="mid"></div><div class="zoom"></div><div class="read"></div>`;
  document.body.appendChild(viewEl);
  const readEl = viewEl.querySelector('.read'), zoomEl = viewEl.querySelector('.zoom');
  const flashEl = document.createElement('div'); flashEl.id = 'hunt-flash'; document.body.appendChild(flashEl);
  const hintEl = document.createElement('div'); hintEl.id = 'hunt-hint'; document.body.appendChild(hintEl);
  const hint = () => {
    const k = inputKind();
    const text = view.raised
      ? k === 'pad' ? `${padText('RT / R2')} sketch · ${padText('LB / RB')} zoom · let go of ${padText('LT / L2')} to lower it` : k === 'touch' ? 'Tap to sketch' : 'Click or G sketch · wheel or Z / C zoom · let go to lower it'
      : k === 'pad' ? `Hold ${padText('LT / L2')} to raise the sketchbook` : k === 'touch' ? '' : 'Hold the right mouse button or R to raise the sketchbook';
    if (hintEl.textContent !== text) hintEl.textContent = text;
    hintEl.style.display = text ? '' : 'none';
  };

  // what the frame holds right now: the best subject on the list (an occluded one is not seen)
  // (seen: a ray to its middle or to its top half gets there; a wall, a floor, a deck in the way stops it)
  // The live readout asks the collision world (cheap); the sketch itself asks what is drawn as well (a stall,
  // a railing, the crowd: a few rays through the scene, a few milliseconds each, once a sketch).
  const rc = new THREE.Raycaster();
  const drawnHit = (o, d) => {
    rc.set(o, _sd); rc.far = d;
    for (const hit of rc.intersectObject(ctx.scene, true)) {
      let ob = hit.object, shown = ob.isMesh && !ob.isSkinnedMesh;   // (a body's skin: its own rays are its rough tiers')
      for (let q = ob; q && shown; q = q.parent) if (q.visible === false) shown = false;
      if (shown && !ob.material?.transparent) return hit.distance;
    }
    return Infinity;
  };
  const seenFrom = (eye, drawn) => (t) => {
    if (!physics?.rayDistance && !drawn) return true;
    for (const lift of [0, 0.55]) {
      _r.copy(t.c).addScaledVector(_u, t.r * lift);
      _sd.subVectors(_r, eye); const d = _sd.length(); _sd.divideScalar(d);
      const near = d - t.r * (t.own ?? 0.3);   // (own: how much of its radius may be in front of its middle: a group's own people)
      if (physics?.rayDistance && physics.rayDistance(eye, _sd, d) < near) continue;
      if (drawn && drawnHit(eye, d) < near) continue;
      return true;
    }
    return false;
  };
  const seen = seenFrom(_eye, false);
  const judge = (drawn = false) => {
    const v = { eye: _eye, fwd: _dir.clone(), up: _u, fov: view.fov, aspect: camera.aspect };
    let best = null;
    for (const item of list) {
      const S = item.s, ts = S.targets(W);
      const r = bestTarget(v, ts, S, drawn ? seenFrom(_eye, true) : seen, 3);
      const q = r?.s.q ?? 0;
      if (q > (best?.q ?? 0)) best = { item, q, t: r.t, parts: r.s };
    }
    return best;
  };

  // the sketchbook up: the camera at the eyes, looking where the rig looks (its yaw and pitch, up to straight up)
  const lookDir = (out) => {
    const R = ctx.rig, F = player.frame;
    if (!R || !F) return camera.getWorldDirection(out);
    const cp = Math.cos(R.pitch);
    return out.copy(F.right).multiplyScalar(-Math.sin(R.yaw) * cp).addScaledVector(F.up, -Math.sin(R.pitch)).addScaledVector(F.fwd, -Math.cos(R.yaw) * cp).normalize();
  };
  const setRaised = (on) => {
    if (on === view.raised) return;
    view.raised = on;
    viewEl.classList.toggle('on', on);
    listEl.classList.toggle('dim', on);
    player.object.visible = !on;
    const R = ctx.rig;
    if (R) { if (on) R.pitchUpLimit = () => -1.35; else delete R.pitchUpLimit; }
    if (!on) ctx.setFov(ctx._fov0 ?? 55);
    sound?.page?.();
    hint();
  };
  ctx._fov0 ??= camera.fov;

  const sketch = async () => {
    if (view.cool > 0 || pending) return;
    view.cool = 0.6;
    const b = judge(true);
    flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
    ctx.sfx.whoosh?.();
    if (!b || b.q < FRAMING.min) {
      const was = view.last?.q >= FRAMING.min ? view.last.item.s.name.toLowerCase() : null;   // (the readout had it: something drawn is in the way)
      ctx.flash(b ? `Too rough to tell: ${b.item.s.name.toLowerCase()}` : was ? `Something is in the way of ${was}` : 'Nothing on your list in that frame', 'bad', 1.4);
      return;
    }
    const item = b.item, better = !item.best || b.q > item.best.q + 0.005;
    if (!better) { ctx.flash(`Not better than your last ${item.s.name.toLowerCase().replace(/^an? |^the /, '')}`, '', 1.3); return; }
    const look = _eye.clone().addScaledVector(_dir, 10);
    let url = null;
    pending++;
    try { url = ctx.capture ? ctx.capture(_eye.clone(), look, 480, 320, { fov: view.fov }) : null; } catch (e) { console.warn('sketch hunt: no frame', e); }
    const was = item.best;
    item.best = { q: b.q, url: null, at: ctx.time };
    drawList();
    ctx.setScore(huntScore(list.map((x) => x.best), 0, HUNT.n).base);
    ctx.flash(`${was ? 'Better! ' : ''}${item.s.name} · ${starText(b.q)}`, 'good', 1.6);
    ctx.sfx.coin?.(list.filter((x) => x.best).length);
    try { if (url) item.best.url = await toSketch(url); } catch { item.best.url = url; }
    pending--;
    if (!ended && list.every((x) => x.best)) finish(true);
  };

  const finish = (all) => {
    if (ended) return;
    ended = true;
    const left = Math.max(0, HUNT.seconds - ctx.time);
    const sc = huntScore(list.map((x) => x.best), all ? left : 0, HUNT.n);
    const cell = ({ s, best }) => `<figure>${best?.url ? `<img src="${best.url}" alt="">` : '<div class="blank">?</div>'}<figcaption><b>${h(s.name)}</b>${best
      ? `<span class="st">${starText(best.q)}</span> ${h(verdict(best.q))} · ${Math.round(best.q * 100)}` : 'not found'}</figcaption></figure>`;
    const html = `<div class="hunt-page"><div class="leaf">${list.slice(0, 3).map(cell).join('')}</div><div class="leaf">${list.slice(3).map(cell).join('')}</div></div>`;
    setRaised(false);
    ctx.finish({
      score: sc.total, title: all ? 'The page is full' : 'Time is up', wide: true, html,
      lines: [`Sketched ${sc.found} of ${HUNT.n} · ${sc.base} for the sketches`, all ? `${Math.round(left)} s to spare: +${sc.bonus}` : 'The whole list sketched with time to spare earns the time left'],
    });
  };

  const onWheel = (e) => { if (view.raised) view.fov = THREE.MathUtils.clamp(view.fov * (e.deltaY > 0 ? 1.08 : 1 / 1.08), HUNT.fov.min, HUNT.fov.max); };
  // a touch screen: a tap while it is raised sketches (the raise is the on-screen aim button's, if any: R on a key board)
  const onPointer = (e) => {
    if (e.pointerType !== 'touch' || e.target.closest?.('#minigame button')) return;
    if (e.target === touchEl) { e.stopPropagation(); view.touchUp = !view.touchUp; return; }
    if (view.raised) sketch();
  };
  // (on a touch screen, a button of its own raises and lowers the sketchbook)
  const touchEl = document.createElement('button');
  touchEl.type = 'button'; touchEl.textContent = '✎';
  touchEl.style.cssText = `position:fixed;right:22px;bottom:150px;z-index:79;width:64px;height:64px;border-radius:50%;border:2px solid ${INK};background:${PAPER};box-shadow:3px 3px 0 ${INK};font:700 26px/1 ui-monospace,Menlo,monospace;color:${INK};pointer-events:auto;`;
  touchEl.style.display = inputKind() === 'touch' ? '' : 'none';
  document.body.appendChild(touchEl);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('pointerdown', onPointer);
  hint();

  return {
    update(dt, inp, { live, phase, raw }) {
      const c = raw ?? {};
      view.cool = Math.max(0, view.cool - dt);
      if (live && !ended && ctx.time >= HUNT.seconds) { finish(false); return; }
      const aim = live && !ended && !!(c.PadAim || c.MouseRight || c.KeyR || view.touchUp);
      touchEl.style.display = inputKind() === 'touch' && live ? '' : 'none';
      setRaised(aim);
      if (view.raised) {
        // zoom: LB / RB, Z / C (the wheel in its event)
        const zin = c.PadBlade || c.KeyC, zout = c.PadGuard || c.KeyZ;
        if (zin) view.fov = Math.max(HUNT.fov.min, view.fov * Math.exp(-1.1 * dt));
        if (zout) view.fov = Math.min(HUNT.fov.max, view.fov * Math.exp(1.1 * dt));
        // the eye: the traveller's head, the look the rig's
        const F = player.frame;
        _u.copy(F?.up ?? new THREE.Vector3(0, 1, 0));
        lookDir(_dir);
        _eye.copy(player.pos).addScaledVector(_u, 1.62 * (player.object.scale?.y ?? 1)).addScaledVector(_dir, 0.12);
        camera.position.copy(_eye);
        camera.up.copy(_u);
        camera.lookAt(_r.copy(_eye).add(_dir));
        ctx.setFov(view.fov);
        if (player.frame?.headingOf) player.heading = player.frame.headingOf(_r.copy(_dir).addScaledVector(_u, -_dir.dot(_u)));
        // what is in the frame, a few times a second
        view.k -= dt;
        if (view.k <= 0) {
          view.k = 0.12;
          const b = judge();
          view.last = b;
          const pct = Math.round((b?.q ?? 0) * 100);
          readEl.innerHTML = b && b.q > 0.05
            ? `${h(b.item.s.name)}<div class="meter"><i style="width:${pct}%"></i></div><small>${b.q >= FRAMING.min ? `${starText(b.q)} ${h(verdict(b.q))}` : 'closer, or nearer the middle'}${b.item.best ? ` · yours: ${starText(b.item.best.q)}` : ''}</small>`
            : 'Nothing on your list in the frame<small>find it, fill the frame with it, and keep it in the middle</small>';
          zoomEl.textContent = `${Math.round(55 / view.fov * 10) / 10}×`;
        }
        const fire = !!(c.PadFire || c.MouseLeft || c.KeyG);
        if (fire && !view.wasFire) sketch();
        view.wasFire = fire;
      } else view.wasFire = !!(c.PadFire || c.MouseLeft || c.KeyG);
      const left = Math.max(0, HUNT.seconds - (live ? ctx.time : 0));
      ctx.status(`${list.filter((x) => x.best).length} / ${HUNT.n} sketched`);
      const show = phase !== 'results';
      if (listEl.hidden === show) listEl.hidden = hintEl.hidden = !show;
      if (phase !== 'play') hint();
      void left;
    },
    pause(on) { if (on) setRaised(false); },
    list, judge, sketch, view, visible: (t, eye, drawn = true) => { _u.copy(player.frame?.up ?? _u.set(0, 1, 0)); return seenFrom(eye, drawn)(t); },   // (for the tests' and the screenshots' bot)
    end() {
      setRaised(false);
      player.object.visible = true;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onPointer);
      listEl.remove(); viewEl.remove(); flashEl.remove(); hintEl.remove(); touchEl.remove();
    },
  };
}

export default {
  id: 'sketchhunt', order: 4,
  name: 'Sketch hunt',
  blurb: 'Three minutes in the Signal Market with your sketchbook, and a list of six things to draw: never the same list twice.',
  rules: 'Find each thing on the list and sketch it. A sketch scores by how well its subject fills the frame and sits in its middle (and is seen from the side the list asks for); sketch it again to do better. The whole list done early is worth the time left.',
  controls: {
    pad: [['Left stick', 'walk'], ['LT / L2 held', 'raise the sketchbook'], ['Right stick', 'look'], ['RT / R2', 'sketch'], ['LB / RB', 'zoom out, in'], ['Menu', 'pause']],
    keys: [['W A S D', 'walk'], ['Right mouse button or R, held', 'raise the sketchbook'], ['Mouse', 'look'], ['Click or G', 'sketch'], ['Wheel or Z / C', 'zoom'], ['Esc', 'pause']],
    touch: [['Stick', 'walk'], ['Aim', 'raise the sketchbook'], ['Tap', 'sketch']],
  },
  score: { kind: 'points', unit: 'pts' },
  hud: { timer: true, score: true, countdown: HUNT.seconds },
  color: '#e4bd83',
  world: 'bazaar',
  drives: false,
  // (its arcade sign at the lantern market, a few steps down the avenue from the gate, turned to whoever comes in)
  markers: [{ level: 'bazaar', at: [-16.4, null, 82], heading: 1.2 }],
  start,
};
