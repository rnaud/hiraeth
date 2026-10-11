import { check } from './dialogue.js';

// Who greets you with a balloon over their head (playtest, October 2026: everyone did, so a street was a
// wall of balloons and none of them meant anything). Walking up to someone, their greeting line (`lines`)
// shows over their head only when they have something for you:
//
//   'objective'  the quest you follow points at them (they are the next step)
//   'quest'      they open the world's quest that is still waiting for its first conversation
//   'new'        a person with a conversation you have never talked to (their first greeting), or one with a
//                new conversation waiting (`person.fresh(ctx)`: the fellow traveller's next meeting)
//   'news'       a listen-only person with news you have not heard yet (an `after` entry: dialogue.js pickListen)
//
// Everyone else (people you have met who have nothing new, bystanders and the crowd with nothing new,
// people with no talk at all) still turns to you, and E still talks to them: just no balloon. Only the first
// two reasons wave you over (beckonFor, issue #79), once each. Shouts
// and calls a scene asks for (npc.shout, a crowd person's shoutUntil) always show: they are not greetings.

const isEntry = (e) => e && typeof e === 'object' && !Array.isArray(e) && 'say' in e;
const NEAR = 2.5;   // m: the objective's marker stands on this person

/**
 * Why `person` (a story def: { id, talk, heard? }) would greet you with a balloon now, or null.
 * @param ctx.game, ctx.quests  state (dialogue.js check)
 * @param ctx.objective         the tracked objective ({ position }) or null
 * @param ctx.at                where they stand (to match the objective's marker)
 */
export function balloonReason(person, { game, quests = null, objective = null, at = null } = {}) {
  const talk = person?.talk;
  if (!talk) return null;
  const ctx = { game, quests };
  // someone met before with a new conversation waiting (the fellow traveller's next meeting: src/story/fellow.js)
  if (typeof person.fresh === 'function' && person.fresh(ctx)) return 'new';
  if (talk.listen) {
    const key = `heard.${person.heard ?? person.id}`;
    const news = talk.listen.some((e, k) => isEntry(e) && e.after && check(e.if, ctx) && check(e.after, ctx) && !game.flag?.(`${key}.n${k}`));
    return news ? 'news' : null;
  }
  if (objective?.position && at && objective.position.distanceTo(at) < NEAR) return 'objective';
  if (quests?.pendingOpener?.()?.who?.includes(person.id)) return 'quest';
  if (!game.flag?.(`met.${person.id}`)) return 'new';
  return null;
}

/**
 * Whether they wave you over (issue #79: only for a very good reason, once): the quest you follow points at them
 * ('objective') or they open the world's quest ('quest'). The reason's key (the wave is once for each), or null:
 * someone you have never met, news, a bystander turn to you and greet you, but don't wave.
 */
export function beckonFor(why, person, { quests = null, objective = null } = {}) {
  if (why === 'objective') return `objective:${objective?.id ?? person?.id}`;
  if (why === 'quest') return `quest:${quests?.pendingOpener?.()?.id ?? person?.id}`;
  return null;
}

/** Does `person` get a balloon now (balloonReason)? */
export const hasBalloon = (person, ctx) => !!balloonReason(person, ctx);
