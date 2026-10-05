// A scratch look at the desert's story objects (development aid for the exporter).
import { buildDesertWorld } from './build-world.mjs';
const W = await buildDesertWorld();
const Q = W.level.qanat;
console.log('fires', Q.fires.length, Q.fires[0] && Object.keys(Q.fires[0]), Q.fires[0]?.constructor?.name);
console.log('city.flames', Q.city.flames.constructor.name, Q.city.flames.width, Q.city.flames.height, Q.city.flames.group?.position, Q.city.flames.group?.parent?.type);
console.log('camps.fires', Q.camps.fires.length, Q.camps.fires[0]);
console.log('embers', Q.city.embers?.constructor?.name, 'smoke', Q.city.smoke?.constructor?.name);
console.log('box', W.boxes.list.map((b) => [b.id, b.item, b.pos, b.yaw]));
console.log('ledge', Object.keys(Q.city.ledge));
console.log('ship', W.ship.site, W.ship.rampFoot);
const dyn = []; W.scene.traverse((o) => { if (o.userData.dynamic) dyn.push(o.type + ':' + (o.name || o.parent?.name)); });
console.log('dynamic', dyn.length, dyn.slice(0, 20));
console.log('story roots', W.storyRoots.map((r) => `${r.type}:${r.name}@${r.position.x.toFixed(0)},${r.position.z.toFixed(0)}`).join(' '));
console.log('spawn', W.level.spawn, 'bike', W.bike.pos, W.bike.dormant);
