using System;
using System.Collections.Generic;
using System.Linq;

namespace Memento
{
    /// <summary>
    /// Which worlds the traveller knows of and can fly to (src/story/route.js knownWorlds,
    /// src/story/calls.js completedWorlds, src/story/ending.js homeOpen), pure, as the web's:
    ///  - the first world (the desert) is always known; after it, the next AHEAD (2) worlds not done
    ///    yet, so there is always a choice of two; finishing one brings the next in ORDER;
    ///  - a world you have been to (or stand in) stays known, done or not;
    ///  - home is not on the route: it opens once ENDING_WORLDS (6) worlds are done and the last
    ///    recording has asked you home (calls.home, or calls.6), or once the ending has been played.
    /// A world is done when its `world.&lt;id&gt;.done` flag is set, or its story page was reached
    /// (`story.&lt;id&gt;.done`, the journal's storyDone on the web).
    /// </summary>
    public static class Route
    {
        public const int Ahead = 2, EndingWorlds = 6;
        public const string Home = "home";

        public static List<string> Known(IList<string> order, Func<string, bool> done, Func<string, bool> visited, string current, int ahead = Ahead)
        {
            var known = new HashSet<string>(order.Take(1));
            foreach (var id in order) if (id == current || done(id) || visited(id)) known.Add(id);
            int open = 0;
            foreach (var id in order.Skip(1))
            {
                if (open >= ahead) break;
                if (!done(id)) { known.Add(id); open++; }
            }
            return order.Where(known.Contains).ToList();
        }

        public static bool Done(GameState s, string id) => s.Is($"world.{id}.done") || s.Is($"story.{id}.done");
        public static bool Visited(GameState s, string id) => s.Is($"seen.{id}");
        public static List<string> Completed(IList<string> order, GameState s) => order.Where(id => Done(s, id)).ToList();
        public static bool EndingUnlocked(int completed) => completed >= EndingWorlds;
        public static bool HomeOpen(GameState s, int completed) => s.Is("ending.done") || (EndingUnlocked(completed) && (s.Is("calls.home") || s.Is($"calls.{EndingWorlds}")));

        /// <summary>The worlds the map lets you fly to from `current` (known, not where you are; home once open), in ORDER.</summary>
        public static List<string> Destinations(IList<string> order, GameState s, string current)
        {
            var list = Known(order, id => Done(s, id), id => Visited(s, id), current).Where(id => id != current).ToList();
            if (current != Home && HomeOpen(s, Completed(order, s).Count)) list.Add(Home);
            return list;
        }
    }
}
