// The fight temples' harm along the route (issues #532, #533; src/fight-temples/harm.js): scaled to the hearts he has on
// arriving in each world, rising gently; the hurts under a quarter heart carried over, not rounded up; the lingering
// hazards' totals under the foes' and near the one-shot hazards'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER, partOf } from '../src/levels/names.js';
import { HEARTS } from '../src/resources.js';
import { SHOPS } from '../src/shop.js';
import { FIGHT_HARM, arrivalHearts, arrivalTable, harmScale, fightHarm, harmBank, hazardScale } from '../src/fight-temples/harm.js';
import { HAZARD, hazardEvery, STEADY, LINGERING } from '../src/fight-temples/hazards.js';
import { rankFor, RANK } from '../src/fight-temples/rules.js';
import { Foes, HARM_BY_STAGE } from '../src/foes.js';
import * as L from '../scripts/combat-review/lib.mjs';

// the twelve tables (src/fight-temples/<world>.js: <WORLD>_FIGHT)
const FIGHT_TEMPLES = Object.fromEntries(await Promise.all(ORDER.map(async (w) => [w, Object.values(await import(`../src/fight-temples/${w}.js`)).find((v) => v?.rooms && v.world === w)])));

test('the hearts on arrival: the start, then every container sold before; the same as the combat review plays with', () => {
  const review = L.heartsOnArrival(SHOPS, ORDER);
  for (const w of ORDER) assert.equal(arrivalHearts(w), review[w].arrival, w);
  assert.equal(arrivalHearts('desert'), 3);
  assert.ok(arrivalHearts('bazaar') >= 12, `the last: ${arrivalHearts('bazaar')}`);
  assert.deepEqual(arrivalTable(SHOPS, ORDER), Object.fromEntries(ORDER.map((w) => [w, review[w].arrival])));
});

test('every heart container sold on the route is counted, a merged part’s shop in its world (issue #560)', () => {
  // (the Almonry, Vael's sky stones', and the Welcome-Shelf, Lorn's Deep Wood's, stand in parts never in ORDER; the
  // Sealed Hangar's hatch, a dismissed world's, is sold nowhere now)
  const heartsOf = (s) => s.wares.find((w) => w.id === 'heart')?.stock ?? 0;
  const route = Object.values(SHOPS).filter((s) => ORDER.includes(partOf(s.world)));
  assert.ok(route.some((s) => s.id === 'almonry') && route.some((s) => s.id === 'welcome'), 'the two parts’ shops are on the route');
  const sold = route.reduce((n, s) => n + heartsOf(s), 0);
  const review = L.heartsOnArrival(SHOPS, ORDER), last = ORDER.at(-1);
  assert.equal(review[last].own, HEARTS.start + sold, `every container: ${HEARTS.start} + ${sold}`);
  // each shop's hearts are there from the next world on, in both tables
  for (const s of route) {
    const i = ORDER.indexOf(partOf(s.world));
    if (i + 1 >= ORDER.length) continue;
    const before = route.filter((t) => ORDER.indexOf(partOf(t.world)) < i + 1).reduce((n, t) => n + heartsOf(t), 0);
    assert.equal(arrivalHearts(ORDER[i + 1]), HEARTS.start + before, `${s.id} (${s.world}): counted by ${ORDER[i + 1]}`);
  }
  assert.equal(arrivalHearts('perdide'), arrivalHearts('arzach') + heartsOf(SHOPS.windshelf) + heartsOf(SHOPS.almonry), 'Vael’s two shops before Lorn');
  assert.equal(arrivalHearts('edena'), arrivalHearts('perdide') + heartsOf(SHOPS.float) + heartsOf(SHOPS.welcome), 'Lorn’s two before Viridel');
});

test('the scale rises with the hearts and along the route: each temple costs a like share, the last a little more', () => {
  const S = ORDER.map((w) => fightHarm(w));
  for (let i = 1; i < S.length; i++) assert.ok(S[i] > S[i - 1], `${ORDER[i]} (${S[i].toFixed(3)}) above ${ORDER[i - 1]} (${S[i - 1].toFixed(3)})`);
  // the share of his hearts a blow takes rises gently: no more than the route's rise from the first to the last
  const share = ORDER.map((w) => fightHarm(w) / arrivalHearts(w));
  for (let i = 1; i < share.length; i++) assert.ok(share[i] >= share[i - 1] - 1e-9, 'never falls');
  assert.ok(Math.abs(share.at(-1) / share[0] - (1 + FIGHT_HARM.rise)) < 1e-9, 'rises by `rise` over the route');
  assert.equal(harmScale(FIGHT_HARM.ref, 0), 1, '`ref` hearts strike at the blows’ own');
  // the hazards scale down with the early temples' few hearts, never up past their own: the rise is the foes'
  assert.ok(hazardScale(fightHarm('desert')) < 0.5, 'the Sunken Hall’s geysers at under half');
  assert.equal(hazardScale(fightHarm('bazaar')), FIGHT_HARM.hazards, 'the Back Rooms’ toll at its own');
  for (const w of ORDER) assert.ok(hazardScale(fightHarm(w)) <= fightHarm(w) + 1e-9 && hazardScale(fightHarm(w)) <= FIGHT_HARM.hazards);
  // the old curve: a light blow a quarter heart everywhere, 3 hearts to 15 (the first 5 times the last, as a share)
  assert.ok(share[0] / share.at(-1) < 1, 'the first temple no harder for his hearts than the last');
  // every temple of the twelve is one of the route's worlds
  for (const w of ORDER) assert.ok(FIGHT_TEMPLES[w], `${w}: a fight temple`);
});

test('the purse: hurts under a quarter heart are carried over and paid a quarter at a time, the total kept', () => {
  const pay = harmBank();
  const got = Array.from({ length: 20 }, () => pay(0.1));
  assert.ok(got.every((q) => q === 0 || q === 0.25), JSON.stringify(got));
  assert.equal(got.reduce((a, b) => a + b, 0), 2, 'twenty tenths: two hearts');
  // 0.4 of a blow is not 0.5 of one any more (the tables' lightHarm, issue #532)
  const sum = (h, n) => { const p = harmBank(); let s = 0; for (let i = 0; i < n; i++) s += p(h); return s; };
  assert.ok(sum(0.5 * 0.25, 40) > sum(0.4 * 0.25, 40), 'lightHarm 0.4 costs less than 0.5');
  assert.equal(sum(0.125, 8), 1, 'an eighth a hurt (Gentle’s half of a quarter): half a heart in four');
  assert.equal(pay(0), 0);
  // a whole blow passes as it is
  const p = harmBank(); assert.equal(p(0.75), 0.75); assert.equal(p(1), 1);
});

test('the foes strike at the temple’s scale through its purse, and as before outside', () => {
  const player = { hearts: 10, maxHearts: 10, hurt(n) { this.hearts -= n; } };
  const foes = Object.create(Foes.prototype);
  Object.assign(foes, { player, settings: { enemies: 'normal' }, stage: 4 });
  assert.equal(foes.harmOf(0.5), 0.75, 'outside: the stage’s (HARM_BY_STAGE, in quarters)');
  assert.equal(HARM_BY_STAGE[4], 1.5);
  foes.harmScale = 0.25; foes.harmBank = harmBank();
  const blows = Array.from({ length: 8 }, () => foes.harmOf(0.25));   // (a skitter's light blow in the Sunken Hall)
  assert.equal(blows.reduce((a, b) => a + b, 0), 0.5, `eight of them half a heart, not two hearts (${blows})`);
  // one blow at most FIGHT_HARM.blow (a tough one's stamp late on)
  foes.harmScale = 1.7; foes.harmCap = FIGHT_HARM.blow; foes.harmBank = harmBank();
  assert.equal(foes.harmOf(1), FIGHT_HARM.blow, 'a stamp at 1.7 times: a heart');
  foes.harmScale = 0.25; foes.harmCap = undefined; foes.harmBank = harmBank();
  foes.settings = { enemies: 'gentle' };
  const soft = Array.from({ length: 16 }, () => foes.harmOf(0.25)).reduce((a, b) => a + b, 0);
  assert.ok(soft <= 0.5 + 1e-9 && soft >= 0.25, `Gentle: about half (${soft})`);
});

test('the rank weighs the hearts lost against the hearts he came with', () => {
  assert.equal(rankFor({ secs: 100, lost: 1 }, 240), 'S', 'ten hearts: as before');
  assert.equal(rankFor({ secs: 100, lost: 1 }, 240, RANK, 3), 'B', 'three hearts: a heart lost is a third of them');
  assert.equal(rankFor({ secs: 100, lost: 0.25 }, 240, RANK, 3), 'S');
  assert.equal(rankFor({ secs: 100, lost: 1.5 }, 240, RANK, 15), 'S', 'fifteen: a heart and a half is a tenth');
  assert.equal(rankFor({ secs: 100, lost: 4 }, 240, RANK, 15), 'A');
});

test('the lingering hazards: lower ticks, a grace stepping in, the dark shorter and no quicker in the last wave', () => {
  // a round of each, stood in it from first to last (the worst: no roll, no step out), against one blow of a one-shot
  // hazard (a millstone, a cart): never more (the dark, the oil and the tiles took 8.5–11.75 hearts a run, the one-shot
  // hazards 0–3.5)
  const round = (k) => {
    const H = HAZARD[k];
    if (k === 'dark') return Math.max(0, Math.floor((H.secs - H.grace) / H.tick) + 1) * H.harm;
    return (1 + Math.floor(Math.max(0, H.secs - HAZARD.enter) / H.tick)) * H.harm;   // (on it as it opens: a tick at once)
  };
  const blow = Math.min(HAZARD.stone.harm, HAZARD.cart.harm);
  for (const k of ['dark', 'crack', 'spill']) assert.ok(round(k) <= blow + 1e-9, `${k}: ${round(k).toFixed(2)} hearts a round at worst, no more than a millstone's ${blow}`);
  // crossed at a walk (in and out within the grace): nothing
  assert.ok(HAZARD.enter >= 0.4 && HAZARD.crack.tile / 2 / 4.5 < HAZARD.enter, 'half a tile crossed at a walk (4.5 m/s) inside the grace');
  // the old dark: 3.6 s of every 5.25 in the last wave, a quarter a second after 0.6 s: 2.7 hearts a minute
  assert.ok(STEADY.has('dark'));
  const room = { hazard: { kind: 'dark', every: 7 } };
  assert.equal(hazardEvery(room, { last: true }), 7, 'the dark no quicker in the last wave');
  assert.ok((HAZARD.dark.warn + HAZARD.dark.secs) / hazardEvery(room, { last: true }) < 0.6, 'dark under 60 % of the time');
  for (const k of ['slag', 'crack', 'spill', 'dark', 'shade']) assert.ok(LINGERING.has(k));
});
