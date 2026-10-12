"""Inactive whole-job ZIP DATA retention. Never executes an archived member.

Trusted parent owns the source/target ancestors. Checks are stdlib-visible,
non-atomic observations, not a hostile-race or native filesystem boundary.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import zipfile

_MAX_ENTRIES = 200000
_MAX_DEPTH = 64
_MAX_PATH_BYTES = 4096
_MAX_FILE_BYTES = 512 * 1024 * 1024
_MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024
_MAX_ARCHIVE_BYTES = 12 * 1024 * 1024 * 1024
_CHUNK = 65536
_MISSING = object()
_CODES = frozenset({'ARGUMENTS_REFUSED', 'PATH_REFUSED', 'OVERLAP_REFUSED', 'TARGET_EXISTS',
                    'SOURCE_REFUSED', 'LIMIT_EXCEEDED', 'SOURCE_CHANGED', 'ARCHIVE_CREATE_FAILED',
                    'ARCHIVE_WRITE_FAILED', 'ARCHIVE_VERIFY_FAILED', 'IO_UNAVAILABLE'})


class _Refusal(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__('WHOLE_JOB_ARCHIVE_REFUSED')


def _fail(code):
    raise _Refusal(code) from None


def _link(s):
    return stat.S_ISLNK(s.st_mode) or bool(getattr(s, 'st_file_attributes', 0) & 0x400)


def _object(s):
    return (s.st_dev, s.st_ino, s.st_mode)


def _identity(s):
    # Python3.12 Windows path-stat legacy ctime and fd-stat ctime differ.
    # Birthtime+mtime are explicit cross-interface observations there.
    birth = getattr(s, 'st_birthtime_ns', s.st_ctime_ns) if os.name == 'nt' else s.st_ctime_ns
    identity = _object(s)
    # Windows path-stat synthesizes execute bits from .cmd/.exe suffixes;
    # fd-stat cannot reproduce them. Keep file type and read/write bits,
    # normalizing only these derived bits for regular files on Windows.
    if os.name == 'nt' and stat.S_ISREG(s.st_mode):
        identity = (s.st_dev, s.st_ino, s.st_mode & ~0o111)
    return (identity, s.st_nlink, s.st_size, s.st_mtime_ns, birth)


def _component(name):
    if (not name or name in ('.', '..') or name.endswith((' ', '.'))
            or any(ord(c) < 32 or ord(c) == 127 for c in name)
            or any(c in '<>:"/\\|?*' for c in name)
            or re.fullmatch(r'(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?', name, re.I)):
        _fail('PATH_REFUSED')
    try:
        if len(name) > 1024 or len(name.encode('utf-8')) > _MAX_PATH_BYTES:
            _fail('LIMIT_EXCEEDED')
    except UnicodeError:
        _fail('PATH_REFUSED')


def _path(value):
    if (type(value) is not str or not 1 <= len(value) <= 32768 or '\0' in value
            or value.startswith(('\\\\', '//')) or not os.path.isabs(value)
            or os.path.normpath(value) != value or os.path.abspath(value) != value):
        _fail('PATH_REFUSED')
    p = Path(value)
    if p == Path(p.anchor) or (os.name == 'nt' and not re.match(r'^[A-Z]:\\', value)):
        _fail('PATH_REFUSED')
    for part in p.parts[1:]:
        _component(part)
    return p


def _ancestors(directory):
    saved = []
    for p in reversed((directory, *directory.parents)):
        s = os.lstat(p)
        if _link(s) or not stat.S_ISDIR(s.st_mode) or os.path.realpath(p) != str(p):
            _fail('PATH_REFUSED')
        saved.append((p, _object(s)))
    return saved


def _recheck_ancestors(saved):
    for p, identity in saved:
        s = os.lstat(p)
        if _link(s) or not stat.S_ISDIR(s.st_mode) or _object(s) != identity or os.path.realpath(p) != str(p):
            _fail('SOURCE_CHANGED')


def _absent(target):
    try:
        os.lstat(target)
    except FileNotFoundError:
        return
    _fail('TARGET_EXISTS')


def _collect_tree(source):
    rows = []
    total = 0
    identities = set()
    folded_paths = set()

    def visit(p, relative, depth):
        nonlocal total
        if len(rows) >= _MAX_ENTRIES or depth > _MAX_DEPTH or len(relative.encode('utf-8')) > _MAX_PATH_BYTES:
            _fail('LIMIT_EXCEEDED')
        folded = relative.casefold()
        if folded in folded_paths:
            _fail('SOURCE_REFUSED')
        folded_paths.add(folded)
        s = os.lstat(p)
        if _link(s) or os.path.realpath(p) != str(p):
            _fail('SOURCE_REFUSED')
        identity = (s.st_dev, s.st_ino)
        if identity in identities:
            _fail('SOURCE_REFUSED')
        identities.add(identity)
        directory = stat.S_ISDIR(s.st_mode)
        if not directory and (not stat.S_ISREG(s.st_mode) or s.st_nlink != 1):
            _fail('SOURCE_REFUSED')
        if not directory:
            if not 0 <= s.st_size <= _MAX_FILE_BYTES:
                _fail('LIMIT_EXCEEDED')
            total += s.st_size
            if total > _MAX_TOTAL_BYTES:
                _fail('LIMIT_EXCEEDED')
        row = {'path': p, 'relative': relative, 'directory': directory, 'identity': _identity(s), 'bytes': 0 if directory else s.st_size}
        rows.append(row)
        if directory:
            names = []
            folded_names = set()
            with os.scandir(p) as entries:
                for entry in entries:
                    if len(rows) + len(names) >= _MAX_ENTRIES:
                        _fail('LIMIT_EXCEEDED')
                    _component(entry.name)
                    if entry.name.casefold() in folded_names:
                        _fail('SOURCE_REFUSED')
                    folded_names.add(entry.name.casefold())
                    names.append(entry.name)
            row['members'] = tuple(sorted(names))
            for name in row['members']:
                visit(p / name, relative + name + ('/' if stat.S_ISDIR(os.lstat(p / name).st_mode) else ''), depth + 1)

    _component(source.name)
    initial = os.lstat(source)
    if _link(initial) or not stat.S_ISDIR(initial.st_mode):
        _fail('SOURCE_REFUSED')
    visit(source, source.name + '/', 0)
    return rows, total


def _recheck_tree(source, rows):
    try:
        current, _ = _collect_tree(source)
        if len(current) != len(rows):
            _fail('SOURCE_CHANGED')
        for before, after in zip(rows, current):
            if any(before.get(k) != after.get(k) for k in ('relative', 'directory', 'identity', 'members', 'bytes')):
                _fail('SOURCE_CHANGED')
    except BaseException:
        _fail('SOURCE_CHANGED')


def _zip_info(row):
    info = zipfile.ZipInfo(row['relative'])
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = ((stat.S_IFDIR | 0o755) << 16) | 0x10 if row['directory'] else (stat.S_IFREG | 0o600) << 16
    return info


def _copy_source_file(archive, row):
    before = os.lstat(row['path'])
    if _link(before) or _identity(before) != row['identity']:
        _fail('SOURCE_CHANGED')
    descriptor = os.open(row['path'], os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
    digest = hashlib.sha256()
    count = 0
    with os.fdopen(descriptor, 'rb') as source:
        if _identity(os.fstat(source.fileno())) != row['identity']:
            _fail('SOURCE_CHANGED')
        with archive.open(_zip_info(row), 'w', force_zip64=True) as target:
            while True:
                data = source.read(min(_CHUNK, row['bytes'] - count + 1))
                if not data:
                    break
                count += len(data)
                if count > row['bytes'] or count > _MAX_FILE_BYTES:
                    _fail('SOURCE_CHANGED')
                digest.update(data)
                target.write(data)
        if count != row['bytes'] or _identity(os.fstat(source.fileno())) != row['identity']:
            _fail('SOURCE_CHANGED')
    if _identity(os.lstat(row['path'])) != row['identity']:
        _fail('SOURCE_CHANGED')
    return digest.hexdigest()


def _verify_archive(target, rows, hashes):
    before = os.lstat(target)
    if _link(before) or not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or not 0 < before.st_size <= _MAX_ARCHIVE_BYTES:
        _fail('ARCHIVE_VERIFY_FAILED')
    descriptor = os.open(target, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as stream:
        if _identity(os.fstat(stream.fileno())) != _identity(before):
            _fail('ARCHIVE_VERIFY_FAILED')
        with zipfile.ZipFile(stream, 'r') as archive:
            infos = archive.infolist()
            if len(infos) != len(rows) or len(infos) > _MAX_ENTRIES or [r.filename for r in infos] != [r['relative'] for r in rows]:
                _fail('ARCHIVE_VERIFY_FAILED')
            total = 0
            for row, info in zip(rows, infos):
                if info.is_dir() != row['directory'] or info.file_size != row['bytes'] or info.flag_bits & 1:
                    _fail('ARCHIVE_VERIFY_FAILED')
                if row['directory']:
                    if archive.read(info) != b'':
                        _fail('ARCHIVE_VERIFY_FAILED')
                    continue
                count = 0
                digest = hashlib.sha256()
                with archive.open(info) as member:
                    while True:
                        data = member.read(min(_CHUNK, row['bytes'] - count + 1))
                        if not data:
                            break
                        count += len(data)
                        total += len(data)
                        if count > row['bytes'] or total > _MAX_TOTAL_BYTES:
                            _fail('ARCHIVE_VERIFY_FAILED')
                        digest.update(data)
                if count != row['bytes'] or digest.hexdigest() != hashes[row['relative']]:
                    _fail('ARCHIVE_VERIFY_FAILED')
        stream.seek(0)
        digest = hashlib.sha256()
        count = 0
        while True:
            data = stream.read(_CHUNK)
            if not data:
                break
            count += len(data)
            if count > _MAX_ARCHIVE_BYTES:
                _fail('ARCHIVE_VERIFY_FAILED')
            digest.update(data)
        if count != before.st_size or _identity(os.fstat(stream.fileno())) != _identity(before):
            _fail('ARCHIVE_VERIFY_FAILED')
    if _identity(os.lstat(target)) != _identity(before):
        _fail('ARCHIVE_VERIFY_FAILED')
    return count, digest.hexdigest()


def archive_fresh_build_job(source_directory=_MISSING, target_zip=_MISSING, /, *extra, **kwargs):
    """Two exact positional strings; bounded DATA result, no cleanup/retry."""
    created = False
    phase = 'IO_UNAVAILABLE'
    if extra or kwargs or type(source_directory) is not str or type(target_zip) is not str:
        return _result(False, 'ARGUMENTS_REFUSED', False)
    try:
        source, target = _path(source_directory), _path(target_zip)
        left, right = str(source).casefold(), str(target).casefold()
        if left == right or right.startswith(left + os.sep) or left.startswith(right + os.sep):
            _fail('OVERLAP_REFUSED')
        parents = _ancestors(source.parent) + _ancestors(target.parent)
        _absent(target)
        rows, total = _collect_tree(source)
        _recheck_tree(source, rows)
        _recheck_ancestors(parents)
        _absent(target)
        phase = 'ARCHIVE_CREATE_FAILED'
        descriptor = os.open(target, os.O_RDWR | os.O_CREAT | os.O_EXCL | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        created = True
        phase = 'ARCHIVE_WRITE_FAILED'
        hashes = {}
        with os.fdopen(descriptor, 'w+b') as stream:
            with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
                for row in rows:
                    if row['directory']:
                        archive.writestr(_zip_info(row), b'')
                    else:
                        hashes[row['relative']] = _copy_source_file(archive, row)
        _recheck_tree(source, rows)
        phase = 'ARCHIVE_VERIFY_FAILED'
        archive_bytes, archive_hash = _verify_archive(target, rows, hashes)
        _recheck_tree(source, rows)
        _recheck_ancestors(parents)
        records = [{'path': r['relative'], 'kind': 'DIRECTORY' if r['directory'] else 'FILE',
                    'bytes': r['bytes'], 'sha256': None if r['directory'] else hashes[r['relative']]} for r in rows]
        tree_hash = hashlib.sha256(json.dumps(records, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
        return {**_result(True, 'WHOLE_JOB_ARCHIVE_VERIFIED', True), 'entries': len(rows),
                'files': len(hashes), 'directories': len(rows) - len(hashes), 'sourceBytes': total,
                'archiveBytes': archive_bytes, 'archiveSha256': archive_hash, 'treeSha256': tree_hash,
                'filesystemGuarantee': 'STDLIB_VISIBLE_NONATOMIC_OBSERVATIONS_NOT_SECURITY_BOUNDARY'}
    except _Refusal as error:
        code = error.code if type(error) is _Refusal and error.code in _CODES else phase
    except BaseException:
        code = phase
    return _result(False, code, created)


def _result(ok, code, created):
    return {'schema': 'siren-terminal-whole-build-archive/v1', 'ok': ok, 'code': code,
            'evidenceClass': 'WHOLE_JOB_SOURCE_TREE_AND_ZIP_DATA', 'archiveCreated': created,
            'cleanupPerformed': False, 'sourceDeletionAttempted': False, 'nativeAdmission': False,
            'inputAuthorized': False, 'productApproval': False}


def _valid_hosted_data(data):
    return (type(data) is dict and data.get('platform') == 'win32' and data.get('repository') == 'Kellas94/siren'
            and data.get('ref') == 'refs/heads/probe/terminal-system-seeded-20261012'
            and all(type(data.get(k)) is str and re.fullmatch(r'[1-9][0-9]{0,19}', data[k]) for k in ('run', 'attempt'))
            and type(data.get('commit')) is str and re.fullmatch(r'[a-f0-9]{40}', data['commit']) is not None)


def _job_name(name):
    return type(name) is str and re.fullmatch(r'siren-fresh-runtime-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', name) is not None


def _receipt(path, data):
    payload = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    if len(payload) > 65536:
        _fail('LIMIT_EXCEEDED')
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(payload)


def _hosted_cli():
    data = {'platform': sys.platform, 'repository': os.environ.get('GITHUB_REPOSITORY'),
            'ref': os.environ.get('GITHUB_REF'), 'run': os.environ.get('GITHUB_RUN_ID'),
            'attempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'commit': os.environ.get('GITHUB_SHA')}
    aggregate = {'schema': 'siren-terminal-whole-build-archive-cli/v1', 'ok': False,
                 'code': 'HOSTED_CONTEXT_REFUSED', 'jobs': [], 'nativeAdmission': False,
                 'inputAuthorized': False, 'cleanupPerformed': False}
    try:
        if len(sys.argv) != 1 or os.environ.get('GITHUB_ACTIONS') != 'true' or not _valid_hosted_data(data):
            return aggregate
        temp = _path(os.environ.get('RUNNER_TEMP'))
        launch = temp / 'siren-fresh-build-launch'
        anchors = _ancestors(temp) + _ancestors(launch)
        names = []
        with os.scandir(temp) as entries:
            count = 0
            for entry in entries:
                count += 1
                if count > 4096:
                    _fail('LIMIT_EXCEEDED')
                if _job_name(entry.name):
                    names.append(entry.name)
                    if len(names) > 8:
                        _fail('LIMIT_EXCEEDED')
        aggregate.update({**data, 'code': 'NO_OWNED_RUNTIME_FOUND',
                          'ownershipPrerequisite': 'TRUSTED_JOB_ISOLATED_RUNNER_TEMP_NOT_UUID_AUTHENTICATION'})
        for name in sorted(names):
            result = archive_fresh_build_job(str(temp / name), str(launch / (name + '.zip')))
            row = {'root': name, **result}
            aggregate['jobs'].append(row)
            try:
                _recheck_ancestors(anchors)
                _receipt(launch / (name + '.archive.json'), row)
            except BaseException:
                aggregate['code'] = 'PER_ROOT_RECEIPT_RETENTION_FAILED'
        if names and aggregate['code'] != 'PER_ROOT_RECEIPT_RETENTION_FAILED':
            aggregate['ok'] = all(row['ok'] for row in aggregate['jobs'])
            aggregate['code'] = 'ALL_SELECTED_JOB_ARCHIVES_VERIFIED' if aggregate['ok'] else 'INCOMPLETE_JOB_ARCHIVE'
        _recheck_ancestors(anchors)
        _receipt(launch / 'whole-job-archive-status.json', aggregate)
    except BaseException:
        aggregate['ok'] = False
        aggregate['code'] = 'ARCHIVE_OR_STATUS_RETENTION_FAILED'
    return aggregate


if __name__ == '__main__':
    result = _hosted_cli()
    print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    sys.exit(0 if result['ok'] else 1)
