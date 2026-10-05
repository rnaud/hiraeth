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
import zipfile

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

    def bundle(self, build, malicious=None, web=600, desktop=1):
        source = self.home / f'{build}.tar.gz'
        files = {
            'moebius': b'#!/bin/sh\nexit 0\n',
            'resources/app/deck.py': b'# updater',
            'resources/app/main.mjs': b'// game',
            'resources/app/game/index.html': b'<html>game</html>',
            'resources/app/game/icons/icon-512.png': b'icon',
            'resources/app/build.json': json.dumps({'build': build, 'version': '0.34'}).encode(),
        }
        if web is not None:
            files['resources/app/content.json'] = json.dumps({'web': web, 'desktop': desktop}).encode()
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


class ContentUpdateTests(unittest.TestCase):
    """The game itself, from the game's site: the web bundle the Android app takes too."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle

    def setUp(self):
        self.setUp_base()
        runtime, fetch = self.bundle(1001, web=600)
        deck.install_update(self.root, runtime, fetch)
        self.current = (self.root / 'current').resolve()

    def content(self, build, min_desktop=1, files=None, entries=()):
        source = self.home / f'web-{build}.zip'
        files = files or {'index.html': f'<html>game {build}</html>'.encode(), 'assets/main.js': b'game()'}
        with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                info = zipfile.ZipInfo(name)
                info.external_attr = 0o100644 << 16
                archive.writestr(info, data)
            for info, data in entries:
                archive.writestr(info, data)
        data = source.read_bytes()
        manifest = {'build': build, 'version': '0.60', 'zip': deck.CONTENT_URL + f'web-{build}.zip',
                    'sha256': hashlib.sha256(data).hexdigest(), 'minNative': 4, 'minDesktop': min_desktop,
                    'size': len(data), 'notes': []}
        return manifest, lambda _manifest, target: shutil.copyfile(source, target)

    def test_the_site_is_the_feed(self):
        self.assertEqual(deck.CONTENT_MANIFEST_URL, 'https://memento.alexandria-rnaud.workers.dev/updates/web.json')
        self.assertTrue(deck.MANIFEST_URL.startswith('https://' + 'github.com/rnaud/moebius/releases/download/steam-deck/'),
                        'the runtime package stays on the release (by hand once the repository is private)')

    def test_a_newer_game_is_unpacked_and_served_next_launch(self):
        self.assertIsNone(deck.choose_content(self.root, self.current), 'nothing downloaded: the packaged game')
        manifest, fetch = self.content(601)
        self.assertTrue(deck.install_content(self.root, manifest, fetch))
        game = self.root / 'web/601'
        self.assertEqual((game / 'index.html').read_text(), '<html>game 601</html>')
        self.assertEqual(json.loads((game / 'bundle.json').read_text())['build'], 601)
        self.assertEqual(deck.choose_content(self.root, self.current), game)
        self.assertEqual(deck.game_env(game)['MOEBIUS_GAME'], str(game))
        self.assertNotIn('MOEBIUS_GAME', deck.game_env(None))
        self.assertFalse(deck.install_content(self.root, manifest, fetch), 'already here')
        self.assertFalse(list((self.root / 'web').glob('.download-*')))

    def test_only_newer_than_the_packaged_game(self):
        for build in (599, 600):
            manifest, fetch = self.content(build)
            self.assertFalse(deck.install_content(self.root, manifest, fetch))
        self.assertFalse(list((self.root / 'web').glob('[0-9]*')))
        # a newer runtime carries a newer game: an older download is not served any more
        manifest, fetch = self.content(601)
        deck.install_content(self.root, manifest, fetch)
        runtime, fetch = self.bundle(2001, web=605)
        deck.install_update(self.root, runtime, fetch)
        self.assertIsNone(deck.choose_content(self.root, (self.root / 'current').resolve()))

    def test_bad_checksum_and_unsafe_archives_change_nothing(self):
        manifest, fetch = self.content(601)
        manifest['sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            deck.install_content(self.root, manifest, fetch)
        link = zipfile.ZipInfo('escape')
        link.external_attr = 0o120777 << 16
        for i, entry in enumerate([(zipfile.ZipInfo('../../escaped'), b'x'), (link, b'/tmp')]):
            manifest, fetch = self.content(602 + i, entries=[entry])
            with self.assertRaises(ValueError):
                deck.install_content(self.root, manifest, fetch)
        manifest, fetch = self.content(605, files={'readme.txt': b'no game'})
        with self.assertRaises(ValueError):
            deck.install_content(self.root, manifest, fetch)
        self.assertFalse(list((self.root / 'web').glob('[0-9]*')))
        self.assertFalse(list((self.root / 'web').glob('.download-*')))
        self.assertFalse((self.home / 'escaped').exists())

    def test_a_game_for_a_newer_runtime_waits(self):
        manifest, fetch = self.content(601, min_desktop=2)
        self.assertFalse(deck.install_content(self.root, manifest, fetch))
        self.assertFalse((self.root / 'web/601').exists())

    def test_runtimes_from_before_content_updates_take_none(self):
        runtime, fetch = self.bundle(2001, web=None)
        deck.install_update(self.root, runtime, fetch)
        current = (self.root / 'current').resolve()
        self.assertEqual(deck.runtime_content(current), {'web': 0, 'desktop': 0})
        manifest, fetch = self.content(601)
        self.assertFalse(deck.install_content(self.root, manifest, fetch))

    def test_a_game_that_failed_to_start_is_skipped_for_good(self):
        for build in (601, 602):
            manifest, fetch = self.content(build)
            deck.install_content(self.root, manifest, fetch)
        (self.root / 'web/602/.failed').write_text('x')   # (desktop/main.mjs marks it)
        self.assertEqual(deck.choose_content(self.root, self.current), self.root / 'web/601')
        manifest, fetch = self.content(602)
        self.assertFalse(deck.install_content(self.root, manifest, fetch), 'not downloaded again')

    def test_pruning_keeps_the_running_game_and_newest_two(self):
        manifest, fetch = self.content(601)
        deck.install_content(self.root, manifest, fetch)
        with (self.root / 'web/601/.in-use').open('a') as pin:
            fcntl.flock(pin, fcntl.LOCK_SH)
            for build in (602, 603):
                manifest, fetch = self.content(build)
                deck.install_content(self.root, manifest, fetch)
            self.assertTrue((self.root / 'web/601').exists())
        manifest, fetch = self.content(604)
        deck.install_content(self.root, manifest, fetch)
        self.assertEqual(sorted(p.name for p in (self.root / 'web').glob('[0-9]*')), ['603', '604'])

    def test_rejects_foreign_or_incomplete_manifests(self):
        manifest, _ = self.content(601)
        deck.validate_content_manifest(manifest)
        for key, value in [('zip', 'https://example.com/web-601.zip'), ('build', True), ('minDesktop', None),
                           ('size', deck.MAX_CONTENT + 1), ('sha256', 'nope')]:
            with self.assertRaises(ValueError):
                deck.validate_content_manifest({**manifest, key: value})

    def test_the_runtime_feed_failing_never_holds_back_the_game(self):
        manifest, fetch = self.content(601)

        def private():
            raise OSError('HTTP Error 404: Not Found')
        with patch('sys.stderr', io.StringIO()), patch('sys.stdout', io.StringIO()):
            failures = deck.update_all(self.root, runtime=private,
                                       content=lambda: deck.install_content(self.root, manifest, fetch))
        self.assertEqual(failures, ['runtime'])
        self.assertTrue((self.root / 'web/601/index.html').is_file())

    def test_launch_serves_the_downloaded_game_and_pins_it(self):
        manifest, fetch = self.content(601)
        deck.install_content(self.root, manifest, fetch)
        seen = {}

        def run(command, check, env):
            seen['env'] = env.get('MOEBIUS_GAME')
            with (self.root / 'web/601/.in-use').open('a') as lock:
                with self.assertRaises(BlockingIOError):
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return type('Done', (), {'returncode': 0})()
        with patch.object(deck.subprocess, 'Popen'), patch.object(deck.subprocess, 'run', side_effect=run):
            with self.assertRaises(SystemExit):
                deck.launch(self.root, [])
        self.assertEqual(seen['env'], str(self.root / 'web/601'))

    def test_installs_a_package_downloaded_by_hand(self):
        runtime, _ = self.bundle(3001)
        folder = self.home / 'Downloads'
        folder.mkdir()
        shutil.copyfile(self.home / '3001.tar.gz', folder / 'moebius-steam-deck-3001.tar.gz')
        (folder / 'steam-deck.json').write_text(json.dumps(runtime))
        manifest, copy = deck.local_package(folder)
        self.assertTrue(deck.install_update(self.root, manifest, copy))
        self.assertEqual(deck.installed_build(self.root), 3001)
        (folder / 'moebius-steam-deck-3001.tar.gz').unlink()
        with self.assertRaises(ValueError):
            deck.local_package(folder)

    def test_todays_updaters_accept_the_new_package(self):
        # they check build.json is exactly {build, version}: the packaged game's build goes in content.json
        source = (Path(__file__).resolve().parents[1] / 'scripts/package-steam-deck.mjs').read_text()
        self.assertIn('/source/build.json`, JSON.stringify({ build, version: VERSION }))', source)
        self.assertIn('/source/content.json`, JSON.stringify({ web: webBuild, desktop: desktopApi() }))', source)


if __name__ == '__main__':
    unittest.main()
