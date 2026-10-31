"""Original supplied T0 owner observation; no CLI/native admission."""
import hashlib,json
import ordinary_direct_context as CX
import ordinary_direct_capture_core as CORE
import ordinary_direct_fixed_plan as P
import ordinary_direct_caller_adapter as A
import ordinary_direct_timing_results_v1 as TR
import ordinary_external_execution_policy_v1 as XP
import ordinary_external_profile_v1 as F
import ordinary_business_domain_v1 as BD
import ordinary_supplied_c0_report_reader_v1 as C0READ

_STATE='_siren_supplied_t0_run_v1'
_FLAGS=('wholeSourceGatePassed','nativeEligibility','authenticatedTransport','sourceCustody','wholeAttempt',
    'innerClockMigrationComplete','t0SelfExitObserved','physicalCapture')
_PATH=F._runtime_path('terminal-observation')

def _need(v,why):
    if v is not True:raise ValueError('SUPPLIED_T0_V1:'+why)
def _raw(v):return json.dumps(v,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
def _diag(error):
    try:message=str(error);unavailable=False
    except BaseException:message='';unavailable=True
    return dict(type=type(error).__name__[:128],message=message[:4096],messageUnavailable=unavailable)
def _original_bodies(parent,edge,record):
    _need(parent.edges.get('owner') is edge and type(edge) is A._OwnedEdge,'ORIGINAL_OWNER_EDGE')
    if record['edge']['disposition']!='STAGED_FINISH':return None
    with edge.q.lock:
        ticket=edge.q.final_ticket
        _need(ticket is not None and ticket is edge.q.capture._final and ticket._owner is edge.q.capture and
            ticket._kind=='READBACK' and ticket._fields['settled'] is True and
            ticket._fields['phase']==record['edge']['finalReadback']['phase'],'ORIGINAL_SETTLED_OWNER_READBACK')
        rows=ticket._fields['rows'];_need(type(rows) is tuple and len(rows)==4,'FOUR_OWNER_BODY_POSITIONS')
        bodies=tuple(row['body'] for row in rows);_need(all(type(b) is bytes for b in bodies),'OWNER_BODY_BYTES')
        return bodies

def run_t0_supplied(*,context,policy,clock,runtime,components,security_factory,startup_factory,
    observe_identity,pump,sleep,read_c0_report,publish_observation):
    _need(type(context) is CX._ExternalExpectedContext and type(policy) is XP._ExecutionPolicyV1 and
        type(clock) is XP._ElapsedClockV1 and clock.parent=='T0' and clock.policy is policy,'EXACT_T0_CONTEXT_POLICY_CLOCK')
    _need(all(callable(p) for p in (security_factory,startup_factory,observe_identity,pump,sleep,
        read_c0_report,publish_observation)),'MANDATORY_EXPLICIT_PORTS')
    state=dict(kind='SIREN_SUPPLIED_T0_LOCAL_STATE_V1',context=context,parent=None,edge=None,phase='RESERVED',primary=None,
        secondary=[],normal_exit=None,timed_record=None,timed_raw=None,capture_bodies=None,lifecycle=None,
        report_packet=None,report_readback=None,receipt_floor_ms=None,clock_checks=[],cleanup='NO_EDGE_RETURNED',
        retained_inputs=[],retained_input_bytes=0,observation=None,observation_raw=None,observation_pin=None,
        delivery=dict(attempted=False,callReturned=False,accepted=False,error=None,reason='NOT_ATTEMPTED'))
    with context._claim_lock:
        _need(not hasattr(context,_STATE) and 'T0' not in context._parents,'LOCAL_RUN_ALREADY_RESERVED');setattr(context,_STATE,state)
    def secondary(label,error):state['secondary'].append((label,error))
    def check(label,phase):
        now=clock.now_ms();row=policy.edge('owner');stop=row['workCutoffMs' if phase=='WORK' else 'supervisionCutoffMs']
        state['clock_checks'].append(dict(label=label,phase=phase,nowMs=now,cutoffMs=stop))
        _need(now<stop,'ORIGINAL_'+phase+'_CUTOFF:'+label);return now
    def retain(label,body,maximum,applicable=True):
        _need(type(body) is bytes and len(body)<=maximum,'RETAINED_INPUT_BOUND:'+label)
        total=state['retained_input_bytes']+len(body);_need(total<=CORE._AGGREGATE_MAX,'PARTIAL_RUNTIME_RETENTION_LIMIT')
        ref=dict(label=label,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),applicable=applicable)
        state['retained_inputs'].append(dict(reference=ref,body=body));state['retained_input_bytes']=total
    operation='PARENT_CONSTRUCTION'
    try:
        parent=state['parent']=CX.from_external_execution_v1(supplied_context=context,policy=policy,clock=clock,runtime=runtime,components=components)
        operation='EDGE_CONSTRUCTION';edge=state['edge']=parent.new_edge('owner',P._FixedPlan('owner').argv)
        operation='SECURITY_FACTORY';check('before-security','WORK');security=security_factory(edge.q,edge.plan)
        state['receipt_floor_ms']=check('before-owner-acquisition','WORK')
        operation='ACQUIRE_START';edge.acquire_and_start(security,startup_factory,pump,sleep)
        operation='POST_START_PROGRESS';check('before-progress','WORK');pump(edge.q);check('after-progress','WORK')
        operation='ORIGINAL_C0_IDENTITY';edge.borrow_identity();handle=edge.original_process_handle();check('before-identity','WORK')
        observed=observe_identity(handle,expected_pid=edge.q.owner._creation['pid'],expected_image=edge.plan.application)
        check('after-identity','WORK');edge.remember_identity(observed)
        operation='ORIGINAL_C0_WAIT';state['normal_exit']=edge.wait_original_exit();state['phase']='WORK_COMPLETED'
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
            record=state['timed_record']=edge.project_timed_outcome();raw=state['timed_raw']=_raw(record)
            retain('owner.timed',raw,CORE._METADATA_MAX);bodies=state['capture_bodies']=_original_bodies(parent,edge,record)
            if bodies is not None:
                for name,body,maximum in zip(('stdout','stderr','archive','index'),bodies,
                    (CORE._STREAM_MAX,CORE._STREAM_MAX,CORE._ARCHIVE_MAX,CORE._METADATA_MAX)):
                    retain('owner.'+name,body,maximum,name not in ('archive','index'))
            _need(F._same(record['edge']['binding'],context.binding('owner')) and
                F._same(record['timing']['declaration']['roleBinding'],context.role_binding('owner')),'EXPECTED_OWNER_ROLE')
            state['lifecycle']=TR.read_external(raw,bodies,context,policy)
        except BaseException as error:secondary('CURRENT_OWNER_PROJECTION_READ',error)
    state['report_readback']=dict(status='NOT_READ',reason='OWNER_LIFECYCLE_NOT_CLEAN')
    if state['primary'] is None and not state['secondary'] and state['lifecycle'] is not None and state['lifecycle']['classification']=='CLEAN_INERT':
        state['report_readback']=dict(status='READ_ATTEMPTED',reason='OBSERVATION_UNRESOLVED')
        try:
            before=check('before-report-read','CLEANUP');packet=state['report_packet']=read_c0_report()
            if type(packet) is dict and type(packet.get('raw')) is bytes:retain('c0.report',packet['raw'],CORE._METADATA_MAX)
            check('after-report-read','CLEANUP')
            _need(type(packet) is dict and type(packet.get('status')) is str,'CLOSED_REPORT_PACKET')
            if packet['status']=='UNAVAILABLE':
                F._keys(packet,('status','reason'),'REPORT_UNAVAILABLE')
                _need(type(packet['reason']) is str and 0<len(packet['reason'])<=4096,'UNAVAILABLE_REASON');state['report_readback']=dict(packet)
            else:
                F._keys(packet,('status','raw','expected_pin','context','runtime_inputs','producer'),'REPORT_READ_PACKET')
                _need(packet['status']=='READ' and type(packet['context']) is BD._BusinessDomainContextV1 and packet['context']._context is context,'ORIGINAL_REPORT_CONTEXT')
                producer=packet['producer'];F._keys(producer,('roleBinding','identity','sourcePlanPin'),'DECLARED_C0_PRODUCER')
                _need(F._same(producer['roleBinding'],context.role_binding('owner')) and F._same(producer['identity'],edge.identity) and
                    F._same(producer['sourcePlanPin'],context.source_plan_pin),'ORIGINAL_DECLARED_C0_PRODUCER')
                inputs=packet['runtime_inputs'];_need(type(inputs) is tuple and len(inputs)<=len(C0READ._LABELS),'EXPLICIT_C0_RUNTIME_INPUTS')
                for index,row in enumerate(inputs):
                    F._keys(row,('label','body'),'C0_RUNTIME_INPUT')
                    label=C0READ._LABELS[index];_need(type(row['label']) is str and row['label']==label,'ORDERED_C0_RUNTIME_INPUT')
                    retain('c0-runtime.'+label,row['body'],C0READ._maximum(label),label not in C0READ._NA)
                answer=C0READ.read_supplied_c0_report(packet['raw'],expected_pin=packet['expected_pin'],context=context,
                    policy=policy,business_context=packet['context'],runtime_inputs=inputs)
                readback=dict(status='READ',producer=F._detach(producer),decision={k:v for k,v in answer.items() if k!='raw'})
                state['report_readback']=readback
                if answer['classification']=='SUPPLIED_C0_REPORT_COMPLETE':
                    retain('c0.report.rechecked',packet['raw'],CORE._METADATA_MAX)
                    receipt=F._load(packet['raw'])['clock']
                    _need(receipt['parent']=='C0' and receipt['originId']==policy.origin_id and
                        state['receipt_floor_ms']<=receipt['minimumObservedMs']<=receipt['lastObservedMs']<=before,
                        'ORIGINAL_T0_C0_RECEIPT_READ_ORDER')
                    readback['clockJoin']=dict(receivedFloorMs=state['receipt_floor_ms'],readStartedMs=before,reportClock=F._detach(receipt))
                check('after-report-revalidation','CLEANUP')
        except BaseException as error:
            state['report_readback']=dict(status='REFUSED_OR_UNAVAILABLE',reason='REPORT_OBSERVATION_RAISED',
                rawRetained=any(row['reference']['label']=='c0.report' for row in state['retained_inputs']))
            secondary('REPORT_OBSERVATION',error)
    attempt=None if parent is None else parent._attempts.get('owner')
    partial=None if attempt is None else dict(phase=attempt['phase'],available={n:attempt[n] is not None for n in ('timing','capture','owner','backend','coordinator','edge')})
    clean=(state['primary'] is None and not state['secondary'] and state['cleanup']=='RETURNED' and state['lifecycle'] is not None and
        state['lifecycle']['classification']=='CLEAN_INERT' and state['report_readback']['status']=='READ' and
        state['report_readback']['decision']['classification']=='SUPPLIED_C0_REPORT_COMPLETE' and 'clockJoin' in state['report_readback'])
    lifecycle=state['lifecycle'];available=lifecycle is not None and lifecycle['exitAvailable']
    observation=dict(schema=1,kind='SIREN_SUPPLIED_T0_OBSERVATION_V1',stage='SUPPLIED_TERMINAL_OBSERVATION_COMPLETE' if clean else 'SUPPLIED_T0_ADVERSE',
        evidenceKind='SUPPLIED_ORIGINAL_OWNER_LIFECYCLE',ownerRole=context.role_binding('owner'),policyPin=policy.reference(),clock=clock.snapshot(),
        clockChecks=list(state['clock_checks']),receiptFloorMs=state['receipt_floor_ms'],construction=partial,cleanup=state['cleanup'],
        primary=None if state['primary'] is None else dict(operation=state['primary'][0],error=_diag(state['primary'][1])),
        secondary=[dict(operation=n,error=_diag(e)) for n,e in state['secondary']],originalC0Identity=None if edge is None else F._detach(edge.identity),
        originalC0NormalExit=F._detach(state['normal_exit']),c0ExitAvailable=available,c0ExitCode=lifecycle['exitCode'] if available else None,
        lifecycle=F._detach(lifecycle),reportReadback=F._detach(state['report_readback']),
        requiredRuntimeInputs=[dict(row['reference']) for row in state['retained_inputs']],runtimeInputOccurrenceBytes=state['retained_input_bytes'],
        partialRetentionBudgetOnly=True,**{n:False for n in _FLAGS})
    state['observation']=observation
    try:
        sealed=_raw(observation);_need(len(sealed)<=CORE._METADATA_MAX,'SEALED_OBSERVATION_BOUND')
        _need(len(sealed)<=CORE._AGGREGATE_MAX-state['retained_input_bytes'],'PARTIAL_SEALED_RETENTION_LIMIT')
        state['observation_raw']=sealed;state['observation_pin']=dict(path=_PATH,bytes=len(sealed),sha256=hashlib.sha256(sealed).hexdigest())
    except BaseException as error:secondary('OBSERVATION_SEAL',error);return state
    delivery=state['delivery']
    try:
        check('before-observation-delivery','CLEANUP');delivery['attempted']=True
        receipt=publish_observation(state['observation_raw']);delivery['callReturned']=True;delivery['receipt']=receipt
        check('after-observation-delivery','CLEANUP');F._keys(receipt,('kind','status','pin'),'SUPPLIED_OBSERVATION_DELIVERY')
        _need(receipt['kind']=='SUPPLIED_T0_OBSERVATION_DELIVERY_V1' and receipt['status']=='RECORDED' and
            F._same(receipt['pin'],state['observation_pin']),'EXACT_SUPPLIED_OBSERVATION_RECEIPT')
        delivery['accepted']=True;delivery['reason']=None
    except BaseException as error:delivery['error']=error;delivery['reason']='DELIVERY_NOT_ESTABLISHED'
    state['phase']='SEALED';return state
