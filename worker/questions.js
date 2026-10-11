// Questions for the author (the `needs-author` label): the coordinator asks on an issue, the Notes page shows the
// question under "Needs you", and the author answers there. docs/systems/notes.md "Questions for the author".
//
// The block, in the issue's body or a comment (the latest valid block on the issue wins):
//
//   <!-- question -->
//   **Question:** <one or two lines>
//   <!-- options: single -->        (or multi; the options are optional: none is a free-text question)
//   - [ ] <option one>
//   - [ ] <option two>
//   <!-- /question -->
//
// The context is the paragraph directly above the block (its lines up to the first blank one).
// Answered (it leaves Needs you): a box ticked in the block (`- [x]`, as on GitHub), or any later comment on the issue.
// An answer from the Notes page posts its comment and ticks the chosen boxes in the block, so both views agree.
//
//   GET  /api/notes/questions               the notebook (cookie)  → { questions: [{ number, title, url, question }] }
//   POST /api/notes/questions/<n>/answer    the notebook (cookie)  { choices, text } → { answered: n }
//        a comment "**Answer:** …", then `needs-author` off and `answered` on.

export const NEEDS_AUTHOR = 'needs-author';
export const ANSWERED = 'answered';
const MAX_ISSUES = 20;              // (one GitHub call each for its comments: a Worker has 50 subrequests)
const CONTEXT_LINES = 12;
// Only the repository's people ask: on a public repository anyone may comment, so a stranger's block is ignored.
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const BLOCK = /<!--\s*question\s*-->([\s\S]*?)<!--\s*\/question\s*-->/g;
const OPTIONS = /^<!--\s*options:\s*(\w+)\s*-->$/;
const OPTION = /^[-*]\s+\[([ xX])\]\s+(.+)$/;

/** One block's inside → { question, mode, options } or null when it isn't in the format. */
function parseBlock(inside) {
  const lines = inside.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = /^\*\*Question:\*\*\s*(.*)$/.exec(lines[0] ?? '');
  if (!first) return null;
  const question = [first[1]];
  let i = 1;
  while (i < lines.length && !OPTIONS.test(lines[i]) && !OPTION.test(lines[i])) question.push(lines[i++]);
  if (question.length > 3) return null;
  const text = question.join('\n').trim();
  if (!text) return null;
  if (i === lines.length) return { question: text, mode: 'text', options: [], ticked: [] };
  const mode = OPTIONS.exec(lines[i])?.[1];
  if (mode !== 'single' && mode !== 'multi') return null;
  const options = [], ticked = [];
  for (i++; i < lines.length; i++) {
    const option = OPTION.exec(lines[i]);
    if (!option) return null;
    options.push(option[2].trim());
    if (option[1] !== ' ') ticked.push(option[2].trim());
  }
  if (!options.length || new Set(options).size !== options.length) return null;
  return { question: text, mode, options, ticked };
}

/** The paragraph directly above a block: its lines up to the first blank one, without markup comments. */
function contextAbove(before) {
  const lines = before.replace(/\s+$/, '').split('\n');
  const paragraph = [];
  for (let i = lines.length - 1; i >= 0 && lines[i].trim() && paragraph.length < CONTEXT_LINES; i--) {
    if (/^<!--.*-->$/.test(lines[i].trim())) break;
    paragraph.unshift(lines[i].trim());
  }
  return paragraph.join('\n');
}

const normal = (text) => text.replace(/\r\n?/g, '\n');
/** Every valid block in one text (line endings made \n), with where it is: [{ block, start, end }]. */
function blocksIn(text) {
  const source = normal(text), found = [];
  let end = 0;
  for (const match of source.matchAll(BLOCK)) {
    const block = parseBlock(match[1]);
    if (block) found.push({ block: { context: contextAbove(source.slice(end, match.index)), ...block }, start: match.index, end: match.index + match[0].length });
    end = match.index + match[0].length;
  }
  return found;
}

/** Every valid question block in one text, in order: [{ context, question, mode, options, ticked }]. */
export function parseQuestions(text) {
  return typeof text === 'string' ? blocksIn(text).map((b) => b.block) : [];
}

/**
 * The latest valid block across texts given oldest first (the body, then the comments), or null:
 * { ...block, answered, source, start, end } — answered when a box is ticked or a later text exists;
 * source is the text's index, start / end the block's place in it (line endings made \n).
 */
export function latestQuestion(texts) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const blocks = typeof texts[i] === 'string' ? blocksIn(texts[i]) : [];
    if (!blocks.length) continue;
    const { block, start, end } = blocks[blocks.length - 1];
    return { ...block, answered: block.ticked.length > 0 || i < texts.length - 1, source: i, start, end };
  }
  return null;
}

/** The text with the chosen boxes of the block at start..end ticked. */
export function tickChoices(text, start, end, choices) {
  const source = normal(text);
  const inside = source.slice(start, end).split('\n').map((line) => {
    const option = OPTION.exec(line.trim());
    return option && choices.includes(option[2].trim()) ? line.replace(/\[ \]/, '[x]') : line;
  }).join('\n');
  return source.slice(0, start) + inside + source.slice(end);
}

const labelNames = (issue) => (issue.labels ?? []).map((l) => typeof l === 'string' ? l : l?.name).filter((l) => typeof l === 'string');
const trusted = (item) => TRUSTED.has(item?.author_association);

/** The comment the answer posts. */
export function answerBody(choices, text) {
  const own = text.trim();
  const head = choices.length ? choices.join('; ') : own;
  return `**Answer:** ${head}${choices.length && own ? `\n\n${own}` : ''}\n\nAnswered from the Hiraeth notebook.`;
}

/** An issue's question: its body and its newest comments (the last page of them), the repository's people only. */
async function issueQuestion(ctx, issue) {
  const sources = trusted(issue) ? [{ text: issue.body ?? '', edit: `${ctx.api}/${issue.number}` }] : [];
  const count = Number.isSafeInteger(issue.comments) ? issue.comments : 0;
  if (count > 0) {
    const page = Math.ceil(count / 100);
    const response = await ctx.github(`${ctx.api}/${issue.number}/comments?per_page=100&page=${page}`);
    if (!response.ok) return { error: response };
    const comments = await response.json();
    if (!Array.isArray(comments)) throw new Error('comments');
    for (const c of comments) if (trusted(c)) sources.push({ text: c.body ?? '', edit: Number.isSafeInteger(c.id) ? `${ctx.api}/comments/${c.id}` : null });
  }
  const found = latestQuestion(sources.map((x) => x.text));
  if (!found) return { question: null, answered: false };
  const { answered, source, start, end, ...question } = found;
  return { question, answered, where: { ...sources[source], start, end } };
}

function view(ctx, issue, question) {
  return { number: issue.number, title: issue.title, url: `https://github.com/${ctx.repository}/issues/${issue.number}`, labels: labelNames(issue), question };
}

/** The questions' routes, signed in already (worker/issues.js): ctx { github, githubFailure, api, repository, json, failure }. */
export async function handleQuestions(request, ctx, number, body) {
  const { json, failure } = ctx;
  if (number === null) {
    const response = await ctx.github(`${ctx.api}?state=open&labels=${NEEDS_AUTHOR}&sort=created&direction=asc&per_page=${MAX_ISSUES}`);
    if (!response.ok) return ctx.githubFailure(response);
    const issues = await response.json();
    if (!Array.isArray(issues)) return failure(502, 'The questions could not be loaded. Please try again.');
    const open = issues.filter((i) => !i.pull_request && Number.isSafeInteger(i.number));
    const found = await Promise.all(open.map((i) => issueQuestion(ctx, i)));
    const failed = found.find((f) => f.error);
    if (failed) return ctx.githubFailure(failed.error);
    // (answered on GitHub already, by a tick or a later comment: the label waits for the coordinator)
    return json({ questions: open.map((i, k) => [i, found[k]]).filter(([, f]) => !f.answered).map(([i, f]) => view(ctx, i, f.question)) });
  }

  // ---- an answer: checked against the question as it stands, then the comment, then the labels
  const choices = body?.choices ?? [], text = body?.text ?? '';
  if (!Array.isArray(choices) || choices.length > 20 || !choices.every((c) => typeof c === 'string' && c.length <= 500)
    || typeof text !== 'string' || text.length > 4000 || CONTROL.test(text) || choices.some((c) => CONTROL.test(c) || /[\r\n]/.test(c))) {
    return failure(400, 'Please pick from the options or write an answer, up to 4,000 characters.');
  }
  if (!choices.length && !text.trim()) return failure(400, 'Pick an option or write an answer first.');
  const got = await ctx.github(`${ctx.api}/${number}`);
  if (got.status === 404 || got.status === 410) return failure(404, 'That issue is gone. Refresh the list.');
  if (!got.ok) return ctx.githubFailure(got);
  const issue = await got.json();
  if (issue.pull_request || issue.state !== 'open' || !labelNames(issue).includes(NEEDS_AUTHOR)) {
    return failure(409, 'This question was already answered or closed. Refresh the list.');
  }
  const asked = await issueQuestion(ctx, issue);
  if (asked.error) return ctx.githubFailure(asked.error);
  const q = asked.question;
  if (asked.answered) return failure(409, 'This question was already answered on GitHub. Refresh the list.');
  if (choices.length && (!q || !choices.every((c) => q.options.includes(c)) || new Set(choices).size !== choices.length || (q.mode === 'single' && choices.length > 1))) {
    return failure(409, 'The question has changed. Refresh the list and answer again.');
  }
  const posted = await ctx.github(`${ctx.api}/${number}/comments`, { method: 'POST', body: JSON.stringify({ body: answerBody(choices, text) }) });
  if (!posted.ok) return ctx.githubFailure(posted, true);
  // (the answer is on GitHub now: an edit or a label that fails is said as such, so the author doesn't answer twice)
  // The chosen boxes ticked in the block too, where it is (the body or its comment).
  let ticked = { ok: true };
  if (choices.length && asked.where.edit) {
    const text = tickChoices(asked.where.text, asked.where.start, asked.where.end, choices);
    ticked = await ctx.github(asked.where.edit, { method: 'PATCH', body: JSON.stringify({ body: text }) });
  }
  const removed = await ctx.github(`${ctx.api}/${number}/labels/${NEEDS_AUTHOR}`, { method: 'DELETE' });
  const added = await ctx.github(`${ctx.api}/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels: [ANSWERED] }) });
  if (!ticked.ok || !(removed.ok || removed.status === 404) || !added.ok) {
    return failure(502, 'Your answer was posted, but the issue could not be fully updated. Check it on GitHub.');
  }
  return json({ answered: number });
}
