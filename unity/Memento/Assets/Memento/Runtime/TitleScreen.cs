using UnityEngine;
using UnityEngine.SceneManagement;

namespace Memento
{
    /// <summary>
    /// The title page: the game's name on paper, then the desert. With a save (Save.cs): Continue
    /// (where you were) or New game (the prologue again; the save is erased), chosen with ↑ ↓ /
    /// the D-pad and A / × or Enter.
    /// </summary>
    public class TitleScreen : MonoBehaviour
    {
        float t; int sel;
        bool HasSave => Save.Exists();
        void Update()
        {
            t += Time.deltaTime;
            if (HasSave) sel = Mathf.Clamp(sel + Pad.NavDown(), 0, 1);
            if (t > 0.4f && Pad.ConfirmDown())
            {
                if (HasSave && sel == 1) Save.Erase();
                SceneManager.LoadScene("Desert");
            }
        }

        void OnGUI()
        {
            var paper = new Color(0.97f, 0.94f, 0.86f); var ink = new Color(0.17f, 0.13f, 0.12f);
            GUI.color = paper; GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture); GUI.color = Color.white;
            var big = new GUIStyle(GUI.skin.label) { fontSize = Screen.height / 7, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
            big.normal.textColor = ink;
            GUI.Label(new Rect(0, Screen.height * 0.25f, Screen.width, Screen.height * 0.25f), "Memento", big);
            var small = new GUIStyle(big) { fontSize = Screen.height / 32, fontStyle = FontStyle.Normal };
            GUI.Label(new Rect(0, Screen.height * 0.5f, Screen.width, Screen.height * 0.08f), "“My son, make us proud. Bring back something of value.”", small);
            var c = ink; c.a = 0.5f + 0.5f * Mathf.Sin(t * 3f); small.normal.textColor = c;
            if (HasSave)
            {
                for (int i = 0; i < 2; i++)
                {
                    var s = new GUIStyle(small); s.normal.textColor = i == sel ? c : new Color(ink.r, ink.g, ink.b, 0.55f);
                    GUI.Label(new Rect(0, Screen.height * (0.66f + i * 0.07f), Screen.width, Screen.height * 0.07f), (i == sel ? "▸ " : "") + (i == 0 ? "Continue" : "New game"), s);
                }
            }
            else GUI.Label(new Rect(0, Screen.height * 0.7f, Screen.width, Screen.height * 0.08f), "Press A / × or Enter", small);
            small.normal.textColor = new Color(ink.r, ink.g, ink.b, 0.6f); small.fontSize = Screen.height / 48;
            GUI.Label(new Rect(0, Screen.height * 0.9f, Screen.width, Screen.height * 0.06f), "The Desert · a Unity port", small);
        }
    }
}
