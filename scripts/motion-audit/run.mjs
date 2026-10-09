// Walks foes in a straight line in node and measures their legs (docs/systems/procedural-animation.md,
// "Measuring"; the rubric: .claude/skills/procedural-animation/SKILL.md).
//
//   node scripts/motion-audit/run.mjs                 a sample of every family (old kinds, world enemies, guardians)
//   node scripts/motion-audit/run.mjs desert/dune-skitter crab keeper   just these (world enemy ids, kinds, guardians)
//   node scripts/motion-audit/run.mjs --all           all 100 world enemies too
//   node scripts/motion-audit/run.mjs --json          the full reports as JSON
//   node scripts/motion-audit/run.mjs --pace=0.5      at half their speeds (does the gait follow the speed?)
//   node scripts/motion-audit/run.mjs --pack          a second of each kind beside it: do they step in unison?
//   node scripts/motion-audit/run.mjs --cost          the kit's time a frame per foe and per leg (µs, this machine)
//   node scripts/motion-audit/run.mjs moustache moustache-hurry   the dog at home (src/dog.js), following a walker
//
// Columns: reach% and lift% are shares of the leg's length, for the foes on the locomotion kit (src/motion-kit/);
// unison is the correlation of two pack members' first feet (1: in step). The walking is in walk.mjs.
import { ENEMY_ROSTER } from '../../src/enemies/roster.js';
import { foeSystem, foeSubject, OLD, GUARDIANS, DOGS, worldLegs } from './walk.mjs';

const args = process.argv.slice(2), json = args.includes('--json'), all = args.includes('--all');
const pace = Number(args.find((a) => a.startsWith('--pace='))?.slice(7) ?? 1);   // (walk at this share of each one's speed)
const pack = args.includes('--pack'), cost = args.includes('--cost');
const picks = args.filter((a) => !a.startsWith('--'));

const sys = foeSystem();
const sample = ['desert/dune-skitter', 'desert/cistern-beast', 'desert/possessed-cistern-pump'];
for (const form of ['crab', 'mantis', 'shell', 'bird', 'stalker', 'newt', 'beetle', 'wasp', 'tripod', 'bell', 'diver'])
  { const e = ENEMY_ROSTER.find((x) => x.form === form && !sample.includes(x.id)); if (e) sample.push(e.id); }
const shade = ENEMY_ROSTER.find((x) => x.family === 'shade'); if (shade) sample.push(shade.id);

const ids = picks.length ? picks : [...Object.keys(OLD), ...(all ? ENEMY_ROSTER.map((e) => e.id) : sample), ...Object.keys(GUARDIANS), ...Object.keys(DOGS)];
const out = {};
const opts = { pace, pack, cost };
for (const id of ids) {
  if (GUARDIANS[id]) out[id] = GUARDIANS[id](pace);
  else if (DOGS[id]) { const { dog, ...r } = DOGS[id](pace); out[id] = r; void dog; }
  else if (OLD[id]) out[id] = foeSubject(sys, id, OLD[id], opts);
  else if (ENEMY_ROSTER.some((e) => e.id === id)) { const e = ENEMY_ROSTER.find((x) => x.id === id); const r = foeSubject(sys, id, worldLegs, opts); out[id] = { form: e.form, ...r }; }
  else console.warn(`unknown subject: ${id}`);
}
sys.dispose();

if (json) console.log(JSON.stringify(out, (k, x) => (k === 'heights' ? undefined : x), 1));
else {
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), pc = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '-');
  console.log(`subject                                  legs  speed  slide/m  worst  reachSpan reach%  lift  lift%  steps/s  bob    ${pack ? 'unison ' : ''}${cost ? 'µs/foe µs/leg ' : ''}groups`);
  for (const [id, r] of Object.entries(out)) {
    const extra = (pack ? `${f2(r.unison).padStart(6)} ` : '') + (cost ? `${f2(r.kitUs).padStart(6)} ${f2(r.kitUs / r.legs.length).padStart(6)} ` : '');
    console.log(`${(id + (r.form ? ` (${r.form})` : '')).padEnd(40)} ${String(r.legs.length).padStart(4)}  ${f2(r.speed).padStart(5)}  ${f2(r.slidePerMetre).padStart(7)}  ${f2(r.worstSlide).padStart(5)}  ${f2(r.reachSpan).padStart(9)} ${pc(r.reachShare).padStart(6)} ${f2(r.lift).padStart(5)} ${pc(r.liftShare).padStart(5)}  ${f2(r.cadence).padStart(7)}  ${f2(r.bob).padStart(5)}  ${extra}${JSON.stringify(r.groups)}`);
  }
}
