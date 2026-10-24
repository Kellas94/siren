"""Inert companion policy and supplied elapsed-coordinate clock; no actor entry."""
import hashlib,json
import ordinary_external_profile_v1 as F
import ordinary_direct_fixed_plan as P
import ordinary_direct_capture_core as C0

_NAMES=('owner','outer','inner','electron','ui')

def _need(ok,code):
    if ok is not True:raise ValueError('EXECUTION_POLICY_V1:'+code)

def _uint(value):return type(value) is int and 0<=value<=0xfffffffe

def _source_pin(value):
    F._keys(value,('path','bytes','sha256'),'EXECUTION_SOURCE_PIN')
    _need(type(value['path']) is str and value['path'].startswith(P._WORK+'\\') and
        '\x00' not in value['path'] and '/' not in value['path'] and value['path'].endswith('.json') and
        type(value['bytes']) is int and 0<value['bytes']<=262144 and F._hex(value['sha256'],64),'EXPECTED_METADATA_PIN')

def _role(value,name):
    F._keys(value,('attemptId','edge','headerSha256','creationInvocationId','parent','child'),'EXECUTION_ROLE')
    C0._binding({key:value[key] for key in ('attemptId','edge','headerSha256','creationInvocationId')})
    plan=P._validate_fixed_plan(P._FixedPlan(name))
    _need(value['edge']==name and value['parent']==plan.parent and value['child']==plan.child,'FIXED_FULL_ROLE')

class _ExecutionPolicyV1:
    __slots__=('_body','_expected_body','_ceilings')

    def __init__(self,raw,*,expected,expected_pin,external_ceilings_ms):
        value=F._load(raw)
        F._version(value,('schema','kind','sourceIdentityKind','sourcePlanPin','reviewPin','originId','edges'),'SIREN_EXTERNAL_EXECUTION_POLICY_V1')
        F._keys(expected,('sourceIdentityKind','sourcePlanPin','reviewPin','roleBindings'),'EXPECTED_EXECUTION_DOMAIN')
        _need(value['sourceIdentityKind']==expected['sourceIdentityKind']=='SIREN_EXTERNAL_SOURCE_PLAN_V1','SEPARATE_SOURCE_IDENTITY_DOMAIN')
        for key in ('sourcePlanPin','reviewPin'):
            _source_pin(value[key]);_source_pin(expected[key])
            _need(F._same(value[key],expected[key]),'ORIGINAL_EXPECTED_SOURCE_REVIEW_PIN')
        F._literal_pin(expected_pin,P._ROOT+'\\capture-external-execution-policy-v1.json',raw)
        _need(F._hex(value['originId'],32),'EXPLICIT_ORIGIN_ID')
        F._keys(external_ceilings_ms,('owner','outer'),'EXPLICIT_EXTERNAL_CEILINGS')
        _need(all(_uint(limit) and limit>0 for limit in external_ceilings_ms.values()),'NO_EXTERNAL_CEILING_DEFAULT')
        F._keys(expected['roleBindings'],_NAMES,'EXPECTED_FIVE_ROLE_BINDINGS')
        rows=value['edges'];_need(type(rows) is list and len(rows)==5,'ORDERED_FIVE_EDGE_WINDOWS')
        seen={};invocations=set();attempt=None;header=None
        for name,row in zip(_NAMES,rows):
            F._keys(row,('roleBinding','issuedAtMs','workCutoffMs','supervisionCutoffMs'),'EXECUTION_WINDOW')
            role=row['roleBinding'];_role(role,name);_role(expected['roleBindings'][name],name)
            _need(F._same(role,expected['roleBindings'][name]),'ORIGINAL_HEADER_AND_INVOCATION')
            if attempt is None:attempt=role['attemptId'];header=role['headerSha256']
            _need(role['attemptId']==attempt and role['headerSha256']==header and role['creationInvocationId'] not in invocations,'COMMON_ATTEMPT_UNIQUE_INVOCATIONS')
            invocations.add(role['creationInvocationId'])
            start,work,stop=(row[key] for key in ('issuedAtMs','workCutoffMs','supervisionCutoffMs'))
            _need(all(_uint(x) for x in (start,work,stop)) and start<work<=stop,'EXACT_WINDOW_ORDER')
            plan=P._FixedPlan(name)
            limit=external_ceilings_ms[name] if name in ('owner','outer') else plan.maintained_parent_budget_seconds*1000
            _need(stop-start<=limit,'UNCHANGED_OR_EXPLICIT_INTERVAL_CEILING')
            parent=next((parent_row for parent_row in seen.values() if parent_row['roleBinding']['child']==role['parent']),None)
            if name!='owner':
                _need(parent is not None and start>=parent['issuedAtMs'] and stop<=parent['supervisionCutoffMs'],'NESTED_ORIGINAL_SUPERVISION')
            seen[name]=row
        self._body=raw
        self._expected_body=json.dumps(expected,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
        self._ceilings=tuple(sorted(external_ceilings_ms.items()))

    @property
    def origin_id(self):return F._load(self._body)['originId']

    def edge(self,name):
        _need(type(name) is str and name in _NAMES,'DECLARED_EXECUTION_EDGE')
        return F._load(self._body)['edges'][_NAMES.index(name)]

    def expected(self):return F._load(self._expected_body)

    def reference(self):
        return dict(path=P._ROOT+'\\capture-external-execution-policy-v1.json',bytes=len(self._body),sha256=hashlib.sha256(self._body).hexdigest())

    def descriptor(self,name):
        expected=self.expected();row=self.edge(name)
        return dict(policyPin=self.reference(),sourceIdentityKind=expected['sourceIdentityKind'],
            sourcePlanPin=expected['sourcePlanPin'],reviewPin=expected['reviewPin'],originId=self.origin_id,
            window=row,ownerDeadlineMs=row['supervisionCutoffMs'])

class _ElapsedClockV1:
    __slots__=('_policy','_parent','_provider','_lock','_minimum','_last','_error','_callable','_owned')

    def __init__(self,policy,parent,*,provider,origin_id,minimum_observed_ms,lock):
        _need(type(policy) is _ExecutionPolicyV1,'EXACT_EXECUTION_POLICY')
        owned=tuple(name for name in _NAMES if policy.edge(name)['roleBinding']['parent']==parent)
        _need(type(parent) is str and bool(owned) and callable(provider) and origin_id==policy.origin_id,'ORIGINAL_PARENT_ORIGIN_PROVIDER')
        _need(_uint(minimum_observed_ms) and all(minimum_observed_ms>=policy.edge(name)['issuedAtMs'] for name in owned),'DECLARED_RECEIPT_FLOOR')
        _need(callable(getattr(lock,'__enter__',None)) and callable(getattr(lock,'__exit__',None)),'SHARED_CLOCK_SERIALIZATION')
        self._policy=policy;self._parent=parent;self._provider=provider;self._lock=lock
        self._minimum=minimum_observed_ms;self._last=None;self._error=None;self._owned=owned
        def sample():
            with self._lock:
                if self._error is not None:raise self._error
                try:
                    now=self._provider()
                    _need(_uint(now) and now>=self._minimum and (self._last is None or now>=self._last),'ORIGINAL_MONOTONE_ELAPSED_COORDINATE')
                    self._last=now;return now
                except BaseException as error:
                    self._error=error;raise
        self._callable=sample

    @property
    def now_ms(self):return self._callable
    @property
    def error(self):return self._error
    @property
    def parent(self):return self._parent
    @property
    def policy(self):return self._policy
    @property
    def lock(self):return self._lock
    @property
    def origin_id(self):return self._policy.origin_id

    def remaining(self,name,phase):
        _need(type(name) is str and name in self._owned and phase in ('WORK','CLEANUP'),'OWNED_EXECUTION_PHASE')
        row=self._policy.edge(name);now=self.now_ms()
        stop=row['workCutoffMs'] if phase=='WORK' else row['supervisionCutoffMs']
        return max(0,stop-now)

    def snapshot(self):
        with self._lock:
            return dict(kind='SIREN_EXTERNAL_CLOCK_RECEIPT_V1',parent=self._parent,originId=self._policy.origin_id,
                minimumObservedMs=self._minimum,lastObservedMs=self._last,clockUnavailable=self._error is not None,
                nativeEligibility=False,clockAuthenticated=False,sourceCustody=False,wholeAttempt=False)
