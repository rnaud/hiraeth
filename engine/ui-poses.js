// The page elements of issue #430 put on the screen for a picture, the same way on the page and in an engine, so the
// two can be laid side by side (Unity's -ui, engine/unity/game.js; the web's side runs this in the page): each through the
// game's own code, which sets the screen part an engine draws and, on the page, its HTML.
//
//   uiPose(ctx, piece)   ctx: { THREE, player, npcs, ship, items, level, openArcade(board), openShop(id), askShop() }
//   UI_PIECES            the pieces and the world each is pictured in
//
// balloons   the nearest person a shout over their head, the traveller beside them facing them
// objective  the homecoming's card (cinema.objective)
// level      the brass level: the item granted, down turned 25° (there is no world left where it turns: the Hangar's
//            was dismissed), the traveller still
// cargo      the homecoming's cargo check with three things in the hold
// endcard    the true ending's card
// credits    the true ending's credits, 18 s into their roll (the people of some worlds met, a thing brought home)
// breath     the breath meter in the Underwater City (a helmet's sea), its air half gone
// arcade     the Arcade's board of games
// shop       Haddu's shop in the desert (src/shop-panel.js on the page, engine/menus.js shopView in an engine), its
//            first ware asked about after a moment (shopask)

import { CargoPanel, EndCard, Credits } from '../src/ship/homecoming.js';
import { credits } from '../src/story/ending.js';
import { ORDER, TITLES } from '../src/levels/names.js';
import { resources } from '../src/resources.js';

export const UI_PIECES = { balloons: 'desert', objective: 'desert', level: 'desert', cargo: 'desert', endcard: 'desert', credits: 'desert', breath: 'underwater', arcade: 'arcade', shop: 'desert', shopask: 'desert' };

const HOLD = [
  { kind: 'thing', name: 'A blue stone', level: 'desert', text: 'Warm when you hold it, as if it had been in someone’s pocket.' },
  { kind: 'song', name: 'The ferryman’s tune', level: 'arzach', text: 'Four notes, the last one held.' },
  { kind: 'item', name: 'Backpack', text: 'Carries the fluid tool and whatever you find.' },
];
let held = null;

export function uiPose(ctx, piece) {
  const { THREE, player, npcs = [], ship, items } = ctx;
  held?.remove?.(); held = null;
  if (piece === 'balloons') {
    const n = npcs.filter((p) => !p.pooled && p.def?.id && p.object?.visible).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
    if (!n) return 'no one here';
    const side = new THREE.Vector3(3, 0, 1.2);
    player.pos.copy(n.pos).add(side);
    player.vel?.set(0, 0, 0);
    player.heading = Math.atan2(-side.x, -side.z);
    n.shout = { text: 'Over *here*! The well is dry again.', until: n.time + 120 };
    return n.def.id;
  }
  if (piece === 'objective') { ship?.cinema?.objective('Follow the light to the stone'); return 'up'; }
  if (piece === 'level') {
    items?.grant?.('level');
    player.frame.set(new THREE.Vector3(Math.sin(0.44), Math.cos(0.44), 0), player.frame.fwd);
    return 'tilted';
  }
  if (piece === 'cargo') {
    held = new CargoPanel({ items: HOLD, titles: { desert: 'The Desert', arzach: 'Vael' }, onGo: () => {}, page: ctx.page ?? true });
    held.show();
    return 'open';
  }
  if (piece === 'endcard') { held = new EndCard(ctx.page ?? true); return 'up'; }
  if (piece === 'credits') {
    const flag = (k) => /^world\.(desert|arzach|perdide)\.done$/.test(k) || (k.startsWith('met.') && k.length % 3 !== 0);
    held = new Credits(credits({ order: ORDER, titles: TITLES, flag, keepsake: { id: 'tooth', name: 'A rust gear tooth', kind: 'thing' } }), null, ctx.page ?? true);
    held.t = 18; held.update(0);
    return 'rolling';
  }
  if (piece === 'breath') { player.breath = 0.45; return 'held'; }   // (the helmet's sea: shown while its air fills again)
  if (piece === 'shop') {
    // (the same wallet and pack on both sides: 60 chimes, one potion, no heart or magic bought yet)
    const st = resources.state;
    for (const [k, v] of [['res.chimes', 60], ['res.potions', 1], ['res.hearts.extra', 0], ['res.magic.extra', 0], ['shop.qanat.potions', null], ['shop.qanat.heart.sold', null], ['shop.qanat.magic.sold', null]]) st.set(k, v);
    return ctx.openShop?.('qanat') ? 'open' : 'no shop';
  }
  if (piece === 'shopask') return ctx.openShop?.('qanat') && ctx.askShop?.() ? 'asked' : 'no shop';
  if (piece === 'arcade') return ctx.openArcade?.(ctx.level?.quickMenu) ? 'open' : 'no board';
  return `no piece ${piece}`;
}
