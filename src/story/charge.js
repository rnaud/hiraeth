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
// first chapter: one line of airy capitals like the title screen's (src/title.js LOGO) on a band of paper, "✦ BRING BACK
// SOMETHING OF VALUE", a pen line drawn under it (issue #222: one line, it was three). It asks nothing of you and
// leaves by itself.

// It sits low in the lower third, under the new world and the traveller (the arrival is for looking at), well
// clear of the toasts at the top and the subtitles at the bottom, and goes in five seconds.
const CARD_MS = 5000;
const CSS = `
#charge-card { position: fixed; left: 0; right: 0; bottom: calc(6vh + var(--safe-bottom, env(safe-area-inset-bottom, 0px))); z-index: 8050; pointer-events: none;
  display: flex; justify-content: center; opacity: 0; transition: opacity .8s; }
#charge-card.on { opacity: 1; }
#charge-card.off { opacity: 0; transition: opacity 1.1s; }
#charge-card .sheet { box-sizing: border-box; width: min(max(640px, 44em), 88vw); text-align: center; color: #2b211f; padding: 10px 4vw 10px;
  background: linear-gradient(90deg, rgba(255, 246, 220, 0), rgba(255, 246, 220, .95) 18%, rgba(255, 246, 220, .95) 82%, rgba(255, 246, 220, 0));
  transform: translateY(8px); transition: transform 1.4s cubic-bezier(.2,.7,.2,1); }
#charge-card.on .sheet { transform: none; }
#charge-card h1 { margin: 0; font: 400 clamp(16px, 2.5vw, 27px)/1.1 var(--face); white-space: nowrap;
  letter-spacing: .42em; margin-right: -.42em; color: #2b211f;
  transition: letter-spacing 1.8s cubic-bezier(.2,.7,.2,1), margin 1.8s cubic-bezier(.2,.7,.2,1); }
#charge-card.on h1 { letter-spacing: .22em; margin-right: -.22em; }
#charge-card h1 i { font-style: normal; color: #f2c54b; -webkit-text-stroke: .8px #2b211f; margin-right: .35em; }
#charge-card svg { display: block; width: min(300px, 60vw); height: 16px; margin: 3px auto 0; overflow: visible; }
#charge-card svg path { fill: none; stroke: #2b211f; stroke-width: 2; stroke-linecap: round; stroke-dasharray: 600; stroke-dashoffset: 600; transition: stroke-dashoffset 1.2s .5s ease-in-out; }
#charge-card.on svg path { stroke-dashoffset: 0; }
#charge-card svg circle { fill: #f2c54b; stroke: #2b211f; stroke-width: 1.4; transform-box: fill-box; transform-origin: center; transform: scale(0); transition: transform .5s 1.5s cubic-bezier(.3,1.6,.5,1); }
#charge-card.on svg circle { transform: scale(1); }
@media (max-width: 600px) { #charge-card .sheet { background: rgba(255, 246, 220, .95); } #charge-card h1 { white-space: normal; } #charge-card.on h1 { letter-spacing: .14em; margin-right: -.14em; } }
`;

/** The title card's one line: the charge, in capitals, no full stop. */
export const chargeCardLine = () => CHARGE.words.replace(/\.$/, '').toUpperCase();

/**
 * Letter the charge in the lower third for a few seconds (resolves when it has gone).
 * `doc` may be absent (tests, node): then it only sounds.
 */
export function showChargeCard({ sound = null, doc = typeof document !== 'undefined' ? document : null, ms = CARD_MS } = {}) {
  sound?.charge?.();
  // (as the screen's 'charge' part too: an engine letters it from there, BridgeHud.cs DrawCharge; issue #394, it showed
  // nothing in Unity. `id` counts the cards, `ms` how long it stays)
  const id = (chargeCards += 1);
  screen.set('charge', { id, mark: CHARGE.mark, text: chargeCardLine(), ms });
  setTimeout(() => { if (screen.state.charge?.id === id) screen.set('charge', null); }, ms);
  if (!doc?.body || !doc.head) return Promise.resolve(false);
  if (!doc.getElementById('charge-card-css')) { const s = doc.createElement('style'); s.id = 'charge-card-css'; s.textContent = CSS; doc.head.appendChild(s); }
  doc.getElementById('charge-card')?.remove();
  const el = doc.createElement('div');
  el.id = 'charge-card';
  el.setAttribute('role', 'status');
  // one line, the charge itself (issue #222: "your father's charge, something of value, bring back something of value":
  // the same words three times over; it was a kicker, a title and the quote)
  el.innerHTML = `<div class="sheet"><h1 aria-label="${CHARGE.from}: ${CHARGE.words}"><i>${CHARGE.mark}</i>${chargeCardLine()}</h1>
    <svg viewBox="0 0 520 26" aria-hidden="true"><path d="M14 15 C120 6 230 20 330 12 S470 9 506 14"/><circle cx="260" cy="15" r="5"/></svg></div>`;
  doc.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add('on');
  return new Promise((resolve) => {
    setTimeout(() => { el.classList.add('off'); el.classList.remove('on'); }, ms - 1300);
    setTimeout(() => { el.remove(); resolve(true); }, ms);
  });
}
export const CHARGE_CARD_MS = CARD_MS;
let chargeCards = 0;
