// Every gadget registered in Node tests, in the original alphabetic order.
// Literal lazy imports make dependencies visible without evaluating every module
// before registration. tests/register-gadgets.test.js checks this complete list
// against the same directory rule as the game's automatic gadget discovery.
import { registerGadget, GADGETS } from '../src/gadgets/registry.js';

const loaders = [
  () => import('../src/gadgets/bomb.js'),
  () => import('../src/gadgets/boomerang.js'),
  () => import('../src/gadgets/bridge.js'),
  () => import('../src/gadgets/bubble.js'),
  () => import('../src/gadgets/fan.js'),
  () => import('../src/gadgets/gun.js'),
  () => import('../src/gadgets/hidden.js'),
  () => import('../src/gadgets/history.js'),
  () => import('../src/gadgets/hook.js'),
  () => import('../src/gadgets/hud.js'),
  () => import('../src/gadgets/index.js'),
  () => import('../src/gadgets/kit.js'),
  () => import('../src/gadgets/lens.js'),
  () => import('../src/gadgets/magnet.js'),
  () => import('../src/gadgets/metal.js'),
  () => import('../src/gadgets/recall.js'),
  () => import('../src/gadgets/registry.js'),
  () => import('../src/gadgets/sfx.js'),
  () => import('../src/gadgets/springs.js'),
  () => import('../src/gadgets/world.js'),
  () => import('../src/gadgets/yard-kit.js'),
];
for (const load of loaders) {
  const m = await load();
  if (m.default?.id && typeof m.default.create === 'function') registerGadget(m.default);
}
export { GADGETS };
