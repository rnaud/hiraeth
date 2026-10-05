using System.Collections;
using System.IO;
using UnityEngine;

namespace Memento
{
    /// <summary>
    /// A standalone build's own check (launch it with -smoke folder): the title is shot when the
    /// desert has loaded under it, New game is picked, the prologue is shot a little later and
    /// skipped, the desert is shot once you are out of the ship, then the player quits. The frames
    /// are what the window shows (ScreenCapture), the HUD with them; "Memento: smoke …" lines go
    /// to the player's log.
    /// </summary>
    public class SmokeTest : MonoBehaviour
    {
        string dir;
        public static void Arm()
        {
            var a = System.Environment.GetCommandLineArgs();
            int i = System.Array.IndexOf(a, "-smoke");
            if (i < 0) return;
            var go = new GameObject("Smoke test");
            DontDestroyOnLoad(go);
            var s = go.AddComponent<SmokeTest>();
            s.dir = i + 1 < a.Length && !a[i + 1].StartsWith("-") ? a[i + 1] : Path.Combine(Application.persistentDataPath, "smoke");
            Directory.CreateDirectory(s.dir);
            Debug.Log($"Memento: smoke test armed, frames to {s.dir}");
        }

        IEnumerator Start()
        {
            float t0 = Time.realtimeSinceStartup;
            while ((Game.Instance == null || Game.Instance.title == null) && Time.realtimeSinceStartup - t0 < 90) yield return null;
            if (Game.Instance == null) { Debug.LogError("Memento: smoke: the desert never loaded"); Application.Quit(2); yield break; }
            Debug.Log($"Memento: smoke: the desert loaded in {Time.realtimeSinceStartup - t0:0.0} s ({Screen.width} × {Screen.height}, {SystemInfo.graphicsDeviceName}, {SystemInfo.graphicsDeviceType})");
            yield return new WaitForSecondsRealtime(3);
            yield return Shot("1_title");
            Game.Instance.title.Pick("NEW GAME");
            yield return new WaitForSecondsRealtime(12);
            yield return Shot("2_prologue");
            // hold the skip
            var ship = Game.Instance.ship;
            float w = 0;
            while (ship && ship.PrologueActive && w < 90) { ship.SkipNow(); w += Time.unscaledDeltaTime; yield return null; }
            yield return new WaitForSecondsRealtime(4);
            yield return Shot("3_the_desert");
            Debug.Log($"Memento: smoke: done, {Time.frameCount} frames, {Time.frameCount / Mathf.Max(1, Time.realtimeSinceStartup - t0):0} fps on average, stage {Game.Instance.quests?.Stage("desert.power")}");
            Application.Quit(0);
        }

        IEnumerator Shot(string name)
        {
            yield return new WaitForEndOfFrame();
            var path = Path.Combine(dir, name + ".png");
            ScreenCapture.CaptureScreenshot(path);
            yield return null; yield return null;
            Debug.Log($"Memento: smoke: shot {path}");
        }
    }
}
