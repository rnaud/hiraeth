import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { keyBadge, badgeLine, escapeHtml } from '../src/prompt-keys.js';
import { padText } from '../src/native-pad.js';
import { backdropFor, isolate, restore, BACKDROPS, portraitSize, portraitPixelRatio, PORTRAIT_INK } from '../src/story/portrait-bg.js';

// ---- round button badges in prompts

test('a prompt\'s button becomes a round badge holding just the button\'s name', () => {
  assert.equal(keyBadge('E'), '<b class="key">E</b>');
  assert.equal(keyBadge('<x>'), '<b class="key">&lt;x&gt;</b>', 'escaped');
  assert.equal(badgeLine('Viridel · E go aboard'), 'Viridel · <b class="key">E</b> go aboard');
  assert.equal(badgeLine('aboard · X / □ step outside\n◆ the well · 20 m'), 'aboard · <b class="key">X / □</b> step outside\n◆ the well · 20 m');
  // only a part that starts with a button: names and words that begin with E stay text
  assert.equal(badgeLine('Viridel · Elsewhere · relics 0/5'), 'Viridel · Elsewhere · relics 0/5');
  assert.equal(badgeLine('a <b> & c'), escapeHtml('a <b> & c'));
});

test('the badge\'s text is still rewritten to the handheld\'s button names (native-pad.js rewrites text nodes)', () => {
  // the text node inside the badge is exactly the button's name
  const inner = keyBadge('X / □').match(/>([^<]*)</)[1];
  assert.equal(padText(inner, 'android'), 'X');
  assert.equal(padText(keyBadge('A / ×').match(/>([^<]*)</)[1], 'android', 'nintendo'), 'B', 'and the bottom button is B on a Retroid');
  assert.equal(badgeLine('B / ○ dismount · RB / R1 boost'), '<b class="key">B / ○</b> dismount · <b class="key">RB / R1</b> boost');
});

// ---- portraits: the person alone against a flat colour

test('a portrait\'s backdrop is the world\'s own tone, unless the person wears something close to it', () => {
  // Nima wears lilac in the Lodestar, whose own tone is lilac: she gets another of its tones
  const nima = { color: '#a99be0', palette: { cloak: '#a99be0', cloth: '#e2d3b4' } };
  const bd = backdropFor(nima, 'incal');
  assert.notEqual(bd, BACKDROPS.incal[0]);
  assert.ok(BACKDROPS.incal.includes(bd));
  // whatever they wear, the tone is one of the world's own
  assert.ok(BACKDROPS.incal.includes(backdropFor({ color: '#34405e', palette: { cloak: '#34405e' } }, 'incal')));
  // red in the desert: the desert's sand
  assert.equal(backdropFor({ color: '#c8483a', palette: { cloak: '#c8483a', cloth: '#5a4a3a' } }, 'desert'), BACKDROPS.desert[0]);
  // an unknown world and a person with no colours still get a colour
  assert.equal(backdropFor({}, 'nowhere'), BACKDROPS.default[0]);
  assert.equal(backdropFor({ backdrop: '#123456', color: '#123456' }, 'desert'), '#123456', 'a person may name their own');
});

test('isolate hides everything but the person (and their cape), and restore brings it all back', () => {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(), tree = new THREE.Group(), light = new THREE.DirectionalLight();
  const crowd = new THREE.Group(), npc = new THREE.Group(), other = new THREE.Group(), hat = new THREE.Mesh(), cape = new THREE.Mesh();
  const off = new THREE.Mesh(); off.visible = false;
  npc.add(hat); crowd.add(npc, other);
  scene.add(ground, tree, light, crowd, cape, off);
  const hidden = isolate([npc, cape, null], scene);
  assert.deepEqual(new Set(hidden), new Set([ground, tree, other]));
  assert.ok(npc.visible && hat.visible && cape.visible && crowd.visible && light.visible);
  assert.ok(!ground.visible && !tree.visible && !other.visible);
  restore(hidden);
  assert.ok(ground.visible && tree.visible && other.visible);
  assert.equal(off.visible, false, 'what was hidden before stays hidden');
});

test('the portrait is drawn at the circle\'s size and supersampled: enough pixels for the screen, ink scaled to the circle', () => {
  // as many pixels as the circle shows on this screen (a little over, for its tilt), within bounds
  assert.equal(portraitSize(84, 1), 105);
  assert.equal(portraitSize(84, 2), 210);
  assert.equal(portraitSize(60, 1), 96, 'never fewer than 96');
  assert.ok(portraitSize(108, 3) <= 320, 'never more than 320');
  // a 720-row frame shown in an 84 px circle: drawn with lines 720 / 84 times as wide (at the portrait's ink weight)
  assert.ok(Math.abs(portraitPixelRatio(720, 84, 1) - (720 / 84) * PORTRAIT_INK) < 1e-9);
  // so a line keeps its width once shrunk: w CSS px × ratio render px, over rows / px of shrink, is w × ink × px / css
  const rows = 408, css = 84, px = portraitSize(css, 1), w = 1.25;
  const inImage = (w * portraitPixelRatio(rows, css)) / (rows / px);
  assert.ok(Math.abs(inImage - w * PORTRAIT_INK * (px / css)) < 1e-9);
  // never thinner than the game draws them
  assert.equal(portraitPixelRatio(100, 84, 1.5), 1.5);
});

// ---- a world's words never come over a conversation (its page showed over Nima's last lines and stayed);
// since October 2026 they are a toast, not a comic page

test('a world\'s closing words wait for the conversation to end, then come as a toast, once', async () => {
  globalThis.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, style: {} }), exitPointerLock() {} };
  globalThis.window = { addEventListener() {} };
  try {
    const { Story, toastSeconds } = await import('../src/quest.js');
    const stories = {}, said = [];
    const journal = { storyDone: () => false, seen: () => true, markSeen() {}, addStory: (l, e) => { stories[l] = e; } };
    const sound = { page() {}, chime() {} };
    const player = { pos: new THREE.Vector3(), frame: { up: new THREE.Vector3(0, 1, 0) } };
    const story = new Story(new THREE.Scene(), {
      levelId: 'incal', def: { title: 'T', intro: 'i', outro: 'o', goal: [50, 0, 50], manual: true, next: 'Next: Vael' },
      journal, sound, capture: () => 'data:image/jpeg;base64,', player, physics: { rayDistance: () => Infinity, groundAt: () => 0 },
      say: (t) => said.push(t),
    });
    let talking = true;
    story.waitFor = () => talking;
    assert.equal(story.complete(), true);
    assert.deepEqual(said, [], 'not over the conversation');
    assert.ok(stories.incal?.img, 'the moment is drawn into the sketchbook at once');
    story.update(0.016, 1, null);
    assert.deepEqual(said, [], 'still talking');
    talking = false;
    story.update(0.016, 1.1, null);
    assert.deepEqual(said, ['o', 'Next: Vael'], 'the talk is over: the closing words, then the next world');
    assert.equal(story.pageOpen, false, 'nothing holds the screen');
    story.update(0.016, 1.2, null);
    assert.equal(said.length, 2, 'and they do not come back');
    // the opening words: the title and the line in one toast, up longer when long
    story.showPage('intro');
    assert.equal(said.at(-1), 'T · i');
    assert.equal(toastSeconds('short'), 4.5);
    assert.ok(toastSeconds('x'.repeat(120)) > 7 && toastSeconds('x'.repeat(400)) === 9);
  } finally {
    delete globalThis.document; delete globalThis.window;
  }
});
