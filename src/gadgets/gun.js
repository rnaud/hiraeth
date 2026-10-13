import * as THREE from 'three';
import { inkMat } from './kit.js';
import { ITEMS } from '../items.js';
import { TRAVELLER_PALETTE as PAL } from '../traveller-style.js';

// The fluid gun (docs/systems/gadgets.md, "The fluid gun"): the makers' glove that drinks from the backpack and
// shoots its fluid. Since the progression rewrite (v1.38) it is a gadget like the others, found in the desert's
// Givers' Hearth, not worn from the start: chosen with D-pad ↑ (B), it is the one LT / L2 aims and RT / R2 shoots,
// and D-pad → (X) takes its next mode (fluid, push, and the modes found). The shooting itself is the fluid tool's
// (src/fluid-tool.js: it reads the triggers while the gun is in hand, `gunInHand`); this definition is what the
// gadgets' runtime, the wheel, the chip and the boxes need of it. `trigger: 'tool'` tells the runtime to leave the
// triggers to the tool.

// the glove as he wears it (src/traveller.js fluidGlove, TRAVELLER_PALETTE): dark green-grey leather, the pale lavender
// band round the cuff's open end, the oval plate on the back of the hand and the three knuckle lights in the fluid's
// light, and the brass fitting on the cuff with its vial of fluid (issue #242: it was brown with a cream trumpet cuff)
const LEATHER = PAL.glove, BAND = PAL.lavender, LIGHT = PAL.gloveLight, FITTING = PAL.fitting;

/** The glove as an object (the box's hovering picture, the menu, the chip): ≈ 0.3 m, fingers forward (+z). */
export function gunModel() {
  const g = new THREE.Group();
  const leather = inkMat(LEATHER), band = inkMat(BAND), fitting = inkMat(FITTING, { metal: 'brass' }), light = inkMat(LIGHT, { glow: 0.75 });
  // the back of the hand and the palm: a rounded slab; four fingers curled a little; the thumb along the side
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.12).translate(0, 0, 0.02), leather));
  for (let i = 0; i < 4; i++) {
    const x = -0.039 + i * 0.026;
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.05, 3, 6).rotateX(Math.PI / 2), leather);
    f.position.set(x, -0.006, 0.11); f.rotation.x = 0.35;
    g.add(f);
    // the knuckle lights: one charge each, on the index, middle and ring fingers (GLOVE.knuckles)
    if (i > 0) g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(0.0075, 0.005, 0.0105), light).translateX(x).translateY(0.024).translateZ(0.082));
  }
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 3, 6).rotateX(Math.PI / 2), leather);
  thumb.position.set(0.066, -0.01, 0.045); thumb.rotation.y = -0.5;
  g.add(thumb);
  // the cuff a little way up the wrist, flaring to its open end, the band round it
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.07, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, -0.07), inkMat(LEATHER, { side: THREE.DoubleSide })));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.007, 5, 18).translate(0, 0, -0.1), band));
  // the oval plate on the back of the hand (lit in the mode's tone), the fitting on the cuff and its vial
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8).scale(0.03, 0.009, 0.042), light).translateY(0.022).translateZ(0.02));
  for (const z of [-0.06, -0.033]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 10).rotateX(Math.PI / 2).translate(0, 0.05, z), fitting));
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.018, 3, 8).rotateX(Math.PI / 2).translate(0, 0.05, -0.0465), light));
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
  text: ITEMS.gun?.text ?? 'The makers’ glove that shoots the backpack’s fluid: aim with {key:aim}, shoot with {key:fire}.',
  model: () => gunModel(),
  create(ctx) { return new Gun(ctx); },
};
