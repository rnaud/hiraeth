namespace Memento
{
    /// <summary>
    /// The graphics preset (src/perf.js QUALITY_PRESETS), the parts the port follows: how much detail
    /// a distant mesh may lose (lodPx: pixels on screen), how far and how small props are drawn
    /// (propFar, propPx), the share of each plant's distance it is drawn to (floraFar), the people's
    /// ranges (crowdFar, crowdMid), and the sun's shadow maps: the size of each cascade (fine 24 m,
    /// near, far 2.3 km; 0 = none), the near one's half-width, how often the near and far maps are
    /// redrawn (nearEvery, farEvery: never the far one on the near one's frame) and the filter's taps.
    /// "high" is the web's High (and Medium) at a render scale of 1; "low" and "handheld" as the web's.
    /// </summary>
    public static class Quality
    {
        public static string Name { get; private set; } = "high";
        public static float lodPx = 1, propFar = 520, propPx = 1, floraFar = 1;
        public static float crowdFar = 420, crowdMid = 65;
        public static int fineSize = 2048, nearSize = 4096, farSize = 2048, nearEvery = 1, farEvery = 3, taps = 9;
        public static float nearExtent = 220;
        public static bool cloudShadows = true;
        /// <summary>Bumped whenever the preset changes (the shadow maps are made again).</summary>
        public static int Version { get; private set; }

        public static void Set(string name)
        {
            Name = name;
            switch (name)
            {
                case "handheld":
                    lodPx = 2; propFar = 320; propPx = 2; floraFar = 0.65f; crowdFar = 220; crowdMid = 40;
                    fineSize = 0; nearSize = 2048; farSize = 2048; nearExtent = 160; nearEvery = 2; farEvery = 4; taps = 4; cloudShadows = false;
                    break;
                case "low":
                    lodPx = 1.5f; propFar = 420; propPx = 1.5f; floraFar = 0.8f; crowdFar = 300; crowdMid = 45;
                    fineSize = 1024; nearSize = 2048; farSize = 2048; nearExtent = 220; nearEvery = 2; farEvery = 3; taps = 4; cloudShadows = false;
                    break;
                default:   // high, medium (the web's FULL)
                    Name = name == "medium" ? "medium" : "high";
                    lodPx = 1; propFar = 520; propPx = 1; floraFar = 1; crowdFar = 420; crowdMid = 65;
                    fineSize = 2048; nearSize = 4096; farSize = 2048; nearExtent = 220; nearEvery = 1; farEvery = 3; taps = 9; cloudShadows = true;
                    break;
            }
            Version++;
        }

        /// <summary>Everything at full detail and nothing culled (a reference for the levels and the culling: -detail full).</summary>
        public static void AllDetail()
        {
            lodPx = 0; propFar = 1e9f; propPx = 0; floraFar = 100;
            Version++;
        }
    }
}
