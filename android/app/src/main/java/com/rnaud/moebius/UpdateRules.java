package com.rnaud.moebius;

import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

// The over-the-air update's rules, without Android: what a manifest means for this
// app, the state to show after a check, when to check again, and how a failure reads.
// WebBundles runs them; app/src/test/.../UpdateRulesTest.java tests them, and
// src/updates.js mirrors the states for the settings (tests/updates.test.js).
//
// States: idle, checking, current, available, downloading, ready, apk, offline, error, off.
final class UpdateRules {
    private UpdateRules() { }

    /** An automatic check again after this long in front (15 min); after a failure, sooner (1 min). */
    static final long RESUME_INTERVAL_MS = 15 * 60 * 1000L;
    static final long RESUME_AFTER_FAILURE_MS = 60 * 1000L;
    /** Retries of a failed automatic check while the app stays in front: 30 s, 2 min, 10 min, then wait for a resume. */
    static final long[] RETRY_MS = { 30 * 1000L, 2 * 60 * 1000L, 10 * 60 * 1000L };

    /**
     * What to do with a manifest; mirrored by webDecision() in scripts/release-info.mjs.
     * @param current the newest build already on the device (built in, in use or pending)
     * @return "apk" (it needs a newer app: the APK update comes first), "skip" or "stage"
     */
    static String decide(int build, int minNative, int nativeApi, int current, boolean bad) {
        if (minNative > nativeApi) return "apk";
        if (bad || build <= current) return "skip";
        return "stage";
    }

    /**
     * The state after a check.
     * @param ready the build downloaded and waiting (0: none)
     * @param auto an automatic check (launch, resume, retry) downloads by itself; one from the settings waits for "Download"
     */
    static String afterCheck(String decision, int build, int ready, boolean auto) {
        if ("apk".equals(decision)) return "apk";
        if ("skip".equals(decision)) return ready > 0 && ready >= build ? "ready" : "current";
        return auto ? "downloading" : "available";
    }

    /** A check or a download is running (a second one joins it instead of starting again). */
    static boolean busy(String state) { return "checking".equals(state) || "downloading".equals(state); }

    /** Whether coming back to the app should check again. */
    static boolean dueOnResume(long now, long lastEnd, String state) {
        if (busy(state) || "off".equals(state)) return false;
        if (lastEnd <= 0) return true;
        boolean failed = "offline".equals(state) || "error".equals(state);
        return now - lastEnd >= (failed ? RESUME_AFTER_FAILURE_MS : RESUME_INTERVAL_MS);
    }

    /** The wait before retry number `failures` (1, 2, …) of an automatic check, or -1: stop until the next resume. */
    static long retryDelay(int failures) {
        return failures >= 1 && failures <= RETRY_MS.length ? RETRY_MS[failures - 1] : -1;
    }

    /** "offline" when the network wasn't there (no route, no DNS, a timeout), else "error". */
    static String classify(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof UnknownHostException || t instanceof ConnectException || t instanceof NoRouteToHostException
                || t instanceof SocketTimeoutException) return "offline";
            if (t instanceof SocketException && String.valueOf(t.getMessage()).toLowerCase().contains("network is unreachable")) return "offline";
        }
        return "error";
    }

    /** Ask past every cache (GitHub's CDN, any proxy): a query that changes each time. */
    static String bust(String url, long now) {
        return url + (url.indexOf('?') >= 0 ? '&' : '?') + "t=" + now;
    }

    /** The release page next to a download URL (…/releases/download/v0.56/x → …/releases/tag/v0.56). */
    static String pageFor(String url, String fallback) {
        if (url == null) return fallback;
        int i = url.indexOf("/releases/download/");
        if (i < 0) return fallback;
        String rest = url.substring(i + "/releases/download/".length());
        int slash = rest.indexOf('/');
        if (slash <= 0) return fallback;
        return url.substring(0, i) + "/releases/tag/" + rest.substring(0, slash);
    }
}
