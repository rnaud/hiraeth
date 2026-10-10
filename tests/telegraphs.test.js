// Body telegraphs (src/telegraph.js, docs/systems/foes.md "Telegraphs: the body, not the floor"): no attack is drawn on
// the ground but a projectile's landing mark; wind-ups long enough to read; the guardians' staged fights (their moves,
// combos, phases and openings) and how a combo is timed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FOES } from '../src/foes.js';
import { ATTACKS } from '../src/enemies/attacks.js';
import { GUARDIANS } from '../src/arena-guardians.js';
import { Guardian, comboOf, windOf, SHIFT } from '../src/temples/boss.js';
import { WIND_MIN, windMin, guardianWindMin, groundMark, isProjectile, TELL, ChargeGlow, POSE_DONE } from '../src/telegraph.js';
import { clearTargets } from '../src/targets.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DT = 1 / 60;

/** Every attack definition in the game: [where, attack]. */
function everyAttack() {
  const out = [];
  for (const [k, D] of Object.entries(FOES)) for (const a of D.attacks) out.push([`foe ${k}.${a.id}`, a, 'foe']);
  for (const [id, a] of Object.entries(ATTACKS)) out.push([`pattern ${id}`, a, 'foe']);   // (the attack-pattern library the archetypes draw on)
  for (const G of GUARDIANS) for (const [id, a] of Object.entries(G.def.attacks)) out.push([`guardian ${G.id}.${id}`, a, 'guardian']);
  return out;
}

test('nothing is drawn on the ground for an attack unless it is a lobbed or thrown projectile, and then where it lands', () => {
  let lobs = 0, bodies = 0;
  for (const [where, a] of everyAttack()) {
    assert.ok(!('tele' in a), `${where}: no floor telegraph flag`);
    assert.ok(!('telegraph' in a), `${where}: a wind-up (wind), not a floor telegraph`);
    if (groundMark(a)) {
      lobs++;
      assert.ok(a.lob && isProjectile(a), `${where}: only a projectile marks the ground`);
      assert.ok(a.at === 'target' || a.at === 'player', `${where}: its mark is where you stand, where it lands`);
    } else bodies++;
    if (a.lob) assert.ok(groundMark(a), `${where}: a lob keeps its landing mark`);
  }
  assert.ok(lobs >= 10 && bodies > lobs * 3, `${lobs} landing marks, ${bodies} body tells`);
});

test('every wind-up is long enough to read (Normal; Gentle longer): foes by weight, guardians ≥ 1 s, combo links ≥ 0.6 s', () => {
  for (const [where, a, who] of everyAttack()) {
    const min = who === 'guardian' ? guardianWindMin(a) : windMin(a);
    assert.ok(a.wind >= min - 1e-9, `${where}: ${a.wind} s, at least ${min} s`);
  }
  // the v1.4 review's complaint: the hound's pounce was 0.60 s
  assert.ok(FOES.hound.attacks.find((a) => a.id === 'pounce').wind >= WIND_MIN.ordinary);
  assert.ok(WIND_MIN.guardian >= 1 && WIND_MIN.link >= 0.6 && POSE_DONE < 0.9, 'a stillness before every strike');
});

test('each guardian is a staged fight: 4-6 moves of its own, three phases that add moves, a combo that ends in an opening, an opening in every phase', () => {
  assert.equal(GUARDIANS.length, 11);
  const ids = new Set();
  for (const G of GUARDIANS) {
    const D = G.def, A = D.attacks, own = Object.keys(A).filter((k) => !A[k].link);
    assert.ok(own.length >= 4 && own.length <= 6, `${G.id}: ${own.length} moves`);
    ids.add(own.sort().join());
    for (const [id, a] of Object.entries(A)) {
      assert.ok(a.part, `${G.id}.${id}: where its glow gathers`);
      assert.ok(a.damage >= 0.5 && a.damage <= 1 && (a.damage * 4) % 1 === 0, `${G.id}.${id}: half a heart to a heart, in quarters`);
      if (a.then) assert.ok(A[a.then]?.link, `${G.id}.${id} → ${a.then}: a link`);
      if (a.link) assert.ok(Object.values(A).some((b) => b.then === id), `${G.id}.${id}: a link is reached from a move`);
    }
    const phases = D.phases.filter((p) => !p.weary);
    assert.ok(phases.length >= 3, `${G.id}: ${phases.length} phases`);
    for (let i = 1; i < phases.length; i++) {
      assert.ok(phases[i].attacks.some((x) => !phases[i - 1].attacks.includes(x)), `${G.id}: phase ${i} brings a move the last did not have`);
      assert.ok(phases[i - 1].hint && phases[i].hint, `${G.id}: each phase is told`);
    }
    for (const p of phases) for (const x of p.attacks) assert.ok(A[x] && !A[x].link, `${G.id}: ${x} begins a move`);
    const combos = own.filter((k) => A[k].then).map((k) => comboOf(D, k));
    assert.ok(combos.length >= 1, `${G.id}: a combo`);
    for (const c of combos) assert.ok(c.length >= 2 && c.length <= 3, `${G.id}: ${c.join(' → ')}: two or three moves`);
    assert.ok(combos.some((c) => A[c.at(-1)].open || A[c.at(-1)].miss), `${G.id}: a combo whose last move is read as the punish, and opens it`);
    // openings read from the body in every phase: after a move or a combo, or when a move misses
    for (const [i, p] of phases.entries()) {
      const opens = p.attacks.some((x) => { const end = A[comboOf(D, x).at(-1)]; return end.open || A[x].miss || end.miss; });
      assert.ok(opens, `${G.id}: phase ${i} opens somewhere`);
    }
  }
  assert.equal(ids.size, 11, 'no two guardians fight with the same moves');
});

function stub(def, model = null) {
  const scene = new THREE.Scene(), notes = [], sounds = [];
  const rt = { def: { id: 'stub' }, root: scene, logic: { resolved: false, resolve() {} }, notice: (t) => notes.push(t), rumble() {}, onBossWake() {}, onBossResolved() {},
    sound: { guardianWarn: (kind, dur) => sounds.push(dur), critter() {} }, player: null };
  const m = model ?? { group: new THREE.Group(), pos: V(0, 0, 4), heading: 0, mouth: V(0, 2, 5), radius: 2, height: 3, animate() {} };
  scene.add(m.group);
  const g = new Guardian(rt, { def, model: m, arena: { center: V(), r: 18, y: 0 } });
  return { g, rt, notes, sounds, m };
}
const runner = (g, P) => { let t = 0; return (s) => { for (let i = 0; i < s / DT; i++) { t += DT; g.update(DT, t); P.down = null; } }; };

test('a combo: each move winds up in full before it strikes, the links at least 0.6 s, and the last opens it', () => {
  clearTargets();
  const K = GUARDIANS.find((G) => G.id === 'desert').def;
  const { g, rt } = stub(K);
  const strikes = [];
  const P = { pos: V(30, 0, 30), health: 3, dead: false, down: null, hurt() {}, knockDown() {} };   // (out of reach: every move misses)
  rt.player = P;
  g.state = 'fight'; g.meter = 0.4; g.floor = 0.4;
  g.begin(P, null, 'sweep');
  const chain = comboOf(K, 'sweep');
  let t = 0, seen = [], last = null;
  for (let i = 0; i < 12 / DT && g.state !== 'open'; i++) {
    t += DT; g.update(DT, t);
    if (g.attack && g.struck && g.attack.id !== last) { strikes.push({ id: g.attack.id, t }); last = g.attack.id; }
    if (g.attack && !seen.includes(g.attack.id)) seen.push(g.attack.id);
  }
  assert.deepEqual(seen, chain, 'the moves in order');
  assert.equal(strikes.length, chain.length);
  for (let i = 1; i < strikes.length; i++) {
    const gap = strikes[i].t - strikes[i - 1].t, a = K.attacks[strikes[i].id];
    assert.ok(gap >= a.wind - 1e-6 && a.wind >= 0.6, `${strikes[i].id}: ${gap.toFixed(2)} s after the last (its wind-up ${a.wind} s)`);
  }
  assert.equal(g.state, 'open', 'spent after its last: open (it pants)');
  assert.ok(Math.abs(g.openFor - K.attacks[chain.at(-1)].open) < 1e-9);
  g.dispose(); clearTargets();
});

test('a move told by the body: the glow on its part grows, it rears, the sound rises over the wind-up; only a lob marks the floor; a miss can open it; Gentle is slower', () => {
  clearTargets();
  const K = GUARDIANS.find((G) => G.id === 'desert').def;
  const { g, rt, sounds, m } = stub(K);
  const P = { pos: V(20, 0, 20), health: 3, dead: false, down: null, hurt() {}, knockDown() {} };
  rt.player = P; g.state = 'fight';
  const run = runner(g, P);
  g.begin(P, null, 'stamp');
  run(K.attacks.stamp.wind * 0.3);
  const k0 = g.glows[0].k;
  run(K.attacks.stamp.wind * 0.6);
  assert.ok(g.glows[0].visible && g.glows[0].k > k0, 'the glow grows on its foot');
  assert.ok(g.glows[1].visible, 'a forefoot each');
  assert.ok(m.tellRig.rotation.x < -0.1, 'it rears back');
  assert.equal(g.tele.group.visible, false, 'nothing on the floor');
  assert.ok(Math.abs(sounds.at(-1) - K.attacks.stamp.wind) < 1e-9, 'its sound rises over the whole wind-up');
  run(K.attacks.stamp.wind * 0.1 + K.attacks.stamp.recover + 0.1);
  assert.equal(g.state, 'open', 'it missed you: wedged, open');
  assert.equal(g.openFor, K.attacks.stamp.miss);
  // a lob: its landing marks drawn where it will fall
  g.enter('fight'); g.cool = 9; g.begin(P, null, 'spit');
  run(K.attacks.spit.wind * 0.5);
  assert.ok(g.tele.group.visible && g.teles.filter((T) => T.group.visible).length === K.attacks.spit.volley - 1, 'three landing marks');
  assert.ok(Math.hypot(g.tele.group.position.x - P.pos.x, g.tele.group.position.z - P.pos.z) < 8, 'round where you stand');
  // Gentle
  TELL.slow = 1.35;
  assert.ok(Math.abs(windOf(K.attacks.stamp) - K.attacks.stamp.wind * 1.35) < 1e-9);
  TELL.slow = 1;
  g.dispose(); clearTargets();
});

test('the Lampless, the Elder and the Cloud-Mother: a dive that misses you wedges them, open longer than after one that lands, and says so', async () => {
  // combat-v1.6: they were the three guardians whose dive opened them the same whether it met you or not
  const { elderOpenFor, ROOST } = await import('../src/temples/arzach.js');
  for (const [id, move] of [['perdide2', 'swoop'], ['arzach', 'dive'], ['arzach2', 'dive']]) {
    const D = GUARDIANS.find((G) => G.id === id).def, a = D.attacks[move];
    assert.ok(a.miss > a.open, `${id}.${move}: a miss opens it longer (${a.miss} s) than a hit (${a.open} s)`);
    assert.ok(D.missHint && D.missHint !== D.openHint, `${id}: what a miss looks like, in words`);
    for (const [far, want] of [[true, a.miss], [false, a.open]]) {
      clearTargets();
      const { g, rt, notes } = stub(D);
      // (it aims its dive at where you stand for the first part of its wind-up: far, you step well aside once it has
      // stopped aiming, and it misses; near, you stay under it, and it lands on you)
      const P = { pos: V(0, 0, 9), health: 3, dead: false, down: null, hurt() {}, knockDown() {} };
      rt.player = P; g.state = 'fight'; g.cool = 9;
      g.begin(P, null, move);
      const end = comboOf(D, move).at(-1);
      let t = 0;
      for (let i = 0; i < 12 / DT && g.state !== 'open'; i++) {
        t += DT;
        if (far && g.attack && g.at > g.windFor * (g.attack.track ?? 0.5) + 0.05) P.pos.set(-12, 0, -9);
        g.update(DT, t); P.down = null;
      }
      assert.equal(g.state, 'open', `${id}: open after its ${move} (${far ? 'missed' : 'landed'})`);
      assert.ok(Math.abs(g.openFor - (end === move ? want : D.attacks[end][far ? 'miss' : 'open'])) < 1e-9, `${id}: open ${g.openFor} s after a ${far ? 'miss' : 'hit'}`);
      assert.equal(notes.includes(D.missHint), far, `${id}: the miss told by its words only when it missed`);
      g.dispose();
    }
  }
  // the Elder hangs aloft longer in her later phases: a miss adds ROOST.miss to that
  const g = { phaseIndex: 1 };
  assert.equal(elderOpenFor(g, null, 4.2, false), ROOST.open[1]);
  assert.equal(elderOpenFor(g, null, 5.6, true), ROOST.open[1] + ROOST.miss);
  // the Lampless's dust runs out along the floor in a ring you jump (its space scored 3)
  const L = GUARDIANS.find((G) => G.id === 'perdide2').def;
  assert.ok(L.attacks.dust.wave && L.attacks.dustEnd.wave, 'the Lampless’s dust: a shock ring');
  clearTargets();
});

test('a phase change: it staggers (no moves, its marks lit), then fights on with the next phase\'s moves; a shockwave is jumped', () => {
  clearTargets();
  const W = GUARDIANS.find((G) => G.id === 'incal').def;
  const { g, rt } = stub(W);
  const P = { pos: V(0, 0, -6), health: 3, dead: false, down: null, hurts: 0, hurt() { this.hurts++; }, knockDown() {} };
  rt.player = P; g.state = 'fight';
  const run = runner(g, P);
  run(0.1);
  assert.equal(g.marks.lines.filter((l) => l.visible).length, 0, 'unmarked at first');
  g.add(0.5);
  assert.equal(g.state, 'shift');
  run(SHIFT * 0.5);
  assert.equal(g.attack, null, 'no move while it changes');
  assert.ok(g.marks.lines.some((l) => l.visible), 'its cracks glow');
  run(SHIFT);
  assert.equal(g.state, 'fight');
  g.add(0.25);
  run(SHIFT + 0.1);
  assert.ok(g.marks.lines.every((l) => l.visible), 'all of them, the last phase');
  // a shockwave: on the floor it knocks you down; in the air it runs under you
  g.stop(); g.cool = 99;
  const slam = { id: 'slam', ...W.attacks.slam };
  g.attackAt.copy(g.model.pos); g.addWave(slam);
  P.pos.set(g.model.pos.x, 2, g.model.pos.z + 9);
  run(1.5);
  assert.equal(P.hurts, 0, 'jumped (or jetted) over it');
  g.addWave(slam); P.pos.y = 0;
  run(1.5);
  assert.equal(P.hurts, 1, 'caught on the floor');
  g.dispose(); clearTargets();
});

test('the glow: a spark of the attacker\'s tone that grows and burns white through the stillness', () => {
  const scene = new THREE.Scene(), G = new ChargeGlow(scene, '#3060ff', 0.4);
  G.set(0.2, V(1, 2, 3), 0);
  const small = G.group.scale.x, blue = G.mat.uniforms.uColor.value.clone();
  G.set(0.9, V(1, 2, 3), 0);
  assert.ok(G.visible && G.group.scale.x > small && G.group.position.y === 2);
  assert.ok(G.mat.uniforms.uColor.value.r > blue.r + 0.3, 'white-hot when held');
  G.set(0, V(), 0);
  assert.equal(G.visible, false);
  G.dispose();
});
