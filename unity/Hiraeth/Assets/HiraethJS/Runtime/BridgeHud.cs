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
            Warm(Ui.Mono);
            root = Hud.MakeCanvas(cam, "HUD (JS bridge)", 100);
            root.SetParent(transform, false);
            var mono = Ui.Mono;
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
            keys = Ui.Panel(root, "keys", Ui.Page, Ui.Ink, 1.5f, 2, 2, 6);
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
            keysText = Ui.Label(keys.rt, "text", mono, 13, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            wheel = Ui.Node("stamina", root);
            wheelRing = Ui.Fill(wheel, Ui.Hex("#2b211f", 0.25f), 0, "ring"); wheelRing.sprite = Ui.Round(32);
            wheelFill = Ui.Fill(wheel, Ui.Gold, 0, "fill"); wheelFill.sprite = Ui.Round(32);
            wheelFill.type = Image.Type.Filled; wheelFill.fillMethod = Image.FillMethod.Radial360; wheelFill.fillOrigin = (int)Image.Origin360.Top; wheelFill.fillClockwise = false;
            Ui.Stretch(wheelFill.rectTransform, 3, 3, 3, 3);
            BuildDialogue(mono);
            BuildGadgets(mono);
            BuildCine(mono);
            BuildBoxCard(mono);   // (over the letterbox: the card stands in its bottom band)
            BuildFight(mono);
            BuildMinigame(mono);
            BuildWarp();          // (over everything but the frame readout, as the page's #warp)
            BuildPassage();   // (over everything: the paper covers the screen as it carries you through)
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
            // the accessibility settings sent with the screen's state (engine/unity/game.js access)
            var acc = state.O("access");
            ts = Mathf.Clamp(acc?.F("ts", 1) ?? 1, 0.6f, 2f);
            solid = acc != null && acc.Get("solid") is bool so && so;
            showFps = acc != null && acc.Get("fps") is bool fp && fp;
            DrawFps();
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
            // (a trial or a game under way: its own HUD, the cue and the floating prompt gone, as the page's body.minigame)
            var mg = state.O("minigame");
            DrawCue(cueState, d == null && (hud || walk) && (mg == null || state.O("photo") != null));
            DrawMinigame(hud && d == null ? mg : null);   // (before the toast: it stacks under the run's clock)
            DrawToast(state.O("toast"), free);
            DrawPrompt(state.O("prompt"), free && mg == null);
            DrawHealth(hud ? state.O("health") : null);
            DrawKeys(state.O("keys"), free);
            DrawGuardian(free ? state.O("guardian") : null);
            DrawFoeTab(state.O("foeTab"), free);
            DrawWheel(state.O("stamina"), free);
            DrawTalk(d, state.Get("choice") is double c ? (int)c : 0);
            // (the gadget's chip, wheel and reticle gone while a run is on, as the page's body.minigame #gadget-chip: src/gadgets/hud.js)
            DrawGadget(free && mg == null ? state.O("gadget") : null);
            DrawGadgetWheel(free && mg == null ? state.O("gadgetWheel") : null);
            DrawReticle(free && mg == null ? state.O("reticle") : null);
            DrawMarks(free ? state.L("gadgetMarks") : null);
            DrawCine(cine, state.O("sub"));
            DrawBoxCard(state.O("boxCard"));
            DrawEdges(state.O("edges"));
            DrawLock(free ? state.O("lock") : null);
            DrawWarn(free ? state.L("warn") : null);
            DrawRestart(state.O("restart"));
            DrawWarp(state.O("warp"));
            DrawPassage(state.O("passage"));
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
        Ui.Box restartBox; Label restartText, restartKey;
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
            restartBox = Ui.Panel(root, "restart", Ui.Page, Ui.Ink, 2.5f, 4, 4, 6);
            restartText = Ui.Label(restartBox.rt, "text", mono, 20, Ui.Ink, TextAnchor.UpperCenter);
            restartKey = Ui.Label(restartBox.rt, "key", mono, 16, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold);
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
            if (r == null) return;
            var s = Ui.Set(restartText, r.S("text") ?? "", 520);
            var ks = Ui.Set(restartKey, $"{r.S("key") ?? ""}  {r.S("label") ?? ""}".Trim(), 520);
            float w = Mathf.Max(s.x, ks.x) + 64, h = s.y + ks.y + 54;
            Ui.Place(restartText.rectTransform, (w - s.x) / 2, 20, s.x, s.y);
            Ui.Place(restartKey.rectTransform, (w - ks.x) / 2, 20 + s.y + 14, ks.x, ks.y);
            Ui.Place(restartBox.rt, (W - w) / 2, (H - h) / 2, w, h);
        }

        // ---------------------------------------------------------------- a trial's or a game's HUD (screen 'minigame')
        // src/minigames/kit/runner.js publish (the web's #minigame, src/minigames/kit/minigames.css): the lives at the left,
        // the clock in the middle (sent once a second while it runs: counted on here between), the score's box at the right,
        // the 3-2-1 in big inked numerals popping in, the flashes stacked under the clock, the hint row at the bottom right
        Ui.Box mgTimer, mgScore; Label mgTimerText, mgPenalty, mgScoreText, mgCount; RectTransform mgLives;
        readonly List<Image> mgLife = new();
        readonly List<(Ui.Box box, Label text, int id, float t, float secs)> mgFlash = new();
        Ui.Box mgHints; Label mgHintsText;
        int mgCountId = -1; float mgCountT; double mgSecs = -1; bool mgRun; float mgLocal; int mgBump = -1; float mgBumpT = 1;
        static readonly Color MgGold = Ui.Hex("#f2c54b"), MgTeal = Ui.Hex("#71d7cf"), MgBad = Ui.Hex("#d9643a"), MgCard = Ui.Hex("#fbf4e2");

        void BuildMinigame(Font mono)
        {
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
            foreach (var b in new[] { mgTimer, mgScore, mgHints }) b.Show(false);
            Show(mgCount, false); mgLives.gameObject.SetActive(false);
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
                mgCount.fontSize = go ? 122 : 140;
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
                var text = Ui.Label(box.rt, "text", Ui.Mono, kind.Contains("big") ? 27 : 16, kind.Contains("bad") ? MgCard : Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold, 1.2f);
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
            // the controls' hint row (def.hints: the pirates between worlds), each word gone once used, the game's line beside it
            var hi = g?.O("hints");
            bool hon = hi != null && !(hi.Get("off") is bool ho && ho);
            mgHints.Show(hon);
            if (hon)
            {
                var parts = (hi.L("items") ?? new List<object>()).OfType<Dictionary<string, object>>().Where(x => !(x.Get("gone") is bool gn && gn)).Select(x => $"<color=#f2c54b>{x.S("k")}</color> {x.S("w")}").ToList();
                var note = hi.S("note") ?? "";
                if (note.Length > 0) parts.Add(note);
                mgHints.SetFill(HintBg); mgHintsText.color = HintInk;
                var s = Ui.Set(mgHintsText, string.Join("   ", parts), W - 60);
                Ui.Place(mgHintsText.rectTransform, 9, 4, s.x, s.y);
                Ui.Place(mgHints.rt, W - 14 - (s.x + 18), H - 12 - (s.y + 8), s.x + 18, s.y + 8);
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
            // (more than eight: a wider ring of smaller slots, as the web's .many)
            int n = slots.Count, hi = w.I("hi", -1);
            bool many = n > 8;
            float size = many ? 344 : 300, R = many ? 136 : 112, C = size / 2, sd = many ? 50 : 56;
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
                LayDisc(gSlots[i], x - z / 2, y - z / 2, z, 2, 3, i == hi ? Ui.Gold : Cream, BridgeMenu.Picture(sl.S("id")), sl.S("glyph"));
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
            float sc = kind == "far" ? 0.7f : 1, sz = 34 * sc;
            Ui.Place(ret.rt, at.Value.x - sz / 2, at.Value.y - sz / 2, sz, sz);
            ret.border.color = kind == "anchor" ? Ui.Red : kind == "target" ? Teal : Ui.Ink;
            ret.rt.localRotation = Quaternion.Euler(0, 0, kind == "anchor" ? 45 : 0);
            Ui.Alpha(ret.rt, kind == "far" ? 0.55f : 1);
            Ui.Place(retH.rectTransform, sz / 2 - 6, sz / 2 - 1, 12, 2);
            Ui.Place(retV.rectTransform, sz / 2 - 1, sz / 2 - 6, 2, 12);
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
                var num = Ui.Label(rt, "n", Ui.Mono, 11, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
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

        // ---------------------------------------------------------------- a makers' box's card (issue #345; src/boxes/card.js)
        // as the web's #boxcard: a low cream strip along the foot of the screen, in the letterbox's bottom band, so the item
        // the scene holds up stays clear above it; the name first and largest, after the makers' star, one line under it
        // (what it does, or the found line), then the button to go on, gold, its key's badge before its word. While the
        // scene plays and before the card, the skip's tag under the top bar
        Ui.Box bCard, bGo, bSkip; Label bName, bText, bGoKey, bGoText, bSkipKey, bSkipText; Image bStar, bGoBadge, bSkipBadge;
        float bCardT;
        const int CardBody = 15, CardName = 26;

        void BuildBoxCard(Font mono)
        {
            bCard = Ui.Panel(root, "box card", Ui.Cream, Ui.Ink, 2, 4, 4);
            bStar = Ui.Rect(bCard.rt, Ui.Hex("#25386c"), 0, "star"); bStar.rectTransform.localRotation = Quaternion.Euler(0, 0, 45);
            bName = Ui.Label(bCard.rt, "name", Ui.Heavy, CardName, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold); Ui.Space(bName, 0.04f);
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
                float sw = LayButton(bSkipBadge, bSkipKey, bSkipText, b.S("back") ?? "", Ui.Upper(b.S("skipLabel") ?? "Skip"), 9, 30);
                Ui.Place(bSkip.rt, W - 18 - sw, H * 0.11f + 14, sw, 30);
                Ui.Alpha(bSkip.rt, 0.85f);
            }
            bCardT = card ? bCardT + Time.unscaledDeltaTime : 0;
            bCard.Show(card);
            if (!card) return;
            // (no wider than 44 of its letters, centred; the name first and largest, then its line, then the button)
            float most = Mathf.Min(44 * CardBody * 0.62f, W - 24), padX = 1.2f * CardBody, padY = 0.6f * CardBody;
            var ns = Ui.Set(bName, Ui.Upper(Text.Plain(b.S("name") ?? "")), most - 2 * padX - 26);
            var ts = Ui.Set(bText, Text.Plain(b.S("text") ?? ""), most - 2 * padX);
            float gh = 32, gw = LayButton(bGoBadge, bGoKey, bGoText, b.S("ok") ?? "", Ui.Upper(b.S("okLabel") ?? "Continue"), 10, gh);
            float inner = Mathf.Max(ns.x + 26, Mathf.Max(ts.x, gw)), w = inner + 2 * padX;
            float y = padY;
            float nameX = w / 2 - (ns.x + 26) / 2;
            Ui.Place(bStar.rectTransform, nameX + 4, y + ns.y / 2 - 6, 12, 12);
            Ui.Place(bName.rectTransform, nameX + 26, y, ns.x, ns.y); y += ns.y + 4;
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
            if (!at.HasValue) return;
            var key = p.S("key", "E");
            prompt.SetFill(HintBg); promptKey.color = HintInk; promptText.color = HintInk;
            promptText.fontSize = Sz(12); promptKeyText.fontSize = Sz(11);
            promptKeyText.text = key;
            float kw = Mathf.Max(21, Ui.Measure(promptKeyText, key).x + 10);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, 21);
            var s = Ui.Set(promptText, p.S("text"), 360);
            float lh = Mathf.Max(21, Sz(12) * 1.6f);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, lh);
            Ui.Place(promptText.rectTransform, 4 + kw + 6, 3, s.x, lh);
            float w = 4 + kw + 6 + s.x + 10, h = lh + 6;
            Ui.Place(prompt.rt, Mathf.Clamp(at.Value.x - w / 2, 8, W - w - 8), Mathf.Clamp(at.Value.y - h, 8, H - h - 8), w, h);
        }

        // the hearts (src/hud.js healthHud / heartsSvg, the page's #health): a heart a container, filled by its quarters,
        // the last one warmer when low; then the potions' flask and count, the wallet's chimes; the magic bar under them
        // (its units, the reserve's level). Without hearts in the state, the old bar.
        static Sprite heartFill, heartLine;
        readonly List<(RectTransform rt, Image back, Image fill, Image line)> hearts = new();
        RectTransform heartRow; Image potionIcon, chimeIcon; Label potionN, chimeN;
        Ui.Box magicBox; Image magicFill;
        static readonly Color HeartRed = Ui.Hex("#d9503f"), HeartLow = Ui.Hex("#e8643c"), ChimeTeal = Ui.Hex("#63d3e4"), MagicTeal = Ui.Hex("#3fa7b4");

        /// <summary>A heart (filled, or its ink outline) from the page's own path (src/hud.js HEART, its 20 × 18.4 box, y
        /// down), its curves cut into a polygon: 40 × 37 px, a pixel's coverage by its distance to the outline.</summary>
        static Sprite Heart(bool outline)
        {
            const int w = 40, h = 37; const float s = 2, edge = 2.1f * s;
            float[][] curves = {
                new[] { 10f, 17.2f, 6.2f, 14.1f, 1.4f, 10.6f, 1.4f, 6.1f }, new[] { 1.4f, 6.1f, 1.4f, 3.2f, 3.6f, 1.2f, 6.1f, 1.2f },
                new[] { 6.1f, 1.2f, 7.8f, 1.2f, 9.2f, 2.2f, 10f, 3.6f }, new[] { 10f, 3.6f, 10.8f, 2.2f, 12.2f, 1.2f, 13.9f, 1.2f },
                new[] { 13.9f, 1.2f, 16.4f, 1.2f, 18.6f, 3.2f, 18.6f, 6.1f }, new[] { 18.6f, 6.1f, 18.6f, 10.6f, 13.8f, 14.1f, 10f, 17.2f },
            };
            var poly = new List<Vector2>();
            foreach (var c in curves)
                for (int i = 0; i < 16; i++)
                {
                    float t = i / 16f, u = 1 - t;
                    float x = u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6];
                    float y = u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7];
                    poly.Add(new Vector2(x * s, (18.4f - y) * s));   // (texture y up)
                }
            var t2 = new Texture2D(w, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = outline ? "heart line" : "heart" };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    bool inside = false; float best = float.MaxValue;
                    for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
                    {
                        Vector2 a = poly[i], b = poly[j];
                        if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
                        var ab = b - a; float k = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-6f, ab.sqrMagnitude));
                        best = Mathf.Min(best, (a + ab * k - p).magnitude);
                    }
                    float d = inside ? -best : best;
                    float cov = outline ? Mathf.Clamp01(0.5f - (Mathf.Abs(d) - edge * 0.5f)) : Mathf.Clamp01(0.5f - d);
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
            float hh = 21.6f * ts, hw = hh * 1.1f, q = Mathf.Max(0, Mathf.Round(h.F("hearts") * 4));
            int max = Mathf.Max(0, h.I("max", 3));
            bool lowNow = h.Get("low") is bool lw && lw;
            while (hearts.Count < max)
            {
                var rt = Ui.Node("heart " + hearts.Count, heartRow);
                Image L(string name, Color c, Sprite sp) { var im = Ui.Rect(rt, c, 0, name); im.sprite = sp; im.type = Image.Type.Simple; Ui.Stretch(im.rectTransform); return im; }
                var shadow = L("shadow", new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.9f), heartFill); shadow.rectTransform.offsetMin = new Vector2(1.5f, -1.5f); shadow.rectTransform.offsetMax = new Vector2(1.5f, -1.5f);
                var back = L("empty", Cream, heartFill);
                var fill = L("fill", HeartRed, heartFill);
                fill.type = Image.Type.Filled; fill.fillMethod = Image.FillMethod.Radial360; fill.fillOrigin = (int)Image.Origin360.Bottom; fill.fillClockwise = true;
                var line = L("ink", Ui.Ink, heartLine);
                hearts.Add((rt, back, fill, line));
            }
            float x = 0;
            for (int i = 0; i < hearts.Count; i++)
            {
                var H_ = hearts[i]; bool on = i < max;
                if (H_.rt.gameObject.activeSelf != on) H_.rt.gameObject.SetActive(on);
                if (!on) continue;
                int n = (int)Mathf.Clamp(q - i * 4, 0, 4);
                Ui.Place(H_.rt, x, 0, hw * 0.92f, hh);
                H_.fill.fillAmount = n / 4f;
                bool last = lowNow && n > 0 && (i == max - 1 || q - (i + 1) * 4 <= 0);
                H_.fill.color = last ? Color.Lerp(HeartLow, Ui.Gold, 0.35f + 0.35f * Mathf.Sin(Time.unscaledTime * Mathf.PI * 2.5f)) : HeartRed;
                x += hw;
            }
            // the potions (∞ while the shop's are endless) and the chimes (none: hidden), beside the hearts
            bool infinite = h.Get("infinite") is bool inf && inf;
            int pots = h.I("potions", -1);
            bool showPot = pots >= 0;
            Show(potionIcon, showPot); Show(potionN, showPot);
            x += hh * 0.35f;
            if (showPot)
            {
                Ui.Place(potionIcon.rectTransform, x, hh * 0.05f, hh * 0.8f, hh * 0.9f);
                Ui.Alpha(potionIcon.rectTransform, infinite || pots > 0 ? 1 : 0.4f);
                var s = Ui.Set(potionN, infinite ? "∞" : pots.ToString(), 80);
                potionN.fontSize = Mathf.RoundToInt(hh * 0.8f);
                Ui.Place(potionN.rectTransform, x + hh * 0.9f, 0, s.x + 4, hh);
                x += hh * 0.9f + s.x + hh * 0.35f;
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
            // the magic bar: as long as its units, filled to the reserve's level
            bool magic = h.Get("magic") is double;
            magicBox.Show(magic);
            if (magic)
            {
                float units = Mathf.Max(1, h.F("magicMax", 3)), bw = hh * 2.35f * units, bh = hh * 0.5f;
                Ui.Place(magicBox.rt, 0, hh + hh * 0.22f, bw, bh);
                Ui.Place(magicFill.rectTransform, 0, 0, Mathf.Max(0, (bw - 4) * Mathf.Clamp01(h.F("magic") / units)), bh - 4);
            }
            Ui.Place(heartRow, 16, 12, 400, hh * 2);
        }

        void BuildHearts()
        {
            if (!heartFill) heartFill = Heart(false);
            if (!heartLine) heartLine = Heart(true);
            heartRow = Ui.Node("hearts", root);
            heartRow.SetSiblingIndex(health.rt.GetSiblingIndex());
            potionIcon = Round(heartRow, HeartRed, "potion"); potionIcon.sprite = Ui.Round(8); potionIcon.type = Image.Type.Sliced;
            potionN = Ui.Label(heartRow, "potions", Ui.Mono, 17, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            chimeIcon = Ui.Rect(heartRow, ChimeTeal, 0, "chime"); chimeIcon.rectTransform.localRotation = Quaternion.Euler(0, 0, 45);
            chimeN = Ui.Label(heartRow, "chimes", Ui.Mono, 17, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            magicBox = Ui.Panel(heartRow, "magic", Cream, Ui.Ink, 2, 1.5f, 1.5f, 6);
            magicFill = Ui.Rect(magicBox.fill.rectTransform, MagicTeal, 0, "level");
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

        void DrawKeys(Dictionary<string, object> k, bool on)
        {
            on &= k != null;
            Show(keys, on);
            if (!on) return;
            var text = "KEY ×" + k.I("small") + (k.Get("big") is bool big && big ? "  + GREAT KEY" : "");
            var s = Ui.Set(keysText, text, 260);
            Ui.Place(keysText.rectTransform, 8, 3, s.x, 18);
            // (under the hearts and the magic bar when they show, as the page's #keys is under #health)
            float ky = heartRow != null && heartRow.gameObject.activeSelf ? 12 + 21.6f * ts * (magicBox.rt.gameObject.activeSelf ? 1.72f : 1) + 8 : 32;
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
            // (the words at the Text size setting's size, the panel in em with them; the plain background: white, black words, no ruled lines)
            dlgText.fontSize = Body; dlgName.fontSize = NameSize;
            dlgPanel.SetFill(solid ? Color.white : Ui.Paper);
            dlgText.color = solid ? Color.black : Ui.Ink;
            Show(dlgLines, !solid);
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
                num.fontSize = AnswerSize; tx.fontSize = AnswerSize;
                Ui.Place(num.rectTransform, 0, 2, keyW, AnswerSize * 1.4f);
                var s = Ui.Set(tx, Ui.Rich(Text.Plain((choices[i] as Dictionary<string, object>).S("text"))), cw - keyW);
                Ui.Place(tx.rectTransform, keyW, 2, s.x, s.y);
                tx.color = hi ? (solid ? Color.black : Ui.Ink) : (solid ? Ui.Hex("#333333") : Muted);
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
