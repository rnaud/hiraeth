// A temple's skin (issue #342): its look inside, never its layout. A house opts in with `skin: <a skin>` on its def,
// a skin being a function (rt) => ({ dress?, done?, brazier? }) from its own module in this folder:
//   called before the layout: it may set rt.kit.plan = [] (the kit then records its walls, halls, round rooms and
//   corridors) and swap rt.M / rt.kit.M's materials for its own;
//   dress(): after the layout, before the kit's flush: its drawn-only dressing (no collision, kept off doorways and pieces);
//   done(): after the flush: puts the house's own materials back (the exterior is built after);
//   brazier(piece, s): draws a brazier's body (returns true), its fire and logic untouched (pieces.js Brazier).
// The same rooms, doors, collision, pieces, timings and logic with and without it (tests/temple-skins.test.js).

/** The skin the house wears (its hooks, rt.skin), or null: none, or switched off (rt.noSkin, ?noskin=1). */
export function houseSkin(rt) {
  const make = rt.def?.skin;
  rt.skin = null;
  if (typeof make !== 'function' || rt.noSkin || (typeof location !== 'undefined' && /[?&]noskin=1/.test(location.search))) return null;
  rt.skin = make(rt) ?? null;
  return rt.skin;
}
