// Browser HUD presentation and packaging icons. No gameplay caller imports this
// module: native HUDs draw the shared state themselves.
import { heartQuarters } from './hud-state.js';
import { badgeLine, escapeHtml, keysHtml, keyBadge } from './prompt-keys.js';
const PROMPT_ALONE = /^(E|SPACE|X \/ □|A \/ ×|B \/ ○|Y \/ △)$/;

// One inked heart (a 20 x 18 box): the outline drawn thick in the ink, the fill in quarters (the quadrants
// round the middle: bottom left, top left, top right, bottom right, as a clock fills), a cream highlight.
const HEART = 'M10 17.2 C 6.2 14.1 1.4 10.6 1.4 6.1 C 1.4 3.2 3.6 1.2 6.1 1.2 C 7.8 1.2 9.2 2.2 10 3.6 C 10.8 2.2 12.2 1.2 13.9 1.2 C 16.4 1.2 18.6 3.2 18.6 6.1 C 18.6 10.6 13.8 14.1 10 17.2 Z';
const QUAD = ['M0 9H10V18H0Z', 'M0 0H10V9H0Z', 'M10 0H20V9H10Z', 'M10 9H20V18H10Z'];
/**
 * The hearts as one inline SVG (DOM-free: main.js puts it into #health .hearts, the tests read it): a heart
 * per container, each filled by its quarters; the last one pulses when `low`. Part-filled hearts show their
 * quarter lines, so a quarter reads at any size.
 */
export function heartsSvg(hearts, max, { low = false } = {}) {
  const qs = heartQuarters(hearts, max), W = 22;
  const body = qs.map((n, i) => {
    const id = `hq${i}`;
    const fill = n >= 4 ? `<path d="${HEART}" class="hf"/>` : n > 0 ? `<clipPath id="${id}"><path d="${QUAD.slice(0, n).join('')}"/></clipPath><path d="${HEART}" class="hf" clip-path="url(#${id})"/>` : '';
    const ticks = n > 0 && n < 4 ? '<path d="M10 3.6V17.2M1.6 9H18.4" class="hq"/>' : '';
    const last = low && n > 0 && (i === qs.length - 1 || qs[i + 1] === 0);
    return `<g transform="translate(${i * W} 0)" class="h${n === 0 ? ' empty' : ''}${last ? ' low' : ''}" data-q="${n}"><path d="${HEART}" class="he"/>${fill}${ticks}<path d="M5.2 4.4 C 4 4.9 3.4 6 3.5 7.2" class="hl"/><path d="${HEART}" class="ho"/></g>`;
  }).join('');
  return `<svg viewBox="-1 -1 ${qs.length * W} 20" width="${qs.length * W}" height="20" aria-hidden="true">${body}</svg>`;
}

/**
 * The potion's corked flask beside the hearts (index.html #health .potion, the same markup): cream glass, the red
 * draught, an ink outline, a glint. An engine draws it as a PNG made from this (scripts/engine-bundle.mjs: hud-potion).
 */
export const POTION_SVG = '<svg viewBox="0 0 14 18" aria-hidden="true"><path d="M5 1.2h4v1.6H5z" fill="#b07a45" stroke="#2b211f" stroke-width="1.2"/><path d="M5.3 2.8h3.4v3.1c2.6 0.8 4.3 3 4.3 5.7 0 3.4-2.7 5.6-6 5.6s-6-2.2-6-5.6c0-2.7 1.7-4.9 4.3-5.7z" fill="#f7ecd2"/><path d="M1.4 10.6c1.6-0.9 3.4-0.2 5.6 0.2s3.9-0.2 5.6-0.7c0.3 3.4-2.4 6.1-5.6 6.1s-5.9-2.4-5.6-5.6z" fill="#d9503f"/><path d="M5.3 2.8h3.4v3.1c2.6 0.8 4.3 3 4.3 5.7 0 3.4-2.7 5.6-6 5.6s-6-2.2-6-5.6c0-2.7 1.7-4.9 4.3-5.7z" fill="none" stroke="#2b211f" stroke-width="1.5" stroke-linejoin="round"/><path d="M3.6 9.6c-0.6 0.8-0.8 1.7-0.6 2.6" fill="none" stroke="#fff4dc" stroke-width="1.1" stroke-linecap="round"/></svg>';

/** Presentation only: keep a single scout line single; separate its existing mark from its words. */
export function questCueHtml(text) {
  const split = text.indexOf('\n'), goal = split < 0 ? '' : text.slice(0, split), step = split < 0 ? text : text.slice(split + 1);
  const mark = step.startsWith('◇ ') ? '◇' : '◆';
  const words = /^[◆◇] /.test(step) ? step.slice(2) : step;
  return `<span class="qi" aria-hidden="true">${mark}</span><span class="qcopy">${goal ? `<small class="goal">${escapeHtml(goal)}</small>` : ''}<span class="step">${keysHtml(words)}</span></span>`;
}

/** The counter's two keys (index.html #keys), inked as the hearts are: brass, an ink outline, a cream glint. */
export const KEY_SVG = '<svg viewBox="0 0 14 22" aria-hidden="true"><path d="M5.8 9.2V20.6H8.2V19.9H10.4V18.2H8.2V16.9H11.2V15H8.2V9.2Z" fill="#d6a94a" stroke="#2b211f" stroke-width="1.4" stroke-linejoin="round"/><circle cx="7" cy="5.6" r="4.3" fill="#d6a94a" stroke="#2b211f" stroke-width="1.5"/><circle cx="7" cy="5.6" r="1.55" fill="#2b211f"/><path d="M4.3 4.4c0.4-1 1.2-1.7 2.2-1.9" fill="none" stroke="#fff4dc" stroke-width="1" stroke-linecap="round"/></svg>';
export const GREAT_KEY_SVG = '<svg viewBox="0 0 16 26" aria-hidden="true"><path d="M6.6 11.4V24.6H9.4V23.6H12.6V21.4H9.4V19.9H13.4V17.6H9.4V15.9H11.8V14H9.4V11.4Z" fill="#c9903a" stroke="#2b211f" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="6.6" r="5.4" fill="#c9903a" stroke="#2b211f" stroke-width="1.5"/><circle cx="8" cy="6.6" r="2.6" fill="#3fae9a" stroke="#2b211f" stroke-width="1.2"/><path d="M4.6 5c0.5-1.3 1.5-2.1 2.8-2.4" fill="none" stroke="#fff4dc" stroke-width="1" stroke-linecap="round"/></svg>';

/** Update browser markup/classes without owning cue state or visibility timing. */
export function renderCue(el, text, kind, lead, previousText, previousKind) {
  if (text && (text !== previousText || kind !== previousKind)) {
    // (the place name is a plain line; a prompt badges its button: native-pad.js renames it in place)
    // (the scout's find: its goal small, over its next step: findSummary)
    el.innerHTML = kind === 'place' ? `<span>${escapeHtml(text)}</span>`
      : kind === 'quest' ? questCueHtml(text)
      : lead?.rest ? `${keyBadge(lead.key)}<span class="hint-copy">${keysHtml(lead.rest)}</span>` : badgeLine(text);
    el.classList.toggle('has-key', !!lead?.rest);
    el.classList.toggle('place', kind === 'place');
    el.classList.toggle('glyph', !kind && PROMPT_ALONE.test(text));   // (a prompt as its button alone: hints subtle or off)
    el.classList.toggle('quest', kind === 'quest');
  }
  if (!!text !== !!previousText) el.classList.toggle('show', !!text);
}
