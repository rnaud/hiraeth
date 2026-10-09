// Canonical choices from references/*/characters: first standing figure, sheet 0.
// Only existing named people are dressed; absent/lore-only people are not spawned.
// Keep stable story ids (several differ from the names printed on the sheets).
const outfit = (name, color, head, tool, kit, o = {}) => ({
  name, cloak: color, cloth: color, hat: color, legs: '#726b62', accent: '#dac699',
  head, under: 'crop', mask: 'none', body: 'none', prop: tool ? (['basket','lantern','bell'].includes(tool) ? tool : 'staff') : 'none',
  back: 'none', shins: 'none', stow: false, trim: 'none', robe: .18, flare: .31,
  bulk: 0, capeLen: 0, capeWide: 1, capeBells: 0, height: 1, size: 1, build: 'slim',
  faceType: 'plain', mood: 'calm', tool, kit, ...o,
});
export const QUEST_LOOKS = {
  incal: {
    nima: outfit('Nima', '#ada2c3', 'cap', 'broom', 'dustpan', { hat: '#807698', robe: .12, faceType: 'long' }),
    corvin: outfit('Corvin Sale', '#e0dbc4', 'sunhat', 'cane', 'fanCollar', { accent: '#95b6b4', trim: 'stripes', build: 'average', faceType: 'long', mood: 'stern' }),
    ossa: outfit('Ossa', '#695e53', 'hood', 'bowl', 'prayer', { hat: '#9a5534', cloak: '#9a5534', headKit: 'hoodLamps', robe: .07, build: 'heavy', faceType: 'elder' }),
    dov: outfit('Dov', '#eee5ce', 'helmet', 'halberd', 'sash', { headKit: 'guardCrest', hat: '#d4c7a4', accent: '#b89846', height: 1.07, faceType: 'long', mask: 'beard' }),
  },
  arzach: {
    oia: outfit('Oïa', '#e8e6d9', 'cowl', 'whistle', 'redCord', { headKit: 'beakedCowl', robe: .07, capeLen: 1.35, faceType: 'elder' }),
    tam: outfit('Tam', '#e7e0c8', 'cowl', 'toyBird', 'patches', { headKit: 'beakedCowl', robe: .5, flare: .36, faceType: 'round', mood: 'curious' }),
    senn: outfit('Senn', '#ddd8c6', 'hooddown', 'earhorn', 'feathers', { under: 'flow', robe: .1, height: 1.07, faceType: 'long' }),
    hollin: outfit('Kesh', '#e6d8bd', 'cowl', 'mallet', 'pebbles', { headKit: 'beakedCowl', hat: '#b96843', cloak: '#b96843', capeLen: .65, robe: .12, build: 'heavy', capeBells: 7, faceType: 'elder', mood: 'amused' }),
  },
  arzach2: {
    ysolde: outfit('Mother Ysolde', '#c9a3a5', 'hood', 'writingBoard', 'keys', { headKit: 'wimple', mask: 'glasses', robe: .07, faceType: 'elder', mood: 'stern' }),
    tiv: outfit('Tiv', '#d4a05a', 'shaved', 'basket', 'stones', { robe: .48, headKit: 'balancedStones', faceType: 'round' }),
    calix: outfit('Brother Calix', '#7e9fa6', 'hood', null, 'bellRope', { robe: .08, build: 'heavy', mask: 'beard', faceType: 'round', mood: 'kind' }),
    aube: outfit('Sister Aube', '#a1aaa2', 'hood', 'windStaff', 'cloudJar', { robe: .1, capeLen: 1.4, faceType: 'elder' }),
    ondine: outfit('Ondine', '#d79773', 'hood', 'staff', 'maps', { robe: .5, capeLen: .95, shins: 'wraps', faceType: 'long' }),
  },
  garage: {
    ottla: outfit('Ottla', '#86a5af', 'helmet', 'wrench', 'mechanic', { headKit: 'antennaHelmet', robe: 0, legs: '#86a5af', build: 'broad', mood: 'curious' }),
    ambroise: outfit('Ambroise', '#c5a457', 'cap', 'clipboard', 'tape', { headKit: 'paperStack', cloth: '#e5ddc3', legs: '#80765e', robe: 0, trim: 'stripes', faceType: 'long' }),
    lune: outfit('Lune', '#b2a1bd', 'crop', 'receiver', 'cable', { headKit: 'dishHeadset', robe: 0, legs: '#b2a1bd', mood: 'curious' }),
    clemence: outfit('Clemence', '#d88e79', 'brim', 'cogCane', 'cameo', { headKit: 'featherAntenna', robe: .1, faceType: 'elder', mask: 'glasses' }),
  },
  buried: {
    'hask.buried': outfit('Hask', '#bcd0bb', 'padded', 'trimmer', 'oilApron', { headKit: 'porthole', cloak: '#b76439', robe: .22, flare: .47, build: 'heavy', bulk: 2 }),
    wen: outfit('Wen', '#dfd5ba', 'padded', 'abacus', 'counter', { headKit: 'counterDome', robe: 0, legs: '#dfd5ba', build: 'average', bulk: 2 }),
    dun: outfit('Dun', '#73a99d', 'padded', null, 'bellows', { mask: 'breather', robe: 0, legs: '#73a99d', height: 1.08, bulk: 2 }),
    pim: outfit('Jot', '#cb7750', 'padded', 'toyWheel', 'cogs', { headKit: 'openPadded', robe: 0, legs: '#cb7750', build: 'heavy', bulk: 2, faceType: 'round', mood: 'curious' }),
    tull: outfit('Tull', '#c4a753', 'helmet', 'oilcan', 'wheelKeys', { headKit: 'headLamp', robe: .34, mask: 'breather', faceType: 'elder', build: 'broad' }),
  },
  edena: {
    mira: outfit('Mira', '#a1c7b2', 'straw', 'wateringCan', 'clockGears', { headKit: 'cupHat', hat: '#c1a76e', robe: .24, build: 'average', faceType: 'round' }),
    vey: outfit('Vey', '#bc8e87', 'brim', 'shears', 'ladder', { headKit: 'vineHat', hat: '#c3b49a', robe: .3, faceType: 'elder' }),
    oro: outfit('Oro', '#e6e2cc', 'cap', 'rule', 'seeds', { headKit: 'pyramidHat', robe: .13, trim: 'hem', faceType: 'long' }),
    'lio.edena': outfit('Rue', '#7da8b4', 'crop', null, 'climbing', { robe: 0, legs: '#7da8b4', mood: 'curious' }),
  },
  spheres: {
    'aube.spheres': outfit('Linnet', '#a9bac8', 'hood', 'tuningFork', 'pendant', { headKit: 'halo', robe: .07, faceType: 'long' }),
    nell: outfit('Nell', '#a5c9c0', 'flow', 'mirror', null, { robe: .12, under: 'flow', sleeveless: true }),
    ume: outfit('Ume', '#d2b467', 'wizard', 'measurePole', 'pebbles', { headKit: 'orbTip', cloth: '#eee7d2', trim: 'stripes', accent: '#d2b467', robe: .3, build: 'heavy' }),
    cael: outfit('Cael', '#9cb19b', 'flatcap', 'cane', 'sphereLamp', { robe: .3, capeLen: 1.1, height: 1.08, faceType: 'long' }),
    ivo: outfit('Emrys', '#ded4bd', 'trapper', 'flag', 'rope', { robe: .45, build: 'broad', mood: 'amused' }),
  },
  perdide: {
    wendel: outfit('Wendel', '#a39670', 'straw', 'lantern', 'eggBasket', { robe: .35, body: 'reedcape', build: 'heavy', faceType: 'round' }),
    sedge: outfit('Sedge', '#82708f', 'brim', 'sickle', 'reeds', { robe: .4, hat: '#a39570', sleeveless: true, faceType: 'long' }),
    saba: outfit('Saba', '#3f597d', 'hood', 'pendulum', 'crystals', { headKit: 'shellHood', robe: .07, capeLen: 1.3, faceType: 'elder' }),
    corm: outfit('Corm', '#9d755f', 'bandana', 'feedingHook', 'apron', { robe: .36, build: 'broad', mask: 'beard', mood: 'amused' }),
    ysse: outfit('Ysse', '#abc8b4', 'crop', 'mallet', 'crystalMantle', { headKit: 'crystalCrown', robe: .06, skin: '#dfded0' }),
  },
  perdide2: {
    'hollin.perdide2': outfit('Hollin', '#948393', 'wizard', 'lamppole', 'hemLamps', { robe: .14, mask: 'beard', hair: '#dfdccd', faceType: 'elder' }),
    wick: outfit('Robin', '#9a7e9e', 'cap', 'lantern', 'wickBag', { robe: .42, build: 'average', mood: 'curious' }),
    'pim.perdide2': outfit('Pim', '#798b43', 'hood', 'teapot', 'moss', { headKit: 'mossHood', robe: .24, flare: .46, build: 'heavy', faceType: 'round' }),
    bram: outfit('Bram', '#d8d4bc', 'hood', 'eggStaff', 'gills', { headKit: 'mushroom', robe: .2, build: 'heavy', height: 1.1 }),
    fen: outfit('Fen', '#9b809e', 'brim', 'reedStaff', 'barkMap', { robe: .4, capeLen: .9, hat: '#bda481', faceType: 'long' }),
  },
  bazaar: {
    sel: outfit('Madame Sel', '#d9967f', 'turban', 'trumpetCane', 'radioCollar', { headKit: 'turbanAntenna', robe: .07, trim: 'diamonds', accent: '#b59b58', faceType: 'elder', mask: 'glasses' }),
    kip: outfit('Kip', '#6c9995', 'cap', null, 'parcel', { robe: 0, legs: '#9aa693', mood: 'curious' }),
    ferro: outfit('Ferro', '#cc8144', 'helmet', 'wrench', 'rigger', { headKit: 'dishHelmet', robe: 0, legs: '#cc8144', build: 'broad', mood: 'stern' }),
    brush: outfit('Brush', '#ddd1ac', 'beret', 'paintBrush', 'palette', { robe: .38, trim: 'patches', accent: '#73a8ab', headKit: 'brushBeret', mood: 'amused' }),
    oyo: outfit('Oyo', '#83aba0', 'brim', 'lanternPole', 'fishPurse', { headKit: 'lanternHat', robe: .32, build: 'average', trim: 'diamonds' }),
  },
};
export function questLook(world, id) { return QUEST_LOOKS[world]?.[id] ?? null; }
