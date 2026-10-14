// Capes on a few (issue #347, the author: "Too many characters wear capes, it shouldn't be more than 10%. Simplify the
// outfits for everyone else"). Before, four people in five wore a cape or a cape over the shoulders (81 %: the
// crowds of the Salt Harbour, the lake, the ring and the silent ones all of them). Every person the game dresses
// (scripts/cape-census.mjs: the story's and the temples' people, the hosts, the shopkeepers, the walkers, each
// world's crowd) is counted: capes on 10 % of them at most, and on no more than 15 % in any world.
import test from 'node:test';
import assert from 'node:assert/strict';

const { capeCensus } = await import('../scripts/cape-census.mjs');
const { dressFor, namedLook, crowdLook, wearsCape, CAPELETS, COSTUMES } = await import('../src/costumes.js');
const { mulberry32 } = await import('../src/noise.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { SHOPKEEPERS } = await import('../src/story/shop-data.js');

const { worlds, all } = await capeCensus();
const pc = (r) => (100 * r.capes) / Math.max(r.people, 1);

test('capes on 10 % of everyone at most, and on 15 % at most in any world', () => {
  console.log(`  everyone: ${all.capes} of ${all.people} (${pc(all).toFixed(1)} %)`);
  assert.ok(all.people > 4000, `the people counted (${all.people})`);
  assert.ok(pc(all) <= 10, `capes on ${pc(all).toFixed(1)} % of everyone`);
  for (const [w, r] of Object.entries(worlds)) assert.ok(pc(r) <= 15, `${w}: capes on ${pc(r).toFixed(1)} % (${r.capes} of ${r.people})`);
  // and not none: the elders and the staff-bearers keep theirs
  assert.ok(pc(all) >= 3, 'a few still wear them');
});

test('the capes a reference or the story asks for are kept', () => {
  const look = (id) => { const d = PEOPLE[id]; return namedLook({ world: 'desert', id, palette: d.palette, head: d.head, cape: d.cape, look: d.look ?? {}, kind: d.kind }); };
  // the desert's sheets (Bako, Sefa, Nour, the Speaker) and its keepers (Ama, Hessa)
  for (const id of ['bako', 'sefa', 'nour', 'speaker', 'ama', 'hessa']) assert.ok(look(id).capeLen > 0, `${id} keeps the cape`);
  assert.equal(look('speaker').body, 'mantle', 'the Speaker’s mantle');
  // the quest references that draw one (src/characters/quest-looks.js)
  assert.ok(namedLook({ world: 'arzach', id: 'oia' }).capeLen > 0, 'Oïa');
  assert.ok(namedLook({ world: 'perdide', id: 'saba' }).capeLen > 0, 'Saba');
  // Nettle's waxed moss-green cape (docs/design/shop-prompts.md)
  const n = SHOPKEEPERS.nettle;
  assert.ok(namedLook({ world: 'perdide', id: 'nettle', palette: n.palette, head: n.head, cape: n.cape, look: n.look }).capeLen > 0, 'Nettle');
  // the coats that were capes: Haddu's teal coat, open
  const h = SHOPKEEPERS.haddu, haddu = namedLook({ world: 'desert', id: 'haddu', palette: h.palette, head: h.head, cape: h.cape, look: h.look });
  assert.equal(haddu.capeLen, 0);
  assert.equal(haddu.robeRole, 'cloak');
  assert.ok(haddu.robeOpen > 0);
});

test('everyone else: no cape over the shoulders, and no draw of anyone’s look moved', () => {
  for (const world of ['desert', 'saltharbour', 'perdide', 'arzach', 'mangrove']) {
    const T = COSTUMES[world].tribes[0];
    const rng = mulberry32(5);
    for (let i = 0; i < 200; i++) {
      const s = crowdLook(rng, { world, kind: i % 2 ? 'f' : 'm' });
      if (wearsCape(s)) continue;
      assert.equal(s.capeLen, 0);
      assert.ok(!CAPELETS.includes(s.body), `${world}: ${s.body} is no cape`);
    }
    // who wears one is drawn from no random number: with everyone caped, a crowd's stream is the same people
    const stream = () => { const r = mulberry32(9); return Array.from({ length: 60 }, (_, i) => dressFor(world, r, { kind: i % 2 ? 'f' : 'm' })); };
    const odds = T.capeOdds;
    T.capeOdds = { meant: 1, other: 1 };
    const caped = stream();
    T.capeOdds = odds;
    const plain = stream();
    for (let i = 0; i < plain.length; i++) for (const k of ['head', 'mask', 'prop', 'cloak', 'cloth', 'height', 'eyes', 'faceType']) assert.equal(plain[i][k], caped[i][k], `${world} #${i}: ${k}`);
    assert.ok(caped.every(wearsCape) || T.capes.every((l) => !l), `${world}: everyone caped when the odds say so`);
    assert.ok(T.capeOdds, `${world}: its own odds`);
  }
});

test('a cape is worn where it means something: by the elders and those with a staff', () => {
  let meant = 0, other = 0;
  for (const world of ['desert', 'arzach', 'arzach2', 'perdide']) {
    const rng = mulberry32(3);
    for (let i = 0; i < 400; i++) {
      const s = crowdLook(rng, { world, kind: i % 2 ? 'f' : 'm' });
      if (!wearsCape(s)) continue;
      if (s.faceType === 'elder' || ['staff', 'bellstaff', 'discstaff'].includes(s.prop)) meant++; else other++;
    }
  }
  assert.ok(meant > 4 * other, `the elders and the staff-bearers (${meant}) far more than anyone else (${other})`);
});
