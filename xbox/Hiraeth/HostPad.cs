// The controller read by the app itself (docs/systems/xbox.md "The A and B buttons"). On a Series X the page's
// Gamepad API saw only some of the D-pad and never A or B: WebView2 in a UWP app gets the pad through the system
// (WebView2Feedback #4366), and whatever XAML does with A, B and the D-pad (focus, engagement, Back) it lost them.
// The app reads every pad through Windows.Gaming.Input 125 times a second on the thread pool and posts each change
// to the page as a web message, in the Standard Gamepad's order:
//   { hiraeth: 'pad', pads: [ { buttons: [17 values, 0..1], axes: [lx, ly, rx, ry] } ] }   (up is -1, as on the web)
// src/xbox.js listenHostPad folds it into navigator.getGamepads(), so the game's controller reads it unchanged.
// C# 7.3 (.NET Native): no newer language features here.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;
using Windows.Gaming.Input;
using Windows.System.Threading;

namespace Hiraeth
{
    sealed class HostPad
    {
        /// <summary>How often the pads are read (ms): every frame at 60 Hz and then some.</summary>
        public const int PeriodMs = 8;

        readonly Action<string> send;   // (called on the thread pool: posts the JSON from the UI thread)
        readonly object gate = new object();
        ThreadPoolTimer timer;
        string last = "";
        int busy;
        volatile bool force;

        public HostPad(Action<string> send)
        {
            this.send = send;
            // (touching Gamepad early fills Gamepad.Gamepads sooner; a pad coming or going is sent at once)
            Gamepad.GamepadAdded += (s, g) => force = true;
            Gamepad.GamepadRemoved += (s, g) => force = true;
        }

        /// <summary>Start reading (the app is on the screen); the first reading is sent even if nothing is held.</summary>
        public void Start()
        {
            lock (gate)
            {
                if (timer != null) return;
                force = true;
                timer = ThreadPoolTimer.CreatePeriodicTimer(Tick, TimeSpan.FromMilliseconds(PeriodMs));
            }
        }

        /// <summary>Stop reading (the guide, another app, standby): the page is told no pad is held any more.</summary>
        public void Stop()
        {
            lock (gate)
            {
                if (timer == null) return;
                timer.Cancel();
                timer = null;
                last = "";
            }
            send("{\"hiraeth\":\"pad\",\"pads\":[]}");
        }

        /// <summary>Send the next reading even if unchanged: a page that just loaded, or asked (pad-sync).</summary>
        public void Resend() { force = true; }

        void Tick(ThreadPoolTimer t)
        {
            if (Interlocked.Exchange(ref busy, 1) == 1) return;   // (a tick still running: skip this one)
            try
            {
                var json = Read();
                bool changed;
                lock (gate)
                {
                    if (timer == null) return;
                    changed = force || json != last;
                    force = false;
                    last = json;
                }
                if (changed) send(json);
            }
            catch (Exception) { }
            finally { Interlocked.Exchange(ref busy, 0); }
        }

        /// <summary>Every pad's reading as the page's message (the JSON is compared, so only a change is sent).</summary>
        static string Read()
        {
            IReadOnlyList<Gamepad> pads = Gamepad.Gamepads;
            var sb = new StringBuilder("{\"hiraeth\":\"pad\",\"pads\":[");
            for (int i = 0; i < pads.Count; i++)
            {
                if (i > 0) sb.Append(',');
                Append(sb, pads[i].GetCurrentReading());
            }
            return sb.Append("]}").ToString();
        }

        static void Append(StringBuilder sb, GamepadReading r)
        {
            var b = r.Buttons;
            // the Standard Gamepad's order: A B X Y, LB RB, LT RT, View Menu, L3 R3, up down left right, guide
            sb.Append("{\"buttons\":[");
            Bit(sb, b, GamepadButtons.A); Bit(sb, b, GamepadButtons.B); Bit(sb, b, GamepadButtons.X); Bit(sb, b, GamepadButtons.Y);
            Bit(sb, b, GamepadButtons.LeftShoulder); Bit(sb, b, GamepadButtons.RightShoulder);
            Num(sb, r.LeftTrigger); sb.Append(','); Num(sb, r.RightTrigger); sb.Append(',');
            Bit(sb, b, GamepadButtons.View); Bit(sb, b, GamepadButtons.Menu);
            Bit(sb, b, GamepadButtons.LeftThumbstick); Bit(sb, b, GamepadButtons.RightThumbstick);
            Bit(sb, b, GamepadButtons.DPadUp); Bit(sb, b, GamepadButtons.DPadDown); Bit(sb, b, GamepadButtons.DPadLeft); Bit(sb, b, GamepadButtons.DPadRight);
            sb.Append("0],\"axes\":[");   // (the guide button never reaches an app: the system keeps it)
            Num(sb, r.LeftThumbstickX); sb.Append(','); Num(sb, -r.LeftThumbstickY); sb.Append(',');
            Num(sb, r.RightThumbstickX); sb.Append(','); Num(sb, -r.RightThumbstickY);
            sb.Append("]}");
        }

        static void Bit(StringBuilder sb, GamepadButtons held, GamepadButtons one)
        {
            sb.Append((held & one) == one ? "1," : "0,");
        }

        /// <summary>Two decimals: enough for a stick, and a resting stick's noise doesn't send a message each tick.</summary>
        static void Num(StringBuilder sb, double v)
        {
            if (double.IsNaN(v)) v = 0;
            v = Math.Max(-1, Math.Min(1, Math.Round(v, 2)));
            if (v == 0) v = 0;   // (no "-0")
            sb.Append(v.ToString("0.##", CultureInfo.InvariantCulture));
        }
    }
}
