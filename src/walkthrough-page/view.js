// The walkthrough page's drawing (walkthrough.html, src/walkthrough-page/main.js; issue #777): the guide from a new game to
// the true ending, part by part (each world, home, the Lantern, home again) and each temple step by step, drawn from
// src/walkthrough-page/steps.js, the same steps tests/playthrough.test.js plays every day (tests/walkthrough.js). Each step
// names the test that proves it and how the test does it (HOW); with the daily run's result (walkthrough-status.json, its
// `status`) each step is marked passed or broken. Pure: node draws it in tests/walkthrough-page.test.js.
import { WALKTHROUGH, HOW, PROOF, stepsOf } from './steps.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** The buttons in a step's words ("A / ×", "RT / R2", "LB / L1", "View", "Menu") as small badges. */
const PROMPT = /\b(A \/ ×|B \/ ○|X \/ □|Y \/ △|RT \/ R2|LT \/ L2|RB \/ R1|LB \/ L1|L3|R3|D-pad [↑↓←→]|View|Menu)(?![\w])/g;
export const words = (s) => esc(s).replace(PROMPT, '<b class="key">$1</b>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
const when = (s) => (s ? `${String(s).replace('T', ' ').slice(0, 16)} UTC` : '?');
const anchor = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A part's status from the daily run (statusFile in tests/walkthrough.js), by step index: true, false or undefined. */
function marksOf(status, part) {
  const p = status?.parts?.find((x) => x.part === part.id);
  return p ? stepsOf(part).map((s, i) => (p.steps[i]?.id === s.id ? p.steps[i].ok : undefined)) : [];   // (a step changed since that day: no mark)
}

/**
 * The page: { nav, main, count }. `status`: the daily run's walkthrough-status.json, or null (no marks; the page says
 * where they come from).
 */
export function walkthroughPage({ parts = WALKTHROUGH, status = null } = {}) {
  let count = 0;
  const nav = parts.map((p) => `<a href="#${anchor(p.id)}">${esc(p.short ?? p.title)}</a>`).join('');
  const body = parts.map((p, k) => {
    const marks = marksOf(status, p);
    let i = 0;
    const rows = [];
    let list = [];
    const flush = () => { if (list.length) rows.push(`<ol class="steps" start="${i - list.length + 1}">${list.join('')}</ol>`); list = []; };
    for (const s of p.steps) {
      if (!Array.isArray(s)) {
        flush();
        if (s.temple) {
          rows.push(`<h4 class="temple" id="${anchor(`${p.id}-${s.temple}`)}">${esc(s.name)}<small>temple</small></h4>`
            + (s.about ? `<p class="about">${words(s.about)}</p>` : '')
            + `<p class="also">Also proven: every ball rolled by real hits, plates stood on, weights carried, in <code>${esc(PROOF.temple.file)}</code> › “${esc(PROOF.temple.name(s.temple, s.name))}”; the guardian’s fight from three stances at 60 and 30 frames a second in <code>${esc(PROOF.guardian.file)}</code> › “${esc(PROOF.guardian.name(s.temple, s.name))}”.</p>`);
        } else rows.push(`<h4 class="sub">${esc(s.part)}</h4>${s.about ? `<p class="about">${words(s.about)}</p>` : ''}`);
        continue;
      }
      const [id, how, say, note] = s;
      const m = marks[i];
      i++; count++;
      const mark = m === true ? '<span class="mark ok" title="passed in the last daily run">✓</span>' : m === false ? '<span class="mark bad" title="broke in the last daily run">✗</span>' : '';
      list.push(`<li id="${anchor(`${p.id}-${i}`)}" class="${m === false ? 'broke' : ''}"><p>${mark}${words(say)}</p>`
        + `${note ? `<p class="note">${words(note)}</p>` : ''}`
        + `<p class="proof"><code>${esc(PROOF.route.file)}</code> › “${esc(p.test)}” · step <code>${esc(id)}</code> · <span class="how" title="${esc(HOW[how]?.long ?? '')}">${esc(HOW[how]?.short ?? how)}</span></p></li>`);
    }
    flush();
    const ps = status?.parts?.find((x) => x.part === p.id);
    const state = ps ? (ps.ok ? '<span class="state ok">passed in the last daily run</span>' : `<span class="state bad">broke in the last daily run: ${esc(ps.message)}</span>`) : '';
    return `<section class="part" id="${anchor(p.id)}"><div class="head"><h3><span class="n">${k + 1}</span>${esc(p.title)}</h3>${state}</div>`
      + (p.intro ? `<p class="intro">${words(p.intro)}</p>` : '')
      + rows.join('')
      + (p.extras?.length ? `<details class="extras"><summary>Off the route (optional, not part of the daily run)</summary><ul>${p.extras.map((x) => `<li>${words(x)}</li>`).join('')}</ul></details>` : '')
      + '</section>';
  }).join('');
  const legend = `<details class="legend"><summary>How the daily run plays each step</summary><dl>${Object.entries(HOW).map(([k, v]) => `<div><dt>${esc(v.short)}</dt><dd>${esc(v.long)}</dd></div>`).join('')}</dl></details>`;
  const run = status ? `<p class="run">Last daily run: ${status.run ? `<a href="${esc(status.run)}">${esc(when(status.at))}</a>` : esc(when(status.at))}${status.rev ? ` (revision <code>${esc(status.rev)}</code>)` : ''}: ${status.ok ? 'every step passed' : 'some steps broke (marked ✗)'}.</p>`
    : '<p class="run">This copy has no daily result to show (<code>walkthrough-status.json</code>, written by the daily run beside its evidence). The steps are still the ones it plays.</p>';
  return { nav, count, main: `<section class="top"><p>${words(INTRO)}</p>${run}${legend}</section>${body}` };
}

const INTRO = 'How to finish Hiraeth, from a new game to the true ending: every world in the route’s order, its main quest, and every temple step by step. Every step below is one the game is played through every day by a test (tests/playthrough.test.js): the same steps, in the same order, done the same way. If the game changes and a step no longer works, that day’s run fails at that step. Buttons are written Xbox / PlayStation. X / □ talks, uses, opens and picks up. A / × jumps (again in the air: the double jump; held: the wings). RB / R1 cuts with the blade and LB / L1 guards. RT / R2 uses the gadget in hand, the gun’s shot or push (D-pad ↑ picks the gadget or the gun’s mode). Y / △ whistles. D-pad → asks Plumb, the scout, where to go next.';
