package com.rnaud.moebius;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

// AppShell (see AppShell.java: info, check, download, restart, openApk) for the page in
// the WebView fallback (WebViewActivity), through Capacitor.nativePromise('AppShell', …).
// In GeckoView the same calls come through the extension port (MainActivity).
// (check, download and openApk: NATIVE_API 4; engine: NATIVE_API 6.)
@CapacitorPlugin(name = "AppShell")
public class AppShellPlugin extends Plugin {

    private WebBundles bundles() {
        return getActivity() instanceof WebViewActivity ? ((WebViewActivity) getActivity()).bundles : null;
    }

    private void run(String method, PluginCall call) {
        AppShell.call(getActivity(), bundles(), "webview", method, new AppShell.Reply() {
            @Override public void ok(JSONObject value) {
                try { call.resolve(JSObject.fromJSONObject(value)); } catch (Exception e) { call.resolve(); }
            }
            @Override public void fail(String message) { call.reject(message); }
        });
    }

    @PluginMethod
    public void info(PluginCall call) { run("info", call); }

    @PluginMethod
    public void check(PluginCall call) { run("check", call); }

    @PluginMethod
    public void download(PluginCall call) { run("download", call); }

    @PluginMethod
    public void restart(PluginCall call) { run("restart", call); }

    @PluginMethod
    public void openApk(PluginCall call) { run("openApk", call); }
}
