package com.rnaud.hiraeth.bridge;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

// The Android player's newer APK handed to Android's package installer (issue #805; BridgeApk.cs downloads and checks it,
// then calls install). A PackageInstaller session (no FileProvider, nothing else in the manifest): the file written into
// the session, committed, and the system's "Do you want to install this update?" started from the status it sends back
// (STATUS_PENDING_USER_ACTION). The app must be allowed to install apps (REQUEST_INSTALL_PACKAGES, added to the manifest by
// BridgeAndroidManifest.cs; the user allows it once in the screen opened here). The same release key signs every testers'
// APK, so it installs over this one and keeps the app's data (the saves). `status` says how it went, read by BridgeApk.Info.
public final class ApkInstaller {
    private ApkInstaller() { }

    /** "", "permission" (the settings' screen opened), "installing", "installed", "aborted" (cancelled), "error: …". */
    public static volatile String status = "";
    private static BroadcastReceiver receiver;

    /** Install the APK at `path` (the main thread): "permission", "installing" or "error: …". */
    public static String install(final Activity activity, final String path) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return status = "permission";
            }
            status = "installing";
            new Thread(() -> commit(activity.getApplicationContext(), path), "hiraeth-apk-install").start();
            return status;
        } catch (Exception e) {
            return status = "error: " + e.getMessage();
        }
    }

    private static void commit(Context ctx, String path) {
        try {
            File f = new File(path);
            PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(ctx.getPackageName());
            params.setSize(f.length());
            int id = pi.createSession(params);
            try (PackageInstaller.Session s = pi.openSession(id)) {
                try (OutputStream out = s.openWrite("hiraeth-unity.apk", 0, f.length()); InputStream in = new FileInputStream(f)) {
                    byte[] buf = new byte[1 << 16];
                    for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
                    s.fsync(out);
                }
                String action = ctx.getPackageName() + ".PLAYER_INSTALL";
                listen(ctx, action);
                Intent back = new Intent(action).setPackage(ctx.getPackageName());
                // (mutable: the system adds the status to it; explicit, by its package, as Android 14 asks of a mutable one)
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
                s.commit(PendingIntent.getBroadcast(ctx, id, back, flags).getIntentSender());
            }
        } catch (Exception e) {
            status = "error: " + e.getMessage();
        }
    }

    private static synchronized void listen(Context ctx, String action) {
        if (receiver != null) return;
        receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent intent) {
                int st = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                    if (confirm == null) { status = "error: no installer"; return; }
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    c.startActivity(confirm);
                    status = "installing";
                } else if (st == PackageInstaller.STATUS_SUCCESS) status = "installed";
                else if (st == PackageInstaller.STATUS_FAILURE_ABORTED) status = "aborted";
                else status = "error: " + intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            }
        };
        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else ctx.registerReceiver(receiver, filter);
    }
}
