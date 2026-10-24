"""Private cached readiness diagnostics. Import performs no I/O or OS acquisition."""
import json
import math
import ntpath
import types

_READINESS = 'C:/Claude/SIREN_WORK/terminal-dialog-readiness-gate-20261018/readiness.py'
_DRIVER = 'C:/Claude/SIREN_WORK/terminal-readonly-dialog-topology-20261018/context/reference/folder_dialog_driver.py'
_ALLOW = {
    ntpath.normcase(ntpath.normpath(_READINESS)): ('readiness.py', frozenset(
        'OwnedDialogReadiness.' + n for n in ('wait_ready', '_sample', '_window', '_fail', '_parent', '_chain', '_call', '_checked', '_time', '_process'))),
    ntpath.normcase(ntpath.normpath(_DRIVER)): ('folder_dialog_driver.py', frozenset(
        'FolderDialogDriver.' + n for n in ('_window', '_fail', '_parent', '_chain', '_call', '_checked', '_observe', '_operate', 'discover'))),
}
_POLICY = 'C:/Claude/SIREN_WORK/terminal-enumeration-lifetime-policy-v2-20261019/candidate/'
_ALLOW[ntpath.normcase(ntpath.normpath(_POLICY + 'readiness.py'))] = _ALLOW[ntpath.normcase(ntpath.normpath(_READINESS))]
_ALLOW[ntpath.normcase(ntpath.normpath(_POLICY + 'diagnostic_driver.py'))] = (
    'diagnostic_driver.py', frozenset(('DiscoveryDiagnosticDriver._window',)))
_TRACEBACK = BaseException.__dict__['__traceback__']

def trace_error(error):
    """Finite source labels only; synthetic filenames are not source attestation."""
    if not isinstance(error, BaseException):
        raise ValueError('TRACE_EXCEPTION_TYPE_REFUSED')
    tb = _TRACEBACK.__get__(error, BaseException)
    rows = []; walked = 0; filtered = 0; omitted = 0
    while type(tb) is types.TracebackType and walked < 32:
        walked += 1
        frame = tb.tb_frame; code = frame.f_code
        filename = code.co_filename
        allowed = None if len(filename) > 1024 or len(code.co_qualname) > 128 else _ALLOW.get(ntpath.normcase(ntpath.normpath(filename)))
        if allowed is None or code.co_qualname not in allowed[1]:
            filtered += 1
        elif len(rows) >= 8:
            omitted += 1
        else:
            row = dict(source=allowed[0], function=code.co_qualname, line=tb.tb_lineno)
            if code.co_qualname in ('OwnedDialogReadiness._window', 'FolderDialogDriver._window', 'DiscoveryDiagnosticDriver._window'):
                # This is the sole allowed local. Its label supplies no authority.
                hwnd = frame.f_locals.get('hwnd')
                if type(hwnd) is int and 0 < hwnd < 2**64:
                    row.update(hwndDecimal=str(hwnd), hwndType='exact-int-audit-only')
            rows.append(row)
        tb = tb.tb_next
    return dict(status='CAPTURED', frames=rows, walkedCount=walked, filteredCount=filtered,
                allowedNotRetainedCount=omitted, walkTruncated=tb is not None,
                frameTruncated=omitted > 0)

def _refuse():
    raise ValueError('DISCOVERY_DATA_SCHEMA_REFUSED')

def _keys(value, names):
    if type(value) is not dict or len(value) != len(names):
        _refuse()
    if any(type(key) is not str for key in value) or set(value) != set(names):
        _refuse()

def _integer(value, lo, hi):
    if type(value) is not int or not lo <= value <= hi:
        _refuse()
    return value

def _boolean(value):
    if type(value) is not bool:
        _refuse()
    return value

def _optional_count(value):
    return None if value is None else _integer(value, 0, 4096)

def _snapshot(value):
    _keys(value, ('schema', 'phase', 'samples', 'observations', 'truncated', 'diagnosticErrorCount'))
    if type(value['schema']) is not int or value['schema'] != 1:
        _refuse()
    phase = value['phase']
    if type(phase) is not str or phase not in ('readiness-new', 'readiness-waiting', 'readiness-ready', 'readiness-failed'):
        _refuse()
    observations = value['observations']
    if type(observations) is not list or len(observations) > 4:
        _refuse()
    rows = []
    for row in observations:
        _keys(row, ('ordinal', 'elapsed', 'enumeratedCount', 'scannedCount', 'candidateCount', 'cardinalityEvaluated', 'ownedWindows', 'rowsTruncated', 'policyCompleted', 'status'))
        elapsed = row['elapsed']
        if elapsed is not None and (type(elapsed) not in (int, float) or not math.isfinite(elapsed) or elapsed < 0):
            _refuse()
        status = row['status']
        if type(status) is not str or status not in ('PARTIAL', 'COMPLETE'):
            _refuse()
        owned = row['ownedWindows']
        if type(owned) is not list or len(owned) > 16:
            _refuse()
        windows = []
        for window in owned:
            _keys(window, ('hwnd', 'pid', 'tid', 'className', 'classNameTruncated', 'dialogClassMatch', 'owner', 'visible', 'enabled'))
            name = window['className']
            if type(name) is not str or len(name) > 128:
                _refuse()
            windows.append(dict(hwnd=_integer(window['hwnd'], 1, 2**64-1),
                pid=_integer(window['pid'], 1, 2**32-1), tid=_integer(window['tid'], 1, 2**32-1),
                className=name, classNameTruncated=_boolean(window['classNameTruncated']),
                dialogClassMatch=_boolean(window['dialogClassMatch']), owner=_integer(window['owner'], 0, 2**64-1),
                visible=_boolean(window['visible']), enabled=_boolean(window['enabled'])))
        rows.append(dict(ordinal=_integer(row['ordinal'], 1, 128), elapsed=elapsed,
            enumeratedCount=_optional_count(row['enumeratedCount']), scannedCount=_integer(row['scannedCount'], 0, 4096),
            candidateCount=_optional_count(row['candidateCount']), cardinalityEvaluated=_boolean(row['cardinalityEvaluated']),
            ownedWindows=windows, rowsTruncated=_boolean(row['rowsTruncated']),
            policyCompleted=_boolean(row['policyCompleted']), status=status))
    copied = dict(schema=1, phase=phase, samples=_integer(value['samples'], 0, 128), observations=rows,
        truncated=_boolean(value['truncated']), diagnosticErrorCount=_integer(value['diagnosticErrorCount'], 0, 2**31-1))
    if len(json.dumps(copied, ensure_ascii=True, allow_nan=False).encode('utf8')) > 65536:
        _refuse()
    return copied

class ReadinessAttempt:
    """One reserved call; raw outcomes stay private to the trusted Python caller.

    run() deliberately does not raise the captured primary. The caller checks
    primary_present and can re-raise primary_reason with its original identity.
    data() is diagnostic DATA only and cannot prove readiness or a rejected HWND.
    """
    def __init__(self, readiness):
        self._readiness = readiness; self._used = False; self._running = False
        self.result_present = False; self.result = None
        self.primary_present = False; self.primary_reason = None
        self._stage = 'NOT_STARTED'; self._called = False; self._boundary = None
        self._snapshot_status = 'NOT_ATTEMPTED'; self._snapshot = None
        self._trace = dict(status='NOT_ATTEMPTED', frames=[])
        self._errors = []; self._error_count = 0

    def _secondary(self, stage, error):
        self._error_count += 1
        if len(self._errors) < 8:
            self._errors.append((stage, error))

    @property
    def secondary_errors(self):
        return tuple(self._errors)

    def run(self):
        if self._running:
            self._secondary('reentry', RuntimeError('READINESS_RETENTION_REENTRY'))
            return self
        if self._used:
            return self
        self._used = True; self._running = True; self._stage = 'LOOKUP'
        try:
            try:
                wait = self._readiness.wait_ready
                self._stage = 'CALL'; self._called = True
                self.result = wait(); self.result_present = True; self._stage = 'RETURNED'
            except BaseException as error:
                # First original error is stored before traceback/snapshot callouts.
                self.primary_present = True; self.primary_reason = error
                self._boundary = self._stage; self._stage = 'RAISED'
                try:
                    self._trace = trace_error(error)
                except BaseException as trace_failure:
                    self._trace = dict(status='UNAVAILABLE', frames=[])
                    self._secondary('trace', trace_failure)
            try:
                self._snapshot_status = 'UNAVAILABLE'
                self._snapshot = _snapshot(self._readiness.discovery_snapshot())
                self._snapshot_status = 'CAPTURED'
            except BaseException as error:
                self._secondary('snapshot', error)
            try:
                errors = self._readiness.discovery_secondary_errors
                if type(errors) is not tuple:
                    raise ValueError('DISCOVERY_ERRORS_SCHEMA_REFUSED')
                # No formatting or equality/truthiness tests on exception values.
                if any(not isinstance(error, BaseException) for error in errors[:8]):
                    raise ValueError('DISCOVERY_ERRORS_SCHEMA_REFUSED')
                for error in errors[:8]:
                    self._secondary('discovery-errors', error)
                self._error_count += max(0, len(errors)-8)
            except BaseException as error:
                self._secondary('discovery-errors', error)
        finally:
            self._running = False
        return self

    def data(self):
        # All values below were constructed here or schema-validated builtins.
        return json.loads(json.dumps(dict(schema=1, waitStage=self._stage, waitCalled=self._called,
            waitFailureBoundary=self._boundary, running=self._running, resultPresent=self.result_present,
            primaryPresent=self.primary_present, snapshotStatus=self._snapshot_status, snapshot=self._snapshot,
            trace=self._trace, secondaryCount=self._error_count,
            secondaryTruncated=self._error_count > len(self._errors),
            secondaryStages=[stage for stage, _ in self._errors]), ensure_ascii=True, allow_nan=False))
