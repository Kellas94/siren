"""Independent consistency reader for local timed-edge declarations and receipts."""
import ordinary_external_profile_v1 as F
import ordinary_direct_fixed_plan as P
import ordinary_direct_results as DX
import ordinary_external_execution_policy_v1 as XP

def _need(ok,code):
    if ok is not True:raise ValueError('TIMED_RESULT_V1:'+code)

def _uint(value):return type(value) is int and 0<=value<=0xfffffffe

def _read(raw,bodies,context,expected_timing,external_policy=None,*,five_role=False):
    _need(type(five_role) is bool and (not five_role or external_policy is not None),'EXPLICIT_FIVE_ROLE_POLICY')
    value=F._load(raw)
    F._version(value,('schema','kind','timing','waits','exitObservation','edge'),'SIREN_FIVE_ROLE_TIMED_EDGE_V2' if five_role else 'SIREN_TIMED_EDGE_V1' if external_policy is None else 'SIREN_EXTERNAL_TIMED_EDGE_V1')
    expected=expected_timing
    external=external_policy is not None
    F._version(expected,('schema','kind','coordinate','roleBinding','workCutoffMs','supervisionCutoffMs')+(() if not external else ('policyPin','originId','issuedAtMs')),'SIREN_FIVE_ROLE_TIMING_V2' if five_role else 'SIREN_EDGE_TIMING_V1' if not external else 'SIREN_EXTERNAL_EDGE_TIMING_V1')
    role=expected['roleBinding'];_need(type(role) is dict and type(role.get('edge')) is str,'ROLE')
    name=role['edge'];plan=P._validate_fixed_plan(P._FixedPlan(name))
    _need(name in (('owner','outer','inner','electron','ui') if five_role else ('owner','outer') if external else ('inner','electron','ui')) and F._same(role,context.role_binding(name)) and
        expected['coordinate']==('EXTERNAL_ELAPSED_MS_V1' if external else 'PARENT_ELAPSED_MS_V1'),'EXPECTED_EXTERNAL_ROLE_DOMAIN')
    work,supervision=expected['workCutoffMs'],expected['supervisionCutoffMs']
    if external:
        row=external_policy.edge(name)
        _need(F._same(expected['policyPin'],external_policy.reference()) and expected['originId']==external_policy.origin_id and
            type(expected['issuedAtMs']) is int and expected['issuedAtMs']==row['issuedAtMs'] and
            work==row['workCutoffMs'] and supervision==row['supervisionCutoffMs'] and _uint(work) and _uint(supervision),'EXACT_EXTERNAL_TIMING_ORDER')
    else:_need(_uint(work) and _uint(supervision) and 0<work<=supervision==plan.maintained_parent_budget_seconds*1000,'FIXED_TIMING_ORDER')
    timing=value['timing']
    F._keys(timing,('declaration','phase','workExpired','clockUnavailable','supervisionClosed','lastObservedMs','dispatches'),'TIMING_RECEIPT')
    _need(F._same(timing['declaration'],expected) and timing['phase'] in ('WORK','CLEANUP') and
        all(type(timing[key]) is bool for key in ('workExpired','clockUnavailable','supervisionClosed')) and
        (timing['lastObservedMs'] is None or _uint(timing['lastObservedMs'])),'EXACT_TIMING_DECLARATION')
    edge=value['edge'];parsed=DX.five_role_edge_value_v2(edge,bodies,context,external_policy) if five_role else DX.external_edge_value(edge,bodies,context,external_policy) if external else DX.edge_value(edge,bodies,context)
    clock=edge['execution']['clockReceipt'] if external else None
    floor=clock['minimumObservedMs'] if external else 0
    _need(edge['binding']==context.binding(name),'EXPECTED_TIMED_EDGE')
    events=timing['dispatches'];_need(type(events) is list and len(events)<=4096,'BOUNDED_DISPATCHES')
    admitted={};last=-1;cleanup=False;closed=False
    work_evidence=False;supervision_evidence=False;unavailable_evidence=False
    for event in events:
        F._keys(event,('callIndex','label','phase','cutoffMs','nowMs','state','reason'),'DISPATCH_ROW')
        phase=event['phase'];now=event['nowMs'];index=event['callIndex']
        _need(phase in ('WORK','CLEANUP') and not(cleanup and phase=='WORK') and _uint(index) and type(event['label']) is str,'PHASE_AND_CALL_INDEX')
        cleanup=cleanup or phase=='CLEANUP';cutoff=work if phase=='WORK' else supervision
        _need(type(event['cutoffMs']) is int and event['cutoffMs']==cutoff,'PHASE_CUTOFF')
        if now is not None:
            _need(_uint(now) and now>=last and now>=floor,'MONOTONE_DISPATCH_SAMPLES');last=now
            work_evidence=work_evidence or phase=='WORK' and now>=work
            supervision_evidence=supervision_evidence or now>=supervision
        if event['state']=='ADMITTED':
            _need(not closed and now is not None and now<cutoff and event['reason']=='BEFORE_CUTOFF' and
                index==len(admitted) and index<len(edge['calls']) and edge['calls'][index]['label']==event['label'],'ACTUAL_ADMITTED_CALL_SEQUENCE')
            admitted[index]=event
        else:
            _need(event['state']=='REFUSED' and index==len(admitted) and
                (event['reason']=='CLOCK_UNAVAILABLE' and now is None or event['reason']=='CUTOFF' and now is not None and now>=cutoff),'KNOWN_PREDISPATCH_REFUSAL')
            if now is None:unavailable_evidence=True
            if now is None or now>=supervision:closed=True
    _need(len(admitted)==len(edge['calls']),'NO_UNDECLARED_EXPORT_CALL')
    if last>=0:_need(timing['lastObservedMs'] is not None and timing['lastObservedMs']>=last,'LAST_OBSERVED_SAMPLE')
    final_sample=timing['lastObservedMs']
    if external:
        observed=clock['lastObservedMs']
        _need(final_sample is None or final_sample>=floor and observed is not None and observed>=final_sample,'ORIGINAL_EXTERNAL_FINAL_CLOCK_JOIN')
        if observed is not None:
            supervision_evidence=supervision_evidence or observed>=supervision
            work_evidence=work_evidence or timing['phase']=='WORK' and observed>=work
        unavailable_evidence=unavailable_evidence or clock['clockUnavailable']
    if final_sample is not None:
        supervision_evidence=supervision_evidence or final_sample>=supervision
        work_evidence=work_evidence or timing['phase']=='WORK' and final_sample>=work
    _need(not cleanup or timing['phase']=='CLEANUP','RETAIN_CLEANUP_PHASE')
    _need(not supervision_evidence or timing['supervisionClosed'],'SUPERVISION_SAMPLE_REQUIRES_CLOSURE')
    _need(not work_evidence or timing['workExpired'],'WORK_SAMPLE_REQUIRES_EXPIRY')
    _need(not unavailable_evidence or timing['clockUnavailable'],'CLOCK_REFUSAL_REQUIRES_UNAVAILABLE')
    waits=value['waits'];_need(type(waits) is list and len(waits)<=4096,'WAIT_RECEIPTS')
    indices=[]
    for row in waits:
        F._keys(row,('nowMs','cutoffMs','timeoutMs','capExplicit','callIndex','outcome','acknowledged'),'ORIGINAL_WAIT_RECEIPT')
        _need(_uint(row['nowMs']) and row['nowMs']>=floor and type(row['capExplicit']) is bool and type(row['acknowledged']) is bool and
            type(row['cutoffMs']) is int and row['cutoffMs']==(work if row['capExplicit'] else supervision) and
            row['nowMs']<row['cutoffMs'] and type(row['timeoutMs']) is int and
            row['timeoutMs']==row['cutoffMs']-row['nowMs'],'EXACT_ORIGINAL_WAIT_TICKET_TIMEOUT')
        index=row['callIndex']
        if index is None:
            _need(row['outcome']=='NOT_DISPATCHED' and not row['acknowledged'],'NO_INVENTED_WAIT_DISPATCH')
        else:
            _need(_uint(index) and index in admitted and edge['calls'][index]['label']=='WAIT:child.process' and
                admitted[index]['phase']==('WORK' if row['capExplicit'] else 'CLEANUP'),'WAIT_DISPATCH_PHASE')
            call=edge['calls'][index]
            outcome=('UNRESOLVED' if call['state']!='RETURNED' else 'SIGNALED' if call['raw']==0 else 'TIMEOUT' if call['raw']==258 else 'FAILED')
            _need(row['outcome']==outcome,'WAIT_DELIVERY_OUTCOME');indices.append(index)
    _need(indices==[i for i,call in enumerate(edge['calls']) if call['label']=='WAIT:child.process'],'ALL_ORIGINAL_PROCESS_WAITS')
    if waits:
        last_wait=waits[-1]
        _need(edge['owner']['wait']['timeoutMs']==last_wait['timeoutMs'],'FINAL_OWNER_WAIT_TIMEOUT')
        if last_wait['acknowledged']:_need(edge['owner']['wait']['state']==last_wait['outcome'],'FINAL_OWNER_WAIT_ACK')
    observed=edge['owner']['exit'];available=observed['state']=='OBSERVED'
    expected_exit=dict(available=available,code=observed['code'] if available else None)
    _need(F._same(value['exitObservation'],expected_exit),'RETAIN_OBSERVED_DWORD_EXIT')
    clean=(parsed['classification']=='CLEAN_INERT' and timing['phase']=='CLEANUP' and
        not any(timing[key] for key in ('workExpired','clockUnavailable','supervisionClosed')) and
        all(row['acknowledged'] for row in waits))
    return dict(classification='CLEAN_INERT' if clean else 'ADVERSE',exitAvailable=available,
        exitCode=expected_exit['code'],physicalCapture=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)


def read(raw,bodies,context,expected_timing):return _read(raw,bodies,context,expected_timing)

def read_external(raw,bodies,context,policy):
    DX._external_policy_context(context,policy)
    value=F._load(raw)
    F._version(value,('schema','kind','timing','waits','exitObservation','edge'),'SIREN_EXTERNAL_TIMED_EDGE_V1')
    _need(type(value['timing']) is dict and type(value['timing'].get('declaration')) is dict,'EXTERNAL_DECLARATION_CONTAINER')
    role=value['timing']['declaration'].get('roleBinding')
    _need(type(role) is dict and type(role.get('edge')) is str,'EXTERNAL_ROLE_CONTAINER')
    name=role['edge'];row=policy.edge(name)
    expected=dict(schema=1,kind='SIREN_EXTERNAL_EDGE_TIMING_V1',coordinate='EXTERNAL_ELAPSED_MS_V1',
        policyPin=policy.reference(),originId=policy.origin_id,roleBinding=row['roleBinding'],issuedAtMs=row['issuedAtMs'],
        workCutoffMs=row['workCutoffMs'],supervisionCutoffMs=row['supervisionCutoffMs'])
    return _read(raw,bodies,context,expected,policy)


def read_five_role_v2(raw,bodies,context,policy):
    DX._external_policy_context(context,policy)
    value=F._load(raw)
    F._version(value,('schema','kind','timing','waits','exitObservation','edge'),'SIREN_FIVE_ROLE_TIMED_EDGE_V2')
    _need(type(value['timing']) is dict and type(value['timing'].get('declaration')) is dict,'EXTERNAL_DECLARATION_CONTAINER')
    role=value['timing']['declaration'].get('roleBinding')
    _need(type(role) is dict and type(role.get('edge')) is str,'EXTERNAL_ROLE_CONTAINER')
    name=role['edge'];row=policy.edge(name)
    expected=dict(schema=1,kind='SIREN_FIVE_ROLE_TIMING_V2',coordinate='EXTERNAL_ELAPSED_MS_V1',
        policyPin=policy.reference(),originId=policy.origin_id,roleBinding=row['roleBinding'],issuedAtMs=row['issuedAtMs'],
        workCutoffMs=row['workCutoffMs'],supervisionCutoffMs=row['supervisionCutoffMs'])
    return _read(raw,bodies,context,expected,policy,five_role=True)
