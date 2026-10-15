// A fitted skin's colours where its texture can't be drawn (issue #264): the engines' VMs decode no JPEG, so a guardian's
// generated skin (the Keeper's, the Elder's) came out white in the Unity build. Its loader passes the loaded GLB here
// with its folder; on the web nothing is set and it goes on as it is. engine/game.js sets the engines' way: the colours
// sampled from its texture at each vertex (public/<folder>/colors.json, scripts/tripo/sample-colors.mjs) put on as
// vertex colours, display values, as the texture would have shown them.
//
//   setSkinColours(async (gltf, folder) => gltf)   the engines' (once, before a world is built)
//   skinColours(gltf, folder) → Promise<gltf>       the loaders' (src/characters/keeper-creature.js, elder-v3-creature.js)

let hook = null;
export function setSkinColours(fn) { hook = fn; }
export function skinColours(gltf, folder) { return hook ? Promise.resolve(hook(gltf, folder)).then(() => gltf, () => gltf) : gltf; }
