// Fight-only lazy imports; audit-module-inputs.test.js checks discovery completeness.
const loaders = {
  'fight-arzach.js': () => import('../src/minigames/fight-arzach.js'),
  'fight-bazaar.js': () => import('../src/minigames/fight-bazaar.js'),
  'fight-buried.js': () => import('../src/minigames/fight-buried.js'),
  'fight-desert.js': () => import('../src/minigames/fight-desert.js'),
  'fight-edena.js': () => import('../src/minigames/fight-edena.js'),
  'fight-glassdunes.js': () => import('../src/minigames/fight-glassdunes.js'),
  'fight-incal.js': () => import('../src/minigames/fight-incal.js'),
  'fight-moonfoundry.js': () => import('../src/minigames/fight-moonfoundry.js'),
  'fight-perdide.js': () => import('../src/minigames/fight-perdide.js'),
  'fight-spacecity.js': () => import('../src/minigames/fight-spacecity.js'),
  'fight-spheres.js': () => import('../src/minigames/fight-spheres.js'),
  'fight-underwater.js': () => import('../src/minigames/fight-underwater.js'),
};
export async function loadFightModules() {
 return Promise.all(Object.values(loaders).map(async load=>(await load()).default));
}
