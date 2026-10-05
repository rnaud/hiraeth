using UnityEngine;

namespace Memento
{
    /// <summary>Starts the playable part of the desert: the traveller, the camera rig, the people and the story.</summary>
    public class Play : MonoBehaviour
    {
        public Game game;
        public void Begin(Game g)
        {
            game = g;
        }
    }
}
