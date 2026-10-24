// Kamal's race body uses the same named NPC construction as his roadside self.
// The sled owns movement; no NPC walking, talking or interaction updater runs here.
import * as THREE from 'three';
import { NPC } from '../npc.js';
import { HOSTS } from '../story/hosts-data.js';
import { MakeHumanPeople } from '../makehuman/people.js';

export function buildKamalRider(ctx) {
  const def = HOSTS.canyon, kind = def.body ?? def.kind ?? 'm';
  let human = ctx.people?.humans?.[kind === 'm' ? 0 : 1] ?? null;
  // The standalone race borrows Arena's world. Reuse its loaded body data, but
  // ask for Kamal's Desert proportions just as the roadside NPC does.
  const people = human?.userData?.mhPeople;
  if (people && people.world !== 'desert') human = new MakeHumanPeople(people.data, 'desert').template(kind);
  const npc = new NPC(ctx.scene, ctx.physics, {
    route: [new THREE.Vector3()], palette: def.palette, lines: def.lines,
    human,
    lib: null, kind, def, world: 'desert', head: def.head, cape: def.cape,
    scale: def.scale, speed: 0,
  });
  npc.object.name = 'Kamal-rival-rider';
  npc.char.pack.visible = false;
  npc.balloon.remove();
  ctx.add(npc.object);
  let disposed = false;
  const target = new THREE.Vector3(), pelvis = new THREE.Vector3(), rootWorld = new THREE.Vector3();
  const seatQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
  return {
    npc, char: npc.char, root: npc.object,
    update(seat, dt, pose) {
      if (disposed) return;
      seat.updateWorldMatrix(true, false);
      seat.getWorldPosition(target);
      npc.object.position.copy(npc.object.parent ? npc.object.parent.worldToLocal(target.clone()) : target);
      seat.getWorldQuaternion(seatQ);
      npc.object.quaternion.copy(npc.object.parent
        ? npc.object.parent.getWorldQuaternion(parentQ).invert().multiply(seatQ) : seatQ);
      pose(this);
      const h = npc.humanoid;
      h?.update();
      if (h?.b.pelvis) {
        // The sled anchor was authored for the unscaled procedural feet origin.
        // Its pelvis is .99m above that origin. Keep its lean/bob, but seat the
        // actual skin pelvis there without changing Kamal's roadside proportions.
        npc.char.body.updateMatrix();
        target.set(0, .99, 0).applyMatrix4(npc.char.body.matrix).applyMatrix4(seat.matrixWorld);
        h.b.pelvis.getWorldPosition(pelvis);
        npc.object.getWorldPosition(rootWorld).add(target).sub(pelvis);
        npc.object.position.copy(npc.object.parent ? npc.object.parent.worldToLocal(rootWorld) : rootWorld);
        npc.object.updateWorldMatrix(true, true);
        h.update();
      }
      h?.resetFeet();
      npc.humanoid?.updateEyes?.(dt, null);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      npc.dispose(ctx.scene); // unregister the LOD and remove any NPC-only surfaces
      npc.object.removeFromParent(); // also release an owned rider under a transformed parent
      // Humanoid clones its skeleton and owns its recoloured body materials.
      // Leave shared costume/material caches and template geometry to their owners;
      // the runner's clearAdded releases this run's mesh buffers afterwards.
      const skeletons = new Set(), materials = new Set();
      npc.object.traverse(o => {
        if (o.isSkinnedMesh) skeletons.add(o.skeleton);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m?.userData?.own) materials.add(m);
        }
      });
      for (const s of skeletons) s.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
