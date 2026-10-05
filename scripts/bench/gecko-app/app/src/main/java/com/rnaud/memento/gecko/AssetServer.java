package com.rnaud.memento.gecko;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

// The game bundled in the APK (assets/public/), served on http://127.0.0.1:<port>/ so the page has a
// plain http origin (localStorage, module scripts, a secure context: loopback) the way Capacitor's
// https://localhost is in the WebView app. GeckoView can't intercept requests (no
// shouldInterceptRequest), and resource://android/ pages get no content scripts (the bridge), hence a loopback
// server. Loopback only; GET and HEAD; keep-alive. For the bench, `inject` puts a script tag first in
// every HTML page's head.
final class AssetServer {
    private static final String TAG = "MementoAssets";
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        String[][] t = { {"html", "text/html"}, {"js", "text/javascript"}, {"mjs", "text/javascript"}, {"css", "text/css"}, {"json", "application/json"},
            {"webmanifest", "application/manifest+json"}, {"wasm", "application/wasm"}, {"png", "image/png"}, {"jpg", "image/jpeg"}, {"svg", "image/svg+xml"},
            {"glb", "model/gltf-binary"}, {"wav", "audio/wav"}, {"mp3", "audio/mpeg"}, {"ogg", "audio/ogg"}, {"woff2", "font/woff2"}, {"ico", "image/x-icon"},
            {"bin", "application/octet-stream"} };
        for (String[] p : t) TYPES.put(p[0], p[1]);
    }

    private final AssetManager assets;
    private final String root;
    private final String inject;
    private ServerSocket socket;

    AssetServer(AssetManager assets, String root, String inject) { this.assets = assets; this.root = root; this.inject = inject; }

    void start(int port) throws IOException {
        socket = new ServerSocket(port, 50, InetAddress.getByName("127.0.0.1"));
        Thread t = new Thread(() -> {
            while (!socket.isClosed()) {
                try { Socket c = socket.accept(); new Thread(() -> serve(c), "asset-conn").start(); }
                catch (IOException e) { if (!socket.isClosed()) Log.w(TAG, "accept", e); }
            }
        }, "asset-server");
        t.setDaemon(true);
        t.start();
    }

    void stop() { try { if (socket != null) socket.close(); } catch (IOException ignored) { } }

    private void serve(Socket c) {
        try (Socket s = c) {
            s.setTcpNoDelay(true);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();
            while (true) {
                String line = readLine(in);
                if (line == null || line.isEmpty()) return;
                String[] parts = line.split(" ");
                boolean keep = !line.endsWith("HTTP/1.0");
                String h;
                while ((h = readLine(in)) != null && !h.isEmpty()) {
                    if (h.toLowerCase().startsWith("connection:") && h.toLowerCase().contains("close")) keep = false;
                }
                if (parts.length < 2) return;
                String path = java.net.URLDecoder.decode(parts[1].split("\\?")[0], "UTF-8");
                respond(out, parts[0].equals("HEAD"), path);
                out.flush();
                if (!keep) return;
            }
        } catch (IOException ignored) { }
    }

    private void respond(OutputStream out, boolean head, String path) throws IOException {
        byte[] body;
        String type;
        if (path.equals("/bench-blank.html") && inject != null) {
            body = withInject("<!doctype html><html><head><title>bench</title></head><body></body></html>").getBytes(StandardCharsets.UTF_8);
            type = "text/html";
        } else {
            if (path.contains("..")) { status(out, 403); return; }
            String p = path.endsWith("/") ? path + "index.html" : path;
            byte[] b = read(root + p);
            if (b == null && !p.substring(p.lastIndexOf('/')).contains(".")) { p = "/index.html"; b = read(root + p); }   // the game's routes
            if (b == null) { status(out, 404); return; }
            String ext = p.substring(p.lastIndexOf('.') + 1);
            type = TYPES.getOrDefault(ext, "application/octet-stream");
            body = type.equals("text/html") && inject != null ? withInject(new String(b, StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8) : b;
        }
        String hdr = "HTTP/1.1 200 OK\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length + "\r\nCache-Control: no-cache\r\n\r\n";
        out.write(hdr.getBytes(StandardCharsets.US_ASCII));
        if (!head) out.write(body);
    }

    private String withInject(String html) {
        String tag = "<script src=\"" + inject + "\"></script>";
        int i = html.indexOf("<head>");
        return i >= 0 ? html.substring(0, i + 6) + tag + html.substring(i + 6) : tag + html;
    }

    private static void status(OutputStream out, int code) throws IOException {
        out.write(("HTTP/1.1 " + code + " X\r\nContent-Length: 0\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
    }

    private byte[] read(String name) {
        try (InputStream in = assets.open(name.startsWith("/") ? name.substring(1) : name)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream(64 << 10);
            byte[] buf = new byte[64 << 10];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toByteArray();
        } catch (IOException e) { return null; }
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder sb = new StringBuilder();
        int ch;
        while ((ch = in.read()) >= 0) {
            if (ch == '\n') return sb.toString().replace("\r", "");
            sb.append((char) ch);
        }
        return sb.length() > 0 ? sb.toString() : null;
    }
}
