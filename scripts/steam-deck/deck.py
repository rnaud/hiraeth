#!/usr/bin/env python3
"""Hiraeth Steam Deck installer, background updater, and Steam integration.

Two kinds of update, both checked in the background at each launch:
- the game itself (content): the same web bundle the Android app takes, from the
  game's site (CONTENT_MANIFEST_URL, published by the Cloudflare deploy). It is
  verified, unpacked to web/<build>/ and served by the runtime from the next launch
  (desktop/main.mjs, MOEBIUS_GAME), unless it needs a newer runtime (minDesktop).
- the runtime (Electron, main.mjs, this updater, a packaged copy of the game): from the
  game's site too (RUNTIME_SITE_URL, in parts: scripts/deck-runtime.mjs), else the
  steam-deck GitHub release; a package downloaded by hand installs with --from (docs/steam-deck.md).

And a third, its own component: the Unity bridge's Linux player (the unity-linux GitHub release),
unpacked to unity/<sha>/ and started by a second Steam shortcut, "Hiraeth (Unity preview)"
(--launch-unity, the launch-unity script), with its own data folder; the web build stays the game.

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
CONTENT_URL = 'https://memento.alexandria-rnaud.workers.dev/updates/'
CONTENT_MANIFEST_URL = CONTENT_URL + 'web.json'
# ... and the runtime there, in parts (scripts/deck-runtime.mjs)
RUNTIME_SITE_URL = CONTENT_URL + 'steam-deck.json'
ROOT = Path.home() / '.local/share/moebius-deck'
MAX_ARCHIVE = 1024 * 1024 * 1024
MAX_CONTENT = 300 * 1024 * 1024
# The Unity preview's player: the asset of the unity-linux release, read from GitHub's API
UNITY_RELEASE_URL = 'https://api.github.com/repos/rnaud/hiraeth/releases/tags/unity-linux'
UNITY_ASSET = 'memento-unity-linux.tar.gz'
UNITY_ASSET_URL = 'https://github.com/rnaud/hiraeth/releases/download/unity-linux/' + UNITY_ASSET
UNITY_PLAYER = 'memento-js.x86_64'
# (the build's own leftovers, not for shipping: never unpacked)
UNITY_SKIP = ('_BackUpThisFolder_ButDontShipItWithYourGame', '_BurstDebugInformation_DoNotShip')
# The two Steam shortcuts, each known by its launcher (its Exe): the game, and the Unity preview
MAIN_NAME, UNITY_NAME = 'Hiraeth', 'Hiraeth (Unity preview)'
OLD_NAMES = (None, '', 'Moebius', 'moebius', 'Memento', 'memento')


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


def add_shortcut(config, root, preview=True):
    """The game's shortcut and the Unity preview's in one account's shortcuts.vdf (one write, backed up
    first). preview: add the preview's when the account lacks it (the background update offers it once
    per account, so one the player removed stays removed). @return whether the file changed"""
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
    # still under the game's old names ('Moebius' or 'Memento') or without an
    # icon gets the game's.
    changed = False
    ours = our_entries(entries, shortcut_exe(root))
    for entry in ours:
        changed |= set_field(entry, 'AppName', MAIN_NAME, lambda name: name in OLD_NAMES)
        changed |= set_field(entry, 'icon', icon, lambda icon: not icon)
    if not ours:
        add_entry(entries, shortcut_exe(root), root, MAIN_NAME, shortcut_appid(root))
        changed = True
    previews = our_entries(entries, shortcut_exe(root, 'launch-unity'))
    for entry in previews:
        changed |= set_field(entry, 'AppName', UNITY_NAME, lambda name: not name)
        changed |= set_field(entry, 'icon', icon, lambda icon: not icon)
    if not previews and preview:
        add_entry(entries, shortcut_exe(root, 'launch-unity'), root, UNITY_NAME, unity_appid(root))
        changed = True
    if not changed:
        return False
    # Check again immediately before writing; don't overwrite intervening edits.
    if steam_running() or (path.read_bytes() if path.exists() else None) != original:
        raise RuntimeError('Steam shortcuts changed during installation; please retry with Steam closed.')
    if original is not None:
        backup = config / f'shortcuts.vdf.moebius-{time.time_ns()}.bak'
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


def add_entry(entries, exe, root, name, appid):
    entries.append((str(len(entries)), [
        ('appid', appid), ('AppName', name), ('Exe', exe),
        ('StartDir', f'"{root}"'), ('icon', str(root / 'icon.png')),
        ('ShortcutPath', ''), ('LaunchOptions', ''), ('IsHidden', 0),
        ('AllowDesktopConfig', 1), ('AllowOverlay', 1), ('OpenVR', 0),
        ('Devkit', 0), ('DevkitGameID', ''), ('LastPlayTime', 0), ('tags', []),
    ]))
    entries[:] = [(str(i), value) for i, (_, value) in enumerate(entries)]


def shortcut_stale(config, root, preview=True):
    """Whether this account lacks our shortcut, or has it under the old name or without an icon; or
    (preview) lacks the Unity preview's, or has it without a name or an icon."""
    try:
        entries = field(parse_vdf((config / 'shortcuts.vdf').read_bytes()), 'shortcuts')
    except (OSError, ValueError):
        return True
    ours = our_entries(entries, shortcut_exe(root))
    previews = our_entries(entries, shortcut_exe(root, 'launch-unity'))
    return (not ours or any(field(value, 'AppName') in OLD_NAMES or not field(value, 'icon') for value in ours)
            or (preview and not previews) or any(not field(value, 'AppName') or not field(value, 'icon') for value in previews))


def fetch_manifest(url):
    request = urllib.request.Request(f'{url}?t={time.time_ns()}', headers={'User-Agent': 'Moebius-Updater', 'Cache-Control': 'no-cache'})
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
    elif manifest.get('url') != BASE_URL + f'moebius-steam-deck-{build}.tar.gz':
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
            request = urllib.request.Request(url, headers={'User-Agent': 'Moebius-Updater'})
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
            required = ['moebius', 'resources/app/deck.py', 'resources/app/main.mjs',
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
    request = urllib.request.Request(url, headers={'User-Agent': 'Moebius-Updater', 'Cache-Control': 'no-cache'})
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
    request = urllib.request.Request(manifest['zip'], headers={'User-Agent': 'Moebius-Updater'})
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
    """Electron's environment: MOEBIUS_GAME names the downloaded game to serve, MOEBIUS_GPU the way
    to draw (GPU_MODES), MOEBIUS_READY the file it touches once its window is up (desktop/main.mjs)."""
    env = {key: value for key, value in (os.environ if base is None else base).items()
           if key not in ('MOEBIUS_GAME', 'MOEBIUS_GPU', 'MOEBIUS_READY', 'LD_PRELOAD')}
    preload = without_overlay((os.environ if base is None else base).get('LD_PRELOAD'))
    if preload:
        env['LD_PRELOAD'] = preload
    if game:
        env['MOEBIUS_GAME'] = str(game)
    if gpu:
        env['MOEBIUS_GPU'] = gpu
    if ready:
        env['MOEBIUS_READY'] = str(ready)
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


# ---------------------------------------------------------------- the Unity preview's player

def get_unity_manifest():
    """The unity-linux release's player, from GitHub's API: {url, size, sha256} (its asset's digest)."""
    request = urllib.request.Request(UNITY_RELEASE_URL, headers={
        'User-Agent': 'Moebius-Updater', 'Accept': 'application/vnd.github+json'})
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


def shortcut_appid(root):
    """The app id Steam gives our shortcut (add_shortcut writes it; Steam names its artwork after it),
    from the old name: the id stays stable."""
    return zlib.crc32((f'"{root / "launch"}"' + 'Moebius').encode()) | 0x80000000


def unity_appid(root):
    """The Unity preview's: Steam's scheme too, from its own launcher and name (never the game's id)."""
    return zlib.crc32((shortcut_exe(root, 'launch-unity') + UNITY_NAME).encode()) | 0x80000000


def shortcut_appids(config, root, launchers=('launch', 'launch-unity')):
    """Our shortcuts' app ids in one account, read from its shortcuts.vdf (by their stable executables)."""
    try:
        document = parse_vdf((config / 'shortcuts.vdf').read_bytes())
    except (OSError, ValueError):
        return []
    entries = field(document, 'shortcuts')
    return [field(value, 'appid') for launcher in launchers for value in our_entries(entries, shortcut_exe(root, launcher))
            if type(field(value, 'appid')) is int]


def install_art(root, configs, app=None):
    """Steam's library artwork for our shortcuts (the Unity preview takes the game's), in each account's
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
        for appid in shortcut_appids(config, root):
            for suffix, name in STEAM_ART.items():
                source = app / name
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


def preview_offered(root):
    """The accounts (their config folders) the Unity preview's shortcut was given to (unity-shortcut.json)."""
    try:
        return set(json.loads((root / 'unity-shortcut.json').read_text()))
    except (OSError, ValueError, TypeError):
        return set()


def remember_preview(root, configs):
    offered = preview_offered(root)
    if not {str(config) for config in configs} <= offered:
        atomic_write(root / 'unity-shortcut.json', json.dumps(sorted(offered | {str(config) for config in configs})).encode())


def steam_entry(root, configs):
    """Our shortcuts' artwork and, while Steam is closed (it rewrites shortcuts.vdf from memory as it
    exits), in accounts that have the game's shortcut: its name and icon if it has the old name, and the
    Unity preview's shortcut, once (one the player removed stays removed; the installer adds it again).
    @return whether anything changed"""
    renamed = False
    if not steam_running():
        offered, given = preview_offered(root), []
        for config in configs:
            if not shortcut_appids(config, root, ('launch',)):
                continue
            preview = str(config) not in offered
            try:
                if shortcut_stale(config, root, preview):
                    renamed |= add_shortcut(config, root, preview)
            except (RuntimeError, ValueError, OSError):
                continue   # (Steam started meanwhile, or files we won't touch: next time)
            if preview:
                given.append(config)
        if given:
            remember_preview(root, given)
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
             ('game', content or (lambda: install_content(root, get_content_manifest())))]
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


def local_package(directory):
    """A package downloaded by hand (gh release download steam-deck): its steam-deck.json and archive."""
    directory = Path(directory).expanduser()
    manifest = json.loads((directory / 'steam-deck.json').read_text())
    validate_manifest(manifest)
    archive = directory / f"moebius-steam-deck-{manifest['build']}.tar.gz"
    if not archive.is_file():
        raise ValueError(f'{archive.name} is not next to steam-deck.json in {directory}')
    return manifest, lambda _manifest, target: shutil.copyfile(archive, target)


def desktop_entry(name, command, icon):
    # Desktop Exec quoting is not shell quoting; escape its reserved characters.
    command = str(command).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    return f'[Desktop Entry]\nType=Application\nName={name}\nExec="{command}"\nIcon={icon}\nTerminal=false\nCategories=Game;\n'.encode()


def write_launchers(root, home=None):
    """launch (the game's shortcut) and launch-unity (the Unity preview's), their icon and desktop entries."""
    applications = (home or Path.home()) / '.local/share/applications'
    deck = shlex.quote(str(root / 'current/resources/app/deck.py'))
    for launcher, flag, name, entry in (('launch', '--launch', MAIN_NAME, 'moebius.desktop'),
                                        ('launch-unity', '--launch-unity', UNITY_NAME, 'moebius-unity.desktop')):
        atomic_write(root / launcher, f'#!/bin/sh\nexec python3 {deck} {flag} "$@"\n'.encode(), 0o755)
        atomic_write(applications / entry, desktop_entry(name, root / launcher, root / 'icon.png'), 0o755)
    atomic_write(root / 'icon.png', (root / 'current/resources/app/game/icons/icon-512.png').read_bytes())


# ---------------------------------------------------------------- launching

# How Chromium draws, tried in turn while the game doesn't come up: the GPU as Electron picks it
# (ANGLE on OpenGL), ANGLE on Vulkan, then software. desktop/main.mjs reads MOEBIUS_GPU.
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


def run_game(command, env, ready, ready_seconds=READY_SECONDS, stop_seconds=STOP_SECONDS, played_seconds=PLAYED_SECONDS, log=print):
    """Electron in its own process group, watched until it ends; none of its processes outlives it
    (Steam counts the game running, a black screen in Gaming Mode, while any of them does).
    @return (how, code, shown): how is 'quit' (it closed, or Steam closed it), 'retry' (it crashed
    soon, hung before its window showed, or asked for another way to draw) or 'ended' (it crashed or
    was killed after its window had been up played_seconds: the way to draw worked, so no other is
    tried; once a game killed after 9 h restarted on Vulkan and gpu.json kept that); shown, whether
    its window did"""
    ready.unlink(missing_ok=True)
    process = subprocess.Popen(command, env=env, start_new_session=True)
    stopping = []

    def stop(number, _frame):
        if not stopping:
            stopping.append(time.monotonic())
            log(f'Signal {number}: closing the game.')
        # (SIGINT to the browser alone: Chromium closes its helpers itself, at once and cleanly)
        try:
            os.kill(process.pid, signal.SIGINT)
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
                shown = shown or ready.exists()
                if shown and shown_at is None:
                    shown_at = now
                if stopping and now - stopping[0] > stop_seconds:
                    signal_group(process.pid, signal.SIGKILL)
                elif not shown and not stopping and not hung and now - started > ready_seconds:
                    log(f'No window after {ready_seconds} s: the game hangs.')
                    hung = True
                    signal_group(process.pid, signal.SIGKILL)
        shown = shown or ready.exists()
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
    command = [sys.executable, str(current / 'resources/app/deck.py'), '--update']
    runner = shutil.which('systemd-run')
    if runner:
        try:
            subprocess.run([runner, '--user', '--quiet', '--collect', f'--unit=memento-update-{time.time_ns()}',
                            '-p', f'StandardOutput=truncate:{log}', '-p', 'StandardError=inherit', '--', *command],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=10, check=True)
            return 'systemd'
        except (OSError, subprocess.SubprocessError):
            pass
    with log.open('w') as stream:
        subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stream, stderr=stream, start_new_session=True)
    return 'child'


def launch(root, arguments, run=run_game, relaunch=None):
    """Electron, watched (run_game), until it closes; the settings' Restart now launches again
    (relaunch: this same process becomes the new current runtime's launcher, so Steam keeps
    tracking the game, and the next pin takes the update)."""
    restart = launch_once(root, arguments, run)
    marker = root / '.restart'
    try:
        wanted = marker.read_text().strip()
        marker.unlink()
    except OSError:
        wanted = ''
    # (the update the settings restarted for: if it isn't what runs next, they don't offer it again)
    os.environ['MOEBIUS_RESTARTED_FOR'] = wanted or str(restart)
    command = [sys.executable, str((root / 'current').resolve() / 'resources/app/deck.py'), '--launch', *arguments]
    (relaunch or (lambda argv: os.execv(argv[0], argv)))(command)


def launch_once(root, arguments, run=run_game):
    """One launch: exits the process when the game closes or can't draw. @return the runtime build
    that ran, when the settings asked to restart into an update"""
    # Resolve before starting the updater. This process runs its immutable build;
    # the background update only affects the next launch. Saves live elsewhere.
    # Hold the short activation lock, never the potentially long download lock.
    restarted = 'MOEBIUS_RESTARTED_FOR' in os.environ
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
        key = f'{build}:{session_kind(os.environ)}'
        ready = root / f'.ready-{os.getpid()}'
        log(f'Runtime {build}, {session_kind(os.environ)}, game {game or "packaged"}.')
        for mode in GPU_MODES[gpu_start(root, key):]:
            log(f'Starting ({mode}).')
            env = game_env(game, mode, ready)
            # the settings' Updates section (desktop/deck-updates.mjs) runs this updater on this install
            env.update(MOEBIUS_ROOT=str(root), MOEBIUS_PYTHON=sys.executable)
            how, code, shown = run([str(current / 'moebius'), *arguments], env, ready, log=log)
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
    parser.add_argument('--update', action='store_true')
    parser.add_argument('--register-steam', action='store_true')
    parser.add_argument('--from', dest='source', metavar='DIR',
                        help='install the package downloaded by hand into DIR (steam-deck.json and its .tar.gz)')
    # the settings' Updates section (desktop/deck-updates.mjs): --status, and --update --progress
    parser.add_argument('--status', action='store_true', help='print what is here and the newest on the feeds, as JSON')
    parser.add_argument('--status-local', action='store_true', help='print only what is here (no network), as JSON')
    parser.add_argument('--progress', metavar='FILE', help='with --update: follow the downloads in FILE')
    parser.add_argument('--root', metavar='DIR', help='the install (default ~/.local/share/moebius-deck)')
    args, extra = parser.parse_known_args()
    root = Path(args.root).expanduser() if args.root else ROOT
    # (--status and --update on an explicit --root run anywhere: the settings' tests on a Mac)
    if (platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64')) and not (args.root and (args.status or args.status_local or args.update)):
        parser.error('This package requires Linux x86-64 (Steam Deck).')
    if args.launch:
        launch(root, extra)
        return
    if args.launch_unity:
        launch_unity(root, extra)
        return
    if extra:
        parser.error('Unknown arguments: ' + ' '.join(extra))
    if args.status or args.status_local:
        print(json.dumps(status(root) if args.status else local_state(root)), flush=True)
        return
    if args.update:
        global PROGRESS
        PROGRESS = Path(args.progress) if args.progress else None
        # (the settings' download, --progress, leaves the Unity preview to the launch's update; a
        # 'unity' failure never fails it)
        failures = update_all(root, with_unity=PROGRESS is None)
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
            if install_content(ROOT, get_content_manifest()):
                print('The newest game was downloaded too.', flush=True)
        except Exception as error:
            print(f'The game looks for its newest version again at the next launch ({error}).', flush=True)
        try:
            print('Checking for the Unity preview\'s player (about 300 MB the first time)…', flush=True)
            if update_unity(ROOT):
                print('The Unity preview was installed too.', flush=True)
        except Exception as error:
            print(f'The Unity preview is downloaded at the next update instead ({error}).', flush=True)
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
