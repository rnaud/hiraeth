// Rumours (issue #340, src/story/rumours.js): the people outside the quests often tell of something near them not found
// yet (a fragment of the singing light, a game's host, a place to stop for), in their world's voice; the Map shows a
// soft circle round it, never centred on it, until it is found. Told once, three open at most a world, saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rumours, RUMOUR, rumourArea, rumourLine, rumourTargets, fragmentWhere, levelSights, tellsRumours, toldKey, seenKey } from '../src/story/rumours.js';
import { RUMOUR_LINES, RUMOUR_OBJECT_LINES, RUMOUR_FIGHT_LINES } from '../src/story/rumours-data.js';
import { RUMOUR_PLACES, RUMOUR_KINDS } from '../src/story/rumour-places.js';
import { FRAGMENTS } from '../src/fragments-data.js';
import { HOSTS } from '../src/story/hosts-data.js';
import { ORDER } from '../src/levels/names.js';
import { TONES, parseLine } from '../src/story/tone.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { mapMarks } from '../src/world-map.js';

const WORLDS = Object.keys(FRAGMENTS);
const fakeGame = (flags = {}) => {
  const events = [];
  return { data: { flags }, events, flag(k) { return this.data.flags[k]; }, set(k, v) { this.data.flags[k] = v; }, emit(e, d) { events.push([e, d]); } };
};
/** A level as the rumours read one: its sights (a numbered row too), beacons, a temple, the ship. */
const level = (world) => {
  const f = FRAGMENTS[world];
  const sights = [
    { name: 'the window in the sand (the square below)', at: [f[0][0] + 80, f[0][1], f[0][2] + 60] },
    { name: 'a stone that rises (2)', at: [f[3][0] - 90, f[3][1], f[3][2]] },
    { name: 'a stone that rises (3)', at: [f[3][0] - 95, f[3][1], f[3][2] + 9] },
    { name: 'the Balcony’s railing over the void at the far end', at: [f[9][0] + 140, f[9][1], f[9][2] - 70] },
  ];
  return { sights: () => sights, beacons: [{ name: 'the lamp chain under the stack', top: [f[12][0], f[12][1] + 40, f[12][2] + 200] }], temples: [{ def: { name: 'The Rose House' }, outside: { door: { at: { x: f[5][0] - 300, y: 0, z: f[5][2] } } } }], ship: { pos: { x: f[6][0] + 20, y: f[6][1], z: f[6][2] + 20 } } };
};
const longestHost = Object.values(HOSTS).filter((h) => !h.object).sort((a, b) => (b.name + b.title).length - (a.name + a.title).length)[0];
const longestFight = Object.entries(HOSTS).filter(([id]) => id.startsWith('fight-')).sort(([, a], [, b]) => (b.name + b.title).length - (a.name + a.title).length)[0];
const anObject = Object.values(HOSTS).find((h) => h.object);

test('every route world has its lines, and every fragment its place in the people’s words', () => {
  for (const w of ORDER.filter((id) => FRAGMENTS[id])) assert.ok(RUMOUR_LINES[w], `${w} has rumour lines`);
  for (const w of WORLDS) {
    const L = RUMOUR_LINES[w];
    for (const k of ['fragment', 'host', 'sight']) assert.ok(L[k].length >= 2, `${w}: two ${k} lines at least`);
    assert.equal(RUMOUR_PLACES[w]?.length, FRAGMENTS[w].length, `${w}: a place for every fragment`);
    for (const e of RUMOUR_PLACES[w]) {
      if (e.startsWith('=')) assert.ok(RUMOUR_KINDS[e.slice(1)], `${w}: a known kind of place: ${e}`);
      else assert.doesNotMatch(e, /\d|#|\(|metre|\bm up\b/, `${w}: said as a local would, no numbers or notes: ${e}`);
    }
  }
});

test('every line has a tone, fills in whole and fits 120 characters, in every world, for every fragment', () => {
  for (const w of WORLDS) {
    const L = level(w), lands = [...levelSights(L), { name: 'the lamp chain under the stack', at: { x: 0, y: 0, z: 0 } }];
    for (const tpl of [...RUMOUR_LINES[w].fragment, ...RUMOUR_LINES[w].host, ...RUMOUR_LINES[w].sight, ...RUMOUR_OBJECT_LINES, ...(RUMOUR_FIGHT_LINES[w] ?? RUMOUR_FIGHT_LINES.any)]) {
      const p = parseLine(tpl);
      assert.ok(p.explicit && TONES.includes(p.tone), `${w}: a tone: ${tpl}`);
    }
    const targets = rumourTargets({ world: w, sights: levelSights(L), hosts: [
      { id: longestHost.id, name: longestHost.name, title: longestHost.title, at: [0, 0, 0] },
      { id: 'host.post', name: anObject?.name ?? 'The makers’ post', title: '', object: true, at: [60, 0, 0] },
      { id: `host.${longestFight[0]}`, name: longestFight[1].name, title: longestFight[1].title, fight: 'The Sunken Hall', at: [-60, 0, 0] },
    ] });
    for (const t of targets) for (let seed = 0; seed < 3; seed++) for (const from of [{ x: t.at.x + 300, y: 0, z: t.at.z - 200 }, { x: t.at.x + 10, y: 0, z: t.at.z }]) {
      const s = rumourLine(w, t, { from, landmarks: lands, seed });
      const p = parseLine(s);
      assert.ok(p.explicit && TONES.includes(p.tone), `${w} ${t.key}: toned`);
      assert.ok(p.text.length <= RUMOUR.maxLength, `${w} ${t.key}: ${p.text.length} characters: ${p.text}`);
      assert.doesNotMatch(p.text, /[{}]|,[.!?,]|\s,|\s\s/, `${w} ${t.key}: filled in cleanly: ${p.text}`);
      if (t.kind === 'sight') assert.ok(p.text.toLowerCase().includes(t.place.toLowerCase()), 'names the place');
      if (t.kind === 'host' && !t.host.object) assert.ok(p.text.includes(t.host.name), 'names the host');
    }
  }
  // (a fragment's own place is said as written; one of several alike, a ribcage, a tower of pods, takes its landmark)
  const t0 = rumourTargets({ world: 'desert' })[0];
  assert.ok(rumourLine('desert', t0, { seed: 0 }).includes(RUMOUR_PLACES.desert[t0.i].replace(/\+$/, '')), 'its own place, as written');
  const ribs = RUMOUR_PLACES.desert.indexOf('inside a ribcage+');
  const where = fragmentWhere('desert', ribs, { x: 0, y: 0, z: 0 }, { landmarks: [{ name: 'the salt pan', at: { x: 0, y: 0, z: 100 } }] });
  assert.equal(where[0], 'inside a ribcage north of the salt pan', 'one of several alike (issue #550: every fragment on its place) says which way it lies');
  assert.deepEqual(levelSights(level('desert')).map((s) => s.name).slice(0, 2), ['the window in the sand', 'a stone that rises'], 'a numbered row is one place, its note left off');
});

test('the circle holds the thing, and is never centred on it', () => {
  for (const w of WORLDS) for (const t of rumourTargets({ world: w, sights: levelSights(level(w)) })) {
    const a = rumourArea(`${w}.${t.key}`, t.at), d = Math.hypot(a.x - t.at.x, a.z - t.at.z);
    assert.ok(a.r >= RUMOUR.radius[0] && a.r <= RUMOUR.radius[1], `${w} ${t.key}: ${a.r.toFixed(1)} m across`);
    assert.ok(d < a.r * 0.75, `${w} ${t.key}: inside its circle (${d.toFixed(1)} of ${a.r.toFixed(1)} m)`);
    assert.ok(d >= a.r * RUMOUR.offset[0] - 1e-9 && d >= 9, `${w} ${t.key}: not at its middle (${d.toFixed(1)} m off)`);
    assert.deepEqual(rumourArea(`${w}.${t.key}`, t.at), a, 'the same circle every time');
  }
});

test('rumours point at real things not found yet, near the speaker first, once each, three open at most', () => {
  const w = 'desert', flags = {}, game = fakeGame(flags);
  // (the first five fragments found already)
  for (let i = 0; i < 5; i++) flags[`frag.${w}.${i}`] = true;
  let roll = 0;
  const rng = () => [0, 0.1, 0.4][roll++ % 3];   // (the chance passes; a kind and a pick)
  const r = new Rumours({ world: w, game, level: level(w), rng });
  const sefa = { id: 'sefa', name: 'Sefa', talk: { listen: ['~happy~ Hello.'] } };
  const at = { x: FRAGMENTS[w][8][0] + 50, y: 0, z: FRAGMENTS[w][8][2] };
  const told = [];
  for (let k = 0; k < 3; k++) {
    const line = r.offer(sefa, at);
    assert.ok(line, 'a rumour');
    assert.ok(parseLine(line).text.length <= 120);
    told.push(...r.active().map((t) => t.key).filter((x) => !told.includes(x)));
  }
  assert.equal(r.active().length, 3);
  assert.equal(r.offer(sefa, at), null, 'three open: no more');
  for (const key of told) {
    const t = r.targets().find((x) => x.key === key);
    assert.ok(t && !t.found, `${key}: a real thing, not found`);
    if (t.kind === 'fragment') assert.ok(t.i >= 5, 'never a fragment already found');
    assert.equal(flags[toldKey(w, key)], 'Sefa', 'saved, with who said it');
  }
  assert.equal(new Set(told).size, 3, 'never the same twice');
  const first = r.targets().find((t) => t.key === told[0]);
  assert.ok(Math.hypot(first.at.x - at.x, first.at.z - at.z) <= RUMOUR.near, 'near the speaker');
  assert.deepEqual(game.events.filter(([e]) => e === 'rumour').length, 3);
  assert.equal(r.closed(), r.targets().find((t) => t.key === told[2]).label, 'the toast: what was told');
  assert.equal(r.closed(), null, 'once');
  // (not every time)
  const r2 = new Rumours({ world: w, game: fakeGame(), level: level(w), rng: () => 0.9 });
  assert.equal(r2.offer(sefa, at), null);
  // (who tells them: the people who only talk and the keepers; never an alien, a host, a quest person)
  assert.ok(tellsRumours(sefa) && tellsRumours({ id: 'haddu', rumourNode: 'again', talk: { nodes: {} } }));
  for (const p of [{ id: 'a', species: 'drifter', talk: { listen: ['~happy~ …'] } }, { id: 'host.x', host: true, talk: { listen: ['~happy~ …'] } }, { id: 'q', talk: { nodes: { a: { say: '~happy~ Hi.' } } } }]) assert.ok(!tellsRumours(p));
  // (nowhere it has no lines)
  assert.equal(new Rumours({ world: 'home', game: fakeGame(), level: {}, rng: () => 0 }).offer(sefa, at), null);
});

test('found, a rumour clears from the map; the save keeps what was told', () => {
  const w = 'glassdunes', flags = {}, game = fakeGame(flags), L = level(w);
  const hosts = [{ id: 'host.ski', name: 'Pell', title: 'who waxes the sledges', at: { x: FRAGMENTS[w][2][0] + 40, y: FRAGMENTS[w][2][1], z: FRAGMENTS[w][2][2] } }];
  const r = new Rumours({ world: w, game, level: L, hosts, rng: () => 0 });
  // (told by hand: a fragment, the host, a place)
  const sight = r.targets().find((t) => t.kind === 'sight');
  for (const key of ['frag.4', 'host.host.ski', sight.key]) game.set(toldKey(w, key), 'Wim');
  assert.deepEqual(r.marks().map((m) => m.key).sort(), ['frag.4', 'host.host.ski', sight.key].sort());
  for (const m of r.marks()) {
    assert.equal(m.kind, 'rumour'); assert.equal(m.by, 'Wim');
    assert.ok(Math.hypot(m.x - m.target.x, m.z - m.target.z) < m.r, 'the circle holds it');
  }
  // the fragment taken
  game.set(`frag.${w}.4`, true);
  assert.ok(!r.marks().some((m) => m.key === 'frag.4'), 'the fragment found: its circle gone');
  // the host met
  game.set('met.host.ski', true);
  assert.ok(!r.marks().some((m) => m.key === 'host.host.ski'), 'the host met: gone');
  // the place walked to
  r.update(1, { x: sight.at.x + 3, y: sight.at.y, z: sight.at.z - 2 });
  assert.equal(flags[seenKey(w, sight.key)], true, 'the place reached is saved');
  assert.deepEqual(r.marks(), [], 'every rumour found: nothing on the map');
  // a save read again (here, one from before they were found): the same rumours, the same circles
  const before = { ...flags }; delete before[`frag.${w}.4`]; delete before['met.host.ski']; delete before[seenKey(w, sight.key)];
  const again = new Rumours({ world: w, game: fakeGame(before), level: L, hosts, rng: () => 0 });
  assert.deepEqual(again.marks().map((m) => m.key).sort(), ['frag.4', 'host.host.ski', sight.key].sort());
  for (const m of again.marks()) assert.deepEqual([m.x, m.z, m.r], Object.values(rumourArea(`${w}.${m.key}`, again.targets().find((t) => t.key === m.key).at)));
  // (and three open: nobody tells a fourth)
  assert.equal(again.offer({ id: 'x', name: 'X', talk: { listen: ['~happy~ Hi.'] } }, { x: 0, y: 0, z: 0 }), null);
});

test('a listen-only talk says the rumour instead of its next line, never over its news; a keeper after the hello', () => {
  const game = fakeGame();
  const person = { id: 'sefa', name: 'Sefa', talk: { listen: ['~happy~ One.', '~sad~ Two.', { after: { flag: 'x.done' }, say: '~happy~ News!' }] } };
  const ctx = { game, quests: { has: () => false }, rumour: () => '~whisper~ Something sings out north of the salt pan.' };
  let r = new DialogueRunner(person, ctx);
  assert.deepEqual(r.pages, ['Something sings out north of the salt pan.']);
  assert.equal(r.tone, 'whisper');
  assert.equal(game.flag('heard.sefa'), undefined, 'their own lines keep their place');
  game.set('x.done', true);
  r = new DialogueRunner(person, ctx);
  assert.deepEqual(r.pages, ['News!'], 'news first');
  r = new DialogueRunner(person, { ...ctx, rumour: () => null });
  assert.equal(r.pages.length, 1, 'no rumour this time: their own line');
  // (src/story/dialogue.js Dialogue.start: a keeper, back again, has it after their hello)
  const src = readFileSync(new URL('../src/story/dialogue.js', import.meta.url), 'utf8');
  assert.match(src, /person\.rumourNode && this\.runner\.nodeId === person\.rumourNode/);
  assert.match(readFileSync(new URL('../src/story/shops.js', import.meta.url), 'utf8'), /rumourNode: 'again'/);
});

test('the Map: a rumour is a soft circle, labelled, its mark at the circle’s middle (web and engine alike)', () => {
  const bounds = { x0: -200, z0: -200, w: 400, h: 400 };
  const m = mapMarks({ you: { x: 0, z: 0, dx: 0, dz: -1 }, rumours: [{ id: 'rumour.frag.3', x: 100, z: -50, r: 40, label: 'Something singing, they say', by: 'Sefa' }], bounds });
  const r = m.find((k) => k.kind === 'rumour');
  assert.equal(r.name, 'Something singing, they say');
  assert.ok(Math.abs(r.ru - 0.1) < 1e-9 && Math.abs(r.rv - 0.1) < 1e-9, 'its radius on the map');
  assert.match(r.sub, /a rumour, Sefa’s word · about \d+ m north-east/);
  // the web's menu draws the circle on the plane (it zooms with the ground) and the label by its mark
  const gm = readFileSync(new URL('../src/game-menu.js', import.meta.url), 'utf8');
  assert.match(gm, /gm-area/); assert.match(gm, /m\.kind === 'rumour' \? `<b>/);
  // the engine's: its circle's size on the sheet and its label, for BridgeMenu.cs
  const em = readFileSync(new URL('../engine/menus.js', import.meta.url), 'utf8');
  assert.match(em, /rx: r4\(rx\), ry: r4\(ry\), label/);
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMenu.cs', import.meta.url), 'utf8');
  assert.match(cs, /Mark\("area"\)/);
  assert.match(readFileSync(new URL('../engine/map-marks.js', import.meta.url), 'utf8'), /\barea: \{/);
});

test('a host is not told of while its run wants what he hasn’t got (issue #480: “It wants the hoverbike.”)', () => {
  const w = 'desert', flags = {}, game = fakeGame(flags), L = level(w);
  FRAGMENTS[w].forEach((_, i) => { flags[`frag.${w}.${i}`] = true; });
  let wants = 'It wants the hoverbike.';
  const at = { x: FRAGMENTS[w][0][0] + 60, y: FRAGMENTS[w][0][1], z: FRAGMENTS[w][0][2] };
  const r = new Rumours({ world: w, game, level: L, rng: () => 0, hosts: [{ id: 'host.race', name: 'Yusra', title: 'who races the dunes', at, lacks: () => wants }] });
  for (const t of r.targets()) if (t.kind === 'sight') flags[seenKey(w, t.key)] = true;   // (only the host left to tell of)
  const sefa = { id: 'sefa', name: 'Sefa', talk: { listen: ['~happy~ Hello.'] } }, from = { x: at.x + 80, y: 0, z: at.z };
  assert.equal(r.targets().find((t) => t.kind === 'host').waiting, true);
  assert.equal(r.offer(sefa, from), null, 'not before the run can be had');
  wants = '';
  const line = r.offer(sefa, from);
  assert.ok(line && line.includes('Yusra'), `told once it can be had: ${line}`);
});

test('a spring-house’s host (a fight temple’s) is told of as its door and the ink, never as a game (issue #483)', () => {
  for (const w of ['desert', 'arzach', 'incal']) {
    const [t] = rumourTargets({ world: w, hosts: [{ id: 'host.fight-desert', name: 'Wafa', title: 'who keeps watch on the sunken hall', fight: 'The Sunken Hall', at: [0, 0, 0] }] }).filter((x) => x.kind === 'host');
    assert.equal(t.label, 'The Sunken Hall', 'the map names the place');
    const own = RUMOUR_FIGHT_LINES[w] ?? RUMOUR_FIGHT_LINES.any;
    for (let seed = 0; seed < own.length; seed++) {
      const s = rumourLine(w, t, { from: { x: 300, y: 0, z: 0 }, seed });
      assert.ok(own.some((tpl) => parseLine(tpl).tone === parseLine(s).tone && s.includes('Wafa')), s);
      assert.doesNotMatch(s, /game|bet|play/i, s);
    }
  }
});
