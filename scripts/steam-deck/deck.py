#!/usr/bin/env python3
"""Moebius Steam Deck installer, background updater, and Steam integration.

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
import struct
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import zlib

BASE_URL = 'https://github.com/rnaud/moebius/releases/download/steam-deck/'
MANIFEST_URL = BASE_URL + 'steam-deck.json'
ROOT = Path.home() / '.local/share/moebius-deck'
MAX_ARCHIVE = 1024 * 1024 * 1024


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
    appid = zlib.crc32((exe + 'Moebius').encode()) | 0x80000000
    entries.append((str(len(entries)), [
        ('appid', appid), ('AppName', 'Moebius'), ('Exe', exe),
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


def write_launchers(root):
    script = '#!/bin/sh\nexec python3 ' + shlex.quote(str(root / 'current/resources/app/deck.py')) + ' --launch "$@"\n'
    atomic_write(root / 'launch', script.encode(), 0o755)
    atomic_write(root / 'icon.png', (root / 'current/resources/app/game/icons/icon-512.png').read_bytes())
    # Desktop Exec quoting is not shell quoting; escape its reserved characters.
    command = str(root / 'launch').replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    entry = f'[Desktop Entry]\nType=Application\nName=Moebius\nExec="{command}"\nIcon={root / "icon.png"}\nTerminal=false\nCategories=Game;\n'
    atomic_write(Path.home() / '.local/share/applications/moebius.desktop', entry.encode(), 0o755)


def launch(root, arguments):
    # Resolve before starting the updater. This process runs its immutable build;
    # the background update only affects the next launch. Saves live elsewhere.
    # Hold the short activation lock, never the potentially long download lock.
    with (root / 'state.lock').open('a') as state:
        fcntl.flock(state, fcntl.LOCK_SH)
        current = (root / 'current').resolve(strict=True)
        pin = (current / '.in-use').open('a')
        fcntl.flock(pin, fcntl.LOCK_SH)
    with pin:
        with (root / 'update.log').open('w') as log:
            subprocess.Popen([sys.executable, str(current / 'resources/app/deck.py'), '--update'],
                             stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        # Keep the pin until Electron exits, so updates cannot remove its assets.
        result = subprocess.run([str(current / 'moebius'), *arguments], check=False)
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--launch', action='store_true')
    parser.add_argument('--update', action='store_true')
    parser.add_argument('--register-steam', action='store_true')
    args, extra = parser.parse_known_args()
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64'):
        parser.error('This package requires Linux x86-64 (Steam Deck).')
    if args.launch:
        launch(ROOT, extra)
        return
    if extra:
        parser.error('Unknown arguments: ' + ' '.join(extra))
    if not args.register_steam:
        print('Checking for a Moebius update…', flush=True)
        changed = install_update(ROOT, get_manifest())
        print('Update installed. It will be used on the next launch.' if changed else 'Already up to date.', flush=True)
    if args.update:
        return
    write_launchers(ROOT)
    configs = steam_configs(Path.home())
    if not configs:
        raise RuntimeError('Game installed. Open Steam and sign in once, then rerun this installer to add it to the library.')
    if steam_running():
        print('Game installed. Exit Steam using Steam → Exit; this installer will add Moebius automatically once Steam closes.', flush=True)
        deadline = time.monotonic() + 300
        while steam_running() and time.monotonic() < deadline:
            time.sleep(1)
        if steam_running():
            raise RuntimeError('Still waiting for Steam. Close it and rerun the installer with --register-steam.')
        time.sleep(2)  # allow Steam to finish flushing its configuration
    for config in configs:
        add_shortcut(config, ROOT)
    print('Moebius is installed and added to Steam. Reopen Steam or return to Gaming Mode. Updates download while you play and apply next launch.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Moebius: {error}', file=sys.stderr)
        sys.exit(1)
