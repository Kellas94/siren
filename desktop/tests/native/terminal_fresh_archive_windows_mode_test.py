"""Inert file/ZIP compatibility tests; .cmd/.exe members are never executed."""
import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import uuid
import zipfile

ROOT = Path(__file__).absolute().parents[3]
SOURCE = Path(__file__).with_name('terminal_fresh_build_archive.py')
FIXTURES = ROOT / 'terminal-fresh-archive-windows-mode-20261011/fixtures'

class WindowsArchiveModeTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('archive_mode_' + uuid.uuid4().hex, SOURCE)
        self.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.mod)

    def test_actual_cmd_exe_suffixes_are_archived_as_inert_exact_bytes(self):
        case = FIXTURES / uuid.uuid4().hex
        source = case / 'siren-fresh-runtime-11111111-1111-4111-8111-111111111111'
        source.mkdir(parents=True)
        values = {name: b'inert DATA; never executed\n' for name in ['asar', 'asar.cmd', 'asar.ps1', 'sample.exe']}
        for name, data in values.items(): (source / name).write_bytes(data)
        result = self.mod.archive_fresh_build_job(str(source), str(case / 'job.zip'))
        self.assertTrue(result['ok'], result)
        self.assertFalse(result['nativeAdmission'])
        with zipfile.ZipFile(case / 'job.zip') as archive:
            self.assertIsNone(archive.testzip())
            for name, data in values.items(): self.assertEqual(archive.read(source.name + '/' + name), data)

    def metadata(self, mode=0o100666, **changes):
        values = dict(st_dev=1, st_ino=2, st_mode=mode, st_nlink=1, st_size=26,
                      st_mtime_ns=3, st_ctime_ns=4, st_birthtime_ns=5)
        values.update(changes)
        return SimpleNamespace(**values)

    def test_windows_only_suffix_execute_bits_normalize_but_other_changes_do_not(self):
        with patch.object(self.mod, 'os', SimpleNamespace(name='nt')):
            base = self.mod._identity(self.metadata())
            self.assertEqual(base, self.mod._identity(self.metadata(0o100777)))
            for change in [dict(mode=0o100444), dict(mode=0o040666), dict(st_dev=8), dict(st_ino=8),
                           dict(st_nlink=2), dict(st_size=27), dict(st_mtime_ns=8), dict(st_birthtime_ns=8)]:
                with self.subTest(change=change): self.assertNotEqual(base, self.mod._identity(self.metadata(**change)))

    def test_posix_executable_permission_bits_remain_part_of_identity(self):
        with patch.object(self.mod, 'os', SimpleNamespace(name='posix')):
            self.assertNotEqual(self.mod._identity(self.metadata()), self.mod._identity(self.metadata(0o100777)))

if __name__ == '__main__': unittest.main(verbosity=2)
