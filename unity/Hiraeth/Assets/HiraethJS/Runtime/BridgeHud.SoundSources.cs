using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
namespace Hiraeth.Bridge {
    public partial class BridgeHud {
        RectTransform soundSourcesRoot;
        UnityEngine.UI.Text soundSourcesText;
        void DrawSoundSources(Dictionary<string, object> s) {
            if (soundSourcesRoot == null) {
                soundSourcesRoot = Ui.Node("sound effects", root);
                var paper = Ui.Rect(soundSourcesRoot, Ui.Hex("#f7ecd2"), 0, "paper");
                Ui.Stretch(paper.rectTransform);
                soundSourcesText = Ui.Label(soundSourcesRoot, "events", Ui.Sans, 12, Ui.Hex("#2b211f"), TextAnchor.UpperLeft);
                soundSourcesText.raycastTarget = false;
            }
            Show(soundSourcesRoot, s != null);
            if (s == null) return;
            string text = "Sound effects\nMusic and spoken dialogue excluded\n" + s.S("status") + "\n\nPlaying (" + s.F("loopCount") + ")\n";
            var loops = s.L("loops");
            if (loops == null || loops.Count == 0) text += "None\n";
            else foreach (var line in loops) text += line + "\n";
            text += "\nRecent\n";
            var rows = s.L("rows");
            if (rows == null || rows.Count == 0) text += "None yet";
            else foreach (var line in rows) text += line + "\n";
            Ui.Set(soundSourcesText, text, 340);
            Ui.Place(soundSourcesRoot, 12, 68, 364, 450);
            Ui.Place(soundSourcesText.rectTransform, 10, 8, 340, 430);
        }
    }
}
