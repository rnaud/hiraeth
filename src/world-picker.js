// The worlds list (L in play, Debug on the title and in the Start menu): every world, open,
// whatever you've found. Its cards are drawn here, for the game (src/main.js) and for the
// title's Debug entry, which shows the list alone (?worlds=1, src/boot.js) without building a world.

/** The cards (and Continue, to the world this save was left in) into the #picker element. */
export function fillPicker(picker, { levels, current = null, cont = null }) {
  if (cont) {
    const btn = document.createElement('a');
    btn.className = 'continue';
    btn.href = `?level=${cont.id}`;
    btn.textContent = `▶ Continue — ${cont.title}`;
    picker.querySelector('header').after(btn);
  }
  picker.querySelector('.cards').innerHTML = levels.map((l, i) => `
  <a class="card${l.id === current ? ' current' : ''}" href="?level=${l.id}">
    <img src="thumbs/${l.id}.jpg" alt="" onerror="this.style.visibility='hidden'" />
    <div class="txt">
      <div class="num">${i + 1}</div>
      <h2>${l.title}</h2>
      <div class="src">${l.source}</div>
      <p>${l.blurb}</p>
      <div class="moves">${l.moves}</div>
    </div>
  </a>`).join('');
}

/** The list alone, before any world is built: a card (or its number) loads that world; close goes back to the title. */
export async function showWorldsOnly(doc = document, win = window) {
  const [{ LEVELS, levelById }, { SaveGame }, { closeHint, inputKind }, { Controller, menuNavigate }, { padFaces }] = await Promise.all([
    import('./levels/index.js'), import('./ui.js'), import('./prompt-keys.js'), import('./controller.js'), import('./native-pad.js')]);
  const picker = doc.getElementById('picker');
  const saved = SaveGame.load()?.level;
  fillPicker(picker, { levels: LEVELS, cont: levelById(saved) ?? null });
  const hint = picker.querySelector('header .hint');
  if (hint) hint.textContent = inputKind() === 'keys' ? 'press a number · Esc for the title' : closeHint('');
  const toTitle = () => { win.location.href = win.location.pathname; };
  picker.querySelector('.close').addEventListener('click', toTitle);
  win.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyL') toTitle();
    const n = Number(e.key);
    if (n >= 1 && n <= LEVELS.length) win.location.search = '?level=' + LEVELS[n - 1].id;
  });
  // a controller: d-pad / stick move, A opens the world, B back to the title (as on the title, src/title.js)
  const controller = new Controller({
    context: () => 'menu',
    look: () => {}, faces: () => padFaces(),
    activity: () => doc.body.classList.add('controller'),
    navigate: (x, y) => menuNavigate(picker, x, y),
    scroll: (amount) => { picker.scrollTop += amount; },
    action: (name) => {
      if (name === 'back' || name === 'start' || name === 'select') toTitle();
      if (name === 'confirm') { if (picker.contains(doc.activeElement)) doc.activeElement.click(); else menuNavigate(picker, 0, 1); }
    },
  });
  let last = performance.now();
  const loop = (now) => {
    controller.update(Math.min((now - last) / 1000, 0.1), !doc.hidden && doc.hasFocus());
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  doc.getElementById('loading')?.remove();
  picker.classList.add('open');
}
