// The game's key phrase: "something of value", the father's charge (src/story/charge.js). Wherever it is
// said on the screen (the prologue's voicemail, a later recording, a conversation, an answer you pick, a
// balloon) it is lettered the same way: bold, in the charge's gold, with its ✦ (index.html `em.value`,
// src/ship/cinema.js). Written `*something of value*` in a line it is also stressed by the voice
// (src/story/voice.js reads the stars); written plainly it is still lettered as the key phrase.
// Pure: text in, text out.

export const KEY_PHRASE = 'something of value';
const RE = /\*(something of value)\*|(something of value)/gi;

/** Whether a line says the key phrase. */
export const saysKeyPhrase = (text) => String(text ?? '').toLowerCase().includes(KEY_PHRASE);

/**
 * Letter the key phrase: html, each saying of it in `<em class="value">`; plain, the words alone (its stars
 * dropped). Stars round anything else are left for the caller's own highlights.
 */
export function markKeyPhrase(text, html = true) {
  return String(text ?? '').replace(RE, (m, starred, bare) => {
    const w = starred ?? bare;
    return html ? `<em class="value">${w}</em>` : w;
  });
}
