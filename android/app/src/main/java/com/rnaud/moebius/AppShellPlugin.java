package com.rnaud.moebius;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// What the page asks the app (src/native-app.js and src/update-panel.js, through
// Capacitor.nativePromise('AppShell', …)):
// - info: which web build is running, the update check's state (with the newest build,
//   its size and changelog lines, the download's progress, the last error and the log);
// - check: look for an update now (the settings' "Check for updates");
// - download: fetch the update the last check found ("Download and restart");
// - restart: switch to the downloaded build (the page reloads at the title screen);
// - openApk: open the release page of the APK the newest game needs.
// check and download resolve at once; the page follows with info and the
// moebius:webupdate events. (check, download and openApk: NATIVE_API 4.)
@CapacitorPlugin(name = "AppShell")
public class AppShellPlugin extends Plugin {

    private WebBundles bundles() {
        return getActivity() instanceof MainActivity ? ((MainActivity) getActivity()).bundles : null;
    }

    private JSObject info(WebBundles b) {
        JSObject ret = new JSObject();
        ret.put("native", WebBundles.NATIVE_API);
        if (b != null) b.fill(ret);
        return ret;
    }

    @PluginMethod
    public void info(PluginCall call) {
        call.resolve(info(bundles()));
    }

    @PluginMethod
    public void check(PluginCall call) {
        WebBundles b = bundles();
        if (b == null) { call.reject("no bundles"); return; }
        b.checkNow();
        call.resolve(info(b));
    }

    @PluginMethod
    public void download(PluginCall call) {
        WebBundles b = bundles();
        if (b == null) { call.reject("no bundles"); return; }
        if (b.downloadNow()) call.resolve(info(b));
        else call.reject("nothing to download");
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

    @PluginMethod
    public void openApk(PluginCall call) {
        WebBundles b = bundles();
        String url = b != null ? b.apkPage() : WebBundles.RELEASES;
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            JSObject ret = new JSObject();
            ret.put("url", url);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            call.reject("no browser for " + url);
        }
    }
}
