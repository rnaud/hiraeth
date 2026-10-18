// The page elements of issue #430 put on the screen for a picture, the same way on the page and in an engine, so the
// two can be laid side by side (Unity's -ui, engine/unity/game.js; the web's side runs this in the page): each through the
// game's own code, which sets the screen part an engine draws and, on the page, its HTML.
//
//   uiPose(ctx, piece)   ctx: { THREE, player, npcs, ship, items, level, tool, openArcade(board), openShop(id), askShop() }
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
// magic      the magic bar part spent (1.6 of 3), a heart and a half gone so the hearts show (issue #427, round 4)
// magicshort the bar short of a shot (0.5 of 3): paler and hatched
// magicfull  the bar full (the hearts short, so it shows)
// magicempty the tank run dry: no bar, "empty" a moment beside the traveller
// mode       the gun's mode switched: its name a moment beside the traveller (the tool's modeFlash)
// aim        aiming (the host holds the aim, KeyR): the crosshair at the centre and the mode's name under it
// jump       the traveller held 0.5 m off the ground, falling: the jump's patch of shade under him
// hearts0..4 the last heart's quarters: hearts0 the last one empty (2 of 3), hearts1 a quarter in it, hearts2 a half,
//            hearts3 three quarters, hearts4 all full (the magic bar part spent, so the hearts show) (issue #461)
// heartslow  three quarters of one heart left: low, the last one warmer and pulsing
// potions    two potions in the pack (a count, not the endless stock), a heart and a half gone
// potionsnone none left: the flask faded, 0
// shop       Haddu's shop in the desert (src/shop-panel.js on the page, engine/menus.js shopView in an engine), its
//            first ware asked about after a moment (shopask)

import { CargoPanel, EndCard, Credits } from '../src/ship/homecoming.js';
import { credits } from '../src/story/ending.js';
import { ORDER, TITLES } from '../src/levels/names.js';
import { resources } from '../src/resources.js';

export const UI_PIECES = { balloons: 'desert', objective: 'desert', level: 'desert', cargo: 'desert', endcard: 'desert', credits: 'desert', breath: 'underwater', arcade: 'arcade', shop: 'desert', shopask: 'desert',
  magic: 'desert', magicshort: 'desert', magicfull: 'desert', magicempty: 'desert', mode: 'desert', aim: 'desert', jump: 'desert',
  hearts0: 'desert', hearts1: 'desert', hearts2: 'desert', hearts3: 'desert', hearts4: 'desert', heartslow: 'desert', potions: 'desert', potionsnone: 'desert' };
/** The pieces a host poses by holding a key while they are up: the aim (KeyR, src/bindings.js KEYS.aim). */
export const UI_KEYS = { aim: 'KeyR' };

const HOLD = [
  { kind: 'thing', name: 'A blue stone', level: 'desert', text: 'Warm when you hold it, as if it had been in someone’s pocket.' },
  { kind: 'song', name: 'The ferryman’s tune', level: 'arzach', text: 'Four notes, the last one held.' },
  { kind: 'item', name: 'Backpack', text: 'Carries the fluid tool and whatever you find.' },
];
let held = null, undo = null;

export function uiPose(ctx, piece) {
  const { THREE, player, npcs = [], ship, items, tool = null } = ctx;
  held?.remove?.(); held = null;
  undo?.(); undo = null;
  // (the magic bar and the tool's notices: the reserve held where it is put, its refill's clock stopped, a heart and a half
  // gone so the hearts and the bar show; let go, all as it was)
  if (piece === 'jump') {
    // (each frame put back where he was put, falling: his update runs, then he is held there off the ground)
    const at = player.pos.clone(), up = player.pos.clone().addScaledVector(player.frame.up, 0.5), update = player.update;
    player.update = function (...a) { const r = update.apply(this, a); this.pos.copy(up); this.vel.set(0, 0, 0); this.onGround = false; this.object?.position.copy(up); return r; };
    player.pos.copy(up);
    undo = () => { player.update = update; player.teleport?.(at, player.frame.up, player.frame.fwd); };
    return 'held up';
  }
  if (/^hearts[0-4]$|^heartslow$|^potions/.test(piece)) {
    // (the hearts held where they are put: their slow mending after a fall waits on hurtAt; the potions in the pack as a
    // count; at full hearts the reserve part spent so the hearts show; let go, all as it was)
    const R = tool?.reserve, st = resources.state;
    const was = { hearts: player.hearts, hurtAt: player.hurtAt, pots: st.flag('res.potions') ?? null, inf: st.flag('res.potions.infinite') ?? null, level: R?.level, since: R?.since };
    undo = () => { player.hearts = was.hearts; player.hurtAt = was.hurtAt; st.set('res.potions', was.pots); st.set('res.potions.infinite', was.inf); if (R) { R.level = was.level; R.since = was.since; } };
    const max = player.maxHearts ?? 3;
    player.hearts = piece === 'heartslow' ? 0.75 : piece.startsWith('potions') ? max - 1.5 : max - 1 + Number(piece.slice(6)) / 4;
    player.hurtAt = 1e12;
    st.set('res.potions.infinite', null);
    st.set('res.potions', piece === 'potionsnone' ? 0 : piece === 'potions' ? 2 : 1);
    if (piece === 'hearts4' && R) { R.level = Math.min(R.max, 1.6); R.since = -1e6; }
    return `${player.hearts} of ${max}`;
  }
  if (/^magic/.test(piece) || piece === 'mode' || piece === 'aim') {
    const R = tool?.reserve;
    if (!R) return 'no tool';
    const was = { level: R.level, since: R.since, hearts: player.hearts, empty: tool.state?.flag?.('tool.empty') ?? null, gun: tool.forceGun };
    undo = () => { R.level = was.level; R.since = was.since; if (was.hearts != null) player.hearts = was.hearts; tool.state?.set?.('tool.empty', was.empty); tool.forceGun = was.gun; };
    // (the gun found and in hand, as a game on foot lends it: src/minigames/kit/onfoot.js; the debug save keeps the gun)
    if (piece === 'aim') { (items ?? tool.items)?.grant?.('gun'); tool.forceGun = true; }
    const level = { magic: 1.6, magicshort: 0.5, magicempty: 0 }[piece] ?? R.max;
    R.level = Math.min(R.max, level); R.since = -1e6;
    if (/^magic/.test(piece)) player.hearts = Math.max(0.5, (player.maxHearts ?? 3) - 1.5);
    if (piece === 'magicempty') tool.state?.set?.('tool.empty', true);
    if (piece === 'mode') tool.modeFlash = 1;
    return `${R.level.toFixed(1)} of ${R.max}`;
  }
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
