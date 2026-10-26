using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    public partial class BridgeHud
    {
        // The enamel of every other message (issue #687, src/hud-look.js ENAMEL_ENGINE): D's dark panel with one brass
        // hairline for a card (the charge, a box's find, the knock-out, a game's cards, the subtitles, the balloons), C's
        // charcoal strip for a tag or a flash; brass capitals for a card's label, ivory badges with dark letters.
        static readonly Color EnPanel = Ui.Hex("#161d1d", .97f), EnBrass = Ui.Hex("#d9b575"), EnBrassInk = Ui.Hex("#edbc76"),
            EnGold = Ui.Hex("#f2c54b"), EnKeyInk = Ui.Hex("#18201f"), EnSoft = Ui.Hex("#f7ecd2", .72f), EnScrim = new Color(12 / 255f, 15 / 255f, 15 / 255f, .55f),
            EnBad = Ui.Hex("#e0775f");
        static Ui.Box EnamelCard(Transform parent, string name, int radius = 10) => Ui.Panel(parent, name, EnPanel, EnBrass, 1.5f, 0, 0, radius);
        static Ui.Box EnamelStrip(Transform parent, string name, int radius = 7) => Ui.Panel(parent, name, HintBg0, HintBg0, 0, 0, 0, radius);
        /// <summary>A card's colours now (the plain speech setting: black, a white hairline, white words).</summary>
        void EnamelPaint(Ui.Box box, bool card = true)
        {
            box.SetFill(solid ? Color.black : card ? EnPanel : HintBg0);
            if (box.border) box.border.color = solid ? Color.white : card ? EnBrass : HintBg0;
        }
        // The shared web --hint-* frame/tab. Allocated once per panel; never a gameplay state.
        static readonly Color HintAccent = Ui.Hex("#79c9c0");
        class EnamelTrim { public Image frame, tab, divider, rivet; public UnityEngine.UI.Text mark; }
        readonly Dictionary<Ui.Box, EnamelTrim> enamel = new();
        void HintTrim(Ui.Box box, bool decorated = true)
        {
            if (!enamel.TryGetValue(box, out var trim))
            {
                trim = new EnamelTrim();
                trim.frame = Ui.Fill(box.rt, Ui.Hex("#f7ecd2", 0.65f), 0, "enamel inset");
                trim.frame.sprite = Ui.Frame(1, 4); trim.frame.type = Image.Type.Sliced; trim.frame.pixelsPerUnitMultiplier = 2;
                Ui.Stretch(trim.frame.rectTransform, 3, 3, 3, 3);
                trim.tab = Ui.Rect(box.rt, HintAccent, 2, "enamel tab");
                trim.divider = Ui.Rect(box.rt, Ui.Hex("#f7ecd2", .55f), 0, "enamel divider");
                trim.rivet = Ui.Rect(box.rt, Ui.Hex("#ad9263"), 4, "enamel brass rivet");
                trim.mark = Ui.Label(box.rt, "enamel mark", Ui.Sans, 16, HintInk0, TextAnchor.MiddleCenter);
                enamel.Add(box, trim);
            }
            bool on = decorated && !solid;
            trim.frame.enabled = trim.tab.enabled = on;
            trim.divider.enabled = trim.rivet.enabled = trim.mark.enabled = false;
            if (on) Ui.Place(trim.tab.rectTransform, -3, (box.rt.rect.height - 14) / 2, 4, 14);
        }
        // Called after HintTrim: decoration has no status meaning; the mark is the existing quest kind.
        void HintColumn(Ui.Box box, float dividerX, string mark = null, bool rivet = false)
        {
            var trim = enamel[box]; float h = box.rt.rect.height;
            trim.divider.enabled = !solid;
            Ui.Place(trim.divider.rectTransform, dividerX, 12, 1, Mathf.Max(0, h - 24));
            trim.rivet.enabled = rivet && !solid;
            Ui.Place(trim.rivet.rectTransform, box.rt.rect.width - 15, 9, 6, 6);
            trim.mark.enabled = !string.IsNullOrEmpty(mark);
            if (trim.mark.enabled) { trim.mark.text = mark; trim.mark.color = HintInk; trim.mark.fontSize = Sz(16); Ui.Place(trim.mark.rectTransform, 10, 8, dividerX - 20, h - 16); }
        }

        // ---------------------------------------------------------------- a card's prompt (issue #695, src/hud-look.js enamelPrompt)
        // The author on the box card's "[Enter] Continue" pill: "just show me the button and what it does next to it" (Breath
        // of the Wild's "Inventory (+)"). The button's badge (an ivory disc, a pill for a longer name, its dark letter) and the
        // word after it in the card's own ink, small, at the card's bottom right: no panel, no border, no fill round them. Where
        // a card has several (a game's), the pad's one is underlined, the one mark (issue #507).
        internal class CardPromptParts { public RectTransform rt; public Image badge, line; public Label key, word, sub; }
        internal static CardPromptParts MakeCardPrompt(Transform parent, string name, int size)
        {
            var p = new CardPromptParts { rt = Ui.Node(name, parent) };
            p.badge = Ui.Rect(p.rt, HintInk0, 32, "badge");
            p.key = Ui.Label(p.badge.rectTransform, "key", Ui.Sans, Mathf.RoundToInt(size * 0.78f), EnKeyInk, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Stretch(p.key.rectTransform);
            p.word = Ui.Label(p.rt, "word", Ui.Sans, size, HintInk0, TextAnchor.UpperLeft, FontStyle.Bold); Ui.Space(p.word, 0.04f);
            p.sub = Ui.Label(p.rt, "sub", Ui.Sans, Mathf.RoundToInt(size * 0.78f), EnSoft, TextAnchor.UpperLeft);
            p.line = Ui.Rect(p.rt, HintInk0, 0, "focus line");
            p.badge.raycastTarget = p.key.raycastTarget = p.word.raycastTarget = p.sub.raycastTarget = p.line.raycastTarget = false;
            return p;
        }
        /// <summary>The prompt from its top-left (x, y) in its parent: `key` its button (none: the word alone), `word` what it
        /// does, `sub` a line under it (an Arcade link's game), `focus` underlined. Returns its size.</summary>
        internal static Vector2 CardPrompt(CardPromptParts p, string key, string word, float x, float y, bool focus = false, string sub = null, Color? ink = null)
        {
            var c = ink ?? HintInk0;
            p.word.color = c; p.line.color = c;
            bool k = !string.IsNullOrEmpty(key);
            p.badge.enabled = p.key.enabled = k;
            float h = Mathf.Round(p.word.fontSize * 1.55f), bw = 0;
            if (k) { p.key.text = key; bw = Mathf.Max(h, Ui.Measure(p.key, key).x + 0.75f * h); Ui.Place(p.badge.rectTransform, 0, 0, bw, h); }
            float gap = k ? Mathf.Round(0.45f * p.word.fontSize) : 0;
            var ws = Ui.Set(p.word, word ?? "");
            float wy = h / 2 - ws.y / 2;
            Ui.Place(p.word.rectTransform, bw + gap, wy, ws.x, ws.y);
            bool s = !string.IsNullOrEmpty(sub);
            p.sub.enabled = s;
            var ss = s ? Ui.Set(p.sub, sub) : Vector2.zero;
            if (s) Ui.Place(p.sub.rectTransform, bw + gap, wy + ws.y + 1, ss.x, ss.y);
            p.line.enabled = focus;
            Ui.Place(p.line.rectTransform, bw + gap, wy + ws.y, ws.x, 1.5f);
            float w = bw + gap + Mathf.Max(ws.x, ss.x), hh = Mathf.Max(h, wy + ws.y + (s ? ss.y + 1 : 0));
            Ui.Place(p.rt, x, y, w, hh);
            return new Vector2(w, hh);
        }
        /// <summary>The prompt's size before it is placed (to set it at a card's right edge).</summary>
        internal static Vector2 CardPromptSize(CardPromptParts p, string key, string word, string sub = null)
        {
            var at = p.rt.anchoredPosition;
            var size = CardPrompt(p, key, word, 0, 0, false, sub);
            p.rt.anchoredPosition = at;
            return size;
        }
    }
}
