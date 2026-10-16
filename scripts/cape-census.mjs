// Who wears a cape (issue #347: "too many characters wear capes, it shouldn't be more than 10%"): every person
// the game dresses, world by world — the story's people and the temples' (src/story/*-data.js, the levels'
// people: src/levels/content.js), the hosts, the shopkeepers, the fellow traveller and the scientist, the walkers
// of the spawn spots (no story: tier 'local'), and a sample of each world's crowd (costumes.js crowdLook; the
// crowd's pooled bodies wear the look of the crowd person they stand in for) — dressed as the game dresses them
// (src/npc.js, src/crowd.js). `capeCensus()` → { worlds: { world: { people, capes, capelets, who, caped } }, all }.
// Run it (`node scripts/cape-census.mjs`) for the table; tests/cape-share.test.js holds the shares down.
import { readdirSync } from 'node:fs';

/** The worlds people live in (their costume's world: COSTUMES), and the sample of each one's crowd. */
export const CROWD_SAMPLE = 240;
// the empty places (the lab, the arena, the yard, the shadow room, the arcade, the atelier) and the references'
// walkers (src/levels/reference-views.js: the reference picture's violet robed figures) are no world's people
const NOT_WORLDS = new Set(['lab', 'arena', 'gadgetyard', 'shadows', 'arcade', 'atelier', 'references', 'garage']);
// the City-Shaft dresses by depth (costumes.js zoneIncal): its crowd sampled over its levels
const INCAL_Y = [200, 150, 92, 36, -24, -100];

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {} });

export async function capeCensus({ sample = CROWD_SAMPLE } = {}) {
  globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
  const THREE = await import('three');
  const { COSTUMES, namedLook, crowdLook, wearsCape, wearsSkirt, CAPELETS } = await import('../src/costumes.js');
  const { mulberry32 } = await import('../src/noise.js');
  const { CONTENT } = await import('../src/levels/content.js');
  const { peopleIn } = await import('../src/studio/people.js');
  const { HOSTS } = await import('../src/story/hosts-data.js');
  const { SHOPKEEPERS } = await import('../src/story/shop-data.js');
  const { SHOPS } = await import('../src/shop.js');
  const { TANSY } = await import('../src/story/fellow-data.js');
  const { THRUM } = await import('../src/story/scientist-data.js');
  const { FAMILY, FAMILY_WORLDS } = await import('../src/characters/family.js');

  const worlds = {};
  const W = (w) => (worlds[w] ??= { people: 0, capes: 0, capelets: 0, skirts: 0, who: { story: [0, 0], walkers: [0, 0], crowd: [0, 0] }, skirted: { story: [0, 0], walkers: [0, 0], crowd: [0, 0] }, caped: [], inSkirts: [] });
  const seen = new Set();
  const count = (world, s, part, name) => {
    const r = W(world);
    const cape = wearsCape(s), capelet = CAPELETS.includes(s.body);
    r.people++; r.who[part][0]++;
    if (cape) { r.capes++; r.who[part][1]++; if (part === 'story') r.caped.push(name); }
    if (capelet) r.capelets++;
    r.skirted[part][0]++;
    if (wearsSkirt(s)) { r.skirts++; r.skirted[part][1]++; if (part === 'story') r.inSkirts.push(name); }
  };
  // a story person as npc.js dresses them (def: their own id and tier; no def: a walker of a spawn spot)
  const person = (world, d) => {
    const talk = !!(d.talk || d.say || d.id && d.name);
    const at = d.at ?? [0, 0];
    const id = talk ? d.id : `${d.kind ?? 'm'}:${Math.round(at[0] ?? 0)},${Math.round(at[1] ?? 0)}`;
    const key = `${world}|${id}`;
    if (talk && seen.has(key)) return;
    seen.add(key);
    const s = namedLook({ world: d.world ?? world, id, palette: d.palette ?? {}, head: d.head ?? null, cape: d.cape ?? null, look: d.look ?? {},
      pos: new THREE.Vector3(at[0] ?? 0, d.y ?? 0, at[1] ?? 0), kind: talk ? d.body ?? d.kind ?? null : d.kind ?? 'm', tier: talk ? d.tier ?? 'named' : 'local' });
    count(world, s, talk ? 'story' : 'walkers', d.name ?? id);
  };
  const live = Object.keys(COSTUMES).filter((w) => !NOT_WORLDS.has(w));
  // the levels' people (their spawn lists: story people and walkers)
  for (const [w, c] of Object.entries(CONTENT)) if (live.includes(w)) for (const n of c?.npcs ?? []) person(w, n);
  // the story's and the temples' people lists
  for (const dir of ['story', 'temples']) {
    for (const f of readdirSync(new URL(`../src/${dir}/`, import.meta.url)).filter((x) => /-(data|people)\.js$/.test(x) && !['aliens-data.js', 'hosts-data.js', 'shop-data.js', 'fellow-data.js', 'scientist-data.js', 'home-data.js', 'lantern-data.js'].includes(x))) {
      const world = f.replace(/-(data|people)\.js$/, '').replace('night-train', 'overnighttrain');
      if (!live.includes(world)) continue;
      const m = await import(`../src/${dir}/${f}`);
      for (const d of peopleIn(m)) person(world, d);
    }
  }
  for (const h of Object.values(HOSTS)) if (live.includes(h.world)) person(h.world, h);
  for (const shop of Object.values(SHOPS)) { const k = SHOPKEEPERS[shop.keeper]; if (k && live.includes(shop.world)) person(shop.world, k); }
  person(TANSY.world ?? 'saltharbour', TANSY);
  person(THRUM.world ?? 'incal', THRUM);
  for (const w of FAMILY_WORLDS) for (const [id, f] of Object.entries(FAMILY)) person(w, { ...f, id, name: f.name ?? id });
  // the crowds
  for (const w of live) {
    if (w === 'home' || w === 'lantern') continue;   // (no crowd: the family and their neighbours)
    const rng = mulberry32(11 + live.indexOf(w));
    for (let i = 0; i < sample; i++) {
      const pos = w === 'incal' || w === 'spacecity' ? new THREE.Vector3(0, INCAL_Y[i % INCAL_Y.length], 0) : null;
      count(w, crowdLook(rng, { world: w, pos, kind: i % 2 ? 'f' : 'm' }), 'crowd');
    }
  }
  const all = Object.values(worlds).reduce((a, r) => ({ people: a.people + r.people, capes: a.capes + r.capes, capelets: a.capelets + r.capelets, skirts: a.skirts + r.skirts }), { people: 0, capes: 0, capelets: 0, skirts: 0 });
  return { worlds, all };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { worlds, all } = await capeCensus();
  const pc0 = (a, b) => `${b ? ((100 * a) / b).toFixed(0) : 0}%`.padStart(4);
  if (process.argv.includes('--skirts')) {
    console.log('world            people skirts       story(skirt)  walkers(skirt) crowd(skirt)');
    for (const [w, r] of Object.entries(worlds)) {
      const p = (k) => `${r.skirted[k][0]}(${r.skirted[k][1]})`.padEnd(14);
      console.log(`${w.padEnd(16)} ${String(r.people).padStart(6)} ${String(r.skirts).padStart(5)} ${pc0(r.skirts, r.people)}   ${p('story')}${p('walkers')}${p('crowd')}`);
    }
    console.log(`all              ${String(all.people).padStart(6)} ${String(all.skirts).padStart(5)} ${pc0(all.skirts, all.people)}`);
    if (process.argv.includes('--who')) for (const [w, r] of Object.entries(worlds)) if (r.inSkirts.length) console.log(`${w}: ${r.inSkirts.join(', ')}`);
    process.exit(0);
  }
  const pc = (a, b) => `${b ? ((100 * a) / b).toFixed(0) : 0}%`.padStart(4);
  console.log('world            people capes        story(caped)  walkers(caped) crowd(caped)  capelets');
  for (const [w, r] of Object.entries(worlds)) {
    const p = (k) => `${r.who[k][0]}(${r.who[k][1]})`.padEnd(14);
    console.log(`${w.padEnd(16)} ${String(r.people).padStart(6)} ${String(r.capes).padStart(5)} ${pc(r.capes, r.people)}   ${p('story')}${p('walkers')}${p('crowd')}${r.capelets}`);
  }
  console.log(`all              ${String(all.people).padStart(6)} ${String(all.capes).padStart(5)} ${pc(all.capes, all.people)}   capelets ${all.capelets} ${pc(all.capelets, all.people)}`);
  if (process.argv.includes('--who')) for (const [w, r] of Object.entries(worlds)) if (r.caped.length) console.log(`${w}: ${r.caped.join(', ')}`);
}
