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

/** A button on a card: a quiet frame; the main one (what Enter does) the turquoise tab; the focused one ivory with dark letters. */
export const enamelButtons = (sel) => `${sel} { color: ${en('ink')}; background: rgba(247, 236, 210, 0.08); border: 1px solid rgba(247, 236, 210, 0.35); border-radius: 5px; box-shadow: none; }
${sel}:hover { background: rgba(247, 236, 210, 0.16); outline: none; }
${sel}:focus, ${sel}:focus-visible { background: ${en('ink')}; color: ${en('keyInk')}; border-color: ${en('brass')}; outline: none; transform: none; box-shadow: none; }
${sel}:active { transform: translateY(1px); box-shadow: none; }`;

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
