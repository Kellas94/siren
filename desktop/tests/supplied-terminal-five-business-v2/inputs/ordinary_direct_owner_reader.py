"""Strict reader for the supplied owner schema, not native or legacy records.

Recomputes local consistency/classification; it authenticates no input lineage.
Physical readback, full capture grammar and whole occurrence accounting remain
separate. Serialized labels cannot supply the held opaque resource capability.
"""
_EDGES=('owner','outer','inner','electron','ui')
_RESOURCES=('job','stdin.child','stdout.read','stdout.write','stderr.read','stderr.write',
            'stdout.sink','stderr.sink','startup.attributeList','startup.storage',
            'child.process','child.primaryThread','stdout.readerThread','stderr.readerThread')
_KEYS={'schema','kind','binding','creation','membership','readerReady','resume','wait','exit',
       'jobRetirement','jobAccounting','resourceClosures','pendingOperations','leases','failures',
       'capture','classification','physicalCapture','sourceCustody','nativeEligibility','wholeAttempt'}

def _need(ok,code):
    if ok is not True:raise ValueError('DIRECT_READER_V1:'+code)

def _keys(value,keys,code):
    _need(type(value) is dict and set(value)==set(keys),code)

def _uint(n,maximum=0xffffffff):return type(n) is int and 0<=n<=maximum

def _state(value,allowed,code):_need(type(value) is str and value in allowed,code)

def _hex(s,n):return type(s) is str and len(s)==n and all(c in '0123456789abcdef' for c in s)

def read_edge(value):
    _keys(value,_KEYS,'CLOSED_ROOT')
    _need(type(value['schema']) is int and value['schema']==2 and
          type(value['kind']) is str and value['kind']=='SUPPLIED_DIRECT_OWNER_V2','SCHEMA')
    for key in ('physicalCapture','sourceCustody','nativeEligibility','wholeAttempt'):
        _need(value[key] is False,'NO_AUTHORITY:'+key)
    b=value['binding'];_keys(b,('attemptId','edge','headerSha256','creationInvocationId'),'BINDING_KEYS')
    _need(_hex(b['attemptId'],32) and _hex(b['headerSha256'],64) and
          _hex(b['creationInvocationId'],32) and type(b['edge']) is str and b['edge'] in _EDGES,'BINDING')
    creation=value['creation'];_keys(creation,('state','pid','tid','callQuiescent'),'CREATION_KEYS')
    _state(creation['state'],('NOT_ATTEMPTED','ATTEMPTED','CREATED','FAILED','UNRESOLVED'),'CREATION_STATE')
    for name in ('pid','tid'):
        _need(creation[name] is None or (_uint(creation[name]) and creation[name]>0),'CREATION_ID')
    _need(creation['state']=='CREATED' or (creation['pid'] is None and creation['tid'] is None),'CREATION_ID_PHASE')
    _need(type(creation['callQuiescent']) is bool,'CREATION_QUIESCENCE')
    _need(creation['state'] not in ('CREATED','FAILED','NOT_ATTEMPTED') or creation['callQuiescent'] is True,'KNOWN_CREATION_QUIESCENCE')
    _need(creation['state']!='ATTEMPTED' or creation['callQuiescent'] is False,'PENDING_CREATION_QUIESCENCE')
    _state(value['membership'],('NOT_OBSERVED','PENDING','MEMBER','NOT_MEMBER','FAILED','UNRESOLVED'),'MEMBERSHIP')
    _need(value['membership']!='MEMBER' or creation['state']=='CREATED','MEMBERSHIP_CREATION')
    ready=value['readerReady'];_keys(ready,('stdout','stderr'),'READER_READY_KEYS')
    _need(all(type(v) is bool for v in ready.values()),'READER_READY_BOOL')
    resume=value['resume'];_keys(resume,('state','priorCount'),'RESUME_KEYS')
    _state(resume['state'],('NOT_ATTEMPTED','PENDING','RETURNED','FAILED','UNRESOLVED'),'RESUME_STATE')
    _need((_uint(resume['priorCount'],0xfffffffe) if resume['state']=='RETURNED' else resume['priorCount'] is None),'RESUME_COUNT')
    wait=value['wait'];_keys(wait,('state','timeoutMs'),'WAIT_KEYS')
    _state(wait['state'],('NOT_OBSERVED','PENDING','SIGNALED','TIMEOUT','FAILED','UNRESOLVED'),'WAIT_STATE')
    _need((wait['timeoutMs'] is None if wait['state']=='NOT_OBSERVED' else
           _uint(wait['timeoutMs'],0xfffffffe) and wait['timeoutMs']>0),'WAIT_TIMEOUT')
    exit=value['exit'];_keys(exit,('state','code'),'EXIT_KEYS')
    _state(exit['state'],('NOT_OBSERVED','PENDING','OBSERVED','FAILED','UNRESOLVED'),'EXIT_STATE')
    _need((_uint(exit['code']) if exit['state']=='OBSERVED' else exit['code'] is None),'EXACT_DWORD_EXIT')
    _need(exit['state']!='OBSERVED' or wait['state']=='SIGNALED','EXIT_SIGNAL_JOIN')
    _state(value['jobRetirement'],('NOT_ATTEMPTED','PENDING','TERMINATED','FAILED','UNRESOLVED'),'JOB_RETIREMENT')
    job=value['jobAccounting'];_keys(job,('state','active','phase'),'JOB_KEYS')
    _state(job['state'],('NOT_OBSERVED','PENDING','OBSERVED','FAILED','UNRESOLVED'),'JOB_STATE')
    _need((_uint(job['active']) if job['state']=='OBSERVED' else job['active'] is None),'JOB_ACTIVE')
    if job['state']=='NOT_OBSERVED':_need(job['phase'] is None,'NO_UNOBSERVED_JOB_PHASE')
    else:
        _state(job['phase'],('POST_EXIT','FORCED_QUIESCENT','FAILED_CREATION'),'ACCOUNTING_PHASE')
        if job['phase']=='POST_EXIT':_need(creation['state']=='CREATED' and wait['state']=='SIGNALED','POST_EXIT_ACCOUNTING_JOIN')
        elif job['phase']=='FORCED_QUIESCENT':_need(creation['callQuiescent'] is True and value['jobRetirement']=='TERMINATED','FORCED_QUIESCENT_JOIN')
        else:_need(creation['state']=='FAILED' and creation['callQuiescent'] is True,'FAILED_CREATION_JOIN')
    closures=value['resourceClosures'];_keys(closures,_RESOURCES,'RESOURCE_ROSTER')
    for state in closures.values():
        _state(state,('NOT_ACQUIRED','ACQUIRING','OPEN','CLOSE_PENDING','CLOSED','FAILED','UNRESOLVED'),'RESOURCE_STATE')
    _need(_uint(value['pendingOperations']) and _uint(value['leases']),'PENDING_COUNTERS')
    failures=value['failures']
    _need(type(failures) is list and len(failures)<=64 and
          all(type(s) is str and 1<=len(s)<=256 for s in failures),'FAILURES')
    c=value['capture'];_keys(c,('state','pending','unacknowledgedExports','failures','spent','held','refused','uncertain'),'CAPTURE_KEYS')
    _state(c['state'],('ACTIVE','STOPPING','SEALED_COMPLETE','SEALED_ADVERSE'),'CAPTURE_STATE')
    _need(all(_uint(c[n]) for n in ('pending','unacknowledgedExports','failures','spent','held')) and
          c['spent']+c['held']<=16777216 and type(c['refused']) is bool and type(c['uncertain']) is bool,'CAPTURE_COUNTERS')
    _state(value['classification'],('CLEAN_LOCAL','ADVERSE'),'CLASSIFICATION')
    # This predicate is derived independently from the contract, not imported
    # from the producing owner. It proves supplied-record consistency only.
    clean=(creation['state']=='CREATED' and creation['callQuiescent'] is True and creation['pid'] is not None and creation['tid'] is not None and
           value['membership']=='MEMBER' and all(ready.values()) and
           resume['state']=='RETURNED' and resume['priorCount']==1 and wait['state']=='SIGNALED' and
           exit['state']=='OBSERVED' and exit['code']==0 and value['jobRetirement']=='NOT_ATTEMPTED' and
           job['state']=='OBSERVED' and job['active']==0 and job['phase']=='POST_EXIT' and all(s=='CLOSED' for s in closures.values()) and
           value['pendingOperations']==0 and value['leases']==0 and not failures and
           c['state']=='SEALED_COMPLETE' and c['pending']==0 and c['unacknowledgedExports']==0 and
           c['failures']==0 and c['held']==0 and not c['refused'] and not c['uncertain'])
    _need(value['classification']==('CLEAN_LOCAL' if clean else 'ADVERSE'),'RECOMPUTED_CLASSIFICATION')
    return dict(edge=b['edge'],attemptId=b['attemptId'],headerSha256=b['headerSha256'],
                creationInvocationId=b['creationInvocationId'],classification=value['classification'],
                physicalCapture=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)

def read_attempt(records):
    _need(type(records) is list and len(records)==5,'EXACT_FIVE_EDGES')
    rows=[read_edge(r) for r in records]
    _need(sorted(r['edge'] for r in rows)==sorted(_EDGES),'UNIQUE_FIVE_EDGES')
    _need(len({r['attemptId'] for r in rows})==1 and len({r['headerSha256'] for r in rows})==1,'SAME_ATTEMPT_HEADER')
    _need(len({r['creationInvocationId'] for r in rows})==5,'UNIQUE_CREATION_INVOCATIONS')
    return dict(kind='SUPPLIED_FIVE_EDGE_COMPOSITION_V2',edges=rows,
                classification='CLEAN_LOCAL' if all(r['classification']=='CLEAN_LOCAL' for r in rows) else 'ADVERSE',
                physicalCapture=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)
