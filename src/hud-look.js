// Every message the game puts on the screen in one look (issue #687, the author: "I would expect all HUDs to be matching
// our new in-game HUD design"). The design is the approved enamel HUD: the hint strips of direction C (v2.19, issue #658:
// src/hint-look.js HINT, a charcoal strip, an inset cream frame, a turquoise tab) and the compact dark conversation panel
// of direction D (v2.21: a dark panel, one brass hairline, a brass speaker label, ivory key badges, no inner boxes).
// docs/systems/ui.md "One look for every message".
//
// index.html's :root carries ENAMEL as the --en-* variables (ENAMEL_VARS, checked by tests/hud-look.test.js); the pieces
// whose CSS is written in JavaScript (the charge card, the subtitles, the box card, the warp's title, the chips, the
// minigames' words) build their boxes with enamelStrip() and enamelCard() below; the CSS files use the variables. The
// Unity bridge (BridgeHud.cs, BridgeHud.Hints.cs EnamelCard) draws the same colours from ENAMEL_ENGINE.
import { HINT } from './hint-look.js';

/** The tokens (CSS values). strip: C's charcoal; panel: D's slightly green charcoal; brass: D's hairline; brassInk: its label. */
export const ENAMEL = Object.freeze({
  strip: HINT.bg, panel: 'rgba(22, 29, 29, 0.97)', ink: HINT.ink, soft: 'rgba(247, 236, 210, 0.72)', accent: HINT.accent,
  brass: '#d9b575', brassInk: '#edbc76', frame: 'rgba(247, 236, 210, 0.65)', keyInk: '#18201f', radius: HINT.radius,
  shadow: '0 2px 5px rgba(0, 0, 0, 0.33)', scrim: 'rgba(12, 15, 15, 0.55)', gold: '#f2c54b', bad: '#e0775f',
});

/** The :root block (index.html carries it as written here). */
export const ENAMEL_VARS = `--en-strip: ${ENAMEL.strip}; --en-panel: ${ENAMEL.panel}; --en-ink: ${ENAMEL.ink}; --en-soft: ${ENAMEL.soft}; --en-accent: ${ENAMEL.accent}; --en-brass: ${ENAMEL.brass}; --en-brass-ink: ${ENAMEL.brassInk}; --en-frame: ${ENAMEL.frame}; --en-key-ink: ${ENAMEL.keyInk}; --en-radius: ${ENAMEL.radius}; --en-shadow: ${ENAMEL.shadow}; --en-scrim: ${ENAMEL.scrim}; --en-gold: ${ENAMEL.gold}; --en-bad: ${ENAMEL.bad};`;

/** A variable with its value as the fallback (a page without index.html's :root, a test page, still gets the look). */
export const en = (k) => `var(--en-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}, ${ENAMEL[k]})`;

/** The same, as numbers for an engine (the Unity bridge): rgba 0..1. */
const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] ?? 1]; };
export const ENAMEL_ENGINE = Object.freeze({ strip: rgba(ENAMEL.strip), panel: rgba(ENAMEL.panel), ink: ENAMEL.ink, brass: ENAMEL.brass, brassInk: ENAMEL.brassInk, accent: ENAMEL.accent, gold: ENAMEL.gold });

/**
 * A strip's declarations (C: a one-line notice, a tag, a flash): charcoal, cream letters, the rounded corner, a soft shadow.
 * Its inset frame and tab are the hint family's (index.html); a strip of a module adds them with enamelTrim(sel).
 */
export const enamelStrip = () => `background: ${en('strip')}; color: ${en('ink')}; border: 0; border-radius: ${en('radius')}; box-shadow: ${en('shadow')};`;

/** A card's declarations (D: the charge, a box's find, a game's start and results, the knock-out): the dark panel and one brass hairline. */
export const enamelCard = () => `background: ${en('panel')}; color: ${en('ink')}; border: 1.5px solid ${en('brass')}; border-radius: ${en('radius')}; box-shadow: ${en('shadow')};`;

/** A card's small label over its title (D's speaker name): brass capitals. */
export const enamelKicker = () => `color: ${en('brassInk')}; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;`;

/** The inset cream frame and the turquoise tab of C, for a strip at `sel` (it must be position: relative or absolute). */
export const enamelTrim = (sel, { tab = true } = {}) => `${sel}::before { content: ''; position: absolute; inset: 3px; border: 1px solid ${en('frame')}; border-radius: 4px; pointer-events: none; }
${tab ? `${sel}::after { content: ''; position: absolute; left: -3px; top: 50%; width: 4px; height: 14px; transform: translateY(-50%); background: ${en('accent')}; border-radius: 2px; pointer-events: none; }` : ''}`;

/**
 * A button's prompt on a card (issue #695, the author: "I don't like the extra padding, border and different color for the
 * button, just show me the button and what it does next to it", Breath of the Wild's "Inventory (+)"): the button's glyph
 * (src/pad-glyphs.js: the pad's, the key's, nothing on touch) and the word, in the card's own ink, small, set at the card's
 * bottom right; no fill, no border, no padding. It stays a <button> (a click or a tap, the focus). On a pad the glyph is
 * the button's own, an ivory disc with its letter (BotW's light disc); with the keys its key's outline. Where a card has
 * several (a game's start, pause and results), the pad's focused one is underlined, the one mark (issue #507; with the keys
 * Enter is always the main one's).
 */
export const PROMPT = Object.freeze({ size: '0.92em', gap: '0.45em', pad: ['ok', 'back', 'x', 'y'] });
export const enamelPrompt = (sel) => `${sel} { display: inline-flex; align-items: center; gap: ${PROMPT.gap}; margin: 0; padding: 0; min-height: 1.9em; font: 600 ${PROMPT.size}/1.2 var(--face); letter-spacing: 0.04em; text-transform: none; color: inherit; background: none; border: 0; border-radius: 0; box-shadow: none; cursor: pointer; transform: none; }
${sel}:hover, ${sel}:focus, ${sel}:focus-visible, ${sel}:active { color: inherit; background: none; border: 0; outline: none; box-shadow: none; transform: none; }
body.controller ${sel}:not(:only-of-type):focus > .lbl, ${sel}:hover > .lbl { text-decoration: underline 1.5px; text-underline-offset: 0.3em; }
${sel} > .glyph { margin: 0; }
body.controller ${sel} > .glyph { background: ${en('ink')}; }
body.controller ${sel} > .glyph:not(${PROMPT.pad.map((r) => `[data-glyph="${r}"]`).join(', ')}) { color: ${en('keyInk')}; }
body.controller ${sel} > .glyph.keys-only { display: none; }`;

/** The item pictures' paper (src/item-icons.js ICON_PAPER): the box card's picture sits in a disc of it (issue #695). */
export const PIC_PAPER = '#f3e7cc';

/** The prompts on the cards (tests/hud-look.test.js: each written with enamelPrompt, none boxed). */
export const HUD_PROMPTS = Object.freeze([
  { id: 'box', file: 'src/hud-styles/box-card.js', sel: '#boxcard .go', what: 'a box\'s Continue' },
  { id: 'restart', file: 'index.html', sel: '#restart button', what: 'the knock-out\'s Restart' },
  { id: 'mg', file: 'src/minigames/kit/minigames.css', sel: '#minigame .sheet .buttons button', what: 'a game\'s Start, Resume, Retry, Quit' },
]);

/**
 * Every message the screen shows and where its look is written (tests/hud-look.test.js reads each: it must use the
 * enamel tokens, and none may be the old cream paper with an ink edge and a hard offset shadow).
 */
export const HUD_MESSAGES = Object.freeze([
  { id: 'charge', file: 'src/hud-styles/charge.js', sel: '#charge-card .sheet', what: 'the father\'s charge lettered after the voicemail' },
  { id: 'subtitle', file: 'src/hud-styles/cinema.js', sel: '#cine .sub span', what: 'the subtitles: the voicemail, the recordings, the scenes' },
  { id: 'skip', file: 'src/hud-styles/cinema.js', sel: '#cine .skip', what: 'hold to skip' },
  { id: 'warp', file: 'src/hud-styles/cinema.js', sel: '#warp .title', what: 'the next world\'s name on the way' },
  { id: 'box', file: 'src/hud-styles/box-card.js', sel: '#boxcard', what: 'what came out of a makers\' box' },
  { id: 'box-skip', file: 'src/hud-styles/box-card.js', sel: '#boxscene .skip', what: 'a box\'s skip' },
  { id: 'restart', file: 'index.html', sel: '#restart .sheet', what: 'knocked out' },
  { id: 'balloon', file: 'index.html', sel: '.balloon', what: 'what people say in passing' },
  { id: 'spell', file: 'src/hud-styles/spell.js', sel: '#spell-chip', what: 'the spell and its cooldown' },
  { id: 'gadget', file: 'src/hud-styles/gadget.js', sel: '#gadget-chip', what: 'the gadget in hand' },
  { id: 'mg-card', file: 'src/minigames/kit/minigames.css', sel: '#minigame .sheet', what: 'a game\'s start, pause and results' },
  { id: 'mg-box', file: 'src/minigames/kit/minigames.css', sel: '#minigame .mg-box', what: 'a game\'s clock and score' },
  { id: 'mg-flash', file: 'src/minigames/kit/minigames.css', sel: '#minigame .mg-flash div', what: 'a game\'s flashes: +3 s, Checkpoint' },
  { id: 'mg-say', file: 'src/hud-styles/labels.js', sel: '#mg-words .say', what: 'a game\'s words over a person' },
  { id: 'mg-tag', file: 'src/hud-styles/labels.js', sel: '#mg-words .tag', what: 'a game\'s tags in the world' },
  { id: 'fish-catch', file: 'src/hud-styles/fishing.js', sel: '#fishing-hud .fh-catch', what: 'a fish caught' },
  { id: 'fish-hint', file: 'src/hud-styles/fishing.js', sel: '#fishing-hud .fh-hint', what: 'the fishing\'s prompt' },
  { id: 'hunt-list', file: 'src/hud-styles/sketchhunt.js', sel: '#hunt-list', what: 'the sketch hunt\'s list' },
  { id: 'hunt-read', file: 'src/hud-styles/sketchhunt.js', sel: '#hunt-view .read', what: 'the sketch hunt\'s reading' },
]);

/**
 * The stamina wheel (issue #710, the author: "the stamina wheel is white in the middle on web but I would expect that part
 * to be transparent? also on unity the stamina wheel doesn't look the same?"): an enamel ring, nothing in its middle. The
 * gadget chip's look (src/hud-styles/gadget.js): a charcoal band edged in brass hairlines, the turquoise accent as the
 * gauge, filled clockwise from the top; winded, the enamel's red pulsing to its gold, a "!" beside it. Sizes in px of a
 * 34 px box centred on its point beside the traveller. The page's SVG is built from it (staminaSvg, src/main.js); the Unity
 * bridge draws the same numbers (BridgeHud.cs StaminaRing, checked by tests/stamina-ring.test.js).
 */
export const STAMINA_RING = Object.freeze({
  size: 34,
  outer: 14, inner: 5.4,            // the band: from 5.4 to 14 px out; inside 5.4 px, nothing drawn
  band: ENAMEL.strip,               // the hints' charcoal
  edge: ENAMEL.brass, edgeWidth: 1.2,   // a brass hairline on each side of the band, inside it
  arcR: 9.6, arcWidth: 6,           // the gauge, between the hairlines: 6.6 to 12.6 px, as thick as the old inked wheel's (7.5 of 40)
  fill: '#3f8f6a', winded: '#c8483a', pulse: '#f2c54b', pulseSecs: 0.7,   // the old wheel's green, red and gold (issue #710)
  shadow: { dy: 2, blur: 2.5, alpha: 0.33 },   // (the enamel's soft shadow, ENAMEL.shadow's 0 2px 5px, as a ring's drop-shadow:
                                               // a filter's blur is the deviation, box-shadow's 5px is twice it)
});

/** The wheel's SVG (index.html #stamina): the band, its two hairlines, the gauge (.arc, its dash the stamina). Nothing fills the middle. */
export function staminaSvg(R = STAMINA_RING) {
  const h = R.size / 2, f = (x) => +x.toFixed(2), s = R.shadow;
  return `<svg viewBox="${-h} ${-h} ${R.size} ${R.size}" style="filter: drop-shadow(0 ${s.dy}px ${s.blur}px rgba(0, 0, 0, ${s.alpha}))">`
    + `<circle class="band" r="${f((R.outer + R.inner) / 2)}" fill="none" stroke="${R.band}" stroke-width="${f(R.outer - R.inner)}"/>`
    + `<circle class="edge" r="${f(R.outer - R.edgeWidth / 2)}" fill="none" stroke="${R.edge}" stroke-width="${R.edgeWidth}"/>`
    + `<circle class="edge" r="${f(R.inner + R.edgeWidth / 2)}" fill="none" stroke="${R.edge}" stroke-width="${R.edgeWidth}"/>`
    + `<circle class="arc" r="${R.arcR}" fill="none" stroke="${R.fill}" stroke-width="${R.arcWidth}" pathLength="100" stroke-dasharray="100 100" transform="rotate(-90)"/>`
    + '</svg>';
}
