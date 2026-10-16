// Skirts on a few (issue #370, the author: "Too many characters have skirts. Simplify"). Before, three people in
// five wore a robe from the belt down (62 %: every one of Vael's silent ones, the bell monastery and the listeners,
// four in five of the desert). Counted over everyone the game dresses (scripts/cape-census.mjs --skirts): skirts on
// 15 % of everyone at most and on 20 % at most in a world, except the orders whose robes are their habit
// (Vael's silent ones, the bell monastery, the listeners), which keep about a third of theirs.
import test from 'node:test';
import assert from 'node:assert/strict';

const { capeCensus } = await import('../scripts/cape-census.mjs');
const { dressFor, namedLook, crowdLook, wearsSkirt, COSTUMES } = await import('../src/costumes.js');
const { mulberry32 } = await import('../src/noise.js');

const { worlds, all } = await capeCensus();
const pc = (r) => (100 * r.skirts) / Math.max(r.people, 1);
const ORDERS = ['arzach', 'arzach2', 'spheres'];

test('skirts on 15 % of everyone at most, 20 % in a world, the robed orders under half', () => {
  console.log(`  everyone: ${all.skirts} of ${all.people} (${pc(all).toFixed(1)} %)`);
  assert.ok(pc(all) <= 15, `skirts on ${pc(all).toFixed(1)} % of everyone`);
  for (const [w, r] of Object.entries(worlds)) {
    if (w === 'home' || w === 'lantern') continue;   // (the family: five people, their own designs)
    const cap = ORDERS.includes(w) ? 50 : 20;
    assert.ok(pc(r) <= cap, `${w}: skirts on ${pc(r).toFixed(1)} % (${r.skirts} of ${r.people})`);
  }
  // and not none: the orders keep their habits
  for (const w of ORDERS) assert.ok(pc(worlds[w]) >= 20, `${w} keeps its robes (${pc(worlds[w]).toFixed(1)} %)`);
});

test('a robe the story or a sheet sets is kept, an open coat is no skirt', () => {
  assert.ok(namedLook({ world: 'arzach', id: 'oia' }).robe > 0, 'Oïa’s sheet');
  assert.ok(namedLook({ world: 'arzach2', id: 'calix' }).robe > 0, 'Brother Calix’s sheet');
  const s = dressFor('desert', mulberry32(1), { look: { robe: 0.3 } });
  assert.equal(s.robe, 0.3);
  assert.ok(!wearsSkirt({ robe: 0.3, robeRole: 'cloak', robeOpen: 0.45 }), 'an open coat');
});

test('who wears a skirt is drawn from no random number: the rest of a crowd is the same people', () => {
  for (const world of ['desert', 'saltharbour', 'arzach', 'mangrove']) {
    const T = COSTUMES[world].tribes[0];
    const stream = () => { const r = mulberry32(9); return Array.from({ length: 60 }, (_, i) => dressFor(world, r, { kind: i % 2 ? 'f' : 'm' })); };
    const odds = T.robeOdds;
    T.robeOdds = { meant: 1, other: 1 };
    const robed = stream();
    T.robeOdds = odds;
    const plain = stream();
    for (let i = 0; i < plain.length; i++) for (const k of ['head', 'mask', 'prop', 'cloak', 'cloth', 'legs', 'height', 'eyes', 'faceType', 'capeLen']) assert.equal(plain[i][k], robed[i][k], `${world} #${i}: ${k}`);
    assert.ok(robed.filter(wearsSkirt).length > plain.filter(wearsSkirt).length, `${world}: fewer skirts`);
    // those without one are in trousers
    for (const s of plain) if (!wearsSkirt(s)) assert.equal(s.robe, 0);
  }
});

test('the elders and staff-bearers keep a skirt more often than anyone else', () => {
  const meant = [0, 0], other = [0, 0];
  for (const world of ['desert', 'arzach', 'arzach2', 'mangrove']) {
    const rng = mulberry32(3);
    for (let i = 0; i < 400; i++) {
      const s = crowdLook(rng, { world, kind: i % 2 ? 'f' : 'm' });
      const m = s.faceType === 'elder' || ['staff', 'bellstaff', 'discstaff'].includes(s.prop) ? meant : other;
      m[0]++; if (wearsSkirt(s)) m[1]++;
    }
  }
  assert.ok(meant[1] / meant[0] > 1.5 * (other[1] / other[0]), `elders ${meant[1]}/${meant[0]}, others ${other[1]}/${other[0]}`);
});
