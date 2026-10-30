using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the loading screen (issues #424, #791)
    // The page's #loading (index.html): black over everything, and in the bottom-right corner only a small turning
    // circle, the word "Loading" and a thin bar under it (issue #791; before, the paper with the pen and the stage's
    // line). Up from the HUD's first frame until the script has built the world (BridgeRunner.Booted), then faded out as
    // the page's `.done` does. A flight's arrival keeps the warp's ink instead (the page's #loading.space): the warp is
    // carried over the reboot and drawn whole, so this screen stays away.
    // The bar, as the page's .bar (src/load-page.js, issue #506; here issue #527): filled as far as the load has come
    // (engine/game.js onLoad -> BridgeHost.LoadProgress, never back), easing there as the page's 0.4 s transition. The
    // stage lines (BridgeHost.LoadLine) and the why lines (LoadWhy) still come, for the shots below, but are not shown.
    // Reduced motion (the settings' `still`, engine/unity/game.js access): the circle pulses instead of turning.
    public partial class BridgeHud
    {
        static readonly Color LoadBlack = Color.black, LoadLight = Ui.Hex("#e9e4d8");
        const float LoadFade = 0.8f;   // (the page's transition: opacity 0.8s)
        const float LoadCorner = 0.78f;   // (the page's .corner opacity)
        RectTransform loadRoot, loadBar; Sketch loadPen; Label loadMsg; Image loadBarFill;
        float loadT, loadA = 1, loadShown; bool loadDone, loadWorld;
        // the page's .corner: 28 px from the right, 24 from the bottom; the circle 14 px, 10 px left of the words' column;
        // the word in capitals, the bar 96 x 2 px 5 px under it, right-aligned with it
        const float BarW = 96, BarH = 2, BarEase = 0.13f, PenS = 14, CornerR = 28, CornerB = 24;
        /// <summary>The one word it says (the page's "Loading", text-transform: uppercase; issue #791).</summary>
        public const string LoadWord = "LOADING";

        void BuildLoading()
        {
            loadRoot = Ui.Node("loading", root);
            Ui.Stretch(loadRoot);
            Ui.Fill(loadRoot, LoadBlack, 0, "black");
            var corner = new Color(LoadLight.r, LoadLight.g, LoadLight.b, LoadCorner);
            loadPen = Ui.Node("pen", loadRoot).gameObject.AddComponent<Sketch>();
            loadPen.raycastTarget = false;
            loadMsg = Ui.Label(loadRoot, "msg", Ui.Sans, 11, corner, TextAnchor.LowerRight);
            loadMsg.text = LoadWord;
            // the bar: its light fill over a faint track
            loadBar = Ui.Node("bar", loadRoot);
            Ui.Fill(loadBar, new Color(LoadLight.r, LoadLight.g, LoadLight.b, 0.18f * LoadCorner), 0, "track");
            loadBarFill = Ui.Rect(loadBar, corner, 0, "fill");
            BridgeHost.LoadLine = null;   // (the last boot's line gone: this one's stages come as it builds)
            BridgeHost.LoadReset(); loadShown = 0;   // (and its bar)
            // (over the menus too, the title among them: their canvas is drawn over the HUD's; issue #510)
            var over = loadRoot.gameObject.AddComponent<Canvas>(); over.overrideSorting = true; over.sortingOrder = 300;
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
            // a world chosen on the title, built after the title's own frames (issue #510): the black up again at once over
            // the title, as the page's fresh #loading after its title has gone
            // (whole even while the boot's own still fades off the title)
            if (world && !loadWorld)
            {
                loadWorld = true;
                if (!noLoading && !noHud && warpCarry == null)
                {
                    if (loadDone) { BridgeHost.LoadLine = null; loadShown = 0; loadT = 0; }
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
                    if (!loadDone) { loadShown = BridgeHost.LoadP; DrawPen(); }
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
            DrawPen();
        }

        void DrawPen()
        {
            // the words' column right-aligned in the corner: the word, the bar 5 px under it; the circle 10 px left of the
            // bar, centred on the column (the page's flex row, align-items: center)
            float colR = W - CornerR, colB = H - CornerB;
            float barY = colB - BarH, msgH = 12, msgY = barY - 5 - msgH;
            Ui.Place(loadMsg.rectTransform, colR - 200, msgY - 2, 200, msgH + 2);
            if (loadMsg.text != LoadWord) loadMsg.text = LoadWord;
            Ui.Place(loadBar, colR - BarW, barY, BarW, BarH);
            float p = Mathf.Clamp01(BridgeHost.LoadP);
            loadShown = Mathf.Min(p, Mathf.Lerp(loadShown, p, 1 - Mathf.Exp(-Time.unscaledDeltaTime / BarEase)) + 0.0005f);
            float fw = BarW * loadShown;
            loadBarFill.enabled = fw >= 0.5f;
            Ui.Place(loadBarFill.rectTransform, 0, 0, fw, BarH);
            // the circle: 14 px, a 2 px ring with a quarter open (the page's border-right transparent), once a second;
            // reduced motion: whole, its light breathing over 1.6 s instead
            float cy = (msgY + colB) / 2, cx = colR - BarW - 10 - PenS / 2;
            Ui.PlaceC(loadPen.rectTransform, cx - PenS / 2, cy - PenS / 2, PenS, PenS);
            loadPen.Clear();
            var c = new Color(LoadLight.r, LoadLight.g, LoadLight.b, LoadCorner);
            float rr = PenS / 2 - 1;
            if (still)
            {
                loadPen.transform.localRotation = Quaternion.identity;
                float k = 0.5f - 0.5f * Mathf.Cos(loadT * Mathf.PI / 1.6f);
                c.a *= Mathf.Lerp(0.25f, 1, k);
                loadPen.Ring(Vector2.zero, rr, 2, c);
            }
            else
            {
                loadPen.transform.localRotation = Quaternion.Euler(0, 0, -loadT * 360);
                var arc = new System.Collections.Generic.List<Vector2>();
                for (int i = 0; i <= 24; i++) { float a = Mathf.PI * (0.25f + 1.5f * i / 24f); arc.Add(new Vector2(-Mathf.Sin(a), Mathf.Cos(a)) * rr); }
                loadPen.Path(arc, 2, c);
            }
        }
        static readonly string loadShot = BridgeArgs.Arg("-loading-shot");
        // (-loading-shot-at: the stages' first words to photograph, comma separated; "waking" alone without it)
        static readonly bool loadShotEach = BridgeArgs.Arg("-loading-shot-at") != null;
        static readonly string[] loadShotAt = (BridgeArgs.Arg("-loading-shot-at") ?? "waking").Split(',', System.StringSplitOptions.RemoveEmptyEntries);
        static readonly bool noLoading = BridgeArgs.Flag("-no-loading");
        int loadShotTaken;
    }
}
