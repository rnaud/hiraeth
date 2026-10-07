using System;

namespace Memento.Bridge
{
    /// <summary>
    /// Puerts' own scripts (its Resources, read as it makes a JsEnv) loaded on Unity's main thread when the JsEnv is
    /// made on the script's thread (BridgeRunner): Resources.Load is the main thread's only. JsRuntime finds this by
    /// name; this assembly compiles only where Puerts is installed (its asmdef's versionDefines), so the bridge's own
    /// code still builds without it.
    /// </summary>
    public sealed class MainThreadLoader : Puerts.ILoader, Puerts.IModuleChecker
    {
        readonly Puerts.DefaultLoader inner = new();
        readonly Func<Func<object>, object> onMain;

        /// <param name="onMain">runs a function on the main thread and returns its value (BridgeHost.OnMainThread)</param>
        public MainThreadLoader(Func<Func<object>, object> onMain) { this.onMain = onMain; }

        public bool FileExists(string filepath) => (bool)onMain(() => inner.FileExists(filepath));

        public string ReadFile(string filepath, out string debugpath)
        {
            string dp = null;
            var text = (string)onMain(() => inner.ReadFile(filepath, out dp));
            debugpath = dp;
            return text;
        }

        public bool IsESM(string filepath) => inner.IsESM(filepath);
    }
}
