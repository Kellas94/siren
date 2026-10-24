"""Real checked components with explicit held bytes and supplied fake exports."""
import copy,hashlib,json,types
BRIDGE_OBSERVATIONS=[]

def external_inputs(packet=None):
    args=dict(source_plan_raw=SUPPLY['plan_raw'],source_buffers=dict(SUPPLY['buffers']),
        declaration_raw=SUPPLY['declaration_raw'],review_raw=SUPPLY['review_raw'],
        expected_source_pin=copy.deepcopy(SUPPLY['plan_pin']),expected_review_pin=copy.deepcopy(SUPPLY['review_pin']))
    if packet is None:
        packet=SUP._supply_external_attempt(**args,attempt_id='d'*32,
            creation_invocations={edge:format(i+10,'032x') for i,edge in enumerate(('owner','outer','inner','electron','ui'))})
    args.update({key+'_raw':packet[key] for key in ('go','declaration','header','context')})
    return args

def bridge_case(packet=None):
    f=context_case();f.packet_inputs=external_inputs(packet)
    f.context=CX.from_external_supplied_go(**f.packet_inputs,claim_lock=f.claim_lock)
    f.expected=json.loads(f.packet_inputs['context_raw'])
    return f

def bridge_observe(label,f=None,**extra):
    row=dict(case=label,actualNativePorts=False,physicalCapture=False,sourceCustody=False,wholeAttempt=False,**extra)
    if f is not None:
        row.update(effects=list(f.effect_events),roles={name:f.context.role_binding(name) for name in ('owner','outer','inner','electron','ui')},
            inputPins={key:dict(bytes=len(value),sha256=hashlib.sha256(value).hexdigest(),hex=value.hex()) for key,value in f.packet_inputs.items() if key.endswith('_raw')},
            parents={name:dict(parent=parent.parent,durationMs=parent.duration_ms,edges=list(parent.edges),
                attempts={edge:dict(phase=attempt['phase'],hasCapture=attempt['capture'] is not None,hasOwner=attempt['owner'] is not None,
                    hasBackend=attempt['backend'] is not None,hasCoordinator=attempt['coordinator'] is not None,hasEdge=attempt['edge'] is not None,
                    error=None if attempt['error'] is None else dict(type=type(attempt['error']).__name__,message=str(attempt['error']))) for edge,attempt in parent._attempts.items()}) for name,parent in f.parents.items()})
    BRIDGE_OBSERVATIONS.append(row)

def finish_bridge_edges(f):
    edges={};exits={};rows={};bodies={};payloads={}
    for index,name in enumerate(('inner','electron','ui'),1):
        parent=f.parent('outer' if name=='inner' else 'inner');exports=f.exports[parent.parent]
        edge=parent.new_edge(name,f.command(name));edges[name]=edge
        def create(*args,port=exports,pid=1000+index):
            pi=args[-1];pi.hProcess=port.handle();pi.hThread=port.handle();pi.dwProcessId=pid;pi.dwThreadId=pid+1000;return 1
        exports.override['CreateProcessW']=[create]
        edge.acquire_and_start(K.Plain(),lambda q,plan:K.storage_for(q),_ready_readers,lambda seconds:None)
        payloads[name]=dict(stdout=('out-'+name+'\n').encode('ascii'),stderr=('err-'+name+'\n').encode('ascii'))
        for channel,reader in edge.q.readers.items():
            handle=edge.q.backend.handles[channel+'.read'].cell.value
            exports.reads[handle]=[payloads[name][channel],b'']
            while True:
                call=edge.q.backend.read(channel,reader.buffer,reader.count,65536)
                if not(call.state=='RETURNED' and call.raw):raise RuntimeError('BRIDGE_SUPPLIED_READ_FAILED')
                data=bytes(reader.buffer.raw[:reader.count.value])
                with edge.q.lock:
                    append=edge.q.capture.finish_read(reader.read_ticket,'DATA' if data else 'EOF',data);reader.read_ticket=None
                    written=None if append is None else append.bytes_for_port
                if append is not None:
                    outcome,count=edge.q.backend.write(channel,written)
                    if not(outcome.state=='RETURNED' and outcome.raw):raise RuntimeError('BRIDGE_SUPPLIED_WRITE_FAILED')
                    with edge.q.lock:edge.q.capture.finish_append(append,'COMMITTED',count.value)
                if not data:break
                with edge.q.lock:reader.read_ticket=edge.q.capture.begin_read(channel,65536)
            reader.callback_returned=True
        edge.borrow_identity();edge.remember_identity(dict(pid=1000+index,image=edge.plan.application,createdFileTime=str(index)))
        if name=='electron':edge.finish_endpoint_discovery()
    for name in ('ui','electron','inner'):
        exits[name]=edges[name].wait_original_exit();edges[name].finalize(None,_ready_readers,lambda seconds:None)
    for name,edge in edges.items():
        rows[name]=edge.project_outcome()
        bodies[name]=None if rows[name]['disposition']!='STAGED_FINISH' else tuple(row['body'] for row in edge.q.final_ticket._fields['rows'])
    return types.SimpleNamespace(edges=edges,exits=exits,rows=rows,bodies=bodies,payloads=payloads)
