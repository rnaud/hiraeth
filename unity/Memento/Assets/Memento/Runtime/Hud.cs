using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The screen over the page, in uGUI on a camera-space canvas (so the camera's own image, and
    /// the batch screenshots, carry it), styled as the web game's (index.html, src/menus.css):
    /// the status box (where you are, the objective, the father's charge in its gold tag), the
    /// prompt floating over what B / ○ would use, speech balloons, toasts, the health bar, the
    /// knock-out sheet, the conversation panel (src/story/dialogue.js: the portrait chip, the name
    /// tag, the words resolving at an even pace, at most three answers), the charge's lettered
    /// card (charge.js), the makers' box card (boxes/card.js), the ship's subtitles, hint and skip
    /// bar (ship/cinema.js), the tool's mode flash; the sketchbook (<see cref="Journal"/>), the
    /// pause menu (<see cref="PauseMenu"/>) and the galactic map (<see cref="StarMap"/>) are on it too.
    /// </summary>
    public class Hud : MonoBehaviour
    {
        public Game game;
        readonly Queue<string> toasts = new();
        string toastNow; float toastT;
        public bool journalOpen;
        public string card; float cardT;            // a card that waits for a press (a makers' box, the ending)
        public string cardTitle;
        string boxName, boxText, boxUse; bool boxCard;
        // conversation
        public DialogueRunner talk; public Npc talkNpc; public string talkName, talkTitle;
        float reveal; int sel;
        public System.Action onTalkEnd;
        Dictionary<string, object> talkPerson; string spokenText; float spokenAt; Voice.Plan spokenPlan;
        public bool cinematic;                       // a scene has the camera (a makers' box opening): no prompts
        public bool hidden;                          // (a batch close-up: the page alone)
        public bool helpOn;                          // H: the controls in the status box
        public bool Busy => talk != null || journalOpen || card != null || cinematic || (pause != null && pause.open);
        float chargeT = -1;                          // the charge's lettered card (charge.js showChargeCard), its age
        string keptName; float keptUntil;            // a new keepsake: "✦ Something of value: …" for a while
        float modeFlash; string modeName = "fluid", modeKind = "shoot";
        bool quietLast;

        // ------------------------------------------------------------------ the canvas and its pieces
        public RectTransform root;
        Canvas canvas;
        float W => root.rect.width; float H => root.rect.height;
        Ui.Box status; Label statusA, statusB, statusHelp; Ui.Box chargeTag; Label chargeTagText;
        Ui.Box toast; Label toastText;
        Ui.Box prompt; Image promptKey; Label promptKeyText, promptText;
        readonly List<(Ui.Box box, Label text, Sketch tail)> balloons = new();
        Ui.Box health; Image healthFill, healthEdge;
        RectTransform restart; Label restartSmall;
        // the conversation
        RectTransform dlg; Ui.Box dlgPanel; Sketch dlgLines, dlgMore; RectTransform chip; Image chipFill; RawImage chipImg; Label chipLetter;
        Ui.Box dlgTag; Label dlgName, dlgTitle, dlgText;
        readonly List<(Ui.Box box, Label num, Label text)> dlgChoices = new();
        // cards
        RectTransform chargeCard; Image chargeBand; Label chargeK, chargeH, chargeQ; Sketch chargePen, chargeLetters; CanvasGroup chargeGroup;
        Ui.Box boxCardPanel; Label boxK, boxH, boxWhatB, boxWhat, boxDoesB, boxDoes, boxLeft; Ui.Box boxGo; Label boxGoText; Sketch boxStar;
        RectTransform sheetDim; Ui.Box sheet; Label sheetTitle, sheetBody, sheetHint;
        // the ship's cinema
        Ui.Box sub; Label subText; Ui.Box hint; Label hintText; RectTransform skip; Label skipText; Image skipBar;
        Ui.Box mode; Label modeText; Sketch modePips;
        Ui.Box fps; Label fpsText; float fpsT, fpsAcc; int fpsN;
        public Journal journal; public PauseMenu pause; public StarMap map;

        /// <summary>A line at the top of the screen (quest.js toast): the newest replaces the one up.</summary>
        public void Toast(string t) { if (string.IsNullOrEmpty(t)) return; toastNow = Text.Plain(t); toastT = 0; }
        public void Kept(string name) { keptName = name; keptUntil = Time.unscaledTime + 12; }
        public void ModeFlash(string kind, string name) { modeKind = kind; modeName = name; modeFlash = 1.6f; }

        public void StartTalk(Dictionary<string, object> person, Npc npc, string displayName, string title)
        {
            talk = new DialogueRunner(person, game.state, game.quests, item => Toast($"Received {game.quests.ItemName(item)}"));
            talkNpc = npc; talkName = displayName; talkTitle = title; reveal = 0; sel = 0; talkPerson = person; spokenText = null;
            if (npc) npc.talking = true;
            if (talk.ended) { EndTalk(); return; }
            // the chip: their portrait against a flat tone of the desert's, or their initial on their colour
            var bg = Portrait.BackdropFor(person);
            Texture shot = null;
            try { shot = npc ? Portrait.Shoot(game, npc, bg) : null; } catch (System.Exception e) { Debug.LogWarning("Memento: portrait: " + e.Message); }
            chipFill.color = shot ? bg : (person?.S("color") is string c ? Ui.Hex(c) : Ui.Hex("#d8a24a"));
            chipImg.texture = shot; chipImg.enabled = shot;
            chipLetter.text = string.IsNullOrEmpty(displayName) ? "?" : displayName.Substring(0, 1);
            chipLetter.enabled = !shot;
            Sounds.Instance?.Play("page");
        }
        void EndTalk()
        {
            if (talkNpc) talkNpc.talking = false;
            talk = null; talkNpc = null;
            onTalkEnd?.Invoke();
        }
        /// <summary>A card that waits for a press: a title and its words (the ending).</summary>
        public void ShowCard(string title, string text, float minSecs = 1.5f) { cardTitle = title; card = text; cardT = -minSecs; boxCard = false; }
        /// <summary>The makers' box card (boxes/card.js): what it is, what it does, the makers' line.</summary>
        public void ShowBoxCard(string name, string text, string use, float minSecs = 0.5f) { cardTitle = name; card = text ?? ""; boxName = name; boxText = text; boxUse = use; boxCard = true; cardT = -minSecs; }
        /// <summary>The father's charge lettered across the screen for a few seconds (charge.js showChargeCard); it asks nothing.</summary>
        public void ShowChargeCard() { chargeT = 0; }

        // ------------------------------------------------------------------ building
        void Start() { if (!root) Build(); }

        /// <summary>The camera-space canvas the HUD and menus draw on (1280 × 720 reference, scaled by height).</summary>
        public static RectTransform MakeCanvas(Camera cam, string name, int order)
        {
            var go = new GameObject(name, typeof(RectTransform)) { layer = 5 };
            var c = go.AddComponent<Canvas>();
            c.renderMode = RenderMode.ScreenSpaceCamera; c.worldCamera = cam; c.planeDistance = Mathf.Max(0.2f, cam.nearClipPlane * 3); c.sortingOrder = order;
            var sc = go.AddComponent<CanvasScaler>();
            sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = new Vector2(1280, 720);
            sc.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight; sc.matchWidthOrHeight = 1;
            go.AddComponent<GraphicRaycaster>();
            return (RectTransform)go.transform;
        }

        public void Build()
        {
            root = MakeCanvas(game.cam, "HUD", 100);
            root.SetParent(transform, false);
            canvas = root.GetComponent<Canvas>();
            var mono = Ui.Mono;
            Debug.Log($"Memento: fonts here: {Ui.FontsLike("Avenir Next")} | {Ui.FontsLike("Futura")}");

            // the status box, bottom left (#hud)
            status = Ui.Panel(root, "status", Ui.Hex("#f7ecd2", 0.85f), Ui.Ink, 1.5f);
            statusHelp = Ui.Label(status.rt, "help", mono, 12, Ui.Ink, lineSpacing: 1.3f);
            statusA = Ui.Label(status.rt, "where", mono, 12, Ui.Ink, lineSpacing: 1.3f);
            statusB = Ui.Label(status.rt, "goal", mono, 12, Ui.Ink, lineSpacing: 1.3f);
            chargeTag = Ui.Panel(status.rt, "charge", Ui.Gold, Ui.Ink, 1.5f, 1.5f, 1.5f, 9);
            chargeTagText = Ui.Label(chargeTag.rt, "text", mono, 12, Ui.Ink);
            Ui.Space(chargeTagText, 0.03f);

            // the prompt over what you would use (#prompt): a round key badge and the action
            prompt = Ui.Panel(root, "prompt", Ui.Paper, Ui.Ink, 1.5f, 2, 2, 12);
            promptKey = Ui.Rect(prompt.rt, Ui.Ink, 11, "key");
            promptKeyText = Ui.Label(promptKey.rectTransform, "k", mono, 11, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(promptKeyText.rectTransform);
            promptText = Ui.Label(prompt.rt, "text", mono, 12, Ui.Ink, TextAnchor.MiddleLeft);

            // health, top left (#health), while hurt
            health = Ui.Panel(root, "health", Ui.Page, Ui.Ink, 2, 2, 2, 6);
            healthFill = Ui.Rect(health.fill.rectTransform, Ui.Hp, 0, "hp");
            healthEdge = Ui.Rect(health.fill.rectTransform, Ui.Ink, 0, "edge");

            // the toast, top centre (#toast)
            toast = Ui.Panel(root, "toast", Ui.Paper, Ui.Ink, 2, 4, 4);
            toastText = Ui.Label(toast.rt, "text", mono, 13, Ui.Ink, TextAnchor.UpperCenter);

            BuildDialogue(mono);
            BuildCards(mono);

            // the ship's cinema: subtitle, hint, hold to skip
            sub = Ui.Panel(root, "subtitle", Ui.Hex("#f7ecd2", 0.95f), Ui.Ink, 2, 3, 3);
            subText = Ui.Label(sub.rt, "text", mono, 17, Ui.Ink, TextAnchor.UpperCenter, lineSpacing: 1.2f);
            hint = Ui.Panel(root, "hint", Ui.Hex("#fff6dc", 0.92f), Ui.Ink, 1.5f);
            hintText = Ui.Label(hint.rt, "text", mono, 13, Ui.Ink, TextAnchor.UpperCenter);
            skip = Ui.Node("skip", root);
            Ui.Fill(skip, Ui.Hex("#2b211f", 0.82f), 0, "bg");
            skipText = Ui.Label(skip, "text", mono, 12, Ui.Page, TextAnchor.MiddleLeft);
            Ui.Space(skipText, 0.08f);
            var barBox = Ui.Panel(skip, "bar", new Color(0, 0, 0, 0), Ui.Page, 1);
            Ui.Place(barBox.rt, 0, 0, 60, 6);
            skipBar = Ui.Rect(barBox.fill.rectTransform, Ui.Gold, 0, "held");

            // the tool's mode, flashed when it changes (#tool .mode)
            mode = Ui.Panel(root, "tool mode", Ui.Hex("#f7ecd2", 0.85f), Ui.Ink, 1);
            modeText = Ui.Label(mode.rt, "text", mono, 11, Ui.Ink, TextAnchor.MiddleLeft);
            Ui.Space(modeText, 0.08f);
            modePips = Ui.Node("pips", mode.rt).gameObject.AddComponent<Sketch>(); modePips.raycastTarget = false;

            fps = Ui.Panel(root, "fps", Ui.Hex("#fffaf0", 0.8f), Ui.Ink, 1.5f);
            fpsText = Ui.Label(fps.rt, "text", mono, 12, Ui.Ink);

            // the knock-out sheet (#restart)
            restart = Ui.Stretch(Ui.Node("restart", root));
            Ui.Fill(restart, Ui.Hex("#2b211f", 0.6f), 0, "dim");
            var rs = Ui.Panel(restart, "sheet", Ui.Page, Ui.Ink, 2, 6, 6);
            rs.rt.anchorMin = rs.rt.anchorMax = rs.rt.pivot = new Vector2(0.5f, 1); rs.rt.sizeDelta = new Vector2(260, 118); rs.rt.anchoredPosition = new Vector2(0, -720 * 0.16f);
            // (the web tilts it -0.8°: a tilted edge would step without antialiasing here)
            var rp = Ui.Label(rs.rt, "p", mono, 13, Ui.Ink, TextAnchor.UpperCenter); Ui.Place(rp.rectTransform, 0, 18, 260, 20); rp.text = "That was too far a fall."; Ui.Space(rp, 0.04f);
            var rb = Ui.Panel(rs.rt, "button", Ui.Gold, Ui.Ink, 2, 3, 3, 4);
            rb.rt.anchorMin = rb.rt.anchorMax = rb.rt.pivot = new Vector2(0.5f, 1); rb.rt.sizeDelta = new Vector2(132, 38); rb.rt.anchoredPosition = new Vector2(0, -46);
            var rbt = Ui.Label(rb.rt, "t", mono, 16, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(rbt.rectTransform); rbt.text = "RESTART"; Ui.Space(rbt, 0.14f);
            restartSmall = Ui.Label(rs.rt, "small", mono, 11, Ui.Faint, TextAnchor.UpperCenter); Ui.Place(restartSmall.rectTransform, 0, 92, 260, 16);

            journal = new Journal(this, root);
            map = new StarMap(this, root);
            pause = new PauseMenu(this, root);
            Refresh();
        }

        void BuildDialogue(Font mono)
        {
            dlg = Ui.Node("dialogue", root);
            dlgPanel = Ui.Panel(dlg, "panel", Ui.Paper, Ui.Ink, 2.5f, 6, 6);
            Ui.Stretch(dlgPanel.rt);
            dlgLines = Ui.Stretch(Ui.Node("lines", dlgPanel.fill.rectTransform)).gameObject.AddComponent<Sketch>(); dlgLines.raycastTarget = false; dlgLines.feather = 0.5f;
            dlgText = Ui.Label(dlgPanel.rt, "text", mono, 15, Ui.Ink, lineSpacing: 1.3f);
            for (int i = 0; i < 3; i++)
            {
                var b = Ui.Panel(dlgPanel.rt, "choice" + i, Ui.Choice, Ui.Ink, 1.5f, 2, 2);
                var num = Ui.Label(b.rt, "n", mono, 14, Ui.Red, TextAnchor.UpperLeft, FontStyle.Bold);
                var t = Ui.Label(b.rt, "t", mono, 14, Ui.Ink, lineSpacing: 1.3f);
                dlgChoices.Add((b, num, t));
            }
            dlgMore = Ui.Node("more", dlgPanel.rt).gameObject.AddComponent<Sketch>(); dlgMore.raycastTarget = false;
            dlgMore.rectTransform.anchorMin = dlgMore.rectTransform.anchorMax = new Vector2(1, 0); dlgMore.rectTransform.pivot = Vector2.zero;
            dlgMore.rectTransform.sizeDelta = new Vector2(14, 9);
            dlgMore.Tri(new Vector2(0, 9), new Vector2(14, 9), new Vector2(7, 0), Ui.Red);
            // the portrait at the top-left corner, over the edge (.dlg-who .dlg-chip)
            chip = Ui.Node("chip", dlg);
            Ui.Rect(chip, Ui.Ink, 0, "shadow").sprite = Ui.Round(32);
            var sh = chip.GetChild(0) as RectTransform; Ui.Stretch(sh, 3, 3, -3, -3);
            var ring = Ui.Fill(chip, Ui.Ink, 0, "ring"); ring.sprite = Ui.Round(32);
            chipFill = Ui.Fill(chip, Ui.Hex("#d8a24a"), 0, "colour"); chipFill.sprite = Ui.Round(32);
            Ui.Stretch(chipFill.rectTransform, 2.5f, 2.5f, 2.5f, 2.5f);
            var mask = chipFill.gameObject.AddComponent<Mask>(); mask.showMaskGraphic = true;
            chipImg = Ui.Stretch(Ui.Node("portrait", chipFill.rectTransform)).gameObject.AddComponent<RawImage>(); chipImg.raycastTarget = false;
            chipLetter = Ui.Label(chipFill.rectTransform, "letter", mono, 36, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(chipLetter.rectTransform);
            var ls = chipLetter.gameObject.AddComponent<Shadow>(); ls.effectColor = Ui.Ink; ls.effectDistance = new Vector2(2, -2);
            chip.localRotation = Quaternion.Euler(0, 0, 3);
            // who is speaking: the caption box across the panel's top edge (.dlg-tag)
            dlgTag = Ui.Panel(dlg, "tag", Ui.Ink, Ui.Ink, 0, 3, 3, 0, Ui.Red);
            
            dlgName = Ui.Label(dlgTag.rt, "name", mono, 19, Ui.Paper, TextAnchor.LowerLeft);
            Ui.Space(dlgName, 0.14f);
            dlgTitle = Ui.Label(dlgTag.rt, "title", mono, 12, Ui.Hex("#fffaf0", 0.85f), TextAnchor.LowerLeft, FontStyle.Italic);
        }

        void BuildCards(Font mono)
        {
            // the charge, lettered (#charge-card): a band of paper across the middle, thin airy capitals
            chargeCard = Ui.Node("charge card", root);
            chargeGroup = chargeCard.gameObject.AddComponent<CanvasGroup>(); chargeGroup.blocksRaycasts = false;
            chargeBand = Ui.Fill(chargeCard, Color.white, 0, "band");
            chargeBand.sprite = Band();
            var top = Ui.Rect(chargeCard, Ui.Hex("#2b211f", 0.55f), 0, "rule top"); top.rectTransform.anchorMin = new Vector2(0, 1); top.rectTransform.anchorMax = new Vector2(1, 1); top.rectTransform.pivot = new Vector2(0.5f, 1); top.rectTransform.sizeDelta = new Vector2(0, 1.5f); top.rectTransform.anchoredPosition = Vector2.zero;
            var bot = Ui.Rect(chargeCard, Ui.Hex("#2b211f", 0.55f), 0, "rule bottom"); bot.rectTransform.anchorMin = new Vector2(0, 0); bot.rectTransform.anchorMax = new Vector2(1, 0); bot.rectTransform.pivot = new Vector2(0.5f, 0); bot.rectTransform.sizeDelta = new Vector2(0, 1.5f); bot.rectTransform.anchoredPosition = Vector2.zero;
            chargeK = Ui.Label(chargeCard, "k", mono, 11, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold); Ui.Space(chargeK, 0.42f);
            chargeH = Ui.Label(chargeCard, "h1", Ui.Light, 60, Ui.Ink, TextAnchor.UpperCenter); chargeH.horizontalOverflow = HorizontalWrapMode.Overflow; chargeH.enabled = false;
            chargeLetters = Ui.Node("letters", chargeCard).gameObject.AddComponent<Sketch>(); chargeLetters.raycastTarget = false;
            chargePen = Ui.Node("pen", chargeCard).gameObject.AddComponent<Sketch>(); chargePen.raycastTarget = false;
            chargeQ = Ui.Label(chargeCard, "q", mono, 15, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Italic); Ui.Space(chargeQ, 0.04f);

            // the makers' box card (#boxcard)
            boxCardPanel = Ui.Panel(root, "box card", Ui.Cream, Ui.Ink, 2, 6, 6);
            
            boxK = Ui.Label(boxCardPanel.rt, "k", mono, 11, Ui.Hex("#2b211f", 0.75f)); Ui.Space(boxK, 0.3f);
            boxStar = Ui.Node("star", boxCardPanel.rt).gameObject.AddComponent<Sketch>(); boxStar.raycastTarget = false;
            boxH = Ui.Label(boxCardPanel.rt, "h2", mono, 24, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(boxH, 0.04f);
            boxWhatB = Ui.Label(boxCardPanel.rt, "what b", mono, 11, Ui.Hex("#7a3a35"), TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(boxWhatB, 0.18f);
            boxWhat = Ui.Label(boxCardPanel.rt, "what", mono, 14, Ui.Ink, lineSpacing: 1.25f);
            boxDoesB = Ui.Label(boxCardPanel.rt, "does b", mono, 11, Ui.Teal, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(boxDoesB, 0.18f);
            boxDoes = Ui.Label(boxCardPanel.rt, "does", mono, 14, Ui.Ink, lineSpacing: 1.25f);
            boxLeft = Ui.Label(boxCardPanel.rt, "left", mono, 11, Ui.Hex("#2b211f", 0.65f), TextAnchor.UpperLeft, FontStyle.Italic); Ui.Space(boxLeft, 0.06f);
            boxGo = Ui.Panel(boxCardPanel.rt, "go", Ui.Gold, Ui.Ink, 1.5f, 2, 2);
            boxGoText = Ui.Label(boxGo.rt, "t", mono, 12, Ui.Ink, TextAnchor.MiddleCenter); Ui.Stretch(boxGoText.rectTransform); Ui.Space(boxGoText, 0.08f);

            // a sheet that waits for a press (the ending): the page's paper over a dimmed world
            sheetDim = Ui.Stretch(Ui.Node("sheet", root));
            Ui.Fill(sheetDim, Ui.Hex("#2b211f", 0.45f), 0, "dim");
            sheet = Ui.Panel(sheetDim, "panel", Ui.Page, Ui.Ink, 2, 7, 7);
            
            sheetTitle = Ui.Label(sheet.rt, "title", mono, 20, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(sheetTitle, 0.14f);
            sheetBody = Ui.Label(sheet.rt, "body", mono, 14, Ui.Ink, lineSpacing: 1.3f);
            sheetHint = Ui.Label(sheet.rt, "hint", mono, 13, Ui.Red, TextAnchor.UpperRight);
        }

        static Sprite band;
        /// <summary>The charge card's band: paper fading in from both sides (linear-gradient 0 → .93 at 18% … 82% → 0).</summary>
        static Sprite Band()
        {
            if (band) return band;
            var t = new Texture2D(128, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var c = Ui.Hex("#fff6dc");
            for (int x = 0; x < 128; x++) { float u = (x + 0.5f) / 128f; float a = Mathf.Min(1, Mathf.Min(u, 1 - u) / 0.18f) * 0.93f; c.a = a; t.SetPixel(x, 0, c); }
            t.Apply();
            band = Sprite.Create(t, new Rect(0, 0, 128, 1), new Vector2(0.5f, 0.5f));
            return band;
        }

        // ------------------------------------------------------------------ input and state
        void Update()
        {
            if (!root) return;
            float dt = Time.unscaledDeltaTime;
            if (toastNow == null && toasts.Count > 0) { toastNow = toasts.Dequeue(); toastT = 0; }
            if (toastNow != null) { toastT += dt; if (toastT >= 4.5f) toastNow = null; }
            if (chargeT >= 0) { chargeT += dt; if (chargeT > 6.4f) chargeT = -1; }
            if (modeFlash > 0) modeFlash -= dt;
            if (Pad.HelpDown()) helpOn = !helpOn;
            // the pause menu over everything; then the open panel takes the press
            if (pause.open) { pause.Update(dt); return; }
            if (card != null) { cardT += dt; if (cardT > 0 && Pad.ConfirmDown()) { card = null; Sounds.Instance?.Play("page"); } return; }
            if (map.open) { map.Update(dt); return; }
            if (journalOpen) { journal.Update(dt); if (Pad.BackDown() || Pad.JournalDown()) { journalOpen = false; Sounds.Instance?.Play("page"); } return; }
            if (talk != null) { UpdateTalk(dt); return; }
            if (quietLast && Pad.MenuDown()) { pause.Open(); return; }
            if (Pad.JournalDown() && !cinematic) { journalOpen = true; journal.Open(); Sounds.Instance?.Play("page"); }
        }
        void LateUpdate()
        {
            if (!root) return;
            quietLast = !Busy && !map.open && !(game.ship && game.ship.PrologueActive) && game.player && !game.player.dead;
            Refresh();
        }

        void UpdateTalk(float dt)
        {
            if (talk.ended) { EndTalk(); return; }
            reveal += dt * 55f;   // letters per second (voice.js REVEAL_CPS)
            var text = talk.TextNow;
            var choices = talk.Choices();
            // a new page: said aloud in the speaker's voice (voice.js), the mouth on its syllables
            if (text != spokenText)
            {
                spokenText = text; spokenAt = Time.time;
                var d = talkPerson;
                var v = Voice.Of(d?.S("id") ?? talkName, d != null && d.Has("voice") ? d.F("voice") : (float?)null, d?.S("kind"), talkNpc ? talkNpc.scale : 1, talkName ?? "", talkTitle ?? "", d?.S("age"));
                spokenPlan = talkNpc ? Sounds.Instance?.Say(Text.Plain(text), talk.Tone, v) : null;
            }
            float? mouth = spokenPlan != null ? Voice.MouthAt(spokenPlan, Time.time - spokenAt) : (float?)null;
            // their face while they say it (talk-face.js): the line's tone, the mouth moving; the traveller looks at them
            if (talkNpc)
            {
                talkNpc.hudSpeaking = reveal < text.Length;
                if (talkNpc.figure) talkNpc.figure.Talk(talkNpc.hudSpeaking, talk.Tone, mouth);
                if (game.player && game.player.figure) game.player.figure.lookTarget = talkNpc.HeadTransform;
            }
            int nav = Pad.NavDown();
            if (choices.Count > 0 && nav != 0) { sel = Mathf.Clamp(sel + nav, 0, choices.Count - 1); Sounds.Instance?.Play("tick"); }
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

        // ------------------------------------------------------------------ drawing (every frame, from the state)
        static void Show(Component c, bool on) { if (c && c.gameObject.activeSelf != on) c.gameObject.SetActive(on); }
        static void Show(Ui.Box b, bool on) { if (b != null) b.Show(on); }

        /// <summary>Where a world point lands on the canvas (top-left origin, y down), or null behind the camera.</summary>
        public Vector2? ToCanvas(Vector3 world)
        {
            var cam = game.cam;
            var sp = cam.WorldToScreenPoint(world);
            if (sp.z <= 0.05f) return null;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(root, sp, cam, out var lp)) return null;
            return new Vector2(lp.x + W * 0.5f, H * 0.5f - lp.y);
        }

        void Refresh()
        {
            bool off = hidden;
            var pl = game.player;
            bool talking = talk != null;
            bool menus = pause.open || journalOpen || map.open;
            bool shipScene = game.ship && game.ship.PrologueActive;
            DrawStatus(!off && !talking && !menus && card == null && !shipScene && pl && !cinematic);
            DrawPrompt(!off && !talking && !menus && card == null && !cinematic && pl);
            DrawBalloons(!off && !talking && !menus);
            DrawHealth(!off && !talking && !menus && pl && pl.health < 0.999f && !pl.dead);
            Show(restart, !off && pl && pl.dead && !menus);
            if (pl && pl.dead) restartSmall.text = Pad.Key("A / ×", "Enter or Space");
            DrawToast(!off && !menus);
            DrawTalk(!off && talking && !menus);
            DrawChargeCard(!off && chargeT >= 0 && !menus);
            DrawBoxCard(!off && card != null && boxCard && !pause.open);
            DrawSheet(!off && card != null && !boxCard && !pause.open);
            DrawShip(!off && !menus);
            DrawMode(!off && modeFlash > 0 && !menus && !talking);
            DrawFps(!off && Settings.showFps);
            journal.Draw(!off && journalOpen && !pause.open);
            map.Draw(!off && map.open && !pause.open);
            pause.Draw(!off && pause.open);
        }

        string KeyFor(string action) => Pad.Key(action == "use" ? "B / ○" : "A / ×", action == "use" ? "E" : "Enter");
        static string Dist(float d) => d < 1000 ? Mathf.Round(d) + " m" : (d / 1000).ToString("0.0") + " km";

        void DrawStatus(bool on)
        {
            Show(status, on);
            if (!on) return;
            var pl = game.player;
            // line 1: where you are (biome.js atmosphere), then the gauges (main.js updateHud)
            var parts = new List<string> { game.Region(pl.transform.position) };
            string Gauge(float v) { int n = Mathf.RoundToInt(Mathf.Clamp01(v) * 10); return "[" + new string('■', n) + new string('·', 10 - n) + "]"; }
            if (pl.climbing) parts.Add($"climbing {Gauge(pl.stamina / Player.Stamina)}");
            else if (pl.stamina < Player.Stamina * 0.99f) parts.Add($"stamina {Gauge(pl.stamina / Player.Stamina)}");
            if (pl.riding) parts.Add(Pad.HasPad ? "B / ○ dismount · RT / R2 go · left stick steer" : "E dismount · W/S throttle · A/D steer · SHIFT boost");
            // the use prompt without a place to hang (a thing's words): in the box, badge first
            string inBox = game.prompt != null && !game.promptAt.HasValue ? game.prompt : null;
            string a = string.Join(" · ", parts);
            // line 2: the objective, or the father's charge in its own gold (charge.js chargeHud)
            string goal = null, charge = null;
            var obj = game.quests.Objective();
            bool kept = keptName != null && Time.unscaledTime < keptUntil;
            if (kept) charge = $"✦ Something of value: {keptName}";
            else if (obj.HasValue) goal = $"◆ {Text.Plain(obj.Value.label)} · {Dist(Vector3.Distance(pl.transform.position, obj.Value.pos))}";
            else if (game.state.Is("prologue.done")) charge = "✦ Bring back something of value";
            float x = 12, y = 8, maxW = Mathf.Min(560, W * 0.6f);
            float w = 0;
            if (helpOn)
            {
                var help = "<b>MEMENTO</b>\n" + (Pad.HasPad
                    ? "left stick move · L3 run · A / × jump · B / ○ talk, use\nRT / R2 shoot · RB / R1 push · D-pad mode · View sketchbook · Menu pause"
                    : "WASD move · SHIFT run · SPACE jump (again in the air: boost)\nE talk, use · G / click shoot · C push · X mode · J sketchbook · Esc pause · H help");
                var hs = Ui.Set(statusHelp, help, maxW); Ui.Place(statusHelp.rectTransform, x, y, hs.x, hs.y); y += hs.y + 2; w = Mathf.Max(w, hs.x);
            }
            Show(statusHelp, helpOn);
            if (inBox != null) a += $" · {(Pad.HasPad ? "B / ○" : "E")} {inBox}";
            var sa = Ui.Set(statusA, a, maxW); Ui.Place(statusA.rectTransform, x, y, sa.x, sa.y); y += sa.y; w = Mathf.Max(w, sa.x);
            Show(statusB, goal != null); Show(chargeTag, charge != null);
            if (goal != null) { var sb = Ui.Set(statusB, goal, maxW); Ui.Place(statusB.rectTransform, x, y, sb.x, sb.y); y += sb.y; w = Mathf.Max(w, sb.x); }
            if (charge != null)
            {
                var st = Ui.Set(chargeTagText, charge, maxW - 16);
                Ui.Place(chargeTagText.rectTransform, 7, 0, st.x, st.y);
                Ui.Place(chargeTag.rt, x, y + 1, st.x + 14, st.y + 1); y += st.y + 3; w = Mathf.Max(w, st.x + 14);
            }
            // bottom left, 16 px in (and over the controller hint's bar when it shows)
            float bh = y + 8, bw = w + 24;
            Ui.Place(status.rt, 16, H - 16 - bh, bw, bh);
        }

        void DrawPrompt(bool on)
        {
            var at = on && game.prompt != null && game.promptAt.HasValue ? ToCanvas(game.promptAt.Value) : null;
            Show(prompt, at.HasValue);
            if (!at.HasValue) return;
            var key = Pad.HasPad ? "B / ○" : "E";
            promptKeyText.text = key;
            float kw = Mathf.Max(21, Ui.Measure(promptKeyText, key).x + 10);
            Ui.Place(promptKey.rectTransform, 4, 3, kw, 21);
            var s = Ui.Set(promptText, game.prompt, 360);
            Ui.Place(promptText.rectTransform, 4 + kw + 6, 3, s.x, 21);
            float w = 4 + kw + 6 + s.x + 10, h = 27;
            Ui.Place(prompt.rt, Mathf.Clamp(at.Value.x - w / 2, 8, W - w - 8), Mathf.Clamp(at.Value.y - h, 8, H - h - 8), w, h);
        }

        readonly List<Rect> placed = new();
        void DrawBalloons(bool on)
        {
            int k = 0; placed.Clear();
            if (on)
                foreach (var n in game.npcs)
                {
                    if (n == null || n.shout == null || Time.time > n.shoutUntil || n.talking) continue;
                    if (Vector3.Distance(n.pos, game.cam.transform.position) > 40) continue;
                    var at = ToCanvas(n.Head + Vector3.up * 0.5f);
                    if (!at.HasValue) continue;
                    if (k == balloons.Count)
                    {
                        var b = Ui.Panel(root, "balloon", Ui.Paper, Ui.Ink, 2, 0, 0, 16);
                        var t = Ui.Label(b.rt, "text", Ui.Mono, 13, Ui.Ink, lineSpacing: 1.15f);
                        var tail = Ui.Node("tail", b.rt).gameObject.AddComponent<Sketch>(); tail.raycastTarget = false;
                        tail.rectTransform.anchorMin = tail.rectTransform.anchorMax = tail.rectTransform.pivot = Vector2.zero;
                        tail.rectTransform.anchoredPosition = new Vector2(22, -11); tail.rectTransform.sizeDelta = new Vector2(10, 11);
                        tail.Tri(new Vector2(0, 11), new Vector2(10, 11), new Vector2(0, 0), Ui.Ink);
                        balloons.Add((b, t, tail));
                    }
                    var (box, text, _) = balloons[k++];
                    Show(box, true);
                    var s = Ui.Set(text, Ui.Rich(Text.Plain(n.shout)), 218);
                    Ui.Place(text.rectTransform, 11, 7, s.x, s.y);
                    float w = s.x + 22, h = s.y + 14;
                    var r = new Rect(Mathf.Clamp(at.Value.x - 27, 4, W - w - 4), Mathf.Clamp(at.Value.y - h - 11, 4, H - h - 4), w, h);
                    // (two people talking at once: the later balloon goes up over the other)
                    for (int guard = 0; guard < 6; guard++)
                    {
                        bool moved = false;
                        foreach (var o in placed) if (o.Overlaps(r)) { r.y = o.yMin - h - 14; moved = true; }
                        if (!moved) break;
                    }
                    placed.Add(r);
                    Ui.Place(box.rt, r.x, r.y, w, h);
                }
            for (int i = k; i < balloons.Count; i++) Show(balloons[i].box, false);
        }

        void DrawHealth(bool on)
        {
            Show(health, on);
            if (!on) return;
            Ui.Place(health.rt, 16, 14, 150, 11);
            float hp = Mathf.Clamp01(game.player.health), w = 146 * hp;
            Ui.Place(healthFill.rectTransform, 0, 0, w, 7);
            Ui.Place(healthEdge.rectTransform, w, 0, 2, 7);
            healthFill.color = hp < 0.3f ? Color.Lerp(Ui.Hp, Ui.Gold, 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * Mathf.PI * 2.5f)) : Ui.Hp;
        }

        void DrawToast(bool on)
        {
            on &= toastNow != null;
            Show(toast, on);
            if (!on) return;
            float t = toastT / 4.5f;
            float a = t < 0.08f ? t / 0.08f : t < 0.8f ? 1 : 1 - (t - 0.8f) / 0.2f;
            float dy = t < 0.08f ? -8 * (1 - t / 0.08f) : 0;
            var s = Ui.Set(toastText, toastNow, Mathf.Min(900, W - 60));
            Ui.Place(toastText.rectTransform, 14, 8, s.x, s.y);
            float w = s.x + 28, h = s.y + 16;
            // below the letterbox's top bar while a scene plays (cinema.js layoutCinema)
            float top = 22 + (game.ship && game.ship.bars > 0.01f ? H * 0.11f * game.ship.bars : 0);
            Ui.Place(toast.rt, W / 2 - w / 2, top + dy, w, h);
            SetAlpha(toast.rt, a);
        }

        static void SetAlpha(RectTransform rt, float a)
        {
            var g = Ui.Group(rt);
            g.alpha = a; g.blocksRaycasts = false;
        }

        void DrawTalk(bool on)
        {
            Show(dlg, on);
            if (!on) return;
            var text = talk.TextNow; int n = Mathf.Min(text.Length, (int)reveal);
            bool done = n >= text.Length;
            var shown = text.Substring(0, n);
            // (a highlight still waiting for its closing star shows plain)
            if (shown.Count(c => c == '*') % 2 == 1) { int i = shown.LastIndexOf('*'); shown = shown.Remove(i, 1); }
            var choices = done ? talk.Choices() : new List<(string text, string tone, int index, Dictionary<string, object> c)>();
            // (a lone "(leave)": the panel's own press closes it)
            if (choices.Count == 1 && choices[0].c == null) choices.Clear();
            float pw = Mathf.Min(720, W - 32);
            float padL = 112, padR = 22, padT = 26, padB = 14, cw = pw - padL - padR;
            var body = Ui.Rich(shown) + (done ? "" : "<color=#2b211f99>▍</color>");
            var ts = Ui.Set(dlgText, body, cw);
            float textH = Mathf.Max(15 * 2.9f, Ui.Measure(dlgText, Ui.Rich(text), cw).y);
            Ui.Place(dlgText.rectTransform, padL, padT + 4, cw, textH);
            float y = padT + 4 + textH + 8;
            for (int i = 0; i < dlgChoices.Count; i++)
            {
                var (box, num, tx) = dlgChoices[i];
                bool has = i < choices.Count;
                Show(box, has);
                if (!has) continue;
                bool hi = i == sel;
                num.text = Pad.HasPad ? "›" : (i + 1).ToString();
                Ui.Place(num.rectTransform, 10, 5, 20, 20);
                var s = Ui.Set(tx, Ui.Rich(Text.Plain(choices[i].text)), cw - 20 - 30);
                Ui.Place(tx.rectTransform, 10 + 19.6f, 5, s.x, s.y);
                float bh = Mathf.Max(21, s.y) + 10;
                Ui.Place(box.rt, padL + (hi ? -1 : 0), y + (hi ? -1 : 0), cw, bh);
                box.SetFill(hi ? Ui.Cream : Ui.Choice);
                box.SetShadow(hi ? 3 : 2, hi ? 3 : 2);
                y += bh + 5;
            }
            if (choices.Count > 0) y -= 5;
            float ph = Mathf.Max(92, y + padB);
            float left = W / 2 - pw / 2, top = H - 26 - ph;
            Ui.Place(dlg, left, top, pw, ph);
            Ui.Place(dlgPanel.rt, 0, 0, pw, ph);
            // ruled like a notebook (repeating-linear-gradient 26 px clear, 1 px of ink at 5 %)
            dlgLines.Clear();
            for (float ly = 26; ly < ph; ly += 27) dlgLines.Box(new Rect(-pw / 2, ph / 2 - ly - 1, pw, 1), Ui.Hex("#2b211f", 0.05f));
            Show(dlgMore, done && choices.Count == 0);
            dlgMore.rectTransform.anchoredPosition = new Vector2(-30, 11 + 3 * (0.5f - 0.5f * Mathf.Cos(Time.unscaledTime * Mathf.PI * 2)));
            // the chip over the top-left corner, the tag beside it across the top edge
            Ui.Place(chip, 14, -36, 84, 84);
            var name = Ui.Upper(talkName ?? "");
            var ns = Ui.Set(dlgName, name);
            var tt = Ui.Set(dlgTitle, talkTitle ?? "");
            Show(dlgTitle, !string.IsNullOrEmpty(talkTitle));
            float tw = Mathf.Min(pw - 124, 14 + ns.x + (string.IsNullOrEmpty(talkTitle) ? 0 : 12 + tt.x) + 14), th = 33;
            Ui.Place(dlgName.rectTransform, 14, 5, ns.x, 23);
            Ui.Place(dlgTitle.rectTransform, 14 + ns.x + 12, 9, Mathf.Max(0, tw - ns.x - 40), 18);
            Ui.Place(dlgTag.rt, 104, -th * 0.6f, tw, th);
        }

        void DrawChargeCard(bool on)
        {
            Show(chargeCard, on);
            if (!on) return;
            float t = chargeT, total = 6.4f;
            // fades in over .9 s, out over the last 1.2 s; the capitals draw in from .5em to .24em
            chargeGroup.alpha = t < 0.9f ? t / 0.9f : t > total - 1.3f ? Mathf.Clamp01((total - t) / 1.2f) : 1;
            float k = 1 - Mathf.Pow(1 - Mathf.Clamp01(t / 2.2f), 3);
            float h = 22 + 20 + 11 + 10 + 63 + 6 + 26 + 12 + 22;
            Ui.Place(chargeCard, 0, H / 2 - h / 2 + 10 * (1 - Mathf.Clamp01(t / 1.6f)), W, h);
            chargeBand.rectTransform.offsetMin = chargeBand.rectTransform.offsetMax = Vector2.zero;
            float y = 22;
            chargeK.text = "✦ YOUR FATHER’S CHARGE"; chargeK.color = new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.8f * Mathf.Clamp01((t - 0.3f) / 0.8f));
            Ui.Place(chargeK.rectTransform, 0, y, W, 16); y += 21;
            // the thin capitals (weight 300, 60 px: a 42 px cap), the letter spacing closing from .5em to .24em
            float capH = Mathf.Min(42, W * 0.039f);
            Ui.PlaceC(chargeLetters.rectTransform, 0, y, W, 63);
            chargeLetters.Clear();
            StrokeFont.Draw(chargeLetters, "SOMETHING OF VALUE", new Vector2(0, 31.5f - 6 - capH / 2), capH, Mathf.Lerp(0.5f, 0.24f, k) / 0.7f, 2.3f, Ui.Ink);
            y += 63;
            chargePen.Clear();
            Ui.PlaceC(chargePen.rectTransform, W / 2 - 230, y + 6, 460, 26);
            // the pen line drawn under them (stroke-dashoffset over 1.5 s from .7 s), the gold dot after
            float draw = Mathf.Clamp01((t - 0.7f) / 1.5f);
            var pts = new List<Vector2>();
            for (int i = 0; i <= 48; i++) { float u = i / 48f; float x = Mathf.Lerp(-230 * 0.95f, 230 * 0.95f, u); pts.Add(new Vector2(x, 2 * Mathf.Sin(u * 7.1f + 0.4f) - 1.5f * Mathf.Sin(u * 3.0f))); }
            int m = Mathf.Max(2, Mathf.RoundToInt(pts.Count * draw));
            if (draw > 0) chargePen.Path(pts.GetRange(0, m), 2.2f, Ui.Ink);
            float dot = Mathf.Clamp01((t - 2f) / 0.5f);
            if (dot > 0) { float r = 5 * (1 + 0.3f * Mathf.Sin(dot * Mathf.PI)); chargePen.Disc(new Vector2(0, -1), r + 1.4f, Ui.Ink); chargePen.Disc(new Vector2(0, -1), r, Ui.Gold); }
            y += 32 + 12;
            chargeQ.text = "“Bring back something of value.”";
            chargeQ.color = new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, 0.85f * Mathf.Clamp01((t - 1.7f) / 1f));
            Ui.Place(chargeQ.rectTransform, 0, y, W, 22);
        }

        void DrawBoxCard(bool on)
        {
            Show(boxCardPanel, on);
            if (!on) return;
            float w = Mathf.Min(560, W * 0.9f), cw = w - 40, y = 14;
            boxK.text = "    AN ARTIFACT OF THE MAKERS";
            Ui.Place(boxK.rectTransform, 20, y, cw, 16);
            boxStar.Clear();
            // the glyph: three dots over an arch, in the makers' blue
            var blue = Ui.Hex("#25386c");
            Ui.PlaceC(boxStar.rectTransform, 0, 0, w, 200);
            var o = new Vector2(-w / 2, 100);
            Vector2 G(float gx, float gy) => o + new Vector2(20 + gx, -(y + 1 + gy) * 1f);
            boxStar.Disc(G(3.5f, 3.5f), 1.6f, blue); boxStar.Disc(G(9f, 2.2f), 1.6f, blue); boxStar.Disc(G(14.5f, 3.5f), 1.6f, blue);
            var arch = new List<Vector2>(); for (int i = 0; i <= 12; i++) { float u = i / 12f; arch.Add(G(2 + 15 * u, 11 - 6.5f * Mathf.Sin(u * Mathf.PI))); }
            boxStar.Path(arch, 1.6f, blue);
            y += 19;
            boxH.text = "    " + (boxName ?? "");
            var hs = Ui.Measure(boxH, boxH.text, cw);
            Ui.Place(boxH.rectTransform, 20, y, cw, hs.y);
            // the four-pointed star before the name
            var c = o + new Vector2(20 + 9, -(y + 15));
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI / 2;
                var tip = c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * 9;
                var l = c + new Vector2(Mathf.Cos(a + 0.785f), Mathf.Sin(a + 0.785f)) * 2.8f;
                var r = c + new Vector2(Mathf.Cos(a - 0.785f), Mathf.Sin(a - 0.785f)) * 2.8f;
                boxStar.Tri(c, l, tip, blue); boxStar.Tri(c, tip, r, blue);
            }
            y += hs.y + 10;
            boxWhatB.text = "WHAT IT IS"; Ui.Place(boxWhatB.rectTransform, 20, y, cw, 14); y += 15;
            var ws = Ui.Set(boxWhat, boxText ?? "", cw); Ui.Place(boxWhat.rectTransform, 20, y, cw, ws.y); y += ws.y + 8;
            bool does = !string.IsNullOrEmpty(boxUse);
            Show(boxDoesB, does); Show(boxDoes, does);
            if (does)
            {
                boxDoesB.text = "WHAT IT DOES"; Ui.Place(boxDoesB.rectTransform, 20, y, cw, 14); y += 15;
                var ds = Ui.Set(boxDoes, boxUse, cw); Ui.Place(boxDoes.rectTransform, 20, y, cw, ds.y); y += ds.y + 8;
            }
            boxLeft.text = "Left by the makers for one who has come a long way.";
            Ui.Place(boxLeft.rectTransform, 20, y, cw, 16); y += 18 + 10;
            boxGoText.text = "continue";
            Show(boxGo, cardT > 0);
            Ui.Place(boxGo.rt, w - 20 - 92, y, 92, 28); y += 28 + 12;
            float bottom = H * 0.11f + 22;
            float left = W >= 980 ? 28 : W / 2 - w / 2;
            float rise = Mathf.Clamp01((cardT + 0.6f) / 0.45f);
            Ui.Place(boxCardPanel.rt, left, H - bottom - y + 16 * (1 - rise), w, y);
            SetAlpha(boxCardPanel.rt, Mathf.Clamp01((cardT + 0.6f) / 0.35f));
        }

        void DrawSheet(bool on)
        {
            Show(sheetDim, on);
            if (!on) return;
            float w = Mathf.Min(620, W * 0.94f), cw = w - 48, y = 20;
            var ts = Ui.Set(sheetTitle, Ui.Upper(cardTitle ?? ""), cw); Ui.Place(sheetTitle.rectTransform, 24, y, cw, ts.y); y += ts.y + 12;
            var bs = Ui.Set(sheetBody, Ui.Rich(card), cw); Ui.Place(sheetBody.rectTransform, 24, y, cw, bs.y); y += bs.y + 14;
            sheetHint.text = cardT > 0 ? $"{Pad.Key("A / ×", "Enter")} ▸" : "";
            Ui.Place(sheetHint.rectTransform, 24, y, cw, 20); y += 20 + 16;
            Ui.Place(sheet.rt, W / 2 - w / 2, H / 2 - y / 2, w, y);
        }

        void DrawShip(bool on)
        {
            var sh = game.ship;
            bool subOn = on && sh && sh.subtitle != null, hintOn = on && sh && sh.hint != null, skipOn = on && sh && sh.PrologueActive;
            Show(sub, subOn); Show(hint, hintOn); Show(skip, skipOn);
            float bars = sh ? H * 0.11f * sh.bars : 0;
            if (subOn)
            {
                var who = sh.subtitleWho == "ship" ? "SHIP" : sh.subtitleWho == "father" ? "FATHER" : sh.subtitleWho == "mother" ? "MOTHER" : "";
                var col = sh.subtitleWho == "father" ? "#7a3a35" : sh.subtitleWho == "mother" ? "#277e86" : "#c8483a";
                var line = (who.Length > 0 ? $"<color={col}><b>{who}</b></color>  " : "") + sh.subtitle;
                var s = Ui.Set(subText, line, Mathf.Min(820, W - 32) - 24);
                Ui.Place(subText.rectTransform, 12, 5, s.x, s.y);
                float w = s.x + 24, h = s.y + 11;
                Ui.Place(sub.rt, W / 2 - w / 2, H - Mathf.Max(bars, H * 0.11f) - 14 - h, w, h);
            }
            if (hintOn)
            {
                var s = Ui.Set(hintText, sh.hint, W - 64);
                Ui.Place(hintText.rectTransform, 12, 6, s.x, s.y);
                float w = s.x + 24, h = s.y + 12;
                Ui.Place(hint.rt, W / 2 - w / 2, Mathf.Max(bars, H * 0.11f) + 12, w, h);
            }
            if (skipOn)
            {
                var label = $"hold {Pad.Key("Y / △", "ESC")} to skip";
                var s = Ui.Set(skipText, label);
                Ui.Place(skipText.rectTransform, 8, 3, s.x, 16);
                var bar = skipBar.rectTransform.parent.parent as RectTransform;
                Ui.Place(bar, 8 + s.x + 8, 8, 60, 6);
                Ui.Place(skipBar.rectTransform, 0, 0, 58 * Mathf.Clamp01(sh.SkipHeld / 0.9f), 4);
                float w = 8 + s.x + 8 + 60 + 8;
                Ui.Place(skip, W - 22 - w, H - (H * 0.055f - 10) - 22, w, 22);
                SetAlpha(skip, 0.9f);
            }
        }

        void DrawMode(bool on)
        {
            Show(mode, on);
            if (!on) return;
            var tool = game.tool;
            var c = modeKind == "stun" ? "#3d74c4" : modeKind == "fire" ? "#cf4f2c" : "#2b211f";
            var s = Ui.Set(modeText, $"<color={c}>{Ui.Upper(modeName)}</color>");
            Ui.Place(modeText.rectTransform, 7, 1, s.x, 16);
            int max = FluidTool.Max; float ch = tool ? tool.charges : max;
            modePips.Clear();
            float px = 7 + s.x + 7, w = px + max * 11 + 4;
            Ui.PlaceC(modePips.rectTransform, 0, 0, w, 18);
            for (int i = 0; i < max; i++)
            {
                var p = new Vector2(-w / 2 + px + 5 + i * 11, 0);
                bool full = i < Mathf.FloorToInt(ch + 0.001f);
                modePips.Disc(p, 5, Ui.Ink);
                modePips.Disc(p, 3.5f, full ? (tool ? tool.ToneOf(i) : Ui.Glyph) : Ui.Page);
            }
            float t = 1.6f - modeFlash;
            float sc = t < 0.24f ? Mathf.Lerp(1.35f, 1, t / 0.24f) : 1;
            Ui.Place(mode.rt, W / 2 - w / 2, H * 0.3f, w, 18);
            mode.rt.localScale = Vector3.one * sc;
            SetAlpha(mode.rt, t > 1.28f ? Mathf.Clamp01((1.6f - t) / 0.32f) : 1);
        }

        void DrawFps(bool on)
        {
            Show(fps, on);
            fpsAcc += Time.unscaledDeltaTime; fpsN++; fpsT += Time.unscaledDeltaTime;
            if (fpsT > 0.5f) { fpsText.text = $"{fpsN / fpsAcc:0} fps · {1000 * fpsAcc / fpsN:0.0} ms · Unity {Application.unityVersion}"; fpsT = 0; fpsAcc = 0; fpsN = 0; }
            if (!on) return;
            var s = Ui.Measure(fpsText, fpsText.text);
            Ui.Place(fpsText.rectTransform, 7, 3, s.x, s.y);
            Ui.Place(fps.rt, W - 14 - s.x - 14, 14, s.x + 14, s.y + 6);
        }
    }
}
