// The marker walked to (issue #349, the author: "my marker tells me to go to the riders' gate, but then when I go there,
// there is just a little prompt for some text, but I don't know where to go after, and if I walk back from the gate, the
// marker/drone tells me to go back to the gate"). Used by tests/marker-walk.test.js and
// `check.mjs --walk` beside it (SKILL.md).
//
// In every world (tests/playthrough-agent.js loadWorld, the core gadgets carried), for each quest at each of its steps,
// and for each quest still to be given (everything else there done), the traveller is put where the marker points
// (rt.objective(), the HUD's and the drone's) and the world runs. What is wrong:
//
//   back again   the marker moved on from a place he reached (a way-point: the gate on the way to Aube), but 40 m back
//                the way he came it points at that place again
//   in and out   "Through the shop door": in through the door, and the marker points straight back out of the room
//                (the way to a find routed across the void from one room to another built near it, issue #351)
//   unnamed      nothing changed when he got there, and what E offers there finishes the step, but the step's words don't
//                name it (a "Climb to the crown" done only by "read the note on the post")
//
// It never walks: it puts him there, as the play-through does.

const A = await import('../../../tests/playthrough-agent.js');
const { ROUTE, SUBROUTES } = await import('../../../tests/playthrough-worlds.js');
const { game } = A;

const CARRIED = { 'item.backpack': 1, 'item.doublejump': 1, 'item.gun': 1, 'item.glider': 1, 'item.sword': 1, 'item.shield': 1 };
const BASE = { 'prologue.done': true, 'charge.given': true, 'charge.card': true, 'bird.promise': true, ...CARRIED };
/** The words of a step or a prompt that say what to do (a few letters each, the small words left out). */
const STOP = new Set(['the', 'from', 'with', 'into', 'onto', 'over', 'under', 'your', 'their', 'that', 'this', 'what', 'then', 'back', 'down', 'there', 'here', 'little', 'old', 'its']);
const stems = (s) => new Set((String(s).toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 4)));
/** Do a step's words name what a prompt does (a word in common)? */
export const names = (text, prompt) => { const a = stems(text); return [...stems(prompt)].some((w) => a.has(w)); };

const fmt = (v) => v.toArray().map(Math.round).join(', ');
const core = (id) => id.replace(/^portal-\d+-/, '');

/** Walk the markers of `worlds` (ids; default the route and its sub-levels). Returns [{ world, at, kind, text }]. */
export function walkMarkers(worlds = null) {
  const out = [];
  for (const { id } of [...ROUTE, ...SUBROUTES]) {
    if (worlds && !worlds.includes(id)) continue;
    A.loadSave({ flags: { ...BASE }, keepsakes: [] });
    const W = A.loadWorld(id);
    try {
      W.step(2);
      const home = W.player.pos.clone();
      const snap = JSON.stringify(game.data.flags);
      const finding = (at, kind, text) => out.push({ world: id, at, kind, text });
      const probe = (at) => {
        const a = W.rt.objective();
        if (!a) return;
        const qid = a.quest ?? W.quests.objective()?.quest ?? null, s0 = qid ? W.quests.stage(qid) : undefined;
        if (a.id.startsWith('portal-')) {
          const passed = W.passed.length;
          W.at(A.standNear(W, a.position, { radius: 1, up: 2 }) ?? a.position.clone()); W.step(3);
          if (W.passed.length === passed) return;
          const b = W.rt.objective();
          if (b?.id.startsWith('portal-') && core(b.id) === core(a.id) && b.position.distanceTo(W.player.pos) < 30) finding(at, 'in and out', `“${a.label}” leads into a room, and the marker points straight back out (“${b.label}”)`);
          // (out of a room by another room's door, across the void between the rooms built off the map)
          else if (b?.id.startsWith('portal-') && W.player.pos.y > 2500 && b.position.distanceTo(W.player.pos) > 40) finding(at, 'in and out', `“${a.label}” leads into a room whose way on is another room’s door (“${b.label}”, ${Math.round(b.position.distanceTo(W.player.pos))} m off)`);
          return;
        }
        const spot = A.standNear(W, a.position, { radius: 6, up: 4 }) ?? a.position.clone();
        W.at(spot); W.step(6);
        const b = W.rt.objective();
        if (!b || (qid && W.quests.stage(qid) !== s0)) return;
        if (b.position.distanceTo(a.position) > 15) {
          // a way-point: it moved on. Walk back the way he came: it must not point there again
          const back = spot.clone().addScaledVector(home.clone().sub(spot).setY(0).normalize(), 40);
          W.at(A.standNear(W, back, { radius: 10, up: 15 }) ?? back); W.step(4);
          const c = W.rt.objective();
          if (c && c.position.distanceTo(a.position) < 6 && (!qid || W.quests.stage(qid) === s0)) finding(at, 'back again', `reached “${a.label}” (${fmt(a.position)}), on to “${b.label}”; 40 m back the marker points at “${c.label}” again`);
          return;
        }
        // nothing changed: what E offers here (not a person: a talk step names its person)
        const e = A.inReach(W)[0];
        if (!e || e.npc || !qid) return;
        const prompt = typeof e.prompt === 'function' ? e.prompt() : e.prompt;
        const text = W.quests.def(qid)?.stages.find((x) => x.id === s0)?.text ?? '';
        try { e.use(W.player); } catch { return; }
        if (W.rt.dialogue.open) A.converse(W, A.goalOf(W, qid));
        W.step(4);
        if (W.quests.stage(qid) !== s0 && !names(text, prompt)) finding(at, 'unnamed', `at “${a.label}” only “${prompt}” finishes the step “${text}”, which doesn't say so`);
      };
      const reset = (flags) => { game.data.flags = flags; W.at(home.clone()); W.step(1); };
      probe('arrival');
      for (const d of [...W.quests.defs.values()]) {
        // to be given: everything else in the world done, this one waiting for its giver or its opening talk
        const given = JSON.parse(snap);
        for (const o of W.quests.defs.values()) if (o.id !== d.id) given[`quest.${o.id}`] = 'done';
        delete given[`quest.${d.id}`]; delete given['quest.tracked'];
        W.quests._chosen = null; reset(given);
        try { probe(`${d.id} (to be given)`); } catch (err) { finding(`${d.id} (to be given)`, 'error', err.message); }
        for (const st of d.stages) {
          const f = JSON.parse(snap);
          f[`quest.${d.id}`] = st.id; f['quest.tracked'] = d.id;
          W.quests._chosen = d.id; reset(f);
          try { probe(`${d.id}:${st.id}`); } catch (err) { finding(`${d.id}:${st.id}`, 'error', err.message); }
        }
      }
    } finally { W.dispose(); }
  }
  return out;
}
