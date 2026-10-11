"""Inactive, fixed historical source-DATA stage. Never imports staged members.

Filesystem checks describe stdlib-visible observations, not an atomic security
boundary. There is no caller-controlled archive, mapping, policy, or hook.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import zipfile


_ROOT = Path(__file__).absolute().parents[3]
_PREPARATION = _ROOT / 'terminal-fresh-provisioner-preparation-20261011'
_ARCHIVE = _ROOT / 'terminal-resolution-observation-20261011/hosted-v1.zip'
_MAPPING = _PREPARATION / 'historical-execution-mapping.json'
_PINS = _PREPARATION / 'pins.json'
_FIXED = (
    (_PINS, 31970, '0544d8e3597fe4eb227191183f070b38af002a6898425b5f42dba506f794b9a4'),
    (_MAPPING, 307168, 'cc382522caa027c181383c9d52b60eace662521834169c7bb849be4fbe8c66ec'),
    (_ARCHIVE, 17469677, '0bde86db6923889ed7256096b516554234aa09140a7e6a346d5c3f528d60f7a2'),
)
_RETAINED = 'desktop/evidence/terminal-session-provision/38145096877-1/execution/'
_MISSING = object()
_CODES = frozenset({
    'ARGUMENTS_REFUSED', 'TARGET_PATH_REFUSED', 'OVERLAPPING_SOURCE_ROOTS',
    'TARGET_PARENT_REFUSED', 'TARGET_EXISTS', 'SOURCE_VALIDATION_FAILED',
    'SOURCE_IDENTITY_CHANGED', 'STAGE_CREATE_FAILED', 'STAGE_WRITE_FAILED',
    'STAGE_IDENTITY_CHANGED', 'STAGE_CONTENT_CHANGED',
})


class HistoricalSourceStageRefused(Exception):
    """Only a bounded code and whether an exclusive target root was created."""
    def __init__(self, code, created=False):
        self.code = code if code in _CODES else 'SOURCE_VALIDATION_FAILED'
        self.retained_directory_created = created is True
        super().__init__('HISTORICAL_SOURCE_STAGE_REFUSED: ' + self.code)


def _refuse(code, created=False):
    raise HistoricalSourceStageRefused(code, created) from None


def _is_link(snapshot):
    return stat.S_ISLNK(snapshot.st_mode) or bool(getattr(snapshot, 'st_file_attributes', 0) & 0x400)


def _object_identity(snapshot):
    # Windows can clear a transient directory attribute on first child creation.
    # Reparse/link refusal is checked separately at each observation.
    return (snapshot.st_dev, snapshot.st_ino, snapshot.st_mode)


def _identity(snapshot):
    # Python3.12 Windows path-stat ctime is legacy creation time, whereas
    # fd-stat ctime is modification time. Birthtime is the explicit stable
    # creation observation there; Unix keeps ctime for metadata changes.
    stamp = getattr(snapshot, 'st_birthtime_ns', snapshot.st_ctime_ns) if os.name == 'nt' else snapshot.st_ctime_ns
    return (_object_identity(snapshot), snapshot.st_nlink, snapshot.st_size,
            snapshot.st_mtime_ns, stamp)


def _regular(snapshot):
    return stat.S_ISREG(snapshot.st_mode) and not _is_link(snapshot) and snapshot.st_nlink == 1


def _read_fixed(path, expected_size, expected_hash):
    before = os.lstat(path)
    if not _regular(before) or before.st_size != expected_size:
        raise ValueError('fixed source shape')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as stream:
        if _identity(os.fstat(stream.fileno())) != _identity(before):
            raise ValueError('fixed source identity')
        raw = stream.read(expected_size + 1)
        after = os.fstat(stream.fileno())
    if (len(raw) != expected_size or _identity(before) != _identity(after)
            or _identity(os.lstat(path)) != _identity(before)
            or hashlib.sha256(raw).hexdigest() != expected_hash):
        raise ValueError('fixed source bytes')
    return raw, _identity(before)


def _closed_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate JSON property')
        result[key] = value
    return result


def _source_path(value):
    if (type(value) is not str or not 1 <= len(value) <= 1024
            or re.fullmatch(r'[A-Za-z0-9_.\-/]+', value) is None):
        return False
    parts = value.split('/')
    return (len(parts) > 1 and all(part not in ('', '.', '..') and not part.endswith('.') for part in parts)
            and not value.startswith('/') and not any(':' in part for part in parts))


def _validated_sources():
    """Private fixed-input validation; all source bytes buffered before output."""
    inputs = []
    payloads = []
    for path, size, digest in _FIXED:
        raw, identity = _read_fixed(path, size, digest)
        inputs.append((path, identity))
        payloads.append(raw)
    # Both inputs are pinned before parsing; pins are provenance, not caller authority.
    pins = json.loads(payloads[0], object_pairs_hook=_closed_pairs)
    mapping = json.loads(payloads[1], object_pairs_hook=_closed_pairs)
    if type(pins) is not dict or type(mapping) is not dict:
        raise ValueError('fixed JSON shape')
    graph = mapping.get('sourceGraph')
    if type(graph) is not list or len(graph) != 55:
        raise ValueError('source count')
    rows = []
    names = set()
    extension_counts = {'.mjs': 0, '.cc': 0, '.inc': 0, '.gyp': 0, '.json': 0}
    total = 0
    for row in graph:
        if type(row) is not dict or set(row) != {'path', 'bytes', 'sha256', 'topLevelMember', 'retainedExecutionMember'}:
            raise ValueError('source row')
        path, size, digest = row['path'], row['bytes'], row['sha256']
        if (not _source_path(path) or path.casefold() in names or type(size) is not int
                or not 0 <= size <= 1048576 or type(digest) is not str
                or re.fullmatch(r'[0-9a-f]{64}', digest) is None
                or row['topLevelMember'] != path or row['retainedExecutionMember'] != _RETAINED + path):
            raise ValueError('source row value')
        suffix = Path(path).suffix
        if suffix not in extension_counts:
            raise ValueError('source kind')
        extension_counts[suffix] += 1
        total += size
        names.add(path.casefold())
        rows.append(dict(row))
    if (total != 840444 or extension_counts != {'.mjs': 47, '.cc': 2, '.inc': 2, '.gyp': 2, '.json': 2}
            or [row['path'] for row in rows] != sorted(row['path'] for row in rows)):
        raise ValueError('source inventory')
    buffered = []
    with zipfile.ZipFile(io.BytesIO(payloads[2]), 'r') as archive:
        infos = archive.infolist()
        if len(infos) != 612:
            raise ValueError('archive inventory')
        by_name = {}
        for info in infos:
            by_name.setdefault(info.filename, []).append(info)
        for row in rows:
            pair = []
            for name in (row['topLevelMember'], row['retainedExecutionMember']):
                selected = by_name.get(name, [])
                if len(selected) != 1:
                    raise ValueError('archive duplicate or missing member')
                info = selected[0]
                mode = info.external_attr >> 16
                if (info.is_dir() or stat.S_ISLNK(mode) or info.flag_bits & 1
                        or info.file_size != row['bytes'] or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)):
                    raise ValueError('archive member shape')
                with archive.open(info, 'r') as stream:
                    raw = stream.read(row['bytes'] + 1)
                if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
                    raise ValueError('archive member bytes')
                pair.append(raw)
            if pair[0] != pair[1]:
                raise ValueError('archive duplicate disagreement')
            buffered.append((row['path'], pair[0]))
    return rows, buffered, inputs


def _fold_path(path):
    return os.path.normcase(os.path.normpath(str(path))).casefold()


def _overlaps(first, second):
    first, second = _fold_path(first), _fold_path(second)
    return first == second or first.startswith(second + os.sep) or second.startswith(first + os.sep)


def _target_path(value):
    if type(value) is not str or not 1 <= len(value) <= 32768:
        _refuse('TARGET_PATH_REFUSED')
    try:
        if len(value.encode('utf-8', 'strict')) > 32768 or any(ord(ch) < 32 for ch in value):
            _refuse('TARGET_PATH_REFUSED')
        if not os.path.isabs(value) or os.path.normpath(value) != value:
            _refuse('TARGET_PATH_REFUSED')
        if os.name == 'nt':
            if re.match(r'^[A-Z]:\\', value) is None or '/' in value:
                _refuse('TARGET_PATH_REFUSED')
            for part in value[3:].split('\\'):
                if (not part or part.endswith((' ', '.')) or any(ch in '<>:"|?*' for ch in part)
                        or part.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', *('COM' + str(n) for n in range(1, 10)), *('LPT' + str(n) for n in range(1, 10))}):
                    _refuse('TARGET_PATH_REFUSED')
        target = Path(value)
        if str(target) != value or target == Path(target.anchor):
            _refuse('TARGET_PATH_REFUSED')
    except HistoricalSourceStageRefused:
        raise
    except (ValueError, UnicodeError, OSError):
        _refuse('TARGET_PATH_REFUSED')
    for protected in (_ARCHIVE.parent, _PREPARATION, Path(__file__).absolute().parent):
        if _overlaps(target, protected):
            _refuse('OVERLAPPING_SOURCE_ROOTS')
    return target


def _parent_identity(parent):
    try:
        if os.path.realpath(parent) != str(parent):
            _refuse('TARGET_PARENT_REFUSED')
        for path in (parent, *parent.parents):
            snapshot = os.lstat(path)
            if not stat.S_ISDIR(snapshot.st_mode) or _is_link(snapshot):
                _refuse('TARGET_PARENT_REFUSED')
        return _object_identity(os.lstat(parent))
    except HistoricalSourceStageRefused:
        raise
    except (ValueError, OSError):
        _refuse('TARGET_PARENT_REFUSED')


def _absent(target):
    try:
        os.lstat(target)
    except FileNotFoundError:
        return
    except OSError:
        _refuse('TARGET_PATH_REFUSED')
    _refuse('TARGET_EXISTS')


def _write_exclusive(path, data):
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_RDWR | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        if stream.write(data) != len(data):
            raise OSError('short exclusive write')
        stream.flush()
        snapshot = os.fstat(stream.fileno())
    if not _regular(snapshot):
        raise OSError('exclusive identity')
    return _identity(snapshot)


def _check_directories(directories):
    for path, identity in directories.items():
        snapshot = os.lstat(path)
        if _is_link(snapshot) or not stat.S_ISDIR(snapshot.st_mode) or _object_identity(snapshot) != identity:
            _refuse('STAGE_IDENTITY_CHANGED', True)


def _check_membership(target, directories, files):
    expected_files = set(files)
    expected_dirs = set(directories) - {target}
    seen_files, seen_dirs = set(), set()
    for base, children, members in os.walk(target, followlinks=False):
        base = Path(base)
        for name in children:
            path = base / name
            if path not in expected_dirs:
                _refuse('STAGE_IDENTITY_CHANGED', True)
            seen_dirs.add(path)
        for name in members:
            path = base / name
            if path not in expected_files:
                _refuse('STAGE_IDENTITY_CHANGED', True)
            seen_files.add(path)
    if seen_files != expected_files or seen_dirs != expected_dirs:
        _refuse('STAGE_IDENTITY_CHANGED', True)


def _check_created(target, directories, files, rows):
    _check_directories(directories)
    _check_membership(target, directories, files)
    for row in rows:
        path = target / row['path']
        snapshot = os.lstat(path)
        if not _regular(snapshot) or _identity(snapshot) != files[path]:
            _refuse('STAGE_IDENTITY_CHANGED', True)
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(descriptor, 'rb') as stream:
            if _identity(os.fstat(stream.fileno())) != files[path]:
                _refuse('STAGE_IDENTITY_CHANGED', True)
            raw = stream.read(row['bytes'] + 1)
            if _identity(os.fstat(stream.fileno())) != files[path]:
                _refuse('STAGE_IDENTITY_CHANGED', True)
        if _identity(os.lstat(path)) != files[path]:
            _refuse('STAGE_IDENTITY_CHANGED', True)
        if len(raw) != row['bytes'] or hashlib.sha256(raw).hexdigest() != row['sha256']:
            _refuse('STAGE_CONTENT_CHANGED', True)
    _check_directories(directories)
    _check_membership(target, directories, files)


def _check_inputs(inputs, created=False):
    try:
        if any(_identity(os.lstat(path)) != identity or not _regular(os.lstat(path)) for path, identity in inputs):
            _refuse('SOURCE_IDENTITY_CHANGED', created)
    except HistoricalSourceStageRefused:
        raise
    except Exception:
        _refuse('SOURCE_IDENTITY_CHANGED', created)


def stage_historical_sources(target_directory=_MISSING, /, *extra, **kwargs):
    """Exclusively stage the fixed55 original source DATA, or retain refusal.

    No member is imported or executed. Failure never deletes, repairs, retries,
    refunds, or overwrites an output. A created partial target remains owned.
    """
    if target_directory is _MISSING or extra or kwargs:
        _refuse('ARGUMENTS_REFUSED')
    try:
        return _stage_historical_sources(target_directory)
    except HistoricalSourceStageRefused as error:
        code, created = error.code, error.retained_directory_created
    # Raise a fresh bounded error outside the handler: even __context__ must
    # not retain a raw IO exception, path, or private error string.
    _refuse(code, created)


def _stage_historical_sources(target_directory):
    target = _target_path(target_directory)
    parent = _parent_identity(target.parent)
    _absent(target)
    try:
        rows, sources, inputs = _validated_sources()
    except Exception:
        _refuse('SOURCE_VALIDATION_FAILED')
    _check_inputs(inputs)
    if _parent_identity(target.parent) != parent:
        _refuse('TARGET_PARENT_REFUSED')
    _absent(target)
    try:
        os.mkdir(target)
    except FileExistsError:
        _refuse('TARGET_EXISTS')
    except Exception:
        _refuse('STAGE_CREATE_FAILED')
    try:
        directories = {target: _object_identity(os.lstat(target))}
        files = {}
        for relative, data in sources:
            path = target / relative
            for directory in reversed(path.parent.parents):
                if target not in directory.parents or directory in directories:
                    continue
                os.mkdir(directory)
                directories[directory] = _object_identity(os.lstat(directory))
            if path.parent not in directories:
                os.mkdir(path.parent)
                directories[path.parent] = _object_identity(os.lstat(path.parent))
            files[path] = _write_exclusive(path, data)
    except Exception:
        _refuse('STAGE_WRITE_FAILED', True)
    try:
        if _parent_identity(target.parent) != parent:
            _refuse('STAGE_IDENTITY_CHANGED', True)
        _check_created(target, directories, files, rows)
        _check_inputs(inputs, True)
        if _parent_identity(target.parent) != parent:
            _refuse('STAGE_IDENTITY_CHANGED', True)
    except HistoricalSourceStageRefused as error:
        if error.retained_directory_created:
            raise
        _refuse('STAGE_IDENTITY_CHANGED', True)
    except Exception:
        _refuse('STAGE_IDENTITY_CHANGED', True)
    return {
        'schema': 'siren-terminal-historical-source-stage/v1',
        'evidenceClass': 'ORIGINAL_SOURCE_STAGE_ONLY',
        'sourceEntries': len(rows), 'sourceBytes': sum(row['bytes'] for row in rows),
        'files': [{key: row[key] for key in ('path', 'bytes', 'sha256')} for row in rows],
        'archiveSha256': _FIXED[2][2], 'mappingSha256': _FIXED[1][2], 'preparationSha256': _FIXED[0][2],
        'retainedDirectoryCreated': True,
        'nativeExecution': False, 'provisioningComplete': False, 'executionAuthorized': False,
        'nativeAdmission': False, 'oldRuntimeEquivalent': False,
        'filesystemGuarantee': 'STDLIB_VISIBLE_NONATOMIC_OBSERVATIONS_NOT_SECURITY_BOUNDARY',
    }
