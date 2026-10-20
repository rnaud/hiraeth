// The music page's catalogue (music.html, src/music-page/main.js, docs/systems/audio.md "The music page"; issue #270):
// every song the game plays, recorded (the Suno files in public/music/) or made as it plays (src/score.js and the
// tunes of src/audio.js), and every sound effect, grouped, each with the variants worth hearing. Pure data and small
// functions of the game's own Sound (src/audio.js): `(s, e) => s.keyGet(true)`, where `e` is the page's player
// (src/music-page/player.js: a place to put a sound at, the frame loop for the continuous layers). Nothing here
// touches Web Audio itself, so tests/music-page.test.js plays every entry on the engines' in-memory context and
// checks that every method of Sound is either here or named in PLUMBING (a new sound can't be missed).

import { SCORES, SCORE_OF, MODES } from '../score.js';
import { SOUNDTRACKS, TITLE_THEME, CUES, loadCue } from '../soundtracks.js';
import { SFX } from '../sfx.js';
import { FOE_VOICES, CUES as FOE_CUES, GLASS } from '../foe-voices.js';
import { KINDS, hit, playColour } from '../score-voices.js';
import { OWN_KINDS } from '../audio.js';
import { LANGUAGES, CALL_VOICES, planLine, voiceOf } from '../story/voice.js';
import { TITLES, ORDER } from '../levels/names.js';
import { RIDER_CALL, RIDER_CALL_BEAT } from '../story/arzach-data.js';
import * as ship from '../ship/sfx.js';
import { pirateSounds, PIRATE_SOUNDS } from '../minigames/pirates-sfx.js';

const name = (id) => TITLES[id] ?? ({ ship: 'The ship', title: 'The title screen' }[id] ?? id);

/** Methods of Sound that are not a sound of their own: the engine, the buses, the helpers the catalogue's sounds use. */
export const PLUMBING = {
  constructor: 'the engine', startIfAllowed: 'the engine', masterLevel: 'the engine', _away: 'the engine', start: 'the engine',
  dispose: 'the engine', levels: 'the meters', toggleMute: 'the mute', setVolumes: 'the volumes', setVoices: 'the voice volume',
  setMusicMode: 'Settings > Music', musicCue: 'the moments (src/music-moments.js)', musicMomentsUpdate: 'the moments',
  holdTheme: 'the moments', playTitleTheme: 'the title (its recording is among the songs)',
  setScore: 'the score player (Songs: each score)', schedule: 'the score player', playEvent: 'the score player', freq: 'the world\'s scale',
  combatSchedule: 'the combat layer (Songs)', menuBusEnsure: 'the menu music (Songs)', menuSchedule: 'the menu music', menuPad: 'the menu music',
  noiseLayer: 'the continuous layers (Ambience)', set: 'the continuous layers', update: 'the continuous layers (Ambience: hold)', follow: 'the score\'s activity',
  railsUpdate: 'the rails layer (Ambience: update with rails)', ambienceTick: 'each world\'s ambience bed (Songs: "with its ambience")',
  houseTick: 'a makers\' house\'s own bed on the beat (Ambience: its ring, drip, moan, creak; src/temples/air.js)',
  placeAt: 'placing a sound', spot: 'placing a sound', foeEar: 'placing a foe\'s sound', foeSpot: 'placing a foe\'s sound', moveFoeSpots: 'placing a foe\'s sound',
  listen: 'the listener (the page calls it every frame)', seated: 'a bench\'s swell (src/benches.js)', seatedK: 'a bench\'s swell', musicLevel: 'the music bus\'s level', _humVoice: 'the hum (makersHum)', _humOut: 'the hum (makersHum)',
  setBands: 'the musicians (Songs)', makeBands: 'the musicians', band: 'the musicians', setBandMode: 'the musicians', bandBeat: 'the musicians',
  soloPhrase: 'the ney solo (Songs)', soloDrone: 'the ney solo', rand: 'a random number', vocal: 'the traveller\'s voice takes (Recorded takes)',
  canSpeak: 'the voices', holdFloor: 'the voices', hush: 'the voices', utterance: 'the voices', trace: 'the voices',
  vary: 'a random factor (the synth\'s variation)', swish: 'a building block of the swings (fluidSlash, toss)', uiOut: 'the menus\' bus (ui)',
};

// ------------------------------------------------------------------ songs
/**
 * The recorded songs: each file of public/music/ the game plays, with the worlds that play it (src/soundtracks.js
 * SOUNDTRACKS), the title's (TITLE_THEME) and the cues (CUES: a file that may not be there yet). Their titles,
 * prompts and links come from public/music/manifest.json, read by the page.
 */
export function recordedSongs() {
  const by = new Map();
  for (const [level, file] of Object.entries(SOUNDTRACKS)) (by.get(file) ?? by.set(file, []).get(file)).push(level);
  // (in the route's order, then the worlds off it)
  const rank = (levels) => Math.min(...levels.map((l) => { const i = ORDER.indexOf(l); return i < 0 ? 99 : i; }));
  const songs = [...by].sort((a, b) => rank(a[1]) - rank(b[1])).map(([file, levels]) => ({ id: `file:${file.replace(/\.mp3$/, '')}`, kind: 'file', file, levels,
    name: levels.map(name).join(' · '), where: `${levels.map(name).join(', ')}: the world's theme, at its moments (arriving, indoors, a moment), or always (Settings > Music)` }));
  songs.push({ id: `file:${TITLE_THEME.replace(/\.mp3$/, '')}`, kind: 'file', file: TITLE_THEME, levels: [], name: name('title'),
    where: 'the title screen (over the procedural menu music once it has loaded)' });
  for (const [id, file] of Object.entries(CUES)) {
    songs.push({ id: `cue:${id}`, kind: 'file', file, levels: [], cue: id, name: `Cue: ${id}`, where: 'played once at a moment; until its file is there the game sings its synth (the singing light\'s theme, under Tunes)' });
  }
  return songs;
}

/** Which worlds play a score: its own, and the desert's for every world without one (src/score.js scoreFor). */
export function scoreUsers(id) {
  if (id === 'ship') return 'the ship, in the prologue (src/ship/)';
  if (id === 'home') return 'Home, and the Lantern';
  const own = name(id);
  if (id !== 'desert') return own;
  const others = Object.keys(TITLES).filter((w) => !SCORES[w] && !SCORE_OF[w]).map(name);
  return `${own}; ${others.length ? `and every world without a score of its own: ${others.join(', ')}; ` : ''}the title and the Lab`;
}

/** The procedural scores (src/score.js SCORES): one each, played by the page's score player with the world's params. */
export function scoreSongs() {
  return Object.entries(SCORES).map(([id, S]) => ({
    id: `score:${id}`, kind: 'score', scoreId: id, name: `${S.title}`, world: name(id), where: scoreUsers(id),
    params: `${(S.root).toFixed(2)} Hz ${S.mode}${MODES[S.mode] ? '' : '?'}, ${S.tempo} bpm, ${S.meter}/${S.meter > 6 ? 8 : 4}, pad ${S.pal.pad}, lead ${S.pal.lead}, pluck ${S.pal.pluck}${S.perc ? ', drums' : ', no drums'}`,
  }));
}

/** The musicians in the worlds (src/story/*: setBands), as the worlds set them up: parts and mode. */
export const BANDS = [
  { id: 'desert-camp', world: 'desert', name: 'The camp by the fire', parts: ['oud', 'ney', 'chant', 'drum'], modes: ['play', 'near', 'feast'] },
  { id: 'desert-procession', world: 'desert', name: 'The procession', parts: ['drum', 'bell'], modes: ['play', 'feast'] },
  { id: 'desert-tree', world: 'desert', name: 'The tree', parts: ['chant', 'bell'], modes: ['play', 'feast'] },
  { id: 'perdide-song', world: 'perdide', name: 'Lorn: the hum and the song', parts: ['bell', 'chant'], modes: ['play', 'feast'] },
  { id: 'edena-clock', world: 'edena', name: 'Viridel: the clock and the ship', parts: ['bell', 'chant'], modes: ['play'] },
  { id: 'incal-shrine', world: 'incal', name: 'The City-Shaft: the shrine and its bells', parts: ['chant', 'bell'], modes: ['play', 'feast'] },
  { id: 'bazaar-tower', world: 'bazaar', name: 'The Signal Market: the tower', parts: ['bell', 'chant'], modes: ['play'] },
  { id: 'home-small', world: 'home', name: 'Home: by the hearth', parts: ['bell'], modes: ['play'] },
];

/**
 * The other music: the menus', the fight's layer, the musicians, and the tunes the game sings at a moment (each a
 * function of the Sound, `world` the scale it is sung in). `long`: it plays until stopped (or its length).
 */
export const TUNES = [
  { id: 'menu', kind: 'loop', name: 'The menu music', where: 'the Start menu and the pause; the title before its recording has loaded (src/audio.js MENU_SCORE)',
    start: (s) => s.menuMusic(true), stop: (s) => s.menuMusic(false) },
  { id: 'combat', kind: 'loop', name: 'The fight\'s layer', where: 'over the world\'s music while foes chase you (src/foes.js): a drum, a tom, a drone',
    start: (s) => s.combat(true), stop: (s) => s.combat(false) },
  ...BANDS.map((b) => ({ id: `band:${b.id}`, kind: 'band', band: b, world: b.world, name: `Musicians: ${b.name}`, where: `${name(b.world)} (src/story/: setBands): ${b.parts.join(', ')}` })),
  { id: 'light-theme', kind: 'tune', name: 'The singing light\'s theme', where: 'the singing light (src/story/light-theme.js): the prologue, the fragments, the map\'s search, the ending',
    variants: [['once', (s) => s.lightTheme()], ['short (the map)', (s) => s.lightTheme({ short: true })], ['passing (falling)', (s) => s.lightTheme({ bend: -3, pan: { from: -0.8, to: 0.8 } })], ['a fifth up', (s) => s.lightTheme({ transpose: 7 })], ['its recording, once there', async (s) => { if (!(await loadCue(s, 'singing-light')) || !s.playCue('singing-light')) s.lightTheme(); }]] },
  { id: 'swell', kind: 'tune', name: 'A moment\'s swell', where: 'a world\'s moments (src/story/*-moments.js): the motif, or the father\'s theme in the world\'s mode',
    variants: [['motif', (s) => s.swell('motif')], ['father', (s) => s.swell('father')]] },
  { id: 'charge', kind: 'tune', name: 'The father\'s charge', where: 'the prologue, as he gives his charge (src/story/charge.js)', variants: [['play', (s) => s.charge()]] },
  { id: 'homage', kind: 'tune', name: 'The homage at the stone', where: 'Home, at the parents\' stone: the world\'s melody on a celesta', variants: [['play', (s, e) => s.homage(e.at)]] },
  { id: 'solo', kind: 'tune', name: 'Bako\'s ney', where: 'the Desert: Bako plays when you ask (src/story/desert.js)', variants: [['play', (s, e) => s.solo(e.at)]] },
  { id: 'spheres-song', kind: 'tune', name: 'The spheres\' song', where: 'the Garden of Spheres: the pole sings the three back',
    variants: [['song', (s, e) => s.spheresSong(e.at)], ['with the ney', (s, e) => s.spheresSong(e.at, { ney: true })]] },
  { id: 'makers-hum', kind: 'tune', name: 'The makers\' hum', where: 'near an unopened chest; the prologue (src/story/hum.js)',
    variants: [['once', (s) => s.makersHum()], ['rising (the prologue)', (s, e) => { const h = s.makersHumRise(6); e.later(6.5, () => h?.stop?.()); }]] },
];

// ------------------------------------------------------------------ effects
const pick = (label, fn) => [label, fn];
const one = (fn) => [pick('play', fn)];
const FX = [];
const add = (group, id, what, variants, where = '') => FX.push({ id, group, name: what, where, variants });

// the body
add('The traveller', 'step', 'A footstep', ['stone', 'grass', 'sand'].flatMap((g) => [pick(`${g} walk`, (s) => s.step(3, { surface: g })), pick(`${g} run`, (s) => s.step(10, { surface: g }))]), 'every step (src/foley.js); the surface underfoot (footSurface)');
add('The traveller', 'jump', 'A jump', [pick('jump', (s) => s.jump()), pick('with a breath', (s) => s.jump({ breath: true }))]);
add('The traveller', 'land', 'A landing', [pick('soft', (s) => s.land({ speed: 3 })), pick('hard', (s) => s.land({ speed: 9 })), pick('a long fall', (s) => s.land({ speed: 16 }))]);
add('The traveller', 'grab', 'Catching a wall', one((s) => s.grab()));
add('The traveller', 'mantle', 'Pulling up a ledge', [pick('mantle', (s) => s.mantle()), pick('with an effort', (s) => s.mantle({ breath: true }))]);
add('The traveller', 'evade', 'The roll out of a blow', one((s) => s.evade()));
add('The traveller', 'knockdown', 'Knocked down', one((s) => s.knockdown()));
add('The traveller', 'getUp', 'Getting up', [pick('get up', (s) => s.getUp()), pick('with a sigh', (s) => s.getUp({ sigh: true }))]);
add('The traveller', 'hurt', 'Hurt', [pick('a small hit', (s) => s.hurt(0.25)), pick('a big hit', (s) => s.hurt(1.5)), pick('a fall', (s) => s.hurt(1, 'fall'))]);
add('The traveller', 'effort', 'His effort (a cut, a throw)', [pick('a heavy cut', (s) => s.effort(1, 0)), pick('his own, no recording (the engines)', (s) => s.grunt('effort', 1, 0))]);
add('The traveller', 'grunt', 'Hurt, his own voice (the engines)', one((s) => s.grunt('hurt', 1, 0)), 'where the recorded takes are not played (issue #379)');
add('The traveller', 'toss', 'Throwing what he carries', one((s) => s.toss()));
add('The traveller', 'wings', 'The fluid wings', [pick('open', (s) => s.wings({ open: true })), pick('fold', (s) => s.wings({ open: false }))]);
add('The traveller', 'flap', 'A wing beat', one((s) => s.flap()));
add('The traveller', 'jets', 'The jets light', one((s) => s.jets()));
add('The traveller', 'heartbeat', 'The low-health heartbeat', one((s) => s.heartbeat()), 'one heart left (src/low-health.js)');
// recorded takes (src/sfx.js: public/sfx/)
for (const g of Object.keys(SFX)) add('Recorded takes', `sample:${g}`, `${g} (${SFX[g].n} take${SFX[g].n > 1 ? 's' : ''})`, one((s) => s.sample(g)), 'public/sfx/ (CC0, scripts/sfx-build.mjs): the next take of the group');
// water
add('Water', 'splash', 'A splash', [pick('small', (s) => s.splash(0.4)), pick('going in', (s) => s.splash(1)), pick('a big drop', (s) => s.splash(2))]);
add('Water', 'stroke', 'A swimming stroke', [pick('breaststroke', (s) => s.stroke(0)), pick('crawl', (s) => s.stroke(1))]);
add('Water', 'wade', 'Wading', [pick('shallow', (s) => s.wade(0.2)), pick('deep', (s) => s.wade(1))]);
add('Water', 'bubbles', 'Bubbles', [pick('a few', (s) => s.bubbles(0.5)), pick('out of air', (s) => s.bubbles(2))]);
add('Water', 'gasp', 'A gasp at the surface', one((s) => s.gasp()));
add('Water', 'underwater', 'Going under (everything dull)', [pick('under for 3 s', (s, e) => { s.underwater(1); s.splash(1); e.later(3, () => s.underwater(0)); }), pick('the halls (0.3) for 3 s', (s, e) => { s.underwater(0.3); e.later(3, () => s.underwater(0)); })], 'the whole mix through a low-pass: play something else meanwhile');
add('Water', 'waterRise', 'Water welling up', [pick('short', (s) => s.waterRise({ dur: 2 })), pick('long', (s) => s.waterRise({ dur: 5 }))]);
// the gun
add('The fluid gun', 'fluidShoot', 'Shoot', [pick('fluid', (s) => s.fluidShoot('shoot')), pick('stilling', (s) => s.fluidShoot('stun')), pick('ember', (s) => s.fluidShoot('fire'))]);
add('The fluid gun', 'fluidMode', 'The mode switches', [pick('fluid', (s) => s.fluidMode('shoot')), pick('stilling', (s) => s.fluidMode('stun')), pick('ember', (s) => s.fluidMode('fire'))]);
add('The fluid gun', 'fluidSplash', 'A glob lands', ['shoot', 'stun', 'fire'].flatMap((m) => [pick(`${m}: the world`, (s) => s.fluidSplash(false, m)), pick(`${m}: someone`, (s) => s.fluidSplash(true, m))]));
add('The fluid gun', 'fluidPush', 'Push', one((s) => s.fluidPush()));
add('The fluid gun', 'fluidBoost', 'Boost', one((s) => s.fluidBoost()));
add('The fluid gun', 'fluidRefill', 'The tank refills', [pick('refill', (s) => s.fluidRefill(false)), pick('a colour added', (s) => s.fluidRefill(true))]);
add('The fluid gun', 'fluidEmpty', 'The tank is empty', one((s) => s.fluidEmpty()));
add('The fluid gun', 'fluidDock', 'The pack in a socket', [pick('in', (s) => s.fluidDock(true)), pick('out', (s) => s.fluidDock(false))]);
// the blade and the shield
add('The blade and the shield', 'fluidSlash', 'A swing of the blade', [0, 1, 2].map((n) => pick(`combo ${n + 1}`, (s) => s.fluidSlash(n))));
add('The blade and the shield', 'fluidWindup', 'The blade pressed: the swing begins', [pick('a light swing', (s) => s.fluidWindup(0)), pick('the heavy third', (s) => s.fluidWindup(2))], 'at the press, before the cut (issue #379)');
add('The blade and the shield', 'lockOn', 'Locking on', [pick('on', (s) => s.lockOn(true)), pick('let go', (s) => s.lockOn(false))], 'Tab / R3 (issue #379)');
add('The blade and the shield', 'fluidSlashHit', 'The blade lands', [pick('the air', (s) => s.fluidSlashHit(false)), pick('a foe', (s) => s.fluidSlashHit(true)), pick('heavy', (s) => s.fluidSlashHit(true, true))]);
add('The blade and the shield', 'fluidCharge', 'The charged cut', [pick('gathering', (s) => s.fluidCharge(false)), pick('full', (s) => s.fluidCharge(true))]);
add('The blade and the shield', 'fluidRiposte', 'The riposte', [pick('starts', (s) => s.fluidRiposte(false)), pick('lands', (s) => s.fluidRiposte(true))]);
add('The blade and the shield', 'fluidDash', 'The dash cut', one((s) => s.fluidDash()));
add('The blade and the shield', 'flurry', 'A perfect dodge\'s flurry', one((s) => s.flurry()));
add('The blade and the shield', 'fluidBlock', 'The shield takes a blow', [pick('a block', (s) => s.fluidBlock(false)), pick('a parry', (s) => s.fluidBlock(true))]);
add('The blade and the shield', 'shield', 'The shield', [pick('open', (s) => s.shieldOpen()), pick('close', (s) => s.shieldClose()), pick('break', (s) => s.shieldBreak())]);
// calls, the scout
add('Calls and the scout', 'drone', 'The scout', ['go', 'found', 'shrug', 'hint'].map((k) => pick(k, (s) => s.drone(k))), 'src/scout.js');
add('Calls and the scout', 'whistle', 'Whistling', [pick('the mount', (s) => s.whistle('mount')), pick('a taxi', (s) => s.whistle('taxi'))]);
add('Calls and the scout', 'packCall', 'Calling the hoverbike from the pack', one((s) => s.packCall()));
add('Calls and the scout', 'tune', 'The rider\'s call (Vael\'s flute)', one((s) => s.tune(RIDER_CALL, RIDER_CALL_BEAT)));
add('Calls and the scout', 'psst', 'Someone calling you over', one((s, e) => s.psst(e.at)));
// chests, keys, items
add('Chests, keys and items', 'boxWobble', 'A chest rocks', [0, 1, 2].map((i) => pick(`wobble ${i + 1}`, (s) => s.boxWobble(i))));
add('Chests, keys and items', 'boxLatch', 'The latch', [pick('catch', (s) => s.boxLatch(false)), pick('release', (s) => s.boxLatch(true))]);
add('Chests, keys and items', 'boxCreak', 'The lid lifts', one((s) => s.boxCreak()));
add('Chests, keys and items', 'boxOpen', 'The chest opens', one((s) => s.boxOpen()));
add('Chests, keys and items', 'boxBurst', 'The light pours out', one((s) => s.boxBurst()));
add('Chests, keys and items', 'fanfare', 'The item rises', one((s) => s.fanfare()));
add('Chests, keys and items', 'keyGet', 'A temple key', [pick('small key', (s) => s.keyGet(false)), pick('great key', (s) => s.keyGet(true))], 'out of its little chest (issue #274)');
add('Chests, keys and items', 'keyTurn', 'A key in a lock', one((s) => s.keyTurn()));
add('Chests, keys and items', 'boxAnswer', 'A box answers the bell', [pick('near', (s) => s.boxAnswer(1)), pick('far', (s) => s.boxAnswer(0.3))]);
add('Chests, keys and items', 'boxHum', 'A box nearby hums', [pick('near, 4 s', (s, e) => e.hold(4, () => s.boxHum(1, 1), () => s.boxHum(0, 0))), pick('far, 6 s', (s, e) => e.hold(6, () => s.boxHum(0.3, 0.4), () => s.boxHum(0, 0)))], 'continuous while one is near');
add('Chests, keys and items', 'pickup', 'Picking something up', one((s) => s.pickup()));
add('Chests, keys and items', 'potion', 'A healing potion', ['open', 'heal', 'no'].map((p) => pick(p, (s) => s.potion(p))));
add('Chests, keys and items', 'potionPickup', 'A potion picked up', one((s) => s.potionPickup()));
// chimes and the shop
add('Chimes and the shop', 'chimePickup', 'A chime picked up', [1, 5, 20, 100].map((v) => pick(`worth ${v}`, (s) => s.chimePickup(v))));
add('Chimes and the shop', 'chimeScatter', 'Chimes scattered out of a foe', [pick('a foe', (s) => s.chimeScatter(false)), pick('a guardian', (s) => s.chimeScatter(true))]);
add('Chimes and the shop', 'shopBell', 'The shop\'s bell', one((s) => s.shopBell()));
add('Chimes and the shop', 'purchase', 'A sale', [pick('cheap', (s) => s.purchase(5)), pick('dear', (s) => s.purchase(80))]);
// quests, fragments, the world's moments
add('Quests and moments', 'chime', 'A quest step done', one((s) => s.chime()));
add('Quests and moments', 'quest', 'A quest\'s moments', ['start', 'step', 'done'].map((k) => pick(k, (s) => s.quest(k))), 'given, a step done, done (issue #379)');
add('Quests and moments', 'doorOpen', 'A temple door opening', one((s) => s.doorOpen()));
add('Quests and moments', 'ui', 'The menus', ['move', 'confirm', 'back', 'tab', 'open', 'close', 'no'].map((k) => pick(k, (s) => s.ui(k))), 'every menu (src/ui-sound.js, issue #379)');
add('Quests and moments', 'toolClick', 'An answer chosen', [pick('chosen', (s) => s.toolClick(true)), pick('back', (s) => s.toolClick(false))], 'a conversation\'s answers');
add('Quests and moments', 'shutter', 'A photo taken', one((s) => s.shutter()), 'photo mode');
add('Quests and moments', 'fail', 'A quest gone wrong', one((s) => s.fail()));
add('Quests and moments', 'whoosh', 'Something giving way', one((s) => s.whoosh()));
add('Quests and moments', 'rumble', 'Water and earth letting go', [pick('short', (s) => s.rumble(2.5)), pick('long', (s) => s.rumble(5))], 'Viridel\'s terraces');
add('Quests and moments', 'page', 'A page turned', one((s) => s.page()));
add('Quests and moments', 'doorway', 'Walking through a doorway: its latch and soft knock', one((s) => s.doorway()));
add('Quests and moments', 'bell', 'The bell-note whistle', one((s) => s.bell()));
add('Quests and moments', 'fragmentSong', 'A fragment singing to itself', [pick('near', (s, e) => s.fragmentSong(e.at, 1)), pick('far', (s, e) => s.fragmentSong(e.at, 0.3))]);
add('Quests and moments', 'finderBeep', 'The finder\'s beep', [pick('far', (s) => s.finderBeep(700)), pick('near', (s) => s.finderBeep(1800))]);
add('Quests and moments', 'fragmentTaken', 'A fragment taken', one((s) => s.fragmentTaken()));
add('Quests and moments', 'orbNote', 'A great sphere touched', [pick('small', (s, e) => s.orbNote(2, e.at, { size: 0.1 })), pick('big', (s, e) => s.orbNote(0, e.at, { size: 1 })), pick('a shove', (s, e) => s.orbNote(4, e.at, { soft: true }))], 'the Garden of Spheres');
add('Quests and moments', 'remembered', 'A sphere that remembers', ['bell', 'chant', 'drum'].map((k) => pick(k, (s, e) => s.remembered(k, e.at))), 'the Garden of Spheres');
add('Quests and moments', 'instrument:skybell', 'The Sky Stones\' bell note', one((s) => s.instrument('bell', 164.8, s.ctx.currentTime + 0.05, 2, 0.1, s.fx)), 'Vael II: the bell answering a shot (src/story/arzach2.js playBellNote)');
// foes and guardians
add('Foes and guardians', 'foeWarn', 'A foe winds up', [pick('ink', (s) => s.foeWarn('blot', 0.8)), pick('machine', (s) => s.foeWarn('machine', 0.8)), ...Object.keys(FOE_CUES).map((c) => pick(`${c}'s cue`, (s) => s.foeWarn('blot', 1, null, c)))], 'over exactly its wind-up (src/telegraph.js)');
add('Foes and guardians', 'guardianWarn', 'A guardian winds up', [pick('living', (s) => s.guardianWarn('organic', 1.2)), pick('living, heavy', (s) => s.guardianWarn('organic', 1.6, true)), pick('machine', (s) => s.guardianWarn('robot', 1.2)), pick('machine, heavy', (s) => s.guardianWarn('robot', 1.6, true))], 'src/temples/boss.js');
add('Foes and guardians', 'foeGlance', 'A blow that does nothing', one((s) => s.foeGlance()));
add('Foes and guardians', 'foeArmour', 'A cut that doesn\'t stop it', one((s) => s.foeArmour()));
add('Foes and guardians', 'foeKill', 'A foe felled in a fight temple: the ink\'s wet thump', [pick('small', (s) => s.foeKill(0.7)), pick('big', (s) => s.foeKill(1))], 'issue #442: src/fight-temples/kill-fx.js');
add('Foes and guardians', 'fireball', 'The ember wisp\'s fireball', ['throw', 'hum', 'tink', 'back', 'stun', 'burst', 'douse'].map((k) => pick(k, (s, e) => s.fireball(k, e.at))), 'issue #398: thrown, in the air, cut back, back on the wisp, the wisp stunned, burst, doused');
for (const [kind, v] of Object.entries(FOE_VOICES)) add('Foes and guardians', `foe:${kind}`, `${kind} (${v.family ?? 'its own'})`, [pick('hurt', (s, e) => s.foeHurt(kind, null, e.at)), pick('done', (s) => s.foeBurst(kind))], 'src/foe-voices.js');
// creatures
const CRITTERS = ['squeak', 'inflate', 'boing', 'portal', 'chime', 'bloom', 'jet', 'whirr', 'clank', 'clack', 'blip', 'splash', 'skip', 'plop', 'poof', 'puff', 'spores', 'flutter', 'scribble', 'creak', 'daze', 'flash'];
add('Creatures', 'critter', 'Wildlife surprised', CRITTERS.map((k) => pick(k, (s) => s.critter(k))), 'a creature\'s own (the worlds\' critters)');
add('Creatures', 'bark', 'Moustache barks', one((s) => s.bark()), 'Home: the dog');
// the ship (src/ship/sfx.js)
const SHIP = {
  ring: ['An incoming call', one((s) => ship.ring(s))],
  beep: ['A beep', [pick('low', (s) => ship.beep(s)), pick('high', (s) => ship.beep(s, true))]],
  impact: ['Something hits the ship', one((s) => ship.impact(s))],
  staticBurst: ['Static', one((s) => ship.staticBurst(s))],
  rumble: ['The ship rumbles', one((s) => ship.rumble(s))],
  roar: ['The engines roar', one((s) => ship.roar(s))],
  hatch: ['The hatch', one((s) => ship.hatch(s))],
  approach: ['Approach', one((s) => ship.approach(s))],
  reentry: ['Re-entry', one((s) => ship.reentry(s))],
  descent: ['The descent', one((s) => ship.descent(s))],
  hum: ['The hull\'s hum (4 s)', one((s, e) => e.hold(4, () => ship.hum(s, 1), () => ship.hum(s, 0)))],
  alarm: ['The alarm (3 s)', one((s, e) => e.hold(3, () => ship.alarm(s, 1), () => ship.alarm(s, 0)))],
  engines: ['The engines (4 s)', one((s, e) => e.hold(4, () => ship.engines(s, 1), () => ship.engines(s, 0)))],
};
for (const [fn, [what, variants]] of Object.entries(SHIP)) add('The ship', `ship:${fn}`, what, variants, 'the prologue, the arrivals and the takeoff (src/ship/sfx.js)');
// the chime pirates (src/minigames/pirates-sfx.js, issue #326): every one of pirateSounds, with its variants
const PIR = (s) => (s._pirateSfx ??= pirateSounds(s));
const PLACE_NAMES = { drift: 'the Rose Rings', mines: 'the Iron Moon', ice: 'the Frost Moon', wrecks: 'the Storm Giant' };
const PIRATE_VARIANTS = {
  tell: ['skiff', 'raider', 'hauler', 'turret', 'core'].map((k) => pick({ skiff: 'a fighter', raider: 'a gunboat', hauler: 'a bomber', turret: 'a turret', core: 'the bridge' }[k], (s) => PIR(s).tell(k, k === 'skiff' ? 0.4 : 0.7))),
  boom: [pick('a mine', (s) => PIR(s).boom(0.6)), pick('a fighter', (s) => PIR(s).boom(1)), pick('a bomber', (s) => PIR(s).boom(1.6)), pick('the captain\'s turret', (s) => PIR(s).boom(2.2))],
  combo: [2, 4, 8].map((n) => pick(`${n} in a row`, (s) => PIR(s).combo(n))),
  tally: [0, 3, 6].map((k) => pick(`step ${k + 1}`, (s) => PIR(s).tally(k))),
  engine: [pick('cruising, 4 s', (s, e) => e.hold(4, () => PIR(s).engine(1, 0), () => PIR(s).engine(0))), pick('pushing, 4 s', (s, e) => e.hold(4, () => PIR(s).engine(1, 1), () => PIR(s).engine(0)))],
  // (issue #555: each place's arrival and bed)
  arrive: Object.entries(PLACE_NAMES).map(([id, name]) => pick(name, (s) => PIR(s).arrive(id))),
  bed: Object.entries(PLACE_NAMES).map(([id, name]) => pick(`${name}, 6 s`, (s, e) => e.hold(6, () => PIR(s).bed(id, 1), () => PIR(s).bed(id, 0)))),
  thunder: [pick('near', (s) => PIR(s).thunder(0.1)), pick('far', (s) => PIR(s).thunder(0.9))],
};
for (const [fn, what] of Object.entries(PIRATE_SOUNDS)) add('Chime pirates', `pirates:${fn}`, what, PIRATE_VARIANTS[fn] ?? one((s) => PIR(s)[fn]()), 'the rail shooter between worlds (src/minigames/pirates-sfx.js)');
// ambience: the continuous layers (update) and the beds' one-offs
const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, altitude: 0, riding: false, thrusting: false, roar: 0, hum: 0, rails: null, rideKind: null, rideSpeed: 0, indoor: 0 };
/** The game's state for update() with `over` changed (the page holds it a few seconds, then lets it go). */
export const layerState = (over = {}) => ({ ...CALM, ...over });
const layer = (id, what, over, secs = 5) => add('Ambience', `layer:${id}`, what, one((s, e) => e.hold(secs, () => s.update(layerState(typeof over === 'function' ? over(e) : over)), () => s.update(layerState()))), 'a continuous layer (Sound.update), held a few seconds');
layer('wind', 'The wind, gusting', { gust: 1 });
layer('storm', 'A storm', { gust: 1, storm: 1 });
layer('high', 'High up', { altitude: 120, gust: 0.5 });
layer('rain', 'Rain', { rain: 1 });
layer('rainRoof', 'Rain on the roof', { rainRoof: 1, indoor: 1 });
layer('cloak', 'Running: the cloak', { speed: 11 });
layer('jet', 'The jets\' roar', { thrusting: true, jetPower: 1 });
layer('roar', 'A waterfall', { roar: 1 });
layer('hum', 'The masts\' hum', { hum: 1 });
layer('bike', 'The hoverbike\'s engine', { riding: true, rideKind: 'bike', rideSpeed: 18 });
layer('rails', 'The train', (e) => ({ rails: { speed: 24, full: 28, out: e.phase() > 0.5 ? 1 : 0, whistle: e.phase() > 0.2 ? 1 : 0 } }), 8);
add('Ambience', 'chirp', 'Birds', one((s) => { const t = s.ctx.currentTime; for (let i = 0; i < 3; i++) s.chirp(t + i * 0.09, 3000 + i * 300, 0.05); }), 'birds\' worlds');
add('Ambience', 'horn', 'A far horn', one((s) => s.horn(s.ctx.currentTime)), 'the cities');
add('Ambience', 'croak', 'A frog', one((s) => s.croak(s.ctx.currentTime)), 'the swamps');
add('Ambience', 'tuning', 'A far signal tuning in', one((s) => s.tuning(s.ctx.currentTime)), 'the Forest of Antennas');
add('Ambience', 'trainWhistle', 'The locomotive\'s whistle', one((s) => s.trainWhistle(s.ctx.currentTime)), 'the Overnight Train');
add('Ambience', 'clack', 'A wheel over a joint', one((s) => { const t = s.ctx.currentTime; for (const d of [0, 0.1, 0.7, 0.8]) s.clack(t + d, 0.08); }), 'the Overnight Train');
add('Ambience', 'ring', 'A struck anvil, a far bell', one((s) => { const t = s.ctx.currentTime; s.ring(t, 1300, { vol: 0.03, dur: 1.4, partials: [1, 2.4, 3.9] }); s.ring(t + 1.5, 311, { vol: 0.03, dur: 4.5, partials: [1, 2.76, 5.4, 8.9] }); }), 'the makers\' houses: the Casting-House, the Founders\' Belfry');
add('Ambience', 'drip', 'A drop into still water', one((s) => { const t = s.ctx.currentTime; for (const d of [0, 0.7, 1.1]) s.drip(t + d, 0.04); }), 'the makers\' houses: the Hush-House, the Whale-House');
add('Ambience', 'moan', 'Far off in the sea, a long low call', one((s) => s.moan(s.ctx.currentTime)), 'the Whale-House');
add('Ambience', 'creak', 'A slack cable taking the strain', one((s) => s.creak(s.ctx.currentTime)), 'the Mooring-House');
// voices
const LINE = 'Hello there, traveller. The wind is kind today.';
for (const lang of Object.keys(LANGUAGES)) add('Voices', `voice:${lang}`, `${LANGUAGES[lang].name ?? lang}`, [pick('a man', (s) => s.speak(planLine(LINE, { lang, voice: voiceOf({ id: `${lang}-m`, kind: 'm' }) }), { channel: 'call' })), pick('a woman', (s) => s.speak(planLine(LINE, { lang, voice: voiceOf({ id: `${lang}-f`, kind: 'f' }) }), { channel: 'call' }))], 'src/story/voice.js LANGUAGES');
for (const [who, p] of Object.entries(CALL_VOICES)) add('Voices', `call:${who}`, `On the call: ${who}`, one((s) => s.speak(planLine(LINE, { lang: 'home', voice: voiceOf(p) }), { channel: 'call' })), 'src/story/voice.js CALL_VOICES');
add('Voices', 'blip', 'The old soft blips (alien voices off)', [pick('low', (s) => s.blip(0.7)), pick('high', (s) => s.blip(1.6))]);
add('Voices', 'syllable', 'A conversation page, said as it comes up (its first syllable starts the voice)', one((s) => { const plan = planLine('Ah, there you are.', { lang: 'desert' }); for (const x of plan.syllables) s.syllable(x, { plan }); }));
// the building blocks (what the sounds above are made of)
add('Building blocks', 'burst', 'Filtered noise', [pick('low', (s) => s.burst(s.ctx.currentTime, { dur: 0.3, freq: 400 })), pick('bright', (s) => s.burst(s.ctx.currentTime, { dur: 0.3, type: 'highpass', freq: 3000 }))]);
add('Building blocks', 'noiseGlide', 'Noise with a moving filter', one((s) => s.noiseGlide(s.ctx.currentTime, { type: 'bandpass', f: 400, f1: 2400, q: 2, dur: 0.6, vol: 0.2 })));
add('Building blocks', 'noiseHit', 'A noise hit', one((s) => s.noiseHit(s.ctx.currentTime, 0.1, 'bandpass', 1500, 0.2, s.fx)));
add('Building blocks', 'sweep', 'A gliding tone', [pick('up', (s) => s.sweep(s.ctx.currentTime, 400, 1600, 0.3, 0.06)), pick('down', (s) => s.sweep(s.ctx.currentTime, 1600, 400, 0.3, 0.06))]);
add('Building blocks', 'pluck', 'A pluck', one((s) => s.pluck(s.freq(0, 1), s.ctx.currentTime, 0.1, 'triangle', s.fx)));
add('Building blocks', 'pad', 'A pad note', one((s) => s.pad(s.freq(0, 0), s.ctx.currentTime, 3)));
add('Building blocks', 'bass', 'A bass note', one((s) => s.bass(s.freq(0, -1), s.ctx.currentTime, 2)));
add('Building blocks', 'ting', 'A small brass ting', one((s) => s.ting(s.ctx.currentTime, 1800)));
add('Building blocks', 'crystalTing', 'A crystal struck', one((s) => s.crystalTing(s.ctx.currentTime, 1600)));
add('Building blocks', 'keyBell', 'A struck bell', one((s) => s.keyBell(880, s.ctx.currentTime, 0.06, 1.2)));
add('Building blocks', 'struck', 'Struck glass partials', one((s) => s.struck(s.ctx.currentTime, 900, GLASS, 1.2, 0.08)));
add('Building blocks', 'drum', 'The bands\' frame drum', [pick('dum', (s) => s.dum(s.ctx.currentTime, 0.3, s.fx)), pick('tek', (s) => s.tek(s.ctx.currentTime, 0.15, s.fx)), pick('clap', (s) => s.clap(s.ctx.currentTime, 0.12, s.fx))]);
add('Building blocks', 'foeVoice', 'A foe attack\'s cue alone', Object.keys(FOE_CUES).map((c) => pick(c, (s) => s.foeVoice(FOE_CUES[c].layers))));

/** The score's instruments (src/score-voices.js KINDS and src/audio.js OWN_KINDS): a note each in the world's scale. */
export function instrumentEntries() {
  const out = [];
  const note = (kind, held) => (s) => { const t = s.ctx.currentTime + 0.05; for (const [i, d] of [0, 2, 4].entries()) s.instrument(kind, s.freq(d, held ? 0 : 1), t + (held ? 0 : i * 0.45), held ? 3 : 0.9, held ? 0.08 : 0.1, s.fx); };
  for (const k of new Set([...KINDS.notes, ...OWN_KINDS])) out.push({ id: `instrument:${k}`, group: 'Instruments', name: k, where: 'a voice of the scores (src/score-voices.js)', variants: [pick('three notes', note(k, false))] });
  const notes = new Set([...KINDS.notes, ...OWN_KINDS]);
  for (const k of KINDS.held) if (!notes.has(k)) out.push({ id: `instrument:${k}`, group: 'Instruments', name: `${k} (held)`, where: 'a drone or a pad of the scores', variants: [pick('a chord', note(k, true))] });
  for (const k of KINDS.hits) out.push({ id: `hit:${k}`, group: 'Instruments', name: `${k} (percussion)`, where: 'a hit of the scores\' drums', variants: [pick('hit', (s) => { const V = (s.V ??= { ctx: s.ctx, noise: s.noiseBuf }), t = s.ctx.currentTime + 0.05; for (let i = 0; i < 3; i++) hit(V, k, t + i * 0.3, 0.12, s.music); })] });
  for (const k of KINDS.colours) out.push({ id: `colour:${k}`, group: 'Instruments', name: `${k} (a world's colour)`, where: 'a world\'s own sound now and then', variants: [pick('play', (s) => { const V = (s.V ??= { ctx: s.ctx, noise: s.noiseBuf }); playColour(V, k, s.freq(0, 1), s.ctx.currentTime + 0.05, 0.6, s.music, [0, -1, -2].map((d) => s.freq(d, 1))); })] });
  return out;
}

/** Every effect, grouped (in order), with its variants. */
export const EFFECTS = [...FX, ...instrumentEntries()];
/** The groups, in the page's order. */
export const EFFECT_GROUPS = [...new Set(EFFECTS.map((x) => x.group))];
/** Every song: the recorded, the scores, the other music. */
export const SONGS = [...recordedSongs(), ...scoreSongs(), ...TUNES.map((t) => ({ ...t, where: t.where, world: t.world }))];

/** The activities a score can be heard under (src/score.js scoreBeat's act). */
export const ACTS = {
  standing: { move: 0, ride: 0, still: 0 },
  'standing a while': { move: 0, ride: 0, still: 40 },
  walking: { move: 1, ride: 0, still: 0 },
  riding: { move: 1, ride: 1, still: 0 },
  indoors: { move: 0, ride: 0, still: 0, indoor: 1 },
  night: { move: 0.5, ride: 0, still: 0, night: 1 },
  storm: { move: 0.5, ride: 0, still: 0, storm: 1 },
};

/** The text of every function in the catalogue (for the coverage test: which methods of Sound it plays). */
export function catalogueSource() {
  const fns = [...EFFECTS.flatMap((x) => x.variants.map(([, f]) => f)), ...TUNES.flatMap((t) => [t.start, t.stop, ...(t.variants ?? []).map(([, f]) => f)]).filter(Boolean)];
  return fns.map(String).join('\n');
}
