"""Strict inert finish record reader with independently supplied saved bodies.

No serialized identifier reconstructs a capability. C0 supplies only existing
pure binding/framing parsers; this reader does not trust the finish state alone.
"""
import ordinary_direct_capture_core as C0
import json
import hashlib

def _need(ok, code):
    if ok is not True:
        raise ValueError('READ_CAPTURE_FINISH:' + code)

def _integer(n, maximum=(1 << 64)-1):
    return type(n) is int and 0 <= n <= maximum

def _pairs(rows):
    result = {}
    for k,v in rows:
        _need(k not in result, 'DUPLICATE_KEY')
        result[k] = v
    return result

def read(raw, bodies):
    _need(type(raw) is bytes and 0 < len(raw) <= 262144, 'RECORD_BYTES')
    r = json.loads(raw.decode('utf8','strict'), object_pairs_hook=_pairs)
    _need(type(r) is dict and set(r) == {'schema','kind','binding','ticketId',
          'reservationId','phase','roles','events','capture','physicalCapture',
          'nativeEligibility','wholeAttempt','captureCharges','streamOccurrences'}, 'KEYS')
    _need(type(r['schema']) is int and r['schema'] == 1 and
          r['kind'] == 'INERT_CAPTURE_FINISH_V1' and
          all(r[k] is False for k in ('physicalCapture','nativeEligibility','wholeAttempt')),
          'INERT_AUTHORITY')
    binding = C0._binding(r['binding'])
    _need(r['ticketId'] == 'original-final-readback' and
          r['reservationId'] == 'original-final-reservation', 'FIXED_JOIN_LABELS')
    _need(r['phase'] in ('STAGED_QUIESCENT','FAILED_QUIESCENT','UNRESOLVED','CONSUMED'),
          'PHASE')
    _need(type(bodies) is tuple and len(bodies) == 4 and
          all(type(b) is bytes for b in bodies) and
          type(r['roles']) is list and len(r['roles']) == 4, 'ROLES')
    clean = r['phase'] == 'CONSUMED'
    caps = (1048576,1048576,4194304,262144)
    electron = binding['edge'] == 'electron'
    for i,(role,row,body,cap) in enumerate(zip(('stdout','stderr','archive','index'),
                                             r['roles'],bodies,caps)):
        _need(type(row) is dict and set(row) == {'role','applicable','resourceId',
              'reservationIndex','maximum','bytes','sha256','consumed','complete',
              'quiescent','calls','closure'}, 'ROLE_KEYS')
        applicable = i < 2 or electron
        resource_id = (role+'.sink' if i < 2 else role) if applicable else None
        _need(row['role'] == role and row['applicable'] is applicable and
              type(row['reservationIndex']) is int and row['reservationIndex'] == i and
              row['resourceId'] == resource_id, 'ROLE_BINDING')
        _need(_integer(row['maximum'],cap) and _integer(row['bytes'],cap) and
              row['bytes'] == len(body) <= row['maximum'] and
              row['sha256'] == hashlib.sha256(body).hexdigest() and
              type(row['complete']) is bool and type(row['quiescent']) is bool and
              (row['consumed'] is None or (_integer(row['consumed'],row['maximum'])
               and row['consumed'] >= len(body))), 'ROLE_BYTES')
        _need(type(row['calls']) is list, 'CALL_ROSTER')
        for call in row['calls']:
            _need(type(call) is dict and set(call) == {'label','state'} and
                  type(call['label']) is str and call['label'].endswith(':'+role) and
                  call['label'].split(':')[0] in ('FILE_FLUSH','FILE_POSITION','FINAL_BODY') and
                  call['state'] in ('RETURNED','UNKNOWN','QUIESCENT_UNKNOWN'), 'CALL')
        if applicable:
            _need(row['calls'] and row['closure'] in
                  ('OPEN','CLOSED','CLOSE_PENDING','FAILED','UNRESOLVED'), 'APPLICABLE_CALLS')
            if row['complete']:
                labels = [c['label'] for c in row['calls']]
                _need(row['quiescent'] and row['consumed'] == len(body) == row['maximum'] and
                      all(c['state'] == 'RETURNED' for c in row['calls']) and
                      labels[:2] == ['FILE_FLUSH:'+role,'FILE_POSITION:'+role] and
                      all(s == 'FINAL_BODY:'+role for s in labels[2:]) and
                      len(labels) == 2 + (row['maximum'] + 65535)//65536, 'COMPLETE_ROSTER')
            clean = clean and row['complete'] and row['quiescent'] and row['closure'] == 'CLOSED'
        else:
            _need(body == b'' and row['maximum'] == row['consumed'] == 0 and
                  row['complete'] and row['quiescent'] and not row['calls'] and
                  row['closure'] == 'NOT_APPLICABLE', 'INAPPLICABLE')
    c = r['capture']
    _need(type(c) is dict and set(c) == {'state','binding','failures','pending',
          'unacknowledgedExports','channels','observations','budget',
          'physicalCapture','nativeEligibility','wholeAttempt'} and
          C0._equal(c.get('binding'),binding) and
          all(c.get(k) is False for k in ('physicalCapture','nativeEligibility','wholeAttempt')),
          'CAPTURE_JOIN')
    _need(type(c['observations']) is list and
          (electron or c['observations'] == []), 'OBSERVATION_ROLES')
    b = c.get('budget')
    _need(type(b) is dict and set(b) == {'spent','held','refused','uncertain','rows','wholeAttempt'}
          and _integer(b['spent'],16777216) and _integer(b['held'],16777216) and
          b['spent'] + b['held'] <= 16777216 and type(b['refused']) is bool and
          type(b['uncertain']) is bool and b['wholeAttempt'] is False and
          type(b['rows']) is list, 'BUDGET')
    final_rows = []
    spent = 0
    held = 0
    for charge in b['rows']:
        _need(type(charge) is list and len(charge) == 4 and type(charge[0]) is str and
              charge[0] in C0._OPS and _integer(charge[1],16777216), 'CHARGE')
        op, maximum, actual, unused = charge
        _need((actual is None and unused is None) or
              (_integer(actual,maximum) and type(unused) is int and
               unused == maximum-actual), 'CHARGE_EFFECT')
        if actual is None:
            held += maximum
        else:
            spent += actual
        if op == 'FINAL_READ':
            final_rows.append(charge)
    _need(spent == b['spent'] and held <= b['held'], 'LEDGER_TOTAL')
    _need(type(c.get('pending')) is int and c['pending'] >= 0 and
          type(c.get('unacknowledgedExports')) is int and c['unacknowledgedExports'] >= 0 and
          type(c.get('failures')) is list and type(c.get('channels')) is dict and
          set(c['channels']) == {'stdout','stderr'}, 'CAPTURE_STATE')
    for i,ch in enumerate(('stdout','stderr')):
        stream = c['channels'][ch]
        _need(type(stream) is dict and set(stream) == {'observed','committed','physicalKnown',
              'pendingKnown','uncommittedOrDiscarded','generation','unknown','overflow',
              'reader','termination','sink','cancel'} and
              stream['cancel'] in ('NOT_REQUESTED','REQUESTED','ACCEPTED','REJECTED','FAILED','UNRESOLVED') and
              stream['reader'] in ('RUNNING','TERMINATED') and
              stream['termination'] in ('NONE','EOF_REPORTED','ERROR','CANCELLED','UNKNOWN') and
              stream['sink'] in ('OPEN','CLOSE_REQUESTED','CLOSED','FAILED','UNRESOLVED') and
              all(_integer(stream.get(k)) for k in
              ('observed','committed','physicalKnown','pendingKnown','uncommittedOrDiscarded','generation')) and
              all(type(stream.get(k)) is bool for k in ('unknown','overflow')), 'STREAM_TYPES')
        clean = clean and (stream['observed'] == stream['committed'] ==
            stream['physicalKnown'] == len(bodies[i]) and stream['reader'] == 'TERMINATED' and
            stream['termination'] == 'EOF_REPORTED' and stream['sink'] == 'CLOSED' and
            not stream['unknown'] and not stream['overflow'] and stream['cancel'] == 'NOT_REQUESTED' and stream['pendingKnown'] == 0 and
            stream['uncommittedOrDiscarded'] == 0)
    if electron:
        index = C0._read_index(bodies[3])
        _need(type(index) is dict and set(index) == {'schema','kind','binding','archiveBytes',
              'archiveSha256','observations','terminationReason'} and
              type(index['schema']) is int and index['schema'] == 1 and
              index['kind'] == 'CAPTURE_CORE_INDEX_V2' and index['binding'] == binding and
              type(index['archiveBytes']) is int and index['archiveBytes'] == len(bodies[2]) and
              index['archiveSha256'] == hashlib.sha256(bodies[2]).hexdigest() and
              C0._equal(index['observations'], c['observations']), 'INDEX_JOIN')
        C0._frames(bodies[2],index['observations'],bodies[1])
        C0._frames(bodies[2],c['observations'],bodies[1])
        previous_eof = False
        previous_terminated = False
        final = c['channels']['stderr']
        for observation in c['observations']:
            terminated = observation['readerStateAtSnapshot'] == 'TERMINATED'
            eof = observation['eofSeenAtSnapshot']
            _need(observation['generation'] <= final['generation'] and
                  observation['observedBytesAtSnapshot'] <= final['observed'] and
                  (not previous_eof or eof) and (not previous_terminated or terminated) and
                  (not terminated or eof), 'SNAPSHOT_FINAL_JOIN')
            previous_eof,previous_terminated = eof,terminated
        clean = clean and index['terminationReason'] == 'ENDPOINT_FOUND' 
    # Per-capture reservation rows retain occurrence ownership even when
    # another capture uses the same shared aggregate budget. Every local row
    # must also be present, with multiplicity, in the global settled ledger.
    own = r['captureCharges']
    _need(type(own) is list, 'OWN_CHARGES')
    remaining = list(b['rows'])
    by_op = {op:[] for op in C0._OPS}
    own_pending = False
    for charge in own:
        if charge is None:
            own_pending = True
            continue
        _need(type(charge) is list and len(charge) == 4 and
              type(charge[0]) is str and charge[0] in by_op and
              _integer(charge[1],16777216), 'OWN_CHARGE')
        matches = [i for i,row in enumerate(remaining) if C0._equal(row,charge)]
        _need(bool(matches), 'OWN_GLOBAL_CHARGE_JOIN')
        remaining.pop(matches[0])
        by_op[charge[0]].append(charge)
    occurrences = r['streamOccurrences']
    _need(type(occurrences) is list, 'STREAM_OCCURRENCES')
    by_channel = {ch:{op:[] for op in ('READ','APPEND')} for ch in ('stdout','stderr')}
    joined = set()
    last_index = -1
    for occurrence in occurrences:
        _need(type(occurrence) is dict and set(occurrence) == {'chargeIndex','channel'} and
              type(occurrence['chargeIndex']) is int and
              0 <= occurrence['chargeIndex'] < len(own) and
              type(occurrence['channel']) is str and occurrence['channel'] in by_channel,
              'STREAM_OCCURRENCE_JOIN')
        i = occurrence['chargeIndex']
        _need(i > last_index and i not in joined and type(own[i]) is list and own[i][0] in ('READ','APPEND'),
              'STREAM_OCCURRENCE_ONCE')
        last_index = i
        joined.add(i)
        by_channel[occurrence['channel']][own[i][0]].append(own[i])
    _need(joined == {i for i,charge in enumerate(own) if charge is not None and
                    charge[0] in ('READ','APPEND')}, 'COMPLETE_STREAM_OCCURRENCES')
    if clean:
        for ch in ('stdout','stderr'):
            stream = c['channels'][ch]
            for op,n in (('READ',stream['observed']),('APPEND',stream['committed'])):
                _need(all(type(row[2]) is int for row in by_channel[ch][op]) and
                      sum(row[2] for row in by_channel[ch][op]) == n,
                      'STREAM_BYTES_JOIN:'+ch+':'+op)
            _need(len(by_channel[ch]['APPEND']) == stream['generation'],
                  'STREAM_GENERATION_JOIN:'+ch)
    if clean and electron:
        committed_prefixes = [0]
        for charge in by_channel['stderr']['APPEND']:
            committed_prefixes.append(committed_prefixes[-1] + charge[2])
        observed_prefixes = {0}
        observed = 0
        for charge in by_channel['stderr']['READ']:
            observed += charge[2]
            observed_prefixes.add(observed)
        for observation in c['observations']:
            generation = observation['generation']
            _need(generation < len(committed_prefixes) and
                  committed_prefixes[generation] == observation['length'] and
                  observation['observedBytesAtSnapshot'] in observed_prefixes,
                  'SNAPSHOT_OCCURRENCE_JOIN')
    final_rows = by_op['FINAL_READ']
    _need(len(final_rows) == 4, 'EXACT_OWN_FINAL_ROWS')
    for row,charge in zip(r['roles'],final_rows):
        _need(charge[1] == row['maximum'] and type(charge[1]) is type(row['maximum']) and
              charge[2] == row['consumed'] and type(charge[2]) is type(row['consumed']),
              'READ_RESERVATION_JOIN')
    clean = clean and not own_pending
    if clean:
        expected = {op:[] for op in C0._OPS}
        for observation in c['observations'] if electron else []:
            n = observation['length']
            token = len(C0._encoded(dict(binding=binding,observation=observation)))
            for op,maximum in (('SNAPSHOT',n),('FRAME',48+n),('ARCHIVE_WRITE',48+n),
                    ('EXPORT_BYTES',n),('EXPORT_TOKEN',token),('CONSUMER_BYTES',n),('CONSUMER_TOKEN',token)):
                expected[op].append([op,maximum,maximum,0])
        if electron:
            n = len(bodies[3])
            expected['INDEX'] = [['INDEX',n,n,0]]
            expected['ARCHIVE_WRITE'].append(['ARCHIVE_WRITE',n,n,0])
        expected['FINAL_READ'] = [['FINAL_READ',len(raw),len(raw),0] for raw in bodies]
        for op in C0._OPS:
            if op not in ('READ','APPEND'):
                _need(C0._equal(by_op[op],expected[op]), 'REQUIRED_OCCURRENCE:'+op)
        for op in ('READ','APPEND'):
            _need(all(type(row[2]) is int and 0 <= row[2] <= row[1] <= 65536 and
                      row[1] > 0 and row[3] == row[1]-row[2] for row in by_op[op]) and
                  sum(row[2] for row in by_op[op]) == len(bodies[0])+len(bodies[1]),
                  'STREAM_OCCURRENCE:'+op)
        _need(all(row[1] == row[2] for row in by_op['APPEND']) and
              sum(row[2] == 0 for row in by_op['READ']) >= 2, 'STREAM_COMPLETION_CHARGES')
    events = r['events']
    _need(type(events) is list and all(type(e) is str for e in events) and
          events[:1] == ['WRITERS_FROZEN'] and events.count('FINAL_RESERVED') == 1 and
          events.count('FINAL_STAGED') == 1 and
          events.index('FINAL_RESERVED') < events.index('FINAL_STAGED'), 'ORDER')
    if r['phase'] == 'CONSUMED':
        prefix = ['WRITERS_FROZEN'] + (['INDEX_PUBLISHED'] if electron else []) + ['FINAL_RESERVED','FINAL_STAGED']
        closing = ['CLOSE:stdout','CLOSE:stderr'] + (['CLOSE:archive','CLOSE:index'] if electron else [])
        _need(events[:len(prefix)] == prefix and events[-1:] == ['FINAL_CONSUMED'] and
              len(events) == len(prefix)+len(closing)+1 and
              sorted(events[len(prefix):-1]) == sorted(closing), 'COMPLETE_ORDER')
    clean = (clean and c['state'] == 'SEALED_COMPLETE' and not c['pending'] and
        not c['unacknowledgedExports'] and not c['failures'] and not b['held'] and
        not b['refused'] and not b['uncertain'])
    return dict(classification='CLEAN_INERT' if clean else 'ADVERSE',
                physicalCapture=False,nativeEligibility=False,wholeAttempt=False)
