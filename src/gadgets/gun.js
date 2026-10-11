import * as THREE from 'three';
import { inkMat } from './kit.js';
import { ITEMS } from '../items.js';

// The fluid gun (docs/systems/gadgets.md, "The fluid gun"): the makers' glove that drinks from the backpack and
// shoots its fluid. Since the progression rewrite (v1.38) it is a gadget like the others, found in the desert's
// Givers' Hearth, not worn from the start: chosen with D-pad ↑ (B), it is the one LT / L2 aims and RT / R2 shoots,
// and D-pad → (X) takes its next mode (fluid, push, and the modes found). The shooting itself is the fluid tool's
// (src/fluid-tool.js: it reads the triggers while the gun is in hand, `gunInHand`); this definition is what the
// gadgets' runtime, the wheel, the chip and the boxes need of it. `trigger: 'tool'` tells the runtime to leave the
// triggers to the tool.

const LEATHER = '#6a4f38', CUFF = '#efe6cf', BRASS = '#d6a94a', FLUID = '#72d5bf';

/** The glove as an object (the box's hovering picture, the menu, the chip): ≈ 0.3 m, fingers forward (+z). */
export function gunModel() {
  const g = new THREE.Group();
  const leather = inkMat(LEATHER), cuff = inkMat(CUFF), brass = inkMat(BRASS, { metal: 'brass' }), fluid = inkMat(FLUID, { glow: 0.7 });
  // the back of the hand and the palm: a rounded slab; four fingers curled a little; the thumb along the side
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.12).translate(0, 0, 0.02), leather));
  for (let i = 0; i < 4; i++) {
    const x = -0.039 + i * 0.026;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 3, 6).rotateX(Math.PI / 2), leather);
    f.position.set(x, -0.006, 0.11); f.rotation.x = 0.35;
    g.add(f);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), brass).translateX(x).translateY(0.025).translateZ(0.075));   // a knuckle stud
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6).rotateX(Math.PI / 2), leather);
  thumb.position.set(0.066, -0.01, 0.045); thumb.rotation.y = -0.5;
  g.add(thumb);
  // the flared cuff with its pale band, the brass fitting on the wrist and the vial of fluid in it
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.09, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.08), inkMat(LEATHER, { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.008, 5, 18).translate(0, 0, -0.118), cuff));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.06).translate(0, 0.03, -0.045), brass));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 3, 8).rotateX(Math.PI / 2).translate(0, 0.048, -0.045), fluid));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.05).translate(0, 0.026, 0.03), brass));   // the plate on the back of the hand
  g.rotation.set(-0.5, 0.6, 0);
  return g;
}

class Gun {
  constructor(ctx) { this.ctx = ctx; }
  /** The fluid tool reads LT / RT itself while the gun is in hand (FluidTool.gunInHand). */
  get trigger() { return 'tool'; }
  get aiming() { return false; }   // (the tool brings the camera over the shoulder itself)
  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  /** Its modes (the fluid tool's: fluid, push, and those found), and the next one (D-pad →, X). */
  get modes() { return this.ctx.tool?.modes ?? []; }
  cycleMode() { return this.ctx.tool?.cycleMode?.(1) ?? false; }
  hud() {
    const T = this.ctx.tool;
    if (!T) return {};
    return { note: T.dry ? 'empty' : T.modeName };
  }
}

export default {
  id: 'gun', name: ITEMS.gun?.name ?? 'Fluid gun', glyph: '✺', order: 5, needs: 'backpack', trigger: 'tool',
  where: ITEMS.gun?.where,
  with: ITEMS.gun?.with,   // (ember mode comes with it: one chest, issue #83)
  text: ITEMS.gun?.text ?? 'The makers’ glove that shoots the backpack’s fluid.',
  use: ITEMS.gun?.use ?? 'Aim with LT / L2 and shoot with RT / R2; D-pad → takes the next mode.',
  model: () => gunModel(),
  create(ctx) { return new Gun(ctx); },
};
