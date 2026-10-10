// The Atelier's content (src/levels/content.js format), kept with the dismissed world (src/levels/names.js
// DISMISSED). src/levels/content.js lists it as CONTENT.atelier for its tests.

export const ATELIER_CONTENT = {
    weather: [],
    story: {
      title: 'THE LAST PAGE',
      intro: 'Every world you crossed was drawn here.',
      outro: 'The pen lifts. The page is yours now.',
      label: 'the pen', goal: [0, 'ground', 0], radius: 18,
    },
    relics: { spots: [], names: [] },
    npcs: [
      { at: [22, 26], radius: 3, palette: { cloak: '#2b211f', cloth: '#f3ead8', legs: '#2b2f45' },
        lines: ["~happy~ Found my atelier? Mind the ink.", "~playful~ I drew those deserts. You did the difficult walking bit.", "~solemn~ Go on. There’s room for another line."] },
    ],
};
