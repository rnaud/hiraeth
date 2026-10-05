using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// Saving the game (src/save-slots.js, game-state.js): the story lives in its flags (quests,
    /// items, what has been done: the same keys as the web game's), so a save is the flags, the
    /// keepsakes, where the traveller stands and the fluid's colours, written as JSON to the
    /// player's data folder every few seconds of play, when a quest moves on and on quitting; read
    /// back at the start (a finished prologue is not played again), and the desert restored to match
    /// (the rib moved aside, the pool full, the chests opened, the bike awake).
    /// </summary>
    public static class Save
    {
        public static string Slot = "slot1";
        public static string PathOf(string slot) => System.IO.Path.Combine(Application.persistentDataPath, $"memento-{slot}.json");
        public static bool Exists(string slot = null) => File.Exists(PathOf(slot ?? Slot));
        public static void Erase(string slot = null) { var p = PathOf(slot ?? Slot); if (File.Exists(p)) File.Delete(p); }

        public static string Write(Game g, string slot = null)
        {
            var d = new Dictionary<string, object>
            {
                ["version"] = 1.0, ["world"] = g.Level, ["saved"] = System.DateTime.UtcNow.ToString("o"),
                ["flags"] = Flags(g.state), ["keepsakes"] = g.state.keepsakes,
            };
            if (g.player) { var p = g.player.transform.position; d["player"] = new List<object> { (double)p.x, (double)p.y, (double)p.z, (double)g.player.heading }; }
            if (g.tool) d["colours"] = (double)g.tool.colours;
            var path = PathOf(slot ?? Slot);
            File.WriteAllText(path, Stringify(d));
            return path;
        }

        static Dictionary<string, object> Flags(GameState s) { var o = new Dictionary<string, object>(); foreach (var k in s.Keys) o[k] = s.Flag(k); return o; }

        /// <summary>The save's data (null if none).</summary>
        public static Dictionary<string, object> Read(string slot = null)
        {
            var path = PathOf(slot ?? Slot);
            if (!File.Exists(path)) return null;
            try { return Json.Parse(File.ReadAllText(path)) as Dictionary<string, object>; }
            catch (System.Exception e) { Debug.LogWarning($"Memento: the save {path} could not be read: {e.Message}"); return null; }
        }

        /// <summary>Put a save's flags and keepsakes into a fresh state (before the story starts).</summary>
        public static void Apply(Dictionary<string, object> d, GameState s)
        {
            if (d == null) return;
            foreach (var (k, v) in d.O("flags") ?? new Dictionary<string, object>()) s.Set(k, v);
            foreach (var k in d.L("keepsakes") ?? new List<object>()) if (k is Dictionary<string, object> kd) s.AddKeepsake(kd);
        }

        // ------------------------------------------------------------------ JSON out (Json.cs reads it back)
        public static string Stringify(object v) { var b = new StringBuilder(); W(b, v); return b.ToString(); }
        static void W(StringBuilder b, object v)
        {
            switch (v)
            {
                case null: b.Append("null"); break;
                case bool x: b.Append(x ? "true" : "false"); break;
                case double x: b.Append(x.ToString("R", CultureInfo.InvariantCulture)); break;
                case float x: b.Append(((double)x).ToString("R", CultureInfo.InvariantCulture)); break;
                case int x: b.Append(x); break;
                case string s: b.Append('"'); foreach (var c in s) { if (c == '"' || c == '\\') b.Append('\\').Append(c); else if (c == '\n') b.Append("\\n"); else if (c < ' ') b.Append($"\\u{(int)c:x4}"); else b.Append(c); } b.Append('"'); break;
                case Dictionary<string, object> o: { b.Append('{'); bool f = true; foreach (var (k, x) in o) { if (!f) b.Append(','); f = false; W(b, k); b.Append(':'); W(b, x); } b.Append('}'); break; }
                case System.Collections.IEnumerable l: { b.Append('['); bool f = true; foreach (var x in l) { if (!f) b.Append(','); f = false; W(b, x); } b.Append(']'); break; }
                default: W(b, v.ToString()); break;
            }
        }
    }
}
