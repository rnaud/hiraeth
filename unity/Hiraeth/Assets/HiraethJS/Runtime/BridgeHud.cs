using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The HUD and the conversation, drawn in uGUI from the web game's own state (src/platform.js
    /// screen: the cue line, the toast, the floating prompt, the health bar, the stamina wheel, the
    /// conversation and the answer a pad has picked), sent by the bundle when it changes. The pieces
    /// and their layout are the C# port's (Hud.cs, Ui.cs): the same paper, ink and fonts; only where
    /// the state comes from differs. The game decides everything; this only draws it.
    /// </summary>
    public class BridgeHud : MonoBehaviour
    {
        public Camera cam;
        RectTransform root;
        float W => root.rect.width; float H => root.rect.height;
        Dictionary<string, object> state = new();
        int toastId = -1; float toastT, toastSecs = 4;

        Ui.Box toast; Label toastText;
        Ui.Box cue; Label cueText;
        Ui.Box prompt; Image promptKey; Label promptKeyText, promptText;
        Ui.Box health; Image healthFill, healthEdge;
        Ui.Box keys; Label keysText;
        RectTransform wheel; Image wheelRing, wheelFill;
        RectTransform dlg; Ui.Box dlgPanel; Sketch dlgLines, dlgMore; RectTransform chip; Image chipFill; Label chipLetter; RawImage chipPhoto;
        Ui.Box dlgTag; Label dlgName, dlgTitle, dlgText;
        readonly List<(Ui.Box box, Label num, Label text, Image line)> dlgChoices = new();
        /// <summary>The panel's type in canvas px (the canvas is 720 tall: index.html #dialogue's --dlg, 2.9 % of the
        /// screen's height, issue #147), and the sizes the rest of the panel takes from it (in em, as the page's).</summary>
        const int Body = 21, AnswerSize = 20, NameSize = 22, TitleSize = 16, LetterSize = 44;
        const float Em = Body, ChipD = 4.6f * Em;
        static readonly Color Muted = Ui.Hex("#5e4b45");
        /// <summary>Every hint one look, one place (issue #306, src/hint-look.js HINT_ENGINE): a near-black strip, cream
        /// letters, at the top centre; the cue first, the toast under it.</summary>
        static readonly Color HintBg = new Color(18 / 255f, 14 / 255f, 13 / 255f, 0.92f), HintInk = Ui.Hex("#f7ecd2");
        const float HintTop = 12, HintGap = 8;
        float cueBottom;   // (where the cue ends this frame: the toast stacks under it)

        public void Set(string json) { state = Json.Parse(json) as Dictionary<string, object> ?? new(); }

        /// <summary>The letters the game writes, put in the fonts' textures at once (a dynamic font adding them one by one
        /// rebuilt its texture under labels already drawn: letters dropped out of a frame).</summary>
        static void Warm(Font f)
        {
            const string chars = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’‘“”…—–·▍›◆✦×éèàçôûâêîïüöäñ";
            foreach (var size in new[] { 11, 12, 13, 14, 15, 16, 19, 20, 21, 25, 36, 44 })
                foreach (var st in new[] { FontStyle.Normal, FontStyle.Bold, FontStyle.Italic })
                    f.RequestCharactersInTexture(chars, size, st);
        }

        void Start()
        {
            Warm(Ui.Mono);
            root = Hud.MakeCanvas(cam, "HUD (JS bridge)", 100);
            root.SetParent(transform, false);
            var mono = Ui.Mono;
            toast = Ui.Panel(root, "toast", HintBg, HintBg, 0, 0, 0, 4);
            toastText = Ui.Label(toast.rt, "text", mono, 13, HintInk, TextAnchor.UpperCenter);
            cue = Ui.Panel(root, "cue", HintBg, HintBg, 0, 0, 0, 4);
            cueText = Ui.Label(cue.rt, "text", mono, 13, HintInk, TextAnchor.MiddleCenter);
            prompt = Ui.Panel(root, "prompt", HintBg, HintBg, 0, 0, 0, 12);
            promptKey = Ui.Rect(prompt.rt, HintInk, 11, "key");
            promptKeyText = Ui.Label(promptKey.rectTransform, "k", mono, 11, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(promptKeyText.rectTransform);
            promptText = Ui.Label(prompt.rt, "text", mono, 12, HintInk, TextAnchor.MiddleLeft);
            health = Ui.Panel(root, "health", Ui.Page, Ui.Ink, 2, 2, 2, 6);
            healthFill = Ui.Rect(health.fill.rectTransform, Ui.Hp, 0, "hp");
            healthEdge = Ui.Rect(health.fill.rectTransform, Ui.Ink, 0, "edge");
            keys = Ui.Panel(root, "keys", Ui.Page, Ui.Ink, 1.5f, 2, 2, 6);
            keysText = Ui.Label(keys.rt, "text", mono, 13, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            wheel = Ui.Node("stamina", root);
            wheelRing = Ui.Fill(wheel, Ui.Hex("#2b211f", 0.25f), 0, "ring"); wheelRing.sprite = Ui.Round(32);
            wheelFill = Ui.Fill(wheel, Ui.Gold, 0, "fill"); wheelFill.sprite = Ui.Round(32);
            wheelFill.type = Image.Type.Filled; wheelFill.fillMethod = Image.FillMethod.Radial360; wheelFill.fillOrigin = (int)Image.Origin360.Top; wheelFill.fillClockwise = false;
            Ui.Stretch(wheelFill.rectTransform, 3, 3, 3, 3);
            BuildDialogue(mono);
            BuildCine(mono);
        }

        // the ship's scenes (src/ship/cinema.js, screen 'cine' and 'sub'; issue #264): the letterbox, the fade, the red
        // wash, the hint under the top bar, the subtitle over the bottom one and the hold-to-skip tag, over the HUD as
        // the page's #cine is
        Image cineRed, cineFade, barTop, barBot;
        Ui.Box subBox, cineHint, skipBox; Label subText, cineHintText, skipText; Image skipTrack, skipFill;
        float fadeA, barH, redA; int subId = -1; float subT;
        static readonly Color CineInk = Ui.Hex("#2b211f"), CinePaper = Ui.Hex("#fff6dc"), SubPaper = new Color(247 / 255f, 236 / 255f, 210 / 255f, 0.95f);
        const int SubSize = 21;

        void BuildCine(Font mono)
        {
            cineRed = Ui.Fill(root, new Color(170 / 255f, 30 / 255f, 25 / 255f, 1), 0, "cine red"); cineRed.raycastTarget = false;
            cineFade = Ui.Fill(root, CineInk, 0, "cine fade"); cineFade.raycastTarget = false;
            barTop = Ui.Rect(root, CineInk, 0, "cine bar top"); barBot = Ui.Rect(root, CineInk, 0, "cine bar bottom");
            cineHint = Ui.Panel(root, "cine hint", HintBg, HintBg, 0, 0, 0, 4);
            cineHintText = Ui.Label(cineHint.rt, "text", mono, 13, HintInk, TextAnchor.UpperCenter);
            subBox = Ui.Panel(root, "cine sub", SubPaper, CineInk, 2, 3, 3);
            subText = Ui.Label(subBox.rt, "text", mono, SubSize, CineInk, TextAnchor.UpperCenter, lineSpacing: 1.25f);
            skipBox = Ui.Panel(root, "cine skip", new Color(43 / 255f, 33 / 255f, 31 / 255f, 0.82f), Color.clear, 0);
            skipText = Ui.Label(skipBox.rt, "text", mono, 12, HintInk, TextAnchor.MiddleLeft);
            skipTrack = Ui.Rect(skipBox.rt, HintInk, 0, "track"); skipFill = Ui.Rect(skipTrack.rectTransform, Ui.Gold, 0, "fill");
        }

        void DrawCine(Dictionary<string, object> c, Dictionary<string, object> sub)
        {
            float dt = Time.unscaledDeltaTime;
            // the fade, eased to its value over its seconds (the page's CSS transition), black or the paper's white
            float fadeTo = c != null ? Mathf.Clamp01(c.F("fade")) : 0, secs = c != null ? Mathf.Max(0.01f, c.F("secs", 0.6f)) : 0.6f;
            fadeA = Mathf.MoveTowards(fadeA, fadeTo, dt / secs);
            var fc = c != null && c.Get("white") is bool wh && wh ? CinePaper : CineInk;
            cineFade.color = new Color(fc.r, fc.g, fc.b, fadeA);
            Show(cineFade, fadeA > 0.002f);
            redA = Mathf.MoveTowards(redA, c != null ? Mathf.Clamp01(c.F("red")) : 0, dt * 4);
            cineRed.color = new Color(170 / 255f, 30 / 255f, 25 / 255f, 0.6f * redA);
            Show(cineRed, redA > 0.002f);
            // the letterbox: 11 % of the height each, 50.5 % with the eyes shut, the eyelids' opening in between (eyelids(k))
            bool lids = c != null && c.Get("lids") is bool l && l, bars = c != null && c.Get("bars") is bool b && b;
            float lid = c != null ? Mathf.Clamp01(c.F("lid", 1)) : 1;
            float to = lids ? 0.505f : lid < 1 ? 0.505f - (0.505f - 0.11f) * lid : bars ? 0.11f : 0;
            barH = lids || lid < 1 ? to : Mathf.MoveTowards(barH, to, dt / 1.1f * 0.2f);
            Show(barTop, barH > 0.001f); Show(barBot, barH > 0.001f);
            Ui.Place(barTop.rectTransform, 0, 0, W, barH * H); Ui.Place(barBot.rectTransform, 0, H - barH * H, W, barH * H);
            // the hint under the top bar
            var hint = c?.S("hint") ?? "";
            Show(cineHint, hint.Length > 0);
            if (hint.Length > 0)
            {
                var s = Ui.Set(cineHintText, Text.Plain(hint), Mathf.Min(560, W - 60));
                Ui.Place(cineHintText.rectTransform, 14, 6, s.x, s.y);
                Ui.Place(cineHint.rt, W / 2 - (s.x + 28) / 2, Mathf.Max(barH * H, cueBottom) + 12, s.x + 28, s.y + 12);
            }
            // the subtitle over the bottom bar: the speaker's tag in their colour, the line, its *emphasis* bold
            if (sub != null && sub.I("id") != subId) { subId = sub.I("id"); subT = 0; }
            subT += dt;
            Show(subBox, sub != null);
            if (sub != null)
            {
                string who = sub.S("who") ?? "", cls = sub.S("cls") ?? "";
                string col = cls == "father" ? "#7a3a35" : cls == "mother" ? "#277e86" : cls == "ship" ? "#c8483a" : "#2b211f";
                var body = (who.Length > 0 ? $"<b><color={col}>{who}</color></b>  " : "") + Ui.Rich(Text.Plain(sub.S("text") ?? ""));
                var s = Ui.Set(subText, body, Mathf.Min(46 * SubSize, W - 64));
                Ui.Place(subText.rectTransform, 12, 5, s.x, s.y);
                float w = s.x + 24, h = s.y + 11;
                Ui.Place(subBox.rt, W / 2 - w / 2, H - Mathf.Max(barH * H, 26) - 14 - h, w, h);
                Ui.Group(subBox.rt).alpha = Mathf.Clamp01(subT / 0.2f);
            }
            // hold to skip, in the bottom corner, its bar filling
            var skip = c?.O("skip");
            Show(skipBox, skip != null);
            if (skip != null)
            {
                bool press = skip.Get("press") is bool p && p;
                var s = Ui.Set(skipText, Text.Plain(skip.S("label") ?? ""), 360);
                float tw = press ? 0 : 62;
                Ui.Place(skipText.rectTransform, 8, 3, s.x, 18);
                Show(skipTrack, !press);
                if (!press) { Ui.Place(skipTrack.rectTransform, 8 + s.x + 8, 9, 60, 6); Ui.Place(skipFill.rectTransform, 0, 0, 60 * Mathf.Clamp01(skip.F("k")), 6); }
                float w = s.x + 16 + tw;
                Ui.Place(skipBox.rt, W - 22 - w, H - H * 0.055f - 14, w, 24);
            }
        }

        void BuildDialogue(Font mono)
        {
            // (Hud.cs BuildDialogue: the notebook panel, the portrait chip, the name tag across its top edge)
            dlg = Ui.Node("dialogue", root);
            dlgPanel = Ui.Panel(dlg, "panel", Ui.Paper, Ui.Ink, 2.5f, 6, 6);
            Ui.Stretch(dlgPanel.rt);
            dlgLines = Ui.Stretch(Ui.Node("lines", dlgPanel.fill.rectTransform)).gameObject.AddComponent<Sketch>(); dlgLines.raycastTarget = false; dlgLines.feather = 0.5f;
            dlgText = Ui.Label(dlgPanel.rt, "text", mono, Body, Ui.Ink, lineSpacing: 1.3f);
            for (int i = 0; i < 4; i++)
            {
                // (an answer: no box, its words on the paper, a red mark beside them; the picked one in full ink, a red line under it)
                var b = Ui.Panel(dlgPanel.rt, "choice" + i, Color.clear, Ui.Ink, 0);
                var line = Ui.Rect(b.rt, Ui.Red, 0, "underline");
                dlgChoices.Add((b, Ui.Label(b.rt, "n", mono, AnswerSize, Ui.Red, TextAnchor.UpperLeft, FontStyle.Bold), Ui.Label(b.rt, "t", mono, AnswerSize, Muted, lineSpacing: 1.3f), line));
            }
            dlgMore = Ui.Node("more", dlgPanel.rt).gameObject.AddComponent<Sketch>(); dlgMore.raycastTarget = false;
            dlgMore.rectTransform.anchorMin = dlgMore.rectTransform.anchorMax = new Vector2(1, 0); dlgMore.rectTransform.pivot = Vector2.zero;
            dlgMore.rectTransform.sizeDelta = new Vector2(18, 12);
            dlgMore.Tri(new Vector2(0, 12), new Vector2(18, 12), new Vector2(9, 0), Ui.Red);
            chip = Ui.Node("chip", dlg);
            // (the portrait chip: their colour in an ink ring, their portrait in it (BridgeRunner.Portrait), else their initial)
            var sh = Ui.Rect(chip, Ui.Ink, 0, "shadow"); sh.sprite = Ui.Round(32);
            Ui.Place(sh.rectTransform, 3, 3, ChipD, ChipD);
            var ring = Ui.Rect(chip, Ui.Ink, 0, "ring"); ring.sprite = Ui.Round(32);
            Ui.Place(ring.rectTransform, 0, 0, ChipD, ChipD);
            chipFill = Ui.Rect(chip, Ui.Hex("#d8a24a"), 0, "colour"); chipFill.sprite = Ui.Round(32);
            Ui.Place(chipFill.rectTransform, 3, 3, ChipD - 6, ChipD - 6);
            chipFill.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            chipPhoto = new GameObject("portrait", typeof(RectTransform)).AddComponent<RawImage>();
            chipPhoto.rectTransform.SetParent(chipFill.rectTransform, false);
            Ui.Stretch(chipPhoto.rectTransform);
            chipPhoto.raycastTarget = false;
            chipPhoto.gameObject.SetActive(false);
            chipLetter = Ui.Label(chip, "letter", mono, LetterSize, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Place(chipLetter.rectTransform, 0, 0, ChipD, ChipD);
            var ls = chipLetter.gameObject.AddComponent<Shadow>(); ls.effectColor = Ui.Ink; ls.effectDistance = new Vector2(2, -2);
            chip.localRotation = Quaternion.Euler(0, 0, 3);
            // (the name in plain ink on the paper's first line, issue #208: no caption box, no subtitle)
            dlgTag = Ui.Panel(dlg, "tag", Color.clear, Ui.Ink, 0);
            dlgName = Ui.Label(dlgTag.rt, "name", mono, NameSize, Ui.Ink, TextAnchor.LowerLeft, FontStyle.Bold); Ui.Space(dlgName, 0.08f);
            dlgTitle = Ui.Label(dlgTag.rt, "title", mono, TitleSize, Ui.Hex("#fffaf0", 0.85f), TextAnchor.LowerLeft, FontStyle.Italic);
        }

        static void Show(Component c, bool on) { if (c && c.gameObject.activeSelf != on) c.gameObject.SetActive(on); }
        static void Show(Ui.Box b, bool on) { if (b != null) b.Show(on); }

        /// <summary>A three.js world point ([x, y, z]) on the canvas (top-left origin, y down), or null behind the camera.</summary>
        Vector2? ToCanvas(List<object> at)
        {
            if (at == null || at.Count < 3) return null;
            var world = new Vector3(-Json.Num(at[0]), Json.Num(at[1]), Json.Num(at[2]));   // (Unity's frame: x mirrored)
            var sp = cam.WorldToScreenPoint(world);
            if (sp.z <= 0.05f) return null;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(root, sp, cam, out var lp)) return null;
            return new Vector2(lp.x + W * 0.5f, H * 0.5f - lp.y);
        }

        void Update()
        {
            if (!root) return;
            // (the canvas just beyond the near plane, which the game's camera sets each frame: on it, the HUD was clipped)
            var canvas = root.GetComponent<Canvas>();
            float pd = Mathf.Max(0.2f, cam.nearClipPlane * 3);
            if (!Mathf.Approximately(canvas.planeDistance, pd)) canvas.planeDistance = pd;
            var d = state.O("dialogue");
            // (a ship's scene hides the game's HUD, cinema.hud(false), but for the cue in a scene you walk through,
            // cinema.controls(true); its own pieces drawn over everything)
            var cine = state.O("cine");
            bool hud = !(cine != null && cine.Get("hud") is bool hs && !hs), free = d == null && hud;
            bool walk = cine != null && cine.Get("walk") is bool wk && wk;
            // (photo mode: its keys in the cue's strip at the top, the rest of the HUD gone; none as the picture is taken)
            var cueState = state.O("cue");
            if (state.O("photo") is Dictionary<string, object> ph)
                cueState = (ph.S("hint") ?? "").Length > 0 ? new Dictionary<string, object> { ["text"] = ph.S("hint"), ["kind"] = "" } : null;
            DrawCue(cueState, d == null && (hud || walk));
            DrawToast(state.O("toast"), free);
            DrawPrompt(state.O("prompt"), free);
            DrawHealth(hud ? state.O("health") : null);
            DrawKeys(state.O("keys"), free);
            DrawWheel(state.O("stamina"), free);
            DrawTalk(d, state.Get("choice") is double c ? (int)c : 0);
            DrawCine(cine, state.O("sub"));
        }

        void DrawToast(Dictionary<string, object> t, bool on)
        {
            if (t != null && t.I("id") != toastId) { toastId = t.I("id"); toastT = 0; toastSecs = Mathf.Max(1, t.F("secs", 4)); }
            toastT += Time.unscaledDeltaTime;
            on &= t != null && toastT < toastSecs;
            Show(toast, on);
            if (!on) return;
            float k = toastT / toastSecs;
            float a = k < 0.08f ? k / 0.08f : k < 0.8f ? 1 : 1 - (k - 0.8f) / 0.2f;
            var s = Ui.Set(toastText, Text.Plain(t.S("text")), Mathf.Min(900, W - 60));
            Ui.Place(toastText.rectTransform, 14, 8, s.x, s.y);
            float w = s.x + 28, h = s.y + 16;
            Ui.Place(toast.rt, W / 2 - w / 2, cueBottom > 0 ? cueBottom + HintGap : HintTop, w, h);
            Ui.Group(toast.rt).alpha = a;
        }

        void DrawCue(Dictionary<string, object> c, bool on)
        {
            on &= c != null;
            Show(cue, on);
            cueBottom = 0;
            if (!on) return;
            bool place = c.S("kind") == "place";
            cueText.fontStyle = place ? FontStyle.Italic : FontStyle.Normal;
            // (a region's name: letters on the land, no strip, as the page's #cue.place)
            cue.SetFill(place ? Color.clear : HintBg);
            cueText.color = place ? Ui.Ink : HintInk;
            var s = Ui.Set(cueText, c.S("text"), Mathf.Min(900, W - 60));
            float w = s.x + 24, h = s.y + 12;
            Ui.Place(cueText.rectTransform, 12, 6, s.x, s.y);
            Ui.Place(cue.rt, W / 2 - w / 2, HintTop, w, h);   // (the top centre, first in the hints' stack: issue #306)
            cueBottom = HintTop + h;
        }

        void DrawPrompt(Dictionary<string, object> p, bool on)
        {
            var at = on && p != null ? ToCanvas(p.L("at")) : null;
            Show(prompt, at.HasValue);
            if (!at.HasValue) return;
            var key = p.S("key", "E");
            promptKeyText.text = key;
            float kw = Mathf.Max(21, Ui.Measure(promptKeyText, key).x + 10);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, 21);
            var s = Ui.Set(promptText, p.S("text"), 360);
            Ui.Place(promptText.rectTransform, 4 + kw + 6, 3, s.x, 21);
            float w = 4 + kw + 6 + s.x + 10, h = 27;
            Ui.Place(prompt.rt, Mathf.Clamp(at.Value.x - w / 2, 8, W - w - 8), Mathf.Clamp(at.Value.y - h, 8, H - h - 8), w, h);
        }

        void DrawHealth(Dictionary<string, object> h)
        {
            Show(health, h != null);
            if (h == null) return;
            Ui.Place(health.rt, 16, 14, 150, 11);
            float hp = Mathf.Clamp01(h.F("value", 1)), w = 146 * hp;
            Ui.Place(healthFill.rectTransform, 0, 0, w, 7);
            Ui.Place(healthEdge.rectTransform, w, 0, 2, 7);
            healthFill.color = h.Get("low") is bool low && low ? Color.Lerp(Ui.Hp, Ui.Gold, 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * Mathf.PI * 2.5f)) : Ui.Hp;
        }

        /// <summary>The key counter while in a temple (issue #274; src/hud.js keysHud: { small, big }): "KEY ×N", and
        /// "+ GREAT KEY" once it is in hand; under the health bar.</summary>
        void DrawKeys(Dictionary<string, object> k, bool on)
        {
            on &= k != null;
            Show(keys, on);
            if (!on) return;
            var text = "KEY ×" + k.I("small") + (k.Get("big") is bool big && big ? "  + GREAT KEY" : "");
            var s = Ui.Set(keysText, text, 260);
            Ui.Place(keysText.rectTransform, 8, 3, s.x, 18);
            Ui.Place(keys.rt, 16, 32, s.x + 16, 24);
        }

        void DrawWheel(Dictionary<string, object> s, bool on)
        {
            var at = on && s != null ? ToCanvas(s.L("at")) : null;
            Show(wheel, at.HasValue);
            if (!at.HasValue) return;
            Ui.Place(wheel, at.Value.x - 17, at.Value.y - 17, 34, 34);
            wheelFill.fillAmount = Mathf.Clamp01(s.F("value", 1));
            wheelFill.color = s.Get("winded") is bool w && w ? Ui.Red : Ui.Gold;
        }

        void DrawTalk(Dictionary<string, object> d, int sel)
        {
            Show(dlg, d != null);
            if (d == null) return;
            // (Hud.cs DrawTalk: the same layout)
            var text = d.S("text") ?? ""; int n = Mathf.Clamp(d.I("shown"), 0, text.Length);
            bool done = d.Get("done") is bool b && b;
            var shown = text.Substring(0, done ? text.Length : n);
            if (System.Linq.Enumerable.Count(shown, ch => ch == '*') % 2 == 1) { int i = shown.LastIndexOf('*'); shown = shown.Remove(i, 1); }
            var choices = d.L("choices") ?? new List<object>();
            // (the page whole at once, issue #147: the bundle sends it all, shown = its length; the panel 46 em wide)
            float pw = Mathf.Min(46 * Em, W - 32);
            float padL = 6.3f * Em, padR = 1.3f * Em, padT = 1.95f * Em, padB = 0.85f * Em, cw = pw - padL - padR;
            var body = Ui.Rich(shown) + (done ? "" : "<color=#2b211f99>▍</color>");
            Ui.Set(dlgText, body, cw);
            float textH = Mathf.Max(Body * 2.9f, Ui.Measure(dlgText, Ui.Rich(text), cw).y);
            Ui.Place(dlgText.rectTransform, padL, padT + 4, cw, textH);
            float y = padT + 4 + textH + 0.45f * Em;
            float keyW = 1.1f * Em + 0.55f * Em;
            for (int i = 0; i < dlgChoices.Count; i++)
            {
                var (box, num, tx, line) = dlgChoices[i];
                bool has = i < choices.Count;
                Show(box, has);
                if (!has) continue;
                bool hi = i == sel;
                num.text = (i + 1).ToString();
                Ui.Place(num.rectTransform, 0, 2, keyW, AnswerSize * 1.4f);
                var s = Ui.Set(tx, Ui.Rich(Text.Plain((choices[i] as Dictionary<string, object>).S("text"))), cw - keyW);
                Ui.Place(tx.rectTransform, keyW, 2, s.x, s.y);
                tx.color = hi ? Ui.Ink : Muted;
                Show(line, hi);
                Ui.Place(line.rectTransform, keyW, 2 + s.y + 1, s.x, 2.2f);
                float bh = Mathf.Max(AnswerSize * 1.4f, s.y) + 6;
                Ui.Place(box.rt, padL, y, cw, bh);
                y += bh + 3;
            }
            if (choices.Count > 0) y -= 3;
            float ph = Mathf.Max(5.2f * Em, y + padB);
            Ui.Place(dlg, W / 2 - pw / 2, H - 26 - ph, pw, ph);
            Ui.Place(dlgPanel.rt, 0, 0, pw, ph);
            dlgLines.Clear();
            for (float ly = 1.7f * Em; ly < ph; ly += 1.7f * Em + 1) dlgLines.Box(new Rect(-pw / 2, ph / 2 - ly - 1, pw, 1), Ui.Hex("#2b211f", 0.05f));
            Show(dlgMore, d.Get("more") is bool m && m);
            dlgMore.rectTransform.anchoredPosition = new Vector2(-1.4f * Em, 0.7f * Em + 3 * (0.5f - 0.5f * Mathf.Cos(Time.unscaledTime * Mathf.PI * 2)));
            Ui.Place(chip, 0.8f * Em, -2.1f * Em, ChipD, ChipD);
            var name = d.S("name") ?? "";
            // their portrait when the engine drew one (engine:portrait:n), on its backdrop; else their initial on their colour
            RenderTexture photo = null;
            var ps = d.S("portrait") ?? "";
            if (ps.StartsWith("engine:portrait:") && int.TryParse(ps.Substring(16), out int pn) && BridgeHost.Runner) BridgeHost.Runner.portraits.TryGetValue(pn, out photo);
            var fillHex = photo && d.S("backdrop") is string bd ? bd : d.S("color") ?? "";
            chipFill.color = ColorUtility.TryParseHtmlString(fillHex, out var cc) ? cc : Ui.Hex("#d8a24a");
            if (chipPhoto.texture != photo) chipPhoto.texture = photo;
            Show(chipPhoto, photo);
            Show(chipLetter, !photo);
            chipLetter.text = name.Length > 0 ? name.Substring(0, 1) : "?";
            var ns = Ui.Set(dlgName, Ui.Upper(name));
            Show(dlgTitle, false);
            float tw = Mathf.Min(pw - padL - padR, ns.x), th = 30;
            Ui.Place(dlgName.rectTransform, 0, 0, tw, th);
            Ui.Place(dlgTag.rt, padL, 0.4f * Em, tw, th);
        }
    }
}
