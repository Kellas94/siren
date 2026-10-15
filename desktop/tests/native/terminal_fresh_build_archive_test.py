"""Tiny source/ZIP DATA tests only. No archived member is imported/executed."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid
import zipfile

ROOT = Path(__file__).absolute().parents[3]
SOURCE = Path(__file__).with_name('terminal_fresh_build_archive.py')
FIXTURES = ROOT / 'terminal-fresh-build-archive-20261011/fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)


def module():
    if not SOURCE.is_file():
        raise AssertionError('new archive_fresh_build_job source/API absent')
    spec = importlib.util.spec_from_file_location('fresh_archive_test_' + uuid.uuid4().hex, SOURCE)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.mod = module()
        self.case = FIXTURES / uuid.uuid4().hex
        self.case.mkdir()
        self.source = self.case / 'siren-fresh-runtime-11111111-1111-4111-8111-111111111111'
        self.source.mkdir()
        self.target = self.case / 'job.zip'

    def call(self, source=None, target=None):
        return self.mod.archive_fresh_build_job(str(source or self.source), str(target or self.target))

    def refused(self, result, code=None, created=False):
        self.assertIs(result['ok'], False)
        if code is not None:
            self.assertEqual(result['code'], code)
        self.assertIs(result['archiveCreated'], created)
        self.assertIs(result['nativeAdmission'], False)
        self.assertIs(result['cleanupPerformed'], False)
        self.assertNotIn('error', result)

    def test_01_actual_whole_tree_zip_bytes_empty_hidden_unicode_and_root_entry(self):
        for name in ['fresh-runtime/electron/dist/empty', 'retained/fresh-runtime/empty', 'fresh-evidence/connect', 'build-work/empty', 'project-Șiren-Δ/gol']:
            (self.source / name).mkdir(parents=True)
        values = {'fresh-runtime/electron/dist/.hidden': b'hidden\x00bytes', 'retained/fresh-runtime/șir-Δ.bin': bytes(range(256)),
                  'fresh-evidence/failure.txt': b'adverse retained', 'build-work/.tlog': b'tracked', 'project-Șiren-Δ/fișier.txt': 'Șiren Δ'.encode()}
        for name, data in values.items():
            (self.source / name).write_bytes(data)
        result = self.call()
        self.assertIs(result['ok'], True)
        self.assertIs(result['nativeAdmission'], False)
        self.assertEqual(result['archiveSha256'], hashlib.sha256(self.target.read_bytes()).hexdigest())
        prefix = self.source.name + '/'
        expected_dirs = {prefix} | {prefix + p.relative_to(self.source).as_posix() + '/' for p in self.source.rglob('*') if p.is_dir()}
        with zipfile.ZipFile(self.target) as archive:
            self.assertEqual(set(archive.namelist()), expected_dirs | {prefix + name for name in values})
            for name in expected_dirs:
                self.assertTrue(archive.getinfo(name).is_dir())
            for name, data in values.items():
                self.assertEqual(hashlib.sha256(archive.read(prefix + name)).digest(), hashlib.sha256(data).digest())
        self.assertEqual(result['files'], len(values))
        self.assertEqual(result['directories'], len(expected_dirs))
        for name, data in values.items():
            self.assertEqual((self.source / name).read_bytes(), data)

    def test_02_actual_existing_target_is_never_overwritten(self):
        self.target.write_bytes(b'keep target')
        (self.source / 'data').write_bytes(b'keep source')
        self.refused(self.call(), 'TARGET_EXISTS')
        self.assertEqual(self.target.read_bytes(), b'keep target')
        self.assertEqual((self.source / 'data').read_bytes(), b'keep source')

    def test_03_actual_overlap_and_noncanonical_paths_refuse_without_creation(self):
        for target in [self.source, self.source / 'nested.zip', self.source / 'nested' / 'out.zip']:
            with self.subTest(target=str(target)):
                self.refused(self.call(target=target), 'OVERLAP_REFUSED')
        self.refused(self.mod.archive_fresh_build_job(str(self.source) + os.sep + '..' + os.sep + self.source.name, str(self.target)), 'PATH_REFUSED')
        self.assertFalse(self.target.exists())

    def test_04_exact_primitive_arguments_refuse_without_coercion(self):
        calls = []
        class Trap(str):
            def __str__(self):
                calls.append('str'); raise AssertionError('coercion')
            def __fspath__(self):
                calls.append('fspath'); raise AssertionError('coercion')
        class PathTrap:
            def __fspath__(self):
                calls.append('fspath'); raise AssertionError('coercion')
        for bad in [None, 1, {}, self.source, Trap(str(self.source)), PathTrap()]:
            self.refused(self.mod.archive_fresh_build_job(bad, str(self.target)), 'ARGUMENTS_REFUSED')
            self.refused(self.mod.archive_fresh_build_job(str(self.source), bad), 'ARGUMENTS_REFUSED')
        for invoke in [lambda: self.mod.archive_fresh_build_job(), lambda: self.mod.archive_fresh_build_job(str(self.source)),
                       lambda: self.mod.archive_fresh_build_job(str(self.source), str(self.target), 0),
                       lambda: self.mod.archive_fresh_build_job(source_directory=str(self.source), target_zip=str(self.target))]:
            self.refused(invoke(), 'ARGUMENTS_REFUSED')
        self.assertEqual(calls, [])
        self.assertFalse(self.target.exists())

    def test_05_actual_non_directory_source_and_missing_target_parent_refuse(self):
        ordinary = self.case / 'source-file'; ordinary.write_bytes(b'not directory')
        self.refused(self.call(source=ordinary))
        self.refused(self.call(target=self.case / 'absent' / 'job.zip'))
        self.assertFalse((self.case / 'absent').exists())
        self.assertFalse(self.target.exists())

    def test_06_actual_hardlink_setup_must_succeed_before_refusal_is_credited(self):
        original = self.source / 'one'; original.write_bytes(b'linked')
        try:
            os.link(original, self.source / 'two')
        except OSError as error:
            self.skipTest('ACTUAL_HARDLINK_SETUP_BLOCKED:' + type(error).__name__)
        self.refused(self.call(), 'SOURCE_REFUSED')
        self.assertFalse(self.target.exists())
        self.assertEqual(original.read_bytes(), b'linked')

    def test_07_conditional_small_private_caps_refuse_before_output(self):
        (self.source / 'long-name').write_bytes(b'four')
        for constant, limit in [('_MAX_FILE_BYTES', 3), ('_MAX_TOTAL_BYTES', 3), ('_MAX_ENTRIES', 1), ('_MAX_PATH_BYTES', 5)]:
            with self.subTest(constant=constant), patch.object(self.mod, constant, limit):
                self.refused(self.call(), 'LIMIT_EXCEEDED')
                self.assertFalse(self.target.exists())
        (self.source / 'nested').mkdir(); (self.source / 'nested' / 'deeper').mkdir()
        with patch.object(self.mod, '_MAX_DEPTH', 1):
            self.refused(self.call(), 'LIMIT_EXCEEDED')

    def test_08_conditional_write_failure_retains_real_partial_zip_and_never_retries(self):
        (self.source / 'data').write_bytes(b'partial retained')
        original = self.mod._copy_source_file; calls = []
        def after_entry(*args, **kwargs):
            calls.append(1); original(*args, **kwargs); raise OSError('PRIVATE_RAW_ERROR_MUST_NOT_LEAK')
        with patch.object(self.mod, '_copy_source_file', after_entry):
            result = self.call()
        self.refused(result, 'ARCHIVE_WRITE_FAILED', True)
        self.assertEqual(calls, [1])
        self.assertTrue(self.target.is_file()); self.assertGreater(self.target.stat().st_size, 0)
        self.assertNotIn('PRIVATE_RAW_ERROR', json.dumps(result))
        partial = self.target.read_bytes()
        self.refused(self.call(), 'TARGET_EXISTS')
        self.assertEqual(self.target.read_bytes(), partial)
        self.assertEqual((self.source / 'data').read_bytes(), b'partial retained')

    def test_09_conditional_late_source_membership_and_zip_corruption_remain_adverse(self):
        (self.source / 'data').write_bytes(b'unchanged')
        original = self.mod._recheck_tree; checks = []
        def changed(*args, **kwargs):
            checks.append(1)
            if len(checks) == 2:
                (self.source / 'late').write_bytes(b'new member')
            return original(*args, **kwargs)
        with patch.object(self.mod, '_recheck_tree', changed):
            self.refused(self.call(), 'SOURCE_CHANGED', True)
        self.assertTrue(self.target.is_file()); self.assertTrue((self.source / 'late').is_file())
        second = self.case / 'corrupt.zip'
        verify = self.mod._verify_archive
        def corrupt(target, *args, **kwargs):
            with open(target, 'r+b') as stream:
                stream.write(b'BAD!')
            return verify(target, *args, **kwargs)
        with patch.object(self.mod, '_verify_archive', corrupt):
            self.refused(self.call(target=second), 'ARCHIVE_VERIFY_FAILED', True)
        self.assertTrue(second.is_file())

    def test_10_conditional_hosted_context_and_exact_uuid_selection_not_native_ownership(self):
        valid = {'platform': 'win32', 'repository': 'Kellas94/siren', 'ref': 'refs/heads/probe/terminal-session-20261010',
                 'run': '123', 'attempt': '1', 'commit': 'a' * 40}
        self.assertTrue(self.mod._valid_hosted_data(valid))
        for key, value in [('platform', 'linux'), ('repository', 'other'), ('ref', 'refs/heads/main'), ('run', '0'), ('attempt', '-1'), ('commit', 'bad')]:
            self.assertFalse(self.mod._valid_hosted_data({**valid, key: value}))
        self.assertTrue(self.mod._job_name(self.source.name))
        for name in [self.source.name.upper(), self.source.name + '-suffix', 'siren-fresh-runtime-../escape', 'siren-fresh-runtime-11111111-1111-1111-1111-111111111111']:
            self.assertFalse(self.mod._job_name(name))
        # Private finite hosted DATA; actual IO is restricted to this tiny case.
        # No actual environment capture or hosted CLI process is performed.
        launch = self.case / 'siren-fresh-build-launch'; launch.mkdir()
        env = {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': valid['repository'], 'GITHUB_REF': valid['ref'],
               'GITHUB_RUN_ID': valid['run'], 'GITHUB_RUN_ATTEMPT': valid['attempt'], 'GITHUB_SHA': valid['commit'],
               'RUNNER_TEMP': str(self.case)}
        with patch.object(self.mod.os, 'environ', env), patch.object(self.mod, 'sys', SimpleNamespace(platform='win32', argv=['inactive-script'])):
            result = self.mod._hosted_cli()
        self.assertTrue(result['ok']); self.assertEqual(result['code'], 'ALL_SELECTED_JOB_ARCHIVES_VERIFIED')
        self.assertEqual([row['root'] for row in result['jobs']], [self.source.name])
        self.assertEqual(json.loads((launch / 'whole-job-archive-status.json').read_bytes()), result)
        self.assertEqual(json.loads((launch / (self.source.name + '.archive.json')).read_bytes()), result['jobs'][0])
        with zipfile.ZipFile(launch / (self.source.name + '.zip')) as archive:
            self.assertEqual(archive.namelist(), [self.source.name + '/'])
        # No roots and an incomplete selected root are distinct adverse outcomes.
        for suffix, broken in [('empty', False), ('incomplete', True)]:
            temporary = self.case / suffix; temporary.mkdir()
            evidence = temporary / 'siren-fresh-build-launch'; evidence.mkdir()
            if broken:
                (temporary / self.source.name).write_bytes(b'not an ordinary directory')
            with patch.object(self.mod.os, 'environ', {**env, 'RUNNER_TEMP': str(temporary)}), patch.object(self.mod, 'sys', SimpleNamespace(platform='win32', argv=['inactive-script'])):
                adverse = self.mod._hosted_cli()
            self.assertFalse(adverse['ok'])
            self.assertEqual(adverse['code'], 'INCOMPLETE_JOB_ARCHIVE' if broken else 'NO_OWNED_RUNTIME_FOUND')
            self.assertEqual(json.loads((evidence / 'whole-job-archive-status.json').read_bytes()), adverse)


if __name__ == '__main__':
    unittest.main()
