// The app: one page (MainPage), full screen to the TV's edges (the page keeps its HUD in the safe area itself,
// src/xbox.js), the game paused while the app is in the background. C# 7.3 (.NET Native).
using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace Hiraeth
{
    sealed partial class App : Application
    {
        public App()
        {
            // (read when WebView2 starts its browser process: sound without a press first, as on the other apps)
            Environment.SetEnvironmentVariable("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--autoplay-policy=no-user-gesture-required");
            InitializeComponent();
            EnteredBackground += OnEnteredBackground;
            LeavingBackground += OnLeavingBackground;
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            var frame = Window.Current.Content as Frame;
            if (frame == null)
            {
                // (to the TV's edges: by default an Xbox app is drawn inside the TV-safe area, a border around it)
                ApplicationView.GetForCurrentView().SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);
                frame = new Frame();
                Window.Current.Content = frame;
            }
            if (frame.Content == null) frame.Navigate(typeof(MainPage), e.Arguments);
            Window.Current.Activate();
            // (on a Windows PC, for testing: full screen as on the console)
            if (!IsXbox()) ApplicationView.GetForCurrentView().TryEnterFullScreenMode();
        }

        static bool IsXbox()
        {
            return Windows.System.Profile.AnalyticsInfo.VersionInfo.DeviceFamily == "Windows.Xbox";
        }

        void OnEnteredBackground(object sender, EnteredBackgroundEventArgs e)
        {
            var page = MainPage.Current;
            if (page != null) page.Away(true, e.GetDeferral());
        }

        void OnLeavingBackground(object sender, LeavingBackgroundEventArgs e)
        {
            var page = MainPage.Current;
            if (page != null) page.Away(false, e.GetDeferral());
        }
    }
}
