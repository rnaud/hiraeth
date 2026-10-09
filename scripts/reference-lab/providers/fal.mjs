// fal.ai (docs/systems/reference-lab.md): FLUX.2 with several references, and Seedream, Ideogram and Recraft on
// the same key. Key: FAL_KEY (or FAL_API_KEY). Each model is its own provider id here (fal-flux, fal-flux-pro, fal-seedream,
// fal-ideogram, fal-recraft), so the page compares them side by side.
//
// Docs checked 2026-10-09:
//   https://fal.ai/docs/model-apis/model-endpoints/queue   (the REST queue)
//   https://fal.ai/models/fal-ai/flux-2/edit/api, …/flux-2-pro/edit/api, …/bytedance/seedream/v4.5/edit/api,
//   …/ideogram/v3/api, …/recraft/v3/image-to-image/api, https://fal.ai/pricing
//   POST https://queue.fal.run/<endpoint>   header `Authorization: Key <key>` → { request_id, status_url, response_url }
//   GET  <status_url> → { status: IN_QUEUE | IN_PROGRESS | COMPLETED, error? }; GET <response_url> → { images: [{ url }] }
//   (the key only ever goes to *.fal.run / fal.ai URLs; the picture URLs are public and fetched without it).
//   References go as data URIs in `image_urls` (fal: "attributes that accept file URLs take a Base64 data URI").
//   Endpoints (text alone → the generation endpoint, with references → the edit one):
//     fal-flux      fal-ai/flux-2 / fal-ai/flux-2/edit            up to 4 refs, num_images
//     fal-flux-pro  fal-ai/flux-2-pro / fal-ai/flux-2-pro/edit    refs, one picture a call
//     fal-seedream  fal-ai/bytedance/seedream/v4.5/text-to-image / …/v4.5/edit   up to 10 refs, num_images
//     fal-ideogram  fal-ai/ideogram/v3                            refs as style references (10 MB total), num_images
//     fal-recraft   fal-ai/recraft/v3/text-to-image / fal-ai/recraft/v3/image-to-image   ONE ref (restyled, strength)
//   Prices: the pricing page lists none of these (2026-10-09); the estimates below are the BFL list prices for
//   FLUX.2 and rough figures for the others, marked "~" on the page. fal's own invoice is the truth.
import { httpJson, ProviderError, sizeFor, parseAspect, pollUntil, downloadImage, onHost, times } from '../common.mjs';

const QUEUE = 'https://queue.fal.run';
const HOSTS = ['fal.run', 'fal.ai', 'fal.media'];

/** fal's image_size: its named preset when the aspect ratio is one, else { width, height } (long edge `long`). */
export function falImageSize(ar, long = 1536) {
  const presets = { '1:1': 'square_hd', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3', '16:9': 'landscape_16_9', '9:16': 'portrait_16_9' };
  parseAspect(ar);
  return presets[ar] ?? sizeFor(ar, long, 16);
}

const VARIANTS = [
  { id: 'fal-flux', label: 'fal · FLUX.2 [dev]', text: 'fal-ai/flux-2', edit: 'fal-ai/flux-2/edit', maxRefs: 4, batch: true, cost: 0.035,
    body: (o) => ({ image_size: falImageSize(o.ar), output_format: 'jpeg' }) },
  { id: 'fal-flux-pro', label: 'fal · FLUX.2 [pro]', text: 'fal-ai/flux-2-pro', edit: 'fal-ai/flux-2-pro/edit', maxRefs: 8, batch: false, cost: 0.045,
    body: (o) => ({ image_size: falImageSize(o.ar), output_format: 'jpeg', safety_tolerance: '2' }) },
  { id: 'fal-seedream', label: 'fal · Seedream 4.5', text: 'fal-ai/bytedance/seedream/v4.5/text-to-image', edit: 'fal-ai/bytedance/seedream/v4.5/edit', maxRefs: 10, batch: true, cost: 0.04,
    body: (o) => ({ image_size: sizeFor(o.ar, 2560, 16) }) },
  { id: 'fal-ideogram', label: 'fal · Ideogram 3 (style refs)', text: 'fal-ai/ideogram/v3', edit: 'fal-ai/ideogram/v3', maxRefs: 4, batch: true, cost: 0.06,
    body: (o) => ({ image_size: falImageSize(o.ar), rendering_speed: 'BALANCED' }) },
  { id: 'fal-recraft', label: 'fal · Recraft V3 (one ref)', text: 'fal-ai/recraft/v3/text-to-image', edit: 'fal-ai/recraft/v3/image-to-image', maxRefs: 1, batch: false, cost: 0.04, maxPrompt: 1000,
    body: (o, refs) => (refs.length ? { strength: 0.6, style: 'digital_illustration' } : { image_size: falImageSize(o.ar), style: 'digital_illustration' }) },
];

/** A prompt cut to `max` characters at the last clause that fits (Recraft takes 1000 at most). */
export function fitPrompt(prompt, max) {
  if (!max || prompt.length <= max) return prompt;
  const head = prompt.slice(0, max);
  const cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf(', '), head.lastIndexOf('; '));
  return (cut > max / 2 ? head.slice(0, cut) : head.slice(0, head.lastIndexOf(' '))).trim();
}

const dataUri = (r) => `data:${r.mime};base64,${r.base64}`;

function falProvider(v) {
  return {
    id: v.id,
    label: v.label,
    keyName: 'FAL_KEY',
    keyAliases: ['FAL_API_KEY'],
    model: v.edit,
    models: [v.edit],
    maxRefs: v.maxRefs,
    checked: '2026-10-09',
    docs: ['https://fal.ai/docs/model-apis/model-endpoints/queue', `https://fal.ai/models/${v.edit}/api`],
    costEstimated: true,

    costPerImage() { return v.cost; },

    /** The endpoint for these references (text alone: the generation endpoint). */
    endpoint(refs) { return refs.length ? v.edit : v.text; },

    /** One submit's request (pure). `perCall`: pictures in this call. */
    buildRequest({ prompt, refs = [], ar = '1:1', perCall = 1 }, key) {
      const use = refs.slice(0, v.maxRefs);
      const body = { prompt: fitPrompt(prompt, v.maxPrompt), ...v.body({ ar }, use) };
      if (use.length) {
        if (v.id === 'fal-recraft') body.image_url = dataUri(use[0]);
        else body.image_urls = use.map(dataUri);
      }
      if (v.batch) body.num_images = perCall;
      return { url: `${QUEUE}/${this.endpoint(use)}`, init: { method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } };
    },

    async generate(opts, ctx) {
      const n = Math.max(1, opts.n ?? 1), refs = opts.refs ?? [];
      const http = { ...ctx, secrets: [ctx.key] };
      const auth = { headers: { Authorization: `Key ${ctx.key}` } };
      const one = async (perCall) => {
        const { url, init } = this.buildRequest({ ...opts, perCall }, ctx.key);
        const sub = await httpJson(this.id, url, init, http);
        for (const u of [sub.status_url, sub.response_url]) if (!onHost(u, HOSTS)) throw new ProviderError(this.id, 'server', 'a queue URL is not on fal: not sending the key there');
        await pollUntil(this.id, async () => {
          const s = await httpJson(this.id, sub.status_url, auth, http);
          if (s.status === 'COMPLETED') {
            if (s.error) throw new ProviderError(this.id, /safety|nsfw|content/i.test(`${s.error_type} ${s.error}`) ? 'blocked' : 'server', `failed: ${String(s.error).slice(0, 300)}`);
            return true;
          }
          return undefined;
        }, { every: ctx.pollEvery ?? 1500, sleep: ctx.sleep, now: ctx.now });
        const out = await httpJson(this.id, sub.response_url, auth, http);
        const urls = (out.images ?? []).map((i) => i?.url).filter(Boolean);
        if (!urls.length) throw new ProviderError(this.id, 'server', 'no picture in the answer');
        return Promise.all(urls.map((u) => downloadImage(this.id, u, ctx)));
      };
      const images = v.batch ? await one(n) : (await times(n, () => one(1))).flat();
      return { model: this.endpoint(refs.slice(0, v.maxRefs)), images, costUSD: +(v.cost * images.length).toFixed(4), meta: { estimated: true } };
    },
  };
}

export const FAL_PROVIDERS = VARIANTS.map(falProvider);
export default FAL_PROVIDERS;
