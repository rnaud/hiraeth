import { markById } from './candidates.js';

export async function seedMarkReview() {
  const { slots } = await import('../save-slots.js');
  slots.sandbox();
  const { game } = await import('../game-state.js');
  game.data = { flags: { 'prologue.done': true, 'items.v': 2, 'item.backpack': 1,
    'ship.powered': true, 'ship.launched': true, 'desert.quest.v': 3 }, keepsakes: [] };
  game.save();
}

export const MARK_VIEWS = {
  door: { name: 'Temple door', distances: [14, 24, 40] },
  frieze: { name: 'Wall frieze', distances: [5, 12, 24] },
  stone: { name: 'Glyph stone', distances: [2.5, 5, 8] },
  outside: { name: 'Distant landmark', distances: [22, 48, 85] },
};

/** A fixed-camera review of the actual world, its renderer, lighting and existing sign placements. */
export async function startMarkReview(w) {
  const deadline = Date.now() + 120000;
  while (!w.__hiraethBooted || document.getElementById('loading')) {
    if (Date.now() > deadline) throw new Error('The mark review world did not finish loading');
    await new Promise(r => setTimeout(r, 100));
  }
  const rt = w.level.temples?.find(t => t.id === 'desert');
  if (!rt) throw new Error('The Rose House is needed for the makers’ mark review');
  const q = new URLSearchParams(location.search), V = (...p) => new w.THREE.Vector3(...p);
  w.sound.muted = true;
  w.sound.setVolumes(0, 0); w.sound.setVoices(0);
  if (w.sound.master) w.sound.master.gain.setValueAtTime(0, w.sound.ctx.currentTime);
  w.story.closePage?.(); w.player.opts.health = false;
  w.sky.hour = 10; w.sky.speed = 0; w.updateSky?.();
  w.weather.mode = 'clear'; w.weather.intensity = 0;
  w.player.object.visible = false;
  const style = document.createElement('style');
  style.textContent = 'body > *:not(canvas):not(#loading) { visibility:hidden!important } canvas { visibility:visible!important }';
  document.head.append(style);
  const pin = { eye: V(), target: V(), quat: new w.THREE.Quaternion() };
  const update = w.camera.updateMatrixWorld.bind(w.camera);
  w.camera.updateMatrixWorld = function(force) {
    this.position.copy(pin.eye); this.quaternion.copy(pin.quat);
    if (this.fov !== 50) { this.fov = 50; this.updateProjectionMatrix(); }
    return update(force);
  };
  const state = w.markReview = { ready: false, candidate: markById(q.get('mark'))?.id ?? 'current' };
  function setView(view = 'door', range = 'near') {
    if (!MARK_VIEWS[view]) view = 'door';
    if (!['near', 'middle', 'far'].includes(range)) range = 'near';
    const distance = MARK_VIEWS[view].distances[['near', 'middle', 'far'].indexOf(range)], K = rt.kit;
    let at;
    if (view === 'door') {
      pin.target.copy(K.world(0, 5.22, 54.6));
      pin.eye.copy(K.world(-6, 4.5, 54.6 - distance));
      at = K.world(4, .1, 44);
    } else if (view === 'frieze') {
      pin.target.copy(K.world(17.95, 14.4, 34.6));
      pin.eye.copy(K.world(17.95 - distance, 13.4, 32));
      at = K.world(10, .1, 34);
    } else if (view === 'stone') {
      pin.target.copy(K.world(-5.6, .85, 6.5));
      pin.eye.copy(K.world(-5.6 + distance, 1.5, 6.5));
      at = K.world(-2, .1, 7);
    } else {
      const O = rt.outside, dy = O.doorY - O.base;
      pin.target.copy(O.kit.world(-12 * 1.3, dy + (52 + .56) * 1.25, 9.7));
      const forward = V(Math.sin(O.door.heading), 0, Math.cos(O.door.heading));
      pin.eye.copy(pin.target).addScaledVector(forward, distance).add(V(0, -distance * .18, 0));
      at = O.front.clone();
    }
    pin.quat.setFromRotationMatrix(new w.THREE.Matrix4().lookAt(pin.eye, pin.target, V(0, 1, 0)));
    w.player.teleport(at, V(0, 1, 0), V(0, 0, 1));
    w.player.vel.set(0, 0, 0);
    state.view = view; state.range = range; state.distance = distance; state.ready = true;
    q.set('markView', view); q.set('range', range);
    history.replaceState(null, '', `${location.pathname}?${q}`);
    w.parent.postMessage({ type: 'makers-mark-ready', ready: state.ready, candidate: state.candidate, view, range, distance }, location.origin);
  }
  w.addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== w.parent || e.data?.type !== 'makers-mark-view') return;
    setView(e.data.view, e.data.range);
  });
  state.setView = setView;
  setView(q.get('markView') ?? 'door', q.get('range') ?? 'near');
}
