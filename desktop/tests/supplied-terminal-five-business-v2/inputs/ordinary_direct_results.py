"""Private supplied-result joins for the maintained three-edge subset.

No IO or capability reconstruction. Expected context, original staged bodies
and typed owner/finish readers remain distinct inputs. All returned authority
fields stay false; complete external/physical occurrence custody remains open.
"""
import hashlib,json
import ordinary_direct_capture_core as C0
import ordinary_direct_fixed_plan as P
import ordinary_direct_finish_reader as R
import ordinary_direct_owner_reader as DR
import ordinary_described_error as E
import ordinary_external_execution_policy_v1 as XP
import ordinary_external_profile_v1 as F

_ROLES=('stdout','stderr','archive','index')
_EDGES=('inner','electron','ui')
_SLOTS=('job','stdin.child','stdout.read','stdout.write','stderr.read','stderr.write',
    'stdout.sink','stderr.sink','child.process','child.primaryThread',
    'stdout.readerThread','stderr.readerThread','archive','index')
_BACKEND_STATES=('NOT_ACQUIRED','ACQUIRING','OPEN','FAILED','UNKNOWN','INDETERMINATE',
                 'CLOSE_PENDING','CLOSED','CLOSE_FAILED')
_OWNER_STATES=('NOT_ACQUIRED','ACQUIRING','OPEN','CLOSE_PENDING','CLOSED','FAILED','UNRESOLVED')

def _need(ok,code):
    if ok is not True:raise ValueError('MAINTAINED_DIRECT_RESULT:'+code)

def _keys(value,keys,code):
    _need(type(value) is dict and all(type(key) is str for key in value) and
          set(value)==set(keys),code)

def _uint(value,maximum=(1<<64)-1):return type(value) is int and 0<=value<=maximum
def _enum(value,values,code):_need(type(value) is str and value in values,code)
def _hex(value,size):return type(value) is str and len(value)==size and all(c in '0123456789abcdef' for c in value)

def _description(value):return E._desc_description(value)

def _identity(value,binding,owner=None):
    if value is None:return
    _keys(value,('pid','image','createdFileTime'),'IDENTITY_KEYS')
    _need(_uint(value['pid'],0xffffffff) and value['pid']>0 and type(value['image']) is str and
          value['image'].casefold()==P._FixedPlan(binding['edge']).application.casefold() and
          type(value['createdFileTime']) is str and 1<=len(value['createdFileTime'])<=20 and
          value['createdFileTime'].isascii() and value['createdFileTime'].isdecimal() and
          0<int(value['createdFileTime'])<(1<<64),'ORIGINAL_IDENTITY_VALUE')
    if owner is not None:
        _need(owner['creation']['state']=='CREATED' and value['pid']==owner['creation']['pid'],
              'ORIGINAL_CREATION_IDENTITY')

def normal_exit(value,identity,context):
    try:
        _keys(value,('kind','binding','pid','wait','exit'),'EXIT_KEYS')
        _need(value['kind']=='DIRECT_ORIGINAL_EXIT_V1','EXIT_VERSION')
        binding=C0._binding(value['binding'])
        _need(context.binding_matches(binding['edge'],binding),'EXPECTED_EXIT_BINDING')
        _identity(identity,binding);_need(identity is not None,'EXIT_IDENTITY_AVAILABLE')
        _keys(value['wait'],('state','timeoutMs'),'EXIT_WAIT_KEYS')
        _keys(value['exit'],('state','code'),'EXIT_CODE_KEYS')
        _need(type(value['pid']) is int and value['pid']==identity['pid'] and
              value['wait']['state']=='SIGNALED' and _uint(value['wait']['timeoutMs'],0xfffffffe) and
              value['wait']['timeoutMs']>0 and value['exit']['state']=='OBSERVED' and
              type(value['exit']['code']) is int and value['exit']['code']==0,'NORMAL_ORIGINAL_EXIT')
        return True
    except (ValueError,TypeError,KeyError):return False

def join_normal_exit(value,record,context):
    _need(normal_exit(value,record['identity'],context) and
          C0._equal(value['binding'],record['binding']) and
          value['pid']==record['owner']['creation']['pid'] and
          C0._equal(value['wait'],record['owner']['wait']) and
          C0._equal(value['exit'],record['owner']['exit']),'EXACT_ORIGINAL_EXIT_RECORD_JOIN')
    return True

def _capture(value,binding):
    _keys(value,('state','binding','failures','pending','unacknowledgedExports','channels',
          'observations','budget','physicalCapture','nativeEligibility','wholeAttempt'),'CAPTURE_KEYS')
    _need(C0._equal(C0._binding(value['binding']),binding),'CAPTURE_BINDING')
    for key in ('physicalCapture','nativeEligibility','wholeAttempt'):_need(value[key] is False,'CAPTURE_NO_AUTHORITY')
    _enum(value['state'],('ACTIVE','STOPPING','SEALED_COMPLETE','SEALED_ADVERSE'),'CAPTURE_STATE')
    _need(_uint(value['pending']) and _uint(value['unacknowledgedExports']) and
          type(value['failures']) is list and len(value['failures'])<=4096 and
          all(type(item) is str and 0<len(item)<=256 for item in value['failures']),'CAPTURE_COUNTERS')
    budget=value['budget'];_keys(budget,('spent','held','refused','uncertain','rows','wholeAttempt'),'BUDGET_KEYS')
    _need(_uint(budget['spent'],16777216) and _uint(budget['held'],16777216) and
          budget['spent']+budget['held']<=16777216 and type(budget['refused']) is bool and
          type(budget['uncertain']) is bool and budget['wholeAttempt'] is False and
          type(budget['rows']) is list,'BUDGET_VALUE')
    spent=held=0
    for row in budget['rows']:
        _need(type(row) is list and len(row)==4,'CHARGE_ROW')
        op,maximum,actual,unused=row
        _enum(op,C0._OPS,'CHARGE_OPERATION')
        _need(_uint(maximum,16777216),'CHARGE_MAXIMUM')
        if actual is None:
            _need(unused is None,'UNKNOWN_CHARGE');held+=maximum
        else:
            _need(_uint(actual,maximum) and type(unused) is int and unused==maximum-actual,
                  'CHARGE_EFFECT');spent+=actual
    _need(spent==budget['spent'] and held<=budget['held'],'GLOBAL_CHARGE_TOTALS')
    _keys(value['channels'],('stdout','stderr'),'CAPTURE_CHANNELS')
    for channel,row in value['channels'].items():
        _keys(row,('observed','committed','physicalKnown','pendingKnown','uncommittedOrDiscarded',
            'generation','unknown','overflow','reader','termination','sink','cancel'),'CHANNEL_KEYS')
        _need(all(_uint(row[key]) for key in ('observed','committed','physicalKnown','pendingKnown',
              'uncommittedOrDiscarded','generation')) and type(row['unknown']) is bool and
              type(row['overflow']) is bool,'CHANNEL_TYPES')
        _need(row['committed']<=row['physicalKnown']<=1048576 and row['pendingKnown']<=1048576 and
              row['committed']+row['pendingKnown']+row['uncommittedOrDiscarded']==row['observed'],
              'CHANNEL_BYTE_JOIN')
        _enum(row['reader'],('RUNNING','TERMINATED','NOT_STARTED'),'CHANNEL_READER')
        _enum(row['termination'],('NONE','EOF_REPORTED','ERROR','CANCELLED','UNKNOWN'),'CHANNEL_TERMINATION')
        _enum(row['sink'],('OPEN','CLOSE_REQUESTED','CLOSED','FAILED','UNRESOLVED'),'CHANNEL_SINK')
        _enum(row['cancel'],('NOT_REQUESTED','REQUESTED','ACCEPTED','REJECTED','FAILED','UNRESOLVED'),'CHANNEL_CANCEL')
        if row['reader']=='NOT_STARTED':
            _need(row['termination']=='NONE' and row['cancel']=='NOT_REQUESTED' and
                  not row['unknown'] and not row['overflow'] and all(row[key]==0 for key in
                  ('observed','committed','physicalKnown','pendingKnown','uncommittedOrDiscarded','generation')),
                  'ABSENT_READER_NO_HISTORY')
    observations=value['observations'];_need(type(observations) is list,'CAPTURE_OBSERVATIONS')
    _need(binding['edge']=='electron' or not observations,'NON_ELECTRON_NO_OBSERVATIONS')
    offset=generation=observed=0
    for ordinal,row in enumerate(observations,1):
        _keys(row,('ordinal','generation','offset','length','sha256','observedBytesAtSnapshot',
              'retainedPrefixBytes','readerStateAtSnapshot','eofSeenAtSnapshot','consumerPhase'),'OBSERVATION_KEYS')
        _need(all(_uint(row[key]) for key in ('ordinal','generation','offset','length',
              'observedBytesAtSnapshot','retainedPrefixBytes')) and row['ordinal']==ordinal and
              row['offset']==offset and row['length']==row['retainedPrefixBytes']<=1048576 and
              generation<=row['generation']<=value['channels']['stderr']['generation'] and
              max(observed,row['length'])<=row['observedBytesAtSnapshot']<=value['channels']['stderr']['observed'] and
              _hex(row['sha256'],64) and row['consumerPhase']=='ENDPOINT_DISCOVERY' and
              type(row['eofSeenAtSnapshot']) is bool,'OBSERVATION_VALUE')
        _enum(row['readerStateAtSnapshot'],('RUNNING','TERMINATED'),'OBSERVATION_READER')
        offset+=48+row['length'];generation=row['generation'];observed=row['observedBytesAtSnapshot']
        _need(offset<=4194304,'OBSERVATION_ARCHIVE_CAP')
    return dict(state=value['state'],pending=value['pending'],
        unacknowledgedExports=value['unacknowledgedExports'],failures=len(value['failures']),
        spent=budget['spent'],held=budget['held'],refused=budget['refused'],uncertain=budget['uncertain'])

def _call(value):
    _keys(value,('label','state','resultKind','raw','savedError','exception'),'CALL_KEYS')
    _need(type(value['label']) is str and value['label'] in _call_labels(),'FIXED_CALL_LABEL')
    _enum(value['state'],('NOT_STARTED','PENDING','RETURNED','UNKNOWN','QUIESCENT_UNKNOWN'),'CALL_STATE')
    _enum(value['resultKind'],('NULL','INTEGER','BOOLEAN','UNAVAILABLE'),'CALL_RESULT_KIND')
    kind=value['resultKind'];raw=value['raw']
    _need((raw is None if kind in ('NULL','UNAVAILABLE') else type(raw) is int if kind=='INTEGER'
          else type(raw) is bool),'CALL_RESULT_TYPE')
    _need(value['savedError'] is None or _uint(value['savedError'],0xffffffff),'CALL_SAVED_ERROR')
    if value['exception'] is not None:_description(value['exception'])
    if value['state'] in ('NOT_STARTED','PENDING'):
        _need(kind=='NULL' and raw is None and value['exception'] is None and value['savedError'] is None,
              'PENDING_CALL_NO_DELIVERY')
    if value['state'] in ('UNKNOWN','QUIESCENT_UNKNOWN'):
        _need(kind=='NULL' and raw is None and value['exception'] is not None,'UNKNOWN_CALL_ERROR')
    return value

def _call_labels():
    labels={'CONFIGURE_JOB','ATTRIBUTE_SIZE','ATTRIBUTE_INIT','CREATE_CHILD',
            'MEMBERSHIP','EXIT_CODE','JOB_ACCOUNTING','RETIRE_JOB','DELETE_ATTRIBUTES'}
    labels.update('ACQUIRE:'+name for name in ('job','stdin.child','stdout.sink','stderr.sink','archive','index'))
    labels.update('ATTRIBUTE_UPDATE:'+name for name in ('HANDLE_LIST','JOB_LIST'))
    for prefix in ('CREATE_PIPE','NONINHERIT_READ','CREATE_READER','CANCEL','READ','APPEND'):
        labels.update(prefix+':'+name for name in ('stdout','stderr'))
    labels.update('RESUME:'+name for name in ('child.primaryThread','stdout.readerThread','stderr.readerThread'))
    labels.update('WAIT:'+name for name in ('child.process','stdout.readerThread','stderr.readerThread'))
    labels.update('CLOSE:'+name for name in _SLOTS)
    for prefix in ('FILE_INFO','FILE_SIZE','FILE_WRITE','FILE_FLUSH','FILE_POSITION','FINAL_BODY'):
        labels.update(prefix+':'+role for role in _ROLES)
    return labels

def _finish_calls(finish,calls):
    # Preserve role-specific multiplicity and order, including repeated chunks.
    # These projections do not recover arguments or output cells/capabilities.
    for row in finish['roles']:
        role=row['role'];labels={prefix+':'+role for prefix in ('FILE_FLUSH','FILE_POSITION','FINAL_BODY')}
        originals=[call for call in calls if call['label'] in labels]
        projected=[dict(label=call['label'],state=call['state']) for call in originals]
        _need(C0._equal(projected,row['calls']),'ORIGINAL_FINISH_CALL_SEQUENCE:'+role)
        if row['complete']:
            _need(all(call['state']=='RETURNED' and call['resultKind'] in ('INTEGER','BOOLEAN') and
                      bool(call['raw']) and call['exception'] is None for call in originals),
                  'KNOWN_COMPLETE_FINISH_CALLS:'+role)

def _clean_calls(calls,binding,capture,finish):
    by_label={label:[call for call in calls if call['label']==label] for label in _call_labels()}
    def one(label):
        rows=by_label[label];_need(len(rows)==1,'ONE_ORIGINAL_CALL:'+label)
        return rows[0]
    def known(row):
        _need(row['state']=='RETURNED' and row['exception'] is None,'KNOWN_ORIGINAL_RETURN')
    def true(row):
        known(row);_need(row['resultKind'] in ('INTEGER','BOOLEAN') and bool(row['raw']),
                        'KNOWN_ORIGINAL_SUCCESS:'+row['label'])
    def exact(label,raw):
        row=one(label);known(row)
        _need(row['resultKind']=='INTEGER' and type(row['raw']) is int and row['raw']==raw,
              'EXACT_ORIGINAL_RETURN:'+label)
    for call in calls:known(call)
    handles=('job','stdin.child','stdout.sink','stderr.sink')+(
        ('archive','index') if binding['edge']=='electron' else ())
    for name in handles:
        row=one('ACQUIRE:'+name);known(row)
        _need(row['resultKind']=='INTEGER' and type(row['raw']) is int and
              0<row['raw']<(1<<64)-16,'KNOWN_ORIGINAL_HANDLE:'+name)
    probe=one('ATTRIBUTE_SIZE');known(probe)
    _need(probe['resultKind']=='INTEGER' and type(probe['raw']) is int and
          probe['raw']==0 and probe['savedError']==122,'EXPECTED_ATTRIBUTE_SIZE_PROBE')
    for label in ('CONFIGURE_JOB','ATTRIBUTE_INIT','ATTRIBUTE_UPDATE:HANDLE_LIST',
                  'ATTRIBUTE_UPDATE:JOB_LIST','CREATE_CHILD','MEMBERSHIP','EXIT_CODE'):
        true(one(label))
    destroy=one('DELETE_ATTRIBUTES');known(destroy)
    _need(destroy['resultKind']=='NULL' and destroy['raw'] is None and destroy['savedError'] is None,
          'ORIGINAL_ATTRIBUTE_DESTRUCTION')
    exact('RESUME:child.primaryThread',1);exact('WAIT:child.process',0)
    _need(bool(by_label['JOB_ACCOUNTING']),'ORIGINAL_JOB_ACCOUNTING_PRESENT')
    for row in by_label['JOB_ACCOUNTING']:true(row)
    _need(not by_label['RETIRE_JOB'],'NO_FORCED_RETIREMENT_FOR_CLEAN')
    for channel in ('stdout','stderr'):
        for prefix in ('CREATE_PIPE','NONINHERIT_READ'):true(one(prefix+':'+channel))
        created=one('CREATE_READER:'+channel);known(created)
        _need(created['resultKind']=='INTEGER' and type(created['raw']) is int and
              0<created['raw']<(1<<64)-16,'KNOWN_ORIGINAL_READER_HANDLE')
        exact('RESUME:'+channel+'.readerThread',1);exact('WAIT:'+channel+'.readerThread',0)
        _need(not by_label['CANCEL:'+channel],'NO_CANCELLED_CLEAN_READER')
        reads=by_label['READ:'+channel]
        _need(bool(reads),'ORIGINAL_READER_READ_PRESENT')
        last=reads[-1]
        _need(last['resultKind'] in ('INTEGER','BOOLEAN') and
              (bool(last['raw']) or last['savedError']==109),'KNOWN_ORIGINAL_READER_EOF_RETURN')
        # Output byte counts remain a separately supplied/custody obligation.
        if capture['channels'][channel]['committed']:
            _need(bool(by_label['APPEND:'+channel]),'ORIGINAL_APPEND_PRESENT')
    applicable=_ROLES if binding['edge']=='electron' else _ROLES[:2]
    for role in _ROLES:
        for prefix in ('FILE_INFO','FILE_SIZE'):
            rows=by_label[prefix+':'+role]
            _need(len(rows)==(2 if role in applicable else 0),'INITIAL_AND_FINAL_FILE_METADATA:'+role)
            for row in rows:true(row)
    for name in _SLOTS:
        expected=name not in ('archive','index') or binding['edge']=='electron'
        rows=by_label['CLOSE:'+name]
        _need(len(rows)==int(expected),'ORIGINAL_HANDLE_CLOSE:'+name)
        for row in rows:true(row)
    if binding['edge']=='electron':
        _need(len(by_label['FILE_WRITE:archive'])==len(capture['observations']) and
              len(by_label['FILE_WRITE:index'])==1,'ORIGINAL_ARCHIVE_INDEX_WRITES')
        for row in by_label['FILE_WRITE:archive']+by_label['FILE_WRITE:index']:true(row)
    else:
        _need(not any(by_label[prefix+':'+role] for prefix in ('FILE_WRITE','ACQUIRE')
                      for role in ('archive','index')),'NO_NON_ELECTRON_EXTRA_FILES')

def _attempts(value,calls,capture,owner):
    _keys(value,('stdout','stderr'),'READER_ATTEMPT_ROSTER')
    absent=[]
    for channel,row in value.items():
        _keys(row,('state','call','backendSlot','ownerSlot'),'READER_ATTEMPT_KEYS')
        _enum(row['state'],('NOT_ATTEMPTED','PRECALL','PRECALL_UNRESOLVED','PENDING','RETURNED','UNKNOWN'),
              'READER_ATTEMPT_STATE')
        _enum(row['backendSlot'],_BACKEND_STATES,'READER_BACKEND_SLOT')
        _enum(row['ownerSlot'],_OWNER_STATES,'READER_OWNER_SLOT')
        _need(row['ownerSlot']==owner['resourceClosures'][channel+'.readerThread'],'ATTEMPT_OWNER_JOIN')
        original=[call for call in calls if call['label']=='CREATE_READER:'+channel]
        if row['call'] is None:
            _need(not original and row['state'] in ('NOT_ATTEMPTED','PRECALL','PRECALL_UNRESOLVED'),
                  'ATTEMPT_NO_ORIGINAL_CALL')
        else:
            call=_call(row['call'])
            _need(len(original)==1 and C0._equal(call,original[0]) and
                  row['state']!='NOT_ATTEMPTED','ORIGINAL_READER_CALL_JOIN')
            if row['state']=='RETURNED':_need(call['state']=='RETURNED','RETURNED_READER_DELIVERY')
            if row['state']=='UNKNOWN':
                _need(call['state'] in ('UNKNOWN','QUIESCENT_UNKNOWN'),'UNKNOWN_READER_DELIVERY')
        if row['state']=='NOT_ATTEMPTED':
            _need(row['backendSlot']==row['ownerSlot']=='NOT_ACQUIRED','UNATTEMPTED_READER_SLOTS')
            absent.append(True)
        else:
            call=row['call']
            absent.append(call is not None and row['state']=='RETURNED' and
                call['resultKind']=='INTEGER' and type(call['raw']) is int and call['raw']==0 and
                row['backendSlot']==row['ownerSlot']=='FAILED')
    if any(row['reader']=='NOT_STARTED' for row in capture['channels'].values()):
        _need(all(absent) and all(row['reader']=='NOT_STARTED' for row in capture['channels'].values()) and
              not capture['observations'],'PROVED_PAIR_ABSENCE_ONLY')

def _edge_value(value,bodies,context,external_policy=None,*,five_role=False):
    _need(type(five_role) is bool and (not five_role or external_policy is not None),'EXPLICIT_FIVE_ROLE_POLICY')
    """Recompute one supplied edge; never dispatch to a legacy settlement.

    A clean result is a local consistency classification, not whole custody.
    Nonstaged capture metadata is parsed but cannot replace missing raw bodies.
    """
    _keys(value,('schema','kind','binding','disposition','classification','finalizationComplete',
        'identity','owner','capture','readerAttempts','finalReadback','captureFinish','bodyAvailability',
        'calls','primaryPresent','primary','secondary','projectionErrors','physicalCapture',
        'sourceCustody','nativeEligibility','wholeAttempt','scope')+(() if external_policy is None else ('execution',)),'CLOSED_EDGE')
    _need(type(value['schema']) is int and value['schema']==1 and
          value['kind']==('SIREN_FIVE_ROLE_DIRECT_EDGE_V2' if five_role else 'MAINTAINED_DIRECT_EDGE_V1' if external_policy is None else 'SIREN_EXTERNAL_DIRECT_EDGE_V1') and
          type(value['finalizationComplete']) is bool and
          value['scope']=='supplied original-owner projection; no capability transfer','EDGE_VERSION')
    raw=json.dumps(value,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
    _need(len(raw)<=262144,'EDGE_RECORD_CAP')
    for key in ('physicalCapture','sourceCustody','nativeEligibility','wholeAttempt'):
        _need(value[key] is False,'NO_AUTHORITY:'+key)
    binding=C0._binding(value['binding'])
    _need(binding['edge'] in (('owner','outer','inner','electron','ui') if five_role else _EDGES if external_policy is None else ('owner','outer')) and context.binding_matches(binding['edge'],binding),
          'CURRENT_EXPECTED_EDGE_BINDING')
    if external_policy is not None:_external_descriptor(value['execution'],binding,context,external_policy)
    owner=value['owner'];owner_class=DR.read_edge(owner)['classification']
    _need(C0._equal(owner['binding'],binding),'ORIGINAL_OWNER_BINDING')
    summary=_capture(value['capture'],binding)
    _need(C0._equal(owner['capture'],summary),'OWNER_CAPTURE_SUMMARY_JOIN')
    _identity(value['identity'],binding,owner)
    _need(type(value['primaryPresent']) is bool and
          value['primaryPresent']==(value['primary'] is not None),'PRIMARY_AVAILABILITY')
    if value['primary'] is not None:_description(value['primary'])
    _need(type(value['secondary']) is list and type(value['projectionErrors']) is list,'ERROR_ARRAYS')
    for row in value['secondary']:
        _keys(row,('stage','error'),'SECONDARY_KEYS')
        _need(type(row['stage']) is str and 0<len(row['stage'])<=256,'SECONDARY_STAGE')
        _description(row['error'])
    for row in value['projectionErrors']:
        _keys(row,('kind','error'),'PROJECTION_ERROR_KEYS')
        _enum(row['kind'],('ACTUAL_EXCEPTION','SNAPSHOT_CHANGED'),'PROJECTION_ERROR_KIND')
        if row['kind']=='ACTUAL_EXCEPTION':_description(row['error'])
        else:_need(row['error'] is None,'SNAPSHOT_ERROR_NO_INVENTED_EXCEPTION')
    _need(type(value['calls']) is list and len(value['calls'])<=4096,'BOUNDED_CALL_ROSTER')
    calls=[_call(row) for row in value['calls']]
    _attempts(value['readerAttempts'],calls,value['capture'],owner)
    final=value['finalReadback']
    _keys(final,('finalAttemptStarted','ticketPresent','ticketJoined','phase','rowsState','settled',
                 'finishRecordAvailability'),'FINAL_AVAILABILITY_KEYS')
    _need(all(type(final[key]) is bool for key in ('finalAttemptStarted','ticketPresent','ticketJoined')),
          'FINAL_AVAILABILITY_TYPES')
    _enum(final['rowsState'],('UNAVAILABLE','NOT_STAGED','PRESENT_UNFINALIZED','STAGED'),'FINAL_ROWS_STATE')
    _enum(final['finishRecordAvailability'],('AVAILABLE','UNAVAILABLE'),'FINAL_RECORD_AVAILABILITY')
    if final['ticketJoined']:
        _need(final['ticketPresent'] and type(final['settled']) is bool,'FINAL_ORIGINAL_TICKET')
        _enum(final['phase'],('RESERVED','READING','STAGED_QUIESCENT','FAILED_QUIESCENT','UNRESOLVED','CONSUMED'),
              'ORIGINAL_FINAL_PHASE')
        _need(final['rowsState']!='UNAVAILABLE','JOINED_FINAL_FIELDS_AVAILABLE')
    else:
        _need(final['phase'] is None and final['settled'] is None and final['rowsState']=='UNAVAILABLE',
              'UNJOINED_FINAL_FIELDS_UNAVAILABLE')
    _enum(value['disposition'],('STAGED_FINISH','PREFINAL_ABORT','FINAL_READBACK_UNAVAILABLE'),
          'EXPLICIT_DISPOSITION')
    _keys(value['bodyAvailability'],_ROLES,'BODY_ROSTER')
    applicable=(True,True,binding['edge']=='electron',binding['edge']=='electron')
    expected_paths={role:P._ROOT+'\\execution\\'+binding['edge']+'-'+role+'.log' for role in _ROLES[:2]}
    if binding['edge']=='electron':
        expected_paths.update(archive=P._ROOT+'\\execution\\electron-stderr-prefix-frames.bin',
                              index=P._ROOT+'\\execution\\electron-stderr-prefix-index.json')
    finish_class=None
    if value['disposition']=='STAGED_FINISH':
        _need(value['captureFinish'] is not None and final['finalAttemptStarted'] and final['ticketJoined'] and
              final['settled'] is True and final['rowsState']=='STAGED' and
              final['finishRecordAvailability']=='AVAILABLE','STAGED_FINISH_AVAILABLE')
        _need(type(bodies) is tuple and len(bodies)==4 and all(type(body) is bytes for body in bodies),
              'ACTUAL_STAGED_BODY_TUPLE')
        finish=value['captureFinish']
        finish_class=R.read(json.dumps(finish,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii'),bodies)['classification']
        _need(C0._equal(finish['capture'],value['capture']) and C0._equal(finish['binding'],binding) and
              finish['phase']==final['phase'],'FINAL_CAPTURE_AND_PHASE_JOIN')
        _finish_calls(finish,calls)
    else:
        _need(value['captureFinish'] is None and bodies is None and
              final['finishRecordAvailability']=='UNAVAILABLE','NO_INVENTED_FINAL_BODIES')
        if value['disposition']=='PREFINAL_ABORT':
            _need(not final['finalAttemptStarted'] and not final['ticketPresent'] and
                  not final['ticketJoined'] and value['capture']['state'] in ('STOPPING','SEALED_ADVERSE') and
                  bool(value['capture']['failures']),'ACTUAL_PREFINAL_ABORT_PHASE')
    caps=(1048576,1048576,4194304,262144)
    for i,role in enumerate(_ROLES):
        row=value['bodyAvailability'][role];_keys(row,('state','reference'),'BODY_AVAILABILITY_KEYS')
        expected_state=('NOT_APPLICABLE' if not applicable[i] else
                        'RETAINED_STAGED_BYTES' if value['disposition']=='STAGED_FINISH' else 'UNAVAILABLE')
        _need(row['state']==expected_state,'BODY_PHASE_AVAILABILITY')
        if expected_state=='RETAINED_STAGED_BYTES':
            ref=row['reference'];_keys(ref,('path','bytes','sha256'),'BODY_REFERENCE_KEYS')
            _need(type(ref['path']) is str and ref['path']==expected_paths[role] and
                  _uint(ref['bytes'],caps[i]) and ref['bytes']==len(bodies[i]) and
                  ref['sha256']==hashlib.sha256(bodies[i]).hexdigest(),'EXACT_SUPPLIED_BODY_REFERENCE')
        else:_need(row['reference'] is None,'NO_BODY_REFERENCE')
    clean=(value['finalizationComplete'] and value['disposition']=='STAGED_FINISH' and
        final['phase']=='CONSUMED' and owner_class=='CLEAN_LOCAL' and finish_class=='CLEAN_INERT' and
        value['identity'] is not None and not value['primaryPresent'] and not value['secondary'] and
        not value['projectionErrors'] and all(call['state']=='RETURNED' for call in calls) and
        all(row['state']=='RETURNED' for row in value['readerAttempts'].values()))
    classification='CLEAN_INERT' if clean else 'ADVERSE'
    if clean:_clean_calls(calls,binding,value['capture'],value['captureFinish'])
    _need(type(value['classification']) is str and value['classification']==classification,
          'RECOMPUTED_EDGE_CLASSIFICATION')
    return dict(binding=dict(binding),classification=classification,physicalCapture=False,
                sourceCustody=False,nativeEligibility=False,wholeAttempt=False)


def edge_value(value,bodies,context):return _edge_value(value,bodies,context)

def _external_policy_context(context,policy):
    import ordinary_direct_context as CX
    _need(type(context) is CX._ExternalExpectedContext and type(policy) is XP._ExecutionPolicyV1,'EXACT_EXTERNAL_RESULT_CONTEXT_POLICY')
    expected=dict(sourceIdentityKind=context.source_identity_kind,sourcePlanPin=context.source_plan_pin,reviewPin=context.review_pin,
        roleBindings={name:context.role_binding(name) for name in ('owner','outer','inner','electron','ui')})
    _need(F._same(policy.expected(),expected),'ORIGINAL_EXTERNAL_RESULT_SOURCE_ROLE_DOMAIN')

def _external_descriptor(value,binding,context,policy):
    _external_policy_context(context,policy)
    _keys(value,('policyPin','sourceIdentityKind','sourcePlanPin','reviewPin','originId','window','ownerDeadlineMs','clockReceipt'),'EXTERNAL_DESCRIPTOR')
    expected=policy.descriptor(binding['edge'])
    _need(F._same({key:item for key,item in value.items() if key!='clockReceipt'},expected),'EXACT_POLICY_ORIGINAL_OWNER_DEADLINE')
    clock=value['clockReceipt'];_keys(clock,('kind','parent','originId','minimumObservedMs','lastObservedMs','clockUnavailable','nativeEligibility','clockAuthenticated','sourceCustody','wholeAttempt'),'EXTERNAL_CLOCK_RECEIPT')
    _need(clock['kind']=='SIREN_EXTERNAL_CLOCK_RECEIPT_V1' and clock['parent']==value['window']['roleBinding']['parent'] and
        clock['originId']==policy.origin_id and _uint(clock['minimumObservedMs'],0xfffffffe) and
        clock['minimumObservedMs']>=value['window']['issuedAtMs'] and type(clock['clockUnavailable']) is bool and
        (clock['lastObservedMs'] is None or _uint(clock['lastObservedMs'],0xfffffffe) and clock['lastObservedMs']>=clock['minimumObservedMs']),
        'ORIGINAL_ELAPSED_CLOCK_RECEIPT')
    _need(all(clock[key] is False for key in ('nativeEligibility','clockAuthenticated','sourceCustody','wholeAttempt')),'NO_EXTERNAL_CLOCK_AUTHORITY')

def external_edge_value(value,bodies,context,policy):
    _external_policy_context(context,policy)
    return _edge_value(value,bodies,context,policy)


def five_role_edge_value_v2(value,bodies,context,policy):
    _external_policy_context(context,policy)
    return _edge_value(value,bodies,context,policy,five_role=True)
