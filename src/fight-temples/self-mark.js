// The traveller found in his crowd (issue #534): from the fight temples' iso camera he was lost under a crab or among a
// pack. While the foes' bodies hide him or hem him in (view.js hiddenShare, crowdAround), an inked ring is drawn round
// him on the HUD, over whatever covers him, a small chevron over his head: the page draws it here (an SVG over the
// canvas); an engine from the screen's 'self' part (src/platform.js screen; BridgeHud.cs DrawSelf): { at: his feet,
// head: over his head, k: its fade, size: the ring across, a share of his height on the screen }.
//
//   const mark = new SelfMark(camera);
//   mark.update(dt, player, bodies);   // each frame, after the camera is placed
//   mark.dispose();

import * as THREE from 'three';
import { screen, page } from '../platform.js';
import { SELF, hiddenShare, crowdAround, lostInCrowd } from './view.js';

const r2 = (v) => Math.round(v * 100) / 100;
const _f = new THREE.Vector3(), _h = new THREE.Vector3();
/** His height to the top of his head, for the ring's size (m). */
export const SELF_HEAD = 1.75;

/** The ring's share shown a frame on (0..1), toward on (hidden) or off: SELF.in / SELF.out s. */
export const easeSelf = (k, on, dt, S = SELF) => (on ? Math.min(1, k + dt / S.in) : Math.max(0, k - dt / S.out));

export class SelfMark {
  constructor(camera) {
    this.camera = camera; this.k = 0; this.share = 0; this.around = 0; this.el = null;
    if (!page.drawsHud()) return;
    // (an ink ring with a cream line in it, and a chevron over his head: drawn at 100 px a side, scaled to him)
    this.el = document.body.appendChild(Object.assign(document.createElement('div'), {
      id: 'fight-self',
      innerHTML: '<svg viewBox="-50 -50 100 100" width="100" height="100" style="overflow:visible"><g fill="none" stroke-linecap="round" stroke-linejoin="round">'
        + '<circle r="40" stroke="#2b211f" stroke-width="7"/><circle r="40" stroke="#fbf4e2" stroke-width="3"/>'
        + '<path d="M-9 -60 L0 -51 L9 -60" stroke="#2b211f" stroke-width="7"/><path d="M-9 -60 L0 -51 L9 -60" stroke="#f2c54b" stroke-width="3"/></g></svg>',
    }));
    this.el.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;margin:-50px 0 0 -50px;pointer-events:none;z-index:24;display:none;transform-origin:50% 50%';
  }

  /** `bodies`: the foes standing, [{ pos, radius, height }]; `off`: nothing shown (the run over, a card up). */
  update(dt, player, bodies, off = false) {
    const cam = this.camera;
    const none = off || player.dead;
    this.share = none ? 0 : hiddenShare(cam.position, player.pos, bodies);
    this.around = none ? 0 : crowdAround(player.pos, bodies);
    this.k = easeSelf(this.k, lostInCrowd(this.share, this.around), dt);
    const on = this.k > 0.01;
    _f.copy(player.pos); _h.copy(player.pos).setY(player.pos.y + SELF_HEAD);
    screen.set('self', on ? { at: [r2(_f.x), r2(_f.y), r2(_f.z)], head: [r2(_h.x), r2(_h.y), r2(_h.z)], k: r2(this.k), size: SELF.size } : null);
    if (!this.el) return;
    if (!on) { this.el.style.display = 'none'; return; }
    const a = _f.project(cam), b = _h.project(cam);
    const W = innerWidth, H = innerHeight, x = (((a.x + b.x) / 2) * 0.5 + 0.5) * W, y = (0.5 - ((a.y + b.y) / 2) * 0.5) * H;
    const px = Math.abs(b.y - a.y) * 0.5 * H * SELF.size;   // (the ring's width across in px)
    this.el.style.display = '';
    this.el.style.left = `${x.toFixed(1)}px`; this.el.style.top = `${y.toFixed(1)}px`;
    this.el.style.opacity = this.k.toFixed(2);
    this.el.style.transform = `scale(${(px / 80).toFixed(3)})`;
  }

  dispose() { screen.set('self', null); this.el?.remove(); this.el = null; }
}
