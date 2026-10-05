using UnityEngine;
using UnityEngine.SceneManagement;

namespace Memento
{
    /// <summary>The title page: the game's name on paper, "press A / × or Enter", then the desert.</summary>
    public class TitleScreen : MonoBehaviour
    {
        float t;
        void Update()
        {
            t += Time.deltaTime;
            if (t > 0.4f && Pad.ConfirmDown()) SceneManager.LoadScene("Desert");
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
            GUI.Label(new Rect(0, Screen.height * 0.7f, Screen.width, Screen.height * 0.08f), "Press A / × or Enter", small);
            small.normal.textColor = new Color(ink.r, ink.g, ink.b, 0.6f); small.fontSize = Screen.height / 48;
            GUI.Label(new Rect(0, Screen.height * 0.9f, Screen.width, Screen.height * 0.06f), "The Desert · a Unity proof of concept", small);
        }
    }
}
