import * as THREE from 'three';
import { buildCharacter } from './player.js';
import { Cape, groundField } from './cape.js';
import { Animator } from './animator.js';
import { Humanoid } from './humanoid.js';
import { makeMaterial, sharedUniforms, MODE_OUTFIT, MODE_EYE } from './materials.js';
import { registerTarget } from './targets.js';
import { mulberry32 } from './noise.js';
import { namedLook, costumeWorld, TRIM_IDS, BUILDS, browColour } from './costumes.js';
import { formatText } from './story/dialogue.js';
import { speakBalloon } from './story/voice.js';
import { toneOf } from './story/tone.js';
import { talkFaces, mouthAt } from './talk-face.js';
import { cleanExpression, PEOPLE_REST } from './expression.js';
import { Knockdown, toppleVelocities, KNOCKOVER } from './ragdoll.js';
export { KNOCKOVER };
import { holdAim } from './crowd.js';
import { Locomotion, gaitFeet, gaitStyle, poseStyle, walkFor } from './locomotion.js';
import { SkinnedLod, skinnedLods } from './skinned-lod.js';

// People of the world: they walk a looping route, pause and look around,
// turn and wave when you come close, then say a line in a comic speech
// balloon. Shy ones back away if you run at them. Their cloaks are the same
// cloth simulation as yours, updated only when they are near the camera.
//
// Pooled NPCs (pooled: true) are the near tier of the city crowds (crowd.js):
// no mind of their own. assign(person) restyles one to match a crowd person,
// and it then mirrors that person's simulated place, pose and reactions until
// release().
//
// The player's fluid tool: hit(mode). A glob splashes and startles them (a
// jump, a turn to the shooter, a short line); the push shoves them back a
// couple of metres, stumbling with their arms flung up, and a close, hard one
// knocks them right over (a ragdoll, src/ragdoll.js): they lie a moment, get
// up and glare at you.
//
// What they wear comes from their world (costumes.js): a named person keeps the
// colours the story gives them, dressed in the world's style; a crowd body is
// dressed exactly like the crowd figure it stands in for.
//
// Story people (src/story/): `follow` walks them toward a moving target
// (the head of a procession, the player), `seat` sits them on a cushion at
// that height, and while `talkTo` is set they stop, turn to the player and
// gesture as they speak. `def` is their conversation data.

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _push = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
export const SPLASHED = ['~angry~ Hey! I\u2019m soaked!', '~surprised~ Ugh, it\u2019s all colours!', '~angry~ Who threw that?', '~curious~ Was that you?', '~angry~ Hey, not funny!'];
export const SHOVED = ['~surprised~ Whoa! Watch it!', '~angry~ Oof! Hey!', '~angry~ Mind where you push!', '~scared~ Easy, traveller!'];
export const SINGED = ['~shout~ Hot! Hot!', '~surprised~ Yow! That’s warm!', '~surprised~ My cloak! …oh. It doesn’t burn?', '~angry~ Sparks! Who’s throwing sparks?'];
const STUN_FOR = 3.5;   // seconds a stilling glob holds them (fluid-kit.js STUN_SECONDS)
// How much animation a person gets by their distance from the camera: up close every frame, the
// feet planted on the ground (feet.js) and the body's lean and turn (locomotion.js); further off
// the pose every 2nd, then 3rd frame (they still move every frame), no foot planting; past 110 m
// the whole update a quarter of the time (and the body draws a simpler mesh: skinned-lod.js).
export const NPC_DETAIL = { feet: 22, every2: 30, every3: 60, quarter: 110 };
let knockedDown = 0;   // bodies down at once (KNOCKOVER.most)

const _face = new THREE.Vector3();
/** Where the player's eyes are (the traveller's head, or about there), for people to look at. */
function faceOf(player) {
  const head = player.humanoid?.b?.Head;
  if (head) return head.getWorldPosition(_face).addScaledVector(player.frame?.up ?? Y, 0.09);
  return _face.copy(player.pos).addScaledVector(player.frame?.up ?? Y, 1.6);
}

export class NPC {
  /**
   * @param o.route   [Vector3] waypoints (on the ground)
   * @param o.palette colours for buildCharacter
   * @param o.lines   things they say
   * @param o.pooled  a crowd's near-tier body (hidden until assign())
   * @param o.head / o.cape / o.look  the story's headwear, cape length and costume overrides (costumes.js dressFor)
   * @param o.world   the world they are dressed for (default: the current level's)
   * @param o.face / o.expression  their own face (morph.js FACE_MORPHS) and the expression they wear at rest (expression.js)
   * @param o.facing  stand on the spot turned this way (rad) instead of walking the route
   */
  constructor(scene, physics, { route, palette = {}, lines, speed = 1.25, shy = false, scale = null, lib = null, human = null, kind = 'm', pooled = false, follow = null, seat = null, head = null, cape = null, def = null, look = null, world = null, face = null, expression = null, facing = null }) {
    this.physics = physics;
    this.follow = follow;   // () => { pos, speed, near } | null: walk there instead of the route
    this.seat = seat;       // sit on something this high (m) instead of walking
    this.def = def;
    this.talkTo = null;     // set by the conversation: face the player, stay put
    this.scene = scene;
    this.kind = kind;
    this.pooled = pooled;
    this.person = null;
    this.stumbleUntil = -1;
    this.stunUntil = -1;
    this.knock = new THREE.Vector3();   // a shove's velocity (m/s), dying away
    this.startleAt = -1e9;
    this.shout = null;
    this.route = route;
    this.lines = lines;
    this.speed = speed * (0.85 + Math.random() * 0.3);
    this.shy = shy;
    // their costume: seeded by who they are, so they look the same every visit
    const at = route[0];
    const dress = pooled ? null : namedLook({ world: world ?? costumeWorld(), id: def?.id ?? `${kind}:${Math.round(at.x)},${Math.round(at.z)}`,
      // a story person's hair and beard follow their kind only when the story says it (def.kind)
      palette, head, cape, look: look ?? def?.look ?? {}, pos: at, kind: def ? def.body ?? def.kind ?? null : kind });
    this.char = buildCharacter(dress ? { ...palette, cloak: dress.cloak, cloth: dress.cloth, legs: dress.legs } : palette);
    this.char.pack.visible = !pooled && (def?.satchel ?? (!dress?.robe && Math.random() < 0.5));   // (a story person's own: def.satchel)
    this.object = this.char.root;
    // their height: the look's (seeded), unless the story sets their size (children, elders: def.scale)
    this.object.scale.setScalar((scale ?? (dress?.height ?? 1)) * (dress?.size ?? 1));
    this.object.userData.noCollide = true;
    scene.add(this.object);
    // (?mh=1: a MakeHuman body by who they are, src/makehuman/people.js)
    // (a child or a teenager as tall as MakeHuman makes their age beside the grown-ups: profile.trueScale)
    if (human?.userData?.mhPeople) {
      human = human.userData.mhPeople.templateFor({ kind, def, dress, pooled });
      const P = human.userData.profile;
      if (P.trueScale) this.object.scale.setScalar(P.trueScale * (dress?.size ?? 1));
      else this.object.scale.multiplyScalar(P.heightFix ?? 1);
    }
    this.baseScale = this.object.scale.x;   // (their size as made: the studio shows them at it)
    this.humanoid = human ? new Humanoid(human, this.char, kind, { skin: dress?.skin ?? '#e8c6a8', build: dress?.build }) : null;
    this.cape = null;
    // a face and a resting expression of their own (the story's, a spawn spot's) win over their look's (restyle)
    this.ownFace = face ?? def?.face ?? null;
    this.ownRest = expression ?? def?.rest ?? null;
    if (dress) this.restyle(dress);
    // a story person's own body and face (morph.js: def.morph, def.face; a child's proportions, home's Lou),
    // or the face and resting expression a spawn spot gives (the Lab's giants), and the expression worn at rest
    if (this.humanoid && def?.morph) { this.humanoid.ownMorph = def.morph; this.humanoid.setMorph(def.morph); }
    const ownFace = this.ownFace;
    if (this.humanoid && ownFace) { this.humanoid.ownFace = ownFace; this.humanoid.setFace(ownFace); }
    const rest = this.ownRest;
    if (this.humanoid && rest) { this.humanoid.restExpression = cleanExpression(rest); this.humanoid.setExpression(this.humanoid.restExpression); }
    this.facing = facing;   // (stands facing this way, rad, until someone comes near: the Lab's giants)
    if (!dress) this.char.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.parent === this.char.capeAnchor) o.visible = false; });
    this.animator = lib ? new Animator(lib, this.char) : null;
    // their own way of walking (locomotion.js gaitStyle), seeded by who they are; the loops start
    // at their own point, so people side by side neither breathe nor step in time
    this.gait = this.styleGait(dress?.build ?? 'average', this.object.scale.x, `${def?.id ?? ''}:${at.x.toFixed(1)},${at.z.toFixed(1)}`);
    if (this.animator) { this.animator.bindBody(this.humanoid); this.animator.offsetLoops(this.gait.phase); }
    this.speed *= this.gait.pace;
    this.loco = new Locomotion({ walk: 1.4, style: { lean: 0.6, bank: 0.8 } });
    if (this.humanoid) this.humanoid.lod = skinnedLods.add(new SkinnedLod(this.humanoid));
    this.pos = route[0].clone();
    this.heading = facing ?? 0;
    this.wp = 1 % route.length;
    this.pause = Math.random() * 3;
    this.phase = Math.random();
    this.time = Math.random() * 10;
    this.vel = new THREE.Vector3();
    this.greeted = 0;
    this.lineIdx = Math.floor(Math.random() * lines.length);

    this.balloon = document.createElement('div');
    this.balloon.className = 'balloon';
    document.body.appendChild(this.balloon);
    if (pooled) this.hide();
  }

  /** Their gait style (locomotion.js) from their build, size and a seed string. */
  styleGait(build, size, seed) {
    this._build = build;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return gaitStyle(mulberry32(h >>> 0), { build, kind: this.kind, size });
  }

  /**
   * A captured walk of their own (locomotion.js walkFor: one of lib.motion.walks, CMU subjects'
   * walking cycles), seeded like the rest of their gait; picked again whenever they become someone
   * else (a crowd person: assign()).
   */
  ownWalk() {
    const G = this.gait, A = this.animator;
    this._walkFor = G;
    const rand = mulberry32((Math.floor(G.phase * 4294967296) ^ 0x9e3779b9) >>> 0);
    A.useWalk(walkFor(A.lib.motion.walks, rand, { kind: this.kind, build: this._build, size: this.object.scale.y * A.legRatio, speed: this.speed, older: G.stoop > 0.05 }));
  }

  /** Shown bodies are in the scene; hidden ones leave it, so their hundred bones skip every pass's matrix update. */
  show(on) {
    this.object.visible = on;
    if (on && !this.object.parent) this.scene.add(this.object);
    else if (!on && this.object.parent) this.object.removeFromParent();
  }

  hide() {
    this.show(false);
    if (this.cape) this.cape.mesh.visible = false;
    this.talking = false;
    this.balloon.classList.remove('show');
  }

  /** Become a crowd person: their clothes, size and place (pooled NPCs only). */
  assign(person, crowd) {
    this.person = person;
    this.crowd = crowd;
    this.restyle(person.style);
    this.object.scale.setScalar(person.size);
    this.pos.copy(person.pos);
    this.heading = person.heading;
    this.lines = [person.lines[person.lineIdx % person.lines.length]];
    this.lineIdx = 0;
    this._frozen = false;
    this.endDown();
    this.gait = this.styleGait(person.style?.build ?? 'average', person.size, `crowd:${person.id ?? person.seed}`);
    if (this.animator) this.animator.offsetLoops(person.phase);
    this.humanoid?.resetFeet();
    this.loco.reset(person.heading);
    if (this.cape) this.cape.ready = false;   // the cloth drops into place at the new spot
  }

  release() {
    if (this.humanoid) talkFaces.release(this.humanoid);   // (the body goes to someone else: their own face)
    if (this.down && this.person) this.crowd?.holdShove?.(this.person, this.pos, false, this.heading);
    this.endDown();
    this.person = null;
    this.hide();
  }

  /**
   * Dress in a look (costumes.js): tunic / trousers / skin and the printed pattern on the body,
   * the costume pieces (headwear, mask, shoulder piece, prop, robe) and a cape of the right
   * colour, length and width. A crowd body takes its person's look, so it matches the crowd figure.
   */
  restyle(s) {
    if (this._style === s) return;
    this._style = s;
    this.look = s;
    const h = this.humanoid, c = this.char;
    Object.assign(c.colors, { cloak: s.cloak, cloth: s.cloth, legs: s.legs });
    if (h) {
      // own copies of the body and brow materials, so recolouring touches only this body
      if (!this._mats) {
        this._mats = new Map();
        const ink = new THREE.Color(c.colors.ink).getHex();
        h.model.traverse((o) => {
          if (!o.isSkinnedMesh || !o.material?.uniforms || h._costume?.includes(o)) return;   // body, eyes, brows (not the costume)
          if (!this._mats.has(o.material)) {
            const m = o.material.userData.own ? o.material : o.material.clone();
            Object.assign(m.uniforms, sharedUniforms);
            m.userData.own = true;   // (Humanoid.ownMaterials: already this body's own)
            const mode = m.uniforms.uMode.value;
            m.userData.role = mode === MODE_OUTFIT ? 'body' : mode === MODE_EYE || m.uniforms.uColor.value.getHex() === ink ? 'eyes' : 'brows';
            m.userData.wrist = m.uniforms.uOutfit.value.w;
            this._mats.set(o.material, m);
          }
          o.material = this._mats.get(o.material);
        });
      }
      const trim = Math.max(0, TRIM_IDS.indexOf(s.trim ?? 'none'));
      for (const m of this._mats.values()) {
        const u = m.uniforms;
        if (m.userData.role === 'body') {
          u.uColor.value.set(s.cloth); u.uColor2.value.set(s.legs); u.uSkin.value.set(s.skin); u.uGlove.value.w = 0;   // bare hands, like the crowd figures
          const t = new THREE.Color(s.accent ?? s.cloak);
          u.uTrim.value.set(t.r, t.g, t.b, trim);
          u.uSuit.value = (s.bulk ?? 0) >= 2 ? 1 : 0;                       // the dome people's padded suits
          u.uOutfit.value.w = s.sleeveless ? 0.2 : m.userData.wrist;      // bare arms in the garden
        } else if (m.userData.role === 'brows') u.uColor.value.set(this.def?.brows ?? browColour(s.hair, s.skin));   // (the hair's, softened; def.brows: a child's own)
        else if (m.userData.role === 'eyes' && s.eyes) { u.uColor2.value.set(s.eyes); u.uSkin.value.set(s.skin); }   // their own iris; the lids in their skin
      }
      h.setBuild(s.build, this.pooled ? h.profile?.yearsOf?.(s) : undefined);   // a crowd body takes its person's build (and a MakeHuman one their age: an elder's body)
      // their look's face (costumes.js faceFor: their people's shapes, their own ink) and the mood it rests in,
      // unless the story gives them their own
      if (!this.ownFace && h.ownFace !== (s.face ?? null)) { h.ownFace = s.face ?? null; h.setFace(h.ownFace); }
      if (!this.ownRest) { h.restExpression = cleanExpression(s.rest ?? PEOPLE_REST); h.setExpression(h.restExpression); }
      h.dress(s);
    }
    // the cape: the same colour, length and width as the crowd figure
    this.cape?.dispose(this.scene);
    const wide = s.capeWide ?? 1;
    this.cape = s.capeLen > 0
      ? new Cape(this.scene, c.capeAnchor ?? c.torso, { color: s.cloak, cols: 10, rows: s.capeLen > 1 ? 8 : 6, length: s.capeLen, bottom: (0.25 + s.capeLen * 0.17) * wide * (BUILDS[s.build]?.width ?? 1) })
      : null;
    if (this.cape && this.pooled) this.cape.mesh.visible = false;
    // the cape's rolled collar in the cape's own colour
    c.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry' && o.parent === c.capeAnchor) { o.visible = !!this.cape; o.material = makeMaterial({ color: s.cloak, figure: true }); } });
  }

  /** Stilled by a 'stun' glob: frozen mid-move for a few seconds (nobody can talk to them meanwhile). */
  stunned() { return this.time < this.stunUntil; }

  /**
   * The fluid tool: 'shoot' startles (a jump, a turn to the shooter, a short
   * line), 'push' shoves them back, stumbling, 'stun' freezes them for a few
   * seconds, 'fire' makes them jump and yelp (it never burns).
   */
  hit(mode, dir, info) {
    // a crowd member standing in for someone: the crowd keeps their state
    if (this.pooled && this.person && this.crowd?.hit) return this.crowd.hit(this.person, mode, dir, info);
    if (this.time < this.stumbleUntil || this.down) return;
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (mode === 'stun') {
      this.stunUntil = this.stumbleUntil = this.time + STUN_FOR; this._frozen = false;
      this.knock.set(0, 0, 0); this.shout = null;
      return;
    }
    if (dir) this.faceTo = Math.atan2(-dir.x, -dir.z);
    if (mode === 'fire') {
      this.startleAt = this.time;
      this.shout = { text: pick(SINGED), until: this.time + 2.4 };
      return;
    }
    if (mode === 'push' && dir && (info?.strength ?? 1) >= KNOCKOVER.strength && this.knockDown(dir, info)) {
      this.shout = { text: pick(SHOVED), until: this.time + 3.5 };
      return;
    }
    if (mode === 'push') {
      this.stumbleUntil = this.time + 0.9; this._frozen = false;
      if (dir) this.knock.set(dir.x, 0, dir.z).normalize().multiplyScalar(4 * (info?.shove ?? 2.4) * (0.6 + 0.4 * (info?.strength ?? 1)));   // dies away at 4/s: ~shove metres
      this.startleAt = this.time + 0.1;   // no hop after the stumble: they just stand and glare (until ~2.5 s)
      this.shout = { text: pick(SHOVED), until: this.time + 3 };
      return;
    }
    this.startleAt = this.time;
    this.shout = { text: pick(SPLASHED), until: this.time + 2.2 };
  }

  /**
   * Knocked over by a push along dir: the body goes limp and tumbles back
   * (src/ragdoll.js), lies a moment and gets up. Not seated or talking people,
   * nor anyone without a body; at most KNOCKOVER.most at once. Returns true if it happened.
   */
  knockDown(dir, info) {
    if (!this.humanoid || this.down || this.seat || this.talkTo || !this.object.visible || knockedDown >= KNOCKOVER.most) return false;
    const d = _d.set(dir.x, 0, dir.z);
    if (d.lengthSq() < 1e-6) return false;
    d.normalize();
    const k = (info?.strength ?? 1), s = this.object.scale.y;
    this.down = new Knockdown(this.humanoid).start(toppleVelocities(d, Y, { carry: (2.2 + 2.2 * k) * Math.sqrt(s), rise: 1.6 + k, tip: 3 + 2 * k }));
    knockedDown++;
    this.faceTo = Math.atan2(-dir.x, -dir.z);
    this.greeted = 0; this.knock.set(0, 0, 0); this._frozen = false;
    return true;
  }

  /** Back on their feet (or the knockdown cut short): the ragdoll's place is theirs. */
  endDown() {
    if (!this.down) return;
    this.down = null;
    knockedDown = Math.max(0, knockedDown - 1);
    this.humanoid?.resetFeet();
  }

  /**
   * A frame knocked down: the ragdoll falls and lies, then the get-up (the
   * idle pose, down on one knee at first, blended in from lying there).
   * Returns true while still down.
   */
  updateDown(dt, player) {
    const D = this.down, H = this.humanoid;
    if (D.phase !== 'rise') {
      const up = D.update(dt, this.physics, Y);
      D.rag.groundSpot(this.physics, Y, this.pos);
      if (!up) return true;
      const f = D.rag.riseDir(Y, _w);
      this.heading = Math.atan2(f.x, f.z);
      this.physics.pushCapsule(this.pos, 0.4, 0.6, 2.0, _push);
      D.beginRise();
    }
    this.pose(dt, 0, -1, 99, player, null);
    this.object.position.copy(this.pos);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    H.update();
    H.kneel(D.kneel, { up: Y, fwd: _w.set(Math.sin(this.heading), 0, Math.cos(this.heading)), ground: this.pos.y });
    if (D.rise(dt, Y)) {
      this.endDown();
      this.startleAt = this.time - 0.9;   // up again: they stand and glare at you a moment (the startled turn, no hop)
      return false;
    }
    return true;
  }

  /** Where the tool aims: the chest. */
  chest(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + 1.15 * this.object.scale.y, this.pos.z);
  }

  update(dt, player, camera) {
    if (this.pooled) {
      if (!this.person) { if (this.object.visible) this.hide(); return; }
      this.updatePuppet(dt, player, camera, this.person);
      return;
    }
    // far away: hidden past 260 m, updated at a quarter rate past 110 m
    const camD0 = camera.position.distanceTo(this.pos);
    this.show(camD0 < 260);
    if (this.cape) this.cape.mesh.visible = camD0 < 220;
    if (camD0 > 110 && this.follow) {
      // far away a follower simply keeps up (no walking simulation)
      const f = this.follow();
      if (f?.pos) { _w.subVectors(f.pos, this.pos); _w.y = 0; if (_w.lengthSq() > 0.25) this.heading = Math.atan2(_w.x, _w.z); this.pos.copy(f.pos); }
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
    }
    if (camD0 > 260) { this.talking = false; return; }
    if (camD0 > 110) { this._skip = ((this._skip ?? 0) + 1) % 4; this._acc = (this._acc ?? 0) + dt; if (this._skip) return; dt = this._acc; this._acc = 0; }
    else this._acc = 0;
    this.time += dt;
    // knocked over: the ragdoll, then getting up
    if (this.down) {
      this.talking = !!this.shout && this.time < this.shout.until;
      this.updateDown(dt, player);
      this.updateCape(dt, player, camera, 0);
      return;
    }
    // shoved: knocked back (not through walls), stumbling with the arms flung up
    if (this.time < this.stumbleUntil) {
      this.greeted = 0;
      this.talking = !!this.shout;
      const sp = this.knock.length();
      if (sp > 0.05) { this.move(_w.copy(this.knock).divideScalar(sp), sp, dt); this.knock.multiplyScalar(Math.exp(-4 * dt)); }
      const g = this.physics.groundAt(this.pos.x, this.pos.y + 1.5, this.pos.z);
      if (Number.isFinite(g)) this.pos.y += (g - this.pos.y) * (1 - Math.exp(-15 * dt));
      this.posture(dt, { stumble: true, still: this.time < this.stunUntil });
      if (camD0 < 160) this.humanoid?.update();
      return;
    }
    this._frozen = false;
    const toPlayer = _v.subVectors(player.pos, this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    // the way to you: held while you stand inside them (walking into someone, or talking nose to
    // nose, an atan2 of a few cm turned them back and forth every frame)
    const toYou = holdAim(this, '_toYou', toPlayer, dist);
    const mover = player.ride ?? player;
    const playerSpeed = Math.hypot(mover.vel.x, mover.vel.z);
    const greetR = (player.riding ? 18 : 9) * Math.max(1, this.object.scale.x * 0.6);   // (giants notice you from further off)
    let speed = 0, face = null, fol = null;
    const startled = this.time - this.startleAt < 2.4 && this.faceTo !== undefined;

    // a vehicle bearing down on them: jump aside (perpendicular to its path)
    const incoming = player.riding && dist < 9 && playerSpeed > 6 &&
      _w.set(mover.vel.x, 0, mover.vel.z).normalize().dot(_d.copy(toPlayer).normalize().negate()) > 0.6;
    if (this.talkTo) {
      // in conversation: still, turned to the player (seated people only turn their head)
      if (!this.seat) face = toYou;
      this.greeted = 0;
    } else if (incoming && !this.seat) {
      _w.set(-mover.vel.z, 0, mover.vel.x).normalize();
      if (_w.dot(toPlayer) > 0) _w.negate();
      speed = this.speed * 3.2;
      this.move(_w, speed, dt);
      face = Math.atan2(-toPlayer.x, -toPlayer.z) + Math.PI;
      this.greeted = 0;
    } else if (startled) {
      // darted: stand still, turned to the shooter
      face = this.faceTo;
      this.greeted = 0;
    } else if (this.seat) {
      // seated: stays put, turns the head toward you when you're close
      this.greeted = dist < greetR ? (this.greeted || this.time) : 0;
    } else if (this.shy && dist < 7 && playerSpeed > 6) {
      // run away from a charging player
      _w.copy(toPlayer).normalize().negate();
      speed = this.speed * 2.6;
      this.move(_w, speed, dt);
      face = Math.atan2(_w.x, _w.z);
      this.greeted = 0;
    } else if ((fol = this.follow?.()) && fol.pos && Math.hypot(fol.pos.x - this.pos.x, fol.pos.z - this.pos.z) > (fol.near ?? 1.2)) {
      // walk toward a moving target, matching its pace (before greeting: a follower near you
      // used to stop to wave whenever you were within 9 m, so Oum and Ilo trailed 9 m behind
      // and the Speaker dropped out of his procession as you came up)
      this.greeted = 0;
      _w.subVectors(fol.pos, this.pos); _w.y = 0;
      const d = _w.length(), near = fol.near ?? 1.2;
      if (d > 40) { this.pos.copy(fol.pos); }           // fell far behind (a teleport, a long fall): catch up
      else {
        _w.divideScalar(d);
        speed = Math.min((fol.speed ?? this.speed) + (d - near) * 0.6, fol.max ?? 4.5);
        this.move(_w, speed, dt);
        face = Math.atan2(_w.x, _w.z);
      }
    } else if (dist < greetR) {
      // stop, face the player, wave once
      face = toYou;
      if (!this.greeted) { this.greeted = this.time; this.lineIdx = (this.lineIdx + 1) % this.lines.length; }
    } else if (fol) {
      // arrived where they were going: waiting, facing their way
      this.greeted = 0;
      if (fol.face !== undefined) face = fol.face;
    } else if (this.facing !== null) {
      // standing on their spot, turned their way
      this.greeted = 0;
      face = this.facing;
    } else {
      this.greeted = 0;
      if (this.pause > 0) this.pause -= dt;
      else {
        const target = this.route[this.wp];
        _w.subVectors(target, this.pos); _w.y = 0;
        const d = _w.length();
        if (d < 0.6) {
          this.wp = (this.wp + 1) % this.route.length;
          this.pause = 1.5 + Math.random() * 4;
        } else {
          _w.divideScalar(d);
          speed = this.speed;
          this.move(_w, speed, dt);
          face = Math.atan2(_w.x, _w.z);
        }
      }
    }
    if (face !== null) {
      let dh = face - this.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      // standing, a person turns no faster than their feet can step round (feet.js); walking, at the pace of the path
      const turn = dh * (1 - Math.exp(-5 * dt)), most = (speed < 0.3 && !startled ? 2.6 : 9) * dt;
      this.heading += THREE.MathUtils.clamp(turn, -most, most);
    }
    this._face = face;
    // stay on the ground
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1.5 - (this.seat ?? 0), this.pos.z);
    // (the first frame straight there: a seated person's cape is baked on them as they first sit)
    if (Number.isFinite(g)) { this.pos.y += (g + (this.seat ?? 0) - this.pos.y) * (this._grounded ? 1 - Math.exp(-15 * dt) : 1); this._grounded = true; }

    const waveT = this.talkTo ? -1 : this.greeted && !this.seat ? this.time - this.greeted : -1;
    // the pose: every frame near the camera, every 2nd / 3rd further off (they still move every frame)
    const D = NPC_DETAIL, near = camD0 < D.feet;
    const every = camD0 < D.every2 || this.time - this.startleAt < 1 ? 1 : camD0 < D.every3 ? 2 : 3;
    this._poseDt = (this._poseDt ?? 0) + dt;
    this._poseN = ((this._poseN ?? 0) + 1) % every;
    const posing = this._poseN === 0 || !this._posed;
    if (posing) {
      this._posed = true;
      this.pose(this._poseDt, speed, waveT, dist, player, this.talkTo ? (this.talkTo.speaking ? 'talk' : 'ground') : null, near);
    }
    this.object.position.copy(this.pos);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    if (posing) this.posture(this._poseDt, { startle: this.time - this.startleAt, pose: this.seat ? 4 : 0 });
    if (this.seat) {
      // the hips down on the cushion, a little behind its front edge
      const s = this.object.scale.y;
      this.object.position.x -= Math.sin(this.heading) * 0.12 * s;
      this.object.position.z -= Math.cos(this.heading) * 0.12 * s;
      this.object.position.y += (0.05 - 0.95) * s;
    }
    if (posing && camD0 < 160) {
      this.humanoid?.update();
      // near: the feet on the real ground, held where they land, stepping round as they turn (feet.js)
      this.plant(this._poseDt, speed, near && !this.seat);
    }
    if (posing) this._poseDt = 0;
    // the eyes: on the player's face when they are near (or talking), else looking around
    if (this.humanoid && camD0 < 40) this.humanoid.updateEyes(dt, this.talkTo || dist < 10 * Math.max(1, this.object.scale.x) ? faceOf(player) : null);

    this.updateCape(dt, player, camera, speed);

    // speech balloon: placed by placeBalloon() after the camera has moved this frame
    this.talking = !this.talkTo && !this.hush && this.greeted && this.time - this.greeted > 0.6 && dist < greetR;   // (hush: a scene is on, no balloons)
    if (this.shout && this.time < this.shout.until) this.talking = true;
  }

  /** Plant the feet (feet.js), or let them follow the clip (far off, seated, leaning, flung about). */
  plant(dt, speed, on) {
    const H = this.humanoid;
    if (!H) return;
    if (!on || !this.animator || dt <= 0) { if (H._feet && (H._feet.l.locked || H._feet.r.locked || H._feet.l.step || H._feet.r.step)) H.resetFeet(); return; }
    this.object.updateMatrixWorld(true);
    const o = gaitFeet(this.animator, speed, this._feetO ??= {});
    o.pivot = false;   // (people step round as they turn: the feet keep their way until they step)
    o.scale = this.object.scale.y;
    H.plantFeet(dt, this.physics, Y, this.object.position, _d.set(Math.sin(this.heading), 0, Math.cos(this.heading)), null, o);
  }

  /** The cloak's cloth (speed: how fast they walk, for the airflow). */
  updateCape(dt, player, camera, speed) {
    // cloth: simulated near the camera; further off it hangs at rest on the body (Cape.rest), so
    // nobody's cape is left in the air where it last was, or frozen mid-swing
    const camD = camera.position.distanceTo(this.pos);
    if (this.cape) this.cape.mesh.visible = camD < (this.lowDetail ? 120 : 220);
    // (every frame up close; every 2nd / 3rd frame further off, where a camp full of people
    // spent ~0.7 ms a frame on cloth nobody could see move)
    this._clothDt = (this._clothDt ?? 0) + dt;
    const every = camD < 12 ? 1 : camD < 35 ? 2 : 3;
    this._clothN = ((this._clothN ?? 0) + 1) % every;
    const clothR = (this.lowDetail ? 30 : 70) + (this._clothOn ? 5 : 0);   // (a margin: no flicker at the edge)
    this._clothOn = !!this.cape && camD < clothR;
    if (this._clothOn && (this._clothN === 0 || !this.cape.ready || this.cape.hung)) {
      this.object.updateMatrixWorld(true);
      this.vel.set(Math.sin(this.heading) * speed, 0, Math.cos(this.heading) * speed);
      const s = this.clothState(player, speed);
      if (!this.cape.drape && !this.cape.ready) this.cape.bake({ ...s, capsules: this.clothCapsules(null) }, { key: this.drapeKey(undefined, s.field) });   // (the shared drape: never with the traveller in it)   // starts settled, no drop
      this.cape.update(Math.min(this._clothDt, 1 / 20), s);
      this._clothDt = 0;
    } else if (!this._clothOn) {
      this._clothDt = 0;
      if (this.cape?.mesh.visible && !this.cape.hung) {
        if (!this.cape.drape) {
          // (far off the body may not have been posed this frame)
          if (camD >= 160) this.humanoid?.update();
          this.object.updateMatrixWorld(true);
          const s = this.clothState(player, 0);
          this.cape.bake(s, { key: this.drapeKey(undefined, s.field) });
        }
        this.cape.rest(dt);
      }
    }

  }

  /** The near tier of a crowd: mirror the simulated person (crowd.js does the thinking). */
  updatePuppet(dt, player, camera, p) {
    this.time += dt;
    const now = this.crowd?.time ?? 0;
    this.show(true);
    if (this.down) {
      // knocked over (crowd.hit): this body tumbles; the person's place follows it (a shove held
      // over their spot, so getting up leaves them right there, and they then walk back home)
      const still = this.updateDown(dt, player);
      this.crowd?.holdShove?.(p, this.pos, still, this.heading);
      this.updateCape(dt, player, camera, 0);
      const line = now < (p.shoutUntil ?? -1) ? p.say : p.lines[p.lineIdx % p.lines.length];
      if (this.lines[0] !== line) { this.lines = [line]; this.lineIdx = 0; }
      this.talking = now < (p.shoutUntil ?? -1);
      return;
    }
    this.pos.copy(p.pos);
    this.heading = p.heading;
    _v.subVectors(player.pos, this.pos); _v.y = 0;
    const dist = _v.length();
    const moving = p.speed > 0.05;
    if (now < p.stumbleUntil) this.posture(dt, { stumble: true, still: now < (p.stunUntil ?? -1) });
    else {
      this._frozen = false;
      const waveT = p.greetT >= 0 && p.pose === 0 && !p.group ? now - p.greetT : -1;
      this.pose(dt, p.speed, waveT, 99, player, p.talk > 0.45 && !moving ? 'talk' : null);
      // the crowd decides where they look
      this.char.head.rotateY(p.headYaw * 0.85);
      this.char.head.rotateX(p.headPitch * 0.7);
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      this.posture(dt, { pose: moving ? 1 : p.pose, startle: now - p.startleT, seed: p.seed });
    }
    const jump = this.object.position.y - this.pos.y;
    this.object.position.copy(this.pos);
    this.object.position.y += Math.max(jump, 0);
    this.object.quaternion.setFromAxisAngle(Y, this.heading);
    if (!moving && (p.pose === 3 || p.pose === 4)) {
      // seated: the hips go down onto the seat, a little behind the edge
      const back = (p.pose === 3 ? 0.22 : 0.12) * p.size;
      this.object.position.x -= Math.sin(this.heading) * back;
      this.object.position.z -= Math.cos(this.heading) * back;
      this.object.position.y += ((p.pose === 3 ? 0.03 : 0.05) - 0.95) * p.size;
    }
    this.humanoid?.update();
    // the feet on the ground while they stand or walk (not seated, leaning or stumbling)
    const camD = camera.position.distanceTo(p.pos);
    this.plant(dt, p.speed, camD < NPC_DETAIL.feet && now >= p.stumbleUntil && (moving || p.pose === 0 || p.pose === 1));
    this.humanoid?.updateEyes(dt, dist < 8 ? faceOf(player) : null);
    if (this.cape) this.cape.mesh.visible = true;
    // the cloth is the costly part: every other frame unless right by the camera
    this._clothDt = (this._clothDt ?? 0) + dt;
    this._clothTick = !this._clothTick;
    if (this.cape && (camD < 5 || this._clothTick || !this.cape.ready)) {
      this.object.updateMatrixWorld(true);
      this.vel.set(Math.sin(this.heading) * p.speed, 0, Math.cos(this.heading) * p.speed);
      const seated = !moving && (p.pose === 3 || p.pose === 4);
      const s = { up: Y, vel: this.vel, wind: player.wind, floor: p.pos, field: seated ? this.seatField() : null, capsules: this.clothCapsules(player) };
      // a new person: the cloth starts settled on them (it used to drop from a stiff cone as they came near)
      if (!this.cape.ready && !this.cape.drape) this.cape.bake({ ...s, capsules: this.clothCapsules(null) }, { key: this.drapeKey(moving ? 0 : p.pose, s.field), force: true });   // (shared: rarely baked)
      this.cape.update(Math.min(this._clothDt, 1 / 20), s);
      this._clothDt = 0;
    }
    const line = now < (p.shoutUntil ?? -1) ? p.say : p.lines[p.lineIdx % p.lines.length];
    if (this.lines[0] !== line) { this.lines = [line]; this.lineIdx = 0; }
    this.talking = p.speaking && (dist < 6 || now < (p.shoutUntil ?? -1));
  }

  /**
   * Poses the mocap clips don't have, laid over the rig after the clip:
   * pose 2 lean on a rail, 3 sit on an edge, 4 sit on a kerb, 6 lean on a wall;
   * stumble (shoved: caught mid-flail, arms up) and startle (a jump, for ~0.8 s).
   */
  posture(dt, { pose = 0, stumble = false, still = false, startle = 99, seed = 0.5 } = {}) {
    const c = this.char;
    if (stumble) {
      // hold the clip's last frame with the arms flung up, one knee raised, leaning back
      if (!this._frozen) {
        this._frozen = true;
        c.arms[0].rotation.set(-0.2, 0, -2.4); c.arms[1].rotation.set(0.1, 0, 2.55);
        c.elbows[0].rotation.set(-0.45, 0, 0); c.elbows[1].rotation.set(-0.25, 0, 0);
        c.legs[1].rotation.set(-0.65, 0, 0); c.knees[1].rotation.set(1.05, 0, 0);
        c.body.rotation.set(-0.12, 0, 0.1);
        c.head.rotation.set(-0.22, 0.25, 0);
      }
      if (!still) c.body.rotation.z = 0.1 + 0.08 * Math.sin(this.time * 9);   // wobbling for balance (stilled: not a twitch)
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      return;
    }
    if (pose === 2) {
      c.torso.rotation.x += 0.42;
      for (let i = 0; i < 2; i++) { c.arms[i].rotation.set(-1.0, 0, (i ? 1 : -1) * 0.12); c.elbows[i].rotation.set(-1.05, 0, 0); }
      c.head.rotateX(-0.32);
    } else if (pose === 3 || pose === 4) {
      const kick = pose === 3 ? Math.sin(this.time * 1.6 + seed * 20) * 0.25 : 0;
      const hip = pose === 3 ? 1.5 : 1.8;
      c.body.position.set(0, 0, 0);
      c.body.rotation.set(0, 0, 0);
      for (let i = 0; i < 2; i++) {
        c.legs[i].rotation.set(-hip, 0, 0);
        c.knees[i].rotation.set(hip + (i ? -kick : kick), 0, 0);
        c.feet[i].rotation.set(0, 0, 0);
        c.arms[i].rotation.set(pose === 3 ? -0.25 : -0.65, 0, (i ? 1 : -1) * 0.2);
        c.elbows[i].rotation.set(pose === 3 ? -0.35 : -0.9, 0, 0);
      }
      c.torso.rotation.x += pose === 3 ? 0.12 : 0.22;
    } else if (pose === 6) {
      c.body.rotation.x -= 0.06;
      c.legs[0].rotation.set(-0.32, 0, 0); c.knees[0].rotation.set(0.75, 0, 0);
    }
    if (startle >= 0 && startle < 0.8) {
      const k = Math.sin(Math.PI * Math.min(startle / 0.8, 1));
      this.object.position.y += 0.3 * Math.sin(Math.PI * Math.min(startle / 0.45, 1));
      c.arms[0].rotation.z -= 1.5 * k; c.arms[1].rotation.z += 1.5 * k;
      c.head.rotateX(-0.25 * k);
    }
  }

  /** Put the balloon over the head (call after the camera update; only for the one that talks). */
  /** @param lift extra pixels up (the E prompt hangs over this person's head) */
  placeBalloon(camera, show, lift = 0) {
    if (!show || !this.talking) { this.balloon.classList.remove('show'); this._voiced = null; return; }
    const head = this.humanoid?.b?.Head;
    if (head) head.getWorldPosition(_w).add(_v.set(0, 0.62, 0));
    else _w.copy(this.pos).add(_v.set(0, 2.3, 0));
    _w.project(camera);
    const on = _w.z < 1 && Math.abs(_w.x) < 1.1 && Math.abs(_w.y) < 1.1;
    if (on) {
      const line = this.shout && this.time < this.shout.until ? this.shout.text : this.lines[this.lineIdx];
      // (the same words as the dialogue panel: *highlighted* places and hints, the {glyph})
      if (this._balloonLine !== line) { this._balloonLine = line; this.balloon.innerHTML = formatText(line); this._lineAt = this.time; this._said = null; }
      // the mumble: once each time a line comes up (quieter further off, panned to where they stand)
      // (no room yet, someone else has the floor: try again next frame, while the balloon is up)
      if (line !== this._voiced) {
        const plan = speakBalloon(line, { person: this.voicePerson(), dist: camera.position.distanceTo(this.pos), pan: THREE.MathUtils.clamp(_w.x * 0.8, -0.9, 0.9) });
        if (plan) { this._voiced = line; this._said = { plan, at: this.time }; }
      }
      // kept on the screen (on a phone a balloon over someone near the edge ran off it)
      const w = this.balloon.offsetWidth || 200;
      const x = THREE.MathUtils.clamp((_w.x * 0.5 + 0.5) * window.innerWidth - 22, 6, Math.max(6, window.innerWidth - w - 6));
      this.balloon.style.transform = `translate(${x.toFixed(1)}px, ${((-_w.y * 0.5 + 0.5) * window.innerHeight - lift).toFixed(1)}px) translate(0, calc(-100% - 12px))`;
    }
    this.balloon.classList.toggle('show', on);
  }

  /**
   * Their face while their balloon is up (src/talk-face.js): the line's tone, the mouth on the syllables of its
   * mumble (or moving by itself for a moment when it went unvoiced). { speaking, tone, mouth }
   */
  balloonFace() {
    const line = this._balloonLine;
    if (!this.talking || !line) return { speaking: false };
    const tone = toneOf(line), S = this._said;
    if (S) { const t = this.time - S.at; return { speaking: t < S.plan.total + 0.15, tone, mouth: mouthAt(S.plan, t) }; }
    return { speaking: this.time - (this._lineAt ?? this.time) < Math.min(3, 0.05 * String(line).length), tone, mouth: null };
  }

  /** Who is speaking, for the voice (src/story/voice.js voiceOf): their data, a crowd person's seed, or this body. */
  voicePerson() {
    if (this.person) return { seed: `crowd:${this.person.id}`, kind: this.person.kind ?? this.kind, size: this.person.size };   // the same voice as their conversation (story/<world>.js crowdTalk)
    if (this.def) return this.def;
    return (this._vp ??= { id: `npc:${String(this.lines?.[0] ?? '')}`, kind: this.kind, scale: this.object.scale.x });
  }

  move(dir, speed, dt) {
    this.pos.addScaledVector(dir, speed * dt);
    // don't walk through walls, rocks or buildings
    this.physics.pushCapsule(this.pos, 0.4, 0.6, 2.0, _push);
  }

  /** What the cloth needs this frame (Cape.update): the body's colliders, the ground, the motion. */
  clothState(player, speed) {
    return { up: Y, vel: this.vel, wind: player.wind, floor: this.pos, field: this.seat ? this.seatField() : null, capsules: this.clothCapsules(player), still: speed < 0.05 };
  }

  /**
   * Seated: what the cape falls onto (cape.js groundField: the seat round the hips, its edges, the
   * ground beyond), probed once for each seat. The floor at the seat's height spread it like a sheet.
   */
  seatField() {
    const o = this.object.position, F = this._field;
    if (F && Math.abs(F.ox - o.x) < 0.03 && Math.abs(F.oz - o.z) < 0.03 && Math.abs(F.oy - this.pos.y) < 0.03 && Math.abs(F.heading - this.heading) < 0.03) return F;
    this._field = groundField((x, y, z, d) => this.physics.groundAt(x, y, z, d), _w.set(o.x, this.pos.y, o.z), this.heading);
    this._field.heading = this.heading;
    return this._field;
  }

  /** Capes of one cut on one kind of body, standing or seated (on one shape of seat), share a baked drape. */
  drapeKey(pose = this.seat ? 4 : 0, field = null) {
    const seated = pose === 3 || pose === 4;
    return `${this.humanoid ? `${this.humanoid.profile?.id ?? this.kind}/${this.humanoid.build}${this.humanoid.years ? `@${this.humanoid.years}` : ''}` : 'rig'}/${seated ? pose : 0}${seated && field ? `|${field.sig}` : ''}`;
  }

  /** What the cape collides with: this body, and the traveller's when they stand close (a cape no longer drapes through them). */
  clothCapsules(player) {
    const own = this.humanoid ? this.humanoid.capsules() : this.capsules();
    if (!player?.bodyCapsules || player.hidden || player.pos.distanceToSquared(this.pos) > 2.2 * 2.2) return own;
    const out = (this._withPlayer ??= []);
    out.length = 0;
    for (const k of own) out.push(k);
    for (const k of player.bodyCapsules()) out.push(k);
    return out;
  }

  capsules() {
    const c = this.char;
    if (!this._caps) {
      this._caps = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 }];
      for (let i = 0; i < 2; i++) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.11 });
    }
    const K = this._caps;
    c.torso.localToWorld(K[0].a.set(0, 0.05, 0));
    c.torso.localToWorld(K[0].b.set(0, 0.6, 0));
    for (let i = 0; i < 2; i++) {
      c.legs[i].localToWorld(K[1 + i].a.set(0, 0, 0));
      c.feet[i].localToWorld(K[1 + i].b.set(0, 0, 0));
    }
    return K;
  }

  /**
   * A child never stands still (def.gait.fidget, 0..1): standing, she shifts from foot to foot,
   * swings her arms, twists, tips her head, and now and then bounces on her toes; walking, her
   * steps are springier.
   */
  fidget(c, speed, k) {
    const t = this.time, still = THREE.MathUtils.clamp(1 - speed / 0.6, 0, 1), s = this.phase * 37;
    if (still > 0.01 && !this.seat && !this.talkTo?.speaking) {
      const w = still * k;
      c.body.rotation.z += Math.sin(t * 2.1 + s) * 0.05 * w;
      c.body.position.x += Math.sin(t * 2.1 + s) * 0.025 * w;
      c.torso.rotation.y += Math.sin(t * 0.8 + s) * 0.28 * w;
      c.arms[0].rotation.x += Math.sin(t * 1.9 + s) * 0.35 * w;
      c.arms[1].rotation.x += Math.sin(t * 1.9 + s + 2.4) * 0.35 * w;
      c.arms[0].rotation.z -= (0.15 + 0.1 * Math.sin(t * 1.1)) * w;
      c.arms[1].rotation.z += (0.15 + 0.1 * Math.sin(t * 1.3)) * w;
      c.head.rotateZ(Math.sin(t * 1.3 + s) * 0.14 * w);
      // a bounce on her toes, every few seconds
      const b = (t * 0.33 + s) % 1;
      if (b < 0.12) c.body.position.y += Math.sin((b / 0.12) * Math.PI * 2) ** 2 * 0.045 * w;
    }
    if (speed > 0.3) c.body.position.y += Math.abs(Math.sin(this.time * 9)) * 0.018 * k * Math.min(1, speed);
  }

  /** Which way the player is from here (held while they stand inside us: see update()). */
  aimAtPlayer(player, dist) {
    _v.subVectors(player.pos, this.pos);
    return dist < 0.7 && this._toYou !== undefined ? this._toYou : Math.atan2(_v.x, _v.z);
  }

  /** Mocap clips (walk / jog when fleeing / idle / talking), wave layered on top. */
  pose(dt, speed, waveT, dist, player, mode = null, near = true) {
    const c = this.char;
    if (this.animator) {
      // (their own captured walk, once the motion library is in: it loads after the people)
      if (this._walkFor !== this.gait && this.animator.lib.motion) this.ownWalk();
      const N = this.animator.lib.native, G = this.gait;
      // a gait of their own (def.gait): a child's short legs take shorter, quicker steps, and break into a run sooner
      const DG = this.def?.gait, stride = DG?.stride ?? 1, pace = DG?.pace ?? 1;
      // their own stride (and a slow drift in it, so two walking side by side fall out of step)
      const wobble = 1 + G.wobble * Math.sin(this.time * G.wobbleRate * Math.PI * 2);
      this.animator.update(dt, {
        speed, onGround: true, mode: mode ?? (waveT >= 0 ? 'talk' : 'ground'),
        walkAt: N.walk * 1.3 * pace, jogAt: N.jog * pace, sprintAt: N.sprint * 1.2 * pace, strideScale: 1.05 * stride * G.stride * wobble, scale: this.object.scale.y,
      });
      this.object.position.copy(this.pos);
      this.object.quaternion.setFromAxisAngle(Y, this.heading);
      this.animator.apply(this.object, { legScale: 1.04 * G.bob });
      const walking = Math.min(this.animator.gaitW * 1.2, 1);
      poseStyle(c, G, this.animator.phase, walking);
      // near: they lean into starting and stopping, bank into a curve, look where they're turning
      if (near) {
        this.loco.update(dt, { vf: speed, speed, heading: this.heading, want: this._face ?? null, ground: !this.seat });
        this.loco.pose(c);
      } else this.loco.lastHeading = this.heading;
      if (DG?.fidget) this.fidget(c, speed, DG.fidget);
      if (waveT >= 0 && waveT < 2.2) {
        const k = Math.min(waveT * 4, 1) * Math.min((2.2 - waveT) * 4, 1);
        c.arms[1].rotation.set(-0.2 * k, 0, 0.12 + 2.5 * k);
        c.elbows[1].rotation.set(-(0.3 + 0.5 * Math.sin(waveT * 14) * k), 0, 0);
      }
      if (dist < 12) {
        let a = this.aimAtPlayer(player, dist) - this.heading;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        c.head.rotateY(THREE.MathUtils.clamp(a, -1.1, 1.1) * 0.8);
      }
      return;
    }
    const moving = Math.min(speed / 1.5, 1), run = Math.min(Math.max((speed - 3) / 3, 0), 1);
    this.phase = (this.phase + (speed / THREE.MathUtils.lerp(1.5, 2.6, run)) * dt) % 1;
    const ph = this.phase * Math.PI * 2;
    const hip = Math.sin(ph) * THREE.MathUtils.lerp(0.45, 0.85, run) * moving;
    const kneeAmp = THREE.MathUtils.lerp(0.7, 1.5, run) * moving;
    c.legs[0].rotation.set(hip, 0, 0);
    c.legs[1].rotation.set(-hip, 0, 0);
    c.knees[0].rotation.x = Math.max(0, -Math.cos(ph)) * kneeAmp + 0.05;
    c.knees[1].rotation.x = Math.max(0, Math.cos(ph)) * kneeAmp + 0.05;
    c.feet[0].rotation.x = -(hip + c.knees[0].rotation.x) * 0.8;
    c.feet[1].rotation.x = -(-hip + c.knees[1].rotation.x) * 0.8;
    const walkBob = 0.5 + 0.5 * Math.cos(2 * ph);
    c.body.position.y = walkBob * 0.03 * moving + Math.sin(this.time * 2) * 0.006;
    c.body.rotation.set(0.04 * moving + run * 0.2, 0, 0);
    c.torso.rotation.set(0, Math.sin(ph) * 0.12 * moving, 0);
    c.arms[0].rotation.set(-hip * 0.9, 0, -0.06);
    c.arms[1].rotation.set(hip * 0.9, 0, 0.06);
    c.elbows[0].rotation.x = c.elbows[1].rotation.x = -(0.2 + run * 1.2);
    // wave: right arm up, hand swinging, for ~2 s after greeting
    if (waveT >= 0 && waveT < 2.2) {
      const k = Math.min(waveT * 4, 1) * Math.min((2.2 - waveT) * 4, 1);
      c.arms[1].rotation.set(-0.2 * k, 0, 0.12 + 2.5 * k);
      c.elbows[1].rotation.x = -(0.3 + 0.5 * Math.sin(waveT * 14) * k);
    }
    // look: at the player when near, around when idle
    let look = Math.sin(this.time * 0.4) * 0.5 * (1 - moving);
    if (dist < 12) {
      let a = this.aimAtPlayer(player, dist) - this.heading;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      look = THREE.MathUtils.clamp(a, -1.1, 1.1);
    }
    c.head.rotation.set(0, look, 0);
    c.hatTip.rotation.x = Math.cos(2 * ph) * 0.1 * moving;
  }

  dispose(scene) {
    if (this.humanoid?.lod) { this.humanoid.lod.reset(); skinnedLods.remove(this.humanoid.lod); }
    scene.remove(this.object);
    this.cape?.dispose(scene);
    this.balloon.remove();
  }
}

/**
 * Scatter a level's people: each walks a small loop around a centre.
 * @param spots [{ at: [x, z] | Vector3, palette, lines, shy, radius, scale, face?, expression?, facing? }]
 */
export function spawnNPCs(scene, physics, spots, { fromY = 1e4, lib = null, humans = null } = {}) {
  return spots.map((s, k) => {
    const cx = s.at[0], cz = s.at[1];
    const r = s.radius ?? 14;
    // the same loop on every visit (seeded by where they stand), on gentle ground only:
    // a point on a steep bank or a wall is tried again closer in, and at worst the centre is used
    const rand = mulberry32(((Math.round(cx * 7.3) * 73856093) ^ (Math.round(cz * 7.3) * 19349663) ^ (k * 83492791)) >>> 0);
    const from = s.y !== undefined ? s.y + 2 : fromY;
    const ground = (x, z) => {
      const y = physics.groundAt(x, from, z);
      if (!Number.isFinite(y)) return null;
      const nrm = physics.groundNormal?.(x, y + 1, z);
      return nrm && nrm.y < 0.8 ? null : y;
    };
    const route = [];
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.8;
      let p = null;
      for (let t = 0; t < 6 && !p; t++) {
        const d = r * (0.5 + rand() * 0.5) * (1 - t / 6);
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = ground(x, z);
        if (y !== null) p = new THREE.Vector3(x, y, z);
      }
      if (!p) { const y = physics.groundAt(cx, from, cz); p = new THREE.Vector3(cx, Number.isFinite(y) ? y : 0, cz); }
      route.push(p);
    }
    const kind = s.kind ?? (k % 2 ? 'f' : 'm');
    const npc = new NPC(scene, physics, { route, palette: s.palette, lines: s.lines, shy: s.shy, speed: s.speed, scale: s.scale, lib,
      human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind, def: s.talk ? s : null, head: s.head ?? null, cape: s.cape ?? null, look: s.look ?? null, world: s.world ?? null,
      face: s.face ?? null, expression: s.expression ?? null, facing: s.facing ?? null });
    return npc;
  });
}

/** A hidden NPC body for a crowd's near tier (see crowd.js). */
export function pooledNPC(scene, physics, { kind = 'm', lib = null, humans = null } = {}) {
  return new NPC(scene, physics, { route: [new THREE.Vector3()], palette: { cloak: '#c8483a', lining: '#2b211f' }, lines: ['…'], lib,
    human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind, pooled: true });
}

/** Put quest and village NPCs on the tool's target list (crowd people register themselves in crowd.js). */
export function registerNPCTargets(npcs) {
  return npcs.filter((n) => !n.pooled).map((n) => {
    const at = new THREE.Vector3();
    return registerTarget({ kind: 'npc', radius: 0.45, npc: n, accepts: ['stun', 'fire'], position: () => n.chest(at), enabled: () => n.object.visible, onHit: (mode, point, dir, info) => n.hit(mode, dir, info) });
  });
}
