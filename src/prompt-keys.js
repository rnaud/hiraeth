// Buttons in prompts, drawn as small round badges (index.html .key): the
// floating "use" prompt (src/story/index.js placePrompt) and the cue's
// prompts at the bottom of the screen (src/hud.js).
//
// The badge holds the button's name as plain text ("E", "X / □"), so
// native-pad.js, which rewrites text nodes, still turns it into the
// handheld's own letter ("X") and swaps A and B when asked.

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One button as a round badge. */
export const keyBadge = (label) => `<b class="key">${escapeHtml(label)}</b>`;

// a button name at the start of a prompt: "E go aboard", "B / ○ step outside", "A / × …"
const LEAD = /^(E|X \/ □|A \/ ×|B \/ ○|Y \/ △|RT \/ R2|LT \/ L2|RB \/ R1|LB \/ L1|L3) (?=\S)/;

/**
 * A status line as HTML: every " · "-separated part that starts with a
 * button name gets that name as a badge; the rest stays plain (escaped) text.
 */
export function badgeLine(text) {
  return String(text ?? '').split('\n').map((line) => line.split(' · ').map((part) => {
    if (part.startsWith('✦ ')) return `<span class="charge">${escapeHtml(part)}</span>`;   // the father's charge, in its own gold (src/story/charge.js)
    const m = part.match(LEAD);
    return m ? keyBadge(m[1]) + ' ' + escapeHtml(part.slice(m[0].length)) : escapeHtml(part);
  }).join(' · ')).join('\n');
}
