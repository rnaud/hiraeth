import * as THREE from 'three';

// The items' pictures for the game menu's Items panel (src/game-menu.js): each item's own model (the
// one that hovers out of its box, src/boxes/model.js buildItemModel) drawn by the game's pipeline, ink
// lines and all, alone against the slot's paper (main.js captureView with `keep` and `backdrop`, as the
// conversation portraits are). One a frame while the menu is open, so opening it costs nothing: a slot
// shows its kind's mark until its picture is ready. Kept for the session (the menu covers the canvas
// while it draws them). A capture that comes back blank (a driver that won't read the canvas back) is
// not retried: the mark stays.
//
//   const icons = new ItemIcons({ scene, capture, build, place, onReady })
//   icons.get(id)   → the picture's URL, or null (and it is queued)
//   icons.pump(id?) draw the next one (main.js, each frame the menu is open; id: that one first); true if it drew one

/** The slots' paper (src/game-menu.css .slot): the picture's backdrop, so it sits in the slot unframed. */
export const ICON_PAPER = '#f3e7cc';
/** Drawn for this many CSS px across (the Items panel's large picture; the slots shrink it): lines and grain at that size. */
export const ICON_CSS = 160;
/** The camera's field of view and the three-quarter view it takes, from a little above and to the side. */
export const ICON_VIEW = { fov: 22, side: 0.5, up: 0.55, margin: 1.12 };

/** Where the camera stands to frame a sphere (centre, radius) from `dir` (unit) at `fov` degrees. */
export function frameSphere(center, radius, dir, fov = ICON_VIEW.fov, margin = ICON_VIEW.margin) {
  const d = (radius * margin) / Math.sin(THREE.MathUtils.degToRad(fov / 2));
  return center.clone().addScaledVector(dir, d);
}

export class ItemIcons {
  /**
   * @param o.scene   the world's scene (the model is added for its picture, then taken away)
   * @param o.capture (eye, look, w, h, opts) → data URL or null (main.js captureView)
   * @param o.build   (id) → the item's model (buildItemModel)
   * @param o.place   () → { at: Vector3, up: Vector3 }: an empty spot (high over the traveller) and which way is up there
   * @param o.onReady (id, url) a picture is ready
   */
  constructor({ scene, capture, build, place, onReady = () => {}, size = null }) {
    Object.assign(this, { scene, capture, build, place, onReady });
    this.size = size ?? Math.round(Math.min(256, ICON_CSS * Math.min(Math.max(globalThis.devicePixelRatio ?? 1, 1), 2) * 1.25));
    this.cache = new Map();   // id → url | null (failed)
    this.queue = [];
  }

  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (!this.queue.includes(id)) this.queue.push(id);
    return null;
  }

  pump(first = null) {
    // (`first`: that one now, ahead of the queue: the gadget in hand, src/gadgets/index.js)
    if (first && !this.cache.has(first)) { const i = this.queue.indexOf(first); if (i >= 0) this.queue.splice(i, 1); this.queue.unshift(first); }
    const id = this.queue.shift();
    if (!id) return false;
    let url = null;
    try { url = this.draw(id); } catch (e) { console.warn('item icon', id, e); }
    this.cache.set(id, url);
    if (url) this.onReady(id, url);
    return true;
  }

  draw(id) {
    const model = this.build(id);
    const { at, up } = this.place();
    model.position.copy(at);
    // a three-quarter view: turned a little, seen from a little above
    model.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.scene.add(model);
    model.updateMatrixWorld(true);
    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(model.quaternion);
    const front = new THREE.Vector3().crossVectors(side, up).normalize();   // (+z: the side an item shows when it hovers out of its box)
    const dir = front.addScaledVector(side, ICON_VIEW.side).addScaledVector(up, ICON_VIEW.up).normalize();
    const eye = frameSphere(sphere.center, Math.max(sphere.radius, 0.05), dir);
    let url = null;
    try { url = this.capture(eye, sphere.center, this.size, this.size, { keep: [model], backdrop: ICON_PAPER, fov: ICON_VIEW.fov, css: ICON_CSS }); }
    finally {
      model.removeFromParent();
      model.traverse((o) => o.geometry?.dispose?.());
    }
    return url;
  }
}
