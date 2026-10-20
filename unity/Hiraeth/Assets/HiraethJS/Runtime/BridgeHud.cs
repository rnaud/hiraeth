using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The HUD and the conversation, drawn in uGUI from the web game's own state (src/platform.js
    /// screen: the cue line, the toast, the floating prompt, the health bar, the stamina wheel, the
    /// conversation and the answer a pad has picked, the gadget in hand's chip, its wheel, reticle and
    /// marks, a makers' box's card, a trial's or a game's clock, score, lives, 3-2-1 and flashes), sent by the bundle when
    /// it changes. The pieces
    /// and their layout are the C# port's (Hud.cs, Ui.cs): the same paper, ink and fonts; only where
    /// the state comes from differs. The game decides everything; this only draws it.
    /// </summary>
    public partial class BridgeHud : MonoBehaviour
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
        readonly List<Badge> dlgKeys = new();   // (an answer's confirm badge, a pad in hand: issue #526)
        /// <summary>The panel's type in canvas px (the canvas is 720 tall: index.html #dialogue's --dlg, 2.9 % of the
        /// screen's height, issue #147), and the sizes the rest of the panel takes from it (in em, as the page's):
        /// × the Text size setting (src/ui.js TEXT_SIZES, the page's --ts; issue #346): the
        /// conversation's panel grows with its words (its sizes are in em), as do the hints and the subtitles.</summary>
        float ts = 1;
        int Sz(float px) => Mathf.RoundToInt(px * ts);
        int Body => Sz(21); int AnswerSize => Sz(20); int NameSize => Sz(22);
        const int TitleSize = 16, LetterSize = 44;
        float Em => Body;
        const float ChipD = 4.6f * 21;   // (the portrait's chip keeps its size)
        static readonly Color Muted = Ui.Hex("#5e4b45");
        /// <summary>Every hint one look, one place (issue #306, src/hint-look.js HINT_ENGINE): a near-black strip, cream
        /// letters, at the top centre; the cue first, the toast under it. With the plain speech background (the page's
        /// .speech-solid, issue #346): black and white, the conversation's panel plain white with black words.</summary>
        static readonly Color HintBg0 = new Color(18 / 255f, 14 / 255f, 13 / 255f, 0.92f), HintInk0 = Ui.Hex("#f7ecd2");
        bool solid, showFps;
        Color HintBg => solid ? Color.black : HintBg0;
        Color HintInk => solid ? Color.white : HintInk0;
        const float HintTop = 12, HintGap = 8;
        float cueBottom;   // (where the cue ends this frame: the toast stacks under it)

        public void Set(string json) { state = Json.Parse(json) as Dictionary<string, object> ?? new(); warpHeard = true; }

        /// <summary>The letters the game writes, put in the fonts' textures at once (a dynamic font adding them one by one
        /// rebuilt its texture under labels already drawn: letters dropped out of a frame).</summary>
        static void Warm(Font f)
        {
            const string chars = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’‘“”…—–·▍›◆✦×éèàçôûâêîïüöäñ○□△↑↓←→⥉●☾✒◯◗◎⌇⧗∩✺♪∞";
            var sizes = new HashSet<int> { 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 24, 25, 28, 36, 44 };
            foreach (var k in new[] { 0.85f, 1.2f, 1.45f }) foreach (var px in new[] { 12, 13, 20, 21, 22 }) sizes.Add(Mathf.RoundToInt(px * k));   // (the Text size setting's)
            foreach (var size in sizes)
                foreach (var st in new[] { FontStyle.Normal, FontStyle.Bold, FontStyle.Italic })
                    f.RequestCharactersInTexture(chars, size, st);
        }

        void Start()
        {
            Warm(Ui.Mono); Warm(Ui.Sans);   // (Sans: the minigames' words, the page's --face)
            root = Hud.MakeCanvas(cam, "HUD (JS bridge)", 100);
            root.SetParent(transform, false);
            var mono = Ui.Sans;   // (the page's face, --face, for the hints, the prompts and the conversation; issue #423, the monospaced face before)
            BuildEdges();   // (first: under every other piece, as the page's vignettes are under its HUD)
            toast = Ui.Panel(root, "toast", HintBg0, HintBg0, 0, 0, 0, 4);
            toastText = Ui.Label(toast.rt, "text", mono, 13, HintInk0, TextAnchor.UpperCenter);
            cue = Ui.Panel(root, "cue", HintBg0, HintBg0, 0, 0, 0, 4);
            cueText = Ui.Label(cue.rt, "text", mono, 13, HintInk0, TextAnchor.MiddleCenter);
            prompt = Ui.Panel(root, "prompt", HintBg0, HintBg0, 0, 0, 0, 12);
            promptKey = Ui.Rect(prompt.rt, HintInk0, 11, "key");
            promptKeyText = Ui.Label(promptKey.rectTransform, "k", mono, 11, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(promptKeyText.rectTransform);
            promptText = Ui.Label(prompt.rt, "text", mono, 12, HintInk0, TextAnchor.MiddleLeft);
            health = Ui.Panel(root, "health", Ui.Page, Ui.Ink, 2, 2, 2, 6);
            healthFill = Ui.Rect(health.fill.rectTransform, Ui.Hp, 0, "hp");
            healthEdge = Ui.Rect(health.fill.rectTransform, Ui.Ink, 0, "edge");
            keys = Ui.Panel(root, "keys", Color.clear, Color.clear, 0);   // (no box: the page's keys are inked glyphs on the picture)
            guardian = Ui.Panel(root, "guardian", Ui.Page, Ui.Ink, 2, 2, 2, 6);
            guardianFill = Ui.Rect(guardian.fill.rectTransform, Ui.Hp, 0, "fill");
            guardianEdge = Ui.Rect(guardian.fill.rectTransform, Ui.Ink, 0, "edge");
            guardianText = Ui.Label(root, "guardian name", mono, 11, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            { var o = guardianText.gameObject.AddComponent<Outline>(); o.effectColor = Ui.Page; o.effectDistance = new Vector2(1.5f, -1.5f); }   // (the page's cream text-shadow round it)
            // the Arena's FOES tab on the left edge (src/foe-spawner.js addTab: paper, an ink edge and shadow; its key under it)
            foeTab = Ui.Panel(root, "foe tab", Ui.Hex("#fffaf0"), Ui.Ink, 2, 2, 2, 3);
            foeTabText = Ui.Label(foeTab.rt, "text", mono, 12, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            foeTabKey = Ui.Panel(root, "foe tab key", Ui.Hex("#f7ecd2", 0.85f), Ui.Ink, 1, 0, 0, 3);
            foeTabKeyText = Ui.Label(foeTabKey.rt, "text", mono, 10, Ui.Ink, TextAnchor.MiddleCenter);
            keysGlyph = Ui.Node("glyphs", keys.rt).gameObject.AddComponent<Sketch>(); keysGlyph.raycastTarget = false;
            keysText = Ui.Label(keys.rt, "text", Ui.Sans, 20, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            { var o = keysText.gameObject.AddComponent<Outline>(); o.effectColor = Ui.Hex("#fffaf0"); o.effectDistance = new Vector2(1.5f, -1.5f); }   // (the page's cream glow round ×N)
            wheel = Ui.Node("stamina", root);
            wheelRing = Ui.Fill(wheel, Ui.Hex("#2b211f", 0.25f), 0, "ring"); wheelRing.sprite = Ui.Round(32);
            wheelFill = Ui.Fill(wheel, Ui.Gold, 0, "fill"); wheelFill.sprite = Ui.Round(32);
            wheelFill.type = Image.Type.Filled; wheelFill.fillMethod = Image.FillMethod.Radial360; wheelFill.fillOrigin = (int)Image.Origin360.Top; wheelFill.fillClockwise = false;
            Ui.Stretch(wheelFill.rectTransform, 3, 3, 3, 3);
            wordsRoot = Ui.Node("words", root);   // (a minigame's words in the world: under the conversation and the cards, as the page's #mg-words)
            Ui.Stretch(wordsRoot);
            BuildUnder(mono);     // (the balloons over people, the breath meter, the brass level: BridgeHud.Parts.cs, issue #430)
            BuildDialogue(mono);
            BuildGadgets(mono);
            BuildCine(mono);
            BuildBoxCard(mono);   // (over the letterbox: the card stands in its bottom band)
            BuildCharge();
            BuildOver(mono);      // (the objective card, the cargo check, the end card: BridgeHud.Parts.cs)
            BuildFight(mono);
            BuildGames(mono);     // (the drum circle's ring, the sketch hunt's list, the fishing's meter, the pirates' reticle: BridgeHud.Games.cs)
            BuildMinigame(mono);
            BuildWarp();          // (over everything but the frame readout, as the page's #warp)
            BuildPassage();   // (over everything: the paper covers the screen as it carries you through)
            BuildLoading();   // (over all of it while the world is built: the page's #loading, BridgeHud.Loading.cs)
            fpsBox = Ui.Panel(root, "fps", new Color(1, 250 / 255f, 240 / 255f, 0.8f), Ui.Ink, 1.5f);
            fpsText = Ui.Label(fpsBox.rt, "text", mono, 12, Ui.Ink, TextAnchor.MiddleLeft);
            fpsBox.Show(false);
        }

        // the frame readout (Settings > Show FPS and frame time; the page's #fps, src/main.js frameReadout): the engine, the
        // frames a second and their ms, the script's and the GPU's, bottom right; BridgeMetrics' own while it measures
        Ui.Box fpsBox; Label fpsText;
        float fpsT; int fpsN; double fpsCpu, fpsGpu;
        /// <summary>Is the player's readout on (BridgeMetrics shows its own then, and only then, unless -metrics asks).</summary>
        public static bool ShowFps;
        void DrawFps()
        {
            ShowFps = showFps;
            bool on = showFps && !BridgeMetrics.Overlay;
            fpsBox.Show(on);
            fpsN++; fpsT += Time.unscaledDeltaTime;
            var r = BridgeHost.Runner;
            if (r) { fpsCpu += r.cpuMs; fpsGpu += r.gpuMs; }
            if (fpsT < 0.5f) return;
            float fps = fpsN / fpsT;
            var text = $"UNITY {SystemInfo.graphicsDeviceType} · {fps:0} fps · {1000 / fps:0.0} ms (cpu {fpsCpu / fpsN:0.0} gpu {fpsGpu / fpsN:0.0})";
            fpsN = 0; fpsT = 0; fpsCpu = 0; fpsGpu = 0;
            if (!on) return;
            var s = Ui.Set(fpsText, text, 900);
            Ui.Place(fpsText.rectTransform, 7, 3, s.x, 16);
            Ui.Place(fpsBox.rt, W - 64 - (s.x + 14), H - 22 - 22, s.x + 14, 22);
        }

        // the ship's scenes (src/ship/cinema.js, screen 'cine' and 'sub'; issue #264): the letterbox, the fade, the red
        // wash, the hint under the top bar, the subtitle over the bottom one and the hold-to-skip tag, over the HUD as
        // the page's #cine is
        Image cineRed, cineFade, barTop, barBot;
        Ui.Box subBox, cineHint, skipBox; Label subText, cineHintText, skipText; Image skipTrack, skipFill;
        float fadeA, barH, redA; int subId = -1; float subT;
        float barFrom, barTo, barT = 1;   // (the letterbox's way in or out: from, to, its share of the 1.1 s done)
        static readonly Color CineInk = Ui.Hex("#2b211f"), CinePaper = Ui.Hex("#fff6dc"), SubPaper = new Color(247 / 255f, 236 / 255f, 210 / 255f, 0.95f);
        const int SubSize = 21;

        void BuildCine(Font mono)
        {
            cineRed = Ui.Fill(root, new Color(170 / 255f, 30 / 255f, 25 / 255f, 1), 0, "cine red"); cineRed.raycastTarget = false;
            cineFade = Ui.Fill(root, CineInk, 0, "cine fade"); cineFade.raycastTarget = false;
            barTop = Ui.Rect(root, CineInk, 0, "cine bar top"); barBot = Ui.Rect(root, CineInk, 0, "cine bar bottom");
            cineHint = Ui.Panel(root, "cine hint", HintBg0, HintBg0, 0, 0, 0, 4);
            cineHintText = Ui.Label(cineHint.rt, "text", mono, 13, HintInk0, TextAnchor.UpperCenter);
            subBox = Ui.Panel(root, "cine sub", SubPaper, CineInk, 2, 3, 3);
            subText = Ui.Label(subBox.rt, "text", mono, SubSize, CineInk, TextAnchor.UpperCenter, lineSpacing: 1.25f);
            skipBox = Ui.Panel(root, "cine skip", new Color(43 / 255f, 33 / 255f, 31 / 255f, 0.82f), Color.clear, 0);
            skipText = Ui.Label(skipBox.rt, "text", mono, 12, HintInk0, TextAnchor.MiddleLeft);
            skipTrack = Ui.Rect(skipBox.rt, HintInk, 0, "track"); skipFill = Ui.Rect(skipTrack.rectTransform, Ui.Gold, 0, "fill");
        }

        const float BarSecs = 1.1f;   // (src/ship/cinema.js: #cine .bar's transition)
        /// <summary>A CSS cubic-bezier(x1, y1, x2, y2) timing function at x (0..1): the curve's t for x found by Newton's
        /// steps (bisection where they stall), its y there.</summary>
        public static float CssEase(float x, float x1, float y1, float x2, float y2)
        {
            if (x <= 0) return 0; if (x >= 1) return 1;
            float Bz(float t, float a, float b) => ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t;
            float t = x;
            for (int i = 0; i < 8; i++)
            {
                float e = Bz(t, x1, x2) - x, d = (3 * (1 - 3 * x2 + 3 * x1)) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1;
                if (Mathf.Abs(e) < 1e-5f) return Bz(t, y1, y2);
                if (Mathf.Abs(d) < 1e-6f) break;
                t -= e / d;
            }
            float lo = 0, hi = 1; t = x;
            for (int i = 0; i < 30; i++) { float e = Bz(t, x1, x2) - x; if (Mathf.Abs(e) < 1e-5f) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2; }
            return Bz(t, y1, y2);
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
            // (eyes: the lid drives them, over the shut lids too, until they are let go: the page's inline heights; the wake was
            // all black in Unity once his eyes were open, issue #394)
            bool eyes = c != null && c.Get("eyes") is bool ey && ey;
            float to = eyes || lid < 1 ? 0.505f - (0.505f - 0.11f) * lid : lids ? 0.505f : bars ? 0.11f : 0;
            // (in and out as the page's CSS transition: 1.1 s on cubic-bezier(.6, 0, .3, 1), from wherever it was, started
            // again when the target moves; it went at an even pace in 0.6 s before, narrower than the web's a beat in and
            // wider a beat after, issue #459)
            if (lids || eyes || lid < 1) { barH = barFrom = barTo = to; barT = 1; }
            else {
                if (to != barTo) { barFrom = barH; barTo = to; barT = 0; }
                barT = Mathf.Min(1, barT + dt / BarSecs);
                barH = Mathf.LerpUnclamped(barFrom, barTo, CssEase(barT, 0.6f, 0f, 0.3f, 1f));
            }
            Show(barTop, barH > 0.001f); Show(barBot, barH > 0.001f);
            Ui.Place(barTop.rectTransform, 0, 0, W, barH * H); Ui.Place(barBot.rectTransform, 0, H - barH * H, W, barH * H);
            // the hint under the top bar
            var hint = c?.S("hint") ?? "";
            Show(cineHint, hint.Length > 0);
            if (hint.Length > 0)
            {
                cineHint.SetFill(HintBg); cineHintText.color = HintInk; cineHintText.fontSize = Sz(13);
                var s = Ui.Set(cineHintText, Text.Plain(hint), Mathf.Min(560 * ts, W - 60));
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
                subText.fontSize = Sz(SubSize);
                subBox.SetFill(solid ? Color.white : SubPaper); subText.color = solid ? Color.black : CineInk;
                var s = Ui.Set(subText, body, Mathf.Min(46 * Sz(SubSize), W - 64));
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

        /// <summary>A three.js world point ([x, y, z]) in Unity's frame (x mirrored).</summary>
        static Vector3 World(List<object> at) => new Vector3(-Json.Num(at[0]), Json.Num(at[1]), Json.Num(at[2]));

        // -hud-trace: where the stamina wheel and the floating prompt are drawn against where their point in the world is
        // drawn, measured as the camera starts to render (the canvas where it is drawn from), in screen px: the error and
        // its change from frame to frame (the shake), logged every 2 s. The wheel's centre and the prompt's foot (its
        // bottom middle, unless held in at an edge) should sit on their points.
        static readonly bool trace = BridgeArgs.Flag("-hud-trace");
        class Trace { public Vector3? at; public Vector2 last; public bool had; public int n, shakeN; public double sum, max, shakeSum, shakeMax; }
        readonly Trace traceWheel = new(), tracePrompt = new();
        float traceT;
        // (as the camera starts to draw; in a batch run, whose camera draws only for its pictures, as the canvases are
        // made ready to draw at the end of the frame instead: once a frame either way)
        void OnEnable() { if (trace) { UnityEngine.Rendering.RenderPipelineManager.beginCameraRendering += TraceCam; Canvas.willRenderCanvases += TraceCanvas; } }
        void OnDisable() { if (trace) { UnityEngine.Rendering.RenderPipelineManager.beginCameraRendering -= TraceCam; Canvas.willRenderCanvases -= TraceCanvas; } }
        int traceFrame = -1, traceCams;
        void TraceCam(UnityEngine.Rendering.ScriptableRenderContext ctx, Camera c) { if (c == cam) { traceCams++; TraceFrame(); } }
        void TraceCanvas() { if (traceCams == 0) TraceFrame(); }
        void TraceFrame()
        {
            if (!root || traceFrame == Time.frameCount) return;
            traceFrame = Time.frameCount;
            Sample(traceWheel, wheel, new Vector2(0.5f, 0.5f));
            Sample(tracePrompt, prompt.rt, new Vector2(0.5f, 0));
            traceT += Time.unscaledDeltaTime;
            if (traceT < 2) return;
            traceT = 0;
            string Say(Trace t) => t.n == 0 ? "not shown" : $"n {t.n}, off {t.sum / t.n:0.0} px (max {t.max:0.0}), shake {t.shakeSum / Mathf.Max(1, t.shakeN):0.00} px a frame (max {t.shakeMax:0.0})";
            Debug.Log($"Hiraeth bridge: hud trace ({(traceCams > 0 ? "as the camera draws" : "as the canvases are made ready")}{(oldPlace ? ", placed as before" : "")}): wheel {Say(traceWheel)}; prompt {Say(tracePrompt)}; {Screen.width}x{Screen.height}, canvas {W:0}x{H:0}");
            foreach (var t in new[] { traceWheel, tracePrompt }) { t.n = t.shakeN = 0; t.sum = t.max = t.shakeSum = t.shakeMax = 0; t.had = false; }
        }
        void Sample(Trace t, RectTransform rt, Vector2 pivot)
        {
            if (!t.at.HasValue || !rt || !rt.gameObject.activeInHierarchy) { t.had = false; return; }
            var truth = cam.WorldToScreenPoint(t.at.Value);
            var corners = new Vector3[4]; rt.GetWorldCorners(corners);   // (bottom left, top left, top right, bottom right)
            var drawn = cam.WorldToScreenPoint(Vector3.Lerp(Vector3.Lerp(corners[0], corners[3], pivot.x), Vector3.Lerp(corners[1], corners[2], pivot.x), pivot.y));
            var err = (Vector2)drawn - (Vector2)truth;
            t.n++; t.sum += err.magnitude; t.max = System.Math.Max(t.max, err.magnitude);
            if (t.had) { double d = (err - t.last).magnitude; t.shakeSum += d; t.shakeN++; t.shakeMax = System.Math.Max(t.shakeMax, d); }
            t.last = err; t.had = true;
        }

        /// <summary>A three.js world point ([x, y, z]) on the canvas (top-left origin, y down), or null behind the camera.</summary>
        /// <remarks>From the camera's viewport, which the canvas covers, as the page projects its #stamina and #prompt: not
        /// through the canvas' own transform (RectTransformUtility from a screen point), which the canvas moves to the camera
        /// only as it draws, so it stood where last frame's camera had put it, and nearer or further with the near plane the
        /// game sets each frame: while running the wheel and the floating prompt were off their points by the camera's
        /// last step, and shook as the frames' lengths varied (the AYN Thor's Unity build, issue #264).</remarks>
        Vector2? ToCanvas(List<object> at)
        {
            if (at == null || at.Count < 3) return null;
            if (oldPlace)
            {
                var sp = cam.WorldToScreenPoint(World(at));
                if (sp.z <= 0.05f) return null;
                if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(root, sp, cam, out var lp)) return null;
                return new Vector2(lp.x + W * 0.5f, H * 0.5f - lp.y);
            }
            var vp = cam.WorldToViewportPoint(World(at));   // (Unity's frame: x mirrored)
            if (vp.z <= 0.05f) return null;
            return new Vector2(vp.x * W, (1 - vp.y) * H);
        }

        // (in LateUpdate: after BridgeRunner's Update has applied the frame's ops, the camera's place and this state among
        // them, so the HUD is placed with the camera the frame is drawn with, whichever of the two Updates Unity runs first.
        // -hud-old: placed as before, in Update and through the canvas' transform, a check against -hud-trace's numbers)
        static readonly bool oldPlace = BridgeArgs.Flag("-hud-old");
        void Update() { if (oldPlace) Draw(); }
        void LateUpdate() { if (!oldPlace) Draw(); }
        /// <summary>Laid out again at once for the canvas's size now: a batch shot (BridgeRunner.Shot) draws 1280 × 720 while
        /// the editor's batch window is 4:3, and the HUD stood where the window had it, the letterbox, the subtitles and the
        /// skip stopping at three quarters of the picture's width (issue #459).</summary>
        public void Relayout() { Canvas.ForceUpdateCanvases(); Draw(); Canvas.ForceUpdateCanvases(); }
        // (-no-hud: nothing of the HUD drawn, the picture alone, as the web's side-by-sides hide the page: scripts/unity-compare/)
        static readonly bool noHud = BridgeArgs.Flag("-no-hud");
        Dictionary<string, object> shows;
        /// <summary>Does the part show now, by the page's rules (src/hud-shows.js hudShows: false for each part hidden).</summary>
        bool On(string part) => !(shows != null && shows.Get(part) is bool b && !b);
        /// <summary>The part's state, or null while the page's rules hide it.</summary>
        Dictionary<string, object> Part(string part) => On(part) ? state.O(part) : null;
        void Draw()
        {
            if (!root) return;
            if (noHud) { if (root.gameObject.activeSelf) root.gameObject.SetActive(false); return; }
            // (the canvas just beyond the near plane, which the game's camera sets each frame: on it, the HUD was clipped)
            var canvas = root.GetComponent<Canvas>();
            float pd = Mathf.Max(0.2f, cam.nearClipPlane * 3);
            if (!Mathf.Approximately(canvas.planeDistance, pd)) canvas.planeDistance = pd;
            // the accessibility settings sent with the screen's state (engine/unity/game.js access)
            var acc = state.O("access");
            ts = Mathf.Clamp(acc?.F("ts", 1) ?? 1, 0.6f, 2f);
            solid = acc != null && acc.Get("solid") is bool so && so;
            showFps = acc != null && acc.Get("fps") is bool fp && fp;
            DrawFps();
            var d = state.O("dialogue");
            var cine = state.O("cine");
            // (which parts the page's rules hide now: src/hud-shows.js, sent with the state as `shows`, issue #430; the
            // conditions kept here before drifted from the page's: the voicemail's E drew only while the HUD was on, #394)
            shows = state.O("shows");
            // (photo mode: its keys in the cue's strip at the top, the rest of the HUD gone; none as the picture is taken)
            var cueState = state.O("cue");
            if (state.O("photo") is Dictionary<string, object> ph)
                cueState = (ph.S("hint") ?? "").Length > 0 ? new Dictionary<string, object> { ["text"] = ph.S("hint"), ["kind"] = "" } : null;
            var mg = state.O("minigame");
            DrawCue(cueState, On("cue"));
            DrawGames(state, On("words"));
            DrawMinigame(d == null ? mg : null);   // (before the toast: it stacks under the run's clock)
            DrawWords(Part("words"));
            DrawBreath(Part("breath"));
            DrawLevel(Part("level"));
            DrawToast(state.O("toast"), On("toast"));
            DrawObjective(Part("objective"));
            DrawBalloons(On("balloons") ? state.L("balloons") : null);
            DrawPrompt(state.O("prompt"), On("prompt"));
            DrawHealth(Part("health"));
            DrawKeys(state.O("keys"), On("keys"));
            DrawGuardian(Part("guardian"));
            DrawFoeTab(state.O("foeTab"), On("foeTab"));
            DrawWheel(state.O("stamina"), On("stamina"));
            DrawTool(Part("tool"));   // (the fluid tool's crosshair and mode, its notices by the traveller: BridgeHud.Tool.cs)
            DrawTalk(d, state.Get("choice") is double c ? (int)c : 0);
            DrawGadget(Part("gadget"));
            DrawGadgetWheel(Part("gadgetWheel"));
            DrawReticle(Part("reticle"));
            DrawMarks(On("gadgetMarks") ? state.L("gadgetMarks") : null);
            DrawCine(cine, state.O("sub"));
            DrawBoxCard(state.O("boxCard"));
            DrawCharge(state.O("charge"));
            DrawCargo(state.O("cargo"));
            DrawEndCard(state.O("endCard"));
            DrawCredits(state.O("credits"));   // (over the end card, as the page's z 8200: BridgeHud.Credits.cs)
            DrawEdges(state.O("edges"));
            DrawLock(Part("lock"));
            DrawWarn(On("warn") ? state.L("warn") : null);
            DrawSelf(Part("self"));
            DrawRestart(state.O("restart"));
            DrawWarp(state.O("warp"));
            DrawPassage(state.O("passage"));
            DrawLoading();
        }

        // ---------------------------------------------------------------- the take-off's warp (issue #264)
        // src/ship/cinema.js Warp: in the take-off's last second space opens out of the middle of the screen, a disc of the
        // night's ink grown over the climbing sky to its corners (an inked rim round it), the streaks in the paper's cream,
        // a little teal and red, rushing out, a few fixed stars, the destination's name on a paper card. Screen 'warp'
        // (its title, an id per take-off) starts it; it runs on this clock, as the page's canvas does on its own. The
        // engine then starts again on the next world (BridgeRunner.Reboot: the scene loaded anew, this HUD with it): the
        // warp is carried over (static), drawn whole while the world loads, as the web's loading screen keeps its ink
        // (index.html #loading.space), and fades out as the new world's first state comes (the arrival).
        static readonly Color WarpSpace = Ui.Hex("#151a2b"), WarpInk = Ui.Hex("#2b211f"), WarpPaper = Ui.Hex("#f7ecd2");
        static readonly Color[] WarpStreaks = { Ui.Hex("#f7ecd2"), Ui.Hex("#62c3c9"), Ui.Hex("#e0705f") };
        const float WarpOpen = 0.9f;
        static string warpCarry;   // (the title of a warp under way when the scene was loaded anew: a flight's reboot)
        RectTransform warpRoot; Sketch warpSketch; Ui.Box warpCard; Label warpCardText;
        struct Streak { public float a, r, v, w, c; }
        Streak[] streaks; Vector2[] stars;
        int warpId = -1; float warpT, warpA, warpCardA; bool warpOn, warpHeard, warpCarried;

        void BuildWarp()
        {
            // (placed as the rest of the HUD is, from the canvas's top-left: the sketch's origin there, y up)
            warpRoot = Ui.Node("warp", root);
            warpSketch = Ui.Node("space", warpRoot).gameObject.AddComponent<Sketch>();
            warpSketch.raycastTarget = false;
            warpCard = Ui.Panel(warpRoot, "title", WarpPaper, WarpInk, 2, 6, 6);
            warpCardText = Ui.Label(warpCard.rt, "text", Ui.Heavy, 30, WarpInk, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Space(warpCardText, 0.24f);
            var rnd = new System.Random(7);
            float R() => (float)rnd.NextDouble();
            streaks = new Streak[220];
            for (int i = 0; i < streaks.Length; i++) streaks[i] = new Streak { a = R() * Mathf.PI * 2, r = R(), v = 0.4f + R(), w = 1 + R() * 2.5f, c = R() };
            stars = new Vector2[90];
            for (int i = 0; i < stars.Length; i++) stars[i] = new Vector2(R(), R());
            // (a flight's reboot: the warp goes on whole while the next world loads)
            if (warpCarry != null) { warpOn = warpCarried = true; warpT = WarpOpen + 1; warpA = warpCardA = 1; warpCardText.text = warpCarry; }
            warpRoot.gameObject.SetActive(warpOn);
        }

        void DrawWarp(Dictionary<string, object> w)
        {
            float dt = Time.unscaledDeltaTime;
            if (w != null && w.I("id") != warpId)
            {
                warpId = w.I("id"); warpT = 0; warpA = 0; warpCardA = 0; warpOn = true; warpCarried = false;
                warpCarry = (w.S("title") ?? "").ToUpperInvariant();
                warpCardText.text = warpCarry;
            }
            // (carried over a reboot: out once the new world says something, the arrival under way; or a take-off's own
            // warp gone from the state without a reboot)
            bool fading = warpCarried ? warpHeard : w == null;
            if (fading) warpCarry = null;
            if (!warpOn) return;
            warpT += dt;
            // the element's opacity: in over 0.5 s (the climbing sky under it at first), out the same way
            warpA = Mathf.MoveTowards(warpA, fading ? 0 : 1, dt / 0.5f);
            warpCardA = fading ? Mathf.Min(warpCardA, warpA) : warpT < 0.4f ? 0 : Mathf.MoveTowards(warpCardA, 1, dt / 0.6f);
            if (fading && warpA <= 0) { warpOn = false; warpRoot.gameObject.SetActive(false); warpSketch.Clear(); return; }
            if (!warpRoot.gameObject.activeSelf) warpRoot.gameObject.SetActive(true);
            Ui.Group(warpRoot).alpha = warpA;
            Ui.Place(warpRoot, 0, 0, W, H); Ui.Place(warpSketch.rectTransform, 0, 0, W, H);
            // the page's warpLook: the disc's reach (smoothstep over WarpOpen s) and the streaks' speed
            float k0 = Mathf.Clamp01(warpT / WarpOpen), hole = k0 * k0 * (3 - 2 * k0), k = Mathf.Clamp01(warpT / 1.2f);
            float cx = W / 2, cy = -H / 2, Rr = Mathf.Sqrt(W * W + H * H) / 2;
            var sk = warpSketch; sk.Clear();
            if (hole < 1) { var p = WarpPaper; p.a = 0.35f + 0.65f * hole; sk.Box(new Rect(-W, -2 * H, 3 * W, 3 * H), p); }
            float rh = hole >= 1 ? Rr * 1.5f : Mathf.Max(1, hole * Rr * 1.04f);
            var c = new Vector2(cx, cy);
            sk.Disc(c, rh, WarpSpace);
            if (hole < 1) sk.Ring(c, rh, 3, WarpInk);
            // (inside the disc: the stars, then the streaks rushing out, cut at its rim)
            var star = WarpPaper; star.a = 0.55f;
            for (int i = 0; i < stars.Length; i++)
            {
                var sp = new Vector2(stars[i].x * W, -stars[i].y * H);
                if ((sp - c).sqrMagnitude < rh * rh) { float sz = 0.6f + (i * 0.37f % 1) * 1.4f; sk.Box(new Rect(sp.x, sp.y, sz + 0.6f, sz + 0.6f), star); }
            }
            for (int i = 0; i < streaks.Length; i++)
            {
                ref var st = ref streaks[i];
                st.r = (st.r + dt * st.v * (0.3f + 1.6f * k)) % 1;
                float r0 = st.r * st.r * Rr, r1 = Mathf.Min(rh, r0 + (30 + 260 * k) * st.r);
                if (r0 >= rh || r1 - r0 < 0.5f) continue;
                var d = new Vector2(Mathf.Cos(st.a), Mathf.Sin(st.a));
                sk.Line(c + d * r0, c + d * r1, st.w * (0.4f + st.r), st.c < 0.12f ? WarpStreaks[2] : st.c < 0.22f ? WarpStreaks[1] : WarpStreaks[0]);
            }
            // the destination's name on its card, in the middle
            bool card = warpCardText.text.Length > 0;
            warpCard.Show(card);
            if (card)
            {
                var sz = Ui.Set(warpCardText, warpCardText.text, W - 80);
                Ui.Place(warpCardText.rectTransform, 22, 10, sz.x, sz.y);
                Ui.Place(warpCard.rt, W / 2 - (sz.x + 44) / 2, H / 2 - (sz.y + 20) / 2, sz.x + 44, sz.y + 20);
                Ui.Group(warpCard.rt).alpha = warpCardA;
            }
        }

        // ---------------------------------------------------------------- a way through (src/passage.js; issue #264)
        // the paper that sweeps across as a door, a cave mouth, a hatch or a temple's door carries you to another space (the
        // page's #passage, PassageCover): the screen's 'passage' { phase: cover | reveal, secs, light, lightSecs, n } from
        // engine/game.js; the sheet, SHEET vw wide with an inked edge each side, slides in from the left until it covers the
        // screen, then on off the right; the doorway's warm light (src/thresholds.js) over the screen before it
        const float PassSheet = 124, PassEdge = 12;   // (vw: as passage.js SHEET, EDGE)
        static readonly Color PassPaper = Ui.Hex("#f2e7cf"), PassLight = Ui.Hex("#ffe9b8");
        Image passLight, passPaper, passInkL, passInkR;
        float passX = -PassSheet, passFrom, passTo = -PassSheet, passT, passSecs = 1, passLightA, passLightTo, passLightSecs = 0.3f;
        bool passReveal; double passN = -1;
        void BuildPassage()
        {
            passLight = Ui.Fill(root, PassLight, 0, "passage light"); passLight.raycastTarget = false;
            passPaper = Ui.Rect(root, PassPaper, 0, "passage paper"); passPaper.raycastTarget = false;
            passInkL = Ui.Rect(passPaper.rectTransform, Ui.Ink, 0, "ink left"); passInkR = Ui.Rect(passPaper.rectTransform, Ui.Ink, 0, "ink right");
            Show(passLight, false); Show(passPaper, false);
        }
        void DrawPassage(Dictionary<string, object> p)
        {
            float dt = Time.unscaledDeltaTime;
            if (p != null && p.Get("n") is double n && n != passN)
            {
                passN = n;
                passLightTo = Mathf.Clamp01(p.F("light")); passLightSecs = Mathf.Max(0.01f, p.F("lightSecs", 0.3f));
                var phase = p.S("phase");
                if (phase == "cover" || phase == "reveal")
                {
                    passReveal = phase == "reveal";
                    // (a cover starts off the left, as the page's: no transition back there)
                    passFrom = passReveal ? passX : -PassSheet; passTo = passReveal ? 100 : -PassEdge;
                    passT = 0; passSecs = Mathf.Max(0.01f, p.F("secs", 0.3f));
                }
            }
            if (p == null) { passLightTo = 0; if (!passReveal && passX > -PassSheet) { passFrom = passX; passTo = 100; passT = 0; passSecs = 0.3f; passReveal = true; } }
            // the sheet, eased as the page's (cover: cubic-bezier(.5,0,.75,1), an ease-in; reveal: (.25,0,.5,1), an ease-out)
            passT = Mathf.Min(passT + dt, passSecs);
            float u = passT / passSecs, e = passReveal ? 1 - (1 - u) * (1 - u) : u * u * u;
            passX = Mathf.Lerp(passFrom, passTo, e);
            bool on = passX > -PassSheet + 0.01f && passX < 99.99f;
            Show(passPaper, on);
            if (on)
            {
                // (the paper between its two inked edges, which stand 0.55 × EDGE in from the sheet's sides, as sheetPath's)
                float vw = W / 100f, inset = 0.65f * PassEdge, pw = (PassSheet - 2 * inset) * vw, ink = Mathf.Max(2, 0.3f * vw);
                Ui.Place(passPaper.rectTransform, (passX + inset) * vw, 0, pw, H);
                Ui.Place(passInkL.rectTransform, 0, 0, ink, H);
                Ui.Place(passInkR.rectTransform, pw - ink, 0, ink, H);
            }
            passLightA = Mathf.MoveTowards(passLightA, passLightTo, dt / passLightSecs);
            passLight.color = new Color(PassLight.r, PassLight.g, PassLight.b, 0.85f * passLightA);
            Show(passLight, passLightA > 0.002f);
        }

        // ---------------------------------------------------------------- the fight (issue #264; engine/combat.js)
        // the lock-on's reticle (src/lock-reticle.js: four gold arrowheads round the foe, tips in, turning; hollow and
        // fainter when it is out of the blade's reach), the markers of foes winding up out of sight (Foes.warnings: an ink
        // ring at the screen's edge filling with the foe's tone), the edges (the low-health heartbeat's red, the flurry's
        // lavender, a moth's white flash) and the knock-out's card, all from the game's state as the page draws them
        static Sprite triFill, triLine, vignette;
        readonly List<(RectTransform rt, Image halo, Image ink, Image face)> lockArrows = new();
        RectTransform lockRoot;
        readonly List<(RectTransform rt, Image ring, Image paper, Image tone)> warnChips = new();
        Image edgeLow, edgeFlurry, edgeBlind;
        Ui.Box restartBox, restartButton; Label restartText, restartKey; Image restartDim; float restartT;
        static readonly Color Gold = Ui.Hex("#f2c54b"), Light = Ui.Hex("#fff6dc");

        /// <summary>An arrowhead pointing down, its tip at the sprite's bottom centre (the pivot): filled, or its outline.</summary>
        static Sprite Arrow(bool outline)
        {
            const int w = 34, h = 36; const float edge = 2.6f;
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = outline ? "arrow line" : "arrow" };
            var px = new Color32[w * h];
            // (the triangle: the tip at (w/2, 0), the back corners at (w, h) and (0, h), texture y up)
            Vector2 a = new(w / 2f, 0), b = new(w, h), c = new(0, h);
            static float Side(Vector2 p, Vector2 u, Vector2 v) { var e = (v - u).normalized; return (p.x - u.x) * e.y - (p.y - u.y) * e.x; }
            float sgn = Side(new Vector2(w / 2f, h / 2f), a, b) < 0 ? 1 : -1;   // (inside negative, whichever way the corners turn)
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    float d = Mathf.Max(Side(p, a, b) * sgn, Mathf.Max(Side(p, b, c) * sgn, Side(p, c, a) * sgn));   // (< 0 inside, by its nearest edge)
                    float k = outline ? Mathf.Clamp01(0.5f - (Mathf.Abs(d + edge * 0.5f) - edge * 0.5f)) : Mathf.Clamp01(0.5f - d);
                    px[y * w + x] = new Color32(255, 255, 255, (byte)(k * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            return Sprite.Create(t, new Rect(0, 0, w, h), new Vector2(0.5f, 0), 100);
        }
        /// <summary>The page's vignettes: clear in the middle, darkening out to the corners (radial-gradient 46 % → 100 %).</summary>
        static Sprite Vignette()
        {
            const int n = 128;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "vignette" };
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n * 2 - 1, v = (y + 0.5f) / n * 2 - 1, r = Mathf.Sqrt(u * u + v * v) / Mathf.Sqrt(2);
                    float al = r < 0.46f ? 0 : r < 0.84f ? Mathf.Lerp(0, 0.6f, (r - 0.46f) / 0.38f) : Mathf.Lerp(0.6f, 0.9f, (r - 0.84f) / 0.16f);
                    px[y * n + x] = new Color32(255, 255, 255, (byte)(Mathf.Clamp01(al) * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            return Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100);
        }

        void BuildEdges()
        {
            vignette ??= Vignette();
            Image V(string name, Color c) { var im = Ui.Fill(root, c, 0, name); im.sprite = vignette; im.type = Image.Type.Simple; im.enabled = false; return im; }
            edgeLow = V("low health", new Color(122 / 255f, 26 / 255f, 14 / 255f, 0));
            edgeFlurry = V("flurry", new Color(120 / 255f, 98 / 255f, 160 / 255f, 0));
            edgeBlind = Ui.Fill(root, new Color(1, 0.98f, 0.95f, 0), 0, "blind"); edgeBlind.enabled = false;
        }

        void BuildFight(Font mono)
        {
            if (!triFill) triFill = Arrow(false);
            if (!triLine) triLine = Arrow(true);
            BuildSelf();   // (the traveller's ring in a fight temple's crowd: BridgeHud.Self.cs, issue #534)
            lockRoot = Ui.Node("lock-on", root);
            for (int i = 0; i < 4; i++)
            {
                var rt = Ui.Node("arrow " + i, lockRoot);
                rt.pivot = new Vector2(0.5f, 0);
                Image Layer(string name, Color c, float grow)
                {
                    var im = Ui.Rect(rt, c, 0, name); im.sprite = triFill; im.type = Image.Type.Simple;
                    var r = im.rectTransform; r.anchorMin = r.anchorMax = new Vector2(0.5f, 0); r.pivot = new Vector2(0.5f, 0);
                    r.anchoredPosition = new Vector2(0, -grow * 0.6f); r.sizeDelta = new Vector2(17 + grow * 2, 18 + grow * 2);
                    return im;
                }
                var halo = Layer("halo", new Color(Light.r, Light.g, Light.b, 0.45f), 6.5f);
                var ink = Layer("ink", new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.85f), 2.6f);
                var face = Layer("face", Gold, 0);
                lockArrows.Add((rt, halo, ink, face));
            }
            lockRoot.gameObject.SetActive(false);
            // (the world dimmed under the card, as the page's #restart: rgba(43, 33, 31, 0.6), faded in over 0.9 s; issue #449)
            // (0.78 here: Unity blends in its linear target, the page in display values, where 0.6 of ink over the sand darkens it as much)
            restartDim = Ui.Fill(root, new Color(43 / 255f, 33 / 255f, 31 / 255f, 0.78f), 0, "restart dim");
            restartDim.gameObject.SetActive(false);
            restartBox = Ui.Panel(root, "restart", Ui.Hex("#f7ecd2"), Ui.Ink, 2, 6, 6);
            restartText = Ui.Label(restartBox.rt, "text", mono, 20, Ui.Ink, TextAnchor.UpperCenter);
            Ui.Space(restartText, 0.04f);
            // (its button: the page's gold button in an ink line on a small hard shadow)
            restartButton = Ui.Panel(restartBox.rt, "button", Ui.Hex("#f2c54b"), Ui.Ink, 2, 3, 3, 4);
            restartKey = Ui.Label(restartButton.rt, "key", mono, 20, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Space(restartKey, 0.14f);
            restartBox.Show(false);
        }

        void DrawEdges(Dictionary<string, object> e)
        {
            float low = e?.F("low") ?? 0, fl = e?.F("flurry") ?? 0, bl = e?.F("blind") ?? 0;
            static void Set(Image im, float a, float scale) { im.enabled = a > 0.002f; var c = im.color; c.a = a * scale; im.color = c; }
            Set(edgeLow, low, 1); Set(edgeFlurry, fl, 0.6f);
            if (bl > 0.002f && e?.S("tone") is string tone) { var tc = Ui.Hex(tone); var bc = Color.Lerp(new Color(1, 0.98f, 0.95f), tc, 0.18f); bc.a = edgeBlind.color.a; edgeBlind.color = bc; }
            Set(edgeBlind, bl, 1);
        }

        void DrawLock(Dictionary<string, object> l)
        {
            var arrows = l?.L("arrows");
            bool on = arrows != null && arrows.Count >= 4;
            if (lockRoot.gameObject.activeSelf != on) lockRoot.gameObject.SetActive(on);
            if (!on) return;
            float k = l.F("k", 1), cx = l.F("x") * W, cy = l.F("y") * H;
            bool hollow = l.Get("hollow") is bool ho && ho;
            Ui.Alpha(lockRoot, Mathf.Clamp01(l.F("a", 1)));
            lockRoot.anchoredPosition = new Vector2(cx, -cy); lockRoot.sizeDelta = Vector2.zero;
            for (int i = 0; i < 4; i++)
            {
                var a = arrows[i] as List<object>; var A = lockArrows[i];
                // (the web's: translate to the tip, rotate by deg (clockwise on a y-down page), the arrow drawn pointing down;
                // here y is up, so the turn is the other way and the sprite, its tip at the bottom, points down when upright)
                A.rt.anchoredPosition = new Vector2((float)Json.Num(a[0]) * H, -(float)Json.Num(a[1]) * H);
                A.rt.localRotation = Quaternion.Euler(0, 0, -(float)Json.Num(a[2]));
                A.rt.localScale = Vector3.one * k;
                A.face.enabled = !hollow;
                A.ink.sprite = hollow ? triLine : triFill; A.halo.sprite = hollow ? triLine : triFill;
            }
        }

        void DrawWarn(List<object> list)
        {
            int n = list?.Count ?? 0;
            while (warnChips.Count < n)
            {
                var rt = Ui.Node("foe warning " + warnChips.Count, root);
                var shadow = Round(rt, Ui.Ink, "shadow"); Ui.Place(shadow.rectTransform, 2, 2, 34, 34);
                var ring = Round(rt, Ui.Ink, "ring"); Ui.Place(ring.rectTransform, 0, 0, 34, 34);
                var paper = Round(rt, new Color(Cream.r, Cream.g, Cream.b, 0.85f), "paper"); Ui.Place(paper.rectTransform, 3, 3, 28, 28);
                var tone = Round(rt, Ui.Ink, "tone");
                warnChips.Add((rt, ring, paper, tone));
            }
            for (int i = 0; i < warnChips.Count; i++)
            {
                var C = warnChips[i]; bool on = i < n;
                if (C.rt.gameObject.activeSelf != on) C.rt.gameObject.SetActive(on);
                if (!on) continue;
                var w = list[i] as Dictionary<string, object>;
                float x = (w.F("x") * 0.5f + 0.5f) * W, y = (0.5f - w.F("y") * 0.5f) * H, k = Mathf.Clamp01(w.F("k")) * 0.7f;
                Ui.Place(C.rt, x - 17, y - 17, 36, 36);
                if (w.S("tone") is string t) C.tone.color = Ui.Hex(t);
                float d = 28 * k; Ui.Place(C.tone.rectTransform, 17 - d / 2, 17 - d / 2, d, d);
                C.tone.enabled = d > 0.5f;
            }
        }

        void DrawRestart(Dictionary<string, object> r)
        {
            restartBox.Show(r != null);
            restartDim.gameObject.SetActive(r != null);
            if (r == null) { restartT = 0; return; }
            // (the page's #restart: the world dimmed, the card a sixth of the way down, faded in together over 0.9 s)
            restartT += Time.unscaledDeltaTime;
            float a = Mathf.Clamp01(restartT / 0.9f);
            Ui.Place(restartDim.rectTransform, 0, 0, W, H);
            Ui.Alpha(restartDim.rectTransform, a); Ui.Alpha(restartBox.rt, a);
            var s = Ui.Set(restartText, r.S("text") ?? "", 520);
            var ks = Ui.Set(restartKey, $"{r.S("key") ?? ""}  {r.S("label") ?? ""}".Trim(), 520);
            float bw = ks.x + 44, bh = ks.y + 20;
            float w = Mathf.Max(Mathf.Max(s.x, bw) + 52, 13 * 21), h = 18 + s.y + 12 + bh + 18;
            Ui.Place(restartText.rectTransform, (w - s.x) / 2, 18, s.x, s.y);
            Ui.Place(restartButton.rt, (w - bw) / 2, 18 + s.y + 12, bw, bh);
            Ui.Place(restartKey.rectTransform, 0, 0, bw, bh);
            Ui.Place(restartBox.rt, (W - w) / 2, H * 0.16f, w, h);
        }

        // ---------------------------------------------------------------- a trial's or a game's HUD (screen 'minigame')
        // src/minigames/kit/runner.js publish (the web's #minigame, src/minigames/kit/minigames.css): the lives at the left,
        // the clock in the middle (sent once a second while it runs: counted on here between), the score's box at the right,
        // the 3-2-1 in big inked numerals popping in, the flashes stacked under the clock, the hint row at the bottom right
        Ui.Box mgTimer, mgScore; Label mgTimerText, mgPenalty, mgScoreText, mgCount; RectTransform mgLives;
        readonly List<Image> mgLife = new();
        readonly List<(Ui.Box box, Label text, int id, float t, float secs)> mgFlash = new();
        Ui.Box mgHints, mgNote; Label mgHintsText, mgNoteText;
        int mgCountId = -1; float mgCountT; double mgSecs = -1; bool mgRun; float mgLocal; int mgBump = -1; float mgBumpT = 1;
        static readonly Color MgGold = Ui.Hex("#f2c54b"), MgTeal = Ui.Hex("#71d7cf"), MgBad = Ui.Hex("#d9643a"), MgCard = Ui.Hex("#fbf4e2");

        Sketch mgSpeed; bool mgSpeedOn; readonly System.Random mgRnd = new(11);
        void BuildMinigame(Font mono)
        {
            // (the speed lines first, under the run's HUD: the page's canvas under #minigame)
            mgSpeed = Ui.Node("mg speed", root).gameObject.AddComponent<Sketch>();
            mgSpeed.raycastTarget = false;
            mgTimer = Ui.Panel(root, "mg timer", Ui.Page, Ui.Ink, 2, 4, 4);
            mgTimerText = Ui.Label(mgTimer.rt, "text", mono, 26, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold, 1.1f); Ui.Space(mgTimerText, 0.06f);
            mgPenalty = Ui.Label(mgTimer.rt, "penalty", mono, 11, Ui.Faint, TextAnchor.UpperCenter); Ui.Space(mgPenalty, 0.14f);
            mgScore = Ui.Panel(root, "mg score", Ui.Page, Ui.Ink, 2, 4, 4);
            mgScoreText = Ui.Label(mgScore.rt, "text", mono, 19, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold, 1.2f);
            mgLives = Ui.Node("mg lives", root);
            mgCount = Ui.Label(root, "mg count", Ui.Heavy, 140, MgGold, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
            var o = mgCount.gameObject.AddComponent<Outline>(); o.effectColor = Ui.Ink; o.effectDistance = new Vector2(3, -3);
            var sh = mgCount.gameObject.AddComponent<Shadow>(); sh.effectColor = Ui.Ink; sh.effectDistance = new Vector2(7, -7);
            mgHints = Ui.Panel(root, "mg hints", HintBg0, HintBg0, 0, 0, 0, 4);
            mgHintsText = Ui.Label(mgHints.rt, "text", mono, 11, HintInk0, TextAnchor.MiddleLeft, FontStyle.Bold);
            // (the game's line beside the row in a box of its own: the page's .mg-hints p, heavier and spaced; issue #569)
            mgNote = Ui.Panel(root, "mg note", HintBg0, HintBg0, 0, 0, 0, 4);
            mgNoteText = Ui.Label(mgNote.rt, "text", mono, 11, HintInk0, TextAnchor.MiddleLeft, FontStyle.Bold); Ui.Space(mgNoteText, 0.06f);
            foreach (var b in new[] { mgTimer, mgScore, mgHints, mgNote }) b.Show(false);
            Show(mgCount, false); mgLives.gameObject.SetActive(false);
        }

        /// <summary>The speed lines (runner.js speedLines, the page's half-size canvas stretched over the screen): ink streaks
        /// from the edges toward the middle, drawn anew each frame at random, more and darker the faster (k 0..1).</summary>
        void DrawSpeed(float k)
        {
            if (k < 0.02f) { if (mgSpeedOn) { mgSpeed.Clear(); mgSpeedOn = false; } return; }
            mgSpeedOn = true;
            Ui.Place(mgSpeed.rectTransform, 0, 0, W, H);
            var sk = mgSpeed; sk.Clear();
            float R() => (float)mgRnd.NextDouble();
            // (in the canvas' half-size units, then doubled: its lines' widths with them)
            float hw = W / 2, hh = H / 2, cx = hw / 2, cy = hh * 0.5f, Rr = Mathf.Sqrt(hw * hw + hh * hh) / 2;
            int n = Mathf.RoundToInt(6 + 22 * k);
            for (int i = 0; i < n; i++)
            {
                float a = R() * Mathf.PI * 2, r0 = Rr * (0.74f + 0.24f * R() - 0.12f * k), len = Rr * (0.05f + 0.14f * k * R());
                var c = Ui.Ink; c.a = 0.12f + 0.4f * k * R();
                float w = 0.5f + 1.1f * R();
                var p0 = new Vector2(cx + Mathf.Cos(a) * r0, cy + Mathf.Sin(a) * r0 * 0.8f) * 2;
                var p1 = new Vector2(cx + Mathf.Cos(a) * (r0 + len), cy + Mathf.Sin(a) * (r0 + len) * 0.8f) * 2;
                sk.Line(new Vector2(p0.x, -p0.y), new Vector2(p1.x, -p1.y), w * 2, c);
            }
        }

        /// <summary>A time as the game writes it (src/minigames/kit/scores.js formatTime): 1:23.45, 9.05.</summary>
        static string MgTime(double s)
        {
            int cs = Mathf.Max(0, Mathf.FloorToInt((float)(s * 100 + 1e-6)));
            int m = cs / 6000, sec = cs / 100 % 60, hun = cs % 100;
            return m > 0 ? $"{m}:{sec:00}.{hun:00}" : $"{sec}.{hun:00}";
        }

        void DrawMinigame(Dictionary<string, object> g)
        {
            float dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);   // (the game's own step is held to 1/20 s: engine/game.js)
            bool on = g != null && g.Get("on") is bool o && o;
            DrawSpeed(on ? (float)g.F("speed") : 0);
            // the clock, the score's box and the lives, along the top
            var tm = on ? g.O("timer") : null;
            mgTimer.Show(tm != null);
            if (tm != null)
            {
                double secs = tm.F("secs");
                bool run = tm.Get("run") is bool r && r;
                if (secs != mgSecs || run != mgRun) { mgSecs = secs; mgRun = run; mgLocal = 0; }
                if (run) mgLocal += dt;
                double t = mgSecs + mgLocal, down = tm.F("down"), pen = tm.F("penalty");
                var ts = Ui.Set(mgTimerText, MgTime(down > 0 ? System.Math.Max(0, down - t) : t));
                string ps = pen > 0 ? $"+{pen:0.#} S PENALTY" : pen < 0 ? $"{-pen:0.#} S BONUS" : "";
                Show(mgPenalty, ps.Length > 0);
                float w = Mathf.Max(ts.x + 28, 26 * 0.62f * 6.2f), h = ts.y + 8 + (ps.Length > 0 ? 14 : 0);
                Ui.Place(mgTimerText.rectTransform, 0, 4, w, ts.y);
                if (ps.Length > 0) { mgPenalty.text = ps; Ui.Place(mgPenalty.rectTransform, 0, 4 + ts.y, w, 14); }
                Ui.Place(mgTimer.rt, W / 2 - w / 2, 14, w, h);
                cueBottom = Mathf.Max(cueBottom, 14 + h + 4);   // (the toast under it)
            }
            var sc = on ? g.S("score") ?? "" : "";
            mgScore.Show(sc.Length > 0);
            if (sc.Length > 0)
            {
                int bump = g.I("bump");
                if (bump != mgBump) { if (mgBump >= 0) mgBumpT = 0; mgBump = bump; }
                mgBumpT += dt;
                float k = mgBumpT < 0.25f ? 1 + 0.12f * Mathf.Sin(mgBumpT / 0.25f * Mathf.PI) : 1;
                var ss = Ui.Set(mgScoreText, sc);
                Ui.Place(mgScoreText.rectTransform, 14, 4, ss.x, ss.y);
                float w = ss.x + 28, h = ss.y + 9;
                Ui.Place(mgScore.rt, W - 18 - w, 14, w, h);
                mgScore.rt.localScale = new Vector3(k, k, 1);
            }
            var lives = on ? g.L("lives") : null;
            mgLives.gameObject.SetActive(lives != null);
            if (lives != null && lives.Count >= 2)
            {
                int n = (int)Json.Num(lives[0]), max = (int)Json.Num(lives[1]);
                while (mgLife.Count < max) { var d = Ui.Rect(mgLives, MgBad, 0, "life" + mgLife.Count); d.sprite = Ui.Round(32); d.type = Image.Type.Sliced; var ol = d.gameObject.AddComponent<Outline>(); ol.effectColor = Ui.Ink; ol.effectDistance = new Vector2(2, -2); mgLife.Add(d); }
                for (int i = 0; i < mgLife.Count; i++)
                {
                    Show(mgLife[i], i < max);
                    if (i >= max) continue;
                    mgLife[i].color = i < n ? MgBad : new Color(MgBad.r, MgBad.g, MgBad.b, 0.0f);
                    mgLife[i].GetComponent<Outline>().effectColor = i < n ? Ui.Ink : new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.45f);
                    Ui.Place(mgLife[i].rectTransform, i * 30, 0, 24, 24);
                }
                Ui.Place(mgLives, 18, 18, max * 30, 24);
            }
            // the 3-2-1: each numeral pops in big and fades (0.8 s); GO! in teal, held until the runner lets it go
            var cn = g?.O("count");
            if (cn != null && cn.I("id") != mgCountId) { mgCountId = cn.I("id"); mgCountT = 0; }
            mgCountT += dt;
            bool go = cn != null && cn.Get("go") is bool gg && gg;
            bool showCount = cn != null && (go || mgCountT < 0.8f);
            Show(mgCount, showCount);
            if (showCount)
            {
                float u = Mathf.Clamp01(mgCountT / 0.8f), s = u < 0.18f ? Mathf.Lerp(1.9f, 1, u / 0.18f) : Mathf.Lerp(1, 0.86f, (u - 0.18f) / 0.82f);
                float a = u < 0.18f ? u / 0.18f : u < 0.75f || go ? 1 : 1 - (u - 0.75f) / 0.25f;
                mgCount.text = cn.S("text");
                mgCount.color = go ? MgTeal : MgGold;
                mgCount.fontSize = go ? 72 : 84;   // (the page's 9.85em and 8.62em of Futura: the condensed face here stands taller, 140 was two thirds too big, issue #264)
                Ui.PlaceC(mgCount.rectTransform, 0, H * 0.38f - 100, W, 200);
                mgCount.rectTransform.localScale = new Vector3(s, s, 1);
                Ui.Alpha(mgCount.rectTransform, a);
            }
            // the flashes, under the clock: "+3 s", "Gate!", the room's name (good teal, bad vermilion, big twice the size)
            var fl = g?.L("flashes") ?? new List<object>();
            var ids = new HashSet<int>(fl.OfType<Dictionary<string, object>>().Select(f => f.I("id")));
            for (int i = mgFlash.Count - 1; i >= 0; i--) if (!ids.Contains(mgFlash[i].id) || mgFlash[i].t > mgFlash[i].secs) { Destroy(mgFlash[i].box.rt.gameObject); mgFlash.RemoveAt(i); }
            foreach (var f in fl.OfType<Dictionary<string, object>>())
            {
                if (mgFlash.Any(x => x.id == f.I("id"))) continue;
                var kind = f.S("kind") ?? "";
                var box = Ui.Panel(root, "mg flash", kind.Contains("bad") ? MgBad : kind.Contains("good") ? MgTeal : Ui.Page, Ui.Ink, 2, 3, 3);
                // (in the page's face, minigames.css .mg-flash: the monospace before, issue #556: the pirates' place names in it)
                var text = Ui.Label(box.rt, "text", Ui.Sans, kind.Contains("big") ? 27 : 16, kind.Contains("bad") ? MgCard : Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold, 1.2f);
                Ui.Space(text, 0.06f);
                text.text = f.S("text");
                mgFlash.Add((box, text, f.I("id"), 0, Mathf.Max(0.3f, f.F("secs", 1.2f))));
            }
            float fy = 92;
            for (int i = 0; i < mgFlash.Count; i++)
            {
                var (box, text, id, t, secs) = mgFlash[i];
                t += dt;
                mgFlash[i] = (box, text, id, t, secs);
                var s = Ui.Measure(text, text.text, W - 80);
                bool big = text.fontSize > 20;   // (big: 27 px, a room's name, the finish)
                float w = s.x + (big ? 44 : 24), h = s.y + (big ? 12 : 6);
                float u = t / secs, a = u < 0.12f ? u / 0.12f : u < 0.8f ? 1 : Mathf.Max(0, 1 - (u - 0.8f) / 0.2f);
                float lift = u < 0.12f ? -8 * (1 - u / 0.12f) : u > 0.8f ? 6 * (u - 0.8f) / 0.2f : 0;
                Ui.Place(text.rectTransform, 0, 0, w, h);
                Ui.Place(box.rt, W / 2 - w / 2, fy + lift, w, h);
                Ui.Alpha(box.rt, a);
                fy += h + 6;
            }
            // the controls' hint row (def.hints: the pirates between worlds), each word gone once used, and the game's line beside
            // it in a box of its own (the page's .mg-hints: the row and its p side by side, 8 px apart, centred on one line, at the
            // bottom right; issue #569: one bar before)
            var hi = g?.O("hints");
            bool hon = hi != null && !(hi.Get("off") is bool ho && ho);
            var parts = hon ? (hi.L("items") ?? new List<object>()).OfType<Dictionary<string, object>>().Where(x => !(x.Get("gone") is bool gn && gn)).Select(x => $"<color=#f2c54b>{x.S("k")}</color> {x.S("w")}").ToList() : new List<string>();
            var note = hon ? hi.S("note") ?? "" : "";
            mgHints.Show(parts.Count > 0); mgNote.Show(note.Length > 0);
            float hx = W - 14, hb = H - 12;
            Vector2 ns = Vector2.zero, rs = Vector2.zero;
            if (note.Length > 0) { mgNote.SetFill(HintBg); mgNoteText.color = HintInk; ns = Ui.Set(mgNoteText, note, W - 60); }
            if (parts.Count > 0) { mgHints.SetFill(HintBg); mgHintsText.color = HintInk; rs = Ui.Set(mgHintsText, string.Join("   ", parts), W - 60 - (note.Length > 0 ? ns.x + 26 : 0)); }
            float rowH = Mathf.Max(note.Length > 0 ? ns.y + 8 : 0, parts.Count > 0 ? rs.y + 8 : 0);
            if (note.Length > 0)
            {
                Ui.Place(mgNoteText.rectTransform, 9, 4, ns.x, ns.y);
                Ui.Place(mgNote.rt, hx - (ns.x + 18), hb - rowH / 2 - (ns.y + 8) / 2, ns.x + 18, ns.y + 8);
                hx -= ns.x + 18 + 8;
            }
            if (parts.Count > 0)
            {
                Ui.Place(mgHintsText.rectTransform, 9, 4, rs.x, rs.y);
                Ui.Place(mgHints.rt, hx - (rs.x + 18), hb - rowH / 2 - (rs.y + 8) / 2, rs.x + 18, rs.y + 8);
            }
        }

        // ---------------------------------------------------------------- the gadgets (issue #344; src/gadgets/hud.js)
        // the chip: the gadget in hand's picture alone in a paper disc, top right (issue #240), a thin teal ring round it
        // filled as far as its count goes, faded when none is left, a gold ring a moment when it changes; the wheel for
        // choosing one (D-pad ↑ or B held); the reticle on what an aim would catch; the numbered diamonds on its locks
        class Disc { public RectTransform rt; public Image shadow, ink, paper; public RawImage pic; public Label glyph; }
        Disc gChip; Image gGauge, gFlash; string gChipId = ""; float gFlashT = 1;
        RectTransform gWheel; Image gWheelBack; readonly List<Disc> gSlots = new(); Ui.Box gWheelName; Label gWheelNameText;
        Ui.Box ret; Image retH, retV; Ui.Box retTag; Label retText;
        readonly List<(RectTransform rt, Label n)> gMarks = new();
        static readonly Color Teal = Ui.Hex("#2f7f86"), Track = Ui.Hex("#2b211f", 0.18f), Cream = Ui.Hex("#f7ecd2");

        static Image Round(Transform parent, Color c, string name)
        {
            var im = Ui.Rect(parent, c, 0, name); im.sprite = Ui.Round(32); im.type = Image.Type.Simple; return im;
        }
        /// <summary>A round slot: an ink ring on its shadow, the paper in it masking the picture (or the gadget's mark).</summary>
        Disc MakeDisc(Transform parent, string name, Font mono, int glyphSize)
        {
            var d = new Disc { rt = Ui.Node(name, parent) };
            d.shadow = Round(d.rt, Ui.Ink, "shadow");
            d.ink = Round(d.rt, Ui.Ink, "ring");
            d.paper = Round(d.rt, Cream, "paper");
            d.paper.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            d.pic = new GameObject("picture", typeof(RectTransform)).AddComponent<RawImage>();
            d.pic.rectTransform.SetParent(d.paper.rectTransform, false); Ui.Stretch(d.pic.rectTransform); d.pic.raycastTarget = false;
            d.glyph = Ui.Label(d.rt, "mark", mono, glyphSize, Ui.Ink, TextAnchor.MiddleCenter);
            return d;
        }
        static void LayDisc(Disc d, float x, float y, float size, float bw, float shadow, Color paper, Texture2D pic, string glyph)
        {
            Ui.Place(d.rt, x, y, size, size);
            Ui.Place(d.shadow.rectTransform, shadow, shadow, size, size);
            Show(d.shadow, shadow > 0);
            Ui.Place(d.ink.rectTransform, 0, 0, size, size);
            Ui.Place(d.paper.rectTransform, bw, bw, size - 2 * bw, size - 2 * bw);
            d.paper.color = paper;
            if (d.pic.texture != pic) d.pic.texture = pic;
            Show(d.pic, pic);
            Show(d.glyph, !pic);
            d.glyph.text = glyph ?? "◆";
            Ui.Place(d.glyph.rectTransform, 0, 0, size, size);
        }

        void BuildGadgets(Font mono)
        {
            gGauge = Round(root, Track, "gadget gauge"); gGauge.raycastTarget = false;
            gFlash = Round(root, Ui.Gold, "gadget flash");
            gChip = MakeDisc(root, "gadget chip", mono, 22);
            gWheel = Ui.Node("gadget wheel", root);
            gWheelBack = Round(gWheel, Ui.Hex("#f7ecd2", 0.35f), "ring");
            gWheelName = Ui.Panel(gWheel, "name", Cream, Ui.Ink, 1.5f);
            gWheelNameText = Ui.Label(gWheelName.rt, "text", mono, 14, Ui.Ink, TextAnchor.MiddleCenter); Ui.Space(gWheelNameText, 0.08f);
            ret = Ui.Panel(root, "reticle", Color.clear, Ui.Ink, 2.5f, 0, 0, 17);
            retH = Ui.Rect(ret.rt, Ui.Ink, 0, "h"); retV = Ui.Rect(ret.rt, Ui.Ink, 0, "v");
            retTag = Ui.Panel(root, "reticle tag", Ui.Hex("#f7ecd2", 0.85f), Ui.Ink, 1);
            retText = Ui.Label(retTag.rt, "text", mono, 12, Ui.Ink, TextAnchor.MiddleCenter);
        }

        void DrawGadget(Dictionary<string, object> g)
        {
            bool on = g != null;
            Show(gChip.rt, on); Show(gGauge, on && g.Get("k") is double); Show(gFlash, false);
            if (!on) { gChipId = ""; return; }
            // (the web's clamp(30px, 6vh, 42px), 12 px down from the top right, 14 px in)
            float d = Mathf.Clamp(H * 0.06f, 30, 42), x = W - 14 - d, y = 12;
            var id = g.S("id") ?? "";
            if (id != gChipId) { gChipId = id; gFlashT = 0; }
            gFlashT += Time.unscaledDeltaTime;
            bool empty = g.Get("empty") is bool e && e;
            if (g.Get("k") is double k)
            {
                // the count: a thin teal ring round the picture, filled clockwise from the top as far as there is
                Ui.Place(gGauge.rectTransform, x - 5, y - 5, d + 10, d + 10);
                gGauge.type = Image.Type.Filled; gGauge.fillMethod = Image.FillMethod.Radial360; gGauge.fillOrigin = (int)Image.Origin360.Top; gGauge.fillClockwise = true;
                gGauge.fillAmount = 1; gGauge.color = Teal; gGauge.fillAmount = Mathf.Clamp01((float)k);
            }
            // (a new gadget in hand: a gold ring that fades, the chip a little larger a moment)
            float f = Mathf.Clamp01(1 - gFlashT / 0.6f), grow = 1 + 0.35f * f * f;
            if (f > 0) { Show(gFlash, true); gFlash.color = new Color(Ui.Gold.r, Ui.Gold.g, Ui.Gold.b, f); float r = d * grow + 10; Ui.Place(gFlash.rectTransform, x + d / 2 - r / 2, y + d / 2 - r / 2, r, r); }
            float s = d * grow;
            LayDisc(gChip, x + d / 2 - s / 2, y + d / 2 - s / 2, s, 1.5f, 2, Ui.Hex("#fffaf0", 0.92f), BridgeMenu.Picture(id), g.S("glyph"));
            Ui.Group(gChip.rt).alpha = empty ? 0.5f : 1;
        }

        void DrawGadgetWheel(Dictionary<string, object> w)
        {
            var slots = w?.L("slots");
            Show(gWheel, slots != null);
            if (slots == null) return;
            // (more than eight: a wider ring of smaller slots, as the web's .many; more than twelve, the gadgets and the
            // glove's modes, wider again: .lots, issue #511)
            int n = slots.Count, hi = w.I("hi", -1);
            bool many = n > 8, lots = n > 12;
            float size = lots ? 404 : many ? 344 : 300, R = lots ? 166 : many ? 136 : 112, C = size / 2, sd = lots ? 46 : many ? 50 : 56;
            Ui.Place(gWheel, W / 2 - C, H / 2 - C, size, size);
            Ui.Place(gWheelBack.rectTransform, 40, 40, size - 80, size - 80);
            while (gSlots.Count < n) { var d = MakeDisc(gWheel, "slot" + gSlots.Count, Ui.Mono, many ? 21 : 24); gSlots.Add(d); }
            for (int i = 0; i < gSlots.Count; i++)
            {
                bool has = i < n;
                Show(gSlots[i].rt, has);
                if (!has) continue;
                var sl = slots[i] as Dictionary<string, object>;
                float a = i / (float)n * Mathf.PI * 2, x = C + Mathf.Sin(a) * R, y = C - Mathf.Cos(a) * R;
                float z = i == hi ? sd * (many ? 1.18f : 1.25f) : sd;
                // (a glove mode's slot: its glyph on the mode's own tint, no picture: its id is 'gun.push')
                var tint = sl.S("tint");
                LayDisc(gSlots[i], x - z / 2, y - z / 2, z, 2, 3, i == hi ? Ui.Gold : string.IsNullOrEmpty(tint) ? Cream : Ui.Hex(tint), BridgeMenu.Picture(sl.S("id")), sl.S("glyph"));
            }
            gWheelName.rt.SetAsLastSibling();
            var s = Ui.Set(gWheelNameText, Ui.Upper(w.S("name") ?? ""), 260);
            Ui.Place(gWheelNameText.rectTransform, 8, 3, s.x, s.y);
            Ui.Place(gWheelName.rt, C - (s.x + 16) / 2, C - (s.y + 6) / 2, s.x + 16, s.y + 6);
        }

        void DrawReticle(Dictionary<string, object> r)
        {
            Vector2? at = null;
            if (r != null) at = r.L("at") is List<object> p ? ToCanvas(p) : r.S("kind") == "far" ? (Vector2?)new Vector2(W / 2, H / 2) : null;
            Show(ret, at.HasValue); Show(retTag, false);
            if (!at.HasValue) return;
            var kind = r.S("kind") ?? "ok";
            // (nohold: a makers' house's bare stone won't take the hook, a longer cross turned 45°: src/gadgets/hud.js, issue #432)
            bool no = kind == "nohold";
            float sc = kind == "far" ? 0.7f : no ? 0.85f : 1, sz = 34 * sc, arm = no ? 8 : 6;
            Ui.Place(ret.rt, at.Value.x - sz / 2, at.Value.y - sz / 2, sz, sz);
            ret.border.color = kind == "anchor" ? Ui.Red : kind == "target" ? Teal : Ui.Ink;
            ret.rt.localRotation = Quaternion.Euler(0, 0, kind == "anchor" || no ? 45 : 0);
            Ui.Alpha(ret.rt, kind == "far" ? 0.55f : 1);
            Ui.Place(retH.rectTransform, sz / 2 - arm, sz / 2 - 1, arm * 2, 2);
            Ui.Place(retV.rectTransform, sz / 2 - 1, sz / 2 - arm, 2, arm * 2);
            var label = r.S("label") ?? "";
            if (label.Length == 0) return;
            Show(retTag, true);
            var s = Ui.Set(retText, label, 300);
            Ui.Place(retText.rectTransform, 5, 1, s.x, s.y);
            Ui.Place(retTag.rt, at.Value.x - (s.x + 10) / 2, at.Value.y + 23, s.x + 10, s.y + 2);
        }

        void DrawMarks(List<object> list)
        {
            int n = list?.Count ?? 0;
            while (gMarks.Count < n)
            {
                var rt = Ui.Node("gadget mark" + gMarks.Count, root);
                var dia = Ui.Panel(rt, "diamond", Ui.Hex("#f7ecd2", 0.75f), Ui.Red, 2.5f);
                Ui.Place(dia.rt, 3, 3, 20, 20); dia.rt.localRotation = Quaternion.Euler(0, 0, 45);
                dia.rt.pivot = new Vector2(0.5f, 0.5f); dia.rt.anchoredPosition = new Vector2(13, -13);
                var num = Ui.Label(rt, "n", Ui.Sans, 11, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);   // (#gadget-marks .m b: the page's face)
                Ui.Place(num.rectTransform, 0, 0, 26, 26);
                gMarks.Add((rt, num));
            }
            for (int i = 0; i < gMarks.Count; i++)
            {
                var m = i < n ? list[i] as Dictionary<string, object> : null;
                var at = m != null ? ToCanvas(m.L("at")) : null;
                Show(gMarks[i].rt, at.HasValue);
                if (!at.HasValue) continue;
                Ui.Place(gMarks[i].rt, at.Value.x - 13, at.Value.y - 13, 26, 26);
                gMarks[i].n.text = m.S("label") ?? (i + 1).ToString();
            }
        }

        // ---------------------------------------------------------------- a minigame's words in the world (src/minigames/kit/labels.js)
        // the screen's 'words': a pop ("+10", "+250", "×3") floats up 70 px from where its world point falls and fades over
        // its last 30 %, popping in at 1.35 × its size; cream letters stroked in ink (gold, vermilion, teal by its kind);
        // a speech balloon over someone (cream, an ink edge and hard shadow, round corners, its tail at the foot), and a
        // label over a thing to pick (its name in capitals, the words under it), both kept on the screen, as the page's
        RectTransform wordsRoot;
        class Pop { public int id; public RectTransform rt; public Label text; public float t, secs; public List<object> at; }
        readonly List<Pop> pops = new();
        readonly List<(Ui.Box box, Label text, Image tail)> says = new();
        readonly List<(Ui.Box box, Label title, Label text)> tags = new();
        static readonly Color WordCream = Ui.Hex("#fbf4e2");

        void DrawWords(Dictionary<string, object> w)
        {
            float dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);
            var list = (w?.L("pops") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            var ids = new HashSet<int>(list.Select(p => p.I("id")));
            for (int i = pops.Count - 1; i >= 0; i--) if (!ids.Contains(pops[i].id) || pops[i].t >= pops[i].secs) { Destroy(pops[i].rt.gameObject); pops.RemoveAt(i); }
            foreach (var p in list)
            {
                int id = p.I("id");
                if (pops.Any(x => x.id == id) || id <= popSeen) continue;
                popSeen = Mathf.Max(popSeen, id);
                var kind = p.S("kind") ?? "";
                var c = kind == "gold" ? MgGold : kind == "bad" ? MgBad : kind == "combo" ? MgTeal : WordCream;
                int size = kind == "gold" ? 28 : kind == "bad" ? 22 : kind == "combo" ? 24 : 20;
                var rt = Ui.Node("pop", wordsRoot);
                var t = Ui.Label(rt, "text", Ui.Sans, size, c, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
                Ui.Space(t, 0.04f);
                // (-webkit-text-stroke 3px in ink, painted under the fill: eight copies round it)
                foreach (var dd in new[] { new Vector2(1.6f, 1.6f), new Vector2(2.2f, 0), new Vector2(0, 2.2f) }) { var o = t.gameObject.AddComponent<Outline>(); o.effectColor = Ui.Ink; o.effectDistance = dd; o.useGraphicAlpha = true; }
                t.horizontalOverflow = HorizontalWrapMode.Overflow;
                t.text = p.S("text") ?? "";
                pops.Add(new Pop { id = id, rt = rt, text = t, t = 0, secs = Mathf.Max(0.1f, p.F("secs", 0.9f)), at = p.L("at") });
            }
            foreach (var q in pops)
            {
                q.t += dt;
                float k = q.t / q.secs;
                var at = ToCanvas(q.at);
                bool on = at.HasValue && k < 1 && at.Value.x > -0.1f * W && at.Value.x < 1.1f * W && at.Value.y > -0.1f * H && at.Value.y < 1.1f * H;
                Show(q.rt, on);
                if (!on) continue;
                var sz = Ui.Measure(q.text, q.text.text);
                Ui.PlaceC(q.rt, at.Value.x - sz.x / 2, at.Value.y - 70 * k - sz.y / 2, sz.x, sz.y);
                Ui.Stretch(q.text.rectTransform);
                float sc = 1.35f - 0.35f * Mathf.Min(1, k * 4);
                q.rt.localScale = new Vector3(sc, sc, 1);
                Ui.Alpha(q.rt, k < 0.7f ? 1 : 1 - (k - 0.7f) / 0.3f);
            }
            // the balloons
            var sl = (w?.L("says") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            while (says.Count < sl.Count)
            {
                var box = Ui.Panel(wordsRoot, "say", WordCream, Ui.Ink, 2, 3, 3, 14);
                var text = Ui.Label(box.rt, "text", Ui.Sans, Sz(13), Ui.Ink, TextAnchor.UpperLeft, FontStyle.Normal, 1.2f);
                // (its tail: an ink corner at the foot, 24 px in from the left)
                var tail = Ui.Rect(box.rt, Ui.Ink, 0, "tail"); tail.rectTransform.localRotation = Quaternion.Euler(0, 0, 45);
                tail.rectTransform.SetSiblingIndex(0);   // (under the paper: only its point shows below the edge)
                says.Add((box, text, tail));
            }
            for (int i = 0; i < says.Count; i++)
            {
                var m = i < sl.Count ? sl[i] : null;
                var at = m != null ? ToCanvas(m.L("at")) : null;
                Show(says[i].box, at.HasValue);
                if (!at.HasValue) continue;
                var (box, text, tail) = says[i];
                text.fontSize = Sz(13);
                var s = Ui.Set(text, m.S("text") ?? "", 300 - 24);
                float bw = s.x + 24, bh = s.y + 15;
                float x = Mathf.Clamp(at.Value.x, bw / 2 + 8, W - bw / 2 - 8), y = Mathf.Max(bh + 8, at.Value.y);
                Ui.Place(box.rt, x - bw / 2, y - bh, bw, bh);
                Ui.Place(text.rectTransform, 12, 7, s.x, s.y);
                Ui.PlaceC(tail.rectTransform, 22, bh - 6.5f, 11, 11);
            }
            // the labels
            var tl = (w?.L("tags") ?? new List<object>()).OfType<Dictionary<string, object>>().ToList();
            while (tags.Count < tl.Count)
            {
                var box = Ui.Panel(wordsRoot, "tag", Ui.Page, Ui.Ink, 2, 3, 3);
                var title = Ui.Label(box.rt, "title", Ui.Sans, 13, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold, 1.2f); Ui.Space(title, 0.08f);
                var text = Ui.Label(box.rt, "text", Ui.Sans, Sz(11), Ui.Ink, TextAnchor.UpperCenter, FontStyle.Normal, 1.2f);
                tags.Add((box, title, text));
            }
            for (int i = 0; i < tags.Count; i++)
            {
                var m = i < tl.Count ? tl[i] : null;
                var at = m != null ? ToCanvas(m.L("at")) : null;
                Show(tags[i].box, at.HasValue);
                if (!at.HasValue) continue;
                var (box, title, text) = tags[i];
                float maxW = 13 * Sz(13);
                string ts = (m.S("title") ?? "").ToUpperInvariant(), xs = m.S("text") ?? "";
                var a = ts.Length > 0 ? Ui.Set(title, ts, maxW) : Vector2.zero;
                text.fontSize = Sz(11);
                var b = xs.Length > 0 ? Ui.Set(text, xs, maxW) : Vector2.zero;
                Show(title, ts.Length > 0); Show(text, xs.Length > 0);
                float iw = Mathf.Max(a.x, b.x), bw = iw + 24, bh = a.y + b.y + 13;
                float x = Mathf.Clamp(at.Value.x, bw / 2 + 8, W - bw / 2 - 8), y = Mathf.Max(bh + 8, at.Value.y);
                Ui.Place(box.rt, x - bw / 2, y - bh, bw, bh);
                Ui.Place(title.rectTransform, 12, 6, iw, a.y);
                Ui.Place(text.rectTransform, 12, 6 + a.y, iw, b.y);
            }
        }
        int popSeen;   // (the last pop's id drawn: one gone stays gone)

        // ---------------------------------------------------------------- a makers' box's card (issue #345; src/boxes/card.js)
        // as the web's #boxcard: a low cream strip along the foot of the screen, in the letterbox's bottom band, so the item
        // the scene holds up stays clear above it; the name first and largest, after the makers' star, one line under it
        // (what it does, or the found line), then the button to go on, gold, its key's badge before its word. While the
        // scene plays and before the card, the skip's tag under the top bar
        Ui.Box bCard, bGo, bSkip; Label bName, bName2, bText, bGoKey, bGoText, bSkipKey, bSkipText; Image bGoBadge, bSkipBadge; Sketch bStar;
        float bCardT;
        const int CardBody = 15, CardName = 26;
        const float CardStar = 0.7f * CardName, CardStarGap = 0.35f * CardName;   // (the page's h2 .star: 0.7em, 0.35em after it)

        // the father's charge lettered low in the lower third (src/story/charge.js showChargeCard, the page's #charge-card;
        // issue #394: Unity showed nothing as the dust cleared): a band of paper fading out at its ends, the gold mark and
        // the airy capitals closing up as it comes in, an ink line under them with a gold dot; in over 0.8 s, out over 1.1 s
        RectTransform charge; Image chargeBand, chargeEdgeL, chargeEdgeR, chargeLine, chargeDot; Label chargeText;
        int chargeId = -1; float chargeT;
        static readonly Color ChargePaper = Ui.Hex("#fff6dc", 0.95f);
        void BuildCharge()
        {
            charge = Ui.Node("charge card", root);
            chargeBand = Ui.Rect(charge, ChargePaper, 0, "band");
            chargeEdgeL = Ui.Rect(charge, ChargePaper, 0, "edge l"); chargeEdgeR = Ui.Rect(charge, ChargePaper, 0, "edge r");
            foreach (var e in new[] { chargeEdgeL, chargeEdgeR }) { e.sprite = Fade(); e.type = Image.Type.Simple; }
            chargeEdgeR.rectTransform.localScale = new Vector3(-1, 1, 1);
            chargeText = Ui.Label(charge, "text", Ui.Sans, 25, Ui.Ink, TextAnchor.MiddleCenter);
            chargeText.supportRichText = true;
            Ui.Space(chargeText, 0.42f);
            chargeLine = Ui.Rect(charge, Ui.Ink, 0, "line");
            chargeDot = Ui.Rect(charge, Ui.Hex("#f2c54b"), 5, "dot");
            charge.gameObject.SetActive(false);
        }
        static Sprite fade;
        /// <summary>A strip from clear to opaque, left to right (the band's soft ends, the page's linear-gradient).</summary>
        static Sprite Fade()
        {
            if (fade) return fade;
            var t = new Texture2D(32, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int x = 0; x < 32; x++) t.SetPixel(x, 0, new Color(1, 1, 1, x / 31f));
            t.Apply();
            return fade = Sprite.Create(t, new Rect(0, 0, 32, 1), new Vector2(0.5f, 0.5f));
        }
        void DrawCharge(Dictionary<string, object> c)
        {
            bool on = c != null;
            if (charge.gameObject.activeSelf != on) charge.gameObject.SetActive(on);
            if (!on) { chargeId = -1; return; }
            int id = c.I("id");
            if (id != chargeId) { chargeId = id; chargeT = 0; }
            chargeT += Time.unscaledDeltaTime;
            float ms = c.F("ms", 5000) / 1000f, t = chargeT;
            float a = t < 0.8f ? t / 0.8f : t > ms - 1.3f ? Mathf.Clamp01(1 - (t - (ms - 1.3f)) / 1.1f) : 1;
            float k = 1 - Mathf.Pow(1 - Mathf.Clamp01(t / 1.8f), 3);   // (the letters closing up, .42 em to .22)
            Ui.Space(chargeText, Mathf.Round(Mathf.Lerp(0.42f, 0.22f, k) * 100) / 100);
            chargeText.fontSize = Mathf.RoundToInt(Mathf.Clamp(H * 0.025f * 16 / 9, 16, 27) * ts);
            var text = $"<color=#f2c54b>{c.S("mark")}</color>  {c.S("text")}";
            var s = Ui.Set(chargeText, text, W);
            float bw = Mathf.Min(Mathf.Max(640, s.x + 120), W * 0.88f), bh = s.y + 40, y = H - H * 0.06f - bh - 8 * (1 - k);
            Ui.Place(charge, 0, 0, W, H);
            float ex = bw * 0.18f, x0 = W / 2 - bw / 2;
            Ui.Place(chargeEdgeL.rectTransform, x0, y, ex, bh); Ui.Place(chargeBand.rectTransform, x0 + ex, y, bw - 2 * ex, bh); Ui.Place(chargeEdgeR.rectTransform, x0 + bw - ex, y, ex, bh);
            Ui.Place(chargeText.rectTransform, W / 2 - s.x / 2, y + 8, s.x, s.y);
            float lw = Mathf.Min(300, W * 0.6f) * Mathf.Clamp01((t - 0.5f) / 1.2f);
            Ui.Place(chargeLine.rectTransform, W / 2 - lw / 2, y + 12 + s.y, lw, 2);
            float d = 10 * Mathf.Clamp01((t - 1.5f) / 0.5f);
            Ui.Place(chargeDot.rectTransform, W / 2 - d / 2, y + 13 + s.y - d / 2, d, d);
            foreach (var g in new Graphic[] { chargeBand, chargeEdgeL, chargeEdgeR, chargeText, chargeLine, chargeDot }) { var col = g.color; col.a = (g == chargeBand || g == chargeEdgeL || g == chargeEdgeR ? 0.95f : 1) * a; g.color = col; }
        }

        void BuildBoxCard(Font mono)
        {
            bCard = Ui.Panel(root, "box card", Ui.Cream, Ui.Ink, 2, 4, 4);
            // (the page's h2 .star: a four-pointed star in the makers' blue, clip-path polygon(50% 0, 61% 39%, 100% 50%, 61% 61%,
            // 50% 100%, 39% 61%, 0 50%, 39% 39%), inline before the name's first line; issue #569)
            bStar = Ui.Node("star", bCard.rt).gameObject.AddComponent<Sketch>(); bStar.raycastTarget = false;
            var sp = new[] { (0.5f, 0f), (0.61f, 0.39f), (1f, 0.5f), (0.61f, 0.61f), (0.5f, 1f), (0.39f, 0.61f), (0f, 0.5f), (0.39f, 0.39f) };
            var navy = Ui.Hex("#25386c"); var mid = new Vector2(CardStar / 2, -CardStar / 2);
            for (int i = 0; i < sp.Length; i++)
            {
                var (ax, ay) = sp[i]; var (bx, by) = sp[(i + 1) % sp.Length];
                bStar.Tri(mid, new Vector2(ax * CardStar, -ay * CardStar), new Vector2(bx * CardStar, -by * CardStar), navy);
            }
            bName = Ui.Label(bCard.rt, "name", Ui.Heavy, CardName, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(bName, 0.04f);
            bName2 = Ui.Label(bCard.rt, "name 2", Ui.Heavy, CardName, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold); Ui.Space(bName2, 0.04f);
            bText = Ui.Label(bCard.rt, "text", mono, CardBody, Ui.Ink, TextAnchor.UpperCenter, lineSpacing: 1.3f);
            bGo = Ui.Panel(bCard.rt, "go", Ui.Gold, Ui.Ink, 1.5f, 2, 2);
            bGoBadge = Ui.Rect(bGo.rt, Ui.Ink, 4, "badge");
            bGoKey = Ui.Label(bGoBadge.rectTransform, "key", mono, 12, Cream, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(bGoKey.rectTransform);
            bGoText = Ui.Label(bGo.rt, "label", mono, 14, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold); Ui.Space(bGoText, 0.08f);
            bSkip = Ui.Panel(root, "box skip", Ui.Hex("#fff6dc", 0.9f), Ui.Ink, 1.5f);
            bSkipBadge = Ui.Rect(bSkip.rt, Ui.Ink, 4, "badge");
            bSkipKey = Ui.Label(bSkipBadge.rectTransform, "key", mono, 11, Cream, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(bSkipKey.rectTransform);
            bSkipText = Ui.Label(bSkip.rt, "label", mono, 13, Ui.Ink, TextAnchor.MiddleLeft); Ui.Space(bSkipText, 0.08f);
            bCard.Show(false); bSkip.Show(false);
        }

        /// <summary>A key's badge and its word laid out in a button from x0: returns the button's width.</summary>
        static float LayButton(Image badge, Label key, Label word, string k, string w, float x0, float h)
        {
            key.text = k;
            float kw = Mathf.Max(h - 8, Ui.Measure(key, k).x + 10);
            Ui.Place(badge.rectTransform, x0, 4, kw, h - 8);
            var s = Ui.Set(word, w);
            Ui.Place(word.rectTransform, x0 + kw + 7, 0, s.x, h);
            return x0 + kw + 7 + s.x + x0;
        }

        void DrawBoxCard(Dictionary<string, object> b)
        {
            bool card = b != null && b.Get("card") is bool c && c, scene = b != null;
            // the skip's tag while it plays, until the card is up (the web's .skip: right 18, under the 11 % top bar)
            bSkip.Show(scene && !card);
            if (scene && !card)
            {
                float sw = LayButton(bSkipBadge, bSkipKey, bSkipText, b.S("back") ?? "", b.S("skipLabel") ?? "Skip", 9, 30);   // (as written, not in capitals: the page's .skip; issue #569)
                Ui.Place(bSkip.rt, W - 18 - sw, H * 0.11f + 14, sw, 30);
                Ui.Alpha(bSkip.rt, 0.85f);
            }
            bCardT = card ? bCardT + Time.unscaledDeltaTime : 0;
            bCard.Show(card);
            if (!card) return;
            // (no wider than 44 of its letters (the page's 44ch: 0.53 of the body's size in its face), centred; the name first and
            // largest, as written (the page's h2: no capitals; issue #569), the star before its first line, its lines centred;
            // then its line, then the button)
            float most = Mathf.Min(44 * CardBody * 0.53f, W - 24), padX = 1.2f * CardBody, padY = 0.6f * CardBody, nameMax = most - 2 * padX;
            var words = Text.Plain(b.S("name") ?? "").Split(' ');
            int nw = words.Length;
            while (nw > 1 && Ui.Measure(bName, string.Join(" ", words, 0, nw)).x + CardStar + CardStarGap > nameMax) nw--;
            string rest = string.Join(" ", words, nw, words.Length - nw);
            var ns = Ui.Set(bName, string.Join(" ", words, 0, nw));
            var rs = rest.Length > 0 ? Ui.Set(bName2, rest, nameMax) : Vector2.zero;
            Show(bName2, rest.Length > 0);
            var ts = Ui.Set(bText, Text.Plain(b.S("text") ?? ""), nameMax);
            float gh = 32, gw = LayButton(bGoBadge, bGoKey, bGoText, b.S("ok") ?? "", b.S("okLabel") ?? "Continue", 10, gh);
            float first = CardStar + CardStarGap + ns.x;
            float inner = Mathf.Max(Mathf.Max(first, rs.x), Mathf.Max(ts.x, gw)), w = inner + 2 * padX;
            float y = padY;
            float nameX = w / 2 - first / 2;
            Ui.Place(bStar.rectTransform, nameX, y + ns.y / 2 - CardStar / 2 + 1, CardStar, CardStar);
            Ui.Place(bName.rectTransform, nameX + CardStar + CardStarGap, y, ns.x, ns.y); y += ns.y;
            if (rest.Length > 0) { Ui.Place(bName2.rectTransform, w / 2 - rs.x / 2, y, rs.x, rs.y); y += rs.y; }
            y += 4;
            Ui.Place(bText.rectTransform, w / 2 - ts.x / 2, y, ts.x, ts.y); y += ts.y + 0.5f * CardBody;
            Ui.Place(bGo.rt, w / 2 - gw / 2, y, gw, gh); y += gh + padY + 2;
            // (it slides up a little and fades in, as the page's transition)
            float k = Mathf.Clamp01(bCardT / 0.4f), e = 1 - (1 - k) * (1 - k);
            float bottom = Mathf.Max(6, H * 0.055f - 34);
            Ui.Place(bCard.rt, W / 2 - w / 2, H - bottom - y + 16 * (1 - e), w, y);
            Ui.Alpha(bCard.rt, Mathf.Clamp01(bCardT / 0.35f));
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
            toast.SetFill(HintBg); toastText.color = HintInk; toastText.fontSize = Sz(13);
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
            if (DrawCueBadge(c)) return;   // (a prompt's button: the page's badge, alone or before its words; issue #422)
            bool place = c.S("kind") == "place";
            cueText.fontStyle = place ? FontStyle.Italic : FontStyle.Normal;
            // (a region's name: letters on the land, no strip, as the page's #cue.place)
            cue.SetFill(place ? (solid ? Color.white : Color.clear) : HintBg);
            cueText.color = place ? (solid ? Color.black : Ui.Ink) : HintInk;
            cueText.fontSize = Sz(13);
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
            if (trace) tracePrompt.at = null;
            if (!at.HasValue) return;
            var key = p.S("key", "E");
            // (the button alone unless hints are full, as the page's .glyph: src/hint-level.js; issue #394, Unity always wrote
            // "E voicemail" where the page shows the E; issue #422, the page's badge alone over the world, not on a strip)
            if (p.Get("words") is bool wd0 && !wd0) { DrawPromptGlyph(at.Value, key); return; }
            PromptOnStrip();
            prompt.SetFill(HintBg); promptKey.color = HintInk; promptText.color = HintInk;
            promptText.fontSize = Sz(12); promptKeyText.fontSize = Sz(11);
            promptKeyText.text = key;
            float kw = Mathf.Max(21, Ui.Measure(promptKeyText, key).x + 10);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, 21);
            // (the button alone unless hints are full, as the page's .glyph: src/hint-level.js; issue #394, Unity always wrote
            // "E voicemail" where the page shows the E)
            bool words = !(p.Get("words") is bool wd) || wd;
            var s = words ? Ui.Set(promptText, p.S("text"), 360) : Vector2.zero;
            Show(promptText, words);
            float lh = Mathf.Max(21, Sz(12) * 1.6f);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, lh);
            Ui.Place(promptText.rectTransform, 4 + kw + 6, 3, s.x, lh);
            float w = words ? 4 + kw + 6 + s.x + 10 : kw + 8, h = lh + 6;
            float px = Mathf.Clamp(at.Value.x - w / 2, 8, W - w - 8), py = Mathf.Clamp(at.Value.y - h, 8, H - h - 8);
            Ui.Place(prompt.rt, px, py, w, h);
            if (trace) tracePrompt.at = Mathf.Approximately(px, at.Value.x - w / 2) && Mathf.Approximately(py, at.Value.y - h) ? World(p.L("at")) : null;   // (not where it is held in at an edge)
        }

        // the hearts (src/hud.js healthHud / heartsSvg, the page's #health): a heart a container, filled by its quarters,
        // the last one warmer when low; then the potions' flask and count, the wallet's chimes; the magic bar under them
        // (its units, the reserve's level). Without hearts in the state, the old bar.
        // (the heart's layers as the page's heartsSvg: its shadow, the cream (he), the red (hf) whole or cut to its quarters,
        // the quarter lines (hq) on a part-filled one, the glint (hl), the ink outline (ho); issue #461)
        static Sprite heartFill, heartLine, heartSolid, heartTicks, heartGlint;
        static readonly Sprite[] heartQuarter = new Sprite[4];
        class HeartImg { public RectTransform rt, body; public Image back, fill, ticks, glint, line; }
        readonly List<HeartImg> hearts = new();
        RectTransform heartRow; RawImage potionIcon, potionInk; Image chimeIcon; Label potionN, chimeN;
        // (the page's #health .hq, .hl: the quarter lines' ink at 0.55, the glint #fff4dc at 0.85)
        static readonly Color HeartTick = Ui.Hex("#2b211f", 0.55f), HeartGlint = Ui.Hex("#fff4dc", 0.85f);
        Ui.Box magicBox; Image magicFill, magicEdge, magicHatch; readonly List<Image> magicTicks = new();
        // (the page's #health .magic i: #3fae9a, short of a unit #8fb9ad under its hatching, index.html)
        static readonly Color HeartRed = Ui.Hex("#d9503f"), HeartLow = Ui.Hex("#e8643c"), ChimeTeal = Ui.Hex("#63d3e4"), MagicTeal = Ui.Hex("#3fae9a"), MagicShort = Ui.Hex("#8fb9ad");
        static Sprite magicHatchSprite;
        /// <summary>The page's hatching of a short bar (repeating-linear-gradient(-45deg, transparent 0 4px, ink 0.35 4px 6px)):
        /// "/" strokes, a tile 8 px across, tiled (the page's period along the stripes' normal, 6 px, is 8.5 px across).</summary>
        static Sprite MagicHatch()
        {
            if (magicHatchSprite) return magicHatchSprite;
            const int n = 8;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Bilinear, name = "hatch" };
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    // (4 × 4 samples a texel: covered where (x - y) mod 8 falls in the stroke's third)
                    float cov = 0;
                    for (int sy = 0; sy < 4; sy++)
                        for (int sx = 0; sx < 4; sx++) { float u = x + (sx + 0.5f) / 4 - (y + (sy + 0.5f) / 4); u = ((u % n) + n) % n; cov += u < n / 3f ? 1 : 0; }
                    px[y * n + x] = new Color32(255, 255, 255, (byte)(cov / 16 * 255));
                }
            t.SetPixels32(px); t.Apply(false, true);
            return magicHatchSprite = Sprite.Create(t, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect);
        }

        /// <summary>A heart's layer from the page's own path (src/hud.js HEART, its 20 × 18.4 box, y down), its curves cut
        /// into a polygon: 40 × 37 px, a pixel's coverage by its distance to the outline. kind: "fill", "line" (the ink
        /// outline, 2.1 wide), "solid" (the fill and its outline: the drop shadow's shape), "q1".."q3" (the fill cut to its
        /// first quarters, as QUAD: bottom left, top left, top right), "ticks" (the quarter lines, hq: M10 3.6V17.2 M1.6 9H18.4,
        /// 0.9 wide), "glint" (hl: M5.2 4.4 C 4 4.9 3.4 6 3.5 7.2, 1.4 wide, round).</summary>
        static Sprite Heart(string kind)
        {
            const int w = 40, h = 37; const float s = 2, edge = 2.1f * s;
            List<Vector2> Bez(float[] c, int steps, List<Vector2> into)
            {
                for (int i = 0; i < steps; i++)
                {
                    float t = i / (float)steps, u = 1 - t;
                    float x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
                    float y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
                    into.Add(new Vector2(x * s, (18.4f - y) * s));   // (texture y up)
                }
                return into;
            }
            float[][] curves = {
                new[] { 10f, 17.2f, 6.2f, 14.1f, 1.4f, 10.6f, 1.4f, 6.1f }, new[] { 1.4f, 6.1f, 1.4f, 3.2f, 3.6f, 1.2f, 6.1f, 1.2f },
                new[] { 6.1f, 1.2f, 7.8f, 1.2f, 9.2f, 2.2f, 10f, 3.6f }, new[] { 10f, 3.6f, 10.8f, 2.2f, 12.2f, 1.2f, 13.9f, 1.2f },
                new[] { 13.9f, 1.2f, 16.4f, 1.2f, 18.6f, 3.2f, 18.6f, 6.1f }, new[] { 18.6f, 6.1f, 18.6f, 10.6f, 13.8f, 14.1f, 10f, 17.2f },
            };
            var poly = new List<Vector2>();
            foreach (var c in curves) Bez(c, 16, poly);
            // (the open strokes, in texture px: the quarter lines, the glint's curve)
            Vector2 P(float x, float y) => new Vector2(x * s, (18.4f - y) * s);
            var strokes = new List<List<Vector2>>();
            if (kind == "ticks") { strokes.Add(new List<Vector2> { P(10, 3.6f), P(10, 17.2f) }); strokes.Add(new List<Vector2> { P(1.6f, 9), P(18.4f, 9) }); }
            if (kind == "glint") { var g = Bez(new[] { 5.2f, 4.4f, 4f, 4.9f, 3.4f, 6f, 3.5f, 7.2f }, 12, new List<Vector2>()); g.Add(P(3.5f, 7.2f)); strokes.Add(g); }
            float half = (kind == "ticks" ? 0.9f : 1.4f) * s / 2;
            int quarters = kind.Length == 2 && kind[0] == 'q' ? kind[1] - '0' : 0;
            float Seg(Vector2 p, Vector2 a, Vector2 b) { var ab = b - a; float k = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-6f, ab.sqrMagnitude)); return (a + ab * k - p).magnitude; }
            var t2 = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "heart " + kind };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    float cov;
                    if (strokes.Count > 0)
                    {
                        float best = float.MaxValue;
                        foreach (var st in strokes) for (int i = 1; i < st.Count; i++) best = Mathf.Min(best, Seg(p, st[i - 1], st[i]));
                        cov = Mathf.Clamp01(0.5f - (best - half));
                    }
                    else
                    {
                        bool inside = false; float best = float.MaxValue;
                        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
                        {
                            Vector2 a = poly[i], b = poly[j];
                            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                            best = Mathf.Min(best, Seg(p, a, b));
                        }
                        float d = inside ? -best : best;
                        cov = kind == "line" ? Mathf.Clamp01(0.5f - (Mathf.Abs(d) - edge * 0.5f)) : kind == "solid" ? Mathf.Clamp01(0.5f - (d - edge * 0.5f)) : Mathf.Clamp01(0.5f - d);
                        if (quarters > 0)
                        {
                            // (QUAD's halves at x 10 and y 9, in px: left of the middle, under it, over it)
                            float left = Mathf.Clamp01(0.5f + (10 * s - p.x)), low = Mathf.Clamp01(0.5f + ((18.4f - 9) * s - p.y)), high = 1 - low;
                            cov *= quarters == 1 ? Mathf.Min(left, low) : quarters == 2 ? left : Mathf.Max(left, high);
                        }
                    }
                    px[y * w + x] = new Color32(255, 255, 255, (byte)(cov * 255));
                }
            t2.SetPixels32(px); t2.Apply(false, true);
            return Sprite.Create(t2, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100);
        }

        void DrawHealth(Dictionary<string, object> h)
        {
            bool hasHearts = h != null && h.Get("hearts") is double;
            Show(health, h != null && !hasHearts);
            if (heartRow == null && hasHearts) BuildHearts();
            if (heartRow != null && heartRow.gameObject.activeSelf != hasHearts) heartRow.gameObject.SetActive(hasHearts);
            if (h == null) return;
            if (!hasHearts)
            {
                Ui.Place(health.rt, 16, 14, 150, 11);
                float hp = Mathf.Clamp01(h.F("value", 1)), w = 146 * hp;
                Ui.Place(healthFill.rectTransform, 0, 0, w, 7);
                Ui.Place(healthEdge.rectTransform, w, 0, 2, 7);
                healthFill.color = h.Get("low") is bool low && low ? Color.Lerp(Ui.Hp, Ui.Gold, 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * Mathf.PI * 2.5f)) : Ui.Hp;
                return;
            }
            // (the page's #health .row: the hearts' svg hh tall, a heart a 22-unit pitch of its 20 (u = hh / 20), the flask
            // 1.15 hh tall beside them, the row as tall as the flask and each centred in it)
            float hh = 21.6f * ts, hw = hh * 1.1f, u = hh / 20, rowH = hh * 1.15f, q = Mathf.Max(0, Mathf.Round(h.F("hearts") * 4));
            int max = Mathf.Max(0, h.I("max", 3));
            bool lowNow = h.Get("low") is bool lw && lw;
            while (hearts.Count < max)
            {
                var rt = Ui.Node("heart " + hearts.Count, heartRow);
                // (the body scales about the page's transform-origin 50% 60% when low: hpulse)
                var body = Ui.Stretch(Ui.Node("body", rt)); body.pivot = new Vector2(0.5f, 0.42f);
                Image L(string name, Color c, Sprite sp) { var im = Ui.Rect(body, c, 0, name); im.sprite = sp; im.type = Image.Type.Simple; Ui.Stretch(im.rectTransform); return im; }
                var shadow = L("shadow", new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.9f), heartSolid); shadow.rectTransform.offsetMin = new Vector2(1.5f, -1.5f); shadow.rectTransform.offsetMax = new Vector2(1.5f, -1.5f);
                hearts.Add(new HeartImg { rt = rt, body = body, back = L("empty", Cream, heartFill), fill = L("fill", HeartRed, heartFill), ticks = L("quarters", HeartTick, heartTicks), glint = L("glint", HeartGlint, heartGlint), line = L("ink", Ui.Ink, heartLine) });
            }
            // (hpulse: 1 → 1.14 → 1 over 0.8 s, each half eased in and out)
            float ph = Time.unscaledTime / 0.8f % 1, pk = ph < 0.5f ? ph * 2 : 2 - ph * 2, pulse = 1 + 0.14f * pk * pk * (3 - 2 * pk);
            float x = 0;
            for (int i = 0; i < hearts.Count; i++)
            {
                var H_ = hearts[i]; bool on = i < max;
                if (H_.rt.gameObject.activeSelf != on) H_.rt.gameObject.SetActive(on);
                if (!on) continue;
                int n = (int)Mathf.Clamp(q - i * 4, 0, 4);
                // (the heart's 20 × 18.5 units at its place in the svg's viewBox, which starts a unit up and left)
                Ui.Place(H_.rt, x + u, (rowH - hh) / 2 + u, 20 * u, 18.5f * u);
                Show(H_.fill, n > 0);
                if (n > 0) H_.fill.sprite = n >= 4 ? heartFill : heartQuarter[n];
                Show(H_.ticks, n > 0 && n < 4);
                Show(H_.glint, n > 0);
                bool last = lowNow && n > 0 && (i == max - 1 || q - (i + 1) * 4 <= 0);
                H_.fill.color = last ? HeartLow : HeartRed;
                H_.body.localScale = Vector3.one * (last ? pulse : 1);
                x += hw;
            }
            // the potions (∞ while the shop's are endless) and the chimes (none: hidden), beside the hearts: the page's flask
            // (src/hud.js POTION_SVG as a PNG on a viewBox a unit wider all round: scripts/engine-bundle.mjs hud-potion), its
            // drop shadow, the count in the page's heavy face (0.9 hh) with its cream glow; none left, faded to 0.4
            bool infinite = h.Get("infinite") is bool inf && inf;
            int pots = h.I("potions", -1);
            bool showPot = pots >= 0;
            if (showPot && potionIcon.texture == null) { potionIcon.texture = BridgeMenu.Picture("hud-potion"); potionInk.texture = BridgeMenu.Picture("hud-potion-ink"); }
            Show(potionIcon, showPot && potionIcon.texture != null); Show(potionInk, showPot && potionInk.texture != null); Show(potionN, showPot);
            x += hh * 0.35f;
            if (showPot)
            {
                float pu = rowH / 18, a = infinite || pots > 0 ? 1 : 0.4f;
                Ui.Place(potionInk.rectTransform, x - pu + 1.5f, -pu + 1.5f, 16 * pu, 20 * pu);
                Ui.Place(potionIcon.rectTransform, x - pu, -pu, 16 * pu, 20 * pu);
                potionInk.color = new Color(1, 1, 1, 0.9f * a); potionIcon.color = new Color(1, 1, 1, a);
                potionN.fontSize = Mathf.RoundToInt(hh * 0.8f);   // (the page's 0.9 hh in Avenir Next Heavy: Unity's bold Avenir draws its figures taller)
                potionN.color = new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, a);
                var s = Ui.Set(potionN, infinite ? "∞" : pots.ToString(), 80);
                float px0 = x + 14 * pu + 2;
                Ui.Place(potionN.rectTransform, px0, (rowH - s.y) / 2 - hh * 0.12f, s.x + 4, s.y);   // (Unity's line box sits its figures lower than the page's line-height 1)
                x = px0 + s.x + hh * 0.35f;
            }
            int chimes = h.I("chimes", -1);
            Show(chimeIcon, chimes > 0); Show(chimeN, chimes > 0);
            if (chimes > 0)
            {
                Ui.Place(chimeIcon.rectTransform, x + hh * 0.2f, hh * 0.15f, hh * 0.65f, hh * 0.65f);
                var s = Ui.Set(chimeN, chimes.ToString(), 120);
                chimeN.fontSize = Mathf.RoundToInt(hh * 0.8f);
                Ui.Place(chimeN.rectTransform, x + hh * 1.05f, 0, s.x + 4, hh);
            }
            // the magic bar (the page's #health .magic): as long as its units, a tick between each, filled to the reserve's level
            // with its ink edge; short of a unit (a shot's cost), paler and hatched (src/hud.js healthHud magicFill, magicShort)
            bool magic = h.Get("magic") is double;
            magicBox.Show(magic);
            if (magic)
            {
                int units = Mathf.Max(1, Mathf.RoundToInt(h.F("magicMax", 3)));
                float bw = hh * 2.35f * units, bh = hh * 0.5f, iw = bw - 4, ih = bh - 4;
                float fill = h.Get("magicFill") is double mf ? Mathf.Clamp01((float)mf) : Mathf.Clamp01(h.F("magic") / units), fw = iw * fill;
                bool shortOf = h.Get("magicShort") is bool sh ? sh : h.F("magic") < 1 - 1e-6f;
                Ui.Place(magicBox.rt, 0, rowH + hh * 0.22f, bw, bh);   // (under the row, as tall as the flask: the page's gap 0.22 hh)
                Ui.Place(magicFill.rectTransform, 0, 0, fw, ih);
                magicFill.color = shortOf ? MagicShort : MagicTeal;
                Show(magicHatch, shortOf && fw > 0);
                Show(magicEdge, fw > 0 && fw < iw);
                Ui.Place(magicEdge.rectTransform, fw, 0, Mathf.Min(2, iw - fw), ih);
                while (magicTicks.Count < units - 1) magicTicks.Add(Ui.Rect(magicBox.fill.rectTransform, new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.75f), 0, "tick"));
                for (int i = 0; i < magicTicks.Count; i++)
                {
                    bool on = i < units - 1;
                    Show(magicTicks[i], on);
                    if (on) Ui.Place(magicTicks[i].rectTransform, iw * (i + 1) / units - 1.5f, 0, 1.5f, ih);
                }
            }
            Ui.Place(heartRow, 16, 12, 400, hh * 2);
        }

        void BuildHearts()
        {
            if (!heartFill) heartFill = Heart("fill");
            if (!heartLine) heartLine = Heart("line");
            heartRow = Ui.Node("hearts", root);
            heartRow.SetSiblingIndex(health.rt.GetSiblingIndex());
            if (!heartSolid) heartSolid = Heart("solid");
            if (!heartTicks) heartTicks = Heart("ticks");
            if (!heartGlint) heartGlint = Heart("glint");
            for (int n = 1; n < 4; n++) if (!heartQuarter[n]) heartQuarter[n] = Heart("q" + n);
            RawImage Pic(string name) { var r = Ui.Node(name, heartRow).gameObject.AddComponent<RawImage>(); r.raycastTarget = false; return r; }
            potionInk = Pic("potion shadow"); potionIcon = Pic("potion");
            potionN = Ui.Label(heartRow, "potions", Ui.Sans, 17, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            { var o = potionN.gameObject.AddComponent<Outline>(); o.effectColor = Ui.Hex("#fffaf0", 0.8f); o.effectDistance = new Vector2(1, -1); }   // (the page's soft cream glow round the count)
            chimeIcon = Ui.Rect(heartRow, ChimeTeal, 0, "chime"); chimeIcon.rectTransform.localRotation = Quaternion.Euler(0, 0, 45);
            chimeN = Ui.Label(heartRow, "chimes", Ui.SansHeavy, 17, Ui.Ink, TextAnchor.MiddleLeft, Ui.SansHeavyStyle);   // (#health .chimes: the page's face at 800)
            magicBox = Ui.Panel(heartRow, "magic", Cream, Ui.Ink, 2, 1.5f, 1.5f, 6);
            magicFill = Ui.Rect(magicBox.fill.rectTransform, MagicTeal, 0, "level");
            magicHatch = Ui.Fill(magicFill.rectTransform, new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.35f), 0, "hatch");
            magicHatch.sprite = MagicHatch(); magicHatch.type = Image.Type.Tiled;
            magicEdge = Ui.Rect(magicBox.fill.rectTransform, Ui.Ink, 0, "edge");
            magicBox.Show(false);
        }

        /// <summary>The key counter while in a temple (issue #274; src/hud.js keysHud: { small, big }): "KEY ×N", and
        /// "+ GREAT KEY" once it is in hand; under the health bar.</summary>
        Ui.Box foeTab, foeTabKey; Label foeTabText, foeTabKeyText;
        /// <summary>The Arena's FOES tab, at the left edge 14 % down as the page's #foe-tab, the key that opens its list under it.</summary>
        void DrawFoeTab(Dictionary<string, object> t, bool on)
        {
            on &= t != null;
            foeTab.Show(on); foeTabKey.Show(on);
            if (!on) return;
            var s = Ui.Set(foeTabText, t.S("text") ?? "FOES", 200);
            float y = H * 0.14f;
            Ui.Place(foeTab.rt, 12, y, s.x + 18, 30);
            Ui.Place(foeTabText.rectTransform, 0, 0, s.x + 18, 30);
            var k = Ui.Set(foeTabKeyText, t.S("key") ?? "", 200);
            Ui.Place(foeTabKey.rt, 12, y + 36, k.x + 12, 18);
            Ui.Place(foeTabKeyText.rectTransform, 0, 0, k.x + 12, 18);
        }

        // the page's KEY_SVG and GREAT_KEY_SVG (src/hud.js): brass, an ink outline, a cream glint, in their viewBox units
        static readonly Color KeyBrass = Ui.Hex("#d6a94a"), GreatBrass = Ui.Hex("#c9903a"), GreatGem = Ui.Hex("#3fae9a"), KeyGlint = Ui.Hex("#fff4dc");
        Sketch keysGlyph;
        /// <summary>One key at x (px), its viewBox scaled by u px a unit: the bit's boxes, the bow's ring and hole, the glint.</summary>
        void KeyGlyph(Sketch sk, float x, float u, bool great)
        {
            Vector2 P(float vx, float vy) => new Vector2(x + vx * u, -vy * u);
            void Bar(float x0, float y0, float x1, float y1, Color c, float grow) => sk.Box(new Rect(x + (x0 - grow) * u, -(y1 + grow) * u, (x1 - x0 + 2 * grow) * u, (y1 - y0 + 2 * grow) * u), c);
            var brass = great ? GreatBrass : KeyBrass;
            float bx = great ? 8 : 7, by = great ? 6.6f : 5.6f, br = great ? 5.4f : 4.3f, hole = great ? 2.6f : 1.55f;
            // the shaft and its teeth, inked (the outline one ink width wider all round), the bow over them
            var bars = great
                ? new[] { (6.6f, 11.4f, 9.4f, 24.6f), (9.4f, 21.4f, 12.6f, 23.6f), (9.4f, 17.6f, 13.4f, 19.9f), (9.4f, 14f, 11.8f, 15.9f) }
                : new[] { (5.8f, 9.2f, 8.2f, 20.6f), (8.2f, 18.2f, 10.4f, 19.9f), (8.2f, 15f, 11.2f, 16.9f) };
            foreach (var b in bars) Bar(b.Item1, b.Item2, b.Item3, b.Item4, Ui.Ink, 0.7f);
            foreach (var b in bars) Bar(b.Item1, b.Item2, b.Item3, b.Item4, brass, 0);
            sk.Disc(P(bx, by), (br + 0.75f) * u, Ui.Ink);
            sk.Disc(P(bx, by), (br - 0.75f) * u, brass);
            if (great) { sk.Disc(P(bx, by), (hole + 0.6f) * u, Ui.Ink); sk.Disc(P(bx, by), (hole - 0.6f) * u, GreatGem); }
            else sk.Disc(P(bx, by), hole * u, Ui.Ink);
            sk.Line(P(bx - 2.7f, by - 1.2f), P(bx - 0.9f, by - 3.1f), Mathf.Max(1, u), KeyGlint);
        }

        void DrawKeys(Dictionary<string, object> k, bool on)
        {
            on &= k != null;
            Show(keys, on);
            if (!on) return;
            // (as the page: the small key and ×N, the great key beside them once it is in hand; --hh, the hearts' height)
            float hh = 21.6f * ts, u = hh * 1.3f / 22f, ug = hh * 1.45f / 26f;
            bool big = k.Get("big") is bool b && b;
            int n = k.I("small");
            keysGlyph.Clear();
            Ui.Place(keysGlyph.rectTransform, 0, 0, 1, 1);
            KeyGlyph(keysGlyph, 0, u, false);
            keysText.fontSize = Mathf.RoundToInt(hh * 0.95f);
            keysText.color = n > 0 ? Ui.Ink : new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.55f);
            var s = Ui.Set(keysText, "×" + n, 260);
            float tx = 14 * u + 2;
            Ui.Place(keysText.rectTransform, tx, (hh * 1.3f - s.y) / 2, s.x, s.y);
            if (big) KeyGlyph(keysGlyph, tx + s.x + hh * 0.4f, ug, true);
            s = new Vector2(tx + s.x + (big ? hh * 0.4f + 16 * ug : 0) - 8, hh * 1.3f);
            // (under the hearts and the magic bar when they show, as the page's #keys is under #health)
            float ky = heartRow != null && heartRow.gameObject.activeSelf ? 12 + 21.6f * ts * (magicBox.rt.gameObject.activeSelf ? 1.72f : 1) + 8 : 12;   // (the page's 12 px with no hearts up)
            Ui.Place(keys.rt, 16, ky, s.x + 16, 24);
        }

        // the guardian's bar (src/temples/runtime.js meterHud, the page's .temple-meter; boss.js guardianBar): a printed bar at
        // the bottom, its name and what it is (a machine's health, a living guardian's unrest) over it, full at the start
        Ui.Box guardian; Image guardianFill, guardianEdge; Label guardianText;
        void DrawGuardian(Dictionary<string, object> g)
        {
            Show(guardian, g != null);
            if (guardianText.gameObject.activeSelf != (g != null)) guardianText.gameObject.SetActive(g != null);
            if (g == null) return;
            const float bw = 260, bh = 15;
            float x = (W - bw) / 2, y = H - 62 - bh, w = (bw - 4) * Mathf.Clamp01(g.F("fill", 1));
            Ui.Place(guardian.rt, x, y, bw, bh);
            Ui.Place(guardianFill.rectTransform, 0, 0, w, bh - 4);
            Ui.Place(guardianEdge.rectTransform, w, 0, w > 0 ? 2 : 0, bh - 4);
            guardianFill.color = Ui.Hex(g.S("color") ?? "#d9503f", 1);
            Ui.Set(guardianText, (g.S("label") ?? "").ToUpperInvariant(), 600);
            Ui.Place(guardianText.rectTransform, x - 170, y - 20, bw + 340, 16);
        }

        void DrawWheel(Dictionary<string, object> s, bool on)
        {
            var at = on && s != null ? ToCanvas(s.L("at")) : null;
            Show(wheel, at.HasValue);
            if (trace) traceWheel.at = null;
            if (!at.HasValue) return;
            Ui.Place(wheel, at.Value.x - 17, at.Value.y - 17, 34, 34);
            if (trace) traceWheel.at = World(s.L("at"));
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
            // (the words at the Text size setting's size, the panel in em with them; the plain background: white, black words, no ruled lines)
            dlgText.fontSize = Body; dlgName.fontSize = NameSize;
            dlgPanel.SetFill(solid ? Color.white : Ui.Paper);
            dlgText.color = solid ? Color.black : Ui.Ink;
            Show(dlgLines, !solid);
            // (the page whole at once, issue #147: the bundle sends it all, shown = its length; the panel 46 em wide)
            float pw = Mathf.Min(46 * Em, W - 32);
            float padL = 6.3f * Em, padR = 1.3f * Em, padT = 1.95f * Em, padB = 0.85f * Em, cw = pw - padL - padR;
            // (a {glyph}: a gap in the words, the shared makers' mark in it: BridgeHud.Mark.cs, issue #513)
            var body = RichMarked(shown) + (done ? "" : "<color=#2b211f99>▍</color>");
            Ui.Set(dlgText, body, cw);
            // (as tall as the node's longest page, the page's .dlg-ghost: the panel keeps its size as the pages turn)
            var ghost = d.S("ghost") ?? "";
            float textH = Mathf.Max(Body * 2.9f, Ui.Measure(dlgText, RichMarked(text), cw).y, ghost.Length > text.Length ? Ui.Measure(dlgText, RichMarked(ghost), cw).y : 0);
            Ui.Place(dlgText.rectTransform, padL, padT + 4, cw, textH);
            var markPic = MarkPicture(d.L("mark"));
            dlgMarks.Lay(dlgText, body, new Vector2(cw, textH), markPic);
            float y = padT + 4 + textH + 0.45f * Em;
            float keyW = 1.1f * Em + 0.55f * Em;
            // (the answers' mark, the page's choiceHtml: the keyboard's number, › on a touch screen, with a pad the confirm
            // button's badge on the answer it would pick and › on the others; issue #526: Unity drew the number always)
            var ak = d.O("answerKey");
            string kind = ak?.S("kind") ?? "keys", okKey = ak?.S("key") ?? "";
            for (int i = 0; i < dlgChoices.Count; i++)
            {
                var (box, num, tx, line) = dlgChoices[i];
                bool has = i < choices.Count;
                Show(box, has);
                while (dlgKeys.Count <= i) dlgKeys.Add(null);
                bool badge = has && kind == "pad" && i == sel && okKey.Length > 0;
                if (!badge && dlgKeys[i] != null) dlgKeys[i].rt.gameObject.SetActive(false);
                if (!has) continue;
                bool hi = i == sel;
                num.text = badge ? "" : kind == "pad" || kind == "touch" ? "›" : (i + 1).ToString();
                num.alignment = kind == "keys" ? TextAnchor.UpperLeft : TextAnchor.UpperCenter;
                num.fontSize = AnswerSize; tx.fontSize = AnswerSize;
                Ui.Place(num.rectTransform, 0, 2, kind == "keys" ? keyW : 1.1f * Em, AnswerSize * 1.4f);   // (the › centred in the page's 1.1 em column)
                if (badge)
                {
                    // (#dialogue .dlg-key .key: .82 of the answer's size, 1.8 of it across, centred on the mark's column at the first line)
                    var bg = dlgKeys[i] ??= MakeBadge(box.rt, "key");
                    bg.rt.gameObject.SetActive(true);
                    float px = 0.82f * AnswerSize;
                    var ks = PlaceBadge(bg, 0, 0, okKey, px, true);
                    float kh = Mathf.Round(1.8f * px), kw = Mathf.Max(kh, ks.x);
                    bg.ring.enabled = bg.shadow.enabled = false;   // (in the panel: the plain ink circle, no ring)
                    Ui.Place(bg.rt, 0.55f * Em - kw / 2, 2 + AnswerSize * 0.7f - kh / 2, kw, kh);
                    Ui.Place(bg.pill.rectTransform, 0, 0, kw, kh);
                }
                var said = RichMarked(PlainKeepingMark((choices[i] as Dictionary<string, object>).S("text")));
                var s = Ui.Set(tx, said, cw - keyW);
                Ui.Place(tx.rectTransform, keyW, 2, s.x, s.y);
                while (choiceMarks.Count <= i) choiceMarks.Add(new InlineMarks());
                choiceMarks[i].Lay(tx, said, s, markPic);
                tx.color = hi ? (solid ? Color.black : Ui.Ink) : (solid ? Ui.Hex("#333333") : Muted);
                Show(line, hi);
                Ui.Place(line.rectTransform, keyW, 2 + s.y + 1, s.x, 2.2f);
                float bh = Mathf.Max(AnswerSize * 1.4f, s.y) + 6;
                Ui.Place(box.rt, padL, y, cw, bh);
                y += bh + 3;
            }
            // (the answers still to come: their room kept on the pages before them, the page's .dlg-choices.waiting, so the
            // panel stands as tall from the first page and the answers come up in place; issue #264)
            var ahead = choices.Count == 0 ? d.L("ahead") : null;
            if (ahead != null && ahead.Count > 0 && dlgChoices.Count > 0)
            {
                var tx0 = dlgChoices[0].text; tx0.fontSize = AnswerSize;
                foreach (var a in ahead) { var s0 = Ui.Measure(tx0, RichMarked(PlainKeepingMark(a as string ?? "")), cw - keyW); y += Mathf.Max(AnswerSize * 1.4f, s0.y) + 6 + 3; }
            }
            if (choices.Count > 0 || (ahead?.Count ?? 0) > 0) y -= 3;
            float ph = Mathf.Max(5.2f * Em, y + padB);
            Ui.Place(dlg, W / 2 - pw / 2, H - 26 - ph, pw, ph);
            Ui.Place(dlgPanel.rt, 0, 0, pw, ph);
            dlgLines.Clear();
            if (!solid) for (float ly = 1.7f * Em; ly < ph; ly += 1.7f * Em + 1) dlgLines.Box(new Rect(-pw / 2, ph / 2 - ly - 1, pw, 1), Ui.Hex("#2b211f", 0.05f));
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
