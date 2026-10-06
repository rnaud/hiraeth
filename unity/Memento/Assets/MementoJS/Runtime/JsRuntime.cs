using System;
using System.Linq;
using System.Reflection;

namespace Memento.Bridge
{
    /// <summary>
    /// Puerts' JsEnv, reached by reflection: the bridge has no compile-time reference to Puerts, so the
    /// project builds (and the C# port runs) without it; scripts/unity-js-setup.sh puts Puerts' packages
    /// in Packages/ (docs/systems/engine-bridge.md). Its V8 runs the game's bundle.
    /// </summary>
    public sealed class JsRuntime : IDisposable
    {
        static Type envType, bufferType;
        static FieldInfo bytesField, countField;
        static MethodInfo eval, tick, dispose;
        readonly object env;

        public static bool Available => Find();

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
            return true;
        }

        public JsRuntime()
        {
            if (!Find()) throw new InvalidOperationException("Puerts is not installed: scripts/unity-js-setup.sh");
            env = Activator.CreateInstance(envType);
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
            if (bufferType != null && bufferType.IsInstanceOfType(buffer))
            {
                var bytes = (byte[])bytesField.GetValue(buffer);
                count = countField != null ? (int)countField.GetValue(buffer) : bytes?.Length ?? 0;
                return bytes;
            }
            throw new ArgumentException($"not an ArrayBuffer: {buffer.GetType()}");
        }

        /// <summary>Bytes as a JS ArrayBuffer (returned as object: Puerts makes it one).</summary>
        public static object ToScript(byte[] bytes) => bytes == null ? null : Find() && bufferType != null ? Activator.CreateInstance(bufferType, bytes) : bytes;
    }
}
