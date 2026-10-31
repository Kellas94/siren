"""Explicit supplied context/runtime fixture, not yet SOURCE admitted.

The fixed instrument must supply CX and checked component modules. K/U supply
the retained fake exports/layouts. No chosen functions are loaded/executed here
before the future fixed SOURCE gate. No callback, DLL, child or file API is used.
"""
import copy,hashlib,json,types

def _encoded(value):return json.dumps(value,separators=(',',':'),sort_keys=True).encode('ascii')

def context_case():
    f=types.SimpleNamespace(effect_events=[],clock_value=1000.0,parents={},exports={})
    f.source_sha='a'*64;f.review_sha='2'*64;f.claim_lock=K.Lock()
    f.packet_inputs=external_inputs()
    f.context=CX.from_external_supplied_go(**f.packet_inputs,claim_lock=f.claim_lock)
    f.header_raw=f.packet_inputs['header_raw'];f.context_raw=f.packet_inputs['context_raw'];f.go_raw=f.packet_inputs['go_raw']
    f.expected=json.loads(f.context_raw)
    f.business_context=BD._BusinessDomainContextV1(f.context,
        input_manifest_pin=dict(path=P._ROOT+'\\INPUT-MANIFEST.json',bytes=700,sha256=f.source_sha),
        controller_review_pin=dict(path=P._ROOT+'\\CONTROLLER-SOURCE-REVIEW.json',bytes=800,sha256=f.review_sha))
    f.components=types.SimpleNamespace(C0=C0,P=P,R=R,C=C,S=S,B=B,Q=Q,A=A,T=T,DR=DR)
    f.layouts=dict(HANDLE=K.Cell,DWORD=K.Cell,BOOL=K.Cell,SIZE_T=K.Cell,
        CRT_UINT=K.Cell,LPVOID=K.Plain,STARTUPINFOW=K.Plain,
        LARGE_INTEGER=K.Cell,BY_HANDLE_FILE_INFORMATION=U.FileInfo,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION=K.Limit,
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION=K.Account,READER_CALLBACK=lambda callback:callback)
    def parent(name,expected=None,fresh=False):
        context=f.context if expected is None else CX._ExpectedContext(expected,f.header_raw,
            f.source_sha,f.review_sha,claim_lock=f.claim_lock)
        if not fresh and expected is None and name in f.parents:return f.parents[name]
        lock=K.Lock();memory=K.Memory();exports=U.Exports(memory,lock)
        exports.events=f.effect_events
        f.exports[name]=exports
        value=CX._ParentContext(context,name,deadline_seconds=1000.0+(240 if name=='outer' else 210),
            monotonic=lambda:f.clock_value,describe=lambda error:dict(type=type(error).__name__,message=str(error)),
            memory=memory,layouts=f.layouts,kernel=exports.kernel,crt=exports.crt,lock=lock,
            budget=C._Budget(),components=f.components)
        if expected is None:f.parents[name]=value
        return value
    f.parent=parent
    f.command=lambda name:P._FixedPlan(name).argv
    def set_time(value):f.clock_value=value
    f.set_time=set_time
    def mutate(value,kind):
        if kind=='missing':value.clear()
        elif kind=='source':value['sourceSha256']='f'*64
        elif kind=='review':value['reviewSha256']='f'*64
        elif kind=='header-bytes':value['attemptHeader']['bytes']+=1
        elif kind=='header-digest':value['attemptHeader']['sha256']='f'*64
        elif kind=='shared-header':value['bindings']['ui']['headerSha256']='f'*64
        elif kind=='invocation-reuse':
            changed=json.loads(f.header_raw);changed['creationInvocations']['ui']=changed['creationInvocations']['electron']
            f.header_raw=_encoded(changed)
            value['attemptHeader'].update(bytes=len(f.header_raw),sha256=hashlib.sha256(f.header_raw).hexdigest())
            for row in value['bindings'].values():row['headerSha256']=value['attemptHeader']['sha256']
            value['bindings']['ui']['creationInvocationId']=changed['creationInvocations']['ui']
        elif kind=='undeclared-edge':value['bindings']['outer']=copy.deepcopy(value['bindings']['inner'])
        else:raise ValueError('UNKNOWN_CONTEXT_MUTATION')
    f.mutate_context=mutate
    def fail_backend(error):
        def fail():raise error
        f.layouts['JOBOBJECT_EXTENDED_LIMIT_INFORMATION']=fail
    f.fail_backend_construction=fail_backend
    return f
