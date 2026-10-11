// The Notes page's "Needs you": the open `needs-author` issues, each with its question (worker/questions.js) and a way
// to answer it from here. Single: the options are buttons. Multi: checkboxes and Send. Always a free-text answer.
// Text only (textContent), never markup: the question comes from GitHub. docs/systems/notes.md.

function el(doc, tag, className, text) {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The page's title with the count of questions waiting: "(2) Hiraeth — Notes". */
export const pageTitle = (count, base = 'Hiraeth — Notes') => count ? `(${count}) ${base}` : base;

/**
 * One question's card. `answer({ choices, text })` returns a promise (the Worker's POST); while it runs every control
 * is disabled, and a failure is said on the card with the controls back.
 */
export function questionCard(doc, item, answer) {
  const li = el(doc, 'li', 'question-card'); li.dataset.number = String(item.number);
  const q = item.question;
  const head = el(doc, 'a', 'question-title', `#${Number(item.number)} ${item.title}`);
  head.href = `https://github.com/rnaud/hiraeth/issues/${Number(item.number)}`; head.target = '_blank'; head.rel = 'noopener noreferrer';
  li.append(head);
  if (q?.context) li.append(el(doc, 'p', 'question-context', q.context));
  li.append(el(doc, 'p', 'question-text', q ? q.question : 'No question block found on this issue. Read it on GitHub, or answer below.'));

  const controls = [];
  const error = el(doc, 'p', 'question-error');
  error.setAttribute('role', 'status');
  const free = el(doc, 'textarea', 'question-free');
  free.maxLength = 4000; free.rows = 2; free.placeholder = 'Or write your own answer';
  free.setAttribute('aria-label', `Or write your own answer to #${Number(item.number)}`);
  const checks = [];
  const busy = (on) => { for (const c of controls) c.disabled = on; li.classList.toggle('sending', on); };
  const submit = async (choices) => {
    const text = free.value.trim();
    if (!choices.length && !text) { error.textContent = q?.mode === 'multi' ? 'Tick an option or write an answer first.' : 'Write an answer first.'; free.focus(); return; }
    busy(true); error.textContent = '';
    try { await answer({ choices, text }); }
    catch (e) { error.textContent = e.message; busy(false); }
  };

  if (q?.mode === 'single') {
    const row = el(doc, 'div', 'question-options');
    for (const option of q.options) {
      const b = el(doc, 'button', 'question-option', option); b.type = 'button';
      b.addEventListener('click', () => submit([option]));
      row.append(b); controls.push(b);
    }
    li.append(row);
  } else if (q?.mode === 'multi') {
    const list = el(doc, 'div', 'question-checks');
    q.options.forEach((option, i) => {
      const label = el(doc, 'label', 'question-check');
      const box = el(doc, 'input'); box.type = 'checkbox'; box.value = option; box.id = `q${Number(item.number)}-${i}`;
      label.htmlFor = box.id;
      label.append(box, el(doc, 'span', '', option));
      list.append(label); checks.push(box); controls.push(box);
    });
    li.append(list);
  }
  const foot = el(doc, 'div', 'question-foot');
  const send = el(doc, 'button', 'question-send', q?.mode === 'multi' ? 'Send' : 'Send answer'); send.type = 'button';
  send.addEventListener('click', () => submit(checks.filter((c) => c.checked).map((c) => c.value)));
  controls.push(free, send);
  foot.append(free, send);
  li.append(foot, error);
  return li;
}
