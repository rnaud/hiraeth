// Midjourney with the author's web session (docs/systems/reference-lab.md, "Midjourney"): a stub, because it
// cannot work without a browser. Opt-in only (`--providers midjourney`), never in DEFAULT_PROVIDERS.
//
// What it was meant to do: send a prompt the way the midjourney.com web app does, with the two HttpOnly session
// cookies the author saved in .env (MJ_AUTH_I = `__Host-Midjourney.AuthUserTokenV3_i`, MJ_AUTH_R = `…_r`), poll
// for the job and download the four grid pictures (cdn.midjourney.com/<job id>/0_0 … 0_3).
//
// Why it does not (checked 2026-10-10, two GET requests, no job submitted):
//   - www.midjourney.com answers every request without a browser, the page and its /api/ alike, with a Cloudflare
//     managed challenge (HTTP 403, `cf-mitigated: challenge`, "Just a moment…"), whatever cookies are sent. Getting
//     through needs a real browser running Cloudflare's JavaScript (a `cf_clearance` cookie bound to that browser's
//     fingerprint). Solving or replaying that is bypassing bot protection: not done here, by rule.
//   - The `_i` cookie is a Firebase ID token that lives about an hour (the saved one had already expired); the web
//     app renews it with `_r` from inside the page. A CLI would have to do the same, behind the same challenge.
//   - Midjourney's Terms of Service, as we read them, forbid automated tools that access the service or make pictures.
//
// So generate() makes no request and says so; the way to use Midjourney stays the web app in a browser (see the
// working rules in CLAUDE.md), and its pictures are saved into references/ by hand. The cookies are never read
// into anything but `ctx` (env.mjs reads them like the other keys and batch.mjs redacts them from every error).
import { ProviderError } from '../common.mjs';

export const NEEDS_BROWSER = 'midjourney.com puts every request from outside a browser behind a Cloudflare challenge '
  + '(HTTP 403, cf-mitigated: challenge), so the lab cannot use the session cookies: make Midjourney pictures in the '
  + 'web app and save them into references/ by hand (docs/systems/reference-lab.md, "Midjourney")';

export default {
  id: 'midjourney',
  label: 'Midjourney (web session, needs a browser)',
  keyName: 'MJ_AUTH_I',
  model: 'v7',
  models: ['v7'],
  maxRefs: 0,
  checked: '2026-10-10',
  docs: ['https://docs.midjourney.com/'],   // (its Terms of Service are linked from there)
  costEstimated: true,

  costPerImage() { return null; },

  async generate() {
    throw new ProviderError(this.id, 'needs-browser', NEEDS_BROWSER);
  },
};
