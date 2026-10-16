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
    public partial class BridgeMenu : MonoBehaviour
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
        // the Map's drawn ground (engine/game.js: the world's collision sampled straight down, drawn as the web's map) and
        // its sharper parts zoomed in, by key (the last few kept: each a few MB)
        readonly Dictionary<string, Texture2D> grounds = new();
        readonly Dictionary<string, int> groundUsed = new();
        // the Map as the web's (issue #343): the whole sheet, its ground on a plane the view scales and moves (z, u0, v0),
        // the marks as the web's pictures (StreamingAssets/hiraeth-js/map-marks, engine/map-marks.js), the cursor and the
        // name of the mark under it beside it, the world's name, north, the scale bar, the zoom's buttons, the note
        RectTransform mapClip, mapPlane; RawImage mapGround, mapDetail, mapCursor, mapNorth; Image mapEdge;
        Label mapDrawing, mapScale, mapNone, mapNote, mapName, zoomIn, zoomOut; Image mapBar; Ui.Box mapTip, mapNameBox, mapScaleBox, mapNoteBox, zoomInBox, zoomOutBox; Label mapTipName, mapTipSub;
        readonly List<(RawImage pic, RawImage ring)> markPics = new();
        readonly List<(RawImage area, Label label)> areaPics = new();   // (the rumours' circles and their names: issue #340)
        static readonly Dictionary<string, Texture2D> markTex = new();
        // the title (issue #346): the painted world behind it (title/<shot>.jpg, scripts/engine-bundle.mjs unityTitle: the web's
        // drawing of the shot, src/title-paint.js), the lettered name (title/logo.png, src/title-logo.js), the entries small,
        // low at the left as the web's (src/title-layout.js, the view's layout)
        RawImage titleArt, titleLogo; Ui.Box versionBox; Label line;
        static readonly Dictionary<string, Texture2D> titleTex = new();
        class TitleButton { public Ui.Box box; public Label text, sub; public Image accent; }
        readonly List<TitleButton> titleButtons = new();
        int titleUsed;
        // the game menu's tabs, the strip at the foot, a thing full screen, a question, the map's marks
        readonly List<Label> tabs = new();
        Label tabPrev, tabNext; Image tabLine;
        Ui.Box strip; Label stripName, stripSub, stripDesc, stripAct;
        Ui.Box card; Label cardTitle, cardSub, cardText, cardFacts, cardUse, cardSteps;
        Ui.Box ask; Label askQ, askWhat, askNo, askYes;
        Ui.Box mapBox;

        static readonly Color Muted = Ui.Hex("#5e4b45"), Band = Ui.Hex("#f2dfb4"), Dim = Ui.Hex("#1d1614", 0.62f);
        const int Body = 19, Small = 14, Tiny = 12;

        static bool B(object o, string k) => o.Get(k) is bool b && b;

        /// <summary>A thing's picture (StreamingAssets/hiraeth-js/item-pictures/id.png), or null where it has none.</summary>
        internal static Texture2D Picture(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (pictures.TryGetValue(id, out var t)) return t;
            var bytes = BridgeUpdates.ScriptFile(System.IO.Path.Combine("item-pictures", id + ".png"));
            if (bytes != null)
            {
                t = new Texture2D(2, 2, TextureFormat.RGBA32, false) { name = "item " + id, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
                if (!t.LoadImage(bytes, true)) { Destroy(t); t = null; }
            }
            pictures[id] = t;
            return t;
        }
        /// <summary>A picture of StreamingAssets/hiraeth-js (the title's, the Map's marks), read once; null where there is none.</summary>
        static Texture2D Streamed(Dictionary<string, Texture2D> cache, string rel)
        {
            if (cache.TryGetValue(rel, out var t)) return t;
            var bytes = BridgeUpdates.ScriptFile(rel);
            if (bytes != null)
            {
                t = new Texture2D(2, 2, TextureFormat.RGBA32, true) { name = rel, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear };
                if (!t.LoadImage(bytes, true)) { Destroy(t); t = null; }
            }
            cache[rel] = t;
            return t;
        }
        static Texture2D Mark(string kind) => Streamed(markTex, "map-marks/" + kind + ".png");

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
            // (the last few kept: the whole map is named at every look, a zoom's part while it is in view)
            while (grounds.Count >= 8)
            {
                string old = null; int at = int.MaxValue;
                foreach (var k in grounds.Keys) { int u = groundUsed.TryGetValue(k, out var f) ? f : 0; if (u < at) { at = u; old = k; } }
                if (old == null) break;
                Destroy(grounds[old]); grounds.Remove(old); groundUsed.Remove(old);
            }
            grounds[key] = t; groundUsed[key] = Time.frameCount;
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
            titleArt = Ui.Node("title art", root).gameObject.AddComponent<RawImage>(); titleArt.raycastTarget = false;
            titleLogo = Ui.Node("title logo", root).gameObject.AddComponent<RawImage>(); titleLogo.raycastTarget = false;
            versionBox = Ui.Panel(root, "version box", Ui.Hex("#f7ecd2", 0.7f), Ui.Ink, 0);
            sheet = Ui.Panel(root, "sheet", Ui.Page, Ui.Ink, 2.5f, 6, 6);
            logo = Ui.Label(root, "logo", Ui.Heavy, 76, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold);
            Ui.Space(logo, 0.18f);
            head = Ui.Label(root, "head", mono, 22, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
            sub = Ui.Label(root, "sub", mono, Small, Muted);
            version = Ui.Label(versionBox.rt, "version", mono, 11, Ui.Ink);
            line = Ui.Label(root, "save line", mono, Small, Muted);
            hint = Ui.Label(root, "hint", mono, Small, Ui.Ink, TextAnchor.LowerRight);
            note = Ui.Label(root, "note", mono, Body, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Italic);
            empty = Ui.Label(root, "empty", mono, Body, Muted, TextAnchor.UpperLeft, FontStyle.Italic);
            meas = Ui.Label(root, "measure", mono, Small, Color.clear);   // (the Controls page's rows measured with it, never shown)
            Ui.Place(meas.rectTransform, -4000, 0, 10, 10);
            for (int i = 0; i < 5; i++) tabs.Add(Ui.Label(root, "tab" + i, mono, Body, Muted, TextAnchor.MiddleCenter));
            tabPrev = Ui.Label(root, "tabPrev", mono, Small, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            tabNext = Ui.Label(root, "tabNext", mono, Small, Ui.Ink, TextAnchor.MiddleRight, FontStyle.Bold);
            tabLine = Ui.Rect(root, Ui.Red, 0, "tabLine");
            // the Map's sheet (src/game-menu.css .gm-mapsheet: its paper, a 2.5 ink edge, a hard ink shadow), what is on it clipped to it
            mapBox = Ui.Panel(root, "map", Ui.Hex("#f6ecd3"), Ui.Ink, 0, 6, 6);
            mapClip = Ui.Stretch(Ui.Node("clip", mapBox.rt)); mapClip.gameObject.AddComponent<RectMask2D>();
            mapPlane = Ui.Node("plane", mapClip);
            mapGround = Ui.Stretch(Ui.Node("ground", mapPlane)).gameObject.AddComponent<RawImage>(); mapGround.raycastTarget = false;
            mapGround.uvRect = new Rect(0, 1, 1, -1);   // (its rows top down: Unity's textures start at the bottom)
            mapDetail = Ui.Node("detail", mapPlane).gameObject.AddComponent<RawImage>(); mapDetail.raycastTarget = false;
            mapDetail.uvRect = new Rect(0, 1, 1, -1);
            mapDrawing = Ui.Label(mapClip, "drawing", mono, Body, Muted, TextAnchor.MiddleCenter, FontStyle.Italic);
            mapNone = Ui.Label(mapClip, "none", mono, Small, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Italic);
            mapNameBox = Ui.Panel(mapClip, "name", Ui.Hex("#fbf4e2", 0.85f), Ui.Ink, 0, 0, 0, 3);
            mapName = Ui.Label(mapNameBox.rt, "text", mono, 16, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            mapNorth = Ui.Node("north", mapClip).gameObject.AddComponent<RawImage>(); mapNorth.raycastTarget = false;
            mapScaleBox = Ui.Panel(mapClip, "scale", Ui.Hex("#fbf4e2", 0.85f), Ui.Ink, 0, 0, 0, 3);
            mapBar = Ui.Rect(mapScaleBox.rt, Ui.Ink, 0, "scaleBar");
            for (int i = 0; i < 2; i++) Ui.Rect(mapBar.rectTransform, Ui.Hex("#fbf4e2"), 0, "paper" + i);
            mapScale = Ui.Label(mapScaleBox.rt, "label", mono, Tiny, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold);
            mapNoteBox = Ui.Panel(mapClip, "note", Ui.Hex("#fbf4e2", 0.85f), Ui.Ink, 0, 0, 0, 3);
            mapNote = Ui.Label(mapNoteBox.rt, "text", mono, 13, Ui.Hex("#3f8fa6"), TextAnchor.MiddleLeft, FontStyle.Bold);
            zoomInBox = Ui.Panel(mapClip, "zoom in", Ui.Hex("#fbf4e2"), Ui.Ink, 2, 2, 2, 4); zoomIn = Ui.Label(zoomInBox.rt, "k", mono, 13, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(zoomIn.rectTransform);
            zoomOutBox = Ui.Panel(mapClip, "zoom out", Ui.Hex("#fbf4e2"), Ui.Ink, 2, 2, 2, 4); zoomOut = Ui.Label(zoomOutBox.rt, "k", mono, 13, Ui.Ink, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Stretch(zoomOut.rectTransform);
            mapCursor = Ui.Node("cursor", mapClip).gameObject.AddComponent<RawImage>(); mapCursor.raycastTarget = false;
            mapTip = Ui.Panel(mapClip, "tip", new Color(31 / 255f, 24 / 255f, 22 / 255f, 0.92f), Ui.Ink, 0, 0, 0, 4);
            mapTipName = Ui.Label(mapTip.rt, "name", mono, 15, Ui.Hex("#f7ecd2"), TextAnchor.UpperLeft, FontStyle.Bold);
            mapTipSub = Ui.Label(mapTip.rt, "sub", mono, 13, Ui.Hex("#f7ecd2", 0.85f), TextAnchor.UpperLeft);
            mapEdge = Ui.Fill(mapBox.rt, Ui.Ink, 0, "edge"); mapEdge.sprite = Ui.Frame(2.5f, 0); mapEdge.type = Image.Type.Sliced; mapEdge.pixelsPerUnitMultiplier = 2;
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
            BuildCard(mono);
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
            if (W > 0) { var (aw, ah) = MapRoom(); var box = string.Format(System.Globalization.CultureInfo.InvariantCulture, "{0:0},{1:0}", aw, ah); if (BridgeHost.menuMapBox != box) BridgeHost.menuMapBox = box; }
            float pd = Mathf.Max(0.2f, cam.nearClipPlane * 2);
            if (!Mathf.Approximately(canvas.planeDistance, pd)) canvas.planeDistance = pd;
            bool open = state != null;
            if (root.gameObject.activeSelf != open) root.gameObject.SetActive(open);
            bool star = open && state.S("kind") == "starmap" && smRoot && smRoot.gameObject.activeSelf;
            // (the galactic map: only its scanner, its meter and a resolving planet moved, the chart as it was; its
            // animations every frame)
            if (star && dirty && Mathf.Approximately(state.F("cv"), smCv)) { dirty = false; smView = state; StarScanner(); }
            if (star) StarAnimate();
            if (!open || !dirty) return;
            dirty = false;
            Draw();
        }

        void Draw()
        {
            used = 0; tilesUsed = 0;
            foreach (var l in new[] { logo, head, sub, hint, note, empty, tabPrev, tabNext, line }) Show(l, false);
            versionBox.Show(false); Show(titleArt, false); Show(titleLogo, false); titleUsed = 0;
            // (the shop's sheet sets these its own way: back to theirs)
            tabNext.fontSize = Small; sub.fontStyle = FontStyle.Normal; line.fontStyle = FontStyle.Normal; line.color = Muted;   // (and the Arena list's filter: DrawFoes)
            foreach (var l in tabs) Show(l, false);
            Show(tabLine, false);
            strip.Show(false); card.Show(false); ask.Show(false); mapBox.Show(false); cSheet.Show(false);
            foreach (var (pic, ring) in markPics) { Show(pic, false); Show(ring, false); }
            foreach (var (area, label) in areaPics) { Show(area, false); Show(label, false); }
            var kind = state.S("kind");
            if (smRoot && kind != "starmap") { Show(smRoot, false); smView = null; smCv = -1; }
            if (kind == "title") DrawTitle(); else if (kind == "start") DrawStart(); else if (kind == "shop") DrawShop(); else if (kind == "card") DrawCard(); else if (kind == "foes") DrawFoes(); else if (kind == "starmap") DrawStarMap(); else DrawGame();
            for (int i = used; i < cells.Count; i++) cells[i].box.Show(false);
            for (int i = tilesUsed; i < tiles.Count; i++) tiles[i].box.Show(false);
            for (int i = titleUsed; i < titleButtons.Count; i++) titleButtons[i].box.Show(false);
            // the buttons' prompts, at the foot on the right
            var h = state.S("hint") ?? "";
            Show(hint, h.Length > 0);
            // (on the title the version takes the corner, the buttons' prompts over it)
            if (h.Length > 0) { hint.text = h; Ui.Place(hint.rectTransform, 24, kind == "title" ? H - 52 : H - 34, W - 48, 22); }
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

        /// <summary>The title's painted world over the whole canvas, cropped to its shape as the page's object-fit: cover.</summary>
        bool TitleArt(string shot)
        {
            var tex = string.IsNullOrEmpty(shot) ? null : Streamed(titleTex, "title/" + shot + ".jpg");
            Show(titleArt, tex != null);
            if (tex == null) return false;
            titleArt.texture = tex;
            float ta = (float)tex.width / Mathf.Max(1, tex.height), a = W / Mathf.Max(1, H);
            titleArt.uvRect = a < ta ? new Rect((1 - a / ta) / 2, 0, a / ta, 1) : new Rect(0, (1 - ta / a) / 2, 1, ta / a);
            Ui.Place(titleArt.rectTransform, 0, 0, W, H);
            return true;
        }

        /// <summary>
        /// One of the title's entries as the web's (src/menus.css #title .main-menu button): paper, a thin ink line, a small
        /// vermilion shadow, the words in small spaced capitals (what it continues under them); the pad's in vermilion with
        /// the shadow in ink; the first (Continue, New game) marked by a vermilion edge at its left.
        /// </summary>
        void TitleEntry(float x, float y, float w, float h, float font, string text, string under, bool on, bool primary)
        {
            if (titleUsed >= titleButtons.Count)
            {
                var b = new TitleButton { box = Ui.Panel(root, "title entry" + titleButtons.Count, Ui.Hex("#fbe8c4", 0.9f), Ui.Hex("#211a17"), 1.5f, 2, 2, 3, Ui.Hex("#e27c5b")) };
                b.accent = Ui.Rect(b.box.rt, Ui.Hex("#e27c5b"), 0, "edge");
                b.text = Ui.Label(b.box.rt, "text", Ui.Sans, 14, Ui.Hex("#211a17"), TextAnchor.UpperLeft, FontStyle.Bold);
                Ui.Space(b.text, 0.14f);
                b.sub = Ui.Label(b.box.rt, "sub", Ui.Sans, 11, Ui.Hex("#211a17", 0.78f), TextAnchor.UpperLeft);
                titleButtons.Add(b);
            }
            var e = titleButtons[titleUsed++];
            e.box.Show(true);
            float lift = on ? 1 : 0;
            Ui.Place(e.box.rt, x - lift, y - lift, w, h);
            e.box.SetFill(on ? Ui.Hex("#e27c5b") : Ui.Hex("#fbe8c4", 0.9f));
            e.box.shadow.color = on ? Ui.Hex("#211a17") : Ui.Hex("#e27c5b");
            e.box.SetShadow(on ? 3 : 2, on ? 3 : 2);
            Show(e.accent, primary);
            if (primary) { e.accent.color = on ? Ui.Hex("#211a17") : Ui.Hex("#e27c5b"); Ui.Place(e.accent.rectTransform, 0, 0, 4, h); }
            var ink = on ? Ui.Hex("#fffaf0") : Ui.Hex("#211a17");
            int fs = Mathf.RoundToInt(font);
            e.text.fontSize = fs; e.text.color = ink;
            e.sub.fontSize = Mathf.Max(10, Mathf.RoundToInt(font * 0.72f)); e.sub.color = new Color(ink.r, ink.g, ink.b, 0.78f);
            bool hasSub = !string.IsNullOrEmpty(under);
            float pad = font * 1.05f + (primary ? 4 : 0), th = fs * 1.25f, sh = hasSub ? e.sub.fontSize * 1.3f : 0, top = (h - th - sh) / 2;
            e.text.text = Ui.Upper(text);
            Ui.Place(e.text.rectTransform, pad, top, w - pad * 2, th);
            Show(e.sub, hasSub);
            if (hasSub) { e.sub.text = under; Ui.Place(e.sub.rectTransform, pad, top + th, w - pad * 2, sh); }
        }

        void DrawTitle()
        {
            var screen = state.S("screen");
            Sheet(0, 0, W, H, false);
            sheet.Show(false);
            dim.color = Ui.Page;
            bool art = TitleArt(state.S("shot"));
            // the version, in the corner on a little paper
            var ver = state.S("version") ?? "";
            versionBox.Show(ver.Length > 0);
            if (ver.Length > 0) { var vs = Ui.Set(version, ver, 200); Ui.Place(version.rectTransform, 6, 1, vs.x, 15); Ui.Place(versionBox.rt, W - 12 - (vs.x + 12), H - 8 - 17, vs.x + 12, 17); }
            var starting = state.S("starting");
            var lay = state.O("layout");
            if (screen == "main" || starting != null)
            {
                // the name as src/title-logo.js letters it, across the top (the layout's), or in plain capitals where its picture is missing
                var lg = lay?.O("logo");
                var lt = Streamed(titleTex, "title/logo.png");
                if (lt != null && lg != null)
                {
                    Show(titleLogo, true); titleLogo.texture = lt;
                    float lw = lg.F("w"), lh = lg.F("h"), k = Mathf.Min(lw / lt.width, lh / lt.height), pw = lt.width * k, ph = lt.height * k;
                    Ui.Place(titleLogo.rectTransform, lg.F("x") + (lw - pw) / 2, lg.F("y") + (lh - ph) / 2, pw, ph);
                }
                else { Show(logo, true); logo.text = state.S("logo") ?? "HIRAETH"; Ui.Place(logo.rectTransform, 0, H * 0.16f, W, 110); }
                var mn = lay?.O("menu");
                float mx = mn?.F("x", 48) ?? 48, my = mn?.F("y", H * 0.6f) ?? H * 0.6f, mw = Mathf.Max(220, mn?.F("w", 240) ?? 240), bh = mn?.F("button", 44) ?? 44, gap = mn?.F("gap", 8) ?? 8, font = mn?.F("font", 14.5f) ?? 14.5f;
                if (starting != null)
                {
                    Show(note, true);
                    note.text = starting.Length > 0 ? starting + " …" : "…";
                    note.alignment = TextAnchor.MiddleLeft; note.fontSize = Body;
                    Ui.Place(note.rectTransform, mx, my, W - mx - 24, 30);
                    return;
                }
                var rows = state.L("rows") ?? new List<object>();
                // (the column ends where the web's does, low on the left: taller entries, those with a line under, grow it upwards)
                float total = 0; foreach (var o in rows) total += (string.IsNullOrEmpty(o.S("sub")) ? bh : Mathf.Max(bh, font * 2.3f + 10)) + gap;
                float y = Mathf.Min(my, H - 56 - total);
                foreach (var o in rows)
                {
                    var r = o as Dictionary<string, object>;
                    float h = string.IsNullOrEmpty(r.S("sub")) ? bh : Mathf.Max(bh, font * 2.3f + 10);
                    TitleEntry(mx, y, mw, h, font, r.S("text"), r.S("sub"), B(r, "on"), B(r, "primary"));
                    y += h + gap;
                }
                note.alignment = TextAnchor.MiddleCenter;
                return;
            }
            // Saves and Settings: a sheet with its heading and its list
            float sw = Mathf.Min(820, W - 48), sx = W / 2 - sw / 2, sy = 34, sh = H - 34 - 54;
            Sheet(sx, sy, sw, sh, false);
            dim.color = Ui.Hex("#e9d9b3");   // (under the painted world when it shows: the sheet over it)
            Head(state.S("head"), sx + 24, sy + 18, sw - 48);
            // (Settings, and Updates in a player that updates its script: engine/menus.js, BridgeUpdates)
            if (screen == "settings" || screen == "updates") { DrawSettings(state.O("page")?.L("rows"), sx + 24, sy + 60, sw - 48, sh - 76); return; }
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

        // ------------------------------------------------------------------ a game's card

        // a trial's or a game's card (engine/menus.js cardView: src/minigames/kit/runner.js cardModel; the web's
        // src/minigames/kit/minigames.css .mg-card .sheet): the start card, the pause, the results, on the game's paper with a
        // hard ink shadow; its kicker, its name in heavy capitals, its blurb, the rules in a dashed box, the controls in two
        // columns, the options' rows, the score big and "New best!" stamped, the lines, the best, the buttons (the main one
        // gold, the pad's in bright gold with a red edge), the keys' hint at the foot
        Ui.Box cSheet, cRules, cStamp; Label cKicker, cTitle, cLead, cText, cRulesText, cBig, cStampText, cLines, cExtra, cBest, cHint;
        class CardButton { public Ui.Box box; public Label text, sub; }
        readonly List<CardButton> cButtons = new();
        readonly List<(Label k, Label v)> cRows = new();
        readonly List<(Ui.Box box, Label label, Label val, Label hint)> cOpts = new();
        static readonly Color CardKicker = Ui.Hex("#8a5a3c"), CardDd = Ui.Hex("#4a3b33"), CardMuted = Ui.Hex("#6b5a4e"), CardStamp = Ui.Hex("#d9643a");

        void BuildCard(Font mono)
        {
            cSheet = Ui.Panel(root, "game card", Ui.Page, Ui.Ink, 2, 7, 7);
            cKicker = Ui.Label(cSheet.rt, "kicker", mono, 12, CardKicker); Ui.Space(cKicker, 0.18f);
            cTitle = Ui.Label(cSheet.rt, "title", Ui.Heavy, 27, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold, 1.1f); Ui.Space(cTitle, 0.12f);
            cLead = Ui.Label(cSheet.rt, "lead", mono, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Italic, 1.35f);
            cText = Ui.Label(cSheet.rt, "text", mono, 15, Ui.Ink, lineSpacing: 1.35f);
            cRules = Ui.Panel(cSheet.rt, "rules", Ui.CardC, Ui.Ink, 1.5f);
            cRulesText = Ui.Label(cRules.rt, "text", mono, 14, Ui.Ink, lineSpacing: 1.35f);
            cBig = Ui.Label(cSheet.rt, "big", Ui.Heavy, 48, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold, 1f);
            cStamp = Ui.Panel(cSheet.rt, "stamp", Ui.Page, CardStamp, 3);
            cStampText = Ui.Label(cStamp.rt, "text", mono, 15, CardStamp, TextAnchor.MiddleCenter, FontStyle.Bold); Ui.Space(cStampText, 0.12f); Ui.Stretch(cStampText.rectTransform);
            cLines = Ui.Label(cSheet.rt, "lines", mono, 14, CardDd, lineSpacing: 1.35f);
            cExtra = Ui.Label(cSheet.rt, "extra", mono, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Italic, 1.35f);
            cBest = Ui.Label(cSheet.rt, "best", mono, 13, CardMuted);
            cHint = Ui.Label(cSheet.rt, "hint", mono, 12, CardMuted);
            cSheet.Show(false);
        }

        /// <summary>A label at (x, y) of the card, wrapped at w, shown only with words: returns the y under it.</summary>
        float CardPut(Label l, string s, float x, float y, float w)
        {
            bool on = !string.IsNullOrEmpty(s);
            Show(l, on);
            if (!on) return y;
            var sz = Ui.Set(l, s, w);
            Ui.Place(l.rectTransform, x, y, w, sz.y);
            return y + sz.y;
        }

        void DrawCard()
        {
            var c = state.O("card");
            if (c == null) return;
            var mono = Ui.Mono;
            // (the pause over the world held, barely dimmed, as the page's .mg-card.clear; the start and the results darker)
            dim.color = c.S("kind") == "paused" ? Ui.Hex("#2b211f", 0.12f) : Ui.Hex("#2b211f", 0.42f);
            sheet.Show(false);
            cSheet.Show(true);
            cSheet.rt.SetAsLastSibling();
            float sw = Mathf.Min(B(c, "wide") ? 760 : 560, W - 40), px = 26, iw = sw - 2 * px, y = 18;
            y = CardPut(cKicker, Ui.Upper(c.S("kicker")), px, y, iw) + 2;
            y = CardPut(cTitle, Ui.Upper(c.S("title")), px, y, iw - 120) + 8;
            var lead = c.O("lead");
            y = CardPut(cLead, lead == null ? null : $"{lead.S("name")} “{lead.S("text")}”", px, y, iw);
            if (lead != null) y += 8;
            y = CardPut(cText, c.S("text"), px, y, iw);
            if (!string.IsNullOrEmpty(c.S("text"))) y += 10;
            var rules = c.S("rules");
            cRules.Show(!string.IsNullOrEmpty(rules));
            if (!string.IsNullOrEmpty(rules))
            {
                var rs = Ui.Set(cRulesText, rules, iw - 20);
                Ui.Place(cRulesText.rectTransform, 10, 7, iw - 20, rs.y);
                Ui.Place(cRules.rt, px, y, iw, rs.y + 14);
                y += rs.y + 14 + 10;
            }
            // the controls: what to press, then what it does (the page's dl: dt bold, dd in brown ink)
            var rows = c.L("rows") ?? new List<object>();
            float kw = 0;
            while (cRows.Count < rows.Count) cRows.Add((Ui.Label(cSheet.rt, "key" + cRows.Count, mono, 14, Ui.Ink, TextAnchor.UpperLeft, FontStyle.Bold), Ui.Label(cSheet.rt, "does" + cRows.Count, mono, 14, CardDd)));
            for (int i = 0; i < rows.Count; i++) kw = Mathf.Max(kw, Ui.Measure(cRows[i].k, (rows[i] as List<object>)?[0] as string ?? "", iw * 0.45f).x);
            for (int i = 0; i < cRows.Count; i++)
            {
                bool on = i < rows.Count;
                Show(cRows[i].k, on); Show(cRows[i].v, on);
                if (!on) continue;
                var r = rows[i] as List<object>;
                var ks = Ui.Set(cRows[i].k, r?[0] as string ?? "", iw * 0.45f);
                var vs = Ui.Set(cRows[i].v, r?.Count > 1 ? r[1] as string ?? "" : "", iw - kw - 12);
                Ui.Place(cRows[i].k.rectTransform, px, y, kw, ks.y);
                Ui.Place(cRows[i].v.rectTransform, px + kw + 12, y, iw - kw - 12, vs.y);
                y += Mathf.Max(ks.y, vs.y) + 3;
            }
            if (rows.Count > 0) y += 9;
            // the options: a row each, its name, its choices (the one chosen ◀ ▶), the pad's row on a band
            var opts = c.L("options") ?? new List<object>();
            while (cOpts.Count < opts.Count)
            {
                var b = Ui.Panel(cSheet.rt, "opt" + cOpts.Count, Color.clear, Ui.Ink, 0);
                cOpts.Add((b, Ui.Label(b.rt, "label", mono, 12, Ui.Ink, TextAnchor.MiddleLeft, FontStyle.Bold), Ui.Label(b.rt, "val", mono, 13, Ui.Ink, TextAnchor.MiddleLeft), Ui.Label(cSheet.rt, "hint", mono, 12, CardMuted)));
            }
            for (int i = 0; i < cOpts.Count; i++)
            {
                var (box, label, val, oh) = cOpts[i];
                bool shown = i < opts.Count;
                box.Show(shown); Show(oh, false);
                if (!shown) continue;
                var o = opts[i] as Dictionary<string, object>;
                bool on = B(o, "on");
                string v = o.L("choices") is List<object> ch
                    ? string.Join("   ", ch.OfType<Dictionary<string, object>>().Select(x => B(x, "on") ? $"<b><color=#277e86>◀ {x.S("label")} ▶</color></b>" : x.S("label")))
                    : $"◀ <b>{o.S("text")}</b> ▶";
                box.SetFill(on ? Band : Color.clear);
                Ui.Set(label, Ui.Upper(o.S("label")), 130); Ui.Place(label.rectTransform, 8, 0, 130, 28);
                Ui.Set(val, v, iw - 150); Ui.Place(val.rectTransform, 144, 0, iw - 150, 28);
                Ui.Place(box.rt, px - 8, y, iw + 16, 28);
                y += 30;
                if (on && !string.IsNullOrEmpty(o.S("hint"))) y = CardPut(oh, o.S("hint"), px + 144, y, iw - 144) + 4;
            }
            if (opts.Count > 0) y += 8;
            // the results: the score big, "New best!" stamped at the top right, the run's lines, what the game adds (a prize)
            var big = c.S("big");
            y = CardPut(cBig, big, px, y + (string.IsNullOrEmpty(big) ? 0 : 4), iw);
            if (!string.IsNullOrEmpty(big)) y += 10;
            bool stamp = B(c, "stamp");
            cStamp.Show(stamp);
            if (stamp) { var ss = Ui.Measure(cStampText, "NEW BEST!"); cStampText.text = "NEW BEST!"; Ui.Place(cStamp.rt, sw - 18 - (ss.x + 24), 18, ss.x + 24, 30); cStamp.rt.localEulerAngles = new Vector3(0, 0, 6); }
            var lines = c.L("lines")?.OfType<string>().ToList() ?? new List<string>();
            y = CardPut(cLines, string.Join("\n", lines), px, y, iw);
            if (lines.Count > 0) y += 10;
            y = CardPut(cExtra, c.S("extra"), px, y, iw);
            if (!string.IsNullOrEmpty(c.S("extra"))) y += 10;
            y = CardPut(cBest, c.S("best"), px, y, iw) + 8;
            // the buttons in a row (wrapped), each its label (and a link's game under it)
            var buttons = c.L("buttons") ?? new List<object>();
            float bx = px, bh = 36, rowH = bh;
            for (int i = 0; i < buttons.Count; i++)
            {
                if (i >= cButtons.Count)
                {
                    var nb = new CardButton { box = Ui.Panel(cSheet.rt, "button" + i, Ui.CardC, Ui.Ink, 2, 3, 3, 4) };
                    nb.text = Ui.Label(nb.box.rt, "text", mono, 15, Ui.Ink, TextAnchor.UpperCenter, FontStyle.Bold); Ui.Space(nb.text, 0.12f);
                    nb.sub = Ui.Label(nb.box.rt, "sub", mono, 11, CardMuted, TextAnchor.UpperCenter);
                    cButtons.Add(nb);
                }
                var b = buttons[i] as Dictionary<string, object>;
                var cb = cButtons[i];
                cb.box.Show(true);
                bool on = B(b, "on"), main = B(b, "main");
                string label = Ui.Upper(b.S("label")), under = b.S("sub") ?? "";
                var ls = Ui.Measure(cb.text, label);
                float us = under.Length > 0 ? Ui.Measure(cb.sub, under).x : 0, bw = Mathf.Max(ls.x, us) + 36, h = under.Length > 0 ? bh + 14 : bh;
                if (bx + bw > px + iw && bx > px) { bx = px; y += rowH + 10; rowH = bh; }
                rowH = Mathf.Max(rowH, h);
                cb.text.text = label; Ui.Place(cb.text.rectTransform, 0, 9, bw, ls.y);
                Show(cb.sub, under.Length > 0);
                if (under.Length > 0) { cb.sub.text = under; Ui.Place(cb.sub.rectTransform, 0, 9 + ls.y + 2, bw, 14); }
                cb.box.SetFill(on ? Ui.Hex("#ffd866") : main ? Ui.Gold : Ui.CardC);
                cb.box.border.color = on ? Ui.Red : Ui.Ink;
                Ui.Place(cb.box.rt, bx - (on ? 1 : 0), y - (on ? 1 : 0), bw, h);
                bx += bw + 10;
            }
            for (int i = buttons.Count; i < cButtons.Count; i++) cButtons[i].box.Show(false);
            y += rowH + 6;
            y = CardPut(cHint, c.S("hint"), px, y + 4, iw) + 16;
            // (no taller than the screen: a long start card scaled down to fit, centred)
            float k = Mathf.Min(1, (H - 24) / y);
            cSheet.rt.localScale = new Vector3(k, k, 1);
            Ui.Place(cSheet.rt, W / 2 - sw * k / 2, Mathf.Max(12, H / 2 - y * k / 2), sw, y);
        }

        // ------------------------------------------------------------------ the Arena's foes (engine/menus.js foesView; issue #264)

        /// <summary>
        /// The Arena's list of foes as the web's page (src/foe-spawner.js FoeList): a paper sheet, FOES, the world filter at the
        /// right with LB / RB, the sections' headings (a world's "Waves from here" beside its own), the foes in a grid of
        /// rows (their name, what they are and do under it), the current choice in gold, "Waves again" and "Clear the field"
        /// at the foot; the rows scrolled to keep the pad's in view.
        /// </summary>
        void DrawFoes()
        {
            float sw = Mathf.Min(1000, W - 36), sx = W / 2 - sw / 2, sy = 16, sh = H - 16 - 46;
            Sheet(sx, sy, sw, sh, true);
            Head(state.S("head"), sx + 24, sy + 16, sw * 0.4f);
            var f = state.O("filter");
            if (f != null)
            {
                Show(line, true);
                line.alignment = TextAnchor.UpperRight; line.fontStyle = FontStyle.Bold; line.color = Ui.Ink;
                var ln = "◀ " + Key("prev", "LB") + "   " + Ui.Upper(f.S("text")) + "  " + (f.I("i") + 1) + " / " + f.I("n") + "   " + Key("next", "RB") + " ▶";
                Ui.Set(line, ln, sw * 0.55f);
                Ui.Place(line.rectTransform, sx + sw - 24 - sw * 0.55f, sy + 22, sw * 0.55f, 20);
            }
            DrawRows("foes", sx + 18, sy + 58, sw - 36, sh - 58 - 14);
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
            // (the save under the heading, as the web's: "Save 1 · The Desert · 12 min played")
            var ln = state.S("line") ?? "";
            Show(line, ln.Length > 0);
            if (ln.Length > 0) { Ui.Set(line, ln, sw * 0.6f); Ui.Place(line.rectTransform, sx + sw - 24 - sw * 0.6f, sy + 22, sw * 0.6f, 20); line.alignment = TextAnchor.UpperRight; }
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
                if (panel == "foes") return k == "head" ? 34 : k == "foot" ? 44 : FoeRowH(row);
                float baseH = panel == "quests" ? (k == "ended" ? 34 : 76) : panel == "items" ? (k == "item" || k == "empty" ? side + 42 : 34) : panel == "worlds" ? 58 : panel == "people" ? 56 : 36;
                return panel == "map" || panel == "worlds" ? Fit(row, baseH) : baseH;
            }
            // (a row of foes as tall as its tallest: the name, then what it is and does, which may take two lines)
            float FoeRowH(List<object> row)
            {
                float tw = w / Mathf.Max(1, cols.Count) - 6 - 28, most = 0;
                foreach (var o in row)
                {
                    if (o is not Dictionary<string, object> c) continue;
                    meas.fontSize = Body; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1;
                    float th = Ui.Measure(meas, c.S("text") ?? "", tw).y, sh = 0;
                    var u = c.S("sub");
                    if (!string.IsNullOrEmpty(u)) { meas.fontSize = Small; meas.lineSpacing = 1.2f; sh = Ui.Measure(meas, u, tw).y + 1; }
                    most = Mathf.Max(most, 5 + th + sh + 12);
                }
                meas.fontSize = Small; meas.fontStyle = FontStyle.Normal; meas.lineSpacing = 1;
                return Mathf.Max(56, most);
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
                // (the list of foes draws whole rows only: a row cut by the sheet's foot ran over its edge)
                bool shown = panel == "foes" ? yy >= y - 1 && yy + rh <= y + h + 2 : yy + rh > y - 1 && yy < y + h - 2;
                if (shown)
                    foreach (var o in row)
                    {
                        var c = o as Dictionary<string, object>;
                        int col = Mathf.Clamp(c.I("col"), 0, cols.Count - 1), span = Mathf.Max(1, c.I("span", 1));
                        float cx = x + w * colX[col], cw = w * (colX[Mathf.Min(col + span, colX.Count - 1)] - colX[col]) - 6;
                        string text = c.S("text"), under = c.S("sub");
                        if (panel == "foes")
                        {
                            // (a section's heading in the page's brick red, small spaced capitals; a row boxed, gold while chosen)
                            var fk = c.S("kind");
                            if (fk == "head") { var hc = Entry(cx, yy + 4, cw, rh - 6, Ui.Upper(text), null, null, false, size: Small); hc.text.color = Ui.Hex("#7a3a35"); hc.text.fontStyle = FontStyle.Bold; continue; }
                            var fc = Entry(cx, yy, cw, rh - 6, fk == "foot" || fk == "waves" ? Ui.Upper(text) : text, under, null, B(c, "on"), size: fk == "foe" ? Body : Small, boxed: true);
                            if (B(c, "lit") && !B(c, "on")) fc.box.SetFill(Ui.Gold);
                            continue;
                        }
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

        /// <summary>The room the game menu has for the Map (DrawGame's panel less the sheet's shadow), in the canvas' units.</summary>
        (float w, float h) MapRoom() => (W - 72 - 10, H - 202 - 10);

        /// <summary>
        /// The Map as the web's (src/game-menu.js mapPanel and mapPaint, issue #343): the whole sheet at the map's own shape
        /// (as wide as the room, issue #272), north up, the drawn ground on a plane the view zooms and moves, the sharper part
        /// over it zoomed in, the marks as the web's at their places on the sheet (the traveller's arrow turned the way he
        /// faces, the one under the cursor ringed in red), the cursor and that mark's name and line beside it, the world's
        /// name, north, the scale bar, the zoom's triggers and the note. No list: the strip under it names what the cursor is on.
        /// </summary>
        void DrawMap(float x, float y, float w, float h)
        {
            var m = state.O("map");
            float aspect = Mathf.Clamp(m?.F("aspect", 1) ?? 1, 0.5f, 3f);
            float mw = Mathf.Min(w - 10, (h - 10) * aspect), mh = mw / aspect;
            mapBox.Show(true);
            Ui.Place(mapBox.rt, x + (w - 10 - mw) / 2, y + (h - 10 - mh) / 2, mw, mh);
            // the view: the plane z times the sheet, its top left at (u0, v0) of the map
            float z = Mathf.Max(1, m?.F("z", 1) ?? 1), u0 = m?.F("u0") ?? 0, v0 = m?.F("v0") ?? 0;
            Ui.Place(mapPlane, -u0 * z * mw, -v0 * z * mh, z * mw, z * mh);
            var key = m?.S("ground") ?? "";
            var ground = key.Length > 0 && grounds.TryGetValue(key, out var gt) ? gt : null;
            if (ground != null) groundUsed[key] = Time.frameCount;
            Show(mapGround, ground != null);
            if (ground != null) mapGround.texture = ground;
            var d = m?.O("detail");
            var dk = d?.S("key") ?? "";
            var dt = dk.Length > 0 && grounds.TryGetValue(dk, out var dtt) ? dtt : null;
            if (dt != null) groundUsed[dk] = Time.frameCount;
            Show(mapDetail, dt != null && ground != null);
            if (dt != null && ground != null) { mapDetail.texture = dt; Ui.Place(mapDetail.rectTransform, d.F("u0") * z * mw, d.F("v0") * z * mh, d.F("s") * z * mw, d.F("s") * z * mh); }
            var drawing = m?.S("drawing") ?? "";
            Show(mapDrawing, ground == null && drawing.Length > 0);
            if (ground == null && drawing.Length > 0) { mapDrawing.text = drawing; Ui.Place(mapDrawing.rectTransform, 0, mh / 2 - 16, mw, 32); }
            var none = m?.S("none") ?? "";
            Show(mapNone, none.Length > 0 && ground != null);
            if (none.Length > 0) { mapNone.text = none; Ui.Place(mapNone.rectTransform, 0, mh / 2 - 12, mw, 24); }
            // the marks (the traveller and those with a word for you over the rest), each its picture, round its place
            float unit = 30;
            var list = m?.L("marks") ?? new List<object>();
            // the rumours' soft circles under every mark (rx across, ry down the sheet: they zoom with the ground), and
            // their short names under their middles (src/game-menu.css .gm-area, .mk-rumour b; issue #340)
            var rumours = list.OfType<Dictionary<string, object>>().Where(k => k.S("kind") == "rumour").ToList();
            while (areaPics.Count < rumours.Count)
            {
                var area = Ui.Node("rumour area", mapClip).gameObject.AddComponent<RawImage>(); area.raycastTarget = false;
                var label = Ui.Label(mapClip, "rumour label", Ui.Mono, Tiny, Ui.Hex("#5b2f52"), TextAnchor.MiddleCenter, FontStyle.BoldAndItalic);
                areaPics.Add((area, label));
            }
            for (int i = 0; i < areaPics.Count; i++)
            {
                var (area, label) = areaPics[i];
                var k = i < rumours.Count ? rumours[i] : null;
                var tex = k != null ? Mark("area") : null;
                Show(area, tex != null); Show(label, k != null);
                if (k == null) continue;
                float ax = k.F("x") * mw, ay = k.F("y") * mh, rx = k.F("rx") * mw, ry = k.F("ry") * mh;
                if (tex != null)
                {
                    area.texture = tex;
                    Ui.PlaceC(area.rectTransform, ax - rx, ay - ry, 2 * rx, 2 * ry);
                    area.transform.SetSiblingIndex(mapPlane.GetSiblingIndex() + 1);   // (over the ground, under the marks)
                }
                var ls = Ui.Set(label, k.S("label") ?? "", mw * 0.4f);
                Ui.Place(label.rectTransform, ax - ls.x / 2, ay + unit * 0.42f, ls.x, ls.y);
            }
            var order = list.OfType<Dictionary<string, object>>().OrderBy(k => k.S("kind") == "you" ? 3 : k.S("kind") == "giver" ? 2 : B(k, "sel") ? 1 : 0).ToList();
            while (markPics.Count < order.Count)
            {
                var ring = Ui.Node("ring", mapClip).gameObject.AddComponent<RawImage>(); ring.raycastTarget = false;
                var pic = Ui.Node("mark", mapClip).gameObject.AddComponent<RawImage>(); pic.raycastTarget = false;
                markPics.Add((pic, ring));
            }
            for (int i = 0; i < markPics.Count; i++)
            {
                var (pic, ring) = markPics[i];
                bool has = i < order.Count;
                var k = has ? order[i] : null;
                var tex = has ? Mark(k.S("kind")) : null;
                Show(pic, tex != null); Show(ring, tex != null && B(k, "sel"));
                if (tex == null) continue;
                float mx = k.F("x") * mw, my = k.F("y") * mh, side = unit * MarkSize(k.S("kind"));
                pic.texture = tex;
                Ui.PlaceC(pic.rectTransform, mx - side / 2, my - side / 2, side, side);
                pic.rectTransform.localEulerAngles = new Vector3(0, 0, k.S("kind") == "you" ? -k.F("deg") : 0);
                if (B(k, "sel")) { float rs = unit * 2.1f; ring.texture = Mark("sel"); Ui.PlaceC(ring.rectTransform, mx - rs / 2, my - rs / 2, rs, rs); }
            }
            // the cursor, gold on a mark, and that mark's name and line beside it (left of it on the right half, under it near the top)
            var cur = m?.L("cursor");
            float cx = cur != null && cur.Count > 1 ? (float)Json.Num(cur[0]) * mw : mw / 2, cy = cur != null && cur.Count > 1 ? (float)Json.Num(cur[1]) * mh : mh / 2;
            bool onMark = m != null && B(m, "on");
            mapCursor.texture = Mark(onMark ? "cursorOn" : "cursor");
            Show(mapCursor, mapCursor.texture != null && ground != null);
            float cs = unit * 1.06f;
            Ui.Place(mapCursor.rectTransform, cx - cs / 2, cy - cs / 2, cs, cs);
            var tip = m?.O("tip");
            mapTip.Show(tip != null);
            if (tip != null)
            {
                float tw = Mathf.Min(mw * 0.46f, 420);
                var ns = Ui.Set(mapTipName, tip.S("name") ?? "", tw - 16);
                var ss = Ui.Set(mapTipSub, tip.S("sub") ?? "", tw - 16);
                float bw = Mathf.Max(ns.x, ss.x) + 18, bh = ns.y + (ss.y > 0 ? ss.y + 2 : 0) + 10;
                Ui.Place(mapTipName.rectTransform, 9, 4, bw - 16, ns.y); Ui.Place(mapTipSub.rectTransform, 9, 6 + ns.y, bw - 16, ss.y);
                float off = 18, tx = B(tip, "left") ? cx - off - bw : cx + off, ty = B(tip, "below") ? cy + off * 0.4f : cy - bh / 2;
                Ui.Place(mapTip.rt, Mathf.Clamp(tx, 4, mw - bw - 4), Mathf.Clamp(ty, 4, mh - bh - 4), bw, bh);
            }
            // the world's name, top left; north, top right
            var world = m?.S("world") ?? "";
            mapNameBox.Show(world.Length > 0);
            if (world.Length > 0) { var ws = Ui.Set(mapName, world, mw * 0.6f); Ui.Place(mapName.rectTransform, 8, 2, ws.x, 22); Ui.Place(mapNameBox.rt, 12, 10, ws.x + 16, 26); }
            mapNorth.texture = Mark("north"); Show(mapNorth, mapNorth.texture != null);
            Ui.Place(mapNorth.rectTransform, mw - 14 - cs, 12, cs, cs);
            // the scale bar, bottom left: a round length, its ink and paper quarters
            var sc = m?.O("scale");
            mapScaleBox.Show(sc != null);
            if (sc != null)
            {
                float bw = Mathf.Max(40, mw * Mathf.Clamp01(sc.F("frac")));
                Ui.Place(mapBar.rectTransform, 5, 4, bw, 7);
                for (int i = 0; i < 2; i++) Ui.Place(mapBar.transform.GetChild(i) as RectTransform, 2 + (bw - 4) * (0.25f + 0.5f * i), 2, (bw - 4) * 0.25f, 3);
                mapScale.text = sc.S("label") ?? "";
                Ui.Place(mapScale.rectTransform, 5, 13, bw, 15);
                Ui.Place(mapScaleBox.rt, 16, mh - 14 - 32, bw + 10, 32);
            }
            // the note over the scale (the ship hears the light on them: issue #273)
            var nt = m?.S("note") ?? "";
            mapNoteBox.Show(nt.Length > 0);
            if (nt.Length > 0) { var ns2 = Ui.Set(mapNote, nt, mw - 140); Ui.Place(mapNote.rectTransform, 6, 2, ns2.x, ns2.y); Ui.Place(mapNoteBox.rt, 16, mh - 14 - 32 - 8 - (ns2.y + 4), ns2.x + 12, ns2.y + 4); }
            // the zoom: RT in, LT out, bottom right (the pad's own names: the script's prompts)
            zoomIn.text = "RT +"; zoomOut.text = "LT −";
            Ui.Place(zoomInBox.rt, mw - 14 - 54, mh - 14 - 2 * 32 - 6, 54, 32);
            Ui.Place(zoomOutBox.rt, mw - 14 - 54, mh - 14 - 32, 54, 32);
            foreach (var t in new Component[] { mapCursor, mapNameBox.rt, mapNorth, mapScaleBox.rt, mapNoteBox.rt, zoomInBox.rt, zoomOutBox.rt, mapTip.rt }) t.transform.SetAsLastSibling();   // (over the marks)
            mapEdge.transform.SetAsLastSibling();
        }

        /// <summary>A mark's side on the sheet, of the web's mark (engine/map-marks.js MAP_MARKS size).</summary>
        static float MarkSize(string kind) => kind switch { "you" => 1.3f, "goal" => 1.6f, "giver" => 1.5f, "rumour" => 0.8f, _ => 1f };

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
