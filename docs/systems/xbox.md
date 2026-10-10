# The Xbox Dev Mode package

The web game in a UWP app with WebView2 (x64), sideloaded on an Xbox in Developer Mode. Why the web game and not
the Unity build: TODO.md, "An Xbox Dev Mode package" (Puerts has no V8 for UWP/Xbox; the gain was ~0.9 ms).
Not for players: there is no Store listing; it is for measuring the game on the console. The Unity bridge has a
measuring package of its own, installed beside it: "The Unity build on the Xbox" below.
**Setting up the console, step by step (sign-up, Developer Mode, installing): [../xbox-setup.md](../xbox-setup.md).**

## The app (`xbox/Hiraeth/`)

C# with .NET Native (C# 7.3: keep newer language features out), WinUI 2.8 and its WebView2 control.

- **`App.xaml(.cs)`**: one page; `RequiresPointerMode="WhenRequested"`, in App.xaml and again in the constructor
  (no mouse-mode cursor: the system's mouse mode stays off, the game reads the pad itself; the page and the web view
  say `RequiresPointer="Never"`, the web view takes the focus when it is ready, on every page load, on activation and on
  a return); `SetDesiredBoundsMode(UseCoreWindow)`, so the picture fills the TV
  to its edges (by default an Xbox app is drawn inside the TV-safe area with a border); `EnteredBackground` /
  `LeavingBackground` → `MainPage.Away`; `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--autoplay-policy=no-user-gesture-required`
  (sound without a press first, as in the other apps).
- **`MainPage.xaml.cs`**: the WebView2, full screen.
  - **The origin**: `https://hiraeth.example/` through `SetVirtualHostNameToFolderMapping`, onto the packaged game
    (`game\`) or a downloaded build (`LocalState\web\<build>\`). The host never changes: the saves are the page's
    storage under that origin (WebView2's profile in `LocalState\EBWebView`), so they survive every update of the game
    and of the package. They go only when the app is uninstalled (or reinstalled under another certificate).
  - **Before every page's scripts** (`AddScriptToExecuteOnDocumentCreatedAsync`): `window.__hiraethXbox = { api, app,
    tvSafe }`, and `navigator.gamepadInputEmulation = 'gamepad'` (the old Xbox WebView's switch to stop turning the
    pad into mouse and keys; harmless if unknown). The user agent gets ` HiraethXbox/<api>`.
  - **WebView2 settings**: no context menus, zoom, pinch, swipe navigation, browser keys, status bar or autofill;
    dev tools only in Debug builds. Each set alone, so an older runtime missing one doesn't stop the app.
  - **Back** (the B button as the system sees it): `BackRequested` is always handled, so the system never closes or
    suspends the game; the page gets `moebius:back`. The game reads B from the Gamepad API like every other button;
    `moebius:back` is only its fallback (an Escape press) when no pad reaches the page.
  - **Away**: leaving the app (the guide, another app, standby) sends `moebius:pause` (and `__moebiusAway`), and
    `moebius:resume` on return, as Android does: `src/audio-guard.js` silences every sound. The web view's memory
    target goes Low while away.
  - **The settings' update section** (`src/update-panel.js`) asks the app over WebView2's web messages:
    `{ hiraeth: 'call', id, method }` → `{ hiraeth: 'reply', id, result | error }`, with Android's AppShell calls
    (`info`, `check`, `download`, `restart`); `info` has AppShell.info's fields with `platform: 'xbox'`.
  - Links to other sites open in the console's browser.
  - **The page's log**: `{ hiraeth: 'log', level, text }` messages (src/xbox.js `forwardLogs`: the page's warnings and
    errors, the load's stages and timings, the pad's id, and a warning at the first mouse event, the sign of the
    system's mouse mode) go to `LocalState\web\page.log`, new each launch (the last one in `page.prev.log`), with the
    app's own lines first: its memory limit (**about 1 GB means the app type is App**), the WebView2 runtime, the
    pointer mode, where the focus goes. The page gets the limit too (`__hiraethXbox.memory`, MB): the frame readout
    ends ` · app 1.0 GB` or ` · game 5.0 GB`.
  - **The pad, read by the app too** (`HostPad.cs`): see "The A and B buttons" below. The D-pad's XY focus moves
    (`XYFocusUp/Down/Left/Right`) all point back at the web view, a focus move away from it is cancelled
    (`LosingFocus` → `TryCancel`), and XY keyboard navigation is off: XAML has nowhere to take the pad's input.
- **`WebBundles.cs`**: the updates (below).
- **`Package.appxmanifest`**: `rnaud.Hiraeth`, display name *Hiraeth*, the `Windows.Xbox` device family (and
  `Windows.Desktop`, to try it on a PC), the `internetClient` capability. Identity's `Version` and `Publisher` are
  written by the build (`scripts/xbox-package.mjs prepare`).
- **Images** (`Assets/`): tiles, store logo and splash at scale 100 and 200, from the app icon's capture
  (`node scripts/icons.mjs xbox`, docs/systems/app-icon.md).

## Updates and saves

The same feed as the Android app and the Deck: the site's `updates/web.json` and `web-<build>.zip`
(`scripts/web-update.mjs`, docs/systems/android.md "Game updates from the site").

- The package carries a built game (`game\`, its build in `game\bundle.json`): the fallback, always there.
- After the first frame (`window.__moebiusBooted`), and on a return after 15 min, the app reads `web.json`. A build
  newer than everything on the console that this app can run (`minXbox <= XboxApi`) is downloaded, checked against
  its sha256, unpacked to `LocalState\web\<build>\` and used from the next launch, or at once with *Restart now* (the
  app maps the host onto the new folder, clears the HTTP cache and opens the title). The cache is cleared only when the
  build served changes (`served.txt`): clearing WebView2's disk cache clears the GPU's shader cache with it, and the
  console compiled all its shaders again at every launch (53 s of "mixing the inks…").
- A downloaded build that doesn't reach its first frame in 60 s goes back to the packaged game and is never tried
  again (`bad.txt`); one that booted once is kept (`good.txt`) and the older ones are deleted.
- **`XboxApi`** (`WebBundles.cs`, 1): the app's level, like Android's `NATIVE_API`. Raise it when the page starts to
  rely on something new in the app; `web.json`'s `minXbox` (read from `WebBundles.cs` by `release-info.mjs xboxApi`)
  then keeps the new game off older apps, which keep the game they have (the settings say a newer app is needed).
- The rules (`WebBundles.Decide`) mirror `release-info.mjs xboxDecision`; the update log (the last 40 steps) is in the
  settings' *Details* and `LocalState\web\update.log`.
- The music and the References sheets come from the site like the other bundled games (`bundledGame` knows the host).

## The game side (`src/xbox.js`)

Everything behind `onXbox()` (the injected object or the user agent token; `?platform=xbox` fakes it in a browser for
the session). Nothing changes elsewhere.

- **Prompts**: the Xbox family always (`pageFamily`, `platformFamily` in `src/native-pad.js`), whatever id WebView2
  gives the pad.
- **Quality**: the default is Auto, which is the **Xbox** preset there (`QUALITY_PRESETS.xbox`): High's full recipe at
  scale 1 (WebView2 on the console reports a pixel ratio of 1.5 at 1080p output, a 1280 × 720 page, measured October 2026), with dynamic
  resolution down to 0.6. The Graphics menu lists it only in the app.
- **The TV's safe area**: `.tv-safe` on the root raises every `--safe-*` inset (index.html; the menus' CSS reads them
  first) to 5 % of the screen, Xbox's guidance (48 × 27 of 960 × 540). The 3D picture still fills the TV.
  `?tvsafe=0` turns it off.
- **The frame readout** (F3, or *Show FPS* in the settings): `XBOX EDGE <n>` first, and at the end
  ` · jit on 1.1 ns · js 240 MB`: a JIT probe (an integer loop, run once: about a nanosecond a turn with the JIT, ten
  to forty interpreted; `jitVerdict`) and the JS heap. `?jit=1` shows the probe anywhere.
- **The pad read by the app** (`listenHostPad`, `mergePads`): from the app's first `{ hiraeth: 'pad' }` message,
  `navigator.getGamepads()` serves the real pads with the app's presses folded in, or a pad of the app's own
  (`HOST_PAD_ID`, standard mapping) when the page sees none. An app from before sends none and nothing changes.
- The settings show the update section. (The title's *Full screen* entry still shows: the app is full screen
  already, so it does nothing there; left alone while the title screen is being redesigned.)

## Signing

One certificate for good, like the Android key: every package signed with it installs over the last and keeps the
saves; a package under a new certificate needs the app removed first, and its saves go with it.

- **Make it once** on the Mac: `scripts/xbox-cert.sh` (openssl): a self-signed code-signing certificate,
  subject `CN=Hiraeth Xbox Dev` (the manifest's Publisher), ten years, as `.local-tools/xbox-signing/hiraeth-xbox.pfx`
  (git-ignored: keep the backup), its `.cer` and `password.txt`; it sets the repository secrets `XBOX_PFX_BASE64` and
  `XBOX_PFX_PASSWORD` with `gh` (`--secrets` sets them again from the existing one).
- Without the secrets the workflow makes a throwaway certificate each run and warns: fine for the first try, not after.
- The workflow writes the certificate's subject into the manifest, so another subject works too.

## The workflow (`.github/workflows/xbox.yml`)

On a push that touches `xbox/`, `scripts/xbox-*` or the workflow, by hand, and nightly when the game moved since the
last package (the release notes' *Built from commit* line). The unit tests first (`tests.yml`), then on
`windows-latest` (or the repository variable `XBOX_RUNNER`, e.g. `windows-2022`, if an image lacks the UWP tools):
find MSBuild, the UWP build tools and the newest Windows SDK; `npm ci && npm run build`; the certificate;
`node scripts/xbox-package.mjs prepare` (stages `dist/` without what devices never carry, `scripts/site-only.mjs`,
writes the package version `major.minor.build.0`: `1.5.4123.0`); `msbuild` (Release, x64, .NET Native, unsigned,
`msbuild.binlog`); `signtool`; publish to the GitHub release **`xbox`** (a prerelease, never the latest):
`hiraeth-xbox.msix`, `hiraeth-xbox.cer`, the dependency `.appx` files (WinUI 2, .NET Native, VCLibs) and all of it in
`hiraeth-xbox.zip`. The run keeps the same files and the build log as an artifact for a week, also when it fails.

## On the console

**Developer Mode** (once): a Partner Center account (the individual developer registration), then on the console
install the green **Xbox Dev Mode** app from the Store, sign in, follow its steps and restart into Developer Mode.
Dev Home opens; under *Remote access* turn on the **Device Portal** (a user name and password) and note its address
(`https://<console-ip>:11443`).

**Deploy** from a PC or the Mac's browser to the Device Portal (accept its self-signed certificate):
1. Download `hiraeth-xbox.zip` from the `xbox` prerelease and unpack it.
2. *Home → My games & apps → Add*: pick `hiraeth-xbox.msix`; on the next page add every `.appx` (the dependencies);
   *Start*. If it asks for a certificate, add `hiraeth-xbox.cer` (or install it first under *Settings → Certificates*
   / the package's certificate option).
3. Set the app type to **Game**: in Dev Home select Hiraeth → *View details* → *App type: Game* (or in the Device
   Portal's app list, the app's menu). **Why**: an *App* gets about 1 GB of memory and 45 % of the GPU, shared with
   the system's UI; a *Game* gets about 5 GB and the whole GPU. The game would be starved as an App.
4. Launch it from Dev Home's list (or the Device Portal's *Start*).

**First run: what to measure** (write it into TODO.md / docs/benchmark-web-vs-unity.md):
1. **The frame readout** (settings → *Show FPS*): fps and ms in the desert, the City-Shaft, a busy town; the scale the
   Xbox preset settles at (`0.6×`…`1×`) and `xbox` at the end.
2. **The JIT**: `jit on` with a nanosecond or so means JavaScript is compiled; `jit off` (tens of ns) means WebView2
   runs jitless on the console, and the CPU side will be several times slower: the decision to revisit.
3. **The GPU share**: compare the readout's ms and scale with the app type set to *App*, then *Game*, in the same
   place: Game should show the higher frame rate or scale (if not, the share isn't reaching the WebView). The Device Portal's *Performance* page
   shows GPU and memory too.
4. **The controller**: every button and both sticks in the game (the settings' controls page shows the pad's
   presses); the prompts in Xbox letters; B goes back in menus and never leaves the app; the guide button and
   coming back pause and resume the sound.
5. **Memory**: the readout's `js … MB` after an hour, and the Device Portal's memory for the app (under 5 GB as a
   Game).
6. **Updates**: the settings' update section (*Check for updates*, *Restart now*), and that the saves are there after.
7. The TV's safe area: the hearts, the menus and the cues inside the screen on the TV; the picture to the edges.

## Debugging on the console

- **DevTools from the Mac**: the Device Portal relays WebView2's DevTools at `https://<console>:11443/msedge` (the
  targets' list; their `webSocketDebuggerUrl` is `wss://<console>:11443/msedge/<pid>/devtools/page/<id>`), with no flag
  in the app (Developer Mode; the documented switch, `--enable-features=msEdgeDevToolsWdpRemoteDebugging`, wasn't
  needed with runtime 150). `node scripts/xbox-devtools.mjs js '<expr>'` evaluates in the game's page, `console [s]`
  prints its console, `load [url]` opens a page (`index.html?start`: the save played last) and prints its load until
  the first frame, `log [page|update]` fetches the app's logs. Edge's `edge://inspect` → *Connect to a remote
  Windows device* works too.
- **Files**: `GET /api/filesystem/apps/files?knownfolderid=LocalAppData&packagefullname=<package>&path=\LocalState\web`
  lists, `/api/filesystem/apps/file?…&filename=page.log&path=\LocalState\web` fetches.
  `LocalState\EBWebView\Breadcrumbs` is Chromium's own trail of the last session (navigations, cache clears, memory
  pressure).
- **The screen**: `GET /ext/screenshot?download=false` (a 1920 × 1080 PNG). **Load**: `/api/resourcemanager/processes`
  (the app's processes, `msedgewebview2.exe` among them) and `/api/resourcemanager/systemperf` (GPU memory and engines).
- Launching through `POST /api/taskmanager/app` failed (`-2147219190`) at first; it works with the portal's CSRF token (the
  `CSRF-Token` cookie of any GET, sent back as `X-CSRF-Token`) and `Content-Length: 0` (October 2026).
- The virtual host's files are not seen by DevTools' Fetch interception: a build can't be swapped in from the Mac.

## The slow load (October 2026)

A new game sat about four minutes on "mixing the inks…" (build 1660, packaged, the Desert): `shaders: 861 kinds of
surface, 75 programs, 53228 ms`, `passage warm-up: 2472 meshes in 158965 ms`, `mixing the inks… 220788 ms`, total
230 s. Loaded again without relaunching the app: shaders 2.5 s, passage 30-31 s, total 42 s. Three causes:

- **The shader cache cleared at every launch** (the app cleared the disk cache before each load, and the GPU's shader
  cache went with it; Breadcrumbs: `ClearBrowsingData_ShaderCache`, `Begin_GpuCache`). Fixed in the app: only when the
  build changes.
- **The passage warm-up drew everything** behind every door (2472 meshes, 8 at a time) on a GPU that couldn't keep up:
  ~100 ms a batch, its fences late (the pacer gave up after three 250 ms waits). Now it draws what the first frame sees
  first, then round the traveller, the ship and the doors, and stops at `PASSAGE.loadBudget` (8 s); the rest is drawn
  as you come near a door, as anything new always was.
- **The app type was most likely App**: the GPU the app saw had 512 MB of its own memory, all of it used, and 832 of
  872 MB shared; Chromium logged `Memory Pressure: Critical` two seconds in. Set it to **Game** (Dev Home → Hiraeth →
  View details → App type); `page.log`'s first line now says which.

## The 100-second title (October 2026)

Build 1687, a first launch: the title's world (shot B4) showed at 99.9 s. Measured over DevTools
(`window.title.timing`, the GL calls timed by a script added before the page loads; "cold" = every shader salted
with a `#define`, so the GPU process compiles it afresh, as on a first launch):

- **38 programs**: 27 surface variants (materials.js, the same über-shader with different `S_*` defines: 39 kB
  vertex, 203 kB fragment, 210 uniforms each), the ink pass (78 kB), the water's, five depth-only shadow
  programs, the blit, bloom and garment ones. The ink look multiplies the surfaces only through their
  defines; the line pass is one program.
- **Per program** (compile + link to `COMPLETION_STATUS_KHR`, the GPU otherwise idle): a surface 0.7-1.2 s,
  **the ink pass 22-28 s** (HLSL warnings X3595: texture reads in loops), small ones 15-70 ms. Four surfaces
  queued at once finished in 1.96 s against 1.1 s alone: about two at a time. A second program with the same
  source in the same session took the full time again.
- **Where the time went** (cold, B4: world at 131 s): the compile stage 5.3 → 36.3 s, then the warm draws and
  first uses 36 → 131 s, nearly all of it inside `getProgramInfoLog` / `getShaderInfoLog` (three.js's first use
  of each program) blocking till the program was linked: 0.8-12 s each, about 89 s in all, the longest task
  **22.6 s** (the menu dead meanwhile). The uploads themselves were negligible; the pacer waited 234 ms once
  (its fences do signal on D3D11).
- **Warm** (the cache kept since the app stopped clearing it): the same shot reloaded showed at 20.2 s, a
  different shot at 45.7 s. The compile stage passed in 1.2 s (cache hits), but each first use still blocked
  0.6-3.8 s: what remains is the driver's own work on each program, not kept across loads.

So no cache makes the live title quick here. The fix (performance.md, "The title's world on a slow shader
compiler"): the title shows the shot's still at once (`public/title-stills/`, `src/title-still.js`) and on the
Xbox never builds the live world (`?vista=live` to try it); first uses wait for the driver instead of blocking;
the ink pass compiles without its debug views and lite path (28 → 16.5 s here). The game's own load gets the last
two as well. Measuring: the probes' method is the salted reload above; `scripts/xbox-devtools.mjs js` reads
`title.timing` (`still`: the picture shown; `live: false`: no world built).

## Design note: a packed single-target G-buffer for the Xbox (proposed, October 2026; not built)

**Why.** ANGLE on D3D11 links a program's pixel shader for its first output only. The first draw into the three-target
G-buffer then compiles the full three-output shader on the GPU process's main thread, synchronously, at 1-15 s each
(docs/systems/performance.md, "The first draws on the Xbox"). That is the floor of a cold load today: the desert's view
draws ~32 programs, about 60 s of draw-time compiles. A G-buffer of one target makes the shader compiled at link the one
the draws use, so it is compiled in parallel on the workers and never again at draw time.

**The repro on the console** (done, October 2026; `scripts/xbox-shaders.mjs --draw` on programs whose `packed` flag
makes them write one RGBA32UI output; a `gpu.angle` trace running). The desert's surface programs as they are against
the same writing one packed uvec4, each linked, then drawn into a matching 4 × 4 target:

| Program | 3 × RGBA16F: link + first draw | 1 × RGBA32UI: link + first draw |
|---|---|---|
| plain | 0.68 + 1.14 s | 1.41 + 0.49 s |
| ground | 1.09 + 7.64 s | 7.78 + 1.06 s |
| weathered | 3.99 + 9.46 s | 9.73 + 1.28 s |

- The trace shows no `D3DCompile` on CrGpuMain for the packed ones: their one compile is at link, on the workers, with
  all the code.
- Their first draws (0.5-1.3 s) show no ANGLE compile; most likely the D3D driver creating the shader at first use,
  which the three-output draws pay too.
- The work a program costs is about the same; it moves from the GPU process's main thread to the links, about two at
  a time beside everything else.
- For the desert's view, roughly: from ~28 s of links plus ~60 s of serial draw-time compiles, to ~55 s of link work
  over the two workers (~28 s) plus ~10-15 s of first draws.

**Shape: pack in the writers, unpack once, readers untouched.**
- The Xbox's G-buffer pass draws into one RGBA32UI target (plus the same depth texture).
- One full-screen unpack pass then writes today's three RGBA16F textures. It is the only three-output program, and a
  tiny one: its draw-time compile is milliseconds. It costs about one extra full-screen pass a frame (read 128 bits,
  write 192 bits a pixel), under a millisecond at the console's resolution; to measure.
- post.js, the bloom, veil.js, water.js (`gbuffer.textures[1]`, the depth texture), the ship's hologram and the rest
  read the unpacked textures as now: no reader changes.
- Behind a flag (`gbufferPacked`, on for the Xbox by `src/xbox.js`, `?gbuf=packed` to try it anywhere). Every other
  platform keeps MRT: their compilers don't have this flaw.

**Bit layout: 128 bits, against 192 today.**

| Field | Bits | Today (RGBA16F) | Packed |
|---|---|---|---|
| albedo r, g, b | 3 × 8 = 24 | half | 8-bit each: flat print colours; post.js's colour-edge threshold is 0.08, and 1/255 steps are far below it |
| light term + line step + white-line flag | 14 | half, signed | L in 0..1 at 10 bits, line step 3 bits (materials.js `lineStep`; check its range), 1 bit white line |
| normal | 2 × 11 = 22 | 3 halves | octahedral; error ~0.05°, below what the normal edge test and the shading see |
| view depth | 16 | half (the `.a` of tNormal) | half, as now: same precision |
| hatch r, g (strokes + shade steps) | 2 × 13 = 26 | half: at values 16-32 the fraction keeps only ~5 bits today | stroke fraction 8 bits + hue/flat step 5 bits (`SHADE.hues` 8 + `flats` 5 + 2 < 32); g: fraction 8 + lift step 4 bits (`SHADE.lifts` 15) |
| hatch b (drawn detail + spot step + weathered) | 12 | half | detail 0..2 at 8 bits, spot step 2 bits (`SPOT.steps` 2), weathered 1 bit, 1 spare |
| hatch a (glow + flags) | 12 | half | glow 6 bits (64 levels: it feeds the bloom's halo, check for banding), 6 flags (hero, figure, soft ink, face, drift, mover) |
| **total** | **126** | | 2 bits spare |

What is squeezed to fit, against my first estimate of 131 bits:
- the normal from 2 × 12 to 2 × 11;
- the light term to 14 bits;
- the glow to 6 bits.

The hatch fields come out better than today's halves: integer steps and fraction no longer share one mantissa.

**Writers to change** (each keeps its three vec4 locals; a shared GLSL snippet declares the outputs and packs at the end):
- `src/materials.js`: the surface shader, which carries grass (`grass-shader.js`), the blade (`blade-shader.js`), the
  crystal (`crystal-shader.js`), dune glass, foe surfaces and face ink;
- the shaders with G-buffer outputs of their own: `src/chimes.js`, `src/jump-shadow.js`, `src/life.js`,
  `src/ship/approach.js`, `src/story/flames.js`;
- `src/passage.js` (`writesGBuffer` looks for `location = 2`) and the warm passes' 4 × 4 G-buffer (`warmPasses`);
- `src/pipeline.js` (`createGBuffer` gains the packed variant) and main.js's G-buffer pass, plus the unpack pass before
  the ink pass.

The studio, the trailer, the items page and the motion page don't run on the Xbox: they keep MRT. title-world.js keeps
MRT too: the Xbox shows its stills.

**Precision risks, to check with pixel diffs** of packed against MRT on the Mac (both paths run there; the probes'
views, three worlds):
- the colour-edge lines on gentle albedo gradients (the ground's biome blends);
- the bloom's halos from the 6-bit glow;
- normal-edge lines on large smooth forms;
- the line step's and the white line's encoding (signed today).

Depth is unchanged.

**Estimate.**

| Part | Time |
|---|---|
| The console repro first | half a day |
| The snippet, the flag, the pipeline and the unpack pass | 1 day |
| The seven writers | 1 day |
| Diffs, tests (the packing and unpacking round trip in node, every writer declaring the packed output) and the console's cold/warm measures | 1 day |
| **Total** | about 3-4 days |

Expected win: the ~60 s of draw-time compiles for the desert's view, and 1-15 s freezes on first sight in play. What
stays is the links on the workers (~28 s serial, in parallel two at a time) and the ink pass.

**Alternatives considered.**
- Three single-output passes: three times the geometry a frame on a console already at 22 fps.
- Two targets: the default layout would still cover one, so it doesn't help.
- An ANGLE flag: none exists (`GetDefaultOutputLayoutFromShader` takes the first output, unconditionally).
- Caching: Chrome stores the binary at link, without the draw-time shaders; a relaunched app still took 51 s warm.

## The controller drove a cursor (October 2026)

Reported on the first install (1660). Seen over DevTools: the page's Gamepad API has the pad
(`Xbox 360 Controller (XInput STANDARD GAMEPAD)`, standard mapping) and the page has the focus; `(pointer: fine)` and
`(hover: hover)` are false. WinUI 2's WebView2 asks for no pointer of its own (its source has no Xbox or
`RequiresPointer` code), so the mouse mode came from XAML: the app now sets `RequiresPointerMode` in code as well as in
App.xaml, `RequiresPointer="Never"` on the page too, no focus engagement on the web view, and puts the focus on the web
view whenever it could have gone (a focus on nothing, or on the page, can bring the cursor back). If it still happens,
`page.log` says so: `mouse input: … the system's mouse mode is on`, and where the focus went.

## The A and B buttons (October 2026)

With the focus fixed (`focusAlways`), a probe of `navigator.getGamepads()` every frame while the author pressed A, B
and the D-pad for three minutes saw only buttons 12, 13 and 14 (D-pad up, down, left), never A, B or D-pad right. A
fake standard pad through `getGamepads`, or a synthetic ArrowUp, moved the title's focus: the game was fine, the pad
didn't reach WebView2's Gamepad API. WebView2 in a UWP app gets the pad from the system, not from the app
(WebView2Feedback #1318, #4366: "only GameInput-based providers work"), and the presses XAML acts on (A to engage or
invoke, B as Back, the D-pad's focus moves) were lost on the way. Two routes, both in:

- **XAML kept off the pad**: no engagement on the web view (MainPage.xaml), its four XY focus targets are itself, a
  focus move away is cancelled, Back is handled. If WebView2 gets the pad natively, that is enough.
- **The app reads the pad** (`HostPad.cs`, the guarantee): `Windows.Gaming.Input.Gamepad.Gamepads`, each
  `GetCurrentReading()` every 8 ms on a `ThreadPoolTimer`; on a change (or a new page: `NavigationCompleted`, and the
  page's `{ hiraeth: 'pad-sync' }`) it posts `{ hiraeth: 'pad', pads: [{ buttons: [17], axes: [4] }] }` in the Standard
  Gamepad's order (A B X Y, LB RB, LT RT analog, View Menu, L3 R3, up down left right, guide always 0; the sticks' Y
  turned so up is -1, rounded to 0.01 so a resting stick sends nothing). While the app is away it stops and sends
  `pads: []`. `src/xbox.js` `mergePads` gives the k-th connected standard pad the app's k-th reading (a button is
  pressed if either says so; each axis is the one pushed further; the id, index and rumble stay the real pad's), so
  the game's `Controller` reads it unchanged. B still never leaves the app (`BackRequested` handled) and the page
  reads it as button 1; the guide button never reaches an app (the system's overlay; `EnteredBackground` pauses the
  sound as before). `XboxApi` stays 1: the page relies on nothing new (an older app sends no pad messages).

Check it on the console: `node scripts/xbox-devtools.mjs js 'JSON.stringify(window.__xboxHostPad && { n: __xboxHostPad.messages, pads: __xboxHostPad.pads })'`
shows the app's readings (hold A while it runs: `buttons[0]` is 1), and
`node scripts/xbox-devtools.mjs js 'navigator.getGamepads().filter(Boolean).map(p => p.id + " " + p.buttons.map((b, i) => b.pressed ? i : "").filter(String))'`
the merged pads with what is held. `page.log` says `pad: read by the app too (1 pad)` once per page.

## The Unity build on the Xbox

The engine bridge (docs/systems/engine-bridge.md: the game's own JavaScript in Unity, drawn by Unity) as a UWP app,
to see whether Unity's native Direct3D 11 path compiles and draws the same world faster than WebView2's ANGLE one
(the 100-second title above). Results: docs/benchmark-web-vs-unity.md, "On the Xbox: WebView2 against the Unity bridge".

- **The script engine**: Puerts 3.0.3 ships no UWP libraries, and its desktop V8 (`PapiV8.dll`: dbghelp, winmm,
  mswsock, a JIT) can't run in a UWP app on the console. Its QuickJS backend (quickjs-ng, an interpreter, plain C) is
  built from Puerts' source at the release's tag for Windows Store x64 (`scripts/unity-uwp-natives.ps1`, CMake's
  `WindowsStore` system: AppContainer, the UWP C runtime) and put into the embedded packages in `Plugins/WSA/x64`
  (`PUERTS_BACKENDS=Quickjs scripts/unity-js-setup.sh` first). `JsRuntime` picks QuickJS where the V8 package is
  missing. **The script is therefore interpreted** while WebView2 on the console has its JIT on (the readout's probe:
  0.4 ns a turn, October 2026): its time is not comparable with the web's. The native side is.
- **The build** (`BridgeBuild.Xbox`): the bridge's scene as a UWP D3D solution, IL2CPP x64, Direct3D 11 (what ANGLE
  draws through on the console), Unity's references copied in. Identity `rnaud.HiraethUnity`, shown as *Hiraeth
  (Unity)*: it installs next to `rnaud.Hiraeth`. No command line on the console: it plays the desert from the spawn.
- **The workflow** (`.github/workflows/unity-xbox.yml`, windows-2022; on a push touching the Unity side and by hand):
  QuickJS and its UWP DLLs, the bundle, GameCI's Windows editor with the UWP module (Puerts' glue, then the
  solution), the package's identity written into Unity's manifest, `msbuild` (Master, x64, sideload, unsigned),
  `signtool` with the WebView2 app's certificate (`XBOX_PFX_BASE64`), published to the prerelease **`unity-xbox`**
  as `memento-unity-xbox.zip` (the `.msix`, its `.cer`, the dependency `.appx` files).
- **The numbers** (`BridgeMetrics`, on in the UWP build, `-metrics` elsewhere): `LocalState\unity.log`, new each launch
  (the last in `unity.prev.log`), and a readout at the top left. The load's stages apart: `script's engine made`,
  `the bundle loaded in`, `Memento.start returned in`, `load: first node` (the first mirrored object), `load: world
  settled` (no new object for 2 s), the first ten frames after the first node one by one (the frame, the script's
  wait, **Unity's own part**, FrameTimingManager's CPU and GPU), and the **first frames** between (their sum, the longest, how many over 50 ms: a
  shader's first use on D3D11 shows there; the shaders themselves were compiled to DXBC when the player was built,
  where the web compiles GLSL → HLSL → DXBC on the console at run time). Then every 5 s: fps, the frame's median,
  95th and longest ms, FrameTimingManager's **CPU main / render thread and GPU** ms, and the **script**'s own time a
  frame and the main thread's **wait** on it.

**Installing and measuring** (from the Mac; the portal has no password). `node scripts/xbox-unity.mjs install <dir>`,
`launch`, `stop` and `log [prev]` do steps 2, 4 and the fetch; by hand:
1. Download `memento-unity-xbox.zip` from the `unity-xbox` prerelease and unpack it.
2. Install: `GET https://192.168.68.64:11443/api/app/packagemanager/packages` for the `CSRF-Token` cookie, then
   `POST /api/app/packagemanager/package?package=memento-unity-xbox.msix` (multipart: the `.msix` and each `.appx`)
   with the header `X-CSRF-Token`, and poll `GET /api/app/packagemanager/state` until it stops answering 204.
   The certificate is the WebView2 app's, already trusted.
3. Dev Home → *Hiraeth (Unity)* → View details → **App type: Game** (as the WebView2 app: an App gets ~1 GB and
   45 % of the GPU).
4. Launch (Dev Home, or `POST /api/taskmanager/app?appid=<base64 of PRAID>&package=<base64 of the full name>`),
   wait for `world settled` and a minute of `frames:` lines at the spawn, then fetch the log:
   `GET /api/filesystem/apps/file?knownfolderid=LocalAppData&packagefullname=<full name>&path=\LocalState&filename=unity.log`.
   The first launch is the cold one; quit and launch again for the warm one (`unity.prev.log` keeps the first).

## Unknowns (to check on the console)

- WebView2 on the console passes the pad to the Gamepad API (seen, runtime 150); whether it also sends it as keys or
  mouse in some state (the page's log says so now).
- Whether the WebView2 runtime on the console takes `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` (autoplay) and has the
  newer settings (each is set alone, logged when refused).
- The pixel ratio: 1.5 at 1080p output (a 1280 × 720 page, the canvas 1920 × 1080), not 2; at 4K output, unknown.
- The first Windows build: the runner image's UWP tools and SDK (the workflow's first step says what it found).
- Tests: `tests/xbox.test.js` (detection, defaults, the bridge, the rules, the package script, the C# app's
  agreement with the page, the workflow).
