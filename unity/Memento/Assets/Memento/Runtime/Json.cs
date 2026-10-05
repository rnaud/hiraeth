using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// A small JSON reader: objects become Dictionary&lt;string, object&gt;, arrays List&lt;object&gt;,
    /// numbers double, plus helpers to read the exporter's data. (JsonUtility cannot read the
    /// story's conditions, which are free-form objects.)
    /// </summary>
    public static class Json
    {
        public static object Parse(string s) { int i = 0; var v = Value(s, ref i); return v; }

        static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        static object Value(string s, ref int i)
        {
            Ws(s, ref i);
            char c = s[i];
            if (c == '{') return Obj(s, ref i);
            if (c == '[') return Arr(s, ref i);
            if (c == '"') return Str(s, ref i);
            if (c == 't') { i += 4; return true; }
            if (c == 'f') { i += 5; return false; }
            if (c == 'n') { i += 4; return null; }
            int st = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            return double.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
        }
        static Dictionary<string, object> Obj(string s, ref int i)
        {
            var d = new Dictionary<string, object>(); i++;
            while (true)
            {
                Ws(s, ref i);
                if (s[i] == '}') { i++; return d; }
                var k = Str(s, ref i); Ws(s, ref i); i++;   // ':'
                d[k] = Value(s, ref i); Ws(s, ref i);
                if (s[i] == ',') i++;
            }
        }
        static List<object> Arr(string s, ref int i)
        {
            var l = new List<object>(); i++;
            while (true)
            {
                Ws(s, ref i);
                if (s[i] == ']') { i++; return l; }
                l.Add(Value(s, ref i)); Ws(s, ref i);
                if (s[i] == ',') i++;
            }
        }
        static string Str(string s, ref int i)
        {
            var b = new StringBuilder(); i++;
            while (s[i] != '"')
            {
                char c = s[i++];
                if (c == '\\')
                {
                    char e = s[i++];
                    switch (e)
                    {
                        case 'n': b.Append('\n'); break;
                        case 't': b.Append('\t'); break;
                        case 'r': b.Append('\r'); break;
                        case 'b': b.Append('\b'); break;
                        case 'f': b.Append('\f'); break;
                        case 'u': b.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; break;
                        default: b.Append(e); break;
                    }
                }
                else b.Append(c);
            }
            i++;
            return b.ToString();
        }

        // ------------------------------------------------------------ reading helpers
        public static Dictionary<string, object> O(this object o, string k) => (o as Dictionary<string, object>)?.TryGetValue(k, out var v) == true ? v as Dictionary<string, object> : null;
        public static List<object> L(this object o, string k) => (o as Dictionary<string, object>)?.TryGetValue(k, out var v) == true ? v as List<object> : null;
        public static object Get(this object o, string k) => (o as Dictionary<string, object>)?.TryGetValue(k, out var v) == true ? v : null;
        public static bool Has(this object o, string k) => (o as Dictionary<string, object>)?.ContainsKey(k) == true;
        public static string S(this object o, string k, string d = null) => o.Get(k) as string ?? d;
        public static float F(this object o, string k, float d = 0)
        {
            var v = o.Get(k);
            return v is double x ? (float)x : v is bool b ? (b ? 1 : 0) : d;
        }
        public static int I(this object o, string k, int d = 0) => o.Get(k) is double x ? (int)x : d;
        public static Vector3 V3(this object o) { var l = o as List<object>; return l == null ? Vector3.zero : new Vector3(Num(l[0]), Num(l[1]), Num(l[2])); }
        public static Vector3 V3(this object o, string k) => o.Get(k).V3();
        public static Color C(this object o) { var l = o as List<object>; return l == null ? Color.white : new Color(Num(l[0]), Num(l[1]), Num(l[2]), 1); }
        public static Color C(this object o, string k) => o.Get(k).C();
        public static float Num(object v) => v is double x ? (float)x : 0f;
        public static Color Hex(string hex)
        {
            if (string.IsNullOrEmpty(hex)) return Color.white;
            int n = Convert.ToInt32(hex.TrimStart('#'), 16);
            return new Color(((n >> 16) & 255) / 255f, ((n >> 8) & 255) / 255f, (n & 255) / 255f, 1);
        }
    }
}
