// Fewer hats (issue #403, the author: "We have too many weird hats, redesign the hats and have less of them on
// average"). Before, four people in five wore something on the head (81 %: a hat, a cap, a hood up, a wrap; every
// one of the Buried Machine's and the Moon Foundry's crowds, nine in ten of the desert's). Counted over everyone
// the game dresses (scripts/cape-census.mjs --hats): something on the head of a third of everyone at most, of 30 %
// of a world's crowd at most, except where the culture calls for more (the desert's sun and sand, the mines' work
// gear, the two orders' habits). The oddest shapes (the stovepipes, the spires, the balls, the reed thatches, the
// lamp hats, the antenna helmets, the floating blossoms, the fezzes, the witch's hat) are worn by nobody but the
// few whose own design has one.
import test from 'node:test';
import assert from 'node:assert/strict';

const { capeCensus } = await import('../scripts/cape-census.mjs');
const { dressFor, namedLook, crowdLook, wearsHat, COSTUMES, HAIR_IDS } = await import('../src/costumes.js');
const { mulberry32 } = await import('../src/noise.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { SHOPKEEPERS } = await import('../src/story/shop-data.js');

const { worlds, all } = await capeCensus();
const pc = (a, b) => (100 * a) / Math.max(b, 1);
/** Where the culture calls for more (docs/systems/characters.md, "Fewer hats"): the crowd's ceiling there. */
const MORE = { desert: 50, glassdunes: 50, buried: 45, moonfoundry: 45, arzach: 62, arzach2: 45 };
/** The shapes dropped from use: only the people whose own design wears one keep it. */
const DROPPED = ['tophat', 'spire', 'orb', 'reeds', 'lamphat', 'antenna', 'flowers', 'fez', 'wizard'];
const OWN = ['The Speaker', 'Ume', 'Hollin', 'Haddu'];

test('something on the head of a third of everyone at most, 30 % of a crowd, more only where the culture asks', () => {
  console.log(`  everyone: ${all.hats} of ${all.people} (${pc(all.hats, all.people).toFixed(1)} %)`);
  assert.ok(pc(all.hats, all.people) <= 33, `hats on ${pc(all.hats, all.people).toFixed(1)} % of everyone`);
  assert.ok(pc(all.hats, all.people) >= 15, 'and not none');
  for (const [w, r] of Object.entries(worlds)) {
    const [n, h] = r.hatted.crowd;
    if (!n) continue;
    assert.ok(pc(h, n) <= (MORE[w] ?? 30) + 5, `${w}: hats on ${pc(h, n).toFixed(1)} % of the crowd (${h} of ${n})`);
    assert.ok(pc(h, n) >= 10, `${w}: still some hats (${pc(h, n).toFixed(1)} %)`);
  }
  // the order of Vael keeps its cowls on about half
  assert.ok(pc(...worlds.arzach.hatted.crowd.slice().reverse()) >= 40, 'Vael’s cowls');
});

test('the oddest shapes are worn by nobody but the people whose design has one', () => {
  for (const [w, r] of Object.entries(worlds)) {
    for (const part of ['crowd', 'walkers']) for (const h of DROPPED) assert.ok(!r.heads[part][h], `${w} ${part}: ${r.heads[part][h]} wear a ${h}`);
    for (const who of r.inHats) {
      const [name, head] = who.match(/^(.*) \((.*)\)$/).slice(1);
      if (DROPPED.includes(head)) assert.ok(OWN.includes(name), `${w}: ${name} wears a ${head}`);
    }
  }
});

test('a head the story or a sheet names as their own is kept', () => {
  const look = (id) => { const d = PEOPLE[id]; return namedLook({ world: 'desert', id, palette: d.palette, head: d.head, cape: d.cape, look: d.look ?? {}, kind: d.kind }); };
  assert.equal(look('sefa').head, 'braidcap', 'Sefa’s cap over her braid');
  assert.equal(look('nour').head, 'sunhat', 'Nour’s sun hat');
  assert.equal(look('speaker').head, 'wizard', 'the Speaker’s hat');
  assert.equal(look('marrow').head, 'raghood', 'Marrow’s hood');
  assert.equal(look('bako').head, 'wrap', 'Bako’s head-wrap (his sheet)');
  const h = SHOPKEEPERS.haddu;
  assert.equal(namedLook({ world: 'desert', id: 'haddu', palette: h.palette, head: h.head, cape: h.cape, look: h.look }).head, 'fez', 'Haddu’s fez');
  // the quest references' sheets (src/characters/quest-looks.js)
  assert.equal(namedLook({ world: 'arzach', id: 'oia' }).head, 'cowl');
  assert.equal(dressFor('desert', mulberry32(1), { look: { head: 'tophat' } }).head, 'tophat', 'look.head');
});

test('who wears a hat is drawn from no random number: the rest of a crowd is the same people, bare heads their own hair', () => {
  for (const world of ['desert', 'saltharbour', 'arzach', 'bazaar', 'incal']) {
    const T = COSTUMES[world].tribes[0];
    const stream = () => { const r = mulberry32(9); return Array.from({ length: 80 }, (_, i) => dressFor(world, r, { kind: i % 2 ? 'f' : 'm' })); };
    const odds = T.hatOdds;
    T.hatOdds = 1;
    const hatted = stream();
    T.hatOdds = odds;
    const fewer = stream();
    for (let i = 0; i < fewer.length; i++) {
      for (const k of ['mask', 'body', 'prop', 'cloak', 'cloth', 'height', 'eyes', 'faceType', 'capeLen', 'robe', 'under']) assert.deepEqual(fewer[i][k], hatted[i][k], `${world} #${i}: ${k}`);
      if (fewer[i].head !== hatted[i].head) assert.equal(fewer[i].head, hatted[i].under, `${world} #${i}: bare, in the hair under the hat`);
      if (!wearsHat(fewer[i])) assert.ok(HAIR_IDS.includes(fewer[i].head) || fewer[i].head === 'hooddown', `${world} #${i}: ${fewer[i].head}`);
    }
    assert.ok(fewer.filter(wearsHat).length < hatted.filter(wearsHat).length, `${world}: fewer hats`);
  }
  // a crowd person and the full body they are promoted to wear the same head
  const a = crowdLook(mulberry32(4), { world: 'bazaar', kind: 'f' }), b = crowdLook(mulberry32(4), { world: 'bazaar', kind: 'f' });
  assert.equal(a.head, b.head);
});
