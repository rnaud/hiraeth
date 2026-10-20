// The outfits test page (issue #540; outfits.html → index.html?level=<world>&outfits=<id>): the game's own
// world and controls with the traveller drawn as the Blender rebuild (data/characters/traveller-v2/) on his
// usual skeleton and animation, and a picker that swaps his outfit live (the U key cycles). The game's
// portrait head (head-v3, the same asset the v2 head was made from) stays, with its drawn face and eyes; the
// B3 body, its cloth and its levels of detail are put away. A corner shows the draws and triangles. Web only:
// the game itself draws v2 in his own clothes since v1.88 (characters/traveller.js); this page builds B3 and dresses him.
// (the binding, the wardrobe on his skeleton and the thigh-lift keys: characters/traveller-v2.js, the game's debug
// switch uses the same)
import { ROOT, json, loadParts, v2Wardrobe } from './traveller-v2.js';

export { ROOT, json, loadParts, v2Wardrobe };
const WORLDS = ['desert', 'incal', 'glassdunes', 'bazaar', 'mangrove', 'saltharbour', 'moonfoundry', 'spacecity', 'home', 'shadows'];

/** Puts the v2 traveller on the player (his B3 meshes away) and starts the picker; a failure (the built
 * site has no data/) is said on the page. */
export function startOutfitPage(o) {
  return start(o).catch((e) => {
    console.error('outfits page', e);
    const note = document.createElement('output');
    note.style.cssText = 'position:fixed;top:10px;left:10px;z-index:10000;max-width:420px;padding:10px;background:#fff8e9ee;color:#7a2a20;font:13px system-ui;border-radius:8px';
    note.textContent = `Outfits page: ${e.message ?? e}`;
    document.body.append(note);
  });
}

async function start({ player, input, frameStats }) {
  const model = player.character;
  const h = model?.humanoid;
  if (!h) throw new Error('outfits page: no traveller');
  const [list, baseManifest] = await Promise.all([json(ROOT + 'outfits.json'), json(ROOT + 'manifest.json')]);
  const base = await loadParts(ROOT + list.base, h.body.skeleton.bones);
  const { wardrobe, load } = v2Wardrobe(model, { list, baseManifest, base });

  // ---- the panel
  const q = new URLSearchParams(location.search);
  const panel = document.createElement('section');
  panel.id = 'outfit-picker';
  panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:10000;max-width:280px;padding:10px 12px;background:#fff8e9ee;color:#302b25;font:13px system-ui;border-radius:8px;box-shadow:0 2px 10px #0003';
  panel.innerHTML = `<b>Outfits</b> <small>(v2 traveller · U cycles)</small><div data-outfits style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0"></div>
    <label>World <select data-world>${WORLDS.map((w) => `<option${w === (q.get('level') ?? 'desert') ? ' selected' : ''}>${w}</option>`).join('')}</select></label>`;
  const stats = document.createElement('output');
  stats.id = 'outfit-stats';
  stats.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:10000;padding:6px 10px;background:#302b25dd;color:#fff8e9;font:12px ui-monospace,monospace;border-radius:6px;white-space:pre';
  document.body.append(panel, stats);
  const buttons = new Map();
  for (const o of list.outfits) {
    const b = document.createElement('button');
    b.textContent = o.name;
    b.dataset.outfit = o.id;
    b.onclick = () => wear(o.id);
    panel.querySelector('[data-outfits]').append(b);
    buttons.set(o.id, b);
  }
  panel.querySelector('[data-world]').onchange = (e) => {
    const n = new URLSearchParams(location.search);
    n.set('level', e.target.value);
    n.set('outfits', wardrobe.worn?.id ?? 'default');
    location.search = n.toString();
  };
  let busy = false;
  async function wear(id) {
    if (busy) return;
    busy = true;
    try {
      await load(id);
      wardrobe.wear(id);
      for (const [k, b] of buttons) b.style.fontWeight = k === id ? '700' : '400';
      const n = new URLSearchParams(location.search);
      n.set('outfits', id);
      history.replaceState(null, '', `${location.pathname}?${n}`);
      window.__outfit = { ...wardrobe.worn, plan: undefined };
    } catch (e) {
      console.error(e);
      stats.textContent = String(e.message ?? e);
    } finally { busy = false; }
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyU' || e.repeat) return;
    const ids = wardrobe.ids();
    wear(ids[(ids.indexOf(wardrobe.worn?.id) + 1) % ids.length]);
  });
  // the corner: the outfit's own draws and triangles, the frame's (the game's readout, averaged)
  let last = { calls: frameStats.calls, tris: frameStats.tris, n: frameStats.n }, frame = 'frame: …';
  const timer = setInterval(() => {
    const w = wardrobe.worn;
    if (!w) return;
    const s = frameStats, d = s.n >= last.n ? { calls: s.calls - last.calls, tris: s.tris - last.tris, n: s.n - last.n } : { ...s };
    last = { calls: s.calls, tris: s.tris, n: s.n };
    const head = model.head ? (model.head.geometry.index?.count ?? model.head.geometry.attributes.position.count) / 3 : 0;
    if (d.n > 0) frame = `frame: ${Math.round(d.calls / d.n)} calls · ${Math.round(d.tris / d.n / 1000)}k tris`;
    stats.textContent = `${w.plan.name}\nhis body + clothes: ${w.draws} draws · ${(w.triangles / 1000).toFixed(1)}k tris\n+ the game's head (head-v3): ${(head / 1000).toFixed(1)}k tris\n${frame}`;
    window.__outfitStats = { id: w.id, draws: w.draws, triangles: w.triangles, headTriangles: head, frameCalls: d.n ? d.calls / d.n : null, frameTris: d.n ? d.tris / d.n : null };
  }, 500);
  addEventListener('pagehide', () => clearInterval(timer), { once: true });
  void input;
  await wear(list.outfits.some((o) => o.id === q.get('outfits')) ? q.get('outfits') : 'default');
  return wardrobe;
}
