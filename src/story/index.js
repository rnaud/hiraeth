import * as THREE from 'three';
import { game } from '../game-state.js';
import { Quests, QuestMarker } from './quests.js';
import { Dialogue } from './dialogue.js';
import { registerInteractable, updateInteract, PRIORITY } from '../interact.js';
import { NPC, registerNPCTargets } from '../npc.js';
import { makeMaterial } from '../materials.js';
import { viaPortal } from '../scout.js';
import { setupDesert } from './desert.js';
import { setupPerdide } from './perdide.js';
import { setupPerdide2 } from './perdide2.js';
import { setupArzach } from './arzach.js';
import { setupArzach2 } from './arzach2.js';
import { setupGarage } from './garage.js';
import { setupBuried } from './buried.js';
import { setupEdena } from './edena.js';
import { setupSpheres } from './spheres.js';

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
};
const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _d = new THREE.Vector3();

export function createStory(o) {
  const { levelId, scene, physics, level, player, npcs, crowd, sound, journal, story, capture, lib, humans, toast = () => {} } = o;
  const quests = new Quests({ game, toast, sound });
  let talking = null;   // { person, npc, at }
  let world = null;
  const dialogue = new Dialogue({
    game, quests, sound, toast,
    portrait: (person, npc) => npc && capture ? portrait(npc) : null,
    onOpen: (person, npc) => {
      talking = { person, npc, at: dialogue.at };
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

  // the quest log in the sketchbook; click a quest to track it
  journal.sections.push(() => quests.journalHtml());
  journal.el.addEventListener('click', (e) => {
    const q = e.target.closest?.('[data-quest]');
    if (q && quests.isActive(q.dataset.quest)) { quests.track(q.dataset.quest); journal.render(); }
  });

  // a sketch of whoever you're talking to, for the panel
  function portrait(npc) {
    // the head (the bone if there is one), seen from a little below: heads tilt down in the idle and seated poses
    const head = npc.humanoid?.b?.Head;
    const look = head ? head.getWorldPosition(_p).addScaledVector(UP, 0.1 * npc.object.scale.y) : _p.copy(npc.pos).addScaledVector(UP, (npc.seat ? 1.0 : 1.62) * npc.object.scale.y);
    _d.subVectors(player.pos, npc.pos).setY(0);
    if (_d.lengthSq() < 1e-4) _d.set(Math.sin(npc.heading), 0, Math.cos(npc.heading));
    _d.normalize();
    const s = npc.object.scale.y;
    const eye = look.clone().addScaledVector(_d, 1.05 * s).add(new THREE.Vector3(-_d.z * 0.3 * s, -0.32 * s, _d.x * 0.3 * s));
    return capture(eye, look.clone().addScaledVector(UP, -0.06 * s), 160, 160);
  }

  /** E talks to this person. */
  function talkable(npc, def) {
    npc.def = def;
    return registerInteractable({
      id: `talk.${def.id}`, priority: PRIORITY.talk, range: def.range ?? 3.4,
      prompt: `talk to ${def.name.replace(/^The /, 'the ')}`,
      at: () => _p.copy(npc.pos).addScaledVector(UP, (npc.seat ? 1.4 : 2.15) * npc.object.scale.y),
      enabled: () => npc.object.visible && !npc.stunned?.(),
      distance: (p) => (Math.abs(p.pos.y - npc.pos.y) < 2.5 ? Math.hypot(p.pos.x - npc.pos.x, p.pos.z - npc.pos.z) : Infinity),
      use: () => dialogue.start(def, npc),
    });
  }
  /** A story person: a full NPC standing, seated or following. */
  function spawn(def, { route, seat = null, heading = null, follow = null, speed = 1.1 }) {
    const kind = def.kind ?? 'm';
    const npc = new NPC(scene, physics, {
      route, palette: def.palette, lines: def.lines ?? ['…'], lib, human: humans ? humans[kind === 'm' ? 0 : 1] : null, kind,
      scale: def.scale ?? 1, seat, follow, head: def.head ?? null, cape: def.cape ?? null, speed, def,
    });
    if (heading !== null) npc.heading = heading;
    npcs.push(npc);
    registerNPCTargets([npc]);
    talkable(npc, def);
    return npc;
  }
  // the level's own people who have something to say
  for (const n of npcs) if (n.def?.talk) talkable(n, n.def);

  world = WORLDS[levelId]?.({ ...o, quests, dialogue, game, spawn, talkable }) ?? null;

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

  const promptEl = typeof document !== 'undefined' ? document.getElementById('prompt') : null;
  const useBtn = typeof document !== 'undefined' ? document.querySelector('#touch .b-use') : null;
  const rt = {
    quests, dialogue, marker, world, portrait, prompt: null, promptAt: null,
    busy: () => dialogue.open,
    /** The tracked objective, routed through doorways (the cave) like the scout does. */
    objective() {
      const ob = quests.objective();
      return ob ? viaPortal(player.pos, ob, level.navigationPortals ?? level.portals ?? []) : null;
    },
    hud() { const ob = rt.objective(); if (!ob) return null; const d = player.pos.distanceTo(ob.position); return `◆ ${ob.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`; },
    update(dt, t, { camera, ePressed = false, paused = false }) {
      quests.update(player);
      world?.update?.(dt, t, { camera });
      world?.hold?.();
      // the person you talk to keeps facing you; a crowd person's group pauses
      if (talking?.crowd && crowd) {
        const p = talking.crowd;
        p.faceUntil = crowd.time + 0.5; p.lookUntil = crowd.time + 1;
        if (p.group) { p.group.pauseUntil = crowd.time + 0.5; p.group.lookUntil = crowd.time + 1; }
      }
      if (talking?.npc?.talkTo) talking.npc.talkTo.speaking = dialogue.runner?.speaker === 'npc' && dialogue.revealed < (dialogue.runner?.text.length ?? 0);
      dialogue.update(dt);
      // the press that closed a conversation must not open the next one (or whistle the mount)
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const fresh = ePressed && now - (dialogue.closedAt ?? -1e9) > 400;
      const r = paused || dialogue.open || player.hidden ? { prompt: null, handled: false } : updateInteract(player, fresh);
      if (ePressed && !fresh) r.handled = true;
      rt.prompt = r.prompt;
      rt.promptAt = r.entry?.at?.() ?? null;
      const ob = rt.objective();
      marker.update(dt, t, ob, player, camera, paused || dialogue.open);
      if (camera) {
        camera.getWorldDirection(_d);
        sound.listen?.(camera.position, Math.atan2(-_d.x, -_d.z));
      }
      if (useBtn) { const label = r.prompt ? r.prompt.split(' ')[0] : 'E'; if (useBtn.dataset.label !== label) { useBtn.dataset.label = label; useBtn.textContent = label === 'E' ? 'E' : label; useBtn.classList.toggle('talk', label !== 'E'); } }
      return r;
    },
    /** The floating "E talk to Ama" tag, over whoever it's for. */
    placePrompt(camera, controller = false) {
      if (!promptEl) return;
      if (!rt.prompt || !rt.promptAt) { promptEl.classList.remove('show'); return; }
      _p.copy(rt.promptAt).project(camera);
      const on = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05;
      if (on) {
        const text = `${controller ? 'X / □' : 'E'} ${rt.prompt}`;
        if (promptEl.dataset.text !== text) { promptEl.dataset.text = text; promptEl.innerHTML = `<b>${controller ? 'X / □' : 'E'}</b> ${rt.prompt}`; }
        promptEl.style.transform = `translate(${((_p.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_p.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`;
      }
      promptEl.classList.toggle('show', on);
    },
    /** The two-shot during a conversation (after the rig has placed the camera). */
    frameCamera(camera) {
      const at = talking?.npc?.pos ?? talking?.at ?? rt._lastAt;
      if (at) rt._lastAt = at;
      if (dialogue.blend < 0.002) { rt._lastAt = null; return; }
      // bystanders the two-shot should not look through
      if (!dialogue._side) {
        rt._avoid = [];
        for (const n of npcs) if (n !== talking?.npc && n.object.visible && n.pos.distanceToSquared(player.pos) < 400) rt._avoid.push(n.pos);
        if (crowd) for (const p of crowd.people) if (p.pos.distanceToSquared(player.pos) < 225 && p !== talking?.crowd) rt._avoid.push(p.pos);
      }
      dialogue.frameCamera(camera, player, at, player.frame?.up ?? UP, rt._avoid ?? []);
    },
  };
  return rt;
}
