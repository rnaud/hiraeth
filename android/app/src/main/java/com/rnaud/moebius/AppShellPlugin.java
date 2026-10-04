package com.rnaud.moebius;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// What the page asks the app (src/native-app.js, through
// Capacitor.nativePromise('AppShell', …)): which web build is running and
// whether a downloaded one is ready (info), and "restart now" (restart).
@CapacitorPlugin(name = "AppShell")
public class AppShellPlugin extends Plugin {

    private WebBundles bundles() {
        return getActivity() instanceof MainActivity ? ((MainActivity) getActivity()).bundles : null;
    }

    @PluginMethod
    public void info(PluginCall call) {
        WebBundles b = bundles();
        JSObject ret = new JSObject();
        ret.put("native", WebBundles.NATIVE_API);
        if (b != null) {
            ret.put("app", b.appBuild());
            ret.put("web", b.webBuild());
            ret.put("bundle", b.fromBundle());
            ret.put("ready", b.ready());
            ret.put("readyVersion", b.readyVersion());
            ret.put("check", b.check());
            ret.put("latest", b.latest());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void restart(PluginCall call) {
        WebBundles b = bundles();
        if (b == null) { call.reject("no bundles"); return; }
        getActivity().runOnUiThread(() -> {
            if (b.applyNow()) call.resolve();
            else call.reject("no update ready");
        });
    }
}
