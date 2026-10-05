using UnityEngine;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The page between two worlds (index.html #loading, main.js stage()): "sketching the city-shaft…"
    /// on the paper, the pen turning in its rings, over everything while the old world is let go and
    /// the next one built from its export.
    /// </summary>
    public class LoadingPage : MonoBehaviour
    {
        RectTransform root; Label msg, title; Sketch pen, streaks; float t;
        /// <summary>The jump (cinema.js Warp): the stars rushing past on the paper, the world's name over them.</summary>
        public string warp; float warpT;
        struct Streak { public float a, r, v, w, c; }
        Streak[] st;

        public static LoadingPage Make(Camera cam, Transform parent)
        {
            var go = new GameObject("Loading page");
            go.transform.SetParent(parent, false);
            var lp = go.AddComponent<LoadingPage>();
            lp.root = Hud.MakeCanvas(cam, "Loading page canvas", 400);
            lp.root.SetParent(go.transform, false);
            Ui.Fill(lp.root, Ui.Page, 0, "paper");
            lp.pen = Ui.Node("pen", lp.root).gameObject.AddComponent<Sketch>(); lp.pen.raycastTarget = false;
            lp.msg = Ui.Label(lp.root, "msg", Ui.Mono, 14, Ui.Ink, TextAnchor.UpperCenter);
            lp.streaks = Ui.Node("streaks", lp.root).gameObject.AddComponent<Sketch>(); lp.streaks.raycastTarget = false;
            lp.title = Ui.Label(lp.root, "title", Ui.Heavy, 44, Ui.Ink, TextAnchor.MiddleCenter);
            lp.st = new Streak[220];
            for (int i = 0; i < lp.st.Length; i++) lp.st[i] = new Streak { a = Random.value * Mathf.PI * 2, r = Random.value, v = 0.4f + Random.value, w = 1 + Random.value * 2.5f, c = Random.value };
            go.SetActive(false);
            return lp;
        }

        public void Show(string text)
        {
            warp = null;
            gameObject.SetActive(text != null);
            if (text == null) return;
            msg.text = text;
            Draw();
            Canvas.ForceUpdateCanvases();
        }
        public bool Shown => gameObject.activeSelf;
        public void ShowWarp(string name)
        {
            if (name == null) { if (warp != null) { warp = null; gameObject.SetActive(false); } return; }
            if (warp == null) warpT = 0;
            warp = name; gameObject.SetActive(true);
            Draw();
        }

        void Update() { t += Time.unscaledDeltaTime; warpT += Time.unscaledDeltaTime; Draw(); }

        void Draw()
        {
            float W = root.rect.width, H = root.rect.height;
            bool w = warp != null;
            pen.gameObject.SetActive(!w); msg.gameObject.SetActive(!w); streaks.gameObject.SetActive(w); title.gameObject.SetActive(w);
            if (w)
            {
                // the streaks fly out from the middle, faster and longer as the jump builds (cinema.js Warp.update)
                Ui.PlaceC(streaks.rectTransform, 0, 0, W, H);
                streaks.Clear();
                float R = Mathf.Sqrt(W * W + H * H) / 2, k = Mathf.Min(1, warpT / 1.2f), dt = Time.unscaledDeltaTime;
                for (int i = 0; i < st.Length; i++)
                {
                    var s = st[i];
                    s.r = (s.r + dt * s.v * (0.3f + 1.6f * k)) % 1; st[i] = s;
                    float r0 = s.r * s.r * R, r1 = r0 + (30 + 260 * k) * s.r;
                    var col = s.c < 0.12f ? Ui.Hex("#c8483a") : s.c < 0.22f ? Ui.Hex("#277e86") : Ui.Ink;
                    var d = new Vector2(Mathf.Cos(s.a), Mathf.Sin(s.a));
                    streaks.Path(new[] { d * r0, d * r1 }, s.w * (0.4f + s.r), col, false);
                }
                title.text = warp.ToUpperInvariant();
                Ui.Place(title.rectTransform, 0, H / 2 - 40, W, 80);
                return;
            }
            Ui.PlaceC(pen.rectTransform, W / 2 - 48, H / 2 - 66, 96, 96);
            pen.Clear();
            pen.transform.localRotation = Quaternion.Euler(0, 0, -t * 150);
            pen.Ring(Vector2.zero, 35, 2.2f * 0.8f, Ui.Ink, 14, 7);
            pen.Ring(Vector2.zero, 24, 2.2f * 0.8f, Ui.Hex("#2b211f", 0.6f), 3, 5.5f);
            var nib = new[] { new Vector2(0, 37), new Vector2(5, 21), new Vector2(0, 16), new Vector2(-5, 21) };
            pen.Quad(nib[0], nib[1], nib[2], nib[3], Ui.Red);
            pen.Path(nib, 1.6f, Ui.Ink, true);
            Ui.Place(msg.rectTransform, 0, H / 2 + 46, W, 20);
        }
    }
}
