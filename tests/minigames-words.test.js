// A minigame's words in the world (src/minigames/kit/labels.js) as the screen's 'words' part (src/platform.js), which an
// engine draws (BridgeHud.cs DrawWords; docs/systems/engine-bridge.md "The trials and games"): the pops with their
// world point, kind and length, the balloons and the tags where they were placed; gone as they end or are disposed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldLabels, tagWords } from '../src/minigames/kit/labels.js';
import { screen } from '../src/platform.js';

test('the words go to the screen\'s state: pops, balloons, tags; cleared as they end', () => {
  const cam = new THREE.PerspectiveCamera();
  const w = new WorldLabels(cam);
  w.pop(new THREE.Vector3(1.234, 2, -3), '+250', 'gold', 1.4);
  w.pop(new THREE.Vector3(0, 0, 0), '×3', 'combo', 0.5);
  w.update(0.1);
  let s = screen.state.words;
  assert.equal(s.pops.length, 2);
  assert.deepEqual({ ...s.pops[0], id: 0 }, { id: 0, text: '+250', kind: 'gold', at: [1.23, 2, -3], secs: 1.4 });
  assert.ok(s.pops[1].id > s.pops[0].id, 'ids count up');
  const say = w.balloon();
  say.show('Lovely shot!', 2);
  say.place(new THREE.Vector3(0, 3, 0));
  const tag = w.tag('<b>Longer blade</b>Reaches<br>further');
  tag.place(new THREE.Vector3(5, 1, 5));
  w.update(0.5);
  s = screen.state.words;
  assert.equal(s.pops.length, 1, 'the short one gone');
  assert.deepEqual(s.says, [{ text: 'Lovely shot!', at: [0, 3, 0] }]);
  assert.deepEqual(s.tags, [{ title: 'Longer blade', text: 'Reaches\nfurther', at: [5, 1, 5] }]);
  w.update(2);
  assert.equal(screen.state.words.says.length, 0, 'the balloon hidden after its time');
  w.dispose();
  assert.equal(screen.state.words, null, 'nothing left');
});

test('a tag\'s html as words', () => {
  assert.deepEqual(tagWords('<b>Spinner II</b>It turns &amp; turns'), { title: 'Spinner II', text: 'It turns & turns' });
  assert.deepEqual(tagWords('plain'), { title: '', text: 'plain' });
});
