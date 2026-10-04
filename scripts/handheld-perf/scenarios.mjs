// Where each measurement loads and stands (setup runs in the page once the world is up).
const go = (expr, off = [6, 0, 6]) => `(() => {
  const at = (${expr}); if (!at) return 'no place';
  const p = new THREE.Vector3(at.x + ${off[0]}, at.y + 40, at.z + ${off[2]});
  const y = physics.groundAt(p.x, p.y, p.z, 400);
  p.y = (Number.isFinite(y) ? y : at.y) + 1.2;
  player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
  return p.toArray().map(Math.round);
})()`;
const spawn = `(() => { const p = level.spawn.clone(); p.y += 0.3; const h = level.spawnHeading ?? 0;
  player.teleport(p, new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(h), 0, Math.cos(h))); return p.toArray().map(Math.round); })()`;
/** the first Vector3 called `key` in the level object (a few levels deep) */
const find = (key) => `(() => { const seen = new Set(); const f = (o, d) => { if (!o || typeof o !== 'object' || seen.has(o) || d > 4) return null; seen.add(o);
  if (o[${JSON.stringify(key)}]?.isVector3) return o[${JSON.stringify(key)}]; for (const v of Object.values(o)) { const r = f(v, d + 1); if (r) return r; } return null; }; return f(level, 0); })()`;

export const SCENARIOS = {
  title: { q: '', settle: 8000, walk: false, turn: 0, title: true },              // the 3D view behind the menu
  ship: { q: 'level=desert&prologue=1', settle: 26000 },                         // the prologue, inside the ship
  desert: { q: 'level=desert', setup: go('level.spawn', [-40, 0, -60]) },         // open dunes
  qanat: { q: 'level=desert', setup: go(find('treeBase'), [10, 0, 4]) },          // Qanat, by the burning tree
  incal: { q: 'level=incal', setup: spawn },                                      // the City-Shaft's rim
  shaft: { q: 'level=incal', setup: go('level.shaft.places.shrine', [0, 0, 0]) }, // the bottom terrace
  ...Object.fromEntries(['arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar'].map((id) => [id, { q: `level=${id}`, setup: spawn }])),
};
