using System;
using System.Linq;
using System.Reflection;

namespace Memento.Bridge
{
    /// <summary>
    /// Puerts' JsEnv, reached by reflection: the bridge has no compile-time reference to Puerts, so the
    /// project builds (and the C# port runs) without it; scripts/unity-js-setup.sh puts Puerts' packages
    /// in Packages/ (docs/systems/engine-bridge.md). Its V8 (QuickJS on the Xbox) runs the game's bundle.
    /// </summary>
    public sealed class JsRuntime : IDisposable
    {
        static Type envType, bufferType;
        static FieldInfo bytesField, countField;
        static Type boxType; static MethodInfo boxGet; static readonly object[] boxKey = { "b" };
        static MethodInfo eval, tick, dispose;
        readonly object env;

        public static bool Available => Find();
        /// <summary>The script engine Puerts runs: V8, or QuickJS where there is no V8 (the Xbox).</summary>
        public static string Backend { get; private set; } = "none";

        static bool Find()
        {
            if (envType != null) return true;
            // (Puerts' core assembly, by its asmdef's name)
            envType = Type.GetType("Puerts.JsEnv, com.tencent.puerts.core", false);
            bufferType = Type.GetType("Puerts.ArrayBuffer, com.tencent.puerts.core", false);
            if (envType == null) return false;
            eval = envType.GetMethods().First(m => m.Name == "Eval" && !m.IsGenericMethod && m.GetParameters().Length == 2);
            tick = envType.GetMethod("Tick", Type.EmptyTypes);
            dispose = envType.GetMethod("Dispose", Type.EmptyTypes);
            if (bufferType != null) { bytesField = bufferType.GetField("Bytes"); countField = bufferType.GetField("Count"); }
            // the backend: V8 where its package is (every player but the Xbox's), else QuickJS (the UWP build: Puerts has no
            // V8 for UWP; its QuickJS is built for it, scripts/unity-uwp-natives.ps1). Puerts' Auto tries V8 first and would
            // throw for a missing package, not fall through: chosen here.
            bool v8 = Type.GetType("Puerts.BackendV8, com.tencent.puerts.v8", false) != null;
            bool qjs = Type.GetType("Puerts.BackendQuickJS, com.tencent.puerts.quickjs", false) != null;
            Backend = v8 ? "V8" : qjs ? "QuickJS" : "none";
            if (!v8 && qjs)
            {
                var kind = Type.GetType("Puerts.BackendType, com.tencent.puerts.core", false);
                var field = envType.GetField("DefaultBackendType", BindingFlags.Public | BindingFlags.Static);
                if (kind != null && field != null) field.SetValue(null, Enum.Parse(kind, "QuickJS"));
            }
            return true;
        }

        public JsRuntime() : this(null) { }

        /// <param name="onMain">made off the main thread: Puerts' own scripts read through this (MainThreadLoader)</param>
        /// <param name="debugPort">V8's inspector there (Chrome's DevTools protocol over a WebSocket: a profile of the script), -1 none</param>
        public JsRuntime(Func<Func<object>, object> onMain, int debugPort = -1)
        {
            if (!Find()) throw new InvalidOperationException("Puerts is not installed: scripts/unity-js-setup.sh");
            if (onMain == null) { env = Activator.CreateInstance(envType); return; }
            var loaderType = Type.GetType("Memento.Bridge.MainThreadLoader, Memento.Bridge.Puerts", false)
                ?? throw new InvalidOperationException("no Memento.Bridge.Puerts assembly (Assets/MementoJS/Puerts): the script cannot run off the main thread");
            var loader = Activator.CreateInstance(loaderType, onMain);
            var ctor = envType.GetConstructors().First(c => { var p = c.GetParameters(); return p.Length == 2 && p[1].ParameterType == typeof(int) && p[0].ParameterType.IsInstanceOfType(loader); });
            env = ctor.Invoke(new[] { loader, (object)debugPort });
        }

        public void Eval(string code, string name) => eval.Invoke(env, new object[] { code, name });
        public void Tick() => tick?.Invoke(env, null);
        public void Dispose() => dispose?.Invoke(env, null);

        /// <summary>The bytes of what a script handed over (Puerts makes a JS ArrayBuffer a Puerts.ArrayBuffer).</summary>
        public static byte[] Bytes(object buffer, out int count)
        {
            count = 0;
            if (buffer == null) return null;
            if (buffer is byte[] b) { count = b.Length; return b; }
            Find();
            // (an IL2CPP player hands a JS object over as a ScriptObject: the script boxes its buffers as { b },
            // BridgeHost.BoxBuffers, and the buffer is read out of it as Puerts' ArrayBuffer)
            if (bufferType != null && !bufferType.IsInstanceOfType(buffer))
            {
                var t = buffer.GetType();
                if (t != boxType) { boxType = t; boxGet = t.GetMethods().FirstOrDefault(m => m.Name == "Get" && m.IsGenericMethodDefinition && m.GetParameters().Length == 1)?.MakeGenericMethod(bufferType); }
                if (boxGet != null) buffer = boxGet.Invoke(buffer, boxKey);
            }
            if (bufferType != null && bufferType.IsInstanceOfType(buffer))
            {
                var bytes = (byte[])bytesField.GetValue(buffer);
                count = countField != null ? (int)countField.GetValue(buffer) : bytes?.Length ?? 0;
                return bytes;
            }
            throw new ArgumentException($"not an ArrayBuffer: {buffer?.GetType()}");
        }

        /// <summary>Bytes as a JS ArrayBuffer (returned as object: Puerts makes it one).</summary>
        public static object ToScript(byte[] bytes) => bytes == null ? null : Find() && bufferType != null ? Activator.CreateInstance(bufferType, bytes) : bytes;
    }
}
