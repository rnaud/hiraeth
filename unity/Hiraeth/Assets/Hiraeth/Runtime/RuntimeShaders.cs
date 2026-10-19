using System.Collections.Generic;
using UnityEngine;

namespace Hiraeth
{
    /// <summary>
    /// The shaders the game finds by name at run time (Shader.Find). A player keeps only what its build is told to keep: the
    /// bridge's builds preload these (BridgeBuild.KeepShaders, issue #500), the native game's always include them
    /// (Batch.IncludeShaders). tests/unity-size.test.js checks every Shader.Find of the run-time code names one of them.
    /// </summary>
    public static class RuntimeShaders
    {
        public static readonly string[] Names = { "Hiraeth/Surface", "Hiraeth/Planet", "Hiraeth/UIText", "Hiraeth/Wisp", "Hiraeth/Mote", "Hiraeth/Print", "Hiraeth/JumpShade", "Hiraeth/Flame", "Hiraeth/Hologram", "Hiraeth/Veil", "Hiraeth/PitVoid", "Hiraeth/DoorLight", "Hiraeth/HoloFigure",
            "Hidden/Hiraeth/Composite", "Hidden/Hiraeth/Bloom", "Hidden/Hiraeth/FXAA", "Hidden/Hiraeth/SMAA", "Hidden/Hiraeth/Upscale", "Hidden/Hiraeth/WaterOver", "UI/Default" };

        /// <summary>
        /// Each one looked up as the game will (a player's start): one line saying how many were found and naming any that
        /// weren't; with every: a line for each, found or missing and whether this GPU runs it. A shader the build left out
        /// draws nothing on a device, so a miss is said as an error.
        /// </summary>
        public static int Check(bool every)
        {
            var missing = new List<string>();
            foreach (var n in Names)
            {
                var s = Shader.Find(n);
                if (s == null) missing.Add(n);
                if (every) Debug.Log($"Hiraeth: shader {n}: {(s == null ? "MISSING" : s.isSupported ? "found" : "found, not supported here")}");
            }
            if (missing.Count > 0) Debug.LogError($"Hiraeth: shaders found by name: {Names.Length - missing.Count} of {Names.Length}, missing: {string.Join(", ", missing)}");
            else Debug.Log($"Hiraeth: shaders found by name: all {Names.Length}");
            return missing.Count;
        }
    }
}
