# The notebook

`notes.html` is the phone-friendly Notes page in the game's Pages list. It shows the GitHub issues
(excluding pull requests), open and closed, each with its status (see "Status" below), 100 a page: the first ten
pages load by themselves, then a Load more button. Search and the status filter work on the loaded notes.
Write up to 4,000 characters in the expanding composer. Enter adds a line; Add or Ctrl/⌘ + Enter sends.
The first line (up to 256 characters) becomes the issue title; the full text is preserved in its body.
The composer clears immediately, and pending notes appear in the list while you type the next one.
Labels and reply counts come from GitHub, and each note links to its issue. Closing an issue on GitHub
moves it to Done on the next refresh. The page does not start the game or its audio system.

GitHub is the only task store: no second database and no automatic TODO.md import. Creating a note does
not wake Claude; issue polling/assignment is a separate workflow that must be configured explicitly.
Unsent drafts and the optimistic outbox are kept in localStorage on that device. Failed submissions stay
in the list with Check GitHub, Retry and Remove draft actions. Reloaded pending notes become unconfirmed;
there are no automatic write retries. If delivery is uncertain, refresh the list before resending.

Other pages file notes through the same API: the lore page's Note buttons (`docs/systems/lore-page.md`) send
`source: 'lore'`, and their issues end "Added from the Hiraeth lore page." instead (`worker/issues.js` SOURCES).

## Worker setup

The existing `hiraeth` Worker handles `/api/notes/*` before static assets. The API is fixed to
`rnaud/hiraeth`; it cannot proxy arbitrary repositories. `worker/issues.js` uses GitHub's Issues API.

Add two **Worker secrets**, never Vite variables, GitHub Actions variables, or source files:

- `HIRAETH_ISSUES_TOKEN`: a fine-grained GitHub token for **only rnaud/hiraeth**, with **Issues: read/write**.
  No contents-write or workflow permission is needed. Ensure Issues are enabled for the repository.
- `HIRAETH_NOTES_PASSWORD`: a nonempty notebook password (a unique, strong password is recommended). Save it in
  your password manager. This is the password you enter on the Notes page, never the GitHub token.

The simplest way: add both as **repository secrets** too (Settings → Secrets and variables → Actions, the
same names). Every deploy then uploads them with the Worker's version (`cloudflare.yml`: `wrangler deploy
--secrets-file`, a file written from the environment and deleted after, never a command-line argument or the
log), so a new Worker, or a rotated secret, is set by the next push. Without them the deploy warns and the
Worker keeps the secrets it has. Or set them on the Worker itself: the Cloudflare dashboard → Workers & Pages →
hiraeth → Settings → Variables and Secrets → Secret, or the hidden prompts below from an authenticated
terminal. Do not paste either value into a chat, commit it, or pass it as a command-line argument.

```sh
npx wrangler secret put HIRAETH_ISSUES_TOKEN
npx wrangler secret put HIRAETH_NOTES_PASSWORD
```

Deploy through the existing Cloudflare workflow so the game's update archives are preserved (see
`docs/cloudflare.md`). The notebook lives at https://hiraeth.alexandria-rnaud.workers.dev/notes.
Copies on GitHub Pages or in a native bundle offer a link to that address, rather than trying to send
credentials cross-origin. Local development uses `wrangler dev` on localhost with a git-ignored
`.dev.vars` containing test credentials; Vite alone does not serve the API.

## Access and failure handling

Both listing and creating require the notebook password. Sign-in issues a signed, origin-bound
400-day cookie, renewed whenever the page checks an authenticated session: Secure, HttpOnly, SameSite=Strict, host-only. The browser never receives the GitHub token
or stores the notebook password. Writes check Origin and accept only JSON; request bodies are limited to 20,000 bytes; notes to 4,000 characters.
Legacy single-line title requests remain supported up to 256 characters. Repository selection and labels cannot be supplied
by a client. GitHub errors are translated to safe messages; no upstream secrets or response bodies are
returned. API responses are never cached. Requests to GitHub time out after 12 seconds. Redirects use `manual` and fail as upstream errors;
Workers does not support fetch's `error` redirect mode. Credentials are never forwarded to a redirect target.

The API fails closed if either secret or either rate-limit binding is absent. Cookie signing derives
a purpose-specific key from the server-only GitHub token and notebook password together; knowing the
password alone cannot forge cookies offline. Rotating either secret invalidates all sessions; Lock
clears the current browser's cookie. Existing unexpired 30-day cookies upgrade on the next visit.
The browser can still forget a device if site data is cleared, private browsing ends, or a secret rotates;
the password itself is never saved in localStorage. The UI calls this action Sign out.

Wrangler configures `NOTES_LOGIN_LIMITER` (5 attempts/minute) and `NOTES_WRITE_LIMITER`
(30 submissions/minute). Each uses a shared notebook key, so switching IPs at the same edge does not
reset the budget. These Cloudflare counters are eventually consistent and **per location**, not a
strict global limit. A limiter failure blocks the operation; a rejected attempt returns 429 with a
60-second retry hint. Short passwords are supported but still easy to guess; throttling does not make
them strong. This is a private author notebook, not a public feedback endpoint.

Tests in `tests/notes-worker.test.js` exercise the Worker with a fake GitHub transport: cookie tampering,
expiry/rotation, Origin checks, title and body limits, pagination/PR exclusion, errors, and creation.
No test creates real issues. The existing update-download tests cover unchanged archive behavior.

## Screenshot drafts (issue #8, v1.46)

The dev menu (L3 + R3, F2, `) has, on its Notes tab, **Screenshot to a Notes draft**: the frame just drawn, 640 px wide as a JPEG
under 88 KB (`src/issue-draft.js` `grabFrame`, `shotJpeg`), with where the game is (`shotContext`: world, position,
heading, version, build, commit, preset, device, tracked quest and stage, hour, save slot). It is a **draft**, not an
issue: it waits in the notebook's own store, and the Notes page lists it under *Screenshot drafts* with its picture
and state, to be written up (the first line is the title) and sent as an issue, or deleted. Nothing is filed from
the game.

**Pairing.** The game runs on other origins (the Android app, GitHub Pages, the Deck) and never holds the password.
The first screenshot asks the Worker for a six-letter code (`POST /api/notes/pair`, valid ten minutes), says it in a
toast and in the menu's Notes section, and polls (`GET /api/notes/pair?code&secret`; the secret only the asking
device has). On the signed-in Notes page, *Pair a device* takes the code (`POST /api/notes/pair/approve`); the device
collects a **device token** once: drafts-write only (it can't read the notebook or file issues), signed from both
Worker secrets like the session cookie, 400 days, so rotating either secret unpairs every device. It is kept in the
device's localStorage (`hiraeth.notes.device.v1`). Until a draft is sent it waits on the device
(`hiraeth.notes.shots.v1`, six at most, the oldest dropped first): offline, or before pairing, it goes up later
(a row in the menu sends what waits).

**Storage.** `worker/drafts.js`: one SQLite Durable Object, `NotesDrafts` (`wrangler.jsonc`: binding `NOTES_DRAFTS`,
migration `notes-drafts-v1`; the deploy creates it, no namespace to make by hand). Keys: `draft:<id>` (text,
state, device, shot id), `shot:<id>` (the JPEG, base64, under a value's 128 KiB), `pair:<code>`. Without the binding
the drafts' routes answer 503 and the Notes page hides the section; the notes themselves are unaffected.

| Route | Who | What |
| --- | --- | --- |
| `POST /api/notes/pair`, `GET /api/notes/pair` | any origin (CORS `*`, no credentials) | a code; the token once approved |
| `POST /api/notes/drafts` | a paired device (`Authorization: Bearer`) | `{ text, context, shot }`: 200 KB a request, a JPEG of 90 KB at most, text 4,000 characters, the state 24 plain values (2,000 characters), 50 drafts at most |
| `GET /api/notes/drafts`, `POST …/drafts/<id>/publish`, `DELETE …/drafts/<id>` | the notebook (the session cookie, same Origin) | list; send as an issue (the text, the picture, the state in a `<details>`), the draft removed; delete it with its picture |
| `GET /api/notes/shots/<id>.jpg` | anyone with the link | the picture, by an unguessable 128-bit id, so the issue on GitHub can show it (GitHub's image proxy fetches it) |

The write limiter covers pairing and drafts too. `tests/notes-drafts.test.js` (the Worker: pairing, tokens, limits,
publish with a fake GitHub) and `tests/issue-draft.test.js` (the game's side over the real Worker and a store in
memory; the menu's section). No test files a real issue.

## Status (issue #277)

Each note shows its status, from the issue's state and labels (`worker/status.js` `issueStatus`, the first that holds):

| Status | When | Who sets it |
| --- | --- | --- |
| **Done** | the issue is closed | the fix's commit (`Fixes #n`), or by hand |
| **Needs you** | open, labelled `needs-author` | an agent or the coordinator, with a question (below) |
| **Blocked** | open, labelled `codex-only` | work the author does in the Codex browser (Midjourney); agents leave it |
| **In progress** | open, labelled `in progress` | the coordinator, when an agent starts the issue |
| **Open** | open, none of those (`todo`, `answered` and the rest are shown as plain labels) | |

**The coordinator's part.** When an agent starts an issue the coordinator puts **`in progress`** on it and comments as
the work goes (what was found, what is being tried, the commit when it lands); the fix's `Fixes #n` closes it when it
reaches `main`, and the label goes with it. A question puts `needs-author` on instead; an answer brings `answered`.

**On the page.** A pill and the row's dot by status; chips to filter (**To do**: everything not done, the default,
with what needs the author and what is in progress first; **All**; then each status), each with its count; the
choice is kept on the device. **Activity ▾** on a note opens its latest comment (who, when, its first three lines
as plain text, a link to it) and, for a closed issue, the commit that closed it ("Landed in `3c068b4`", from the
issue's last `closed` event) and a link to the issue.

**Calls and caching.** The list is `GET /api/notes/issues?state=all&page=n` (one GitHub call a page; without
`state` it is the open issues 50 a page, as before), through the Worker's token (5,000 an hour, not the 60 of an
anonymous page). Its rows carry only what the page draws (`listView`: no link, which the page builds from the
number; no empty labels, zero replies or missing closing time), and `lastPage` from GitHub's `Link` header. The page
keeps the last list in localStorage (`hiraeth.notes.list.v3`: the rows, when it was read and `fullAt`, when it was
last read whole) and shows it at once on the next visit ("Updated 5 min ago").

**A refresh (#388)** (`src/notes-page/list-sync.js`) asks only for what changed: `GET
/api/notes/issues?state=all&since=<t>` (GitHub's `since`, `sort=updated`: every issue updated at or after `t`,
closed, reopened, relabelled or new), `t` the newest `updatedAt` the kept list holds less five minutes, to the
second (the Worker takes only that form, `YYYY-MM-DDTHH:MM:SSZ`). The rows replace or join the kept ones by number,
newest first: usually one small call. The list is read whole when nothing is kept, when it was last read whole over
a day ago, when its format changed (an older key or no `fullAt`), when more changed than ten pages, and from
**Reload all**; a whole read asks for page 1, then pages 2 to `lastPage` (up to ten) at once. Deleted or
transferred issues leave the list only on a whole read. Load more reads one page past them and merges it.

An opened note is `GET /api/notes/issues/<n>/activity`: the issue, its newest comment
(`comments?per_page=1&page=<count>`) and, closed, its events (the last page): two or three calls, only for the
notes opened. The page keeps each opened note's activity (`hiraeth.notes.activity.v1`, 200 at most) while the
issue's `updatedAt` stands: a new comment, a label or closing it moves `updatedAt`, so it is fetched again. If
GitHub refuses (its rate limit: the Worker's 429), the page says so and keeps showing the list it has, with its time.
Sign out clears both caches.

Timed over a fake GitHub at 300 ms a call with 390 issues (`tests/notes-refresh.test.js`'s fake): a refresh was
1,213 ms (four pages one after another; the questions 605 ms beside it), now 302 ms (one call; the questions 301 ms
from their cache); a whole read 605 ms (was 1,213). Tests: `tests/notes-status.test.js` (the mapping, the excerpt
and the closing commit from GitHub-shaped fixtures, both routes over a fake GitHub, the filter, the order and the
caches), `tests/notes-refresh.test.js` (the merge, when a whole read is due, the `since` route, the pages at once,
the questions' cache, the timing).

## Questions for the author (`needs-author`)

When an agent or the coordinator needs a decision, it asks on a GitHub issue: the label **`needs-author`**, and a
question block in the issue's body or in a new comment. The Notes page lists every open `needs-author` issue under
**Needs you**, at the top (a count badge, and the count in the page's title), with the question, the context above it
and a link to the issue. The author answers there: the Worker posts a comment, takes `needs-author` off and puts
**`answered`** on, so the coordinator picks the issue up (`gh issue list -l answered`) and takes `answered` off
once it has acted.

The block, exactly (`worker/questions.js` parses it strictly; a block that doesn't match is ignored):

```
The crab fight takes 40 s now; the brief says 20.
<!-- question -->
**Question:** Which way should it go?
<!-- options: single -->
- [ ] Halve its health
- [ ] Double the traveller's damage
<!-- /question -->
```

- **Context:** the paragraph directly above the block (its lines up to the first blank line, 12 at most).
- **The question:** the first line inside starts `**Question:**`; one or two lines (three at most).
- **Options** (optional): `<!-- options: single -->` (one choice: buttons) or `<!-- options: multi -->` (any number:
  checkboxes and Send), then one `- [ ] option` a line, no other lines, no duplicates. Without them it is a free-text
  question. A free-text box is always there too.
- **The latest valid block on the issue wins** (the body, then the comments, oldest first; only the newest 100
  comments are read). Only blocks written by the repository's owner, members or collaborators count: anyone can
  comment on this public repository.
- **Answered on GitHub** counts too: a box ticked in the block (`- [x]`, ticked or edited in place), or **any later
  comment** on the issue (from the repository's people), is the answer, and the issue leaves Needs you, though its
  `needs-author` label stays for the coordinator to swap. So put the context above the block in the same comment,
  never in a comment after it. The coordinator reads the ticks and the comments after the block as the answer.
- **The answer from the page** is a comment: `**Answer:** Lorn; Vael` (the options picked, joined by `; `), then the
  free text as its own paragraph (with no option picked, the free text follows `**Answer:**`), then `Answered from
  the Hiraeth notebook.` The chosen boxes are ticked in the block too (the body or the comment that holds it is
  edited), so GitHub and the page agree. To ask again, post a new block and put `needs-author` back.

| Route | Who | What |
| --- | --- | --- |
| `GET /api/notes/questions` | the notebook (the session cookie) | the open `needs-author` issues (20 at most, oldest first), each with its parsed question or `null` |
| `POST /api/notes/questions/<n>/answer` | the notebook (cookie, same Origin, the write limiter) | `{ choices, text }`, checked against the question as it stands (the options offered, one for single; the issue open, still `needs-author` and not answered on GitHub, else 409); the comment, the boxes ticked, then the labels |

If the comment is posted but ticking the boxes or a label change fails, the page says so (502) rather than inviting a second answer.

**Kept (#388).** Each listed issue's question is kept in the notebook's store (the drafts' Durable Object, one key
`questions:cache`) with the issue's `updated_at` and comment count: while both stand (a new comment, a body edit or a
label moves them) and for an hour at most (a box ticked by editing a comment may not move them), the issue costs no
comment call, so an unchanged list of questions is the one call for the `needs-author` issues. Issues that left the
list leave the cache. Without the store, or when it fails, every issue is read as before. An answer always reads
the question as it stands.
Tests: `tests/notes-questions.test.js` (the parser, the routes over a fake GitHub, the page's card on a stand-in DOM).
