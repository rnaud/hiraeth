import { page, screen } from '../platform.js';
import * as THREE from 'three';
import { game } from '../game-state.js';
import { PAD } from '../bindings.js';
import { Quests, QuestMarker } from './quests.js';
import { Dialogue, TRAVELLER_TAG } from './dialogue.js';
import { sightOf } from './shot.js';
import { flameVeils } from './flames.js';
import { hasBalloon } from './balloons.js';
import { talkSpace, stepBack, gapOf } from './spacing.js';
import { CAPSULE } from '../player.js';
import { MomentStage } from './moment.js';
import { recordSightings } from './sightings.js';
import { glyphGeometry } from './sign-text.js';
import { registerInteractable, updateInteract, PRIORITY } from '../interact.js';
import { NPC, registerNPCTargets } from '../npc.js';
import { talkFaces } from '../talk-face.js';
import { makeMaterial } from '../materials.js';
import { expressionFor } from '../expression.js';
import { viaPortal } from '../scout.js';
import { backdropFor, portraitSize } from './portrait-bg.js';
import { keyBadge, escapeHtml } from '../prompt-keys.js';
import { hintsFor } from '../hint-level.js';
import { setupDesert } from './desert.js';
import { setupPerdide } from './perdide.js';
import { setupPerdide2 } from './perdide2.js';
import { setupArzach } from './arzach.js';
import { setupArzach2 } from './arzach2.js';
import { setupGarage } from './garage.js';
import { setupBuried } from './buried.js';
import { setupEdena } from './edena.js';
import { setupSpheres } from './spheres.js';
import { setupIncal } from './incal.js';
import { setupBazaar } from './bazaar.js';
import { setupCabs } from './cab.js';
import { setupHome } from './home.js';
import { setupLantern } from './lantern.js';
import { setupTempleStory } from '../temples/index.js';
import { setupShops } from './shops.js';
import { setupFellow } from './fellow.js';

// The story runtime for a world: quests, conversations, the objective
// marker, the E prompt, and the world's own story (src/story/<world>.js).
// main.js makes one per level:
//
//   const storyRt = createStory({ levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, capture, lib, humans, toast, tool });
//   storyRt.update(dt, t, { camera, ePressed })  → { handled }  (before player.update; when handled, the player's own E must not fire)
//   storyRt.frameCamera(camera)                 (after the rig: the two-shot during conversations)
//   storyRt.objective()                         (for the scout's Q ping)
//   storyRt.hud() / storyRt.prompt / storyRt.busy()
//
// Other systems use the shared pieces directly:
//   storyRt.quests      start / advance / set / stage / give / has / locate (src/story/quests.js)
//   storyRt.dialogue    start(person, npc) (src/story/dialogue.js)
//   registerInteractable(...) for anything E should use (src/interact.js)

const WORLDS = {
  desert: setupDesert,
  perdide: setupPerdide,
  perdide2: setupPerdide2,
  arzach: setupArzach,
  arzach2: setupArzach2,
  garage: setupGarage,
  buried: setupBuried,
  edena: setupEdena,
  spheres: setupSpheres,
  incal: setupIncal,
  bazaar: setupBazaar,
  home: setupHome,
  lantern: setupLantern,
};
const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _eyes = new THREE.Vector3();

export function createStory(o) {
  const { levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, capture, lib, humans, toast = () => {} } = o;
  const quests = new Quests({ game, toast, sound });
  let talking = null;   // { person, npc, at }
  let world = null;
  const dialogue = new Dialogue({
    game, quests, sound, toast,
    portrait: (person, npc) => npc && capture ? portrait(npc, person) : null,
    portraitYou: (tone) => capture ? portraitYou(tone) : null,
    onOpen: (person, npc) => {
      talking = { person, npc, at: dialogue.at, look: dialogue.look };
      if (npc) makeRoom(npc);   // (before the camera cuts to the two-shot: nobody sees the step)
      if (npc) npc.talkTo = { speaking: true };
      world?.onTalk?.(person, npc, true);
      if (typeof document !== 'undefined') document.body.classList.add('talking');
    },
    onClose: (person, npc) => {
      if (npc) npc.talkTo = null;
      world?.onTalk?.(person, npc, false);
      talking = null;
      if (typeof document !== 'undefined') document.body.classList.remove('talking');
    },
  });
  const marker = new QuestMarker(scene, makeMaterial);

  // (the quests in the game menu's Quests panel, where choosing one tracks it: main.js, src/game-menu.js)

  // a sketch of whoever you're talking to, for the panel: just them (and their cape) against a flat
  // colour of this world's (src/story/portrait-bg.js); returns { src, background }
  function portrait(npc, person = npc.def) {
    // the head (the bone if there is one), seen from a little below: heads tilt down in the idle and seated poses
    // (someone without a head says where its face is and how to frame it: an alien, src/aliens/alien.js portraitShot)
    const own = npc.portraitShot?.(player.pos);
    const head = npc.humanoid?.b?.Head;
    const look = own ? _p.copy(own.look) : head ? head.getWorldPosition(_p).addScaledVector(UP, 0.1 * npc.object.scale.y) : _p.copy(npc.pos).addScaledVector(UP, (npc.seat ? 1.0 : 1.62) * npc.object.scale.y);
    _d.subVectors(player.pos, npc.pos).setY(0);
    if (_d.lengthSq() < 1e-4) _d.set(Math.sin(npc.heading), 0, Math.cos(npc.heading));
    _d.normalize();
    const s = own ? 1 : npc.object.scale.y;
    const eye = own ? own.eye : look.clone().addScaledVector(_d, 1.05 * s).add(new THREE.Vector3(-_d.z * 0.3 * s, -0.32 * s, _d.x * 0.3 * s));
    const background = backdropFor(person, levelId);
    // as sharp as the circle it is shown in (its size on this screen), drawn at that size and supersampled
    const css = (typeof document !== 'undefined' && document.querySelector('#dialogue .dlg-chip')?.clientWidth) || 84;
    const px = portraitSize(css, typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    const src = capture(eye, look.clone().addScaledVector(UP, -0.06 * s), px, px, { keep: [npc.object, npc.cape?.mesh], backdrop: background, fov: 36, css });
    return src ? { src, background } : null;
  }

  /** Where the traveller's face is (its middle, as drawn: characters/tripo-face.js), or near enough. */
  function travellerFace(out) {
    const h = player.humanoid, head = h?.b?.Head;
    if (!head || player.hidden || player.object?.visible === false) return null;
    return h.drawnFace?.at?.(head, out) ?? head.getWorldPosition(out).addScaledVector(player.frame?.up ?? UP, 0.08);
  }

  // the traveller's own, for the panel on his lines: his face wearing the tone of what he says, framed as theirs are
  const _yf = new THREE.Vector3(), _yd = new THREE.Vector3();
  function portraitYou(tone) {
    const h = player.humanoid, up = player.frame?.up ?? UP;
    const face = travellerFace(_yf);
    if (!h || !face) return null;
    // (from in front of his face as it is turned now, a little to the side and below, as theirs are)
    const fwd = h.drawnFace?.facing?.(_yd) ?? (player.frame?.dir ? player.frame.dir(player.heading, _yd) : _yd.set(Math.sin(player.heading), 0, Math.cos(player.heading)));
    fwd.addScaledVector(up, -fwd.dot(up)).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const look = face.clone().addScaledVector(up, -0.04);
    const eye = look.clone().addScaledVector(fwd, 1.0).addScaledVector(right, 0.3).addScaledVector(up, -0.1);
    const background = backdropFor(TRAVELLER_TAG, levelId);
    const css = (typeof document !== 'undefined' && document.querySelector('#dialogue .dlg-chip')?.clientWidth) || 84;
    const px = portraitSize(css, typeof window !== 'undefined' ? window.devicePixelRatio : 1);
    // (the face put on for the picture, the eyes open; given back after: his talking face takes it on from there)
    const was = h.expression, blink = h.drawnFace?.blink ?? 0;
    h.setExpression(expressionFor(tone, { rest: h.restExpression }));
    h.drawnFace?.eyes(0, null, h.drawnFace.look);
    try {
      const src = capture(eye, look, px, px, { keep: [player.object], backdrop: background, fov: 25, css });
      return src ? { src, background } : null;
    } finally {
      h.setExpression(was);
      h.drawnFace?.eyes(blink, null, h.drawnFace.look);
    }
  }

  /** E talks to this person. */
  function talkable(npc, def) {
    if (npc.identify) npc.identify(def, levelId);
    else npc.def = def;
    return registerInteractable({
      id: `talk.${def.id}`, priority: PRIORITY.talk, range: def.range ?? 3.4, npc,
      prompt: `talk to ${def.name.replace(/^The /, 'the ')}`,
      at: () => (npc.talkAt ? npc.talkAt(_p) : _p.copy(npc.pos).addScaledVector(UP, (npc.seat ? 1.4 : 2.15) * npc.object.scale.y)),
      enabled: () => npc.object.visible && !npc.stunned?.(),
      distance: (p) => (Math.abs(p.pos.y - npc.pos.y) < 2.5 ? Math.hypot(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z) : Infinity),
      use: () => dialogue.start(def, npc),
    });
  }
  /** A story person: a full NPC standing, seated or following. */
  function spawn(def, { route, seat = null, heading = null, follow = null, speed = 1.1 }) {
    const kind = def.body ?? def.kind ?? 'm';   // (def.body: the body, when it isn't the voice's kind: a child)
    const npc = new NPC(scene, physics, {
      route, palette: def.palette, lines: def.lines ?? ['…'], lib, human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind,
      scale: def.scale, seat, follow, head: def.head ?? null, cape: def.cape ?? null, speed, def,
    });
    if (heading !== null) npc.heading = heading;
    npcs.push(npc);
    registerNPCTargets([npc]);
    talkable(npc, def);
    return npc;
  }
  // the level's own people who have something to say
  for (const n of npcs) if (n.def?.talk) talkable(n, n.def);
  // what the traveller writes down as he meets it: the light, the makers' sign, the father's signal (src/story/sightings.js)
  recordSightings(game, { toast });
  // the world's traces (a detour world's: a mark, a fragment, something left; its content's `traces`, src/levels/<world>.js):
  // { id, at: [x, y, z], label, glyph?: { size, yaw, lift }, range?, person: { id, name, talk } }; E looks at it
  const traceAt = (tr) => new THREE.Vector3(tr.at[0], tr.at[1] ?? level.ground?.heightAt?.(tr.at[0], tr.at[2]) ?? 0, tr.at[2]);
  for (const tr of o.traces ?? level?.traces ?? []) {
    const at = traceAt(tr), look = tr.look ? new THREE.Vector3(...tr.look) : at.clone().addScaledVector(UP, (tr.glyph?.lift ?? 0.6));
    if (tr.glyph && scene) {
      const g = tr.glyph, m = new THREE.Mesh(glyphGeometry(g.size ?? 0.8, 0.05), makeMaterial({ color: g.color ?? '#70e7df', glow: g.glow ?? 0.6, flat: true }));
      m.position.copy(at).addScaledVector(UP, g.lift ?? 0.6);
      m.rotation.set(g.pitch ?? 0, g.yaw ?? 0, 0);
      m.name = `trace.${tr.id}`;
      scene.add(m);
    }
    registerInteractable({
      id: `trace.${tr.id}`, priority: PRIORITY.use, range: tr.range ?? 3, prompt: `look at ${tr.label ?? tr.person?.name?.replace(/^The /, 'the ') ?? 'it'}`,
      at: () => look, distance: (p) => (Math.abs(p.pos.y - at.y) < (tr.height ?? 4) ? Math.hypot(p.pos.x - at.x, p.pos.z - at.z) : Infinity),
      use: () => dialogue.start(tr.person, null, at, look),
    });
  }

  // a world's first times, filmed (src/story/moment.js): on the ship's camera, never over a conversation
  const moments = new MomentStage({ ship: o.ship ?? null, game, player, physics, quiet: () => dialogue.open || !!story?.pageOpen });
  world = WORLDS[levelId]?.({ ...o, quests, dialogue, game, spawn, talkable, moments }) ?? null;
  // the cabs (src/taxi.js): they drive themselves, and ask where to as you get in (src/story/cab.js)
  const cabs = setupCabs({ player, dialogue, level, toast });
  // the world's temple (src/temples/): its quest, its local, its rooms and guardian
  const temple = setupTempleStory({ ...o, quests, dialogue, game, spawn, talkable });
  // the world's shops (src/story/shops.js): the keepers behind their counters, the wares on them
  const shops = setupShops({ level, game, spawn });
  // the fellow traveller (src/story/fellow.js): Tansy, a few steps from the ship in her stops along the route
  const fellow = setupFellow({ ...o, game, quests, talkable });

  // people in the crowd: whoever is nearest (a pooled full NPC) can be talked to
  if (crowd && world?.crowdTalk) {
    for (const e of crowd.pool) {
      registerInteractable({
        id: 'talk.crowd', priority: PRIORITY.talk, range: 2.6,
        prompt: () => `talk to ${(e.person && world.crowdTalk(e.person)?.name.toLowerCase()) ?? 'them'}`,
        at: () => _p.copy(e.person.pos).addScaledVector(UP, 2.1),
        enabled: () => !!e.person && !!world.crowdTalk(e.person) && crowd.time >= e.person.stunUntil,
        distance: (p) => (e.person && Math.abs(p.pos.y - e.person.pos.y) < 2.5 ? Math.hypot(p.pos.x - e.person.pos.x, p.pos.z - e.person.pos.z) : Infinity),
        use: () => {
          const def = world.crowdTalk(e.person);
          if (def && dialogue.start(def, e.npc)) talking.crowd = e.person;
        },
      });
    }
  }

  // ---------------------------------------------------------------- the conversation camera
  // (src/story/shot.js: a shot with no wall, tree, rock or bystander between it and the faces)
  const sight = physics ? sightOf(physics, { veils: (near) => flameVeils(near, 30) }) : null;
  const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fw = new THREE.Vector3(), _fs = new THREE.Vector3(), _fsd = new THREE.Vector3();
  /** What the camera frames: a person (the two-shot), or a thing (over the shoulder, at `look`). */
  function shotOf(t) {
    if (t.npc) return { npc: t.npc };
    const up = player.frame?.up ?? UP;
    let look = t.look ?? t.at;
    // a thing given by where you stand to see it (on the ground): look at it, not at your feet
    if (!t.look && look && _d.subVectors(look, player.pos).dot(up) < 0.5) look = look.clone().addScaledVector(up, 0.6);
    return { at: t.at, look };
  }
  function faceOf(npc, up, out) {
    if (npc.faceAt && npc.object.visible) return npc.faceAt(out);   // (an alien: its lantern, its eyes, its heart)
    const head = npc.humanoid?.b?.Head;
    if (head && npc.object.visible) return head.getWorldPosition(out).addScaledVector(up, 0.08 * npc.object.scale.y);
    return out.copy(npc.pos).addScaledVector(up, (npc.seat ? 1.0 : 1.55) * npc.object.scale.y);
  }
  /** Each person's balloon allowed or not (npc.quiet): story people by their def, crowd people by their short talk. */
  let balloonT = 0;
  const crowdOf = new Map();
  if (crowd) for (const e of crowd.pool) crowdOf.set(e.npc, e);
  function quietBalloons() {
    const objective = quests.objective();
    for (const n of npcs) {
      const e = crowdOf.get(n);
      const def = e ? (e.person && world?.crowdTalk?.(e.person)) || null : n.def ?? null;
      n.quiet = !hasBalloon(def, { game, quests, objective, at: n.pos });
    }
  }
  /** Bystanders the shot should not look through (asked again whenever the shot is). */
  const bystanders = () => {
    const out = [];
    for (const n of npcs) if (n !== talking?.npc && n.object.visible && n.pos.distanceToSquared(player.pos) < 400) out.push(n.pos);
    if (crowd) for (const p of crowd.people) if (p !== talking?.crowd && p.pos.distanceToSquared(player.pos) < 225) out.push(p.pos);
    return out;
  };

  /**
   * Too close to start talking: the traveller steps back to a comfortable gap (src/story/spacing.js),
   * or, his back to a wall, the other does; then he faces them. Done as the camera cuts in, so
   * the step is never seen. On ordinary ground only (not riding, swimming, climbing or upside down).
   */
  function makeRoom(npc) {
    const up = player.frame?.up ?? UP;
    if (!npc.pos || up.y < 0.999 || player.ride || player.swim || player.climbing || player.gliding || player.down || player.onGround === false) return null;
    const { want, min } = talkSpace(npc);
    let moved = null;
    if (gapOf(player.pos, npc.pos) < min) {
      const others = bystanders();
      const facing = player.frame?.dir ? player.frame.dir(player.heading, _fw) : null;
      const to = stepBack({ a: player.pos, b: npc.pos, want, min, physics, radius: CAPSULE.radius, height: CAPSULE.height, others, facing });
      if (to) { player.pos.copy(to); player.vel?.set(0, 0, 0); moved = 'traveller'; }
      else if (!npc.seat && !npc.person && !npc.down) {
        // (a crowd person's place is the crowd's, a seated one stays on their seat)
        const s = npc.object?.scale?.y ?? 1;
        const there = stepBack({ a: npc.pos, b: player.pos, want, min, physics, radius: 0.35 * s, height: 1.9 * s, others });
        if (there) { npc.pos.copy(there); npc.object?.position.copy(there); moved = 'them'; }
      }
    }
    // turned to them already when the shot opens (rather than seen turning on the spot)
    if (player.frame?.headingOf) {
      _d.subVectors(npc.pos, player.pos); _d.addScaledVector(up, -_d.dot(up));
      if (_d.lengthSq() > 0.09) player.heading = player.frame.headingOf(_d);
    }
    return moved;
  }

  const promptEl = page.byId('prompt');
  // (looked up when needed: the touch controls are built after the story)
  let useBtn = null;
  const useButton = () => (useBtn ??= typeof document !== 'undefined' ? document.querySelector('#touch .b-use') : null);
  const rt = {
    quests, dialogue, marker, world, temple, shops, fellow, portrait, moments, makeRoom, cabs, prompt: null, promptAt: null,
    busy: () => dialogue.open || moments.playing || !!world?.busy?.(),   // (a world's own scene: home's quiet moments, a first time filmed)
    /** The tracked objective, routed through doorways (the cave) like the scout does. */
    objective() {
      const ob = quests.objective();
      return ob ? viaPortal(player.pos, ob, level.navigationPortals ?? level.portals ?? []) : null;
    },
    hud() { const ob = rt.objective(); if (!ob) return null; const d = player.pos.distanceTo(ob.position); return `◆ ${ob.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`; },
    update(dt, t, { camera, ePressed = false, paused = false }) {
      quests.update(player);
      world?.update?.(dt, t, { camera });
      moments.update(dt);
      temple?.update(dt, t);
      shops?.update(dt);
      world?.hold?.();
      // the person you talk to keeps facing you; a crowd person's group pauses
      if (talking?.crowd && crowd) {
        const p = talking.crowd;
        p.faceUntil = crowd.time + 0.5; p.lookUntil = crowd.time + 1;
        if (p.group) { p.group.pauseUntil = crowd.time + 0.5; p.group.lookUntil = crowd.time + 1; }
      }
      if (talking?.npc?.talkTo) talking.npc.talkTo.speaking = dialogue.runner?.speaker === 'npc' && dialogue.revealed < (dialogue.runner?.text.length ?? 0);
      cabs.update();
      // who greets you with a balloon: only those with something for you (src/story/balloons.js)
      if ((balloonT -= dt) <= 0) { balloonT = 0.25; quietBalloons(); }
      dialogue.update(dt);
      // their faces (src/talk-face.js): the person you talk to wears the tone of the line they say, their mouth on
      // its syllables; so does the traveller on his pages and when he answers; each eases back to rest after
      const F = dialogue.faces();
      if (dialogue.open && talking?.npc?.humanoid && talking.npc.object.visible) talkFaces.drive(talking.npc.humanoid, F.npc);
      else if (dialogue.open && talking?.npc?.express) talking.npc.express(F.npc);   // (no face: the tone as a glow and a gesture, src/aliens/)
      if (player.humanoid && (dialogue.open || F.player.speaking)) talkFaces.drive(player.humanoid, F.player);
      // and the traveller's eyes on their face
      // (a moment says where he looks and turns: src/story/moment.js m.eyes, m.face)
      const M = moments.playing ? moments.current : null;
      // and held still while it lasts: no weight shifts, glances or looking about (src/player.js TALK_CALM)
      player.talking = dialogue.open;
      player.eyeTarget = dialogue.open && talking?.npc?.object.visible ? faceOf(talking.npc, player.frame?.up ?? UP, _eyes) : M?.eyes ?? null;
      // the traveller turns to whoever they talk to, or to what they look at
      player.faceToward = talking && dialogue.open ? (talking.npc?.pos ?? (rt._shot?.of === talking ? rt._shot.look : talking.look ?? talking.at)) : M?.face ?? null;
      // the press that closed a conversation must not open the next one (or whistle the mount)
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const fresh = ePressed && now - (dialogue.closedAt ?? -1e9) > 400;
      const r = paused || dialogue.open || player.hidden ? { prompt: null, handled: false } : updateInteract(player, fresh);
      if (ePressed && !fresh) r.handled = true;
      rt.prompt = r.prompt;
      rt.promptEntry = r.entry ?? null;
      rt.promptAt = r.entry?.at?.() ?? null;
      const ob = rt.objective();
      marker.update(dt, t, ob, player, camera, paused || dialogue.open);
      if (camera) {
        camera.getWorldDirection(_d);
        sound.listen?.(camera.position, Math.atan2(-_d.x, -_d.z));
      }
      if (useButton()) { const label = r.prompt ? r.prompt.split(' ')[0] : 'E'; if (useBtn.dataset.label !== label) { useBtn.dataset.label = label; useBtn.textContent = label === 'E' ? 'E' : label; useBtn.classList.toggle('talk', label !== 'E'); } }
      return r;
    },
    /** The floating "E talk to Ama" tag, over whoever it's for. */
    placePrompt(camera, controller = false) {
      if (!promptEl) return;
      if (!rt.prompt || !rt.promptAt) { promptEl.classList.remove('show'); screen.set('prompt', null); return; }
      const at = rt.promptAt.toArray().map((v) => +v.toFixed(2));   // (before projecting: the vector may be shared)
      _p.copy(rt.promptAt).project(camera);
      const on = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      // (as data too, platform.js screen.prompt: where it floats, in the world)
      screen.set('prompt', on ? { text: rt.prompt, key: controller ? PAD.interact : 'E', at } : null);
      if (on) {
        // (hints full: the button and what it does; otherwise the button alone, a small quiet glyph: src/hint-level.js)
        const words = hintsFor('words'), key = controller ? PAD.interact : 'E', text = words ? `${key} ${rt.prompt}` : key;
        // (the button as a round badge; native-pad.js renames it in place, it rewrites text nodes)
        if (promptEl.dataset.text !== text) { promptEl.dataset.text = text; promptEl.innerHTML = words ? `${keyBadge(key)}<span>${escapeHtml(rt.prompt)}</span>` : keyBadge(key); promptEl.classList.toggle('glyph', !words); }
        promptEl.style.transform = `translate(${((_p.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_p.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
      }
      promptEl.classList.toggle('show', on);
    },
    /** The two-shot during a conversation (after the rig has placed the camera). */
    frameCamera(camera) {
      world?.frameCamera?.(camera);   // a world's own camera moment (the Lodestar flaring, the broadcast)
      if (talking && (talking.npc || talking.at) && rt._shot?.of !== talking) rt._shot = { ...shotOf(talking), of: talking };   // (kept while the camera blends back)
      if (dialogue.blend < 0.002 || !rt._shot) { rt._shot = null; return; }
      const S = rt._shot, up = player.frame?.up ?? UP;
      const o = { sight, faceA: _fa.copy(player.pos).addScaledVector(up, 1.58), look: S.look, facing: player.frame?.dir?.(player.heading, _fw) ?? null };
      if (S.npc) {
        o.faceB = faceOf(S.npc, up, _fb);
        o.radiusB = 0.3 * (S.npc.object?.scale?.y ?? 1);
        // a close shot of his face may be had (src/story/coverage.js): standing or sitting on the ground, not
        // inside a vehicle, swimming or hanging off a wall (the cab's cabin, a mount's saddle)
        const free = !player.ride && !player.swim && !player.climbing && !player.gliding && !player.down;
        o.single = free && S.npc.object?.visible !== false ? travellerFace(_fs) : null;
        o.singleFacing = o.single ? player.humanoid?.drawnFace?.facing?.(_fsd) ?? null : null;
        o.viewH = typeof innerHeight !== 'undefined' ? innerHeight : null;   // (CSS px: the close shot's face no taller than it needs to be on a big screen)
      }
      dialogue.frameCamera(camera, player, S.npc?.pos ?? S.at, up, bystanders, o);
    },
  };
  return rt;
}
