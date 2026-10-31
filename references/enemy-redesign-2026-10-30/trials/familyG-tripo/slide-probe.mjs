// #800 family G: tests/foe-slide.test.js's measure for one kind (scripts/motion-audit/foe-slide.mjs): each scenario's
// slide a metre (a rad for the turn) and its worst contact.
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/slide-probe.mjs <kind>
import { loadClips, slideArena, measure } from '../../../../scripts/motion-audit/foe-slide.mjs';

await loadClips();
const { foes, done } = slideArena();
for (const kind of (process.argv[2] ?? 'sentinel').split(',')) for (const sc of ['walk', 'run', 'strafe', 'turn', 'knock']) {
  const r = measure(foes, kind, sc, { frames: 150 });
  console.log(kind.padEnd(10), sc.padEnd(7), 'slide', r.slidePerM.toFixed(3), 'worst', r.worst.toFixed(3));
}
done();
