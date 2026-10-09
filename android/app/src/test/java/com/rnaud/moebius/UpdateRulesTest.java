package com.rnaud.moebius;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;

import org.junit.Test;

// The over-the-air update's rules (UpdateRules). Run with: cd android && ./gradlew testDebugUnitTest
public class UpdateRulesTest {

    @Test
    public void whichBuildsTheAppTakes() {
        assertEquals("stage", UpdateRules.decide(14, 4, 4, 12, false));
        assertEquals("skip", UpdateRules.decide(12, 4, 4, 12, false));   // the same build as on the device
        assertEquals("skip", UpdateRules.decide(11, 3, 4, 12, false));   // older
        assertEquals("stage", UpdateRules.decide(14, 3, 4, 12, false));  // an older native level is fine
        assertEquals("apk", UpdateRules.decide(14, 5, 4, 12, false));    // needs a newer app
        assertEquals("apk", UpdateRules.decide(11, 5, 4, 12, false));
        assertEquals("skip", UpdateRules.decide(14, 4, 4, 12, true));    // failed to boot before
    }

    @Test
    public void theStateAfterACheck() {
        assertEquals("downloading", UpdateRules.afterCheck("stage", 14, 0, true));   // automatic: fetch it by itself
        assertEquals("available", UpdateRules.afterCheck("stage", 14, 0, false));    // the settings: wait for Download
        assertEquals("apk", UpdateRules.afterCheck("apk", 14, 0, true));
        assertEquals("current", UpdateRules.afterCheck("skip", 14, 0, true));
        assertEquals("ready", UpdateRules.afterCheck("skip", 14, 14, false));        // already downloaded
        assertEquals("current", UpdateRules.afterCheck("skip", 14, 13, false));
    }

    @Test
    public void whenToCheckAgain() {
        long min = 60 * 1000L;
        assertTrue(UpdateRules.dueOnResume(1000, 0, "idle"));                 // never checked: the launch
        assertFalse(UpdateRules.dueOnResume(5 * min, 1, "current"));
        assertTrue(UpdateRules.dueOnResume(16 * min, 1, "current"));
        assertFalse(UpdateRules.dueOnResume(30 * 1000L, 1, "offline"));
        assertTrue(UpdateRules.dueOnResume(2 * min, 1, "offline"));            // a failure is retried sooner
        assertTrue(UpdateRules.dueOnResume(2 * min, 1, "error"));
        assertFalse(UpdateRules.dueOnResume(99 * min, 1, "downloading"));     // already running
        assertFalse(UpdateRules.dueOnResume(99 * min, 1, "checking"));
        assertFalse(UpdateRules.dueOnResume(99 * min, 0, "off"));             // a debug build
        assertEquals(30000L, UpdateRules.retryDelay(1));
        assertEquals(120000L, UpdateRules.retryDelay(2));
        assertEquals(600000L, UpdateRules.retryDelay(3));
        assertEquals(-1L, UpdateRules.retryDelay(4));
        assertEquals(-1L, UpdateRules.retryDelay(0));
    }

    @Test
    public void offlineOrAnError() {
        assertEquals("offline", UpdateRules.classify(new UnknownHostException("github.com")));
        assertEquals("offline", UpdateRules.classify(new ConnectException("refused")));
        assertEquals("offline", UpdateRules.classify(new SocketTimeoutException()));
        assertEquals("offline", UpdateRules.classify(new IOException("wrapped", new UnknownHostException())));
        assertEquals("error", UpdateRules.classify(new IOException("HTTP 404")));
        assertEquals("error", UpdateRules.classify(new IOException("the download was damaged (sha256 mismatch)")));
    }

    @Test
    public void pastTheCaches() {
        assertEquals("https://x/web.json?t=5", UpdateRules.bust("https://x/web.json", 5));
        assertEquals("https://x/web.json?a=1&t=5", UpdateRules.bust("https://x/web.json?a=1", 5));
        assertEquals("https://github.com/rnaud/hiraeth/releases/tag/v0.56",
            UpdateRules.pageFor("https://github.com/rnaud/hiraeth/releases/download/v0.56/moebius-v0.56.apk", "f"));
        assertEquals("f", UpdateRules.pageFor("https://example.com/a.apk", "f"));
        assertEquals("f", UpdateRules.pageFor(null, "f"));
    }

    @Test
    public void updatesFromTheGamesSite() {
        // the site's web.json needs WEB_MIN_NATIVE, below this app's NATIVE_API: taken here and by older apps alike
        assertTrue(WebBundles.WEB_MIN_NATIVE <= WebBundles.NATIVE_API);
        assertEquals("stage", UpdateRules.decide(545, WebBundles.WEB_MIN_NATIVE, WebBundles.NATIVE_API, 541, false));
        assertEquals("stage", UpdateRules.decide(545, WebBundles.WEB_MIN_NATIVE, 4, 117, false));   // an app from before, over its run-numbered build
        // the same commit's build as the APK's versionCode: nothing to take
        assertEquals("skip", UpdateRules.decide(541, WebBundles.WEB_MIN_NATIVE, WebBundles.NATIVE_API, 541, false));
        assertTrue(WebBundles.MANIFEST.startsWith("https://memento.alexandria-rnaud.workers.dev/updates/"));
        // no release page on the site: the APK's page falls back to the releases (the author's)
        assertEquals(WebBundles.RELEASES, UpdateRules.pageFor("https://memento.alexandria-rnaud.workers.dev/updates/web-545.zip", WebBundles.RELEASES));
    }

    @Test
    public void busyStates() {
        assertTrue(UpdateRules.busy("checking"));
        assertTrue(UpdateRules.busy("downloading"));
        assertFalse(UpdateRules.busy("ready"));
        assertFalse(UpdateRules.busy("available"));
    }
}
