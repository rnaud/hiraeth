// The sound QC's list (.claude/skills/sound-qc/SKILL.md): every player action and game event that should be heard,
// found in the code (the inventory of October 2026: the input bindings, src/foley.js, src/fluid-blade.js, the tool,
// the gadgets, the menus, the quests, the ship), with
//
//   id, what, group        the row of the report
//   role                   its band in the mix (scripts/sound-qc/lib.mjs ROLES)
//   play(s)                the Sound call that makes it (rendered alone, calm: its level, onset, length, variation);
//                          a method the Sound lacks makes it silent (missing)
//   web: [[file, /re/]]    where the game asks for it in the browser (all must match; none: never asked for)
//   engine                 'shared' (the same module, built by engine/game.js too), [[file, /re/]] (the engines' own
//                          wiring), or null (not in the engines)
//   drive, calls           the scenario that does it in the game (scripts/sound-qc/scenarios.mjs, the engines' build)
//                          and the Sound methods that count as its sound there
//   key                    one of the actions every player does: the QC is red while one of these is not OK
//   repeats                false: a one-off (a quest done) whose takes may be alike

const A = (id, what, group, role, play, o = {}) => ({ id, what, group, role, play, web: [], engine: 'shared', key: false, repeats: true, ...o });
const MAIN = 'src/main.js', ENG = 'engine/game.js', BLADE = 'src/fluid-blade.js', FOLEY = 'src/foley.js';
const foley = (name) => ({ web: [[MAIN, /new BodyFoley\(/], [MAIN, /foley\.update\(/], [FOLEY, new RegExp(`emit\\('${name}'`)]], engine: [[ENG, /new BodyFoley\(/], [ENG, /foley\.update\(/]] });

export const ACTIONS = [
  // ------------------------------------------------------------------ the body
  A('step-walk', 'a footstep, walking', 'the body', 'foley', (s) => s.step(3.6), { key: true, web: [[MAIN, /sound\.step\(/]], engine: [[ENG, /sound\.step\(/]], drive: 'walk', calls: ['step'] }),
  A('step-sprint', 'a footstep, sprinting', 'the body', 'foley', (s) => s.step(8), { key: true, web: [[MAIN, /sound\.step\(/]], engine: [[ENG, /sound\.step\(/]], drive: 'sprint', calls: ['step'] }),
  A('step-grass', 'a footstep on grass', 'the body', 'foley', (s) => s.step(4, { surface: 'grass' }), { web: [[MAIN, /footing/]], engine: [[ENG, /footing:/]] }),
  A('step-stone', 'a footstep on stone', 'the body', 'foley', (s) => s.step(4, { surface: 'stone' }), { web: [[MAIN, /footing/]], engine: [[ENG, /footing:/]] }),
  A('jump', 'a jump', 'the body', 'action', (s) => s.jump(), { key: true, ...foley('jump'), drive: 'jump', calls: ['jump'] }),
  A('land-soft', 'landing from a hop', 'the body', 'foley', (s) => s.land({ speed: 4 }), { key: true, ...foley('land'), drive: 'jump', calls: ['land'] }),
  A('land-hard', 'landing from a fall', 'the body', 'impact', (s) => s.land({ speed: 13 }), { key: true, ...foley('land'), drive: 'fall', calls: ['land'] }),
  A('evade', 'the roll', 'the body', 'action', (s) => s.evade(), { key: true, ...foley('evade'), drive: 'evade', calls: ['evade'] }),
  A('grab', 'catching a wall to climb', 'the body', 'foley', (s) => s.grab(), foley('grab')),
  A('mantle', 'pulling up over a ledge', 'the body', 'foley', (s) => s.mantle(), foley('mantle')),
  A('wings', 'the wings opening', 'the body', 'action', (s) => s.wings({ open: true }), foley('wings')),
  A('jets', 'the jets lighting', 'the body', 'action', (s) => s.jets(), foley('jets')),
  A('boost', 'the double jump\'s lift', 'the body', 'action', (s) => s.fluidBoost(), { web: [['src/fluid-tool.js', /fluidBoost/]] }),
  A('swim-in', 'into the water', 'the body', 'impact', (s) => s.splash(1), { web: [[MAIN, /waters\.sound = sound/]], engine: [[ENG, /waters\.sound = sound/]] }),
  A('swim-stroke', 'a swimming stroke', 'the body', 'foley', (s) => s.stroke(0), { web: [[MAIN, /waters\.sound = sound/]], engine: [[ENG, /waters\.sound = sound/]] }),
  A('hurt', 'taking a blow', 'the body', 'impact', (s) => s.hurt(1, 'foe'), { key: true, web: [[MAIN, /sound\.hurt\(/]], engine: [[ENG, /sound\?\.hurt\?\.\(/]], drive: 'hurt', calls: ['hurt'] }),
  A('knockdown', 'knocked down', 'the body', 'impact', (s) => s.knockdown(), { key: true, ...foley('knockdown'), drive: 'knockout', calls: ['knockdown'] }),
  A('get-up', 'getting up', 'the body', 'foley', (s) => s.getUp(), foley('getUp')),
  A('low-health', 'the low-health heartbeat', 'the body', 'warn', (s) => s.heartbeat(), { key: true, web: [['src/low-health.js', /heartbeat/]], drive: 'low', calls: ['heartbeat'] }),
  A('potion-open', 'a potion uncorked', 'the body', 'action', (s) => s.potion('open'), { key: true, web: [[MAIN, /sound\.potion\('open'\)/]], engine: [['engine/combat.js', /potion\?\.\('open'\)|potion\('open'\)/]], drive: 'potion', calls: ['potion:open'] }),
  A('potion-heal', 'the hearts coming back', 'the body', 'cue', (s) => s.potion('heal'), { key: true, web: [[MAIN, /sound\.potion\('heal'\)/]], engine: [[ENG, /potion\?*\.?\(?'heal'/]], drive: 'potion', calls: ['potion:heal'] }),
  // ------------------------------------------------------------------ the blade and the shield
  A('swing-press', 'the blade pressed: the swing begins', 'the blade', 'action', (s) => s.fluidWindup?.(0), { key: true, web: [[BLADE, /fluidWindup/]], drive: 'combo', calls: ['fluidWindup', 'fluidSlash'], press: true }),
  A('swing-1', 'the combo\'s first cut', 'the blade', 'action', (s) => s.fluidSlash(0), { key: true, web: [[BLADE, /fluidSlash\?\.\(/]], drive: 'combo', calls: ['fluidSlash'] }),
  A('swing-2', 'the combo\'s second cut', 'the blade', 'action', (s) => s.fluidSlash(1), { key: true, web: [[BLADE, /fluidSlash\?\.\(/]], drive: 'combo', calls: ['fluidSlash'] }),
  A('swing-3', 'the combo\'s heavy third', 'the blade', 'action', (s) => s.fluidSlash(2), { key: true, web: [[BLADE, /fluidSlash\?\.\(/]], drive: 'combo', calls: ['fluidSlash'] }),
  A('charge', 'the charge gathering', 'the blade', 'action', (s) => s.fluidCharge(false), { web: [[BLADE, /fluidCharge\?\.\(false\)/]] }),
  A('charge-full', 'the charge full', 'the blade', 'cue', (s) => s.fluidCharge(true), { web: [[BLADE, /fluidCharge\?\.\(true\)/]] }),
  A('dash-cut', 'the dash cut', 'the blade', 'action', (s) => s.fluidDash(), { web: [[BLADE, /fluidDash/]] }),
  A('riposte', 'the riposte landing', 'the blade', 'cue', (s) => s.fluidRiposte(true), { web: [[BLADE, /fluidRiposte\?\.\(true\)/]] }),
  A('hit', 'a cut landing on a foe', 'the blade', 'impact', (s) => s.fluidSlashHit(true, false), { key: true, web: [[BLADE, /fluidSlashHit/]], drive: 'hit', calls: ['fluidSlashHit', 'foeHurt'] }),
  A('hit-heavy', 'the heavy third landing', 'the blade', 'impact', (s) => s.fluidSlashHit(true, true), { key: true, web: [[BLADE, /fluidSlashHit/]] }),
  A('hit-armour', 'a cut on armour', 'the blade', 'impact', (s) => s.foeArmour(), { web: [['src/foes.js', /foeArmour/]] }),
  A('foe-hurt', 'a foe hurt (a blot)', 'the blade', 'impact', (s) => s.foeHurt('blot'), { key: true, web: [['src/foes.js', /foeHurt/]], drive: 'hit', calls: ['foeHurt'] }),
  A('shield-open', 'the shield opening', 'the blade', 'action', (s) => s.shieldOpen(), { key: true, web: [[BLADE, /shieldOpen/]], drive: 'guard', calls: ['shieldOpen'] }),
  A('shield-close', 'the shield folding', 'the blade', 'foley', (s) => s.shieldClose(), { web: [[BLADE, /shieldClose/]], drive: 'guard', calls: ['shieldClose'] }),
  A('block', 'a blow blocked', 'the blade', 'impact', (s) => s.fluidBlock(false), { key: true, web: [[BLADE, /fluidBlock/]] }),
  A('parry', 'a perfect parry', 'the blade', 'impact', (s) => s.fluidBlock(true), { web: [[BLADE, /fluidBlock/]] }),
  A('shield-break', 'the shield breaking', 'the blade', 'impact', (s) => s.shieldBreak(), { web: [[BLADE, /shieldBreak/]] }),
  A('lock-on', 'locking on to a foe', 'the blade', 'ui', (s) => s.lockOn?.(true) ?? s.fluidMode('stun'), { key: true, web: [['src/foes.js', /lockOn\?\.\(true\)|fluidMode\?\.\('stun'\)/]], drive: 'lock', calls: ['lockOn', 'fluidMode'] }),
  A('lock-off', 'letting the lock go', 'the blade', 'ui', (s) => s.lockOn?.(false), { web: [['src/foes.js', /lockOn\?\.\(false\)/]] }),
  A('flurry', 'a perfect dodge\'s flurry', 'the blade', 'cue', (s) => s.flurry(), { web: [[MAIN, /sound\.flurry/]], engine: [['engine/combat.js', /flurry/]] }),
  // ------------------------------------------------------------------ the tool and the gadgets
  A('shoot', 'the gun\'s shot', 'the tool', 'action', (s) => s.fluidShoot('shoot'), { web: [['src/fluid-tool.js', /fluidShoot/]] }),
  A('gun-mode', 'the gun\'s mode changed', 'the tool', 'ui', (s) => s.fluidMode('fire'), { web: [['src/fluid-tool.js', /fluidMode/]] }),
  A('splash', 'a shot landing', 'the tool', 'impact', (s) => s.fluidSplash(true), { web: [['src/fluid-tool.js', /fluidSplash/]] }),
  A('empty', 'the tank empty', 'the tool', 'ui', (s) => s.fluidEmpty(), { web: [['src/fluid-tool.js', /fluidEmpty/]] }),
  A('scout', 'the scout drone sent', 'the tool', 'action', (s) => s.drone('go'), { web: [['src/scout.js', /drone\?*\.?\(?'go'/]], drive: 'scout', calls: ['drone'] }),
  A('carry-throw', 'a carried thing thrown', 'the tool', 'action', (s) => s.toss?.(), { web: [['src/carry.js', /toss/]], engine: [[ENG, /carryHooks\.toss/]] }),
  A('carry-put', 'a carried thing put down', 'the tool', 'foley', (s) => s.land({ speed: 2.5 }), { web: [[MAIN, /carryHooks\.sound/]], engine: [[ENG, /carryHooks\.sound/]] }),
  // ------------------------------------------------------------------ the world: pick-ups, chests, doors, quests
  A('pickup', 'picking something up (the use button)', 'the world', 'cue', (s) => s.pickup(), { key: true, web: [[MAIN, /interactHooks\.onUse/]], engine: [[ENG, /interactHooks\.onUse/]] }),
  A('chime', 'a chime picked up', 'the world', 'cue', (s) => s.chimePickup(1), { key: true, web: [[MAIN, /chimePickup/]], engine: [['engine/combat.js', /chimePickup/]] }),
  A('potion-pickup', 'a potion picked up', 'the world', 'cue', (s) => s.potionPickup(), { web: [[MAIN, /potionPickup/]], engine: [['engine/combat.js', /potionPickup/]] }),
  A('key-get', 'a temple key out of its chest', 'the world', 'cue', (s) => s.keyGet(false), { key: true, repeats: false, web: [['src/temples/pieces.js', /keyGet/]] }),
  A('key-turn', 'a key in a lock', 'the world', 'foley', (s) => s.keyTurn(), { web: [['src/temples/pieces.js', /keyTurn/]] }),
  A('box-latch', 'a makers\' box\'s latch', 'the world', 'action', (s) => s.boxLatch(), { web: [['src/boxes/scene.js', /boxLatch/]] }),
  A('box-open', 'a makers\' box opening', 'the world', 'cue', (s) => s.boxOpen(), { repeats: false, web: [['src/boxes/scene.js', /boxOpen/]] }),
  A('door', 'a temple door opening', 'the world', 'cue', (s) => (s.doorOpen ? s.doorOpen() : s.whoosh()), { web: [['src/temples/pieces.js', /doorOpen|whoosh/]] }),
  A('lever', 'a lever pulled', 'the world', 'action', (s) => s.critter('clank'), { web: [['src/temples/pieces.js', /critter\?*\.?\(?'clank'/]] }),
  A('portal', 'a doorway between worlds', 'the world', 'cue', (s) => s.page(), { web: [[MAIN, /sound\.page/]], engine: [[ENG, /sound\.page/]] }),
  A('quest-start', 'a quest given', 'the world', 'cue', (s) => s.quest?.('start') ?? s.chime(), { key: true, repeats: false, web: [['src/story/quests.js', /quest\?\.\('start'\)|sound\?\.chime/]] }),
  A('quest-step', 'a quest\'s step done', 'the world', 'cue', (s) => s.quest?.('step') ?? s.chime(), { key: true, repeats: false, web: [['src/story/quests.js', /quest\?\.\('step'\)|sound\?\.chime/]] }),
  A('quest-done', 'a quest done', 'the world', 'cue', (s) => s.quest?.('done') ?? s.chime(), { key: true, repeats: false, web: [['src/story/quests.js', /quest\?\.\('done'\)|sound\?\.chime/]] }),
  A('purchase', 'buying in a shop', 'the world', 'cue', (s) => s.purchase(10), { web: [['src/shop-panel.js', /purchase/]] }),
  A('whistle', 'the mount\'s whistle', 'the world', 'action', (s) => s.whistle('mount'), { web: [[MAIN, /sound\.whistle/]], engine: [[ENG, /sound\?\.whistle/]] }),
  // ------------------------------------------------------------------ the menus and the talk
  A('menu-open', 'a menu opening', 'the menus', 'ui', (s) => s.ui?.('open'), { key: true, web: [[MAIN, /sound\.ui\?*\.?\(?'open'|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('menu-close', 'a menu closing', 'the menus', 'ui', (s) => s.ui?.('close'), { key: true, web: [[MAIN, /sound\.ui|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('menu-move', 'the cursor moving', 'the menus', 'ui', (s) => s.ui?.('move'), { key: true, web: [[MAIN, /sound\.ui|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('menu-confirm', 'a choice confirmed', 'the menus', 'ui', (s) => s.ui?.('confirm'), { key: true, web: [[MAIN, /sound\.ui|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('menu-back', 'back out of a page', 'the menus', 'ui', (s) => s.ui?.('back'), { key: true, web: [[MAIN, /sound\.ui|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('menu-tab', 'the next tab', 'the menus', 'ui', (s) => s.ui?.('tab'), { web: [[MAIN, /sound\.ui|uiSound\(/]], engine: [[ENG, /sound\.ui|uiSound\(/]] }),
  A('talk-choice', 'an answer chosen in a conversation', 'the menus', 'ui', (s) => s.toolClick?.(true), { key: true, web: [['src/story/dialogue.js', /toolClick/]] }),
  A('photo', 'a photo taken', 'the menus', 'cue', (s) => s.shutter?.(), { web: [[MAIN, /shutter/]], engine: [[ENG, /shutter/]] }),
];

/** The Sound's methods the list plays (a method the game calls that is not here is reported, not judged). */
export const PLAYED = new Set(ACTIONS.flatMap((a) => (a.calls ?? [])));
