"""Missing opt-in APIs and preserved v1 child-parent refusal; supplied values only."""
import hashlib,unittest

def five_policy(f):
    expected=dict(sourceIdentityKind=f.context.source_identity_kind,sourcePlanPin=f.context.source_plan_pin,reviewPin=f.context.review_pin,
        roleBindings={n:f.context.role_binding(n) for n in ('owner','outer','inner','electron','ui')})
    value=dict(schema=1,kind='SIREN_EXTERNAL_EXECUTION_POLICY_V1',sourceIdentityKind=expected['sourceIdentityKind'],
        sourcePlanPin=expected['sourcePlanPin'],reviewPin=expected['reviewPin'],originId='e'*32,
        edges=[dict(roleBinding=expected['roleBindings'][n],issuedAtMs=i,workCutoffMs=w,supervisionCutoffMs=s) for n,(i,w,s) in
            zip(('owner','outer','inner','electron','ui'),[(0,5000,6000),(100,4500,5000),(200,3500,4000),(300,1000,2000),(300,900,1800)])])
    raw=_encoded(value);pin=dict(path=P._ROOT+'\\capture-external-execution-policy-v1.json',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
    return XP._ExecutionPolicyV1(raw,expected=expected,expected_pin=pin,external_ceilings_ms=dict(owner=6000,outer=4900)),raw,pin

class FiveRoleAPIChecks(unittest.TestCase):
    def presence(self,symbol,name):
        present=callable(getattr(globals().get(symbol),name,None))
        SEMANTIC_OBSERVATIONS.append(dict(case='five-role-api-presence',symbol=symbol,name=name,present=present))
        self.assertTrue(present,'explicit five-role API is absent: '+symbol+'.'+name)
    def test_parent_factory_api_exists(self):self.presence('CX','from_five_role_execution_v2')
    def test_timing_type_api_exists(self):self.presence('TM','_FiveRoleTimingV2')
    def test_edge_reader_api_exists(self):self.presence('DX','five_role_edge_value_v2')
    def test_timed_reader_api_exists(self):self.presence('TR','read_five_role_v2')
    def test_existing_v1_refuses_child_parent_before_sample_or_claim(self):
        f=context_case();policy,raw,pin=five_policy(f);lock=C0ProbeLock();memory=K.Memory();port=U.Exports(memory,lock);events=[];port.events=events
        runtime=dict(memory=memory,layouts=f.layouts,kernel=port.kernel,crt=port.crt,lock=lock,budget=C._Budget());calls=[]
        def provider():calls.append('provider');return 800
        clock=XP._ElapsedClockV1(policy,'inner',provider=provider,origin_id=policy.origin_id,minimum_observed_ms=750,lock=lock)
        with self.assertRaises(ValueError) as caught:CX.from_external_execution_v1(supplied_context=f.context,policy=policy,clock=clock,runtime=runtime,components=f.components)
        self.assertEqual(f.context._parents,{});self.assertEqual(calls,[]);self.assertEqual(events,[])
        SEMANTIC_OBSERVATIONS.append(dict(case='existing-v1-child-parent-refusal',error=str(caught.exception),parents=[],providerCalls=list(calls),effects=list(events),
            policyRawHex=raw.hex(),policyPin=pin,inputPins={k:dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),hex=b.hex()) for k,b in f.packet_inputs.items() if k.endswith('_raw')},
            actualNativePorts=False,wholeAttempt=False))
