# The Unity port and the benchmark

The desert in Unity (a proof of concept) and the web-against-Unity benchmark. (The other way to
Unity, the web game's own JavaScript run in Unity by Puerts and drawn through this port's look:
docs/systems/engine-bridge.md, `unity/Memento/Assets/MementoJS/`.)

## The desert in Unity (a proof of concept)
`unity/Memento` is a Unity 6 (URP) port of the desert, built from this game rather than
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
  clips), conversations with tones and at most three answers, quests and the journal, the
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
  benchmark mode (`unity/Memento/Assets/Memento/Runtime/Bench.cs`).
- **Fair conditions**: the same pixels (device scale 1; High at render scale 1.0, Handheld at 0.75
  without dynamic resolution, URP the same), the presets mapped (the table in the report), the
  quiet-machine gate before and during every run (no Unity editor or job, no other automated
  browser or build, low load, AC power), runs alternating over three rounds, the paths again at
  60 Hz for the stutter.
- `mac-run.sh` runs it all and rewrites the report; `android-run.sh` does the handheld (the APK
  `com.rnaud.memento.unity` and the game in the device's Chrome, never the app `com.rnaud.moebius`).

## Building in GitHub Actions (the testers' builds)

The engine bridge's Unity player (docs/systems/engine-bridge.md, "Players"), built for testing on the
devices next to the players' builds, by `.github/workflows/unity-android.yml` on every push to `main`
that touches `unity/`, `engine/`, `src/`, `public/` or `scripts/unity-*` (and by hand: Actions ▸ Unity
release (testers) ▸ Run workflow):
- **Android** (`BridgeBuild.AndroidRelease`): package `com.rnaud.memento.unity`, named "Memento
  (Unity)", the game's icon (`public/icons/icon-512.png`), landscape, immersive, sound on (paused when
  left), the pads through the Input System; IL2CPP ARM64, Vulkan then GLES3; versionName the newest
  version in `src/changelog.js`, versionCode the commit count (`release-info.mjs build`); signed with the
  web app's release key (alias `moebius`), so it installs **next to** the app `com.rnaud.moebius`, never
  over it, and every build installs over the last. Published as `memento-unity.apk` on the release
  [`unity-android`](https://github.com/rnaud/moebius/releases/tag/unity-android).
- **Linux** (`BridgeBuild.Linux -mono`, the Steam Deck's: x86_64, Vulkan), after the APK, as
  `memento-unity-linux.tar.gz` on the release `unity-linux`.
- Both releases are prereleases and never "latest" (the app's updater and the players read the
  `vX.Y` releases); each build replaces its file, moves the tag to its commit and rewrites the notes
  (which commit, which web version: `release-info.mjs unity-notes`). `scripts/unity-publish.sh` does it.
- The steps: Puerts (`scripts/unity-js-setup.sh`, cached), the bundle (`node scripts/engine-bundle.mjs
  unity`), Unity's `Library` cached per platform, then GameCI's `game-ci/unity-builder@v6` in Unity's
  Linux editor image (6000.6.4f1, read from `ProjectVersion.txt`): one editor run for Puerts' IL2CPP
  glue (`BridgeBuild.Il2cpp`: it is C# too, compiled by the next start), one for the APK.
- **A local build** does the same from the Mac: `scripts/unity-android-release.sh` (the key from
  `.local-tools/android-signing/`, here or in the main checkout; it checks the APK is signed with the
  release certificate, then uploads to `unity-android`; `NO_UPLOAD=1` builds only, `CLEAN=1` deletes
  `Library/Bee` after). The commit has to be pushed first: the notes and the tag name it.
- The bench's own Android players stay apart and debug-signed: the bridge's `com.rnaud.memento.bridge`
  (`BridgeBuild.Android`) and the C# port's `BenchBuild.Android`, which also uses
  `com.rnaud.memento.unity`. Android refuses an APK signed by another key over an installed one: to put
  the C# port's bench APK on a device that has the testers' APK (or the other way round), uninstall
  `com.rnaud.memento.unity` first (that deletes its saves, never the web app's).

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
in seconds, naming it. The runs take one seat at a time (the Linux job waits for the APK's).

Costs: the repository is private, so the minutes count (an Android IL2CPP build is 30–60 min from a
cold `Library`, less from the cache; pushes to `main` that touch `src/` are frequent, and runs queue
one at a time). To build less often, narrow the workflow's `paths:` or drop `push:` and run it by hand.
