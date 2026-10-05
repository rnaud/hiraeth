using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Memento
{
    /// <summary>The flags the story runs on (src/game-state.js): flag(k), set(k, v), on(event).</summary>
    public class GameState
    {
        readonly Dictionary<string, object> flags = new();
        readonly Dictionary<string, List<Action<object>>> listeners = new();
        public readonly List<Dictionary<string, object>> keepsakes = new();
        public object Flag(string k) => flags.TryGetValue(k, out var v) ? v : null;
        public bool Is(string k) { var v = Flag(k); return v switch { null => false, bool b => b, double d => d != 0, string s => s.Length > 0, _ => true }; }
        public double Num(string k) => Flag(k) is double d ? d : 0;
        public void Set(string k, object v)
        {
            if (v is int i) v = (double)i;
            if (v is float f) v = (double)f;
            var prev = Flag(k);
            if (Equals(prev, v)) return;
            flags[k] = v;
            Emit("flag:" + k, v);
        }
        public void On(string ev, Action<object> f) { if (!listeners.TryGetValue(ev, out var l)) listeners[ev] = l = new(); l.Add(f); }
        public void Emit(string ev, object payload = null) { if (listeners.TryGetValue(ev, out var l)) foreach (var f in l.ToArray()) f(payload); }
        public bool AddKeepsake(Dictionary<string, object> k) { if (keepsakes.Any(x => x.S("id") == k.S("id"))) return false; keepsakes.Add(k); Emit("keepsake", k); return true; }
        public IEnumerable<string> Keys => flags.Keys;
    }

    /// <summary>Quests as data (src/story/quests.js): stages that advance on flags, arrivals or talk.</summary>
    public class Quests
    {
        public const string Done = "done";
        readonly GameState game;
        public readonly Dictionary<string, Dictionary<string, object>> defs = new();
        public readonly Dictionary<string, Func<Vector3?>> locators = new();
        public Dictionary<string, object> itemNames = new();
        public Action<string> toast = _ => { };
        public readonly Dictionary<string, Action> onDone = new();
        public Quests(GameState g) { game = g; }

        public void Define(Dictionary<string, object> d) => defs[d.S("id")] = d;
        /// <summary>A new world: its quests replace the last one's (the flags stay: progress is kept).</summary>
        public void Clear() { defs.Clear(); locators.Clear(); onDone.Clear(); itemNames = new Dictionary<string, object>(); }
        public string Stage(string id) => game.Flag("quest." + id) as string;
        public bool IsStarted(string id) => Stage(id) != null;
        public bool IsDone(string id) => Stage(id) == Done;
        public bool IsActive(string id) { var s = Stage(id); return s != null && s != Done; }
        List<object> Stages(string id) => defs[id].L("stages");
        int IndexOf(string id, string stage) => Stages(id).FindIndex(x => x.S("id") == stage);
        public bool Reached(string id, string stage)
        {
            var s = Stage(id); if (s == null || !defs.ContainsKey(id)) return false;
            if (s == Done) return true;
            int i = IndexOf(id, s), j = IndexOf(id, stage);
            return i >= 0 && j >= 0 && i >= j;
        }
        public Dictionary<string, object> Current(string id) { var s = Stage(id); return defs.ContainsKey(id) ? Stages(id).FirstOrDefault(x => x.S("id") == s) as Dictionary<string, object> : null; }
        public bool Start(string id, string stage = null)
        {
            if (!defs.ContainsKey(id)) return false;
            if (IsStarted(id) && stage == null) return false;
            return SetStage(id, stage ?? Stages(id)[0].S("id"));
        }
        public bool Advance(string id, string from = null)
        {
            var s = Stage(id); if (!defs.ContainsKey(id) || s == null || s == Done) return false;
            if (from != null && s != from) return false;
            int i = IndexOf(id, s); var st = Stages(id);
            return SetStage(id, i + 1 < st.Count ? st[i + 1].S("id") : Done);
        }
        public bool SetStage(string id, string stage)
        {
            var d = defs[id]; var prev = Stage(id);
            if (prev == stage) return false;
            game.Set("quest." + id, stage);
            if (stage != Done) game.Set("quest.tracked", id);
            var st = Current(id);
            bool main = d.Get("main") is bool b && b;
            if (stage == Done) { toast($"{(main ? "Completed" : "Done")}: {d.S("title")}"); if (onDone.TryGetValue(id, out var f)) f(); if (game.Flag("quest.tracked") as string == id) game.Set("quest.tracked", Active().FirstOrDefault()?.S("id")); }
            else if (prev == null) toast($"{(main ? "Quest" : "New errand")}: {d.S("title")} · {Text.Plain(st.S("text"))}");
            else toast($"{d.S("title")}: {Text.Plain(st.S("text"))}");
            game.Emit("quest", id);
            return true;
        }
        public string Tracked() { var t = game.Flag("quest.tracked") as string; return t != null && IsActive(t) ? t : null; }
        public IEnumerable<Dictionary<string, object>> Active() => defs.Values.Where(d => IsActive(d.S("id")));
        public bool Has(string item) => game.Num("item." + item) > 0;
        public void Give(string item, int n = 1) { game.Set("item." + item, game.Num("item." + item) + n); game.Emit("item", item); }
        public bool Take(string item) { if (!Has(item)) return false; game.Set("item." + item, game.Num("item." + item) - 1); game.Emit("item", item); return true; }
        public string ItemName(string item) => itemNames.TryGetValue(item, out var v) ? v as string : item;
        public void Locate(string name, Func<Vector3?> f) => locators[name] = f;
        public Vector3? Where(Dictionary<string, object> st)
        {
            if (st == null) return null;
            string at = st.S("at");
            if (st.Has("bring") && (at == null || Has(st.S("bring")))) at = st.S("to") ?? at;
            at ??= st.S("goto") ?? st.S("talk");
            return at != null && locators.TryGetValue(at, out var f) ? f() : null;
        }
        public (string label, Vector3 pos, string quest)? Objective()
        {
            var id = Tracked() ?? Active().FirstOrDefault(d => d.Get("main") is bool b && b)?.S("id") ?? Active().FirstOrDefault()?.S("id");
            if (id == null) return null;
            var st = Current(id); var p = Where(st);
            return p.HasValue ? (st.S("label") ?? st.S("text"), p.Value, id) : null;
        }
        /// <summary>Arrivals and flags: advance any stage whose condition is met (quests.js update).</summary>
        public void Update(Vector3 player)
        {
            foreach (var d in defs.Values.ToArray())
            {
                var id = d.S("id"); var st = Current(id);
                if (st == null) continue;
                if (st.Has("goto"))
                {
                    var p = locators.TryGetValue(st.S("goto"), out var f) ? f() : null;
                    float r = st.F("radius", 12);
                    if (p.HasValue && Vector2.Distance(new Vector2(player.x, player.z), new Vector2(p.Value.x, p.Value.z)) < r && Mathf.Abs(player.y - p.Value.y) < Mathf.Max(r, 12)) Advance(id, st.S("id"));
                }
                else if (st.Has("flag"))
                {
                    var want = st.Get("value") ?? true;
                    var v = game.Flag(st.S("flag"));
                    bool met = want is bool wb ? (wb ? game.Is(st.S("flag")) : !game.Is(st.S("flag"))) : Equals(v, want);
                    if (met) Advance(id, st.S("id"));
                }
            }
        }
    }

    /// <summary>Text helpers: tones (src/story/tone.js) and the motifs / highlights of dialogue.js formatText.</summary>
    public static class Text
    {
        public static readonly string[] Tones = { "neutral", "happy", "sad", "angry", "scared", "surprised", "curious", "tired", "solemn", "playful", "whisper", "shout" };
        static readonly Regex Tag = new(@"^\s*~([a-z]+)~\s*");
        public static (string text, string tone) Parse(object line)
        {
            if (line is Dictionary<string, object> o)
            {
                var inner = Parse(o.S("text") ?? o.S("say") ?? "");
                var t = o.S("tone");
                return t != null && Array.IndexOf(Tones, t) >= 0 ? (inner.text, t) : inner;
            }
            var s = line as string ?? "";
            var m = Tag.Match(s);
            if (m.Success && Array.IndexOf(Tones, m.Groups[1].Value) >= 0) return (s.Substring(m.Length), m.Groups[1].Value);
            return (s, s.TrimEnd().EndsWith("?") ? "curious" : s.TrimEnd().EndsWith("!") ? "surprised" : "neutral");
        }
        /// <summary>For the screen: {glyph} as its plain mark, *highlights* in the ink's accent colour (IMGUI rich text).</summary>
        public static string Rich(string s) => Regex.Replace((s ?? "").Replace("{glyph}", "⁖⌒"), @"\*([^*]+)\*", "<color=#b8433f><b>$1</b></color>");
        public static string Plain(string s) => Regex.Replace(Parse(s ?? "").text.Replace("{glyph}", "⁖⌒"), @"\*([^*]+)\*", "$1");
    }

    /// <summary>The conversation logic without any UI (src/story/dialogue.js DialogueRunner): nodes, pages, ≤ 3 choices, conditions and effects.</summary>
    public class DialogueRunner
    {
        public readonly Dictionary<string, object> person;
        readonly GameState game; readonly Quests quests;
        public bool ended; public string nodeId; public Dictionary<string, object> node;
        public List<(string text, string tone)> pages = new();
        public int page;
        public Action<string> onGive = _ => { };

        /// <summary>No effects (a look at where a conversation goes, the batch's): conditions only.</summary>
        public readonly bool dry;
        public DialogueRunner(Dictionary<string, object> person, GameState game, Quests quests, Action<string> onGive = null, bool dry = false)
        {
            this.person = person; this.game = game; this.quests = quests; this.dry = dry;
            if (onGive != null) this.onGive = onGive;
            var talk = person.O("talk"); var nodes = talk.O("nodes");
            string first = nodes.Keys.First();
            var entry = talk.L("entry");
            if (entry != null) foreach (var e in entry) if (Check(e.Get("if"))) { first = e.S("node"); break; }
            Goto(first);
        }

        public bool Check(object cond)
        {
            if (cond == null) return true;
            if (cond is List<object> all) return all.All(Check);
            if (cond is not Dictionary<string, object> c) return true;
            if (c.Has("all")) return c.L("all").All(Check);
            if (c.Has("any")) return c.L("any").Any(Check);
            if (c.Has("not")) return !Check(c.Get("not"));
            if (c.Has("has")) return quests.Has(c.S("has"));
            if (c.Has("flag")) return c.Has("is") ? Equals(game.Flag(c.S("flag")), c.Get("is")) : game.Is(c.S("flag"));
            if (c.Has("quest"))
            {
                var q = c.S("quest"); var s = quests.Stage(q);
                if (c.Has("stage")) return c.Get("stage") is List<object> l ? l.Contains(s) : s == c.S("stage");
                if (c.Has("active")) return quests.IsActive(q) == (bool)c.Get("active");
                if (c.Has("done")) return quests.IsDone(q) == (bool)c.Get("done");
                if (c.Has("started")) return quests.IsStarted(q) == (bool)c.Get("started");
                if (c.Has("reached")) return quests.Reached(q, c.S("reached"));
                return quests.IsActive(q);
            }
            return true;
        }

        public void Apply(object effects)
        {
            if (effects == null) return;
            var list = effects as List<object> ?? new List<object> { effects };
            foreach (var x in list)
            {
                if (x is not Dictionary<string, object> e) continue;
                if (e.O("set") is { } set) foreach (var kv in set) game.Set(kv.Key, kv.Value);
                if (e.S("start") is { } st) quests.Start(st);
                if (e.Get("advance") is { } adv) { if (adv is List<object> a) quests.Advance(a[0] as string, a[1] as string); else quests.Advance(adv as string); }
                if (e.L("stage") is { } sg) quests.SetStage(sg[0] as string, sg[1] as string);
                if (e.S("give") is { } give) { quests.Give(give); onGive(give); }
                if (e.S("take") is { } take) quests.Take(take);
                if (e.S("track") is { } tr) game.Set("quest.tracked", tr);
                if (e.O("keepsake") is { } k) game.AddKeepsake(k);
                if (e.L("emit") is { } em) game.Emit(em[0] as string, em.Count > 1 ? em[1] : null);
            }
        }

        public void Goto(string id)
        {
            var nodes = person.O("talk").O("nodes");
            if (id == null || !nodes.TryGetValue(id, out var n)) { ended = true; return; }
            nodeId = id; node = n as Dictionary<string, object>;
            var say = node.Get("say");
            var lines = say as List<object> ?? new List<object> { say ?? "" };
            pages = lines.Where(s => !(s is Dictionary<string, object> d && d.Has("if")) || Check((s as Dictionary<string, object>).Get("if"))).Select(Text.Parse).ToList();
            if (pages.Count == 0) pages.Add(("", "neutral"));
            page = 0;
            if (!dry) Apply(node.Get("do"));
        }
        public string TextNow => pages[Mathf.Clamp(page, 0, pages.Count - 1)].text;
        public string Tone => pages[Mathf.Clamp(page, 0, pages.Count - 1)].tone;
        public bool LastPage => page >= pages.Count - 1;

        public List<(string text, string tone, int index, Dictionary<string, object> c)> Choices()
        {
            var res = new List<(string, string, int, Dictionary<string, object>)>();
            if (!LastPage || ended) return res;
            var cs = node.L("choices");
            if (cs != null)
                for (int i = 0; i < cs.Count; i++)
                {
                    var c = cs[i] as Dictionary<string, object>;
                    if (!Check(c.Get("if"))) continue;
                    if (c.Get("once") is bool once && once && game.Is($"said.{person.S("id")}.{nodeId}.{i}")) continue;
                    var (t, tone) = Text.Parse(c.S("text"));
                    res.Add((t, tone, i, c));
                }
            if (res.Count > 0) return res;
            if (node.Has("next")) return res;
            res.Add((node.S("bye") ?? "(leave)", "neutral", -1, null));
            return res;
        }
        public bool Advance()
        {
            if (ended) return false;
            if (!LastPage) { page++; return true; }
            var cs = node.L("choices");
            if (node.Has("next") && (cs == null || !cs.Any(c => Check(c.Get("if"))))) { Goto(node.S("next")); return true; }
            return false;
        }
        public bool Choose(int index)
        {
            var list = Choices();
            var pick = list.FirstOrDefault(x => x.index == index);
            if (pick.text == null) return false;
            var c = pick.c;
            if (c == null) { ended = true; return true; }
            if (c.Get("once") is bool once && once) game.Set($"said.{person.S("id")}.{nodeId}.{index}", true);
            Apply(c.Get("do"));
            if ((c.Get("end") is bool e && e) || !c.Has("goto")) { ended = true; return true; }
            Goto(c.S("goto"));
            return true;
        }
    }
}
