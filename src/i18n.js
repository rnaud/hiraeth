// The game's words in the player's language (docs/systems/localisation.md). English is the source: every key
// is in src/i18n/en.js, and a language's table (src/i18n/fr.js) has what has been translated; anything it lacks
// falls back to English, then to the key itself (never an empty line on the screen).
//
//   t('menu.resume')                      'Resume' / 'Reprendre'
//   t('menu.deleteSave', { n: 2 })        'Delete Save 2?' ({name} fills in)
//   setLanguage('fr')                     the "Language" setting (src/ui.js applyAccess)
//   onLanguage(f)                         told when it changes (the menus draw themselves again)
//
// Covered: the menus, the settings, the Controls page, the HUD's lines and prompts, the title screen's menu. Not
// yet: the dialogue and the story (src/story/*), the items' and quests' texts, the minigames.

import { EN } from './i18n/en.js';
import { FR } from './i18n/fr.js';

export const LANGUAGES = {
  en: { name: 'English', table: EN },
  fr: { name: 'Français', table: FR },
};

let lang = 'en';
const listeners = new Set();

/** The words for `key` in the language now (English if it lacks them; the key if English does), with {name}s filled in. */
export function t(key, vars) {
  const s = LANGUAGES[lang]?.table[key] ?? EN[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s;
}

/** Choose the language ('en', 'fr'; anything else: English). */
export function setLanguage(l) {
  const next = LANGUAGES[l] ? l : 'en';
  if (globalThis.document?.documentElement) document.documentElement.lang = next;
  if (next === lang) return;
  lang = next;
  for (const f of listeners) f(lang);
}
export const language = () => lang;
/** Told when the language changes. Returns a function that stops it. */
export function onLanguage(f) { listeners.add(f); return () => listeners.delete(f); }

/**
 * The page's own words (index.html): every [data-t] element's text, and [data-t-aria] / [data-t-title] its
 * aria-label / title, in the language now, and again whenever it changes.
 */
export function translatePage(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const apply = () => {
    for (const e of root.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
    for (const e of root.querySelectorAll('[data-t-aria]')) e.setAttribute('aria-label', t(e.dataset.tAria));
    for (const e of root.querySelectorAll('[data-t-title]')) e.setAttribute('title', t(e.dataset.tTitle));
  };
  apply();
  onLanguage(apply);
}

/** The keys a language's table lacks (tests; the translator's to-do list). */
export const missing = (l) => Object.keys(EN).filter((k) => !(k in (LANGUAGES[l]?.table ?? {})));
