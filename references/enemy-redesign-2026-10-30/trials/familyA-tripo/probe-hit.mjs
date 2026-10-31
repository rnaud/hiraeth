// tests/combat-reach.test.js's bodyHits case for a kind: a blade swept across its body at mid height; where it hits
// against the body span's centre.   node probe-hit.mjs [kind skitter]
import * as THREE from 'three';
import { bodyHits } from '../../../../src/fluid-blade.js';
import { bodySpan } from '../../../../src/foe-body.js';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const kind = process.argv[2] ?? 'skitter';
clearTargets();
const P = { pos: v(0, 0, 40), vel: v(), heading: 0, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() {} };
const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
const f = foes.add(kind, v(0, 0, 1.6));
for (let i = 0; i < 10; i++) foes.look(f, 1 / 60);
f.model.group.updateMatrixWorld(true);
const S = bodySpan(f.model), y = (S.lo + S.hi) / 2;
const Y = +(process.env.Y ?? NaN), yy = Number.isFinite(Y) ? Y : y;
const hit = bodyHits(v(0, 1.1, 0), 3, null, { a: v(-1.2, yy, 1.6), b: v(-0.4, yy, 1.6) }, { a: v(0.4, yy, 1.6), b: v(1.2, yy, 1.6) });
console.log('span', S.lo.toFixed(2), S.hi.toFixed(2), 'centre', S.centre.toArray().map((x) => x.toFixed(2)), 'heading', f.heading.toFixed(2), 'hits', hit.map((h) => [h.body, h.point.toArray().map((x) => x.toFixed(2)), h.point.distanceTo(S.centre).toFixed(2)]));
foes.dispose();
