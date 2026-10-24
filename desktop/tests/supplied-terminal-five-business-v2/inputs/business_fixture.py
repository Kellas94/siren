"""Supplied V2 edge production starts before readiness; no legacy-result conversion."""
import copy,hashlib,json,math,types

def business_grouped_case_v2(*,payloads,provider,stack):
    g=context_case()
    if g.parents or g.context._parents or g.effect_events:raise RuntimeError('FRESH_UNCLAIMED_BUSINESS_CONTEXT')
    def no_legacy_parent(*args,**kwargs):raise RuntimeError('NO_LEGACY_PARENT_FACTORY_IN_BUSINESS_V2')
    g.parent=no_legacy_parent
    g.edges={};g.rows={};g.bodies={};g.exits={};g.secondary=[];g.io_events=[];g.order=[];g.namespaces={};g.clocks={};g.exports={};g.runtimes={}
    g.payloads=payloads;g.pids=dict(inner=99,electron=10,ui=20);g.births=dict(inner='123',electron=CC.iso_filetime('2026-10-19T10:00:00Z'),ui='456')
    g.files={P._ROOT+'\\capture-context.json':g.packet_inputs['context_raw'],P._ROOT+'\\capture-attempt-header.json':g.packet_inputs['header_raw']};g.read_errors={};g.provider_samples=[]
    g.streams_finished=set();g.prefix_consumed=[];g.inner_published=False;g.outer_published=False;g.port_hooks={};g.supplied_inner_exit=0
    policy,raw,pin=five_policy(g);v=json.loads(raw)
    for row,(i,w,s) in zip(v['edges'],[(0,19000,20000),(100,17500,18000),(200,15000,16000),(300,6000,9000),(300,5500,8500)]):row.update(issuedAtMs=i,workCutoffMs=w,supervisionCutoffMs=s)
    g.policy_raw=_encoded(v);g.policy_pin=dict(pin,bytes=len(g.policy_raw),sha256=hashlib.sha256(g.policy_raw).hexdigest())
    g.policy=XP._ExecutionPolicyV1(g.policy_raw,expected=policy.expected(),expected_pin=g.policy_pin,external_ceilings_ms=dict(owner=20000,outer=17900))
    def sampled():
        now=provider();g.provider_samples.append(now);return now
    g.original_provider=provider;g.clock_provider=sampled;stack.direct_components=g.components
    class SuppliedPath:
        def __init__(self,value):self.value=(value.value if type(value) is SuppliedPath else str(value)).replace('/','\\')
        def __str__(self):return self.value
        def __truediv__(self,part):return SuppliedPath(self.value+'\\'+str(part))
        @property
        def name(self):return self.value.rsplit('\\',1)[-1]
        def read_bytes(self):
            g.io_events.append(('body-read',self.value))
            if self.value in g.read_errors:raise g.read_errors[self.value]
            return g.files[self.value]
    g.Path=SuppliedPath
    def pin(path):
        body=g.files[str(path)];g.io_events.append(('pin',str(path)))
        return dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
    def read_bytes(path,maximum):
        body=SuppliedPath(path).read_bytes()
        if type(body) is not bytes or len(body)>maximum:raise RuntimeError('EXACT_BOUNDED_SUPPLIED_BODY')
        return body
    g.pin=pin;g.read_bytes=read_bytes
    def hook(name,*args):
        callback=g.port_hooks.get(name)
        if callback is not None:callback(*args)
    def namespace(parent):
        if parent in g.namespaces:return g.namespaces[parent]
        lock=C0ProbeLock();memory=K.Memory();exports=U.Exports(memory,lock);exports.events=g.effect_events
        runtime=dict(memory=memory,layouts=g.layouts,kernel=exports.kernel,crt=exports.crt,lock=lock,budget=C._Budget())
        floor=sampled() if parent=='outer' else g.clocks['outer'].snapshot()['lastObservedMs']
        if floor is None:raise RuntimeError('OBSERVED_PARENT_RECEIPT_FLOOR_REQUIRED')
        clock=XP._ElapsedClockV1(g.policy,parent,provider=sampled,origin_id=g.policy.origin_id,minimum_observed_ms=floor,lock=lock)
        ns=dict(need=CC.need,describe=CC.describe,k=CC,json=json,hashlib=hashlib,Path=SuppliedPath,
            ROOT=SuppliedPath(P._ROOT),OUT=SuppliedPath(P._ROOT+'\\execution'),JOURNAL=SuppliedPath(P._ROOT+'-image\\picker-parent-observation.jsonl'),
            PROBE='siren-ordinary-picker-cancel-v1',cancel=CANCEL,consumer=CONSUMER,focus_evidence=FEM,route_evidence=REM)
        exec(COMMON_GROUP_CODE,ns)
        actual=ns['bind_five_role_business_v2'](stack=stack,parent=parent,context=g.context,business_context=g.business_context,policy=g.policy,clock=clock,runtime=runtime,components=g.components)
        g.namespaces[parent]=ns;g.parents[parent]=actual;g.clocks[parent]=clock;g.exports[parent]=exports;g.runtimes[parent]=runtime
        def plain_pin(path):
            result=pin(path);hook('pin',parent,path,result);return result
        def plain_read_bytes(path,maximum):
            body=read_bytes(path,maximum);hook('read_bytes',parent,path,body);return body
        ns['_fixture_pin']=plain_pin;ns['_fixture_read_bytes']=plain_read_bytes
        return ns
    g.namespace=namespace
    for name in ('inner','electron','ui'):
        parent='outer' if name=='inner' else 'inner';namespace(parent);exports=g.exports[parent]
        edge=g.parents[parent].new_edge(name,g.command(name));g.edges[name]=edge
        def create(*args,child=name,port=exports):
            pi=args[-1];pi.hProcess=port.handle();pi.hThread=port.handle();pi.dwProcessId=g.pids[child];pi.dwThreadId=1000+g.pids[child];return 1
        exports.override['CreateProcessW']=[create]
        edge.acquire_and_start(K.Plain(),lambda q,plan:K.storage_for(q),_ready_readers,lambda seconds:None)
        if name=='electron':g.held_electron=g.runtimes['inner']['budget'].view()
        if name=='ui':g.held_both=g.runtimes['inner']['budget'].view()
    original_wait=g.exports['outer'].kernel['WaitForSingleObject'];inner_handle=g.edges['inner'].q.backend.handles['child.process'].cell.value
    def wait_inner(handle,timeout):
        if handle.value==inner_handle and not g.inner_published:raise RuntimeError('ORIGINAL_INNER_WAIT_BEFORE_RESULT_PUBLICATION')
        if handle.value==inner_handle:g.io_events.append(('supplied-original-inner-wait',timeout))
        return original_wait(handle,timeout)
    g.exports['outer'].kernel['WaitForSingleObject']=wait_inner
    original_exit=g.exports['outer'].kernel['GetExitCodeProcess']
    def supplied_exit(handle,result):
        if handle.value==inner_handle:result.value=g.supplied_inner_exit;return 1
        return original_exit(handle,result)
    g.exports['outer'].kernel['GetExitCodeProcess']=supplied_exit
    def finish(name):
        if name in g.streams_finished:raise RuntimeError('SINGLE_SUPPLIED_STREAM_COMPLETION')
        _group_finish_payloads(g.edges[name],g.exports['outer' if name=='inner' else 'inner'],g.payloads[name])
        if name=='electron':
            g.edges[name].committed_prefix(lambda b:g.prefix_consumed.append(b));g.edges[name].finish_endpoint_discovery()
        g.streams_finished.add(name);g.io_events.append(('supplied-stream-eof',name))
    g.finish_streams=finish
    def refresh():
        for name,edge in g.edges.items():
            timed=edge.project_timed_outcome();g.rows[name]=timed
            bodies=None if timed['edge']['disposition']!='STAGED_FINISH' else tuple(r['body'] for r in edge.q.final_ticket._fields['rows']);g.bodies[name]=bodies
            if bodies is not None:
                for role,body in zip(('stdout','stderr','archive','index'),bodies):
                    ref=timed['edge']['bodyAvailability'][role]['reference']
                    if ref is not None and ref['path'] not in g.files:g.files[ref['path']]=body
    g.refresh=refresh
    return g

def business_observe_v2(label,g,**extra):
    def error(e):return None if e is None else dict(type=type(e).__name__,message=str(e))
    def literal(value):
        if type(value) not in (bytes,bytearray):return None
        body=bytes(value);return dict(sourceType=type(value).__name__,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),hex=body.hex())
    def safe(value):
        if type(value) in (bytes,bytearray):return literal(value)
        if type(value) is dict:return {k:safe(v) for k,v in value.items()}
        if type(value) in (list,tuple):return [safe(v) for v in value]
        if value is None or type(value) in (str,int,float,bool):return value
        raise TypeError('EXPLICIT_BUSINESS_OBSERVATION_TYPE:'+type(value).__name__)
    calls={};identity_calls={}
    for parent,ns in g.namespaces.items():
        calls[parent]=[dict(operation=c['operation'],state=c['state'],beforeMs=c['beforeMs'],afterMs=c['afterMs'],returned=c['returned'],error=error(c['error']),
            resultValueType=type(c['value']).__name__,resultData=copy.deepcopy(c['value']) if type(c['value']) in (dict,list,str,int,float,bool) else None,
            resultLiteral=literal(c['value'])) for c in ns.get('_five_work_calls',[])]
        identity_calls[parent]=[dict(edge=c['edge'].plan.edge,handleDecimal=str(c['handle']),state=c['state'],beforeMs=c['beforeMs'],afterMs=c['afterMs'],returned=c['returned'],
            valueType=type(c['value']).__name__,value=None if type(c['value']) is not MODEL.ProcessIdentity else dict(pid=c['value'].pid,image=c['value'].image,createdFileTime=c['value'].created_filetime,running=c['value'].running),
            error=error(c['error'])) for c in ns.get('_five_identity_calls',[])]
    raw_inner=g.files.get(P._ROOT+'\\execution\\inner-result.json');raw_outer=g.files.get(P._ROOT+'\\execution\\result.json')
    SEMANTIC_OBSERVATIONS.append(dict(case='five-business-'+label,policyRawHex=g.policy_raw.hex(),policyPin=g.policy_pin,
        transportInputs={k:dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),hex=b.hex()) for k,b in g.packet_inputs.items() if k.endswith('_raw')},
        domains=g.business_context.snapshot(),innerRawHex=None if raw_inner is None else raw_inner.hex(),outerRawHex=None if raw_outer is None else raw_outer.hex(),
        rows=copy.deepcopy(g.rows),captureBodies={n:None if b is None else [dict(bytes=len(x),sha256=hashlib.sha256(x).hexdigest(),hex=x.hex()) for x in b] for n,b in g.bodies.items()},
        localInner=copy.deepcopy(getattr(g,'row',None)),localOuter=copy.deepcopy(getattr(g,'outer_row',None)),order=list(g.order),ioEvents=list(g.io_events),effects=list(g.effect_events),
        workCalls=calls,identityCalls=identity_calls,heldElectron=g.held_electron,heldBoth=g.held_both,providerSamples=list(g.provider_samples),
        prefixes=[dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),hex=b.hex()) for b in g.prefix_consumed],primary=error(g.primary),
        innerReadback=literal(getattr(g,'outer_env',{}).get('_five_inner_raw')),outerPrimary=error(getattr(g,'outer_primary',None)),actualNativePorts=False,physicalCapture=False,sourceCustody=False,wholeSourceGatePassed=False,wholeAttempt=False,innerClockMigrationComplete=False,**safe(extra)))
