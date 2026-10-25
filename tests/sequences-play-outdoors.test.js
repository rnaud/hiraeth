// Same actual engine/web sequence comparison; partitioned to bound each test process.
import { checkSequences } from './sequences-check.js';
import { playPartition } from './sequences-play-groups.js';
checkSequences((s) => playPartition(s) === 'outdoors');
