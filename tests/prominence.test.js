import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The prominence tiers (src/costumes.js PROMINENCE): the crowd and the walkers without a story wear their world's
// colours a step quieter, so the quest people, the family, Tansy and the shopkeepers stand out.
const { PROMINENCE, TIER_COLOURS, tierColour, crowdLook, namedLook, dressFor, COSTUMES } = await import('../src/costumes.js');
const { mulberry32 } = await import('../src/noise.js');
const { QUEST_LOOKS } = await import('../src/characters/quest-looks.js');
const { TANSY } = await import('../src/story/fellow-data.js');
const { SHOPKEEPERS } = await import('../src/story/shop-data.js');

const hsl = (hex) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
const meanSat = (looks) => {
  let t = 0, n = 0;
  for (const s of looks) for (const k of TIER_COLOURS) { t += hsl(s[k]).s; n++; }
  return t / n;
};

test('the tiers go quieter from quest to background', () => {
  const order = ['quest', 'named', 'local', 'background'];
  for (let i = 1; i < order.length; i++) {
    const a = PROMINENCE[order[i - 1]], b = PROMINENCE[order[i]];
    assert.ok(b.sat <= a.sat && b.soft >= a.soft, `${order[i]} is no louder than ${order[i - 1]}`);
  }
  assert.ok(PROMINENCE.background.sat < 1 && PROMINENCE.background.sat > 0.4, 'the crowd is quieter, not grey');
  assert.equal(PROMINENCE.quest.sat, 1, 'quest people keep their colours');
});

test('a quieter colour keeps its hue: the world’s palette, not grey', () => {
  for (const hex of ['#c8483a', '#4d6a9a', '#6f8f5a', '#d9967f', '#b89846']) {
    const a = hsl(hex), b = hsl(tierColour(hex, 'background'));
    assert.ok(Math.abs(a.h - b.h) < 0.02 || Math.abs(a.h - b.h) > 0.98, `${hex}: hue kept`);
    assert.ok(b.s < a.s, `${hex}: less saturated`);
    assert.ok(b.s > a.s * 0.5, `${hex}: still coloured`);
  }
  assert.equal(tierColour('#c8483a', 'quest'), '#c8483a');
  assert.equal(tierColour('#c8483a', 'named'), '#c8483a');
});

// a person's loudest colour (what makes them stand out at play distance): the most saturated of their clothes
const loudest = (s) => Math.max(...['cloak', 'cloth', 'hat', 'accent'].map((k) => hsl(s[k]).s));
const mean = (a) => a.reduce((t, v) => t + v, 0) / a.length;

// the three busy places the author looked at: Qanat's square, the Signal Market, Lorn's crowd
const PLACES = { desert: 'desert-data', bazaar: 'bazaar-data', perdide: 'perdide-data' };
test('in the busy places the crowd is quieter than the story’s people', async () => {
  for (const [world, file] of Object.entries(PLACES)) {
    const { PEOPLE } = await import(`../src/story/${file}.js`);
    const rng = mulberry32(7), r2 = mulberry32(7);
    const crowd = Array.from({ length: 80 }, (_, i) => crowdLook(rng, { world, kind: i % 2 ? 'f' : 'm' }));
    const plain = Array.from({ length: 80 }, (_, i) => dressFor(world, r2, { kind: i % 2 ? 'f' : 'm' }));
    assert.ok(meanSat(crowd) < meanSat(plain) * 0.8, `${world}: the crowd is quieter than its costume tables`);
    for (let i = 0; i < crowd.length; i++) {
      assert.equal(crowd[i].tier, 'background');
      assert.equal(crowd[i].head, plain[i].head, 'the same people, only their colours quieter');
      assert.equal(crowd[i].skin, plain[i].skin, 'skin untouched');
    }
    const story = Object.values(PEOPLE).filter((d) => d?.id).map((d) => namedLook({ world, id: d.id, palette: d.palette ?? {}, look: d.look ?? {}, kind: d.kind ?? null, tier: d.tier ?? 'named' }));
    for (const q of story) assert.ok(['named', 'quest'].includes(q.tier));
    const c = mean(crowd.map(loudest)), p = mean(story.map(loudest));
    assert.ok(c < p, `${world}: the story's people stand out (crowd ${c.toFixed(2)} < people ${p.toFixed(2)})`);
  }
});

test('quest people, the family, Tansy and the shopkeepers keep their exact colours; walkers without a story go quieter', () => {
  const sel = namedLook({ world: 'bazaar', id: 'sel' });
  assert.equal(sel.cloak, QUEST_LOOKS.bazaar.sel.cloak);
  assert.equal(TANSY.tier, 'quest');
  for (const k of Object.keys(SHOPKEEPERS)) assert.equal(SHOPKEEPERS[k].tier, 'quest', `${k} is a quest-tier keeper`);
  const t = namedLook({ world: TANSY.world ?? 'saltharbour', id: 'tansy', palette: TANSY.palette, tier: TANSY.tier });
  assert.equal(t.cloak, TANSY.palette.cloak);
  const palette = { cloak: '#c8483a', cloth: '#5a4a3a' };
  const named = namedLook({ world: 'desert', id: 'someone', palette });
  const local = namedLook({ world: 'desert', id: 'someone', palette, tier: 'local' });
  assert.equal(named.cloak, '#c8483a');
  assert.ok(hsl(local.cloak).s < hsl(named.cloak).s);
  assert.ok(COSTUMES.desert);
});
