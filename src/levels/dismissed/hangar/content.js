// The Sealed Hangar's content (src/levels/content.js format: its page, its relics, its own people), kept with the
// dismissed world (src/levels/names.js DISMISSED). src/levels/content.js lists it as CONTENT.garage for its tests.
const pal = (cloak, extra = {}) => ({ cloak, lining: extra.lining ?? '#2b211f', ...extra });

export const HANGAR_CONTENT = {
    weather: ['rain'],
    // the story is a quest (src/story/garage-data.js): this page closes when the Major's note is found
    story: {
      title: 'THE MAJOR FORGOT',
      intro: 'Major Brask built this pocket universe, and forgot why. His people keep the machines turning, and pass round a signal nobody can read.',
      outro: "The Major’s note says he still doesn’t know what his world is for. On its back: coordinates for a wheel buried in sand. The machines keep working.",
      label: 'the great machine', goal: [90, 86, -60], radius: 12, manual: true,
    },
    relics: {
      spots: [[0, -40], [-120, 60], [150, 40], { at: [60, 898.8, 2940] }, { at: [2940, -148.8, 0] }],
      names: ['Brask’s cog', 'Portal fuse', 'Ring compass', 'Upside-down coin', 'Gravity marble'],
    },
    npcs: [
      { at: [40, 60], palette: pal('#e6875f', { cloth: '#3f8f8a' }), lines: ["~playful~ Gravity is a local arrangement here.", "~tired~ The Major built this world and forgot its purpose."] },
      { at: [-80, -20], palette: pal('#62c3c9'), lines: ["~angry~ Hands clear of the gears, please!", "~happy~ Grease today, grease tomorrow. Lovely."] },
      // (Gaspard, resting his feet on the plateau's edge in sight of the signal board and the portal: he stood 250 m off the
      //  walk from the landing to the portal, 175 m from anyone: the level design audit's fifth round)
      { at: [70, 95], palette: pal('#f2c54b'), lines: ["~playful~ Walk round the ring and arrive where you left.", "~tired~ My feet have seen this whole world. Twice."], shy: true },
    ],
};
