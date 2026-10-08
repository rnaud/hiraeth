# Controls and the controller

Keyboard, mouse, touch and gamepad: the layout, the prompts and the October 2026 controls.

## Keyboard, mouse, touch and the tool

```bash
npm install
npm run dev     # http://localhost:5173
```

Controls: click to capture the mouse · WASD move · Shift run · Space jump ·
hold Space in the air to glide · mouse wheel zoom · Esc releases the mouse.
**F** swings the fluid blade (RB / R1 on a controller, ⚔ on touch), **Ctrl** or **Z** held (on land) guards (LB / L1, 🛡), **Alt** evades (X / □, touch ↶). **Tab** locks on to a foe (R3, ◉): docs/systems/foes.md. The push is a gun mode (X, the D-pad, ◐), fired as a shot; C and the middle button do nothing now. **F3** toggles the FPS counter. **H** shows or hides the controls help (hidden by default). **E** interacts: whistle for the level's mount (or hail a taxi), get on, get
off. **Q** (or touch **ping**) launches a tiny backpack scout toward your next
objective. It waits a few metres ahead, labels the destination and returns after
five seconds; ping again to refresh it. The guide follows quest progress and
portal routes, with local obstacle avoidance. **L** opens the level picker. Each level's controls are listed in [worlds.md](worlds.md), "Levels".

**The tool:** hold right mouse (or **R**) to aim, click (or **G**) to fire, and
**X** to switch modes (fluid, push, and those found). On a gamepad, LT aims, RT fires while
aiming and the D-pad switches; on touch, use **◎ ✺ ⇄**. The paralyze ray
freezes wildlife and people briefly. Foam darts activate things from afar:
reactive scenery, observatory lenses within 30 m, cruising
taxis and Lorn's carnivorous plants.

## Controller

Connect a standard Xbox, PlayStation or compatible gamepad, then press a button
while the game is focused. Keyboard and touch remain available (unchanged).

The layout is by **position**, so a Retroid Pocket (letters printed Nintendo-style:
B at the bottom, A on the right, Y left, X top) and an Xbox pad put the same action
under the same thumb (`src/controller.js`, from a Retroid player's feedback):

| | bottom (Xbox A, Retroid B) | right (Xbox B, Retroid A) | left (Xbox X, Retroid Y) | top (Xbox Y, Retroid X) |
|---|---|---|---|---|
| walking | jump (again in the air: boost; hold: wings) | interact, talk, get on | evade; with LT: call mount / taxi | ping |
| riding | jump off (a hop, its speed carries you) | get off (moving or flying: jump off) | hop / flap / rise (a cab: where to?) | |

- **Walking:** left stick moves; click it (L3) to run, until you let the stick go.
  Right stick looks; hold LB / L1 and the right stick zooms (with no foe near: in a fight LB / L1 is the
  guard). LT / L2 aims the fluid tool and RT / R2 shoots while it is held (the **push** is a gun mode, fired
  the same way); RT / R2 without LT is the **jets'** throttle (analog; they fly like a plane: see
  docs/systems/movement-and-camera.md).
  **RB / R1 swings the fluid blade** (press again to chain three swings), **LB / L1 held guards**, **R3 locks
  on** to the nearest foe, then the next, then lets go (docs/systems/foes.md). D-pad left / right changes the
  gun mode (fluid, push and those found), up sounds the bell-note whistle, down photo mode. View / Select opens the sketchbook on your **gear**
  (every item and what it does, `gearHtml` in `src/items.js`); Menu / Start the settings.
- **The pad's interact never whistles.** On the keyboard E still falls back to the
  whistle when nothing is near; on a pad that is LT + the left button's (`player.callMount`).
- **Riding** (context `'ride'`, `padRide()`): RT / R2 is an analog throttle, LT / L2
  brakes and reverses, the left stick steers (pushing it forward does not drive), and on
  the bird it tilts too: forward dives, back climbs. RB / R1 or
  L3 boosts the hoverbike and skiff. On the ground a squeeze of RT lifts the bird off.
  The bottom button jumps off, the left button is the vehicle's own hop / flap / rise.
  A cab drives itself (movement.md, "Riding a cab"): its dash asks where to as you get in
  (choose a stop like an answer: the stick or d-pad and A / ×), X / □ (SPACE) asks again,
  B / ○ (E) steps out at the stop; the triggers and the stick do nothing in it.
- **Menus** confirm with the button printed **A** and go back with **B**, each platform's
  habit: Xbox bottom / right, Retroid right / bottom. View and Menu close too. While
  **talking**, the interact button also carries the conversation on (so on Xbox, B to
  talk and B again does not walk away). Photo: sticks fly / look, LB / RB lower / raise,
  confirm saves, back or D-pad down leaves.
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
  does not fire). Without aiming, RT / R2 and the left mouse button (pointer captured)
  fire the jets. G alone does nothing. The touch ✺ button writes `TouchFire`, a quick
  shot that raises the arm for you, since touch has no trigger to hold.
- **The jets fly like a plane** (v0.89, replacing "like Superman", which replaced "steer like the
  bird"): RT / R2 is the throttle, analog (`PadThrust`, `triggers().thrust`); from the ground it lifts
  you straight up. The left stick flies the nose: forward dives, back climbs (Settings: invert),
  left / right bank and turn. Let go to glide; LT / L2 in flight holds you to shoot. The keyboard's
  left click or SPACE held in the air, and touch's ⤒ held, are full throttle; W / S and A / D (the
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
