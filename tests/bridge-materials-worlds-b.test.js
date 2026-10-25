import test from 'node:test';
import { auditMaterials } from './bridge-materials.js';

test('bridge materials: worlds-b retains every actual gap and its required stale witnesses', async () => {
  await auditMaterials('worlds-b');
});
