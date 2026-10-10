#!/usr/bin/env node
// The motion QC in node (.claude/skills/motion-qc/SKILL.md): the traveller on the gait harness's course (flat ground,
// a ramp, stairs: src/gait-course.js) through the scenarios' scripted hands (scripts/motion-qc/scenarios.mjs COURSE),
// each way of moving him, recorded every frame (sample.mjs) and judged (lib.mjs). Seconds a run, no browser.
//
//   node scripts/motion-qc/run.mjs [out-dir] [--ways moves,mm] [--only <part of a name>,...] [--body plain] [--json]
//
// ways: loops (the clips' loops alone), moves (the loops with the captured starts, stops and turns over them: the
// game's default), mm (motion matching, ?mm=1). Writes <out>/motion.json (every run's measures, events and verdict),
// motion.md (the table) and <scenario>.<way>.svg (a contact sheet of its worst frames: the pose from the side and
// from above, the feet's trails, captioned). Exits 1 if a run of the default way is red.
import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { course, traveller } from '../../tests/gait-sim.js';
import { CAM_PLUS_Z } from '../../src/gait-course.js';
import { analyse, table, LIMITS } from './lib.mjs';
import { sample, metaOf, stickOf, timeAnimator } from './sample.mjs';
import { COURSE } from './scenarios.mjs';
import { sheetSVG } from './sheet.mjs';

export const WAYS = { loops: { matching: false, moves: false }, moves: { matching: false, moves: true }, mm: { matching: true, moves: false } };

/** One scenario one way: { samples, meta, r (lib.analyse) }. */
export async function runScenario(sc, way, { body = 'v1', fps = 60, onFrame = null } = {}) {
  const p = await traveller(course(), new THREE.Vector3(...sc.at), { ...WAYS[way], body });
  timeAnimator(p.animator);
  const dt = 1 / fps, S = [], st = {};
  let t = 0;
  for (const [secs, input, tag] of sc.script) {
    const n = Math.round(secs * fps);
    for (let i = 0; i < n; i++) {
      p.update(dt, input, CAM_PLUS_Z);
      p.object.updateMatrixWorld(true);
      S.push(sample(p, st, { t, dt, tag, stick: stickOf(input), run: !!input.ShiftLeft }));
      onFrame?.(p, S.length - 1, S[S.length - 1]);
      t += dt;
    }
  }
  const meta = { ...metaOf(p), fps };
  return { samples: S, meta, r: analyse(S, meta) };
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(tmpdir(), 'motion-qc'));
  mkdirSync(OUT, { recursive: true });
  if (process.env.MM) Object.assign((await import('../../src/motion-match.js')).MATCH, JSON.parse(process.env.MM));
  const ways = arg('ways', 'moves,mm').split(','), only = arg('only')?.split(','), body = arg('body', 'v1');
  const names = Object.keys(COURSE).filter((n) => !only || only.some((o) => n.includes(o)));
  const rows = [], out = {};
  for (const name of names) for (const way of ways) {
    const { samples, meta, r } = await runScenario(COURSE[name], way, { body });
    rows.push({ name, way, r });
    out[`${name} · ${way}`] = { measures: r.measures, fails: r.fails, green: r.green, worst: r.worst,
      events: { ...r.events, steps: r.events.steps.slice().sort((a, b) => b.slide - a.slide).slice(0, 12), holds: r.events.holds.slice().sort((a, b) => b.slide - a.slide).slice(0, 6) } };
    writeFileSync(join(OUT, `${slug(name)}.${way}.svg`), sheetSVG(`${name} · ${way}`, samples, r.worst));
    const m = r.measures;
    console.log(`${(name + ' · ' + way).padEnd(56)} ${r.green ? 'green' : 'RED  '} slide ${(m.slideP95 * 100).toFixed(1)}/${(m.slideMax * 100).toFixed(1)} cm held ${(m.held * 100).toFixed(1)} pops ${m.popsPerMin.toFixed(1)}/min jolts ${m.joltsPerMin.toFixed(1)}/min boundary ${(m.boundaryMax * 100).toFixed(1)} cm start ${m.start?.toFixed(2) ?? '-'} stop ${m.stop?.toFixed(2) ?? '-'} turn ${m.turn?.toFixed(2) ?? '-'}${m.pivots ? ` pivot ${(m.pivotSlip * 100).toFixed(1)} cm ${Math.round(m.crossed * 100)}%` : ''}${m.matchUs ? ` match ${m.matchUs.toFixed(0)} µs` : ''}${r.fails.length ? `  [${r.fails.join(' ')}]` : ''}`);
  }
  writeFileSync(join(OUT, 'motion.json'), JSON.stringify({ when: new Date().toISOString(), body, limits: LIMITS, results: out }, null, 1));
  writeFileSync(join(OUT, 'motion.md'), `${table(rows)}\n`);
  console.log(`\nwritten to ${OUT}`);
  const red = rows.filter((x) => x.way === 'moves' && !x.r.green);
  process.exit(red.length ? 1 : 0);
}
