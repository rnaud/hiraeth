using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the loading screen (issue #424)
    // The page's #loading (index.html): the paper over everything, the pen turning in its two dashed rings, its red nib,
    // and the line under it that says what the build is on ("sketching the golden dunes…", "inking the collisions…",
    // "waking the people…", "mixing the inks…": main.js's stages, engine/game.js onStage → BridgeHost.LoadStage). Up from
    // the HUD's first frame until the script has built the world (BridgeRunner.Booted), then faded out as the page's
    // `.done` does. A flight's arrival keeps the warp's ink instead (the page's #loading.space): the warp is carried over
    // the reboot and drawn whole, so the paper stays away.
    // Under the line, as the page's .bar and .why (src/load-page.js, issue #506; here issue #527): an inked rule filled with
    // the nib's red as far as the load has come (engine/game.js onLoad → BridgeHost.LoadProgress, never back), easing there
    // as the page's 0.4 s transition, and a smaller, fainter line saying why this part takes the time.
    public partial class BridgeHud
    {
        static readonly Color LoadPaper = Ui.Hex("#f7ecd2"), LoadInk = Ui.Hex("#2b211f"), LoadNib = Ui.Hex("#c8483a");
        const float LoadFade = 0.8f;   // (the page's transition: opacity 0.8s)
        RectTransform loadRoot, loadBar; Sketch loadPen; Label loadMsg, loadWhy; Image loadBarFill;
        float loadT, loadA = 1, loadShown; bool loadDone, loadWorld;
        // the page's .bar: 180 px inside a 1.6 px ink border (10 px high, 183 wide outside), radius 4; .why at 0.85 em, 0.72 opaque
        const float BarW = 183, BarH = 10, BarB = 1.6f, BarEase = 0.13f;

        void BuildLoading()
        {
            loadRoot = Ui.Node("loading", root);
            Ui.Stretch(loadRoot);
            Ui.Fill(loadRoot, LoadPaper, 0, "paper");
            loadPen = Ui.Node("pen", loadRoot).gameObject.AddComponent<Sketch>();
            loadPen.raycastTarget = false;
            loadMsg = Ui.Label(loadRoot, "msg", Ui.Sans, 15, LoadInk, TextAnchor.UpperCenter);
            // the bar: its red fill under its ink frame
            loadBar = Ui.Node("bar", loadRoot);
            loadBarFill = Ui.Rect(loadBar, LoadNib, 2, "fill");
            var frame = Ui.Fill(loadBar, LoadInk, 0, "frame");
            frame.sprite = Ui.Frame(BarB, 4); frame.type = Image.Type.Sliced; frame.pixelsPerUnitMultiplier = 2;
            // (the page's opacity 0.72 as the colour it makes on the paper: a 0.72 alpha blends lighter on the linear page)
            loadWhy = Ui.Label(loadRoot, "why", Ui.Sans, 13, Color.Lerp(LoadPaper, LoadInk, 0.72f), TextAnchor.UpperCenter);
            loadWhy.horizontalOverflow = HorizontalWrapMode.Wrap; loadWhy.text = "";
            BridgeHost.LoadLine = null;   // (the last boot's line gone: this one's stages come as it builds)
            BridgeHost.LoadReset(); loadShown = 0;   // (and its bar and why line)
            // (over the menus too, the title among them: their canvas is drawn over the HUD's; issue #510)
            var over = loadRoot.gameObject.AddComponent<Canvas>(); over.overrideSorting = true; over.sortingOrder = 300;
            loadMsg.text = "sketching the world…";
            // (a flight's reboot: the warp is the loading screen; a run that photographs the picture alone: none)
            // (-no-loading: none, as before issue #424, its -loading-shot still taken: the "before" of the side-by-sides)
            loadDone = warpCarry != null || noHud || noLoading;
            loadA = loadDone ? 0 : 1;
            loadRoot.gameObject.SetActive(!loadDone);
        }

        void DrawLoading()
        {
            var r = BridgeHost.Runner;
            bool world = BridgeHost.WorldLoading, building = (r && !r.Booted) || world;
            // a world chosen on the title, built after the title's own frames (issue #510): the paper up again at once over the
            // title, as the page's fresh #loading after its title has gone, its line from the start
            // (whole even while the boot's own still fades off the title)
            if (world && !loadWorld)
            {
                loadWorld = true;
                if (!noLoading && !noHud && warpCarry == null)
                {
                    if (loadDone) { BridgeHost.LoadLine = null; loadMsg.text = "sketching the world…"; loadWhy.text = ""; loadShown = 0; loadT = 0; }
                    loadDone = false; loadA = 1;
                    loadRoot.gameObject.SetActive(true);
                }
            }
            else if (!world) loadWorld = false;
            var line = BridgeHost.LoadLine;
            // (-loading-shot <file>: a picture once the build says it is waking the people, for the side-by-sides; with
            // -loading-shot-at inking,waking,mixing: one as each of those stages begins, <file>-<stage>.png, the bar shown where
            // it is going rather than on its way)
            if (loadShot != null && building && line != null)
                for (int i = 0; i < loadShotAt.Length; i++)
                {
                    if ((loadShotTaken & (1 << i)) != 0 || !line.StartsWith(loadShotAt[i])) continue;
                    loadShotTaken |= 1 << i;
                    if (!loadDone) { loadShown = BridgeHost.LoadP; DrawPen(line); }
                    Canvas.ForceUpdateCanvases();
                    r.Shot(loadShotAt.Length == 1 && !loadShotEach ? loadShot : System.IO.Path.ChangeExtension(loadShot, null) + "-" + loadShotAt[i] + System.IO.Path.GetExtension(loadShot));
                }
            if (loadDone) return;
            float dt = Time.unscaledDeltaTime;
            loadT += dt;
            if (!building) loadA = Mathf.MoveTowards(loadA, 0, dt / LoadFade);
            if (loadA <= 0) { loadDone = true; loadRoot.gameObject.SetActive(false); return; }
            loadRoot.SetAsLastSibling();
            Ui.Group(loadRoot).alpha = loadA;
            DrawPen(line);
        }

        void DrawPen(string line)
        {
            // the pen: 96 px a side, turning once in 2.4 s (the page's .pen and its spin), the line 18 px under it; the pen,
            // the line, the bar and the why line centred together, as the page's grid
            float s = 96 / 120f;
            Ui.PlaceC(loadPen.rectTransform, W / 2 - 48, H / 2 - 90, 96, 96);
            loadPen.Clear();
            loadPen.transform.localRotation = Quaternion.Euler(0, 0, -loadT * 150);
            loadPen.Ring(Vector2.zero, 35, 1.8f, LoadInk, 14, 7);   // (whole units: Sketch.Path's dashes step by them)
            loadPen.Ring(Vector2.zero, 24, 1.8f, new Color(LoadInk.r, LoadInk.g, LoadInk.b, 0.6f), 3, 6);
            var nib = new[] { new Vector2(0, 46) * s, new Vector2(6, 26) * s, new Vector2(0, 20) * s, new Vector2(-6, 26) * s };
            loadPen.Quad(nib[0], nib[1], nib[2], nib[3], LoadNib);
            loadPen.Path(nib, 2 * s, LoadInk, true);
            if (!string.IsNullOrEmpty(line) && loadMsg.text != line) loadMsg.text = line;
            Ui.Place(loadMsg.rectTransform, 0, H / 2 + 23, W, 24);
            // the bar 12 px under the line, the why line 10 px under the bar (the page's 18 px gaps less their margins)
            float p = Mathf.Clamp01(BridgeHost.LoadP);
            loadShown = Mathf.Min(p, Mathf.Lerp(loadShown, p, 1 - Mathf.Exp(-Time.unscaledDeltaTime / BarEase)) + 0.0005f);
            Ui.Place(loadBar, W / 2 - BarW / 2, H / 2 + 54, BarW, BarH);
            // (the fill reaches in under the frame's stroke, as the page's clipped to the border's inside: no paper between)
            float inset = BarB - 0.6f, fw = (BarW - 2 * inset) * loadShown;
            loadBarFill.enabled = fw >= 1;
            Ui.Place(loadBarFill.rectTransform, inset, inset, fw, BarH - 2 * inset);
            var why = BridgeHost.LoadWhy ?? "";
            if (loadWhy.text != why) loadWhy.text = why;
            float ww = Mathf.Min(390, W * 0.86f);
            Ui.Place(loadWhy.rectTransform, W / 2 - ww / 2, H / 2 + 74, ww, 40);
        }
        static readonly string loadShot = BridgeArgs.Arg("-loading-shot");
        // (-loading-shot-at: the stages' first words to photograph, comma separated; "waking" alone without it)
        static readonly bool loadShotEach = BridgeArgs.Arg("-loading-shot-at") != null;
        static readonly string[] loadShotAt = (BridgeArgs.Arg("-loading-shot-at") ?? "waking").Split(',', System.StringSplitOptions.RemoveEmptyEntries);
        static readonly bool noLoading = BridgeArgs.Flag("-no-loading");
        int loadShotTaken;
    }
}
