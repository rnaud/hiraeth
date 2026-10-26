// Literal lazy imports; audit-module-inputs checks completeness against disk.
const loaders = {
  'glassdunes-people.js': () => import('../src/story/glassdunes-people.js'),
  'moonfoundry-people.js': () => import('../src/story/moonfoundry-people.js'),
  'spacecity-people.js': () => import('../src/story/spacecity-people.js'),
  'underwater-people.js': () => import('../src/story/underwater-people.js'),
};
export const files = Object.freeze(Object.keys(loaders));
export function loadStoryPeopleFile(file) {
  if (!Object.hasOwn(loaders, file)) throw Error('Unknown story people: ' + file);
  return loaders[file]();
}
