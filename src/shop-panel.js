import { t } from './i18n.js';
import { glyph } from './pad-glyphs.js';
import { menuNavigate } from './controller.js';
import { SHOP_LINES } from './story/shop-data.js';
import { stripTone, parseLine } from './story/tone.js';
import { planLine, voiceOf } from './story/voice.js';
import { chimeIcon } from './chime-icon.js';
import { ITEMS } from './items.js';

// The shop panel (docs/systems/ui.md, "The shop"): opened by talking to a keeper ("Show me what you have") or
// at their counter (src/story/shops.js: game.emit('shop:open', { shop })). A paper sheet over the room: the
// keeper's name and what they say (in their voice), the wallet, and the wares as cards: a picture, the name,
// what it does, the price in chimes, how many are left and what you have. A card's button buys it, after a
// yes / no; one you can't afford, sold out or can't carry more of says so on the card, and the keeper says it too.
//
// The controller: the cards are a grid (data-grid-nav, src/controller.js menuNavigate), A / × on a card asks,
// A / × again buys, B / ○ backs out of the question and then out of the shop (main.js menuRoot and
// closeControllerMenu); the glyphs sit inside the buttons (src/pad-glyphs.js). The keyboard: arrows, Enter (or
// Space, E), Esc. The mouse and a finger: tap a card, then Buy; ✕ leaves.
//
//   const panel = new ShopPanel({ el, game, resources, sound, onBought, onClose });
//   panel.open(entry)   (entry: src/story/shops.js { shop, logic, keeper, npc, show })
//   panel.isOpen · panel.root (what a controller press goes to) · panel.back() · panel.close()
//
// shopHtml(view) and warePicture(kind) are pure: the tests read them.
//
// Anselm Thrum's shop aboard the ship (v1.62, issue #185: src/fragment-shop.js) is the same panel with an entry of
// `kind: 'fragments'`: the wallet is the fragments of the singing light you hold, the prices are in fragments, and the
// wares are his upgrades (their names from src/items.js, their pictures the items page's own when drawn: `icon`); one
// already fitted says so, one whose gear you don't have yet says what it needs, in one line.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The chimes' crystal, small, for prices and the wallet (as the HUD's: index.html #health .chimes; src/chime-icon.js). */
export const CHIME_SVG = chimeIcon('chime-ico');
/** A fragment of the singing light, small (Anselm's prices and the fragments you hold): a pale splinter, inked. */
export const FRAGMENT_SVG = '<svg class="chime-ico frag-ico" viewBox="0 0 20 32" aria-hidden="true"><path d="M10 1.5 16.5 14 10 30.5 3.5 14Z" fill="#dff7ff" stroke="#2b211f" stroke-width="2" stroke-linejoin="round"/><path d="M10 1.5V30.5M3.5 14H16.5" fill="none" stroke="#7fb8c9" stroke-width="1.2"/></svg>';
/** A ware of Anselm's with no picture drawn yet: a fragment, large. */
const FRAGMENT_PIC = FRAGMENT_SVG.replace('class="chime-ico frag-ico"', 'class="frag-pic"');

/** What the money of a shop is: the chimes (every keeper's), or the fragments you hold (Anselm's). */
export function shopMoney(kind = 'chimes') {
  if (kind === 'fragments') return { cls: 'fragments', icon: FRAGMENT_SVG, title: t('shop.fragHeld'), ask: (w) => t('shop.askFrag', { what: w.name ?? w.id, n: w.price }) };
  return { icon: CHIME_SVG, title: t('hud.chimes'), ask: (w) => t('shop.ask', { what: t(`shop.${w.id}.a`), n: w.price }) };
}

/**
 * One of Anselm's wares as a card shows it (src/fragment-shop.js thrumWares): its name, what it does, its picture
 * (`icon(id)`: the items page's, or null), and its state in one line: fitted, what it needs first, or too dear.
 */
export function upgradeWare(w, icon = () => null) {
  const url = w.ware ? null : icon(w.id);
  // (his wares that aren't upgrades, issue #481: named and said by their own keys; his notebook's next page by its number)
  return { ...w, name: w.ware ? t(`thrum.${w.id}.name`, { n: w.page ?? 1 }) : ITEMS[w.id]?.name ?? w.id, effect: t(`thrum.${w.id}`), note: '',
    pic: url ? `<img class="ware-img" src="${esc(url)}" alt="">` : FRAGMENT_PIC,
    flag: w.state === 'owned' ? t(w.ware ? 'shop.bought' : 'shop.fitted') : w.state === 'needs' ? t(`shop.needs.${w.needs}`) : w.state === 'short' ? t('shop.fragShort') : w.state === 'wait' ? t('shop.fragWait') : '' };
}

/** A ware's picture: an inked drawing in the HUD's own style (the flask, a heart, a magic cell). */
export function warePicture(kind) {
  if (kind === 'potion') return '<svg viewBox="0 0 28 36" aria-hidden="true"><path d="M10 2.4h8v3.2h-8z" fill="#b07a45" stroke="#2b211f" stroke-width="1.6"/><path d="M10.6 5.6h6.8v6.2c5.2 1.6 8.6 6 8.6 11.4 0 6.8-5.4 11.2-12 11.2s-12-4.4-12-11.2c0-5.4 3.4-9.8 8.6-11.4z" fill="#f7ecd2"/><path d="M2.8 21.2c3.2-1.8 6.8-0.4 11.2 0.4s7.8-0.4 11.2-1.4c0.6 6.8-4.8 12.2-11.2 12.2s-11.8-4.8-11.2-11.2z" fill="#d9503f"/><path d="M10.6 5.6h6.8v6.2c5.2 1.6 8.6 6 8.6 11.4 0 6.8-5.4 11.2-12 11.2s-12-4.4-12-11.2c0-5.4 3.4-9.8 8.6-11.4z" fill="none" stroke="#2b211f" stroke-width="2" stroke-linejoin="round"/><path d="M7.2 19.2c-1.2 1.6-1.6 3.4-1.2 5.2" fill="none" stroke="#fff4dc" stroke-width="1.6" stroke-linecap="round"/></svg>';
  if (kind === 'heart') return '<svg viewBox="0 0 32 30" aria-hidden="true"><path d="M16 28C9 22.5 2.5 17.5 2.5 10.2 2.5 5.6 6 2.4 10 2.4c2.7 0 4.8 1.5 6 3.6 1.2-2.1 3.3-3.6 6-3.6 4 0 7.5 3.2 7.5 7.8 0 7.3-6.5 12.3-13.5 17.8z" fill="#d9503f" stroke="#2b211f" stroke-width="2.2" stroke-linejoin="round"/><path d="M7.2 8.8c0.6-1.8 2-2.8 3.6-3" fill="none" stroke="#fff4dc" stroke-width="1.8" stroke-linecap="round"/><path d="M16 11v8M12 15h8" stroke="#f7ecd2" stroke-width="2.4" stroke-linecap="round"/></svg>';
  if (kind === 'magic') return '<svg viewBox="0 0 30 36" aria-hidden="true"><rect x="9" y="3" width="12" height="25" rx="6" fill="#70e7df" stroke="#2b211f" stroke-width="2"/><path d="M12 9v12" stroke="#e8fffd" stroke-width="2" stroke-linecap="round"/><path d="M5 27h20l-2.4 6H7.4z" fill="#d6a13e" stroke="#2b211f" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 12v8M11 16h8" stroke="#2b6f6a" stroke-width="2.2" stroke-linecap="round"/></svg>';
  return '';
}

/** What a card says under its name: how many are left, and what you have. */
export function stockText(w) {
  const left = w.limited ? t('shop.left', { n: w.stock }) : t('shop.shelf', { n: w.stock });
  const have = w.id === 'potion' ? t('shop.carry', { n: w.owned, m: Number.isFinite(w.cap) ? w.cap : '∞' })
    : w.id === 'heart' ? t('shop.hearts', { n: w.owned }) : w.id === 'magic' ? t('shop.units', { n: w.owned }) : '';
  return { left, have };
}
/** The word on a card that can't be bought now (sold out, too dear, a full pack), or ''. */
export const stateText = (state) => (state === 'soldout' ? t('shop.soldOut') : state === 'short' ? t('shop.short') : state === 'full' ? t('shop.full') : state === 'owned' ? t('shop.fitted') : '');

/**
 * The panel's markup. view: { keeper: { name, title }, line (what they say now), wallet, wares (Shop.view()),
 * ask (a ware's id while its yes / no shows, or null), money (shopMoney: the chimes unless given) }. A ware may
 * carry its own words and picture (`name`, `effect`, `note`, `pic`, `flag`: Anselm's, upgradeWare).
 */
export function shopHtml({ keeper = {}, line = '', wallet = 0, wares = [], ask = null, money = null } = {}) {
  const m = money ?? shopMoney();
  const cards = wares.map((w) => {
    const { left, have } = w.note === undefined ? stockText(w) : {}, flag = w.flag ?? stateText(w.state);
    const stock = w.note === undefined ? `${esc(left)} · ${esc(have)}` : esc(w.note);
    return `<button type="button" class="ware ${w.state}" data-ware="${esc(w.id)}" data-state="${w.state}"${w.state === 'ok' ? '' : ' aria-disabled="true"'}>
      <span class="ware-pic">${w.pic ?? warePicture(w.kind)}</span>
      <span class="ware-name">${esc(w.name ?? t(`shop.${w.id}.name`))}</span>
      <span class="ware-effect">${esc(w.effect ?? t(`shop.${w.id}.effect`))}</span>
      ${stock ? `<span class="ware-stock">${stock}</span>` : ''}
      <span class="ware-foot">${w.state === 'soldout' || w.state === 'owned' ? '' : `<span class="ware-price">${m.icon}<b>${w.price}</b></span>`}${flag ? `<span class="ware-flag">${esc(flag)}</span>` : ''}${glyph('ok', { focus: true })}</span>
    </button>`;
  }).join('');
  const asked = ask ? wares.find((w) => w.id === ask) : null;
  return `<div class="shop-sheet${m.cls ? ` ${m.cls}` : ''}">
    <header class="shop-head">
      <div class="shop-keeper"><b>${esc(keeper.name ?? '')}</b><i>${esc(keeper.title ?? '')}</i><p class="shop-line">${esc(stripTone(line))}</p></div>
      <div class="shop-wallet" title="${esc(m.title)}">${m.icon}<b>${wallet}</b></div>
      <button type="button" class="shop-close" data-a="close" aria-label="${esc(t('shop.leave'))}">${glyph('back')}<span>✕</span></button>
    </header>
    <div class="shop-wares" data-grid-nav${asked ? ' inert' : ''}>${cards}</div>
    ${asked ? `<div class="shop-ask" role="alertdialog"><p>${esc(m.ask(asked))}</p>
      <div class="shop-ask-row"><button type="button" class="yes" data-a="yes">${glyph('ok')}<span>${esc(t('shop.yes'))}</span></button><button type="button" class="no" data-a="no">${glyph('back')}<span>${esc(t('shop.no'))}</span></button></div></div>` : ''}
  </div>`;
}

/** The next of a keeper's lines for `what` (in turn: never the same twice running). `lines`: theirs (Anselm's: src/story/scientist-data.js). */
export function keeperLine(keeper, what, turn = new Map(), lines = SHOP_LINES[keeper]) {
  const list = lines?.[what] ?? [];
  if (!list.length) return '';
  const k = `${keeper}.${what}`, i = turn.get(k) ?? 0;
  turn.set(k, i + 1);
  return list[i % list.length];
}

export class ShopPanel {
  /**
   * @param o.el        the panel's element (index.html #shop; made if missing)
   * @param o.game      the game state (its events: 'wallet', 'shop:bought')
   * @param o.resources src/resources.js (the wallet)
   * @param o.sound     src/audio.js (the bell, the coins, the keeper's voice)
   * @param o.onBought  ({ ware, price }) after a sale (main.js: the hearts filled, the HUD shown)
   * @param o.onClose   () after it closes
   * @param o.covered   () => true while another menu is open over it (the Start menu, the game menu): the keys are theirs
   */
  constructor({ el = null, game, resources, sound = null, onBought = () => {}, onClose = () => {}, covered = () => false, icon = () => null, doc = globalThis.document } = {}) {
    Object.assign(this, { game, resources, sound, onBought, onClose, covered, icon, doc });
    this.el = el ?? doc?.getElementById?.('shop') ?? null;
    if (!this.el && doc?.createElement) {
      this.el = doc.createElement('div');
      this.el.id = 'shop';
      doc.body.appendChild(this.el);
    }
    this.el?.setAttribute?.('role', 'dialog');
    this.el?.classList?.add?.('pad-raw');
    this.entry = null; this.ask = null; this.line = ''; this.turn = new Map();
    this.el?.addEventListener?.('click', (e) => this.click(e));
    this.el?.addEventListener?.('pointerdown', (e) => e.stopPropagation());   // (not a look-drag or a shot behind it)
    globalThis.window?.addEventListener?.('keydown', (e) => this.key(e), true);
    game?.on?.('wallet', () => { if (this.isOpen) this.render(); });
  }
  get isOpen() { return !!this.entry; }
  /** What a controller's directions and A / × go to: the yes / no while it shows, else the sheet. */
  get root() { return this.el?.querySelector?.('.shop-ask') ?? this.el; }
  open(entry) {
    if (!entry || !this.el) return false;
    this.entry = entry; this.ask = null;
    this.openedAt = globalThis.performance?.now?.() ?? 0;
    this.say('open');
    this.el.classList.add('open');
    this.el.setAttribute('aria-label', entry.shop?.label ?? 'Shop');
    if (this.doc?.pointerLockElement) this.doc.exitPointerLock?.();
    if (!this.fragments) this.sound?.shopBell?.();   // (Anselm's hold has no bell)
    this.render(true);
    return true;
  }
  close() {
    if (!this.entry) return;
    const e = this.entry;
    this.entry = null; this.ask = null;
    this.el.classList.remove('open');
    this.el.innerHTML = '';
    this.doc?.activeElement?.blur?.();
    // the keeper's goodbye, over their head
    const bye = keeperLine(e.keeper?.id, 'bye', this.turn, e.lines);
    if (bye && e.npc) e.npc.shout = { text: bye, until: (e.npc.time ?? 0) + 3 };
    this.onClose();
  }
  /** B / ○, Esc: out of the question first, then out of the shop. */
  back() {
    if (!this.entry) return false;
    if (this.ask) { const w = this.ask; this.ask = null; this.render(); this.focus(`[data-ware="${w}"]`); return true; }
    this.close();
    return true;
  }
  /** The keeper says something (shown over the wares, in their voice). */
  say(what) {
    const id = this.entry?.keeper?.id;
    const line = keeperLine(id, what, this.turn, this.entry?.lines);
    if (!line) return;
    this.line = line;
    try {
      const p = parseLine(line);
      const plan = planLine({ text: p.text, tone: p.tone }, { voice: voiceOf(this.entry.keeper), lang: this.sound?.language ?? 'home' });
      this.sound?.speak?.(plan, { channel: 'choice' });
    } catch { /* (no voice: the words still show) */ }
  }
  /** Anselm's (src/fragment-shop.js): the fragments you hold are the money. */
  get fragments() { return this.entry?.kind === 'fragments'; }
  view() {
    const e = this.entry, frag = this.fragments;
    const wares = frag ? e.logic.view().map((w) => upgradeWare(w, this.icon)) : e.logic.view();
    return { keeper: { name: e.keeper?.name, title: e.keeper?.title }, line: this.line, wallet: frag ? e.logic.held : this.resources.chimes, wares, ask: this.ask, money: shopMoney(frag ? 'fragments' : 'chimes') };
  }
  /** An item's picture is drawn (src/item-icons.js): on Anselm's cards, if his shop is open. */
  iconReady() { if (this.isOpen && this.fragments) this.render(); }
  render(first = false) {
    if (!this.entry || !this.el) return;
    const focused = this.doc?.activeElement?.dataset?.ware ?? null;
    this.el.innerHTML = shopHtml(this.view());
    if (this.ask) this.focus('.shop-ask .yes');
    else if (focused) this.focus(`[data-ware="${focused}"]`);
    else if (first) this.focus('.ware.ok') || this.focus('.ware');
  }
  focus(sel) {
    const b = this.el?.querySelector?.(sel);
    if (!b) return false;
    b.focus({ preventScroll: true });
    return true;
  }
  /** A card chosen: ask (if it can be bought), or the keeper says why not. */
  pick(id) {
    const w = this.entry?.logic.view().find((x) => x.id === id);
    if (!w) return;
    if (w.state === 'ok') { this.ask = id; this.render(); return; }
    this.say(w.state === 'soldout' ? 'soldOut' : w.state);
    this.sound?.potion?.('no');
    this.render();
  }
  /** Yes: paid and given (the keeper thanks you), or why not. */
  buy() {
    const id = this.ask;
    this.ask = null;
    if (!id) return null;
    const r = this.entry.logic.buy(id);
    if (r.ok) { this.say(id); if (this.fragments) this.sound?.fragmentTaken?.(); else this.sound?.purchase?.(r.price); this.onBought(r); }
    else this.say(r.state === 'soldout' ? 'soldOut' : r.state);
    this.render();
    this.focus(`[data-ware="${id}"]`);
    return r;
  }
  click(e) {
    if (!this.entry) return;
    e.stopPropagation?.();
    const a = e.target?.closest?.('[data-a]')?.dataset?.a;
    if (a === 'close') return this.close();
    if (a === 'yes') return this.buy();
    if (a === 'no') return this.back();
    const w = e.target?.closest?.('[data-ware]')?.dataset?.ware;
    if (w && !this.ask) this.pick(w);
  }
  key(e) {
    if (!this.entry || (e.repeat && !/^Arrow/.test(e.code)) || this.covered()) return;
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (dirs[e.code]) { e.preventDefault(); e.stopImmediatePropagation(); menuNavigate(this.root, ...dirs[e.code]); return; }
    if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); this.back(); return; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyE') {
      e.preventDefault(); e.stopImmediatePropagation();
      if ((globalThis.performance?.now?.() ?? 0) - this.openedAt < 300) return;   // (the press that opened it: a conversation's answer)
      const f = this.doc?.activeElement;
      if (f && this.root.contains(f)) f.click(); else menuNavigate(this.root, 0, 1);
    }
  }
}
