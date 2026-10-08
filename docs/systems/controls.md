# Controls and the controller

Keyboard, mouse, touch and gamepad: the layout, the prompts and the October 2026 controls.

## Keyboard, mouse, touch and the tool

```bash
npm install
npm run dev     # http://localhost:5173
```

Controls: click to capture the mouse · WASD move · Shift run · Space jump ·
hold Space in the air to glide · mouse wheel zoom · Esc releases the mouse.
**Left click** (pointer captured, not aiming) or **F** swings the fluid blade, **Ctrl** or **Z** held (on
land) guards, **Alt** evades, **Tab** locks on to a foe (docs/systems/foes.md). **F3** toggles the FPS
counter, **F4** the hitboxes (L3 + R3 on a pad: docs/systems/foes.md, "Hitboxes"). **H** opens the
Controls page. **E** interacts: get on, get off, talk, use; with nothing near it whistles for the level's
mount (or hails a taxi). **Q** (or touch **ping**) launches a tiny backpack scout toward your next
objective. It waits a few metres ahead, labels the destination and returns after five seconds; ping again
to refresh it. The guide follows quest progress and portal routes, with local obstacle avoidance. **V**
sounds the bell-note whistle (and the echo shell). **P** photo mode. **L** opens the level picker. Each
level's controls are listed in [worlds.md](worlds.md), "Levels".

**The tool:** hold right mouse (or **R**) to aim, left click (or **G**) to fire while aiming, and **X** to
switch modes (fluid, push, and those found). On a gamepad, LT aims, RT fires while aiming and the D-pad's
← / → switch; on touch, use **◎ ✺ ◐**. The jets: Space held in the air (RT on a pad). The paralyze ray
freezes wildlife and people briefly. Foam darts activate things from afar: reactive scenery, observatory
lenses within 30 m, cruising taxis and Lorn's carnivorous plants.

**Gadgets** (v0.90, docs/systems/gadgets.md): **T** or the middle mouse button uses the one in hand
(hold to aim, let go), **B** takes the next (Shift + B the one before; held: the wheel); on a pad Y / △
and D-pad ↑; on touch ◆, and the chip in the corner takes the next. With no gadget in hand the use
button sounds the bell-note whistle.

## Controller

Connect a standard Xbox, PlayStation or compatible gamepad, then press a button
while the game is focused. Keyboard and touch remain available.

The layout is by **position**, so a Retroid Pocket (letters printed Nintendo-style:
B at the bottom, A on the right, Y left, X top) and an Xbox pad put the same action
under the same thumb (`src/controller.js`, from a Retroid player's feedback). The whole table, one
job per button per context, is `src/bindings.js` (`BINDINGS`; `PAD`, the names the prompts use); "The
layout" below has it, the audit it came from and why each button is where it is.

- **Riding** (context `'ride'`, `padRide()`): RT / R2 is an analog throttle, LT / L2
  brakes and reverses, the left stick steers (pushing it forward does not drive), and on
  the bird it tilts too: forward dives, back climbs. RB / R1 or L3 boosts the hoverbike and
  skiff. On the ground a squeeze of RT lifts the bird off. The bottom button jumps off, the
  right one (back) gets off, the left one is the vehicle's own hop / flap / rise.
  A cab drives itself (movement.md, "Riding a cab"): its dash asks where to as you get in
  (choose a stop like an answer: the stick or d-pad and A / ×), X / □ (SPACE) asks again,
  B / ○ (E) steps out at the stop; the triggers and the stick do nothing in it.
- **Talking:** the button printed A, or the interact button (X / □), carries the conversation on; B goes
  back (leaves), as in every menu.
- **Photo:** sticks fly / look, LB / RB lower / raise, confirm saves, back, View or Menu leaves.
- **Menus** confirm with the button printed **A** and go back with **B**, each platform's
  habit: Xbox bottom / right, Retroid right / bottom. View and Menu close too.
- **Where the letters are** (`src/native-pad.js` `padFaces`): Android reports buttons by
  printed letter (KEYCODE_BUTTON_A is index 0), so on a Nintendo-labelled handheld
  index 0 is the right button; `toPositions()` moves them to the standard positions.
  Auto picks Nintendo letters for the Android app and handhelds (Retroid, Anbernic,
  AYN), Xbox for Xbox / PlayStation pads and computers. The setting **Controller
  buttons** overrides it: A at the bottom (Xbox, PlayStation), A on the right (Retroid,
  Nintendo), or A on the right with a Retroid switched to its own Xbox style (letters
  Nintendo, reported by position). It replaces the old Swap A/B.
- **Prompts** are written by position in Xbox / PlayStation form ("A / ×" is the bottom
  button); `padText()` prints the pad's own letter (a Retroid's bottom button reads "B").
  Menu prompts use `confirmKey()` / `backKey()`, and code reading raw pad buttons (the
  galactic map, the homecoming, skipping a scene) uses `padIndex('ok' | 'back')`.

On browsers that require a touch or click to enable audio, tap the page once.
Controller logic and browser integration are tested with simulated standard pads;
physical controller testing is still needed on iPhone.


## The layout (v0.93: a pass with a controller, after the big action games)

The pad had grown one verb at a time, and some buttons had two jobs that changed under you. This pass
lines it up with what players' thumbs already know from the big third-person action games, keeps what
already matched, and gives every button one job per context (`src/bindings.js`, checked by
`tests/bindings.test.js`).

### What the reference games share

- **A / × jumps** and confirms (Elden Ring, Horizon, Assassin's Creed, Genshin; God of War where it lets you).
- **B / ○ dodges** (Elden Ring's roll and backstep, the dodge rolls of Horizon, God of War and Assassin's
  Creed, Genshin's dash) and is **back** in every menu.
- **Attacks and the guard on the shoulders:** R1 light, R2 heavy, L1 guard and parry (souls-likes, God of
  War, Assassin's Creed). **L2 aims, R2 fires while aiming** (Horizon's bow, God of War's axe).
- **R3 locks on** (souls-likes; Elden Ring turns the camera behind you when there is nothing to lock);
  Horizon's R3 is its Focus scan, which shows the way to the objective. **L3 sprints** (Horizon, God of War).
- **The D-pad is the quick slots:** in Breath of the Wild / Tears of the Kingdom ↑ held opens the ability
  wheel, ← / → the weapon wheels, ↓ whistles for the horse; Elden Ring's D-pad cycles its slots.
- **View / touchpad the map or journal, Menu / Options pause.**
- **Interact** sits on a face button that is neither jump nor dodge (Horizon's □).

### Before (to v0.92): the audit

| button | on foot | in a fight | aiming | climbing · swimming · gliding · jets | riding (bike, skiff, bird) | cab | menus · talking | photo |
|---|---|---|---|---|---|---|---|---|
| A / × | jump · boost · held: wings | same | same | climb-jump · rise · wings · climbs on the jets | jump off | choose a stop | confirm · confirm | save |
| B / ○ | interact, talk, get on | same | same | | get off | get out | back · **carries on (Xbox only)** | leave |
| X / □ | evade | evade | **+ LT: call the mount** | | hop / flap / rise | where to | | |
| Y / △ | **the gadget, or the scout with none in hand** | same | same | | the scout | | | |
| RB / R1 | the blade | same | | | boost | | panel after | up |
| LB / L1 | **+ right stick: zoom** | **guard** | | | | | panel before | down |
| LT / L2 | aim | | | jets: hold to aim | brake | | | |
| RT / R2 | the jets' throttle | | shoot | the jets' throttle | throttle | | | faster |
| L3 | run | | | climb fast · swim fast · jets faster | boost | | | |
| R3 | lock on (nothing near: nothing) | lock on | | | lock on | | | |
| D-pad ↑ | **choose a gadget (held: the wheel), or the bell while none is owned** | | | | **the bell** | | navigate | |
| D-pad ↓ | photo mode | | | | photo mode | | navigate | leave |
| D-pad ← → | gun mode | | | | | | navigate | |
| View | the sketchbook | | | | the sketchbook | | close | |
| Menu | the Start menu | | | | the Start menu | | close | leave |

Keyboard: **B** chose the gadget *and* guarded (the runtime took it from the guard once a gadget was
owned); **F** attacked while the **left mouse button** fired the jets.

Conflicts and oddities:
1. **Y / △ changed job under you:** the scout with nothing in hand, the gadget with one; taking a gadget
   silently took the scout away (riding gave it back).
2. **The bell had no pad button once a gadget was owned:** D-pad ↑ rang it only until the first gadget, and
   the item card, the found-it toasts and the bell and shell guardians' hints said "R3", which locks on.
   On a pad with a gadget, those two fights could not be played.
3. **B / ○ interacted,** where every reference game dodges and menus go back; talking needed an exception
   so B did not walk away on Xbox (on a Retroid it did).
4. **Calling the mount was LT + X:** a chord of the aim trigger and the evade button, for the most used
   travel verb.
5. **Photo mode** held a prime quick slot (D-pad ↓) and had no way in at all on a touch screen.
6. **R3 with nothing to lock on to did nothing.**
7. The Arena's description said LB / L1 swings the blade (it is RB / R1).
8. Keyboard: B was a gadget key and a guard key; the attack was F, where every PC action game attacks
   on the left click.

### After (v0.93)

| button | on foot | in a fight | aiming | climbing · swimming · gliding · jets | riding | cab | menus · talking | photo |
|---|---|---|---|---|---|---|---|---|
| A / × | jump · boost · held: wings | same | same | as before | jump off | choose a stop | confirm · carry on | save |
| B / ○ | **evade** (the stick's way, or a backstep) | evade | evade | | get off (moving: jump off) | get out | back · **leave** | leave |
| X / □ | **interact, talk, pick up, get on** | same | same | | hop / flap / rise | where to | · **carry on** | |
| Y / △ | the gadget in hand · **none in hand: the bell-note whistle / echo shell** | same | same | | | | | |
| RB / R1 | the blade | same | | | boost | | panel after | up |
| LB / L1 | + right stick: zoom (no foe near) | guard | | | | | panel before | down |
| LT / L2 | aim | | | jets: hold to aim | brake | | | |
| RT / R2 | the jets' throttle | | shoot | the jets' throttle | throttle | | | faster |
| L3 | run | | | as before | boost | | | |
| R3 | lock on · **no foe in reach: the scout** | lock on, the next, let go | | **the scout** | **the scout** | | | |
| D-pad ↑ | choose a gadget (tap: the next, held: the wheel) | | | | | | navigate | |
| D-pad ↓ | **call the mount, hail a taxi** | | | | | | navigate | |
| D-pad ← → | gun mode | | | | | | navigate | |
| View (on release) | the sketchbook | | | | the sketchbook | | close | **leave** |
| View + D-pad ↑ | **photo mode** (also in the Start menu) | | | | photo mode | | | |
| View + D-pad ↓ / ← / → | **free** (`padchord` events) | | | | | | | |
| L3 + R3 | debug: the hitbox overlay (F4) | | | | | | | |
| Menu | the Start menu | | | | the Start menu | | close | leave |

Keyboard and mouse: the **left click** swings the blade (pointer captured, not aiming; aiming, it shoots),
F still does; Ctrl or Z guards, Alt evades, Tab locks on, Q the scout, V the whistle, B only chooses
gadgets. The jets on a keyboard are Space held in the air. Touch keeps its buttons; photo mode is in the
Start menu.

### Why each is where it is

- **Kept:** A jump, the shoulders and the triggers (RB blade, LB guard, LT aim, RT fire / jets: already the
  souls and Horizon layout), L3 run, R3 lock-on, D-pad ← / → gun mode (the story's "X or the D-pad" stays
  true), D-pad ↑ gadgets with the hold-to-open wheel (Zelda's ability wheel is on ↑), View and Menu, the
  riding layout (A jumps off: the author's own handheld request; B, back, gets off; RT / LT drive).
- **B evades, X interacts:** dodge on the right button is the strongest habit the reference games share,
  and back in menus is the same button, so "B gets you out" holds everywhere: a blow, a menu, a vehicle, a
  cab, a conversation. Interact moves to the free left button, as Horizon's □.
- **D-pad ↓ calls the mount:** Zelda's whistle, one press on a quick slot instead of a chord on the aim
  trigger; the keyboard's E still whistles when nothing is near.
- **The scout on R3 when nothing can be locked on to:** R3 means "find something": a foe if one is in reach
  (souls), else the way to the objective (Horizon's Focus). In a fight R3 always locks; out of one it never
  needs to. It works riding and flying, where Y sent it before. (Bosses are not foes in reach: in a
  temple, R3 asks the drone for a hint, as the ping did: docs/systems/boss-hints.md.)
- **The whistle on Y with no gadget in hand:** Y is "use what is in your hand"; with no gadget the hand
  holds the whistle (the chip shows it, the wheel's first slot says so). So the bell and the shell have a
  pad button in every fight again, one tap of D-pad ↑ (or the wheel's top) away.
- **Photo mode under View:** rarely used, so it leaves the quick slots; View held turns the D-pad into a
  second layer (the sketchbook opens as View is let go, if no chord was used meanwhile). It is in the
  Start menu too, the only way in on a touch screen.
- **Free for later:** View + D-pad ↓ / ← / →, sent as a `padchord` window event (`{ detail: { name:
  'viewDown' | 'viewLeft' | 'viewRight' } }`). The hitbox overlay keeps L3 + R3 (both sticks: a debug
  combo nobody presses by accident; R3 alone still locks on, L3 alone runs).
- **The keyboard:** the left click attacks as in every PC action game (and shoots while aiming, as
  before); B is only the gadgets' key, so it never raises the shield.
- **Players from before** see a one-time note the first time they use a pad (`PAD_SCHEME` in
  `src/bindings.js`, kept on the device as `moebius.padScheme`). Nothing else to migrate: the bindings are
  not stored, only the face-letter setting, which is unchanged.

Tests: `tests/bindings.test.js` (no button bound twice in a context; a virtual pad pressed through every
row on foot, riding, in menus, talking and in photo mode; no prompt in `src/` naming the old buttons),
`tests/controller.test.js`, `tests/gadgets-qa.test.js` (the whistle with nothing in hand).

## The controls of October 2026: straight shots, the jets on RT, jumping off

From the author's handheld sessions (TODO.md, "Controls").

- **Straight shots** (`src/fluid-tool.js`): `FLUID.shoot.gravity` is 0, so a glob flies
  in a straight line from the nozzle to the crosshair's point (`shotDir`), and nothing
  previews its path (the dotted arc is gone). The crosshair was already a straight
  camera ray, so every target lands where it did. Where a lip right in front of the
  nozzle hides a point the camera sees (hovering just under a shelf), the glob leaves
  from beside the nozzle on the crosshair's own ray instead (`clearLine`). No puzzle
  wanted a falling glob (`tool:bloom` uses only the point; the "from above" fights
  check where you stand).
- **Aim first** (`triggers()` in `src/controller.js`, used by `toolInput` and the
  player): LT / L2, the right mouse button or R aims, and only then do RT / R2, the
  left mouse button or G shoot, on a fresh press (a button held from before the aim
  does not fire). Without aiming, RT / R2 fires the jets (the left mouse button swings the blade
  since v0.93). G alone does nothing. The touch ✺ button writes `TouchFire`, a quick
  shot that raises the arm for you, since touch has no trigger to hold.
- **The jets fly like a plane** (v0.89, replacing "like Superman", which replaced "steer like the
  bird"): RT / R2 is the throttle, analog (`PadThrust`, `triggers().thrust`); from the ground it lifts
  you straight up. The left stick flies the nose: forward dives, back climbs (Settings: invert),
  left / right bank and turn. Let go to glide; LT / L2 in flight holds you to shoot. The keyboard's
  SPACE held in the air (v0.93: no longer the left click), and touch's ⤒ held, are full throttle; W / S and A / D (the
  left drag on touch) fly the nose. docs/systems/movement-and-camera.md.
- **Jump off** (`player.jumpOff`, `JUMP_OFF`): riding, the bottom button (Retroid B)
  jumps off the bird, the hoverbike, the skiff or a taxi with a 7 m/s hop. You keep
  85 % of its speed, and in the air it fades slowly until you land. The left button
  takes over the vehicle's hop / flap / rise. E and the right button still step off
  beside a vehicle that is standing. When it is moving faster than 6 m/s or flying more
  than 3 m up, they jump off too. In the air or at speed the backpack is simply back on (no
  hand-off). With the wings, they open by themselves until you press jump. A fall that
  would kill you, with no wings and no fluid for the jets, is refused ("Too high to
  jump."), unless the bird is yours: then `watchFall` calls her `JUMP_OFF.catchAfter` s
  into it, and she swoops in to catch you (`flyCatch` leads you by its own reach time).
- **The ragdoll from higher up**: `FALL.tumble` is 32 m/s (about 16 m). A fatal fall is
  still 48 m/s (about 36 m).
- Tests: `tests/jets.test.js` (the jets), `tests/controls.test.js` (jumping off the bird low and high, with and
  without wings, the refused taxi jump, the bike's momentum, the new tumble height),
  `tests/controller.test.js` (`triggers`, the ride buttons), `tests/fluid-tool.test.js`
  (the straight shot, aim-first, the lip).
