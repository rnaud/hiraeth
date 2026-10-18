#!/usr/bin/env python3
"""Hiraeth Steam Deck installer, background updater, and Steam integration.

Two kinds of update, both checked in the background at each launch:
- the game itself (content): the same web bundle the Android app takes, from the
  game's site (CONTENT_MANIFEST_URL, published by the Cloudflare deploy). It is
  verified, unpacked to web/<build>/ and served by the runtime from the next launch
  (desktop/main.mjs, HIRAETH_GAME), unless it needs a newer runtime (minDesktop).
- the runtime (Electron, main.mjs, this updater, a packaged copy of the game): from the
  game's site too (RUNTIME_SITE_URL, in parts: scripts/deck-runtime.mjs), else the
  steam-deck GitHub release; a package downloaded by hand installs with --from (docs/steam-deck.md).

And a third, its own component: the Unity bridge's Linux player (the unity-linux GitHub release),
unpacked to unity/<sha>/, with its own data folder. The "Hiraeth" shortcut only ever starts the Unity player
(issue #484), watched as Electron is: the player before it gets one try, and when none starts the launcher says so
in a dialog and returns to Steam, never to the web game. The second shortcut, "Hiraeth (web)" (--launch-web), is
the web runtime, started only by the player's own choice.

Standard-library only; no root, FUSE, Proton, or SteamOS system changes.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import signal
import struct
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile
import zlib

# The runtime package: the GitHub release (or by hand with --from), and the game's site
BASE_URL = 'https://github.com/rnaud/hiraeth/releases/download/steam-deck/'
MANIFEST_URL = BASE_URL + 'steam-deck.json'
# The game's content updates, next to the web game (scripts/web-update.mjs)
CONTENT_URL = 'https://hiraeth.alexandria-rnaud.workers.dev/updates/'
CONTENT_MANIFEST_URL = CONTENT_URL + 'web.json'
# ... and the runtime there, in parts (scripts/deck-runtime.mjs)
RUNTIME_SITE_URL = CONTENT_URL + 'steam-deck.json'
ROOT = Path.home() / '.local/share/hiraeth-deck'
MAX_ARCHIVE = 1024 * 1024 * 1024
MAX_CONTENT = 300 * 1024 * 1024
# The Unity preview's player: the asset of the unity-linux release, read from GitHub's API
UNITY_RELEASE_URL = 'https://api.github.com/repos/rnaud/hiraeth/releases/tags/unity-linux'
UNITY_ASSET = 'hiraeth-unity-linux.tar.gz'
UNITY_ASSET_URL = 'https://github.com/rnaud/hiraeth/releases/download/unity-linux/' + UNITY_ASSET
UNITY_PLAYER = 'hiraeth-js.x86_64'
# (the build's own leftovers, not for shipping: never unpacked)
UNITY_SKIP = ('_BackUpThisFolder_ButDontShipItWithYourGame', '_BurstDebugInformation_DoNotShip')
# The two Steam shortcuts, each known by its launcher (its Exe): the game, and the Unity preview
MAIN_NAME, UNITY_NAME = 'Hiraeth', 'Hiraeth (Unity)'
OLD_NAMES = (None, '')   # (a shortcut without a name gets the game's)
# (the preview's shortcut under the name it had, or none: renamed; a name the player chose stays. Until 1.73 both
#  shortcuts showed the game's icon and art, and the two were told apart only by "(Unity preview)")
OLD_UNITY_NAMES = (None, '', 'Hiraeth (Unity preview)')
# The preview's own icon, beside the game's (write_launchers: the runtime's steam/unity/icon.png, a Unity badge on it)
UNITY_ICON = 'icon-unity.png'
# Which engine the "Hiraeth" shortcut starts (docs/steam-deck.md, "The engine"): unity, always, since issue #484. No
# setting, no remote switch and no fallback put it on the web: an engine.json from before (--engine web) is ignored.
# The engine still names the second shortcut's layout (second_shortcut): 'web' only for installs from before the switch
# (D19, their Unity preview shortcut, swapped into "Hiraeth (web)" by the next update that finds Steam closed).
ENGINES = ('web', 'unity')
DEFAULT_ENGINE = 'unity'
# ... and once it is unity, the second shortcut starts the web runtime: its launcher, name and WEB-badged icon
WEB_NAME = 'Hiraeth (web)'
WEB_ICON = 'icon-web.png'
# (the names the second shortcut has had: one of them is ours to change when it swaps engines, any other the player's)
SECOND_NAMES = (*OLD_UNITY_NAMES, UNITY_NAME, WEB_NAME)
# The Unity player's watched start: no first frame by then is a failed start (its load on the Deck builds the whole
# world before the first frame: ~25 s measured; the pipeline cache cold after a reboot adds to it)
UNITY_READY_SECONDS = 120
# Steam's Exit Game (issue #438): the player ends itself within 2 s of the signal (BridgeQuit.cs: its saves written, then
# an alarm ends it if its shutdown is still going); killed, with anything it started, if it is still there after this
UNITY_STOP_SECONDS = 4
# What says the player is up: the file it touches after its first frame (-ready, BridgeRunner.MarkReady), or, for
# players from before -ready, these lines of its log (the first script frame played)
UNITY_READY_MARKS = (b'Hiraeth bridge: ready', b'Hiraeth bridge: script frame 1 took')


def atomic_write(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def parse_vdf(data):
    """Keep ordered fields, arbitrary string bytes and unknown field names.

    Unsupported binary types fail closed: never repair or discard user data.
    """
    offset = 0

    def string():
        nonlocal offset
        end = data.index(b'\0', offset)
        value = data[offset:end].decode('utf-8', errors='surrogateescape')
        offset = end + 1
        return value

    def tree(depth=0):
        nonlocal offset
        if depth > 32:
            raise ValueError('VDF nesting is too deep')
        result = []
        while True:
            kind = data[offset]
            offset += 1
            if kind == 8:
                return result
            key = string()
            if kind == 0:
                value = tree(depth + 1)
            elif kind == 1:
                value = string()
            elif kind == 2:
                value, = struct.unpack_from('<I', data, offset)
                offset += 4
            else:
                raise ValueError(f'Unsupported VDF type {kind}; shortcuts unchanged')
            result.append((key, value))

    try:
        result = tree()
        if offset != len(data):
            raise ValueError('Trailing VDF data')
        return result
    except (IndexError, struct.error) as error:
        raise ValueError('Truncated VDF; shortcuts unchanged') from error


def encode_vdf(tree):
    def string(text):
        return text.encode('utf-8', errors='surrogateescape') + b'\0'
    result = bytearray()
    for key, value in tree:
        kind = 0 if isinstance(value, list) else 1 if isinstance(value, str) else 2
        result.extend(bytes([kind]) + string(key))
        result.extend(encode_vdf(value) if kind == 0 else string(value) if kind == 1 else struct.pack('<I', value))
    return bytes(result) + b'\x08'


def field(tree, key):
    return next((value for name, value in tree if name.lower() == key.lower()), None)


def steam_running():
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            if proc.stat().st_uid == os.getuid() and (proc / 'comm').read_text().strip() == 'steam':
                return True
        except (OSError, UnicodeError):
            continue
    return False


def steam_configs(home):
    roots = [home / '.local/share/Steam', home / '.steam/steam', home / '.steam/root',
             home / '.var/app/com.valvesoftware.Steam/.local/share/Steam']
    return sorted({p.resolve() for root in roots for p in (root / 'userdata').glob('*/config')
                   if p.parent.name.isdigit() and p.parent.name != '0' and p.is_dir()})


def shortcut_exe(root, launcher='launch'):
    """A shortcut's identity: its stable executable (launch: the game; launch-unity: the Unity preview)."""
    return f'"{root / launcher}"'


def our_entries(entries, exe):
    return [value for _, value in (entries if isinstance(entries, list) else [])
            if isinstance(value, list) and field(value, 'exe') == exe]


def second_shortcut(engine):
    """The shortcut beside "Hiraeth": the engine it doesn't start. (its launcher, name, icon, and the launcher it
    replaces: one shortcut that swaps its Exe when the engine changes, keeping its app id, playtime and art's place)"""
    if engine == 'unity':
        return 'launch-web', WEB_NAME, WEB_ICON, 'launch-unity'
    return 'launch-unity', UNITY_NAME, UNITY_ICON, 'launch-web'


def add_shortcut(config, root, preview=True, engine=None):
    """The game's shortcut and the second one (second_shortcut: the Unity preview while the engine is web,
    "Hiraeth (web)" once it is unity) in one account's shortcuts.vdf (one write, backed up first).
    preview: add the second when the account lacks it (the background update offers it once per account
    and engine, so one the player removed stays removed). @return whether the file changed"""
    if steam_running():
        raise RuntimeError('Exit Steam completely before adding the shortcut, then run the installer again.')
    path = config / 'shortcuts.vdf'
    original = path.read_bytes() if path.exists() else None
    document = parse_vdf(original) if original else [('shortcuts', [])]
    entries = field(document, 'shortcuts')
    if not isinstance(entries, list):
        raise ValueError('Missing shortcuts map; Steam files unchanged')
    icon = str(root / 'icon.png')
    # Identity is the stable executable, not the display name. Keep user edits, but a shortcut
    # without a name or an icon gets the game's.
    changed = False
    ours = our_entries(entries, shortcut_exe(root))
    for entry in ours:
        changed |= set_field(entry, 'AppName', MAIN_NAME, lambda name: name in OLD_NAMES)
        changed |= set_field(entry, 'icon', icon, lambda icon: not icon)
    if not ours:
        add_entry(entries, shortcut_exe(root), root, MAIN_NAME, shortcut_appid(root))
        changed = True
    launcher, name, icon_name, swapped = second_shortcut(engine or engine_setting(root))
    second_icon = str(root / icon_name)
    # the engine changed: the other engine's shortcut becomes this one (its id, playtime and place kept); a name
    # or icon of ours follows, one the player gave it stays
    ours_icons = ('', icon, str(root / UNITY_ICON), str(root / WEB_ICON))
    for entry in our_entries(entries, shortcut_exe(root, swapped)):
        set_field(entry, 'Exe', shortcut_exe(root, launcher), lambda _old: True)
        set_field(entry, 'AppName', name, lambda old: old in SECOND_NAMES)
        set_field(entry, 'icon', second_icon, lambda old: old in ours_icons)
        changed = True
    seconds = our_entries(entries, shortcut_exe(root, launcher))
    old_names = OLD_UNITY_NAMES if launcher == 'launch-unity' else OLD_NAMES
    for entry in seconds:
        changed |= set_field(entry, 'AppName', name, lambda old: old in old_names)
        changed |= set_field(entry, 'icon', second_icon, lambda old: not old or old == icon)
    if not seconds and preview:
        appid = unity_appid(root) if launcher == 'launch-unity' else web_appid(root)
        add_entry(entries, shortcut_exe(root, launcher), root, name, appid, icon_name)
        changed = True
    if not changed:
        return False
    # Check again immediately before writing; don't overwrite intervening edits.
    if steam_running() or (path.read_bytes() if path.exists() else None) != original:
        raise RuntimeError('Steam shortcuts changed during installation; please retry with Steam closed.')
    if original is not None:
        backup = config / f'shortcuts.vdf.hiraeth-{time.time_ns()}.bak'
        atomic_write(backup, original)
    atomic_write(path, encode_vdf(document))
    return True


def set_field(entry, key, value, replace):
    """Set a shortcut's field (matched as Steam does, whatever its case) when replace(its value)."""
    for i, (name, old) in enumerate(entry):
        if name.lower() == key.lower():
            if isinstance(old, str) and replace(old) and old != value:
                entry[i] = (name, value)
                return True
            return False
    entry.append((key, value))
    return True


def add_entry(entries, exe, root, name, appid, icon='icon.png'):
    entries.append((str(len(entries)), [
        ('appid', appid), ('AppName', name), ('Exe', exe),
        ('StartDir', f'"{root}"'), ('icon', str(root / icon)),
        ('ShortcutPath', ''), ('LaunchOptions', ''), ('IsHidden', 0),
        ('AllowDesktopConfig', 1), ('AllowOverlay', 1), ('OpenVR', 0),
        ('Devkit', 0), ('DevkitGameID', ''), ('LastPlayTime', 0), ('tags', []),
    ]))
    entries[:] = [(str(i), value) for i, (_, value) in enumerate(entries)]


def shortcut_stale(config, root, preview=True, engine=None):
    """Whether this account lacks our shortcut, or has it under the old name or without an icon; or has the
    other engine's second shortcut (to swap); or (preview) lacks the second (second_shortcut), or has it under
    its old name (or none) or the game's icon (or none)."""
    try:
        entries = field(parse_vdf((config / 'shortcuts.vdf').read_bytes()), 'shortcuts')
    except (OSError, ValueError):
        return True
    launcher, _name, _icon, swapped = second_shortcut(engine or engine_setting(root))
    old_names = OLD_UNITY_NAMES if launcher == 'launch-unity' else OLD_NAMES
    ours = our_entries(entries, shortcut_exe(root))
    seconds = our_entries(entries, shortcut_exe(root, launcher))
    return (not ours or any(field(value, 'AppName') in OLD_NAMES or not field(value, 'icon') for value in ours)
            or bool(our_entries(entries, shortcut_exe(root, swapped)))
            or (preview and not seconds)
            or any(field(value, 'AppName') in old_names or field(value, 'icon') in (None, '', str(root / 'icon.png')) for value in seconds))


def fetch_manifest(url):
    request = urllib.request.Request(f'{url}?t={time.time_ns()}', headers={'User-Agent': 'Hiraeth-Updater', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(65537)
    if len(data) > 65536:
        raise ValueError('Manifest is too large')
    manifest = json.loads(data)
    validate_manifest(manifest)
    return manifest


def get_manifest(fetch=fetch_manifest):
    """The newest runtime of the two feeds: the game's site and the GitHub release (a 404 while the
    repository is private). Raises only when neither answers."""
    found, errors = [], []
    for url in (RUNTIME_SITE_URL, MANIFEST_URL):
        try:
            found.append(fetch(url))
        except Exception as error:
            errors.append(f'{url}: {error}')
    if not found:
        raise ValueError('; '.join(errors))
    return max(found, key=lambda manifest: manifest['build'])


def validate_manifest(manifest):
    build = manifest.get('build')
    if type(build) is not int or build < 1:
        raise ValueError('Invalid release build number')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest.get('sha256', '')):
        raise ValueError('Invalid release checksum')
    if 'parts' in manifest:
        # the game's site: the package in parts, steam-deck-<build>.tar.gz.000, .001…
        parts, size = manifest['parts'], manifest.get('size')
        if (not isinstance(parts, list) or not 0 < len(parts) <= 100
                or parts != [CONTENT_URL + f'steam-deck-{build}.tar.gz.{i:03d}' for i in range(len(parts))]):
            raise ValueError('Unexpected release parts')
        if type(size) is not int or not 0 < size <= MAX_ARCHIVE:
            raise ValueError('Invalid release size')
    elif manifest.get('url') != BASE_URL + f'hiraeth-steam-deck-{build}.tar.gz':
        raise ValueError('Unexpected release URL')
    if not isinstance(manifest.get('version'), str):
        raise ValueError('Missing release version')


PROGRESS = None   # a file the settings follow a download in (--progress; desktop/deck-updates.mjs)


def progress(step, got, total, done=False):
    """{step, got, total} for the settings' progress bar, at most four times a second."""
    if PROGRESS is None:
        return
    now = time.monotonic()
    if not done and now - getattr(progress, 'last', 0) < 0.25:
        return
    progress.last = now
    try:
        atomic_write(PROGRESS, json.dumps({'step': step, 'got': got, 'total': total or 0}).encode())
    except OSError:
        pass


def download(manifest, destination, step='runtime', seconds=900):
    digest, size = hashlib.sha256(), 0
    deadline = time.monotonic() + seconds
    with destination.open('wb') as output:
        for url in manifest.get('parts') or [manifest['url']]:
            request = urllib.request.Request(url, headers={'User-Agent': 'Hiraeth-Updater'})
            with urllib.request.urlopen(request, timeout=30) as response:
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_ARCHIVE or time.monotonic() > deadline:
                        raise ValueError('Download exceeded its size or time limit')
                    progress(step, size, manifest.get('size'))
                    digest.update(chunk)
                    output.write(chunk)
    if 'size' in manifest and size != manifest['size']:
        raise ValueError('Download size mismatch; installed game unchanged')
    if digest.hexdigest() != manifest['sha256']:
        raise ValueError('Download checksum mismatch; installed game unchanged')


def extract(archive, destination, skip=()):
    """skip: entries under a folder whose name ends so are left out (checked all the same)."""
    with tarfile.open(archive, 'r:gz') as bundle:
        members = bundle.getmembers()
        if sum(member.size for member in members) > 3 * MAX_ARCHIVE:
            raise ValueError('Archive is too large')
        base = destination.resolve()
        for member in members:
            target = (base / member.name).resolve()
            if not target.is_relative_to(base) or not (member.isfile() or member.isdir()):
                raise ValueError('Unsafe archive entry')
        # Only regular files/directories; no symlinks, devices, ownership, or setuid.
        for member in members:
            if skip and any(part.endswith(skip) for part in Path(member.name).parts):
                continue
            target = base / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, target.open('wb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(0o755 if member.mode & 0o111 else 0o644)


def installed_build(root):
    try:
        return json.loads((root / 'current/resources/app/build.json').read_text())['build']
    except (OSError, ValueError, KeyError):
        return -1


def prune_versions(root):
    """Keep the newest two builds and any build currently used by a game."""
    versions = sorted((p for p in (root / 'versions').iterdir() if p.name.isdigit()),
                      key=lambda p: int(p.name), reverse=True)
    current = (root / 'current').resolve()
    for version in versions[2:]:
        if version == current:
            continue
        with (version / '.in-use').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue
            shutil.rmtree(version)


def install_update(root, manifest, downloader=download):
    validate_manifest(manifest)
    root.mkdir(parents=True, exist_ok=True)
    # Prevent simultaneous launches/installers from racing a download or symlink.
    with (root / 'update.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        if manifest['build'] <= installed_build(root):
            return False
        versions = root / 'versions'
        versions.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=versions, prefix='.download-') as temporary:
            staging = Path(temporary)
            archive = staging / 'game.tar.gz'
            downloader(manifest, archive)
            # Check here too, so every installation path verifies the artifact.
            digest = hashlib.sha256()
            with archive.open('rb') as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
            if digest.hexdigest() != manifest['sha256']:
                raise ValueError('Download checksum mismatch')
            content = staging / 'game'
            content.mkdir()
            extract(archive, content)
            required = ['hiraeth', 'resources/app/deck.py', 'resources/app/main.mjs',
                        'resources/app/game/index.html', 'resources/app/game/icons/icon-512.png']
            if any(not (content / name).is_file() for name in required):
                raise ValueError('Incomplete game bundle')
            metadata = json.loads((content / 'resources/app/build.json').read_text())
            if metadata != {'build': manifest['build'], 'version': manifest['version']}:
                raise ValueError('Bundle metadata does not match release')
            with (root / 'state.lock').open('a') as state:
                fcntl.flock(state, fcntl.LOCK_EX)
                destination = versions / str(manifest['build'])
                # Recover an interrupted activation using freshly verified files.
                if destination.exists():
                    shutil.rmtree(destination)
                content.rename(destination)
                link = root / '.current-new'
                link.unlink(missing_ok=True)
                link.symlink_to(destination, target_is_directory=True)
                link.replace(root / 'current')
                try:
                    prune_versions(root)
                except OSError as error:
                    print(f'Update installed, but old-build cleanup failed: {error}', file=sys.stderr)
        return True


# ---------------------------------------------------------------- content updates (the game itself)

def get_content_manifest():
    url = f'{CONTENT_MANIFEST_URL}?t={time.time_ns()}'   # past every cache
    request = urllib.request.Request(url, headers={'User-Agent': 'Hiraeth-Updater', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(65537)
    if len(data) > 65536:
        raise ValueError('Content manifest is too large')
    manifest = json.loads(data)
    validate_content_manifest(manifest)
    return manifest


def validate_content_manifest(manifest):
    build = manifest.get('build')
    if type(build) is not int or build < 1:
        raise ValueError('Invalid content build number')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest.get('sha256', '')):
        raise ValueError('Invalid content checksum')
    if manifest.get('zip') != CONTENT_URL + f'web-{build}.zip':
        raise ValueError('Unexpected content URL')
    if not isinstance(manifest.get('version'), str):
        raise ValueError('Missing content version')
    if type(manifest.get('minDesktop')) is not int or manifest['minDesktop'] < 1:
        raise ValueError('Missing the runtime level the content needs')
    size = manifest.get('size')
    if type(size) is not int or not 0 < size <= MAX_CONTENT:
        raise ValueError('Invalid content size')


def download_content(manifest, destination):
    request = urllib.request.Request(manifest['zip'], headers={'User-Agent': 'Hiraeth-Updater'})
    digest, size = hashlib.sha256(), 0
    deadline = time.monotonic() + 600
    with urllib.request.urlopen(request, timeout=30) as response, destination.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_CONTENT or time.monotonic() > deadline:
                raise ValueError('Content download exceeded its size or time limit')
            progress('game', size, manifest.get('size'))
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != manifest['sha256']:
        raise ValueError('Content checksum mismatch; installed game unchanged')


def extract_zip(archive, destination):
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        if sum(member.file_size for member in members) > 3 * MAX_CONTENT:
            raise ValueError('Content is too large')
        base = destination.resolve()
        for member in members:
            kind = (member.external_attr >> 16) & 0o170000
            target = (base / member.filename).resolve()
            if (member.filename.startswith('/') or '\\' in member.filename or not target.is_relative_to(base)
                    or kind not in (0, 0o100000, 0o040000)):
                raise ValueError('Unsafe content entry')
        # Only regular files/directories; no symlinks, devices, or modes from the archive.
        for member in members:
            target = base / member.filename
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with bundle.open(member) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)
            target.chmod(0o644)


def runtime_content(current):
    """What a runtime carries: {'web': its game's build, 'desktop': its DESKTOP_API}. Runtimes from
    before content updates have no content.json, and take none."""
    try:
        data = json.loads((current / 'resources/app/content.json').read_text())
        if type(data.get('web')) is int and type(data.get('desktop')) is int:
            return data
    except (OSError, ValueError, AttributeError):
        pass
    return {'web': 0, 'desktop': 0}


def content_builds(root):
    """The unpacked games: {build: path} (bundle.json is written before a folder is renamed in)."""
    builds = {}
    for path in (root / 'web').glob('[0-9]*'):
        if path.name.isdigit() and (path / 'bundle.json').is_file() and (path / 'index.html').is_file():
            builds[int(path.name)] = path
    return builds


def choose_content(root, current):
    """The newest downloaded game this runtime can run and that never failed to start, when it is
    newer than the runtime's own copy; else None (the runtime serves its packaged game)."""
    carried = runtime_content(current)
    for build, path in sorted(content_builds(root).items(), reverse=True):
        if build <= carried['web']:
            break
        try:
            need = json.loads((path / 'bundle.json').read_text()).get('minDesktop')
        except (OSError, ValueError, AttributeError):
            continue
        if (path / '.failed').exists() or type(need) is not int or need > carried['desktop']:
            continue
        return path
    return None


def without_overlay(preload):
    """LD_PRELOAD without Steam's overlay (gameoverlayrenderer.so, which Steam preloads into every
    game): on SteamOS 3.8 it crashes Chromium's zygote as it starts, so the window never opens, Gaming
    Mode stays black, and the browser waits for ever. Gaming Mode draws Steam's overlay itself."""
    kept = [lib for lib in re.split(r'[: ]+', preload or '') if lib and Path(lib).name != 'gameoverlayrenderer.so']
    return ':'.join(kept)


def game_env(game, gpu=None, ready=None, base=None):
    """Electron's environment: HIRAETH_GAME names the downloaded game to serve, HIRAETH_GPU the way
    to draw (GPU_MODES), HIRAETH_READY the file it touches once its window is up (desktop/main.mjs)."""
    env = {key: value for key, value in (os.environ if base is None else base).items()
           if key not in ('HIRAETH_GAME', 'HIRAETH_GPU', 'HIRAETH_READY', 'LD_PRELOAD')}
    preload = without_overlay((os.environ if base is None else base).get('LD_PRELOAD'))
    if preload:
        env['LD_PRELOAD'] = preload
    if game:
        env['HIRAETH_GAME'] = str(game)
    if gpu:
        env['HIRAETH_GPU'] = gpu
    if ready:
        env['HIRAETH_READY'] = str(ready)
    return env


def prune_content(root, keep=2):
    """Keep the newest two games and any one in use."""
    for _, path in sorted(content_builds(root).items(), reverse=True)[keep:]:
        with (path / '.in-use').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue
            shutil.rmtree(path)


def install_content(root, manifest, downloader=download_content):
    """Download, verify and unpack a newer game for the next launch. @return whether one was added"""
    validate_content_manifest(manifest)
    current = (root / 'current').resolve(strict=True)
    carried = runtime_content(current)
    if manifest['minDesktop'] > carried['desktop']:
        print(f"Game build {manifest['build']} needs a newer Hiraeth runtime: install the new package.", flush=True)
        return False
    web = root / 'web'
    web.mkdir(parents=True, exist_ok=True)
    with (web / 'update.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        if manifest['build'] <= max([carried['web'], *content_builds(root)]) or (web / str(manifest['build'])).exists():
            return False   # (not newer, or already here: one that failed to start is not taken again)
        with tempfile.TemporaryDirectory(dir=web, prefix='.download-') as temporary:
            staging = Path(temporary)
            archive = staging / 'web.zip'
            downloader(manifest, archive)
            # Check here too, so every path verifies the download.
            digest = hashlib.sha256()
            with archive.open('rb') as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
            if digest.hexdigest() != manifest['sha256']:
                raise ValueError('Content checksum mismatch')
            content = staging / 'game'
            content.mkdir()
            extract_zip(archive, content)
            if not (content / 'index.html').is_file():
                raise ValueError('Incomplete game content')
            fields = ('build', 'version', 'minDesktop', 'sha256')
            atomic_write(content / 'bundle.json', json.dumps({key: manifest[key] for key in fields}).encode())
            with (root / 'state.lock').open('a') as state:
                fcntl.flock(state, fcntl.LOCK_EX)
                content.rename(web / str(manifest['build']))
                try:
                    prune_content(root)
                except OSError as error:
                    print(f'Game update added, but old-build cleanup failed: {error}', file=sys.stderr)
        return True


def content_update(root):
    """The background update's game step (web.json's game; its deckEngine kill switch is gone, issue #484)."""
    return install_content(root, get_content_manifest())


# ---------------------------------------------------------------- the engine: unity

def engine_setting(root):
    """The engine the "Hiraeth" shortcut starts: DEFAULT_ENGINE, unity (issue #484: an engine.json asking for the web,
    written by the --engine of earlier runtimes, no longer counts; the file is left as it was)."""
    return DEFAULT_ENGINE


def choose_engine(root):
    """What the "Hiraeth" shortcut starts: the Unity player, whatever engine.json or web.json say. @return (engine, why)"""
    return 'unity', 'the Steam Deck runs the Unity player'


# ---------------------------------------------------------------- the Unity preview's player

def get_unity_manifest():
    """The unity-linux release's player, from GitHub's API: {url, size, sha256} (its asset's digest)."""
    request = urllib.request.Request(UNITY_RELEASE_URL, headers={
        'User-Agent': 'Hiraeth-Updater', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=10) as response:
        data = response.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise ValueError('Unity release is too large')
    return unity_manifest(json.loads(data))


def unity_manifest(release):
    asset = next((asset for asset in (release.get('assets') or []) if isinstance(asset, dict)
                  and asset.get('name') == UNITY_ASSET), None)
    if asset is None:
        raise ValueError(f'No {UNITY_ASSET} on the unity-linux release')
    digest = asset.get('digest') or ''
    manifest = {'url': asset.get('browser_download_url'), 'size': asset.get('size'),
                'sha256': digest[len('sha256:'):] if digest.startswith('sha256:') else ''}
    validate_unity_manifest(manifest)
    return manifest


def validate_unity_manifest(manifest):
    if manifest.get('url') != UNITY_ASSET_URL:
        raise ValueError('Unexpected Unity player URL')
    if type(manifest.get('size')) is not int or not 0 < manifest['size'] <= MAX_ARCHIVE:
        raise ValueError('Invalid Unity player size')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest.get('sha256') or ''):
        raise ValueError('Invalid Unity player checksum')


def download_unity(manifest, destination):
    download(manifest, destination, step='unity', seconds=1800)


def unity_installed(root):
    """The installed player's {sha256, size, installedAt} (unity/current/unity.json), or None."""
    try:
        current = (root / 'unity/current').resolve(strict=True)
        data = json.loads((current / 'unity.json').read_text())
        if (current / UNITY_PLAYER).is_file() and isinstance(data.get('sha256'), str):
            return data
    except (OSError, ValueError, AttributeError):
        pass
    return None


def prune_unity(root, keep=2):
    """Keep the current player and the one before it, and any one in use (a running preview pins it)."""
    unity = root / 'unity'
    current = (unity / 'current').resolve()

    def installed_at(path):
        try:
            return json.loads((path / 'unity.json').read_text()).get('installedAt', 0)
        except (OSError, ValueError, AttributeError):
            return 0
    players = sorted((path for path in unity.iterdir() if re.fullmatch(r'[0-9a-f]{12}', path.name) and path.is_dir()),
                     key=lambda path: (path == current, installed_at(path)), reverse=True)
    for path in players[keep:]:
        if path == current:
            continue
        with (path / '.in-use').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                continue
            shutil.rmtree(path)


def install_unity(root, manifest, downloader=download_unity):
    """Download, verify and unpack the unity-linux player when its digest differs from the installed
    one, then point unity/current at it. @return whether one was installed"""
    validate_unity_manifest(manifest)
    unity = root / 'unity'
    unity.mkdir(parents=True, exist_ok=True)
    with (unity / 'update.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return False
        if (unity_installed(root) or {}).get('sha256') == manifest['sha256']:
            return False
        destination = unity / manifest['sha256'][:12]
        with tempfile.TemporaryDirectory(dir=unity, prefix='.download-') as temporary:
            staging = Path(temporary)
            archive = staging / 'player.tar.gz'
            downloader(manifest, archive)
            # Check here too, so every path verifies the download.
            digest, size = hashlib.sha256(), 0
            with archive.open('rb') as stream:
                while chunk := stream.read(1024 * 1024):
                    digest.update(chunk)
                    size += len(chunk)
            if size != manifest['size']:
                raise ValueError('Unity player size mismatch; installed player unchanged')
            if digest.hexdigest() != manifest['sha256']:
                raise ValueError('Unity player checksum mismatch; installed player unchanged')
            content = staging / 'player'
            content.mkdir()
            extract(archive, content, skip=UNITY_SKIP)
            archive.unlink()
            # the player at the archive's top, or in its one folder (the workflow's bridge-linux/)
            if not (content / UNITY_PLAYER).is_file():
                inner = [path for path in content.iterdir() if path.is_dir()]
                if len(inner) != 1 or not (inner[0] / UNITY_PLAYER).is_file():
                    raise ValueError('Incomplete Unity player')
                content = inner[0]
            (content / UNITY_PLAYER).chmod(0o755)
            atomic_write(content / 'unity.json', json.dumps({
                'sha256': manifest['sha256'], 'size': manifest['size'], 'installedAt': time.time()}).encode())
            with (unity / 'state.lock').open('a') as state:
                fcntl.flock(state, fcntl.LOCK_EX)
                if destination.exists():
                    # (an earlier player again, or an interrupted activation: the fresh files replace it,
                    # unless a preview still runs it)
                    with (destination / '.in-use').open('a') as pin:
                        try:
                            fcntl.flock(pin, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        except BlockingIOError:
                            raise ValueError('That Unity player is running; it updates next time') from None
                        shutil.rmtree(destination)
                content.rename(destination)
                link = unity / '.current-new'
                link.unlink(missing_ok=True)
                link.symlink_to(destination.name, target_is_directory=True)
                link.replace(unity / 'current')
                try:
                    prune_unity(root)
                except OSError as error:
                    print(f'Unity player installed, but old-player cleanup failed: {error}', file=sys.stderr)
        return True


def update_unity(root):
    return install_unity(root, get_unity_manifest())


# ---------------------------------------------------------------- Steam's library artwork

# Steam's names in an account's config/grid/, after the shortcut's app id → the runtime's files
# (resources/app/; scripts/steam-art.mjs makes them): the portrait capsule, the wide one, the hero,
# the logo laid over it, the icon.
STEAM_ART = {'p.png': 'steam/portrait.png', '.png': 'steam/wide.png', '_hero.png': 'steam/hero.png',
             '_logo.png': 'steam/logo.png', '_icon.png': 'game/icons/icon-512.png'}
# ... and the Unity preview's: the same with a Unity badge (scripts/steam-art.mjs unity), the game's where a runtime
# has none yet
UNITY_ART = {'p.png': 'steam/unity/portrait.png', '.png': 'steam/unity/wide.png', '_hero.png': 'steam/unity/hero.png',
             '_logo.png': 'steam/unity/logo.png', '_icon.png': 'steam/unity/icon.png'}
# ... and "Hiraeth (web)"'s, once the engine is unity: a WEB badge (scripts/steam-art.mjs web)
WEB_ART = {'p.png': 'steam/web/portrait.png', '.png': 'steam/web/wide.png', '_hero.png': 'steam/web/hero.png',
           '_logo.png': 'steam/web/logo.png', '_icon.png': 'steam/web/icon.png'}


def shortcut_appid(root):
    """The app id Steam gives our shortcut (add_shortcut writes it; Steam names its artwork after it),
    from its launcher and the game's name: the id stays stable."""
    return zlib.crc32((f'"{root / "launch"}"' + MAIN_NAME).encode()) | 0x80000000


def unity_appid(root):
    """The Unity preview's: Steam's scheme too, from its own launcher and name (never the game's id)."""
    return zlib.crc32((shortcut_exe(root, 'launch-unity') + UNITY_NAME).encode()) | 0x80000000


def web_appid(root):
    """A new "Hiraeth (web)"'s (an account that had no Unity preview to swap): from its own launcher and name."""
    return zlib.crc32((shortcut_exe(root, 'launch-web') + WEB_NAME).encode()) | 0x80000000


def shortcut_appids(config, root, launchers=('launch', 'launch-unity', 'launch-web')):
    """Our shortcuts' app ids in one account, read from its shortcuts.vdf (by their stable executables)."""
    try:
        document = parse_vdf((config / 'shortcuts.vdf').read_bytes())
    except (OSError, ValueError):
        return []
    entries = field(document, 'shortcuts')
    return [field(value, 'appid') for launcher in launchers for value in our_entries(entries, shortcut_exe(root, launcher))
            if type(field(value, 'appid')) is int]


def install_art(root, configs, app=None):
    """Steam's library artwork for our shortcuts (the Unity preview's own, badged: UNITY_ART), in each account's
    config/grid/: files only, never
    shortcuts.vdf, so it is safe while Steam runs (it shows them once it restarts). Artwork the player
    chose in Steam (a file there that isn't one we wrote) is kept. @return how many files changed"""
    app = app or root / 'current/resources/app'
    record = root / 'steam-art.json'
    try:
        ours = set(json.loads(record.read_text()))
    except (OSError, ValueError, TypeError):
        ours = set()
    changed = 0
    for config in configs:
        targets = [(appid, STEAM_ART) for appid in shortcut_appids(config, root, ('launch',))]
        targets += [(appid, UNITY_ART) for appid in shortcut_appids(config, root, ('launch-unity',))]
        targets += [(appid, WEB_ART) for appid in shortcut_appids(config, root, ('launch-web',))]
        for appid, art in targets:
            for suffix, name in art.items():
                source = app / name
                if not source.is_file():
                    source = app / STEAM_ART[suffix]   # (a runtime from before the preview's own art)
                if not source.is_file():
                    continue
                data = source.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                target = config / 'grid' / f'{appid}{suffix}'
                if target.exists():
                    there = hashlib.sha256(target.read_bytes()).hexdigest()
                    if there == digest or there not in ours:
                        continue
                ours.add(digest)
                atomic_write(target, data)
                changed += 1
    if changed:
        atomic_write(record, json.dumps(sorted(ours)).encode())
    return changed


# ---------------------------------------------------------------- the settings' Updates section

def local_state(root):
    """What the next launch would run (desktop/deck-updates.mjs compares it with what runs): the
    installed runtime, and the game it would serve (a downloaded one choose_content picks, else the
    runtime's own)."""
    current = (root / 'current').resolve(strict=True)
    carried = runtime_content(current)
    try:
        version = json.loads((current / 'resources/app/build.json').read_text()).get('version', '')
    except (OSError, ValueError, AttributeError):
        version = ''
    state = {'runtime': installed_build(root), 'runtimeVersion': version, 'desktop': carried['desktop'],
             'nextWeb': carried['web'], 'nextVersion': version}
    # the Unity preview's player, its sha256's first 12 ('' before one is installed; the panel ignores it)
    state['unity'] = ((unity_installed(root) or {}).get('sha256') or '')[:12]
    # the engine the next launch starts (choose_engine): unity, always
    state['engine'], state['engineSetting'] = choose_engine(root)[0], engine_setting(root)
    game = choose_content(root, current)
    if game:
        try:
            bundle = json.loads((game / 'bundle.json').read_text())
            state['nextWeb'], state['nextVersion'] = bundle['build'], bundle.get('version', '')
        except (OSError, ValueError, KeyError):
            pass
    return state


def offline(error):
    import urllib.error
    return isinstance(error, (OSError, urllib.error.URLError)) and not isinstance(error, urllib.error.HTTPError)


def status(root, content=None, runtime=None):
    """The settings' check: what is here, and the newest game and runtime on the feeds (no download)."""
    state = local_state(root)
    state['checkedAt'] = int(time.time() * 1000)
    try:
        game = (content or get_content_manifest)()
        state['game'] = {key: game.get(key) for key in ('build', 'version', 'size', 'minDesktop', 'notes')}
    except Exception as error:
        state['gameError'], state['offline'] = str(error), offline(error)
    try:
        feed = (runtime or get_manifest)()
        state['runtimeFeed'] = {key: feed.get(key) for key in ('build', 'version', 'size')}
    except Exception as error:
        state['runtimeError'] = str(error)   # (GitHub private, or offline: quiet)
    return state


def offered_file(root, engine=None):
    """Where the accounts given the second shortcut are kept: the Unity preview's (unity-shortcut.json) while the
    engine is web, "Hiraeth (web)"'s (web-shortcut.json) once it is unity, so each is offered once."""
    return root / ('web-shortcut.json' if (engine or engine_setting(root)) == 'unity' else 'unity-shortcut.json')


def preview_offered(root, engine=None):
    """The accounts (their config folders) the second shortcut was given to."""
    try:
        return set(json.loads(offered_file(root, engine).read_text()))
    except (OSError, ValueError, TypeError):
        return set()


def remember_preview(root, configs, engine=None):
    offered = preview_offered(root, engine)
    if not {str(config) for config in configs} <= offered:
        atomic_write(offered_file(root, engine), json.dumps(sorted(offered | {str(config) for config in configs})).encode())


def steam_entry(root, configs):
    """Our shortcuts' artwork and, while Steam is closed (it rewrites shortcuts.vdf from memory as it
    exits), in accounts that have the game's shortcut: its name and icon if it has the old name, and the
    Unity preview's shortcut, once (one the player removed stays removed; the installer adds it again).
    @return whether anything changed"""
    renamed = False
    if not steam_running():
        engine = engine_setting(root)
        offered, given = preview_offered(root, engine), []
        for config in configs:
            if not shortcut_appids(config, root, ('launch',)):
                continue
            preview = str(config) not in offered
            try:
                if shortcut_stale(config, root, preview, engine):
                    renamed |= add_shortcut(config, root, preview, engine)
            except (RuntimeError, ValueError, OSError):
                continue   # (Steam started meanwhile, or files we won't touch: next time)
            if preview:
                given.append(config)
        if given:
            remember_preview(root, given, engine)
    return install_art(root, configs) > 0 or renamed


def steam_refresh(root):
    """The background update's Steam step: the launchers (launch-unity is new to installs from before
    the preview), then steam_entry."""
    try:
        write_launchers(root)
    except OSError as error:
        print(f'launchers: not rewritten ({error})', file=sys.stderr, flush=True)
    return steam_entry(root, steam_configs(Path.home()))


def update_all(root, runtime=None, content=None, art=None, unity=None, with_unity=True):
    """The background update: the runtime, the game and the Unity preview's player separately, so one
    failing (a feed out of reach, or offline) never holds back the others; and Steam's shortcuts and
    artwork. with_unity: False for the settings' download (its bar covers the runtime and the game).
    @return what failed"""
    failures = []
    steps = [('runtime', runtime or (lambda: install_update(root, get_manifest()))),
             ('game', content or (lambda: content_update(root)))]
    if with_unity:
        steps.append(('unity', unity or (lambda: update_unity(root))))
    steps.append(('artwork', art or (lambda: steam_refresh(root))))
    for name, step in steps:
        try:
            changed = step()
            print(f'{name}: ' + ('update installed for the next launch.' if changed else 'up to date.'), flush=True)
        except Exception as error:
            print(f'{name}: no update ({error})', file=sys.stderr, flush=True)
            failures.append(name)
    return failures


# ---------------------------------------------------------------- the install from before the rename

# The Deck's install from before the game was renamed (moebius-deck, its feeds on memento's site, which is gone: frozen
# at its last build), with its own two shortcuts and desktop entries, the same names and icon as ours. Taken away on
# request (--remove-old-install), never by an update: its two Steam shortcuts (known by their launchers, as ours are)
# leave shortcuts.vdf, and their library artwork, its two desktop entries and its folder are moved into one backup
# folder with the shortcuts.vdf as it was (nothing deleted: removing the backup is the player's choice).
LEGACY_DIR = '.local/share/moebius-deck'
LEGACY_DESKTOP = ('moebius.desktop', 'moebius-unity.desktop')


def remove_old_install(root, home=None, configs=None, stamp=None):
    """The old install's shortcuts, art, desktop entries and folder, into a backup (only while Steam is closed: it
    rewrites shortcuts.vdf from memory as it exits). @return what was taken away and where the backup is"""
    home = home or Path.home()
    legacy = home / LEGACY_DIR
    if steam_running():
        raise RuntimeError('Exit Steam completely first (it rewrites its shortcuts as it exits), then run this again.')
    backup = root / f'removed-moebius-deck-{stamp or time.strftime("%Y%m%d-%H%M%S")}'
    report = {'backup': str(backup), 'shortcuts': [], 'art': [], 'desktop': [], 'folder': None}
    exes = {shortcut_exe(legacy), shortcut_exe(legacy, 'launch-unity')}

    def old(value):
        return isinstance(value, list) and field(value, 'exe') in exes

    for config in (steam_configs(home) if configs is None else configs):
        path = config / 'shortcuts.vdf'
        try:
            original = path.read_bytes()
            document = parse_vdf(original)
        except (OSError, ValueError):
            continue
        entries = field(document, 'shortcuts')
        if not isinstance(entries, list) or not any(old(value) for _, value in entries):
            continue
        account = backup / config.parent.name
        atomic_write(account / 'shortcuts.vdf', original)
        for _, value in entries:
            if not old(value):
                continue
            appid = field(value, 'appid')
            report['shortcuts'].append({'account': config.parent.name, 'name': field(value, 'AppName'), 'appid': appid, 'exe': field(value, 'exe')})
            if type(appid) is int:
                art = re.compile(rf'^{appid}(p|_hero|_logo|_icon)?\.(png|jpe?g|webp|ico)$')
                for file in sorted((config / 'grid').glob(f'{appid}*')):
                    if art.match(file.name):
                        (account / 'grid').mkdir(parents=True, exist_ok=True)
                        shutil.move(str(file), str(account / 'grid' / file.name))
                        report['art'].append(f'{config.parent.name}/grid/{file.name}')
        kept = [value for _, value in entries if not old(value)]
        entries[:] = [(str(i), value) for i, value in enumerate(kept)]
        # (checked again just before writing: Steam started, or the file changed meanwhile, and nothing is written)
        if steam_running() or path.read_bytes() != original:
            raise RuntimeError('Steam shortcuts changed meanwhile; nothing written for this account. Close Steam and run this again.')
        atomic_write(path, encode_vdf(document))
    applications = home / '.local/share/applications'
    for name in LEGACY_DESKTOP:
        entry = applications / name
        try:
            text = entry.read_text()
        except OSError:
            continue
        if str(legacy) in text:   # (only an entry that launches the old install)
            (backup / 'applications').mkdir(parents=True, exist_ok=True)
            shutil.move(str(entry), str(backup / 'applications' / name))
            report['desktop'].append(name)
    if legacy.is_dir() and not legacy.is_symlink():
        backup.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy), str(backup / 'moebius-deck'))
        report['folder'] = str(legacy)
    if any(report[key] for key in ('shortcuts', 'art', 'desktop', 'folder')):
        backup.mkdir(parents=True, exist_ok=True)
        atomic_write(backup / 'removed.json', json.dumps(report, indent=1).encode())
    return report


def local_package(directory):
    """A package downloaded by hand (gh release download steam-deck): its steam-deck.json and archive."""
    directory = Path(directory).expanduser()
    manifest = json.loads((directory / 'steam-deck.json').read_text())
    validate_manifest(manifest)
    archive = directory / f"hiraeth-steam-deck-{manifest['build']}.tar.gz"
    if not archive.is_file():
        raise ValueError(f'{archive.name} is not next to steam-deck.json in {directory}')
    return manifest, lambda _manifest, target: shutil.copyfile(archive, target)


def desktop_entry(name, command, icon):
    # Desktop Exec quoting is not shell quoting; escape its reserved characters.
    command = str(command).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    return f'[Desktop Entry]\nType=Application\nName={name}\nExec="{command}"\nIcon={icon}\nTerminal=false\nCategories=Game;\n'.encode()


def write_launchers(root, home=None, engine=None):
    """launch (the game's shortcut: the engine's), launch-unity (the Unity preview's) and launch-web (the web
    shortcut's), their icons, and the desktop entries of launch and of the second shortcut (second_shortcut)."""
    applications = (home or Path.home()) / '.local/share/applications'
    deck = shlex.quote(str(root / 'current/resources/app/deck.py'))
    app = root / 'current/resources/app'
    atomic_write(root / 'icon.png', (app / 'game/icons/icon-512.png').read_bytes())
    # (the second shortcut's own icons, a UNITY or WEB badge on the game's: the game's where a runtime has none yet)
    for icon, art in ((UNITY_ICON, UNITY_ART), (WEB_ICON, WEB_ART)):
        badged = app / art['_icon.png']
        atomic_write(root / icon, (badged if badged.is_file() else app / 'game/icons/icon-512.png').read_bytes())
    for launcher, flag in (('launch', '--launch'), ('launch-unity', '--launch-unity'), ('launch-web', '--launch-web')):
        # (every launcher, whatever the engine: a shortcut Steam hasn't swapped yet still starts)
        atomic_write(root / launcher, f'#!/bin/sh\nexec python3 {deck} {flag} "$@"\n'.encode(), 0o755)
    second, name, icon, swapped = second_shortcut(engine or engine_setting(root))
    entries = {'launch-unity': 'hiraeth-unity.desktop', 'launch-web': 'hiraeth-web.desktop'}
    atomic_write(applications / 'hiraeth.desktop', desktop_entry(MAIN_NAME, root / 'launch', root / 'icon.png'), 0o755)
    atomic_write(applications / entries[second], desktop_entry(name, root / second, root / icon), 0o755)
    (applications / entries[swapped]).unlink(missing_ok=True)


# ---------------------------------------------------------------- launching

# How Chromium draws, tried in turn while the game doesn't come up: the GPU as Electron picks it
# (ANGLE on OpenGL), ANGLE on Vulkan, then software. desktop/main.mjs reads HIRAETH_GPU.
GPU_MODES = ('gl', 'vulkan', 'software')
RETRY_EXIT = 75      # desktop/main.mjs: its GPU process keeps crashing, try the next mode
RESTART_EXIT = 76    # desktop/main.mjs: the settings' Restart now, into the update (launched again)
READY_SECONDS = 30   # no window by then: Electron hangs (a helper process died as it started)
STOP_SECONDS = 5     # Steam's Exit Game (a signal): this long to close, then killed with its helpers
PLAYED_SECONDS = 60  # a window up this long has drawn: a crash or kill after it is not the way to draw's fault


def session_kind(env):
    return 'gamescope' if env.get('GAMESCOPE_WAYLAND_DISPLAY') or env.get('XDG_CURRENT_DESKTOP') == 'gamescope' else 'desktop'


def signal_group(group, number):
    try:
        os.killpg(group, number)
    except (ProcessLookupError, PermissionError):
        pass


def group_alive(group):
    try:
        os.killpg(group, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def run_game(command, env, ready, ready_seconds=READY_SECONDS, stop_seconds=STOP_SECONDS, played_seconds=PLAYED_SECONDS, log=print,
             check=None, stop_signal=signal.SIGINT, cwd=None):
    """Electron (or the Unity player) in its own process group, watched until it ends; none of its processes
    outlives it (Steam counts the game running, a black screen in Gaming Mode, while any of them does).
    ready: the file it touches once its window is up; check: another way to tell (the player's log).
    @return (how, code, shown): how is 'quit' (it closed, or Steam closed it), 'retry' (it crashed
    soon, hung before its window showed, or asked for another way to draw) or 'ended' (it crashed or
    was killed after its window had been up played_seconds: the way to draw worked, so no other is
    tried; once a game killed after 9 h restarted on Vulkan and gpu.json kept that); shown, whether
    its window did"""
    ready.unlink(missing_ok=True)
    process = subprocess.Popen(command, env=env, start_new_session=True, cwd=cwd)
    stopping = []

    def up():
        return ready.exists() or bool(check and check())

    def stop(number, _frame):
        if not stopping:
            stopping.append(time.monotonic())
            log(f'Signal {number}: closing the game.')
        # (SIGINT to the browser alone: Chromium closes its helpers itself, at once and cleanly; the Unity
        # player is sent SIGTERM, as Steam would send it)
        try:
            os.kill(process.pid, stop_signal)
        except ProcessLookupError:
            pass
    handled = (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
    previous = {number: signal.signal(number, stop) for number in handled}
    started, shown, hung, code = time.monotonic(), False, False, None
    shown_at = None
    try:
        # (monotonic time stops while the Deck sleeps: a Deck put to sleep as the game starts doesn't count)
        while code is None:
            try:
                code = process.wait(timeout=0.25)
            except subprocess.TimeoutExpired:
                now = time.monotonic()
                shown = shown or up()
                if shown and shown_at is None:
                    shown_at = now
                    log(f'Up after {now - started:.1f} s.')
                if stopping and now - stopping[0] > stop_seconds:
                    signal_group(process.pid, signal.SIGKILL)
                elif not shown and not stopping and not hung and now - started > ready_seconds:
                    log(f'No window after {ready_seconds} s: the game hangs.')
                    hung = True
                    signal_group(process.pid, signal.SIGKILL)
        shown = shown or up()
        # its helpers end with it; one left behind (a zygote outliving the browser) is killed
        deadline = time.monotonic() + 2
        while group_alive(process.pid) and time.monotonic() < deadline:
            time.sleep(0.1)
    finally:
        signal_group(process.pid, signal.SIGKILL)
        for number, handler in previous.items():
            signal.signal(number, handler)
        ready.unlink(missing_ok=True)
    if stopping or (code == 0 and not hung):
        return 'quit', 0 if stopping else code, shown
    if code == RESTART_EXIT and not hung:
        return 'restart', code, shown
    if code != RETRY_EXIT and not hung and shown_at is not None and time.monotonic() - shown_at >= played_seconds:
        return 'ended', code, shown
    return 'retry', code, shown


def gpu_start(root, key):
    """The way to draw that worked last for this runtime build and session kind (gpu.json)."""
    try:
        mode = json.loads((root / 'gpu.json').read_text()).get(key)
    except (OSError, ValueError, AttributeError):
        mode = None
    return GPU_MODES.index(mode) if mode in GPU_MODES else 0


def gpu_remember(root, key, mode):
    build = key.split(':')[0] + ':'
    try:
        data = json.loads((root / 'gpu.json').read_text())
        data = {name: value for name, value in data.items() if name.startswith(build)} if isinstance(data, dict) else {}
    except (OSError, ValueError):
        data = {}
    if data.get(key) != mode:
        data[key] = mode
        try:
            atomic_write(root / 'gpu.json', json.dumps(data).encode())
        except OSError:
            pass


def start_updater(root, current):
    """The background update, in its own systemd unit when it can: outside the game's process tree,
    so Steam doesn't wait for a download to finish before it counts the game closed (a black screen in
    Gaming Mode), and a download carries on after the game. @return how it was started"""
    log = root / 'update.log'
    if os.environ.get('HIRAETH_NO_UPDATE') == '1':   # (a test copy of the install, on a Deck: never updated)
        return 'off'
    # (an install elsewhere than the usual folder updates itself, not the usual one)
    command = [sys.executable, str(current / 'resources/app/deck.py'), *(['--root', str(root)] if root != ROOT else []), '--update']
    runner = shutil.which('systemd-run')
    if runner:
        try:
            subprocess.run([runner, '--user', '--quiet', '--collect', f'--unit=hiraeth-update-{time.time_ns()}',
                            '-p', f'StandardOutput=truncate:{log}', '-p', 'StandardError=inherit', '--', *command],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=10, check=True)
            return 'systemd'
        except (OSError, subprocess.SubprocessError):
            pass
    with log.open('w') as stream:
        subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stream, stderr=stream, start_new_session=True)
    return 'child'


def launch(root, arguments, run=run_game, relaunch=None, engine=None):
    """The game: the Unity player for "Hiraeth" (engine None), Electron for "Hiraeth (web)" (engine 'web'), watched
    (run_game), until it closes; the settings' Restart now launches again (relaunch: this same process
    becomes the new current runtime's launcher, so Steam keeps tracking the game, and the next pin takes
    the update)."""
    restart = launch_once(root, arguments, run, engine)
    marker = root / '.restart'
    try:
        wanted = marker.read_text().strip()
        marker.unlink()
    except OSError:
        wanted = ''
    # (the update the settings restarted for: if it isn't what runs next, they don't offer it again)
    os.environ['HIRAETH_RESTARTED_FOR'] = wanted or str(restart)
    flag = '--launch-web' if engine == 'web' else '--launch'
    command = [sys.executable, str((root / 'current').resolve() / 'resources/app/deck.py'), flag,
               *(['--root', str(root)] if root != ROOT else []), *arguments]
    (relaunch or (lambda argv: os.execv(argv[0], argv)))(command)


def launch_once(root, arguments, run=run_game, engine=None):
    """One launch: the Unity player for "Hiraeth" (launch_unity_watched; none starts: unity_failed, a dialog and
    exit 1, never the web game), Electron for "Hiraeth (web)" alone (engine 'web'). Exits the process when the game
    closes or can't draw. @return the runtime build that ran, when the settings asked to restart into an update"""
    # Resolve before starting the updater. This process runs its immutable build;
    # the background update only affects the next launch. Saves live elsewhere.
    # Hold the short activation lock, never the potentially long download lock.
    restarted = 'HIRAETH_RESTARTED_FOR' in os.environ
    with (root / 'state.lock').open('a') as state:
        fcntl.flock(state, fcntl.LOCK_SH)
        current = (root / 'current').resolve(strict=True)
        pin = (current / '.in-use').open('a')
        fcntl.flock(pin, fcntl.LOCK_SH)
        game = choose_content(root, current)
        game_pin = (game / '.in-use').open('a') if game else open(os.devnull)
        if game:
            fcntl.flock(game_pin, fcntl.LOCK_SH)
    with pin, game_pin, (root / 'launch.log').open('a' if restarted else 'w') as record:
        def log(line):
            print(f'Hiraeth: {line}', file=sys.stderr, flush=True)
            record.write(f'{time.strftime("%Y-%m-%d %H:%M:%S")} {line}\n')
            record.flush()
        try:
            if not restarted:   # (a restart into an update: it has just been checked)
                start_updater(root, current)
        except OSError as error:
            log(f'No update check ({error}).')
        # Keep the pins until Electron exits, so updates cannot remove its assets.
        build = json.loads((current / 'resources/app/build.json').read_text()).get('build', 0)
        why = 'the web shortcut'
        if engine != 'web':
            engine, why = choose_engine(root)
        log(f'Engine {engine} ({why}).')
        if engine == 'unity':
            if launch_unity_watched(root, arguments, run, log) == 'restart':
                return build
            unity_failed(root, log)
        key = f'{build}:{session_kind(os.environ)}'
        ready = root / f'.ready-{os.getpid()}'
        log(f'Runtime {build}, {session_kind(os.environ)}, game {game or "packaged"}.')
        for mode in GPU_MODES[gpu_start(root, key):]:
            log(f'Starting ({mode}).')
            env = game_env(game, mode, ready)
            # the settings' Updates section (desktop/deck-updates.mjs) runs this updater on this install
            env.update(HIRAETH_ROOT=str(root), HIRAETH_PYTHON=sys.executable)
            how, code, shown = run([str(current / 'hiraeth'), *arguments], env, ready, log=log)
            if how == 'restart':
                log(f'Restarting into the update ({mode}).')
                gpu_remember(root, key, mode)
                return build
            if how == 'quit':
                log(f'Closed ({mode}, exit {code}).')
                if shown:
                    gpu_remember(root, key, mode)
                sys.exit(code)
            if how == 'ended':
                log(f'Ended ({mode}, exit {code}) after it had drawn: not tried another way.')
                gpu_remember(root, key, mode)
                sys.exit(1)
            log(f'Did not run ({mode}, exit {code}, window {"shown" if shown else "never shown"}).')
        # nothing worked: back to Steam's library rather than a black screen
        log('Gave up: no way to draw worked.')
        sys.exit(1)


def unity_env(root, base=None):
    """The Unity preview's environment: TMPDIR a folder that lasts (Unity keeps its Vulkan pipeline cache
    in temporaryCachePath, under TMPDIR, which SteamOS clears at boot), XDG_CONFIG_HOME its own data
    folder (persistentDataPath and PlayerPrefs: never the web game's profile)."""
    env = dict(os.environ if base is None else base)
    env.update(TMPDIR=str(root / 'unity-cache'), XDG_CONFIG_HOME=str(root / 'unity-data'))
    return env


def unity_command(player, root, arguments):
    return [str(player / UNITY_PLAYER), '-screen-fullscreen', '1', '-screen-width', '1280', '-screen-height', '800',
            '-logFile', str(root / 'unity-data/player.log'), *arguments]


def unity_players(root):
    """The installed players to try, in order: the current one, then the one before it (prune_unity keeps two),
    each a folder unity/<sha12>/ with its player."""
    unity = root / 'unity'
    try:
        current = (unity / 'current').resolve(strict=True)
    except OSError:
        current = None

    def installed_at(path):
        try:
            return json.loads((path / 'unity.json').read_text()).get('installedAt', 0)
        except (OSError, ValueError, AttributeError):
            return 0
    others = sorted((path for path in (unity.iterdir() if unity.is_dir() else ())
                     if re.fullmatch(r'[0-9a-f]{12}', path.name) and path != current and (path / UNITY_PLAYER).is_file()),
                    key=installed_at, reverse=True)
    return ([current] if current and (current / UNITY_PLAYER).is_file() else []) + others[:1]


def unity_health(root):
    """How each player's watched start went, by its sha's first 12 (unity-health.json): 'ok' or 'failed'."""
    try:
        data = json.loads((root / 'unity-health.json').read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def unity_remember(root, player, result):
    """A player's start ('ok': it drew; 'failed': no first frame in time, or a crash before PLAYED_SECONDS),
    kept for the players still installed. A failed one is skipped by the launcher while another player is there, and
    tried again when none is (launch_unity_watched): the next player build gets its own chance first."""
    data = unity_health(root)
    if data.get(player.name) == result:
        return
    installed = {path.name for path in (root / 'unity').iterdir() if path.is_dir()} if (root / 'unity').is_dir() else set()
    data = {sha: value for sha, value in data.items() if sha in installed}
    data[player.name] = result
    try:
        atomic_write(root / 'unity-health.json', json.dumps(data).encode())
    except OSError:
        pass


def unity_ready(path):
    """A check for run_game: whether the player's log (path) says its first frame played (UNITY_READY_MARKS),
    read as it grows."""
    seen = {'offset': 0, 'tail': b''}

    def check():
        try:
            with path.open('rb') as stream:
                stream.seek(seen['offset'])
                data = stream.read(1024 * 1024)
        except OSError:
            return False
        seen['offset'] += len(data)
        text = seen['tail'] + data
        if any(mark in text for mark in UNITY_READY_MARKS):
            return True
        seen['tail'] = text[-200:]
        return False
    return check


def launch_unity_watched(root, arguments, run=run_game, log=print):
    """The "Hiraeth" shortcut's Unity player, watched as Electron is: its first frame within UNITY_READY_SECONDS
    (the -ready file, or its log's line), or it is a failed start (unity_remember) and the player before it gets
    one try. No player yet (a new install): it is downloaded first (wait_for_unity). Players that failed before are
    skipped while another is there, and tried again when none is (no web game to go to: issue #484). Each runs
    pinned, with its own data folder (unity_env: saves apart from the web's) and a lasting cache. Exits the process
    when the game closes. @return 'restart' (exit 76: launch again), or None when no player started"""
    for folder in ('unity-cache', 'unity-data'):
        (root / folder).mkdir(parents=True, exist_ok=True)
    (root / 'unity').mkdir(parents=True, exist_ok=True)
    if not unity_players(root):
        log('No Unity player installed yet: downloading it (about 300 MB).')
        wait_for_unity(root, log)
    with (root / 'unity/state.lock').open('a') as state:
        fcntl.flock(state, fcntl.LOCK_SH)
        players = unity_players(root)
        health = unity_health(root)
        tried = [player for player in players if health.get(player.name) != 'failed']
        if players and not tried:
            log('Every installed Unity player failed to start before: ' + ', '.join(player.name for player in players)
                + '; trying them again.')
            tried = players
        pins = []
        for player in tried:
            pin = (player / '.in-use').open('a')
            fcntl.flock(pin, fcntl.LOCK_SH)
            pins.append(pin)
    if not players:
        log('No Unity player installed (no network, or its download failed).')
    try:
        for player in tried:
            ready = root / f'.unity-ready-{os.getpid()}'
            output = root / 'unity-data/player.log'
            if output.exists():   # (the last run's, kept: the one that failed, when one did)
                output.replace(root / 'unity-data/player-prev.log')
            command = unity_command(player, root, ['-ready', str(ready), *arguments])
            log(f'Starting the Unity player {player.name}.')
            how, code, shown = run(command, unity_env(root), ready, ready_seconds=UNITY_READY_SECONDS, stop_seconds=UNITY_STOP_SECONDS,
                                   log=log, check=unity_ready(output), stop_signal=signal.SIGTERM, cwd=player)
            if how == 'restart':
                log(f'Restarting into the update (Unity {player.name}).')
                unity_remember(root, player, 'ok')
                return 'restart'
            if how == 'quit':
                log(f'Closed (Unity {player.name}, exit {code}).')
                if shown:
                    unity_remember(root, player, 'ok')
                sys.exit(code)
            if how == 'ended':
                log(f'Ended (Unity {player.name}, exit {code}) after it had drawn.')
                unity_remember(root, player, 'ok')
                sys.exit(1)
            log(f'The Unity player {player.name} did not start (exit {code}, {"drew" if shown else "no first frame"}).')
            unity_remember(root, player, 'failed')
    finally:
        for pin in pins:
            pin.close()
    return None


# A first install has no player yet (the installer's own download failed): the launch downloads it, or waits for the
# background update that already is, this long at most (~300 MB)
UNITY_WAIT_SECONDS = 1800


def wait_for_unity(root, log=print, install=None, wait_seconds=None, sleep=time.sleep, dialog=None):
    """No player installed: download it now (update_unity), or wait while the background update downloads it (its
    lock held: install_unity returns False), a dialog saying so meanwhile (busy_dialog). @return whether one is
    installed"""
    install = install or update_unity
    deadline = time.monotonic() + (UNITY_WAIT_SECONDS if wait_seconds is None else wait_seconds)
    close = (dialog or busy_dialog)('Downloading the game (about 300 MB) before its first start…')
    try:
        while unity_installed(root) is None:
            try:
                install(root)
            except Exception as error:
                log(f'The Unity player could not be downloaded ({error}).')
                return False
            if unity_installed(root) is not None:
                break
            if time.monotonic() > deadline:
                log('The Unity player is still downloading in the background: gave up waiting.')
                return False
            sleep(2)
    finally:
        close()
    log('The Unity player is installed.')
    return True


# The dialogs the launcher shows itself (no game window: Gaming Mode would otherwise sit black, or go straight back to
# the library without a word): zenity, which Steam itself uses on SteamOS, else KDE's kdialog, else none (the log only)
DIALOG_TOOLS = ('zenity', 'kdialog')
ERROR_SECONDS = 600   # (the error dialog closes itself after this, should nobody press OK)


def dialog_env(base=None):
    """The dialog's environment: without Steam's overlay preload, as Electron's (without_overlay)."""
    env = dict(os.environ if base is None else base)
    preload = without_overlay(env.pop('LD_PRELOAD', None))
    if preload:
        env['LD_PRELOAD'] = preload
    return env


def dialog_command(tool, kind, text):
    """The command for a dialog: kind 'error' (an OK button) or 'busy' (a moving bar, no buttons); None: not this tool."""
    if tool == 'zenity':
        if kind == 'error':
            return ['zenity', '--error', '--title=Hiraeth', '--width=520', f'--timeout={ERROR_SECONDS}', '--no-markup',
                    f'--text={text}']
        return ['zenity', '--progress', '--pulsate', '--no-cancel', '--auto-close', '--title=Hiraeth', '--width=520',
                '--no-markup', f'--text={text}']
    if tool == 'kdialog' and kind == 'error':
        return ['kdialog', '--title', 'Hiraeth', '--error', text]
    return None   # (kdialog's bar needs D-Bus calls: the log says it instead)


def find_dialog_tool(which=shutil.which):
    return next((tool for tool in DIALOG_TOOLS if which(tool)), None)


def show_error(text, popen=subprocess.Popen, which=shutil.which):
    """An error dialog, waited for (the player presses OK). @return whether one was shown"""
    tool = find_dialog_tool(which)
    command = dialog_command(tool, 'error', text) if tool else None
    if not command:
        return False
    try:
        popen(command, env=dialog_env(), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
              stderr=subprocess.DEVNULL).wait(ERROR_SECONDS + 10)
        return True
    except (OSError, subprocess.SubprocessError):
        return False


def busy_dialog(text, popen=subprocess.Popen, which=shutil.which):
    """A dialog with a moving bar while the launcher waits. @return a function that closes it"""
    tool = find_dialog_tool(which)
    command = dialog_command(tool, 'busy', text) if tool else None
    if not command:
        return lambda: None
    try:
        process = popen(command, env=dialog_env(), stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        return lambda: None

    def close():
        try:
            process.stdin.write(b'100\n')
            process.stdin.close()
            process.wait(5)
        except (OSError, ValueError, subprocess.SubprocessError):
            process.kill()
    return close


UNITY_FAILED_TEXT = ('Hiraeth could not start on this Steam Deck.\n\n'
                     'Try again in a moment. If it keeps happening, connect to the internet so the game can update '
                     'itself, then start it again. What happened is in {log}.')


def unity_failed(root, log, show=None):
    """No Unity player started: say so (a dialog over Gaming Mode's black screen), then back to Steam's library
    (exit 1). Never the web game (issue #484)."""
    log('Gave up: the Unity player did not start (no web fallback).')
    (show or show_error)(UNITY_FAILED_TEXT.format(log=root / 'launch.log'))
    sys.exit(1)


def exec_player(command, env, cwd, keep, output):
    """Become the player, so Steam tracks it (and its Exit Game reaches it) directly; the pin's lock
    (keep) and the log (output, its stdout and stderr) go with it."""
    os.set_inheritable(keep.fileno(), True)
    os.dup2(output.fileno(), 1)
    os.dup2(output.fileno(), 2)
    os.chdir(cwd)
    os.execve(command[0], command, env)


def launch_unity(root, arguments, run=exec_player, install=update_unity, updater=start_updater):
    """The Unity preview's shortcut: the installed player (installed first if it isn't yet), pinned so an
    update never removes it while it runs, with its own data folder and a lasting cache."""
    for folder in ('unity-cache', 'unity-data'):
        (root / folder).mkdir(parents=True, exist_ok=True)
    record = (root / 'unity-launch.log').open('w')

    def log(line):
        print(f'Hiraeth (Unity preview): {line}', file=sys.stderr, flush=True)
        record.write(f'{time.strftime("%Y-%m-%d %H:%M:%S")} {line}\n')
        record.flush()
    if unity_installed(root) is None:
        log('No Unity player yet: downloading it (about 300 MB)…')
        try:
            install(root)
        except Exception as error:
            log(f'Download failed ({error}).')
    try:   # (the background update, as the game's launch starts it: the runtime, the game, this player)
        updater(root, (root / 'current').resolve(strict=True))
    except OSError as error:
        log(f'No update check ({error}).')
    (root / 'unity').mkdir(parents=True, exist_ok=True)
    with (root / 'unity/state.lock').open('a') as state:
        fcntl.flock(state, fcntl.LOCK_SH)
        if unity_installed(root) is None:
            log('The Unity player is not installed (no network, or the background update is still downloading it): try again later.')
            record.close()
            sys.exit(1)
        player = (root / 'unity/current').resolve(strict=True)
        pin = (player / '.in-use').open('a')
        fcntl.flock(pin, fcntl.LOCK_SH)
    command = unity_command(player, root, arguments)
    log(f'Starting {player.name}: {shlex.join(command)}')
    with pin, record:   # (exec_player never returns: the player holds them from here)
        run(command, unity_env(root), player, pin, record)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launch', action='store_true')
    parser.add_argument('--launch-unity', action='store_true', help='the Unity preview (launch-unity)')
    parser.add_argument('--launch-web', action='store_true', help='the web runtime, whatever the engine (launch-web)')
    parser.add_argument('--update', action='store_true')
    parser.add_argument('--register-steam', action='store_true')
    parser.add_argument('--from', dest='source', metavar='DIR',
                        help='install the package downloaded by hand into DIR (steam-deck.json and its .tar.gz)')
    # the settings' Updates section (desktop/deck-updates.mjs): --status, and --update --progress
    parser.add_argument('--status', action='store_true', help='print what is here and the newest on the feeds, as JSON')
    parser.add_argument('--status-local', action='store_true', help='print only what is here (no network), as JSON')
    parser.add_argument('--progress', metavar='FILE', help='with --update: follow the downloads in FILE')
    parser.add_argument('--root', metavar='DIR', help='the install (default ~/.local/share/hiraeth-deck)')
    parser.add_argument('--remove-old-install', action='store_true',
                        help='take away the install from before the rename (~/.local/share/moebius-deck): its Steam shortcuts leave shortcuts.vdf, its art, desktop entries and folder go to a backup (Steam closed)')
    args, extra = parser.parse_known_args()
    root = Path(args.root).expanduser() if args.root else ROOT
    # (--status and --update on an explicit --root run anywhere: the settings' tests on a Mac)
    if (platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64')) and not (args.root and (args.status or args.status_local or args.update)):
        parser.error('This package requires Linux x86-64 (Steam Deck).')
    if args.launch:
        launch(root, extra)
        return
    if args.launch_web:
        launch(root, extra, engine='web')
        return
    if args.launch_unity:
        launch_unity(root, extra)
        return
    if extra:
        parser.error('Unknown arguments: ' + ' '.join(extra))
    if args.status or args.status_local:
        print(json.dumps(status(root) if args.status else local_state(root)), flush=True)
        return
    if args.remove_old_install:
        try:
            print(json.dumps(remove_old_install(root), indent=1), flush=True)
        except RuntimeError as error:
            print(error, file=sys.stderr, flush=True)
            sys.exit(1)
        return
    if args.update:
        global PROGRESS
        PROGRESS = Path(args.progress) if args.progress else None
        # (the settings' download, --progress, takes the player too: it is the game; a 'unity' failure never fails it)
        failures = update_all(root)
        progress('done', 0, 0, done=True)
        sys.exit(1 if 'runtime' in failures and 'game' in failures else 0)
    if not args.register_steam:
        if args.source:
            manifest, copy = local_package(args.source)
            print(f"Installing Hiraeth build {manifest['build']} from {args.source}…", flush=True)
            changed = install_update(ROOT, manifest, copy)
        else:
            print('Checking for a Hiraeth update…', flush=True)
            changed = install_update(ROOT, get_manifest())
        print('Update installed. It will be used on the next launch.' if changed else 'Already up to date.', flush=True)
        try:
            if content_update(ROOT):
                print('The newest game was downloaded too.', flush=True)
        except Exception as error:
            print(f'The game looks for its newest version again at the next launch ({error}).', flush=True)
        try:
            print('Checking for the Unity player (about 300 MB the first time)…', flush=True)
            if update_unity(ROOT):
                print('The Unity player was installed too.', flush=True)
        except Exception as error:
            print(f'The Unity player is downloaded when Hiraeth first starts instead ({error}).', flush=True)
    write_launchers(ROOT)
    configs = steam_configs(Path.home())
    if not configs:
        raise RuntimeError('Game installed. Open Steam and sign in once, then rerun this installer to add it to the library.')
    # accounts that have the shortcut as it should be need nothing from Steam, only the artwork
    missing = [config for config in configs if shortcut_stale(config, ROOT)]
    if not missing:
        remember_preview(ROOT, configs)
        changed = install_art(ROOT, configs)
        print('Hiraeth is installed and in Steam' + (' with its library artwork: restart Steam to see it.' if changed else '.'), flush=True)
        return
    if steam_running():
        print('Game installed. Exit Steam using Steam → Exit; this installer will add Hiraeth automatically once Steam closes.', flush=True)
        deadline = time.monotonic() + 300
        while steam_running() and time.monotonic() < deadline:
            time.sleep(1)
        if steam_running():
            raise RuntimeError('Still waiting for Steam. Close it and rerun the installer with --register-steam.')
        time.sleep(2)  # allow Steam to finish flushing its configuration
    for config in configs:
        add_shortcut(config, ROOT)
    remember_preview(ROOT, configs)
    install_art(ROOT, configs)
    print('Hiraeth is installed and added to Steam. Reopen Steam or return to Gaming Mode. Updates download while you play and apply next launch.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Hiraeth: {error}', file=sys.stderr)
        sys.exit(1)
