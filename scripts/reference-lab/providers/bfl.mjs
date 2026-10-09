// Black Forest Labs, direct (docs/systems/reference-lab.md): FLUX.2 without fal in between. Key: BFL_API_KEY.
//
// Docs checked 2026-10-09:
//   https://docs.bfl.ai/quick_start/generating_images      (endpoints, polling, limits)
//   https://docs.bfl.ai/api-reference/models/generate-or-edit-an-image-with-flux2-[pro]   (the request body)
//   https://docs.bfl.ai/flux_2/flux2_image_editing           (multi-reference: up to 8 by API)
//   https://docs.bfl.ai/quick_start/pricing
//   POST https://api.bfl.ai/v1/<model>   header `x-key: <key>`
//        { prompt, input_image, input_image_2 … input_image_8, width, height, output_format, safety_tolerance }
//        → { id, polling_url, cost (credits) }
//   GET  <polling_url> (header x-key) → { status: 'Pending' | 'Ready' | 'Error' | 'Failed' …, result: { sample } }
//        `sample` is a signed URL valid 10 minutes, fetched without the key. 429: over 24 tasks at once;
//        402: out of credits. One picture a call. Input images are sent as base64 (the schema's "string").
//   Models: flux-2-pro (pinned; the default), flux-2-pro-preview (latest pro), flux-2-max, flux-2-flex,
//   flux-2-klein-9b. Price per image (USD, 1 credit = $0.01): pro from 0.03 (0.045 with references), max from
//   0.07, flex from 0.05, klein 9B from 0.015; it grows with the megapixels. The answer's `cost` wins when given.
import { httpJson, ProviderError, sizeFor, pollUntil, downloadImage, onHost, times } from '../common.mjs';

const API = 'https://api.bfl.ai/v1';
const HOSTS = ['bfl.ai'];   // (the key only ever goes here: a polling URL elsewhere is refused)
const COST = { 'flux-2-pro': [0.03, 0.045], 'flux-2-pro-preview': [0.03, 0.045], 'flux-2-max': [0.07, 0.07], 'flux-2-flex': [0.05, 0.05], 'flux-2-klein-9b': [0.015, 0.015] };

export default {
  id: 'bfl',
  label: 'Black Forest Labs FLUX.2 (direct)',
  keyName: 'BFL_API_KEY',
  model: 'flux-2-pro',
  models: ['flux-2-pro', 'flux-2-pro-preview', 'flux-2-max', 'flux-2-flex', 'flux-2-klein-9b'],
  maxRefs: 8,
  checked: '2026-10-09',
  docs: ['https://docs.bfl.ai/quick_start/generating_images', 'https://docs.bfl.ai/api-reference/models/generate-or-edit-an-image-with-flux2-[pro]', 'https://docs.bfl.ai/quick_start/pricing'],

  costPerImage(model, { refs = [] } = {}) { const c = COST[model]; return c ? c[refs.length ? 1 : 0] : null; },

  /** One call's request (pure). */
  buildRequest({ prompt, refs = [], ar = '1:1', model = this.model }, key) {
    const { width, height } = sizeFor(ar, 1920, 16);
    const body = { prompt, width, height, output_format: 'jpeg', safety_tolerance: 2 };
    refs.slice(0, this.maxRefs).forEach((r, i) => { body[i ? `input_image_${i + 1}` : 'input_image'] = r.base64; });
    return { url: `${API}/${encodeURIComponent(model)}`, init: { method: 'POST', headers: { 'x-key': key, accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
  },

  async generate(opts, ctx) {
    const model = opts.model || this.model;
    const req = this.buildRequest({ ...opts, model }, ctx.key);
    const http = { ...ctx, secrets: [ctx.key] };
    let credits = 0, counted = 0;
    const images = await times(Math.max(1, opts.n ?? 1), async () => {
      const sub = await httpJson(this.id, req.url, req.init, http);
      if (typeof sub.cost === 'number') { credits += sub.cost; counted++; }
      if (!onHost(sub.polling_url, HOSTS)) throw new ProviderError(this.id, 'server', 'the polling URL is not on bfl.ai: not sending the key there');
      const result = await pollUntil(this.id, async () => {
        const s = await httpJson(this.id, sub.polling_url, { headers: { 'x-key': ctx.key, accept: 'application/json' } }, http);
        if (s.status === 'Ready') return s.result;
        if (/^(Error|Failed)$/.test(s.status)) throw new ProviderError(this.id, 'server', `the task failed (${s.status})`);
        if (/Moderated/i.test(s.status ?? '')) throw new ProviderError(this.id, 'blocked', `refused (${s.status})`);
        return undefined;
      }, { every: ctx.pollEvery ?? 1000, sleep: ctx.sleep, now: ctx.now });
      return downloadImage(this.id, result.sample, ctx);
    }, 3);
    const each = this.costPerImage(model, opts);
    const costUSD = counted === images.length ? +(credits * 0.01).toFixed(4) : each == null ? null : +(each * images.length).toFixed(4);
    return { model, images, costUSD, meta: credits ? { credits } : {} };
  },
};
