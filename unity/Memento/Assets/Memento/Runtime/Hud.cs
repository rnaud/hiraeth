using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// The screen over the page (src/ui.js, src/story/dialogue.js, src/story/charge.js), drawn
    /// with IMGUI on paper colours: the objective line (◆ label · distance), the use prompt,
    /// toasts, the health bar while hurt, speech over people's heads, the conversation panel
    /// (the words resolving at an even pace, their tone, at most three answers), the journal
    /// (View / Tab) and the father's charge card at the start.
    /// </summary>
    public class Hud : MonoBehaviour
    {
        public Game game;
        readonly Queue<(string text, float secs)> toasts = new();
        string toastNow; float toastT;
        public bool journalOpen;
        public string card; float cardT;            // a full-screen card (the father's charge, the ending)
        public string cardTitle;
        // conversation
        public DialogueRunner talk; public Npc talkNpc; public string talkName, talkTitle;
        float reveal; int sel;
        public System.Action onTalkEnd;
        GUIStyle panel, nameStyle, body, small, choice, choiceSel, center, bubble;
        Texture2D paperTex, inkTex, shadeTex;
        static readonly Color Paper = new(0.97f, 0.94f, 0.86f, 0.96f), Ink = new(0.17f, 0.13f, 0.12f), Accent = new(0.72f, 0.26f, 0.25f);

        public void Toast(string t) { if (!string.IsNullOrEmpty(t)) toasts.Enqueue((Text.Plain(t), 3.6f)); }
        public bool cinematic;                       // a scene has the camera (a makers' box opening): no prompts
        public bool Busy => talk != null || journalOpen || card != null || cinematic;

        public void StartTalk(Dictionary<string, object> person, Npc npc, string displayName, string title)
        {
            talk = new DialogueRunner(person, game.state, game.quests, item => Toast($"Received {game.quests.ItemName(item)}"));
            talkNpc = npc; talkName = displayName; talkTitle = title; reveal = 0; sel = 0;
            if (npc) npc.talking = true;
            if (talk.ended) EndTalk();
        }
        void EndTalk()
        {
            if (talkNpc) talkNpc.talking = false;
            talk = null; talkNpc = null;
            onTalkEnd?.Invoke();
        }
        public void ShowCard(string title, string text, float minSecs = 1.5f) { cardTitle = title; card = text; cardT = -minSecs; }

        void Update()
        {
            float dt = Time.deltaTime;
            if (toastNow == null && toasts.Count > 0) { var t = toasts.Dequeue(); toastNow = t.text; toastT = t.secs; }
            if (toastNow != null) { toastT -= dt; if (toastT <= 0) toastNow = null; }
            if (card != null) { cardT += dt; if (cardT > 0 && Pad.ConfirmDown()) card = null; return; }
            if (Pad.JournalDown() && talk == null) journalOpen = !journalOpen;
            if (journalOpen && Pad.BackDown()) journalOpen = false;
            if (talk != null) UpdateTalk(dt);
        }

        void UpdateTalk(float dt)
        {
            if (talk.ended) { EndTalk(); return; }
            reveal += dt * 55f;   // letters per second (voice.js REVEAL_CPS)
            var text = talk.TextNow;
            var choices = talk.Choices();
            // their face while they say it (talk-face.js): the line's tone, the mouth moving; the traveller looks at them
            if (talkNpc)
            {
                talkNpc.hudSpeaking = reveal < text.Length;
                if (talkNpc.figure) talkNpc.figure.Talk(talkNpc.hudSpeaking, talk.Tone);
                if (game.player && game.player.figure) game.player.figure.lookTarget = talkNpc.HeadTransform;
            }
            int nav = Pad.NavDown();
            if (choices.Count > 0) sel = Mathf.Clamp(sel + nav, 0, choices.Count - 1);
            int pick = Pad.ChoiceDown();
            if (pick >= 0 && pick < choices.Count && reveal >= text.Length) { talk.Choose(choices[pick].index); reveal = 0; sel = 0; return; }
            if (Pad.BackDown()) { EndTalk(); return; }
            if (Pad.ConfirmDown())
            {
                if (reveal < text.Length) { reveal = text.Length; return; }
                if (choices.Count > 0) { talk.Choose(choices[sel].index); reveal = 0; sel = 0; }
                else if (!talk.Advance()) EndTalk();
                else reveal = 0;
            }
            if (talk != null && talk.ended) EndTalk();
        }

        void Styles()
        {
            if (panel != null) return;
            paperTex = Tex(Paper); inkTex = Tex(Ink); shadeTex = Tex(new Color(0, 0, 0, 0.35f));
            panel = new GUIStyle { normal = { background = paperTex }, border = new RectOffset(2, 2, 2, 2), padding = new RectOffset(22, 22, 16, 16) };
            int u = Mathf.Max(14, Screen.height / 42);
            nameStyle = new GUIStyle { fontSize = u + 4, fontStyle = FontStyle.Bold, normal = { textColor = Ink }, richText = true };
            body = new GUIStyle { fontSize = u + 2, wordWrap = true, normal = { textColor = Ink }, richText = true };
            small = new GUIStyle { fontSize = u - 1, normal = { textColor = new Color(Ink.r, Ink.g, Ink.b, 0.75f) }, richText = true, wordWrap = true };
            choice = new GUIStyle(body) { fontSize = u + 1, padding = new RectOffset(10, 6, 4, 4) };
            choiceSel = new GUIStyle(choice) { normal = { textColor = Accent, background = Tex(new Color(0.92f, 0.86f, 0.74f, 1)) } };
            center = new GUIStyle(body) { alignment = TextAnchor.MiddleCenter };
            bubble = new GUIStyle(small) { normal = { textColor = Ink, background = paperTex }, padding = new RectOffset(8, 8, 4, 4), alignment = TextAnchor.MiddleCenter, wordWrap = false };
        }
        static Texture2D Tex(Color c) { var t = new Texture2D(1, 1); t.SetPixel(0, 0, c); t.Apply(); return t; }
        void Box(Rect r) { GUI.DrawTexture(r, inkTex); GUI.DrawTexture(new Rect(r.x + 2, r.y + 2, r.width - 4, r.height - 4), paperTex); }

        void OnGUI()
        {
            if (!game) return;
            Styles();
            float W = Screen.width, H = Screen.height, u = Mathf.Max(14, H / 42f);
            var cam = game.cam;
            // speech over heads
            foreach (var n in game.npcs)
            {
                if (n == null || n.shout == null || Time.time > n.shoutUntil || n.talking || !cam) continue;
                var sp = cam.WorldToScreenPoint(n.Head + Vector3.up * 0.4f);
                if (sp.z < 0 || sp.z > 40) continue;
                var size = bubble.CalcSize(new GUIContent(n.shout));
                var r = new Rect(sp.x - size.x / 2, H - sp.y - size.y, size.x, size.y);
                Box(new Rect(r.x - 2, r.y - 2, r.width + 4, r.height + 4)); GUI.Label(r, n.shout, bubble);
            }
            if (card != null)
            {
                GUI.DrawTexture(new Rect(0, 0, W, H), paperTex);
                var t = new GUIStyle(center) { fontSize = (int)(u * 2.2f), fontStyle = FontStyle.Bold };
                GUI.Label(new Rect(W * 0.1f, H * 0.18f, W * 0.8f, H * 0.15f), cardTitle ?? "", t);
                var b = new GUIStyle(center) { fontSize = (int)(u * 1.25f), fontStyle = FontStyle.Italic };
                GUI.Label(new Rect(W * 0.15f, H * 0.35f, W * 0.7f, H * 0.35f), Text.Rich(card), b);
                if (cardT > 0) GUI.Label(new Rect(0, H * 0.8f, W, u * 2), $"{Pad.Key("A / ×", "Enter")}  continue", new GUIStyle(small) { alignment = TextAnchor.MiddleCenter });
                return;
            }
            // the objective line, top centre
            var obj = game.quests.Objective();
            if (obj.HasValue && talk == null)
            {
                float d = Vector3.Distance(game.player.transform.position, obj.Value.pos);
                var line = $"◆ {Text.Plain(obj.Value.label)} · {(d < 1000 ? Mathf.Round(d) + " m" : (d / 1000).ToString("0.0") + " km")}";
                var sz = small.CalcSize(new GUIContent(line));
                var r = new Rect(W / 2 - sz.x / 2 - 12, 14, sz.x + 24, sz.y + 10);
                Box(r); GUI.Label(new Rect(r.x + 12, r.y + 5, sz.x, sz.y), line, small);
                // the marker over the place, when it is on screen
                var sp = cam.WorldToScreenPoint(obj.Value.pos + Vector3.up * 2.5f);
                if (sp.z > 0) GUI.Label(new Rect(sp.x - 10, H - sp.y - 14, 30, 30), "<color=#3fb0b8><size=26>◆</size></color>", small);
            }
            // health, while hurt
            if (game.player.health < 0.999f)
            {
                Box(new Rect(20, 20, 204, 20));
                GUI.DrawTexture(new Rect(22, 22, 200 * game.player.health, 16), Tex(Accent));
            }
            if (game.player.dead)
            {
                GUI.DrawTexture(new Rect(0, 0, W, H), shadeTex);
                var r = new Rect(W / 2 - 160, H / 2 - 40, 320, 80); Box(r);
                GUI.Label(r, $"{Pad.Key("A / ×", "Enter")}  Restart", center);
            }
            // toasts, low centre
            if (toastNow != null)
            {
                var sz = body.CalcSize(new GUIContent(toastNow)); float w = Mathf.Min(sz.x, W * 0.7f);
                float h = body.CalcHeight(new GUIContent(toastNow), w);
                var r = new Rect(W / 2 - w / 2 - 14, H * 0.16f, w + 28, h + 14);
                Box(r); GUI.Label(new Rect(r.x + 14, r.y + 7, w, h), toastNow, body);
            }
            // the use prompt
            if (talk == null && !journalOpen && game.prompt != null)
            {
                var line = $"{Pad.Key("B / ○", "E")}  {game.prompt}";
                var sz = body.CalcSize(new GUIContent(line));
                var r = new Rect(W / 2 - sz.x / 2 - 12, H * 0.72f, sz.x + 24, sz.y + 10);
                Box(r); GUI.Label(new Rect(r.x + 12, r.y + 5, sz.x, sz.y), line, body);
            }
            if (talk != null) DrawTalk(W, H, u);
            if (journalOpen) DrawJournal(W, H, u);
            // the controls, small, bottom left
            GUI.Label(new Rect(16, H - u * 1.6f, W, u * 1.4f), Pad.HasPad ? "left stick move · A / × jump · L3 run · B / ○ talk, use · RB / R1 push · View journal" : "WASD move · mouse look (right button) · Space jump · Shift run · E talk, use · C push · Tab journal", small);
        }

        void DrawTalk(float W, float H, float u)
        {
            var text = talk.TextNow; int n = Mathf.Min(text.Length, (int)reveal);
            var shown = text.Substring(0, n);
            var choices = talk.Choices();
            float pw = Mathf.Min(W * 0.72f, 980), ph = u * 7.5f + choices.Count * (u + 14);
            var r = new Rect(W / 2 - pw / 2, H - ph - 30, pw, ph);
            Box(r);
            GUI.Label(new Rect(r.x + 22, r.y + 12, pw - 44, u + 8), $"{talkName}  <size={(int)(u - 2)}><i>{talkTitle}</i></size>   <size={(int)(u - 3)}><color=#8a6fb8>~{talk.Tone}~</color></size>", nameStyle);
            GUI.Label(new Rect(r.x + 22, r.y + u * 2.2f, pw - 44, u * 4.5f), Text.Rich(shown), body);
            if (n >= text.Length)
            {
                float y = r.y + u * 6.6f;
                for (int i = 0; i < choices.Count; i++)
                {
                    var c = choices[i];
                    GUI.Label(new Rect(r.x + 30, y, pw - 60, u + 10), $"{i + 1}.  {Text.Rich(c.text)}", i == sel ? choiceSel : choice);
                    y += u + 14;
                }
                if (choices.Count == 0) GUI.Label(new Rect(r.x + pw - 160, r.y + ph - u * 1.6f, 150, u * 1.4f), $"{Pad.Key("A / ×", "Enter")}  ▸", small);
            }
        }

        void DrawJournal(float W, float H, float u)
        {
            var r = new Rect(W * 0.18f, H * 0.1f, W * 0.64f, H * 0.8f); Box(r);
            float y = r.y + 20;
            GUI.Label(new Rect(r.x + 24, y, r.width, u * 2), "Journal", nameStyle); y += u * 2.4f;
            var Q = game.quests;
            foreach (var d in Q.defs.Values.Where(d => Q.IsStarted(d.S("id"))))
            {
                var id = d.S("id"); bool done = Q.IsDone(id);
                bool main = d.Get("main") is bool b && b;
                GUI.Label(new Rect(r.x + 24, y, r.width - 48, u * 1.5f), $"{(main ? "◆" : "◇")} <b>{d.S("title")}</b>{(done ? "   ✓ Complete" : Q.Tracked() == id ? "   <i>tracked</i>" : "")}", body); y += u * 1.6f;
                if (done) { GUI.Label(new Rect(r.x + 48, y, r.width - 72, u * 1.5f), Text.Plain(d.S("outro")), small); y += u * 1.6f; continue; }
                foreach (var s in d.L("stages"))
                {
                    var sid = s.S("id");
                    if (!Q.Reached(id, sid) || (s.Get("secret") is bool sec && sec)) continue;
                    bool now = Q.Stage(id) == sid;
                    var line = (now ? "▸ " : "<color=#7a7064>✓ ") + Text.Plain(s.S("text")) + (now ? "" : "</color>");
                    float h = small.CalcHeight(new GUIContent(line), r.width - 72);
                    GUI.Label(new Rect(r.x + 48, y, r.width - 72, h), line, small); y += h + 4;
                }
                y += 8;
            }
            if (game.state.keepsakes.Count > 0)
            {
                y += 6; GUI.Label(new Rect(r.x + 24, y, r.width, u * 1.6f), "<b>Keepsakes</b>", body); y += u * 1.6f;
                foreach (var k in game.state.keepsakes) { GUI.Label(new Rect(r.x + 48, y, r.width - 72, u * 2.4f), $"<b>{k.S("name")}</b> · {k.S("text")}", small); y += u * 2.4f; }
            }
            GUI.Label(new Rect(r.x + 24, r.yMax - u * 2, r.width, u * 1.5f), "<i>“My son, make us proud. Bring back something of value.”</i>", small);
        }
    }
}
