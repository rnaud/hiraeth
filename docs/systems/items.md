# Items, the backpack and the makers' boxes

What the traveller carries and the boxes that give it.

## Items, boxes and the backpack (v0.35)
- **Items** (`src/items.js`): the backpack, fluid jets, fluid wings, the stilling
  and ember modes, and the boxes' special items. Each is stored as a game flag
  `item.<id>`. `items.has/grant/revoke` take effect live.
- **Boxes** (`src/boxes/`): a dark blue chest with a pale star, after
  `references/box-opening.webp`. It glows, hums and shudders as you approach,
  and E opens it. Since v0.39 the chests are set down `BOX_SCALE` (1.9×) larger,
  and the opening scene (`scene.js`) has them wake, lift `LIFT` metres off the
  ground turning slowly, and come apart from the top down: every box material is
  made with `makeMaterial({ dissolve })`, whose `DISSOLVE` block discards the
  surface by world-space noise as `uDissolve.x` goes 0 → 1, with a burning edge
  (the box leaves the shadow pass meanwhile). The item grows out of the light
  at its centre and hovers there with a card showing its name, what it is and
  what it does. Then the item is granted, and the box is gone for good (no
  collider either).
  Each placement's `hint` makes a small quest (`box.<id>`, "A Makers' Box"):
  it starts `BOX_QUEST_DELAY` s after you arrive while the box is shut, its one
  step says where to look and points the scout at the box (locator `box.<id>`),
  and the `box.<id>` flag finishes it. The desert's first box is the story's.
  Placements are in `placements.js`: the backpack lies near the desert crash
  site as the first quest stage, and every world has a box. Fallback boxes
  appear by the ship if you reach a world without what it needs. Special item
  effects are in `effects.js`. `migrateSave` gives saves from before v0.35
  the backpack.
- **Backpack-powered abilities** (`src/fluid-tool.js`, `src/fluid-kit.js`,
  `src/flammable.js`):
  - With no backpack there is no tool, and vehicles won't start.
  - The jets drain the same reserve (0.3 charges per second) and work in any
    world. The wings bloom from the tank and are needed to glide.
  - X cycles through the modes you own: shoot, stilling (freezes), ember
    (lights `level.flammables`) and, since the temples, bloom (grows). A target that doesn't list a mode in
    `accepts` gets `'shoot'`, so every puzzle works in every mode.
  - Riding the hoverbike or skiff moves the tank into the vehicle's socket.
- **Dev menu** (`src/dev-menu.js`, the backquote key or settings): items,
  boxes, flags, teleport. Also `?items=all|none|a,b`.

## The makers' boxes, Android controls and updates (v0.36)
- **The boxes** are artifacts of the makers, the people of the glyph (see "The
  boxes" in the story bible). The backpack's box stands in the Givers' shrine
  in Qanat (231, 391). Opening it brings six villagers and Nour, the eldest,
  whose conversation sends you on the rest of `desert.power` (stages `city →
  box → elder → well → ama → speaker → down → …`). Saves are migrated: `items.v`
  2 marks the box open for anyone who has the backpack, and `desert.quest.v` 2
  maps the old stages.
- **Android controls** (`android/.../GamepadBridge.java`, `src/native-pad.js`):
  the activity reads the built-in controller and hands it to the page as a
  Standard Gamepad. With it the prompts use Android button names (A B X Y, L1
  R1 L2 R2, Select, Start); `?pad=android` forces them in a browser.
- **Updates** (`android/.../Updater.java`): on launch the app reads
  `latest.json` from the newest release (uploaded by the workflow with the APK:
  versionCode, version, APK URL). It offers newer builds and hands them to the
  system installer; the same key keeps the save.
