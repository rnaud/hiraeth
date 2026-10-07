using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// The title screen, light and airy (src/title.js, src/menus.css "the title, light and airy"):
    /// the desert itself at golden hour behind it (the web draws its own vista; here the camera
    /// drifts slowly round Qanat and its smoke), a soft paper light behind the menu and darker
    /// corners, HIRAETH in thin wide capitals with a pen rule and its gold dot, and the menu as
    /// thin spaced capitals over the sky (Continue with a save, New game, Settings, Quit), the
    /// chosen one underlined with a gold dot. ↑ ↓ / the D-pad choose, A / × or Enter picks.
    /// It is an overlay on the desert scene: the world is built under it, the play starts after.
    /// </summary>
    public class TitleScreen : MonoBehaviour
    {
        Game game;
        RectTransform root;
        float t; int sel;
        readonly List<(Label text, Sketch rule)> items = new();
        Label version; Sketch logoRule; RawImage veil, glow;
        PauseMenu settings;
        bool HasSave => Game.useSaves && Save.Exists();
        string[] Items => HasSave ? new[] { "CONTINUE", "NEW GAME", "SETTINGS", "QUIT" } : new[] { "NEW GAME", "SETTINGS", "QUIT" };
        public bool Open => root;
        float hour0;

        /// <summary>The loading page's scene: open the desert with the title over it.</summary>
        public static void Boot() { Game.showTitle = true; SceneManager.LoadScene("Desert"); }

        public void Begin(Game g)
        {
            game = g;
            Settings.Load();
            root = Hud.MakeCanvas(g.cam, "Title", 200);
            root.SetParent(transform, false);
            // the veil: a soft paper light behind the menu column, the corners a touch darker
            veil = Ui.Stretch(Ui.Node("veil", root)).gameObject.AddComponent<RawImage>(); veil.texture = Veil(); veil.raycastTarget = false;
            logoRule = Ui.Node("rule", root).gameObject.AddComponent<Sketch>(); logoRule.raycastTarget = false;
            glow = Ui.Node("menu light", root).gameObject.AddComponent<RawImage>(); glow.texture = Glow(); glow.raycastTarget = false;
            for (int i = 0; i < 4; i++)
            {
                var tx = Ui.Label(root, "item", Ui.Sans, 23, Ui.Ink, TextAnchor.UpperCenter);
                tx.horizontalOverflow = HorizontalWrapMode.Overflow;
                var gl = tx.gameObject.AddComponent<Outline>(); gl.effectColor = new Color(1, 0.98f, 0.94f, 0.55f); gl.effectDistance = new Vector2(1.5f, -1.5f);
                var rule = Ui.Node("underline", root).gameObject.AddComponent<Sketch>(); rule.raycastTarget = false;
                items.Add((tx, rule));
            }
            version = Ui.Label(root, "version", Ui.Mono, 11, Ui.Hex("#2b211f", 0.75f), TextAnchor.LowerRight);
            settings = new PauseMenu(g, root, true) { onClose = () => { } };
            // golden hour: the low warm light the web's vista keeps all day (title-vista.js HOUR ≈ 17.2)
            if (g.look) { hour0 = g.look.hour; g.look.hour = 17.2f; }
            Sounds.Create(g.cam.gameObject);
            Place(0);
        }

        static Texture2D Veil()
        {
            const int n = 96;
            var tx = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x + 0.5f) / n - 0.5f, v = (y + 0.5f) / n - 0.5f;
                    // radial-gradient(ellipse 46% 62% at 50% 56%, paper .34 → 0 at 70%), corners darker
                    float d1 = new Vector2(u / 0.46f, (v + 0.06f) / 0.62f).magnitude;
                    float light = 0.34f * Mathf.Clamp01(1 - d1 / 0.7f);
                    float d2 = new Vector2(u / 1.2f, (v - 0.05f) / 1.1f).magnitude * 2;
                    float dark = 0.22f * Mathf.Clamp01((d2 - 0.62f) / 0.38f);
                    var c = Color.Lerp(new Color(0.984f, 0.957f, 0.886f, light), new Color(0.17f, 0.13f, 0.12f, dark), dark / Mathf.Max(0.001f, dark + light));
                    c.a = Mathf.Max(light, dark);
                    tx.SetPixel(x, y, c);
                }
            tx.Apply();
            return tx;
        }
        static Texture2D Glow()
        {
            const int n = 64;
            var tx = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float d = new Vector2((x + 0.5f) / n - 0.5f, (y + 0.5f) / n - 0.5f).magnitude * 2;   // closest-side
                    float a = d < 0.65f ? Mathf.Lerp(0.7f, 0.4f, d / 0.65f) : Mathf.Lerp(0.4f, 0, (d - 0.65f) / 0.35f);
                    tx.SetPixel(x, y, new Color(1, 0.98f, 0.94f, Mathf.Clamp01(a)));
                }
            tx.Apply();
            return tx;
        }

        void Update()
        {
            if (!root) return;
            float dt = Time.unscaledDeltaTime; t += dt;
            // the camera drifts round the city, high over the dunes, the smoke in the frame
            var c = game.world.Places.V3("cityCenter");
            float a = 2.35f + t * 0.012f;
            var eye = c + new Vector3(Mathf.Cos(a) * 330, 70 + 8 * Mathf.Sin(t * 0.05f), Mathf.Sin(a) * 330);
            eye.y = Mathf.Max(eye.y, game.world.Ground.HeightAt(eye.x, eye.z) + 30);
            game.cam.transform.position = eye;
            game.cam.transform.rotation = Quaternion.LookRotation(c + new Vector3(0, 46, 0) - eye, Vector3.up);
            game.cam.fieldOfView = 55;
            if (game.look) game.look.Apply();
            if (settings.open) { settings.Update(dt); return; }
            int n = Pad.NavDown();
            if (n != 0) { sel = Mathf.Clamp(sel + n, 0, Items.Length - 1); Sounds.Instance?.Play("tick"); }
            if (t > 0.4f && Pad.ConfirmDown()) Pick(Items[sel]);
        }

        public void Pick(string what)
        {
            switch (what)
            {
                case "CONTINUE": Leave(); break;
                case "NEW GAME": if (Game.useSaves) Save.Erase(); Leave(); break;
                case "SETTINGS": settings.Open(); break;
                case "QUIT":
#if UNITY_EDITOR
                    UnityEditor.EditorApplication.isPlaying = false;
#else
                    Application.Quit();
#endif
                    break;
            }
        }
        void Leave()
        {
            Sounds.Instance?.Play("page");
            if (game.look) game.look.hour = hour0;
            Destroy(root.gameObject); root = null;
            Game.showTitle = false;
            game.BeginPlay();
            Destroy(this);
        }

        void LateUpdate() { if (root) Place(t); }

        void Place(float time)
        {
            float W = root.rect.width, H = root.rect.height;
            settings.Draw(settings.open);
            bool show = !settings.open;
            logoRule.gameObject.SetActive(show); glow.gameObject.SetActive(show); version.gameObject.SetActive(show);
            if (!show) { foreach (var (tx, r) in items) { tx.gameObject.SetActive(false); r.gameObject.SetActive(false); } return; }
            // the name: thin wide capitals near the top (title.js LOGO: weight 200, a soft paper glow), a pen rule and its gold dot
            float cap = Mathf.Min(H * 0.104f, W * 0.06f);
            float top0 = H * 0.1f;
            Ui.PlaceC(logoRule.rectTransform, 0, top0, W, cap + 50);
            logoRule.Clear();
            var mid = new Vector2(0, (cap + 50) / 2 - cap / 2);
            StrokeFont.Draw(logoRule, "HIRAETH", mid, cap, 0.36f, cap * 0.075f, new Color(1, 0.98f, 0.94f, 0.18f));
            StrokeFont.Draw(logoRule, "HIRAETH", mid, cap, 0.36f, cap * 0.028f, Ui.Paper);
            float ry = mid.y - cap / 2 - 21;
            logoRule.Line(new Vector2(-113, ry), new Vector2(113, ry), 1.2f, new Color(1, 0.98f, 0.94f, 0.95f));
            logoRule.Disc(new Vector2(0, ry), 2.4f, Ui.Hex("#8a6a2a")); logoRule.Disc(new Vector2(0, ry), 1.7f, Ui.Gold);
            // the menu: a column of thin spaced capitals, centred, over a soft paper light
            var it = Items;
            float size = Mathf.Clamp(H * 0.026f, 16, 23), gap = Mathf.Clamp(H * 0.016f, 6, 14), step = size * 1.2f + 2 * Mathf.Clamp(H * 0.01f, 4, 10) + gap;
            float top = H * 0.44f;
            Ui.PlaceC(glow.rectTransform, W / 2 - 260, top - 50, 520, step * it.Length + 100);
            for (int i = 0; i < items.Count; i++)
            {
                var (tx, rule) = items[i];
                bool has = i < it.Length;
                tx.gameObject.SetActive(has); rule.gameObject.SetActive(has);
                if (!has) continue;
                bool f = i == sel;
                tx.fontSize = Mathf.RoundToInt(size);
                tx.text = it[i];
                Ui.Space(tx, f ? 0.48f : 0.42f);
                tx.color = new Color(Ui.Ink.r, Ui.Ink.g, Ui.Ink.b, f ? 1 : 0.9f);
                float y = top + i * step;
                Ui.Place(tx.rectTransform, 0, y, W, size * 1.5f);
                rule.Clear();
                if (f)
                {
                    float w = Ui.Measure(tx, it[i]).x * 0.6f;
                    Ui.PlaceC(rule.rectTransform, W / 2 - 150, y + size * 1.3f + 3, 300, 12);
                    rule.Line(new Vector2(-w / 2, 3), new Vector2(w / 2, 3), 1.2f, Ui.Ink);
                    rule.Disc(new Vector2(0, -2), 2.5f, Ui.Gold);
                }
            }
            version.text = $"Unity port · {Application.version}";
            var vs = Ui.Measure(version, version.text);
            Ui.Place(version.rectTransform, W - 12 - vs.x - 12, H - 8 - vs.y - 2, vs.x + 12, vs.y + 2);
        }
    }
}
