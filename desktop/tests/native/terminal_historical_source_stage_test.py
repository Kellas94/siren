"""Focused inert source-stage tests. Imports only own helper and Python stdlib."""
import hashlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
import uuid
import zipfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'terminal-historical-source-stage-20261011'
FIXTURES = EVIDENCE / 'fixtures'
HELPER = Path(__file__).with_name('terminal_historical_source_stage.py')
if HELPER.exists():
    spec = importlib.util.spec_from_file_location('terminal_historical_source_stage', HELPER)
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
else:
    api = None
MAPPING = json.loads((ROOT / 'terminal-fresh-provisioner-preparation-20261011/historical-execution-mapping.json').read_bytes())['sourceGraph']
ARCHIVE = ROOT / 'terminal-resolution-observation-20261011/hosted-v1.zip'


class HistoricalSourceStageTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(callable(getattr(api, 'stage_historical_sources', None)), 'Missing actual fixed historical source-stage API')
        FIXTURES.mkdir(parents=True, exist_ok=True)
        self.base = FIXTURES / str(uuid.uuid4())
        self.base.mkdir()
        self.target = self.base / 'staged'

    def call(self, target=None, *extra, **kwargs):
        return api.stage_historical_sources(str(self.target) if target is None else target, *extra, **kwargs)

    def refusal(self, code, target=None, *extra, created=False, **kwargs):
        with self.assertRaises(Exception) as caught:
            self.call(target, *extra, **kwargs)
        self.assertEqual(caught.exception.code, code)
        self.assertIs(caught.exception.retained_directory_created, created)
        self.assertEqual(str(caught.exception), 'HISTORICAL_SOURCE_STAGE_REFUSED: ' + code)
        return caught.exception

    def test_exact_original_55_source_bytes_only_and_closed_nonadmission_manifest(self):
        result = self.call()
        self.assertEqual(result['evidenceClass'], 'ORIGINAL_SOURCE_STAGE_ONLY')
        self.assertEqual(result['sourceEntries'], 55)
        self.assertEqual(result['sourceBytes'], sum(row['bytes'] for row in MAPPING))
        for key in ['nativeExecution', 'provisioningComplete', 'executionAuthorized', 'nativeAdmission', 'oldRuntimeEquivalent']:
            self.assertIs(result[key], False)
        actual = sorted(p.relative_to(self.target).as_posix() for p in self.target.rglob('*') if p.is_file())
        self.assertEqual(actual, sorted(row['path'] for row in MAPPING))
        self.assertEqual(sum(name.endswith('.mjs') for name in actual), 47)
        self.assertEqual(sum(name.endswith(('.cc', '.inc', '.gyp')) for name in actual), 6)
        self.assertEqual(sum(name.endswith('.json') for name in actual), 2)
        with zipfile.ZipFile(ARCHIVE) as archive:
            for row in MAPPING:
                raw = (self.target / row['path']).read_bytes()
                self.assertEqual(raw, archive.read(row['topLevelMember']))
                self.assertEqual(raw, archive.read(row['retainedExecutionMember']))
                self.assertEqual(len(raw), row['bytes'])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['sha256'])
        self.assertEqual(result['files'], [{key: row[key] for key in ['path', 'bytes', 'sha256']} for row in MAPPING])

    def test_exact_str_path_subclasses_objects_and_coercion_hooks_refused(self):
        calls = []
        class Coerce:
            def __fspath__(self): calls.append('fspath'); return str(self.target)
            def __str__(self): calls.append('str'); return 'target'
        class String(str):
            def __str__(self): calls.append('subclass'); return super().__str__()
        for value in [String(str(self.target)), self.target, Coerce(), None, 7, b'bytes']:
            with self.subTest(kind=type(value).__name__):
                with self.assertRaises(Exception) as caught:
                    api.stage_historical_sources(value)
                self.assertEqual(caught.exception.code, 'TARGET_PATH_REFUSED')
                self.assertIs(caught.exception.retained_directory_created, False)
        self.assertEqual(calls, [])
        self.assertFalse(self.target.exists())

    def test_extra_arguments_and_caller_source_archive_manifest_hooks_refused(self):
        self.refusal('ARGUMENTS_REFUSED', str(self.target), lambda: self.fail('hook'))
        for name in ['archive', 'source', 'manifest', 'on_copy']:
            self.refusal('ARGUMENTS_REFUSED', str(self.target), **{name: lambda: self.fail('hook')})
        with self.assertRaises(Exception) as caught:
            api.stage_historical_sources()
        self.assertEqual(caught.exception.code, 'ARGUMENTS_REFUSED')
        self.assertFalse(self.target.exists())

    def test_preexisting_file_never_overwritten(self):
        self.target.write_bytes(b'preserve-original')
        before = self.target.stat().st_ino
        self.refusal('TARGET_EXISTS')
        self.assertEqual(self.target.read_bytes(), b'preserve-original')
        self.assertEqual(self.target.stat().st_ino, before)

    def test_preexisting_nonempty_directory_never_deleted_or_repaired(self):
        self.target.mkdir()
        (self.target / 'sentinel').write_bytes(b'preserve-original')
        before = self.target.stat().st_ino
        self.refusal('TARGET_EXISTS')
        self.assertEqual((self.target / 'sentinel').read_bytes(), b'preserve-original')
        self.assertEqual(self.target.stat().st_ino, before)

    def test_same_ancestor_and_nested_fixed_source_roots_refused(self):
        roots = [ROOT / 'terminal-resolution-observation-20261011', ROOT / 'terminal-fresh-provisioner-preparation-20261011', HELPER.parent]
        for root in roots:
            for value in [root, root / 'new-stage', root.parent]:
                with self.subTest(root=str(value)):
                    self.refusal('OVERLAPPING_SOURCE_ROOTS', str(value))
        if os.name == 'nt':
            self.refusal('OVERLAPPING_SOURCE_ROOTS', str(roots[0]).upper())
        self.assertFalse(self.target.exists())

    def test_noncanonical_relative_drive_root_and_missing_parent_refused(self):
        for value in ['relative', str(self.base) + os.sep + 'x' + os.sep + '..' + os.sep + 'target', str(self.base.anchor), str(self.target) + '\0', str(self.target) + '\ud800']:
            with self.subTest(path=repr(value)):
                self.refusal('TARGET_PATH_REFUSED', value)
        self.refusal('TARGET_PARENT_REFUSED', str(self.base / 'missing' / 'target'))
        self.assertFalse((self.base / 'missing').exists())

    def test_success_then_repeat_refuses_without_changing_any_bytes_or_identity(self):
        self.call()
        before = {p.relative_to(self.target).as_posix(): (p.stat().st_ino, p.read_bytes()) for p in self.target.rglob('*') if p.is_file()}
        self.refusal('TARGET_EXISTS')
        self.assertEqual({p.relative_to(self.target).as_posix(): (p.stat().st_ino, p.read_bytes()) for p in self.target.rglob('*') if p.is_file()}, before)

    def test_actual_preexisting_hardlink_target_is_preserved(self):
        existing = self.base / 'existing'
        existing.write_bytes(b'hardlink-preserved')
        os.link(existing, self.target)
        self.refusal('TARGET_EXISTS')
        self.assertEqual(self.target.read_bytes(), b'hardlink-preserved')
        self.assertEqual(self.target.stat().st_ino, existing.stat().st_ino)

    def test_conditional_input_validation_failure_has_zero_target_effects(self):
        # Private IO fault injection only; not an API hook or actual archive-corruption claim.
        with patch.object(api, '_validated_sources', side_effect=OSError('PRIVATE_RAW_ERROR')):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertFalse(self.target.exists())

    def test_conditional_late_write_failure_preserves_partial_and_refuses_retry(self):
        original_write = api._write_exclusive
        count = 0
        def fail_after_first(path, data):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError('PRIVATE_RAW_ERROR')
            return original_write(path, data)
        with patch.object(api, '_write_exclusive', side_effect=fail_after_first):
            self.refusal('STAGE_WRITE_FAILED', created=True)
        self.assertTrue(self.target.is_dir())
        partial = {p.relative_to(self.target).as_posix(): p.read_bytes() for p in self.target.rglob('*') if p.is_file()}
        self.assertEqual(len(partial), 1)
        self.refusal('TARGET_EXISTS')
        self.assertEqual({p.relative_to(self.target).as_posix(): p.read_bytes() for p in self.target.rglob('*') if p.is_file()}, partial)

    def test_conditional_same_byte_output_replacement_refuses_actual_changed_inode(self):
        original_write = api._write_exclusive
        replaced = False
        def replace_first(path, data):
            nonlocal replaced
            saved = original_write(path, data)
            if not replaced:
                replaced = True
                before = Path(path).stat().st_ino
                Path(path).rename(self.base / 'retired-original')
                Path(path).write_bytes(data)
                self.assertNotEqual(Path(path).stat().st_ino, before)
            return saved
        with patch.object(api, '_write_exclusive', side_effect=replace_first):
            self.refusal('STAGE_IDENTITY_CHANGED', created=True)
        self.assertTrue((self.base / 'retired-original').is_file())
        self.assertTrue(self.target.is_dir())

    def test_duplicate_binding_and_keyword_arguments_have_bounded_refusal(self):
        for invoke in [lambda: api.stage_historical_sources(str(self.target), target_directory=str(self.target)),
                       lambda: api.stage_historical_sources(target_directory=str(self.target), archive='no')]:
            with self.assertRaises(Exception) as caught:
                invoke()
            self.assertEqual(caught.exception.code, 'ARGUMENTS_REFUSED')
            self.assertIs(caught.exception.retained_directory_created, False)
        self.assertFalse(self.target.exists())

    def test_conditional_refusal_does_not_expose_original_error_chain(self):
        with patch.object(api, '_validated_sources', side_effect=OSError('PRIVATE_RAW_ERROR')):
            caught = self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertIsNone(caught.__context__)
        self.assertIsNone(caught.__cause__)

    def test_empty_preexisting_directory_still_refused(self):
        self.target.mkdir()
        identity = self.target.stat().st_ino
        self.refusal('TARGET_EXISTS')
        self.assertEqual(self.target.stat().st_ino, identity)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_file_parent_refused_without_creating_or_changing_it(self):
        parent = self.base / 'file-parent'
        parent.write_bytes(b'preserve-parent')
        self.refusal('TARGET_PARENT_REFUSED', str(parent / 'target'))
        self.assertEqual(parent.read_bytes(), b'preserve-parent')

    def test_conditional_fixed_read_wrong_hash_refused_before_output(self):
        # Own tiny DATA input substitutes only private IO; fixed source files unchanged.
        probe = self.base / 'probe'
        probe.write_bytes(b'tiny')
        with patch.object(api, '_validated_sources', side_effect=lambda: api._read_fixed(probe, 4, '0' * 64)):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertFalse(self.target.exists())
        self.assertEqual(probe.read_bytes(), b'tiny')

    def test_conditional_fixed_read_size_refused_before_open(self):
        probe = self.base / 'probe'
        probe.write_bytes(b'tiny')
        opened = []
        original_open = api.os.open
        def observed(path, *args, **kwargs):
            opened.append(str(path))
            return original_open(path, *args, **kwargs)
        with patch.object(api.os, 'open', side_effect=observed), patch.object(api, '_validated_sources', side_effect=lambda: api._read_fixed(probe, 3, '0' * 64)):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertEqual(opened, [])
        self.assertFalse(self.target.exists())

    def test_conditional_final_selected_member_bad_bytes_before_output(self):
        original_open = api.zipfile.ZipFile.open
        reads = []
        last = MAPPING[-1]['retainedExecutionMember']
        def observed(archive, member, *args, **kwargs):
            name = member.filename if isinstance(member, zipfile.ZipInfo) else member
            reads.append(name)
            if name == last:
                return io.BytesIO(b'not-original')
            return original_open(archive, member, *args, **kwargs)
        with patch.object(api.zipfile.ZipFile, 'open', new=observed):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertEqual(len(reads), 110)
        self.assertEqual(reads[-1], last)
        self.assertFalse(self.target.exists())

    def test_conditional_duplicate_selected_member_refused_before_output(self):
        original_infos = api.zipfile.ZipFile.infolist
        selected = {row[key] for row in MAPPING for key in ['topLevelMember', 'retainedExecutionMember']}
        def duplicate(archive):
            infos = list(original_infos(archive))
            duplicate_info = next(info for info in infos if info.filename == MAPPING[0]['topLevelMember'])
            removed = next(info for info in infos if info.filename not in selected)
            infos.remove(removed)
            return infos + [duplicate_info]
        with patch.object(api.zipfile.ZipFile, 'infolist', new=duplicate):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertFalse(self.target.exists())

    def test_conditional_selected_member_metadata_size_refused(self):
        original_infos = api.zipfile.ZipFile.infolist
        def wrong_size(archive):
            infos = []
            for info in original_infos(archive):
                if info.filename == MAPPING[-1]['retainedExecutionMember']:
                    info = copy.copy(info)
                    info.file_size += 1
                infos.append(info)
            return infos
        with patch.object(api.zipfile.ZipFile, 'infolist', new=wrong_size):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertFalse(self.target.exists())

    def test_conditional_mapping_traversal_refused_without_archive_traversal(self):
        original_read = api._read_fixed
        original_open = api.zipfile.ZipFile.open
        reads = []
        def read(path, size, digest):
            raw, identity = original_read(path, size, digest)
            if path == api._MAPPING:
                data = json.loads(raw)
                data['sourceGraph'][-1]['path'] = '../outside.mjs'
                raw = json.dumps(data).encode('utf-8')
            return raw, identity
        def opened(archive, *args, **kwargs):
            reads.append('archive')
            return original_open(archive, *args, **kwargs)
        with patch.object(api, '_read_fixed', new=read), patch.object(api.zipfile.ZipFile, 'open', new=opened):
            self.refusal('SOURCE_VALIDATION_FAILED')
        self.assertEqual(reads, [])
        self.assertFalse(self.target.exists())

    def test_conditional_changed_input_identity_refused_before_output(self):
        original_validate = api._validated_sources
        probe = self.base / 'input-identity-probe'
        probe.write_bytes(b'unchanged-bytes')
        def changed_input():
            rows, sources, inputs = original_validate()
            identity = api._identity(probe.lstat())
            probe.rename(self.base / 'retired-input')
            probe.write_bytes(b'unchanged-bytes')
            self.assertNotEqual(api._identity(probe.lstat()), identity)
            return rows, sources, inputs + [(probe, identity)]
        with patch.object(api, '_validated_sources', new=changed_input):
            self.refusal('SOURCE_IDENTITY_CHANGED')
        self.assertFalse(self.target.exists())
        self.assertEqual(probe.read_bytes(), b'unchanged-bytes')
        self.assertEqual((self.base / 'retired-input').read_bytes(), b'unchanged-bytes')

    def test_conditional_changed_content_with_new_observed_identity_refused(self):
        original_write = api._write_exclusive
        changed = False
        bad_path = None
        def changed_content(path, data):
            nonlocal changed, bad_path
            identity = original_write(path, data)
            if not changed:
                changed = True
                bad_path = Path(path)
                bad_path.write_bytes(bytes([data[0] ^ 1]) + data[1:])
                return api._identity(bad_path.lstat())
            return identity
        with patch.object(api, '_write_exclusive', new=changed_content):
            self.refusal('STAGE_CONTENT_CHANGED', created=True)
        self.assertTrue(bad_path.is_file())
        self.assertEqual(len([p for p in self.target.rglob('*') if p.is_file()]), 55)

    def test_conditional_extra_output_member_refused_and_retained(self):
        original_write = api._write_exclusive
        extra = self.target / 'unexpected-extra'
        def add_extra(path, data):
            identity = original_write(path, data)
            if not extra.exists():
                extra.write_bytes(b'preserved-extra')
            return identity
        with patch.object(api, '_write_exclusive', new=add_extra):
            self.refusal('STAGE_IDENTITY_CHANGED', created=True)
        self.assertEqual(extra.read_bytes(), b'preserved-extra')

    def test_conditional_root_replaced_during_final_read_refused(self):
        original_open = api.os.open
        moved = False
        retired = self.base / 'retired-root'
        def replace_root(path, flags, *args, **kwargs):
            nonlocal moved
            # First output read follows all initial created-directory checks.
            if not moved and str(path).startswith(str(self.target) + os.sep) and flags & os.O_CREAT == 0:
                moved = True
                old_inode = self.target.stat().st_ino
                self.target.rename(retired)
                self.target.mkdir()
                self.assertNotEqual(self.target.stat().st_ino, old_inode)
                for child in retired.iterdir():
                    child.rename(self.target / child.name)
            return original_open(path, flags, *args, **kwargs)
        with patch.object(api.os, 'open', new=replace_root):
            self.refusal('STAGE_IDENTITY_CHANGED', created=True)
        self.assertTrue(moved)
        self.assertTrue(retired.is_dir())
        self.assertEqual(len([p for p in self.target.rglob('*') if p.is_file()]), 55)

    def test_conditional_input_replaced_during_output_refused_created_true(self):
        original_validate = api._validated_sources
        original_write = api._write_exclusive
        probe = self.base / 'late-input-probe'
        probe.write_bytes(b'unchanged-bytes')
        identity = api._identity(probe.lstat())
        moved = False
        def validated_with_probe():
            rows, sources, inputs = original_validate()
            return rows, sources, inputs + [(probe, identity)]
        def replace_input(path, data):
            nonlocal moved
            saved = original_write(path, data)
            if not moved:
                moved = True
                probe.rename(self.base / 'retired-late-input')
                probe.write_bytes(b'unchanged-bytes')
                self.assertNotEqual(api._identity(probe.lstat()), identity)
            return saved
        with patch.object(api, '_validated_sources', new=validated_with_probe), patch.object(api, '_write_exclusive', new=replace_input):
            self.refusal('SOURCE_IDENTITY_CHANGED', created=True)
        self.assertEqual(probe.read_bytes(), b'unchanged-bytes')
        self.assertTrue((self.base / 'retired-late-input').is_file())


if __name__ == '__main__':
    unittest.main(verbosity=2)
