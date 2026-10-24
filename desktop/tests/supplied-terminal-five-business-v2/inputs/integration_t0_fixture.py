"""T0 invokes the actual C0/business chain at its supplied owned scheduling point."""
def t0_case_integrated():
    c0=c0_case_integrated()
    f=types.SimpleNamespace(c0=c0,g=c0.g,events=[],effects=[],waits=[],inline_started=False,inline_calls=0,c0_state=None,
        owner_drained=False,missing_eof=False,late_inline=False,read_count=0,read_mode='READ',late_read=False,
        security_error=None,startup_error=None,identity_error=None,read_error=None,publish_error=None,publish_wrong=False,
        late_publish=False,published=[],transport=[],provider_calls=[],clock_error=None,clock_error_calls=[],
        fail_clock=False,fail_clock_after_read=False,c0_floor_delta=0,c0_skew=0,observed_code=0)
    original_provider=c0.clock._provider
    def provider():
        if f.fail_clock:
            f.clock_error_calls.append('provider-failure');raise f.clock_error
        value=original_provider();f.provider_calls.append(value);return value
    f.provider=provider;f.lock=C0ProbeLock();memory=K.Memory();f.port=U.Exports(memory,f.lock);f.port.events=f.effects
    f.runtime=dict(memory=memory,layouts=f.g.layouts,kernel=f.port.kernel,crt=f.port.crt,lock=f.lock,budget=C._Budget())
    f.clock=XP._ElapsedClockV1(c0.policy,'T0',provider=provider,origin_id=c0.policy.origin_id,minimum_observed_ms=750,lock=f.lock)
    def edge():return f.g.context._parents['T0'].edges['owner']
    def create(*args):
        pi=args[-1];pi.hProcess=f.port.handle();pi.hThread=f.port.handle();pi.dwProcessId=888;pi.dwThreadId=1888;return 1
    f.port.override['CreateProcessW']=[create]
    original_wait=f.port.kernel['WaitForSingleObject']
    def wait(handle,timeout):f.waits.append(dict(handle=handle.value,timeoutMs=timeout));return original_wait(handle,timeout)
    f.port.kernel['WaitForSingleObject']=wait
    def exit_code(handle,cell):cell.value=f.observed_code;return 1
    f.port.kernel['GetExitCodeProcess']=exit_code
    def security(q,plan):
        f.events.append('owner-security')
        if f.security_error is not None:raise f.security_error
        return K.Plain()
    def startup(q,plan):
        if f.startup_error is not None:raise f.startup_error
        return K.storage_for(q)
    def pump(q):
        armed=all(r.armed for r in q.readers.values());_ready_readers(q)
        if armed and not f.inline_started and not edge().finalization_started:
            f.inline_started=True;f.inline_calls+=1;f.events.append('inline-c0-enter-after-owner-resume')
            root=getattr(f.g.context,T0_STATE_KEY);floor=root['receipt_floor_ms']+f.c0_floor_delta
            if c0.clock.snapshot()['lastObservedMs'] is not None:raise RuntimeError('C0_CLOCK_ALREADY_CONSUMED_BEFORE_HANDOFF')
            chosen=provider if not f.c0_skew else lambda:provider()+f.c0_skew
            c0.provider=chosen
            c0.clock=XP._ElapsedClockV1(c0.policy,'C0',provider=chosen,origin_id=c0.policy.origin_id,minimum_observed_ms=floor,lock=c0.lock)
            c0.arguments['clock']=c0.clock;f.c0_state=c0.run();f.events.append('inline-c0-returned-with-sealed-report')
            if f.c0_state['report_raw'] is None:raise RuntimeError('INLINE_C0_REPORT_UNAVAILABLE')
            f.events.append('owner-stderr-suffix-after-c0-seal')
            owner_payloads(edge(),f.port,dict(stdout=b'c0-started\n',stderr=b'before-report\nlate-after-report\x00\r\n'),f.missing_eof)
            f.owner_drained=not f.missing_eof
            if f.late_inline:c0.coordinate=c0.policy.edge('owner')['workCutoffMs']
    def observe(handle,*,expected_pid,expected_image):
        if handle!=edge().original_process_handle():raise RuntimeError('ORIGINAL_C0_HANDLE_MISMATCH')
        if f.identity_error is not None:raise f.identity_error
        return dict(pid=expected_pid,image=expected_image,createdFileTime='2999')
    def sleep(seconds):c0.coordinate+=max(1,math.ceil(seconds*1000))
    def read_report():
        f.read_count+=1;f.events.append('report-read-after-owner-finalization')
        if not edge().finalization_complete:raise RuntimeError('REPORT_BEFORE_OWNER_FINALIZATION')
        if f.read_error is not None:raise f.read_error
        if f.read_mode=='BOOL':return True
        if f.read_mode=='UNAVAILABLE':return dict(status='UNAVAILABLE',reason='explicit supplied readback unavailable')
        # Read owned port-created bytes; this is test transport, not actor custody.
        source=c0.publish_input;raw=OUTPUT_PATH.joinpath(source['path']).read_bytes()
        if len(raw)!=source['bytes'] or hashlib.sha256(raw).hexdigest()!=source['sha256']:raise RuntimeError('OWNED_PORT_REPORT_DRIFT')
        if f.read_mode=='TAMPER':
            report=json.loads(raw);report['clock']['minimumObservedMs']-=1;raw=_encoded(report)
        f.transport.append(c0_raw_file('t0-report-port-before-return',raw))
        inputs=[]
        for row in f.c0_state['retained_inputs']:
            saved=c0_raw_file('t0-runtime-port-before-return',row['body']);f.transport.append(saved)
            body=OUTPUT_PATH.joinpath(saved['path']).read_bytes()
            if len(body)!=saved['bytes'] or hashlib.sha256(body).hexdigest()!=saved['sha256']:raise RuntimeError('OWNED_RUNTIME_PORT_DRIFT')
            inputs.append(dict(label=row['reference']['label'],body=body))
        if f.read_mode=='REORDER':inputs[-1],inputs[-2]=inputs[-2],inputs[-1]
        producer=dict(roleBinding=f.g.context.role_binding('owner'),identity=dict(edge().identity),sourcePlanPin=copy.deepcopy(f.g.context.source_plan_pin))
        if f.read_mode=='FOREIGN_ID':producer['identity']=dict(f.c0_state['report']['originalOuterIdentity'])
        if f.read_mode=='FOREIGN_ROLE':producer['roleBinding']=f.g.context.role_binding('outer')
        packet=dict(status='READ',raw=raw,expected_pin=dict(path=F._runtime_path('c0-report'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()),context=f.g.business_context,runtime_inputs=tuple(inputs),producer=producer)
        if f.fail_clock_after_read:f.fail_clock=True
        if f.late_read:c0.coordinate=c0.policy.edge('owner')['supervisionCutoffMs']
        return packet
    def publish(raw):
        f.events.append('publish-one-t0-observation');f.published.append(raw)
        f.publish_input=c0_raw_file('t0-observation-port-input',raw)
        if f.publish_error is not None:raise f.publish_error
        pin=dict(path=F._runtime_path('terminal-observation'),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        if f.publish_wrong:pin['sha256']='f'*64
        if f.late_publish:c0.coordinate=c0.policy.edge('owner')['supervisionCutoffMs']
        return dict(kind=T0_DELIVERY_KIND,status='RECORDED',pin=pin)
    f.arguments=dict(context=f.g.context,policy=c0.policy,clock=f.clock,runtime=f.runtime,components=f.g.components,
        security_factory=security,startup_factory=startup,observe_identity=observe,pump=pump,sleep=sleep,
        read_c0_report=read_report,publish_observation=publish)
    f.run=lambda:T0_ENTRY(**f.arguments);return f
