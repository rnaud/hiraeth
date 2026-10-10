import * as T from 'three';

// The creatures gallery's frame (enemies.html, src/enemies/page.js): where the still camera looks and how far back it
// stands. It used to be fitted to the body's box every frame, so the camera rode along with every bob, glide and
// flap (a sky ray's flight, a jelly's pulse): the page seemed to move with the creature. Now the frame is the body's
// box at rest (taken without the walk's progress), grown by every box the pose has shown since it began and by a
// move's ground, and eased to that: it settles within the first cycle (four seconds at most) and then holds still while the creature moves in
// front of it. A walk is followed only by its steady progress along the ground (the root's, not the body's sway).
// A still pose (the contact sheets' captures) is framed on that pose alone, as before.

/**
 * How fast the frame eases to a grown box (1/s), how little it may move before it's left where it is (m), and after
 * how long a pose it stops growing (s): past it the camera never moves (a marionette's strings swing a little wider
 * for a long while).
 */
export const GALLERY_FRAME = { ease: 5, settle: 0.002, lock: 4 };

const _b = new T.Box3();
/** The box of what is drawn of `obj` (world space): hidden parts left out (a jelly's hidden stalks stay where it began). */
export function visibleBox(obj, box = new T.Box3()) {
  box.makeEmpty();
  obj.updateWorldMatrix(true, true);
  obj.traverseVisible((o) => {
    if (!o.geometry) return;
    if (o.boundingBox !== undefined) { if (o.boundingBox === null) o.computeBoundingBox(); _b.copy(o.boundingBox); }   // (a skinned or instanced mesh: its own box, as Box3.setFromObject)
    else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox); }
    box.union(_b.applyMatrix4(o.matrixWorld));
  });
  return box;
}

export class GalleryFrame {
  constructor() { this.box = new T.Box3(); this.centre = new T.Vector3(); this.r = 1; this.key = null; this._c = new T.Vector3(); this._s = new T.Sphere(); }
  /** Start again from `box` (a new pose or move), snapped: no easing in from the last pose's frame. */
  reset(key, box) {
    this.key = key; this.box.copy(box); this.age = 0;
    this.box.getCenter(this.centre); this.r = this.box.getBoundingSphere(this._s).radius;
    return this;
  }
  /** Take in what the pose shows now (`box`, in the creature's own frame) and ease towards the grown box over `dt` s. */
  grow(box, dt) {
    this.age += dt;
    if (this.age < GALLERY_FRAME.lock) this.box.union(box);
    const c = this.box.getCenter(this._c), r = this.box.getBoundingSphere(this._s).radius;
    const k = dt > 0 ? 1 - Math.exp(-GALLERY_FRAME.ease * dt) : 1;
    if (this.centre.distanceTo(c) > GALLERY_FRAME.settle) this.centre.lerp(c, k); else this.centre.copy(c);
    this.r = Math.abs(this.r - r) > GALLERY_FRAME.settle ? this.r + (r - this.r) * k : r;
    return this;
  }
  /** The box's height (the item viewer sets a model's bottom on the floor by it). */
  get height() { return this.box.max.y - this.box.min.y; }
}
