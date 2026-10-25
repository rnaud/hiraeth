# The makers' spells

Four workings the makers left at the hearts of four of their houses (issue #667). Each is given when that house's
guardian is resolved (`temple.<id>.done`), cast with **LB / L1 + RB / R1 pressed together** (the guard's and the
blade's buttons, as the player has them; **Y** on the keyboard, the **✺** button on a touch screen), and then
**30 s** to recover, one recovery for all four. One spell is chosen at a time, in the game menu's **Items** (View /
Select): the spells won are tiles after the gadgets, the chosen one *in use*, A / × on another ("Choose this spell")
chooses it. Code: `src/spells/` (`data.js` the four and their tuning, `book.js` the save, `caster.js` casting and the
effects, `hud.js` the chip, `index.js` `wireSpells`, made the same way by `main.js` and `engine/game.js`).

## The four, and why these

| Spell | House (world, place on the route) | What it does | Next to what it does not repeat |
|---|---|---|---|
| **Aerie ward** ◎ | the Aerie (Vael, 2nd) | gold rings close round him like a gyroscope; the next **two** blows, from any side, break on them; 12 s | the shield: front only, held, the blade's hand busy |
| **Slow tide** ◔ | the Whale-House (Underwater City, 5th) | a dome of slow water where he stands (8 m): foes inside move, wind up and strike at a **third** of their pace; 8 s | stilling: one foe a shot, stopped; the tide is a place, a crowd, slowed |
| **Engine shards** ✦ | the Engine-House (Buried Machine, 8th) | six shards circle him 2.2 m out and cut every foe they pass through, each once every 0.5 s; 6 s | the bombs and the spring boots' stomp: a blast that throws foes off; the shards stay with him and cut |
| **Mooring veil** ◌ | the Mooring-House (Floating City, 11th) | a curtain of light: foes lose him (as when he rides off), give up the chase, never notice him; 8 s, or until he cuts or shoots | the hush-cloth: quieter steps before a fight; the veil takes him out of one begun |

Spread along the route (2nd, 5th, 8th, 11th world) so the kit grows through the journey, each house's spell in its
own register: the Aerie's guard in the high wind, the whales' slow water, the engine's cutting gears, the moorers'
light. All four are the makers' high craft (rings, a clock-dome, machined shards, a light curtain: never organic). The
guardians are the makers' own: the tide, the shards and the veil pass over them; the ward still takes their blows.

## How each one touches the game

- **ward**: `player.absorb(amount, why)` (src/player.js `hurt`): true takes the blow. Never a fall, the water or a
  knock-out (`Infinity`).
- **tide**: `foes.slowAt(pos)` → the factor for a foe there (src/foes.js `Foes.update`): its own step, wind-up, strike
  and look run at that share of the world's time; its warning sound stretched to match.
- **shards**: `foes.hurt(f, 'blade', dir, { damage: 1, source: 'shards' })`, as a cut lands, each foe once a beat.
- **veil**: `player.veiled` (src/foes.js `Foe.update`: `lost`): chasing foes go home, idle ones never notice him. The
  blade swinging or the glove's shot (`tool:fire`) lifts it.

A press while recovering says "<name> recovers in N s." (once a second and a half) with the dry click; riding, down or
knocked out it does nothing and costs nothing. The chord (src/controller.js): both buttons pressed within
`SPELL_CHORD` (0.12 s) of each other send `PadSpell` for that frame, and neither the guard nor the blade until both
are let go; RB pressed a moment first starts a swing, which the cast drops while it is still winding up. The guard held
longer, then RB, is the blade as ever (the riposte after a parry).

## The save

`spell.<id>` true once won, `spell.selected` the chosen one (the first won, until another is chosen). A save that
resolved those houses before the spells existed is given them as it loads (src/save-migrate.js step 31,
`awardSpells`), and `wireSpellAwards` gives any that a flag already says (the engines' saves too). The recovery and a
spell at work are not kept: a load starts ready.

## On the screen

The chip under the gadget's in the top right (src/spells/hud.js, the screen's `spell` for the engines:
`BridgeHud.cs DrawSpell`): ready, the glyph in its colour and a full ring; working, the ring in its colour emptying;
recovering, a pale disc with the seconds left and a teal ring filling back; ready again, a gold flash. Each spell's
look is drawn in `SpellCaster.begin` / `work` (glowing flat ink, thin rings: src/thin.js), each cast with a ring of its
colour over the ground (the tool's rings). Sounds are the game's own: the shield opening and blocking (ward), the
makers' hum rising and the chime (tide), the riposte's ring and the cut landing (shards), a whoosh (veil), the dry
click when not ready.
