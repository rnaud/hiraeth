// A screenshot as a Notes draft (issue #8; docs/systems/notes.md "Screenshot drafts"): the dev menu's
// "Screenshot to a Notes draft" (L3 + R3, F2) takes the frame just drawn, small, with where the game is (the world,
// where you stand, the build, the preset), and saves it as a draft on the notebook (worker/drafts.js), where the Notes
// page on any device lists it to be written up and sent as an issue. Nothing is filed from here.
//
// The game holds no password: the device is paired once. The first draft asks the notebook for a code, says it, and
// waits; the author types it on the signed-in Notes page and the device keeps the token it is given (localStorage).
// Drafts wait on the device until they are sent (a queue in localStorage, a few at most), so a draft taken offline or
// before pairing goes up later.
//
//   const drafts = new ShotDrafts({ toast });
//   drafts.save({ shot: await shotJpeg(canvas), context: shotContext({...}) })
//   drafts.status() → { paired, code, queued }

export const NOTES_HOST = 'https://hiraeth.alexandria-rnaud.workers.dev';
export const DEVICE_KEY = 'hiraeth.notes.device.v1';
export const QUEUE_KEY = 'hiraeth.notes.shots.v1';
/** The size the frame is taken at (its width, at most) and the most a picture may weigh (the notebook's limit: 90 KB). */
export const SHOT = { width: 640, bytes: 88000, queue: 6 };

/** The frame just drawn, copied small onto a 2D canvas (call it right after the render, in the same task: the WebGL canvas keeps no copy). */
export function grabFrame(source, { width = SHOT.width, doc = globalThis.document } = {}) {
  const w0 = source?.width ?? 0, h0 = source?.height ?? 0;
  if (!w0 || !h0 || !doc?.createElement) return null;
  const k = Math.min(1, width / w0), c = doc.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(source, 0, 0, c.width, c.height);
  return c;
}
const toBlob = (canvas, q) => new Promise((resolve) => { try { canvas.toBlob((b) => resolve(b), 'image/jpeg', q); } catch { resolve(null); } });
async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
/** A canvas as a JPEG small enough for the notebook (base64), lowering the quality, then the size, until it fits; or null. */
export async function shotJpeg(canvas, { bytes = SHOT.bytes, doc = globalThis.document } = {}) {
  let c = canvas;
  for (let round = 0; c && round < 3; round++) {
    for (const q of [0.72, 0.55, 0.4]) {
      const b = await toBlob(c, q);
      if (b && b.size <= bytes) return base64(b);
    }
    c = grabFrame(c, { width: Math.round(c.width * 0.7), doc });   // (smaller, and again)
  }
  return null;
}

/** Where the game is, as plain short values (the notebook keeps strings, numbers and booleans only, 24 at most). */
export function shotContext({ levelId, world, pos, heading, version, build, commit, preset, device, quest, stage, hour, slot, at = new Date() } = {}) {
  const r = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined);
  const out = {
    level: levelId, world, x: r(pos?.x), y: r(pos?.y), z: r(pos?.z), heading: r(heading),
    version, build, commit, preset, device, quest, stage, hour: r(hour), slot: slot == null ? undefined : String(slot),
    at: at.toISOString?.() ?? String(at),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}
/** The default words of a draft (the Notes page asks for the real ones). */
export const draftText = (ctx) => `Screenshot · ${ctx.world ?? ctx.level ?? 'Hiraeth'}`;

export class ShotDrafts {
  constructor({ host = NOTES_HOST, fetch: f = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, toast = () => {}, setTimeout: st = globalThis.setTimeout, pollMs = 3000 } = {}) {
    Object.assign(this, { host, f, storage, toast, st, pollMs });
    this.pairing = null;    // { code, secret, expires }
    this.sending = false;
  }
  // ---------------------------------------------------------------- the device's memory
  read(key, fallback) { try { const v = JSON.parse(this.storage?.getItem(key) ?? 'null'); return v ?? fallback; } catch { return fallback; } }
  write(key, v) { try { if (v == null) this.storage?.removeItem(key); else this.storage?.setItem(key, JSON.stringify(v)); return true; } catch { return false; } }
  get token() { return this.read(DEVICE_KEY, null)?.token ?? null; }
  queue() { const q = this.read(QUEUE_KEY, []); return Array.isArray(q) ? q : []; }
  status() { return { paired: !!this.token, code: this.pairing?.code ?? null, queued: this.queue().length }; }

  /** Keep a draft on the device and send what is waiting. Resolves to what happened: 'sent' | 'queued' | 'pairing' | 'full'. */
  async save({ shot = null, context = {}, text = draftText(context) } = {}) {
    let q = [...this.queue(), { text, context, shot, t: Date.now() }];
    let full = false;
    while (q.length > SHOT.queue) { q.shift(); full = true; }
    while (q.length && !this.write(QUEUE_KEY, q)) { q.shift(); full = true; }   // (storage full: the oldest goes)
    if (!q.length) { this.toast('Could not keep the screenshot on this device: its storage is full.'); return 'full'; }
    if (full) this.toast('The oldest unsent screenshot was dropped to make room.');
    return this.flush();
  }

  async api(path, { method = 'GET', body, token } = {}) {
    if (!this.f) throw new Error('offline');
    const r = await this.f(`${this.host}/api/notes/${path}`, { method, cache: 'no-store', credentials: 'omit',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await r.json(); } catch { /* no body */ }
    return { status: r.status, ok: r.ok, data };
  }

  /** Send the waiting drafts (paired), or pair first. */
  async flush() {
    if (this.sending) return 'queued';
    const token = this.token;
    if (!token) { await this.pair(); return this.token ? this.flush() : 'pairing'; }
    this.sending = true;
    let sent = 0;
    try {
      for (const d of this.queue()) {
        let r;
        try { r = await this.api('drafts', { method: 'POST', token, body: { text: d.text, context: d.context, shot: d.shot } }); }
        catch { this.toast('Saved on this device. It goes to your notebook when the connection is back.'); return 'queued'; }
        if (r.status === 401) { this.write(DEVICE_KEY, null); this.sending = false; await this.pair(); return 'pairing'; }
        if (!r.ok) { this.toast(`Saved on this device; the notebook said: ${r.data?.error ?? r.status}`); return 'queued'; }
        this.write(QUEUE_KEY, this.queue().filter((x) => x.t !== d.t));
        sent++;
      }
    } finally { this.sending = false; }
    if (sent) this.toast(sent === 1 ? 'Screenshot saved as a draft in your Notes.' : `${sent} screenshots saved as drafts in your Notes.`);
    return 'sent';
  }

  /** Ask the notebook for a pairing code, say it, and wait for the Notes page to approve it (then send). */
  async pair() {
    const live = this.pairing && this.pairing.expires * 1000 > Date.now();
    if (!live) {
      let r;
      try { r = await this.api('pair', { method: 'POST', body: {} }); }
      catch { this.toast('Saved on this device. No connection to your notebook to pair with.'); return false; }
      if (!r.ok || !r.data?.code) { this.toast(`Saved on this device; pairing failed: ${r.data?.error ?? r.status}`); return false; }
      this.pairing = r.data;
      this.poll();
    }
    this.toast(`Pair this device: on the Notes page, choose Pair a device and enter ${this.pairing.code}. The screenshot waits here.`);
    return false;
  }
  /** Ask, every few seconds while the code lasts, whether the Notes page has approved it. */
  poll() {
    const p = this.pairing;
    const tick = async () => {
      if (this.pairing !== p || p.expires * 1000 <= Date.now()) { if (this.pairing === p) this.pairing = null; return; }
      let r;
      try { r = await this.api(`pair?code=${encodeURIComponent(p.code)}&secret=${encodeURIComponent(p.secret)}`); } catch { r = null; }
      if (r?.data?.token) {
        this.pairing = null;
        this.write(DEVICE_KEY, { token: r.data.token, at: Date.now() });
        this.toast('Paired with your notebook.');
        return this.flush();
      }
      if (r && r.status === 404) { this.pairing = null; return; }
      this.st?.(tick, this.pollMs);
    };
    this.st?.(tick, this.pollMs);
  }
}
