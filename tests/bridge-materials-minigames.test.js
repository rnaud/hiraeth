import test from 'node:test';
import { auditMaterials } from './bridge-materials.js';

test('bridge materials: minigames retains every actual gap and its required stale witnesses', async () => {
  await auditMaterials('minigames');
});
