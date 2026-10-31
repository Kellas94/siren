"""Separate supplied T0/C0 parents; no installed entry or native admission."""
import ordinary_direct_context as CX
import ordinary_direct_fixed_plan as P
import ordinary_direct_capture_core as C0
import ordinary_direct_finish_reader as R
import ordinary_direct_capture_finish as C
import ordinary_direct_process_owner as S
import ordinary_direct_file_backend as B
import ordinary_direct_finish_coordinator as Q
import ordinary_direct_caller_adapter as A
import ordinary_direct_timing_v1 as TM
import ordinary_external_execution_policy_v1 as XP
import ordinary_external_profile_v1 as F

def _need(ok,code):
    if ok is not True:raise ValueError('EXTERNAL_PARENT_V1:'+code)

def _expected(context):
    _need(type(context) is CX._ExternalExpectedContext,'EXACT_EXTERNAL_CONTEXT')
    return dict(sourceIdentityKind=context.source_identity_kind,sourcePlanPin=context.source_plan_pin,
        reviewPin=context.review_pin,roleBindings={name:context.role_binding(name) for name in ('owner','outer','inner','electron','ui')})

class _ExternalParentContext:
    __slots__=('_issued','_runtime','_components','_name','edges','_attempts')

    def __init__(self,*,supplied_context,policy,clock,runtime,components):
        expected=_expected(supplied_context)
        _need(type(policy) is XP._ExecutionPolicyV1 and type(clock) is XP._ElapsedClockV1,'EXACT_POLICY_CLOCK')
        _need(F._same(policy.expected(),expected) and clock.policy is policy and
            clock.origin_id==policy.origin_id and clock.parent in ('T0','C0'),'ORIGINAL_EXTERNAL_POLICY_CLOCK_BINDING')
        _need(type(runtime) is dict and set(runtime)=={'memory','layouts','kernel','crt','lock','budget'} and
            runtime['lock'] is clock.lock and type(runtime['budget']) is C._Budget,'EXACT_SHARED_RUNTIME')
        _need(all(getattr(components,key,None) is module for key,module in
            [('C0',C0),('P',P),('R',R),('C',C),('S',S),('B',B),('Q',Q),('A',A)]),'EXACT_CHECKED_COMPONENTS')
        name='owner' if clock.parent=='T0' else 'outer';row=policy.edge(name)
        # No clock sample or clock snapshot while holding a transition lock.
        with supplied_context._claim_lock:
            _need(clock.parent not in supplied_context._parents,'EXTERNAL_PARENT_CLAIM_ONCE')
            supplied_context._parents[clock.parent]=self
        self._issued=(supplied_context,policy,clock,clock.parent,clock.now_ms,runtime['lock'],runtime['budget'],row['supervisionCutoffMs'])
        self._runtime=dict(runtime);self._components=components
        self._name=name;self.edges={};self._attempts={}

    @property
    def context(self):return self._issued[0]
    @property
    def execution_policy(self):return self._issued[1]
    @property
    def execution_clock(self):return self._issued[2]
    @property
    def parent(self):return self._issued[3]
    @property
    def now_ms(self):return self._issued[4]
    @property
    def lock(self):return self._issued[5]
    @property
    def budget(self):return self._issued[6]
    @property
    def duration_ms(self):return self._issued[7]

    def validate(self,name):
        _need(name==self._name and F._same(self.execution_policy.expected(),_expected(self.context)) and
            self.execution_clock.policy is self.execution_policy and self.execution_clock.parent==self.parent and
            self.execution_clock.origin_id==self.execution_policy.origin_id and
            self.now_ms is self.execution_clock.now_ms and self.lock is self.execution_clock.lock and
            self.duration_ms==self.execution_policy.edge(name)['supervisionCutoffMs'],'ORIGINAL_PARENT_POLICY_CLOCK')

    def new_edge(self,name,command):
        _need(type(name) is str,'EXTERNAL_EDGE_NAME');self.validate(name)
        plan=P._validate_fixed_plan(P._FixedPlan(name))
        _need(plan.parent==self.parent and type(command) in (tuple,list) and
            all(type(arg) is str for arg in command) and tuple(command)==plan.argv,'FIXED_EXTERNAL_COMMAND')
        with self.lock:
            _need(name not in self._attempts,'EXTERNAL_INVOCATION_ONCE')
            binding=self.context.binding(name)
            attempt=dict(binding=binding,phase='RESERVED',timing=None,capture=None,owner=None,backend=None,coordinator=None,edge=None,error=None)
            self._attempts[name]=attempt
            try:
                timing=attempt['timing']=TM._ExternalTimingV1(self,name);timing.claim(self,name)
                capture=attempt['capture']=C._Capture(binding,self.budget)
                owner=attempt['owner']=S._Owner(binding,capture,deadline_ms=self.duration_ms)
                runtime=self._runtime
                backend=attempt['backend']=B._Backend(runtime['memory'],runtime['layouts'],runtime['kernel'],runtime['crt'])
                coordinator=attempt['coordinator']=Q._Coordinator(owner,capture,backend,self.lock)
                describe=lambda error:dict(type=type(error).__name__,message=str(error))
                edge=attempt['edge']=A._OwnedEdge(coordinator,plan,self.now_ms,describe,timing=timing)
                self.edges[name]=edge;attempt['phase']='ROOTED'
            except BaseException as error:
                attempt['error']=error;attempt['phase']='CONSTRUCTION_FAILED';raise
        return edge
