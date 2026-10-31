"""Read completed private Cancel DATA; never imports the controller or calls OS APIs."""
from pathlib import Path
import hashlib
import json
import os
import sys

W = Path('C:/Claude/SIREN_WORK')
R = W / 'terminal-operational-four-stage-candidate-v1-20261022'
X = R / 'execution'
D = W / 'terminal-operational-four-stage-candidate-v1-20261022-readback'
A = W / 'terminal-operational-four-stage-candidate-v1-20261022-image'


def need(value, label):
    if not value:
        raise RuntimeError(label)


def pin(path):
    data = path.read_bytes()
    return dict(path=str(path), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def read_raw(path, maximum):
    fields = ['st_dev', 'st_ino', 'st_mode', 'st_nlink', 'st_size', 'st_mtime_ns', 'st_ctime_ns']
    prior_metadata = prior_identity = None
    for _ in range(2):
        before = path.stat()
        need(before.st_size <= maximum, 'BOUNDED_COMPLETED_DATA')
        metadata = tuple(getattr(before, field) for field in fields)
        need(prior_metadata is None or metadata == prior_metadata, 'COMPLETED_DATA_BETWEEN_READS')
        with path.open('rb') as source:
            body = source.read(maximum + 1)
        after = path.stat()
        need(len(body) <= maximum and len(body) == before.st_size and metadata == tuple(getattr(after, field) for field in fields), 'STABLE_COMPLETED_DATA')
        identity = dict(path=str(path), bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
        need(prior_identity is None or identity == prior_identity, 'COMPLETED_DATA_READBACK')
        prior_metadata, prior_identity = metadata, identity
    return body, identity


def read(path, maximum=4 * 1024 * 1024):
    body, identity = read_raw(path, maximum)
    return json.loads(body), identity


def receipt_files(proof, bounded_read):
    """Join whole retained bodies to exact fixed paths; never classify success."""
    need(type(proof) is dict, 'RECEIPT_PROOF')
    rows = proof.get('receiptFiles')
    need(type(rows) is dict and set(rows) == {'journal', 'stdout', 'stderr'}, 'RECEIPT_FILE_SET')
    fixed = {'journal': (A / 'picker-parent-observation.jsonl', 11264),
             'stdout': (X / 'electron-stdout.log', 1048576),
             'stderr': (X / 'electron-stderr.log', 1048576)}
    result = {}
    for key, (path, maximum) in fixed.items():
        row = rows[key]
        need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'}, 'RECEIPT_PIN_SCHEMA')
        need(type(row['path']) is str and row['path'] == str(path)
             and type(row['bytes']) is int and 0 <= row['bytes'] <= maximum
             and type(row['sha256']) is str and len(row['sha256']) == 64
             and all(c in '0123456789abcdef' for c in row['sha256']), 'RECEIPT_PIN_VALUES')
        body, actual = bounded_read(path, maximum)
        need(type(body) is bytes and len(body) <= maximum, 'WHOLE_BOUNDED_RAW_BYTES')
        wanted = dict(path=str(path), bytes=len(body), sha256=hashlib.sha256(body).hexdigest())
        need(type(actual) is dict and actual == wanted == row, 'ACTUAL_WHOLE_RECEIPT_BODY')
        result[key] = wanted
    return result


def direct_context_files(go,source_sha,review_sha,bounded_read):
    """Literal GO/body custody joins only; not semantic context acceptance."""
    need(type(go) is dict and set(go)=={'schema','kind','probe','stage','sourceSha256',
         'reviewSha256','contextPin','attemptHeaderPin'},'DIRECT_GO_CLOSED_KEYS')
    need(type(go['schema']) is int and go['schema']==1 and
         go['kind']=='MAINTAINED_DIRECT_GO_V1' and go['probe']=='siren-ordinary-picker-cancel-v1' and
         go['stage']=='ordinary-cancel-native-go-direct' and
         go['sourceSha256']==source_sha and go['reviewSha256']==review_sha,'DIRECT_GO_PARENT_BINDING')
    rows={}
    for key,name in (('contextPin','capture-context.json'),('attemptHeaderPin','capture-attempt-header.json')):
        path=R/name;row=go[key]
        need(type(row) is dict and set(row)=={'path','bytes','sha256'} and
             type(row['path']) is str and row['path']==str(path) and type(row['bytes']) is int and
             0<row['bytes']<=262144 and type(row['sha256']) is str and len(row['sha256'])==64 and
             all(char in '0123456789abcdef' for char in row['sha256']),'DIRECT_CONTEXT_LITERAL_PIN')
        body,actual=bounded_read(path,262144)
        need(type(body) is bytes and len(body)==row['bytes'] and
             actual==row==dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest()),
             'DIRECT_CONTEXT_LITERAL_BODY_JOIN')
        rows[key]=dict(actual)
    return dict(pins=rows,semanticContextAccepted=False,
        scope='Literal supplied context/header bodies matched GO; semantic and authentic-context review remains separate')

def direct_capture_files(outer,inner,bounded_read):
    """Retain exact fixed capture bodies; never classify a whole attempt."""
    need(type(outer) is dict and type(inner) is dict and
         type(outer.get('schema')) is int and outer['schema']==1 and
         type(inner.get('schema')) is int and inner['schema']==1 and
         outer.get('kind')=='MAINTAINED_DIRECT_OUTER_V1' and
         inner.get('kind')=='MAINTAINED_DIRECT_INNER_V1','DIRECT_READBACK_ROOT_VERSIONS')
    outcomes=inner.get('edgeOutcomes')
    need(type(outcomes) is dict and set(outcomes)=={'electron','ui'},'DIRECT_READBACK_CHILD_ROSTER')
    records=dict(inner=outer.get('innerEdge'),electron=outcomes['electron'],ui=outcomes['ui'])
    result={}
    for name,row in records.items():
        if row is None:
            stage=outer.get('stage') if name=='inner' else inner.get('stage')
            need(stage==('ordinary-cancel-direct-adverse' if name=='inner' else 'cancel-inner-direct-adverse'),
                 'NO_COMPLETE_MISSING_EDGE')
            result[name]=dict(available=False,roles=None);continue
        need(type(row) is dict and row.get('kind')=='MAINTAINED_DIRECT_EDGE_V1' and
             type(row.get('schema')) is int and row['schema']==1 and
             type(row.get('binding')) is dict and row['binding'].get('edge')==name,
             'DIRECT_READBACK_EDGE_VERSION_AND_ROLE')
        disposition=row.get('disposition')
        need(disposition in ('STAGED_FINISH','PREFINAL_ABORT','FINAL_READBACK_UNAVAILABLE'),
             'DIRECT_READBACK_DISPOSITION')
        data=row.get('bodyAvailability')
        need(type(data) is dict and set(data)=={'stdout','stderr','archive','index'},'DIRECT_READBACK_BODY_ROSTER')
        paths=dict(stdout=X/(name+'-stdout.log'),stderr=X/(name+'-stderr.log'))
        if name=='electron':paths.update(archive=X/'electron-stderr-prefix-frames.bin',index=X/'electron-stderr-prefix-index.json')
        retained={}
        for role,cap in zip(('stdout','stderr','archive','index'),(1048576,1048576,4194304,262144)):
            entry=data[role]
            need(type(entry) is dict and set(entry)=={'state','reference'},'DIRECT_READBACK_AVAILABILITY_KEYS')
            state=('NOT_APPLICABLE' if role not in paths else
                   'RETAINED_STAGED_BYTES' if disposition=='STAGED_FINISH' else 'UNAVAILABLE')
            need(entry['state']==state,'DIRECT_READBACK_EXACT_AVAILABILITY')
            if state!='RETAINED_STAGED_BYTES':
                need(entry['reference'] is None,'DIRECT_READBACK_NO_INVENTED_REFERENCE')
                retained[role]=dict(state=state,pin=None);continue
            path=paths[role];ref=entry['reference']
            need(type(ref) is dict and set(ref)=={'path','bytes','sha256'} and
                 type(ref['path']) is str and ref['path']==str(path) and type(ref['bytes']) is int and
                 0<=ref['bytes']<=cap and type(ref['sha256']) is str and len(ref['sha256'])==64 and
                 all(char in '0123456789abcdef' for char in ref['sha256']),'DIRECT_READBACK_FIXED_BODY_PIN')
            body,actual=bounded_read(path,cap)
            need(type(body) is bytes and len(body)<=cap and actual==ref==dict(path=str(path),
                 bytes=len(body),sha256=hashlib.sha256(body).hexdigest()),'DIRECT_READBACK_WHOLE_BODY')
            retained[role]=dict(state=state,pin=dict(actual))
        result[name]=dict(available=True,disposition=disposition,roles=retained)
    return dict(edges=result,successClassified=False,wholeAttempt=False,
        scope='Exact referenced raw body retention only; owner/finish/context semantics and whole occurrence accounting remain separate')


def main():
    need(sys.argv[1:] == ['--read-completed-direct'] and sys.flags.isolated and sys.flags.no_site and sys.dont_write_bytecode, 'FIXED_COMPLETED_READER')
    need(not os.path.lexists(D), 'FRESH_COMPLETED_READ_OUTPUT')
    selected = []
    bounded_limits = {}

    def checked(path, maximum=4 * 1024 * 1024):
        value, identity = read(path, maximum)
        selected.append(identity)
        bounded_limits[str(path)] = maximum
        return value

    def checked_raw(path, maximum):
        body, identity = read_raw(path, maximum)
        selected.append(identity)
        bounded_limits[str(path)] = maximum
        return body, identity

    manifest = checked(R / 'INPUT-MANIFEST.json')
    manifest_pin = selected[-1]
    review = checked(R / 'CONTROLLER-SOURCE-REVIEW.json')
    review_pin = selected[-1]
    go = checked(R / 'go.json')
    attempt = checked(X / 'attempt.json')
    outer = checked(X / 'result.json')
    inner = checked(X / 'inner-result.json')
    need(type(manifest) is dict and type(manifest.get('inputs')) is list and type(attempt) is dict and type(attempt.get('inputs')) is list, 'COMPLETED_MEMBERSHIP_SCHEMA')
    expected = manifest['inputs'] + [manifest_pin, review_pin]
    need(attempt['inputs'] == expected and attempt.get('sourceSha256') == manifest_pin['sha256'], 'ACTUAL_ATTEMPT_INPUTS')
    need(review.get('author') == '/root/atomic_cleanup_review' and review.get('findings') == [] and review.get('inputManifest') == manifest_pin, 'ACTUAL_WHOLE_SOURCE_RECEIPT_BINDING')
    vector = hashlib.sha256(json.dumps(expected[:-1], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    need(review.get('inputVectorSha256') == vector, 'ACTUAL_WHOLE_SOURCE_VECTOR')
    need(type(review) is dict and review.get('verdict') == 'NO_BLOCKING_ORDINARY_PICKER_CONTROLLER_SOURCE_FINDINGS' and review.get('candidate') == str(R), 'ACTUAL_WHOLE_SOURCE_DECLARATION_IDENTITY')
    context_files = direct_context_files(go, manifest_pin['sha256'], review_pin['sha256'], checked_raw)
    for row in expected:
        need(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'} and pin(Path(row['path'])) == row, 'CURRENT_OPERATIONAL_INPUT')
    need(type(outer) is dict and outer.get('inner') == inner and type(inner) is dict and type(inner.get('proof')) is dict, 'OUTER_ACTUAL_INNER_RECONCILIATION')
    need(type(attempt.get('runtime')) is list, 'ATTEMPT_RUNTIME_SCHEMA')
    for role in ['inner', 'outer']:
        after = checked(X / ('runtime-after-' + role + '.json'))
        need(after.get('coverageComplete') is True and after.get('fileCount') == len(attempt['runtime']) and after.get('rows') == attempt['runtime'], 'BOTH_COMPLETE_RUNTIME_AFTER_VECTORS_' + role)
    proof = inner['proof']
    receipts = receipt_files(proof, checked_raw)
    capture_files = direct_capture_files(outer, inner, checked_raw)
    ui = proof.get('ui')
    if type(ui) is dict:
        need(checked(X / 'ui-result.json') == ui, 'ACTUAL_UI_RESULT_RECONCILIATION')
    commands = {}
    for role in ['inner', 'electron', 'ui']:
        path = X / (role + '-command.json')
        if path.exists():
            commands[role] = checked(path)
    endpoint_path = A / 'terminal-request-endpoint.jsonl'
    endpoint = dict(present=endpoint_path.exists(), rows=None, completeTraceProved=False, finalCleanliness='UNKNOWN_NO_FINAL_STATUS_CONSUMER')
    if endpoint['present']:
        raw, identity = read_raw(endpoint_path, 65536)
        need(not raw or raw.endswith(b'\n'), 'STABLE_COMPLETE_ENDPOINT_ROWS')
        rows = [json.loads(line) for line in raw.splitlines()]
        need(len(rows) <= 128, 'ENDPOINT_ROW_COUNT_BOUND')
        endpoint.update(rows=rows, pin=identity, interpretation='Uninterpreted completed rows; positive outcome requires the separately reviewed validator and independent DATA review')
        selected.append(identity)
        bounded_limits[str(endpoint_path)] = 65536
    # Keep the complete actual proof. No image-observation or BMP prerequisite:
    # the Cancel route does not run IMAGE_ONLY. An early missing required
    # controller result/after-vector still refuses, with its real tool error.
    result = dict(
        scope='Root readback of completed private Cancel DATA; not independent acceptance or a success classifier',
        inputManifest=manifest_pin,
        sourceReview=review_pin,
        reviewVectorSha256=vector,
        operationalInputs=len(expected),
        currentOperationalInputsVerified=True,
        runtimeRows=len(attempt['runtime']),
        bothCompleteAfterVectorsReconciled=True,
        go=go,
        suppliedContextFiles=context_files,
        referencedDirectCaptureFiles=capture_files,
        attempt={key: value for key, value in attempt.items() if key not in ['inputs', 'runtime']},
        outer=outer,
        inner=inner,
        endpoint=endpoint,
        wholeReceiptFiles=receipts,
        wholeReceiptFilesQualification='Complete fixed raw bodies matched actual controller pins; no filtering or embedding; independent DATA must interpret the original raw files.',
        launchRecords=commands,
        launchRecordsQualification='Retained command DATA; OS environment and actual original process binding require separate reviewed source/control/DATA evidence',
        selectedPins=selected,
    )
    for row in selected:
        need(read_raw(Path(row['path']), bounded_limits[row['path']])[1] == row, 'FINAL_COMPLETED_READ_INPUT')
    encoded = (json.dumps(result, indent=2) + '\n').encode()
    need(len(encoded) <= 4 * 1024 * 1024, 'COMPLETED_OUTPUT_BOUND')
    D.mkdir()
    with (D / 'initial-read.json').open('xb') as output:
        need(output.write(encoded) == len(encoded), 'COMPLETE_OUTPUT_WRITE')
        output.flush()
        os.fsync(output.fileno())
    print(json.dumps(dict(
        output=pin(D / 'initial-read.json'),
        outerStage=outer.get('stage'),
        outerPrimary=outer.get('primary'),
        outerSecondary=outer.get('secondary'),
        outerForced=outer.get('forced'),
        innerStage=inner.get('stage'),
        innerPrimary=inner.get('primary'),
        innerSecondary=inner.get('secondary'),
        innerForced=inner.get('forced'),
        operationalInputs=len(expected),
        runtimeRows=len(attempt['runtime']),
        endpointRows=None if endpoint['rows'] is None else len(endpoint['rows']),
        successClassified=False,
    )))


if __name__ == '__main__':
    main()
