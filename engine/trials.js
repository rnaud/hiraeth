// The trials and the games for an engine (docs/systems/engine-bridge.md, "The trials and games"; issue #264): what
// main.js makes for them, made from the same modules. In a world: its challenges (src/trials/: the mastery trial and
// the makers' runs, their signs, wind columns and courses), the signs of the games played elsewhere (a game's
// `markers`, src/minigames/kit/marker.js), and every sign's host, stood by the story (src/minigames/kit/hosts.js). A
// trial's Play makes a MinigameRunner (src/minigames/kit/runner.js) played here on foot, as main.js's `open`; a game's
// Play asks the engine for the game's own page (`onGame`: the Unity bridge starts again on it, as the page goes to
// ?game=<id>&from=<world>). On a game's page (`def`), the runner is made at once and its Quit goes back (`onLeave`).
//
// The runner's HUD is the screen's 'minigame' part (BridgeHud.cs); its card (the start card, the pause, the results)
// is engine/menus.js's 'card', kept in step with the runner here (`sync`, each frame before the menus hold the world).
//
//   const trials = makeTrials({ levelId, scene, physics, level, player, camera, rig, sound, story, menus, … });
//   trials.sync();                        each frame, first: the card open while the runner has one up
//   trials.padAction(name) → bool         the pad's actions, before the game's own (Menu pauses a run)
//   trials.filterInput(ctl)               a run on foot's own buttons (the Sunken Hall: no jump)
//   trials.update(dt, ctl)                the run, after the camera (drives: false) or instead of the traveller (drives)
//   trials.world(dt, t)                   the wind columns, the courses' moving pieces, the signs' lamps
import { createChallenges } from '../src/trials/index.js';
import { MODES } from '../src/trials/course.js';
import { ITEMS } from '../src/items.js';
import { GAMES, gameById } from '../src/minigames/index.js';
import { placeGameMarker } from '../src/minigames/kit/marker.js';
import { queueHost, takeHosts } from '../src/minigames/kit/hosts.js';
import { MinigameRunner } from '../src/minigames/kit/runner.js';
import { gameLinks } from '../src/minigames/kit/arcade.js';
import { partsOf, shiftAt } from '../src/levels/names.js';
import { inputKind } from '../src/prompt-keys.js';
import * as THREE from 'three';

/** A game page's address (?game=<id>&from=<world>, ?level=<id>, ?worlds=1) as { game, from, level, back, to, via, stage } (to: the world the pirates' fight is on the way to, src/ambush.js; stage: the pirates' level, issue #555). */
export function readHref(href) {
  // (no URLSearchParams in an engine's VM)
  const q = {};
  for (const kv of String(href ?? '').replace(/^[^?]*\?/, '').split('&')) { const [k, v = ''] = kv.split('='); if (k) q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
  return { game: q.game ?? null, from: q.from ?? null, level: q.level ?? null, back: q.back ?? null, to: q.to ?? null, via: q.via ?? null, stage: q.stage ?? null };
}

export function makeTrials({ levelId, scene, physics, level, player, camera, rig, sound, wind = null, tool = null, foes = null, chimes = null, npcs = [], crowd = null, wildlife = null, flora = null,
  people = null, story = null, menus = null, items, game, toast = () => {}, waters = null, kick = null, settings = null, ship = null, def = null, from = null, onGame = null, onLeave = null, thresholds = null, transit = null, log = () => {} }) {
  let runner = null;
  const host = (extra) => ({ scene, camera, player, physics, level, sound, wind, state: game, kick, tool, foes, rig, settings, chimes,
    npcs, crowd, wildlife, flora, people, capture: null, othersOpen: () => !!menus?.open && menus.mode !== 'card', ...extra });
  let challenges = null;
  if (def) {
    // a game's page: the runner takes over at once (main.js: the start card up), the world's story set aside
    runner = new MinigameRunner(def, host({ ship, from, links: transit?.links ?? gameLinks(def, level, from),   // (from the Arcade: back to it, the game before / after, as main.js; a game's own: the pirates' next place)
      onResult: transit ? (r) => transit.onResult(r) : null,
      navigate: (href) => { transit?.left(); runner = null; onLeave?.(href); } }));
    story?.beacon?.removeFromParent?.();
    if (story) story.done = true;
  } else {
    // the world's challenges, as main.js makes them: a sign's Play opens the run here (Quit leaves you where it did)
    challenges = createChallenges({ levelId, scene, physics, level, player, items, game, foes, npcs, sound, notice: (t) => toast(t), host: story ? queueHost : null,
      surfaceAt: waters ? (x, z, y, below) => waters.surfaceAt(x, z, y, below) : null,
      open: (d) => {
        if (runner) return false;
        runner = new MinigameRunner(d, host({ ship: null, from: null, navigate: () => { runner = null; } }));
        return true;
      } });
    // the signs of the games played on their own pages (a merged world's parts' too), each Play the engine's to start
    for (const g of GAMES) for (const m of g.markers ?? []) {
      if (!partsOf(levelId).includes(m.level)) continue;
      const [x, y, z] = shiftAt(m.level, m.at), gy = y ?? physics.groundAt(x, 1e4, z);
      try {
        placeGameMarker({ scene, levelId, lights: (level.lights ??= []), physics, thresholds, go: (href) => onGame?.(href) }, g.id, new THREE.Vector3(x, Number.isFinite(gy) ? gy : 0, z),
          { heading: m.heading ?? 0, ...(story ? {} : { host: false }) });
      } catch (e) { log(`the ${g.id} sign: ${e?.message ?? e}`); }
    }
    // their hosts (issue #248): each sign's person, or its post, offers it
    for (const spot of takeHosts()) { try { story?.host?.(spot); } catch (e) { log(`the host of ${spot.id}: ${e?.message ?? e}`); } }
  }
  const T = {
    challenges,
    /** The run under way (a MinigameRunner), or null. */
    get runner() { return runner; },
    get running() { return !!runner; },
    /** The runner moves the traveller and the camera itself (a game that drives), not the usual play. */
    get drives() { return !!runner?.drives; },
    /** A trial in the world: the gadgets stay in hand (the fan into the skiff's sail). */
    get keepsGadgets() { return !runner || !!runner.def.trial; },
    busy: () => !!runner?.busy(),
    /**
     * A trial or makers' run of this world opened on its start card (a test's, the bridge's -trial), as its host's Play;
     * `grant`: the gadgets it wants (and its prize's) given first (a plan's debug save has none).
     */
    open(id, { grant = false } = {}) {
      const w = challenges?.byId(id) ?? challenges?.list?.find((x) => x.trial.world === id || x.trial.id === `trial-${id}`) ?? null;
      if (!w) return false;
      if (grant) for (const n of [...(MODES[w.trial.mode]?.needs ?? []), ...(w.trial.needs ?? []), ITEMS[w.trial.reward]?.needs].filter(Boolean)) if (!n.includes(':') && n !== 'jets' && !items.has(n)) items.grant(n);
      return w.try();
    },
    /** The card kept in step with the runner (engine/menus.js openCard), before the menus hold the world. */
    sync() {
      const R = runner, M = R?.cardModel;
      if (R && R.phase === 'intro' && M && inputKind() !== R.introKind) R.showIntro();   // (a pad picked up: the card lists its buttons)
      if (!menus?.openCard) return;
      if (menus.mode === 'card' && (menus.card?.runner !== R || !M)) menus.close();
      else if (menus.mode === 'card') menus.cardSync();
      else if (M && !menus.open) menus.openCard(R);
    },
    /** The pad's action while a run is on (main.js: the runner first, unless a menu of the game's own is up). */
    padAction(name) { return !!runner && !menus?.open && runner.padAction(name); },
    filterInput(ctl) { if (runner && !runner.drives) runner.filterInput(ctl); },
    update(dt, ctl) { runner?.update(dt, ctl); },
    world(dt, t) { challenges?.update(dt, t); },
    /** A game's page: where its Quit goes (?level=<from>, or the worlds). */
    def,
  };
  return T;
}

export { gameById };
