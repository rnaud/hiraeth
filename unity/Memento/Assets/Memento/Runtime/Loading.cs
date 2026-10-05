using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>The Title scene: "sketching the world…" while the desert loads (index.html #loading: the pen turning in its rings), then the desert with its title.</summary>
    public class Loading : MonoBehaviour
    {
        float t; Label msg; Sketch pen; RectTransform root;
        void Start()
        {
            var cam = new GameObject("Camera").AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = Ui.Page;
            root = Hud.MakeCanvas(cam, "Loading", 0);
            Ui.Fill(root, Ui.Page, 0, "paper");
            pen = Ui.Node("pen", root).gameObject.AddComponent<Sketch>(); pen.raycastTarget = false;
            msg = Ui.Label(root, "msg", Ui.Mono, 14, Ui.Ink, TextAnchor.UpperCenter); msg.text = "sketching the world…";
        }
        void Update()
        {
            t += Time.unscaledDeltaTime;
            float W = root.rect.width, H = root.rect.height;
            Ui.PlaceC(pen.rectTransform, W / 2 - 48, H / 2 - 66, 96, 96);
            pen.Clear();
            pen.transform.localRotation = Quaternion.Euler(0, 0, -t * 150);
            pen.Ring(Vector2.zero, 35, 2.2f * 0.8f, Ui.Ink, 14, 7);
            pen.Ring(Vector2.zero, 24, 2.2f * 0.8f, Ui.Hex("#2b211f", 0.6f), 3, 5.5f);
            var nib = new[] { new Vector2(0, 37), new Vector2(5, 21), new Vector2(0, 16), new Vector2(-5, 21) };
            pen.Quad(nib[0], nib[1], nib[2], nib[3], Ui.Red);
            pen.Path(nib, 1.6f, Ui.Ink, true);
            Ui.Place(msg.rectTransform, 0, H / 2 + 46, W, 20);
            // (a few frames drawn first, so the page shows while the desert loads)
            if (t > 0.25f && Time.frameCount > 3) { enabled = false; TitleScreen.Boot(); }
        }
    }
}
