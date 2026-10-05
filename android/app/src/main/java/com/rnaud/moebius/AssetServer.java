package com.rnaud.moebius;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

// The game for GeckoView, on http://127.0.0.1:<PORT>/ (MainActivity.ORIGIN): GeckoView can't
// intercept requests the way Capacitor serves https://localhost in the WebView, and pages from
// resource://android/ get no content scripts (the bridge), so a loopback server gives the page a
// plain origin of its own: localStorage (the saves), module scripts, a secure context (loopback).
// One fixed port: the origin, and with it the saves, must never move. It serves the game built into
// the APK (assets/public/, as `npx cap sync` puts it) or a downloaded bundle's directory
// (WebBundles: setRoot), the game's routes falling back to index.html, GET and HEAD, keep-alive,
// revalidation by ETag (made of the build being served: a new APK or bundle changes them all). Loopback only: nothing else on the network
// reaches it, and it serves nothing but the game's files (the bridge to the app is the extension
// port, not this server).
//
// Once, for the first launch in GeckoView, every index.html also starts with the saves copied from
// the WebView (SaveImport: setImport) until the page says it has written them.
final class AssetServer {
    static final String TAG = "MoebiusServer";
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        String[][] t = { {"html", "text/html; charset=utf-8"}, {"js", "text/javascript"}, {"mjs", "text/javascript"}, {"css", "text/css"},
            {"json", "application/json"}, {"webmanifest", "application/manifest+json"}, {"wasm", "application/wasm"}, {"png", "image/png"},
            {"jpg", "image/jpeg"}, {"jpeg", "image/jpeg"}, {"webp", "image/webp"}, {"svg", "image/svg+xml"}, {"glb", "model/gltf-binary"},
            {"gltf", "model/gltf+json"}, {"wav", "audio/wav"}, {"mp3", "audio/mpeg"}, {"ogg", "audio/ogg"}, {"woff2", "font/woff2"},
            {"ico", "image/x-icon"}, {"txt", "text/plain"}, {"bin", "application/octet-stream"} };
        for (String[] p : t) TYPES.put(p[0], p[1]);
    }

    private final AssetManager assets;
    private volatile File root;          // a downloaded bundle; null: the APK's assets/public
    private volatile String build = "0"; // what is served (in the ETags)
    private volatile String importScript;
    private volatile String benchTag;    // debug builds: a script first in every page (the bench's page bridge)
    private ServerSocket socket;

    AssetServer(AssetManager assets) { this.assets = assets; }

    /** @throws IOException when the port is taken (another app holds it) */
    void start(int port) throws IOException {
        socket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"));
        Thread t = new Thread(() -> {
            while (!socket.isClosed()) {
                try {
                    Socket c = socket.accept();
                    Thread w = new Thread(() -> serve(c), "moebius-asset");
                    w.setDaemon(true);
                    w.start();
                } catch (IOException e) { if (!socket.isClosed()) Log.w(TAG, "accept", e); }
            }
        }, "moebius-asset-server");
        t.setDaemon(true);
        t.start();
    }

    boolean running() { return socket != null && !socket.isClosed(); }

    /**
     * serve this directory (a downloaded bundle), or the APK's own game (null)
     * @param build what it is (a bundle's build, or the APK's version code and install time): the ETags
     */
    void setRoot(String dir, String build) { root = dir != null ? new File(dir) : null; this.build = build; }

    /** the script that writes the WebView's saves into this origin's storage (null: none, or done) */
    void setImport(String script) { importScript = script; }

    /** debug builds: put this tag first in every HTML page, and serve an empty /bench-blank.html (scripts/bench) */
    void setBenchTag(String tag) { benchTag = tag; }

    private void serve(Socket c) {
        try (Socket s = c) {
            s.setTcpNoDelay(true);
            s.setSoTimeout(60000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();
            while (true) {
                String line = readLine(in);
                if (line == null || line.isEmpty()) return;
                String[] parts = line.split(" ");
                boolean keep = !line.endsWith("HTTP/1.0");
                String etag = null, h;
                while ((h = readLine(in)) != null && !h.isEmpty()) {
                    String l = h.toLowerCase(Locale.ROOT);
                    if (l.startsWith("connection:") && l.contains("close")) keep = false;
                    else if (l.startsWith("if-none-match:")) etag = h.substring(h.indexOf(':') + 1).trim();
                }
                if (parts.length < 2) return;
                respond(out, parts[0], parts[1], etag);
                out.flush();
                if (!keep) return;
            }
        } catch (IOException ignored) { }
    }

    private void respond(OutputStream out, String method, String target, String ifNoneMatch) throws IOException {
        if (!method.equals("GET") && !method.equals("HEAD")) { status(out, 405, "Method Not Allowed"); return; }
        String path;
        try { path = URLDecoder.decode(target.split("[?#]")[0], "UTF-8"); } catch (IllegalArgumentException e) { status(out, 400, "Bad Request"); return; }
        if (!path.startsWith("/") || path.contains("..") || path.contains("\\")) { status(out, 403, "Forbidden"); return; }
        if (path.endsWith("/")) path += "index.html";
        File dir = root;
        String b = build;
        String bench = benchTag;
        if (bench != null && path.equals("/bench-blank.html")) {
            byte[] body = ("<!doctype html><html><head>" + bench + "<title>bench</title></head></html>").getBytes(StandardCharsets.UTF_8);
            head(out, 200, "OK", "text/html; charset=utf-8", body.length, "no-store", null);
            if (!method.equals("HEAD")) out.write(body);
            return;
        }
        if (!exists(dir, path) && !path.substring(path.lastIndexOf('/')).contains(".")) path = "/index.html";   // the game's routes
        if (!exists(dir, path)) { status(out, 404, "Not Found"); return; }
        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        String type = TYPES.getOrDefault(ext, "application/octet-stream");
        String inject = (path.equals("/index.html") && importScript != null ? importScript : "") + (bench != null && ext.startsWith("htm") ? bench : "");
        if (!inject.isEmpty()) {
            // (the import's page: never cached, never revalidated)
            String html = new String(read(dir, path), StandardCharsets.UTF_8);
            int i = html.indexOf("<head>");
            html = i >= 0 ? html.substring(0, i + 6) + inject + html.substring(i + 6) : inject + html;
            byte[] body = html.getBytes(StandardCharsets.UTF_8);
            head(out, 200, "OK", type, body.length, "no-store", null);
            if (!method.equals("HEAD")) out.write(body);
            return;
        }
        String tag = "\"" + b + "-" + Integer.toHexString(path.hashCode()) + "\"";
        if (tag.equals(ifNoneMatch)) { head(out, 304, "Not Modified", null, -1, "no-cache", tag); return; }
        if (dir != null) {
            File f = new File(dir, path.substring(1));
            head(out, 200, "OK", type, f.length(), "no-cache", tag);
            if (!method.equals("HEAD")) try (InputStream in = new FileInputStream(f)) { copy(in, out); }
        } else {
            // (assets are compressed in the APK: their length is known once read)
            byte[] body = read(null, path);
            head(out, 200, "OK", type, body.length, "no-cache", tag);
            if (!method.equals("HEAD")) out.write(body);
        }
    }

    private boolean exists(File dir, String path) {
        if (dir != null) return new File(dir, path.substring(1)).isFile();
        try (InputStream in = assets.open("public" + path)) { return true; } catch (IOException e) { return false; }
    }

    private byte[] read(File dir, String path) throws IOException {
        try (InputStream in = dir != null ? new FileInputStream(new File(dir, path.substring(1))) : assets.open("public" + path)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            copy(in, b);
            return b.toByteArray();
        }
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] b = new byte[64 * 1024];
        for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
    }

    private static void head(OutputStream out, int code, String why, String type, long length, String cache, String etag) throws IOException {
        StringBuilder h = new StringBuilder("HTTP/1.1 ").append(code).append(' ').append(why).append("\r\n");
        if (type != null) h.append("Content-Type: ").append(type).append("\r\n");
        h.append("Content-Length: ").append(Math.max(0, length)).append("\r\n");
        h.append("Cache-Control: ").append(cache).append("\r\n");
        if (etag != null) h.append("ETag: ").append(etag).append("\r\n");
        h.append("\r\n");
        out.write(h.toString().getBytes(StandardCharsets.US_ASCII));
    }

    private static void status(OutputStream out, int code, String why) throws IOException { head(out, code, why, "text/plain", 0, "no-store", null); }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        for (int ch; (ch = in.read()) >= 0; ) {
            if (ch == '\n') return sb.toString().replace("\r", "");
            if (sb.length() > 16384) throw new IOException("line too long");
            sb.append((char) ch);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }
}
