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
    public partial class BridgeHud
    {
        static readonly Color LoadPaper = Ui.Hex("#f7ecd2"), LoadInk = Ui.Hex("#2b211f"), LoadNib = Ui.Hex("#c8483a");
        const float LoadFade = 0.8f;   // (the page's transition: opacity 0.8s)
        RectTransform loadRoot; Sketch loadPen; Label loadMsg;
        float loadT, loadA = 1; bool loadDone;

        void BuildLoading()
        {
            loadRoot = Ui.Node("loading", root);
            Ui.Stretch(loadRoot);
            Ui.Fill(loadRoot, LoadPaper, 0, "paper");
            loadPen = Ui.Node("pen", loadRoot).gameObject.AddComponent<Sketch>();
            loadPen.raycastTarget = false;
            loadMsg = Ui.Label(loadRoot, "msg", Ui.Sans, 15, LoadInk, TextAnchor.UpperCenter);
            BridgeHost.LoadLine = null;   // (the last boot's line gone: this one's stages come as it builds)
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
            bool building = r && !r.Booted;
            var line = BridgeHost.LoadLine;
            // (-loading-shot <file>: a picture once the build says it is waking the people, for the side-by-sides)
            if (loadShot != null && !loadShotTaken && building && line != null && line.StartsWith("waking"))
            {
                loadShotTaken = true;
                if (!loadDone) DrawPen(line);
                Canvas.ForceUpdateCanvases(); r.Shot(loadShot);
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
            // the pen: 96 px a side at the middle, turning once in 2.4 s (the page's .pen and its spin), the line 18 px under it
            float s = 96 / 120f;
            Ui.PlaceC(loadPen.rectTransform, W / 2 - 48, H / 2 - 66, 96, 96);
            loadPen.Clear();
            loadPen.transform.localRotation = Quaternion.Euler(0, 0, -loadT * 150);
            loadPen.Ring(Vector2.zero, 35, 1.8f, LoadInk, 14, 7);   // (whole units: Sketch.Path's dashes step by them)
            loadPen.Ring(Vector2.zero, 24, 1.8f, new Color(LoadInk.r, LoadInk.g, LoadInk.b, 0.6f), 3, 6);
            var nib = new[] { new Vector2(0, 46) * s, new Vector2(6, 26) * s, new Vector2(0, 20) * s, new Vector2(-6, 26) * s };
            loadPen.Quad(nib[0], nib[1], nib[2], nib[3], LoadNib);
            loadPen.Path(nib, 2 * s, LoadInk, true);
            if (!string.IsNullOrEmpty(line) && loadMsg.text != line) loadMsg.text = line;
            Ui.Place(loadMsg.rectTransform, 0, H / 2 + 48, W, 24);
        }
        static readonly string loadShot = BridgeArgs.Arg("-loading-shot");
        static readonly bool noLoading = BridgeArgs.Flag("-no-loading");
        bool loadShotTaken;
    }
}
