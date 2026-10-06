// A small, scheduled effects track shares the music clock, including pause/resume.
export function scheduleFoley(ctx, out, shots, start) {
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0); let seed = 41;
  for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
  function breath(time, duration, frequency, volume) {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter).connect(gain).connect(out); source.start(time); source.stop(time + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  let offset = 0;
  for (const shot of shots) {
    const hero = shot.actors?.find(a => a.kind === 'hero'), time = start + offset;
    if (hero?.mount === 'bike') {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(115, time);
      oscillator.frequency.linearRampToValueAtTime(165, time + shot.duration * 0.5);
      oscillator.frequency.exponentialRampToValueAtTime(65, time + shot.duration);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.13, time + shot.duration * 0.5);
      gain.gain.linearRampToValueAtTime(0, time + shot.duration);
      pan.pan.setValueAtTime(0.8, time); pan.pan.linearRampToValueAtTime(-0.8, time + shot.duration);
      oscillator.connect(gain).connect(pan).connect(out); oscillator.start(time); oscillator.stop(time + shot.duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
      breath(time, shot.duration, 650, 0.14);
    } else if (hero?.mount === 'bird') {
      for (let t = 0.25; t < shot.duration - 0.5; t += Math.PI / 3) breath(time + t, 0.45, 420, 0.13);
    } else if (hero?.clip === 'climbUp') {
      for (let t = 0.3; t < shot.duration - 0.2; t += 0.55) breath(time + t, 0.13, 1300, 0.16);
    }
    offset += shot.duration;
  }
}
