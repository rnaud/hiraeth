import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import zipfile
import zlib

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
            'hiraeth': b'#!/bin/sh\nexit 0\n',
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
                item.mode = 0o755 if name == 'hiraeth' else 0o644
                archive.addfile(item, io.BytesIO(data))
            if malicious:
                archive.addfile(malicious, io.BytesIO(b'x' * malicious.size))
        manifest = {'build': build, 'version': '0.34', 'url': deck.BASE_URL + f'hiraeth-steam-deck-{build}.tar.gz',
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
        self.assertTrue((self.root / 'current/hiraeth').stat().st_mode & 0o111)
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
        self.assertEqual(deck.CONTENT_MANIFEST_URL, 'https://hiraeth.alexandria-rnaud.workers.dev/updates/web.json')
        self.assertTrue(deck.MANIFEST_URL.startswith('https://' + 'github.com/rnaud/hiraeth/releases/download/steam-deck/'),
                        'the runtime package stays on the release (by hand once the repository is private)')

    def test_a_newer_game_is_unpacked_and_served_next_launch(self):
        self.assertIsNone(deck.choose_content(self.root, self.current), 'nothing downloaded: the packaged game')
        manifest, fetch = self.content(601)
        self.assertTrue(deck.install_content(self.root, manifest, fetch))
        game = self.root / 'web/601'
        self.assertEqual((game / 'index.html').read_text(), '<html>game 601</html>')
        self.assertEqual(json.loads((game / 'bundle.json').read_text())['build'], 601)
        self.assertEqual(deck.choose_content(self.root, self.current), game)
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
                                       content=lambda: deck.install_content(self.root, manifest, fetch),
                                       unity=lambda: False, art=lambda: False)
        self.assertEqual(failures, ['runtime'])
        self.assertTrue((self.root / 'web/601/index.html').is_file())

    def test_installs_a_package_downloaded_by_hand(self):
        runtime, _ = self.bundle(3001)
        folder = self.home / 'Downloads'
        folder.mkdir()
        shutil.copyfile(self.home / '3001.tar.gz', folder / 'hiraeth-steam-deck-3001.tar.gz')
        (folder / 'steam-deck.json').write_text(json.dumps(runtime))
        manifest, copy = deck.local_package(folder)
        self.assertTrue(deck.install_update(self.root, manifest, copy))
        self.assertEqual(deck.installed_build(self.root), 3001)
        (folder / 'hiraeth-steam-deck-3001.tar.gz').unlink()
        with self.assertRaises(ValueError):
            deck.local_package(folder)

    def test_todays_updaters_accept_the_new_package(self):
        # they check build.json is exactly {build, version}: the packaged game's build goes in content.json
        source = (Path(__file__).resolve().parents[1] / 'scripts/package-steam-deck.mjs').read_text()
        self.assertIn('/source/build.json`, JSON.stringify({ build, version: VERSION }))', source)
        self.assertIn('/source/content.json`, JSON.stringify({ web: webBuild, desktop: desktopApi() }))', source)


class SiteRuntimeTests(unittest.TestCase):
    """The runtime from the game's site, in parts (scripts/deck-runtime.mjs): the GitHub release is private."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle

    def site_manifest(self, build, part=7):
        github, _ = self.bundle(build)
        data = (self.home / f'{build}.tar.gz').read_bytes()
        chunks = [data[i:i + part] for i in range(0, len(data), part)]
        manifest = {'build': build, 'version': '0.34', 'sha256': github['sha256'], 'size': len(data), 'key': 'k',
                    'parts': [deck.CONTENT_URL + f'steam-deck-{build}.tar.gz.{i:03d}' for i in range(len(chunks))]}
        return manifest, dict(zip(manifest['parts'], chunks))

    def setUp(self):
        self.setUp_base()

    def test_installs_from_the_sites_parts(self):
        manifest, served = self.site_manifest(795001)
        deck.validate_manifest(manifest)
        opened = []

        def urlopen(request, timeout):
            opened.append(request.full_url)
            return io.BytesIO(served[request.full_url])
        with patch.object(deck.urllib.request, 'urlopen', side_effect=urlopen):
            self.assertTrue(deck.install_update(self.root, manifest))
        self.assertEqual(opened, manifest['parts'])
        self.assertEqual(deck.installed_build(self.root), 795001)

    def test_a_missing_or_foreign_part_changes_nothing(self):
        manifest, served = self.site_manifest(795001)
        short = dict(served)
        short[manifest['parts'][-1]] = b''
        with patch.object(deck.urllib.request, 'urlopen', side_effect=lambda request, timeout: io.BytesIO(short[request.full_url])):
            with self.assertRaises(ValueError):
                deck.install_update(self.root, manifest)
        self.assertFalse((self.root / 'current').exists())
        for bad in ({'parts': ['https://example.com/steam-deck-795001.tar.gz.000']},
                    {'parts': manifest['parts'][1:]}, {'parts': []}, {'size': 0}):
            with self.assertRaises(ValueError):
                deck.validate_manifest({**manifest, **bad})

    def test_the_newest_feed_wins_and_github_failing_is_quiet(self):
        site, _ = self.site_manifest(795001)
        github, _ = self.bundle(189001)

        def fetch(url):
            if url == deck.RUNTIME_SITE_URL:
                return site
            raise OSError('HTTP Error 404: Not Found')   # the private repository
        self.assertEqual(deck.get_manifest(fetch)['build'], 795001)
        self.assertEqual(deck.get_manifest(lambda url: site if url == deck.RUNTIME_SITE_URL else github)['build'], 795001)
        newer, _ = self.bundle(796001)
        self.assertEqual(deck.get_manifest(lambda url: site if url == deck.RUNTIME_SITE_URL else newer)['build'], 796001)
        with self.assertRaises(ValueError):
            deck.get_manifest(lambda url: (_ for _ in ()).throw(OSError('offline')))


class SettingsUpdateTests(unittest.TestCase):
    """The settings' Updates section on the Deck (desktop/deck-updates.mjs): --status, --update --progress, Restart now."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle
    content = ContentUpdateTests.content

    def setUp(self):
        self.setUp_base()
        runtime, fetch = self.bundle(1001, web=600)
        deck.install_update(self.root, runtime, fetch)

    def test_status_says_what_is_here_and_what_is_new(self):
        manifest, fetch = self.content(601)
        local = deck.local_state(self.root)
        self.assertEqual((local['runtime'], local['nextWeb'], local['desktop']), (1001, 600, 1))
        deck.install_content(self.root, manifest, fetch)
        self.assertEqual(deck.local_state(self.root)['nextWeb'], 601, 'what the next launch serves')
        newer, _ = self.content(602)
        state = deck.status(self.root, content=lambda: newer, runtime=lambda: (_ for _ in ()).throw(OSError('404')))
        self.assertEqual((state['game']['build'], state['game']['minDesktop']), (602, 1))
        self.assertIn('runtimeError', state)
        self.assertGreater(state['checkedAt'], 0)
        import urllib.error
        state = deck.status(self.root, content=lambda: (_ for _ in ()).throw(urllib.error.URLError('no network')), runtime=lambda: None)
        self.assertTrue(state['offline'])

    def test_downloads_report_their_progress(self):
        manifest, fetch = self.content(601)
        data = (self.home / 'web-601.zip').read_bytes()
        file = self.home / 'progress.json'
        with patch.object(deck, 'PROGRESS', file), patch.object(deck.urllib.request, 'urlopen', return_value=io.BytesIO(data)):
            deck.download_content(manifest, self.home / 'out.zip')
            deck.progress('done', 0, 0, done=True)
        self.assertEqual(json.loads(file.read_text())['step'], 'done')

    def test_the_restart_exit_is_not_a_crash(self):
        how = deck.run_game([sys.executable, '-c', f'import sys; sys.exit({deck.RESTART_EXIT})'], dict(os.environ),
                            self.home / '.ready', log=lambda _line: None)
        self.assertEqual(how[:2], ('restart', deck.RESTART_EXIT))


class SteamArtTests(unittest.TestCase):
    """Steam's library artwork for the shortcut, in each account's config/grid/."""

    setUp_base = SteamDeckTests.setUp

    def setUp(self):
        self.setUp_base()
        self.app = self.home / 'app'
        for name in deck.STEAM_ART.values():
            (self.app / name).parent.mkdir(parents=True, exist_ok=True)
            (self.app / name).write_bytes(f'art {name}'.encode())
        deck.add_shortcut(self.config, self.root)

    def test_the_shortcuts_app_id_names_the_art(self):
        appid = deck.shortcut_appid(self.root)
        self.assertEqual(appid, zlib.crc32((f'"{self.root / "launch"}"' + 'Hiraeth').encode()) | 0x80000000)
        self.assertEqual(deck.shortcut_appids(self.config, self.root), [appid])
        self.assertEqual(deck.install_art(self.root, [self.config], self.app), 5)
        grid = sorted(path.name for path in (self.config / 'grid').iterdir())
        self.assertEqual(grid, sorted(f'{appid}{suffix}' for suffix in ('p.png', '.png', '_hero.png', '_logo.png', '_icon.png')))
        self.assertEqual((self.config / f'grid/{appid}p.png').read_bytes(), b'art steam/portrait.png')
        self.assertEqual((self.config / f'grid/{appid}_icon.png').read_bytes(), b'art game/icons/icon-512.png')
        self.assertEqual(deck.install_art(self.root, [self.config], self.app), 0, 'nothing to do the second time')

    def test_new_art_replaces_ours_but_never_the_players(self):
        appid = deck.shortcut_appid(self.root)
        deck.install_art(self.root, [self.config], self.app)
        (self.config / f'grid/{appid}_hero.png').write_bytes(b'the player\'s own hero')
        for name in deck.STEAM_ART.values():
            (self.app / name).write_bytes(f'new art {name}'.encode())
        self.assertEqual(deck.install_art(self.root, [self.config], self.app), 4, 'all but the player\'s')
        self.assertEqual((self.config / f'grid/{appid}_hero.png').read_bytes(), b'the player\'s own hero')
        self.assertEqual((self.config / f'grid/{appid}.png').read_bytes(), b'new art steam/wide.png')

    def old_shortcut(self, name='', icon=''):
        document = deck.parse_vdf((self.config / 'shortcuts.vdf').read_bytes())
        entry = deck.field(deck.field(document, 'shortcuts'), '0')
        deck.set_field(entry, 'AppName', name, lambda _old: True)
        deck.set_field(entry, 'icon', icon, lambda _old: True)
        (self.config / 'shortcuts.vdf').write_bytes(deck.encode_vdf(document))
        return entry

    def entry(self):
        document = deck.parse_vdf((self.config / 'shortcuts.vdf').read_bytes())
        return deck.field(deck.field(document, 'shortcuts'), '0')

    def test_a_nameless_shortcut_is_named_hiraeth_with_its_icon(self):
        self.old_shortcut()
        self.assertTrue(deck.shortcut_stale(self.config, self.root))
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        entry = self.entry()
        self.assertEqual((deck.field(entry, 'AppName'), deck.field(entry, 'icon')), ('Hiraeth', str(self.root / 'icon.png')))
        self.assertEqual(deck.field(entry, 'appid'), deck.shortcut_appid(self.root), 'the same id: its playtime and artwork stay')
        self.assertEqual(len(deck.field(deck.parse_vdf((self.config / 'shortcuts.vdf').read_bytes()), 'shortcuts')), 1, 'no duplicate')
        self.assertFalse(deck.shortcut_stale(self.config, self.root))
        self.assertFalse(deck.add_shortcut(self.config, self.root))

    def test_a_named_shortcut_keeps_its_id_and_gets_an_icon(self):
        self.old_shortcut(name='Hiraeth')
        original_id = deck.field(self.entry(), 'appid')
        self.assertTrue(deck.shortcut_stale(self.config, self.root))
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        self.assertEqual(deck.field(self.entry(), 'AppName'), 'Hiraeth')
        self.assertEqual(deck.field(self.entry(), 'appid'), original_id)
        self.assertEqual(deck.field(self.entry(), 'icon'), str(self.root / 'icon.png'))
        self.assertFalse(deck.shortcut_stale(self.config, self.root))

    def test_a_name_the_player_chose_is_kept(self):
        self.old_shortcut(name='My game', icon='/some/icon.png')
        self.assertFalse(deck.shortcut_stale(self.config, self.root))
        self.assertFalse(deck.add_shortcut(self.config, self.root))
        self.assertEqual(deck.field(self.entry(), 'AppName'), 'My game')

    def test_the_update_renames_only_while_steam_is_closed(self):
        self.old_shortcut()
        with patch.object(deck, 'steam_running', return_value=True):
            deck.steam_entry(self.root, [self.config])
        self.assertEqual(deck.field(self.entry(), 'AppName'), '')
        deck.steam_entry(self.root, [self.config])
        self.assertEqual(deck.field(self.entry(), 'AppName'), 'Hiraeth')

    def test_no_shortcut_no_art_and_shortcuts_vdf_untouched(self):
        other = self.home / '.local/share/Steam/userdata/456/config'
        other.mkdir(parents=True)
        self.assertEqual(deck.install_art(self.root, [other], self.app), 0)
        before = (self.config / 'shortcuts.vdf').read_bytes()
        with patch.object(deck, 'steam_running', return_value=True):   # safe while Steam runs: files only
            deck.install_art(self.root, [self.config], self.app)
        self.assertEqual((self.config / 'shortcuts.vdf').read_bytes(), before)


class LaunchTests(unittest.TestCase):
    """Gaming Mode never left black: a watched start (run_game: the Unity player's), a clean exit, the update apart."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle

    def setUp(self):
        self.setUp_base()
        runtime, fetch = self.bundle(1001, web=600)
        deck.install_update(self.root, runtime, fetch)
        self.ready = self.home / '.ready'

    def script(self, body):
        return [sys.executable, '-c', 'import os, sys, time, subprocess\n' + body]

    def test_a_game_that_shows_its_window_and_closes_is_done(self):
        how = deck.run_game(self.script(f'open({str(self.ready)!r}, "w").write("1")\ntime.sleep(0.5)'),
                            dict(os.environ), self.ready, log=lambda _line: None)
        self.assertEqual(how, ('quit', 0, True))
        self.assertFalse(self.ready.exists())

    def test_a_hung_start_is_killed_and_retried(self):
        started = time.monotonic()
        how = deck.run_game(self.script('time.sleep(60)'), dict(os.environ), self.ready, ready_seconds=1, log=lambda _line: None)
        self.assertEqual(how[0], 'retry')
        self.assertFalse(how[2])
        self.assertLess(time.monotonic() - started, 10)

    def test_a_game_killed_after_it_has_drawn_is_not_retried(self):
        # killed (or crashed) long after its window showed: the way to draw worked, no fallback
        body = f'open({str(self.ready)!r}, "w").write("1")\ntime.sleep(1.5)\nos.kill(os.getpid(), 9)'
        how = deck.run_game(self.script(body), dict(os.environ), self.ready, played_seconds=0.5, log=lambda _line: None)
        self.assertEqual(how, ('ended', -9, True))
        # the same soon after the window showed is still a failed start
        how = deck.run_game(self.script(f'open({str(self.ready)!r}, "w").write("1")\nos.kill(os.getpid(), 9)'),
                            dict(os.environ), self.ready, played_seconds=30, log=lambda _line: None)
        self.assertEqual(how[0], 'retry')

    def test_the_retry_exit_asks_for_the_next_way_to_draw(self):
        how = deck.run_game(self.script(f'sys.exit({deck.RETRY_EXIT})'), dict(os.environ), self.ready, log=lambda _line: None)
        self.assertEqual(how, ('retry', deck.RETRY_EXIT, False))

    def test_no_helper_outlives_the_game(self):
        # a zygote left behind by a browser that died kept Steam's game "running" on a black screen
        marker = self.home / 'helper.pid'
        body = (f'child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])\n'
                f'open({str(marker)!r}, "w").write(str(child.pid))\nos._exit(0)')
        deck.run_game(self.script(body), dict(os.environ), self.ready, log=lambda _line: None)
        helper = int(marker.read_text())
        time.sleep(0.2)
        with self.assertRaises(ProcessLookupError):
            os.kill(helper, 0)

    def test_steam_closing_the_game_closes_it_cleanly(self):
        # Exit Game signals the launcher; it passes it on, then kills what's left
        def close_soon():
            time.sleep(1)
            os.kill(os.getpid(), signal.SIGTERM)
        closer = threading.Thread(target=close_soon)
        closer.start()
        how = deck.run_game(self.script('import signal\nsignal.signal(signal.SIGTERM, signal.SIG_IGN)\nsignal.signal(signal.SIGINT, signal.SIG_IGN)\ntime.sleep(60)'),
                            dict(os.environ), self.ready, stop_seconds=1, log=lambda _line: None)
        closer.join()
        self.assertEqual(how[:2], ('quit', 0))

    def test_the_update_runs_outside_the_game(self):
        # in its own systemd unit, so Steam doesn't wait for a download before it counts the game closed
        current = (self.root / 'current').resolve()
        with patch.object(deck.shutil, 'which', return_value='/usr/bin/systemd-run'), \
                patch.object(deck.subprocess, 'run') as run, patch.object(deck.subprocess, 'Popen') as popen:
            self.assertEqual(deck.start_updater(self.root, current), 'systemd')
        command = run.call_args.args[0]
        self.assertEqual(command[:2], ['/usr/bin/systemd-run', '--user'])
        # (an install elsewhere than the usual folder updates itself, never the usual one)
        self.assertEqual(command[-4:], [str(current / 'resources/app/deck.py'), '--root', str(self.root), '--update'])
        self.assertIn(f'StandardOutput=truncate:{self.root / "update.log"}', command)
        popen.assert_not_called()
        with patch.object(deck, 'ROOT', self.root), patch.object(deck.shutil, 'which', return_value='/usr/bin/systemd-run'), \
                patch.object(deck.subprocess, 'run') as run:
            deck.start_updater(self.root, current)
        self.assertEqual(run.call_args.args[0][-2:], [str(current / 'resources/app/deck.py'), '--update'])
        with patch.dict(os.environ, {'HIRAETH_NO_UPDATE': '1'}), patch.object(deck.subprocess, 'run') as run:
            self.assertEqual(deck.start_updater(self.root, current), 'off')
        run.assert_not_called()
        with patch.object(deck.shutil, 'which', return_value=None), patch.object(deck.subprocess, 'Popen') as popen:
            self.assertEqual(deck.start_updater(self.root, current), 'child')
        self.assertTrue(popen.call_args.kwargs['start_new_session'])


class OneShortcutTests(unittest.TestCase):
    """One Steam shortcut, "Hiraeth" (issue #484): the second shortcuts the Deck had, "Hiraeth (Unity)" (issue #146) and
    then "Hiraeth (web)" (D19), leave shortcuts.vdf at the next update that finds Steam closed, and never come back."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle

    def setUp(self):
        self.setUp_base()
        self.vdf = self.config / 'shortcuts.vdf'

    def entries(self):
        return deck.field(deck.parse_vdf(self.vdf.read_bytes()), 'shortcuts')

    def by_exe(self, launcher):
        return [value for _, value in self.entries() if deck.field(value, 'Exe') == f'"{self.root / launcher}"']

    def second(self, launcher, name, appid, icon):
        return [('appid', appid), ('AppName', name), ('Exe', f'"{self.root / launcher}"'), ('icon', icon), ('LastPlayTime', 5)]

    def test_a_fresh_account_gets_only_hiraeth(self):
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        self.assertEqual([deck.field(value, 'AppName') for _, value in self.entries()], ['Hiraeth'])
        main = self.by_exe('launch')[0]
        self.assertEqual(deck.field(main, 'appid'), zlib.crc32((f'"{self.root / "launch"}"' + 'Hiraeth').encode()) | 0x80000000)
        self.assertEqual(deck.field(main, 'icon'), str(self.root / 'icon.png'))
        self.assertFalse(deck.shortcut_stale(self.config, self.root))
        self.assertFalse(deck.add_shortcut(self.config, self.root))

    def test_an_existing_shortcuts_file_keeps_its_entries(self):
        other = ('0', [('appid', 7), ('AppName', 'Other'), ('Exe', '"/other"')])
        original = deck.encode_vdf([('shortcuts', [other])])
        self.vdf.write_bytes(original)
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        self.assertEqual(self.entries()[0], other)
        self.assertEqual([deck.field(value, 'AppName') for _, value in self.entries()], ['Other', 'Hiraeth'])
        self.assertEqual(next(self.config.glob('*.bak')).read_bytes(), original)

    def test_the_web_and_unity_shortcuts_leave_steam_while_it_is_closed(self):
        deck.add_shortcut(self.config, self.root)
        main = self.by_exe('launch')[0]
        deck.set_field(main, 'AppName', 'My own name', lambda _old: True)
        main.append(('LaunchOptions2', 'the player\'s'))
        other = [('appid', 7), ('AppName', 'Other'), ('Exe', '"/other"')]
        web = self.second('launch-web', 'Hiraeth (web)', 3000000001, str(self.root / 'icon-web.png'))
        preview = self.second('launch-unity', 'My Unity test', 3000000002, '/my/icon.png')   # (named by the player: still ours)
        self.vdf.write_bytes(deck.encode_vdf([('shortcuts', [('0', other), ('1', main), ('2', web), ('3', preview)])]))
        before = self.vdf.read_bytes()
        self.assertTrue(deck.shortcut_stale(self.config, self.root))
        # Steam running: nothing written (it rewrites shortcuts.vdf from memory as it exits)
        with patch.object(deck, 'steam_running', return_value=True):
            deck.steam_entry(self.root, [self.config])
        self.assertEqual(self.vdf.read_bytes(), before)
        self.assertTrue(deck.steam_entry(self.root, [self.config]))
        self.assertEqual(self.entries(), [('0', other), ('1', main)], 'the player\'s edits to the game\'s shortcut stay')
        self.assertIn(before, [path.read_bytes() for path in self.config.glob('*.bak')])
        self.assertFalse(deck.shortcut_stale(self.config, self.root))
        # and never added again: the next updates and the installer leave it at one
        backups = len(list(self.config.glob('*.bak')))
        deck.steam_entry(self.root, [self.config])
        self.assertFalse(deck.add_shortcut(self.config, self.root))
        self.assertEqual((len(self.entries()), len(list(self.config.glob('*.bak')))), (2, backups))
        self.assertFalse(self.by_exe('launch-web') or self.by_exe('launch-unity'))

    def test_an_account_without_the_game_gets_nothing_from_the_update(self):
        web = self.second('launch-web', 'Hiraeth (web)', 3000000001, '')
        self.vdf.write_bytes(deck.encode_vdf([('shortcuts', [('0', web)])]))
        before = self.vdf.read_bytes()
        deck.steam_entry(self.root, [self.config])
        self.assertEqual(self.vdf.read_bytes(), before, 'only an account that has Hiraeth is touched by the update')
        self.vdf.write_bytes(deck.encode_vdf([('shortcuts', [])]))
        deck.steam_entry(self.root, [self.config])
        self.assertEqual(self.entries(), [])

    def test_the_installer_takes_them_out_too(self):
        web = self.second('launch-web', 'Hiraeth (web)', 3000000001, '')
        self.vdf.write_bytes(deck.encode_vdf([('shortcuts', [('0', web)])]))
        self.assertTrue(deck.shortcut_stale(self.config, self.root))
        self.assertTrue(deck.add_shortcut(self.config, self.root))
        self.assertEqual([deck.field(value, 'AppName') for _, value in self.entries()], ['Hiraeth'])

    def test_the_launchers_and_desktop_entries(self):
        runtime, fetch = self.bundle(1001)
        deck.install_update(self.root, runtime, fetch)
        applications = self.home / '.local/share/applications'
        applications.mkdir(parents=True)
        for name in ('hiraeth-unity.desktop', 'hiraeth-web.desktop'):
            (applications / name).write_text('[Desktop Entry]\n')
        for name in ('icon-unity.png', 'icon-web.png'):
            (self.root / name).write_bytes(b'badged')
        deck.write_launchers(self.root, home=self.home)
        for launcher in ('launch', 'launch-unity', 'launch-web'):
            script = (self.root / launcher).read_text()
            self.assertTrue((self.root / launcher).stat().st_mode & 0o111)
            self.assertIn('/current/resources/app/deck.py', script)
            # (a second shortcut Steam still shows, until the next update with Steam closed: the Unity player too)
            self.assertTrue(script.rstrip().endswith(' --launch "$@"'), launcher)
        self.assertEqual(sorted(path.name for path in applications.iterdir()), ['hiraeth.desktop'])
        entry = (applications / 'hiraeth.desktop').read_text()
        self.assertIn('Name=Hiraeth\n', entry)
        self.assertIn(f'Exec="{self.root / "launch"}"', entry)
        self.assertIn(f'Icon={self.root / "icon.png"}\n', entry)
        self.assertFalse((self.root / 'icon-unity.png').exists() or (self.root / 'icon-web.png').exists())
        self.assertEqual((self.root / 'icon.png').read_bytes(), b'icon')

    def test_only_hiraeth_gets_library_art(self):
        app = self.home / 'app'
        for name in deck.STEAM_ART.values():
            (app / name).parent.mkdir(parents=True, exist_ok=True)
            (app / name).write_bytes(f'art {name}'.encode())
        deck.add_shortcut(self.config, self.root)
        document = deck.parse_vdf(self.vdf.read_bytes())
        deck.field(document, 'shortcuts').append(('1', self.second('launch-web', 'Hiraeth (web)', 3000000001, '')))
        self.vdf.write_bytes(deck.encode_vdf(document))   # (Steam open: the web shortcut still there)
        game = deck.shortcut_appid(self.root)
        self.assertEqual(deck.install_art(self.root, [self.config], app), 5)
        self.assertEqual(sorted(path.name for path in (self.config / 'grid').iterdir()),
                         sorted(f'{game}{suffix}' for suffix in deck.STEAM_ART))
        self.assertFalse(hasattr(deck, 'UNITY_ART') or hasattr(deck, 'WEB_ART'))


class RemoveOldInstallTests(unittest.TestCase):
    """--remove-old-install: the install from before the rename (moebius-deck), its shortcuts, art, entries, folder."""

    setUp_base = SteamDeckTests.setUp

    def setUp(self):
        self.setUp_base()
        self.legacy = self.home / '.local/share/moebius-deck'
        (self.legacy / 'versions/1903001').mkdir(parents=True)
        (self.legacy / 'unity-data').mkdir()
        (self.legacy / 'unity-data/prefs').write_text('old preview saves')
        self.vdf = self.config / 'shortcuts.vdf'
        other = ('0', [('appid', 7), ('AppName', 'Other game'), ('Exe', '"/other"')])
        old_game = ('1', [('appid', 2165417005), ('AppName', 'Hiraeth'), ('Exe', f'"{self.legacy / "launch"}"')])
        old_preview = ('2', [('appid', 4192644511), ('AppName', 'Hiraeth (Unity preview)'), ('Exe', f'"{self.legacy / "launch-unity"}"')])
        self.vdf.write_bytes(deck.encode_vdf([('shortcuts', [other, old_game, old_preview])]))
        self.original = self.vdf.read_bytes()
        deck.add_shortcut(self.config, self.root)   # (ours, beside them)
        self.before = self.vdf.read_bytes()
        grid = self.config / 'grid'
        grid.mkdir()
        for name in ('2165417005p.png', '2165417005_hero.png', '4192644511.png', '21654170050.png', '7p.png'):
            (grid / name).write_bytes(name.encode())
        self.apps = self.home / '.local/share/applications'
        self.apps.mkdir(parents=True)
        (self.apps / 'moebius.desktop').write_text(f'[Desktop Entry]\nExec="{self.legacy / "launch"}"\n')
        (self.apps / 'moebius-unity.desktop').write_text(f'[Desktop Entry]\nExec="{self.legacy / "launch-unity"}"\n')
        (self.apps / 'hiraeth.desktop').write_text(f'[Desktop Entry]\nExec="{self.root / "launch"}"\n')

    def names(self):
        return [deck.field(value, 'AppName') for _, value in deck.field(deck.parse_vdf(self.vdf.read_bytes()), 'shortcuts')]

    def test_only_the_old_installs_things_go_into_one_backup(self):
        report = deck.remove_old_install(self.root, home=self.home, configs=[self.config], stamp='t')
        backup = self.root / 'removed-moebius-deck-t'
        self.assertEqual(report['backup'], str(backup))
        self.assertEqual(self.names(), ['Other game', 'Hiraeth'], 'the old two gone; ours and the other kept')
        self.assertEqual([s['appid'] for s in report['shortcuts']], [2165417005, 4192644511])
        self.assertEqual((backup / '123/shortcuts.vdf').read_bytes(), self.before, 'shortcuts.vdf as it was')
        self.assertEqual(sorted(p.name for p in (self.config / 'grid').iterdir()), ['21654170050.png', '7p.png'], 'only those two ids\' art moved')
        self.assertEqual(sorted(p.name for p in (backup / '123/grid').iterdir()), ['2165417005_hero.png', '2165417005p.png', '4192644511.png'])
        self.assertEqual(sorted(p.name for p in self.apps.iterdir()), ['hiraeth.desktop'])
        self.assertEqual(report['desktop'], ['moebius.desktop', 'moebius-unity.desktop'])
        self.assertFalse(self.legacy.exists())
        self.assertEqual((backup / 'moebius-deck/unity-data/prefs').read_text(), 'old preview saves', 'moved, not deleted')
        self.assertEqual(json.loads((backup / 'removed.json').read_text())['folder'], str(self.legacy))
        again = deck.remove_old_install(self.root, home=self.home, configs=[self.config], stamp='u')
        self.assertEqual((again['shortcuts'], again['art'], again['desktop'], again['folder']), ([], [], [], None), 'a second run: nothing')
        self.assertFalse((self.root / 'removed-moebius-deck-u').exists())

    def test_never_while_steam_runs(self):
        with patch.object(deck, 'steam_running', return_value=True):
            with self.assertRaises(RuntimeError):
                deck.remove_old_install(self.root, home=self.home, configs=[self.config], stamp='t')
        self.assertEqual(self.vdf.read_bytes(), self.before)
        self.assertTrue(self.legacy.is_dir())
        self.assertTrue((self.apps / 'moebius.desktop').exists())

    def test_a_desktop_entry_of_that_name_for_something_else_stays(self):
        (self.apps / 'moebius.desktop').write_text('[Desktop Entry]\nExec="/opt/other"\n')
        report = deck.remove_old_install(self.root, home=self.home, configs=[self.config], stamp='t')
        self.assertEqual(report['desktop'], ['moebius-unity.desktop'])
        self.assertTrue((self.apps / 'moebius.desktop').exists())


class UnityPlayerTests(unittest.TestCase):
    """The Unity preview's player, from the unity-linux release: its own component (unity/<sha>/)."""

    setUp_base = SteamDeckTests.setUp

    def setUp(self):
        self.setUp_base()
        self.count = 0

    def player(self, top='bridge-linux', extra=(), files=None):
        """A fake hiraeth-unity-linux.tar.gz: its release JSON (the asset GitHub lists) and a downloader."""
        self.count += 1
        source = self.home / f'player-{self.count}.tar.gz'
        prefix = f'{top}/' if top else ''
        files = files or {
            'hiraeth-js.x86_64': (b'#!/bin/sh\n' + str(self.count).encode(), 0o644),   # (made executable on install)
            'UnityPlayer.so': (b'so', 0o755),
            'hiraeth-js_Data/data.unity3d': (b'data', 0o644),
            'hiraeth-js_BackUpThisFolder_ButDontShipItWithYourGame/huge.cpp': (b'x' * 100, 0o644),
        }
        with tarfile.open(source, 'w:gz') as archive:
            for name, (data, mode) in files.items():
                item = tarfile.TarInfo(prefix + name)
                item.size, item.mode = len(data), mode
                archive.addfile(item, io.BytesIO(data))
            for item in extra:
                archive.addfile(item, io.BytesIO(b'x' * item.size))
        data = source.read_bytes()
        release = {'tag_name': 'unity-linux', 'assets': [
            {'name': 'notes.txt', 'size': 1, 'digest': 'sha256:' + '0' * 64, 'browser_download_url': 'https://example.com/x'},
            {'name': deck.UNITY_ASSET, 'size': len(data), 'digest': 'sha256:' + hashlib.sha256(data).hexdigest(),
             'browser_download_url': deck.UNITY_ASSET_URL}]}
        return release, lambda _manifest, target: shutil.copyfile(source, target)

    def install(self, top='bridge-linux', **kwargs):
        release, fetch = self.player(top, **kwargs)
        manifest = deck.unity_manifest(release)
        return manifest, deck.install_unity(self.root, manifest, fetch)

    def test_the_release_json_names_the_player(self):
        release, _ = self.player()
        manifest = deck.unity_manifest(release)
        self.assertEqual(manifest['url'], 'https://github.com/rnaud/hiraeth/releases/download/unity-linux/hiraeth-unity-linux.tar.gz')
        self.assertEqual(manifest['sha256'], release['assets'][1]['digest'][7:])
        asset = release['assets'][1]
        for bad in ({'browser_download_url': 'https://example.com/hiraeth-unity-linux.tar.gz'}, {'digest': None},
                    {'digest': 'md5:abc'}, {'size': 0}, {'size': deck.MAX_ARCHIVE + 1}, {'name': 'other.tar.gz'}):
            with self.assertRaises(ValueError):
                deck.unity_manifest({'assets': [{**asset, **bad}]})

    def test_the_api_is_asked_with_a_user_agent_and_a_timeout(self):
        release, _ = self.player()
        seen = {}

        def urlopen(request, timeout):
            seen.update(url=request.full_url, agent=request.get_header('User-agent'), timeout=timeout)
            return io.BytesIO(json.dumps(release).encode())
        with patch.object(deck.urllib.request, 'urlopen', side_effect=urlopen):
            self.assertEqual(deck.get_unity_manifest(), deck.unity_manifest(release))
        self.assertEqual(seen['url'], 'https://api.github.com/repos/rnaud/hiraeth/releases/tags/unity-linux')
        self.assertTrue(seen['agent'])
        self.assertLessEqual(seen['timeout'], 30)

    def test_installs_switches_and_keeps_the_one_before(self):
        first, changed = self.install()
        self.assertTrue(changed)
        current = (self.root / 'unity/current').resolve()
        self.assertEqual(current.name, first['sha256'][:12])
        self.assertTrue((current / 'hiraeth-js.x86_64').stat().st_mode & 0o111, 'executable')
        self.assertTrue((current / 'hiraeth-js_Data/data.unity3d').is_file())
        self.assertFalse(list(current.glob('*_BackUpThisFolder_ButDontShipItWithYourGame')), 'the build\'s leftovers stay out')
        self.assertEqual(deck.unity_installed(self.root)['sha256'], first['sha256'])
        self.assertFalse(deck.install_unity(self.root, first, lambda *_: self.fail('not downloaded again')))
        second, _ = self.install(top='')   # (the player at the archive's top works too)
        self.assertEqual((self.root / 'unity/current').resolve().name, second['sha256'][:12])
        self.assertTrue((self.root / 'unity' / first['sha256'][:12]).is_dir(), 'the one before is kept')
        third, _ = self.install()
        players = sorted(path.name for path in (self.root / 'unity').iterdir() if not path.name.startswith('.') and path.is_dir() and path.name != 'current')
        self.assertEqual(players, sorted([second['sha256'][:12], third['sha256'][:12]]))
        self.assertFalse(list((self.root / 'unity').glob('.download-*')))

    def test_a_running_preview_keeps_its_player(self):
        first, _ = self.install()
        with ((self.root / 'unity/current').resolve() / '.in-use').open('a') as pin:
            fcntl.flock(pin, fcntl.LOCK_SH)
            self.install()
            self.install()
            self.assertTrue((self.root / 'unity' / first['sha256'][:12] / 'hiraeth-js.x86_64').is_file())
        self.install()
        self.assertFalse((self.root / 'unity' / first['sha256'][:12]).exists())

    def test_a_wrong_checksum_or_size_changes_nothing(self):
        first, _ = self.install()
        for key, value in (('sha256', '0' * 64), ('size', 5)):
            release, fetch = self.player()
            manifest = {**deck.unity_manifest(release), key: value}
            with self.assertRaises(ValueError):
                deck.install_unity(self.root, manifest, fetch)
            self.assertEqual(deck.unity_installed(self.root)['sha256'], first['sha256'])
        self.assertFalse(list((self.root / 'unity').glob('.download-*')))

    def test_unsafe_archives_are_refused(self):
        link = tarfile.TarInfo('bridge-linux/escape')
        link.type, link.linkname = tarfile.SYMTYPE, '/tmp'
        outside = tarfile.TarInfo('../../escaped')
        outside.size = 1
        absolute = tarfile.TarInfo(str(self.home / 'absolute'))
        absolute.size = 1
        for entry in (link, outside, absolute):
            with self.assertRaises(ValueError):
                self.install(extra=[entry])
        with self.assertRaises(ValueError):
            self.install(files={'readme.txt': (b'no player', 0o644)})
        self.assertIsNone(deck.unity_installed(self.root))
        self.assertFalse((self.home / 'escaped').exists() or (self.home / 'absolute').exists())

    def test_the_update_reports_it_apart_and_the_settings_skip_it(self):
        def offline():
            raise OSError('offline')
        with patch('sys.stderr', io.StringIO()), patch('sys.stdout', io.StringIO()):
            self.assertEqual(deck.update_all(self.root, runtime=lambda: False, content=lambda: False,
                                             unity=offline, art=lambda: False), ['unity'])
            self.assertEqual(deck.update_all(self.root, runtime=lambda: False, content=lambda: False,
                                             unity=offline, art=lambda: False, with_unity=False), [])


class EngineTests(unittest.TestCase):
    """What the "Hiraeth" shortcut starts (docs/plans/unity-default-portables.md, D9; issue #484): the Unity player,
    watched, with a fallback to the player before and then an error dialog, never the web game."""

    setUp_base = SteamDeckTests.setUp
    bundle = SteamDeckTests.bundle
    player = UnityPlayerTests.player
    install = UnityPlayerTests.install

    def setUp(self):
        self.setUp_base()
        self.count = 0
        runtime, fetch = self.bundle(1001)
        deck.install_update(self.root, runtime, fetch)
        self.updater = patch.object(deck, 'start_updater')
        self.updater.start()
        self.addCleanup(self.updater.stop)
        # the dialogs the launcher shows (wait_for_unity's bar, unity_failed's error), and no network for the player
        self.errors, self.busy = [], []

        def busy(_text):
            self.busy.append('open')
            return lambda: self.busy.append('closed')
        for name, fake in (('show_error', self.errors.append), ('busy_dialog', busy),
                           ('update_unity', lambda _root: (_ for _ in ()).throw(OSError('offline')))):
            patcher = patch.object(deck, name, side_effect=fake)
            patcher.start()
            self.addCleanup(patcher.stop)

    def players(self):
        """Two players installed: the one before (first) and the current one (second)."""
        first, _ = self.install()
        time.sleep(0.01)
        second, _ = self.install()
        return first['sha256'][:12], second['sha256'][:12]

    def launch(self, results):
        """One launch with a fake run: results maps a player's sha12 to what run_game returns.
        @return (what ran in order, the exit code, the launch log)"""
        ran = []

        def run(command, env, ready, log, **kwargs):
            player = kwargs['cwd']
            ran.append(player.name)
            self.assertEqual(command[0], str(player / deck.UNITY_PLAYER))
            self.assertEqual(command[command.index('-ready') + 1], str(ready))
            self.assertEqual(env['XDG_CONFIG_HOME'], str(self.root / 'unity-data'), 'the player\'s own data folder')
            self.assertEqual(kwargs['ready_seconds'], deck.UNITY_READY_SECONDS)
            self.assertEqual(kwargs['stop_signal'], signal.SIGTERM)
            # (Steam's Exit Game: Gaming Mode is black until the player is gone; it ends itself in 2 s, BridgeQuit.cs, #438)
            self.assertEqual(kwargs['stop_seconds'], deck.UNITY_STOP_SECONDS)
            self.assertLessEqual(deck.UNITY_STOP_SECONDS, 5)
            with (player / '.in-use').open('a') as lock, self.assertRaises(BlockingIOError):
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)   # (pinned while it runs)
            return results[player.name]
        code = None
        with patch('sys.stderr', io.StringIO()):
            try:
                deck.launch(self.root, [], run=run, relaunch=lambda _argv: None)
            except SystemExit as done:
                code = done.code
        return ran, code, (self.root / 'launch.log').read_text()

    def test_the_hiraeth_shortcut_only_ever_starts_unity(self):
        # (issue #484: no setting, no remote switch and no fallback put "Hiraeth" on the web game)
        _, current = self.players()
        self.assertEqual(deck.choose_engine(self.root)[0], 'unity')
        ran, code, log = self.launch({current: ('quit', 0, True)})
        self.assertEqual((ran, code), ([current], 0))
        self.assertIn('Engine unity', log)
        self.assertEqual((deck.local_state(self.root)['engine'], deck.local_state(self.root)['engineSetting']), ('unity', 'unity'))
        # an engine.json from an earlier runtime's --engine web no longer counts
        (self.root / 'engine.json').write_text(json.dumps({'engine': 'web'}))
        ran, _, _ = self.launch({current: ('quit', 0, True)})
        self.assertEqual(ran, [current])
        self.assertEqual(deck.local_state(self.root)['engineSetting'], 'unity')
        # nor does web.json's old kill switch (deckEngine 'web'), nor its last reading on the disk
        (self.root / 'engine-remote.json').write_text(json.dumps({'deckEngine': 'web'}))
        manifest = {'build': 700, 'version': '1.8', 'sha256': '0' * 64, 'zip': deck.CONTENT_URL + 'web-700.zip',
                    'minDesktop': 1, 'size': 10, 'deckEngine': 'web'}
        deck.validate_content_manifest(manifest)   # (a web.json that still has the field is still taken)
        with patch.object(deck, 'get_content_manifest', return_value=manifest), \
                patch.object(deck, 'install_content', return_value=False) as install:
            self.assertFalse(deck.content_update(self.root))
        install.assert_called_once_with(self.root, manifest)
        ran, _, _ = self.launch({current: ('quit', 0, True)})
        self.assertEqual(ran, [current])
        for gone in ('remote_engine', 'set_engine', 'game_env', 'GPU_MODES', 'launch_unity', 'second_shortcut'):
            self.assertFalse(hasattr(deck, gone), f'{gone}: the web launch, its switches and the second shortcut are gone')
        self.assertEqual(self.errors, [])

    def test_the_unity_engine_starts_the_current_player(self):
        before, current = self.players()
        ran, code, log = self.launch({current: ('quit', 0, True)})
        self.assertEqual((ran, code), ([current], 0))
        self.assertEqual(deck.unity_health(self.root), {current: 'ok'})

    def test_a_player_that_never_draws_falls_back_to_the_one_before_then_says_so_never_the_web(self):
        before, current = self.players()
        hung = ('retry', -9, False)
        ran, code, log = self.launch({current: hung, before: hung})
        self.assertEqual((ran, code), ([current, before], 1))
        self.assertEqual(deck.unity_health(self.root), {current: 'failed', before: 'failed'})
        self.assertIn('no web fallback', log)
        self.assertNotIn('web', log.replace('no web fallback', ''))
        self.assertEqual(len(self.errors), 1, 'a dialog says the game could not start')
        self.assertIn('could not start', self.errors[0])
        self.assertIn(str(self.root / 'launch.log'), self.errors[0])
        # with nothing else to go to, the next launch tries them again (a slow first start is not the end)
        ran, code, log = self.launch({current: ('quit', 0, True), before: hung})
        self.assertEqual((ran, code), ([current], 0))
        self.assertIn('failed to start before', log)
        self.assertEqual(deck.unity_health(self.root)[current], 'ok')
        # a new player build gets its own chance first
        newest, _ = self.install()
        ran, _, _ = self.launch({newest['sha256'][:12]: ('quit', 0, True)})
        self.assertEqual(ran, [newest['sha256'][:12]])

    def test_a_crashing_player_hands_over_to_the_one_before_which_is_kept(self):
        before, current = self.players()
        ran, code, _ = self.launch({current: ('retry', -11, True), before: ('quit', 0, True)})
        self.assertEqual((ran, code), ([current, before], 0))
        ran, _, _ = self.launch({before: ('ended', -9, True)})
        self.assertEqual(ran, [before], 'the failed current one is skipped while another is there')
        self.assertEqual(deck.unity_health(self.root), {current: 'failed', before: 'ok'})

    def test_closing_before_the_first_frame_is_not_a_failure(self):
        _, current = self.players()
        ran, code, _ = self.launch({current: ('quit', 0, False)})
        self.assertEqual((ran, code), ([current], 0))
        self.assertEqual(deck.unity_health(self.root), {})

    def test_no_player_yet_downloads_it_first(self):
        release, fetch = self.player()
        manifest = deck.unity_manifest(release)
        sha = manifest['sha256'][:12]
        with patch.object(deck, 'update_unity', side_effect=lambda root: deck.install_unity(root, manifest, fetch)):
            ran, code, log = self.launch({sha: ('quit', 0, True)})
        self.assertEqual((ran, code), ([sha], 0))
        self.assertIn('No Unity player installed yet: downloading it', log)
        self.assertEqual(self.busy, ['open', 'closed'], 'a dialog with a bar while it downloads')
        self.assertEqual(self.errors, [])

    def test_no_player_and_no_network_says_so_never_the_web(self):
        ran, code, log = self.launch({})
        self.assertEqual((ran, code), ([], 1))
        self.assertIn('could not be downloaded', log)
        self.assertEqual(len(self.errors), 1)
        self.assertEqual(self.busy, ['open', 'closed'])

    def test_waiting_on_the_background_download(self):
        # (the background update holds the download's lock: install_unity returns False until it is done)
        release, fetch = self.player()
        manifest = deck.unity_manifest(release)
        calls = []

        def busy(root):
            calls.append(1)
            if len(calls) == 3:   # (the background download finished meanwhile)
                deck.install_unity(root, manifest, fetch)
            return False
        log = []
        self.assertTrue(deck.wait_for_unity(self.root, log.append, install=busy, sleep=lambda _s: None, dialog=lambda _t: lambda: None))
        self.assertEqual(len(calls), 3)
        # and it gives up at its deadline
        shutil.rmtree(self.root / 'unity')
        self.assertFalse(deck.wait_for_unity(self.root, log.append, install=lambda _root: False, wait_seconds=0,
                                             sleep=lambda _s: None, dialog=lambda _t: lambda: None))
        self.assertIn('gave up waiting', log[-1])

    def test_the_old_shortcuts_launchers_start_unity(self):
        # (launch-web and launch-unity as earlier runtimes wrote them: deck.py --launch-web / --launch-unity)
        started = []
        with patch.object(deck.platform, 'system', return_value='Linux'), patch.object(deck.platform, 'machine', return_value='x86_64'), \
                patch.object(deck, 'launch', side_effect=lambda root, extra: started.append(extra)):
            for flag in ('--launch', '--launch-web', '--launch-unity'):
                with patch.object(sys, 'argv', ['deck.py', flag, '--root', str(self.root), '-x']):
                    deck.main()
        self.assertEqual(started, [['-x']] * 3)

    def test_restart_now_launches_again_into_the_update(self):
        _, current = self.players()
        (self.root / '.restart').write_text('601\n')   # (the settings' Restart now, before the player's exit 76)
        relaunched = []
        restart = lambda *a, **k: ('restart', deck.RESTART_EXIT, True)
        with patch('sys.stderr', io.StringIO()), patch.dict(os.environ, {}, clear=False):
            os.environ.pop('HIRAETH_RESTARTED_FOR', None)
            deck.launch(self.root, ['--x'], run=restart, relaunch=relaunched.append)
            self.assertEqual(os.environ['HIRAETH_RESTARTED_FOR'], '601')
        # (an install elsewhere than the usual folder is launched again there)
        self.assertEqual(relaunched[0][1:], [str((self.root / 'current').resolve() / 'resources/app/deck.py'), '--launch',
                                             '--root', str(self.root), '--x'])
        with patch.object(deck, 'ROOT', self.root), patch('sys.stderr', io.StringIO()), patch.dict(os.environ, {}, clear=False):
            deck.launch(self.root, ['--x'], run=restart, relaunch=relaunched.append)
        self.assertEqual(relaunched[1][2:], ['--launch', '--x'])
        self.assertFalse((self.root / '.restart').exists())
        self.assertIn(f'Restarting into the update (Unity {current})', (self.root / 'launch.log').read_text())
    def test_the_watchdog_reads_the_ready_file_or_the_players_log(self):
        ready, output = self.home / '.unity-ready', self.home / 'player.log'
        script = 'import sys, time\n'
        # a player from before -ready: its log's first script frame says it is up
        body = (f'open({str(output)!r}, "w").write("Hiraeth bridge: the bundle loaded\\n")\ntime.sleep(0.6)\n'
                f'open({str(output)!r}, "a").write("Hiraeth bridge: script frame 1 took 40 ms\\n")\ntime.sleep(0.6)')
        how = deck.run_game([sys.executable, '-c', script + body], dict(os.environ), ready, ready_seconds=5,
                            check=deck.unity_ready(output), stop_signal=signal.SIGTERM, log=lambda _line: None)
        self.assertEqual(how, ('quit', 0, True))
        # one that never draws is killed at its deadline: a failed start
        output.write_text('')
        started = time.monotonic()
        how = deck.run_game([sys.executable, '-c', script + 'time.sleep(60)'], dict(os.environ), ready, ready_seconds=1,
                            check=deck.unity_ready(output), log=lambda _line: None)
        self.assertEqual((how[0], how[2]), ('retry', False))
        self.assertLess(time.monotonic() - started, 10)
        # the -ready file is enough
        how = deck.run_game([sys.executable, '-c', script + f'open({str(ready)!r}, "w").write("1")\ntime.sleep(0.5)'],
                            dict(os.environ), ready, check=deck.unity_ready(self.home / 'none.log'), log=lambda _line: None)
        self.assertEqual(how, ('quit', 0, True))

    def test_the_players_last_log_is_kept(self):
        _, current = self.players()
        (self.root / 'unity-data').mkdir(exist_ok=True)
        (self.root / 'unity-data/player.log').write_text('the last run')
        self.launch({current: ('quit', 0, True)})
        self.assertEqual((self.root / 'unity-data/player-prev.log').read_text(), 'the last run')


class LauncherDialogTests(unittest.TestCase):
    """The dialogs the launcher shows itself when the Unity player isn't there yet or doesn't start (issue #484)."""

    def test_the_dialogs(self):
        which = {'zenity': '/usr/bin/zenity'}.get
        command = deck.dialog_command('zenity', 'error', 'Hiraeth could not start.')
        self.assertEqual(command[:2], ['zenity', '--error'])
        self.assertIn('--no-markup', command)
        self.assertEqual(command[-1], '--text=Hiraeth could not start.')
        self.assertIn('--no-cancel', deck.dialog_command('zenity', 'busy', 'x'))
        self.assertEqual(deck.dialog_command('kdialog', 'error', 'x'), ['kdialog', '--title', 'Hiraeth', '--error', 'x'])
        self.assertIsNone(deck.dialog_command('kdialog', 'busy', 'x'))
        self.assertEqual(deck.find_dialog_tool(lambda tool: tool == 'kdialog'), 'kdialog')
        self.assertIsNone(deck.find_dialog_tool(lambda _tool: None))
        # shown and waited for, without Steam's overlay preload
        seen = {}

        class Process:
            stdin = io.BytesIO()

            def __init__(self, command, env, **kwargs):
                seen.update(command=command, env=env, stdin=kwargs.get('stdin'))

            def wait(self, _seconds):
                seen['waited'] = True
        with patch.dict(os.environ, {'LD_PRELOAD': '/steam/gameoverlayrenderer.so:/other.so'}):
            self.assertTrue(deck.show_error('x', popen=Process, which=which))
        self.assertEqual((seen['command'][1], seen['waited'], seen['env']['LD_PRELOAD']), ('--error', True, '/other.so'))
        close = deck.busy_dialog('x', popen=Process, which=which)
        self.assertEqual(seen['command'][1], '--progress')
        close()
        # no tool: nothing shown, the launch goes on (its log says it)
        self.assertFalse(deck.show_error('x', popen=Process, which=lambda _tool: None))
        deck.busy_dialog('x', popen=Process, which=lambda _tool: None)()


class PlayerUpdateBridgeTests(unittest.TestCase):
    setUp_base = SteamDeckTests.setUp
    player = UnityPlayerTests.player

    def setUp(self):
        self.setUp_base()
        self.count = 0
        release, fetch = self.player(files=self.files(100, 4))
        manifest = deck.unity_manifest(release)
        deck.install_unity(self.root, manifest, fetch)
        self.running = (self.root / 'unity/current').resolve()
        self.pin = (self.running / '.in-use').open('a')
        fcntl.flock(self.pin, fcntl.LOCK_SH)
        self.addCleanup(self.pin.close)
        app = self.root / 'current/resources/app'
        app.mkdir(parents=True, exist_ok=True)
        (app / 'deck.py').write_text('# installed launcher')
        self.ready = self.root / '.unity-ready-123'
        self.ready.touch()
        self.saved = self.root / 'unity-data/store.json'
        self.saved.parent.mkdir(exist_ok=True)
        self.saved.write_text('{"settings":"kept","save":"kept"}')
        self.old_manifest = manifest

    def files(self, build, api, min_api=3):
        prefix = 'hiraeth-js_Data/StreamingAssets/'
        helper = b'# canonical player-only helper fixture\n'
        return {'hiraeth-js.x86_64': (b'player', 0o755), 'UnityPlayer.so': (b'so', 0o755),
                prefix+'deck-player.py': (helper, 0o644),
                prefix+'player.json': (json.dumps({'api': api, 'build': build, 'helperProtocol': 1, 'helperSha256': hashlib.sha256(helper).hexdigest()}).encode(), 0o644),
                prefix+'hiraeth-js/bundle.json': (json.dumps({'build': build, 'minUnity': min_api, 'version': '1.99'}).encode(), 0o644)}

    def operation(self, manifest, fetch=None, install=False):
        return deck.player_operation(self.root, self.running, self.ready, 4, 100, install,
                                     feed=lambda: manifest, downloader=fetch)

    def test_available_verified_ready_and_save_previous_preserved(self):
        release, fetch = self.player(files=self.files(101, 4))
        manifest = deck.unity_manifest(release)
        self.assertEqual(self.operation(manifest)['state'], 'available')
        self.assertEqual(self.operation(manifest, fetch, True)['state'], 'ready')
        self.assertEqual(self.operation(manifest)['state'], 'ready')
        self.assertTrue(self.running.is_dir())
        self.assertEqual(self.saved.read_text(), '{"settings":"kept","save":"kept"}')
        # A stale UI ready cannot make a feed now pointing at the running player restart.
        self.assertEqual(self.operation(self.old_manifest)['state'], 'current')

    def test_busy_is_not_ready_then_real_completed_update_is_ready(self):
        release, fetch = self.player(files=self.files(101, 4))
        manifest = deck.unity_manifest(release)
        with (self.root / 'unity/update.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(self.operation(manifest, fetch, True)['state'], 'busy')
        self.assertEqual(self.operation(manifest, fetch, True)['state'], 'ready')

    def test_incompatible_stale_missing_metadata_and_bad_hash_never_activate(self):
        variants = [self.files(101, 3), self.files(99, 4), self.files(101, 4, 5),
                    {'hiraeth-js.x86_64': (b'no metadata', 0o755)}]
        missing_helper = self.files(101, 4); del missing_helper['hiraeth-js_Data/StreamingAssets/deck-player.py']
        bad_helper = self.files(101, 4); bad_helper['hiraeth-js_Data/StreamingAssets/deck-player.py'] = (b'wrong helper', 0o644)
        variants.extend([missing_helper, bad_helper])
        for files in variants:
            release, fetch = self.player(files=files)
            with self.assertRaises(ValueError): self.operation(deck.unity_manifest(release), fetch, True)
            self.assertEqual((self.root / 'unity/current').resolve(), self.running)
        release, fetch = self.player(files=self.files(101, 4))
        manifest = deck.unity_manifest(release); manifest['sha256'] = 'f' * 64
        with self.assertRaisesRegex(ValueError, 'checksum'): self.operation(manifest, fetch, True)
        self.assertEqual((self.root / 'unity/current').resolve(), self.running)

    def test_extraction_failure_and_failed_start_feed_keep_previous(self):
        bad = tarfile.TarInfo('../escape'); bad.size = 1
        release, fetch = self.player(files=self.files(101, 4), extra=[bad])
        with self.assertRaises(ValueError): self.operation(deck.unity_manifest(release), fetch, True)
        self.assertEqual((self.root / 'unity/current').resolve(), self.running)
        release, fetch = self.player(files=self.files(102, 4))
        manifest = deck.unity_manifest(release)
        self.operation(manifest, fetch, True)
        failed = (self.root / 'unity/current').resolve()
        deck.unity_remember(self.root, failed, 'failed')
        with self.assertRaisesRegex(ValueError, 'failed to start'): self.operation(manifest)
        self.assertIn(self.running, deck.unity_players(self.root))

    def test_ready_snapshot_holds_activation_lock_through_metadata_read(self):
        release, fetch = self.player(files=self.files(101, 4))
        manifest = deck.unity_manifest(release)
        self.operation(manifest, fetch, True)
        entered, activated = threading.Event(), threading.Event()
        real = deck.player_metadata
        worker = None
        def activate():
            entered.set()
            with (self.root / 'unity/state.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                link = self.root / 'unity/.test-current'
                link.symlink_to(self.running.name)
                link.replace(self.root / 'unity/current')
                activated.set()
        def inspect(folder, api, build):
            nonlocal worker
            worker = threading.Thread(target=activate)
            worker.start(); self.assertTrue(entered.wait(1))
            self.assertFalse(activated.wait(.05), 'background activation must wait for snapshot lock')
            return real(folder, api, build)
        with patch.object(deck, 'player_metadata', side_effect=inspect):
            result = deck.verified_player_snapshot(self.root, manifest['sha256'], 4, 100)
        worker.join(2)
        self.assertTrue(activated.is_set())
        self.assertEqual(result['build'], 101)
        # A later recheck sees the changed current rather than reusing the first ready result.
        self.assertIsNone(deck.verified_player_snapshot(self.root, manifest['sha256'], 4, 100))

    def test_real_helper_process_reports_ready_busy_and_offline_without_touching_save(self):
        release, fetch = self.player(files=self.files(101, 4))
        manifest = deck.unity_manifest(release)
        self.operation(manifest, fetch, True)
        feed = self.home / 'fixture-feed.json'; feed.write_text(json.dumps(manifest))
        wrapper = self.home / 'helper-process.py'
        wrapper.write_text("import importlib.util,json,sys\n"
            "from pathlib import Path\n"
            "spec=importlib.util.spec_from_file_location('deck',sys.argv.pop(1));d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)\n"
            "feed=Path(sys.argv.pop(1));mode=sys.argv.pop(1)\n"
            "def get():\n"
            " if mode=='offline': raise OSError('fixture network unavailable')\n"
            " return json.loads(feed.read_text())\n"
            "d.get_unity_manifest=get\n"
            "sys.exit(d.main())\n")
        progress = self.home / 'helper-progress.json'
        def run(mode='normal'):
            command = [sys.executable, str(wrapper), str(Path(deck.__file__)), str(feed), mode,
                       '--root', str(self.root), '--player-operation', 'check', '--player', str(self.running),
                       '--ready', str(self.ready), '--min-api', '4', '--min-build', '100', '--progress', str(progress)]
            result = subprocess.run(command, capture_output=True, text=True, timeout=10)
            state = json.loads(progress.read_text())
            self.assertEqual(json.loads(result.stdout.strip().splitlines()[-1]), state)
            self.assertEqual(self.saved.read_text(), '{"settings":"kept","save":"kept"}')
            return state
        self.assertEqual(run()['state'], 'ready')
        with (self.root / 'unity/update.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(run()['state'], 'busy')
        self.assertEqual(run()['state'], 'ready')
        self.assertEqual(run('offline')['state'], 'offline')

    def test_nonlauncher_or_unpinned_layout_is_rejected_before_network(self):
        with self.assertRaises(ValueError):
            deck.managed_player_root(self.root, self.running, self.root / 'fake-ready')
        self.pin.close()
        with self.assertRaisesRegex(ValueError, 'not pinned'):
            deck.managed_player_root(self.root, self.running, self.ready)


class VersionedReleaseCompatibility(unittest.TestCase):
    def test_exact_build_url_and_no_expanded_host_trust(self):
        good = {'build': 123001, 'version': '2.07', 'sha256': 'a' * 64,
                'url': 'https://github.com/rnaud/hiraeth/releases/download/steam-deck-123001/hiraeth-steam-deck-123001.tar.gz'}
        deck.validate_manifest(good)
        for url in [good['url'].replace('github.com', 'evil.example'), good['url'] + '?x=1',
                    good['url'].replace('steam-deck-123001/', 'steam-deck-123002/'),
                    good['url'].replace('rnaud/hiraeth', 'other/hiraeth'), good['url'].replace('https:', 'http:')]:
            with self.assertRaises(ValueError):
                deck.validate_manifest(dict(good, url=url))

    def test_actual_old_validator_migrates_via_unchanged_site_parts(self):
        # Exact extracted functions from the published pre-fix launcher, with source SHA recorded.
        fixture = json.loads((Path(__file__).parent / 'fixtures/steam-deck-v206-feed.json').read_text())
        namespace = {'re': __import__('re'), 'BASE_URL': deck.BASE_URL, 'CONTENT_URL': deck.CONTENT_URL,
                     'RUNTIME_SITE_URL': deck.RUNTIME_SITE_URL, 'MANIFEST_URL': deck.MANIFEST_URL,
                     'MAX_ARCHIVE': deck.MAX_ARCHIVE, 'fetch_manifest': None}
        exec(fixture['functions'], namespace)
        old = {'build': 122001, 'version': '2.06', 'sha256': 'a' * 64,
               'url': deck.BASE_URL + 'hiraeth-steam-deck-122001.tar.gz'}
        new = {'build': 123001, 'version': '2.07', 'sha256': 'b' * 64, 'size': 100,
               'parts': [deck.CONTENT_URL + 'steam-deck-123001.tar.gz.000']}
        def fetch(url):
            value = new if url == deck.RUNTIME_SITE_URL else old
            namespace['validate_manifest'](value)
            return value
        self.assertEqual(namespace['get_manifest'](fetch)['build'], 123001)
        with self.assertRaises(ValueError):
            namespace['validate_manifest']({'build': 123001, 'version': '2.07', 'sha256': 'b' * 64,
                'url': 'https://github.com/rnaud/hiraeth/releases/download/steam-deck-123001/hiraeth-steam-deck-123001.tar.gz'})
        # Site unavailable: existing install still sees the untouched legacy fallback.
        def offline(url):
            if url == deck.RUNTIME_SITE_URL: raise OSError('offline')
            return fetch(url)
        self.assertEqual(namespace['get_manifest'](offline), old)
        with self.assertRaises(ValueError):
            namespace['validate_manifest'](dict(new, parts=['https://evil.example/part']))


if __name__ == '__main__':
    unittest.main()
