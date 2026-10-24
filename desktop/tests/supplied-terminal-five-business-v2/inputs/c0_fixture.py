"""Actual C0-owned components and business producer with supplied exports only."""
import copy,hashlib,json,math,types
C0_RAW_FILES=[]

class C0ProbeLock:
    def __init__(self):self.depth=0;self.reentries=0
    def __enter__(self):
        if self.depth:self.reentries+=1;raise RuntimeError('C0_PROBE_LOCK_REENTRY')
        self.depth=1;return self
    def __exit__(self,*unused):self.depth=0

def c0_raw_file(label,body):
    path=OUTPUT_PATH/('c0-raw-'+str(len(C0_RAW_FILES))+'.bin')
    with path.open('xb') as stream:stream.write(body)
    pin=dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
    C0_RAW_FILES.append(pin);return dict(label=label,**pin)

def c0_case():
    g=focus_case();g.run();g.outer()
    if g.primary is not None:raise RuntimeError('SUPPLIED_BUSINESS_PRODUCER_NOT_POSITIVE')
    f=types.SimpleNamespace(g=g,coordinate=800,clock_calls=[],events=[],effects=[],waits=[],published=[],
        read_count=0,security_error=None,startup_error=None,identity_error=None,publication_mode='READ',
        publication_error=None,late_read=False,late_progress=False,publish_error=None,publish_wrong=False,late_publish=False,finished=False)
    expected=dict(sourceIdentityKind=g.context.source_identity_kind,sourcePlanPin=g.context.source_plan_pin,
        reviewPin=g.context.review_pin,roleBindings={n:g.context.role_binding(n) for n in ('owner','outer','inner','electron','ui')})
    value=dict(schema=1,kind='SIREN_EXTERNAL_EXECUTION_POLICY_V1',sourceIdentityKind=expected['sourceIdentityKind'],
        sourcePlanPin=expected['sourcePlanPin'],reviewPin=expected['reviewPin'],originId='e'*32,
        edges=[dict(roleBinding=expected['roleBindings'][n],issuedAtMs=i,workCutoffMs=w,supervisionCutoffMs=s)
            for n,(i,w,s) in zip(('owner','outer','inner','electron','ui'),[(0,5000,6000),(100,4500,5000),(200,3500,4000),(300,1000,2000),(300,1000,2000)])])
    f.policy_raw=_encoded(value);f.policy_pin=dict(path=P._ROOT+'\\capture-external-execution-policy-v1.json',bytes=len(f.policy_raw),sha256=hashlib.sha256(f.policy_raw).hexdigest())
    f.policy=XP._ExecutionPolicyV1(f.policy_raw,expected=expected,expected_pin=f.policy_pin,external_ceilings_ms=dict(owner=6000,outer=4900))
    f.lock=C0ProbeLock();memory=K.Memory();f.port=U.Exports(memory,f.lock);f.port.events=f.effects
    f.runtime=dict(memory=memory,layouts=g.layouts,kernel=f.port.kernel,crt=f.port.crt,lock=f.lock,budget=C._Budget())
    def now():f.clock_calls.append(f.coordinate);return f.coordinate
    f.clock=XP._ElapsedClockV1(f.policy,'C0',provider=now,origin_id=f.policy.origin_id,minimum_observed_ms=750,lock=f.lock)
    def create(*args):
        pi=args[-1];pi.hProcess=f.port.handle();pi.hThread=f.port.handle();pi.dwProcessId=777;pi.dwThreadId=1777;return 1
    f.port.override['CreateProcessW']=[create]
    original_wait=f.port.kernel['WaitForSingleObject']
    def wait(handle,timeout):f.waits.append(dict(handle=handle.value,timeoutMs=timeout));return original_wait(handle,timeout)
    f.port.kernel['WaitForSingleObject']=wait
    def edge():return g.context._parents['C0'].edges['outer']
    def security(q,plan):
        f.events.append('security')
        if f.security_error is not None:raise f.security_error
        return K.Plain()
    def startup(q,plan):
        f.events.append('startup')
        if f.startup_error is not None:raise f.startup_error
        return K.storage_for(q)
    def pump(q):
        armed=all(r.armed for r in q.readers.values());_ready_readers(q)
        if armed and not f.finished and not edge().finalization_started:
            f.events.append('supplied-post-start-reader-completion')
            _group_finish_payloads(edge(),f.port,dict(stdout=b'actual-outer\x00\r\n',stderr=b'outer-diagnostic\n'))
            f.finished=True
            if f.late_progress:f.coordinate=4500
    def observe(handle,*,expected_pid,expected_image):
        f.events.append('observe-original-outer')
        if handle!=edge().original_process_handle():raise RuntimeError('UNDECLARED_ORIGINAL_HANDLE')
        if f.identity_error is not None:raise f.identity_error
        return dict(pid=expected_pid,image=expected_image,createdFileTime='999')
    def sleep(seconds):f.coordinate+=max(1,math.ceil(seconds*1000))
    def read():
        f.read_count+=1;f.events.append('read-publication-after-finalization')
        if not edge().finalization_complete:raise RuntimeError('PUBLICATION_READ_BEFORE_OWNED_FINALIZATION')
        if f.publication_error is not None:raise f.publication_error
        if f.publication_mode=='BOOL':return True
        if f.publication_mode=='UNAVAILABLE':return dict(status='UNAVAILABLE',reason='explicit supplied missing publication')
        row=copy.deepcopy(g.outer_row)
        if f.publication_mode=='ADVERSE':row['inner']['proof']['directFocusPortRetirement']['retirementConfirmed']=False
        raw=(json.dumps(row,indent=2,ensure_ascii=True)+'\n').encode('ascii')
        f.business_input=c0_raw_file('business-before-port-return',raw)
        packet=dict(status='READ',raw=raw,expected_pin=dict(path=P._ROOT+'\\execution\\result.json',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()),context=g.business_context,
            artifacts=dict(journal=g.files[P._ROOT+'-image\\picker-parent-observation.jsonl'],stdout=g.bodies['electron'][0],stderr=g.bodies['electron'][1]),
            inner_bodies=g.bodies['inner'],child_bodies={n:g.bodies[n] for n in ('electron','ui')},
            producer=dict(roleBinding=g.context.role_binding('outer'),identity=dict(edge().identity),sourcePlanPin=copy.deepcopy(g.context.source_plan_pin)))
        if f.publication_mode=='FOREIGN_PRODUCER':packet['producer']['identity']['pid']=g.outer_row['identity']['pid']
        if f.late_read:f.coordinate=5000
        return packet
    def publish(raw):
        f.events.append('publish-one-sealed-report');f.published.append(raw)
        f.publish_input=c0_raw_file('supplied-report-port-input',raw)
        if f.publish_error is not None:raise f.publish_error
        pin=dict(path=F._runtime_path('c0-report'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        if f.publish_wrong:pin['sha256']='f'*64
        if f.late_publish:f.coordinate=5000
        return dict(kind='SUPPLIED_C0_REPORT_DELIVERY_V1',status='RECORDED',pin=pin)
    f.arguments=dict(context=g.context,policy=f.policy,clock=f.clock,runtime=f.runtime,components=g.components,
        security_factory=security,startup_factory=startup,observe_identity=observe,pump=pump,sleep=sleep,
        read_outer_publication=read,publish_report=publish)
    f.run=lambda:C0RUN.run_c0_supplied(**f.arguments)
    return f

def c0_observe(label,f,state):
    retained=[]
    for row in state['retained_inputs']:retained.append(dict(reference=dict(row['reference']),file=c0_raw_file('retained:'+row['reference']['label'],row['body'])))
    sealed=None if state['report_raw'] is None else c0_raw_file('retained-sealed-report',state['report_raw'])
    semantic_observe(label,f.g,c0=dict(report=state['report'],sealed=sealed,reportPin=state['report_pin'],
        retainedInputs=retained,retainedInputBytes=state['retained_input_bytes'],policyRawHex=f.policy_raw.hex(),policyPin=f.policy_pin,
        delivery={k:(None if v is None else C0RUN._diagnostic(v)) if k=='error' else v for k,v in state['delivery'].items()},
        timedRecord=state['timed_record'],lifecycle=state['lifecycle'],cleanup=state['cleanup'],phase=state['phase'],
        primary=None if state['primary'] is None else dict(operation=state['primary'][0],error=C0RUN._diagnostic(state['primary'][1])),
        secondary=[dict(operation=k,error=C0RUN._diagnostic(v)) for k,v in state['secondary']],events=list(f.events),effects=list(f.effects),waits=list(f.waits),
        clockCalls=list(f.clock_calls),lockReentries=f.lock.reentries,publicationReads=f.read_count,publishCalls=len(f.published),
        businessInput=getattr(f,'business_input',None),publishInput=getattr(f,'publish_input',None)))
