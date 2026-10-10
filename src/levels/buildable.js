// Every world that can still be built, for the tests and the tools (not the game: it builds what src/levels/index.js
// LEVELS lists): the levels, the parts of the merged worlds on their own (Vael II's sky stones, Lorn II's Deep Wood:
// src/levels/names.js PARTS, built as before for their tests), and the dismissed worlds (src/levels/dismissed/).

import { LEVELS } from './index.js';
import { TITLES } from './names.js';
import { createArzach2, buildArzach2 } from './arzach2.js';
import { createPerdide2, buildPerdide2 } from './perdide2.js';
import { DISMISSED_LEVELS } from './dismissed/index.js';

/** The merged worlds' parts, each built on its own (its own ground, its own temple). */
export const PART_LEVELS = [
  { id: 'arzach2', create: createArzach2, build: buildArzach2, hidden: true, part: 'arzach', title: TITLES.arzach2 },
  { id: 'perdide2', create: createPerdide2, build: buildPerdide2, hidden: true, part: 'perdide', title: TITLES.perdide2 },
];
export const BUILDABLE = [...LEVELS, ...PART_LEVELS, ...DISMISSED_LEVELS];
/** A buildable world by its id (a level, a part on its own, a dismissed world). */
export const buildableById = (id) => BUILDABLE.find((l) => l.id === id);
