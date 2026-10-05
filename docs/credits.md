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

## Notes that sat under the credits

Character rendering and scout regression checks: `node --test tests/*.test.js`.

The desert reference pass adds cream radio equipment, a softer lavender suit,
a shallow turquoise mineral basin west of camp, a suspension bridge farther
northwest, and large dish canopies above the dome village. Running and climbing
now use speeds matched to the animation; climb contacts orient palms and toes
toward the wall. The bike parks within boarding range and recalls to a clear
nearby spot if blocked or still travelling after four seconds.
