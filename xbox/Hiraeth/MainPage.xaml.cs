// The game in a full-screen WebView2 (docs/systems/xbox.md):
//   - served from a folder (the packaged game\ or a downloaded build, WebBundles) at a fixed https origin through
//     a virtual host mapping, so the saves (the page's storage, under that origin) stay across updates;
//   - the page told it runs here before its scripts (window.__hiraethXbox, and "HiraethXbox/<api>" in the user
//     agent: src/xbox.js), so it picks the Xbox prompts, preset and the TV's safe area;
//   - the system's Back (the B button) kept from closing the app: the page gets moebius:back instead;
//   - leaving the app (the guide, another app, standby) pauses the game's sound: moebius:pause / moebius:resume,
//     as Android sends them (src/audio-guard.js);
//   - the settings' update section answered over web messages (src/xbox.js xboxCall: info, check, download, restart);
//   - a downloaded build that doesn't boot in time goes back to the packaged one (the boot watch);
//   - the page's warnings, errors and load timings written to LocalState\web\page.log (src/xbox.js forwardLogs),
//     with what the app knows (its memory limit: an App or a Game, the WebView2 runtime, where the focus is).
// C# 7.3 (.NET Native): no newer language features here.
using System;
using System.Threading.Tasks;
using Microsoft.Web.WebView2.Core;
using Windows.ApplicationModel.Core;
using Windows.Data.Json;
using Windows.Foundation;
using Windows.System;
using Windows.System.Profile;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Input;
using Windows.UI.Xaml.Navigation;

namespace Hiraeth
{
    public sealed partial class MainPage : Page
    {
        /// <summary>The page's origin, fixed for good: the saves live in its storage (src/xbox.js XBOX_HOST).</summary>
        public const string Host = "hiraeth.example";
        public const string Origin = "https://" + Host + "/";
        /// <summary>Added to WebView2's user agent (src/xbox.js XBOX_UA).</summary>
        public const string UserAgentToken = "HiraethXbox/";

        public static MainPage Current { get; private set; }

        readonly WebBundles bundles = new WebBundles();
        WebBundles.Choice running;
        CoreWebView2 core;
        DispatcherTimer bootWatch;
        DateTimeOffset bootStarted;
        bool away, checkedOnce;
        DateTimeOffset lastCheck = DateTimeOffset.MinValue;

        public MainPage()
        {
            InitializeComponent();
            Current = this;
            NavigationCacheMode = NavigationCacheMode.Required;
            SystemNavigationManager.GetForCurrentView().BackRequested += OnBack;
            Loaded += OnLoaded;
            Window.Current.Activated += (s, e) => { if (e.WindowActivationState != CoreWindowActivationState.Deactivated) FocusWeb("activated"); };
        }

        /// <summary>The pad's input to the page: the web view holds the focus (a focus elsewhere may bring the system's mouse mode back).</summary>
        void FocusWeb(string why)
        {
            try
            {
                if (!Web.Focus(FocusState.Programmatic)) bundles.PageLog("app: the web view refused the focus (" + why + ")");
            }
            catch (Exception e) { bundles.PageLog("app: focus: " + e.Message); }
        }

        async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                bundles.StartPageLog();
                var limit = MemoryManager.AppMemoryUsageLimit / 1048576;
                // (about 1 GB: the app type is App, with a shared slice of the GPU and its memory; about 5 GB: Game)
                bundles.PageLog("app: build " + bundles.AppBuild + ", " + AnalyticsInfo.VersionInfo.DeviceFamily + ", memory limit " + limit + " MB"
                    + (limit < 2048 ? " (the app type is App: set it to Game in Dev Home)" : "") + ", pointer mode " + Application.Current.RequiresPointerMode);
                Web.GotFocus += (s2, e2) => bundles.PageLog("app: focus on the web view");
                Web.LostFocus += (s2, e2) =>
                {
                    var f = FocusManager.GetFocusedElement();
                    bundles.PageLog("app: the web view lost the focus to " + (f == null ? "nothing" : f.GetType().Name));
                };
                await Web.EnsureCoreWebView2Async();
                core = Web.CoreWebView2;
                try { bundles.PageLog("app: WebView2 " + core.Environment.BrowserVersionString); } catch { }
                FocusWeb("web view ready");
                var s = core.Settings;
                // (each alone: a console whose WebView2 runtime is older than the SDK lacks the newer ones)
                Try("context menus", () => s.AreDefaultContextMenusEnabled = false);   // (no right-click menu)
                Try("zoom", () => s.IsZoomControlEnabled = false);
                Try("pinch zoom", () => s.IsPinchZoomEnabled = false);
                Try("swipe", () => s.IsSwipeNavigationEnabled = false);
                Try("accelerator keys", () => s.AreBrowserAcceleratorKeysEnabled = false);   // (no F5, Ctrl+F, browser back and the like)
                Try("status bar", () => s.IsStatusBarEnabled = false);
                Try("autofill", () => s.IsGeneralAutofillEnabled = false);
                Try("passwords", () => s.IsPasswordAutosaveEnabled = false);
#if DEBUG
                Try("dev tools", () => s.AreDevToolsEnabled = true);
#else
                Try("dev tools", () => s.AreDevToolsEnabled = false);
#endif
                s.UserAgent = s.UserAgent + " " + UserAgentToken + WebBundles.XboxApi;
                core.WebMessageReceived += OnMessage;
                core.NavigationStarting += OnNavigationStarting;
                core.NavigationCompleted += OnNavigationCompleted;
                core.NewWindowRequested += OnNewWindow;
                core.ProcessFailed += OnProcessFailed;
                running = bundles.Pick();
                await core.AddScriptToExecuteOnDocumentCreatedAsync(PageScript());
                Load(running, "launch");
            }
            catch (Exception ex)
            {
                // (no WebView2 runtime, or it failed to start: say so on the screen, it is all there is to see)
                Status.Text = "Hiraeth couldn't start its web view: " + ex.Message;
                Status.Visibility = Visibility.Visible;
                bundles.Log("WebView2 failed: " + ex);
            }
        }

        void Try(string what, Action set)
        {
            try { set(); } catch (Exception e) { bundles.Log("setting " + what + ": " + e.Message); }
        }

        /// <summary>Before every page's own scripts: what the page needs to know it runs here (src/xbox.js).</summary>
        string PageScript()
        {
            var info = new JsonObject();
            info["api"] = JsonValue.CreateNumberValue(WebBundles.XboxApi);
            info["app"] = JsonValue.CreateNumberValue(bundles.AppBuild);
            info["tvSafe"] = JsonValue.CreateBooleanValue(true);
            info["memory"] = JsonValue.CreateNumberValue(MemoryManager.AppMemoryUsageLimit / 1048576);   // (MB: about 1024 as an App, 5000 as a Game)
            return "window.__hiraethXbox = " + info.Stringify() + ";"
                + "if (window.__moebiusAway === undefined) window.__moebiusAway = false;"
                // (the old Xbox WebView turned the pad into mouse and keys unless asked not to; harmless where unknown)
                + "try { navigator.gamepadInputEmulation = 'gamepad'; } catch (e) {}";
        }

        /// <summary>Serve `game` at the origin and open the title screen.</summary>
        void Load(WebBundles.Choice game, string why)
        {
            running = game;
            bundles.Log("serving build " + game.Build + (game.Bundle ? " (downloaded)" : " (packaged)") + ": " + why);
            try { core.ClearVirtualHostNameToFolderMapping(Host); } catch { }
            core.SetVirtualHostNameToFolderMapping(Host, game.Folder, CoreWebView2HostResourceAccessKind.Allow);
            // (only when the build changes: clearing the disk cache clears the GPU's shader cache too, and the
            // console then compiled every shader again at each launch, a minute of "mixing the inks…")
            if (bundles.SwitchServed(game)) _ = ClearCacheThen(() => core.Navigate(Origin + "index.html"));
            else core.Navigate(Origin + "index.html");
            StartBootWatch();
        }

        /// <summary>The HTTP cache may hold the last build's unhashed files (index.html, public/): cleared before switching builds.</summary>
        async Task ClearCacheThen(Action then)
        {
            try { await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache); }
            catch (Exception e) { bundles.Log("cache: " + e.Message); }
            then();
        }

        // ------------------------------------------------------------------ the boot watch

        void StartBootWatch()
        {
            bootWatch?.Stop();
            bootStarted = DateTimeOffset.Now;
            bootWatch = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
            bootWatch.Tick += OnBootTick;
            bootWatch.Start();
        }

        async void OnBootTick(object sender, object e)
        {
            var timer = bootWatch;
            string booted = "false";
            try { booted = await core.ExecuteScriptAsync("window.__moebiusBooted === true"); } catch { }
            if (timer != bootWatch) return;   // (a newer load started meanwhile)
            if (booted == "true")
            {
                bootWatch.Stop();
                bundles.MarkGood(running);
                if (!checkedOnce) { checkedOnce = true; AutoCheck("launch"); }
                return;
            }
            if (DateTimeOffset.Now - bootStarted < WebBundles.BootTimeout) return;
            bootWatch.Stop();
            if (running.Bundle && !bundles.IsGood(running.Build))
            {
                bundles.MarkBad(running);
                Load(bundles.Packaged(), "fallback");
            }
            else if (!checkedOnce) { checkedOnce = true; AutoCheck("launch"); }
        }

        /// <summary>An automatic check (the launch, a return after 15 min): downloads by itself, for the next launch.</summary>
        void AutoCheck(string why)
        {
            lastCheck = DateTimeOffset.Now;
            _ = bundles.CheckAsync(running, true, why);
        }

        // ------------------------------------------------------------------ navigation

        void OnNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args)
        {
            // (the game's own pages only; a link elsewhere opens in the console's browser)
            if (args.Uri.StartsWith(Origin, StringComparison.OrdinalIgnoreCase) || args.Uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase)) return;
            args.Cancel = true;
            OpenOutside(args.Uri);
        }

        void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            FocusWeb("page loaded");   // (the pad's input goes to the page)
            if (away) { _ = Send(true); }         // (a page that loads while away is told again)
        }

        void OnNewWindow(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            OpenOutside(args.Uri);
        }

        static void OpenOutside(string uri)
        {
            Uri u;
            if (Uri.TryCreate(uri, UriKind.Absolute, out u) && (u.Scheme == "https" || u.Scheme == "http")) { _ = Launcher.LaunchUriAsync(u); }
        }

        void OnProcessFailed(CoreWebView2 sender, CoreWebView2ProcessFailedEventArgs args)
        {
            bundles.Log("web view process failed: " + args.ProcessFailedKind);
            if (args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited || args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                try { core.Reload(); } catch { }
            }
        }

        // ------------------------------------------------------------------ Back (the B button)

        void OnBack(object sender, BackRequestedEventArgs e)
        {
            // Handled: the system doesn't close or suspend the game. The page reads B itself (the Gamepad API);
            // moebius:back is its fallback when no pad reaches it (src/xbox.js backFallback).
            e.Handled = true;
            if (core != null) { _ = core.ExecuteScriptAsync("window.dispatchEvent(new Event('moebius:back'))"); }
        }

        // ------------------------------------------------------------------ away and back (App: EnteredBackground / LeavingBackground)

        /// <summary>The app leaves the screen (on) or comes back: the page pauses its sound, the web view eases its memory.</summary>
        public async void Away(bool on, Windows.Foundation.Deferral deferral)
        {
            try
            {
                if (core == null || away == on) return;
                away = on;
                await Send(on);
                try { core.MemoryUsageTargetLevel = on ? CoreWebView2MemoryUsageTargetLevel.Low : CoreWebView2MemoryUsageTargetLevel.Normal; } catch { }
                if (!on)
                {
                    FocusWeb("back");
                    if (checkedOnce && DateTimeOffset.Now - lastCheck > TimeSpan.FromMinutes(15)) AutoCheck("resume");
                }
            }
            catch (Exception e) { bundles.Log("away: " + e.Message); }
            finally { deferral?.Complete(); }
        }

        Task Send(bool on)
        {
            var js = on
                ? "window.__moebiusAway = true; window.dispatchEvent(new Event('moebius:pause'));"
                : "window.__moebiusAway = false; window.dispatchEvent(new Event('moebius:resume'));";
            return core.ExecuteScriptAsync(js).AsTask();
        }

        // ------------------------------------------------------------------ the settings' update section (src/xbox.js xboxCall)

        async void OnMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            JsonObject msg;
            if (!JsonObject.TryParse(args.WebMessageAsJson, out msg)) return;
            var kind = msg.GetNamedString("hiraeth", "");
            if (kind == "log")
            {
                // (src/xbox.js forwardLogs: the page's warnings, errors, load timings, what the pad looks like from there)
                bundles.PageLog(msg.GetNamedString("level", "info") + ": " + msg.GetNamedString("text", ""));
                return;
            }
            if (kind != "call") return;
            var id = msg.GetNamedNumber("id", 0);
            var method = msg.GetNamedString("method", "");
            var reply = new JsonObject();
            reply["hiraeth"] = JsonValue.CreateStringValue("reply");
            reply["id"] = JsonValue.CreateNumberValue(id);
            WebBundles.Choice next = null;
            try
            {
                switch (method)
                {
                    case "info": break;
                    case "check": _ = bundles.CheckAsync(running, false, "settings"); await Task.Delay(50); break;
                    case "download": _ = bundles.CheckAsync(running, true, "settings"); await Task.Delay(50); break;
                    case "restart":
                        next = bundles.Ready(running);
                        if (next == null) throw new InvalidOperationException("No update is ready");
                        break;
                    default: throw new InvalidOperationException("Not on this app: " + method);
                }
                reply["result"] = bundles.Info(running);
            }
            catch (Exception e) { reply["error"] = JsonValue.CreateStringValue(e.Message); }
            try { core.PostWebMessageAsJson(reply.Stringify()); } catch { }
            if (next != null) Load(next, "restart");
        }
    }
}
