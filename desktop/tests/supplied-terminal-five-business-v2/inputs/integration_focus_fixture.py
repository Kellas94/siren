"""Fresh supplied proof production over explicit original-coordinate parents."""
import copy,hashlib,json,types

def integration_seed():
    parent_ns=dict(k=CC,e=CANCEL,R=LOGICAL_ROOT,types=types,json=json)
    exec(PARENT_SEED_CODE,parent_ns)
    seed_ns=dict(PARENT=types.SimpleNamespace(fixture=parent_ns['parent_seed']),
        nf=NATIVE_WORLD,guardfixture=GUARD_WORLD,helpers=GUARD_PORTS,_worlds=_focus_worlds,
        FNATIVE=FNATIVE,CF=CF,ctypes=ctypes,types=types,json=json,copy=copy,
        LOGICAL_ROOT=LOGICAL_ROOT,W=WORK_PATH,
        OPERATIVE=types.SimpleNamespace(__unused=None))
    # This port supplies the already frozen prefocus bytes. The selected seed's
    # path read cannot access disk or select another source.
    class PrefocusPort:
        def __truediv__(self,name):
            if name!='prefocus-fixture.json':raise RuntimeError('EXACT_PREFOCUS_SEED_BODY')
            return self
        def read_bytes(self):return PREFOCUS_BODY
    seed_ns['OPERATIVE']=PrefocusPort()
    exec(FOCUS_SEED_CODE,seed_ns);s=seed_ns['focus_seed']()
    # Keep the actual receipt producer's nonempty stdout and use harmless
    # nonempty stderr, accepted independently by the actual receipt consumer.
    s.artifacts['stderr']=b'supplied renderer diagnostic\n'
    s.raw.now=1.0
    return s

def focus_business_case_integrated(*,prepared,policy,provider,receipt_floor,seed):
    s=seed
    payloads=dict(inner=dict(stdout=b'inner-route-output\n',stderr=b'inner-route-diagnostic\n'),
        electron={role:s.artifacts[role] for role in ('stdout','stderr')},
        ui=dict(stdout=b'ui-route-output\n',stderr=b'ui-route-diagnostic\n'))
    clocks=[];bindings=[];g=None
    def make_clock():
        g.order.append('readiness');clock=CLOCK._Fuse(s.raw);clocks.append(clock);return clock
    def create_cancel(facade,binding,clock):
        if facade is not s.facade or binding is not bindings[0] or clock is not clocks[0]:raise RuntimeError('ORIGINAL_SHARED_FOCUS_C1_OBJECTS')
        g.order.append('c1')
        if g.before_c1 is not None:g.before_c1()
        return FOREGROUND.create_observed_escape_cancel(facade,binding,clock)
    stack=types.SimpleNamespace(observer=ADAPTER,model=MODEL,clock=types.SimpleNamespace(create_dialog_clock=make_clock),
        readiness=READINESS,foreground=types.SimpleNamespace(create_observed_escape_cancel=create_cancel),focus_policy=FOCUS)
    g=business_grouped_case_integrated(payloads=payloads,provider=provider,stack=stack,prepared=prepared,supplied_policy=policy,receipt_floor=receipt_floor)
    g.seed=s;g.skip_finish=set()
    def now():return g.clocks['inner'].now_ms()/1000
    def sleep(seconds):s.raw.now+=seconds
    time_port=types.SimpleNamespace(monotonic=now,sleep=sleep)
    s.identity.update(pid=g.pids['electron'],image=g.edges['electron'].plan.application,
                      createdFileTime=g.births['electron'])
    s.controller.update(pid=g.pids['inner'],image=g.edges['inner'].plan.application,
                        createdFileTime=g.births['inner'])
    for event in s.session['events']:event['processIdentity'].update(pid=s.identity['pid'],path=s.identity['image'])
    # Supplied ABI lookup table only. Do not consume the actual one-use identity
    # lease before held_direct_identity borrows it through the maintained helper.
    original_handles={g.edges[name].q.backend.handles['child.process'].cell.value:name for name in ('electron','ui')}
    g.identity_calls=[];g.identity_fault=None
    def original_name(handle):
        if handle not in original_handles:raise RuntimeError('UNSUPPLIED_ORIGINAL_HANDLE')
        return original_handles[handle]
    def value(handle,field):
        name=original_name(handle);g.identity_calls.append((name,field,str(handle)))
        result=dict(pid=g.pids[name],image=g.edges[name].plan.application,birth=g.births[name])[field]
        if g.identity_fault==(name,field):return result+1 if type(result) is int else str(result)+'x'
        return result
    def times(handle,created,*unused):
        ticks=int(value(handle,'birth'));created._obj.low=ticks&0xffffffff;created._obj.high=ticks>>32;return 1
    def image(handle,flags,buffer,length):
        text=value(handle,'image');buffer.value=text;length._obj.value=len(text);return 1
    s.facade._fn.update(GetProcessId=lambda handle:value(handle,'pid'),GetProcessTimes=times,
        QueryFullProcessImageNameW=image,GetExitCodeProcess=lambda handle,result:(setattr(result._obj,'value',259),1)[1],
        WaitForSingleObject=lambda handle,timeout:(original_name(handle),258)[1])
    cns=g.namespace('inner');c=types.SimpleNamespace(**cns)
    # Function globals remain cns; changing only a SimpleNamespace copy would
    # leave the actual helper closure unbound.
    cns.update(cancel=CANCEL,consumer=CONSUMER,focus_evidence=FEM,route_evidence=REM,time=time_port)
    cns.update(DATA=g.Path(P._ROOT+'\\data'),ENDPOINT_JOURNAL=g.Path(P._ROOT+'-image\\terminal-request-endpoint.jsonl'))
    g.files[str(cns['JOURNAL'])]=s.artifacts['journal']
    g.files[str(cns['ENDPOINT_JOURNAL'])]=s.encode_rows(s.endpoint)
    state=dict(provider=False)
    def hook(operation,parent,path,value):
        callback=g.port_hooks.get(operation)
        if callback is not None:callback(parent,path,value)
    def write_port(parent,path,value):
        raw=_encoded(value);g.io_events.append(('write',str(path)));g.files[str(path)]=raw
        if path.name=='inner-result.json':
            g.inner_published=True
            if 'inner' not in g.skip_finish:g.finish_streams('inner')
        if path.name=='result.json':g.outer_published=True
        hook('write',parent,path,raw)
    def publish_port(parent,path,value):
        if str(path) in g.files:raise RuntimeError('EXCLUSIVE_SUPPLIED_PUBLICATION')
        raw=_encoded(value);g.io_events.append(('publish',str(path)));g.files[str(path)]=raw
        if path.name=='go-quit.json':
            for name in ('electron','ui'):
                if name not in g.skip_finish:g.finish_streams(name)
        hook('publish',parent,path,raw)
    def read_port(parent,path,maximum):
        g.io_events.append(('read',str(path)))
        if path.name=='ui-result.json':value=copy.deepcopy(s.final)
        elif path.name=='sessions.json':value=copy.deepcopy(s.session)
        else:raise RuntimeError('EXACT_SUPPLIED_READ_ROSTER')
        if len(_encoded(value))>maximum:raise RuntimeError('SUPPLIED_READ_PROFILE')
        hook('read',parent,path,value);return value
    def wait_port(parent,path,deadline):
        g.io_events.append(('wait',str(path)))
        if path.name=='pointer-started.json':value=dict(probe=cns['PROBE'],stage='pointer-started',**s.phase)
        elif path.name=='ui-cancelled.json':state['provider']=True;value=copy.deepcopy(s.cancelled)
        else:raise RuntimeError('EXACT_SUPPLIED_WAIT_ROSTER')
        hook('wait_file',parent,path,value);return value
    for parent,ns in g.namespaces.items():
        ports=dict(write=lambda path,value,parent=parent:write_port(parent,path,value),
            publish=lambda path,value,parent=parent:publish_port(parent,path,value),
            read=lambda path,maximum,parent=parent:read_port(parent,path,maximum),
            wait_file=lambda path,deadline,parent=parent:wait_port(parent,path,deadline),
            pin=ns['_fixture_pin'],read_bytes=ns['_fixture_read_bytes'])
        ns['bind_five_role_ports_v2'](ports)
    c.__dict__.update(cns)
    identities=dict(inner=dict(s.controller));apis={}
    for name in ('electron','ui'):
        api,identity=cns['held_direct_identity_five_v2'](g.edges[name],s.facade,stack,g.edges[name].plan.application)
        apis[name]=api;identities[name]=identity
    # Outer original identity is supplied separately; it is not borrowed by the
    # inner controller or transferred as an executable capability.
    g.edges['inner'].borrow_identity();g.edges['inner'].remember_identity(dict(s.controller))
    def live(name):cns['remaining_five_v2'](g.policy.edge('inner')['workCutoffMs']/1000);cns['live_direct_five_v2'](g.edges[name],apis[name],identities[name],stack)
    prefix=types.SimpleNamespace(PrefixReader=lambda *args,**kw:types.SimpleNamespace(
        read=lambda:s.encode_rows(s.active_rows if state['provider'] else s.active_rows[:2])))
    env=dict(c=c,stack=stack,facade=s.facade,focus_port=s.port,identities=identities,
        retention=RETENTION,route_support=SUPPORT,phase=s.phase,proof=s.proof,edges={name:g.edges[name] for name in ('electron','ui')},
        settlements={},forced=[],deadline=g.policy.edge('inner')['workCutoffMs']/1000,live=live,secondary=g.secondary,ui=s.ui,identity=s.identity,
        source=g.source_sha,apis=apis,prefix_reader=prefix,json=json,time=time_port,sys=sys,
        os=types.SimpleNamespace(path=types.SimpleNamespace(lexists=lambda path:str(path) in g.files)))
    exec(FIVE_INNER_PRODUCER_CODE,env)
    observe=env['observe_focus_five_v2'];g.before_focus=None;g.before_c1=None
    def observe_actual(*args):
        g.order.append('focus');bindings.append(args[3])
        if args[4] is not clocks[0]:raise RuntimeError('SAME_ORIGINAL_READINESS_CLOCK')
        if g.before_focus is not None:g.before_focus()
        return observe(*args)
    env['observe_focus_five_v2']=observe_actual
    g.c=c;g.cns=cns;g.env=env;g.stack=stack;g.identities=identities;g.primary=None;g.route_result=None
    # Prefocus is the actual new helper, not a hand-authored acceptance flag.
    env['retain_prefocus_ready_five_v2'](s.proof['uiReady'],g.source_sha,s.identity,s.ui,s.proof)
    def run():
        try:return env['_run_five_business_inner_v2']()
        finally:g.primary=env.get('primary');g.row=env.get('result');g.refresh()
    g.run=run
    def outer():
        edge=g.edges['inner'];ns=g.namespace('outer');oc=types.SimpleNamespace(**ns)
        oe=dict(c=oc,edge=edge,source=g.source_sha,identity=s.controller,secondary=[],forced=[],
            deadline=g.policy.edge('outer')['workCutoffMs']/1000,time=time_port,json=json,hashlib=hashlib)
        if hasattr(g,'outer_env'):oe=g.outer_env
        else:exec(FIVE_OUTER_PRODUCER_CODE,oe);g.outer_env=oe
        try:return oe['_run_five_business_outer_v2']()
        finally:g.outer_primary=oe.get('primary');g.outer_row=oe.get('result');g.outer_ns=ns;g.refresh()
    g.outer=outer
    return g

