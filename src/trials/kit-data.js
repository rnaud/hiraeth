// The makers' runs (docs/systems/challenges.md): optional challenges built from the temples' own kit, stood
// in the open world, a second kind of trial beside each world's ride (src/trials/data.js). Each is a short
// chain of temple pieces (gusts down a hall, a bank of eyes, crystal pendulums over a causeway) with a
// makers' sign a step from its start; the same start card, clock, best and Retry as the trials
// (src/minigames/kit/runner.js). Its reward is quiet: someone standing nearby has a word for you (on the
// results card and over their head), and the sign's plate keeps your best.
// Pure data (src/trials/kit-courses.js builds them; tests/trials-kit.test.js checks them in their worlds).
//
//   id       'kit-<world>' (its best: minigame.kit-<world>.best; its first finish: trial.kit-<world>.done)
//   course   which builder (src/trials/kit-courses.js COURSES): 'windhall', 'hushwalk'
//   origin   [x, y, z] the course's frame (its entrance, at floor level) and yaw (radians: its +z runs
//            into it); everything else is in that frame, metres
//   marker   [x, z] the sign, in the course's frame (on the ground there)
//   start    [x, z] and heading (in the frame): where the run begins
//   par      the makers' mark (s): a steady first run beats it
//   needs    items it wants (the fluid gun for a bank of eyes); lacks: the words when they are missing
//   wet      the run ends in the water (a causeway)
//   voice    who speaks when it ends well ({ who: the person's id, name, from: where they stand, and the
//            lines: first, beaten (the makers' mark, the first time), again }): every line carries its tone

export const KIT_TRIALS = {
  'kit-desert': {
    id: 'kit-desert', world: 'desert', mode: 'kit', course: 'windhall', name: 'Wind hall', color: '#9fd6ee',
    blurb: 'A roofless hall of the makers on a dune crest west of the landing, where the wind is kept and let go in gusts.',
    rules: 'Walk the hall to its far end through the gusts: when the streaks come, get behind a screen. Under the porch at its end, wake all three eyes with the fluid in one breath.',
    origin: [-135, 21.4, -64], yaw: 0,
    marker: [4.4, -7.2], start: [0, -1.4], heading: 0, par: 42,
    needs: ['backpack'], lacks: 'The eyes at its end want the fluid gun.',
    onFoot: true,
    voice: {
      who: 'pell', name: 'Pell', from: 'at the foot of the dune',
      first: '~playful~ Forty-six steps, and most of them against the wind. I counted. Come back and make it fewer.',
      beaten: '~surprised~ Under the makers’ own mark! That hall hasn’t been walked so fast since it had a roof.',
      again: '~neutral~ I counted again. The wind lost.',
    },
  },
  'kit-perdide': {
    id: 'kit-perdide', world: 'perdide', mode: 'kit', course: 'hushwalk', name: 'Hush walk', color: '#c7a6f2',
    blurb: 'A causeway of the makers out over the lake south of the landing, with crystals of the Hush swinging across it.',
    rules: 'Walk out to the round stone at the end of the causeway and back to the shore. The crystals knock you into the lake: time them, or still one with a stilling burst.',
    origin: [4, 1.2, 24], yaw: 0,
    marker: [-3.6, -3.2], start: [0, -1.2], heading: 0, par: 48,
    wet: true, onFoot: true,
    voice: {
      who: 'sedge', name: 'Sedge', from: 'in the reeds by the shore',
      first: '~whisper~ Out and back, and dry. The crystals swing for the Hush, not for us. You made them look slow.',
      beaten: '~surprised~ That was quicker than the makers meant it. Don’t tell Wendel. He’ll want to try.',
      again: '~neutral~ Dry again. The reeds noticed.',
    },
  },
};

/** The makers' runs standing in a world. */
export const kitTrialsFor = (world) => Object.values(KIT_TRIALS).filter((T) => T.world === world);
