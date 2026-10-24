"""Shared original CX/BD/policy; lower proof runs only after owned outer resume."""
import copy,hashlib,json,math,types
class IntegrationState(types.SimpleNamespace):
    @property
    def coordinate(self):return int(round(self.seed.raw.now*1000))
    @coordinate.setter
    def coordinate(self,value):self.seed.raw.now=value/1000
def c0_case_integrated():
    g=context_case();seed=integration_seed()
    g.policy,g.policy_raw,g.policy_pin=integration_policy(g)
    f=IntegrationState(g=g,seed=seed,clock_calls=[],events=[],effects=[],waits=[],published=[],
        read_count=0,security_error=None,startup_error=None,identity_error=None,publication_mode='READ',
        publication_error=None,late_read=False,late_progress=False,publish_error=None,publish_wrong=False,late_publish=False,finished=False)
    f.policy,f.policy_raw,f.policy_pin=g.policy,g.policy_raw,g.policy_pin
    f.lock=C0ProbeLock();memory=K.Memory();f.port=U.Exports(memory,f.lock);f.port.events=f.effects
    f.runtime=dict(memory=memory,layouts=g.layouts,kernel=f.port.kernel,crt=f.port.crt,lock=f.lock,budget=C._Budget())
    def now():f.clock_calls.append(f.coordinate);return f.coordinate
    f.provider=now
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
            f.events.append('actual-business-enter-after-outer-resume')
            floor=f.clock.snapshot()['lastObservedMs']
            produced=focus_business_case_integrated(prepared=g,policy=f.policy,provider=f.provider,receipt_floor=floor,seed=seed)
            if produced is not g:raise RuntimeError('ORIGINAL_PREPARED_BUSINESS_CONTEXT')
            g.run();g.outer()
            f.events.append('actual-business-returned-before-outer-eof')
            f.events.append('supplied-post-start-reader-completion')
            _group_finish_payloads(edge(),f.port,dict(stdout=b'actual-outer\x00\r\n',stderr=b'outer-diagnostic\n'))
            f.finished=True
            if f.late_progress:f.coordinate=f.policy.edge('outer')['workCutoffMs']
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
        literal=g.files[P._ROOT+'\\execution\\result.json'];row=json.loads(literal)
        if f.publication_mode=='ADVERSE':row['inner']['proof']['directFocusPortRetirement']['retirementConfirmed']=False
        raw=literal if f.publication_mode=='READ' else _encoded(row)
        f.business_input=c0_raw_file('business-before-port-return',raw)
        packet=dict(status='READ',raw=raw,expected_pin=dict(path=P._ROOT+'\\execution\\result.json',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()),context=g.business_context,
            artifacts=dict(journal=g.files[P._ROOT+'-image\\picker-parent-observation.jsonl'],stdout=g.bodies['electron'][0],stderr=g.bodies['electron'][1]),
            inner_bodies=g.bodies['inner'],child_bodies={n:g.bodies[n] for n in ('electron','ui')},
            producer=dict(roleBinding=g.context.role_binding('outer'),identity=dict(edge().identity),sourcePlanPin=copy.deepcopy(g.context.source_plan_pin)))
        if f.publication_mode=='FOREIGN_PRODUCER':packet['producer']['identity']['pid']=g.outer_row['identity']['pid']
        if f.late_read:f.coordinate=f.policy.edge('outer')['supervisionCutoffMs']
        return packet
    def publish(raw):
        f.events.append('publish-one-sealed-report');f.published.append(raw)
        f.publish_input=c0_raw_file('supplied-report-port-input',raw)
        if f.publish_error is not None:raise f.publish_error
        pin=dict(path=F._runtime_path('c0-report'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        if f.publish_wrong:pin['sha256']='f'*64
        if f.late_publish:f.coordinate=f.policy.edge('outer')['supervisionCutoffMs']
        return dict(kind=C0_DELIVERY_KIND,status='RECORDED',pin=pin)
    f.arguments=dict(context=g.context,policy=f.policy,clock=f.clock,runtime=f.runtime,components=g.components,
        security_factory=security,startup_factory=startup,observe_identity=observe,pump=pump,sleep=sleep,
        read_outer_publication=read,publish_report=publish)
    f.run=lambda:C0_ENTRY(**f.arguments)
    return f
