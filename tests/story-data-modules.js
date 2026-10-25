// Literal lazy imports preserve discovery coverage without opaque module paths.
// tests/audit-module-inputs.test.js checks this list against the source directory.
const loaders = {
  'aliens-data.js': () => import('../src/story/aliens-data.js'),
  'arzach-data.js': () => import('../src/story/arzach-data.js'),
  'arzach2-data.js': () => import('../src/story/arzach2-data.js'),
  'bazaar-data.js': () => import('../src/story/bazaar-data.js'),
  'buried-data.js': () => import('../src/story/buried-data.js'),
  'desert-data.js': () => import('../src/story/desert-data.js'),
  'edena-data.js': () => import('../src/story/edena-data.js'),
  'fellow-data.js': () => import('../src/story/fellow-data.js'),
  'home-data.js': () => import('../src/story/home-data.js'),
  'hosts-data.js': () => import('../src/story/hosts-data.js'),
  'incal-data.js': () => import('../src/story/incal-data.js'),
  'lantern-data.js': () => import('../src/story/lantern-data.js'),
  'night-train-data.js': () => import('../src/story/night-train-data.js'),
  'perdide-data.js': () => import('../src/story/perdide-data.js'),
  'perdide2-data.js': () => import('../src/story/perdide2-data.js'),
  'rumours-data.js': () => import('../src/story/rumours-data.js'),
  'scientist-data.js': () => import('../src/story/scientist-data.js'),
  'shop-data.js': () => import('../src/story/shop-data.js'),
  'spheres-data.js': () => import('../src/story/spheres-data.js'),
};
export const files = Object.freeze(Object.keys(loaders));
export async function loadStoryData(world) {
  const name=world+'-data.js';
  return Object.hasOwn(loaders,name)?loaders[name]():null;
}
