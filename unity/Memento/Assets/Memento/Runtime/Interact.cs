using System;
using System.Collections.Generic;
using UnityEngine;

namespace Memento
{
    /// <summary>Things you can use with B / ○ or E (src/interact.js): the nearest one in range wins, by priority.</summary>
    public class Interactable
    {
        public string id;
        public Func<Vector3> at;
        public float range = 2.6f;
        public int priority = 1;          // talk 2, use 1
        public Func<string> prompt;
        public Func<bool> enabled = () => true;
        public Action use;
    }

    public static class Interact
    {
        public static readonly List<Interactable> All = new();
        public static Interactable Add(Interactable i) { All.Add(i); return i; }
        public static void Remove(Interactable i) => All.Remove(i);
        public static Interactable Best(Vector3 p)
        {
            Interactable best = null; float bd = float.MaxValue;
            foreach (var i in All)
            {
                if (!i.enabled()) continue;
                var a = i.at();
                if (Mathf.Abs(a.y - p.y) > 3.5f) continue;
                float d = Vector2.Distance(new Vector2(a.x, a.z), new Vector2(p.x, p.z));
                if (d > i.range) continue;
                float score = d - i.priority * 0.5f;
                if (score < bd) { bd = score; best = i; }
            }
            return best;
        }
    }
}
