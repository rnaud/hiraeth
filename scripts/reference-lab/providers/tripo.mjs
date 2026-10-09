// Tripo (Tripo3D), the reference lab's 3D mode (docs/systems/reference-lab.md, "3D mode"): a picked reference
// (one view, or several views of one subject) or a prompt turned into a textured 3D model (GLB), optionally
// rigged and given a preview animation. Key: TRIPO_3D_API_KEY (or TRIPO_API_KEY, the docs' own name).
//
// Docs checked 2026-10-09 (API v3; v2's single POST /v2/openapi/task with a `type` is the older form of the same):
//   https://developers.tripo3d.ai/en/docs/introduction           base URL, `Authorization: Bearer <key>`, { code, data }
//   https://developers.tripo3d.ai/en/docs/files                  POST /v3/files (multipart `file`, JPEG/PNG ≤ 20 MB) → { file_token }
//   https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard   POST /v3/generation/image-to-model
//        { input: <file_token | URL | task_id>, model, texture, pbr, texture_quality, face_limit, quad, … }
//   https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard  POST /v3/generation/multiview-to-model
//        { inputs: [{ front: <token> }, { left: … }, { back: … }, { right: … }], … }  front required, 2 to 4 views
//   https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard    POST /v3/generation/text-to-model
//        { prompt (≤ 1024 chars), negative_prompt (≤ 255), … }
//   https://developers.tripo3d.ai/en/docs/generation-image-to-model/p          the P series (low poly, 48–20,000 faces)
//   https://developers.tripo3d.ai/en/docs/task-query             GET /v3/tasks/<task_id> → { status: queued | running |
//        success | failed | cancelled (| banned | expired: task-lifecycle), progress, output: { model_url,
//        rendered_image_url }, credits_consumed, error_code, error_message }; poll every 1–2 s, at most 1 request a second
//   https://developers.tripo3d.ai/en/docs/animations-rig-check   POST /v3/animations/rig-check { input: <task_id> } →
//        output { riggable, rig_type: biped | quadruped | hexapod | octopod | avian | serpentine | aquatic } (free)
//   https://developers.tripo3d.ai/en/docs/animations-rig         POST /v3/animations/rig { input, model: v1.0-20240301
//        (biped) | v2.5-20260210 (the other bodies), rig_type, spec: tripo | mixamo, out_format: glb } → output.model_url
//   https://developers.tripo3d.ai/en/docs/animations-retarget    POST /v3/animations/retarget { input: <rig task_id>,
//        animation: 'preset:…', out_format: glb, bake_animation, animate_in_place } → output.model_url
//   https://developers.tripo3d.ai/en/docs/error-handling         400 bad parameters, 401 key, 403 permission OR credits,
//        429; codes 1000/1001 key, 2008 content policy, 2010 insufficient credits
//   https://developers.tripo3d.ai/en/docs/billing, https://developers.tripo3d.ai/en/pricing   credits frozen at
//        creation, charged on success only; 1 credit = $0.01. H series: text 10 / 20 (untextured / textured),
//        image and multiview 20 / 30; HD texture +10, 8K texture +20, HD geometry +20, quad +5, smart low-poly +10;
//        rig check free, rig 25, retarget 10 an animation. (P series prices are on a tab the page does not show in
//        text: the same figures are used, marked as an estimate.) The task's own credits_consumed wins.
//   The model URLs expire after 5 minutes: downloaded at once, without the key (cdn.tripo3d.ai). `quad: true`
//   makes the output FBX, not GLB.
import { httpJson, ProviderError, pollUntil, downloadImage } from '../common.mjs';

export const TRIPO_API = 'https://openapi.tripo3d.ai/v3';
export const VIEWS = ['front', 'left', 'back', 'right'];
export const H_MODELS = ['v3.1-20260211', 'v3.0-20250812', 'v2.5-20250123'];
export const P_MODELS = ['P1-20260311', 'P2-20260801'];
const RIG_MODEL = { biped: 'v1.0-20240301', other: 'v2.5-20260210' };
/** A short walk for each body Tripo rigs (animations-retarget); avian has none. */
export const PREVIEW_ANIMATION = {
  biped: 'preset:biped:walk', quadruped: 'preset:quadruped:walk', hexapod: 'preset:hexapod:walk', octopod: 'preset:octopod:walk',
  serpentine: 'preset:serpentine:march', aquatic: 'preset:aquatic:march',
};
export const CREDIT_USD = 0.01;

/** The options the lab exposes, filled with their defaults (pure). */
export function tripoOptions(o = {}) {
  const model = o.model || H_MODELS[0];
  const texture = o.texture !== false;
  return {
    model,
    texture,
    pbr: texture && o.pbr !== false,
    textureQuality: ['standard', 'detailed'].includes(o.textureQuality) ? o.textureQuality : 'standard',
    faceLimit: o.faceLimit ? Math.max(48, Math.round(+o.faceLimit)) || null : null,
    quad: !!o.quad,
    rig: !!o.rig,
  };
}

const isP = (model) => /^P\d/.test(model);
const atLeastV3 = (model) => /^v3\./.test(model) || isP(model);

/** Credits a candidate should cost (the pricing page; the tasks' credits_consumed replaces it once known). */
export function estimateCredits(kind, options) {
  const o = tripoOptions(options);
  const base = { text: [10, 20], image: [20, 30], multiview: [20, 30] }[kind];
  if (!base) throw new Error(`3D kind "${kind}"`);
  let c = base[o.texture ? 1 : 0];
  if (o.texture && o.textureQuality === 'detailed') c += 10;
  if (o.quad) c += 5;
  if (o.rig) c += 25 + 10;   // (rig check free; the rig; one preview animation)
  return c;
}

/**
 * The generation request's body (pure). kind: 'image' (inputs: [token]), 'multiview' (inputs: [{ view, token }]),
 * 'text' (prompt). Throws a bad-request ProviderError for options the model does not take.
 */
export function generationRequest(kind, { prompt = '', negative = '', inputs = [], options = {} } = {}) {
  const o = tripoOptions(options);
  if (![...H_MODELS, ...P_MODELS].includes(o.model)) throw new ProviderError('tripo', 'bad-request', `no Tripo model "${o.model}" (there: ${[...H_MODELS, ...P_MODELS].join(', ')})`);
  if (o.quad && !(/^v3\./.test(o.model) || o.model === 'P2-20260801')) throw new ProviderError('tripo', 'bad-request', `quad needs a v3 model or P2 (not ${o.model})`);
  const body = { model: o.model, texture: o.texture, pbr: o.pbr };
  if (o.texture && atLeastV3(o.model)) body.texture_quality = o.textureQuality;
  if (o.faceLimit) body.face_limit = isP(o.model) ? Math.min(o.faceLimit, o.model === 'P1-20260311' ? 20000 : 50000) : o.faceLimit;
  if (o.quad) body.quad = true;
  if (kind === 'text') {
    const p = String(prompt).trim();
    if (!p) throw new ProviderError('tripo', 'bad-request', 'text to model needs a prompt');
    return { path: '/generation/text-to-model', body: { prompt: p.slice(0, 1024), ...(negative ? { negative_prompt: String(negative).slice(0, 255) } : {}), ...body } };
  }
  if (kind === 'image') {
    if (inputs.length !== 1) throw new ProviderError('tripo', 'bad-request', 'image to model takes one picture');
    return { path: '/generation/image-to-model', body: { input: inputs[0].token ?? inputs[0], ...body } };
  }
  if (kind === 'multiview') {
    const seen = new Set();
    for (const i of inputs) {
      if (!VIEWS.includes(i.view)) throw new ProviderError('tripo', 'bad-request', `view "${i.view}": front, left, back or right`);
      if (seen.has(i.view)) throw new ProviderError('tripo', 'bad-request', `two pictures for the ${i.view} view`);
      seen.add(i.view);
    }
    if (inputs.length < 2 || inputs.length > 4) throw new ProviderError('tripo', 'bad-request', 'multiview takes 2 to 4 views');
    if (!seen.has('front')) throw new ProviderError('tripo', 'bad-request', 'multiview needs a front view');
    return { path: '/generation/multiview-to-model', body: { inputs: inputs.map((i) => ({ [i.view]: i.token })), ...body } };
  }
  throw new ProviderError('tripo', 'bad-request', `3D kind "${kind}"`);
}

/** Tripo's failures sorted into the lab's kinds (its 403 also means "no credits"; its codes say which). */
export function tripoKind(e) {
  const msg = String(e?.message ?? '');
  if (/credit|\b2010\b/i.test(msg)) return 'credits';
  if (/content policy|\b2008\b|banned/i.test(msg)) return 'blocked';
  return e?.kind ?? 'error';
}

const fail = (kind, message) => new ProviderError('tripo', kind, message);

export default {
  id: 'tripo',
  label: 'Tripo 3D',
  keyName: 'TRIPO_3D_API_KEY',
  keyAliases: ['TRIPO_API_KEY'],
  mode: '3d',
  model: H_MODELS[0],
  models: [...H_MODELS, ...P_MODELS],
  maxRefs: 4,
  checked: '2026-10-09',
  docs: ['https://developers.tripo3d.ai/en/docs/introduction', 'https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard', 'https://developers.tripo3d.ai/en/docs/animations-rig', 'https://developers.tripo3d.ai/en/pricing'],
  costEstimated: false,

  /** Per model at the defaults (image to model, textured), for the page. */
  costPerImage() { return estimateCredits('image', {}) * CREDIT_USD; },

  headers(key, json = true) { return { Authorization: `Bearer ${key}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }; },

  /** One API call: the answer's `data`, or a ProviderError of the right kind (redacted by httpJson). */
  async call(path, init, ctx) {
    let j;
    try { j = await httpJson(this.id, `${TRIPO_API}${path}`, init, { ...ctx, secrets: [ctx.key] }); } catch (e) {
      if (e instanceof ProviderError) {
        const kind = tripoKind(e);
        // (Tripo answers "no credits" with a 403, which httpJson calls a refused key: say what it is)
        if (kind !== e.kind && kind === 'credits') e.message = e.message.replace(/^[^(]*\(/, 'out of Tripo credits: top up at https://platform.tripo3d.ai (');
        e.kind = kind;
        throw e;
      }
      throw e;
    }
    if (j?.code !== 0) {
      const m = `${j?.message ?? 'refused'}${j?.code != null ? ` (code ${j.code})` : ''}`;
      throw fail(j?.code === 1000 || j?.code === 1001 ? 'auth' : tripoKind({ message: m, kind: 'bad-request' }), m.slice(0, 300));
    }
    return j.data ?? {};
  },

  /** The account's credits: { balance, frozen } (GET /v3/account/balance, free). */
  async balance(ctx) {
    const d = await this.call('/account/balance', { headers: this.headers(ctx.key, false) }, ctx);
    return { balance: d.balance ?? null, frozen: d.frozen ?? null };
  },

  /** A picture uploaded → its file_token. img: { bytes, mime, name }. */
  async upload(img, ctx) {
    if (!/^image\/(jpeg|png)$/.test(img.mime)) throw fail('bad-request', `Tripo takes JPEG or PNG pictures (not ${img.mime})`);
    const form = new FormData();
    form.append('file', new Blob([img.bytes], { type: img.mime }), img.name ?? (img.mime === 'image/png' ? 'view.png' : 'view.jpg'));
    const d = await this.call('/files', { method: 'POST', headers: this.headers(ctx.key, false), body: form }, ctx);
    if (!d.file_token) throw fail('server', 'no file_token in the upload\'s answer');
    return d.file_token;
  },

  /** A task created and polled to its end → its `data` (status success). onProgress(progress). */
  async runTask(path, body, ctx, onProgress) {
    const created = await this.call(path, { method: 'POST', headers: this.headers(ctx.key), body: JSON.stringify(body) }, ctx);
    const id = created.task_id;
    if (!id || !/^[\w-]+$/.test(id)) throw fail('server', 'no task_id in the answer');
    ctx.onTask?.(id);
    return pollUntil(this.id, async () => {
      const d = await this.call(`/tasks/${encodeURIComponent(id)}`, { headers: this.headers(ctx.key, false) }, ctx);
      if (d.status === 'success') return { ...d, task_id: d.task_id ?? id };
      if (d.status === 'banned') throw fail('blocked', `task ${id} refused by the content policy`);
      if (['failed', 'cancelled', 'expired'].includes(d.status)) {
        const why = d.error_message ? `: ${String(d.error_message).slice(0, 200)}` : '';
        throw fail(d.error_code === 2010 ? 'credits' : 'server', `task ${id} ${d.status}${d.error_code ? ` (code ${d.error_code})` : ''}${why}`);
      }
      onProgress?.(d.progress ?? 0, d.status);
      return undefined;
    }, { every: ctx.pollEvery ?? 2000, timeout: ctx.timeout ?? 600000, sleep: ctx.sleep, now: ctx.now });
  },

  /** A file Tripo made (signed, 5-minute URL; no key sent) → { bytes, mime, format }. */
  async fetchOutput(url, ctx) {
    if (!url) throw fail('server', 'the task has no output file');
    const { bytes, mime } = await downloadImage(this.id, url, { ...ctx, secrets: [ctx.key] });
    return { bytes, mime, format: formatOf(bytes, url, mime) };
  },

  /**
   * One candidate: the generation task, its model and preview downloaded, then (rig) the rig check, the rig and a
   * preview walk. A rig that fails leaves the model standing. Returns { model, task, credits, file, preview, rig }.
   */
  async makeModel({ kind, prompt, negative, inputs, options }, ctx) {
    const o = tripoOptions(options);
    const req = generationRequest(kind, { prompt, negative, inputs, options: o });
    const stage = (s, p) => ctx.onStage?.(s, p);
    const gen = await this.runTask(req.path, req.body, ctx, (p) => stage('model', p));
    const out = gen.output ?? {};
    const file = await this.fetchOutput(out.model_url ?? out.pbr_model_url ?? out.base_model_url, ctx);
    const preview = out.rendered_image_url ? await this.fetchOutput(out.rendered_image_url, ctx).catch(() => null) : null;
    let credits = Number(gen.credits_consumed) || 0;
    const tasks = { model: gen.task_id };
    let rig = null;
    if (o.rig) {
      rig = { status: 'running' };
      try {
        stage('rig-check', 0);
        const rc = await this.runTask('/animations/rig-check', { input: gen.task_id }, ctx);
        tasks.rigCheck = rc.task_id;
        const type = rc.output?.rig_type ?? null;
        if (!rc.output?.riggable) rig = { status: 'not-riggable', rigType: type };
        else {
          stage('rig', 0);
          const model = type === 'biped' ? RIG_MODEL.biped : RIG_MODEL.other;
          const r = await this.runTask('/animations/rig', { input: gen.task_id, model, rig_type: type ?? 'biped', spec: 'tripo', out_format: 'glb' }, ctx, (p) => stage('rig', p));
          tasks.rig = r.task_id; credits += Number(r.credits_consumed) || 0;
          rig = { status: 'done', rigType: type, rigModel: model, file: await this.fetchOutput(r.output?.model_url, ctx) };
          const animation = PREVIEW_ANIMATION[type];
          if (animation) {
            stage('animation', 0);
            const a = await this.runTask('/animations/retarget', { input: r.task_id, animation, out_format: 'glb', bake_animation: true, animate_in_place: true }, ctx, (p) => stage('animation', p));
            tasks.retarget = a.task_id; credits += Number(a.credits_consumed) || 0;
            rig.animation = animation;
            rig.animated = await this.fetchOutput(a.output?.model_url ?? a.output?.model_urls?.[0], ctx);
          }
        }
      } catch (e) {
        rig = { ...rig, status: 'error', kind: e?.kind ?? 'error', error: String(e?.message ?? e) };
      }
    }
    return { model: o.model, task: gen.task_id, tasks, credits, file, preview, rig };
  },
};

/** glb, fbx or the URL's extension, from the file's first bytes. */
export function formatOf(bytes, url = '', mime = '') {
  const head = Buffer.from(bytes.subarray(0, 20)).toString('latin1');
  if (head.startsWith('glTF')) return 'glb';
  if (head.startsWith('Kaydara FBX')) return 'fbx';
  if (/^\x89PNG/.test(head)) return 'png';
  if (/^\xff\xd8/.test(head)) return 'jpg';
  if (/^RIFF....WEBP/s.test(head)) return 'webp';
  const ext = String(url).split('?')[0].match(/\.(glb|fbx|png|jpe?g|webp)$/i)?.[1]?.toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext ?? (/png/.test(mime) ? 'png' : 'bin');
}
