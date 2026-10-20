using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the pointer on the menus (issue #574)
    // The mouse and the fingers on what the menus drew: each thing a click or a tap can do something to is put down as it is
    // drawn (Hit: its box and the target the view named, `pt`, or one of the frame's own: the close button 'close', a tab
    // 'tab:i', the side tabs 'go:-1' / 'go:1', a question's 'ask:0' / 'ask:1', the Map's sheet 'map'…), and what the pointer
    // does is handed to the script (BridgeHost.MenuEvent → engine/menus.js pointer), which does what the web's click does
    // through the pad's own actions:
    //   - the mouse over a target: 'hover' once as it comes over it (the cursor goes there, as the page's mouse picks a cell);
    //   - a click or a tap, let go on what it was pressed on: 'press', with where on it (a slider's value);
    //   - a slider pressed and dragged: its value follows ('press' each move);
    //   - the Map: pressed, 'point' (the cursor there), dragged 'drag' (the map moved), the wheel 'zoom' round the mouse, the
    //     mouse over it 'point' as it moves (src/game-menu.js: its pointermove, pointerdown, wheel);
    //   - the wheel over a list, or a finger dragged on it: the list scrolled here (Scroll keeps where the pointer left it
    //     while the view says the pointer moved its cursor last: engine/menus.js view().pointer), 'scroll' to the script.
    // The HUD's own presses (what is in hand, the minigames' pause) are BridgeHud.Pointer.cs's, read as before.
    public partial class BridgeMenu
    {
        struct HitBox { public RectTransform rt, clip; public Rect sub; public bool part; public string pt; }
        readonly List<HitBox> hits = new();

        /// <summary>What a click on `c` does: the view's target for it (nothing for none), drawn on top of what came before.</summary>
        void Hit(Component c, string pt, RectTransform clip = null)
        {
            if (!c || string.IsNullOrEmpty(pt)) return;
            hits.Add(new HitBox { rt = c.transform as RectTransform, pt = pt, clip = clip });
        }
        /// <summary>A part of `c` (px from its top left): a slider's track, taller than drawn for a finger.</summary>
        void HitPart(Component c, Rect box, string pt)
        {
            if (!c || string.IsNullOrEmpty(pt)) return;
            hits.Add(new HitBox { rt = c.transform as RectTransform, pt = pt, sub = box, part = true });
        }

        /// <summary>Where a screen point is on a box: 0..1 across and down (out of 0..1 off it); false when the box isn't drawn.</summary>
        bool OnBox(HitBox h, Vector2 sp, out Vector2 f)
        {
            f = default;
            if (!h.rt || !h.rt.gameObject.activeInHierarchy) return false;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(h.rt, sp, cam, out var lp)) return false;
            var r = h.rt.rect;
            float px = lp.x - r.xMin, py = r.yMax - lp.y;   // (from its top left, y down: as Ui.Place places)
            var box = h.part ? h.sub : new Rect(0, 0, r.width, r.height);
            f = new Vector2((px - box.xMin) / Mathf.Max(1, box.width), (py - box.yMin) / Mathf.Max(1, box.height));
            return true;
        }
        bool InBox(HitBox h, Vector2 sp, out Vector2 f)
        {
            if (!OnBox(h, sp, out f)) return false;
            if (f.x < 0 || f.x > 1 || f.y < 0 || f.y > 1) return false;
            return !h.clip || RectTransformUtility.RectangleContainsScreenPoint(h.clip, sp, cam);
        }
        /// <summary>The target under a screen point (the last drawn on top), or null.</summary>
        string HitAt(Vector2 sp, out Vector2 f)
        {
            f = default;
            for (int i = hits.Count - 1; i >= 0; i--) if (InBox(hits[i], sp, out f)) return hits[i].pt;
            return null;
        }
        /// <summary>Where a target was drawn, on the screen (its middle): a batch run's press (BridgeHud.SimPointer), or null.</summary>
        public Vector2? ScreenOf(string pt)
        {
            for (int i = hits.Count - 1; i >= 0; i--)
            {
                var h = hits[i];
                if (h.pt != pt || !h.rt || !h.rt.gameObject.activeInHierarchy) continue;
                var r = h.rt.rect;
                var box = h.part ? h.sub : new Rect(0, 0, r.width, r.height);
                var local = new Vector3(r.xMin + box.center.x, r.yMax - box.center.y, 0);
                return RectTransformUtility.WorldToScreenPoint(cam, h.rt.TransformPoint(local));
            }
            return null;
        }
        /// <summary>A target's box on the menus' canvas (px from its top left): the batch run's log.</summary>
        public string Targets()
        {
            var sb = new System.Text.StringBuilder();
            foreach (var h in hits) if (h.rt && h.rt.gameObject.activeInHierarchy) sb.Append(h.pt).Append(' ');
            return sb.ToString();
        }

        /// <summary>The mouse is over this target now: where the page's :hover is a look of its own (a run's card's buttons,
        /// the title's entries), drawn here, the cursor left where it was (engine/menus.js pointer).</summary>
        bool HoverOn(string pt) => !string.IsNullOrEmpty(pt) && pt == hoverPt;
        static readonly Color CardHover = Ui.Hex("#fff6dc");

        // ---- the pointer's state between frames
        string downKind, downPt, hoverPt; Vector2 downAt, lastAt, lastMouse; bool dragged; Mouse mouseWas;
        float scrollPending;        // (px the lists are scrolled by the wheel or a finger since the last drawing)
        bool scrollHeld;            // (scrolled by the pointer: the lists stay where it left them until the view says the pointer moved its cursor)
        const float DragPx = 12;    // (a press moved further than this, in the canvas' px, is a drag, not a click: the page's click is let go in place)
        float CanvasPx => H / Mathf.Max(1, Screen.height);

        /// <summary>Each frame with a menu up (Update, before it is drawn): the fingers', then the mouse's.</summary>
        void PollMenuPointer()
        {
            if (state == null || !cam) { downKind = null; downPt = null; hoverPt = null; return; }
            bool touched = false;
            var ts = Touchscreen.current;
            if (ts != null)
            {
                var t = ts.primaryTouch; var p = t.position.ReadValue();
                if (downKind == null && t.press.wasPressedThisFrame) { Down("touch", p); touched = true; }
                if (downKind == "touch") { if (t.press.isPressed) Move(p); else Up(p); }
            }
            var m = Mouse.current;
            if (m == null) return;
            var mp = m.position.ReadValue();
            // the mouse over a target: the cursor there, once as it comes over it (on the Map: each move, its cursor following)
            bool moved = m != mouseWas || (mp - lastMouse).sqrMagnitude > 0.01f;
            mouseWas = m; lastMouse = mp;
            if (moved && downKind == null && !touched)
            {
                var pt = HitAt(mp, out var f);
                if (pt == "map") BridgeHost.MenuEvent("point", pt, f);
                else if (pt != hoverPt && pt != null) BridgeHost.MenuEvent("hover", pt, f);
                if (pt != hoverPt) { var kind = state.S("kind"); if (kind == "card" || kind == "title" || kind == "start") dirty = true; }   // (their :hover drawn here)
                hoverPt = pt;
            }
            if (downKind == null && !touched && m.leftButton.wasPressedThisFrame) Down("mouse", mp);
            if (downKind == "mouse") { if (m.leftButton.isPressed) Move(mp); else Up(mp); }
            float wy = m.scroll.ReadValue().y;
            if (wy != 0) Wheel(mp, wy);
        }

        void Down(string kind, Vector2 p)
        {
            downKind = kind; downAt = lastAt = p; dragged = false;
            downPt = HitAt(p, out var f);
            if (downPt == "map") BridgeHost.MenuEvent("point", downPt, f);   // (the page's pointerdown on the sheet: the cursor there)
            else if (downPt != null && downPt.StartsWith("slide:")) BridgeHost.MenuEvent("press", downPt, f);   // (a slider takes the press at once)
        }
        void Move(Vector2 p)
        {
            var d = p - lastAt; lastAt = p;
            if (!dragged && (p - downAt).magnitude * CanvasPx > DragPx) dragged = true;
            if (!dragged || d.sqrMagnitude < 0.0001f) return;
            if (downPt == "map")
            {
                // (the map moved under the finger or the held button: the move in the sheet's widths and heights, y down)
                var h = hits.Find(x => x.pt == "map");
                if (OnBox(h, p, out var f1) && OnBox(h, p - d, out var f0)) BridgeHost.MenuEvent("drag", "map", f1 - f0);
            }
            else if (downPt != null && downPt.StartsWith("slide:"))
            {
                var h = hits.Find(x => x.pt == downPt);
                if (OnBox(h, p, out var f)) BridgeHost.MenuEvent("press", downPt, new Vector2(Mathf.Clamp01(f.x), Mathf.Clamp01(f.y)));
            }
            else if (downKind == "touch") ScrollBy(d.y * CanvasPx);   // (a finger up the screen: the list up with it, as the page scrolls)
        }
        void Up(Vector2 p)
        {
            // a click: let go on what it was pressed on, not dragged (the Map's and a slider's were taken as pressed)
            if (!dragged && downPt != null && downPt != "map" && !downPt.StartsWith("slide:") && HitAt(p, out var f) == downPt) BridgeHost.MenuEvent("press", downPt, f);
            downKind = null; downPt = null;
        }
        void Wheel(Vector2 p, float wy)
        {
            var pt = HitAt(p, out var f);
            // (the Map: a notch closer round the mouse, or further; elsewhere the list under it, a few lines a notch)
            if (pt == "map") BridgeHost.MenuEvent("zoom", pt, f, wy > 0 ? -1 : 1);
            else ScrollBy(-Mathf.Sign(wy) * 40);
        }
        void ScrollBy(float px)
        {
            if (Mathf.Abs(px) < 0.01f) return;
            scrollPending += px; scrollHeld = true; dirty = true;
            BridgeHost.MenuEvent("scroll", "", Vector2.zero);
        }

        // ---- the lists' scroll: round the cursor, or where the pointer left it
        int scrollCall; string scrollKey;
        readonly Dictionary<int, float> scrolled = new();
        /// <summary>The drawing starts: the lists counted again (each Scroll in the drawing is the next list), the hits drawn again.</summary>
        void PointerDrawStart()
        {
            hits.Clear();
            scrollCall = 0;
            var key = $"{state.S("kind")}|{state.S("panel")}|{state.S("screen")}|{state.O("page")?.S("id")}|{B(state, "news")}";
            if (key != scrollKey) { scrollKey = key; scrolled.Clear(); scrollHeld = false; scrollPending = 0; }
            if (B(state, "pointer")) scrollHeld = false;   // (the script has the pointer's scroll: the view holds it from here)
        }
        void PointerDrawEnd() { scrollPending = 0; }

        /// <summary>
        /// How far a list of rows (their heights) is scrolled in `avail`: the one at `at` in the middle (the pad's, as before);
        /// while the pointer moved the cursor or scrolled the list last, where it was, moved by the wheel or the finger.
        /// </summary>
        float Scroll(List<float> hs, int at, float avail)
        {
            float total = 0, top = 0;
            for (int i = 0; i < hs.Count; i++) { if (i == at) top = total; total += hs[i]; }
            float most = Mathf.Max(0, total - avail), h = at < hs.Count ? hs[at] : 0;
            float centred = total <= avail ? 0 : Mathf.Clamp(top + h / 2 - avail / 2, 0, most);
            int k = scrollCall++;
            bool held = scrollHeld || B(state, "pointer");
            float v = held && scrolled.TryGetValue(k, out var was) ? was + scrollPending : centred;
            v = Mathf.Clamp(v, 0, most);
            scrolled[k] = v;
            return v;
        }
    }
}
