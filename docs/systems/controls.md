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
sounds the bell-note whistle (and the echo shell). **C** drinks a healing potion (D-pad ← on a pad,
the flask beside the hearts on touch: docs/systems/items.md). **P** photo mode. **L** opens the level picker. Each
level's controls are listed in [worlds.md](worlds.md), "Levels".

**The tool:** hold right mouse (or **R**) to aim, left click (or **G**) to fire while aiming, and **X** to
switch modes (fluid, push, and those found). On a gamepad, LT aims, RT fires while aiming and D-pad →
takes the next mode (round again after the last); on touch, use **◎ ✺ ◐**. The jets: Space held in the air (RT on a pad). The paralyze ray
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
  Since v1.2 the page shows the half that matches the pad in hand (`padFamily` from the Gamepad id:
  "A" on Xbox, "×" on PlayStation, a Switch pad's own letters), and the menus' buttons carry their
  prompt as a glyph inside them (`src/pad-glyphs.js`; docs/systems/ui.md, "The menus on a controller").
  A Switch pad on a computer confirms with its A, on the right.

### Pads without the standard mapping (`src/pad-maps.js`, v0.93)

A browser gives the W3C Standard Gamepad layout (`mapping: 'standard'`) only to pads it knows; the rest
come raw (`mapping: ''`), buttons in their HID report's order. The author's 8BitDo SN30 Pro in D-input
mode on a Mac was one: read as standard, its bottom button evaded, LB aimed, View was Menu, the D-pad (a
hat switch on axis 9) and the right stick's y (axis 5) did nothing. `installPadMaps()` (called from
`installNativePad`, so for the title screen too) wraps `navigator.getGamepads()`: every pad without the
standard mapping comes out as a standard one, with `.remap = { profile, raw, hat, left, right, sources }`;
standard pads and the Android app's pad come out untouched (the same objects, the same array, nothing
allocated). So `controller.js` and every raw reader (`padIndex`) see one layout.

- **Detection:** by `mapping`, then vendor / product parsed from the id (Chrome `… (Vendor: 2dc8
  Product: 6101)`, Firefox `2dc8-6101-…`), then the name (Safari gives only the product name).
- **Axes by browser:** Chrome on macOS puts each HID axis at usage − 0x30 (X 0, Y 1, Z 2, Rx 3, Ry 4,
  Rz 5, the hat 9) and the simulation page's Accelerator / Brake (analog triggers) in the first free slots
  (`gamepad_device_mac.mm`); Firefox's default remapper and Safari's HID pads list them in report order.
  A profile lists its axes by usage and `axisMap()` places them. A hat is also learned at run time: any
  axis that reads beyond ±1 (a hat's neutral, 1.29 or 3.29) is one. `hatDirection()` decodes the eight
  steps of 2/7 from −1 (up, clockwise); anything off them is neutral (0.0 before the first report too).
- **Triggers:** the digital L2 / R2 buttons and, where there is one, the analog axis (0..1 from its rest
  at −1, counted only once that rest has been seen: an axis not reported yet reads 0), whichever is more.
- **Profiles** (`PROFILES`, from SDL's game controller database, Mac rows, and the browsers' own
  remappers): `8bitdo` (Nintendo letters, the default for vendor 2dc8: SN30 Pro 6001 / 6101, SN30 Pro+
  6002 / 6102, Pro 2, Lite, NES30 / N30 Pro…: raw 0 A right, 1 B bottom, 3 X top, 4 Y left, 6 / 7 L / R,
  8 / 9 L2 / R2, 10 Select, 11 Start, 13 / 14 L3 / R3, Home 12 or 2), `8bitdo-xbox` (Ultimate, the adapters,
  M30: raw 0 A bottom), `8bitdo-dpad` (stickless SN30, Zero 2, NES30: the D-pad axes walk as the left
  stick, since its D-pad slots would fire on every step), `dualshock4` / `dualsense` (raw in Firefox, or
  Safari outside the GameController framework), `switchpro`, `snes` (USB SNES pads: 0810:e501, 081f:e401,
  0079:0011), and `generic` for the rest: read as standard, as before, but a hat (once seen) is its
  D-pad and Chrome's right stick is Z / Rz.
- **Faces by position:** the bottom face button is the game's A / × on every pad, whatever is printed
  on it (the SN30 Pro's B). Prompts stay in Xbox / PlayStation form; the setting **Controller buttons: A
  on the right** prints Nintendo letters and confirms menus with the right button, as on a Retroid.
- **The SN30 Pro's modes on a Mac:** macOS mode (A + Start) emulates a DualShock 4 and X-input
  (X + Start) an Xbox pad, which every browser maps itself; D-input (B + Start) and Switch mode
  (Y + Start) may come raw, and are what this reads.
- Tests: `tests/pad-maps.test.js` (each profile on a raw fixture; the hat's 8 directions and neutral;
  standard pads unchanged; the controller driven through a raw SN30 Pro).

### The input display (`src/input-display.js`, v0.93)

To see a controller register: a small ink drawing of a pad in the lower right, each button lit as it is
pressed, both sticks where they are, the triggers' travel as bars; under it the pad's `id`, its
`mapping`, vendor:product, the browser's layout and the profile chosen (with the hat's axis and the
right stick's), the raw state live (pressed button indices, every axis), and the last six presses as
`raw → button → what it does`: `button 7 → RB / R1 → the fluid blade`, `axis 9 = 0.14 → D-pad ↓ → call
the mount`, `button 5 → not mapped`. What it does is the first clause of `src/bindings.js` `BINDINGS`
for the controller's context (`actionLabel`). On in the Arena; View + D-pad ← there (a free chord), **F6**
anywhere, the dev menu, `?inputs=1` (`?inputs=0` keeps it off in the Arena). Off, `update()` returns at
once and nothing is built.

On browsers that require a touch or click to enable audio, tap the page once.
Controller logic and browser integration are tested with simulated standard pads;
physical controller testing is still needed on iPhone.


## Rumble (`src/rumble.js`, v1.6)

The controller shakes for a few moments, each a named pattern of pulses (the heavy motor and the light one,
0..1): `hurt` (by the hearts lost, main.js `onHurt`; a fall rumbles as its landing instead), `slam` (a heavy
foe's ground slam, by distance out to 14 m: `src/foes.js` `addWave`), `land` (a hard landing's tumble) and
`knockdown` (main.js `onKnockdown`), `potion` (two soft swallows, `onDrink`), `charged` (the blade's charged
cut let go, harder when full: `src/fluid-blade.js` `release`), `chime` (a picked-up chime, the lightest tick),
`takeoff` (the ship off its feet: `src/ship/cinematics.js`), `search` (the galactic map's signature search: three
pulses, stronger and closer together nearer a world) and `found`.

- **Where it plays:** the Gamepad API's `vibrationActuator.playEffect('dual-rumble', …)` (Chrome and Edge on
  a computer, the Steam Deck's Electron app, the Xbox app's WebView2), `hapticActuators[0].pulse()` where only
  that exists; in the Android app, whose pads are its own (`src/native-pad.js`), the bridge's AppShell
  `rumble` ({ ms, strong, weak }, `Rumbler.java`): the last pad's own vibrators (two motors on Android 12+ get
  the strong and weak pulses apart), or the handheld's motor under built-in controls (a Retroid); a phone with
  no pad never vibrates. `AppShell.info` says `rumble` (NATIVE_API 8, the VIBRATE permission).
- **Settings > Controls:** Controller rumble (on by default) and Rumble strength (low 0.45, medium 0.75 by
  default, high 1). Without a pad that can shake both are greyed out ("no controller that can rumble") and
  nothing plays; changing them plays a short pulse to feel.
- Nothing depends on it: every cue that rumbles also shows and sounds. `tests/rumble.test.js`.

## Remapping (`src/remap.js`, the Controls page)

The tables in `src/bindings.js` stay the defaults and the one source: `KEYS` (each keyboard verb's
key, by `KeyboardEvent.code`, so by position: an AZERTY's Z is `KeyW`) and `PAD_VERBS` (each pad
verb's button by position; `PAD`, the prompts' names, is built from it). A player's changes are
overrides beside them, saved with the settings (`keys: { verb: code }`, `pad: { verb: button }`);
`setControlPrefs` drops anything that is not a verb, not a change, or on a key the menus need
(Esc, Enter, the F keys, the dev menu's backquote). The game never reads the overrides:

- **The keyboard.** `installKeyRemap()` (boot.js, before any other key listener) listens in the
  capture phase on the window. A key a verb was moved to is sent on as that verb's *default* key
  (a new `KeyboardEvent` with its code, dispatched at the same target; the original is stopped); a
  default key whose verb moved away, and that nothing took, sends nothing (`keyRoutes`). Typing in
  a text field is left alone. Toggle run / guard is done here too.
- **The pad.** `Controller.update` reads each default button through `padMap()` (index → the
  button pressed for it) while playing and riding (riding, the same verbs' buttons: jump off is
  the jump's). Menus, conversations and photo mode keep the default buttons: A confirms and B goes
  back whatever the player did, so the way out is never lost; View and Menu can't be moved. With
  View held, the D-pad is still View's layer (photo), whatever verb is bound there. Analog values
  follow their verb (fire moved to a face button still throttles the jets, at full).
- **Two verbs on one key or button** is a *clash*, not refused: both happen. The Controls page
  marks both rows (⚠, the other verb named, a dashed frame) and says so under the list.
- **The prompts** are written with the default names and renamed on the page: native-pad.js's
  text rewriter (the same one that prints a Retroid's own letters) runs `padRename` on every text
  ("A / ×" is the button now bound to jump; one pass, so a swap stays a swap) and `keyRename` on
  key badges (`.key` holding exactly a default key's name: "E", "SPACE", "W/S"). Under `.pad-raw`
  (the conversation panel, the game menu, the restart card, the Controls page's own lists, the
  "Talking", "In menus", "Their panels" and "Photo mode" rows) the pad names are not renamed:
  those are the menus' own buttons (they still show one half of "A / ×": docs/systems/ui.md). The keyboard's names follow the keyboard's layout where the
  browser tells it (`navigator.keyboard.getLayoutMap`: an AZERTY shows ZQSD) and the language
  ("ESPACE", "MAJ").
- **The Controls page** (Start menu → Controls, or H) starts with "Your buttons" and "Your keys"
  (the one in your hands first, `rebindHtml`): each verb with its key or button, a press on it
  waits for the next key (`captureKey`, Esc leaves it) or button (`capturePad`: the controller
  hands it the next new press after the others are let go; Menu or View leaves it), 8 s at most;
  "Reset to defaults" clears that device's overrides. Touch is not remapped; the mouse buttons stay.
- **Hold or toggle** (settings: Run, Guard; `RUN_MODES` auto / hold / toggle, `GUARD_MODES` hold /
  toggle). Auto is the pad's old L3: run until the stick is let go (on the keyboard, held).

Tests: `tests/accessibility.test.js` (routes, conflicts, the controller through a map, captures,
renamed prompts, saved prefs) and `tests/bindings.test.js` (the default table).

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
   The debug levels borrowed the mount's chord: the References' list of views and the Arcade's games board
   opened on LT + X / □ (they follow the mount's button, so now D-pad ↓); the Arcade's game cards turn to
   the game before / after on LB / RB, as the menus' panels do (kept).
8. Keyboard: B was a gadget key and a guard key; the attack was F, where every PC action game attacks
   on the left click.

### After (v0.93; the D-pad's quick slots as of v1.11: one job per button)

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
| D-pad ↓ | **call the mount, hail a taxi** (the Arena, the Arcade, the References: their list) | | | | | | navigate | |
| D-pad ← | **drink a healing potion** (v1.11; View + D-pad ↓ before) | | | | | | navigate | |
| D-pad → | **the next gun mode** (round again after the last; ← took the one before until v1.11) | | | | | | navigate | |
| View (on release) | the sketchbook | | | | the sketchbook | | close | **leave** |
| View + D-pad ↑ | **photo mode** (also in the Start menu) | | | | photo mode | | | |
| View + D-pad ↓ / ← / → | **free** (`padchord` events; in the Arena ← toggles the input display) | | | | | | | |
| L3 + R3 | debug: the hitbox overlay (F4) | | | | | | | |
| Menu | the Start menu | | | | the Start menu | | close | leave |

Keyboard and mouse: the **left click** swings the blade (pointer captured, not aiming; aiming, it shoots),
F still does; Ctrl or Z guards, Alt evades, Tab locks on, Q the scout, V the whistle, B only chooses
gadgets. The jets on a keyboard are Space held in the air. Touch keeps its buttons; photo mode is in the
Start menu.

### Why each is where it is

- **Kept:** A jump, the shoulders and the triggers (RB blade, LB guard, LT aim, RT fire / jets: already the
  souls and Horizon layout), L3 run, R3 lock-on, D-pad ↑ gadgets with the hold-to-open wheel (Zelda's ability wheel is on ↑), View and Menu, the
  riding layout (A jumps off: the author's own handheld request; B, back, gets off; RT / LT drive).
- **B evades, X interacts:** dodge on the right button is the strongest habit the reference games share,
  and back in menus is the same button, so "B gets you out" holds everywhere: a blow, a menu, a vehicle, a
  cab, a conversation. Interact moves to the free left button, as Horizon's □.
- **D-pad ↓ calls the mount:** Zelda's whistle, one press on a quick slot instead of a chord on the aim
  trigger; the keyboard's E still whistles when nothing is near. The levels with a quick menu and no mount
  (the Arena's FOES list, the Arcade's board, the References' views) open it on ↓ instead: there is
  nothing to call there, so the button still has one job in each place.
- **One job per button (v1.11):** each D-pad direction is one verb, whatever you are doing: ↑ gadgets (tap
  the next, hold the wheel, gadgets only), ← the potion, ↓ the mount, → the next gun mode. The potion
  leaves View + D-pad ↓ for a single press (it is drunk mid-fight); the gun modes, which took both ← and
  →, keep → alone and go round (there are four at most). v1.11's first build tried double duties instead
  (L3 clicked standing still called the mount, a tap of ↑ while aiming took the next gun mode, the potion
  on ↓): a button whose job depends on whether the stick is at rest or LT is held proved confusing, so it
  went back to one job per button (`PAD_SCHEME` 4).
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
- **Free for later:** View + D-pad ↓ / ← / → (↓ drank the potion from v1.5 to v1.10), sent as a `padchord` window event (`{ detail: { name:
  'viewDown' | 'viewLeft' | 'viewRight' } }`). The hitbox overlay keeps L3 + R3 (both sticks: a debug
  combo nobody presses by accident; R3 alone still locks on, L3 alone runs).
- **The keyboard:** the left click attacks as in every PC action game (and shoots while aiming, as
  before); B is only the gadgets' key, so it never raises the shield.
- **Players from before** see a one-time note the first time they use a pad (`PAD_SCHEME` in
  `src/bindings.js`, kept on the device as `moebius.padScheme`). The buttons a player moved (the settings'
  `pad`) are brought up to date once (`migratePad` in `src/remap.js`, from `migrateSettings`, marked
  `padV`): from schemes 1–2, the mount and the next gun mode stay where they were and the mode before is
  gone; from scheme 3 (a saved `potion` tells it), the potion keeps the button chosen and a verb the player
  had swapped onto ↓ (the potion's place then) moves to ←, its place now, so a swap stays a swap.
  Whatever still shares a button after that goes back to its default.

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
