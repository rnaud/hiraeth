// No literal key or button names where a verb has a binding (issue #95): the item and gadget cards, the trials'
// start cards and the story's notices name inputs as {key:verb} (src/prompt-keys.js), so they follow the
// player's remapping and the input in hand. A name with no binding of its own (the mounts' throttle) may stay
// literal, in Xbox / PlayStation form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ITEMS } from '../src/items.js';
import { CONTROLS } from '../src/trials/index.js';
import { keyText } from '../src/prompt-keys.js';

// the pad's names for bound verbs, and the keyboard's as the old cards wrote them ("(T, or the middle mouse button)")
const PAD = /\b(?:LT \/ L2|RB \/ R1|LB \/ L1|A \/ ×|B \/ ○|X \/ □|Y \/ △|D-pad [↑↓←→]|RT \/ R2)/;
const KEYS = /\((?:T|R|G|V|X|B|E|F|Q)(?:,| or )|right mouse|middle mouse|left click|\bW \/ S\b/;

test('the item and gadget cards name no literal keys', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    for (const f of ['use', 'text']) {
      const s = it[f];
      if (typeof s !== 'string') continue;
      assert.doesNotMatch(s, PAD, `${id}.${f}`);
      assert.doesNotMatch(s, KEYS, `${id}.${f}`);
    }
  }
  const dir = new URL('../src/gadgets/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/^\s+use: (?:ITEMS\.\w+\?\.use \?\? )?'([^']*)'/gm)) {
      assert.doesNotMatch(m[1], PAD, f); assert.doesNotMatch(m[1], KEYS, f);
    }
  }
});

test('the trials’ start cards name their inputs as verbs', () => {
  for (const [mode, C] of Object.entries(CONTROLS)) {
    for (const kind of ['pad', 'keys', 'touch']) {
      assert.ok(C[kind]?.length, `${mode}.${kind}`);
      for (const [k, v] of C[kind]) {
        if (k === 'RT / R2' && v === 'throttle') continue;   // (the mounts' throttle: no verb of its own)
        assert.doesNotMatch(`${k} ${v}`, PAD, `${mode}.${kind}: ${k}`);
        assert.doesNotMatch(`${k} ${v}`, /^(?:Space|Shift|W A S D|Left stick|Right mouse|Left mouse|[A-Z])\b/, `${mode}.${kind}: ${k}`);
      }
    }
  }
  // and they resolve for each input
  const [k] = CONTROLS.kit.pad[1];
  assert.equal(keyText(k, { kind: 'pad', teach: true }), 'A / ×');
  assert.equal(keyText(k, { kind: 'keys', teach: true }), 'SPACE');
});

test('the story’s notices and toasts name no literal pad buttons', () => {
  const dir = new URL('../src/story/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\b(?:toast|notice|once)\??\.?\(\s*(?:'[^']*',\s*)?(['"`])((?:(?!\1).)*)\1/g)) {
      assert.doesNotMatch(m[2], PAD, `${f}: ${m[2].slice(0, 60)}`);
    }
  }
});

test('the gadget verbs resolve on every input', () => {
  assert.equal(keyText('{key:use}', { kind: 'keys', teach: true }), 'T or the middle mouse button');
  assert.equal(keyText('{key:use}', { kind: 'pad', teach: true }), 'RT / R2');
  assert.equal(keyText('{key:use}', { kind: 'touch', teach: true }), '✺');
  assert.equal(keyText('{key:reel}', { kind: 'keys', teach: true }), 'W / S');
  assert.equal(keyText('{key:reel}', { kind: 'pad', teach: true }), 'the left stick');
});
