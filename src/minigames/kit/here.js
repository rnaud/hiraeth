// A helping game played in the world that asked for it, with no page of its own between (issue #789: "There should be
// no loading screen between the desert house and the keeper game"). The Rose House's Keeper asks for Cistern channels
// as its ending (src/temples/endings.js); its game used to be a page of its own (?game=cistern&encounter=…), a loading
// screen each way. Here the game's own court is built into the world's scene for the run, far over the world at its
// `here[world]` (the court's group: the session's ctx.scene; level.at: where it stands), the runner made as a trial's
// is (main.js, engine/trials.js: `open`), and the way back is the receipt's as before (src/temples/helper-encounter.js):
// Quit and the win mark it, the world's temple takes it back on the next frame (the pose restored, the ending played).
// Nothing here loads a level or changes the world's: the court is made and let go with the run.
//
//   const here = helperHere({ levelId, scene, level, game, open: (def, host) => runner | null, byId? (the games: node has no glob) });
//   here.play(href) → bool    the story's playGame first: true when the game is played here (else the page as before)
//   here.running              a run here is on (the save keeps the place in the house, not the court's)

import * as THREE from 'three';
import { gameById } from '../index.js';
import { helperRun, holdHelperReturn } from '../../temples/helper-encounter.js';
import { disposeTree } from './dispose.js';

/** A game page's address read: { game, from, encounter } (no URLSearchParams in an engine's VM). */
export function readGameHref(href) {
  const q = {};
  for (const kv of String(href ?? '').replace(/^[^?]*\?/, '').split('&')) { const [k, v = ''] = kv.split('='); if (k) q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
  return { game: q.game ?? null, from: q.from ?? null, encounter: q.encounter ?? null };
}

/** Where a game is built when it is played in this world (def.here: { [world]: [x, y, z] }), or null. */
export function hereAt(def, levelId) {
  const at = def?.here?.[levelId];
  return Array.isArray(at) && at.length === 3 && at.every(Number.isFinite) ? at : null;
}

/** The game's own build (a generator: its arena), run through in one go into `root`. */
function buildInto(def, root) {
  const gen = def.build(root, { here: true });
  for (;;) { const s = gen.next(); if (s.done) return s.value; }
}

export function helperHere({ levelId, scene, level, game, open, byId = gameById, log = (e) => console.warn(e) }) {
  let run = null;
  const end = () => {
    if (!run) return;
    const { root } = run;
    run = null;
    holdHelperReturn(game, false);
    disposeTree(root);
    root.removeFromParent();
  };
  return {
    get running() { return !!run; },
    play(href) {
      if (run) return false;
      const q = readGameHref(href), def = byId(q.game), at = hereAt(def, levelId);
      if (!at || q.from !== levelId || !q.encounter || typeof def.build !== 'function') return false;
      const helper = helperRun(game, def.id, q.encounter);
      if (!helper || helper.recoveryHref()) return false;   // (a receipt already won or left: the temple takes it back)
      const root = new THREE.Group();
      root.name = `${def.id} (played here)`;
      root.position.fromArray(at);
      scene.add(root);
      let built;
      try { built = buildInto(def, root); } catch (e) { log(e); disposeTree(root); root.removeFromParent(); return false; }
      root.updateMatrixWorld(true);
      // (the session's level: the court's, where it stands, and the world's list of what casts no shadow, read live:
      // main.js may give the world's level a new list while the run is on)
      const court = { ...built, at: root.position.clone() };
      Object.defineProperty(court, 'noShadow', { get: () => (level.noShadow ??= []), set: (v) => { level.noShadow = v; }, enumerable: true });
      run = { root };
      holdHelperReturn(game, true);
      let runner = null;
      try {
        runner = open(def, { scene: root, level: court, from: levelId, helper: helper.context, links: helper.links,
          onResult: (r) => helper.onResult(r), completionHref: (r) => helper.completionHref(r), recoveryHref: () => null,
          navigate: () => { helper.left(); end(); } });
      } catch (e) { log(e); runner = null; }
      if (!runner) { end(); return false; }
      run.runner = runner;
      return true;
    },
    dispose() { if (run?.runner && !run.runner.ended) run.runner.end(); end(); },
  };
}
