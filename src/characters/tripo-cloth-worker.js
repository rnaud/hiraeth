// The traveller's overshirt simulated off the main thread (src/characters/tripo-cloth-sim.js).
import { clothWorkerHandler } from './tripo-cloth-sim.js';

const handle = clothWorkerHandler();
self.onmessage = ({ data }) => {
  const r = handle(data);
  if (r) self.postMessage(r, [r.P.buffer, r.G.buffer]);
};
