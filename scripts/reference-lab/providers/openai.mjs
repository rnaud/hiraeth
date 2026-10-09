// OpenAI GPT Image (docs/systems/reference-lab.md). Key: OPENAI_API_KEY.
//
// Docs checked 2026-10-09:
//   https://developers.openai.com/api/docs/guides/image-generation (models, sizes, quality, the price table)
//   POST https://api.openai.com/v1/images/generations   JSON { model, prompt, n, size, quality, output_format }
//   POST https://api.openai.com/v1/images/edits         multipart: model, prompt, n, size, quality, output_format,
//                                                       and every reference as an `image[]` file part
//   Auth: `Authorization: Bearer <key>` (a header, never the URL). Answer: { data: [{ b64_json }], usage }.
//   Models: gpt-image-2 (the default here: the newest with a published price), gpt-image-2.5-sunburst (the
//   guide's editing model), gpt-image-2.5-flare (fast), gpt-image-1.5, gpt-image-1, gpt-image-1-mini.
//   Sizes: 1024x1024, 1536x1024, 1024x1536 everywhere; the 2+ models also take WIDTHxHEIGHT in multiples of 16
//   (655,360 to 8,294,400 pixels, 1:3 to 3:1), so the aspect ratio is exact there.
//   Price per image (USD, medium quality, 1024² / 1536-long): gpt-image-2 0.053 / 0.041, gpt-image-1.5 0.034 / 0.05,
//   gpt-image-1 0.042 / 0.063, gpt-image-1-mini 0.011 / 0.015; high quality is ~4x. The 2.5 models are billed by
//   token ($30 / M image output tokens) with no per-image figure published: their estimate is left out.
import { httpJson, ProviderError, sizeFor, parseAspect } from '../common.mjs';

const API = 'https://api.openai.com/v1';
const COST = {   // [square, long] at medium quality
  'gpt-image-2': [0.053, 0.041], 'gpt-image-1.5': [0.034, 0.05], 'gpt-image-1': [0.042, 0.063], 'gpt-image-1-mini': [0.011, 0.015],
};
const QUALITY_X = { low: 0.12, medium: 1, high: 4 };

/** The size for an aspect ratio: exact on the 2+ models, the nearest of the three fixed sizes on the older ones. */
export function openaiSize(model, ar) {
  const { ratio } = parseAspect(ar);
  if (/^gpt-image-1/.test(model)) return ratio > 1.15 ? '1536x1024' : ratio < 0.87 ? '1024x1536' : '1024x1024';
  const { width, height } = sizeFor(ar, 1536, 16);
  return `${width}x${height}`;
}

export default {
  id: 'openai',
  label: 'OpenAI GPT Image',
  keyName: 'OPENAI_API_KEY',
  model: 'gpt-image-2',
  models: ['gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'],
  maxRefs: 16,
  checked: '2026-10-09',
  docs: ['https://developers.openai.com/api/docs/guides/image-generation'],

  costPerImage(model, { ar = '1:1', quality = 'medium' } = {}) {
    const c = COST[model];
    if (!c) return null;
    return +(c[parseAspect(ar).ratio === 1 ? 0 : 1] * (QUALITY_X[quality] ?? 1)).toFixed(4);
  },

  /** The request (pure: the tests read it). `refs`: [{ name, mime, base64 }] already read. */
  buildRequest({ prompt, refs = [], ar = '1:1', n = 1, model = this.model, quality = 'medium' }, key) {
    const headers = { Authorization: `Bearer ${key}` };
    const fields = { model, prompt, n: String(n), size: openaiSize(model, ar), quality, output_format: 'jpeg' };
    if (!refs.length) {
      return { url: `${API}/images/generations`, init: { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, n }) } };
    }
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    for (const r of refs) form.append('image[]', new Blob([Buffer.from(r.base64, 'base64')], { type: r.mime }), r.name);
    return { url: `${API}/images/edits`, init: { method: 'POST', headers, body: form } };
  },

  async generate(opts, ctx) {
    const model = opts.model || this.model;
    const { url, init } = this.buildRequest({ ...opts, refs: (opts.refs ?? []).slice(0, this.maxRefs), model }, ctx.key);
    const json = await httpJson(this.id, url, init, { ...ctx, secrets: [ctx.key] });
    const images = (json.data ?? []).filter((d) => d.b64_json).map((d) => ({ bytes: Buffer.from(d.b64_json, 'base64'), mime: 'image/jpeg' }));
    if (!images.length) throw new ProviderError(this.id, 'server', 'no picture in the answer');
    const each = this.costPerImage(model, opts);
    return { model, images, costUSD: each == null ? null : +(each * images.length).toFixed(4), meta: { size: openaiSize(model, opts.ar ?? '1:1'), usage: json.usage ?? null } };
  },
};
