import { formatText } from './dialogue.js';
import { CAB_VOICE, CAB_LINES } from './cab-lines.js';

// Riding a cab (src/taxi.js): cabs drive themselves, and you ride seated inside. As you get in, the
// little screen on the dash asks where to: a conversation (src/story/dialogue.js), so the stops are
// picked like any answer, with the mouse, the keys (1–9, arrows and E / Enter) or a pad (the stick or
// the d-pad and A / ×). A stop chosen, the cab flies itself there (Taxi.goTo); there it says where
// you are and waits; E / B / ○ steps you out onto the stop, SPACE / X / □ asks again (on the way
// too: another stop). Closing the question without an answer leaves you seated, the cab waiting.
//
// A world's stops are level.cabStops: [{ id, name, at, heading, step, approach?, depths? }] (at: where
// the cab hovers, step: where you get out, depths: only a cab that goes below the smog stops there).
// A cab may have a voice of its own (taxi.voice: { name, title, … }) and its own talk round the
// question (taxi.talk(where, { greet }) => { entry, nodes }: Wren, src/story/incal.js).

export function setupCabs({ player, dialogue, level, toast = () => {} }) {
  let turn = 0;
  const say = (line, stop) => formatText(line, false).replace('{stop}', stop?.name ?? '');
  const pick = (list) => (Array.isArray(list) ? list[turn++ % list.length] : list);
  /** The stops this cab goes to: all of them for a cab that goes below the smog (free: Wren). */
  const stopsFor = (v) => (level?.cabStops ?? []).filter((s) => v.free || !s.depths);
  const nameOf = (v) => v.voice?.name ?? CAB_VOICE.name;

  function wire(v) {
    v._cabWired = true;
    v.onArrive = (taxi, stop) => toast(`${nameOf(taxi)}: ${say(pick(CAB_LINES.arrive), stop)}`);
    v.onBlocked = (taxi, stop, why) => { taxi.note = why; if (player.ride === taxi) taxi.asking = true; };
  }

  function go(v, stop) {
    if (player.ride !== v) return;
    if (v.goTo(stop)) toast(`${nameOf(v)}: ${say(CAB_LINES.going, stop)}`);
  }

  /** The question, as a conversation with the cab. */
  function ask(v) {
    const routing = v.mode === 'route';
    const here = (s) => v.stop === s || (v.mode === 'aboard' && v.pos.distanceTo(s.at) < 30) || (routing && v.route?.stop === s);   // (not where you already are)
    const stops = stopsFor(v).filter((s) => !here(s));
    const note = v.note; v.note = null;
    const greet = v._askedFor !== v.boardings;
    v._askedFor = v.boardings;
    const line = note ? CAB_LINES[note] : !stops.length ? CAB_LINES.nowhere : routing ? CAB_LINES.onTheWay : v.stop ? CAB_LINES.again : greet && v.talk ? CAB_LINES.then : pick(CAB_LINES.where);
    const choices = stops.map((s) => ({ text: `~neutral~ ${s.name}`, do: () => go(v, s), end: true }));
    if (routing) choices.push({ text: CAB_LINES.carryOn, end: true });
    else if (v.exitAt?.()) choices.push({ text: CAB_LINES.out, do: () => { if (player.ride === v) player.interact?.({ call: false }); }, end: true });
    else choices.push({ text: CAB_LINES.stay, end: true });
    const where = { say: [line], choices };
    const talk = v.talk?.(where, { greet: greet && !note }) ?? { entry: [{ node: 'where' }], nodes: { where } };
    return dialogue.start({ ...CAB_VOICE, color: v.color, ...(v.voice ?? {}), talk }, null, null);
  }

  return {
    stopsFor, ask,
    /** Each frame (before the traveller): open the question when the cab you ride wants an answer. */
    update() {
      const v = player.ride;
      if (!v || v.kind !== 'taxi') return;
      if (!v._cabWired) wire(v);
      if (v.asking && !dialogue.open) { v.asking = false; ask(v); }
    },
  };
}
