import fcntl
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('deck', Path(__file__).resolve().parents[1] / 'scripts/steam-deck/deck.py')
deck = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deck)


class SteamDeckTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name).resolve()
        self.root = self.home / 'game with spaces'
        self.config = self.home / '.local/share/Steam/userdata/123/config'
        self.config.mkdir(parents=True)
        self.steam = patch.object(deck, 'steam_running', return_value=False)
        self.steam.start()
        self.addCleanup(self.steam.stop)

    def bundle(self, build, malicious=None):
        source = self.home / f'{build}.tar.gz'
        files = {
            'moebius': b'#!/bin/sh\nexit 0\n',
            'resources/app/deck.py': b'# updater',
            'resources/app/main.mjs': b'// game',
            'resources/app/game/index.html': b'<html>game</html>',
            'resources/app/game/icons/icon-512.png': b'icon',
            'resources/app/build.json': json.dumps({'build': build, 'version': '0.34'}).encode(),
        }
        with tarfile.open(source, 'w:gz') as archive:
            for name, data in files.items():
                item = tarfile.TarInfo(name)
                item.size = len(data)
                item.mode = 0o755 if name == 'moebius' else 0o644
                archive.addfile(item, io.BytesIO(data))
            if malicious:
                archive.addfile(malicious, io.BytesIO(b'x' * malicious.size))
        manifest = {'build': build, 'version': '0.34', 'url': deck.BASE_URL + f'moebius-steam-deck-{build}.tar.gz',
                    'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
        return manifest, lambda _manifest, target: shutil.copyfile(source, target)

    def test_preserves_other_shortcuts_unknown_fields_and_raw_bytes(self):
        tree = [('shortcuts', [('0', [('appid', 4294967295), ('AppName', 'Other'),
                 ('Exe', '"/other"'), ('future', 'raw\udcff'), ('tags', [('0', 'Favorites')])])]), ('futureRoot', 10)]
        path = self.config / 'shortcuts.vdf'
        original = deck.encode_vdf(tree)
        path.write_bytes(original)
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        result = deck.parse_vdf(path.read_bytes())
        self.assertEqual(result[0][1][0], tree[0][1][0])
        self.assertEqual(result[1], tree[1])
        self.assertEqual(next(self.config.glob('*.bak')).read_bytes(), original)
        added = result[0][1][1][1]
        self.assertEqual(deck.field(added, 'Exe'), f'"{self.root / "launch"}"')
        self.assertTrue(deck.field(added, 'appid') & 0x80000000)
        first = path.read_bytes()
        self.assertFalse(deck.add_shortcut(self.config, self.root))
        self.assertEqual(path.read_bytes(), first)

    def test_corrupt_shortcuts_never_overwritten(self):
        path = self.config / 'shortcuts.vdf'
        for blob in [b'\0shortcuts\0', b'\x07unknown\0\x08', b'\x08extra']:
            path.write_bytes(blob)
            with self.assertRaises(ValueError):
                deck.add_shortcut(self.config, self.root)
            self.assertEqual(path.read_bytes(), blob)

    def test_running_steam_is_not_modified(self):
        with patch.object(deck, 'steam_running', return_value=True):
            with self.assertRaises(RuntimeError):
                deck.add_shortcut(self.config, self.root)
        self.assertFalse((self.config / 'shortcuts.vdf').exists())

    def test_detects_steam_starting_during_registration(self):
        with patch.object(deck, 'steam_running', side_effect=[False, True]):
            with self.assertRaises(RuntimeError):
                deck.add_shortcut(self.config, self.root)
        self.assertFalse((self.config / 'shortcuts.vdf').exists())

    def test_deduplicates_steam_roots_and_finds_multiple_accounts(self):
        (self.home / '.steam').mkdir()
        (self.home / '.steam/steam').symlink_to(self.home / '.local/share/Steam')
        second = self.home / '.local/share/Steam/userdata/456/config'
        second.mkdir(parents=True)
        self.assertEqual(deck.steam_configs(self.home), sorted([self.config, second]))

    def test_install_update_and_monotonic_builds(self):
        one, fetch = self.bundle(1001)
        self.assertTrue(deck.install_update(self.root, one, fetch))
        self.assertEqual(deck.installed_build(self.root), 1001)
        self.assertTrue((self.root / 'current/moebius').stat().st_mode & 0o111)
        self.assertFalse(deck.install_update(self.root, one, fetch))
        two, fetch = self.bundle(2001)
        self.assertTrue(deck.install_update(self.root, two, fetch))
        self.assertEqual(deck.installed_build(self.root), 2001)
        self.assertFalse(deck.install_update(self.root, one, fetch))

    def test_bad_checksum_preserves_previous_install(self):
        one, fetch = self.bundle(1001)
        deck.install_update(self.root, one, fetch)
        two, fetch = self.bundle(2001)
        two['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            deck.install_update(self.root, two, fetch)
        self.assertEqual(deck.installed_build(self.root), 1001)
        self.assertFalse((self.root / 'versions/2001').exists())

    def test_failed_download_preserves_previous_install(self):
        one, fetch = self.bundle(1001)
        deck.install_update(self.root, one, fetch)
        two, _ = self.bundle(2001)
        def interrupted(_manifest, target):
            target.write_bytes(b'partial')
            raise OSError('offline')
        with self.assertRaises(OSError):
            deck.install_update(self.root, two, interrupted)
        self.assertEqual(deck.installed_build(self.root), 1001)
        self.assertFalse(list((self.root / 'versions').glob('.download-*')))

    def test_rejects_archive_traversal_and_symlinks(self):
        for i, kind in enumerate(['path', 'symlink']):
            entry = tarfile.TarInfo('../../escaped' if kind == 'path' else 'escape')
            if kind == 'symlink':
                entry.type = tarfile.SYMTYPE
                entry.linkname = '/tmp'
            manifest, fetch = self.bundle(3001 + i, entry)
            with self.assertRaises(ValueError):
                deck.install_update(self.root, manifest, fetch)
        self.assertFalse((self.root / 'current').exists())

    def test_rejects_foreign_feed_urls_and_bad_builds(self):
        manifest, _ = self.bundle(1001)
        for key, value in [('url', 'https://example.com/game.tar.gz'), ('build', True), ('build', -1)]:
            invalid = {**manifest, key: value}
            with self.assertRaises(ValueError):
                deck.validate_manifest(invalid)

    def test_parallel_update_skips_without_modifying_files(self):
        self.root.mkdir()
        with (self.root / 'update.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            manifest, fetch = self.bundle(1001)
            self.assertFalse(deck.install_update(self.root, manifest, fetch))
        self.assertFalse((self.root / 'current').exists())

    def test_pruning_keeps_running_build_and_newest_two(self):
        one, fetch = self.bundle(1001)
        deck.install_update(self.root, one, fetch)
        with (self.root / 'current/.in-use').open('a') as pin:
            fcntl.flock(pin, fcntl.LOCK_SH)
            for build in [2001, 3001]:
                manifest, fetch = self.bundle(build)
                deck.install_update(self.root, manifest, fetch)
            self.assertTrue((self.root / 'versions/1001').exists())
        manifest, fetch = self.bundle(4001)
        deck.install_update(self.root, manifest, fetch)
        self.assertEqual(sorted(p.name for p in (self.root / 'versions').iterdir()), ['3001', '4001'])

    def test_retry_recovers_interrupted_activation(self):
        manifest, fetch = self.bundle(1001)
        stale = self.root / 'versions/1001'
        stale.mkdir(parents=True)
        (stale / 'partial').write_text('old')
        self.assertTrue(deck.install_update(self.root, manifest, fetch))
        self.assertFalse((stale / 'partial').exists())


if __name__ == '__main__':
    unittest.main()
