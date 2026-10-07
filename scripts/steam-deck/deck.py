#!/usr/bin/env python3
"""Memento Steam Deck installer, background updater, and Steam integration.

Two kinds of update, both checked in the background at each launch:
- the game itself (content): the same web bundle the Android app takes, from the
  game's site (CONTENT_MANIFEST_URL, published by the Cloudflare deploy). It is
  verified, unpacked to web/<build>/ and served by the runtime from the next launch
  (desktop/main.mjs, MOEBIUS_GAME), unless it needs a newer runtime (minDesktop).
- the runtime (Electron, main.mjs, this updater, a packaged copy of the game): the
  package on the steam-deck GitHub release. Once the repository is private that
  feed is out of reach: install a new package by hand with --from (docs/steam-deck.md).

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

# The runtime package (GitHub; by hand with --from once the repository is private)
BASE_URL = 'https://github.com/rnaud/moebius/releases/download/steam-deck/'
MANIFEST_URL = BASE_URL + 'steam-deck.json'
# The game's content updates, next to the web game (scripts/web-update.mjs)
CONTENT_URL = 'https://memento.alexandria-rnaud.workers.dev/updates/'
CONTENT_MANIFEST_URL = CONTENT_URL + 'web.json'
ROOT = Path.home() / '.local/share/moebius-deck'
MAX_ARCHIVE = 1024 * 1024 * 1024
MAX_CONTENT = 300 * 1024 * 1024


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


def add_shortcut(config, root):
    if steam_running():
        raise RuntimeError('Exit Steam completely before adding the shortcut, then run the installer again.')
    path = config / 'shortcuts.vdf'
    original = path.read_bytes() if path.exists() else None
    document = parse_vdf(original) if original else [('shortcuts', [])]
    entries = field(document, 'shortcuts')
    if not isinstance(entries, list):
        raise ValueError('Missing shortcuts map; Steam files unchanged')
    exe = f'"{root / "launch"}"'
    # Identity is the stable executable, not the display name. Keep user edits.
    if any(isinstance(value, list) and field(value, 'exe') == exe for _, value in entries):
        return False
    appid = zlib.crc32((exe + 'Moebius').encode()) | 0x80000000   # (the old name: the id stays stable)
    entries.append((str(len(entries)), [
        ('appid', appid), ('AppName', 'Memento'), ('Exe', exe),
        ('StartDir', f'"{root}"'), ('icon', str(root / 'icon.png')),
        ('ShortcutPath', ''), ('LaunchOptions', ''), ('IsHidden', 0),
        ('AllowDesktopConfig', 1), ('AllowOverlay', 1), ('OpenVR', 0),
        ('Devkit', 0), ('DevkitGameID', ''), ('LastPlayTime', 0), ('tags', []),
    ]))
    entries[:] = [(str(i), value) for i, (_, value) in enumerate(entries)]
    # Check again immediately before writing; don't overwrite intervening edits.
    if steam_running() or (path.read_bytes() if path.exists() else None) != original:
        raise RuntimeError('Steam shortcuts changed during installation; please retry with Steam closed.')
    if original is not None:
        backup = config / f'shortcuts.vdf.moebius-{time.time_ns()}.bak'
        atomic_write(backup, original)
    atomic_write(path, encode_vdf(document))
    return True


def get_manifest():
    request = urllib.request.Request(MANIFEST_URL, headers={'User-Agent': 'Moebius-Updater'})
    with urllib.request.urlopen(request, timeout=8) as response:
        data = response.read(65537)
    if len(data) > 65536:
        raise ValueError('Manifest is too large')
    manifest = json.loads(data)
    validate_manifest(manifest)
    return manifest


def validate_manifest(manifest):
    build = manifest.get('build')
    if type(build) is not int or build < 1:
        raise ValueError('Invalid release build number')
    if not re.fullmatch(r'[0-9a-f]{64}', manifest.get('sha256', '')):
        raise ValueError('Invalid release checksum')
    if manifest.get('url') != BASE_URL + f'moebius-steam-deck-{build}.tar.gz':
        raise ValueError('Unexpected release URL')
    if not isinstance(manifest.get('version'), str):
        raise ValueError('Missing release version')


def download(manifest, destination):
    request = urllib.request.Request(manifest['url'], headers={'User-Agent': 'Moebius-Updater'})
    digest, size = hashlib.sha256(), 0
    deadline = time.monotonic() + 600
    with urllib.request.urlopen(request, timeout=30) as response, destination.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_ARCHIVE or time.monotonic() > deadline:
                raise ValueError('Download exceeded its size or time limit')
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != manifest['sha256']:
        raise ValueError('Download checksum mismatch; installed game unchanged')


def extract(archive, destination):
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
        print(f"Game build {manifest['build']} needs a newer Memento runtime: install the new package.", flush=True)
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


def update_all(root, runtime=None, content=None):
    """The background update: the runtime and the game separately, so one failing (the runtime's
    feed once GitHub is out of reach, or offline) never holds back the other. @return what failed"""
    failures = []
    steps = (('runtime', runtime or (lambda: install_update(root, get_manifest()))),
             ('game', content or (lambda: install_content(root, get_content_manifest()))))
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


def write_launchers(root):
    script = '#!/bin/sh\nexec python3 ' + shlex.quote(str(root / 'current/resources/app/deck.py')) + ' --launch "$@"\n'
    atomic_write(root / 'launch', script.encode(), 0o755)
    atomic_write(root / 'icon.png', (root / 'current/resources/app/game/icons/icon-512.png').read_bytes())
    # Desktop Exec quoting is not shell quoting; escape its reserved characters.
    command = str(root / 'launch').replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    entry = f'[Desktop Entry]\nType=Application\nName=Memento\nExec="{command}"\nIcon={root / "icon.png"}\nTerminal=false\nCategories=Game;\n'
    atomic_write(Path.home() / '.local/share/applications/moebius.desktop', entry.encode(), 0o755)


# ---------------------------------------------------------------- launching

# How Chromium draws, tried in turn while the game doesn't come up: the GPU as Electron picks it
# (ANGLE on OpenGL), ANGLE on Vulkan, then software. desktop/main.mjs reads MOEBIUS_GPU.
GPU_MODES = ('gl', 'vulkan', 'software')
RETRY_EXIT = 75      # desktop/main.mjs: its GPU process keeps crashing, try the next mode
READY_SECONDS = 30   # no window by then: Electron hangs (a helper process died as it started)
STOP_SECONDS = 5     # Steam's Exit Game (a signal): this long to close, then killed with its helpers


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


def run_game(command, env, ready, ready_seconds=READY_SECONDS, stop_seconds=STOP_SECONDS, log=print):
    """Electron in its own process group, watched until it ends; none of its processes outlives it
    (Steam counts the game running, a black screen in Gaming Mode, while any of them does).
    @return (how, code, shown): how is 'quit' (it closed, or Steam closed it) or 'retry' (it crashed,
    hung before its window showed, or asked for another way to draw); shown, whether its window did"""
    ready.unlink(missing_ok=True)
    process = subprocess.Popen(command, env=env, start_new_session=True)
    stopping = []

    def stop(number, _frame):
        if not stopping:
            stopping.append(time.monotonic())
            log(f'Signal {number}: closing the game.')
        signal_group(process.pid, signal.SIGTERM)
    handled = (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
    previous = {number: signal.signal(number, stop) for number in handled}
    started, shown, hung, code = time.monotonic(), False, False, None
    try:
        # (monotonic time stops while the Deck sleeps: a Deck put to sleep as the game starts doesn't count)
        while code is None:
            try:
                code = process.wait(timeout=0.25)
            except subprocess.TimeoutExpired:
                now = time.monotonic()
                shown = shown or ready.exists()
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


def launch(root, arguments, run=run_game):
    # Resolve before starting the updater. This process runs its immutable build;
    # the background update only affects the next launch. Saves live elsewhere.
    # Hold the short activation lock, never the potentially long download lock.
    with (root / 'state.lock').open('a') as state:
        fcntl.flock(state, fcntl.LOCK_SH)
        current = (root / 'current').resolve(strict=True)
        pin = (current / '.in-use').open('a')
        fcntl.flock(pin, fcntl.LOCK_SH)
        game = choose_content(root, current)
        game_pin = (game / '.in-use').open('a') if game else open(os.devnull)
        if game:
            fcntl.flock(game_pin, fcntl.LOCK_SH)
    with pin, game_pin, (root / 'launch.log').open('w') as record:
        def log(line):
            print(f'Memento: {line}', file=sys.stderr, flush=True)
            record.write(f'{time.strftime("%Y-%m-%d %H:%M:%S")} {line}\n')
            record.flush()
        try:
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
            how, code, shown = run([str(current / 'moebius'), *arguments], game_env(game, mode, ready), ready, log=log)
            if how == 'quit':
                log(f'Closed ({mode}, exit {code}).')
                if shown:
                    gpu_remember(root, key, mode)
                sys.exit(code)
            log(f'Did not run ({mode}, exit {code}, window {"shown" if shown else "never shown"}).')
        # nothing worked: back to Steam's library rather than a black screen
        log('Gave up: no way to draw worked.')
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launch', action='store_true')
    parser.add_argument('--update', action='store_true')
    parser.add_argument('--register-steam', action='store_true')
    parser.add_argument('--from', dest='source', metavar='DIR',
                        help='install the package downloaded by hand into DIR (steam-deck.json and its .tar.gz)')
    args, extra = parser.parse_known_args()
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64'):
        parser.error('This package requires Linux x86-64 (Steam Deck).')
    if args.launch:
        launch(ROOT, extra)
        return
    if extra:
        parser.error('Unknown arguments: ' + ' '.join(extra))
    if args.update:
        update_all(ROOT)
        return
    if not args.register_steam:
        if args.source:
            manifest, copy = local_package(args.source)
            print(f"Installing Memento build {manifest['build']} from {args.source}…", flush=True)
            changed = install_update(ROOT, manifest, copy)
        else:
            print('Checking for a Memento update…', flush=True)
            changed = install_update(ROOT, get_manifest())
        print('Update installed. It will be used on the next launch.' if changed else 'Already up to date.', flush=True)
        try:
            if install_content(ROOT, get_content_manifest()):
                print('The newest game was downloaded too.', flush=True)
        except Exception as error:
            print(f'The game looks for its newest version again at the next launch ({error}).', flush=True)
    write_launchers(ROOT)
    configs = steam_configs(Path.home())
    if not configs:
        raise RuntimeError('Game installed. Open Steam and sign in once, then rerun this installer to add it to the library.')
    if steam_running():
        print('Game installed. Exit Steam using Steam → Exit; this installer will add Memento automatically once Steam closes.', flush=True)
        deadline = time.monotonic() + 300
        while steam_running() and time.monotonic() < deadline:
            time.sleep(1)
        if steam_running():
            raise RuntimeError('Still waiting for Steam. Close it and rerun the installer with --register-steam.')
        time.sleep(2)  # allow Steam to finish flushing its configuration
    for config in configs:
        add_shortcut(config, ROOT)
    print('Memento is installed and added to Steam. Reopen Steam or return to Gaming Mode. Updates download while you play and apply next launch.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Memento: {error}', file=sys.stderr)
        sys.exit(1)
