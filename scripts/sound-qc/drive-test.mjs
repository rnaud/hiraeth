// Fixed game bundle plus real packaged effects, for the same sound scenarios.
import { loadBundle } from '../../engine/game-test-runtime.mjs';
import { installEffectFileDecoder } from './test-runtime.mjs';
import { driveVm } from './drive-core.mjs';
export const driver = ({ file, level = 'desert' } = {}) => driveVm(loadBundle(file), { level, installEffectFileDecoder });
