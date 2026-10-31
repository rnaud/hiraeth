# The Unity port and the benchmark

The desert in Unity (a proof of concept) and the web-against-Unity benchmark. (The other way to
Unity, the web game's own JavaScript run in Unity by Puerts and drawn through this port's look:
docs/systems/engine-bridge.md, `unity/Hiraeth/Assets/HiraethJS/`.)

## The desert in Unity (a proof of concept)
`unity/Hiraeth` is a Unity 6 (URP) port of the desert, built from this game rather than
beside it (the details, how to run it and what is missing: `unity/README.md`).
- **Export** (`scripts/unity-export/export-desert.mjs`): the desert is built headlessly as
  `main.js` builds it (the level, the ship, the story's people, the boxes, the bike, the
  flora; `build-world.mjs`, with the tests' DOM stub) and written out: static surfaces merged
  by material and 256 m tile, the `makeMaterial` options read back from each shader's
  uniforms, the terrain heightfield, the collision `physics.js` bakes, the moving things, the
  time-of-day palette and the "Moebius print" preset, the story's places, portals, people,
  crowd and procession, and `desert-data.js` as `story.json`. Unity's frame mirrors x; the
  shaders mirror it back before every pattern, so the page lands where it does here.
- **The look**: a URP renderer feature draws the same G-buffer (albedo + light, normal +
  depth, hatching + flags) and one ink composite, `materials.js`, `ground-ink.js`,
  `biome.js` and `post.js` ported to HLSL; side-by-side shots match the web closely.
- **The play**: the traveller (glTFast, his own clips), walk / run / jump / climb / mantle,
  the camera rig, the people and the procession (Quaternius bodies in their palettes, UAL
  clips), conversations with tones and at most three answers (the people's voices: audio.md, "The people's
  voices", the Unity port), quests and the journal, the
  father's charge, the makers' chest on the ledge, the rib, the pool and the jar, the
  hoverbike under the tarp, the burning tree's fire and its burn, falls and knock-downs.
  `scripts/unity-export/unity-batch.sh Play` plays the opening quest end to end in batch mode.
- The project carries the Unity side of MCP for Unity (CoplayDev) so an MCP client can drive
  the editor; see `unity/README.md`.

### Web or Unity: the benchmark (`scripts/bench/`)
The same desert measured on three sides, to decide on numbers: this game in Chrome, the Unity port
as a macOS player, and the port's WebGL (WebGPU) build. Results and the reading of them:
`docs/benchmark-web-vs-unity.md`.
- **Viewpoints, once for all sides** (`viewpoints.mjs` → `viewpoints.json`, built from the desert
  itself): the spawn, Qanat by the tree, the camps, the dune vista, the cave, and two paths (riding
  through the gate into Qanat, walking round the camps), each with the traveller's place, the eye,
  the target and the fov; the hour and the weather fixed.
- **The web side** (`web-bench.mjs`, `web-page.mjs`, `browser.mjs`): real Chrome on the GPU (ANGLE
  Metal, checked), no vsync or frame-rate limit; requestAnimationFrame is wrapped to time each
  frame, its JavaScript and (EXT_disjoint_timer_query) its GPU commands; the camera pinned through
  `updateMatrixWorld`, the HUD hidden; nothing in `src/` changes. **The Unity side**: the players'
  benchmark mode (`unity/Hiraeth/Assets/Hiraeth/Runtime/Bench.cs`).
- **Fair conditions**: the same pixels (device scale 1; High at render scale 1.0, Handheld at 0.75
  without dynamic resolution, URP the same), the presets mapped (the table in the report), the
  quiet-machine gate before and during every run (no Unity editor or job, no other automated
  browser or build, low load, AC power), runs alternating over three rounds, the paths again at
  60 Hz for the stutter.
- `mac-run.sh` runs it all and rewrites the report; `android-run.sh` does the handheld (the APK
  `com.rnaud.hiraeth.unity` and the game in the device's Chrome, never the app `com.rnaud.hiraeth`).

## Building in GitHub Actions (the testers' builds)

The engine bridge's Unity player (docs/systems/engine-bridge.md, "Players"), built for testing on the
devices next to the players' builds, by `.github/workflows/unity-android.yml`, on request (Actions ▸ Unity release (testers) ▸ Run workflow, or `gh workflow run unity-android.yml`).
It also runs daily at 03:17 UTC, building only when relevant code/assets changed since the last
successful Android and Linux build. Failed or skipped runs do not advance that baseline. There are
no per-push native builds. Compatible game scripts still arrive through the
web deployment's Unity OTA bundle. C# / bridge changes need a requested installer; compatibility
checks must not be lowered to make an older player accept them. Builds remain serialized.
- **Android** (`BridgeBuild.AndroidRelease`): package `com.rnaud.hiraeth.unity`, named "Hiraeth
  (Unity)", the game's icon (`public/icons/icon-512.png`), landscape, immersive, sound on (paused when
  left), the pads through the Input System; IL2CPP ARM64, Vulkan only (see below); versionName the newest
  version in `src/changelog.js`, versionCode the commit count (`release-info.mjs build`); signed with the
  web app's release key (alias `moebius`), so it installs **next to** the app `com.rnaud.hiraeth`, never
  over it, and every build installs over the last. Published as `hiraeth-unity.apk` on the release
  [`unity-android`](https://github.com/rnaud/hiraeth/releases/tag/unity-android).
- **Linux** (`BridgeBuild.Linux`, the Steam Deck's: x86_64, IL2CPP, Vulkan), after the APK, as
  `hiraeth-unity-linux.tar.gz` on the release `unity-linux`. IL2CPP since October 2026: the Mono player never
  ran (Puerts' start threw `csType.GetNestedTypes is not a function`). Its build wants Unity's Linux sysroot,
  a package the job adds to the manifest for that build only (`com.unity.toolchain.linux-x86_64`); on a Mac,
  `com.unity.toolchain.macos-arm64-linux` and `com.unity.sysroot.linux-x86_64` (not committed). Its retry
  is on the same Library, and only a third try starts from none (see "Retries"). Packed with `pigz` (all
  cores, the same `.tar.gz`). A branch's run by hand builds the APK alone unless asked for the Linux player
  too (`gh workflow run unity-android.yml --ref <branch> -f linux=true`; it publishes nothing).
  On the Deck: `scripts/bench/deck-unity.sh` (docs/systems/performance.md, "The Steam Deck, round 6").
- Both releases are prereleases and never "latest" (the app's updater and the players read the
  `vX.Y` releases); each build replaces its file, moves the tag to its commit and rewrites the notes
  (which commit, which web version: `release-info.mjs unity-notes`). `scripts/unity-publish.sh` does it,
  and then puts the same file on its built version's release (`vX.Y`) beside the APK, labelled with its
  commit (android.md, "The Unity builds on a version's release").
  The two releases were made once by hand: Actions' token was refused creating one (403 "Resource not
  accessible by integration", on a commit that adds a workflow), and it may be refused moving the tag
  over such commits (a warning; the notes still name the commit). Each run also keeps its APK as an
  artifact for a week.
- The steps: Puerts (`scripts/unity-js-setup.sh`), the bundle (`node scripts/engine-bundle.mjs
  unity`), then GameCI's `game-ci/unity-builder@v6` in Unity's Linux editor image (6000.6.4f1, read
  from `ProjectVersion.txt`): one editor run for Puerts' IL2CPP glue (`BridgeBuild.Il2cpp`: it is C#
  too, compiled by the next start), one for the APK. Every `unity-builder` step gets `GITHUB_TOKEN`: the
  action looks up the latest game-ci CLI release through GitHub's API, and unsigned, on the runner's shared
  IP, it ran out of the 60-an-hour limit (run 38042662102: both Linux player attempts failed in a fraction
  of a second, "Failed to resolve the latest game-ci CLI release: GitHub API returned 403"). The cache
  prunes are `continue-on-error` (housekeeping), and the publish retries transient errors
  (`scripts/retry.sh`; android.md, "When a release fails").
- **The caches** (a cold APK took 54 minutes: the image 2, the glue's editor run with a first import
  12, shaders 12, the IL2CPP C++ 20, Gradle 4): Unity's `Library` per platform (the imports, the
  shader cache, the IL2CPP build's objects in `Library/Bee`, rebuilt only where the C# changed; the
  symbol backups and stripped copies left out); Puerts' glue (`Assets/Gen`: its editor run skipped on a
  hit); Gradle's downloads (`~/.gradle`: GameCI mounts the runner's home as the container's `/root`);
  Puerts' release; npm. The repository's caches are limited to 10 GB (past it GitHub evicts the oldest,
  and a cold APK is 54 minutes again), so no key changes every run and each Unity cache keeps one entry:
  - `unity-library-<android|linux>-<Unity>-puerts-<version>-<hash>`, the hash of what Unity imports and
    compiles: the committed `Assets` (not `StreamingAssets`, the game's JavaScript, nor `Assets/Gen`),
    `ProjectSettings` and `Packages/manifest.json`. Restored from the newest entry; an exact hit is not
    saved again (a requested run that only moved the JavaScript saves nothing); otherwise saved
    after the build, as `…-partial` when the build failed (what was imported is kept, and the next run
    misses and saves it whole), then `scripts/unity-ci-cache-prune.sh` deletes the older entries (the
    workflow's token with `actions: write`; nothing is deleted unless the new entry is there). About
    1.4 GB for Android, 0.8 for Linux.
  - `unity-gradle-<Unity>-<hash of Packages/manifest.json and Assets/Plugins/Android>`, saved when that
    moved and the APK was built, the older pruned the same way (about 0.9 GB).
  - `puerts-glue-<Puerts>-<Unity>-<hash>`, the hash of the committed C# and asmdefs (the glue's bridges
    follow the public signatures and extension methods) and the manifest, never `Assets/Gen` itself;
    Puerts goes into `Packages/`, out of the hash. Computed when the step runs, before the glue exists.
    40 KB, a new entry only when the C# moved (any C# edit makes the glue again: 80 seconds).
  - `puerts-3.0.3` and setup-node's npm cache (`node-cache-…`, keyed on `package-lock.json`, in this
    and the other workflows; setup-java's Gradle cache in `android.yml` on its Gradle files) are saved
    only on a miss; their replaced entries go after 7 days unused. Together under 1 GB.
- **The editor image** (8 GB) is pulled each run, 2 to 6 minutes from Docker Hub (too large for an
  Actions cache): `scripts/unity-ci-docker.sh` frees the runner's disk (these runners have no `/mnt`
  to put Docker on) and pulls it in the background while the job checks out, bundles and restores.
- **Measured** (2026-10-07, the hosted ubuntu runner, 4 cores): cold, no cache, the Android job 57
  minutes (run 37617242382); warm (run 37649246951) the Android job 12 minutes and the Linux one 9: the
  APK's editor run 3.3 minutes, Unity's build in it under 2 (nothing recompiled: the shaders and the
  IL2CPP objects come from the cache), the Linux player's 2; the rest is waiting on the image (5
  minutes: the disk's cleanup and the pull, beside the other steps) and the caches (1–2). A warm run
  is so bounded by the hosted runner's image pull: a self-hosted runner (this Mac, with Unity
  installed: GameCI's `providerStrategy: local-system`) would bring it to the build's few minutes.
  On 2026-10-09 a warm Android job took 8 minutes: the image 2.5, the glue 1.3 (its key had moved
  with a C# edit), the Library's restore 1 and save 0.3, Gradle's save 0.3 (a new entry every run then,
  the caches at 11 GB and evicting), the APK 2. With one entry per cache, a run that moves no C# skips
  the glue and both saves: about 6 minutes.
- **Retries**: the first editor start in a job's container is often killed right after it loads its
  modules (exit 137, about 1 in 2; a later start about 1 in 5; the same step passes when run again; the
  kernel's log is printed after a kill: no out-of-memory kill in run 38525814587, 14 GB free). Each editor run has
  `continue-on-error` and goes again on the same Library when it failed (20 seconds lost); the APK, the
  APK job's glue and the Linux player go a third time (4 of 45 runs before #290 failed on two kills).
  Only the Linux player's third try starts from no Library. Until #290 its first retry did (a rule from the
  Mono player's days, run 38151565992, when starts on the cached Library were killed every time): in 13 of
  the 28 Linux jobs of 2026-10-11 to 14 the first start was killed and the retry imported and compiled
  everything again, 15–28 minutes (the "25 minutes" of #290), where a warm Linux job takes 5–7. In the
  first run after (38525814587) the Linux player's first start was killed and the retry built it on the
  same Library in 107 seconds: the Linux job 5.2 minutes where 38519467734, killed the same way, took 29.5.
- **A local build** does the same from the Mac: `scripts/unity-android-release.sh` (the key from
  `.local-tools/android-signing/`, here or in the main checkout; it checks the APK is signed with the
  release certificate, then uploads to `unity-android`; `NO_UPLOAD=1` builds only, `CLEAN=1` deletes
  `Library/Bee` after). The commit has to be pushed first: the notes and the tag name it.
- The bench's own Android players stay apart and debug-signed: the bridge's `com.rnaud.hiraeth.bridge`
  (`BridgeBuild.Android`) and the C# port's `BenchBuild.Android`, which also uses
  `com.rnaud.hiraeth.unity`. Android refuses an APK signed by another key over an installed one: to put
  the C# port's bench APK on a device that has the testers' APK (or the other way round), uninstall
  `com.rnaud.hiraeth.unity` first (that deletes its saves, never the web app's).

### A newer player is available (issue #805)

A player asked for a new player only when the newest script needed one (`minUnity` above its `UnityApi`), so a player
whose C# was behind (the enamel menus, the new foes' bodies) but whose script still ran never heard of it. Now it offers
the newest player of its platform whenever its own build (`bundle.json`'s, the commit count) is older:
- **The feed.** `unity.json`'s `players` (`{ android, linux, xbox }`: `{ build, version, commit, url, size, sha256 }`),
  written by the Cloudflare deploy from the `player.json` that `scripts/unity-publish.sh` puts beside each build on its
  prerelease after the build (docs/systems/android.md, "A newer app or player is available"). `BridgeUpdates.Info` passes
  them on with `playerPlatform` (`-player-platform android|linux|xbox`: a test's platform) and `apkInstall`.
- **The decision** (`src/updates.js playerOffer`, pure): this platform's entry, newer than `app`, on the game's GitHub
  releases with a size and a sha256; else nothing (the same build, an older one, none advertised, no file). Android: *install*
  (or *open* on a player with `OpenUrl` only); the Deck and the Xbox: a notice.
- **Where it shows.** On the title a small enamel card at the bottom right (`BridgeMenu.Offer.cs`: the night panel, brass
  corners, a teal edge; `engine/menus.js titleView`'s `offer`, polled every 4 s, 0.4 s while downloading, never each
  frame), *A newer player is available* under the title's Updates entry, and the offer first on the Updates page (the
  title's, under Settings, and the Start menu's), before the script's own state, which works as before. A tap on the card
  opens Updates. The card (and the line under Updates) only for a new version: the feed's `version` against the player's
  own (`appVersion`, its `bundle.json`'s); a newer build of the same version, which the daily testers' builds bring often,
  is offered on the Updates page only. *Not now* keeps that build off the title (the store's
  `hiraeth.playerOffer.dismissed`) until a newer one; the page still offers it.
- **Android: one tap** (`BridgeHost.ApkInstall(build)` → `BridgeApk.cs`): only the feed's build, newer than this player,
  from `https://github.com/rnaud/hiraeth/releases/download/`, under 600 MB; downloaded with its progress into
  `temporaryCachePath/player/`, its size and sha256 checked on a thread, then handed to Android's package installer
  (`Assets/HiraethJS/Android/ApkInstaller.java`: a `PackageInstaller` session, the system's confirmation started from its
  `STATUS_PENDING_USER_ACTION`, no FileProvider). The permission: `REQUEST_INSTALL_PACKAGES`, written into the generated
  unityLibrary manifest by `Editor/BridgeAndroidManifest.cs` (`IPostGenerateGradleAndroidProject`, no custom manifest);
  the first time, the player opens Android's *Install unknown apps* page and says to allow it, then *Install* again. A
  cancelled installer leaves the file: *Download and install* hands it over again. The same release key signs every
  testers' APK, so it installs over this one and keeps `persistentDataPath` (the saves). Downloads of builds the player has
  become are deleted at the next start.
- **The Deck**: *quit Hiraeth and launch it again*, its launcher fetches the player in the background (a managed install
  also has *Update player and restart*, #620). **The Xbox**: *install it through the Device Portal*. Both only say so.
- In the editor or a batch run nothing is installed: with `-player-platform android` a download goes as far as the
  installer's step, logged. Checked in batch mode: `-updates <a local unity.json with players> -player-platform android
  -title-shots 1280x720` (the card), `-updates-page` (the page).
- **The first player with this offer is installed by hand once**: an older player's `Info` has no `players`.

### Android: Vulkan only, and the variants never asked for (issue #703)

- **Vulkan only.** Android's players (the project's settings, `BridgeBuild.AndroidPlayer`, `BenchBuild.Android`)
  carry no OpenGL ES 3 fallback since #703: its 132 Surface variants were 44 % of a cold Android build's shader
  CPU time (docs/audits/perf-materials-v2.31.md). With Vulkan alone Unity writes
  `<uses-feature android:name="android.hardware.vulkan.version" android:required="true" />` into the manifest
  itself (checked in the APK with `aapt2 dump xmltree`), so a store leaves a device without Vulkan out; a sideloaded
  APK still installs there, and Unity's player then says the device has no supported graphics API and quits. Every device the game is tested on (the Retroid, an Adreno; the Deck and the Xbox are not
  Android) has Vulkan; the devices lost are Android phones and boxes without a Vulkan 1.0 driver (Mali-T7xx/T8xx
  and Adreno 3xx-era GPUs, some Android 7-and-older sets, a few Android TV boxes).
- **Combinations never asked for, left out.** On Android BridgeShaderStrip also leaves out what
  `BridgeRenderer.Lean` cannot give there (`BridgeShaderStrip.NeverOnAndroid`): a skin (`HIRAETH_SKIN`) with a lean or
  plain keyword (Lean returns at once for a skin, and only `WorldLoader.MakeMaterial`, before Lean, gives one),
  `HIRAETH_PLAIN` without a lean keyword (`plainOk` needs one), and `HIRAETH_PLAIN` with `HIRAETH_LEAN_SLIM` (only
  under the runtime test flag `-slim-on-plain`: build with `-keep-unasked` to keep them for it). 54 of the G-buffer
  pass's 228 Vulkan variants: 174 left. `tests/unity-android-strip.test.js` derives from the C# what Lean can ask
  for (each guard it relies on checked in the source) and fails if a rule ever matches one of them.
- **Measured** (a cold local `BridgeBuild.Android` on the M4 Pro, 27 Oct 2026, the Surface of 591ed0aa8): the G-buffer
  pass 448 → 174 variants after scriptable stripping, Vulkan alone (was 228 Vulkan + 132 OpenGL ES 3 = 360), the
  shadow pass 8; 8 720 s of compiler CPU, 761 s wall (the Mac also busy). A cold CI Android build compiles about half
  the Surface CPU it did (the skin variants left out are the biggest): from ~49 min (26 Oct, 360 variants) to an
  expected ~25 min on the same source; the shader cache key is unchanged (each kept variant's source is the same).

### Unity's own switches on the Odin 3 (issue #803)

Six Unity-side candidates, each measured against the same build on the AYN Odin 3 (Adreno 830, 1920 × 1080 at 60 Hz,
Vulkan): the bench's own player under an id of its own (`BridgeBuild.Android -package com.rnaud.hiraeth.perf803
-unity-audio`), `scripts/bench/android-bridge.sh` with `-quality handheld -no-dyn-res` (Handheld held at its top, 0.75,
FSR 1), `-bench 8 -split -metrics`, muted (`-mute` closes Unity's output stream; the script checked `dumpsys audio` at
every run), the desert's five views and the City-Shaft's four, the configurations interleaved over three rounds after an
unrecorded warm-up launch on each fresh install (no pipeline cache), medians of the rounds, then of the views. The
frames are held to the display's 60 Hz, so the frame's median is 16.6 ms wherever the GPU fits; what the changes move
is the threads under it (`-split` now gives the main thread's and the render thread's ms, FrameTimingManager's, and the
C# apply by op, `split.applyOps`, LateUpdate's draws as `late`).

| candidate | desert: frame, p95 / main / render / GPU (ms) | City-Shaft: frame, p95 / main / render / GPU | kept? |
|---|---|---|---|
| the build as it was | 16.65, 17.20 / 4.12 / 1.29 / 12.52 | 16.67, 19.04 / 6.34 / 4.02 / 14.01 (wide: 23.3, 26.1) | |
| GPU Resident Drawer off (`-no-grd`) | 16.65, 17.01 / **3.42** / 1.30 / 12.53 | 16.66, 18.65 / 6.76 / 3.66 / 14.03 (wide: 23.3, 26.0) | **kept** |
| LateUpdate's draws past nodes with none (`late`, ms) | 0.29-0.39 → 0.24-0.35 | 0.62-0.96 → 0.59-0.90 | **kept** |
| graphics jobs, split (`-graphics-jobs`) | 16.64, 17.01 / 3.79 / **0.63** / **13.13** | **18.40, 22.62** / 5.32 / **1.04** / **17.96** (wide: **26.4, 32.4**) | dropped |
| static batching off (`-no-static-batch`) | 16.64, 17.09 / 3.94 / 1.80 / 12.73 | 16.65, 18.46 / 6.76 / 3.89 / 14.67 (wide: 23.9, 25.8) | (already on) |
| HDR off | no change possible: every camera has `allowHDR = false`, and the asset Android draws with has HDR off | | dropped |
| Store Actions Optimization | obsolete in Unity 6 (the render graph sets every load and store; the property is a compile error from 6000.4) | | dropped |

- **The GPU Resident Drawer** was **on** on Android: every quality level, Android's "Mobile" too, draws with
  `PC_RPAsset` (Forward+, the drawer on); `Mobile_RPAsset`, the asset with HDR on and the drawer off, is used by none.
  Off, the main thread was shorter at 8 of the 9 views (the desert's camps 4.83 → 4.22 ms, the Qanat tree 4.12 → 3.42,
  the dunes 2.82 → 2.48, the spawn 4.55 → 4.08, the cave 2.76 → 2.56; the City-Shaft's crowds 5.11 → 4.91 and 6.08 →
  5.70, the wide view 6.95 → 6.80; its start 6.34 → 6.76), its p95 6.98 → 6.05 in the desert, the GPU the same to
  0.05 ms. Our shaders have no DOTS instancing, so the drawer drew nothing of ours; it only kept its books, as on the
  Xbox and the Deck. Now off on Android as there (BridgeRunner `Experiments`; `-grd` keeps it). The build with it
  (and the change below) against the old one, two more rounds: the desert's main thread 4.04 → 2.50 ms (median of views),
  its p95 7.33 → 6.83; the City-Shaft's 6.19 → 6.63 (one round of the old build there: an adb failure lost the other);
  the GPU and the frames the same.
- **LateUpdate's draws** (BridgeRenderer `DrawCrowds`) asked Unity whether each of the scene's few thousand nodes was
  active before looking for its footprints or GPU instances; most have neither, so the managed check goes first: 0.03-0.12
  ms less at 8 of 9 views on the Odin (0.05-0.16 in the Mac editor's batch run). The same nodes drawn.
- **The C# apply** is no longer the 2.1 ms of "A cheaper sync": 0.15-0.5 ms in the desert and 0.4-0.9 in the City-Shaft
  on the Odin, of which the nodes' transforms 0.02-0.15, the bones' Burst job 0.02-0.13, the cloth's and flames' points
  0.05-0.23, the GPU instances up to 0.32; LateUpdate's draws (0.3-1 ms) cost more than all of it. A Burst job for the
  nodes' transforms (a TransformAccessArray of the nodes that move, as the bones') was tried: 0.01-0.05 ms less at 7 views,
  more at the two stillest, so not kept.
- **Graphics jobs** (split threading) took 0.7-3 ms off the render thread, but the GPU took 0.6 ms longer in the desert
  and 4 in the City-Shaft, where the frame is the GPU's: its wide view 23.3 → 26.4 ms, p95 26.1 → 32.4. Off.
- **Static batching** (already on Android, "BridgeRenderer.StaticBatch") still pays: off, the GPU 0.2-0.7 ms longer and the
  desert's render thread 0.5 ms.
- Every picture against the old build's at the same view: the same within what the moving people and smoke change
  between two runs of one build (a mean difference of 0.01-3.8 of 255 a view, as between two runs of one build).

Not measured: the Retroid (the same Android path; its CPU is slower, so the drawer's cost is likely larger there), the Steam
Deck (not reachable; its player already has the drawer off), the Xbox (its player already has it off; graphics jobs on
D3D12 untried: the Xbox build is D3D11). The bench's Android player without Unity's audio
(`BridgeBuild.Android` as it is) no longer starts the game since the recorded effects became required (#622): "Sound
effects couldn't load", so the plan never runs; `-unity-audio` builds it with Unity's audio, which `-mute` silences.

### The Unity licence (the author, once)

GameCI activates a Unity seat for each editor run and returns it after. A **Personal** licence needs
two repository secrets (Settings ▸ Secrets and variables ▸ Actions, or `gh secret set NAME`):
- `UNITY_EMAIL`: the Unity account's email;
- `UNITY_PASSWORD`: its password.

The account must sign in without two-factor authentication (headless activation can't answer a
code): a Unity account kept for CI is the clean way. unity-builder v6 then activates a Personal seat
with Unity's licensing client (`--activate-all --include-personal`); a `.ulf` licence file is no longer
needed (Unity stopped issuing them for Personal, and Unity Hub 3 keeps an entitlement licence,
`~/Library/Unity/licenses/`, instead). **Unity Pro / Plus**: add `UNITY_SERIAL` (the serial from
id.unity.com ▸ Subscriptions) beside the two. The release key's secrets are the Android workflow's
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`). A missing secret fails the run's first job
in seconds, naming it. The runs take one seat at a time (the Linux job waits for the APK's). (Set up
on 2026-10-07 with `UNITY_EMAIL` and `UNITY_PASSWORD`: each editor run logs "Licensing method:
personal … ASSIGN_SEAT" and, at its end, "Successfully returned the entitlement license".)

Traps met on the way: `-version` on the editor's command line makes Unity print its version and
quit, building nothing (the version goes in as GameCI's `-buildVersion`); GameCI v6 fails a run whose
log does not say "Build succeeded!" (its own build script's words), so `BridgeBuild`'s entries log that
on success; and an Android build ignores the default icon: with its adaptive icons left empty it
draws Unity's cube, so `AndroidRelease` fills them (both layers: `public/icons/maskable-512.png`).

Costs: native builds run daily only when needed, or on request. The separate daily full test run never starts a native build.
