const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
export const backend = new Proxy({}, { get: (_, k) => UNSET.has(k) ? undefined : () => {} });
export async function quiet(fn) {
  const saved = Object.fromEntries(['warn', 'info', 'log', 'error'].map(k => [k, console[k]]));
  try { for (const k of Object.keys(saved)) console[k] = () => {}; return await fn(); }
  finally { Object.assign(console, saved); }
}

