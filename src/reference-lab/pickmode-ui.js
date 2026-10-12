// Pick mode on the page (reference-lab.html #pickmode; the logic is pickmode.js): "Pick all" at the top of To pick
// opens it full screen (the Fullscreen API, else the overlay fills the window), one batch at a time.
//
//   a click on a picture, or its number (1-9)   pick it, and on to the next batch at once
//   S or →  skip  ·  ←  back (to change a pick)  ·  X  none of them  ·  Z  the chosen one alone, full size
//   Enter   pick the focused one  ·  Esc  close the zoom, else leave Pick mode (leaving full screen does too)
//   a pad:  ← → choose, A pick, X none of them, Y zoom, LB back, RB skip, B close the zoom, then leave
import { PICK_WHY, PickSession, bestColumns, buildPickQueue, pickGridHtml, pickHeadHtml, progressText, shownCandidates } from './pickmode.js';
import { candidateSrc } from './view.js';

/**
 * o: { api(path, body) (the dev server), prompts() (the prompt documents), target() (the form's target folder, for a
 * batch with none), onClose() (the page redraws its batches) }. Returns { open, close, isOpen, key, pad }.
 */
export function installPickMode({ api, prompts, target = () => '', onClose = () => {} }) {
  const root = document.querySelector('#pickmode');
  const $ = (s) => root.querySelector(s);
  const grid = $('.pm-grid'), why = $('#pm-why'), zoom = $('.pm-zoom');
  const details = new Map();   // batch → its candidates.json (fetched once, again after a move)
  let session = null, shown = null, lastWorld = null, focusAt = 0, zoomAt = -1, busy = false, noteTimer = 0;

  const isOpen = () => root.classList.contains('open');
  const status = (text, bad = false) => { const s = $('.pm-status'); s.textContent = text; s.classList.toggle('bad', bad); };
  const detail = (batch) => {
    if (!details.has(batch)) details.set(batch, api(`batches/${encodeURIComponent(batch)}`).catch((e) => { details.delete(batch); throw e; }));
    return details.get(batch);
  };
  const preload = (batch) => detail(batch).then((m) => shownCandidates(m).forEach((c) => { const i = new Image(); i.src = candidateSrc(m.batch, c.file); })).catch(() => {});

  function note(text) {
    const n = $('.pm-note');
    n.textContent = text; n.classList.remove('gone');
    clearTimeout(noteTimer); noteTimer = setTimeout(() => n.classList.add('gone'), 3500);
  }
  function drawProgress() {
    const p = session.progress();
    $('.pm-progress').textContent = progressText(p);
    $('.pm-bar-prog i').style.width = `${p.total ? (100 * p.decided) / p.total : 100}%`;
  }
  // the pictures as large as the screen allows: the columns that give each the most area at the batch's aspect
  function layout() {
    const m = shown, n = grid.querySelectorAll('.pm-cand').length;
    if (!m || !n) { grid.style.gridTemplateColumns = ''; grid.style.gridAutoRows = ''; return; }
    const W = grid.clientWidth - 32, H = grid.clientHeight - 24, gap = 12, cap = 28;
    const cols = bestColumns(n, m.ar, W, H, { gap, cap }), rows = Math.ceil(n / cols);
    const [aw, ah] = String(m.ar ?? '16:9').split(':').map(Number), a = aw > 0 && ah > 0 ? aw / ah : 16 / 9;
    const iw = Math.max(80, Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows - cap) * a));
    grid.style.gridTemplateColumns = `repeat(${cols}, ${Math.floor(iw)}px)`;
    grid.style.gridAutoRows = `${Math.floor(iw / a + cap)}px`;
  }
  const cands = () => [...grid.querySelectorAll('.pm-cand')];
  function focusCand(i) {
    const list = cands();
    if (!list.length) return;
    focusAt = Math.max(0, Math.min(list.length - 1, i));
    list[focusAt].focus({ preventScroll: true });
  }

  async function draw() {
    const it = session.current;
    drawProgress();
    closeZoom();
    if (!it) {
      shown = null;
      $('.pm-what').innerHTML = pickHeadHtml(null);
      grid.innerHTML = `<p class="pm-empty">${session.queue.length ? 'Every batch here is decided. ← goes back to change one; Esc returns to the lab.' : 'Nothing to pick: every finished batch has a pick or a "none of them".'}</p>`;
      layout();
      return;
    }
    if (lastWorld && it.world !== lastWorld) note(`Now: ${it.world}`);
    else if (!lastWorld) note(`Starting with ${it.world}`);
    lastWorld = it.world;
    $('.pm-what').innerHTML = pickHeadHtml(it);
    grid.innerHTML = '<p class="pm-empty">Loading…</p>';
    why.value = PICK_WHY;
    let m;
    try { m = await detail(it.batch); } catch (e) { status(`${it.batch}: ${e.message}`, true); grid.innerHTML = `<p class="pm-empty">Could not load ${it.batch}: S skips it.</p>`; return; }
    if (session.current !== it) return;   // (moved on while it loaded)
    shown = m;
    $('.pm-what').innerHTML = pickHeadHtml(it, m);
    grid.innerHTML = pickGridHtml(m, it.picked);
    layout();
    focusCand(Math.max(0, shownCandidates(m).findIndex((c) => c.id === it.picked)));
    // the next one's pictures loaded while this one is looked at
    const nx = session.queue.find((q, i) => i > session.at && (q.state === 'open' || q.state === 'skipped'));
    if (nx) preload(nx.batch);
  }

  // every move: one at a time (a second press while the server answers is ignored), then the next batch drawn
  async function move(fn, done) {
    if (busy || !session) return;
    busy = true; root.classList.add('busy');
    const it = session.current;
    try {
      const r = await fn();
      if (it) details.delete(it.batch);
      if (done) status(done(r, it));
    } catch (e) { status(e.message, true); }
    finally { busy = false; root.classList.remove('busy'); }
    draw();
  }
  const reason = () => why.value.trim();
  function pickAt(i) {
    const c = shownCandidates(shown)[i];
    if (!c || !session?.current) return;
    move(() => session.pick(c.id, reason()), (r, it) => `Picked ${it.title}: ${c.id} → ${r?.file ?? ''}`);
  }
  // the server's pick takes the batch's own target, else the one the form names
  const pickApi = {
    pick: ({ batch, candidate, why: w }) => api('pick', { batch, candidate, why: w, target: session.queue.find((q) => q.batch === batch)?.target || target() || null }),
    unpick: (b) => api('unpick', b),
    reject: (b) => api('reject', b),
  };
  const reject = () => move(() => session.reject(why.value.trim() === PICK_WHY ? '' : reason()), (r, it) => `None of them: ${it.title}`);
  const skip = () => { if (!busy && session) { const it = session.current; session.skip(); status(it ? `Skipped ${it.title}: it comes back at the end.` : ''); draw(); } };
  const back = () => { if (!busy && session) { session.back(); status(session.current?.state === 'picked' ? 'A new pick replaces this one (its sheet is taken back).' : ''); draw(); } };

  // the zoom: one picture alone, full size (← → through the batch's others, its number or Enter picks it)
  const zoomOpen = () => zoom.classList.contains('open');
  function openZoom(i) {
    const list = shownCandidates(shown);
    if (!list.length) return;
    zoomAt = (i + list.length) % list.length;
    const c = list[zoomAt], p = shown.providers?.[c.provider] ?? {};
    zoom.querySelector('img').src = candidateSrc(shown.batch, c.file);
    zoom.querySelector('.pm-zcap').textContent = `${zoomAt + 1} of ${list.length} · ${p.label ?? c.provider} #${c.id.split('/').pop()} · Enter or ${zoomAt + 1} picks it · ← → the others · Z or Esc closes`;
    zoom.classList.add('open'); zoom.setAttribute('aria-hidden', 'false');
  }
  function closeZoom() { zoom.classList.remove('open'); zoom.setAttribute('aria-hidden', 'true'); zoomAt = -1; }

  async function open() {
    if (isOpen()) return;
    root.classList.add('open'); root.setAttribute('aria-hidden', 'false');
    try { await root.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* refused (no gesture, an iframe): the overlay fills the window */ }
    status('Loading the batches…');
    details.clear(); lastWorld = null;
    try {
      const [{ batches }, docs] = await Promise.all([api('batches'), prompts()]);
      session = new PickSession(buildPickQueue(batches, docs), pickApi);
      status('Click a picture or press its number to pick it; the next batch comes at once.');
    } catch (e) { session = new PickSession([], pickApi); status(e.message, true); }
    draw();
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('open'); root.setAttribute('aria-hidden', 'true');
    closeZoom();
    if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
    session = null; shown = null;
    onClose();
  }
  // Esc in full screen is the browser's (it leaves full screen and the page never sees the key): the zoom closes
  // first, staying in the window; else Pick mode ends
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement || !isOpen()) return;
    if (zoomOpen()) closeZoom(); else close();
  });
  addEventListener('resize', () => { if (isOpen()) layout(); });

  root.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('.pm-zoom')) { closeZoom(); return; }
    const z = t.closest('[data-pm-zoom]');
    if (z) { openZoom(shownCandidates(shown).findIndex((c) => c.id === z.dataset.pmZoom)); return; }
    const c = t.closest('[data-pm-cand]');
    if (c) { pickAt(shownCandidates(shown).findIndex((x) => x.id === c.dataset.pmCand)); return; }
    const b = t.closest('[data-pm]');
    if (!b) return;
    ({ back, skip, reject, exit: close, zoom: () => (zoomOpen() ? closeZoom() : openZoom(focusAt)) })[b.dataset.pm]?.();
  });
  root.addEventListener('focusin', (e) => { const i = cands().indexOf(e.target.closest?.('.pm-cand')); if (i >= 0) focusAt = i; });

  /** A key while Pick mode is open (main.js passes them all here then). */
  function key(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target === why) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); why.blur(); focusCand(focusAt); }
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (zoomOpen()) {
      e.preventDefault();
      if (k === 'Escape' || k === 'z') closeZoom();
      else if (k === 'ArrowLeft' || k === 'ArrowRight') openZoom(zoomAt + (k === 'ArrowRight' ? 1 : -1));
      else if (k === 'Enter') { const i = zoomAt; closeZoom(); pickAt(i); }
      else if (/^[1-9]$/.test(k)) { closeZoom(); pickAt(+k - 1); }
      return;
    }
    if (/^[1-9]$/.test(k)) { e.preventDefault(); pickAt(+k - 1); }
    else if (k === 's' || k === 'ArrowRight') { e.preventDefault(); skip(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (k === 'x' || k === 'Delete') { e.preventDefault(); reject(); }
    else if (k === 'z') { e.preventDefault(); openZoom(focusAt); }
    else if (k === 'Enter' && e.target.closest?.('.pm-cand')) { e.preventDefault(); pickAt(focusAt); }
    else if (k === 'Escape') { e.preventDefault(); close(); }
    else if (k === 'w') { e.preventDefault(); why.focus(); why.select(); }
  }
  /** A pad's move or button while Pick mode is open. */
  function pad(name, x = 0) {
    if (name === 'navigate') { if (!x) return; if (zoomOpen()) openZoom(zoomAt + x); else focusCand(focusAt + x); return; }
    if (zoomOpen()) {
      if (name === 'confirm') { const i = zoomAt; closeZoom(); pickAt(i); }
      else if (name === 'back' || name === 'y') closeZoom();
      return;
    }
    if (name === 'confirm') pickAt(focusAt);
    else if (name === 'back') close();
    else if (name === 'x') reject();
    else if (name === 'y') openZoom(focusAt);
    else if (name === 'tabPrev') back();
    else if (name === 'tabNext') skip();
  }
  return { open, close, isOpen, key, pad };
}
