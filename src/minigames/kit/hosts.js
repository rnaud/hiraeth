// The hosts of the games in the worlds (issue #248; docs/systems/minigames.md "The hosts"). A game's sign in a world
// (kit/marker.js), a trial's or a makers' run's (src/trials/index.js) no longer starts anything when pressed: it asks
// for its host (src/story/hosts-data.js HOSTS), and the story (src/story/index.js `host`) stands them beside it, a
// person who tells you in a line or two what it is and offers it, Play or Not now (or, where nobody could stand, the
// sign itself, read: a makers' post, a buoy on the water). Play does what the sign did.
//
//   queueHost({ id, name, at, heading, play, enabled?, whileRiding? })   a sign wants its host (built before the story is)
//   takeHosts() → the spots asked for so far (main.js hands them to the story, once it is up)
//   hostTalk(host, play, later) → the person or thing's talk: its lines, then Play / Not now
//   hostStand(at, heading, stand) → where the person stands: beside the sign, a little in front of it

import * as THREE from 'three';
import { HOSTS } from '../../story/hosts-data.js';

export { HOSTS };
const queue = [];

/** The host of a game, a trial or a makers' run (its id), or null. */
export const hostOf = (id) => HOSTS[id] ?? null;

/** A sign wants its host: kept until the story takes them (takeHosts). */
export function queueHost(spot) { if (hostOf(spot.id)) queue.push(spot); return !!hostOf(spot.id); }
/** The signs waiting for their hosts, taken. */
export function takeHosts() { return queue.splice(0); }

/**
 * Where a host stands: 1.5 m beside the sign (its `stand.side`: 1 to its right as you face it, -1 its left) and
 * `stand.ahead` m toward you (0.5), facing you.
 */
export function hostStand(at, heading = 0, { side = 1, ahead = 0.5 } = {}, out = new THREE.Vector3()) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  return out.set(at.x - fz * 1.5 * side + fx * ahead, at.y, at.z + fx * 1.5 * side + fz * ahead);
}

/**
 * The host's talk (a src/story/dialogue.js person): their lines, then Play (`play`, once the talk has closed: `later`)
 * or Not now. `name`: the game's, for the prompt ("ask Darro about the canyon run").
 */
export function hostTalk(host, play, { later = (f) => f(), name = '' } = {}) {
  const { say, lines, object, prompt, stand, ...person } = host;
  const game = name ? name.replace(/^The /, 'the ') : '';
  return {
    ...person,
    lines: lines ?? ['~neutral~ …'],
    // ("ask Darro about the canyon run", "ask Yusra about fishing": a game named for what you do takes no "the")
    prompt: prompt ?? (game ? `ask ${host.name} about ${/^the /.test(game) ? game : /ing$/i.test(game) ? game.toLowerCase() : `the ${game.toLowerCase()}`}` : undefined),
    talk: {
      nodes: {
        offer: {
          say,
          choices: [
            { text: '~happy~ Play.', do: () => later(play), end: true },
            { text: '~neutral~ Not now.', end: true },
          ],
        },
      },
    },
  };
}
