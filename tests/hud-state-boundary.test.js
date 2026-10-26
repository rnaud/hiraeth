import test from 'node:test';
import assert from 'node:assert/strict';
import { Cue } from '../src/hud.js';
import { CueState } from '../src/hud-state.js';
import { screen } from '../src/platform.js';

test('native and browser cues publish the same state and transition notifications', () => {
  const native = new CueState();
  const el = {innerHTML:'',classList:{toggle(){}}}, web = new Cue(el);
  let nativeChanges=0, webChanges=0;
  native.onChange=()=>nativeChanges++; web.onChange=()=>webChanges++;
  for(const [text,kind] of [['',''],['E turn the lens',''],['E board the ship',''],['◆ Find the stair','quest'],['Golden dunes','place'],['',''],['X / □',''],['','']]) {
    screen.reset(); native.set(text,kind); const expected=structuredClone(screen.state.cue);
    screen.reset(); web.set(text,kind);
    assert.deepEqual(screen.state.cue,expected);
    assert.equal(web.text,native.text);assert.equal(web.kind,native.kind);
    assert.equal(webChanges,nativeChanges);
  }
  assert.equal(el.innerHTML,'<b class="key">X / □</b>','the browser still draws the final gamepad badge');
});
