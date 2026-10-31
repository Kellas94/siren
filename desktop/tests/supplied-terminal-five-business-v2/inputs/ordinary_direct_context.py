"""Private explicit supplied context for maintained direct-parent composition.

C0/P/R and supplied components are the exact checked namespace. This module does
not load it or manufacture an operational context. A matching supplied header
and context establish consistency only, never producer/transport authenticity.
The production context/header producer and whole source custody remain open.
"""
import hashlib,json,math
import ordinary_direct_capture_core as C0
import ordinary_direct_fixed_plan as P
import ordinary_direct_finish_reader as R
import ordinary_external_profile_v1 as F
import ordinary_external_supply_v1 as ES
import ordinary_direct_timing_v1 as TM

_EDGES=('inner','electron','ui')

def _need(ok,code):
    if ok is not True:raise ValueError('DIRECT_CONTEXT:'+code)

def _keys(value,keys,code):
    _need(type(value) is dict and all(type(key) is str for key in value) and
          set(value)==set(keys),code)

def _hex(value,size):
    return type(value) is str and len(value)==size and all(c in '0123456789abcdef' for c in value)

def _finite(value):
    return type(value) in (int,float) and 0<=value<(1<<53) and math.isfinite(value)

def _constant(value):raise ValueError('DIRECT_CONTEXT:NONFINITE_HEADER')

def _read_supplied(raw):
    _need(type(raw) is bytes and 0<len(raw)<=262144,'BOUNDED_SUPPLIED_BODY')
    return json.loads(raw.decode('utf8','strict'),object_pairs_hook=R._pairs,
                      parse_constant=_constant)

def _supplied_pin(value,path,raw):
    _keys(value,('path','bytes','sha256'),'SUPPLIED_PIN_KEYS')
    _need(type(value['path']) is str and value['path']==path and
          type(value['bytes']) is int and 0<value['bytes']<=262144 and
          _hex(value['sha256'],64) and type(raw) is bytes and len(raw)==value['bytes'] and
          hashlib.sha256(raw).hexdigest()==value['sha256'],'SUPPLIED_PIN_BYTES')
    return dict(value)

def from_supplied_go(go_raw,context_raw,header_raw,source_sha,review_sha,*,claim_lock):
    """One private supplied subset join; no file IO or producer authentication.

    These are runtime attempt bodies, not members of their own source manifest:
    including a header's source hash in that manifest would be self-referential.
    Their expected literal pins travel in the explicit versioned GO contract.
    """
    go=_read_supplied(go_raw)
    _keys(go,('schema','kind','probe','stage','sourceSha256','reviewSha256',
              'contextPin','attemptHeaderPin'),'VERSIONED_GO_KEYS')
    _need(type(go['schema']) is int and go['schema']==1 and
          type(go['kind']) is str and go['kind']=='MAINTAINED_DIRECT_GO_V1' and
          go['probe']=='siren-ordinary-picker-cancel-v1' and
          go['stage']=='ordinary-cancel-native-go-direct' and
          type(go['sourceSha256']) is str and go['sourceSha256']==source_sha and
          type(go['reviewSha256']) is str and go['reviewSha256']==review_sha,'ACTUAL_VERSIONED_GO')
    context_pin=_supplied_pin(go['contextPin'],P._ROOT+'\\capture-context.json',context_raw)
    header_pin=_supplied_pin(go['attemptHeaderPin'],P._ROOT+'\\capture-attempt-header.json',header_raw)
    value=_read_supplied(context_raw)
    context=_ExpectedContext(value,header_raw,source_sha,review_sha,claim_lock=claim_lock)
    _need(C0._equal(context.header_pin,header_pin),'GO_CONTEXT_COMMON_HEADER_PIN')
    context.context_pin=context_pin
    context.go_sha256=hashlib.sha256(go_raw).hexdigest()
    return context

class _ExpectedContext:
    def __init__(self,value,header_body,source_sha,review_sha,*,claim_lock):
        _need(callable(getattr(claim_lock,'__enter__',None)) and
              callable(getattr(claim_lock,'__exit__',None)),'SHARED_CONTEXT_CLAIM_LOCK')
        _keys(value,('schema','kind','sourceSha256','reviewSha256','headerMeaning',
                     'attemptHeader','bindings'),'CLOSED_CONTEXT')
        _need(type(value['schema']) is int and value['schema']==1 and
              type(value['kind']) is str and value['kind']=='MAINTAINED_DIRECT_CONTEXT_V1' and
              type(value['headerMeaning']) is str and
              value['headerMeaning']=='COMMON_ATTEMPT_HEADER_V1','VERSION_AND_HEADER_MEANING')
        _need(_hex(source_sha,64) and _hex(review_sha,64) and
              type(value['sourceSha256']) is str and value['sourceSha256']==source_sha and
              type(value['reviewSha256']) is str and value['reviewSha256']==review_sha,
              'ACTUAL_SOURCE_AND_REVIEW_GO_JOIN')
        pin=value['attemptHeader']
        _keys(pin,('path','bytes','sha256'),'ATTEMPT_HEADER_PIN')
        _need(type(pin['path']) is str and pin['path']==P._ROOT+'\\capture-attempt-header.json' and
              type(pin['bytes']) is int and 0<pin['bytes']<=262144 and _hex(pin['sha256'],64) and
              type(header_body) is bytes and len(header_body)==pin['bytes'] and
              hashlib.sha256(header_body).hexdigest()==pin['sha256'],'SUPPLIED_LITERAL_HEADER_BYTES')
        header=_read_supplied(header_body)
        _keys(header,('schema','kind','sourceSha256','reviewSha256','attemptId',
                      'creationInvocations'),'COMMON_HEADER_KEYS')
        _need(type(header['schema']) is int and header['schema']==1 and
              header['kind']=='MAINTAINED_ATTEMPT_HEADER_V1' and
              type(header['sourceSha256']) is str and header['sourceSha256']==source_sha and
              type(header['reviewSha256']) is str and header['reviewSha256']==review_sha and
              _hex(header['attemptId'],32),'COMMON_HEADER_JOIN')
        _keys(header['creationInvocations'],_EDGES,'EXPLICIT_SUBSET_INVOCATIONS')
        _keys(value['bindings'],_EDGES,'EXPLICIT_MAINTAINED_SUBSET')
        bindings={name:C0._binding(value['bindings'][name]) for name in _EDGES}
        identifiers=[]
        for name,binding in bindings.items():
            invocation=header['creationInvocations'][name]
            _need(_hex(invocation,32) and binding['edge']==name and
                  binding['attemptId']==header['attemptId'] and
                  binding['headerSha256']==pin['sha256'] and
                  binding['creationInvocationId']==invocation,'EXPECTED_EDGE_BINDING:'+name)
            identifiers.append(invocation)
        _need(len(set(identifiers))==3,'DISTINCT_DECLARED_INVOCATIONS')
        self._bindings=bindings;self.source_sha=source_sha;self.review_sha=review_sha
        self.header_pin=dict(pin);self.header_body=header_body
        self.native_eligibility=False;self.source_custody=False
        self._claim_lock=claim_lock;self._parents={}

    def binding(self,name):
        _need(type(name) is str and name in _EDGES,'DECLARED_BINDING')
        return dict(self._bindings[name])

    def binding_matches(self,name,value):
        if type(name) is not str or name not in _EDGES:return False
        try:actual=C0._binding(value)
        except (ValueError,TypeError):return False
        return C0._equal(actual,self._bindings[name])

class _ExternalExpectedContext:
    """New held-source-plan identity domain; not a legacy input manifest.

    This constructor validates the full supplied transport. It never accepts a
    caller's already-parsed consistency dictionary as an expected context.
    """
    def __init__(self,*,claim_lock,**supplied):
        _need(callable(getattr(claim_lock,'__enter__',None)) and
              callable(getattr(claim_lock,'__exit__',None)),'SHARED_EXTERNAL_CONTEXT_CLAIM_LOCK')
        joined=ES._read_external_go(**supplied)
        self._role_bindings=F._detach(joined['bindings'])
        self.source_sha=joined['sourcePlanSha256'];self.review_sha=joined['reviewSha256']
        self.source_identity_kind='SIREN_EXTERNAL_SOURCE_PLAN_V1'
        self.source_plan_pin=F._detach(supplied['expected_source_pin'])
        self.review_pin=F._detach(supplied['expected_review_pin'])
        self.header_body=supplied['header_raw']
        self.header_pin=ES._pin(F._runtime_path('attempt-header'),self.header_body)
        self.context_pin=ES._pin(F._runtime_path('context'),supplied['context_raw'])
        self.declaration_pin=ES._pin(F._runtime_path('declaration'),supplied['declaration_raw'])
        self.go_sha256=joined['goSha256']
        self.unresolved_sources=tuple(joined['unresolvedSources'])
        self.native_eligibility=False;self.source_custody=False
        self.authenticated_review=False;self.operational_entry=False
        self._claim_lock=claim_lock;self._parents={}

    def role_binding(self,name):
        _need(type(name) is str and name in F._EDGES,'DECLARED_EXTERNAL_ROLE')
        return F._detach(self._role_bindings[name])

    def binding(self,name):
        role=self.role_binding(name)
        plan=P._validate_fixed_plan(P._FixedPlan(name))
        _need(role['edge']==plan.edge and role['parent']==plan.parent and role['child']==plan.child,
              'RETAINED_EXTERNAL_PARENT_CHILD')
        return C0._binding({key:role[key] for key in ('attemptId','edge','headerSha256','creationInvocationId')})

    def binding_matches(self,name,value):
        if type(name) is not str or name not in F._EDGES:return False
        try:return C0._equal(C0._binding(value),self.binding(name))
        except (ValueError,TypeError,KeyError):return False


def from_external_supplied_go(*,claim_lock,**supplied):
    """Separate versioned path; preserve literal five-edge header and GO."""
    return _ExternalExpectedContext(claim_lock=claim_lock,**supplied)


class _ParentContext:
    def __init__(self,context,parent,*,deadline_seconds,monotonic,describe,
                 memory,layouts,kernel,crt,lock,budget,components):
        _need(type(context) in (_ExpectedContext,_ExternalExpectedContext) and type(parent) is str and
              parent in ('outer','inner'),'EXACT_EXPECTED_PARENT_CONTEXT')
        duration=240 if parent=='outer' else 210
        _need(_finite(deadline_seconds) and deadline_seconds>=duration and
              callable(monotonic) and callable(describe),'INHERITED_PARENT_CLOCK')
        _need(components.C0 is C0 and components.P is P and components.R is R,
              'EARLY_NATIVE_COMPONENT_IDENTITY_JOIN')
        _need(type(budget) is components.C._Budget,'EXACT_SHARED_CAPTURE_BUDGET')
        _need(callable(getattr(lock,'__enter__',None)) and
              callable(getattr(lock,'__exit__',None)),'SHARED_PARENT_SYNCHRONIZATION')
        with context._claim_lock:
            _need(parent not in context._parents,'PARENT_SESSION_CLAIMED_ONCE')
            # Retain even a subsequently failed initialization. This is local
            # one-use state, not cross-process or module-reload replay proof.
            context._parents[parent]=self
        self.context=context;self.parent=parent;self.deadline_seconds=deadline_seconds
        self.duration_ms=duration*1000;self._monotonic=monotonic;self._last_ms=-1
        self._describe=describe;self._memory=memory;self._layouts=layouts
        self._kernel=kernel;self._crt=crt;self.lock=lock;self.budget=budget
        self._components=components
        self.edges={};self._attempts={}
        def inherited_now_ms():
            now=self._monotonic()
            _need(_finite(now),'AVAILABLE_PARENT_MONOTONIC_VALUE')
            # Anchor to the original absolute deadline. Ceil the elapsed
            # coordinate, so an integer wait cannot extend it by rounding.
            coordinate=math.ceil((now-self.deadline_seconds)*1000+self.duration_ms)
            with self.lock:
                _need(type(coordinate) is int and 0<=coordinate<=0xfffffffe and
                      coordinate>=self._last_ms,'MONOTONIC_INHERITED_COORDINATE')
                self._last_ms=coordinate
            return coordinate
        # Store one callable object; siblings receive this identical clock.
        self.now_ms=inherited_now_ms

    def binding_matches(self,name,value):return self.context.binding_matches(name,value)

    def timing_v1(self,name,*,work_cutoff_ms,supervision_cutoff_ms=None):
        _need(type(self.context) is _ExternalExpectedContext,'EXPLICIT_EXTERNAL_TIMING_CONTEXT')
        _need(type(name) is str and name in _EDGES,'TIMED_MAINTAINED_EDGE')
        return TM._EdgeTimingV1(self,name,work_cutoff_ms=work_cutoff_ms,supervision_cutoff_ms=supervision_cutoff_ms)

    def new_edge(self,name,command,*,timing=None):
        _need(type(name) is str and name in _EDGES,'FIXED_MAINTAINED_ROLE')
        plan=P._validate_fixed_plan(P._FixedPlan(name))
        _need(plan.parent==self.parent,'CURRENT_PARENT_OWNS_EDGE')
        _need(type(command) in (tuple,list) and all(type(arg) is str for arg in command) and
              tuple(command)==plan.argv,'EXACT_FIXED_COMMAND')
        if timing is not None:
            _need(type(timing) is TM._EdgeTimingV1,'EXACT_TIMING_POLICY')
            timing.validate_for(self,name,self.now_ms)
        with self.lock:
            _need(name not in self._attempts,'INVOCATION_RESERVED_ONCE')
            binding=self.context.binding(name)
            if timing is not None:timing.claim(self,name)
            # Reserve before constructors, retain partial construction, and
            # never repeat the declared invocation after an allocation failure.
            attempt=dict(binding=binding,phase='RESERVED',capture=None,owner=None,
                         backend=None,coordinator=None,edge=None,error=None)
            self._attempts[name]=attempt
            try:
                C,S,B,Q,A=(getattr(self._components,key) for key in ('C','S','B','Q','A'))
                capture=attempt['capture']=C._Capture(binding,self.budget)
                owner=attempt['owner']=S._Owner(binding,capture,deadline_ms=self.duration_ms)
                backend=attempt['backend']=B._Backend(self._memory,self._layouts,self._kernel,self._crt)
                coordinator=attempt['coordinator']=Q._Coordinator(owner,capture,backend,self.lock)
                edge=attempt['edge']=A._OwnedEdge(coordinator,plan,self.now_ms,self._describe,timing=timing)
                self.edges[name]=edge;attempt['phase']='ROOTED'
            except BaseException as error:
                attempt['error']=error;attempt['phase']='CONSTRUCTION_FAILED'
                raise
        # No acquisition, launch, storage construction or foreign API here.
        return edge


def from_external_execution_v1(*,supplied_context,policy,clock,runtime,components):
    # Deferred checked import avoids a module-initialization cycle.
    import ordinary_external_parent_v1 as EP
    return EP._ExternalParentContext(supplied_context=supplied_context,policy=policy,clock=clock,runtime=runtime,components=components)


def from_five_role_execution_v2(*,supplied_context,policy,clock,runtime,components):
    """Explicit successor; legacy/v1 parent contracts remain separate."""
    import ordinary_five_role_execution_v2 as EP2
    return EP2._FiveRoleParentV2(supplied_context=supplied_context,policy=policy,clock=clock,runtime=runtime,components=components)
