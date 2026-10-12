import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// (levels/content.js, for the errands, builds nothing at import, but its modules want a page to exist)
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
await import('./register-gadgets.js');   // (the gadgets as items: the makers' courts' boxes hold them)

const { progressBefore, seedDebugSave, worldsBefore, WORLDS, WORLD_ENDS, TANK_BANDS, opensInDebugSave } = await import('../src/debug-save.js');
const { ORDER, SIDE, partsOf } = await import('../src/levels/names.js');
const { PLACEMENTS } = await import('../src/boxes/placements.js');
const { ITEMS } = await import('../src/items.js');
const { knownWorlds } = await import('../src/story/route.js');
const { pendingCall, CALL_COUNT } = await import('../src/story/calls.js');
const { SlotStore, slotKey, DEBUG_SLOT, SLOT_COUNT } = await import('../src/save-slots.js');
const { GameState } = await import('../src/game-state.js');
const { pickHref, alongLine } = await import('../src/world-picker.js');

const SRC = path.join(path.dirname(new URL(import.meta.url).pathname), '../src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const started = (flags, world) => Object.keys(flags).some((k) => k.startsWith(`quest.${world}.`) || k.startsWith(`world.${world}.`) || k.startsWith(`temple.${world}.`) || k.startsWith(`box.${world}.`));

test('the debug save is for the route worlds only: the dev worlds, the side worlds and home keep the save being played', () => {
  for (const id of ['lab', 'home', 'references', ...SIDE]) {
    assert.equal(progressBefore(id), null, id);
    assert.equal(opensInDebugSave(id), false, id);
    assert.equal(pickHref(id), `?level=${id}`);
    assert.equal(alongLine(id), 'in your save');
  }
  for (const id of ORDER) assert.equal(pickHref(id), `?level=${id}&debugsave=1`);
  assert.match(alongLine('incal'), new RegExp(`${ORDER.indexOf('incal')} worlds done before it`));
});

test('the desert starts a new journey: past the prologue, nothing found', () => {
  const { flags, keepsakes } = progressBefore('desert');
  assert.equal(flags['prologue.done'], true);
  assert.equal(flags['ship.level'], 'desert');
  assert.equal(keepsakes.length, 0);
  assert.ok(!Object.keys(flags).some((k) => /^(item|box|quest|world)\./.test(k)), JSON.stringify(flags));
});

test('every world before the chosen one is played through, the chosen one and those after are untouched', () => {
  for (const [i, id] of ORDER.entries()) {
    const { flags, keepsakes, journal } = progressBefore(id);
    const before = ORDER.slice(0, i), after = ORDER.slice(i);
    assert.deepEqual(worldsBefore(id), before);
    for (const w of before) {
      assert.equal(flags[`world.${w}.done`], true, `${id}: ${w} done`);
      // (a merged world part by part: src/levels/names.js PARTS)
      for (const part of partsOf(w)) {
        assert.equal(flags[`world.${part}.done`], true, `${id}: ${part} done`);
        for (const q of WORLDS[part][0].QUESTS ?? []) assert.ok(['done', 'failed'].includes(flags[`quest.${q.id}`]), `${id}: quest ${q.id} over`);
        for (const p of PLACEMENTS[part] ?? []) {
          assert.equal(flags[`box.${p.id}`], true, `${id}: box ${p.id} open`);
          assert.equal(flags[`item.${p.item}`], true, `${id}: ${p.item} owned`);
          if (p.hint) assert.equal(flags[`quest.box.${p.id}`], 'done');
        }
        const T = WORLDS[part][1].QUEST;
        assert.equal(flags[`temple.${T.id.replace(/^temple\./, '')}.done`], true);
        assert.equal(flags[`quest.${T.id}`], 'done');
      }
      assert.ok(journal.stories[w] && journal.seen[w], `${id}: ${w}'s story page`);
    }
    for (const w of after) {
      for (const part of partsOf(w)) assert.ok(!started(flags, part), `${id}: nothing of ${part} yet`);
      assert.ok(!keepsakes.some((k) => k.level === w), `${id}: no keepsake of ${w}`);
      for (const p of partsOf(w).flatMap((part) => PLACEMENTS[part] ?? [])) if (!before.some((b) => partsOf(b).some((part) => (PLACEMENTS[part] ?? []).some((q) => q.item === p.item)))) assert.ok(!flags[`item.${p.item}`], `${id}: ${p.item} not yet`);
      assert.ok(!journal.seen[w]);
    }
    // the chosen world is on the ship's chart (and is where the ship last flew)
    assert.ok(knownWorlds({ order: ORDER, done: (w) => !!flags[`world.${w}.done`], visited: (w) => !!journal.seen[w], current: null }).includes(id), `${id} charted`);
    assert.equal(flags['ship.level'], id);
    if (i > 0) assert.equal(flags['ship.launched'], true);
    // the recordings: one heard per world done, none left waiting at the console
    for (let n = 1; n <= Math.min(i, CALL_COUNT); n++) assert.equal(flags[`calls.${n}`], true, `${id}: recording ${n}`);
    assert.equal(flags[`calls.${i + 1}`], undefined);
    assert.equal(pendingCall({ flag: (k) => flags[k], completed: i }), null, `${id}: nothing waiting`);
  }
});

test('the gear and the tank are what the route gave: the wings in Vael, the Warden\'s bellows in the City-Shaft (never the debug jets), a band per magical water', () => {
  assert.equal(progressBefore('arzach').flags['item.glider'], undefined);
  assert.equal(progressBefore('perdide').flags['item.glider'], true);
  assert.equal(progressBefore('perdide').flags['item.bell'], true, 'and the sky stones’ bell (Vael’s, since October 2026)');
  assert.equal(progressBefore('incal').flags['item.wardenbellows'], undefined);
  assert.equal(progressBefore('glassdunes').flags['item.wardenbellows'], true);
  assert.equal(progressBefore('glassdunes').flags['item.harness'], undefined, 'the Warden’s harness went in v1.42');
  assert.equal(progressBefore('glassdunes').flags['item.jetpack'], undefined, 'the jets anywhere: a debug item');
  assert.equal(progressBefore('glassdunes').flags['item.cabpass'], true);   // (Lio's, at the end of a City-Shaft quest: a conversation gives it)
  assert.equal(progressBefore('buried').flags['item.coil'], true, 'the Clock-House’s coil, in the Glass Dunes');
  assert.equal(progressBefore('arzach').flags['ship.powered'], true);
  assert.equal(progressBefore('perdide').flags['bird.promise'], true);
  for (const [i, id] of ORDER.entries()) {
    const { flags } = progressBefore(id);
    const bands = TANK_BANDS.filter((b) => ORDER.findIndex((w) => partsOf(w).includes(b.world)) < i);
    assert.equal(flags['tool.colours'] ?? 1, Math.min(5, 1 + bands.length), id);
    for (const [k, b] of bands.entries()) if (b.tone) assert.equal(flags['tool.tones'][2 + k], b.tone);
    assert.equal(flags['tool.empty'], undefined);
  }
});

test('Viridel’s terraces end the only way they can (failed), the errands are delivered or still carried', () => {
  const { flags, journal } = progressBefore('underwater');
  assert.equal(flags['quest.edena.terraces'], 'failed');
  assert.ok(flags['failed.edena.terraces']);
  assert.equal(flags['edena.terraces.flooded'], true);
  assert.equal(journal.errands.gear.done, true);    // the Deep Wood (Lorn) → Viridel
  assert.equal(journal.errands.seed.done, false);   // Viridel → the Underwater City (since v1.40): in the pack
  assert.equal(journal.errands.kelpjar, undefined);   // (the Underwater City gives it)
});

test('the people of each world before are met, the keepsakes are kept in route order', () => {
  const { flags, keepsakes } = progressBefore('bazaar');
  for (const id of ['ama', 'teo', 'oia', 'lio', 'sabri', 'lark']) assert.equal(flags[`met.${id}`], true, id);
  const levels = keepsakes.map((k) => ORDER.findIndex((w) => partsOf(w).includes(k.level)));
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
  assert.equal(new Set(keepsakes.map((k) => k.id)).size, keepsakes.length);
});

// ---- the grants that live in the story's code, not its data: each must be covered

const STORY_FILE = (w) => `story/${w}.js`;
/** The bodies of `quests.def(...).onDone = () => { ... };` in a file. */
const onDoneBodies = (src) => [...src.matchAll(/\.onDone = \(\) => \{([\s\S]*?)\n {2}\};/g)].map((m) => m[1]);

test('every flag a world’s quest end sets in code is in the debug save after it', () => {
  // (part by part: a merged world's parts each end their own story; the Glass Dunes' ends with its temple, below)
  for (const [i, world] of ORDER.entries()) for (const w of partsOf(world)) {
    if (i === ORDER.length - 1) continue;
    const { flags } = progressBefore(ORDER[i + 1]);
    // (the worlds whose story is their temple: the Glass Dunes, and the three promoted in v1.40)
    if (['glassdunes', 'underwater', 'moonfoundry', 'spacecity'].includes(w)) { assert.match(read(STORY_FILE(w)), new RegExp(`game\\.set\\('world\\.${w}\\.done', true\\)`), `the temple ends ${w}`); assert.equal(flags[`world.${w}.done`], true); continue; }
    const bodies = onDoneBodies(read(STORY_FILE(w)));
    assert.ok(bodies.some((b) => b.includes(`world.${w}.done`)), `${w}: its main quest's onDone found`);
    for (const body of bodies) {
      for (const m of body.matchAll(/game\.set\('([^']+)',\s*(true|false|'[^']*'|\d+)\)/g)) {
        const v = JSON.parse(m[2].replace(/^'|'$/g, '"'));
        assert.deepEqual(flags[m[1]], v, `${w}: ${m[1]} (src/story/${w}.js onDone; add it to WORLD_ENDS in src/debug-save.js)`);
      }
    }
  }
  // (and the table holds nothing the code doesn't set)
  for (const [w, set] of Object.entries(WORLD_ENDS)) for (const k of Object.keys(set)) assert.ok(read(STORY_FILE(w)).includes(`game.set('${k}', true)`), `${w}: ${k}`);
});

test('every keepsake the story code gives is kept', () => {
  const all = progressBefore('bazaar').keepsakes.map((k) => k.id);
  const last = 'bazaar';
  for (const w of ORDER.flatMap(partsOf)) {
    const src = read(STORY_FILE(w));
    const ids = [...src.matchAll(/addKeepsake\(\{\s*id:\s*'([^']+)'/g)].map((m) => m[1]);
    if (/addKeepsake\((KEEPSAKE|keepsakeFor)/.test(src)) {
      const data = WORLDS[w][0];
      ids.push((data.KEEPSAKE ?? data.keepsakeFor('yes')).id);
    }
    assert.ok(!/addKeepsake\((?!\{|KEEPSAKE|keepsakeFor)/.test(src), `${w}: an addKeepsake the test can't read`);
    for (const id of ids) if (w !== last) assert.ok(all.includes(id), `${w}: keepsake ${id}`);
  }
});

test('every magical water that colours the tank is a band, and the code grants items only from boxes', () => {
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(SRC);
  const sites = [], grants = [], gives = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'), rel = path.relative(SRC, f);   // (code, not comments)
    for (const m of src.matchAll(/emit\('tool:refill',\s*\{\s*addColour/g)) sites.push(rel);
    if (/items\.grant\(/.test(src) && rel !== 'items.js') grants.push(rel);
    for (const m of src.matchAll(/quests\.give\('([^']+)'\)/g)) if (ITEMS[m[1]]) gives.push(`${rel}: ${m[1]}`);
  }
  assert.deepEqual([...new Set(sites)].sort(), TANK_BANDS.map((b) => `story/${b.world}.js`).sort(), 'a new tank band: add it to TANK_BANDS');
  // (main.js and the dev menu: the ?items= and dev switches; the boxes: PLACEMENTS; the trials: their rewards, held in
  // a debug save since v1.58 (TRIALS); the scientist's upgrades for the fragments of the singing light: fitted as the
  // fragments of the worlds before reach them, since v1.58, issue #203)
  assert.deepEqual(grants.sort(), ['boxes/index.js', 'dev-menu.js', 'main.js', 'story/scientist-data.js', 'trials/index.js'], 'a new place that grants gear: cover it in src/debug-save.js');
  assert.deepEqual(gives, [], 'gear given in code by a quest: cover it in src/debug-save.js');
});

// ---- the save itself

test('seeding writes the debug slot only, makes it the active one, and the game reads it', () => {
  const st = mem({ 'hiraeth.slots.v': '1', 'hiraeth.slot': '2',
    [slotKey('hiraeth.game.v1', 2)]: JSON.stringify({ flags: { 'prologue.done': true, 'world.desert.done': true }, keepsakes: [] }),
    [slotKey('hiraeth.game.v1', DEBUG_SLOT)]: JSON.stringify({ flags: { stale: true }, keepsakes: [] }),
    [slotKey('hiraeth.save.v1', DEBUG_SLOT)]: JSON.stringify({ level: 'desert', pos: [0, 0, 0] }) });
  const store = new SlotStore(st);
  assert.equal(store.active, 2);
  const state = new GameState(store.view());
  assert.equal(state.flag('world.desert.done'), true);
  const before = new Map([...st.m].filter(([k]) => !k.includes(`.s${DEBUG_SLOT}.`) && k !== 'hiraeth.slot'));
  const p = seedDebugSave('buried', { store, state });
  assert.ok(p);
  assert.equal(store.active, DEBUG_SLOT);
  assert.equal(st.getItem('hiraeth.slot'), DEBUG_SLOT);
  // the player's own save is as it was
  for (const [k, v] of before) assert.equal(st.getItem(k), v, k);
  // the shared state now reads the debug save, the old debug save is gone (and its position: the world starts at its start)
  assert.equal(state.flag('world.glassdunes.done'), true);
  assert.equal(state.flag('world.buried.done'), undefined);
  assert.equal(state.flag('stale'), undefined);
  assert.equal(st.getItem(slotKey('hiraeth.save.v1', DEBUG_SLOT)), null);
  assert.equal(new GameState(store.view(DEBUG_SLOT)).flag('item.wardenbellows'), true);
  assert.ok(JSON.parse(st.getItem(slotKey('hiraeth.journal.v1', DEBUG_SLOT))).stories.incal);
  // the title's list never shows it
  assert.equal(store.list().length, SLOT_COUNT);
  assert.equal(store.latest(), 2);
  // off the route: nothing written
  assert.equal(seedDebugSave('lab', { store }), null);
});

// ---- issue #203: the debug saves in the title's Saves screen; everything in the worlds before held

test('the worlds before are complete: their trials run and rewarded, their fragments found, Anselm met and his upgrades fitted where they fit', async () => {
  const { FRAGMENTS, fragKey, fragmentCounts } = await import('../src/fragments-data.js');
  const { FRAGMENT_ITEMS } = await import('../src/items.js');
  const { TRIALS } = await import('../src/trials/data.js');
  for (const [i, id] of ORDER.entries()) {
    const { flags } = progressBefore(id);
    const before = ORDER.slice(0, i), after = ORDER.slice(i);
    for (const w of before) for (const [k] of (FRAGMENTS[w] ?? []).entries()) assert.equal(flags[fragKey(w, k)], true, `${id}: ${w}'s fragment ${k}`);
    for (const w of after) for (const [k] of (FRAGMENTS[w] ?? []).entries()) assert.equal(flags[fragKey(w, k)], undefined, `${id}: ${w}'s fragment ${k} still to find`);
    const found = fragmentCounts(flags).found;
    assert.equal(!!flags['frag.met'], found > 0, `${id}: Anselm met once there is a fragment`);
    for (const u of FRAGMENT_ITEMS) {
      const need = ITEMS[u.id].needs, fits = u.at <= found && (!need || !!flags[`item.${need}`]);
      assert.equal(!!flags[`item.${u.id}`], fits, `${id}: ${u.id} (${u.at}) ${fits ? 'fitted' : 'not yet'} at ${found}`);
    }
    for (const w of before) for (const part of partsOf(w)) {
      const T = TRIALS[part];
      if (!T) continue;
      assert.equal(flags[`trial.${T.world ?? part}.done`], true, `${id}: ${part}'s trial run`);
      if (ITEMS[T.reward] && !ITEMS[T.reward].retired) assert.equal(flags[`item.${T.reward}`], true, `${id}: ${T.reward} held`);
    }
    for (const w of after) for (const part of partsOf(w)) assert.equal(flags[`trial.${part}.done`], undefined);
  }
  // halfway along the route: the heart, the finder and the edge at least
  const mid = progressBefore('glassdunes').flags;
  for (const u of ['lightheart', 'finder', 'lightedge']) assert.equal(mid[`item.${u}`], true, u);
});

test('each world\'s debug save is a valid save: the game reads it, every item is one the game knows, nothing debug-only', () => {
  for (const id of ORDER) {
    const store = new SlotStore(mem({ 'hiraeth.slots.v': '1' }));
    const p = seedDebugSave(id, { store });
    const state = new GameState(store.view(DEBUG_SLOT));
    assert.equal(state.flag('prologue.done'), true, id);
    assert.equal(state.flag('ship.level'), id);
    for (const k of Object.keys(p.flags).filter((f) => f.startsWith('item.'))) {
      const it = ITEMS[k.slice(5)];
      assert.ok(it, `${id}: ${k} is an item`);
      assert.ok(!it.debug && !it.retired, `${id}: ${k} is no debug or retired item`);
    }
    for (const k of state.keepsakes()) assert.ok(k.id && k.name, `${id}: keepsake ${k.id}`);
    assert.doesNotThrow(() => JSON.parse(store.view(DEBUG_SLOT).getItem('hiraeth.journal.v1')));
  }
});

test('into one of the player\'s slots only when chosen: that slot alone is written and played, the debug slot left as it was', async () => {
  const { debugSlot, debugSaveHref, DEBUG_PARAM, SLOT_PARAM } = await import('../src/debug-save.js');
  assert.equal(debugSlot(2), 2); assert.equal(debugSlot('3'), 3);
  for (const v of [null, undefined, 0, 4, 'x', 'debug']) assert.equal(debugSlot(v), DEBUG_SLOT, String(v));
  assert.equal(debugSaveHref('buried'), '?level=buried&debugsave=1');
  assert.equal(debugSaveHref('buried', 2), '?level=buried&debugsave=1&debugslot=2');
  assert.deepEqual([DEBUG_PARAM, SLOT_PARAM], ['debugsave', 'debugslot']);
  const st = mem({ 'hiraeth.slots.v': '1', [slotKey('hiraeth.game.v1', 1)]: JSON.stringify({ flags: { mine: true }, keepsakes: [] }),
    [slotKey('hiraeth.game.v1', DEBUG_SLOT)]: JSON.stringify({ flags: { old: true }, keepsakes: [] }) });
  const store = new SlotStore(st);
  const keep = new Map([...st.m].filter(([k]) => !k.includes('.s2.') && k !== 'hiraeth.slot'));
  seedDebugSave('incal', { store, slot: 2 });
  assert.equal(store.active, 2);
  assert.equal(new GameState(store.view(2)).flag('world.edena.done'), true);
  for (const [k, v] of keep) assert.equal(st.getItem(k), v, `${k} untouched`);
  // (boot passes the slot from the link, then drops it)
  const boot = fs.readFileSync(path.join(SRC, 'boot.js'), 'utf8');
  assert.match(boot, /seedDebugSave\(q\.get\('level'\), \{ state: game, slot: q\.get\(SLOT_PARAM\) \}\)/);
  assert.match(boot, /q\.delete\(DEBUG_PARAM\); q\.delete\(SLOT_PARAM\);/);
});

test('the Saves screen\'s debug saves: every world of the route, marked debug, the debug slot unless one is chosen, asked before one is replaced', async () => {
  globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget();   // (ui.js reads them at import)
  const { debugSavesHtml, nextDebugInto } = await import('../src/title.js');
  const html = debugSavesHtml(DEBUG_SLOT, ORDER, true);
  assert.match(html, /Debug: start at a world/); assert.match(html, /class="dtag">debug</);
  assert.match(html, /Into: the debug save \(your saves untouched\)/);
  const worlds = [...html.matchAll(/data-debug-world="([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.deepEqual(worlds, ORDER, 'every world, in the route\'s order');
  assert.match(html, /a new journey/); assert.match(html, /1 world done before it/); assert.match(html, new RegExp(`${ORDER.length - 1} worlds done before it`));
  assert.match(debugSavesHtml(2, ORDER, true), /Into: Save 2/);
  assert.deepEqual([nextDebugInto(DEBUG_SLOT), nextDebugInto(1), nextDebugInto(SLOT_COUNT)], [1, 2, DEBUG_SLOT], 'the debug slot, then each of the player\'s, round again');
  const title = fs.readFileSync(path.join(SRC, 'title.js'), 'utf8');
  assert.match(title, /devMode\(\{ settings \}\) \? `<li class="debug-saves\$\{debugOpen \? ' open' : ''\}">\$\{debugSavesHtml\(debugInto, ORDER, debugOpen\)\}/, 'shown where src/dev-gate.js says, folded or open');
  assert.match(title, /if \(slot !== DEBUG_SLOT && !asked && !store\.summary\(slot\)\.empty\) \{ askDebug\(id, slot\); return; \}/, 'a slot holding a save: asked first');
  assert.match(title, /if \(!store\.holding\) store\.holdWrites\(\);/, 'the game behind the title writes nothing into the slot it was loading');
  assert.match(title, /debugSaveHref\(id, slot\)/);
});

// issue #227: a first-time player's Saves screen showed the whole route (ALWAYS_DEV): the section folds to one row
test('the Saves screen\'s debug section is one closed "Debug" row until chosen: no world in it or in the pad\'s path', async () => {
  globalThis.matchMedia ??= () => ({ matches: false }); globalThis.window ??= new EventTarget();
  const { debugSavesHtml, savesRows } = await import('../src/title.js');
  const shut = debugSavesHtml();
  assert.equal((shut.match(/<button/g) ?? []).length, 1, 'one row: the pad steps onto it once and no further');
  assert.match(shut, /data-a="debug-open" aria-expanded="false"/); assert.match(shut, />Debug</);
  assert.doesNotMatch(shut, /data-debug-world|thumbs\//, 'no world named or pictured');
  const open = debugSavesHtml(DEBUG_SLOT, ORDER, true);
  assert.match(open, /data-a="debug-open" aria-expanded="true"/);
  assert.equal((open.match(/<button/g) ?? []).length, ORDER.length + 2, 'opened: its head, the slot it writes and every world');
  // the pad's rows: Back, the saves, then whatever buttons the debug section holds (one while folded)
  const fake = { querySelector: (q) => (q === '[data-a="back"]' ? 'back' : null), querySelectorAll: (q) => (assert.equal(q, '.slot, .debug-saves button'), ['s1', 's2', 's3', 'debug']) };
  assert.deepEqual(savesRows(fake), ['back', 's1', 's2', 's3', 'debug']);
  const title = fs.readFileSync(path.join(SRC, 'title.js'), 'utf8');
  assert.match(title, /else if \(a === 'saves'\) \{ debugOpen = false; show\('saves'/, 'folded each time the screen opens');
  assert.match(title, /else if \(a === 'debug-open'\) \{\s*debugOpen = !debugOpen;\s*renderSaves\(\);/, 'A opens it (and folds it)');
  assert.match(title, /const rows = savesRows\(savesEl\);/);
});
