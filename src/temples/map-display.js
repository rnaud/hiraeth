import * as THREE from 'three';

/** Opt-in map display only. `at` stays the authored floor position for old map/route consumers. */
export function mapDisplay(at, display, yaw = 0) {
  if (!display) return { at: [...at], scale: 1, plinth: null };
  const { scale, plinth } = display;
  if (!(scale >= 1 && scale <= 1.6) || !Array.isArray(plinth) || plinth.length !== 3 || !plinth.every(Number.isFinite) || plinth[0] <= 0 || plinth[2] <= 0 || plinth[1] <= 0 || plinth[1] > .3) throw new Error('Invalid map chest display');
  const [w,h,d] = plinth;
  return { at: [at[0],at[1]+h,at[2]], scale,
    plinth: new THREE.BoxGeometry(w,h,d).rotateY(yaw).translate(at[0],at[1]+h/2,at[2]) };
}
