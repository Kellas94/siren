"""One-use supplied C0 outer supervision; no native entry or custody authority."""
import hashlib,json
import ordinary_direct_context as CX
import ordinary_direct_fixed_plan as P
import ordinary_direct_capture_core as CORE
import ordinary_direct_caller_adapter as A
import ordinary_direct_timing_results_v1 as TR
import ordinary_external_execution_policy_v1 as XP
import ordinary_external_profile_v1 as F
import ordinary_business_domain_v1 as BD
import ordinary_business_publication_reader_v1 as PUB

_STATE='_siren_supplied_c0_run_v1'
_REPORT_PATH=F._runtime_path('c0-report')
_FLAGS=('wholeSourceGatePassed','nativeEligibility','authenticatedTransport','sourceCustody',
    'wholeAttempt','innerClockMigrationComplete','c0SelfExitObserved','c0FinalStreamsObserved')

def _need(value,code):
    if value is not True:raise ValueError('SUPPLIED_C0_V1:'+code)

def _raw(value):return json.dumps(value,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')

def _diagnostic(error):
    try:message=str(error);unavailable=False
    except BaseException:message='';unavailable=True
    return dict(type=type(error).__name__[:128],message=message[:4096],messageUnavailable=unavailable)

def _body_tuple(parent,edge,record):
    _need(parent.edges.get('outer') is edge and type(edge) is A._OwnedEdge,'ORIGINAL_OUTER_EDGE')
    if record['edge']['disposition']!='STAGED_FINISH':return None
    with edge.q.lock:
        ticket=edge.q.final_ticket
        _need(ticket is not None and ticket is edge.q.capture._final and ticket._owner is edge.q.capture and
            ticket._kind=='READBACK' and ticket._fields['settled'] is True and
            ticket._fields['phase']==record['edge']['finalReadback']['phase'],'ORIGINAL_SETTLED_READBACK')
        rows=ticket._fields['rows']
        _need(type(rows) is tuple and len(rows)==4,'FOUR_ORIGINAL_READBACK_ROWS')
        bodies=tuple(r['body'] for r in rows)
        _need(all(type(b) is bytes for b in bodies),'ORIGINAL_BODY_BYTES')
        return bodies

def run_c0_supplied(*,context,policy,clock,runtime,components,security_factory,
    startup_factory,observe_identity,pump,sleep,read_outer_publication,publish_report):
    """Return retained local state; its immutable report excludes later delivery.

    Cooperative ports must return and the supplied original provider must progress.
    Existing cutoffs cannot preempt a blocked synchronous Python call.
    """
    _need(type(context) is CX._ExternalExpectedContext and type(policy) is XP._ExecutionPolicyV1 and
        type(clock) is XP._ElapsedClockV1 and clock.parent=='C0' and clock.policy is policy,'EXACT_C0_CONTEXT_POLICY_CLOCK')
    _need(all(callable(p) for p in (security_factory,startup_factory,observe_identity,pump,sleep,
        read_outer_publication,publish_report)),'MANDATORY_EXPLICIT_PORTS')
    state=dict(kind='SIREN_SUPPLIED_C0_LOCAL_STATE_V1',context=context,parent=None,edge=None,primary=None,
        secondary=[],phase='RESERVED',normal_exit=None,timed_record=None,timed_raw=None,capture_bodies=None,
        lifecycle=None,publication_packet=None,publication=None,retained_inputs=[],retained_input_bytes=0,
        clock_checks=[],cleanup='NO_EDGE_RETURNED',report=None,report_raw=None,report_pin=None,
        delivery=dict(attempted=False,callReturned=False,accepted=False,error=None,reason='NOT_ATTEMPTED'))
    with context._claim_lock:
        _need(not hasattr(context,_STATE) and 'C0' not in context._parents,'LOCAL_RUN_ALREADY_RESERVED')
        setattr(context,_STATE,state)
    def secondary(label,error):state['secondary'].append((label,error))
    def check(label,phase):
        now=clock.now_ms();row=policy.edge('outer');stop=row['workCutoffMs' if phase=='WORK' else 'supervisionCutoffMs']
        state['clock_checks'].append(dict(label=label,phase=phase,nowMs=now,cutoffMs=stop))
        _need(now<stop,'ORIGINAL_'+phase+'_CUTOFF:'+label)
    def retain(label,body,maximum,applicable=True):
        _need(type(body) is bytes and len(body)<=maximum,'BOUNDED_RETAINED_INPUT:'+label)
        total=state['retained_input_bytes']+len(body)
        _need(total<=CORE._AGGREGATE_MAX,'PARTIAL_RUNTIME_RETENTION_LIMIT')
        row=dict(label=label,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),applicable=applicable)
        state['retained_inputs'].append(dict(reference=row,body=body));state['retained_input_bytes']=total
        return row
    def retain_tuple(prefix,bodies):
        _need(type(bodies) is tuple and len(bodies)==4,'EXACT_SUPPLIED_BODY_TUPLE')
        for name,body,maximum in zip(('stdout','stderr','archive','index'),bodies,
            (CORE._STREAM_MAX,CORE._STREAM_MAX,CORE._ARCHIVE_MAX,CORE._METADATA_MAX)):
            retain(prefix+'.'+name,body,maximum,not(name in ('archive','index') and prefix!='business.electron'))
    operation='PARENT_CONSTRUCTION'
    try:
        parent=state['parent']=CX.from_external_execution_v1(supplied_context=context,policy=policy,
            clock=clock,runtime=runtime,components=components)
        operation='EDGE_CONSTRUCTION';edge=state['edge']=parent.new_edge('outer',P._FixedPlan('outer').argv)
        operation='SECURITY_FACTORY';check('before-security','WORK');security=security_factory(edge.q,edge.plan);check('after-security','WORK')
        operation='ACQUIRE_START';edge.acquire_and_start(security,startup_factory,pump,sleep)
        operation='POST_START_PROGRESS';check('before-progress','WORK');pump(edge.q);check('after-progress','WORK')
        operation='ORIGINAL_IDENTITY';edge.borrow_identity();handle=edge.original_process_handle();check('before-identity','WORK')
        observed=observe_identity(handle,expected_pid=edge.q.owner._creation['pid'],expected_image=edge.plan.application)
        check('after-identity','WORK');edge.remember_identity(observed)
        operation='ORIGINAL_WAIT';state['normal_exit']=edge.wait_original_exit();state['phase']='WORK_COMPLETED'
    except BaseException as error:state['primary']=(operation,error)
    finally:
        edge=state['edge']
        if edge is not None:
            state['cleanup']='ATTEMPTED'
            try:
                edge.finalize(None if state['primary'] is None else state['primary'][1],pump,sleep)
                state['cleanup']='RETURNED' if edge.finalization_complete else 'RETURNED_INCOMPLETE'
            except BaseException as error:state['cleanup']='RAISED';secondary('FINALIZE',error)
    edge=state['edge'];parent=state['parent']
    if edge is not None:
        try:
            record=state['timed_record']=edge.project_timed_outcome()
            raw=state['timed_raw']=_raw(record);retain('outer.timed',raw,CORE._METADATA_MAX)
            bodies=state['capture_bodies']=_body_tuple(parent,edge,record)
            if bodies is not None:retain_tuple('outer',bodies)
            state['lifecycle']=TR.read_external(raw,bodies,context,policy)
        except BaseException as error:secondary('CURRENT_TIMED_PROJECTION_READ',error)
    state['publication']=dict(status='NOT_READ',reason='ORIGINAL_LIFECYCLE_NOT_CLEAN')
    if state['primary'] is None and not state['secondary'] and state['lifecycle'] is not None and state['lifecycle']['classification']=='CLEAN_INERT':
        state['publication']=dict(status='READ_ATTEMPTED',reason='OBSERVATION_UNRESOLVED')
        try:
            check('before-publication-read','CLEANUP')
            packet=state['publication_packet']=read_outer_publication()
            # Retain the raw packet before deadline/shape/semantic checks.
            if type(packet) is dict and type(packet.get('raw')) is bytes:retain('business.raw',packet['raw'],PUB._PUBLICATION_MAX)
            check('after-publication-read','CLEANUP')
            _need(type(packet) is dict and type(packet.get('status')) is str,'CLOSED_PUBLICATION_PACKET')
            if packet['status']=='UNAVAILABLE':
                F._keys(packet,('status','reason'),'PUBLICATION_UNAVAILABLE')
                _need(type(packet['reason']) is str and 0<len(packet['reason'])<=4096,'UNAVAILABLE_REASON')
                state['publication']=dict(packet)
            else:
                F._keys(packet,('status','raw','expected_pin','context','artifacts','inner_bodies','child_bodies','producer'),'PUBLICATION_READ_PACKET')
                _need(packet['status']=='READ' and type(packet['context']) is BD._BusinessDomainContextV1 and packet['context']._context is context,'ORIGINAL_PUBLICATION_CONTEXT')
                producer=packet['producer'];F._keys(producer,('roleBinding','identity','sourcePlanPin'),'DECLARED_PUBLICATION_PRODUCER')
                _need(F._same(producer['roleBinding'],context.role_binding('outer')) and F._same(producer['identity'],edge.identity) and
                    F._same(producer['sourcePlanPin'],context.source_plan_pin),'DECLARED_ORIGINAL_OUTER_PRODUCER')
                F._keys(packet['artifacts'],('journal','stdout','stderr'),'PUBLICATION_ARTIFACTS')
                F._keys(packet['child_bodies'],('electron','ui'),'PUBLICATION_CHILD_BODIES')
                retain_tuple('business.inner',packet['inner_bodies'])
                for name in ('electron','ui'):retain_tuple('business.'+name,packet['child_bodies'][name])
                for name,maximum in (('journal',11264),('stdout',CORE._STREAM_MAX),('stderr',CORE._STREAM_MAX)):
                    retain('business.artifact.'+name,packet['artifacts'][name],maximum)
                answer=PUB.read_outer_publication(packet['raw'],expected_pin=packet['expected_pin'],context=packet['context'],
                    artifacts=packet['artifacts'],inner_bodies=packet['inner_bodies'],child_bodies=packet['child_bodies'])
                state['publication']=dict(status='READ',producer=F._detach(producer),decision={k:v for k,v in answer.items() if k!='raw'})
                check('after-publication-semantics','CLEANUP')
        except BaseException as error:
            state['publication']=dict(status='REFUSED_OR_UNAVAILABLE',reason='PUBLICATION_OBSERVATION_RAISED',
                rawRetained=any(r['reference']['label']=='business.raw' for r in state['retained_inputs']))
            secondary('PUBLICATION_OBSERVATION',error)
    attempt=None if parent is None else parent._attempts.get('outer')
    partial=None if attempt is None else dict(phase=attempt['phase'],available={key:attempt[key] is not None for key in ('timing','capture','owner','backend','coordinator','edge')})
    clean=(state['primary'] is None and not state['secondary'] and state['cleanup']=='RETURNED' and
        state['lifecycle'] is not None and state['lifecycle']['classification']=='CLEAN_INERT' and
        state['publication']['status']=='READ' and state['publication']['decision']['classification']=='SUPPLIED_BUSINESS_COMPLETE')
    report=dict(schema=1,kind='SIREN_SUPPLIED_C0_REPORT_V1',stage='SUPPLIED_C0_OBSERVATION_COMPLETE' if clean else 'SUPPLIED_C0_ADVERSE',
        outerRole=context.role_binding('outer'),policyPin=policy.reference(),clock=clock.snapshot(),clockChecks=list(state['clock_checks']),
        primary=None if state['primary'] is None else dict(operation=state['primary'][0],error=_diagnostic(state['primary'][1])),
        secondary=[dict(operation=label,error=_diagnostic(error)) for label,error in state['secondary']],
        construction=partial,cleanup=state['cleanup'],originalOuterIdentity=None if edge is None else F._detach(edge.identity),
        originalOuterNormalExit=F._detach(state['normal_exit']),lifecycle=F._detach(state['lifecycle']),publication=F._detach(state['publication']),
        requiredRuntimeInputs=[dict(r['reference']) for r in state['retained_inputs']],runtimeInputOccurrenceBytes=state['retained_input_bytes'],
        partialRetentionBudgetOnly=True,**{k:False for k in _FLAGS})
    state['report']=report
    try:
        sealed=_raw(report);_need(len(sealed)<=CORE._METADATA_MAX,'SEALED_REPORT_BOUND')
        _need(len(sealed)<=CORE._AGGREGATE_MAX-state['retained_input_bytes'],'PARTIAL_SEALED_RETENTION_LIMIT')
        state['report_raw']=sealed;state['report_pin']=dict(path=_REPORT_PATH,bytes=len(sealed),sha256=hashlib.sha256(sealed).hexdigest())
    except BaseException as error:secondary('REPORT_SEAL',error);return state
    delivery=state['delivery']
    try:
        check('before-report-delivery','CLEANUP')
        delivery['attempted']=True
        receipt=publish_report(state['report_raw']);delivery['callReturned']=True;delivery['receipt']=receipt
        check('after-report-delivery','CLEANUP')
        F._keys(receipt,('kind','status','pin'),'SUPPLIED_REPORT_DELIVERY')
        _need(receipt['kind']=='SUPPLIED_C0_REPORT_DELIVERY_V1' and receipt['status']=='RECORDED' and
            F._same(receipt['pin'],state['report_pin']),'EXACT_SUPPLIED_DELIVERY_RECEIPT')
        delivery['accepted']=True;delivery['reason']=None
    except BaseException as error:
        delivery['error']=error;delivery['reason']='DELIVERY_NOT_ESTABLISHED'
    state['phase']='SEALED';return state
