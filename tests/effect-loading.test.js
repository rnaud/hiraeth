import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSoundWithRetry } from '../src/effect-loading.js';
import { createHold } from '../src/title-hold.js';

class Element extends EventTarget {
  constructor(tag, owner) { super(); this.tag = tag; this.owner = owner; this.children = []; this.style = {}; }
  setAttribute() {} removeAttribute() {}
  append(...nodes) { this.children.push(...nodes); }
  showModal() { this.owner.visible = this; }
  close() { this.owner.visible = null; }
  remove() { this.owner.removed++; }
}
function documentFixture() {
  const doc = { visible: null, removed: 0 };
  doc.createElement = tag => new Element(tag, doc); doc.body = doc.createElement('body');
  return doc;
}
const settle = () => new Promise(resolve => setImmediate(resolve));
for (const behindTitle of [false, true]) test(`failed take then explicit retry succeeds ${behindTitle ? 'behind Continue' : 'direct start'}`, async () => {
  const prior = globalThis.document, doc = documentFixture(); globalThis.document = doc;
  const hold = behindTitle ? createHold({}) : null;
  let attempts = 0, disposed = 0;
  const sound = { async prepareEffects({ retry }) { attempts++; if (!retry) throw new Error('missing take'); return 'ready'; }, dispose() { disposed++; } };
  try {
    const pending = prepareSoundWithRetry(sound, { onFailure: () => { if (hold) hold.stage = 'Sound effects couldn’t load.'; } });
    await settle(); assert.equal(doc.visible.tag, 'dialog', 'visible above the held title, not hidden inside world loading');
    assert.equal(hold?.failed ?? null, null);
    doc.visible.children[1].children[0].dispatchEvent(new Event('click'));
    assert.equal(await pending, 'ready'); assert.equal(attempts, 2); assert.equal(disposed, 0); assert.equal(doc.visible, null);
    if (hold) { hold.arrive(); hold.release(); await hold.go; assert.equal(hold.failed, null); }
  } finally { globalThis.document = prior; }
});

test('Back to title settles and disposes the pending loader exactly once', async () => {
  const prior = globalThis.document, doc = documentFixture(); globalThis.document = doc;
  let disposed = 0, back = 0;
  try {
    const pending = prepareSoundWithRetry({ prepareEffects: async () => { throw new Error('missing'); }, dispose: () => disposed++ }, { onBack: () => back++ });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await settle(); doc.visible.children[1].children[1].dispatchEvent(new Event('click'));
    await rejected; assert.equal(disposed, 1); assert.equal(back, 1); assert.equal(doc.visible, null); assert.equal(doc.removed, 1);
  } finally { globalThis.document = prior; }
});
