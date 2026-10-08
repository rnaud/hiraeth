import { FOES } from './foes.js';

// The Arena's foe list (docs/systems/foes.md, "The Arena"): a tab on the left edge that opens a list of every foe
// kind. Choose one and the waves stop: it comes in ahead of you, and again each time it falls (practice). "Waves"
// brings the waves back. `?level=arena&foe=crab` starts on one kind. Paper and ink, as the dev menu.
//
//   const spawner = mountFoeSpawner({ foes, kind })   (src/main.js, in a world whose level.foes.waves is set)

const CSS = `
#foe-spawner { position: fixed; left: calc(10px + env(safe-area-inset-left, 0px)); top: 14%; z-index: 30; font: 12px ui-monospace, Menlo, monospace; color: #2b211f; }
#foe-spawner > button.tab { writing-mode: vertical-rl; padding: 10px 5px; letter-spacing: .2em; }
#foe-spawner button { font: inherit; background: #fffaf0; border: 2px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; cursor: pointer; color: #2b211f; }
#foe-spawner button.on { background: #f2c54b; }
#foe-spawner .list { display: none; margin-top: 6px; padding: 8px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 4px 4px 0 #2b211f; max-height: calc(80vh - 60px); overflow: auto; width: 176px; }
#foe-spawner.open .list { display: grid; gap: 4px; }
#foe-spawner .list button { text-align: left; padding: 5px 8px; min-height: 28px; }
#foe-spawner .list small { opacity: .55; float: right; }
#foe-spawner h3 { margin: 0 0 2px; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #7a3a35; }
`;

/** The kinds in the list, in the order they are met: the ink first, then each world's own. */
export const SPAWN_KINDS = Object.keys(FOES);

export function mountFoeSpawner({ foes, kind = null } = {}) {
  if (kind && FOES[kind]) foes.setPractice(kind);
  if (typeof document === 'undefined') return null;
  if (!document.getElementById('foe-spawner-css')) { const st = document.createElement('style'); st.id = 'foe-spawner-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div');
  el.id = 'foe-spawner';
  const rows = SPAWN_KINDS.map((k) => `<button data-kind="${k}">${FOES[k].name}<small>${FOES[k].hp} hp</small></button>`).join('');
  el.innerHTML = `<button class="tab">FOES</button><div class="list"><h3>Spawn a foe</h3>${rows}<h3>Then</h3><button data-a="waves">Waves again</button><button data-a="clear">Clear the field</button></div>`;
  document.body.appendChild(el);
  const sync = () => { for (const b of el.querySelectorAll('[data-kind]')) b.classList.toggle('on', foes.practice?.kind === b.dataset.kind); el.querySelector('[data-a="waves"]').classList.toggle('on', !foes.practice); };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('tab')) el.classList.toggle('open');
    else if (b.dataset.kind) foes.setPractice(b.dataset.kind);
    else if (b.dataset.a === 'waves') foes.setPractice(null);
    else if (b.dataset.a === 'clear') foes.setPractice('');
    b.blur(); sync();
  });
  sync();
  return { el, dispose: () => el.remove() };
}
