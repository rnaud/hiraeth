// The father's charge: "Bring back something of value." The last thing he says on
// the prologue's recording before the traveller pauses it to listen (src/story/calls.js
// PROLOGUE_CALL), and the journey's own quest: every world's quest is a way of
// answering it, the keepsakes are what you carry, and the ending at the stone on
// the hill (src/story/ending.js) is where it closes.
//
// It is not one of a world's quests (those live and die with their world): its
// state is read off the save, so it stands the same everywhere.
//
//   chargeState({ flag, keepsakes, completed, failed })   → { stage, worlds, waiting, kept, names, lost }
//     failed: the titles of quests that went wrong (flags failed.<id>, src/story/quests.js); the
//     card keeps them too, quietly, under what you carry: it isn't a mark against you, it's
//     what happened
//     stage: null (not given yet) · 'out' (find it) · 'home' (home is on the map) · 'light' (the first
//     homecoming is over: follow the singing light; `traced`: its trace is on the map) · 'ilen' (she is
//     coming home with you) · 'done' (the true ending)
//     waiting: six worlds done, the last recording not heard yet (it waits on the ship's voicemail)
//   chargeHud(state)          the HUD's line for it: '✦ …' (main.js shows it in its own colour)
//   chargeJournalHtml(state)  the card pinned at the top of the sketchbook
//   showChargeCard({ sound }) the title card when it is given (after the landing, or once on an
//                             older save), with its own sound (audio.js charge())
//
// Flags: charge.given (the father's words have been heard), charge.card (its title card shown).
// Its mark is ✦, gold: a world's main quest is ◆, an errand ◇.

import { ENDING_WORLDS, endingUnlocked, homeOpen, finaleOpen, TOWER } from './ending.js';
import { escapeHtml } from '../prompt-keys.js';
import { screen } from '../platform.js';
import { styleText } from '../ui-style-registry.js';

export const CHARGE = {
  title: 'Something of Value',
  from: 'Your father’s charge',
  words: 'Bring back something of value.',
  quote: 'My son, make us proud. Bring back something of value.',
  mark: '✦',
};
export const GIVEN = 'charge.given';
export const CARD = 'charge.card';

/** Where the charge stands, from the save: `flag(name)`, the keepsakes, how many worlds are done. */
export function chargeState({ flag, keepsakes = [], completed = 0, failed = [] }) {
  const worlds = Array.isArray(completed) ? completed.length : completed;
  const given = !!(flag(GIVEN) || flag('prologue.done'));
  // (home is on the map by the same rule the map uses: six worlds and the last recording heard, src/story/ending.js)
  const stage = !given ? null : flag('ending.final') ? 'done' : flag('ending.done') ? (flag('finale.met') ? 'ilen' : 'light')
    : homeOpen({ flag, completed: worlds }) ? 'home' : 'out';
  return { stage, worlds, of: ENDING_WORLDS, traced: finaleOpen({ flag, completed }), waiting: stage === 'out' && endingUnlocked(worlds), kept: keepsakes.length, names: keepsakes.map((k) => k.name), lost: [...failed] };
}

/** What to do about it now, in a few words. */
export function chargeStep(st) {
  if (st.stage === 'out' && st.waiting) return 'A new message is waiting on the ship’s voicemail';
  if (st.stage === 'out') return st.kept ? 'Keep looking, out in the worlds' : 'Find it, out in the worlds';
  if (st.stage === 'home') return 'Home is on the map: take it home';
  // (not heard the market yet: its silent tower is the goal, issue #127; the map points at it too, src/ship/starmap.js)
  if (st.stage === 'light') return st.traced ? 'The light’s trace is on the map, past the Signal Market' : TOWER.step;
  if (st.stage === 'ilen') return 'Ilen is aboard: take her home';
  if (st.stage === 'done') return 'You brought it home on your own two feet.';
  return '';
}

/** The HUD line: '✦ Bring back something of value', or where it stands; null once it is done. */
export function chargeHud(st, { kept = null } = {}) {
  if (!st?.stage || st.stage === 'done') return null;
  if (kept) return `${CHARGE.mark} Something of value: ${kept}`;   // (one part of the line: its gold tag holds it all)
  if (st.stage === 'home') return `${CHARGE.mark} Home is on the map: take it home`;
  if (st.stage === 'light') return `${CHARGE.mark} ${st.traced ? 'Follow the light’s trace, past the Signal Market' : TOWER.step}`;
  if (st.stage === 'ilen') return `${CHARGE.mark} Take Ilen home`;
  return `${CHARGE.mark} ${CHARGE.words.replace(/\.$/, '')}`;
}

/** The card pinned at the top of the sketchbook (nothing before the father has said it). */
export function chargeJournalHtml(st) {
  if (!st?.stage) return '';
  const done = st.stage === 'done';
  // six worlds open the way home; past six, the count goes on (the route has nine, and they stay open)
  const worlds = st.worlds >= st.of ? `${st.worlds} worlds done` : `${st.worlds} of ${st.of} worlds before home`;
  const steps = [
    st.stage !== 'out' && `<li class="done">${worlds}</li>`,
    `<li class="now">${escapeHtml(chargeStep(st))}${st.stage === 'out' ? ` <span>${worlds}</span>` : ''}</li>`,
  ].filter(Boolean).join('');
  const carry = st.names.length
    ? `<p class="carry"><b>What you carry</b> ${st.names.map((n) => `<span>${escapeHtml(n)}</span>`).join('')}</p>`
    : '<p class="carry empty"><b>What you carry</b> <span>nothing yet</span></p>';
  const lost = st.lost?.length ? `<p class="carry lost"><b>What you could not mend</b> ${st.lost.map((n) => `<span>${escapeHtml(n)}</span>`).join('')}</p>` : '';
  return `<section class="charge${done ? ' finished' : ''}">
    <p class="k"><i>${CHARGE.mark}</i> ${CHARGE.from}</p>
    <h2>${CHARGE.title}${done ? '<b class="stamp">✓ Brought home</b>' : ''}</h2>
    <blockquote>“${CHARGE.quote}”</blockquote>
    <ul>${steps}</ul>${carry}${lost}</section>`;
}

// ---------------------------------------------------------------------------
// The title card: the father's words lettered over the landing site, the way a comic opens its
// first chapter: one line of airy capitals like the title screen's (src/title.js LOGO) on the enamel panel (issue #687; a band of paper until v2.29), "✦ BRING BACK
// SOMETHING OF VALUE", a pen line drawn under it (issue #222: one line, it was three). It asks nothing of you and
// leaves by itself.

// It sits low in the lower third, under the new world and the traveller (the arrival is for looking at), well
// clear of the toasts at the top and the subtitles at the bottom, and goes in five seconds.
const CARD_MS = 5000;
// The enamel look of every message (issue #687, src/hud-look.js): the dark panel with its brass hairline, the ✦ in the
// charge's gold in a column of its own beside the words (C's icon column), the words in ivory capitals.

/** The title card's one line: the charge, in capitals, no full stop. */
export const chargeCardLine = () => CHARGE.words.replace(/\.$/, '').toUpperCase();

/**
 * Letter the charge in the lower third for a few seconds (resolves when it has gone).
 * `doc` may be absent (tests, node): then it only sounds. `after(ms, fn)`: its clock (the prologue's is the game's,
 * src/ship/cinema.js Cinema.after, so its lines wait on the card the same on every machine; issue #539).
 */
export function showChargeCard({ sound = null, doc = typeof document !== 'undefined' ? document : null, ms = CARD_MS, after = (t, fn) => setTimeout(fn, t) } = {}) {
  sound?.charge?.();
  // (as the screen's 'charge' part too: an engine letters it from there, BridgeHud.cs DrawCharge; issue #394, it showed
  // nothing in Unity. `id` counts the cards, `ms` how long it stays)
  const id = (chargeCards += 1);
  screen.set('charge', { id, mark: CHARGE.mark, text: chargeCardLine(), ms });
  after(ms, () => { if (screen.state.charge?.id === id) screen.set('charge', null); });
  if (!doc?.body || !doc.head) return Promise.resolve(false);
  if (!doc.getElementById('charge-card-css')) { const s = doc.createElement('style'); s.id = 'charge-card-css'; s.textContent = styleText('charge-card-css'); doc.head.appendChild(s); }
  doc.getElementById('charge-card')?.remove();
  const el = doc.createElement('div');
  el.id = 'charge-card';
  el.setAttribute('role', 'status');
  // one line, the charge itself (issue #222: "your father's charge, something of value, bring back something of value":
  // the same words three times over; it was a kicker, a title and the quote)
  el.innerHTML = `<div class="sheet"><span class="mark" aria-hidden="true">${CHARGE.mark}</span><div class="words"><h1 aria-label="${CHARGE.from}: ${CHARGE.words}">${chargeCardLine()}</h1>
    <svg viewBox="0 0 520 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 10 C120 4 230 15 330 9 S470 7 516 10"/></svg></div></div>`;
  doc.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add('on');
  return new Promise((resolve) => {
    after(ms - 1300, () => { el.classList.add('off'); el.classList.remove('on'); });
    after(ms, () => { el.remove(); resolve(true); });
  });
}
export const CHARGE_CARD_MS = CARD_MS;
let chargeCards = 0;
