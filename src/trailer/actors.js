import * as THREE from 'three';
import { NPC } from '../npc.js';
import { Taxi } from '../taxi.js';
import { Trail } from '../trail.js';
import { buildCharacter, Player } from '../player.js';
import { createTravellerV1 } from '../characters/traveller-v1.js';
import { Animator } from '../animator.js';
import { Hoverbike } from '../bike.js';
import { mulberry32 } from '../noise.js';
import { Flock } from '../life.js';

// Staged routes use the game's models and animation clips, without starting quests or AI.
import { actorPosition } from './timeline.js';

export function createActors(scene, level, shots, human, lib, outfit, bird) {
  const casts = new Map();
  for (const shot of shots) {
    const cast = (shot.actors ?? []).map((cue, i) => {
      let object, person, taxi, flock, mount, trails, climber;
      if (cue.kind === 'hero') {
        const char = buildCharacter();
        const character = createTravellerV1(char, outfit), humanoid = character.humanoid;
        const animator = new Animator(lib, char); animator.bindBody(humanoid);
        object = char.root; scene.add(object);
        person = { object, animator, humanoid, character };
        if (cue.mount === 'bike') {
          mount = new Hoverbike({ groundAt: (x, y, z) => level.ground.heightAt(x, z) });
          scene.add(mount.object); mount.object.visible = false;
          trails = [0, 2.5].map(offset => new Trail(scene, { offset, radius: 0.3, life: 1.6, ground: (x, y, z) => level.ground.heightAt(x, z) }));
        (level.noShadow ??= []).push(...trails.map(t => t.mesh));
        } else if (cue.mount === 'bird') mount = bird;
        if (cue.clip === 'climbUp') climber = { humanoid, physics: level.physics, pos: object.position, frame: { up: new THREE.Vector3(0, 1, 0) }, wallN: new THREE.Vector3(-Math.sin(cue.heading), 0, -Math.cos(cue.heading)), _climbF: 1 };
      } else if (cue.kind === 'person') {
        person = new NPC(scene, { groundAt: (x, y, z) => level.ground.heightAt(x, z) }, {
          route: [new THREE.Vector3(...cue.from), new THREE.Vector3(...cue.to)],
          lines: [], human, lib, world: level.id, scale: 1, cape: false,
          def: { id: `trailer-${shot.name}-${i}`, kind: 'm', look: { cape: false } },
        });
        // The trailer has no dialogue or cloth simulation; retain the game's dressed body and headwear.
        person.balloon.remove(); if (person.cape) person.cape.mesh.visible = false;
        object = person.object;
      } else if (cue.kind === 'taxi') {
        taxi = new Taxi(null, cue.color ?? '#e9b45f', cue.scale ?? 2, () => {});
        object = taxi.object; scene.add(object);
      } else {
        const group = new THREE.Group(); scene.add(group);
        flock = new Flock(group, { count: cue.count ?? 7, size: cue.size ?? 1.3, height: [0, 0], radius: 0, speed: 0, seed: 8 });
        const random = mulberry32(8 + i);
        for (const b of flock.birds) { b.off.set((random() - 0.5) * 14, (random() - 0.5) * 4, (random() - 0.5) * 10); b.rate = 7 + random() * 4; b.glide = random() * 10; }
        object = group;
      }
      object.visible = false;
      return { cue, object, person, taxi, flock, mount, trails, climber };
    });
    casts.set(shot, cast);
  }
  return {
    inspect() {
      const result = [];
      for (const cast of casts.values()) for (const a of cast) if (a.object.visible) {
        const row = { kind: a.cue.kind, mount: a.cue.mount };
        if (a.contacts) row.wallGaps = ['r', 'l'].map(s => { const n = a.climber.wallN, p = a.person.humanoid.b[`hand_${s}`].getWorldPosition(new THREE.Vector3()); const hit = level.physics.rayHit(p.addScaledVector(n, 0.5), n.clone().negate(), 1.5); return hit ? hit.distance - 0.5 : null; });
        if (a.contacts) row.handErrors = ['r', 'l'].map((s, i) => a.person.humanoid.b[`hand_${s}`].getWorldPosition(new THREE.Vector3()).distanceTo(a.contacts.hands[i]));
        if (a.trails) row.trails = a.trails.map(t => ({ visible: t.mesh.visible, samples: t.samples.length }));
        result.push(row);
      }
      return result;
    },
    update(frame, dt = 0) {
      for (const [shot, cast] of casts) for (const a of cast) {
        a.object.visible = shot === frame.shot;
        if (a.cue.mount === 'bike') a.mount.object.visible = a.object.visible;
        if (a.trails) a.trails.forEach(t => { t.mesh.visible = a.object.visible; });
        if (!a.object.visible) continue;
        const { cue, object, person, taxi, flock, mount, trails, climber } = a;
        const pos = actorPosition(cue, frame.progress), heading = Math.atan2(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]);
        const travel = shot.duration * ((cue.end ?? 1) - (cue.start ?? 0));
        const speed = Math.hypot(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]) / travel;
        if (person) {
          object.position.fromArray(pos); object.rotation.y = cue.heading ?? heading;
          if (cue.groundRelative) object.position.y += level.ground.heightAt(pos[0], pos[2]);
          if (cue.mount === 'bike') {
            mount.object.position.copy(object.position);
            mount.object.position.y += Math.sin(frame.local * 5) * 0.06;
            mount.object.rotation.y = heading; mount.time = frame.local; mount.speed = speed;
            mount.animate?.(0, mount); mount.object.updateMatrixWorld(true);
            trails.forEach((trail, i) => {
              const jet = mount.body.localToWorld(mount.jets[i].clone());
              const nozzle = jet.clone().sub(mount.object.position);
              trail.time = frame.local; trail.dist = frame.local * speed; trail.samples = [];
              // Reconstruct the preceding path so review seeks have the same trail as playback.
              for (let t = frame.local - trail.life; t < frame.local; t += 1 / 20) {
                const p = new THREE.Vector3(...cue.from).lerp(new THREE.Vector3(...cue.to), t / travel);
                if (cue.groundRelative) p.y += level.ground.heightAt(p.x, p.z);
                p.y += Math.sin(t * 5) * 0.06; p.add(nozzle);
                trail.samples.push({ p, t, d: t * speed, g: trail.groundPlane(p) });
              }
              trail.update(0, jet);
            });
          }
          if (mount) { mount.object.updateMatrixWorld(true); mount.seatTransform(object.position, object.quaternion); }
          const animator = person.animator, clip = cue.clip ?? (mount ? 'drive' : speed > 2.6 ? 'jog' : speed > 0.01 ? 'walk' : 'idle');
          for (const [key, action] of Object.entries(animator.actions)) action.setEffectiveWeight(key === clip ? 1 : 0);
          animator.actions[clip].time = (frame.local * (animator.lib.native[clip] ? speed / animator.lib.native[clip] : 1)) % animator.clips[clip].duration;
          animator.mixer.update(0); animator.src.updateMatrixWorld(true);
          animator.apply(object);
          for (const key of Object.keys(animator.w)) animator.w[key] = key === clip ? 1 : 0;
          const wrists = person.character?.poseArms({ animator, onGround: !mount && !climber });
          person.humanoid.update(); person.humanoid.poseHands(animator);
          person.character?.poseWrists(wrists ?? []);
          if (person.character) {
            // the fingers by what he does (src/hands.js), the same at any seek: a grip on the handlebars, open running, relaxed
            person.humanoid.hands?.set(mount ? 'grip' : clip === 'jog' ? 'open' : 'relaxed');
            person.character.updateHands(); object.updateMatrixWorld(true);
            if (climber) {
              if (!dt || frame.local < a.lastLocal) climber._wallHolds = undefined;
              a.contacts = Player.prototype.climbContacts.call(climber, dt || 1 / 30);
              person.humanoid.resetFeet(); person.humanoid.reach(a.contacts);
            }
            if (!dt || a.lastShot !== shot || frame.local < a.lastLocal) person.character.cloth.update(0, 'rest', true);
            person.character.updateCloth(dt); a.lastShot = shot; a.lastLocal = frame.local;
          }
        } else if (taxi) {
          taxi.pos.fromArray(pos); taxi.heading = heading;
          taxi.pitch = -Math.atan2(cue.to[1] - cue.from[1], Math.hypot(cue.to[0] - cue.from[0], cue.to[2] - cue.from[2]));
          taxi.time = frame.local;
          taxi.pos.y += Math.sin(frame.local * 2) * 0.12;
          taxi.update(0, null, frame.local);
        } else {
          // Pose the wings from the film clock, so seek/replay produces the same crossing.
          for (const b of flock.birds) b.flap = frame.local * b.rate;
          flock.phase = -heading; flock.update(0, frame.local, new THREE.Vector3(...pos));
        }
      }
    },
  };
}
