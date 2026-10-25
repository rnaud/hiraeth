import test from 'node:test';
import { auditMaterials } from './bridge-materials.js';

test('bridge materials: worlds-a retains every actual gap and its required stale witnesses', async () => {
  await auditMaterials('worlds-a');
});
