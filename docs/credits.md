# Credits

The third-party art, animation and sound the game uses, and their licences.

- Animations: [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html)
  by Quaternius, CC0. This is the full version with the climbing set, from the glTF mirror at
  [Cinevva](https://app.cinevva.com/tools/animations) (UE mannequin bone names). It has
  been trimmed to the 16 clips used here (`public/anim/ual.glb`, 219 KB): locomotion, jumps,
  driving, talking, look-around, the climb loops (idle/up/down/left/right) and the ledge climb.
- Human body: [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)
  by Quaternius, CC0, with the Superhero male and female models and
  textures removed (`public/anim/human_*.glb`).
- Motion capture: the people's walks and the motion-matching database (`public/anim/walks.glb`,
  `public/anim/locomotion.glb`) are converted from the
  [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/). The data used in this
  project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF
  EIA-0196217. Takes and terms: docs/motion-data.md.
- License texts are in `public/anim/`.
- Sound effects (`public/sfx/`, the body's foley and the blade's swings and hits): all CC0 1.0
  (public domain), cut, filtered and re-encoded by `scripts/sfx-build.mjs`; each file's source is in
  `public/sfx/manifest.json`.
  - [Impact Sounds](https://kenney.nl/assets/impact-sounds) and [RPG Audio](https://kenney.nl/assets/rpg-audio)
    by Kenney (kenney.nl), CC0: footsteps, landings, cloth, belts, leather, creaks, wood knocks.
  - From [Freesound](https://freesound.org), sounds marked Creative Commons 0 on their pages (their HQ
    previews): breaths and exhale grunts by gtrempe (#444726), pain grunts by unfa (#610998) and
    MrFossy (#547209), sighs by ValentinPetiteau (#569568) and elle-trudgett (#146769), body falls by
    leonelmail (#504626) and #346694, whooshes by qubodup (#60013, #59988), Jofae (#389590),
    SypherZent (#420668), Dalesome (#352719) and florianreichelt (#683101), wet splats by Breviceps
    (#445109), nebulasnails (#495118, #495117) and gprosser (#360942), cloth flaps by martian (#19290)
    and memuse (#280205), swimming by craigsmith (#438845) and small splashes by N-RAZM (#390391).

## Notes that sat under the credits

Character rendering and scout regression checks: `node --test tests/*.test.js`.

The desert reference pass adds cream radio equipment, a softer lavender suit,
a shallow turquoise mineral basin west of camp, a suspension bridge farther
northwest, and large dish canopies above the dome village. Running and climbing
now use speeds matched to the animation; climb contacts orient palms and toes
toward the wall. The bike parks within boarding range and recalls to a clear
nearby spot if blocked or still travelling after four seconds.
