// The toad's lob wind-up in node, frame by frame: its bellows' scale, the throat bubble's veil and the glob.
import * as THREE from 'three';
import { Foes } from '../../../../src/foes.js';
import { GameState } from '../../../../src/game-state.js';
import { clearTargets } from '../../../../src/targets.js';

clearTargets();
const foes = new Foes({ level: { foes: { own: true } }, levelId: 'arena', scene: null, player: { pos: new THREE.Vector3(0, 0, 6), heading: Math.PI }, physics: { groundAt: () => 0 }, game: new GameState(null), rng: () => 0.01 });
const f = foes.add(process.argv[2] ?? 'toad@perdide', new THREE.Vector3(), { tier: 0 }); f.heading = 0; f.provoked = true;
for (let i = 0; i < 45; i++) foes.look(f, 1 / 30);
f.atk = f.def.attacks.find((a) => a.id === 'lob'); f.state = 'wind'; f.attackAt = new THREE.Vector3(0, 0, 6);
const find = (n) => { let x = null; f.model.group.traverse((o) => { if (o.name === n) x = o; }); return x; };
for (let i = 0; i <= 30; i++) {
  f.k = Math.min(0.6, i / 30); foes.look(f, 1 / 30);
  if (i % 5 === 0) { let veil = null; f.model.group.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uVeil && o.parent?.name === "throat" && !veil) veil = [o.visible, o.material.uniforms.uVeil.value.toFixed(2), o.scale.x.toFixed(2), o.material.uniforms.uGlow?.value.toFixed(2)]; });
    console.log(i, 'k', f.k.toFixed(2), 'bellows', find('bellows')?.scale.toArray().map((x) => x.toFixed(2)).join(','), 'veil', veil); }
}
foes.dispose();
