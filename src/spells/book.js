import { SPELLS, SPELL_ORDER, TEMPLE_SPELL, isSpell } from './data.js';

// The spells the traveller knows and the one chosen, kept in the save as game flags (src/game-state.js):
//   spell.<id>       true: earned (its temple's guardian resolved)
//   spell.selected   the spell LB / L1 + RB / R1 casts
// Earned when a temple's `temple.<id>.done` is set (wireSpellAwards), and for a save that had resolved those
// temples before the spells existed, as it loads (src/save-migrate.js step 31: awardSpells).
//
//   const book = spellBook(game)
//   book.owned() → ['ward', 'tide']   book.has('ward')   book.grant('ward')   book.selected()   book.select('tide')

/**
 * The spells a save's flags have earned and not yet been given, given (in place): each resolved temple's, and a
 * choice if none is made. Pure on the flags; returns the ids given.
 */
export function awardSpells(flags) {
  const given = [];
  if (!flags) return given;
  for (const [temple, id] of Object.entries(TEMPLE_SPELL)) {
    if (flags[`temple.${temple}.done`] && !flags[`spell.${id}`]) { flags[`spell.${id}`] = true; given.push(id); }
  }
  if (!isSpell(flags['spell.selected']) || !flags[`spell.${flags['spell.selected']}`]) {
    const first = SPELL_ORDER.find((id) => flags[`spell.${id}`]);
    if (first) flags['spell.selected'] = first;
  }
  return given;
}

/** The spell book over a game state (game.flag / game.set). */
export function spellBook(game) {
  const book = {
    has: (id) => isSpell(id) && !!game?.flag?.(`spell.${id}`),
    owned: () => SPELL_ORDER.filter((id) => book.has(id)),
    /** The spell chosen (one owned), or the first owned, or null. */
    selected() {
      const s = game?.flag?.('spell.selected');
      return book.has(s) ? s : book.owned()[0] ?? null;
    },
    /** Earn a spell (and choose it, if none was); true if it is new. */
    grant(id) {
      if (!isSpell(id) || book.has(id)) return false;
      game.set(`spell.${id}`, true);
      if (!book.has(game.flag('spell.selected'))) game.set('spell.selected', id);
      return true;
    },
    /** Choose an owned spell; true if it changed. */
    select(id) {
      if (!book.has(id) || book.selected() === id) return false;
      game.set('spell.selected', id);
      return true;
    },
    /** The next owned spell after the chosen one (dir -1: before), round again. */
    next(dir = 1) {
      const list = book.owned(), at = list.indexOf(book.selected());
      return list.length ? list[(at + dir + list.length) % list.length] : null;
    },
    revoke(id) { if (book.has(id)) game.set(`spell.${id}`, null); if (game.flag('spell.selected') === id) game.set('spell.selected', book.owned()[0] ?? null); },
  };
  return book;
}

/**
 * Give each temple's spell as it is resolved (its `temple.<id>.done` flag set: src/temples/runtime.js
 * onBossResolved); `onGrant(id)` hears each new one (the toast that names it). Returns an unsubscribe function.
 */
export function wireSpellAwards(game, onGrant = () => {}) {
  const book = spellBook(game);
  const off = game.on('flag', ({ name, value } = {}) => {
    const m = /^temple\.(\w+)\.done$/.exec(name ?? '');
    const id = m && value ? TEMPLE_SPELL[m[1]] : null;
    if (id && book.grant(id)) onGrant(id);
  });
  // (a save given its spells before this ran: the migration's, or a flag set while nothing listened)
  for (const [temple, id] of Object.entries(TEMPLE_SPELL)) if (game.flag(`temple.${temple}.done`)) book.grant(id);
  return off;
}

/** The Items panel's spells (src/game-menu-data.js itemsData): each owned one, the chosen one in use. */
export function spellMenu(game) {
  const book = spellBook(game), sel = book.selected();
  return book.owned().map((id) => ({ id, name: SPELLS[id].name, text: SPELLS[id].text, glyph: SPELLS[id].glyph, color: SPELLS[id].ink ?? SPELLS[id].color, inUse: id === sel }));
}
