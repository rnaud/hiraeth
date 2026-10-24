using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Hiraeth.Bridge
{
    public partial class BridgeHud
    {
        // The shared web --hint-* frame/tab. Allocated once per panel; never a gameplay state.
        static readonly Color HintAccent = Ui.Hex("#79c9c0");
        class EnamelTrim { public Image frame, tab; }
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
                enamel.Add(box, trim);
            }
            bool on = decorated && !solid;
            trim.frame.enabled = trim.tab.enabled = on;
            if (on) Ui.Place(trim.tab.rectTransform, -3, (box.rt.rect.height - 14) / 2, 4, 14);
        }
    }
}
