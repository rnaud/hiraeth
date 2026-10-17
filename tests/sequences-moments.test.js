// Issue #429 (bridge parity 2: sequences, not stills): the later worlds' filmed moments, the engines' bundle held to the
// web's recorded stream beat by beat. tests/sequences-check.js; docs/systems/engine-bridge.md, "Sequences".
import { checkSequences } from './sequences-check.js';

const FIRST = /^moment-(desert|arzach|perdide)/;
checkSequences((s) => s.id.startsWith('moment-') && !FIRST.test(s.id));
