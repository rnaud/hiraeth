// Google Gemini image ("Nano Banana") (docs/systems/reference-lab.md). Key: GEMINI_API_KEY.
//
// Docs checked 2026-10-09:
//   https://ai.google.dev/api/generate-content          (generateContent: current, no deprecation notice)
//   https://ai.google.dev/gemini-api/docs/image-generation (models, reference limits; its examples now use
//                                                        the Interactions API, kept here as `api: 'interactions'`)
//   https://ai.google.dev/gemini-api/docs/pricing
//   POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
//        { contents: [{ parts: [{ inlineData: { mimeType, data } }…, { text }] }],
//          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } } }
//        → candidates[].content.parts[].inlineData { mimeType, data }
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   (GEMINI_IMAGE_API=interactions)
//        { model, input: [{ type: 'text', text }, { type: 'image', mime_type, data }…],
//          response_format: { type: 'image', aspect_ratio } } → steps[type=model_output].content[type=image].data
//   Auth: `x-goog-api-key: <key>` (a header, never the ?key= query).
//   Models: gemini-nano-banana-2.1 (recommended), gemini-3-pro-image (best with style references: 3 style +
//   6 object refs), gemini-3.1-flash-image, gemini-3.1-flash-lite-image (no style references),
//   gemini-2.5-flash-image (shut down 2026-10-02). Up to 14 references overall. One picture a call.
//   Price per image at 1K (USD): nano-banana-2.1 0.0336, 3.1-flash 0.067, 3.1-flash-lite 0.0336, 3-pro 0.134.
import { httpJson, ProviderError, parseAspect, times } from '../common.mjs';

const API = 'https://generativelanguage.googleapis.com/v1beta';
const COST = { 'gemini-nano-banana-2.1': 0.0336, 'gemini-3.1-flash-image': 0.067, 'gemini-3.1-flash-lite-image': 0.0336, 'gemini-3-pro-image': 0.134, 'gemini-2.5-flash-image': 0.039 };

/** The pictures in an answer, in either API's shape (and either key casing). */
export function geminiImages(json) {
  const out = [];
  for (const c of json?.candidates ?? []) for (const p of c?.content?.parts ?? []) {
    const d = p.inlineData ?? p.inline_data;
    if (d?.data) out.push({ bytes: Buffer.from(d.data, 'base64'), mime: d.mimeType ?? d.mime_type ?? 'image/png' });
  }
  for (const s of json?.steps ?? []) if (s?.type === 'model_output') for (const c of s.content ?? []) {
    if (c?.type === 'image' && c.data) out.push({ bytes: Buffer.from(c.data, 'base64'), mime: c.mime_type ?? c.mimeType ?? 'image/png' });
  }
  return out;
}

export default {
  id: 'gemini',
  label: 'Google Gemini (Nano Banana)',
  keyName: 'GEMINI_API_KEY',
  model: 'gemini-nano-banana-2.1',
  models: ['gemini-nano-banana-2.1', 'gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'],
  maxRefs: 14,
  checked: '2026-10-09',
  docs: ['https://ai.google.dev/api/generate-content', 'https://ai.google.dev/gemini-api/docs/image-generation', 'https://ai.google.dev/gemini-api/docs/pricing'],

  costPerImage(model) { return COST[model] ?? null; },

  /** One call's request (pure). `api`: 'generateContent' (default) or 'interactions'. */
  buildRequest({ prompt, refs = [], ar = '1:1', model = this.model, api = 'generateContent' }, key) {
    parseAspect(ar);
    const headers = { 'x-goog-api-key': key, 'Content-Type': 'application/json' };
    if (api === 'interactions') {
      const input = [{ type: 'text', text: prompt }, ...refs.map((r) => ({ type: 'image', mime_type: r.mime, data: r.base64 }))];
      return { url: `${API}/interactions`, init: { method: 'POST', headers, body: JSON.stringify({ model, input, response_format: { type: 'image', aspect_ratio: ar } }) } };
    }
    const parts = [...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })), { text: prompt }];
    const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ar } } };
    return { url: `${API}/models/${encodeURIComponent(model)}:generateContent`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
  },

  async generate(opts, ctx) {
    const model = opts.model || this.model;
    const api = ctx.env?.GEMINI_IMAGE_API === 'interactions' ? 'interactions' : 'generateContent';
    const req = this.buildRequest({ ...opts, refs: (opts.refs ?? []).slice(0, this.maxRefs), model, api }, ctx.key);
    const runs = await times(Math.max(1, opts.n ?? 1), async () => {
      const json = await httpJson(this.id, req.url, req.init, { ...ctx, secrets: [ctx.key] });
      const imgs = geminiImages(json);
      if (!imgs.length) {
        const why = json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason;
        throw new ProviderError(this.id, why && why !== 'STOP' ? 'blocked' : 'server', why ? `no picture (${why})` : 'no picture in the answer');
      }
      return imgs[0];
    });
    const each = this.costPerImage(model);
    return { model, images: runs, costUSD: each == null ? null : +(each * runs.length).toFixed(4), meta: { api } };
  },
};
