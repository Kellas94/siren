"""Actual private edge composition with explicit supplied scheduling only.

The fake startup storage bypasses its native constructor. Ready READ tickets
are supplied before child resume; completion uses original backend/capture
methods afterwards. No original callback execution or physical IO is claimed.
"""
import copy,types

OBSERVATIONS=[]

def _ready_readers(q):
    for channel in ('stdout','stderr'):
        reader=q.readers[channel]
        if q.backend.handles[channel+'.readerThread'].state=='OPEN' and not reader.armed:
            with q.lock:
                reader.read_ticket=q.capture.begin_read(channel,65536)
                reader.armed=True;q.owner.observe_reader_ready(channel)

def _finish_readers(q):
    for channel,reader in q.readers.items():
        call=q.backend.read(channel,reader.buffer,reader.count,65536)
        if not(call.state=='RETURNED' and call.raw and reader.count.value==0):
            raise RuntimeError('SUPPLIED_EMPTY_READER_FIXTURE')
        with q.lock:
            q.capture.finish_read(reader.read_ticket,'EOF')
            reader.read_ticket=None;reader.callback_returned=True

def _bodies(edge):
    if edge.result['disposition']!='STAGED_FINISH':return None
    return tuple(row['body'] for row in edge.q.final_ticket._fields['rows'])

def result_case(case,edge_name='inner'):
    f=context_case();parent=f.parent('outer' if edge_name=='inner' else 'inner')
    edge=parent.new_edge(edge_name,f.command(edge_name));exports=f.exports[parent.parent]
    f.edge=edge;f.legacy=dict(stage='ordinary-cancel-complete',settlement={})
    injected=RuntimeError('SUPPLIED_'+case.upper())
    if case=='initial-abort':
        exports.override['SetInformationJobObject']=[0]
        try:edge.acquire_and_start(K.Plain(),None,_ready_readers,lambda seconds:None)
        except RuntimeError as error:f.initial_error=error
        else:raise RuntimeError('EXPECTED_ACTUAL_START_FAILURE')
        edge.finalize(None,_ready_readers,lambda seconds:None)
    elif case=='initial-absence':
        exports.override['_beginthreadex']=[0]
        try:edge.acquire_and_start(K.Plain(),lambda q,plan:K.storage_for(q),_ready_readers,lambda seconds:None)
        except (RuntimeError,ValueError) as error:f.initial_error=error
        else:raise RuntimeError('EXPECTED_ACTUAL_READER_START_FAILURE')
        edge.finalize(None,_ready_readers,lambda seconds:None)
    else:
        edge.acquire_and_start(K.Plain(),lambda q,plan:K.storage_for(q),_ready_readers,lambda seconds:None)
        _finish_readers(edge.q)
        edge.borrow_identity();edge.remember_identity(dict(pid=1001,image=edge.plan.application,createdFileTime='1'))
        f.exit=edge.wait_original_exit()
        if edge_name=='electron':edge.finish_endpoint_discovery()
        if case=='normal':pass
        elif case=='clock-fault':
            def fail():raise injected
            edge.now_ms=fail
        elif case=='unsettled-final':
            # Interrupt the actual final staging after rows have been attached,
            # before their reservation/operation tickets settle. Do not replace
            # phase/rows/holds with invented postconditions.
            original=edge.q.capture.stage_final_readback
            def fail(ticket,rows):
                original_settle=edge.q.capture._budget.settle
                def stop(*args,**kwargs):raise injected
                edge.q.capture._budget.settle=stop
                try:return original(ticket,rows)
                finally:edge.q.capture._budget.settle=original_settle
            edge.q.capture.stage_final_readback=fail
        else:raise ValueError('UNKNOWN_RESULT_FIXTURE')
        edge.finalize(None,_ready_readers,lambda seconds:None)
    f.row=edge.result;f.bodies=_bodies(edge)
    def replace_binding(value,binding):
        if type(value) is dict:
            if set(value)==set(binding):value.update(binding)
            else:
                for item in value.values():replace_binding(item,binding)
        elif type(value) is list:
            for item in value:replace_binding(item,binding)
    f.replace_binding_everywhere=replace_binding
    OBSERVATIONS.append(dict(case=case,edge=edge_name,row=copy.deepcopy(f.row),
        bodySizes=None if f.bodies is None else [len(body) for body in f.bodies],
        effects=list(exports.events),originalExit=copy.deepcopy(getattr(f,'exit',None))))
    return f
