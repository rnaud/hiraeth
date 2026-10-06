// 48 seconds across six worlds: fire, city, flight, machinery, deep wood, garden.
// Nine locked compositions, drawn from the reference sheets; three camera moves provide contrast.
export const SHOTS = [
  { name: 'The traveller', world: 'desert', scene: 'horizon', duration: 5, from: [0, 7.9, 0], to: [0, 7.9, 0], look: [0, 9, -180], fov: 46, fade: 0.6, actors: [{ kind: 'hero', from: [-3, 0, -9], to: [0.1, 0, -16.8], heading: 2.76, groundRelative: true }] },
  { name: 'The burning crown', world: 'desert', duration: 4, from: [135, 40, 288], to: [135, 40, 288], look: [246, 38, 402], fov: 62 },
  { name: 'The City-Shaft', world: 'shaft', scene: 'shaft', duration: 5, from: [0, 0, 0], to: [0, 0, 0], look: [0, -27, -65], fov: 66, actors: [
    { kind: 'taxi', from: [-5, -5, -10], to: [-5, -12, -80], color: '#e99b53', scale: 2 },
    { kind: 'taxi', from: [5, -20, -95], to: [5, -13, -10], color: '#88baba', scale: 1.8 },
    { kind: 'taxi', from: [-6, -32, -15], to: [-6, -40, -95], color: '#f1ddad', scale: 2.3 },
    { kind: 'taxi', from: [6, -49, -95], to: [6, -42, -20], color: '#da7966', scale: 1.5 },
    { kind: 'taxi', from: [-5, -70, -20], to: [-5, -72, -95], color: '#c5cbbb', scale: 2 },
    { kind: 'taxi', from: [5, -84, -95], to: [5, -79, -20], color: '#e5a657', scale: 1.8 },
    { kind: 'taxi', from: [-3, 5, -100], to: [-3, 20, -50], color: '#f1e5ca', scale: 1.5 },
    { kind: 'taxi', from: [4, 22, -50], to: [4, 5, -95], color: '#8aaca9', scale: 1.7 },
  ] },
  { name: 'Across the dunes', world: 'desert', duration: 4, from: [3, 1.2, 95], to: [3, 1.2, 95], look: [0, 2, 100], fov: 52, groundRelative: true, actors: [{ kind: 'hero', mount: 'bike', from: [-18, 1.2, 100], to: [18, 1.2, 100], groundRelative: true }] },
  { name: 'On the wing', world: 'arzach2', duration: 5, from: [66, 113, 138], to: [-74, 118, -42], look: [60, 110, 130], lookTo: [-80, 115, -50], bird: [[60, 110, 130], [-80, 115, -50]], actors: [{ kind: 'hero', mount: 'bird', from: [0, 0, 0], to: [0, 0, 0] }, { kind: 'flock', size: 0.5, count: 9, from: [76, 115, 100], to: [-102, 118, -35] }], fov: 43, linear: true },
  { name: 'The sphere and the lake', world: 'spheres', scene: 'garden', duration: 3, from: [0, 3, 0], to: [0, 3, 0], look: [0, 8, -50], fov: 58 },
  { name: 'The buried machine', world: 'buried', duration: 4, from: [1, -27.5, -249], to: [1, -27.5, -249], look: [-3.2, -27.5, -254.3], fov: 55, actors: [{ kind: 'hero', clip: 'climbUp', heading: 2.94, from: [-3.11, -31, -254.75], to: [-3.11, -27, -254.75] }] },
  { name: 'Beyond the grove', world: 'spheres', scene: 'grove', duration: 4, from: [0, 1.7, 0], to: [0, 1.7, -3], look: [0, 13, -60], fov: 56 },
  { name: 'The glowing stream', world: 'perdide2', scene: 'stream', duration: 3, from: [0, 1.7, 0], to: [0, 1.7, 0], look: [0, 2.7, -50], fov: 50 },
  { name: 'The mushroom canopy', world: 'perdide2', duration: 4, from: [-17, 3, -115], to: [-13, 4, -138], look: [-50, 20, -160], lookTo: [-45, 48, -165], fov: 78 },
  { name: 'The mirror lake', world: 'spheres', duration: 3, from: [190, 3, -45], to: [190, 3, -45], look: [190, 8, -130], fov: 64, actors: [{ kind: 'flock', from: [125, 9, -85], to: [250, 12, -85] }] },
  { name: 'A sea of stone', world: 'arzach2', duration: 4, from: [20, 75, 90], to: [20, 75, 90], look: [-40, 80, -60], bird: [[-80, 85, 58], [85, 87, 58]], actors: [{ kind: 'hero', mount: 'bird', from: [0, 0, 0], to: [0, 0, 0] }, { kind: 'flock', size: 0.8, count: 11, from: [65, 80, 53], to: [-65, 89, 35] }], fov: 70, linear: true, fade: 0.6 },
];
export const DURATION = SHOTS.reduce((n, s) => n + s.duration, 0);
export function frameAt(seconds) {
  const time = Math.max(0, Math.min(DURATION, Number.isFinite(seconds) ? seconds : 0));
  let start = 0;
  for (let index = 0; index < SHOTS.length; index++) {
    const shot = SHOTS[index];
    if (time < start + shot.duration || index === SHOTS.length - 1) {
      const local = time - start, progress = local / shot.duration;
      const ease = shot.linear ? progress : progress * progress * (3 - 2 * progress);
      const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * ease);
      const transition = shot.fade ?? 0.12;
      return { shot, index, local, progress, position: mix(shot.from, shot.to), look: mix(shot.look, shot.lookTo ?? shot.look),
        bird: shot.bird ? mix(...shot.bird) : null,
        fade: Math.max(0, 1 - local / transition, (local - shot.duration + transition) / transition) };
    }
    start += shot.duration;
  }
}

export function actorPosition(cue, progress) {
  const u = Math.max(0, Math.min(1, (progress - (cue.start ?? 0)) / ((cue.end ?? 1) - (cue.start ?? 0))));
  if (u === 0) return [...cue.from];
  if (u === 1) return [...cue.to];
  return cue.from.map((v, i) => v + (cue.to[i] - v) * u);
}
