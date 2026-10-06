using System;
using UnityEngine;

namespace Memento.Bridge
{
    /// <summary>
    /// The game's sound in Unity (docs/systems/engine-bridge.md, "Sound"): the web game's own synthesis
    /// (src/audio.js) runs in the VM on the Web Audio shim (engine/webaudio.js), which renders stereo PCM;
    /// each frame the script hands the next frames over (BridgeHost.Audio) to keep this ring a little
    /// ahead, and Unity's audio thread plays it from OnAudioFilterRead on a clip-less AudioSource.
    /// Muted (batch runs, or -mute on a player's command line): nothing reaches Unity's audio, the ring
    /// is drained on the main thread at the output rate instead, and its level is counted for the log.
    /// </summary>
    [RequireComponent(typeof(AudioSource))]
    public class BridgeAudio : MonoBehaviour
    {
        public bool muted;
        public int rate;
        float[] ring = new float[2 * 48000];   // a second of stereo
        int head, count;                        // (in floats; guarded by the lock)
        readonly object gate = new object();
        float[] scratch = new float[0];
        // what was played: for the log
        public long framesIn, framesOut, underruns; double sumSq; long sumN;
        double drainCarry;

        void Awake()
        {
            rate = AudioSettings.outputSampleRate > 0 ? AudioSettings.outputSampleRate : 48000;
            ring = new float[2 * rate];
        }

        public void Begin(bool mute)
        {
            muted = mute;
            var src = GetComponent<AudioSource>();
            src.playOnAwake = false; src.spatialBlend = 0; src.loop = true; src.volume = 1;
            if (!muted) src.Play();
        }

        /// <summary>Frames the ring holds now (what the script tops up to its lead).</summary>
        public int Queued { get { lock (gate) return count / 2; } }

        /// <summary>The script's next PCM: float32 stereo interleaved.</summary>
        public void Push(byte[] bytes, int n)
        {
            int floats = n / 4;
            if (floats <= 0) return;
            if (scratch.Length < floats) scratch = new float[floats];
            Buffer.BlockCopy(bytes, 0, scratch, 0, floats * 4);
            lock (gate)
            {
                int cap = ring.Length;
                floats = Math.Min(floats, cap - count) & ~1;   // (a full ring drops the newest: the script ran ahead)
                int w = (head + count) % cap;
                int first = Math.Min(floats, cap - w);
                Array.Copy(scratch, 0, ring, w, first);
                if (floats > first) Array.Copy(scratch, first, ring, 0, floats - first);
                count += floats;
                framesIn += floats / 2;
            }
        }

        int Pull(float[] data, int channels, int frames)
        {
            int got;
            lock (gate)
            {
                got = Math.Min(frames, count / 2);
                int cap = ring.Length;
                for (int i = 0; i < got; i++)
                {
                    float l = ring[head], r = ring[(head + 1) % cap];
                    head = (head + 2) % cap;
                    if (data != null)
                    {
                        int o = i * channels;
                        data[o] = l; if (channels > 1) data[o + 1] = r;
                        for (int c = 2; c < channels; c++) data[o + c] = 0;
                    }
                    sumSq += l * l + r * r; sumN += 2;
                }
                count -= got * 2;
                framesOut += got;
                if (got < frames && framesIn > 0) underruns++;
            }
            return got;
        }

        void OnAudioFilterRead(float[] data, int channels)
        {
            if (muted) return;
            int frames = data.Length / channels;
            int got = Pull(data, channels, frames);
            if (got < frames) Array.Clear(data, got * channels, (frames - got) * channels);
        }

        void Update()
        {
            if (!muted) return;
            // (muted: the ring drained as Unity's output would, so the script renders just as much)
            drainCarry += Time.unscaledDeltaTime * rate;
            int frames = (int)drainCarry;
            drainCarry -= frames;
            if (frames > 0) Pull(null, 2, Math.Min(frames, rate));
        }

        /// <summary>For the log: the frames that came and went, the gaps, the level (RMS) of what was played.</summary>
        public string Report()
        {
            lock (gate)
            {
                double rms = sumN > 0 ? Math.Sqrt(sumSq / sumN) : 0;
                return $"{{\"rate\":{rate},\"muted\":{(muted ? "true" : "false")},\"in\":{framesIn},\"out\":{framesOut},\"underruns\":{underruns},\"rms\":{rms:0.00000}}}";
            }
        }
    }
}
