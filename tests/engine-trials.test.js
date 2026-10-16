// Issue #264: the trials and the games in the engines (engine/trials.js, docs/systems/engine-bridge.md "The trials and
// games"). engine/game.js makes a world's challenges (its trial, its makers' runs), the signs of the games played on their
// own pages and every sign's host, as main.js does; a host's Play opens the runner (src/minigames/kit/runner.js) here, or
// asks the engine for the game's page (createGame({ game }), the Sunken Hall's among them). The runner's card is
// engine/menus.js's 'card' (BridgeMenu.cs draws it), its HUD the screen's 'minigame' (BridgeHud.cs). The Sunken Hall keeps
// the author's controls (535f87f9a): B / ○ rolls, no jump.
// engine/game.js in a bare V8 context (the bundle the engines run), the menus the engines' own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

globalThis.matchMedia ??= () => ({ matches: false });
globalThis.window ??= new EventTarget();
const { EngineMenus } = await import('../engine/menus.js');


const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const run = (g, frames, keys = {}) => quietly(() => { for (let i = 0; i < frames; i++) { for (const [k, v] of Object.entries(keys)) g.key(k, v); g.frame(1 / 30); } });
const plain = (x) => JSON.parse(JSON.stringify(x));   // (the VM's objects, as plain ones: another realm's prototypes)
const tap = async (g, code) => { g.key(code, true); await run(g, 1); g.key(code, false); await run(g, 1); };

let B = null;
async function load() {
  if (B) return B;
  const file = tempPath(join(tmpdir(), `hiraeth-engine-trials-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  B = loadBundle(file, { pads: () => [] });
  return B;
}
/** Beside a person (their front, 1.6 m out), facing them. */
function beside(g, n) {
  const V = n.pos.constructor, dir = new V(Math.sin(n.heading ?? 0), 0, Math.cos(n.heading ?? 0));
  const p = n.pos.clone().addScaledVector(dir, 1.6);
  g.player.teleport(p, new V(0, 1, 0), new V(0, 0, 1));
  g.player.heading = Math.atan2(n.pos.x - p.x, n.pos.z - p.z);
  g.rig.yaw = g.player.heading + Math.PI;
}
/** Talk to them (E) and take their Play (the host's talk: its lines, then Play / Not now). */
async function play(g, n, done) {
  beside(g, n);
  await run(g, 3);
  await tap(g, 'KeyE');
  const d = g.story.dialogue;
  assert.ok(d.open, `talking to ${n.def.id}`);
  for (let i = 0; i < 20 && d.open; i++) {
    const S = g.screen().state.dialogue;
    const c = S?.choices ?? [];
    if (S?.done && c.length) { const p = c.find((x) => /^Play/.test(x.text)); assert.ok(p, `${n.def.id} offers Play: ${c.map((x) => x.text)}`); d.choose(p.index); } else d.next();
    await run(g, 2);
  }
  assert.ok(!d.open, 'the talk over');
  // (Play once the talk has closed: the story's `later`, on the page's clock)
  for (let i = 0; i < 30 && !done(); i++) { await new Promise((r) => setTimeout(r, 10)); await run(g, 1); }
}

test('readHref reads a game page\'s address', async () => {
  const { readHref } = (await load()).exports;
  assert.deepEqual(plain(readHref('?game=fight-desert&from=desert')), { game: 'fight-desert', from: 'desert', level: null, back: null });
  assert.equal(readHref('?level=perdide').level, 'perdide');
});

test('a world\'s trials, its games\' signs and their hosts in the engine; a makers\' run played on its card and HUD (issue #264)', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const went = [];
  const g = await quietly(() => X.createGame({ levelId: 'desert', backend, menus, onGame: (h) => went.push(h) }));
  // the desert's trial and makers' run, as main.js makes them
  assert.deepEqual(plain(g.trials.challenges.list.map((w) => w.trial.id).sort()), ['kit-desert', 'trial-desert']);
  // every sign has its host, stood by the story: the trial's, the games' (the Sunken Hall's Wafa by its door)
  const hosts = new Set(g.npcs.map((n) => n.def?.id).filter((id) => /^host\./.test(id ?? '')));
  for (const id of ['host.trial-desert', 'host.fight-desert', 'host.canyon', 'host.fishing', 'host.rings']) assert.ok(hosts.has(id), `${id} stands by the sign`);
  X.items.grant('backpack'); X.items.grant('gun');
  await run(g, 2);

  // a game's host: Play asks the engine for the game's page (?game=<id>&from=desert), as the page goes there
  await play(g, g.npcs.find((n) => n.def?.id === 'host.fight-desert'), () => went.length > 0);
  assert.deepEqual(went, ['?game=fight-desert&from=desert']);
  assert.ok(!g.trials.running, 'nothing runs here: the engine starts again on the game');

  // the makers' run: its card, the menus' 'card' (the world held under it)
  assert.ok(g.trials.open('kit-desert'));
  await run(g, 2);
  assert.equal(menus.mode, 'card');
  const card = menus.view().card;
  assert.equal(card.kind, 'intro');
  assert.equal(card.title, 'Wind hall');
  assert.ok(card.rules.includes('The makers’ mark'), card.rules);
  assert.ok(card.rows.length >= 3 && card.rows.every(([k, v]) => k && v && !/\{key:/.test(k + v)), JSON.stringify(card.rows));
  assert.deepEqual(plain(card.buttons.map((b) => [b.act, !!b.on])), [['start', true], ['quit', false]], 'Start picked');
  assert.ok(g.minigameOn);
  // Start (Enter): the 3-2-1, the HUD the screen's 'minigame'
  menus.key('Enter');
  await run(g, 2);
  assert.equal(menus.mode, null, 'the card let go');
  const S = g.screen().state;
  assert.equal(g.trials.runner.phase, 'count');
  assert.equal(S.minigame?.count?.text, '3');
  assert.ok(S.minigame.timer && S.minigame.timer.run === false, JSON.stringify(S.minigame));
  await run(g, 80, { KeyW: true });
  g.key('KeyW', false);
  assert.equal(g.trials.runner.phase, 'play');
  assert.equal(S.minigame.on, true);
  assert.equal(S.minigame.timer.run, true);
  assert.match(S.minigame.score, /^gate \d \/ \d/);
  // Esc pauses (not the Start menu): Resume, Retry, Quit; B / ○ resumes
  await tap(g, 'Escape');
  assert.equal(menus.mode, 'card');
  assert.deepEqual(plain(menus.view().card.buttons.map((b) => b.act)), ['resume', 'retry', 'quit']);
  assert.equal(S.minigame.timer.run, false, 'the clock stopped');
  menus.action('back');
  await run(g, 2);
  assert.equal(menus.mode, null);
  assert.equal(g.trials.runner.paused, false);
  // the pad: Menu pauses; down twice to Quit, A / ×: the run is left, here in the world
  await tap(g, 'Escape');
  menus.navigate(0, 1); menus.navigate(0, 1);
  assert.equal(menus.view().card.buttons.find((b) => b.on)?.act, 'quit');
  menus.action('confirm');
  await run(g, 2);
  assert.equal(menus.mode, null);
  assert.ok(!g.trials.running, 'left');
  assert.equal(S.minigame, null, 'its HUD gone');
});

test('the Sunken Hall on its own page in the engine: its card, B / ○ rolls and no jump (535f87f9a), Quit back to the desert', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const left = [];
  const g = await quietly(() => X.createGame({ levelId: 'desert', game: 'fight-desert', from: 'desert', backend, menus, onLeave: (h) => left.push(h) }));
  assert.equal(g.level.id, 'arena', 'the hall, built under its host\'s id');
  await run(g, 2);
  assert.equal(menus.mode, 'card');
  const card = menus.view().card;
  assert.equal(card.title, 'The Sunken Hall');
  assert.ok(card.rows.some(([, v]) => v === 'roll'), 'a roll');
  assert.ok(!card.rows.some(([k, v]) => /jump/i.test(`${k} ${v}`)), `no jump: ${JSON.stringify(card.rows)}`);
  menus.key('Enter');
  await run(g, 90);
  assert.equal(g.trials.runner.phase, 'play');
  assert.equal(g.tool.blade?.roll?.duration > 0, true, 'the blade\'s dodge is the roll');
  // Space and the pad's jump do nothing here: the session takes them before the traveller reads them
  const y0 = g.player.pos.y;
  await run(g, 10, { Space: true });
  g.key('Space', false);
  assert.ok(Math.abs(g.player.pos.y - y0) < 0.05, `no jump (${y0} → ${g.player.pos.y})`);
  // issue #368 in the engine: the wave's foes come up out of the springs, and a cut lays its crescent (what it hits)
  const S = g.trials.runner.session;
  let seen = 0;
  for (let i = 0; i < 60 && !seen; i++) { await run(g, 2); seen = S.run.standing; }
  assert.ok(seen >= 1, `the first wave up (${JSON.stringify(plain(S.run))})`);
  let u = 0;
  g.key('KeyF', true); await run(g, 1); g.key('KeyF', false);
  for (let i = 0; i < 30 && !(u >= 1); i++) { await run(g, 1); u = Math.max(u, g.tool.blade.slash?.u ?? 0); }
  assert.ok(u > 0.5, `the crescent laid (${u})`);
  assert.equal(g.tool.blade.arc?.drawn?.reach ?? g.tool.blade.slash?.reach, g.tool.blade.wide.reach);
  // the run over: the results card (the time big, the lines, a prize's html as plain lines), Retry first, then Quit
  g.trials.runner.ctx.finish({ lines: ['Rooms cleared 4 of 4'], html: '<div class="trial-reward"><p class="kicker">Yours: the Ember colours</p><p>For your backpack &amp; sword.</p></div>' });
  await run(g, 60);
  assert.equal(menus.mode, 'card');
  const res = menus.view().card;
  assert.equal(res.kind, 'results');
  assert.match(res.big, /^\d+\.\d\d$/);
  assert.equal(res.extra, 'Yours: the Ember colours\nFor your backpack & sword.');
  assert.deepEqual(plain(res.buttons.map((b) => [b.act, !!b.main, !!b.on])), [['retry', true, true], ['quit', false, false]]);
  assert.equal(g.screen().state.minigame.on, false, 'the clock gone under the results');
  // Quit: back to the world it was entered from
  menus.navigate(0, 1);
  menus.action('confirm');
  await run(g, 1);
  assert.deepEqual(left, ['?level=desert']);
});

// the other worlds' fight temples (issue #341: the Wind Cloister, the Drowned Mill, the Pour Floor) on the same runner:
// their card, the roll and no jump, a wave up out of the springs, their hazard's lanes coming and hurting, Quit home
for (const [world, id, name, kind] of [['arzach', 'fight-arzach', 'The Wind Cloister', 'gust'], ['perdide', 'fight-perdide', 'The Drowned Mill', 'stone'], ['moonfoundry', 'fight-moonfoundry', 'The Pour Floor', 'pour'], ['edena', 'fight-edena', 'The Seed Vault', 'bloom'], ['incal', 'fight-incal', 'The Lift Depot', 'drop'], ['buried', 'fight-buried', 'The Tooth Gallery', 'cart'], ['bazaar', 'fight-bazaar', 'The Back Rooms', 'toll']]) {
  test(`${name} on its own page in the engine: its card, the roll, a wave, its ${kind}, Quit back to ${world}`, async () => {
    const { exports: X } = await load();
    const menus = new EngineMenus({});
    const left = [];
    const g = await quietly(() => X.createGame({ levelId: world, game: id, from: world, backend, menus, onLeave: (h) => left.push(h) }));
    await run(g, 2);
    assert.equal(menus.mode, 'card');
    const card = menus.view().card;
    assert.equal(card.title, name);
    assert.ok(card.rows.some(([, v]) => v === 'roll') && !card.rows.some(([k, v]) => /jump/i.test(`${k} ${v}`)), 'B rolls, no jump');
    menus.key('Enter');
    await run(g, 90);
    assert.equal(g.trials.runner.phase, 'play');
    const S = g.trials.runner.session;
    let seen = 0;
    for (let i = 0; i < 60 && !seen; i++) { await run(g, 2); seen = S.run.standing; }
    assert.ok(seen >= 1, `the first wave up (${JSON.stringify(plain(S.run))})`);
    // the second room's hazard, begun under him: it comes, runs and is gone
    const def = g.trials.runner.def.table, room = def.rooms[1];
    const lane = room.hazard.lanes?.[0] ?? (kind === 'drop' ? { spot: [(room.x[0] + room.x[1]) / 2, (room.z[0] + room.z[1]) / 2] } : { sign: room.hazard.signs[0] });
    assert.equal(room.hazard.kind, kind);
    S.hazards.start(1, lane);
    assert.equal(S.hazards.active, 1);
    await run(g, 30);
    assert.equal(plain(S.hazards.list)[0].kind, kind);
    await run(g, 240);
    assert.equal(S.hazards.active, 0, 'and gone');
    g.trials.runner.ctx.finish({ lines: ['Rooms cleared 4 of 4'] });
    await run(g, 60);
    assert.equal(menus.view().card.kind, 'results');
    menus.navigate(0, 1);
    menus.action('confirm');
    await run(g, 1);
    assert.deepEqual(left, [`?level=${world}`]);
  });
}

test('a game that drives (the ring race) moves the traveller itself in the engine', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: 'desert', game: 'rings', from: 'desert', backend, menus }));
  await run(g, 2);
  assert.ok(g.trials.drives);
  menus.key('Enter');
  await run(g, 90);
  const p0 = g.player.pos.clone();
  await run(g, 30, { Space: true });
  assert.ok(g.player.pos.distanceTo(p0) > 1, 'flown');
  assert.match(g.screen().state.minigame.score, /^Ring 1 \/ 20/);
});

test('a game that drives shows its own camera under its start card (Cistern channels: the court from above, not the follow camera)', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: 'desert', game: 'cistern', from: 'desert', backend, menus }));
  await run(g, 3);
  assert.equal(menus.mode, 'card', 'the start card up');
  assert.ok(g.trials.drives);
  const cam = g.camera.position;
  assert.ok(cam.y - g.player.pos.y > 40, `high over the court (${(cam.y - g.player.pos.y).toFixed(1)} m over the traveller)`);
  assert.ok(Math.abs(g.camera.fov - 44) < 0.1, `the game's field of view (${g.camera.fov})`);
});

test('the Canyon run steered into its walls goes on (a wall\'s sand burst read the heading before it was made)', async () => {
  const { exports: X } = await load();
  const menus = new EngineMenus({});
  const g = await quietly(() => X.createGame({ levelId: 'desert', game: 'canyon', from: 'desert', backend, menus }));
  await run(g, 3);
  menus.key('Enter');
  const warn = console.warn, failed = [];
  console.warn = (...a) => { if (/failed/.test(String(a[0]))) failed.push(String(a[1] ?? a[0]).slice(0, 200)); };
  try { for (let i = 0; i < 400; i++) { g.key('KeyW', true); g.key('KeyA', i > 60); g.frame(1 / 30); } } finally { console.warn = warn; }
  assert.deepEqual(failed, []);
});

test('the menus\' card: options left and right, the buttons up and down, Menu its start (engine/menus.js)', () => {
  const calls = [];
  const runner = {
    cardV: 1, phase: 'intro',
    cardModel: { kind: 'intro', title: 'Kite', options: [{ id: 'level', label: 'Difficulty', choices: [{ label: 'Easy', on: true }, { label: 'Hard', on: false }] }], buttons: [{ act: 'start', label: 'Start', main: true }, { act: 'quit', label: 'Quit' }] },
    act: (a) => calls.push(['act', a]), padAction: (n) => calls.push(['pad', n]), stepCardOption: (id, d) => { calls.push(['opt', id, d]); runner.cardV++; },
  };
  const m = new EngineMenus({});
  m.openCard(runner);
  assert.equal(m.view().card.buttons[0].on, true, 'on its main button');
  m.navigate(0, -1);
  assert.equal(m.view().card.options[0].on, true);
  m.navigate(1, 0);
  assert.deepEqual(calls.at(-1), ['opt', 'level', 1]);
  assert.equal(m.view().card.options[0].on, true, 'kept on the option it changed');
  m.navigate(0, 1); m.navigate(0, 1);
  m.action('confirm');
  assert.deepEqual(calls.at(-1), ['act', 'quit']);
  m.action('start');
  assert.deepEqual(calls.at(-1), ['pad', 'start']);
  m.key('Enter');
  assert.deepEqual(calls.at(-1), ['act', 'start'], 'Enter is the main button');
  m.key('KeyR');
  assert.deepEqual(calls.at(-1), ['act', 'start'], 'no Retry on a start card');
});
