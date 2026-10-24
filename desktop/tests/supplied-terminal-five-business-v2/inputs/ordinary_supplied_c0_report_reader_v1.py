"""Independent supplied positive C0 report revalidation; no IO or capabilities."""
import hashlib
import ordinary_direct_context as CX
import ordinary_direct_capture_core as CORE
import ordinary_direct_fixed_plan as P
import ordinary_direct_results as DX
import ordinary_direct_timing_results_v1 as TR
import ordinary_external_execution_policy_v1 as XP
import ordinary_external_profile_v1 as F
import ordinary_business_domain_v1 as BD
import ordinary_business_publication_reader_v1 as PUB

_FLAGS=('wholeSourceGatePassed','nativeEligibility','authenticatedTransport','sourceCustody','wholeAttempt',
    'innerClockMigrationComplete','c0SelfExitObserved','c0FinalStreamsObserved')
_ROOT=('schema','kind','stage','outerRole','policyPin','clock','clockChecks','primary','secondary','construction',
    'cleanup','originalOuterIdentity','originalOuterNormalExit','lifecycle','publication','requiredRuntimeInputs',
    'runtimeInputOccurrenceBytes','partialRetentionBudgetOnly')+_FLAGS
_LABELS=('outer.timed',)+tuple('outer.'+n for n in ('stdout','stderr','archive','index'))+('business.raw',)+tuple(
    'business.'+edge+'.'+n for edge in ('inner','electron','ui') for n in ('stdout','stderr','archive','index'))+tuple(
    'business.artifact.'+n for n in ('journal','stdout','stderr'))
_NA={p+'.'+n for p in ('outer','business.inner','business.ui') for n in ('archive','index')}
_CHECKS=(('before-security','WORK'),('after-security','WORK'),('before-progress','WORK'),('after-progress','WORK'),
    ('before-identity','WORK'),('after-identity','WORK'),('before-publication-read','CLEANUP'),
    ('after-publication-read','CLEANUP'),('after-publication-semantics','CLEANUP'))

def _need(v,why):
    if v is not True:raise ValueError('C0_REPORT_READER_V1:'+why)
def _uint(v,maximum=0xfffffffe):return type(v) is int and 0<=v<=maximum
def _diag(v):
    F._keys(v,('operation','error'),'C0_DIAGNOSTIC')
    _need(type(v['operation']) is str and 0<len(v['operation'])<=128,'DIAGNOSTIC_OPERATION')
    e=v['error'];F._keys(e,('type','message','messageUnavailable'),'C0_ERROR')
    _need(type(e['type']) is str and 0<len(e['type'])<=128 and type(e['message']) is str and len(e['message'])<=4096 and
        type(e['messageUnavailable']) is bool,'BOUNDED_ERROR_DATA')
def _maximum(label):
    if label=='business.raw':return PUB._PUBLICATION_MAX
    if label=='business.artifact.journal':return 11264
    if label.endswith(('.stdout','.stderr')):return CORE._STREAM_MAX
    if label.endswith('.archive'):return CORE._ARCHIVE_MAX
    return CORE._METADATA_MAX

def read_supplied_c0_report(raw,*,expected_pin,context,policy,business_context,runtime_inputs):
    _need(type(raw) is bytes and 0<len(raw)<=CORE._METADATA_MAX,'REPORT_LITERAL_BOUND')
    _need(type(context) is CX._ExternalExpectedContext and type(policy) is XP._ExecutionPolicyV1 and
        type(business_context) is BD._BusinessDomainContextV1 and business_context._context is context,'EXACT_EXPECTED_CONTEXTS')
    DX._external_policy_context(context,policy);domains=business_context.snapshot()
    actual=dict(path=F._runtime_path('c0-report'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
    result=dict(schema=1,kind='SUPPLIED_C0_REPORT_REVALIDATION_V1',classification='RAW_REPORT_NOT_COMPLETE',
        reason='REPORT_LITERAL_OR_SCHEMA_REFUSED',raw=raw,reportPin=actual,claimedStage=None,lifecycle=None,
        businessDecision=None,missingPositiveInputs=list(_LABELS),domains=domains,**{k:False for k in _FLAGS})
    try:
        F._literal_pin(expected_pin,actual['path'],raw)
        report=F._load(raw);F._version(report,_ROOT,'SIREN_SUPPLIED_C0_REPORT_V1')
        _need(report['stage'] in ('SUPPLIED_C0_OBSERVATION_COMPLETE','SUPPLIED_C0_ADVERSE'),'RECOGNIZED_REPORT_STAGE')
        result['claimedStage']=report['stage']
        _need(all(report[k] is False for k in _FLAGS) and report['partialRetentionBudgetOnly'] is True,'NO_REPORT_AUTHORITY')
        _need(F._same(report['outerRole'],context.role_binding('outer')) and F._same(report['policyPin'],policy.reference()),'ORIGINAL_ROLE_POLICY_JOIN')
        if report['primary'] is not None:_diag(report['primary'])
        _need(type(report['secondary']) is list and len(report['secondary'])<=4096,'SECONDARY_DIAGNOSTIC_ROSTER')
        for error in report['secondary']:_diag(error)
        construction=report['construction']
        if construction is not None:
            F._keys(construction,('phase','available'),'CONSTRUCTION_SUMMARY')
            _need(construction['phase'] in ('RESERVED','CONSTRUCTION_FAILED','ROOTED'),'CONSTRUCTION_PHASE')
            F._keys(construction['available'],('timing','capture','owner','backend','coordinator','edge'),'CONSTRUCTION_AVAILABILITY')
            _need(all(type(v) is bool for v in construction['available'].values()),'TYPED_CONSTRUCTION_AVAILABILITY')
        _need(report['cleanup'] in ('NO_EDGE_RETURNED','ATTEMPTED','RETURNED','RETURNED_INCOMPLETE','RAISED'),'CLEANUP_AVAILABILITY')
        clock=report['clock'];F._keys(clock,('kind','parent','originId','minimumObservedMs','lastObservedMs','clockUnavailable',
            'nativeEligibility','clockAuthenticated','sourceCustody','wholeAttempt'),'C0_CLOCK_RECEIPT')
        window=policy.edge('outer')
        _need(clock['kind']=='SIREN_EXTERNAL_CLOCK_RECEIPT_V1' and clock['parent']=='C0' and clock['originId']==policy.origin_id and
            _uint(clock['minimumObservedMs']) and clock['minimumObservedMs']>=window['issuedAtMs'] and type(clock['clockUnavailable']) is bool and
            (clock['lastObservedMs'] is None or _uint(clock['lastObservedMs']) and clock['lastObservedMs']>=clock['minimumObservedMs']) and
            all(clock[k] is False for k in ('nativeEligibility','clockAuthenticated','sourceCustody','wholeAttempt')),'ORIGINAL_C0_CLOCK')
        checks=report['clockChecks'];_need(type(checks) is list and len(checks)<=len(_CHECKS),'BOUNDED_ORIGINAL_CLOCK_CHECKS')
        last=clock['minimumObservedMs']
        for row,(label,phase) in zip(checks,_CHECKS):
            F._keys(row,('label','phase','nowMs','cutoffMs'),'CLOCK_CHECK')
            stop=window['workCutoffMs' if phase=='WORK' else 'supervisionCutoffMs']
            _need(row['label']==label and row['phase']==phase and type(row['cutoffMs']) is int and row['cutoffMs']==stop and
                _uint(row['nowMs']) and row['nowMs']>=last,'ORIGINAL_ORDERED_CLOCK_CHECK')
            last=row['nowMs']
        _need(not checks or clock['lastObservedMs'] is not None and clock['lastObservedMs']>=last,'RETAIN_LATEST_C0_COORDINATE')
        refs=report['requiredRuntimeInputs']
        _need(type(refs) is list and len(refs)<=len(_LABELS) and type(runtime_inputs) is tuple and len(runtime_inputs)==len(refs),'EXACT_REQUIRED_INPUT_ROSTER')
        bodies={};total=0
        for label,ref,supplied in zip(_LABELS,refs,runtime_inputs):
            F._keys(ref,('label','bytes','sha256','applicable'),'RUNTIME_INPUT_REFERENCE')
            F._keys(supplied,('label','body'),'ACTUAL_RUNTIME_INPUT')
            body=supplied['body'];maximum=_maximum(label)
            _need(type(ref['label']) is str and type(supplied['label']) is str and ref['label']==supplied['label']==label and type(body) is bytes and len(body)<=maximum and
                type(ref['bytes']) is int and ref['bytes']==len(body) and F._hex(ref['sha256'],64) and
                hashlib.sha256(body).hexdigest()==ref['sha256'] and ref['applicable'] is (label not in _NA) and
                (label not in _NA or body==b''),'LITERAL_ORDERED_INPUT_POSITION')
            total+=len(body);_need(total<=CORE._AGGREGATE_MAX,'PARTIAL_INPUT_OCCURRENCE_LIMIT');bodies[label]=body
        _need(type(report['runtimeInputOccurrenceBytes']) is int and report['runtimeInputOccurrenceBytes']==total and
            len(raw)<=CORE._AGGREGATE_MAX-total,'EXACT_PARTIAL_OCCURRENCE_SUM')
        result['missingPositiveInputs']=list(_LABELS[len(refs):])
        if report['stage']=='SUPPLIED_C0_ADVERSE':
            result['reason']='CLAIMED_ADVERSE_RAW_PRESERVED';return result
        result['reason']='POSITIVE_REPORT_REVALIDATION_REFUSED'
        _need(len(refs)==len(_LABELS) and report['primary'] is None and report['secondary']==[] and report['cleanup']=='RETURNED' and
            construction is not None and construction['phase']=='ROOTED' and all(construction['available'].values()) and
            len(checks)==len(_CHECKS) and clock['clockUnavailable'] is False and clock['lastObservedMs'] is not None and
            clock['lastObservedMs']<window['supervisionCutoffMs'] and all(row['nowMs']<row['cutoffMs'] for row in checks),'COMPLETE_ORIGINAL_REPORT_REQUIREMENTS')
        outer_bodies=tuple(bodies['outer.'+n] for n in ('stdout','stderr','archive','index'))
        lifecycle=TR.read_external(bodies['outer.timed'],outer_bodies,context,policy)
        result['lifecycle']=lifecycle
        _need(lifecycle['classification']=='CLEAN_INERT' and F._same(lifecycle,report['lifecycle']),'RECOMPUTED_OUTER_LIFECYCLE')
        timed=F._load(bodies['outer.timed']);edge=timed['edge']
        _need(F._same(edge['binding'],context.binding('outer')) and
            F._same(timed['timing']['declaration']['roleBinding'],context.role_binding('outer')),'EXPECTED_ORIGINAL_OUTER_ROLE')
        original_clock=edge['execution']['clockReceipt']
        _need(clock['parent']==original_clock['parent']=='C0' and
            clock['originId']==original_clock['originId']==policy.origin_id and
            clock['minimumObservedMs']==original_clock['minimumObservedMs'],'ORIGINAL_CLOCK_PARENT_ORIGIN_FLOOR')
        projected=(timed['timing']['lastObservedMs'],original_clock['lastObservedMs'])
        _need(all(_uint(sample) for sample in projected) and
            all(checks[5]['nowMs']<=sample<=checks[6]['nowMs']<=clock['lastObservedMs'] for sample in projected),
            'WORK_PROJECTION_PUBLICATION_SNAPSHOT_ORDER')
        _need(F._same(edge['identity'],report['originalOuterIdentity']),'ORIGINAL_OUTER_IDENTITY')
        DX.join_normal_exit(report['originalOuterNormalExit'],edge,context)
        publication=report['publication'];F._keys(publication,('status','producer','decision'),'COMPLETE_PUBLICATION')
        _need(publication['status']=='READ','PUBLICATION_READ_AVAILABLE')
        producer=publication['producer'];F._keys(producer,('roleBinding','identity','sourcePlanPin'),'DECLARED_OUTER_PRODUCER')
        _need(F._same(producer['roleBinding'],context.role_binding('outer')) and F._same(producer['identity'],edge['identity']) and
            F._same(producer['sourcePlanPin'],context.source_plan_pin),'ORIGINAL_DECLARED_OUTER_PRODUCER')
        business=bodies['business.raw'];business_pin=dict(path=P._ROOT+'\\execution\\result.json',bytes=len(business),sha256=hashlib.sha256(business).hexdigest())
        answer=PUB.read_outer_publication(business,expected_pin=business_pin,context=business_context,
            artifacts={n:bodies['business.artifact.'+n] for n in ('journal','stdout','stderr')},
            inner_bodies=tuple(bodies['business.inner.'+n] for n in ('stdout','stderr','archive','index')),
            child_bodies={e:tuple(bodies['business.'+e+'.'+n] for n in ('stdout','stderr','archive','index')) for e in ('electron','ui')})
        decision={k:v for k,v in answer.items() if k!='raw'};result['businessDecision']=decision
        _need(decision['classification']=='SUPPLIED_BUSINESS_COMPLETE' and F._same(decision,publication['decision']),'RECOMPUTED_BUSINESS_SEMANTICS')
        result['classification']='SUPPLIED_C0_REPORT_COMPLETE';result['reason']=None
    except (ValueError,TypeError,KeyError,IndexError,RecursionError,OverflowError):pass
    return result
