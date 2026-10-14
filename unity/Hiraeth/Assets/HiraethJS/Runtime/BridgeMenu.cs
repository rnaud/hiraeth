using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Hiraeth.Bridge
{
    /// <summary>
    /// The menus, drawn in uGUI from the game's own menu state (engine/menus.js view(): the title, the Start menu, the game
    /// menu), sent by the bundle when it changes (BridgeHost.Menu). The script decides everything (the entries, the cursor,
    /// what a press does, as the web's src/title.js, src/ui.js SettingsMenu and src/game-menu.js do); this only lays it out
    /// in the HUD's paper and ink (Ui.cs, BridgeHud): a paper sheet over the world dimmed, the entries in ink, the one the
    /// pad is on in full ink on a cream band with a red mark and line, the buttons' prompts at the foot.
    /// </summary>
    public class BridgeMenu : MonoBehaviour
    {
        public Camera cam;
        RectTransform root;
        float W => root.rect.width; float H => root.rect.height;
        Dictionary<string, object> state;
        bool dirty;

        Image dim;
        Ui.Box sheet;
        Label logo, head, sub, version, hint, note, empty, meas;
        // a pool of entries (a row of the title, the sidebar, a page's control, a panel's cell), each a band, its words, a value and a slider
        class Cell { public Ui.Box box; public Label text, sub, val; public Image bar, fill, mark, line; public RawImage pic; }
        readonly List<Cell> cells = new();
        int used;
        // the Items panel's tiles (as the web's .slot: the picture on its paper in an ink frame, the name under it)
        class Tile { public Ui.Box box; public RawImage pic; public Label mark, name, inUse; public Image ring; }
        readonly List<Tile> tiles = new();
        int tilesUsed;
        // the items' pictures (public/item-pictures as PNGs: scripts/engine-bundle.mjs unityPictures), each read once
        static readonly Dictionary<string, Texture2D> pictures = new();
        RawImage cardPic; Label cardMark;
        // the Map's drawn ground (engine/game.js: the world's collision sampled straight down, drawn as the web's map), by key
        readonly Dictionary<string, Texture2D> grounds = new();
        RawImage mapGround; Label mapDrawing, mapScale; Image mapBar;
        // the game menu's tabs, the strip at the foot, a thing full screen, a question, the map's marks
        readonly List<Label> tabs = new();
        Label tabPrev, tabNext; Image tabLine;
        Ui.Box strip; Label stripName, stripSub, stripDesc, stripAct;
        Ui.Box card; Label cardTitle, cardSub, cardText, cardFacts, cardUse, cardSteps;
        Ui.Box ask; Label askQ, askWhat, askNo, askYes;
        Ui.Box mapBox; readonly List<(Image dot, Label name)> marks = new();

        static readonly Color Muted = Ui.Hex("#5e4b45"), Band = Ui.Hex("#f2dfb4"), Dim = Ui.Hex("#1d1614", 0.62f);
        const int Body = 19, Small = 14, Tiny = 12;

        static bool B(object o, string k) => o.Get(k) is bool b && b;

        /// <summary>A thing's picture (StreamingAssets/hiraeth-js/item-pictures/id.png), or null where it has none.</summary>
        static Texture2D Picture(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (pictures.TryGetValue(id, out var t)) return t;
            var bytes = StreamingFile.Read(System.IO.Path.Combine(Application.streamingAssetsPath, "hiraeth-js", "item-pictures", id + ".png"));
            if (bytes != null)
            {
                t = new Texture2D(2, 2, TextureFormat.RGBA32, false) { name = "item " + id, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
                if (!t.LoadImage(bytes, true)) { Destroy(t); t = null; }
            }
            pictures[id] = t;
            return t;
        }
        /// <summary>A button's name as the pad in hand prints it (the view's keys: ok, back, prev, next; the script names them, src/native-pad.js).</summary>
        string Key(string k, string or) => state.O("keys")?.S(k) is string s && s.Length > 0 ? s : or;

        public void Set(string json) { state = Json.Parse(json) as Dictionary<string, object>; dirty = true; }
        /// <summary>A menu on screen (the title, the Start menu, the game menu): BridgeMetrics leaves its readout off it.</summary>
        public bool Open => state != null;

        /// <summary>The Map's ground, RGBA rows top down (BridgeHost.MapImage), kept by its key for the view that names it.</summary>
        public void SetMap(string key, byte[] rgba, int w, int h)
        {
            if (rgba == null || rgba.Length < w * h * 4 || grounds.ContainsKey(key)) return;   // (a key is drawn once)
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false) { name = "map " + key, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            grounds[key] = t;
            t.LoadRawTextureData(rgba);
            t.Apply(false, true);
            dirty = true;
        }

        void Start()
        {
            root = Hud.MakeCanvas(cam, "Menus (JS bridge)", 200);
            root.SetParent(transform, false);
            var mono = Ui.Mono;
            dim = Ui.Fill(root, Dim, 0, "dim");
            sheet = Ui.Panel(root, "sheet", Ui.Page, Ui.Ink, 2.5f, 6, 6);
            logo = Ui.Label(root, "logo", Ui.Heavy, 76, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Space(logo, 0.18f);
            head = Ui.Label(root, "head", mono, 22, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
            sub = Ui.Label(root, "sub", mono, Small, Muted);
            version = Ui.Label(root, "version", mono, Tiny, Muted);
            hint = Ui.Label(root, "hint", mono, Small, Ui.Ink, TextAnchor.LowerRight);
            note = Ui.Label(root, "note", mono, Body, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Italic);
            empty = Ui.Label(root, "empty", mono, Body, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            meas = Ui.Label(root, "measure", mono, Small, Color.clear);   // (the Controls page's rows measured with it, never shown)
            Ui.Place(meas.rectTransform, -4000, 0, 10, 10);
            for (int i = 0; i < 5; i++) tabs.Add(Ui.Label(root, "tab" + i, mono, Body, Muted, TextAnchor.MiddleCenter));
            tabPrev = Ui.Label(root, "tabPrev", mono, Small, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            tabNext = Ui.Label(root, "tabNext", mono, Small, Ui.Ink, TextAnchor.MiddleRight, FontStyle.Bold);
            tabLine = Ui.Rect(root, Ui.Red, 0, "tabLine");
            mapBox = Ui.Panel(root, "map", Ui.Hex("#efe0bd"), Ui.Ink, 1.5f);
            mapGround = Ui.Node("ground", mapBox.rt).gameObject.AddComponent<RawImage>(); mapGround.raycastTarget = false;
            mapGround.uvRect = new Rect(0, 1, 1, -1);   // (its rows top down: Unity's textures start at the bottom)
            mapDrawing = Ui.Label(mapBox.rt, "drawing", mono, Small, Muted, TextAnchor.MiddleCenter, FontStyle.Italic);
            mapBar = Ui.Rect(mapBox.rt, Ui.Ink, 0, "scaleBar");
            mapScale = Ui.Label(mapBox.rt, "scale", mono, Tiny, Ui.Ink, TextAnchor.LowerLeft, FontStyle.Bold);
            strip = Ui.Panel(root, "strip", Ui.Paper, Ui.Ink, 1.5f, 3, 3);
            stripName = Ui.Label(strip.rt, "name", mono, Body, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
            stripSub = Ui.Label(strip.rt, "sub", mono, Small, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            stripDesc = Ui.Label(strip.rt, "desc", mono, Small, Ui.Ink);
            stripAct = Ui.Label(strip.rt, "act", mono, Small, Ui.Red, TextAnchor.UpperRight, FontStyle.Bold);
            card = Ui.Panel(root, "full", Ui.Paper, Ui.Ink, 2.5f, 6, 6);
            cardTitle = Ui.Label(card.rt, "title", mono, 26, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
            cardSub = Ui.Label(card.rt, "sub", mono, Small, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            cardText = Ui.Label(card.rt, "text", mono, Body, Ui.Ink, lineSpacing: 1.3f);
            cardFacts = Ui.Label(card.rt, "facts", mono, Small, Ui.Ink, lineSpacing: 1.35f);
            cardUse = Ui.Label(card.rt, "use", mono, Body, Ui.Red, TextAnchor.UpperLeft, FontStyle.Bold);
            cardSteps = Ui.Label(card.rt, "steps", mono, Small, Muted, TextAnchor.LowerCenter);
            ask = Ui.Panel(root, "ask", Ui.Paper, Ui.Ink, 2.5f, 6, 6);
            askQ = Ui.Label(ask.rt, "q", mono, 22, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold);
            askWhat = Ui.Label(ask.rt, "what", mono, Small, Muted, TextAnchor.UpperCenter, lineSpacing: 1.3f);
            askNo = Ui.Label(ask.rt, "no", mono, Body, Ui.Ink, TextAnchor.MiddleCenter);
            askYes = Ui.Label(ask.rt, "yes", mono, Body, Ui.Ink, TextAnchor.MiddleCenter);
            cardPic = Ui.Node("pic", card.rt).gameObject.AddComponent<RawImage>(); cardPic.raycastTarget = false;
            cardMark = Ui.Label(card.rt, "mark", Ui.Sans, 64, Ui.Teal, TextAnchor.MiddleCenter);
            root.gameObject.SetActive(false);
        }

        Cell Take()
        {
            if (used >= cells.Count)
            {
                var c = new Cell { box = Ui.Panel(root, "cell" + cells.Count, Color.clear, Ui.Ink, 0) };
                c.mark = Ui.Rect(c.box.rt, Ui.Red, 0, "mark");
                c.line = Ui.Rect(c.box.rt, Ui.Red, 0, "line");
                c.text = Ui.Label(c.box.rt, "text", Ui.Mono, Body, Ui.Ink, TextAnchor.UpperLeft);
                c.sub = Ui.Label(c.box.rt, "sub", Ui.Mono, Small, Muted, TextAnchor.UpperLeft, lineSpacing: 1.2f);
                c.val = Ui.Label(c.box.rt, "val", Ui.Mono, Body, Ui.Ink, TextAnchor.UpperRight);
                c.bar = Ui.Rect(c.box.rt, Ui.Hex("#2b211f", 0.25f), 0, "bar");
                c.fill = Ui.Rect(c.bar.rectTransform, Ui.Ink, 0, "fill");
                cells.Add(c);
            }
            var cell = cells[used++];
            cell.box.Show(true);
            return cell;
        }

        /// <summary>An entry at (x, y), w × h: its words (and what is under them), its value at the right, its slider; the pad's on it drawn so.</summary>
        Cell Entry(float x, float y, float w, float h, string text, string under, string val, bool on, float slider = -1, int size = Body, bool dimmed = false, bool boxed = false)
        {
            var c = Take();
            Ui.Place(c.box.rt, x, y, w, h);
            c.box.SetFill(on ? Band : boxed ? Ui.Hex("#fff6dc", 0.6f) : Color.clear);
            c.text.fontSize = size; c.text.fontStyle = on ? FontStyle.Bold : FontStyle.Normal;
            c.text.color = dimmed ? Muted : on ? Ui.Ink : Ui.Hex("#3b2e2a");
            float pad = 14, valW = string.IsNullOrEmpty(val) ? 0 : Mathf.Min(w * 0.45f, Ui.Measure(c.val, val).x + 4);
            var ts = Ui.Set(c.text, text ?? "", w - pad * 2 - valW - 8);
            Ui.Place(c.text.rectTransform, pad, 5, w - pad * 2 - valW - 8, ts.y);
            bool hasSub = !string.IsNullOrEmpty(under);
            c.sub.gameObject.SetActive(hasSub);
            if (hasSub) { var ss = Ui.Set(c.sub, under, w - pad * 2 - valW - 8); Ui.Place(c.sub.rectTransform, pad, 5 + ts.y + 1, w - pad * 2 - valW - 8, Mathf.Min(ss.y, h - ts.y - 6)); }
            c.val.gameObject.SetActive(valW > 0);
            if (valW > 0) { c.val.text = val; c.val.fontSize = size; Ui.Place(c.val.rectTransform, w - pad - valW, 5, valW, Mathf.Max(size * 1.4f, h - 8)); }
            c.bar.gameObject.SetActive(slider >= 0);
            if (slider >= 0) { float bw = Mathf.Min(160, w * 0.3f); Ui.Place(c.bar.rectTransform, w - pad - bw, h - 9, bw, 3); Ui.Place(c.fill.rectTransform, 0, 0, bw * Mathf.Clamp01(slider), 3); }
            c.mark.gameObject.SetActive(on);
            if (c.pic) Show(c.pic, false);
            c.line.gameObject.SetActive(on);
            if (on) { Ui.Place(c.mark.rectTransform, 0, 4, 4, h - 8); Ui.Place(c.line.rectTransform, pad, 5 + ts.y + (hasSub ? 0 : 1), Mathf.Min(Ui.Measure(c.text, text ?? "").x, w - pad * 2), 2); }
            return c;
        }

        static void Show(Component c, bool on) { if (c && c.gameObject.activeSelf != on) c.gameObject.SetActive(on); }

        /// <summary>A line's small picture at its left (what you carry, a keepsake), the words moved over for it.</summary>
        void LinePicture(Cell cell, Texture2D pic, float h, float most = 26)
        {
            if (!cell.pic) { cell.pic = Ui.Node("pic", cell.box.rt).gameObject.AddComponent<RawImage>(); cell.pic.raycastTarget = false; }
            Show(cell.pic, pic != null);
            if (pic == null) return;
            float s = Mathf.Min(h - 6, most);
            cell.pic.texture = pic;
            Ui.Place(cell.pic.rectTransform, 12, (h - s) / 2, s, s);
            var p = cell.text.rectTransform.anchoredPosition; cell.text.rectTransform.anchoredPosition = new Vector2(p.x + s + 6, p.y);
            if (cell.sub.gameObject.activeSelf) { var q = cell.sub.rectTransform.anchoredPosition; cell.sub.rectTransform.anchoredPosition = new Vector2(q.x + s + 6, q.y); }
        }

        /// <summary>
        /// One of the Items panel's tiles, centred in its column (x, w): its picture on the slot's paper in an ink frame
        /// (side × side), its name under it in two lines at most; the pad's on it in gold, lifted on its shadow, ringed in
        /// red; an empty slot (an item still to find) faint and unnamed. (src/game-menu.css .slot)
        /// </summary>
        void DrawTile(float x, float y, float w, float side, Dictionary<string, object> c)
        {
            if (tilesUsed >= tiles.Count)
            {
                var t = new Tile { box = Ui.Panel(root, "tile" + tiles.Count, Ui.Hex("#f6e9c8"), Ui.Ink, 2.5f, 0, 0, 18) };
                t.ring = Ui.Rect(t.box.rt, Ui.Red, 20, "ring"); t.ring.transform.SetAsFirstSibling();
                t.pic = Ui.Node("pic", t.box.rt).gameObject.AddComponent<RawImage>(); t.pic.raycastTarget = false;
                t.mark = Ui.Label(t.box.rt, "mark", Ui.Sans, 40, Ui.Teal, TextAnchor.MiddleCenter);
                t.name = Ui.Label(t.box.rt, "name", Ui.Mono, Tiny, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold, 1.1f);
                t.name.verticalOverflow = VerticalWrapMode.Truncate;
                t.inUse = Ui.Label(t.box.rt, "inUse", Ui.Mono, 10, Ui.Paper, TextAnchor.MiddleCenter, FontStyle.Bold);
                t.inUse.text = "in use";
                tiles.Add(t);
            }
            var tile = tiles[tilesUsed++];
            tile.box.Show(true);
            bool on = B(c, "on"), empty = B(c, "empty"), inUse = B(c, "inUse");
            float lift = on ? 2 : 0, px = x + (w - side) / 2 - lift;
            Ui.Place(tile.box.rt, px, y - lift, side, side);
            tile.box.SetFill(empty ? Ui.Hex("#2b211f", 0.03f) : on ? Ui.Gold : Ui.Hex("#f6e9c8"));
            if (tile.box.border) tile.box.border.color = empty ? Ui.Hex("#2b211f", 0.26f) : inUse ? Ui.Red : Ui.Ink;
            tile.box.shadow.enabled = on; tile.box.SetShadow(on ? 4 : 0, on ? 4 : 0);
            Show(tile.ring, on);
            if (on) { tile.ring.rectTransform.anchorMin = Vector2.zero; tile.ring.rectTransform.anchorMax = Vector2.one; tile.ring.rectTransform.offsetMin = new Vector2(-6, -6); tile.ring.rectTransform.offsetMax = new Vector2(6, 6); tile.ring.color = Ui.Hex("#c8483a", 0.85f); }
            var tex = empty ? null : Picture(c.S("pic"));
            Show(tile.pic, tex != null);
            if (tex != null) { tile.pic.texture = tex; float ps = side * 0.86f; Ui.Place(tile.pic.rectTransform, (side - ps) / 2, (side - ps) / 2, ps, ps); }
            Show(tile.mark, tex == null && !empty);
            if (tex == null && !empty) { tile.mark.text = c.S("mark") ?? "✧"; tile.mark.fontSize = Mathf.RoundToInt(side * 0.42f); Ui.Place(tile.mark.rectTransform, 0, 0, side, side); }
            Show(tile.inUse, inUse);
            if (inUse) { Ui.Place(tile.inUse.rectTransform, side / 2 - 28, side - 8, 56, 15); }
            Show(tile.name, !empty);
            if (!empty) { tile.name.text = c.S("text") ?? ""; Ui.Place(tile.name.rectTransform, (side - w) / 2 + lift, side + 5 + lift, w, 30); }
        }

        void Update()
        {
            if (!root) return;
            var canvas = root.GetComponent<Canvas>();
            if (W > 0) BridgeHost.menuWidth = W;
            float pd = Mathf.Max(0.2f, cam.nearClipPlane * 2);
            if (!Mathf.Approximately(canvas.planeDistance, pd)) canvas.planeDistance = pd;
            bool open = state != null;
            if (root.gameObject.activeSelf != open) root.gameObject.SetActive(open);
            if (!open || !dirty) return;
            dirty = false;
            Draw();
        }

        void Draw()
        {
            used = 0; tilesUsed = 0;
            foreach (var l in new[] { logo, head, sub, version, hint, note, empty, tabPrev, tabNext }) Show(l, false);
            // (the shop's sheet sets these its own way: back to theirs)
            tabNext.fontSize = Small; sub.fontStyle = FontStyle.Normal;
            foreach (var l in tabs) Show(l, false);
            Show(tabLine, false);
            strip.Show(false); card.Show(false); ask.Show(false); mapBox.Show(false);
            foreach (var m in marks) { Show(m.dot, false); Show(m.name, false); }
            var kind = state.S("kind");
            if (kind == "title") DrawTitle(); else if (kind == "start") DrawStart(); else if (kind == "shop") DrawShop(); else DrawGame();
            for (int i = used; i < cells.Count; i++) cells[i].box.Show(false);
            for (int i = tilesUsed; i < tiles.Count; i++) tiles[i].box.Show(false);
            // the buttons' prompts, at the foot on the right
            var h = state.S("hint") ?? "";
            Show(hint, h.Length > 0);
            if (h.Length > 0) { hint.text = h; Ui.Place(hint.rectTransform, 24, H - 34, W - 48, 22); }
            hint.transform.SetAsLastSibling();
        }

        void Sheet(float x, float y, float w, float h, bool dimmed)
        {
            dim.color = dimmed ? Dim : Ui.Page;
            Ui.Place(sheet.rt, x, y, w, h);
            sheet.Show(true);
        }

        void Head(string text, float x, float y, float w)
        {
            if (string.IsNullOrEmpty(text)) return;
            Show(head, true);
            var s = Ui.Set(head, Ui.Upper(text), w);
            Ui.Place(head.rectTransform, x, y, w, s.y);
        }

        // ------------------------------------------------------------------ the title

        void DrawTitle()
        {
            var screen = state.S("screen");
            Sheet(0, 0, W, H, false);
            sheet.Show(false);
            dim.color = Ui.Page;
            Show(version, true);
            version.text = state.S("version") ?? "";
            Ui.Place(version.rectTransform, 24, H - 30, 200, 18);
            var starting = state.S("starting");
            if (screen == "main" || starting != null)
            {
                Show(logo, true);
                logo.text = state.S("logo") ?? "HIRAETH";
                Ui.Place(logo.rectTransform, 0, H * 0.16f, W, 110);
                if (starting != null)
                {
                    Show(note, true);
                    note.text = starting.Length > 0 ? starting + " …" : "…";
                    Ui.Place(note.rectTransform, 0, H * 0.6f, W, 30);
                    return;
                }
                var rows = state.L("rows") ?? new List<object>();
                float w = Mathf.Min(340, W - 80), y = H * 0.56f;
                foreach (var o in rows)
                {
                    var r = o as Dictionary<string, object>;
                    float h = B(r, "primary") && !string.IsNullOrEmpty(r.S("sub")) ? 56 : 42;
                    Entry(W / 2 - w / 2, y, w, h, r.S("text"), r.S("sub"), null, B(r, "on"), size: B(r, "primary") ? 22 : Body);
                    y += h + 6;
                }
                return;
            }
            // Saves and Settings: a sheet with its heading and its list
            float sw = Mathf.Min(820, W - 48), sx = W / 2 - sw / 2, sy = 34, sh = H - 34 - 54;
            Sheet(sx, sy, sw, sh, false);
            dim.color = Ui.Hex("#e9d9b3");
            Head(state.S("head"), sx + 24, sy + 18, sw - 48);
            if (screen == "settings") { DrawSettings(state.O("page")?.L("rows"), sx + 24, sy + 60, sw - 48, sh - 76); return; }
            var list = state.L("rows") ?? new List<object>();
            float top = sy + 60, avail = sh - 76;
            var hs = new List<float>();
            int onAt = 0;
            for (int i = 0; i < list.Count; i++)
            {
                var r = list[i] as Dictionary<string, object>;
                hs.Add(r.Has("note") && !string.IsNullOrEmpty(r.S("note")) ? 66 : !string.IsNullOrEmpty(r.S("sub2")) ? 62 : !string.IsNullOrEmpty(r.S("sub")) ? 50 : 38);
                if (B(r, "on")) onAt = i;
            }
            float y0 = Scroll(hs, onAt, avail);
            float yy = top - y0;
            for (int i = 0; i < list.Count; i++)
            {
                var r = list[i] as Dictionary<string, object>;
                float h = hs[i];
                if (yy + h > top - 1 && yy < top + avail - 2)
                {
                    var under = string.Join("\n", new[] { r.S("sub"), r.S("sub2"), r.S("note") }.Where(s => !string.IsNullOrEmpty(s)));
                    var val = r.S("when") ?? "";
                    if (r.S("fold") is string fold && fold.Length > 0) val = (fold == "open" ? "▴ " : "▾ ") + (r.S("tag") ?? "");
                    Entry(sx + 24, yy, sw - 48, h - 4, r.S("text"), under, val, B(r, "on"), size: B(r, "back") ? Small + 2 : Body, boxed: !B(r, "back"));
                }
                yy += h;
            }
            var a = state.O("ask");
            if (a != null) DrawAsk(a);
        }

        /// <summary>How far a list of rows (their heights) is scrolled so the one at `at` shows in `avail`.</summary>
        static float Scroll(List<float> hs, int at, float avail)
        {
            float total = 0, top = 0;
            for (int i = 0; i < hs.Count; i++) { if (i == at) top = total; total += hs[i]; }
            if (total <= avail) return 0;
            float h = at < hs.Count ? hs[at] : 0;
            return Mathf.Clamp(top + h / 2 - avail / 2, 0, total - avail);
        }

        // ------------------------------------------------------------------ a shop (engine/menus.js shopView; issue #264)

        /// <summary>
        /// A keeper's sheet over the dimmed world, as the web's shop panel (src/shop-panel.js): their name and title, what
        /// they say now, the wallet (chimes, or the fragments you hold at Anselm's) at the top right; the wares a list,
        /// each its picture (Anselm's: the items' own), name, what it does and how many, the price or why not on the
        /// right; the question over it all.
        /// </summary>
        void DrawShop()
        {
            float sw = Mathf.Min(900, W - 48), sx = W / 2 - sw / 2, sy = 30, sh = H - 30 - 50;
            Sheet(sx, sy, sw, sh, true);
            Head(state.S("head"), sx + 24, sy + 16, sw * 0.6f);
            Show(sub, true); sub.fontStyle = FontStyle.Italic;
            var ss = Ui.Set(sub, state.S("sub") ?? "", sw * 0.6f);
            Ui.Place(sub.rectTransform, sx + 24, sy + 46, sw * 0.6f, ss.y);
            var line = state.S("line") ?? "";
            Show(empty, line.Length > 0);
            float top = sy + 70;
            if (line.Length > 0)
            {
                empty.fontSize = Body;
                var ls = Ui.Set(empty, "“" + line + "”", sw - 48);
                Ui.Place(empty.rectTransform, sx + 24, top, sw - 48, ls.y);
                top += ls.y + 12;
            }
            // the wallet, top right
            Show(tabNext, true);
            tabNext.fontSize = 22;
            Ui.Set(tabNext, state.S("wallet") ?? "", 240);
            Ui.Place(tabNext.rectTransform, sx + sw - 24 - 240, sy + 16, 240, 30);
            var rows = state.L("rows") ?? new List<object>();
            var hs = new List<float>(); int at = 0;
            for (int i = 0; i < rows.Count; i++) { var r = rows[i] as Dictionary<string, object>; hs.Add(Fit(r, sw - 48)); if (B(r, "on")) at = i; }
            float avail = sy + sh - 16 - top, yy = top - Scroll(hs, at, avail);
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i] as Dictionary<string, object>;
                float rh = hs[i];
                if (yy + rh > top - 1 && yy < top + avail - 2)
                {
                    var pic = Picture(r.S("pic"));
                    var cell = Entry(sx + 24, yy, sw - 48, rh - 6, (pic != null ? "" : (r.S("mark") ?? "") + " ") + r.S("text"), r.S("sub"), r.S("val"), B(r, "on"), dimmed: !B(r, "ok"), boxed: true);
                    LinePicture(cell, pic, rh - 6, 44);   // (a ware's picture larger than a line's: the web's card shows it big)
                }
                yy += rh;
            }
            var ask = state.O("ask");
            if (ask != null) DrawAsk(ask);

            // (a ware as tall as its words: its name, then what it does and how many under it)
            float Fit(Dictionary<string, object> r, float w)
            {
                float vw = Mathf.Min(w * 0.3f, 180), tw = w - 28 - vw - 8 - (string.IsNullOrEmpty(r.S("pic")) ? 0 : 50);
                meas.fontSize = Body; meas.fontStyle = FontStyle.Bold; meas.lineSpacing = 1;
                float th = Ui.Measure(meas, r.S("text") ?? "", tw).y;
                meas.fontSize = Small; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1.2f;
                float sh2 = string.IsNullOrEmpty(r.S("sub")) ? 0 : Ui.Measure(meas, r.S("sub"), tw).y + 1;
                meas.lineSpacing = 1;
                return Mathf.Max(string.IsNullOrEmpty(r.S("pic")) ? 52 : 60, 5 + th + sh2 + 14);
            }
        }

        void DrawAsk(Dictionary<string, object> a)
        {
            ask.Show(true);
            ask.rt.SetAsLastSibling();
            float w = Mathf.Min(520, W - 60), x = W / 2 - w / 2;
            var q = Ui.Set(askQ, a.S("q"), w - 40);
            Ui.Place(askQ.rectTransform, 20, 20, w - 40, q.y);
            var wt = string.Join("\n", new[] { a.S("what"), a.S("undone") }.Where(s => !string.IsNullOrEmpty(s)));
            var ws = Ui.Set(askWhat, wt, w - 40);
            Ui.Place(askWhat.rectTransform, 20, 26 + q.y, w - 40, ws.y);
            float by = 40 + q.y + ws.y, bw = (w - 60) / 2;
            int on = a.I("on");
            askNo.text = a.S("no"); askYes.text = a.S("yes");
            askNo.fontStyle = on == 0 ? FontStyle.Bold : FontStyle.Normal; askYes.fontStyle = on == 1 ? FontStyle.Bold : FontStyle.Normal;
            askNo.color = on == 0 ? Ui.Ink : Muted; askYes.color = on == 1 ? Ui.Red : Muted;
            Ui.Place(askNo.rectTransform, 20, by, bw, 36); Ui.Place(askYes.rectTransform, 40 + bw, by, bw, 36);
            Ui.Place(ask.rt, x, H / 2 - (by + 56) / 2, w, by + 56);
        }

        void DrawSettings(List<object> rows, float x, float y, float w, float h, bool plain = false)
        {
            rows ??= new List<object>();
            // (a row as tall as its words: the Controls page's lines wrap, what they are and how, side by side; a line of
            // What's new across the page; a setting or a verb one line, its note under it while the pad is on it)
            var hs = new List<float>(); int at = 0;
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i];
                float rh = 44;
                if (plain || B(r, "plain"))
                {
                    float tw = B(r, "wide") ? Ui.Measure(meas, r.S("text") ?? "", w - 28).y : Ui.Measure(meas, r.S("text") ?? "", w * 0.5f - 28).y;
                    float vw = B(r, "wide") ? 0 : Ui.Measure(meas, r.S("val") ?? "", w * 0.45f).y;
                    rh = Mathf.Max(28, Mathf.Max(tw, vw) + 12) + (B(r, "head") ? 8 : 0);
                }
                else if (B(r, "on") && !string.IsNullOrEmpty(r.S("note"))) rh += 18;
                hs.Add(rh);
                if (B(r, "on")) at = i;
            }
            float yy = y - Scroll(hs, at, h);
            for (int i = 0; i < rows.Count; i++)
            {
                var r = rows[i] as Dictionary<string, object>;
                float rh = hs[i];
                if (yy + rh > y - 1 && yy < y + h - 2)
                {
                    float sl = r.Get("slider") is double d ? (float)d : -1;
                    bool rowPlain = plain || B(r, "plain"), head = B(r, "head");
                    var c = Entry(x, yy + (head ? 8 : 0), w, rh - 4 - (head ? 8 : 0), r.S("text"), B(r, "on") ? r.S("note") : null, r.S("val"), B(r, "on"), sl, rowPlain && !head ? Small : Body);
                    if (head) c.text.fontStyle = FontStyle.Bold;
                    // (a verb moved off its own button: its button in red, as the web marks it)
                    c.val.color = B(r, "moved") ? Ui.Red : head ? Muted : Ui.Ink;
                }
                yy += rh;
            }
        }

        // ------------------------------------------------------------------ the Start menu

        void DrawStart()
        {
            float sx = 24, sy = 24, sw = W - 48, sh = H - 24 - 50;
            Sheet(sx, sy, sw, sh, true);
            Head(state.S("head"), sx + 24, sy + 16, sw - 48);
            float sideW = Mathf.Clamp(sw * 0.3f, 190, 280), top = sy + 60;
            var side = state.L("side") ?? new List<object>();
            float y = top;
            foreach (var o in side)
            {
                var e = o as Dictionary<string, object>;
                Entry(sx + 16, y, sideW, 38, (B(e, "sel") ? "› " : "  ") + e.S("text"), null, null, B(e, "on"));
                y += 42;
            }
            var page = state.O("page");
            float px = sx + 16 + sideW + 20, pw = sw - (px - sx) - 20;
            Show(sub, true);
            sub.fontStyle = FontStyle.Bold;
            Ui.Set(sub, Ui.Upper(page?.S("title") ?? ""), pw);
            Ui.Place(sub.rectTransform, px + 14, top - 2, pw, 20);
            // (what the page is for, under its title: the Controls page's "choose a verb, then press its new button")
            var pn = page?.S("note") ?? "";
            float noteH = 0;
            Show(empty, pn.Length > 0);
            if (pn.Length > 0) { empty.fontSize = Tiny; var ns = Ui.Set(empty, pn, pw - 28); noteH = ns.y + 6; Ui.Place(empty.rectTransform, px + 14, top + 20, pw - 28, ns.y); }
            else empty.fontSize = Body;
            var rows = page?.L("rows");
            DrawSettings(rows, px, top + 22 + noteH, pw, sh - (top - sy) - 40 - noteH);
        }

        // ------------------------------------------------------------------ the game menu

        void DrawGame()
        {
            float sx = 18, sy = 16, sw = W - 36, sh = H - 16 - 46;
            Sheet(sx, sy, sw, sh, true);
            // the tabs: the five panels' names, this one in ink with the red line under it; LB / RB at the sides
            var t = state.O("tabs");
            var names = t?.L("names") ?? new List<object>();
            int cur = t?.I("i") ?? 0, edge = t?.I("edge") ?? 0;
            float tw = (sw - 140) / Mathf.Max(1, names.Count), tx = sx + 70;
            for (int i = 0; i < names.Count && i < tabs.Count; i++)
            {
                var l = tabs[i]; Show(l, true);
                l.text = Ui.Upper(names[i] as string);
                l.fontStyle = i == cur ? FontStyle.Bold : FontStyle.Normal; l.color = i == cur ? Ui.Ink : Muted;
                Ui.Place(l.rectTransform, tx + i * tw, sy + 12, tw, 28);
                if (i == cur) { Show(tabLine, true); float lw = Mathf.Min(tw - 12, Ui.Measure(l, l.text).x); Ui.Place(tabLine.rectTransform, tx + i * tw + tw / 2 - lw / 2, sy + 40, lw, 3); }
            }
            Show(tabPrev, true); Show(tabNext, true);
            tabPrev.text = "◀ " + Key("prev", "LB"); tabNext.text = Key("next", "RB") + " ▶";
            tabPrev.color = edge < 0 ? Ui.Red : Ui.Ink; tabNext.color = edge > 0 ? Ui.Red : Ui.Ink;
            Ui.Place(tabPrev.rectTransform, sx + 14, sy + 12, 60, 28); Ui.Place(tabNext.rectTransform, sx + sw - 74, sy + 12, 60, 28);
            float top = sy + 56, bottom = sy + sh - 84, px = sx + 18, pw = sw - 36;
            var person = state.O("person");
            var full = state.O("full");
            var panel = state.S("panel");
            if (person != null) DrawPerson(person, px, top, pw, bottom - top);
            else if (panel == "map") DrawMap(px, top, pw, bottom - top);
            else DrawRows(panel, px, top, pw, bottom - top);
            // the strip: the cell's name, what it is, and what A / × does
            var s = state.O("strip");
            if (s != null && person == null)
            {
                strip.Show(true);
                Ui.Place(strip.rt, sx + 14, bottom + 6, sw - 28, 70);
                var ns = Ui.Set(stripName, s.S("name"), sw * 0.5f);
                Ui.Place(stripName.rectTransform, 12, 8, ns.x, ns.y);
                Ui.Set(stripSub, s.S("sub"), sw * 0.4f);
                Ui.Place(stripSub.rectTransform, 24 + ns.x, 11, sw * 0.4f, 18);
                Ui.Set(stripDesc, s.S("desc"), sw - 220);
                Ui.Place(stripDesc.rectTransform, 12, 34, sw - 220, 32);
                var act = s.S("act") ?? "";
                stripAct.text = act.Length > 0 ? Key("ok", "A") + "  " + act : "";
                Ui.Place(stripAct.rectTransform, sw - 28 - 190, 8, 176, 20);
            }
            if (full != null) DrawFull(full);
        }

        void DrawRows(string panel, float x, float y, float w, float h)
        {
            var rows = state.L("rows") ?? new List<object>();
            var cols = state.L("cols") ?? new List<object> { 1.0 };
            var colX = new List<float>(); float acc = 0;
            foreach (var c in cols) { colX.Add(acc); acc += (float)Json.Num(c); }
            colX.Add(acc);
            if (rows.Count == 0)
            {
                Show(empty, true); empty.fontSize = Body;
                Ui.Set(empty, state.S("empty") ?? "", w);
                Ui.Place(empty.rectTransform, x + 14, y + 10, w - 28, 60);
                return;
            }
            if (panel == "items")
            {
                // the gear's count and the wallet over the tiles
                Show(sub, true); sub.fontStyle = FontStyle.Bold;
                var chimes = state.Get("chimes") is double ch ? $"   ·   {ch:0} chimes" : "";
                Ui.Set(sub, $"GEAR  {state.I("gear")}/{state.I("slots")}{chimes}", w);
                Ui.Place(sub.rectTransform, x + 6, y - 2, w, 18);
                y += 20; h -= 20;
            }
            // a row's height by what is in it
            // (the gear's tiles: as wide as a column lets them, up to the web's 132 px, their names under them)
            float side = Mathf.Clamp(w / Mathf.Max(1, cols.Count) - 14, 56, 132);
            float RowH(List<object> row)
            {
                var k = (row.Count > 0 ? row[0] : null).S("kind");
                float baseH = panel == "quests" ? (k == "ended" ? 34 : 76) : panel == "items" ? (k == "item" || k == "empty" ? side + 42 : 34) : panel == "worlds" ? 58 : panel == "people" ? 56 : 36;
                return panel == "map" || panel == "worlds" ? Fit(row, baseH) : baseH;
            }
            // (a line as tall as its words: on the Retroid's 4:3 the Map's list is narrow, and a long mark's name ran onto
            // the next line's, issue #264; measured as Entry lays it out, its name in Body bold, the line under in Small)
            float Fit(List<object> row, float baseH)
            {
                if (row.Count != 1 || row[0] is not Dictionary<string, object> c) return baseH;
                float tw = w - 6 - 36;
                meas.fontSize = Body; meas.fontStyle = FontStyle.Bold; meas.lineSpacing = 1;
                float th = Ui.Measure(meas, c.S("text") ?? "", tw).y, sh = 0;
                var u = c.S("sub");
                if (!string.IsNullOrEmpty(u)) { meas.fontSize = Small; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1.2f; sh = Ui.Measure(meas, u, tw).y + 1; }
                meas.fontSize = Small; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1;
                return Mathf.Max(baseH, 5 + th + sh + 12);
            }
            var hs = new List<float>(); int at = 0;
            for (int r = 0; r < rows.Count; r++) { var row = rows[r] as List<object>; hs.Add(RowH(row)); foreach (var c in row) if (B(c, "on")) at = r; }
            float yy = y - Scroll(hs, at, h);
            for (int r = 0; r < rows.Count; r++)
            {
                var row = rows[r] as List<object>;
                float rh = hs[r];
                if (yy + rh > y - 1 && yy < y + h - 2)
                    foreach (var o in row)
                    {
                        var c = o as Dictionary<string, object>;
                        int col = Mathf.Clamp(c.I("col"), 0, cols.Count - 1), span = Mathf.Max(1, c.I("span", 1));
                        float cx = x + w * colX[col], cw = w * (colX[Mathf.Min(col + span, colX.Count - 1)] - colX[col]) - 6;
                        string text = c.S("text"), under = c.S("sub");
                        if (B(c, "inUse")) under = "in use";
                        if (!string.IsNullOrEmpty(c.S("step"))) under = (string.IsNullOrEmpty(under) ? "" : under + "\n") + "Next: " + c.S("step");
                        if (B(c, "tracked")) text = "◆ " + text;
                        if (c.S("done") == "done") text = "✓ " + text; else if (c.S("done") == "failed") text = "· " + text;
                        if (c.S("kind") == "item" || c.S("kind") == "empty") { DrawTile(cx, yy + 6, cw, side, c); continue; }
                        // (what you carry and the keepsakes: a line each, its small picture first)
                        var pic = Picture(c.S("pic"));
                        var cell = Entry(cx, yy, cw, rh - 6, (pic != null || string.IsNullOrEmpty(c.S("mark")) ? "" : c.S("mark") + " ") + text, under, null, B(c, "on"), size: c.S("kind") == "ended" ? Small : Body, dimmed: B(c, "off"), boxed: true);
                        cell.text.alignment = TextAnchor.UpperLeft;
                        LinePicture(cell, pic, rh - 6);
                    }
                yy += rh;
            }
        }

        void DrawMap(float x, float y, float w, float h)
        {
            var m = state.O("map");
            // (the map's shape, width over height: 1 a square, the engine's; a wider one as wide as the room lets it be, issue #272)
            float aspect = Mathf.Clamp(m?.F("aspect", 1) ?? 1, 0.5f, 3f);
            float mw = Mathf.Min(h * aspect, w * 0.58f), mh = mw / aspect;
            mapBox.Show(true);
            Ui.Place(mapBox.rt, x, y, mw, mh);
            // the ground under the marks (drawn once its rays are all in; until then how far they are)
            var key = m?.S("ground") ?? "";
            var ground = key.Length > 0 && grounds.TryGetValue(key, out var gt) ? gt : null;
            Show(mapGround, ground != null);
            if (ground != null) { mapGround.texture = ground; Ui.Place(mapGround.rectTransform, 0, 0, mw, mh); mapGround.transform.SetAsFirstSibling(); mapBox.fill.transform.SetAsFirstSibling(); }
            var drawing = m?.S("drawing") ?? "";
            Show(mapDrawing, ground == null && drawing.Length > 0);
            if (ground == null && drawing.Length > 0) { mapDrawing.text = drawing; Ui.Place(mapDrawing.rectTransform, 0, mh / 2 - 12, mw, 24); }
            // the scale bar at the foot, a round length
            var sc = m?.O("scale");
            Show(mapBar, sc != null); Show(mapScale, sc != null);
            if (sc != null) { float bw = mw * Mathf.Clamp01(sc.F("frac")); Ui.Place(mapBar.rectTransform, 16, mh - 18, bw, 3); mapScale.text = sc.S("label") ?? ""; Ui.Place(mapScale.rectTransform, 16, mh - 38, 160, 18); }
            var list = m?.L("marks") ?? new List<object>();
            while (marks.Count < list.Count)
            {
                var dot = Ui.Rect(mapBox.rt, Ui.Ink, 4, "mark"); var name = Ui.Label(mapBox.rt, "name", Ui.Mono, Tiny, Ui.Ink);
                marks.Add((dot, name));
            }
            for (int i = 0; i < list.Count; i++)
            {
                var k = list[i] as Dictionary<string, object>;
                var (dot, name) = marks[i];
                Show(dot, true); Show(name, true);
                float u = Mathf.Clamp01(k.F("u")), v = Mathf.Clamp01(k.F("v")), s = k.S("kind") == "you" ? 12 : 9;
                dot.color = k.S("kind") == "you" ? Ui.Red : k.S("kind") == "ship" ? Ui.Teal : k.S("kind") == "goal" ? Ui.Gold : Ui.Ink;
                Ui.Place(dot.rectTransform, u * mw - s / 2, v * mh - s / 2, s, s);
                bool on = B(k, "on");
                name.text = on || k.S("kind") == "you" || k.S("kind") == "ship" ? k.S("name") : "";
                name.fontStyle = on ? FontStyle.Bold : FontStyle.Normal;
                Ui.Place(name.rectTransform, u * mw + 8, v * mh - 8, 180, 16);
            }
            // the legend beside it: the rows
            Show(sub, true); sub.fontStyle = FontStyle.Bold;
            Ui.Set(sub, Ui.Upper(m?.S("world") ?? ""), w - mw - 20);
            Ui.Place(sub.rectTransform, x + mw + 20, y - 2, w - mw - 20, 18);
            DrawRows("map", x + mw + 14, y + 20, w - mw - 14, h - 20);
        }

        void DrawPerson(Dictionary<string, object> p, float x, float y, float w, float h)
        {
            Show(head, true);
            var ns = Ui.Set(head, p.S("name"), w);
            Ui.Place(head.rectTransform, x + 6, y, w, ns.y);
            Show(sub, true); sub.fontStyle = FontStyle.Italic;
            Ui.Set(sub, p.S("role"), w);
            Ui.Place(sub.rectTransform, x + 6, y + ns.y + 2, w, 18);
            var lines = new List<string>();
            foreach (var s in p.L("story") ?? new List<object>()) lines.Add(s as string);
            if (!string.IsNullOrEmpty(p.S("now"))) lines.Add("\n<b>NOW</b>\n" + p.S("now"));
            var between = p.L("between") ?? new List<object>();
            if (between.Count > 0) lines.Add("\n<b>BETWEEN YOU</b>\n" + string.Join("\n", between));
            var c = Entry(x, y + ns.y + 26, w, h - ns.y - 26, string.Join("\n", lines), null, null, false, size: Small, boxed: true);
            c.text.lineSpacing = 1.3f;
            var steps = (p.S("prev") is string pv && pv.Length > 0 ? "◀ " + pv : "") + "        " + (p.S("next") is string nx && nx.Length > 0 ? nx + " ▶" : "");
            Show(note, true); note.fontSize = Small; note.text = steps.Trim();
            Ui.Place(note.rectTransform, x, y + h + 10, w, 20);
        }

        void DrawFull(Dictionary<string, object> f)
        {
            card.Show(true);
            card.rt.SetAsLastSibling();
            float w = Mathf.Min(720, W - 80), x = W / 2 - w / 2, pad = 26, cw = w - pad * 2;
            // (a thing's picture large at the top right, the words beside it: the web's .gm-full .big)
            var tex = Picture(f.S("pic"));
            bool marked = tex == null && !string.IsNullOrEmpty(f.S("mark"));
            float big = tex != null || marked ? Mathf.Min(150, w * 0.26f) : 0;
            Show(cardPic, tex != null); Show(cardMark, marked);
            if (tex != null) { cardPic.texture = tex; Ui.Place(cardPic.rectTransform, w - pad - big, pad, big, big); }
            if (marked) { cardMark.text = f.S("mark"); Ui.Place(cardMark.rectTransform, w - pad - big, pad, big, big); }
            if (big > 0) cw -= big + 16;
            var ts = Ui.Set(cardTitle, f.S("title"), cw);
            Ui.Place(cardTitle.rectTransform, pad, pad, cw, ts.y);
            float y = pad + ts.y + 4;
            var sb = (f.S("sub") ?? "") + (B(f, "inUse") ? "  ·  in use" : "");
            var ss = Ui.Set(cardSub, sb, cw); Ui.Place(cardSub.rectTransform, pad, y, cw, ss.y); y += ss.y + 10;
            var tx = Ui.Set(cardText, f.S("text") ?? "", cw); Ui.Place(cardText.rectTransform, pad, y, cw, tx.y); y += tx.y + 10;
            var facts = new List<string>();
            foreach (var o in f.L("facts") ?? new List<object>()) { var k = o as Dictionary<string, object>; facts.Add((B(k, "on") ? "✓ " : "… ") + k.S("text") + (string.IsNullOrEmpty(k.S("list")) ? "" : "\n    " + k.S("list"))); }
            var fs = Ui.Set(cardFacts, string.Join("\n", facts), cw); Ui.Place(cardFacts.rectTransform, pad, y, cw, fs.y); y += fs.y + (facts.Count > 0 ? 12 : 0);
            var use = f.S("use") ?? "";
            var nt = f.S("note") ?? "";
            cardUse.text = (use.Length > 0 ? Key("ok", "A") + "  " + use : "") + (nt.Length > 0 ? (use.Length > 0 ? "\n" : "") + nt : "");
            var us = Ui.Measure(cardUse, cardUse.text, cw); Ui.Place(cardUse.rectTransform, pad, y, cw, us.y); y += us.y + 10;
            cardSteps.text = ((f.S("prev") is string pv && pv.Length > 0 ? "◀ " + pv : "") + "      " + (f.S("next") is string nx && nx.Length > 0 ? nx + " ▶" : "")).Trim();
            Ui.Place(cardSteps.rectTransform, pad, y, cw, 20); y += 28;
            y = Mathf.Max(y, pad + big + 20);
            Ui.Place(card.rt, x, Mathf.Max(20, H / 2 - y / 2), w, y);
        }
    }
}
