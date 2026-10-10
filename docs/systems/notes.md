# The notebook

`notes.html` is the phone-friendly Notes page in the game's Pages list. It shows open GitHub issues
(excluding pull requests), 50 records per page with a Load more button. Search filters the loaded notes.
Write one line and press Enter or Add to create an issue; the composer stays ready for the next thought.
Labels and reply counts come from GitHub, and each note links to its issue. Closing an issue on GitHub
removes it on the next refresh. The page does not start the game or its audio system.

GitHub is the only task store: no second database and no automatic TODO.md import. Creating a note does
not wake Claude; issue polling/assignment is a separate workflow that must be configured explicitly.
Unsent drafts are kept in localStorage on that device. A failed or uncertain submission keeps the draft;
there are no automatic write retries. If delivery is uncertain, refresh the list before resending.

## Worker setup

The existing `memento` Worker handles `/api/notes/*` before static assets. The API is fixed to
`rnaud/hiraeth`; it cannot proxy arbitrary repositories. `worker/issues.js` uses GitHub's Issues API.

Add two **Worker secrets**, not Vite variables, GitHub Actions variables, or source files:

- `HIRAETH_ISSUES_TOKEN`: a fine-grained GitHub token for **only rnaud/hiraeth**, with **Issues: read/write**.
  No contents-write or workflow permission is needed. Ensure Issues are enabled for the repository.
- `HIRAETH_NOTES_PASSWORD`: a unique, strong notebook password of at least 24 characters. Save it in
  your password manager. This is the password you enter on the Notes page, never the GitHub token.

Use the Cloudflare dashboard → Workers & Pages → memento → Settings → Variables and Secrets → Secret,
or the hidden prompts below from an authenticated terminal. Do not paste either value into a chat,
commit it, or pass it as a command-line argument.

```sh
npx wrangler secret put HIRAETH_ISSUES_TOKEN
npx wrangler secret put HIRAETH_NOTES_PASSWORD
```

Deploy through the existing Cloudflare workflow so the game's update archives are preserved (see
`docs/cloudflare.md`). The notebook lives at https://memento.alexandria-rnaud.workers.dev/notes.
Copies on GitHub Pages or in a native bundle offer a link to that address, rather than trying to send
credentials cross-origin. Local development uses `wrangler dev` on localhost with a git-ignored
`.dev.vars` containing test credentials; Vite alone does not serve the API.

## Access and failure handling

Both listing and creating require the notebook password. Sign-in issues a signed, origin-bound
30-day cookie: Secure, HttpOnly, SameSite=Strict, host-only. The browser never receives the GitHub token
or stores the notebook password. Writes check Origin and accept only JSON; bodies are limited to 4 KiB,
titles to one nonempty line of at most 256 characters. Repository selection and labels cannot be supplied
by a client. GitHub errors are translated to safe messages; no upstream secrets or response bodies are
returned. API responses are never cached. Requests to GitHub time out after 12 seconds.

The API fails closed if either secret is absent or the notebook password is too short. Rotating the
notebook password invalidates all sessions; Lock clears the current browser's cookie. Use a generated
password or a long random passphrase: this is a private author notebook, not a public feedback endpoint.
Cloudflare rate-limiting rules can additionally cover `/api/notes/session` for high-traffic deployments.

Tests in `tests/notes-worker.test.js` exercise the Worker with a fake GitHub transport: cookie tampering,
expiry/rotation, Origin checks, title and body limits, pagination/PR exclusion, errors, and creation.
No test creates real issues. The existing update-download tests cover unchanged archive behavior.
