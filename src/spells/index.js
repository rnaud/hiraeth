import { SPELLS, isSpell } from './data.js';
import { spellBook, wireSpellAwards } from './book.js';
import { SpellCaster } from './caster.js';
import { SpellHud } from './hud.js';
import { verbKey, verbButton } from '../remap.js';
import { inputKind } from '../prompt-keys.js';

export { SPELLS, SPELL_ORDER, SPELL_COOLDOWN, TEMPLE_SPELL, isSpell } from './data.js';
export { spellBook, awardSpells, spellMenu } from './book.js';

// The spells in a running game (docs/systems/spells.md), wired the same way by the page (main.js) and the engines
// (engine/game.js): the awards as temples are resolved, the caster and its chip, the menu's choice.
//
//   const spells = wireSpells({ scene, player, foes: () => foes, tool, sound, game, toast, touch, input, padText })
//   spells.update(dt, input, paused)   each frame, after the foes
//   spells.select(id)                  the game menu's Items: a spell chosen (true: it was a spell)
//   spells.caster                      (tests, the dev tools)

/** How the spell is cast, for the hands on the game: the pad's chord, the keyboard's key, the touch button. */
export function castKeyText(kind, { guard = 'LB / L1', blade = 'RB / R1', key = 'Y' } = {}) {
  if (kind === 'pad') return `${guard} + ${blade}`;
  if (kind === 'touch') return 'the ✺ button';
  return key;
}

/** The cast as the player's hands are on the game now (their buttons and keys: src/remap.js). */
export const castNow = (kind = inputKind()) => castKeyText(kind, { guard: verbButton('guard'), blade: verbButton('blade'), key: verbKey('spell') });

export function wireSpells({ level = null, scene = null, player = null, foes = () => null, tool = null, sound = null, game, toast = () => {}, touch = false, input = null, hud = undefined, castText = () => castNow() } = {}) {
  const H = hud === undefined ? new SpellHud({ touch, input }) : hud;
  const caster = new SpellCaster({ scene, player, foes, tool, sound, game, toast, hud: H });
  level?.noShadow?.push?.(caster.fx);   // (light, not things: no shadow on the ground, as the gadgets' effects)
  // a temple resolved: its spell, and its name and how to cast it said (the toasts wait for the guardian's ending)
  const offAwards = wireSpellAwards(game, (id) => {
    const S = SPELLS[id];
    toast(`Spell learned: ${S.name}. ${castText()} casts it.`);
    sound?.chime?.();
  });
  const book = spellBook(game);
  return {
    caster, book,
    update: (dt, input, paused, hidden) => caster.update(dt, input, paused, hidden),
    isSpell,
    select(id) {
      if (!isSpell(id)) return false;
      if (book.select(id)) sound?.chime?.();   // (one recovery for all: switching never skips it; a spell working goes on)
      return true;
    },
    dispose() { offAwards?.(); caster.dispose(); },
  };
}
