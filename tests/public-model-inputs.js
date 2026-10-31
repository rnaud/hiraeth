// Complete public model inputs for native texture tests. The companion test
// discovers new models independently so this catalogue cannot silently omit one.
import { readFileSync } from 'node:fs';
const READERS = {
  "anim/gestures.glb": () => readFileSync(new URL("../public/anim/gestures.glb", import.meta.url)),
  "anim/human_f.glb": () => readFileSync(new URL("../public/anim/human_f.glb", import.meta.url)),
  "anim/human_m.glb": () => readFileSync(new URL("../public/anim/human_m.glb", import.meta.url)),
  "anim/locomotion.glb": () => readFileSync(new URL("../public/anim/locomotion.glb", import.meta.url)),
  "anim/moves.glb": () => readFileSync(new URL("../public/anim/moves.glb", import.meta.url)),
  "anim/sprint-kevin.glb": () => readFileSync(new URL("../public/anim/sprint-kevin.glb", import.meta.url)),
  "anim/traveller.glb": () => readFileSync(new URL("../public/anim/traveller.glb", import.meta.url)),
  "anim/ual.glb": () => readFileSync(new URL("../public/anim/ual.glb", import.meta.url)),
  "anim/walks.glb": () => readFileSync(new URL("../public/anim/walks.glb", import.meta.url)),
  "characters/father-v1/model.glb": () => readFileSync(new URL("../public/characters/father-v1/model.glb", import.meta.url)),
  "characters/traveller-b3/model.glb": () => readFileSync(new URL("../public/characters/traveller-b3/model.glb", import.meta.url)),
  "characters/traveller-v1/head-v3/model.glb": () => readFileSync(new URL("../public/characters/traveller-v1/head-v3/model.glb", import.meta.url)),
  "enemies/hound/body.glb": () => readFileSync(new URL("../public/enemies/hound/body.glb", import.meta.url)),
  "enemies/bellows-toad/body.glb": () => readFileSync(new URL("../public/enemies/bellows-toad/body.glb", import.meta.url)),
  "enemies/centipede/body.glb": () => readFileSync(new URL("../public/enemies/centipede/body.glb", import.meta.url)),
  "enemies/skitter/body.glb": () => readFileSync(new URL("../public/enemies/skitter/body.glb", import.meta.url)),
  "enemies/tripod/body.glb": () => readFileSync(new URL("../public/enemies/tripod/body.glb", import.meta.url)),
  "enemies/drone/body.glb": () => readFileSync(new URL("../public/enemies/drone/body.glb", import.meta.url)),
  "enemies/crawler/body.glb": () => readFileSync(new URL("../public/enemies/crawler/body.glb", import.meta.url)),
  "enemies/blot/body.glb": () => readFileSync(new URL("../public/enemies/blot/body.glb", import.meta.url)),
  "enemies/worm/body.glb": () => readFileSync(new URL("../public/enemies/worm/body.glb", import.meta.url)),
  "enemies/rootknot/body.glb": () => readFileSync(new URL("../public/enemies/rootknot/body.glb", import.meta.url)),
  "enemies/wisp/body.glb": () => readFileSync(new URL("../public/enemies/wisp/body.glb", import.meta.url)),
  "enemies/shellback/body.glb": () => readFileSync(new URL("../public/enemies/shellback/body.glb", import.meta.url)),
  "enemies/dunemummer/body.glb": () => readFileSync(new URL("../public/enemies/dunemummer/body.glb", import.meta.url)),
  "enemies/woodcutter/body.glb": () => readFileSync(new URL("../public/enemies/woodcutter/body.glb", import.meta.url)),
  "enemies/storm-ray/body.glb": () => readFileSync(new URL("../public/enemies/storm-ray/body.glb", import.meta.url)),
  "enemies/lamp-moth/body.glb": () => readFileSync(new URL("../public/enemies/lamp-moth/body.glb", import.meta.url)),
  "enemies/cloud-jelly/body.glb": () => readFileSync(new URL("../public/enemies/cloud-jelly/body.glb", import.meta.url)),
  "enemies/cart/body.glb": () => readFileSync(new URL("../public/enemies/cart/body.glb", import.meta.url)),
  "enemies/bell/body.glb": () => readFileSync(new URL("../public/enemies/bell/body.glb", import.meta.url)),
  "enemies/roller/body.glb": () => readFileSync(new URL("../public/enemies/roller/body.glb", import.meta.url)),
  "enemies/mummerking/body.glb": () => readFileSync(new URL("../public/enemies/mummerking/body.glb", import.meta.url)),
  "enemies/sentinel/body.glb": () => readFileSync(new URL("../public/enemies/sentinel/body.glb", import.meta.url)),
  "enemies/hulk/body.glb": () => readFileSync(new URL("../public/enemies/hulk/body.glb", import.meta.url)),
  "enemies/prowler/body.glb": () => readFileSync(new URL("../public/enemies/prowler/body.glb", import.meta.url)),
  "guardians/elder-v3/model.glb": () => readFileSync(new URL("../public/guardians/elder-v3/model.glb", import.meta.url)),
  "guardians/keeper-v1/model.glb": () => readFileSync(new URL("../public/guardians/keeper-v1/model.glb", import.meta.url)),
  "models/ships/caravan-a/playable.glb": () => readFileSync(new URL("../public/models/ships/caravan-a/playable.glb", import.meta.url)),
};
export const PUBLIC_MODELS = Object.freeze(Object.keys(READERS));
export function readPublicModel(path) {
  if (!Object.hasOwn(READERS, path)) throw Error('Undeclared public model: ' + path);
  return READERS[path]();
}
