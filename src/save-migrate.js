// Old saves, brought up to date when they load (src/game-state.js calls migrateFlags).
//
// People with the same name in two worlds used to share one id, so meeting one
// marked the other as met too (the credits, the mother's "who did you meet"). The
// later one of each pair now has an id of its own, '<name>.<world>'. A save that
// met "hask" before cannot say which Hask it was (the City-Shaft's seller of views is Tobin now): if the player has been to the
// renamed person's world, they are taken to have met them too (a little generous,
// never wrong the other way). Clemence's id was an old name (malvina): renamed outright.
//
// Since the true ending came in (October 2026), a save that ended under the old rules has had its first
// homecoming (step 2).
//
// Dov's lift token used to be given outright; since it became a choice (keep it, or give it back), a save
// that has the token among its keepsakes but no `incal.token` kept it (step 3): the Lantern, Dov and the
// stone then read it as kept (src/story/ending.js choicesMade).
//
// The health bar became hearts and the backpack's three chambers a magic bar (October 2026, src/resources.js):
// step 4 stamps the resources' format (`res.v`). Nothing else needs moving: the fourth chamber ('cell')
// lengthens the bar from its own item flag, so a save that had it has a bar of four units (and passes the
// 'magic:4' doors of the Engine-House and the Furnace steps), the quick coil quickens the refill from its own;
// the hearts are not saved (a load starts whole, as the bar did) and potions start infinite (no flag: true).
//
// The first shop (Qanat's, v1.5: src/shop.js) made potions finite: a new game starts with POTION.start and
// carries at most POTION.cap. A save from before had them infinite (no flag): step 5 gives it a full stock
// (the cap) rather than the start, so nobody loses out, and the format becomes 2. A save the dev menu had made
// infinite on purpose (the flag true) stays so.
//
// The signature search (v1.6, src/story/signature-search.js) charts a newly opened world only once it is found
// on the ship's map (`map.found.<id>`). A save from before keeps every world it had charted: step 6 marks the
// worlds the route had opened for it (src/story/route.js knownWorlds, from its flags) as found.
//
// The fellow traveller (v1.28, src/story/fellow.js) is met in the first four of her stops a save lands in: step 7
// marks a save that had already finished one of them as late (`fellow.late`), so she says she has been a world
// behind him rather than ahead.
//
// The progression rewrite (v1.38) took the gun and the boost off the backpack: step 8 gives a save the lift valve
// (the double jump) and the fluid gun if it was past the places they are found now (the giant's pool, the Givers'
// Hearth), so nobody loses what they had. Step 9 takes the jets (a debug item since) out of play: the save keeps the
// Warden's harness instead, the City-Shaft's own.
// The author's level changes (October 2026, src/levels/names.js MERGED, DISMISSED): Vael II became part of Vael,
// Lorn II of Lorn, and the Sealed Hangar left the route for the Glass Dunes. Step 10 moves a save's own world
// (`ship.level`) and the worlds it had found on the map to the world each became; a Hangar it had finished
// counts as the Glass Dunes' slot finished (`world.glassdunes.done`), so the route does not take a world back.
// The part's own flags (`arzach2.*`, `world.arzach2.done`, `quest.arzach2.*`, the temples', the boxes') keep
// their names: the merged world carries its parts' quests and finds under them. Where you stand
// (src/ui.js SaveGame) goes through migrateWhere, and the sketchbook's relics through migrateJournal.
// The City-Shaft's air pillars (v1.42, src/shaft-pillars.js) carry the wings up the shaft, so the Warden's harness
// went: step 11 gives a save that had it the Warden's bellows, the Warden's Well's chest's new find (the chest stays
// opened).
//
// The Overnight Train's Mireille shared her name and id with the Underwater City's (v1.43): she is Solange, and step 12
// marks her met under her own id.
// The Givers' House remade (v1.44, src/temples/desert.js): he starts with nothing in his hands, and the sword and the
// shield's guard are found in the desert's temple. Nobody loses a weapon: step 13 gives every save from before the
// sword and the shield (all of them had both from the start since v1.38, past the temple or not), their temple chests
// open; ember mode, the house's old key, waits in the Givers' Hearth now, its chest open for a save that has it. A
// save inside the house, not done, starts the remade house from its door (its doors and fires were the old puzzle's);
// a save that had calmed the Keeper keeps it calmed, its doors open.
// The fluid gun comes with ember mode, in one chest in the Givers' room off the Hearth's hall (issue #83): step 14 gives
// a save that opened either of v1.44's two chests (or has either item) both, the gun's chest open.
//
// Nobody sends you to somebody else (issue #85): the steps whose only purpose was going to see the next person went from
// five quests. Step 15 moves a save standing on one of them on to the step after (QUEST_STAGE_MOVES); the cab pass's
// old last step (bring Tobin's coin back to Lio) is the pass in hand, the errand done; a save on the train that had
// still to ask Ambrose to stop has the stop asked (Solange pulls the cord herself now).
//
// Two more went in v1.49 (issue #118): Hask's (Wen says where the ramp is) and Calix's (the clapper is the goal): step 16.
// And the three worlds of v1.40 (issue #137): the errands that carried something from one person to another end where
// the thing is used (Wen's count at the lookout, Liesel's hook on the furnace's crane, Sel's notes on the cables, the
// cutting in the Crown), and Fabre's word down to Maelle is no quest: step 17 (QUEST_STAGE_MOVES_137).
// The giant's drain (issue #158): the keepers' pole and its lever went; a save holding the pole lets it go: step 18.
// The lift valve's chest behind the makers' shrine's door (issue #156): open for a save that had it, step 19.
// The last steps that sent you back to tell someone after the goal (issue #172, v1.54): each of those ten quests is done
// at its goal, and the person has their word when you pass: step 20 (QUEST_STAGE_MOVES_172).
// And the last two (issue #183, v1.54): the Lodestar lit is the City-Shaft's main quest done (Nima's word waits with
// her), the giant's chest seen Ilo's errand: step 21 (QUEST_STAGE_MOVES_183).
//
// The fragments of the singing light (issue #196, v1.55: src/fragments.js): a save from before has found none and has
// not met the scientist; step 22 starts it at zero (any `frag.*` it carries, from a build in between, goes).
// Re-placed over the rebuilt worlds' new country in v1.61 (issue #228): 29 of the 96 moved, each keeping its index. A
// save keeps its count world by world; a found flag on a slot that moved goes to one that didn't and is still to find,
// so the new places show (an old spot nobody reached is counted instead): step 23 (FRAGMENTS_MOVED_228). The
// Floating city's anchor-minder is Tilde now ('tilde', she was 'odile': Viridel's Odile is Odile and Talo's; #229).
// The Floating city's capstan man shared the name and the id 'bram' with Lorn's cave-mouth keeper (#251, v1.63): he is
// Ewart ('ewart'). Step 24 moves a save's `met.bram`, `talks.bram` and `said.bram.*` to him when only the Floating city
// can have given them (the city visited, nothing of the Deep Wood's or the White Mangrove's, where Lorn's Bram sits, and
// no answer said to Lorn's Bram). When both worlds could have, the save cannot tell: Lorn's Bram (the older, the one with
// a conversation) keeps them, and Ewart counts as met only if the span was reeled at his capstan (BRAM_251). Lorn
// finished (`world.perdide.done`) counts as the Deep Wood walked. Two more shared the desert's Pell's id 'pell': Hobb,
// who listens at the Undertower's stones ('hobb'), and the waterfall city's Aldo ('aldo'). Pell keeps every `pell` flag
// (the first world: he is always met); Hobb counts as met if his Undertower was started or entered, Aldo if his sighting
// was heard (SHARED_PELL_251).
//
// The fragments re-placed again in v1.66 (issue #250): many into and onto the worlds' places of interest (the desert's
// ribcages, the Garden's temples, the Glass Dunes' cairns…). Step 25 (FRAGMENTS_MOVED_250) keeps a save's count as step
// 23 did: a found flag on a moved slot goes to an unmoved one still to find (never the Desert's slot 5, Marrow's errand's
// goal), so the new places show.
//
// Quests are given by people since issue #273 (v1.67): on arrival a world's quests wait for whoever gives them, the
// temple's local first, marked on the map. Step 26 hides nothing a save has (its quests started or done stay as they
// are) and marks each part it had already been to as keeping the old ways (`givers.old.<part>`: there the box quests
// still come on arrival, the temple's quest as you near its door); only the worlds it has still to reach have givers.
//
// The night mail is done when Solange's answer is in your hand (issue #279, v1.69): its last two steps (step off at the
// halt, bring Edda the answer) went. Step 27 moves a save on either to done, the answer kept for Edda to read when you
// pass; a save that had brought it already has had her read it (`nightmail.read`).
//
// Three renamed so that no two names in one world blur (issue #281, v1.73): the Whale-House's Anselme is Achille (beside
// Anselm Thrum, aboard in every world), Lorn's lamp-counter Tamsy is Briony (beside Tansy) and the Welcome-Shelf's Rowan
// is Burdock (beside Robin). Their ids went with their names: step 28 moves each one's `met.`, `talks.` and `said.` flags
// (and Burdock's `perdide2.rowan.welcome`) to the new id (RENAMED_281).
//
// Each step runs once per save (flag `save.migrated` holds the last step done).

import { knownWorlds } from './story/route.js';
import { ORDER, MERGED, DISMISSED, worldFor, ROUTE_PARTS } from './levels/names.js';
import { STOPS as FELLOW_STOPS } from './story/fellow-data.js';

/** The resources' format (src/resources.js RES_VERSION; kept here so the migration needs no game modules). */
export const RES_VERSION = 2;
/** The potions' carry cap (src/resources.js POTION.cap; here so the migration needs no game modules). */
export const POTION_CAP = 5;

export const RENAMED_PEOPLE = [
  { from: 'hask', to: 'hask.buried', world: 'buried' },
  { from: 'ossa', to: 'ossa.buried', world: 'buried' },
  { from: 'pip', to: 'pip.garage', world: 'garage' },
  { from: 'lio', to: 'lio.edena', world: 'edena' },
  { from: 'hollin', to: 'hollin.perdide2', world: 'perdide2' },
  { from: 'pim', to: 'pim.perdide2', world: 'perdide2' },
  { from: 'aube', to: 'aube.spheres', world: 'spheres' },
  { from: 'ivo', to: 'ivo.perdide', world: 'perdide' },
];
/** Ids that were only ever one person's: every flag moves over. */
export const MOVED_PEOPLE = [{ from: 'malvina', to: 'clemence' }];

/** The player has been to this world: its story has started (its quests or its own flags). */
export function visited(flags, world) {
  const a = `quest.${world}.`, b = `${world}.`, c = `world.${world}.`;
  return Object.keys(flags).some((k) => k.startsWith(a) || k.startsWith(b) || k.startsWith(c));
}

const STEPS = [
  // 1: the people who shared an id
  (flags) => {
    for (const { from, to, world } of RENAMED_PEOPLE) {
      if (flags[`met.${from}`] && flags[`met.${to}`] === undefined && visited(flags, world)) flags[`met.${to}`] = true;
    }
    for (const { from, to } of MOVED_PEOPLE) {
      for (const k of Object.keys(flags)) {
        for (const p of ['met.', 'said.']) {
          if (k === `${p}${from}` || k.startsWith(`${p}${from}.`)) {
            const nk = p + to + k.slice(p.length + from.length);
            if (flags[nk] === undefined) flags[nk] = flags[k];
            delete flags[k];
          }
        }
      }
    }
  },
  // 2: two homecomings (src/story/ending.js). A save that saw the old ending (`ending.done`: the stone, the
  // oldest recording, the credits) has had its first homecoming: it stays done, marked 'old', and the
  // true ending waits for Ilen (the Lantern opens once the Signal Market has been heard). The reel the
  // old ending left on the stone is in his pocket again (the slab shows it only after `ending.final`);
  // the ship's log of the light over the hill waits on the voicemail (calls.js TRACE_CALL) to point the way.
  (flags) => {
    if (flags['ending.done'] && !flags['ending.first'] && !flags['ending.final']) flags['ending.first'] = 'old';
  },
  // 3: Dov's lift token, given before it was a choice: kept (the keepsake is the proof; `incal.dov.fed`
  // alone isn't: a newer save may have stopped between feeding him and choosing)
  (flags, keepsakes) => {
    if (flags['incal.token'] === undefined && keepsakes?.some((k) => k.id === 'incal.token')) flags['incal.token'] = 'kept';
  },
  // 4: hearts and the magic bar (src/resources.js): the format stamped; the chamber items read as bar length
  (flags) => {
    if (flags['res.v'] === undefined) flags['res.v'] = 1;
  },
  // 5: potions finite since the first shop: a save that had them infinite gets a full stock (the carry cap)
  (flags) => {
    if (flags['res.potions.infinite'] === undefined) {
      flags['res.potions'] = Math.max(POTION_CAP, Math.floor(+flags['res.potions'] || 0));
      flags['res.potions.infinite'] = false;
    }
    flags['res.v'] = RES_VERSION;
  },
  // 6: the signature search: the worlds an older save had on its map stay charted
  (flags) => {
    const done = (id) => !!flags[`world.${id}.done`];
    for (const id of knownWorlds({ order: ORDER, done, visited: (id) => visited(flags, id) })) flags[`map.found.${id}`] ??= true;
  },
  // 7: the fellow traveller (v1.28, src/story/fellow.js): a save that had already finished one of her stops before
  // she came meets her all the same, in the next of them it lands in (she waits there); she has been a world
  // behind him, not ahead (`fellow.late`: her first meeting says so)
  (flags) => {
    if (flags['fellow.meet'] === undefined && FELLOW_STOPS.some((id) => flags[`world.${id}.done`])) flags['fellow.late'] = true;
  },
  // 8: the progression rewrite (v1.38, docs/systems/progression.md): he starts with the sword alone; the backpack's
  // boost (the old "triple jump") became the lift valve's double jump (`doublejump`, by the giant's pool), and the
  // gun, which came with the backpack, a gadget of its own (`gun`, in the Givers' Hearth). A save keeps what it had
  // earned: past the pool (the backpack and a tank that had been filled: it could boost) it has the lift valve;
  // past the Hearth (its grille up, the stone taken, the desert done, another world started, or anything found that
  // only a gun could use) it has the gun, in hand if nothing else was, and both chests are found open. An earlier
  // save follows the new order: the chests wait where the route brings it.
  (flags) => {
    if (!flags['item.backpack']) return;
    const pastPool = !flags['tool.empty'] || !!flags['desert.pool.tinted'] || !!flags['desert.channel.open'];
    const later = ORDER.filter((id) => id !== 'desert').some((id) => visited(flags, id));
    const pastHearth = !!flags['desert.hearth.open'] || !!flags['desert.stone.taken'] || !!flags['desert.tree.lit'] || !!flags['world.desert.done'] || !!flags['ship.powered'] || later
      || ['stun', 'fire', 'bloom', 'glider', 'jetpack'].some((id) => flags[`item.${id}`]) || !!flags['temple.desert.entered'];
    if (pastPool || pastHearth) { flags['item.doublejump'] ??= true; flags['box.desert.lift'] ??= true; }
    if (pastHearth) {
      flags['item.gun'] ??= true; flags['box.desert.gun'] ??= true;
      if (!flags['gadget.equipped']) flags['gadget.equipped'] = 'gun';   // (the gun in hand, as it always was; another gadget in hand stays)
    }
  },
  // 9: the jets anywhere became a debug item (v1.38, the author: too strong for the worlds). A save that owned them loses
  // them from play; it had them from the Warden's Well's chest (or a fallback box by the ship), so it has the Warden's
  // harness, the City-Shaft's own jets, and that chest counts as opened. `jets.lost` remembers it (the debug menu gives
  // the jets back to whoever wants them).
  (flags) => {
    if (!flags['item.jetpack']) return;
    flags['item.jetpack'] = false;
    flags['jets.lost'] = true;
    flags['item.harness'] ??= true;
    flags['box.incal.temple.jetpack'] ??= true;
  },
  // 10: merged and dismissed worlds (src/levels/names.js): the ship's world and the map's finds move to their
  // replacements; a finished Hangar is the Glass Dunes' slot finished
  (flags) => migrateWorlds(flags),
  // 11: the Warden's harness (the City-Shaft's own jets, v1.38) went in v1.42: the City-Shaft's air pillars carry the
  // wings, and the Warden's Well's chest holds the Warden's bellows (the wings' third strength). A save that had the
  // harness (its chest opened, or step 9's) has the bellows instead; `harness.lost` remembers it.
  (flags) => {
    if (!flags['item.harness']) return;
    delete flags['item.harness'];
    flags['harness.lost'] = true;
    flags['item.wardenbellows'] ??= true;
    flags['box.incal.temple.jetpack'] ??= true;
  },
  // 12: the Overnight Train's Mireille (the night mail's, who rides the roofs) shared her name and her id with the
  // Underwater City's, who grows the glow-kelp: meeting one marked the other. She is Solange now ('solange'); a save that
  // got the letter to her has met her (the kelp grower keeps 'mireille')
  (flags) => {
    if (flags['met.mireille'] && ['stop', 'off', 'home', 'done'].includes(flags['quest.bazaar.nightmail'])) flags['met.solange'] ??= true;
  },
  // 13: the Givers' House remade (v1.44): the sword and the shield were his from the start; now they are found there.
  // Every save from before keeps both, their chests open (a save from before the items, too: src/boxes/index.js
  // migrateSave's legacy rule doesn't count them). The old house's puzzle state goes, unless the Keeper was calmed.
  (flags) => migrateGivers(flags),
  // 14: the fluid gun and ember mode in one chest (issue #83): v1.44 had two chests side by side in the Givers' Hearth.
  // A save that opened either (or has either item) has both, the gun's chest open
  (flags) => migrateGunChest(flags),
  // 15: the quest steps that only sent you to somebody else, gone (issue #85): a save on one goes on to the step after
  (flags) => migrateQuestStages(flags),
  // 16: two more steps that only sent you to a person, gone (issue #118, v1.49): a save on one goes on to the step after
  (flags) => migrateQuestStages(flags, QUEST_STAGE_MOVES_118),
  // 17: the new worlds' carries from one person to another, done where the thing is used (issue #137, v1.49)
  (flags) => migrateCarries137(flags),
  // 18: the giant's drain (issue #158, v1.51): no lever; you pull the debris out yourself. A save holding the keepers'
  // pole puts it down (it is no item now), and the lever's heaves are forgotten: an unfinished drain is cleared by hand.
  (flags) => migrateDrain158(flags),
  // 19: the makers' shrine (issue #156, v1.51): the lift valve's chest stands behind a door a full tank opens. A save that
  // opened the chest (or has the double jump) finds the door open; one waiting at the chest goes back to the door.
  (flags) => migrateShrine156(flags),
  // 20: the ten "Tell X" steps after the goal, gone (issue #172, v1.54): a save on one is done (the two main quests go
  // back to their goal's step, its flag already set, so the world's end runs as you arrive); what was said is not said again
  (flags) => migrateTells172(flags),
  // 21: the last two report-backs, gone (issue #183, v1.54): the City-Shaft's main quest ends at the light, Ilo's at the
  // giant's chest; a save sent back down to Nima goes back to the light's step (its flag set: the world's end runs as you
  // arrive), and one that heard her already keeps her word said. Ilo's step keeps its id: a save on it with the chest seen
  // is done as it loads
  (flags) => migrateTells183(flags),
  // 22: the fragments of the singing light (issue #196, v1.55): none found yet, the scientist still to meet
  (flags) => migrateFragments196(flags),
  // 23: the fragments re-placed over the new country (issue #228, v1.61), and the anchor-minder renamed (issue #229)
  (flags) => migrateFragments228(flags),
  // 24: the Floating city's capstan man is Ewart, not a second Bram; Hobb and Aldo are not Pell (issue #251, v1.63)
  (flags) => migrateBram251(flags),
  // 25: the fragments re-placed in and on the worlds' places of interest (issue #250, v1.66)
  (flags) => migrateFragments250(flags),
  // 26: quests are given by people (issue #273, v1.67): the worlds a save had been to keep their quests' old ways
  (flags) => migrateQuestGivers273(flags),
  // 27: the night mail done at Solange's answer (issue #279, v1.69): a save stepping off or bringing it back is done
  (flags) => migrateNightMail279(flags),
  // 28: three people renamed, and their ids (issue #281, v1.73): Anselme → Achille, Tamsy → Briony, Rowan → Burdock
  (flags) => migrateRenamed281(flags),
  // 29: the gadgets earned in the temples (issues #375, #377, v1.80): a chest or a box a save opened holds something else
  // now; the save is given that too, and keeps what it had (the echo shell, the horn and the tongs folded into a gadget)
  (flags) => migrateGadgets375(flags),
];
/**
 * Step 29's boxes (their ids the saves' flags, kept), each to what it holds since v1.80: the temples' chests their
 * house's gadget, the makers' courts' boxes the old temple things (docs/design/gadget-temples.md).
 */
export const BOXES_375 = {
  'arzach2.temple.bell': 'hook', 'perdide2.temple.lantern': 'bubble', 'underwater.temple.horn': 'springs',
  'incal.temple.jetpack': 'fan', 'garage.temple.coil': 'boomerang', 'buried.temple.cell': 'bomb',
  'moonfoundry.temple.tongs': 'magnet', 'spheres.temple.lens': 'monocle', 'bazaar.temple.echo': 'recall',
  'arzach.hook': 'bell', 'edena.bubble': 'lantern', 'perdide.fan': 'wardenbellows', 'perdide2.boomerang': 'coil',
  'spheres.bomb': 'cell', 'buried.monocle': 'lens',
};
/** Step 29's retired things, each to the gadget it was folded into. */
export const FOLDED_375 = { echo: 'recall', horn: 'springs', tongs: 'magnet' };
/** Step 29 (pure, in place): what an opened box holds now, and the gadget a retired thing went into. Nothing taken. */
export function migrateGadgets375(flags) {
  for (const [box, item] of Object.entries(BOXES_375)) if (flags[`box.${box}`]) flags[`item.${item}`] = true;
  for (const [old, item] of Object.entries(FOLDED_375)) if (flags[`item.${old}`]) flags[`item.${item}`] = true;
  return flags;
}
/** Step 28's ids, old → new, and the other flags named after them (issue #281). */
export const RENAMED_281 = { ids: { anselme: 'achille', tamsy: 'briony', rowan: 'burdock' }, flags: { 'perdide2.rowan.welcome': 'perdide2.burdock.welcome' } };
/** Step 28 (pure, in place): each renamed person's flags under their new id (a flag already there is kept). */
export function migrateRenamed281(flags) {
  for (const k of Object.keys(flags)) {
    const m = k.match(/^(met|said|talks)\.([a-z]+)(\..*)?$/), to = m && RENAMED_281.ids[m[2]];
    const nk = to ? `${m[1]}.${to}${m[3] ?? ''}` : RENAMED_281.flags[k];
    if (!nk) continue;
    flags[nk] ??= flags[k];
    delete flags[k];
  }
  return flags;
}
/** The night mail's steps removed in v1.69 (issue #279): step 27. */
export const QUEST_STAGE_MOVES_279 = { 'bazaar.nightmail': { off: 'done', home: 'done' } };
/** Step 27 (pure, in place): the answer stays in his coat until Edda reads it; brought already, she has. */
export function migrateNightMail279(flags) {
  if (flags['quest.bazaar.nightmail'] === 'done') flags['nightmail.read'] ??= true;
  return migrateQuestStages(flags, QUEST_STAGE_MOVES_279);
}
/** Step 26's parts: every part of the route, and the Clock-House's own id (the Glass Dunes' temple and two of its boxes). */
export const GIVER_PARTS_273 = [...ROUTE_PARTS, 'garage'];
/**
 * Step 26 (pure, in place): since issue #273 a world's quests wait for the people who give them (the temple's local gives
 * the temple's and the boxes'), instead of starting on arrival or as you pass the temple's door. A save from before
 * keeps every quest it has, started or done (nothing is hidden), and each part it had been to keeps the old ways
 * (`givers.old.<part>`: src/temples/index.js, src/boxes/index.js); the parts it had not been to, the new arrivals,
 * have givers.
 */
export function migrateQuestGivers273(flags) {
  const keys = Object.keys(flags);
  const been = (w) => visited(flags, w) || keys.some((k) => k.startsWith(`temple.${w}.`) || k === `quest.temple.${w}` || k.startsWith(`box.${w}.`) || k.startsWith(`quest.box.${w}.`));
  const same = { garage: 'glassdunes', glassdunes: 'garage' };   // (the Clock-House stands in the Glass Dunes)
  for (const w of GIVER_PARTS_273) if (been(w) || (same[w] && been(same[w]))) flags[`givers.old.${w}`] = true;
  return flags;
}
/** The slots of src/fragments-data.js whose spots moved in v1.66 (issue #250), world by world: step 25. */
export const FRAGMENTS_MOVED_250 = {
  desert: [0, 7], arzach: [0, 3], perdide: [3], edena: [0, 5, 7], underwater: [3], incal: [2, 4, 5, 6], glassdunes: [2, 4, 6, 7],
  buried: [0, 3, 6, 7], moonfoundry: [2, 7], spheres: [0, 2, 4, 5, 7], spacecity: [6], bazaar: [6, 7],
};
/** Step 25 (pure, in place): each world's count kept, its found flags off the slots moved in v1.66 where an unmoved one is free (as step 23). */
export function migrateFragments250(flags, per = 8) {
  return moveFoundOff(flags, FRAGMENTS_MOVED_250, per, { desert: [5] });
}
/** Step 24's ids and the worlds where Lorn's Bram can be met (the Deep Wood's part of Lorn, the White Mangrove). */
export const BRAM_251 = { from: 'bram', to: 'ewart', city: 'spacecity', lorn: ['perdide2', 'mangrove'], lornDone: 'world.perdide.done', reeled: 'spacecity.drift.reeled' };
/** Step 24's two who shared the desert's Pell's id: their new id, and the flags that show they were met. */
export const SHARED_PELL_251 = [
  { to: 'hobb', any: ['quest.temple.bazaar', 'temple.bazaar.entered', 'temple.bazaar.done'] },
  { to: 'aldo', any: ['sight.waterfall.pell'] },
];
/**
 * A save's found fragments off the slots that moved (`moved`: { world: [slot, …] }), world by world: each found flag on
 * a moved slot goes to a slot that didn't move and is still to find, the first free, so the count stays and the new
 * place shows (an old spot nobody reached is counted instead); where none is free it stays on its slot (steps 23, 25).
 * `never`: { world: [slot, …] } never given one (the Desert's slot 5: Marrow's errand ends when it is found).
 */
export function moveFoundOff(flags, moved, per = 8, never = {}) {
  for (const [world, slots] of Object.entries(moved)) {
    const free = [...Array(per).keys()].filter((i) => !slots.includes(i) && !(never[world] ?? []).includes(i) && !flags[`frag.${world}.${i}`]);
    for (const i of slots) {
      if (!flags[`frag.${world}.${i}`] || !free.length) continue;
      flags[`frag.${world}.${free.shift()}`] = flags[`frag.${world}.${i}`];
      delete flags[`frag.${world}.${i}`];
    }
  }
  return flags;
}
/** Step 24 (pure, in place): the capstan man's flags moved off Lorn's Bram when the save can only have met him; Hobb and Aldo met. */
export function migrateBram251(flags) {
  if (flags['met.pell']) for (const { to, any } of SHARED_PELL_251) if (any.some((k) => flags[k])) flags[`met.${to}`] ??= true;
  const { from, to, city, lorn, lornDone, reeled } = BRAM_251;
  const mine = Object.keys(flags).filter((k) => k === `met.${from}` || k === `talks.${from}` || k.startsWith(`said.${from}.`));
  if (!mine.length || !visited(flags, city)) return flags;
  const lornToo = lorn.some((w) => visited(flags, w)) || !!flags[lornDone] || mine.some((k) => k.startsWith('said.'));
  if (lornToo) {   // (can't tell: Lorn's Bram keeps his; the capstan man met if the span was reeled beside him)
    if (flags[`met.${from}`] && flags[reeled]) flags[`met.${to}`] ??= true;
    return flags;
  }
  for (const k of mine) {
    const [kind, ...rest] = k.split('.');
    flags[[kind, to, ...rest.slice(1)].join('.')] ??= flags[k];
    delete flags[k];
  }
  return flags;
}
/** The slots of src/fragments-data.js whose spots moved in v1.61 (issue #228), world by world: step 23. */
export const FRAGMENTS_MOVED_228 = {
  arzach: [1, 3, 4], perdide: [2, 4, 5], edena: [2, 3, 6], underwater: [0, 2, 4, 5, 6], buried: [0],
  moonfoundry: [1, 3, 4, 5], spheres: [1], spacecity: [0, 2, 3, 5, 6, 7], bazaar: [0, 1, 5],
};
/** Step 23 (pure, in place): each world's count kept, its found flags off the moved slots where an unmoved one is free; 'odile' → 'tilde'. */
export function migrateFragments228(flags, per = 8) {
  moveFoundOff(flags, FRAGMENTS_MOVED_228, per);
  for (const k of Object.keys(flags)) {
    const m = k.match(/^(met|said|talks)\.odile(\..*)?$/);
    if (m) { flags[`${m[1]}.tilde${m[2] ?? ''}`] ??= flags[k]; delete flags[k]; }
  }
  return flags;
}
/** The quest steps removed in v1.54 (issue #183): step 21. */
export const QUEST_STAGE_MOVES_183 = { 'incal.light': { tell: 'look' } };
/** Step 21 (pure, in place). */
export function migrateTells183(flags) {
  if (flags['quest.incal.light'] === 'done') flags['incal.nima.told'] = true;
  return migrateQuestStages(flags, QUEST_STAGE_MOVES_183);
}
/** Step 22 (pure, in place): the fragments' count from zero. */
export function migrateFragments196(flags) {
  for (const k of Object.keys(flags)) if (k.startsWith('frag.')) delete flags[k];
  return flags;
}
/** The quest steps removed in v1.54 (issue #172): step 20. */
export const QUEST_STAGE_MOVES_172 = {
  'edena.garden': { tell: 'scar' },          // (Mira: the scorch seen is the end; back to it, so the end runs on arrival)
  'edena.cutting': { tell: 'done' },         // (Esk: the cutting planted)
  'edena.tree': { tell: 'done' },            // (Rue: the crown reached)
  'bazaar.oldsign': { tell: 'done' },        // (Brush: the sign woken)
  'buried.gauges': { tell: 'done' },         // (Ket: the three gauges read)
  'incal.mirror': { tell: 'done' },          // (Perrine: the mirror washed and turned up)
  'perdide.patience': { tell: 'done' },      // (Wendel: the plants tired of you)
  'perdide.fireflies': { ivo: 'done' },      // (Ivo: the fireflies followed home)
  'perdide2.lamps': { tell: 'answer' },      // (Hollin: the boat seen is the end; back to it, so the end runs on arrival)
  'spheres.avenue': { tell: 'done' },        // (Cael: the avenue walked)
};
/** Who has said their word already, for a quest that was done under the old steps (the flag their talk sets now). */
export const SAID_172 = {
  'edena.garden': 'edena.mira.told', 'edena.cutting': 'edena.esk.planted', 'edena.tree': 'edena.rue.told',
  'bazaar.oldsign': 'bazaar.brush.read', 'buried.gauges': 'buried.ket.told', 'incal.mirror': 'incal.perrine.turned',
  'perdide.patience': 'perdide.wendel.patient', 'perdide.fireflies': 'perdide.ivo.told', 'spheres.avenue': 'spheres.cael.walked',
};
/** Step 20 (pure, in place). */
export function migrateTells172(flags) {
  for (const [id, said] of Object.entries(SAID_172)) if (flags[`quest.${id}`] === 'done') flags[said] = true;
  return migrateQuestStages(flags, QUEST_STAGE_MOVES_172);
}
/** Step 19 (pure, in place). */
export function migrateShrine156(flags) {
  if (flags['box.desert.lift'] || flags['item.doublejump']) flags['desert.door.open'] = true;
  else if (flags['quest.desert.power'] === 'valve') flags['quest.desert.power'] = 'door';
  return flags;
}
/** Step 18 (pure, in place). */
export function migrateDrain158(flags) {
  delete flags['item.pole'];
  delete flags['desert.lever'];
  delete flags['desert.pole.tried'];
  return flags;
}

/** The quest steps removed in v1.46 (issue #85), each to the step a save on it goes on to. */
export const QUEST_STAGE_MOVES = {
  'incal.light': { palace: 'look' },            // (Dov at the gate: someone you pass on the way up to the crown)
  'edena.garden': { vey: 'inside' },            // (Vey by the vines: Mira says where the hatch is)
  'perdide.crystal': { saba: 'sing', listen: 'splinter' },   // (Saba at the crystal: Wendel says what makes it sing)
  'bazaar.nightmail': { find: 'mireille', stop: 'off' },     // (Ambrose aboard: Edda says where Solange rides; Solange pulls the cord)
};
/** The quest steps removed in v1.49 (issue #118): step 16. */
export const QUEST_STAGE_MOVES_118 = {
  'buried.tooth': { hask: 'down' },             // (Hask on his bench: Wen says where the ramp is)
  'arzach2.bell': { calix: 'clapper' },         // (Calix at the monastery: the clapper is the goal; he says where it lies)
};
/** The quest steps removed in v1.49 (issue #137): step 17. */
export const QUEST_STAGE_MOVES_137 = {
  'moonfoundry.count': { ilse: 'done' },        // (the count to Petra: it is done at the lookout, where it is counted)
  'moonfoundry.hook': { bertil: 'crane' },      // (the hook to Bertil: it is hung on his crane at the last furnace)
  'spacecity.notes': { tamar: 'cables' },       // (the notes to Ines: they are laid on the cables under the Towers)
  'underwater.kelp': { fabre: 'done' },         // (the cutting to Fabre: it goes in his window box as you come up into the Crown)
  'underwater.lamps': { maelle: 'done' },       // (Fabre's word down to Maelle: no quest now, her line when you pass)
};
/** Step 17 (pure, in place): the stages moved on, the things used where they were for, and who has said their word. */
export function migrateCarries137(flags) {
  const was = (id) => flags[`quest.${id}`];
  const kelpAtFabre = was('underwater.kelp') === 'fabre', lamps = was('underwater.lamps'), counted = was('moonfoundry.count') === 'done';
  migrateQuestStages(flags, QUEST_STAGE_MOVES_137);
  if (kelpAtFabre && flags['item.kelpcutting'] > 0) flags['item.kelpcutting'] -= 1;   // (in the window box now)
  if (was('moonfoundry.count') === 'done') flags['moonfoundry.moons.counted'] = true;
  if (counted) { flags['moonfoundry.ilse.counted'] = true; flags['moonfoundry.wen.counted'] = true; }   // (Petra wrote it in)
  // (what was said already, under the old steps, is not said again)
  if (was('moonfoundry.hook') === 'done') flags['moonfoundry.bertil.thanked'] = true;
  if (was('spacecity.notes') === 'done') flags['spacecity.notes.laid'] = true;
  if (was('underwater.kelp') === 'done' && !kelpAtFabre) flags['underwater.fabre.thanked'] = true;
  if (lamps !== undefined) flags['underwater.fabre.lamps'] = true;
  if (lamps === 'done') flags['underwater.maelle.lamps'] = true;
  return flags;
}
/** Steps 15 and 16 (pure, in place). */
export function migrateQuestStages(flags, table = QUEST_STAGE_MOVES) {
  const first = table === QUEST_STAGE_MOVES;
  // (a save on the train that had still to ask for the stop: asked, as Solange's cord does now)
  if (first && flags['quest.bazaar.nightmail'] === 'stop') flags['nightmail.stop'] = true;
  for (const [id, moves] of Object.entries(table)) {
    const k = `quest.${id}`, to = moves[flags[k]];
    if (to) flags[k] = to;
  }
  if (!first) return flags;
  // the cab pass: Tobin's coin brought back to Lio was the last step; the pass is in hand now
  if (flags['quest.incal.pass'] === 'back') {
    flags['quest.incal.pass'] = 'done';
    if (flags['item.fare'] > 0) flags['item.fare'] -= 1;
    flags['item.cabpass'] = Math.max(1, +flags['item.cabpass'] || 0);
  }
  return flags;
}

/** Step 14 (pure, in place): the gun and its ember mode, one chest. */
export function migrateGunChest(flags) {
  if (!(flags['item.gun'] || flags['item.fire'] || flags['box.desert.gun'] || flags['box.desert.hearth.fire'])) return flags;
  const hadGun = !!flags['item.gun'];
  flags['item.gun'] = true;
  flags['item.fire'] = true;
  flags['box.desert.gun'] = true;
  if (!hadGun && !flags['gadget.equipped']) flags['gadget.equipped'] = 'gun';   // (the gun in hand, as its chest gives it)
  return flags;
}

/** The remade Givers' House's doors and fires (src/temples/desert.js LOGIC): open and lit for a save that had calmed the Keeper. */
export const GIVERS_DONE = { open: ['d1', 'dc', 'dm', 'br1', 'sc', 'd3'], lit: ['b0', 'arM', 'bw0', 'b3', 'sentry', 'e10', 'b4', 'b6', 'b7', 'b8', 'b9'], weight: { wP: 'pp' }, drum: { ballK: 1 }, found: ['kS'], unlocked: { dE: 1 } };   // (weight: the Dry Channel's on its plate, issue #337; the balcony's ball dropped, the small key taken and turned, issue #406)
/** Step 13 (pure, in place): the sword and the shield kept, the house's old state cleared or settled. */
export function migrateGivers(flags) {
  flags['item.sword'] ??= true;
  flags['item.shield'] ??= true;
  flags['box.desert.temple.sword'] ??= true;
  flags['box.desert.temple.shield'] ??= true;
  // ember mode: the house's old chest held it; it waits in the Hearth now
  if (flags['item.fire'] || flags['box.desert.temple.fire']) { flags['item.fire'] ??= true; flags['box.desert.hearth.fire'] ??= true; }
  const done = flags['temple.desert.boss'] === 'done' || !!flags['temple.desert.done'];
  for (const k of Object.keys(flags)) if (/^temple\.desert\.(open|lit|drum|weight)\./.test(k) || k === 'temple.desert.checkpoint') delete flags[k];
  if (done) {
    for (const id of GIVERS_DONE.open) flags[`temple.desert.open.${id}`] = true;
    for (const id of GIVERS_DONE.lit) flags[`temple.desert.lit.${id}`] = true;
    for (const [id, plate] of Object.entries(GIVERS_DONE.weight)) flags[`temple.desert.weight.${id}`] = plate;
    for (const [id, t] of Object.entries(GIVERS_DONE.drum)) flags[`temple.desert.drum.${id}`] = t;
    for (const id of GIVERS_DONE.found) flags[`temple.desert.found.${id}`] = true;
    for (const [id, n] of Object.entries(GIVERS_DONE.unlocked)) flags[`temple.desert.unlocked.${id}`] = n;
  }
  return flags;
}

/** Step 10 (pure, in place): a save's worlds moved to the ones that took their place. */
export function migrateWorlds(flags) {
  const moved = { ...MERGED, ...DISMISSED };
  const ship = flags['ship.level'];
  if (ship != null && Object.hasOwn(moved, ship)) flags['ship.level'] = worldFor(ship, 'desert');
  for (const [from, to] of Object.entries(moved)) {
    if (!to) continue;
    if (flags[`map.found.${from}`]) flags[`map.found.${to}`] ??= true;
    // (the fellow traveller met in Lorn II was met in Lorn: src/story/fellow-data.js STOPS)
    if (flags[`fellow.stop.${from}`] !== undefined) flags[`fellow.stop.${to}`] ??= flags[`fellow.stop.${from}`];
  }
  if (flags['world.garage.done']) flags['world.glassdunes.done'] ??= true;
  return flags;
}

/**
 * Which worlds were laid out again (their places moved), by version: a save made before stood somewhere else.
 * Vael's plain moved north of the sky stones (October 2026: src/levels/names.js PART_OFFSET).
 */
export const LAYOUT = { arzach: 2 };
/** The layout version of a world (1 for one never moved). */
export const layoutOf = (id) => LAYOUT[id] ?? 1;

/**
 * Where a save stood (src/ui.js SaveGame: { level, pos, heading, yaw, hour, up, fwd, layout }), brought up to date:
 * a merged or dismissed world's id becomes the world that took its place (a dismissed one without one: `fallback`;
 * null leaves the level unset, and the game opens the ship's world), and where it stood is forgotten (it lands at the ship, by its spawn) if that world was laid
 * out again since. Pure; returns a new object (or what it was given, if nothing changed).
 */
export function migrateWhere(saved, { fallback = 'desert' } = {}) {
  if (!saved || typeof saved !== 'object' || saved.level == null) return saved;
  const level = worldFor(saved.level, fallback) ?? null;
  const moved = level !== saved.level, relaid = level != null && (saved.layout ?? 1) !== layoutOf(level);
  if (!moved && !relaid) return saved;
  const { pos, up, fwd, heading, yaw, ...rest } = saved;
  return level == null ? { ...rest, level } : { ...rest, level, layout: layoutOf(level) };
}

/**
 * The sketchbook (src/quest.js Journal data: { relics: { world: { i: entry } }, stories, seen }) brought up to date:
 * a merged part's relics move into its world's list after the parts before it (`bases`: { part: [world, first
 * index] }, src/levels/content.js RELIC_BASE), and having seen the part is having seen the world. In place;
 * returns true if anything moved.
 */
export function migrateJournal(data, bases) {
  if (!data) return false;
  let moved = false;
  for (const [part, [world, base]] of Object.entries(bases ?? {})) {
    if (part === world) continue;
    const own = data.relics?.[part];
    if (own && Object.keys(own).length) {
      const into = (data.relics[world] ??= {});
      for (const [i, entry] of Object.entries(own)) into[base + Number(i)] ??= entry;
      delete data.relics[part];
      moved = true;
    }
    if (data.seen?.[part] && !data.seen[world]) { data.seen[world] = 1; moved = true; }
  }
  return moved;
}

/** The step a fresh save starts at (src/game-state.js reset): nothing to migrate. */
export const MIGRATED = () => STEPS.length;

/** Bring a save's flags up to date (in place; `keepsakes` is read, never changed). Returns true if anything ran. */
export function migrateFlags(flags, keepsakes = []) {
  if (!flags) return false;
  const done = flags['save.migrated'] ?? 0;
  if (done >= STEPS.length) return false;
  // a brand-new game has nothing to migrate
  if (!Object.keys(flags).length) { flags['save.migrated'] = STEPS.length; return false; }
  for (let i = done; i < STEPS.length; i++) STEPS[i](flags, keepsakes);
  flags['save.migrated'] = STEPS.length;
  return true;
}
