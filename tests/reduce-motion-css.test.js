// Reduce motion stops every animation of the game menu (src/game-menu.css): the "Reduce motion" setting
// (html.reduce-motion, src/ui.js) and the system's prefers-reduced-motion both list each animated rule. Issue #235:
// the world map's loading pen kept spinning, missing from both lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** A selector list split at its top-level commas (not those inside :is(…)). */
const split = (sels) => sels.split(/,(?![^(]*\))/).map((s) => s.trim());
const css = readFileSync(new URL('../src/game-menu.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('every animated rule of the game menu is stilled by Reduce motion and by prefers-reduced-motion (issue #235)', () => {
  // the rules (outside @keyframes and @media) that set an animation other than none
  const flat = css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g, '');
  const animated = [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => /animation:(?!\s*none)/.test(body)).flatMap(([, sel]) => split(sel));
  assert.ok(animated.includes('#journal .gm-mapimg .pen'), 'the map\'s loading pen is one of them');
  const stilled = split;
  const media = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*([^{]+)\{ animation: none; \}/);
  const setting = [...css.matchAll(/(html\.reduce-motion[^{]+)\{ animation: none; \}/g)].flatMap((m) => stilled(m[1]));
  assert.ok(media, 'a prefers-reduced-motion block');
  for (const sel of animated) {
    assert.ok(stilled(media[1]).includes(sel), `prefers-reduced-motion stills ${sel}`);
    assert.ok(setting.includes(`html.reduce-motion ${sel}`), `Reduce motion stills ${sel}`);
  }
});
