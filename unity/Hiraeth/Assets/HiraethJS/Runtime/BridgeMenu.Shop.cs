using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- a shop, as the page's (issue #264)
    // src/shop-panel.css #shop: a cream sheet in a 2 px ink line on a hard shadow; the keeper's name in bold with what they
    // are in italics beside it, their line in a speech bubble under it (its tail at the left), the wallet boxed at the
    // right (the chime's crystal or a fragment, the count in heavy figures) and the way out boxed beside it; the wares as
    // cards in a grid (three a row, Anselm's four), each its picture, name, what it does, its stock, its price and flag,
    // the pad's lifted on a red edge and a red shadow; a sold-out, full, fitted or wanting one greyed; one too dear its
    // price in red; asked, the question boxed at the sheet's foot over the wares, Buy in gold, Not now in paper, their
    // buttons as key caps. Until now a list of boxed rows on the menus' paper (engine/menus.js shopView sends both).
    public partial class BridgeMenu
    {
        static readonly Color ShopSheet = Ui.Hex("#f7ecd2"), ShopCard = Ui.Hex("#fffaf0"), ShopOn = Ui.Hex("#fff3cf"), ShopGrey = Ui.Hex("#efe3c8"),
            ShopRed = Ui.Hex("#c8483a"), ShopDear = Ui.Hex("#a33a2c"), ShopGold = Ui.Hex("#f2c54b"), ShopInk = Ui.Hex("#2b211f");

        RectTransform shRoot;
        Ui.Box shSheet, shBubble, shTail, shWallet, shClose, shAsk, shYes, shNo;
        Image shTailPatch, shDimWares;
        Label shName, shTitle, shLine, shPurse, shCloseText, shAskQ, shYesText, shNoText;
        RawImage shCoin;
        readonly List<ShopCardUi> shCards = new();
        readonly List<(Ui.Box box, Label text)> shCaps = new();
        int shCapsUsed;
        class ShopCardUi { public Ui.Box box, flag; public RawImage pic, coin; public Label name, effect, stock, price, flagText, mark; }

        const int ShopBase = 14;

        void BuildShop()
        {
            shRoot = Ui.Node("shop (the web's)", root);
            shSheet = Ui.Panel(shRoot, "sheet", ShopSheet, ShopInk, 2, 6, 6);
            var s = shSheet.rt;
            shName = Ui.Label(s, "keeper", Ui.Sans, 19, ShopInk, TextAnchor.UpperLeft, FontStyle.Bold, 1f); Ui.Space(shName, 0.06f);
            shTitle = Ui.Label(s, "what they are", Ui.Sans, ShopBase, Ui.Hex("#2b211f", 0.7f), TextAnchor.UpperLeft, FontStyle.Italic, 1f);
            shBubble = Ui.Panel(s, "line", ShopCard, ShopInk, 1.5f, 0, 0, 10);
            shLine = Ui.Label(shBubble.rt, "text", Ui.Sans, ShopBase, ShopInk, TextAnchor.UpperLeft, FontStyle.Italic, 1.04f);   // (the page's 1.4: the face's own line is 1.35)
            shTail = Ui.Panel(s, "tail", ShopCard, ShopInk, 1.5f);
            shTailPatch = Ui.Rect(s, ShopCard, 0, "tail's inside");
            shWallet = Ui.Panel(s, "wallet", ShopCard, ShopInk, 1.5f);
            shCoin = Ui.Node("coin", shWallet.rt).gameObject.AddComponent<RawImage>(); shCoin.raycastTarget = false;
            shPurse = Ui.Label(shWallet.rt, "count", Ui.Heavy, 18, ShopInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f);
            shClose = Ui.Panel(s, "close", ShopCard, ShopInk, 1.5f);
            shCloseText = Ui.Label(shClose.rt, "x", Ui.Sans, 16, ShopInk, TextAnchor.MiddleLeft, FontStyle.Normal, 1f);
            shDimWares = Ui.Rect(s, Ui.Hex("#f7ecd2", 0.5f), 0, "the wares held back");
            shAsk = Ui.Panel(s, "ask", ShopSheet, ShopInk, 2, 5, 5);
            shAskQ = Ui.Label(shAsk.rt, "q", Ui.Sans, ShopBase, ShopInk, TextAnchor.UpperCenter, FontStyle.Bold, 1.25f);
            shYes = Ui.Panel(shAsk.rt, "buy", ShopGold, ShopInk, 2, 3, 3, 4);
            shYesText = Ui.Label(shYes.rt, "text", Ui.Sans, 15, ShopInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f); Ui.Space(shYesText, 0.08f);
            shNo = Ui.Panel(shAsk.rt, "not now", ShopCard, ShopInk, 2, 3, 3, 4);
            shNoText = Ui.Label(shNo.rt, "text", Ui.Sans, 15, ShopInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f); Ui.Space(shNoText, 0.08f);
            shRoot.gameObject.SetActive(false);
        }

        /// <summary>A button's key cap (the page's .glyph: the key's name in a small inked box), at (x, y) of `parent`; its width.</summary>
        float ShopCap(RectTransform parent, string role, string key, float x, float midY)
        {
            // (the pad's button as the page's glyph inside it, src/shop-panel.js glyph('back') / glyph('ok'): issue #517)
            if (state.O("glyphs") != null) { float gw = PutGlyph(parent, role, x, midY, 15); if (gw > 0) return gw; }
            if (shCapsUsed >= shCaps.Count)
            {
                var b = Ui.Panel(shRoot, "cap" + shCaps.Count, Ui.Hex("#fffaf0"), ShopInk, 1.5f, 0, 2, 3);
                shCaps.Add((b, Ui.Label(b.rt, "key", Ui.Sans, 11, ShopInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f)));
            }
            var (box, text) = shCaps[shCapsUsed++];
            box.rt.SetParent(parent, false);
            box.Show(true);
            float w = Ui.Measure(text, key).x + 10;
            text.text = key; Ui.Stretch(text.rectTransform);
            Ui.Place(box.rt, x, midY - 10, w, 19);
            return w;
        }

        ShopCardUi ShopCardAt(int i)
        {
            while (shCards.Count <= i)
            {
                var c = new ShopCardUi { box = Ui.Panel(shSheet.rt, "ware" + shCards.Count, ShopCard, ShopInk, 2, 3, 3) };
                var r = c.box.rt;
                c.pic = Ui.Node("pic", r).gameObject.AddComponent<RawImage>(); c.pic.raycastTarget = false;
                c.mark = Ui.Label(r, "mark", Ui.Sans, 40, ShopInk, TextAnchor.MiddleCenter);
                c.name = Ui.Label(r, "name", Ui.Sans, 15, ShopInk, TextAnchor.UpperCenter, FontStyle.Bold, 1.1f); Ui.Space(c.name, 0.03f);
                c.effect = Ui.Label(r, "effect", Ui.Sans, 13, Ui.Hex("#2b211f", 0.85f), TextAnchor.UpperCenter, FontStyle.Normal, 1.04f);
                c.stock = Ui.Label(r, "stock", Ui.Sans, 12, Ui.Hex("#2b211f", 0.7f), TextAnchor.UpperCenter, FontStyle.Normal, 1.04f);
                c.coin = Ui.Node("coin", r).gameObject.AddComponent<RawImage>(); c.coin.raycastTarget = false;
                c.price = Ui.Label(r, "price", Ui.Heavy, 18, ShopInk, TextAnchor.MiddleLeft, FontStyle.Bold, 1f);
                c.flag = Ui.Panel(r, "flag", ShopSheet, ShopInk, 1.5f);
                c.flagText = Ui.Label(c.flag.rt, "text", Ui.Sans, 12, ShopInk, TextAnchor.MiddleCenter, FontStyle.Bold, 1f);
                Ui.Stretch(c.flagText.rectTransform);
                shCards.Add(c);
            }
            return shCards[i];
        }

        void DrawShop()
        {
            if (!shRoot) BuildShop();
            shRoot.gameObject.SetActive(true);
            shRoot.SetAsLastSibling();
            sheet.Show(false);
            // (the page lays its sheet over the world as it is, the room still lit round it)
            dim.color = Color.clear;
            shCapsUsed = 0;
            float sw = Mathf.Min(868, W - 40), px = 18, iw = sw - px * 2, y = 16;
            var coin = Picture(state.S("coin") ?? "shop-chime");
            // the way out, then the wallet, at the right
            shCloseText.text = "✕";
            float capW = ShopCap(shClose.rt, "back", Key("back", "B"), 9, 16), cw = 9 + capW + 6 + Ui.Measure(shCloseText, "✕").x + 10;
            Ui.Place(shCloseText.rectTransform, 9 + capW + 6, 0, 20, 33);
            Ui.Place(shClose.rt, sw - px - cw, y, cw, 33);
            var purse = state.S("purse") ?? "";
            float pw = Ui.Measure(shPurse, purse).x, ww = 10 + 18 + 5 + pw + 12;
            shPurse.text = purse; Ui.Place(shPurse.rectTransform, 10 + 18 + 5, 0, pw + 4, 38);
            shCoin.texture = coin; Show(shCoin, coin != null);
            if (coin) { float ch = 19, cwd = ch * coin.width / Mathf.Max(1, coin.height); Ui.Place(shCoin.rectTransform, 10 + (18 - cwd) / 2, 19 - ch / 2, cwd, ch); }
            Ui.Place(shWallet.rt, sw - px - cw - 14 - ww, y, ww, 38);
            // the keeper, and their line in a bubble under the name
            float lw = sw - px - cw - 14 - ww - 14 - px;
            var ns = Ui.Set(shName, state.S("head") ?? "", lw);
            Ui.Place(shName.rectTransform, px, y + 4, ns.x + 4, ns.y);
            var ts = Ui.Set(shTitle, state.S("sub") ?? "", lw - ns.x - 10);
            Ui.Place(shTitle.rectTransform, px + ns.x + 10, y + 4 + (ns.y - ts.y) / 2 + 2, ts.x + 4, ts.y);
            float by = y + 4 + ns.y + 8;
            var line = state.S("line") ?? "";
            shBubble.Show(line.Length > 0); shTail.Show(line.Length > 0); Show(shTailPatch, line.Length > 0);
            if (line.Length > 0)
            {
                var ls = Ui.Set(shLine, line, lw - 22);
                Ui.Place(shLine.rectTransform, 11, 7, lw - 22, ls.y);
                Ui.Place(shBubble.rt, px, by, lw, ls.y + 14);
                // (the page's ::before: a 10 px square turned 45° about its middle, half over the bubble's top edge, its lower
                // half hidden by the bubble's paper)
                Ui.Place(shTail.rt, px + 18, by - 7, 10, 10);
                shTail.rt.pivot = new Vector2(0.5f, 0.5f); shTail.rt.anchoredPosition = new Vector2(px + 23, -(by - 2)); shTail.rt.localEulerAngles = new Vector3(0, 0, 45);
                Ui.Place(shTailPatch.rectTransform, px + 15, by + 1.5f, 16, 8);
                by += ls.y + 14;
            }
            y = Mathf.Max(by, y + 38) + 12;
            // the wares, a card each, in the page's grid
            var rows = state.L("rows") ?? new List<object>();
            int cols = Mathf.Max(1, state.I("cols") > 0 ? state.I("cols") : 3);
            float gap = 12, cardW = (iw - gap * (cols - 1)) / cols;
            bool frag = (state.S("coin") ?? "") == "shop-fragment";
            for (int r0 = 0; r0 < rows.Count; r0 += cols)
            {
                float rowH = 0;
                var hs = new List<float>();
                for (int i = r0; i < Mathf.Min(rows.Count, r0 + cols); i++) { float h = ShopCardDraw(i, rows[i] as Dictionary<string, object>, cardW, frag, coin, false); hs.Add(h); rowH = Mathf.Max(rowH, h); }
                for (int i = r0; i < Mathf.Min(rows.Count, r0 + cols); i++)
                {
                    var r = rows[i] as Dictionary<string, object>;
                    ShopCardDraw(i, r, cardW, frag, coin, true, rowH);
                    bool on = B(r, "on") && state.O("ask") == null;
                    float lift = on ? 1 : 0;
                    Ui.Place(shCards[i].box.rt, px + (i - r0) * (cardW + gap) - lift, y - lift * 2, cardW, rowH);
                }
                y += rowH + gap;
            }
            for (int i = rows.Count; i < shCards.Count; i++) shCards[i].box.Show(false);
            y += 6 - gap + 12;
            // asked: the wares held back, the question at the sheet's foot
            var ask = state.O("ask");
            shAsk.Show(ask != null); Show(shDimWares, ask != null);
            if (ask != null)
            {
                Ui.Place(shDimWares.rectTransform, 2, 2, sw - 4, y - 4);
                shDimWares.transform.SetAsLastSibling(); shAsk.rt.SetAsLastSibling();
                float aw = Mathf.Min(420, sw * 0.9f);
                var qs = Ui.Set(shAskQ, ask.S("q") ?? "", aw - 32);
                Ui.Place(shAskQ.rectTransform, 16, 12, aw - 32, qs.y);
                int on = ask.I("on");
                float bh = 38, byy = 12 + qs.y + 10;
                float yw = ShopAskButton(shYes, shYesText, "ok", Key("ok", "A"), ask.S("yes"), byy, bh, on == 1, ShopGold);
                float nw = ShopAskButton(shNo, shNoText, "back", Key("back", "B"), ask.S("no"), byy, bh, on == 0, ShopCard);
                float bx = (aw - yw - 12 - nw) / 2;
                Ui.Place(shYes.rt, bx, byy, yw, bh);
                Ui.Place(shNo.rt, bx + yw + 12, byy, nw, bh);
                float ah = byy + bh + 14;
                Ui.Place(shAsk.rt, sw / 2 - aw / 2, y - 22 - ah, aw, ah);
            }
            for (int i = shCapsUsed; i < shCaps.Count; i++) shCaps[i].box.Show(false);
            // (no taller than the screen: scaled down to fit, centred)
            float k = Mathf.Min(1, (H - 60) / y);
            shRoot.localScale = Vector3.one;
            shSheet.rt.localScale = new Vector3(k, k, 1);
            Ui.Place(shSheet.rt, W / 2 - sw * k / 2, Mathf.Max(12, H / 2 - y * k / 2), sw, y);
        }

        /// <summary>One of the question's buttons: its key cap and its word, gold for Buy; the pad's ringed in red. Its width.</summary>
        float ShopAskButton(Ui.Box b, Label text, string role, string key, string word, float y, float h, bool on, Color fill)
        {
            b.Show(true);
            float cap = ShopCap(b.rt, role, key, 16, h / 2);
            var ws = Ui.Measure(text, word ?? "");
            text.text = word ?? "";
            Ui.Place(text.rectTransform, 16 + cap + 7, 0, ws.x + 4, h);
            b.SetFill(on ? Ui.Hex("#ffd866") : fill);
            b.border.color = on ? ShopRed : ShopInk;
            return 16 + cap + 7 + ws.x + 16;
        }

        /// <summary>A ware's card (the page's .ware) laid out cardW wide: its height; with `place`, drawn rowH tall.</summary>
        float ShopCardDraw(int i, Dictionary<string, object> r, float cardW, bool frag, Texture2D coin, bool place, float rowH = 0)
        {
            var c = ShopCardAt(i);
            var d = r.O("card") ?? new Dictionary<string, object>();
            string st = r.S("state") ?? "ok";
            bool asked = state.O("ask") != null, on = B(r, "on") && !asked, grey = st == "soldout" || st == "full" || st == "owned" || st == "needs";
            float iw = cardW - 20, y = 12;
            var pic = Picture(d.S("pic")) ?? Picture(d.S("alt"));
            float ph = frag && Picture(d.S("pic")) != null ? 72 : 58;
            if (place)
            {
                c.box.Show(true);
                c.pic.texture = pic; Show(c.pic, pic != null); Show(c.mark, pic == null);
                if (pic != null) { float pw = ph * pic.width / Mathf.Max(1, pic.height); Ui.Place(c.pic.rectTransform, cardW / 2 - pw / 2, y, pw, ph); c.pic.color = grey ? new Color(0.85f, 0.83f, 0.8f, 0.45f) : Color.white; }
                else { c.mark.text = r.S("mark") ?? "◆"; Ui.Place(c.mark.rectTransform, 0, y, cardW, ph); }
            }
            y += ph + 4;
            var ns = place ? Ui.Set(c.name, d.S("name") ?? "", iw) : Ui.Measure(c.name, d.S("name") ?? "", iw);
            if (place) Ui.Place(c.name.rectTransform, 10, y, iw, ns.y);
            y += ns.y + 4;
            var es = place ? Ui.Set(c.effect, d.S("effect") ?? "", iw) : Ui.Measure(c.effect, d.S("effect") ?? "", iw);
            if (place) Ui.Place(c.effect.rectTransform, 10, y, iw, es.y);
            y += es.y + 4;
            string stock = d.S("stock") ?? "";
            var ss = stock.Length > 0 ? (place ? Ui.Set(c.stock, stock, iw) : Ui.Measure(c.stock, stock, iw)) : Vector2.zero;
            if (place) { Show(c.stock, stock.Length > 0); if (stock.Length > 0) Ui.Place(c.stock.rectTransform, 10, y, iw, ss.y); }
            if (stock.Length > 0) y += ss.y + 4;
            float footH = 27;
            if (place)
            {
                // the foot at the card's bottom (the page's grid row 1fr pushes it down): the price, then the flag
                string price = d.S("price") ?? "", flag = d.S("flag") ?? "";
                float prw = price.Length > 0 ? Ui.Measure(c.price, price).x : 0, cw0 = price.Length > 0 ? 17 : 0;
                float flw = flag.Length > 0 ? Ui.Measure(c.flagText, flag).x + 14 : 0;
                float total = (price.Length > 0 ? cw0 + 4 + prw : 0) + (price.Length > 0 && flag.Length > 0 ? 8 : 0) + flw;
                float fx = cardW / 2 - total / 2, fy = rowH - 10 - footH;
                Show(c.coin, price.Length > 0 && coin != null); Show(c.price, price.Length > 0);
                if (price.Length > 0)
                {
                    if (coin) { float ch = 18, cwd = ch * coin.width / Mathf.Max(1, coin.height); c.coin.texture = coin; Ui.Place(c.coin.rectTransform, fx + (cw0 - cwd) / 2, fy + footH / 2 - ch / 2, cwd, ch); }
                    c.price.text = price; c.price.color = st == "short" ? ShopDear : ShopInk;
                    Ui.Place(c.price.rectTransform, fx + cw0 + 4, fy, prw + 4, footH);
                    fx += cw0 + 4 + prw + 8;
                }
                c.flag.Show(flag.Length > 0);
                if (flag.Length > 0)
                {
                    bool dark = st == "soldout" || st == "owned";
                    c.flag.SetFill(dark ? ShopInk : ShopSheet); c.flagText.color = dark ? ShopSheet : ShopInk;
                    c.flagText.text = flag;
                    Ui.Place(c.flag.rt, fx, fy + footH / 2 - 10, flw, 20);
                }
                c.box.SetFill(on ? ShopOn : grey ? ShopGrey : ShopCard);
                c.box.border.color = on ? ShopRed : ShopInk;
                c.box.shadow.color = on ? ShopRed : ShopInk;
                c.box.SetShadow(on ? 5 : 3, on ? 6 : 3);
            }
            return y + footH + 10;
        }
    }
}
