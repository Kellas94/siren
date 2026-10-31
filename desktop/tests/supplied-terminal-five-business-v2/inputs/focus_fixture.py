"""Supplied memory/ABI world over actual selected direct lifecycle/functions.

No old fixture run/complete/settlement helper is invoked. All process/window,
reader-ready and callback-return observations remain supplied, not native proof.
"""
import copy,hashlib,json,types

FOCUS_OBSERVATIONS=[]
_focus_worlds=[]

def restore_focus_worlds():
    while _focus_worlds:_focus_worlds.pop().restore()

def focus_case():
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
    payloads=dict(inner=dict(stdout=b'inner-route-output\n',stderr=b'inner-route-diagnostic\n'),
        electron={role:s.artifacts[role] for role in ('stdout','stderr')},
        ui=dict(stdout=b'ui-route-output\n',stderr=b'ui-route-diagnostic\n'))
    g=grouped_case(payloads=payloads,finalize=False,retain_identity=False)
    g.seed=s;s.raw.now=1000.0
    # Parent keeps its original monotonic callable. Advance its supplied scalar
    # through the common time port; the original 1240/1210 deadlines stay fixed.
    def now():g.clock_value=s.raw.now;return s.raw.now
    def sleep(seconds):s.raw.now+=seconds;g.clock_value=s.raw.now
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
    clocks=[];bindings=[];g.order=[]
    def make_clock():
        g.order.append('readiness');clock=CLOCK._Fuse(s.raw);clocks.append(clock);return clock
    def create_cancel(facade,binding,clock):
        if facade is not s.facade or binding is not bindings[0] or clock is not clocks[0]:raise RuntimeError('ORIGINAL_SHARED_FOCUS_C1_OBJECTS')
        g.order.append('c1')
        if g.before_c1 is not None:g.before_c1()
        return FOREGROUND.create_observed_escape_cancel(facade,binding,clock)
    stack=types.SimpleNamespace(observer=ADAPTER,model=MODEL,clock=types.SimpleNamespace(create_dialog_clock=make_clock),
        readiness=READINESS,foreground=types.SimpleNamespace(create_observed_escape_cancel=create_cancel),focus_policy=FOCUS)
    cns['_direct_stack']=stack
    cns.update(DATA=g.Path(P._ROOT+'\\data'),ENDPOINT_JOURNAL=g.Path(P._ROOT+'-image\\terminal-request-endpoint.jsonl'))
    g.files[str(cns['JOURNAL'])]=s.artifacts['journal']
    g.files[str(cns['ENDPOINT_JOURNAL'])]=s.encode_rows(s.endpoint)
    state=dict(provider=False)
    def write(path,value):g.io_events.append(('write',str(path)));g.files[str(path)]=_encoded(value)
    def publish(path,value):
        if str(path) in g.files:raise RuntimeError('EXCLUSIVE_SUPPLIED_PUBLICATION')
        g.io_events.append(('publish',str(path)));g.files[str(path)]=_encoded(value)
    def read(path,*unused):
        g.io_events.append(('read',str(path)))
        if path.name=='ui-result.json':return copy.deepcopy(s.final)
        if path.name=='sessions.json':return copy.deepcopy(s.session)
        raise RuntimeError('EXACT_SUPPLIED_READ_ROSTER')
    def wait_file(path,deadline):
        cns['remaining'](deadline);g.io_events.append(('wait',str(path)))
        if path.name=='pointer-started.json':return dict(probe=cns['PROBE'],stage='pointer-started',**s.phase)
        if path.name=='ui-cancelled.json':state['provider']=True;return copy.deepcopy(s.cancelled)
        raise RuntimeError('EXACT_SUPPLIED_WAIT_ROSTER')
    cns.update(write=write,publish=publish,read=read,wait_file=wait_file)
    c.__dict__.update(cns)
    identities=dict(inner=dict(s.controller));apis={}
    for name in ('electron','ui'):
        api,identity=cns['held_direct_identity'](g.edges[name],s.facade,stack,g.edges[name].plan.application)
        apis[name]=api;identities[name]=identity
    # Outer original identity is supplied separately; it is not borrowed by the
    # inner controller or transferred as an executable capability.
    g.edges['inner'].borrow_identity();g.edges['inner'].remember_identity(dict(s.controller))
    def live(name):cns['remaining'](1210.0);cns['live_direct'](g.edges[name],apis[name],identities[name],stack)
    prefix=types.SimpleNamespace(PrefixReader=lambda *args,**kw:types.SimpleNamespace(
        read=lambda:s.encode_rows(s.active_rows if state['provider'] else s.active_rows[:2])))
    env=dict(c=c,stack=stack,facade=s.facade,focus_port=s.port,identities=identities,
        retention=RETENTION,route_support=SUPPORT,phase=s.phase,proof=s.proof,edges={name:g.edges[name] for name in ('electron','ui')},
        settlements={},forced=[],deadline=1210.0,live=live,secondary=g.secondary,ui=s.ui,identity=s.identity,
        source=g.source_sha,apis=apis,prefix_reader=prefix,json=json,time=time_port,sys=sys,
        os=types.SimpleNamespace(path=types.SimpleNamespace(lexists=lambda path:str(path) in g.files)))
    exec(INNER_ROUTE_CODE,env)
    observe=env['observe_focus'];g.before_focus=None;g.before_c1=None
    def observe_actual(*args):
        g.order.append('focus');bindings.append(args[3])
        if args[4] is not clocks[0]:raise RuntimeError('SAME_ORIGINAL_READINESS_CLOCK')
        if g.before_focus is not None:g.before_focus()
        return observe(*args)
    env['observe_focus']=observe_actual
    g.c=c;g.cns=cns;g.env=env;g.stack=stack;g.identities=identities;g.primary=None;g.route_result=None
    # Prefocus is the actual new helper, not a hand-authored acceptance flag.
    env['retain_prefocus_ready'](s.proof['uiReady'],g.source_sha,s.identity,s.ui,s.proof)
    def run():
        try:g.route_result=env['selected_route']()
        except BaseException as error:g.primary=error
        finally:
            for name in ('ui','electron'):g.edges[name].finalize(g.primary,c.direct_pump,time_port.sleep)
            env['primary']=g.primary
            exec(INNER_ROOT_CODE,env);g.primary=env['primary'];g.row=env['result'];g.refresh()
        return g.row
    g.run=run
    def outer():
        edge=g.edges['inner'];normal=edge.wait_original_exit();edge.finalize(None,_ready_readers,time_port.sleep);g.refresh()
        ns=g.namespace('outer');ns.update(cancel=CANCEL,consumer=CONSUMER,focus_evidence=FEM,route_evidence=REM)
        oc=types.SimpleNamespace(**ns);settlement=ns['direct_edge_value'](edge,g.secondary)
        oe=dict(c=oc,primary=None,secondary=g.secondary,forced=[],settlement=settlement,
            source=g.source_sha,identity=s.controller,exit_settlement=normal,inner=g.row)
        exec(OUTER_ROOT_CODE,oe);g.outer_row=oe['result'];g.outer_ns=ns;return g.outer_row
    g.outer=outer
    def observe_case(case):
        g.observe(case)
        FOCUS_OBSERVATIONS.append(dict(case=case,inner=copy.deepcopy(getattr(g,'row',None)),
            outer=copy.deepcopy(getattr(g,'outer_row',None)),order=list(g.order),
            identityCalls=list(g.identity_calls),focusDispatches=s.focusDispatches,c1Dispatches=s.dispatches,
            clock=None if not clocks else clocks[0].snapshot(),primaryType=None if g.primary is None else type(g.primary).__name__,
            actualNativePorts=False,ctypesRepresentation=True,wholeAttempt=False))
    g.observe_focus_case=observe_case
    return g
