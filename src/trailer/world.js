// Cinematic cameras must be passed through: the world uses their frustum to update
// fire, smoke and banners. A fixed simulation time also makes review seeks repeatable.
export function updateTrailerWorld(level, seconds, dt, camera) {
  const flame = level.qanat?.city?.flames;
  level.update?.(dt, seconds, { camera });
  if (flame) {
    // The trailer holds the fire at its authored intensity; seeking is independent of prior frames.
    flame.time = seconds * (0.8 + 0.35 * flame.intensity) * flame.pace;
    flame.update(0);
  }
}
