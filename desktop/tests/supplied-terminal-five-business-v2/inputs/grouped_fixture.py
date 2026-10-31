"""Unexecuted nonempty three-edge fixture for the coherent grouped packet.

Actual checked A/Q/C/S/B functions use supplied Python memory/exports. The
ready phase and callback return are supplied; no callback/native execution is
claimed. New instrument must provide exact COMMON_GROUP_CODE/READBACK_CODE.
"""
import copy,hashlib,json,types

GROUP_OBSERVATIONS=[]

def _group_source_context(f,source):
    if source!=f.source_sha:raise ValueError('DECLARED_BUSINESS_SOURCE_REQUIRED')
    if type(f.context) is not CX._ExternalExpectedContext:raise ValueError('REAL_EXTERNAL_CONTEXT_REQUIRED')
    if f.context.source_sha==f.source_sha:raise ValueError('BUSINESS_EXTERNAL_DOMAINS_SEPARATE')


def _group_finish_payloads(edge,exports,payloads):
    q=edge.q
    for channel,reader in q.readers.items():
        payload=payloads[channel]
        handle=q.backend.handles[channel+'.read'].cell.value
        exports.reads[handle]=[payload[i:i+65536] for i in range(0,len(payload),65536)]+[b'']
        while True:
            call=q.backend.read(channel,reader.buffer,reader.count,65536)
            if not(call.state=='RETURNED' and call.raw):raise RuntimeError('GROUP_SUPPLIED_READ_FAILED')
            data=bytes(reader.buffer.raw[:reader.count.value])
            with q.lock:
                append=q.capture.finish_read(reader.read_ticket,'DATA' if data else 'EOF',data)
                reader.read_ticket=None
                written=None if append is None else append.bytes_for_port
            if append is not None:
                result,count=q.backend.write(channel,written)
                if not(result.state=='RETURNED' and result.raw):raise RuntimeError('GROUP_SUPPLIED_WRITE_FAILED')
                with q.lock:q.capture.finish_append(append,'COMMITTED',count.value)
            if not data:
                with q.lock:reader.callback_returned=True
                break
            with q.lock:reader.read_ticket=q.capture.begin_read(channel,65536)

def grouped_case(payloads=None,unfinished=None,source='a'*64,finalize=True,retain_identity=True):
    f=context_case();_group_source_context(f,source)
    f.edges={};f.rows={};f.bodies={};f.exits={};f.io_events=[];f.secondary=[]
    f.payloads=payloads or dict(inner=dict(stdout=b'inner-out\n',stderr=b'inner-err\n'),
        electron=dict(stdout=b'electron-out\n',stderr=b'electron-err\n'),
        ui=dict(stdout=b'ui-out\n',stderr=b'ui-err\n'))
    f.pids=dict(inner=99,electron=10,ui=20)
    f.births=dict(inner='123',electron=CC.iso_filetime('2026-10-19T10:00:00Z'),ui='456')
    for name in ('inner','electron','ui'):
        parent=f.parent('outer' if name=='inner' else 'inner');exports=f.exports[parent.parent]
        edge=parent.new_edge(name,f.command(name));f.edges[name]=edge
        def create(*args,child=name,port=exports):
            pi=args[-1];pi.hProcess=port.handle();pi.hThread=port.handle()
            pi.dwProcessId=f.pids[child];pi.dwThreadId=1000+f.pids[child];return 1
        exports.override['CreateProcessW']=[create]
        edge.acquire_and_start(K.Plain(),lambda q,plan:K.storage_for(q),_ready_readers,lambda seconds:None)
        _group_finish_payloads(edge,exports,f.payloads[name])
        if retain_identity:
            edge.borrow_identity();edge.remember_identity(dict(pid=f.pids[name],image=edge.plan.application,
                                                            createdFileTime=f.births[name]))
        if name=='electron':edge.finish_endpoint_discovery()
    injected=RuntimeError('ACTUAL_GROUP_NONEMPTY_STAGING_INTERRUPT')
    if unfinished is not None:
        capture=f.edges[unfinished].q.capture;original=capture.stage_final_readback
        def interrupt(ticket,rows):
            settle=capture._budget.settle
            def fail(*args):raise injected
            capture._budget.settle=fail
            try:return original(ticket,rows)
            finally:capture._budget.settle=settle
        capture.stage_final_readback=interrupt
    if finalize:
        for name in ('ui','electron','inner'):
            edge=f.edges[name];f.exits[name]=edge.wait_original_exit()
            edge.finalize(None,_ready_readers,lambda seconds:None)
    # Reproject siblings after all finalization; do not reuse earlier global
    # budget snapshots as proof of the final state.
    for name,edge in f.edges.items():
        f.rows[name]=edge.project_outcome()
        f.bodies[name]=None if f.rows[name]['disposition']!='STAGED_FINISH' else tuple(
            row['body'] for row in edge.q.final_ticket._fields['rows'])
    f.files={P._ROOT+'\\capture-context.json':f.context_raw,
             P._ROOT+'\\capture-attempt-header.json':f.header_raw}
    for name,row in f.rows.items():
        if f.bodies[name] is not None:
            for index,role in enumerate(('stdout','stderr','archive','index')):
                ref=row['bodyAvailability'][role]['reference']
                if ref is not None:f.files[ref['path']]=f.bodies[name][index]
    f.files[P._ROOT+'-image\\picker-parent-observation.jsonl']=b'explicit supplied journal\n'
    f.read_errors={}
    class SuppliedPath:
        def __init__(self,value):self.value=(value.value if type(value) is SuppliedPath else str(value)).replace('/',chr(92))
        def __str__(self):return self.value
        def __eq__(self,other):return type(other) is SuppliedPath and self.value==other.value
        def __hash__(self):return hash(self.value)
        @property
        def name(self):return self.value.rsplit('\\',1)[-1]
        def __truediv__(self,name):return SuppliedPath(self.value+'\\'+str(name))
        def lstat(self):return types.SimpleNamespace(st_size=len(f.files[self.value]))
        def read_bytes(self):
            f.io_events.append(('body',self.value))
            if self.value in f.read_errors:raise f.read_errors[self.value]
            return f.files[self.value]
    f.Path=SuppliedPath
    def pin(path):
        key=str(path);f.io_events.append(('pin',key));body=f.files[key]
        return dict(path=key,bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
    def read_raw(path,maximum):
        body=SuppliedPath(path).read_bytes()
        if len(body)>maximum:raise RuntimeError('GROUP_FAKE_RAW_BOUND')
        return body,pin(path)
    f.pin=pin;f.read_raw=read_raw
    def namespace(parent):
        names=('inner',) if parent=='outer' else ('electron','ui')
        ns=dict(_direct_parent=f.parents[parent],_direct_expected=f.business_context,
            _direct_context_module=CX,_direct_results_module=DX,_direct_route_module=DROUTE,
            _direct_retained_rows={name:copy.deepcopy(f.rows[name]) for name in names},
            _direct_retained_bodies={name:f.bodies[name] for name in names},
            _direct_saved_readbacks={},_direct_saved_read_started=set(),
            need=CC.need,describe=CC.describe,k=CC,json=json,hashlib=hashlib,
            Path=SuppliedPath,pin=pin,ROOT=SuppliedPath(P._ROOT),OUT=SuppliedPath(P._ROOT+'\\execution'),
            JOURNAL=SuppliedPath(P._ROOT+'-image\\picker-parent-observation.jsonl'),
            PROBE='siren-ordinary-picker-cancel-v1',threading=types.SimpleNamespace(Lock=K.Lock))
        exec(COMMON_GROUP_CODE,ns)
        return ns
    f.namespace=namespace
    def refresh():
        for name,edge in f.edges.items():
            f.rows[name]=edge.project_outcome()
            f.bodies[name]=None if f.rows[name]['disposition']!='STAGED_FINISH' else tuple(
                row['body'] for row in edge.q.final_ticket._fields['rows'])
            if f.bodies[name] is not None:
                for index,role in enumerate(('stdout','stderr','archive','index')):
                    ref=f.rows[name]['bodyAvailability'][role]['reference']
                    if ref is not None:f.files[ref['path']]=f.bodies[name][index]
    f.refresh=refresh
    reader=dict(hashlib=hashlib,R=SuppliedPath(P._ROOT),X=SuppliedPath(P._ROOT+'\\execution'))
    exec(READBACK_CODE,reader);f.reader=reader
    def observe(case):
        GROUP_OBSERVATIONS.append(dict(case=case,rows=copy.deepcopy(f.rows),
            bodySizes={name:None if bodies is None else [len(body) for body in bodies] for name,bodies in f.bodies.items()},
            bodyDigests={name:None if bodies is None else [hashlib.sha256(body).hexdigest() for body in bodies] for name,bodies in f.bodies.items()},
            ioEvents=list(f.io_events),effects=list(f.effect_events)))
    f.observe=observe
    return f
