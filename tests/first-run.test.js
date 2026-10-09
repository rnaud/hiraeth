import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quietFirstRun, isFreshProfile, hasAnySave, SEEN_KEY } from '../src/first-run.js';
import { devMode, DEV_KEY, ALWAYS_DEV } from '../src/dev-gate.js';
import { verbKey } from '../src/prompt-keys.js';
import { PAD } from '../src/bindings.js';
import { FirstSteps, LOOK, JUMP, TAUGHT } from '../src/first-steps.js';
import { NUDGE, nudgeText, nudgeDue } from '../src/ship/prologue.js';

const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('a brand-new profile is not greeted with "Updated to": the version is marked seen, silently', () => {
  assert.match(src('src/changelog.js'), new RegExp(`SEEN_KEY = '${SEEN_KEY.replace(/\./g, '\\.')}'`), 'the same key the changelog reads');
  const fresh = mem();
  assert.equal(isFreshProfile(fresh), true);
  assert.equal(quietFirstRun(fresh, '0.97'), true);
  assert.equal(fresh.getItem(SEEN_KEY), '0.97', 'seen: Changelog.fresh is false, no toast');
  assert.equal(quietFirstRun(fresh, '0.98'), false, 'only once: the next version is an update');
  // coming from an older version: the toast still shows
  const old = mem({ [SEEN_KEY]: '0.95' });
  assert.equal(quietFirstRun(old, '0.97'), false);
  assert.equal(old.getItem(SEEN_KEY), '0.95');
  // never seen a version, but a save: an update from before the seen mark (or a cleared mark)
  for (const key of ['moebius.s2.game.v1', 'moebius.s1.save.v1', 'moebius.game.v1']) {
    const saved = mem({ [key]: '{}' });
    assert.equal(hasAnySave(saved), true, key);
    assert.equal(quietFirstRun(saved, '0.97'), false, key);
    assert.equal(saved.getItem(SEEN_KEY), null);
  }
  // the debug slot is not a player's save
  assert.equal(hasAnySave(mem({ 'moebius.sdebug.game.v1': '{}' })), false);
  assert.equal(quietFirstRun(null, '0.97'), false, 'no storage: nothing to do');
  // boot runs it before the title (which writes a save on New game)
  const boot = src('src/boot.js');
  assert.ok(boot.indexOf('quietFirstRun(') > 0 && boot.indexOf('quietFirstRun(') < boot.indexOf('await showTitle()'));
});

test('the debug entries are the author’s: the Developer panel setting, a dev build or ?dev=1', () => {
  const s = mem();
  assert.equal(devMode({ storage: s, search: '', dev: false }), ALWAYS_DEV, 'ALWAYS_DEV: everyone, for now');
  assert.equal(devMode({ always: false, storage: s, search: '', dev: false }), false, 'a player sees none');
  assert.equal(devMode({ always: false, storage: s, search: '', dev: false, settings: { devPanel: true } }), true, 'the Developer panel');
  assert.equal(devMode({ always: false, storage: s, search: '', dev: true }), true, 'a dev build');
  assert.equal(devMode({ always: false, storage: s, search: '?dev=1', dev: false }), true, '?dev=1');
  assert.equal(s.getItem(DEV_KEY), '1');
  assert.equal(devMode({ always: false, storage: s, search: '', dev: false }), true, 'remembered on the device');
  assert.equal(devMode({ always: false, storage: s, search: '?dev=0', dev: false }), false, '?dev=0 forgets it');
  assert.equal(devMode({ always: false, storage: s, search: '', dev: false }), false);
  // the title's Debug button and the Start menu's entry go through it
  const title = src('src/title.js'), ui = src('src/ui.js');
  assert.match(title, /devMode\(\{ settings \}\) \? `<button data-a="debug">\$\{t\('title\.debug'\)\}<\/button>` : ''/);
  assert.match(title, /a === 'debug' && devMode\(/);
  assert.match(ui, /<button data-a="debug" data-dev hidden>\$\{t\('menu\.debug'\)\}<\/button>/);
  assert.match(ui, /for \(const b of el\.querySelectorAll\('\[data-dev\]'\)\) b\.hidden = !dev;/);
  assert.match(ui, /a === 'debug' && devMode\(/);
  assert.match(src('docs/systems/ui.md'), /src\/dev-gate\.js/, 'documented');
});

test('teaching prompts name the input in your hands; on a pad the gun’s mode is the D-pad, never X', () => {
  assert.equal(verbKey('mode', 'pad'), PAD.mode);
  assert.doesNotMatch(verbKey('mode', 'pad'), /X/);
  assert.equal(verbKey('mode', 'keys'), 'X');
  assert.equal(verbKey('aim', 'pad'), PAD.aim);
  assert.equal(verbKey('jump', 'pad'), PAD.jump);
  assert.equal(verbKey('look', 'pad'), 'the right stick');
  assert.equal(verbKey('look', 'keys'), 'the mouse');
  assert.equal(verbKey('move', 'touch'), 'the stick on the left');
  assert.match(src('src/story/desert.js'), /export function filledText\(kind = inputKind\(\)\)/);
  assert.doesNotMatch(src('src/story/desert.js'), /switch the gun to push with X or the D-pad/);
});

test('the pool’s first fill and the chest’s dregs name the buttons as the player holds them', async () => {
  globalThis.document ??= undefined;
  const { filledText, dregsText } = await import('../src/story/desert.js');
  assert.match(filledText('pad'), /switch the gun to push with D-pad ← \/ →/);
  assert.match(filledText('pad'), /aim with LT \/ L2, then RT \/ R2/);
  assert.match(filledText('keys'), /push with X,/);
  assert.match(dregsText('pad'), /One shot\. Aim with LT \/ L2, then RT \/ R2\./);
});

test('the ship’s walk: one quiet nudge after 20 s with the message unplayed, then never again', () => {
  assert.equal(NUDGE.after, 20);
  assert.equal(nudgeDue(5), false);
  assert.equal(nudgeDue(20), true);
  assert.equal(nudgeDue(25, { played: true }), false, 'not once the message plays');
  assert.equal(nudgeDue(40, { shown: true }), false, 'once');
  const keys = (v) => verbKey(v, 'pad');
  assert.equal(nudgeText({ moved: false, keys }), 'Look around: move with the left stick, look with the right stick');
  assert.match(nudgeText({ moved: true, keys }), /message blinks on the cockpit dash/);
  assert.equal(nudgeText({ moved: false, keys: (v) => verbKey(v, 'keys') }), 'Look around: move with WASD, look with the mouse');
  const c = src('src/ship/cinematics.js');
  assert.match(c, /nudgeDue\(this\.walkT/);
  assert.match(c, /C\.hint\(null\)/, 'and it goes');
});

test('the desert’s first steps: look and jump, each said once, only if not used yet', () => {
  const flags = {}, state = { flag: (k) => flags[k], set: (k, v) => { flags[k] = v; } };
  let s = new FirstSteps(state, { kind: 'keys' });
  const run = (sec, o) => { let last = ''; for (let t = 0; t < sec; t += 0.1) { const l = s.update(0.1, o); if (l) last = l; } return last; };
  assert.equal(run(LOOK.after - 0.5, { active: true }), '', 'a moment to find it alone');
  assert.equal(run(1, { active: true }), 'Look around with the mouse');
  assert.equal(flags[TAUGHT.look], true);
  run(LOOK.show + 0.5, { active: true });
  assert.equal(s.update(0.1, { active: true }), '', 'gone');
  assert.equal(run(5, { active: true, moved: JUMP.walk / 100 }), '', 'not before a walk');
  assert.equal(run(6, { active: true, moved: JUMP.walk / 100 }), 'Jump with SPACE');
  run(10, { active: true, moved: 1 });
  assert.equal(s.update(0.1, { active: true, moved: 1 }), '');
  assert.equal(s.done, true);
  // used first: never said
  for (const k of Object.keys(flags)) delete flags[k];
  s = new FirstSteps(state, { kind: 'pad' });
  s.looked(); s.jumped();
  assert.equal(run(60, { active: true, moved: 1 }), '');
  // nothing while not active (a talk, the ship, a menu)
  for (const k of Object.keys(flags)) delete flags[k];
  s = new FirstSteps(state, { kind: 'pad' });
  assert.equal(run(30, { active: false }), '');
  assert.equal(run(LOOK.after + 0.2, { active: true }), 'Look around with the right stick');
});
