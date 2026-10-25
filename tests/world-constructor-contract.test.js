// A single registry integration check protects the direct constructors used by world-specific tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildableById } from '../src/levels/buildable.js';
import { TEMPLE_HOME } from '../src/temples/attachment.js';
import { createArzach } from '../src/levels/arzach.js';
import { createArzach2 } from '../src/levels/arzach2.js';
import { createBazaar } from '../src/levels/bazaar.js';
import { createBuried } from '../src/levels/buried.js';
import { createDesert } from '../src/levels/desert.js';
import { createEdena } from '../src/levels/edena.js';
import { createGlassDunes } from '../src/levels/glass-dunes.js';
import { createIncal } from '../src/levels/incal.js';
import { createMoonFoundry } from '../src/levels/moon-foundry.js';
import { createPerdide } from '../src/levels/perdide.js';
import { createPerdide2 } from '../src/levels/perdide2.js';
import { createSpaceCity } from '../src/levels/space-city.js';
import { createUnderwater } from '../src/levels/underwater.js';
import { buildHouse } from './house-walk.js';

test('focused world fixtures use the exact registry constructor, including moved temples and standalone parts', () => {
  for (const [id, create] of Object.entries({ arzach: createArzach, arzach2: createArzach2, bazaar: createBazaar, buried: createBuried,
    desert: createDesert, edena: createEdena, garage: createGlassDunes, incal: createIncal, moonfoundry: createMoonFoundry,
    perdide: createPerdide, perdide2: createPerdide2, spacecity: createSpaceCity, underwater: createUnderwater })) {
    assert.equal(buildableById(TEMPLE_HOME[id] ?? id).create, create, id);
  }
  assert.notEqual(createArzach, createArzach2, 'merged Aerie must not silently become its standalone Belfry part');
  assert.notEqual(createPerdide, createPerdide2, 'merged Lorn must not silently become its standalone Deep Wood part');
  assert.throws(() => buildHouse('desert'), /requires the actual world constructor/);
});
