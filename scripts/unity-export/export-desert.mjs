// The desert alone, as the first pass exported it (export-world.mjs does every world):
//   node scripts/unity-export/export-desert.mjs [outDir]
process.argv.splice(2, 0, 'desert');
await import('./export-world.mjs');
