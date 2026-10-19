using System.Collections.Generic;
using UnityEngine;

namespace Hiraeth.Bridge
{
    // ---------------------------------------------------------------- the traveller found in his crowd (issue #534)
    // src/fight-temples/self-mark.js: in a fight temple, while the foes' bodies hide him or hem him in, an inked ring round
    // him over whatever covers him, a gold chevron over his head. The screen's 'self' part: `at` his feet and `head` over
    // his head (world points: placed here with this frame's camera, as the page projects them), `k` its fade, `size` the
    // ring across as a share of his height on the screen. The page's SVG: a ring of radius 40 in a 100 box, an ink line 7
    // wide under a cream one 3 wide, the chevron from (±9, -60) to (0, -51), all scaled so the ring is `size` × his height.
    public partial class BridgeHud
    {
        RectTransform selfRoot; Sketch selfSk;
        static readonly Color SelfInk = Ui.Hex("#2b211f"), SelfCream = Ui.Hex("#fbf4e2"), SelfGold = Ui.Hex("#f2c54b");

        /// <summary>Built with the fight's pieces (BuildFight): under the lock's arrows and the warnings, as the page's z 24.</summary>
        void BuildSelf()
        {
            selfRoot = Ui.Node("traveller's ring", root);
            selfSk = Ui.Node("ring", selfRoot).gameObject.AddComponent<Sketch>(); selfSk.raycastTarget = false;
            Show(selfRoot, false);
        }

        void DrawSelf(Dictionary<string, object> s)
        {
            if (selfRoot == null) BuildSelf();
            Vector2? feet = s != null ? ToCanvas(s.L("at")) : null, head = s != null ? ToCanvas(s.L("head")) : null;
            bool on = feet.HasValue && head.HasValue && s.F("k") > 0.01f;
            Show(selfRoot, on);
            if (!on) return;
            Vector2 mid = (feet.Value + head.Value) * 0.5f;
            float px = Mathf.Abs(head.Value.y - feet.Value.y) * s.F("size", 1.25f), k = px / 80f;
            Ui.PlaceC(selfSk.rectTransform, mid.x - 1, mid.y - 1, 2, 2);
            Ui.Alpha(selfRoot, Mathf.Clamp01(s.F("k")));
            selfSk.Clear();
            selfSk.Ring(Vector2.zero, 40 * k, 7 * k, SelfInk);
            selfSk.Ring(Vector2.zero, 40 * k, 3 * k, SelfCream);
            Vector2 a = new(-9 * k, 60 * k), b = new(0, 51 * k), c = new(9 * k, 60 * k);
            selfSk.Line(a, b, 7 * k, SelfInk); selfSk.Line(b, c, 7 * k, SelfInk);
            selfSk.Line(a, b, 3 * k, SelfGold); selfSk.Line(b, c, 3 * k, SelfGold);
        }
    }
}
