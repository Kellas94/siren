"""Pure private QA receipt parser. Caller owns retention, identity and lifecycle."""
import json
import math
import re

FIXED_TARGET = r'C:\Claude\SIREN_WORK\terminal-fixed-directory-guard-v1-20261021\owned-cwd'
SOURCE = 'file:///C:/Claude/SIREN_WORK/terminal-operational-four-stage-candidate-v1-20261022-image/runtime/desktop/src/terminal/private-picker-close-observer.mjs'
STAGES = ('prepare', 'write-join', 'retire-views', 'journal', 'window-close')
ADVERSE = ('SIREN_PICKER_FINAL_ADVERSE', 'SIREN_CLOSE_FAILURE', 'SIREN_CLOSE_ROLLBACK_FAILURE')
SAFE = 9007199254740991


class Refused(RuntimeError):
    pass


def need(condition, reason):
    if not condition:
        raise Refused(reason)


def integer(value, lower=0, upper=SAFE):
    return type(value) is int and lower <= value <= upper


def exact(value, expected):
    return type(value) is type(expected) and value == expected


def schema(value, expected):
    need(type(value) is dict and value.keys() == expected.keys(), 'closed schema')
    for key, item in expected.items():
        need(exact(value[key], item), 'field value or type')


def raw_text(value, maximum):
    need(type(value) in (bytes, str), 'raw input type')
    try:
        raw = value if type(value) is bytes else value.encode('utf8', 'strict')
        need(len(raw) <= maximum, 'raw byte bound')
        text = raw.decode('utf8', 'strict')
    except UnicodeError:
        raise Refused('raw encoding') from None
    need(not raw or raw.endswith(b'\n'), 'incomplete final line')
    return raw, text


def pairs(items):
    result = {}
    for key, value in items:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result


def no_constant(value):
    raise Refused('nonfinite JSON constant')


def decode(text, maximum=4096):
    need(len(text.encode('utf8')) <= maximum, 'JSON byte bound')
    # Bound lexical nesting before the recursive JSON decoder runs.
    depth = 0
    quoted = escaped = False
    for char in text:
        if quoted:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char in '[{':
            depth += 1
            need(depth <= 16, 'JSON depth')
        elif char in ']}':
            depth -= 1
    try:
        value = json.loads(text, object_pairs_hook=pairs, parse_constant=no_constant)
    except (ValueError, RecursionError, UnicodeError):
        raise Refused('malformed JSON') from None
    check_json(value)
    return value


def check_json(value):
    if type(value) is str:
        try:
            value.encode('utf8', 'strict')
        except UnicodeError:
            raise Refused('JSON surrogate') from None
    elif type(value) is float:
        need(math.isfinite(value), 'nonfinite JSON number')
    elif type(value) is dict:
        for key, item in value.items():
            check_json(key)
            check_json(item)
    elif type(value) is list:
        for item in value:
            check_json(item)


def binding_value(binding):
    keys = {'mainPid', 'projectId', 'windowId', 'epoch', 'pointerBits', 'parentHwnd'}
    need(type(binding) is dict and all(type(key) is str for key in binding) and binding.keys() == keys, 'binding schema')
    need(integer(binding['mainPid'], 1, 4294967295), 'binding PID')
    for key in ('projectId', 'windowId'):
        value = binding[key]
        need(type(value) is str and re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value) is not None, 'binding context')
    need(integer(binding['epoch'], 1), 'binding epoch')
    bits = binding['pointerBits']
    need(type(bits) is int and bits in (32, 64), 'binding width')
    need(integer(binding['parentHwnd'], 1, (1 << bits) - 1), 'binding HWND')
    return binding


def clean_status(records):
    return dict(failed=False, code=None, selectionCount=1, apiCount=1, matched=True,
                pending=False, settled=True, unmatched=False, records=records, ioBroken=False)


def journal_value(raw, text, binding):
    lines = text.splitlines(keepends=True)
    need(len(lines) == 4 and all(line.endswith('\n') for line in lines), 'one-pick journal rows')
    rows = [decode(line) for line in lines]
    resolver, boundary, settlement, footer = rows
    need(type(resolver) is dict, 'resolver schema')
    wc = resolver.get('webContentsId')
    need(integer(wc, 1), 'reported webContentsId')
    schema(resolver, dict(version=1, sequence=1, stage='resolver-selected', failed=False,
                         ordinal=1, branch='detached', projectId=binding['projectId'],
                         windowId=binding['windowId'], epoch=binding['epoch'], role='terminal', webContentsId=wc))
    need(type(boundary) is dict, 'boundary schema')
    handle = boundary.get('handleHex')
    width = binding['pointerBits'] // 8
    need(type(handle) is str and re.fullmatch('[0-9a-f]{' + str(width * 2) + '}', handle) is not None, 'handle encoding')
    hwnd = int.from_bytes(bytes.fromhex(handle), 'little')
    need(hwnd == binding['parentHwnd'], 'original parent binding')
    schema(boundary, dict(version=1, sequence=2, stage='api-call-boundary', failed=False,
                         ordinal=1, matched=True, mainPid=binding['mainPid'], branch='detached',
                         senderWebContentsId=wc, parentWebContentsId=wc, parentWebContentsStatus='VALUE',
                         handleBytes=width, handleHex=handle))
    need(type(settlement) is dict, 'settlement schema')
    common = dict(version=1, sequence=3, stage=settlement.get('stage'), failed=False,
                  ordinal=1, matched=True, apiCount=1, selectionCount=1)
    if common['stage'] == 'rejected':
        schema(settlement, common)
        outcome = 'REJECT'
    else:
        need(common['stage'] == 'fulfilled-projection', 'settlement stage')
        canceled = settlement.get('canceled')
        need(type(canceled) is bool, 'canceled type')
        common.update(canceled=canceled, fileCount=0 if canceled else 1, selectedPathPresent=not canceled)
        if not canceled:
            common['selectedPath'] = FIXED_TARGET
        schema(settlement, common)
        outcome = 'CANCEL' if canceled else 'SELECT'
    prefix_bytes = len(''.join(lines[:3]).encode('utf8'))
    schema(footer, dict(version=1, sequence=4, stage='journal-final', failed=False,
                        status=clean_status(3), writtenRowsBeforeFooter=3, writtenBytesBeforeFooter=prefix_bytes,
                        finalWriteOutcome='NOT_SELF_ATTESTED', flushOutcome='NOT_YET_ATTESTED', closeOutcome='NOT_YET_ATTESTED'))
    # Nested exact-type comparison is required: bool must not equal an integer.
    schema(footer['status'], clean_status(3))
    return outcome, wc, hwnd


def close_value(stdout, stderr, binding, journal_bytes):
    need(all(marker not in stdout and marker not in stderr for marker in ADVERSE), 'adverse shutdown marker')
    stages = []
    frames = []
    for lane, stream in (('stdout', stdout), ('stderr', stderr)):
        for index, line in enumerate(stream.splitlines()):
            if line.startswith('SIREN_CLOSE_STAGE '):
                need(lane == 'stdout', 'stage on stderr')
                stage = decode(line[len('SIREN_CLOSE_STAGE '):], 1024)
                need(type(stage) is dict and stage.keys() == {'stage', 'elapsedMs', 'pendingWrites', 'hasProcessIdentity'}, 'shutdown stage schema')
                need(type(stage['stage']) is str and integer(stage['elapsedMs']) and integer(stage['pendingWrites']) and stage['hasProcessIdentity'] is True, 'shutdown stage values')
                stages.append((index, stage))
                continue
            marker = 'siren-picker-final-close' in line or 'MAIN_WINDOW_CLOSED' in line or 'SIREN_CLOSE_STAGE' in line
            obj = decode(line) if line.lstrip().startswith('{') else None
            candidate = type(obj) is dict and (obj.get('stage') == 'MAIN_WINDOW_CLOSED' or type(obj.get('probe')) is str and obj['probe'].startswith('siren-picker-final-close'))
            if marker or candidate:
                need(candidate and lane == 'stdout', 'confused shutdown frame')
                frames.append((index, obj))
    need(len(stages) == 5 and tuple(item['stage'] for _, item in stages) == STAGES, 'shutdown stage order')
    need(all(stages[i][1]['elapsedMs'] <= stages[i+1][1]['elapsedMs'] for i in range(4)), 'shutdown elapsed order')
    need(stages[-1][1]['pendingWrites'] == 0, 'pending writes')
    need(len(frames) == 1 and frames[0][0] > stages[-1][0], 'sole frame after stages')
    frame = frames[0][1]
    expected_final = dict(version=1, requested=True, completed=True, complete=True, pending=False,
                          settled=True, matched=True, failed=False, code=None, attemptedRows=4,
                          writtenRows=4, attemptedBytes=journal_bytes, writtenBytes=journal_bytes,
                          writtenBytesKnown=True, rowLimitExceeded=False, byteLimitExceeded=False,
                          finalWriteAttempted=True, finalWriteComplete=True, flushAttempted=True,
                          flushSucceeded=True, closeAttempted=True, closeConfirmed=True, closeUnknown=False,
                          descriptorAcquired=True, finalFailureCount=0, finalFailuresDropped=0)
    need(type(frame) is dict and frame.keys() == {'probe', 'version', 'stage', 'source', 'mainPid', 'armed', 'closed', 'captureFailurePresent', 'status', 'journal'}, 'frame schema')
    schema(frame['status'], clean_status(4))
    schema(frame['journal'], expected_final)
    schema(frame, dict(probe='siren-picker-final-close-v2', version=2, stage='MAIN_WINDOW_CLOSED',
                       source=SOURCE, mainPid=binding['mainPid'], armed=True, closed=True,
                       captureFailurePresent=False, status=clean_status(4), journal=expected_final))


def consume(journal, stdout, stderr, binding):
    """Validate retained evidence; no filesystem, process or physical admission claim."""
    b = binding_value(binding)
    raw, text = raw_text(journal, 11264)
    _, out = raw_text(stdout, 1048576)
    _, err = raw_text(stderr, 1048576)
    outcome, wc, hwnd = journal_value(raw, text, b)
    close_value(out, err, b, len(raw))
    return dict(observationComplete=True, providerOutcome=outcome, selectedPathWitness=outcome == 'SELECT',
                reportedWebContentsId=wc, parentHwnd=hwnd, rows=4, journalBytes=len(raw),
                productAdmissionProved=False, processExitProved=False, recoveryProved=False,
                nativeIdentityProved=False)
