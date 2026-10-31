"""Local opted-in effect admission; no authenticated clock or native authority."""
import ordinary_direct_fixed_plan as P
import ordinary_direct_capture_core as C0
import ordinary_external_profile_v1 as F

def _need(ok,code):
    if ok is not True:raise ValueError('EDGE_TIMING_V1:'+code)

def _uint(value):return type(value) is int and 0<=value<=0xfffffffe

class _EdgeTimingV1:
    # Read-only public API, not an authentication boundary against Python code.
    __slots__=('_issued','_phase','_claimed','_clock_error','_last',
        '_work_expired','_supervision_closed','_dispatches')

    def __init__(self,parent,name,*,work_cutoff_ms,supervision_cutoff_ms=None):
        plan=P._validate_fixed_plan(P._FixedPlan(name))
        _need(plan.edge in ('inner','electron','ui') and plan.parent==parent.parent,'MAINTAINED_PARENT_ROLE')
        ceiling=parent.duration_ms
        supervision=ceiling if supervision_cutoff_ms is None else supervision_cutoff_ms
        _need(_uint(ceiling) and ceiling==plan.maintained_parent_budget_seconds*1000 and
            _uint(work_cutoff_ms) and _uint(supervision) and 0<work_cutoff_ms<=supervision==ceiling,'UNCHANGED_SUPERVISION_AND_WORK_ORDER')
        role=parent.context.role_binding(name)
        _need(role['edge']==name and role['parent']==plan.parent and role['child']==plan.child,'FULL_PARENT_CHILD_ROLE')
        C0._binding({key:role[key] for key in ('attemptId','edge','headerSha256','creationInvocationId')})
        self._issued=(parent,parent.now_ms,tuple(role.items()),work_cutoff_ms,supervision)
        self._phase='WORK';self._claimed=False;self._clock_error=None;self._last=None
        self._work_expired=False;self._supervision_closed=False;self._dispatches=[]

    @property
    def parent(self):return self._issued[0]
    @property
    def clock(self):return self._issued[1]
    @property
    def work_cutoff_ms(self):return self._issued[3]
    @property
    def supervision_cutoff_ms(self):return self._issued[4]
    @property
    def phase(self):return self._phase
    @property
    def claimed(self):return self._claimed
    @property
    def clock_error(self):return self._clock_error
    @property
    def work_expired(self):return self._work_expired
    @property
    def supervision_closed(self):return self._supervision_closed
    @property
    def dispatches(self):return F._detach(self._dispatches)

    def validate_for(self,parent,name,clock):
        plan=P._validate_fixed_plan(P._FixedPlan(name))
        role=dict(self._issued[2]);work=self.work_cutoff_ms;supervision=self.supervision_cutoff_ms
        _need(plan.edge in ('inner','electron','ui') and plan.parent==parent.parent and
            role['edge']==name and role['parent']==plan.parent and role['child']==plan.child and
            self.parent is parent and self.clock is clock and clock is parent.now_ms and
            _uint(work) and _uint(supervision) and _uint(parent.duration_ms) and
            0<work<=supervision==parent.duration_ms==plan.maintained_parent_budget_seconds*1000 and
            F._same(role,parent.context.role_binding(name)),'EXACT_LOCAL_PARENT_ROLE_CLOCK')

    def claim(self,parent,name):
        self.validate_for(parent,name,parent.now_ms)
        _need(not self._claimed and self._phase=='WORK','TIMING_POLICY_CLAIM_ONCE');self._claimed=True

    def declaration(self):
        return dict(schema=1,kind='SIREN_EDGE_TIMING_V1',coordinate='PARENT_ELAPSED_MS_V1',
            roleBinding=dict(self._issued[2]),workCutoffMs=self.work_cutoff_ms,supervisionCutoffMs=self.supervision_cutoff_ms)

    def sample(self):
        if self._clock_error is not None:raise self._clock_error
        try:
            self.validate_for(self.parent,dict(self._issued[2])['edge'],self.clock)
            now=self.clock()
            with self.parent.lock:
                _need(_uint(now) and (self._last is None or now>=self._last),'MONOTONE_ORIGINAL_CLOCK')
                self._last=now
                if self.phase=='WORK' and now>=self.work_cutoff_ms:self._work_expired=True
                if now>=self.supervision_cutoff_ms:self._supervision_closed=True
            return now
        except BaseException as error:
            if self._clock_error is None:self._clock_error=error
            raise

    def remaining(self,phase):
        _need(phase in ('WORK','CLEANUP'),'TIMING_PHASE')
        now=self.sample();stop=self.work_cutoff_ms if phase=='WORK' else self.supervision_cutoff_ms
        return max(0,stop-now)

    def begin_cleanup(self):
        with self.parent.lock:
            _need(self._phase=='WORK','SINGLE_PHASE_HANDOFF');self._phase='CLEANUP'

    def admit(self,label,call_index):
        self.validate_for(self.parent,dict(self._issued[2])['edge'],self.clock)
        _need(self._claimed and type(label) is str and _uint(call_index) and len(self._dispatches)<4096,'BOUNDED_DISPATCH_ADMISSION')
        phase=self.phase;stop=self.work_cutoff_ms if phase=='WORK' else self.supervision_cutoff_ms
        try:now=self.sample()
        except BaseException:
            self._dispatches.append(dict(callIndex=call_index,label=label,phase=phase,cutoffMs=stop,
                nowMs=None,state='REFUSED',reason='CLOCK_UNAVAILABLE'))
            raise
        admitted=not self.supervision_closed and now<stop
        self._dispatches.append(dict(callIndex=call_index,label=label,phase=phase,cutoffMs=stop,nowMs=now,
            state='ADMITTED' if admitted else 'REFUSED',reason='BEFORE_CUTOFF' if admitted else 'CUTOFF'))
        _need(admitted,'DISPATCH_CUTOFF')

    def snapshot(self):
        return dict(declaration=self.declaration(),phase=self.phase,workExpired=self.work_expired,
            clockUnavailable=self.clock_error is not None,supervisionClosed=self.supervision_closed,
            lastObservedMs=self._last,dispatches=F._detach(self._dispatches))


class _ExternalTimingV1(_EdgeTimingV1):
    __slots__=('_policy','_execution_clock')

    def __init__(self,parent,name):
        import ordinary_external_parent_v1 as EP
        import ordinary_external_execution_policy_v1 as XP
        _need(type(parent) is EP._ExternalParentContext and name in ('owner','outer'),'EXACT_EXTERNAL_PARENT')
        parent.validate(name);policy=parent.execution_policy;clock=parent.execution_clock
        _need(type(policy) is XP._ExecutionPolicyV1 and type(clock) is XP._ElapsedClockV1,'EXACT_EXTERNAL_TIMING_INPUTS')
        row=policy.edge(name);role=row['roleBinding']
        self._policy=policy;self._execution_clock=clock
        self._issued=(parent,clock.now_ms,tuple(role.items()),row['workCutoffMs'],row['supervisionCutoffMs'])
        self._phase='WORK';self._claimed=False;self._clock_error=None;self._last=None
        self._work_expired=False;self._supervision_closed=False;self._dispatches=[]

    def validate_for(self,parent,name,clock):
        import ordinary_external_parent_v1 as EP
        _need(type(parent) is EP._ExternalParentContext and parent is self.parent,'ORIGINAL_EXTERNAL_PARENT_TYPE')
        parent.validate(name);row=self._policy.edge(name)
        _need(self._policy is parent.execution_policy and self._execution_clock is parent.execution_clock and
            self.clock is clock is parent.now_ms and clock is self._execution_clock.now_ms and
            self._execution_clock.lock is parent.lock and F._same(dict(self._issued[2]),row['roleBinding']) and
            self.work_cutoff_ms==row['workCutoffMs'] and self.supervision_cutoff_ms==row['supervisionCutoffMs']==parent.duration_ms,
            'ORIGINAL_EXTERNAL_ROLE_CLOCK_CUTOFFS')

    def declaration(self):
        row=self._policy.edge(dict(self._issued[2])['edge'])
        return dict(schema=1,kind='SIREN_EXTERNAL_EDGE_TIMING_V1',coordinate='EXTERNAL_ELAPSED_MS_V1',
            policyPin=self._policy.reference(),originId=self._policy.origin_id,roleBinding=dict(self._issued[2]),
            issuedAtMs=row['issuedAtMs'],workCutoffMs=self.work_cutoff_ms,supervisionCutoffMs=self.supervision_cutoff_ms)

    def execution_descriptor(self,owner_deadline):
        row=self._policy.descriptor(dict(self._issued[2])['edge']);row['ownerDeadlineMs']=owner_deadline
        # Called only outside the transition-lock sections of projection.
        row['clockReceipt']=self._execution_clock.snapshot();return row


class _FiveRoleTimingV2(_EdgeTimingV1):
    __slots__=('_policy','_execution_clock')

    def __init__(self,parent,name):
        import ordinary_five_role_execution_v2 as EP2
        import ordinary_external_execution_policy_v1 as XP
        _need(type(parent) is EP2._FiveRoleParentV2,'EXACT_FIVE_ROLE_PARENT')
        parent.validate(name);policy=parent.execution_policy;clock=parent.execution_clock
        _need(type(policy) is XP._ExecutionPolicyV1 and type(clock) is XP._ElapsedClockV1,'EXACT_FIVE_ROLE_TIMING_INPUTS')
        row=policy.edge(name);self._policy=policy;self._execution_clock=clock
        self._issued=(parent,clock.now_ms,tuple(row['roleBinding'].items()),row['workCutoffMs'],row['supervisionCutoffMs'])
        self._phase='WORK';self._claimed=False;self._clock_error=None;self._last=None
        self._work_expired=False;self._supervision_closed=False;self._dispatches=[]

    def validate_for(self,parent,name,clock):
        import ordinary_five_role_execution_v2 as EP2
        _need(type(parent) is EP2._FiveRoleParentV2 and parent is self.parent,'ORIGINAL_FIVE_ROLE_PARENT_TYPE')
        parent.validate(name);row=self._policy.edge(name)
        _need(self._policy is parent.execution_policy and self._execution_clock is parent.execution_clock and
            self.clock is clock is parent.now_ms and clock is self._execution_clock.now_ms and
            self._execution_clock.lock is parent.lock and F._same(dict(self._issued[2]),row['roleBinding']) and
            self.work_cutoff_ms==row['workCutoffMs'] and self.supervision_cutoff_ms==row['supervisionCutoffMs']==parent.deadline_ms(name),
            'ORIGINAL_FIVE_ROLE_CLOCK_CUTOFFS')

    def declaration(self):
        row=self._policy.edge(dict(self._issued[2])['edge'])
        return dict(schema=1,kind='SIREN_FIVE_ROLE_TIMING_V2',coordinate='EXTERNAL_ELAPSED_MS_V1',
            policyPin=self._policy.reference(),originId=self._policy.origin_id,roleBinding=dict(self._issued[2]),
            issuedAtMs=row['issuedAtMs'],workCutoffMs=self.work_cutoff_ms,supervisionCutoffMs=self.supervision_cutoff_ms)

    def execution_descriptor(self,owner_deadline):
        row=self._policy.descriptor(dict(self._issued[2])['edge']);row['ownerDeadlineMs']=owner_deadline
        row['clockReceipt']=self._execution_clock.snapshot();return row
