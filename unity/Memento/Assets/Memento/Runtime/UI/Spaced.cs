using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Label = UnityEngine.UI.Text;

namespace Memento
{
    /// <summary>
    /// CSS letter-spacing for a legacy Text: each glyph's quad moved along its line by em × size
    /// per character before it, the line re-centred for its alignment (single-line labels).
    /// </summary>
    [RequireComponent(typeof(Label))]
    public class Spaced : BaseMeshEffect
    {
        public float em = 0.1f;
        readonly List<UIVertex> verts = new();
        public override void ModifyMesh(VertexHelper vh)
        {
            if (!IsActive() || em == 0) return;
            var text = GetComponent<Label>();
            var gen = text.cachedTextGenerator;
            var chars = gen.characters; var lines = gen.lines;
            if (chars == null || chars.Count == 0 || lines == null || lines.Count == 0) return;
            verts.Clear(); vh.GetUIVertexStream(verts);
            int quads = verts.Count / 6;
            string s = text.text;
            float px = em * text.fontSize;
            // per visible glyph: its line and its index along the line (spaces count, tags do not)
            var shift = new float[quads]; int q = 0;
            var lineCount = new int[lines.Count];
            var glyphLine = new int[quads];
            int li = 0, inLine = 0;
            for (int i = 0; i < chars.Count && i < s.Length; i++)
            {
                while (li + 1 < lines.Count && i >= lines[li + 1].startCharIdx) { lineCount[li] = inLine; li++; inLine = 0; }
                if (chars[i].charWidth <= 0) continue;
                bool quad = !char.IsWhiteSpace(s[i]);
                if (quad) { if (q >= quads) break; shift[q] = inLine * px; glyphLine[q] = li; q++; }
                inLine++;
            }
            lineCount[li] = inLine;
            // (an Outline or a Shadow before this one has laid copies of the glyphs end to end: each copy moves the same; rich text the count cannot follow is left as it is)
            if (q == 0 || quads % q != 0) return;
            float k = text.alignment switch
            {
                TextAnchor.UpperCenter or TextAnchor.MiddleCenter or TextAnchor.LowerCenter => 0.5f,
                TextAnchor.UpperRight or TextAnchor.MiddleRight or TextAnchor.LowerRight => 1f,
                _ => 0f,
            };
            for (int g = 0; g < quads; g++)
            {
                int o = g % q;
                float dx = shift[o] - k * px * Mathf.Max(0, lineCount[glyphLine[o]] - 1);
                for (int j = 0; j < 6; j++) { var v = verts[g * 6 + j]; v.position.x += dx; verts[g * 6 + j] = v; }
            }
            vh.Clear(); vh.AddUIVertexTriangleStream(verts);
        }
    }

}
