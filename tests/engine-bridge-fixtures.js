/** A backend that records every op. */
export function recorder() {
  const log = [];
  const rec = (op) => (...a) => log.push([op, ...a]);
  return {
    log,
    ops: (op) => log.filter((e) => e[0] === op),
    backend: {
      geometry: rec('geometry'), material: rec('material'), create: rec('create'), visible: rec('visible'), remove: rec('remove'), camera: rec('camera'), frame: rec('frame'),
      instances: (id, count, mats) => log.push(['instances', id, count, Float32Array.from(mats.subarray(0, count * 16))]),
      transforms: (ids, mats, n) => log.push(['transforms', Array.from(ids.subarray(0, n)), Float32Array.from(mats.subarray(0, n * 16))]),
    },
  };
}

