# The Xbox Dev Mode package

The web game in a UWP app with WebView2 (x64), sideloaded on an Xbox in Developer Mode. Why the web game and not
the Unity build: TODO.md, "An Xbox Dev Mode package" (Puerts has no V8 for UWP/Xbox; the gain was ~0.9 ms).
Not for players: there is no Store listing; it is for measuring the game on the console.

## The app (`xbox/Hiraeth/`)

C# with .NET Native (C# 7.3: keep newer language features out), WinUI 2.8 and its WebView2 control.

- **`App.xaml(.cs)`**: one page; `RequiresPointerMode="WhenRequested"` (no mouse-mode cursor: the system's mouse
  mode stays off, the game reads the pad itself); `SetDesiredBoundsMode(UseCoreWindow)`, so the picture fills the TV
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
  app maps the host onto the new folder, clears the HTTP cache and opens the title).
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
  scale 1 (WebView2 on the console reports a pixel ratio of 2 at 1080p, where High renders 1× too), with dynamic
  resolution down to 0.6. The Graphics menu lists it only in the app.
- **The TV's safe area**: `.tv-safe` on the root raises every `--safe-*` inset (index.html; the menus' CSS reads them
  first) to 5 % of the screen, Xbox's guidance (48 × 27 of 960 × 540). The 3D picture still fills the TV.
  `?tvsafe=0` turns it off.
- **The frame readout** (F3, or *Show FPS* in the settings): `XBOX EDGE <n>` first, and at the end
  ` · jit on 1.1 ns · js 240 MB`: a JIT probe (an integer loop, run once: about a nanosecond a turn with the JIT, ten
  to forty interpreted; `jitVerdict`) and the JS heap. `?jit=1` shows the probe anywhere.
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

## Unknowns (to check on the console)

- Whether WebView2 on the console passes the pad to the Gamepad API (reported working: WebView2Feedback#4366) and
  whether it also sends the pad as keys (then the page sees both; the injected `gamepadInputEmulation` may not apply
  to WebView2).
- Whether the WebView2 runtime on the console takes `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` (autoplay) and has the
  newer settings (each is set alone, logged when refused).
- The pixel ratio at 4K output, and whether the app runs its swap chain at 1080p (the Xbox preset assumes 1080p).
- The first Windows build: the runner image's UWP tools and SDK (the workflow's first step says what it found).
- Tests: `tests/xbox.test.js` (detection, defaults, the bridge, the rules, the package script, the C# app's
  agreement with the page, the workflow).
