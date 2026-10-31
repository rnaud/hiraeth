using System.IO;
using UnityEditor.Android;
using UnityEngine;

namespace Hiraeth.EditorTools
{
    /// <summary>
    /// The Android players may hand their newer APK to Android's installer (issue #805: BridgeApk.cs, ApkInstaller.java), which
    /// needs REQUEST_INSTALL_PACKAGES: written into the generated unityLibrary's manifest after Unity makes the Gradle project
    /// (no custom manifest to keep up with Unity's own). The user still allows it once, in the screen the player opens.
    /// </summary>
    public class BridgeAndroidManifest : IPostGenerateGradleAndroidProject
    {
        public const string Permission = "android.permission.REQUEST_INSTALL_PACKAGES";
        public int callbackOrder => 0;

        public void OnPostGenerateGradleAndroidProject(string path)
        {
            var file = Path.Combine(path, "src", "main", "AndroidManifest.xml");
            if (!File.Exists(file)) { Debug.LogError("Hiraeth: no unityLibrary manifest at " + file + ": the player can't install its newer APK"); return; }
            File.WriteAllText(file, WithPermission(File.ReadAllText(file)));
            Debug.Log("Hiraeth: " + Permission + " in " + file);
        }

        /// <summary>The manifest with the permission (once), before its &lt;application&gt; (or at its end).</summary>
        public static string WithPermission(string xml)
        {
            if (xml.Contains("\"" + Permission + "\"")) return xml;
            var line = "<uses-permission android:name=\"" + Permission + "\" />\n  ";
            int at = xml.IndexOf("<application", System.StringComparison.Ordinal);
            if (at < 0) at = xml.LastIndexOf("</manifest>", System.StringComparison.Ordinal);
            return at < 0 ? xml : xml.Insert(at, line);
        }
    }
}
