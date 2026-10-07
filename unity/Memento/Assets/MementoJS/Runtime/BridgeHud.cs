using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento.Bridge
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
        RectTransform wheel; Image wheelRing, wheelFill;
        RectTransform dlg; Ui.Box dlgPanel; Sketch dlgLines, dlgMore; RectTransform chip; Image chipFill; Label chipLetter; RawImage chipPhoto;
        Ui.Box dlgTag; Label dlgName, dlgTitle, dlgText;
        readonly List<(Ui.Box box, Label num, Label text)> dlgChoices = new();

        public void Set(string json) { state = Json.Parse(json) as Dictionary<string, object> ?? new(); }

        /// <summary>The letters the game writes, put in the fonts' textures at once (a dynamic font adding them one by one
        /// rebuilt its texture under labels already drawn: letters dropped out of a frame).</summary>
        static void Warm(Font f)
        {
            const string chars = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~’‘“”…—–·▍›◆✦éèàçôûâêîïüöäñ";
            foreach (var size in new[] { 11, 12, 13, 14, 15, 19, 36 })
                foreach (var st in new[] { FontStyle.Normal, FontStyle.Bold, FontStyle.Italic })
                    f.RequestCharactersInTexture(chars, size, st);
        }

        void Start()
        {
            Warm(Ui.Mono);
            root = Hud.MakeCanvas(cam, "HUD (JS bridge)", 100);
            root.SetParent(transform, false);
            var mono = Ui.Mono;
            toast = Ui.Panel(root, "toast", Ui.Paper, Ui.Ink, 2, 4, 4);
            toastText = Ui.Label(toast.rt, "text", mono, 13, Ui.Ink, TextAnchor.UpperCenter);
            cue = Ui.Panel(root, "cue", Ui.Hex("#fff6dc", 0.92f), Ui.Ink, 1.5f, 2, 2);
            cueText = Ui.Label(cue.rt, "text", mono, 13, Ui.Ink, TextAnchor.MiddleCenter);
            prompt = Ui.Panel(root, "prompt", Ui.Paper, Ui.Ink, 1.5f, 2, 2, 12);
            promptKey = Ui.Rect(prompt.rt, Ui.Ink, 11, "key");
            promptKeyText = Ui.Label(promptKey.rectTransform, "k", mono, 11, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(promptKeyText.rectTransform);
            promptText = Ui.Label(prompt.rt, "text", mono, 12, Ui.Ink, TextAnchor.MiddleLeft);
            health = Ui.Panel(root, "health", Ui.Page, Ui.Ink, 2, 2, 2, 6);
            healthFill = Ui.Rect(health.fill.rectTransform, Ui.Hp, 0, "hp");
            healthEdge = Ui.Rect(health.fill.rectTransform, Ui.Ink, 0, "edge");
            wheel = Ui.Node("stamina", root);
            wheelRing = Ui.Fill(wheel, Ui.Hex("#2b211f", 0.25f), 0, "ring"); wheelRing.sprite = Ui.Round(32);
            wheelFill = Ui.Fill(wheel, Ui.Gold, 0, "fill"); wheelFill.sprite = Ui.Round(32);
            wheelFill.type = Image.Type.Filled; wheelFill.fillMethod = Image.FillMethod.Radial360; wheelFill.fillOrigin = (int)Image.Origin360.Top; wheelFill.fillClockwise = false;
            Ui.Stretch(wheelFill.rectTransform, 3, 3, 3, 3);
            BuildDialogue(mono);
        }

        void BuildDialogue(Font mono)
        {
            // (Hud.cs BuildDialogue: the notebook panel, the portrait chip, the name tag across its top edge)
            dlg = Ui.Node("dialogue", root);
            dlgPanel = Ui.Panel(dlg, "panel", Ui.Paper, Ui.Ink, 2.5f, 6, 6);
            Ui.Stretch(dlgPanel.rt);
            dlgLines = Ui.Stretch(Ui.Node("lines", dlgPanel.fill.rectTransform)).gameObject.AddComponent<Sketch>(); dlgLines.raycastTarget = false; dlgLines.feather = 0.5f;
            dlgText = Ui.Label(dlgPanel.rt, "text", mono, 15, Ui.Ink, lineSpacing: 1.3f);
            for (int i = 0; i < 3; i++)
            {
                var b = Ui.Panel(dlgPanel.rt, "choice" + i, Ui.Choice, Ui.Ink, 1.5f, 2, 2);
                dlgChoices.Add((b, Ui.Label(b.rt, "n", mono, 14, Ui.Red, TextAnchor.UpperLeft, FontStyle.Bold), Ui.Label(b.rt, "t", mono, 14, Ui.Ink, lineSpacing: 1.3f)));
            }
            dlgMore = Ui.Node("more", dlgPanel.rt).gameObject.AddComponent<Sketch>(); dlgMore.raycastTarget = false;
            dlgMore.rectTransform.anchorMin = dlgMore.rectTransform.anchorMax = new Vector2(1, 0); dlgMore.rectTransform.pivot = Vector2.zero;
            dlgMore.rectTransform.sizeDelta = new Vector2(14, 9);
            dlgMore.Tri(new Vector2(0, 9), new Vector2(14, 9), new Vector2(7, 0), Ui.Red);
            chip = Ui.Node("chip", dlg);
            // (the portrait chip: their colour in an ink ring, their portrait in it (BridgeRunner.Portrait), else their initial)
            var sh = Ui.Rect(chip, Ui.Ink, 0, "shadow"); sh.sprite = Ui.Round(32);
            Ui.Place(sh.rectTransform, 3, 3, 84, 84);
            var ring = Ui.Rect(chip, Ui.Ink, 0, "ring"); ring.sprite = Ui.Round(32);
            Ui.Place(ring.rectTransform, 0, 0, 84, 84);
            chipFill = Ui.Rect(chip, Ui.Hex("#d8a24a"), 0, "colour"); chipFill.sprite = Ui.Round(32);
            Ui.Place(chipFill.rectTransform, 3, 3, 78, 78);
            chipFill.gameObject.AddComponent<Mask>().showMaskGraphic = true;
            chipPhoto = new GameObject("portrait", typeof(RectTransform)).AddComponent<RawImage>();
            chipPhoto.rectTransform.SetParent(chipFill.rectTransform, false);
            Ui.Stretch(chipPhoto.rectTransform);
            chipPhoto.raycastTarget = false;
            chipPhoto.gameObject.SetActive(false);
            chipLetter = Ui.Label(chip, "letter", mono, 36, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Place(chipLetter.rectTransform, 0, 0, 84, 84);
            var ls = chipLetter.gameObject.AddComponent<Shadow>(); ls.effectColor = Ui.Ink; ls.effectDistance = new Vector2(2, -2);
            chip.localRotation = Quaternion.Euler(0, 0, 3);
            dlgTag = Ui.Panel(dlg, "tag", Ui.Ink, Ui.Ink, 0, 3, 3, 0, Ui.Red);
            dlgName = Ui.Label(dlgTag.rt, "name", mono, 19, Ui.Paper, TextAnchor.LowerLeft); Ui.Space(dlgName, 0.14f);
            dlgTitle = Ui.Label(dlgTag.rt, "title", mono, 12, Ui.Hex("#fffaf0", 0.85f), TextAnchor.LowerLeft, FontStyle.Italic);
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
            DrawToast(state.O("toast"), d == null);
            DrawCue(state.O("cue"), d == null);
            DrawPrompt(state.O("prompt"), d == null);
            DrawHealth(state.O("health"));
            DrawWheel(state.O("stamina"), d == null);
            DrawTalk(d, state.Get("choice") is double c ? (int)c : 0);
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
            Ui.Place(toast.rt, W / 2 - w / 2, 22, w, h);
            Ui.Group(toast.rt).alpha = a;
        }

        void DrawCue(Dictionary<string, object> c, bool on)
        {
            on &= c != null;
            Show(cue, on);
            if (!on) return;
            bool place = c.S("kind") == "place";
            cueText.fontStyle = place ? FontStyle.Italic : FontStyle.Normal;
            var s = Ui.Set(cueText, c.S("text"), Mathf.Min(900, W - 60));
            float w = s.x + 24, h = s.y + 12;
            Ui.Place(cueText.rectTransform, 12, 6, s.x, s.y);
            Ui.Place(cue.rt, W / 2 - w / 2, H - 46 - h, w, h);
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
            float pw = Mathf.Min(720, W - 32);
            float padL = 112, padR = 22, padT = 26, padB = 14, cw = pw - padL - padR;
            var body = Ui.Rich(shown) + (done ? "" : "<color=#2b211f99>▍</color>");
            Ui.Set(dlgText, body, cw);
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
                num.text = (i + 1).ToString();
                Ui.Place(num.rectTransform, 10, 5, 20, 20);
                var s = Ui.Set(tx, Ui.Rich(Text.Plain((choices[i] as Dictionary<string, object>).S("text"))), cw - 20 - 30);
                Ui.Place(tx.rectTransform, 10 + 19.6f, 5, s.x, s.y);
                float bh = Mathf.Max(21, s.y) + 10;
                Ui.Place(box.rt, padL + (hi ? -1 : 0), y + (hi ? -1 : 0), cw, bh);
                box.SetFill(hi ? Ui.Cream : Ui.Choice);
                box.SetShadow(hi ? 3 : 2, hi ? 3 : 2);
                y += bh + 5;
            }
            if (choices.Count > 0) y -= 5;
            float ph = Mathf.Max(92, y + padB);
            Ui.Place(dlg, W / 2 - pw / 2, H - 26 - ph, pw, ph);
            Ui.Place(dlgPanel.rt, 0, 0, pw, ph);
            dlgLines.Clear();
            for (float ly = 26; ly < ph; ly += 27) dlgLines.Box(new Rect(-pw / 2, ph / 2 - ly - 1, pw, 1), Ui.Hex("#2b211f", 0.05f));
            Show(dlgMore, d.Get("more") is bool m && m);
            dlgMore.rectTransform.anchoredPosition = new Vector2(-30, 11 + 3 * (0.5f - 0.5f * Mathf.Cos(Time.unscaledTime * Mathf.PI * 2)));
            Ui.Place(chip, 14, -36, 84, 84);
            var name = d.S("name") ?? ""; var title = d.S("title") ?? "";
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
            var tt = Ui.Set(dlgTitle, title);
            Show(dlgTitle, title.Length > 0);
            float tw = Mathf.Min(pw - 124, 14 + ns.x + (title.Length == 0 ? 0 : 12 + tt.x) + 14), th = 33;
            Ui.Place(dlgName.rectTransform, 14, 5, ns.x, 23);
            Ui.Place(dlgTitle.rectTransform, 14 + ns.x + 12, 9, Mathf.Max(0, tw - ns.x - 40), 18);
            Ui.Place(dlgTag.rt, 104, -th * 0.6f, tw, th);
        }
    }
}
