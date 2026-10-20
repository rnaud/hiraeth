// Sequences, the web against the engines moment by moment (issue #429, bridge parity 2: "compare sequences, not stills").
// A sequence is a world set up one way (a save, a cinematic of the review page's catalog, the prologue, a game's page)
// and a list of beats; each beat has a way to get there (a dev jump on the game's own objects, keys pressed, a condition
// waited for, a time in the game's seconds) and is then recorded: a picture, and what the screen shows as data (probe).
// The same file runs in three places, each with its own clock and its own way to press a key:
//   the web     scripts/unity-compare/sequences.mjs web: imported into the page by Vite, ticked from headless Chrome
//               (the page's own clock, window.clock()), the keys pressed by Chrome's input, the picture Chrome's
//   node        engine/sequence-run.mjs: the engines' bundle (engine/game.js, which exports this file's runner) played in
//               a bare VM at a fixed step; the state stream only (tests/sequences.test.js, on GitHub)
//   Unity       engine/unity/game.js -sequence <id>: the bundle in Puerts, a frame a tick, Unity's picture
// The streams are compared beat by beat (compareStreams): what differs and isn't named in engine/bridge-gaps.js
// STREAM_DIFFS fails the test. docs/systems/engine-bridge.md, "Sequences".
import * as THREE from 'three';
import { inkSpec } from './ink-spec.js';
import { portMaterial } from './unity/port-format.js';
import { OPENING_BEATS, beatDue } from './opening-beats.js';
import { PROLOGUE_STAGES } from '../src/ship/prologue.js';
import { HOLO } from '../src/ship/hologram.js';
import { CINEMATICS } from '../src/cinematics-page/catalog.js';
import { stageCinematic, seedReviewEntry } from '../src/cinematics-page/runtime.js';
import { screen } from '../src/platform.js';
import { game as gameState } from '../src/game-state.js';
import { MAP } from '../src/world-map.js';
import { heldBackPerson } from '../src/story/dialogue.js';
import { seedDebugSave } from '../src/debug-save.js';
import { slots, slotStorage, DEBUG_SLOT } from '../src/save-slots.js';
import { items } from '../src/items.js';
import { HUD_HIDES } from '../src/hud-shows.js';

// ------------------------------------------------------------------ the sequences

const tap = (...codes) => codes;
/** A cinematic of the review page's catalog (src/cinematics-page/catalog.js) by its id. */
export const catalogEntry = (id) => CINEMATICS.find((e) => e.id === id) ?? null;
/** What plays now: the prologue, a world's moment, a ship's scene or a box opening, and its own clock (s). */
export function playing(G) {
  const P = G.ship?.prologue;
  if (P && !P.done && G.ship?.playing) return { what: 'prologue', stage: P.stage, t: P.t };
  const m = G.story?.moments?.current;
  if (m) return { what: `moment:${m.id}`, stage: null, t: m.t ?? 0 };
  const c = G.ship?.cinematic;
  if (c && G.ship?.playing) return { what: `ship:${c.constructor?.name ?? 'scene'}`, stage: c.i ?? null, t: c.t ?? 0 };
  const b = G.boxes?.scene;
  if (b && G.boxes?.busy?.()) return { what: 'box', stage: b.phase ?? null, t: b.t ?? 0 };
  return null;
}
/** Seconds into what plays (its own clock), or -1 when nothing does. */
const playT = (G) => playing(G)?.t ?? -1;
/** A beat `secs` into the cinematic that plays (or the first beat after it ended). */
const into = (name, secs, more = {}) => ({ name, until: (G) => playT(G) >= secs || (!playing(G) && G.since > secs), timeout: secs + 30, ...more });
/** A beat at a ship's scene's step `i` (src/ship/cinematics.js Sequence: its clock starts again each step), `secs` into it. */
const atStep = (name, i, secs, more = {}) => ({ name, until: (G) => { const c = G.ship?.cinematic; return !G.ship?.playing || (c && (c.i > i || (c.i === i && c.t >= secs))); }, timeout: 60, ...more });
/** A beat at a box opening's phase (src/boxes/scene.js: its clock starts again each phase). */
const atPhase = (name, phase, secs, more = {}) => ({ name, until: (G) => { const b = G.boxes?.scene; return !b || (b.phase === phase && b.t >= secs) || BOX_PHASES.indexOf(b.phase) > BOX_PHASES.indexOf(phase); }, timeout: 30, ...more });
const BOX_PHASES = ['approach', 'wake', 'rise', 'wobble', 'dissolve', 'reveal', 'card', 'beat', 'out'];
/** Someone of this world by their id, the traveller put 1.6 m before them facing them (the Unity host's 'approach'). */
function approach(G, who) {
  const n = (G.npcs ?? []).find((x) => x.def?.id === who && !x.pooled);
  if (!n) throw new Error(`no ${who} here`);
  const dir = new THREE.Vector3(Math.sin(n.heading ?? 0), 0, Math.cos(n.heading ?? 0)), p = n.pos.clone().addScaledVector(dir, 1.6);
  G.player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  G.player.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z); G.rig.yaw = G.player.heading + Math.PI;
}
/** Bako's line with the makers' mark in it (src/story/desert-data.js, his listen lines). */
const MARK_LINE = '~curious~ An open corner beside a shorter upright, on your ball. {glyph} Like between the giant’s eyes, out past the back gate.';
/** The makers' temple of this id in the world. */
const temple = (G, id) => (G.level.temples ?? []).find((t) => t.id === id) ?? null;
/** A minigame's start card's main button, a pause, as a pad's Menu (src/minigames/kit/runner.js padAction). */
const padStart = (G) => G.minigame?.padAction?.('start');
/** A fight temple's run: more foes up, and the three nearest him stood round him, stunned (sequence 'fight-crowd'). */
function hemIn(G) {
  const S = G.minigame?.session, P = G.player;
  if (!S || !P) throw new Error('no fight temple run');
  S.crowd(4);
  const near = (G.foes?.list ?? []).filter((f) => f.alive).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)).slice(0, 3);
  near.forEach((f, i) => { const [dx, dz] = [[0.6, 0.6], [-1.1, 0.5], [0.5, -1.2]][i]; f.pos.set(P.pos.x + dx, P.pos.y, P.pos.z + dz); f.model?.group?.position.copy(f.pos); f.stunned = 9; });
}
/** A pool of oil lent to the run's room, 6.5 m down the screen from him (the fight temples' iso camera: +x +z). */
function lendPool(G) {
  const S = G.minigame?.session, P = G.player, R = S?.def?.rooms?.[S.run.room];
  if (!R) throw new Error('no fight temple room');
  R.hazard = { kind: 'spill', every: 999, n: 1 };
  S.hazards.start(S.run.room, { spot: [P.pos.x + 4.6, P.pos.z + 4.6] });
}
/** A run of a game's page: its card, the count, the run held a while on `hold`, the pause. */
const gameBeats = (hold) => [
  { name: 'card', wait: 1 },
  { name: 'count', act: padStart, wait: 0.8 },
  { name: 'run', until: (G) => G.minigame?.phase === 'play', timeout: 20, hold: { [hold]: true }, wait: 2.5 },
  { name: 'pause', hold: { [hold]: false }, act: padStart, wait: 0.6 },
];

/** The opening (issue #394's beats, engine/opening-beats.js): a new save's prologue in the desert. */
const OPENING = {
  id: 'opening', title: 'The opening', setup: { level: 'desert', prologue: true, fresh: true },
  beats: [...OPENING_BEATS.map((b) => ({
    name: b.name,
    // (the E that plays the father's message: pressed after the console's beat, before the call's)
    keys: b.stage === 'call' && b.name === 'call-rise' ? tap('KeyE') : [],
    until: (G) => { const P = G.ship?.prologue; return !P || P.done || beatDue(b, PROLOGUE_STAGES, P.stage, P.t); },
    timeout: 120,
    // (at the console: the traveller at the cockpit's point, the voicemail's prompt over its button)
    after: b.console ? (G) => { const m = G.ship.modelOf(G.player.pos); if (m?.interior?.points?.cockpit) G.player.pos.copy(G.ship.world(m, m.interior.points.cockpit)); } : null,
    wait: b.console ? 0.9 : 0,
  })),
  // after it: Plumb's word on the village on the horizon, on the cue in its name (src/companion.js, issue #434)
  // (and the first step out's drift into the view over, so the camera is the rig's on both sides whenever the line comes)
  { name: 'plumb', until: (G) => /Plumb:/.test(G.screen().cue?.text ?? '') && !G.ship?.reveal && !G.ship?.blend, timeout: 60 }],
};

/** Every world's filmed moment (src/story/*-moments.js, the catalog's "World moments"): three beats into each. */
const MOMENTS = CINEMATICS.filter((e) => e.group === 'World moments').map((e) => ({
  id: `moment-${e.id}`, title: `World moment · ${e.title}`, setup: { level: e.world, review: e.id },
  beats: [into('start', 0.6), into('mid', 4), into('late', 9)],
}));

export const SEQUENCES = [
  OPENING,
  ...MOMENTS,
  {
    id: 'box', title: 'A makers\' box opening', setup: { level: 'desert', review: 'box.desert.backpack' },
    beats: [atPhase('rise', 'rise', 0.3), atPhase('wobble', 'wobble', 1), atPhase('reveal', 'reveal', 0.4), { name: 'card', until: (G) => !!G.screen().boxCard?.card, timeout: 30, wait: 0.6 }],
  },
  {
    id: 'arrival', title: 'The ship\'s arrival', setup: { level: 'arzach', review: 'arrival.arzach' },
    beats: [atStep('space', 0, 1.5), atStep('clouds', 1, 1), atStep('descent', 2, 2), atStep('land', 3, 1.5), atStep('ramp', 4, 1.2), { name: 'out', until: (G) => !G.ship?.playing, timeout: 60, wait: 1.5 }],
  },
  {
    id: 'takeoff', title: 'The ship\'s takeoff', setup: { level: 'arzach', review: 'takeoff' },
    beats: [atStep('seal', 0, 1), atStep('lift', 1, 2), atStep('away', 1, 4.6), atStep('stars', 2, 0.8)],
  },
  {
    // the Underwater City's sea port (issue #572): the ship sets down on its deck over the sea, the lock lowers it, the
    // ramp; then the lift down its shaft through the surface, the sea and the Dock's crown (src/underwater-port.js)
    id: 'sea-port', title: 'The sea port and its lift', setup: { level: 'underwater', review: 'arrival.underwater' },
    beats: [atStep('land', 3, 1.5), atStep('berth', 4, 2), atStep('ramp', 5, 1.2), { name: 'out', until: (G) => !G.ship?.playing, timeout: 60, wait: 1.5 },
      { name: 'cabin', act: (G) => { const S = G.level.seaPort, p = new THREE.Vector3(0.4, S.lift.y + 0.05, 128.6); G.player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)); G.player.heading = Math.PI; G.rig.yaw = 0; }, until: (G) => G.level.seaPort.lift.moving, timeout: 5, wait: 0.4 },
      { name: 'surface', until: (G) => G.level.seaPort.lift.y < 75, timeout: 20 },
      { name: 'deep', until: (G) => G.level.seaPort.lift.y < 42, timeout: 20 },
      { name: 'crown', until: (G) => G.level.seaPort.lift.y < 19, timeout: 20 },
      { name: 'dock', until: (G) => G.level.seaPort.lift.at === 'foot', timeout: 20, wait: 1 }],
  },
  {
    // the Start menu and its pages (src/ui.js SettingsMenu on the web, engine/menus.js in the engines; no Items, Quests or
    // Map there since issue #487), and the game menu's (src/game-menu.js) Items, Map and Quests
    id: 'menus', title: 'The Start menu and its pages', setup: { level: 'bazaar', debug: true },
    beats: [
      { name: 'play', wait: 1.5 },
      { name: 'start', act: (G) => G.menu.open('start'), wait: 0.5 },
      { name: 'items', act: (G) => { G.menu.close(); G.menu.open('game', 'items'); }, wait: 0.5 },
      { name: 'map', act: (G) => { G.menu.close(); G.menu.open('game', 'map'); }, wait: 1.5 },
      { name: 'quests', act: (G) => { G.menu.close(); G.menu.open('game', 'quests'); }, wait: 0.5 },
      { name: 'settings', act: (G) => { G.menu.close(); G.menu.open('start', 'settings'); }, wait: 0.5 },
      { name: 'closed', act: (G) => G.menu.close(), wait: 0.8 },
    ],
  },
  {
    // the Start menu's other entries (issue #264): Controls with its rebinding, What's new (the page's own panel, N; the
    // engines' Start menu page) and Photo mode (P), in and out
    id: 'start-pages', title: 'Controls, What\'s new and Photo mode', setup: { level: 'bazaar', debug: true },
    beats: [
      { name: 'play', wait: 1.5 },
      { name: 'controls', act: (G) => G.menu.open('start', 'controls'), wait: 0.5 },
      { name: 'news', act: (G) => { G.menu.close(); G.menu.open('start', 'news'); }, wait: 0.5 },
      { name: 'photo', act: (G) => G.menu.close(), keys: tap('KeyP'), wait: 0.8 },
      { name: 'back', keys: tap('KeyP'), wait: 0.8 },
    ],
  },
  {
    // the House map (issue #405, src/house-map.js): the game menu's panel inside a makers' house (the Start menu's page until
    // issue #487), its floor drawn
    id: 'house-map', title: 'The House map', setup: { level: 'buried', debug: true },
    beats: [
      { name: 'inside', act: (G) => { const a = temple(G, 'buried').arrival, h = a.heading; G.player.teleport(a.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(h), 0, Math.cos(h))); G.player.heading = h; G.rig.yaw = h + Math.PI; }, wait: 2 },
      { name: 'map', act: (G) => G.menu.open('game', 'house'), wait: 1.5 },
      { name: 'closed', act: (G) => G.menu.close(), wait: 0.6 },
    ],
  },
  {
    // a fight in the Arena (its waves stopped): a blot set down, locked on, a cut, a hit, its death, its chimes
    id: 'fight', title: 'A fight', setup: { level: 'arena', fight: true },
    beats: [
      { name: 'ready', act: (G) => { const F = G.foes; F.setPractice?.(''); F.waveRest = F.packRest = 1e9; for (const f of [...F.list]) F.remove(f); }, wait: 1 },
      { name: 'spawn', act: (G) => { G.foe = G.foes.spawnKind('blot', { n: 1, dist: 5 })[0]; G.foeHp = G.foe?.hp; }, wait: 1 },
      { name: 'lock', keys: tap('Tab'), wait: 0.8 },
      { name: 'cut', keys: tap('KeyF'), wait: 0.1 },
      { name: 'hit', keys: tap('KeyF', 'KeyF'), until: (G) => !G.foe || G.foe.hp < G.foeHp, timeout: 4, wait: 0.1 },
      { name: 'death', act: (G) => { if (G.foe?.alive) G.foes.hurt(G.foe, 'blade', new THREE.Vector3(0, 0, 1), { damage: 99 }); }, wait: 0.6 },
      { name: 'chimes', act: (G) => { if (G.foe) G.player.teleport(G.foe.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); }, wait: 2.5 },
    ],
  },
  {
    // the foes' painted surfaces (src/foe-surface.js, #264): five kinds of the roster one at a time, close, in the Arena (its waves
    // stopped): the crab's bands and specks, the lizard's scales and belly, the centipede's rivets and rust, the brute's cracks,
    // the moth's lantern glowing
    id: 'foes', title: 'The foes\' painted surfaces', setup: { level: 'arena', fight: true },
    beats: ['crab', 'lizard', 'centipede', 'brute', 'moth'].map((kind) => ({
      name: kind, wait: 1.2,
      act: (G) => {
        const F = G.foes; F.setPractice?.(''); F.waveRest = F.packRest = 1e9; for (const f of [...F.list]) F.remove(f);
        // (ahead and a little to the side, out from behind him)
        const f = F.spawnKind(kind, { n: 1, dist: 3.2 })[0], h = G.player.heading ?? 0;
        if (f) { f.pos.x += Math.cos(h) * 1.5; f.pos.z -= Math.sin(h) * 1.5; f.heading = Math.atan2(G.player.pos.x - f.pos.x, G.player.pos.z - f.pos.z); }
      },
    })).concat([
      // (and the chimes a felled crab leaves, lying out of his reach: the crystals, src/crystal-shader.js)
      { name: 'chimes', wait: 1.6, act: (G) => {
        const F = G.foes; for (const f of [...F.list]) F.remove(f);
        const f = F.spawnKind('crab', { n: 1, dist: 6 })[0], h = G.player.heading ?? 0;
        if (f) { f.pos.x += Math.cos(h) * 1.2; f.pos.z -= Math.sin(h) * 1.2; F.hurt(f, 'blade', new THREE.Vector3(0, 0, 1), { damage: 99 }); }
      } },
      // (and a while later, the crystals at rest on the sand, each with its patch of shade under it: chimes.js blobMaterial)
      { name: 'chimes-rest', wait: 3 },
    ]),
  },
  {
    // a makers' temple, the Buried's: in at its door, its first switch lit, a small key, the great key and the guardian's door
    id: 'temple', title: 'A makers\' temple', setup: { level: 'buried', debug: true },
    beats: [
      { name: 'enter', act: (G) => { const a = temple(G, 'buried').arrival, h = a.heading; G.player.teleport(a.pos.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(h), 0, Math.cos(h))); G.player.heading = h; G.rig.yaw = h + Math.PI; }, wait: 2 },
      { name: 'switch', act: (G) => temple(G, 'buried').piece('s1')?.hit('shoot'), wait: 1.2 },
      { name: 'key', act: (G) => { const rt = temple(G, 'buried'); rt.logic.light('arB'); rt.onLit('arB'); rt.applyDoors(); rt.piece('kS')?.openIt(); }, wait: 3 },
      { name: 'door', act: (G) => { const rt = temple(G, 'buried'); rt.logic.light('k3'); rt.logic.moveDrum('bQ', 0); rt.piece('kB')?.openIt(); rt.logic.unlock('d4'); rt.applyDoors(); }, wait: 3 },
    ],
  },
  {
    // a fight temple's run (the Sunken Hall, src/fight-temples): its card, the count, the first wave up from the springs
    id: 'fight-temple', title: 'A fight temple\'s first wave', setup: { level: 'desert', game: 'fight-desert' },
    beats: [
      { name: 'card', wait: 1 },
      { name: 'count', act: padStart, wait: 0.8 },
      { name: 'wave', until: (G) => G.minigame?.session?.run?.phase === 'fight' && G.minigame.session.run.standing >= 1, timeout: 40, wait: 1.5 },
    ],
  },
  {
    // the same run read from the iso camera (issue #534, src/fight-temples/view.js): three foes stood round him (his ring,
    // the screen's 'self' part), a pool of oil lent to the room 6.5 m down the screen from him (the view drawn toward it),
    // then Tab (no lock: the aim's ring flashed, the line said once); all placed from where he stands, so the run's own
    // layout (drawn from a seed of its own on each side) does not move them
    id: 'fight-crowd', title: 'A fight temple\'s crowd from the iso camera', setup: { level: 'desert', game: 'fight-desert' },
    beats: [
      { name: 'card', wait: 1 },
      { name: 'count', act: padStart, wait: 0.8 },
      { name: 'wave', until: (G) => G.minigame?.session?.run?.phase === 'fight' && G.minigame.session.run.standing >= 1, timeout: 40, wait: 1 },
      { name: 'hemmed', act: hemIn, wait: 0.6 },
      { name: 'pool', act: lendPool, wait: 1 },
      { name: 'lock', keys: tap('Tab'), wait: 0.2 },
    ],
  },
  { id: 'game-rings', title: 'A minigame: the rings', setup: { level: 'desert', game: 'rings' }, beats: gameBeats('Space') },
  { id: 'game-ski', title: 'A minigame: the ski', setup: { level: 'desert', game: 'ski' }, beats: gameBeats('KeyW') },
  // the chime pirates' four places (issue #555, #556): each its sky, ground and arrival out of the warp with its name, on
  // the way to Edena (?game=pirates&stage=<level>&to=edena)
  ...['drift', 'mines', 'ice', 'wrecks'].map((stage) => ({
    id: `game-pirates-${stage}`, title: `The chime pirates: ${stage}`, setup: { level: 'desert', game: 'pirates', stage, to: 'edena' },
    // (on the way somewhere the run starts as the page opens, no card, so each beat waits on the game: the 3-2-1 at its 1,
    // the place's name still up from the warp, then the run a few seconds on. The warp itself is over by the time the
    // web's runner starts, a second or two into the page.)
    beats: [{ name: 'named', until: (G) => G.minigame?.countState?.text === '1' && !!G.minigame?.flashes?.some((f) => /big/.test(f.kind ?? '')), timeout: 10, wait: 0.2 },
      { name: 'run', until: (G) => G.minigame?.phase === 'play', timeout: 20, wait: 2.5 }],
  })),
  {
    // Anselm's arrival on the first fragment, filmed (issue #550, #556: src/story/scientist-arrival.js): the desert's
    // fragment by the ship walked into on the save before the desert; the traveller hears the tick, Anselm runs in, the
    // two of them, then his talk
    id: 'thrum-arrival', title: 'Anselm\'s arrival', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'taken', act: (G) => { const f = G.fragments.list[5]; G.player.teleport(f.pos.clone().setY(f.pos.y - 0.9), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)); },
        until: (G) => playing(G)?.what === 'moment:thrum.arrival', timeout: 10, wait: 0.8 },
      into('run', 2.6), into('two', 5),
      { name: 'talk', until: (G) => !!G.story?.dialogue?.open, timeout: 20, wait: 0.8 },
    ],
  },
  {
    // a conversation with choices: Teo in the desert (src/story/desert-data.js: two pages, then his two answers)
    id: 'talk', title: 'A conversation with choices', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'beside', act: (G) => approach(G, 'teo'), wait: 1.2 },
      { name: 'open', keys: tap('KeyE'), until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.2 },
      { name: 'page', keys: tap('Space'), wait: 1.2 },
      { name: 'choices', until: (G) => (G.screen().dialogue?.choices?.length ?? 0) > 0, timeout: 6, wait: 0.5 },
      { name: 'answer', keys: tap('Digit1'), wait: 1.5 },
    ],
  },
  {
    // the ship's hold and Anselm's shop (issue #264, #195/#234: the engines never attached the ship, so the ramp led
    // nowhere): walked into the ramp from 4 m out, up it on the ship's autopilot and in, then before Anselm by the
    // crates, his talk (and its gestures, #197: public/anim/gestures.glb), "Show me what you have", his shop. Arzach's
    // debug save: the desert's fragments found, so he is met and aboard (the desert's has none before it)
    id: 'hold', title: 'The ship\'s hold and Anselm\'s shop', setup: { level: 'arzach', debug: true },
    beats: [
      { name: 'ramp', act: (G) => { const S = G.ship, out = S.rampFoot.clone().sub(S.hinge).setY(0).normalize(); standAt(G, S.rampFoot.clone().addScaledVector(out, 4), S.hinge); }, wait: 1.2 },
      { name: 'walk-in', hold: { KeyW: true }, until: (G) => !!G.ship.auto, timeout: 8, wait: 0.6 },
      { name: 'aboard', hold: { KeyW: false }, until: (G) => G.ship.inside && !G.ship.auto, timeout: 20, wait: 1.2 },
      { name: 'anselm', act: (G) => {
        const n = G.story.scientist?.aboard;
        if (!n) throw new Error('Anselm is not aboard');
        const at = n.pos.clone().add(new THREE.Vector3(Math.sin(n.heading), 0, Math.cos(n.heading)).multiplyScalar(1.6));
        standAt(G, at, n.pos);
      }, wait: 1.2 },
      { name: 'talk', keys: tap('KeyE'), until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.5 },
      { name: 'gesture', keys: tap('Space'), wait: 1.5 },
      { name: 'choices', until: (G) => (G.screen().dialogue?.choices?.length ?? 0) > 0, timeout: 6, wait: 0.5 },   // (the gesture's line is the one with the answers since #519's shorter count: a Space here would take the first)
      { name: 'shop', keys: tap('Digit1'), until: (G) => !G.story?.dialogue?.open, timeout: 5, wait: 1.5 },
    ],
  },
  {
    // Plumb talks (issue #543): something critical to tell you (the first Blade Gate's line, said as if near it) brings it
    // to your shoulder with its red mark, nothing on the cue; Q opens its talk in the dialogue box (its name, its portrait);
    // the talk turned past, it flies toward the goal
    id: 'plumb-talk', title: 'Plumb\'s talk', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'mark', act: (G) => { G.state.set('met.x', true); G.state.set('drone.said.bladegate', false); G.plumb.gap = 0; G.plumb.note('bladegate'); },
        until: (G) => !!G.scout?.mark?.visible, timeout: 30, wait: 1.2 },
      { name: 'talk', keys: tap('KeyQ'), until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.5 },
      { name: 'page', keys: tap('Space'), wait: 1.2 },
      // (the Blade Gate's warning: nowhere to fly, you are at it, issue #563)
      { name: 'after', keys: tap('Space'), until: (G) => !G.story?.dialogue?.open, timeout: 5, wait: 1.5 },
      // lost: the box says it, then the flight with its pointing word on the cue (issue #559: "This way." in a box points at nothing)
      { name: 'lost', act: (G) => { G.plumb.gap = 0; G.state.set('drone.said.pointer', true); Object.assign(G.plumb.lost, { t: 1e4, walked: 1e4, cool: 0 }); },
        until: (G) => !!G.scout?.mark?.visible, timeout: 30, wait: 1.2 },
      { name: 'lostTalk', keys: tap('KeyQ'), until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.2 },
      { name: 'bark', keys: tap('Space'), until: (G) => !G.story?.dialogue?.open, timeout: 5, wait: 0.6 },
      // (then the find's line: the bark's 3.2 s are the page's clock, which the engines' runner outpaces, so by the cue)
      { name: 'flight', until: (G) => / m$/.test(G.screen().cue?.text ?? ''), timeout: 15, wait: 0.5 },
    ],
  },
  {
    // the makers' mark in a line (issue #513: Unity drew "⁖⌒" where the page draws the shared open-corner mark): Bako's
    // listen line about it (src/story/desert-data.js), said as his whole talk for once
    id: 'mark', title: 'The makers\' mark in a conversation', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'beside', act: (G) => approach(G, 'bako'), wait: 1.2 },
      { name: 'said', act: (G) => { const n = G.npcs.find((x) => x.def?.id === 'bako' && !x.pooled); G.story.dialogue.start(heldBackPerson(n.def, MARK_LINE), n); }, until: (G) => !!G.story?.dialogue?.open, timeout: 5, wait: 1.5 },
    ],
  },
  {
    // the desert's hoverbike on a new save (issue #421: in Unity it was given at the prologue's end, nothing in the
    // hollow, no quest): under its tarp in Marrow's hollow, the tarp pulled back with E, the errand begun
    id: 'hoverbike', title: 'The hoverbike in its hollow', setup: { level: 'desert' },
    beats: [
      { name: 'hollow', act: (G) => {
        const b = G.player.mount, dir = new THREE.Vector3(1, 0, 0.6).normalize(), p = b.pos.clone().addScaledVector(dir, 3.2);
        G.player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
        G.player.heading = Math.atan2(b.pos.x - p.x, b.pos.z - p.z); G.rig.yaw = G.player.heading + Math.PI;
      }, wait: 2 },
      { name: 'tarp', keys: tap('KeyE'), wait: 1.6 },
    ],
  },
  {
    // the skull cave's shafts of light (issue #420, "weird artifacts on the god rays"): from the passage's landing over
    // the cave, then down among the shafts
    id: 'skull-cave', title: 'The skull cave\'s shafts of light', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'landing', act: (G) => { const c = G.level.qanat.cave; standAt(G, c.inside, c.origin); }, wait: 2.5 },
      { name: 'shafts', act: (G) => { const c = G.level.qanat.cave, s = shaftMid(c.shafts, 0); standAt(G, c.origin.clone().lerp(s, 0.35), s); }, wait: 2.5 },
    ],
  },
  {
    // a makers' house's deadly pits (issue #425, "seen through walls like an artifact"): the Rose House's Great Hall from
    // its door, turned toward each of its pits behind the wings' walls, then at the channel's pit's lip
    id: 'pits', title: 'A makers\' house\'s pits', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'hall', act: (G) => { const a = temple(G, 'desert').arrival; standAt(G, a.pos, a.pos.clone().add(new THREE.Vector3(Math.sin(a.heading), 0, Math.cos(a.heading)))); }, wait: 2.5 },
      { name: 'toward-channel', act: (G) => standAt(G, temple(G, 'desert').arrival.pos, pitMid(temple(G, 'desert'), 'channel')), wait: 1.5 },
      { name: 'toward-fires', act: (G) => standAt(G, temple(G, 'desert').arrival.pos, pitMid(temple(G, 'desert'), 'fires')), wait: 1.5 },
      { name: 'lip', act: (G) => { const rt = temple(G, 'desert'), p = rt.pits.find((x) => x.room === 'channel'), b = p.box;
        const lip = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y + 3, b.min.z - 3).applyMatrix4(rt.kit.frame);
        standAt(G, lip, pitMid(rt, 'channel')); }, wait: 2.5 },
    ],
  },
  {
    // the grass parting along his last second of steps (src/brush.js) and a splat of the fluid growing on the ground
    // (src/splat-decal.js), the Garden's meadow (issue #264: in Unity the grass parted round his feet only, the splats whole)
    id: 'grass-splats', title: 'The grass parting, a splat growing', setup: { level: 'spheres', debug: true },
    beats: [
      { name: 'meadow', act: (G) => { const at = G.player.pos.clone().add(new THREE.Vector3(-9, 0, 6)); at.y = G.level.ground?.heightAt?.(at.x, at.z) ?? at.y; standAt(G, at, at.clone().add(new THREE.Vector3(0, 0, -10))); }, wait: 1.5 },
      { name: 'walk', hold: { KeyW: true }, wait: 0.9 },
      { name: 'stop', hold: { KeyW: false }, wait: 0.25 },
      { name: 'splat', act: (G) => {
        const p = G.player.pos, f = new THREE.Vector3(Math.sin(G.player.heading), 0, Math.cos(G.player.heading)), at = p.clone().addScaledVector(f, 5);
        at.y = G.level.ground?.heightAt?.(at.x, at.z) ?? p.y;
        G.tool?.splats?.add(at, new THREE.Vector3(0, 1, 0), '#e0467a', '#ffd84a', 1.2, 6);
      }, wait: 0.08 },
      { name: 'splat-held', wait: 1 },
    ],
  },
  {
    // the bird by you in the Garden of Spheres (issue #459: the web floated "ride the bird" over it, the engines nothing):
    // whistled down, landed, the traveller set down beside it facing it
    id: 'bird', title: 'The bird landed beside you', setup: { level: 'spheres', debug: true },
    beats: [
      { name: 'call', act: (G) => G.player.callMount(), until: (G) => !!G.player.mount?.landed && G.player.mount.pos.distanceTo(G.player.pos) < 30, timeout: 40, wait: 0.5 },
      { name: 'beside', act: (G) => { const b = G.player.mount, at = b.pos.clone().add(new THREE.Vector3(2.4, 0, 0)); at.y = b.pos.y; standAt(G, at, b.pos); }, wait: 1.2 },
    ],
  },
  {
    // a splat in front of him, frame by frame (issue #459: in Unity not drawn 0.08 s after it came, there by 1 s): put
    // down by the tool's own Splats on the ground ahead, as a glob's landing does
    id: 'splat', title: 'A splat as it comes', setup: { level: 'desert', debug: true },
    beats: [
      { name: 'still', act: (G) => standAt(G, G.player.pos.clone(), G.player.pos.clone().add(new THREE.Vector3(0, 0, 4))), wait: 1.5 },
      { name: 'at-0.08', act: splatAhead, wait: 0.08 },
      { name: 'at-0.3', wait: 0.22 },
      { name: 'at-1', wait: 0.7 },
    ],
  },
  {
    // the desert's ground decals that three pulls in front with a polygon offset (issue #463: in Unity only the splats'
    // reached the port): the sand banked against things, the salt pan, the tide lines, the sand river, the basin's
    // shore, the crash's scorch and its scrapes, each looked at from its edge nearest the start
    id: 'decals', title: 'The ground\'s decals', setup: { level: 'desert', debug: true },
    beats: [
      // (a hair of look input first: the debug save is before the backpack, so the desert's first steps would print
      // "Look around…" after 6 s still, at a beat the machine's speed picks; looked at, it never comes)
      { name: 'start', act: (G) => { G.rig.look(1e-6, 0); G.decalFrom = G.player.pos.clone(); }, wait: 0.5 },
      decalBeat('drift', (m) => m.uniforms?.uDrift?.value === 1),
      decalBeat('salt', colourIs('#f1ece0')),
      decalBeat('tide', colourIs('#efe6d3')),
      decalBeat('river', colourIs('#f7e0b2')),
      decalBeat('shore', colourIs('#d6c19c')),
      decalBeat('scorch', colourIs('#e2be86')),
      decalBeat('scrape', colourIs('#b48a5e')),
    ],
  },
];

/** A ground decal's material by its colour (makeMaterial's uColor). */
function colourIs(hex) { return (m) => m.uniforms?.uColor?.value?.getHexString?.() === hex.slice(1); }
/**
 * A beat at a ground decal (a mesh drawn with three's polygon offset, not a splat, whose material `match`es): of its
 * vertices the one nearest where the sequence started, the traveller 5 m outside it facing 6 m into it.
 */
function decalBeat(name, match) {
  return { name, wait: 2.5, act: (G) => {
    const from = G.decalFrom ?? G.player.pos, v = new THREE.Vector3(), best = new THREE.Vector3();
    let bestD = Infinity;
    G.scene.updateMatrixWorld(true);
    G.scene.traverse((o) => {
      const m = o.material;
      if (!o.isMesh || Array.isArray(m) || !m?.polygonOffset || m.uniforms?.uSplatTime || !match(m)) return;
      const p = o.geometry?.attributes?.position;
      if (!p || o.isInstancedMesh) return;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        const d = (v.x - from.x) ** 2 + (v.z - from.z) ** 2;
        if (d < bestD) { bestD = d; best.copy(v); }
      }
    });
    if (!Number.isFinite(bestD)) throw new Error(`no decal ${name}`);
    const out = new THREE.Vector3(from.x - best.x, 0, from.z - best.z);
    if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
    out.normalize();
    const at = best.clone().addScaledVector(out, 5), to = best.clone().addScaledVector(out, -6);
    at.y = G.level.ground?.heightAt?.(at.x, at.z) ?? best.y;
    standAt(G, at, to);
  } };
}

/** A splat on the ground 4 m before the traveller and 2 m to his side, in view (the tool's Splats.add, as a glob landing there). */
function splatAhead(G) {
  const p = G.player.pos, h = G.player.heading ?? 0, c = Math.cos(h), s = Math.sin(h);
  const at = new THREE.Vector3(p.x + s * 4 + c * 2, p.y, p.z + c * 4 - s * 2);
  const g = G.player.physics?.groundAt?.(at.x, at.y + 5, at.z);
  if (Number.isFinite(g)) at.y = g;
  G.tool.splats.add(at, new THREE.Vector3(0, 1, 0), '#e2493b', '#f6d24a', 1.2);
}

/** The traveller set down at `at`, he and the camera facing `to` (a world point). */
function standAt(G, at, to) {
  G.player.teleport(at.clone(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  G.player.heading = Math.atan2(to.x - at.x, to.z - at.z); G.rig.yaw = G.player.heading + Math.PI;
}
/** The middle of a cave's shaft of light (its wash's mesh, in the world). */
const shaftMid = (shafts, i) => { shafts.updateMatrixWorld(true); return new THREE.Vector3().setFromMatrixPosition(shafts.children[i].matrixWorld); };
/** The middle of a temple's pit of that room, in the world. */
const pitMid = (rt, room) => rt.pits.find((p) => p.room === room).box.getCenter(new THREE.Vector3()).applyMatrix4(rt.kit.frame);

/** The sequence of that id, or null. */
export const sequenceById = (id) => SEQUENCES.find((s) => s.id === id) ?? null;

// ------------------------------------------------------------------ setting a sequence up

/**
 * The page's address for a sequence on the web: its world, and what the page seeds and starts from the address (the
 * cinematics review: the save before that world and the cinematic staged; the prologue; a debug save; a game's page).
 */
export function webQuery(setup) {
  const q = new URLSearchParams({ level: setup.level });
  if (setup.review) { const e = catalogEntry(setup.review); q.set('cinematicReview', setup.review); for (const [k, v] of Object.entries(e?.query ?? {})) q.set(k, v); }
  if (setup.prologue) q.set('prologue', '1');
  if (setup.debug) q.set('debugsave', '1');
  if (setup.game) { q.set('game', setup.game); q.set('from', setup.level); }
  if (setup.stage) q.set('stage', setup.stage);   // (the chime pirates' level, issue #555)
  if (setup.to) q.set('to', setup.to);             // (the world their flight is on the way to)
  return `?${q}`;
}

/**
 * The engines' side of the same: the save written first (always the debug save's slot, never a player's), then what
 * createGame takes. Called before createGame; `ready(G)` after it, the cinematic staged as the page's review does.
 */
export function engineSetup(setup) {
  slots.setActive(DEBUG_SLOT); gameState.reload(); gameState.reset();
  try { slotStorage.removeItem('hiraeth.journal.v1'); } catch { /* none */ }
  const e = setup.review ? catalogEntry(setup.review) : null;
  if (e) seedReviewEntry(e);
  if (setup.debug) seedDebugSave(setup.level, { slot: DEBUG_SLOT, state: gameState });
  const opts = { levelId: setup.level };
  if (setup.prologue) opts.prologue = true;
  if (e?.query?.via) { opts.via = e.query.via; opts.arrive = true; }
  if (e?.query?.prologue) opts.prologue = true;
  if (setup.fight) opts.fight = true;
  if (setup.game) { opts.game = setup.game; opts.from = setup.level; }
  if (setup.stage) opts.stage = setup.stage;
  if (setup.to) opts.to = setup.to;
  return opts;
}

/**
 * The engines' -game argument for a sequence's setup (engine/unity/game.js): the game's id, with its address's own words
 * after a '?' as the Unity host's -game takes them (the chime pirates' stage and where they fly: issue #555), or null.
 * (No URLSearchParams in an engine's VM: engine/trials.js readHref reads it back.)
 */
export function engineGameArg(opts) {
  if (!opts?.game) return null;
  const words = Object.entries({ stage: opts.stage, to: opts.to }).filter(([, v]) => v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return words.length ? `${opts.game}?${words.join('&')}` : opts.game;
}

/** After the world is up: the review's cinematic staged (the page does it itself from its address: startReview). */
export function engineReady(G, setup) {
  const e = setup.review ? catalogEntry(setup.review) : null;
  if (!e || e.query) return null;
  G.story?.closePage?.();
  return stageCinematic(stageWindow(G), e);
}
/** The page's window as stageCinematic reads it, from the engines' game. */
const stageWindow = (G) => ({ storyRt: G.story, story: G.storyPage, ship: G.ship, boxes: G.boxes, level: G.level, player: G.player, items, THREE, rig: G.rig, camera: G.camera, gadgets: G.gadgets });

// ------------------------------------------------------------------ the game, seen the same way on both sides

/**
 * The web's game as a sequence sees it: the page's globals (src/main.js Object.assign(window, …)), its Start menu
 * (window.menu, src/ui.js SettingsMenu) and its game menu (window.journal.menu, src/game-menu.js GameMenu).
 */
export function webGame(w) {
  const newsOpen = () => !!w.document.getElementById('changelog')?.classList.contains('open');
  return {
    side: 'web', win: w,
    scene: w.scene, camera: w.camera, player: w.player, rig: w.rig, level: w.level, ship: w.ship, boxes: w.boxes,
    story: w.storyRt, storyPage: w.story, npcs: w.npcs, fragments: w.fragments, gadgets: w.gadgets, tool: w.tool, foes: w.foes, trials: w.trials, items: w.items, state: gameState,
    scout: w.scout, plumb: w.plumb,
    get minigame() { return w.minigame ?? null; },
    // (the screen's state, and what the page draws of the fight in its own HTML that the engines send as parts:
    // engine/combat.js 'lock', 'warn', 'restart'; the web's #foe-lock, #foe-warn, #restart)
    screen: () => ({ ...screen.state, lock: w.foes?.lock ? true : screen.state.lock ?? null, warn: w.foes?.warnView?.length ? true : null, restart: w.document.getElementById('restart')?.classList.contains('open') ? true : null,
      foeTab: w.document.getElementById('foe-tab') && !w.document.body.classList.contains('foe-list') ? true : null }),
    // (the recordings' hologram: on the page a scene of its own drawn over the picture, HOLO.render)
    // (what the page draws over the finished picture from scenes of its own: the see-through surfaces' wash and the ways
    // through's light (level.veils), the wind's wisps, the motes, a makers' house's air, the recordings' hologram; the
    // engines hang them all in the mirrored scene: engine/bridge-gaps.js, its passes)
    extraScenes: () => [w.level?.veils?.scene, w.wind?.scene, w.motes?.scene, ...(w.houseAir?.scenes?.() ?? []), HOLO.live() ? HOLO.scene : null].filter(Boolean),
    menu: {
      open(kind, page = null) {
        // (What's new: on the page its own panel over the game, N or the Start menu's entry: src/changelog.js Changelog)
        if (kind === 'start' && page === 'news') { if (!newsOpen()) w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyN' })); }
        else if (kind === 'start') w.menu.toggle(true, page ?? 'settings');
        else w.journal.toggle(true, page);
      },
      close() { if (w.menu.open) w.menu.toggle(false); if (w.journal.open) w.journal.toggle(false); if (newsOpen()) w.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyN' })); },
      view() {
        const txt = (el) => clean(el?.textContent);
        // (What's new: its versions as the engines' page has them, the newest four (engine/menus.js NEWS_VERSIONS), a
        // heading then its lines)
        if (newsOpen()) {
          const rows = [...w.document.querySelectorAll('#changelog .list section')].slice(0, 4)
            .flatMap((s) => [clean(s.querySelector('h2')?.firstChild?.textContent), ...[...s.querySelectorAll('li')].map(txt)]);
          return { kind: 'start', page: 'news', side: [], rows };
        }
        if (w.menu.open) {
          const el = w.menu.el, page = w.menu.current;
          const side = [...el.querySelectorAll('.menu-nav button')].filter((b) => !b.hidden).map(txt);
          const rows = [...el.querySelectorAll(`.panel[data-page="${page}"] label.row > span:first-child, .panel[data-page="${page}"] li > span:first-child`)].map(txt);
          return { kind: 'start', page, side, rows };
        }
        // (a keeper's shop: the page's own HTML, its wares by name, as the engines' 'shop' sheet: shopView)
        if (w.shopPanel?.isOpen) return shopView(w.shopPanel);
        if (w.journal.open) {
          const M = w.journal.menu;
          // (side: the panels' tabs, the House map's among them inside a makers' house: issue #487)
          return { kind: 'game', page: M.panel, side: M.state.panels.map((p) => clean(p.name)), rows: (M.rows ?? []).flat().map((c) => clean(c.name ?? '')) };
        }
        return null;
      },
    },
  };
}

/** A shop open (src/shop-panel.js ShopPanel, the page's and the engines' alike): its id and its wares' names. */
const shopView = (P) => ({ kind: 'shop', page: P.entry?.shop?.id ?? null, side: [], rows: P.view().wares.map((x) => clean(x.name ?? x.label ?? '')) });

/** The engines' game (engine/game.js createGame) as a sequence sees it, with the menus the host made (engine/menus.js). */
export function engineGame(g, menus = null) {
  return {
    side: 'engine', game: g,
    scene: g.scene, camera: g.camera, player: g.player, rig: g.rig, level: g.level, ship: g.ship, boxes: g.boxes,
    story: g.story, storyPage: g.storyPage, npcs: g.npcs, fragments: g.fragments, gadgets: g.gadgets, tool: g.tool, foes: g.foes, trials: g.trials, items, state: gameState,
    scout: g.scout, plumb: g.plumb,
    get minigame() { return g.trials?.runner ?? null; },
    screen: () => { const st = g.screen().state; return { ...st, lock: st.lock ? true : null, warn: st.warn?.length ? true : null, restart: st.restart ? true : null }; },
    extraScenes: () => [],
    menu: {
      open(kind, page = null) {
        if (!menus) return;
        if (kind === 'start') {
          menus.show('start');
          // (What's new chosen, as the page's entry opens its panel: in it, BridgeMenu's panel over the game; the others shown
          // from the sidebar)
          if (page && page !== 'settings') { const i = menus.startSide().findIndex((e) => e.page === page); if (i >= 0) { menus.start.page = page; menus.start.at = page === 'news' ? { in: 'page', i: 0 } : { in: 'side', i }; } }
          menus.changed();
        } else menus.show('game', page);
      },
      close() { menus?.close(); },
      view() {
        if (menus?.mode === 'shop' && menus.shop?.panel?.isOpen) return shopView(menus.shop.panel);
        const v = menus?.view?.();
        if (!v) return null;
        if (v.kind === 'start') return { kind: 'start', page: menus.startPage(), side: v.side.map((s) => clean(s.text)), rows: (v.page?.rows ?? []).filter((r) => !(r.head && menus.startPage() === 'settings')).map((r) => clean(r.text)) };   // (the settings' group headings: the page's h2, not its rows)
        if (v.kind === 'game') return { kind: 'game', page: v.panel, side: v.tabs.names.map(clean), rows: menus.panel().rows.flat().map((c) => clean(c.name ?? '')) };
        // (a run's card, a shop, the foes' list: the page's own HTML on the web, compared by their screen parts)
        return null;
      },
    },
  };
}

/**
 * A key pressed or let go in the engines as the Unity host's readInput routes the player's (engine/unity/game.js): a
 * menu open takes it; Esc in play opens the Start menu (not over a conversation, a scene, a box, photo mode or a run),
 * J the game menu; else the game's.
 */
export function engineKey(g, menus, code, down) {
  if (!down) { menus?.keyUp?.(code); g.key(code, false); return; }
  if (menus?.open) { menus.key(code); return; }
  if (menus && code === 'Escape' && !g.story?.dialogue?.open && !g.photoOn && !g.scenePlaying && !g.boxPlaying && !g.minigameOn) { menus.show('start'); return; }
  if (menus && code === 'KeyJ' && !g.minigameOn) { menus.show('game'); return; }
  g.key(code, true);
}

// ------------------------------------------------------------------ the runner

/**
 * One sequence played against a game (webGame / engineGame): tick(dt) with the game's seconds since the last tick,
 * once a frame (the engines) or every few frames (the web, from outside). It answers what the side has to do:
 *   { keys: [[code, down], …] }   press or let go (the web through Chrome's input, the engines engineKey)
 *   { record: beat, late }        the beat is here: take the picture and probe(G)
 *   { done: true }                no beats left
 *   null                          nothing this tick
 * A beat runs in this order: act(G) (a dev jump; a promise is waited for), its keys tapped (down, 0.12 s, up, 0.25 s
 * apart), until(G) waited for (timeout s, then recorded `late`), after(G), wait s more, then recorded.
 */
/**
 * The Map drawn whole at its first look while the sequences' streams are taken (the node runner, engine/sequence-run.mjs,
 * and the web's recorder, scripts/unity-compare/sequences.mjs): its rays and its picture are a few ms a frame in play
 * (MAP.budget, issue #468's phase 1), so how much of it a beat saw hung on the machine's speed and load, and a stream
 * taken on a busy machine differed from one taken on an idle one. Not for the players' runs (the stutter routes measure
 * the budget itself).
 */
export function mapAtOnce() { MAP.budget = 1e6; }

export class SequenceRun {
  constructor(G, seq) { Object.assign(this, { G, seq, i: 0, phase: 'act', t: 0, time: 0, events: [], busy: false, late: false, errors: [] }); G.since = 0; }
  tick(dt) {
    this.time += dt;
    const G = this.G;
    G.since = (G.since ?? 0) + dt;
    const due = this.events.filter((e) => e.at <= this.time);
    if (due.length) { this.events = this.events.filter((e) => e.at > this.time); return { keys: due.map((e) => [e.code, e.down]) }; }
    if (this.busy) return null;
    const b = this.seq.beats[this.i];
    if (!b) return { done: true };
    if (this.phase === 'act') {
      this.phase = 'keys'; this.t = 0; this.late = false;
      const r = this.call(b.act);
      if (r?.then) { this.busy = true; r.then(() => { this.busy = false; }, (e) => { this.errors.push(`${b.name}: ${e?.message ?? e}`); this.busy = false; }); }
      (b.keys ?? []).forEach((code, k) => { this.events.push({ at: this.time + 0.05 + k * 0.25, code, down: true }, { at: this.time + 0.17 + k * 0.25, code, down: false }); });
      for (const [code, down] of Object.entries(b.hold ?? {})) this.events.push({ at: this.time + 0.05, code, down });
      return null;
    }
    if (this.phase === 'keys') { if (!this.events.length) { this.phase = 'until'; this.t = 0; } return null; }
    if (this.phase === 'until') {
      this.t += dt;
      let ok = !b.until;
      if (!ok) { try { ok = !!b.until(G); } catch { ok = false; } }
      if (!ok && this.t < (b.timeout ?? 30)) return null;
      this.late = !ok;
      this.call(b.after);
      this.phase = 'wait'; this.t = 0;
      return null;
    }
    if (this.phase === 'wait') { this.t += dt; if (this.t < (b.wait ?? 0)) return null; this.phase = 'act'; this.i++; G.since = 0; return { record: b, late: this.late }; }
    return null;
  }
  call(f) { if (!f) return null; try { return f(this.G); } catch (e) { this.errors.push(`${this.seq.beats[this.i]?.name}: ${e?.message ?? e}`); return null; } }
}

// ------------------------------------------------------------------ what is on screen, as data

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.!?…)]+$/gu, '').trim();
const r1 = (v) => Math.round(v * 10) / 10;
/** Each screen part as the stream keeps it: what a player reads of it, not its timing (null: just that it shows). */
const PART = {
  prompt: (p) => ({ text: clean(p.text), key: p.key ?? null }),
  cue: (p) => clean(p.text),
  toast: (p) => clean(p.text),
  sub: (p) => ({ who: p.who ?? null, text: clean(p.text) }),
  dialogue: (d) => ({ name: clean(d.name), text: clean(d.text), choices: (d.choices ?? []).map((c) => clean(c.text)) }),
  cine: (c) => ({ bars: !!c.bars, lids: !!c.lids, hud: c.hud !== false, walk: !!c.walk, skip: !!c.skip }),
  boxCard: (b) => ({ name: clean(b.name), card: !!b.card, scene: !!b.scene }),
  charge: (c) => ({ mark: c.mark ?? null, text: clean(c.text) }),
  keys: (k) => ({ small: k.small ?? 0, big: !!k.big }),
  health: (h) => ({ low: !!h.low }),
  gadget: (g) => g.id ?? null,
  carry: (c) => clean(c.name),
};
/** Parts that come and go with timing alone (the stamina wheel's fade, a pad's pick): not compared. */
// (the toast: the engines keep its part, drawn for its secs from when its id came, the page clears it as it fades, and
// queues the next by its own clock; what was toasted is the story's, the same on both sides)
// (the HUD's own buttons for a pointer, issue #570: the page's are its elements, minigames.css .mg-pause, the engines' this
// part, src/hud-buttons.js; tests/hud-buttons.test.js holds the two to one rule)
const UNSTEADY = new Set(['choice', 'stamina', 'version', 'toast', 'buttons']);

/** The drawables in view: each visible mesh within `far` m of the camera and in its frustum, by the port's kind of its material. */
function objectKinds(G, far = 120) {
  const cam = G.camera, kinds = {};
  cam.updateMatrixWorld();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const at = cam.getWorldPosition(new THREE.Vector3()), s = new THREE.Sphere(), seen = new Map();
  const kindOf = (m) => {
    if (seen.has(m)) return seen.get(m);
    let k;
    try { const spec = inkSpec(m), p = portMaterial(spec, 0); k = p.port ?? (spec.type === 'other' ? `three:${spec.three}` : spec.type); } catch { k = 'unknown'; }
    seen.set(m, k);
    return k;
  };
  for (const root of [G.scene, ...G.extraScenes()]) {
    root?.traverseVisible?.((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      const g = o.geometry;
      if (g && !o.isInstancedMesh && !o.isSkinnedMesh) {
        if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch { return; } }
        if (g.boundingSphere) {
          s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
          if (s.center.distanceTo(at) - s.radius > far || !fr.intersectsSphere(s)) return;
        }
      }
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && m.visible !== false) { const k = kindOf(m); kinds[k] = (kinds[k] ?? 0) + 1; }
    });
  }
  return kinds;
}

/**
 * What the screen shows at a beat, as data: the HUD's parts (src/platform.js screen) and what each says, the menu open
 * and its rows, what plays (the prologue's stage, a moment, a ship's scene, a box), the drawables in view by the port's
 * kind of their material, the camera and the traveller.
 */
export function probe(G) {
  const S = G.screen(), hud = {};
  for (const [k, v] of Object.entries(S)) {
    if (v == null || UNSTEADY.has(k)) continue;
    // (a region's name: it fades in and out by the game's clock as he walks, the page's and the engines' a little apart)
    if (k === 'cue' && v.kind === 'place') continue;
    try { hud[k] = PART[k] ? PART[k](v) : true; } catch { hud[k] = true; }
  }
  const c = G.camera, p = G.player?.pos;
  const play = playing(G);
  let menu = null;
  try { menu = G.menu.view(); } catch { menu = null; }
  return {
    hud, menu,
    playing: play ? { what: play.what, stage: play.stage ?? null } : null,
    objects: objectKinds(G),
    cam: c ? [...c.getWorldPosition(new THREE.Vector3()).toArray().map(r1), r1(c.fov ?? 0)] : null,
    player: p ? p.toArray().map(r1) : null,
  };
}

// ------------------------------------------------------------------ the two streams against each other

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Kinds that follow the camera (the dust motes, the wind's wisps: one cloud each, in view or culled by a hair): not compared. */
const AMBIENT = new Set(['mote', 'wisp']);
/** How far apart the camera and the traveller may be (m) before it is a difference: the two clocks differ a little. */
export const TOLERANCE = { cam: 3, fov: 4, player: 2.5 };

/**
 * One beat's records against each other → the differences, each { key, web, engine }:
 *   part-:<name> / part+:<name>   a HUD part shown on the web only / in the engines only
 *   part~:<name>                  shown on both, saying different things
 *   menu, menu.side, menu.rows    another menu or page open / its sidebar / its rows
 *   playing                       another cinematic or stage playing
 *   obj-:<kind> / obj+:<kind>     drawables of that port kind in view on the web only / in the engines only
 *   cam, cam.fov, player          the camera or the traveller further apart than TOLERANCE
 *   late                          the beat's condition never came on one side (recorded at its timeout)
 */
/**
 * The parts of a beat's HUD that show (src/hud-shows.js, the one table the page's CSS and BridgeHud follow): a part set
 * but hidden (a bark under a conversation, the cue under the letterbox) is not on screen on either side.
 */
export function shownHud(hud) {
  const c = hud.cine && typeof hud.cine === 'object' ? hud.cine : null, walk = !!c?.walk;
  const on = { talking: 'dialogue' in hud, bars: !!c?.bars && !walk, hudOff: !!c && c.hud === false && !walk, minigame: 'minigame' in hud, photo: 'photo' in hud };
  const out = { ...hud };
  for (const [state, parts] of Object.entries(HUD_HIDES)) if (on[state]) for (const p of parts) delete out[p];
  // (people's barks come when chance has them say something: the page's and the engines' never at the same moment)
  delete out.balloons;
  return out;
}

export function compareBeat(web, eng) {
  web = { ...web, hud: shownHud(web.hud) }; eng = { ...eng, hud: shownHud(eng.hud) };
  const out = [], add = (key, a, b) => out.push({ key, web: a ?? null, engine: b ?? null });
  // (the hold-to-skip tag shows for a while after a press, by the wall's clock: kept in the stream, not compared)
  const steady = (k, v) => (k === 'cine' && v ? { ...v, skip: undefined } : v);
  for (const k of new Set([...Object.keys(web.hud), ...Object.keys(eng.hud)])) {
    if (!(k in eng.hud)) add(`part-:${k}`, web.hud[k], null);
    else if (!(k in web.hud)) add(`part+:${k}`, null, eng.hud[k]);
    else if (!same(steady(k, web.hud[k]), steady(k, eng.hud[k]))) add(`part~:${k}`, web.hud[k], eng.hud[k]);
  }
  const wm = web.menu, em = eng.menu;
  if (!!wm !== !!em || (wm && (wm.kind !== em.kind || wm.page !== em.page))) add('menu', wm && `${wm.kind}:${wm.page}`, em && `${em.kind}:${em.page}`);
  else if (wm) {
    if (!same(wm.side, em.side)) add('menu.side', wm.side, em.side);
    if (!same(wm.rows, em.rows)) add('menu.rows', wm.rows, em.rows);
  }
  if (!!web.late !== !!eng.late) add('late', !!web.late, !!eng.late);
  if (!same(web.playing, eng.playing)) add('playing', web.playing, eng.playing);
  for (const k of new Set([...Object.keys(web.objects), ...Object.keys(eng.objects)])) {
    if (AMBIENT.has(k)) continue;
    if (!eng.objects[k]) add(`obj-:${k}`, web.objects[k], 0);
    else if (!web.objects[k]) add(`obj+:${k}`, 0, eng.objects[k]);
  }
  if (web.cam && eng.cam) {
    if (dist(web.cam, eng.cam) > TOLERANCE.cam) add('cam', web.cam.slice(0, 3), eng.cam.slice(0, 3));
    if (Math.abs(web.cam[3] - eng.cam[3]) > TOLERANCE.fov) add('cam.fov', web.cam[3], eng.cam[3]);
  }
  if (web.player && eng.player && dist(web.player, eng.player) > TOLERANCE.player) add('player', web.player, eng.player);
  return out;
}

/**
 * Two streams ({ <sequence id>: { beats: [{ beat, …probe }] } }) against each other → every difference
 * { seq, beat, key, web, engine }; a beat on one side only is `beat-missing`.
 */
export function compareStreams(web, eng, { only = null } = {}) {
  const out = [];
  for (const id of new Set([...Object.keys(web), ...Object.keys(eng)])) {
    if (only && !only.includes(id)) continue;
    const W = web[id]?.beats ?? [], E = eng[id]?.beats ?? [];
    for (const name of new Set([...W.map((b) => b.beat), ...E.map((b) => b.beat)])) {
      const a = W.find((b) => b.beat === name), b = E.find((x) => x.beat === name);
      if (!a || !b) { out.push({ seq: id, beat: name, key: 'beat-missing', web: !!a, engine: !!b }); continue; }
      for (const d of compareBeat(a, b)) out.push({ seq: id, beat: name, ...d });
    }
  }
  return out;
}

/** A list's pattern: `*` any run, `a|b` either. */
export const glob = (p) => new RegExp(`^(?:${String(p).split('|').map((alt) => alt.split('*').map((x) => x.replace(/[.+?^$()|[\]\\{}]/g, '\\$&')).join('.*')).join('|')})$`);
/** The entry of a list (engine/bridge-gaps.js STREAM_DIFFS) that names a difference, or null. */
export function listedDiff(list, d) {
  return list.find((e) => glob(e.seq ?? '*').test(d.seq) && glob(e.beat ?? '*').test(d.beat) && (e.keys ?? []).some((k) => glob(k).test(d.key))) ?? null;
}
