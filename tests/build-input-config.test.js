// Keep one real full-config contract; page tests need only the pure page list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import config, { BUILD_INPUT as compatibilityInput } from '../vite.config.js';
import { BUILD_INPUT } from '../scripts/build-input.mjs';

test('Vite uses the same page-input object exported for page consumers', () => {
  assert.strictEqual(compatibilityInput, BUILD_INPUT, 'existing config export retains identity');
  assert.strictEqual(config.build.rolldownOptions.input, BUILD_INPUT, 'the actual build consumes the shared list');
  const expected = {
    'caravan-review': 'caravan-review.html',
    'notes': 'notes.html',
    'cinematics': 'cinematics.html',
    'enemies': 'enemies.html',
    'main': 'index.html',
    'studio': 'studio.html',
    'trailer': 'trailer.html',
    'motion': 'motion.html',
    'changelog': 'changelog.html',
    'items': 'items.html',
    'audits': 'audits.html',
    'references': 'references.html',
    'lore': 'lore.html',
    'soundEffects': 'sound-effects.html',
    'music': 'music.html',
    'serendipity': 'serendipity.html',
    'temples': 'temples.html',
    'outfits': 'outfits.html',
    'outfits-gallery': 'outfits-gallery.html',
  };
  assert.deepEqual(Object.keys(BUILD_INPUT), Object.keys(expected), 'all original pages and their order');
  for (const [key, page] of Object.entries(expected)) {
    assert.equal(BUILD_INPUT[key], fileURLToPath(new URL('../' + page, import.meta.url)), key + ' stays at the repository root');
  }
});
