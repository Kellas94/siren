"""Actual new lower production at the owned C0 scheduling point, then fixed readers."""
import copy,hashlib,json,unittest
def integration_layer(state,role):
    if state is None:return None
    name='report' if role=='c0' else 'observation'
    def diag(error):return dict(type=type(error).__name__,message=str(error))
    return dict(value=state[name],sealed=None if state[name+'_raw'] is None else c0_raw_file(role+'-sealed',state[name+'_raw']),
        pin=state[name+'_pin'],timedRecord=state['timed_record'],lifecycle=state['lifecycle'],cleanup=state['cleanup'],phase=state['phase'],
        primary=None if state['primary'] is None else dict(operation=state['primary'][0],error=diag(state['primary'][1])),
        secondary=[dict(operation=n,error=diag(e)) for n,e in state['secondary']],
        retainedInputs=[dict(reference=dict(r['reference']),file=c0_raw_file(role+'-retained:'+r['reference']['label'],r['body'])) for r in state['retained_inputs']],
        retainedInputBytes=state['retained_input_bytes'],delivery={k:diag(v) if k=='error' and v is not None else v for k,v in state['delivery'].items()})

def integration_observe(label,f,state):
    extra=dict(c0Integration=integration_layer(f.c0_state,'c0'),t0Integration=integration_layer(state,'t0'),
        integrationEvents=dict(t0=list(f.events),c0=list(f.c0.events)),integrationClockCalls=list(f.provider_calls),
        integrationTransport=list(f.transport),integrationInputPorts=dict(business=getattr(f.c0,'business_input',None),c0=getattr(f.c0,'publish_input',None),t0=getattr(f,'publish_input',None)),actualNativePorts=False)
    # business_observe_v2 owns the supplied flags itself.
    extra.pop('actualNativePorts')
    if hasattr(f.g,'namespaces'):business_observe_v2('integrated-'+label,f.g,**extra)
    else:SEMANTIC_OBSERVATIONS.append(dict(case='integrated-before-lower-production-'+label,**extra,actualNativePorts=False))

class IntegratedChecks(unittest.TestCase):
    def tearDown(self):restore_focus_worlds()
    def test_actual_new_business_c0_report_revalidation_and_t0_observation(self):
        f=t0_case_integrated();state=f.run();integration_observe('positive',f,state)
        self.assertIsNotNone(f.c0_state,'ACTUAL_C0_MUST_RETURN')
        self.assertIsNone(f.c0_state['primary'],'C0_LIFECYCLE_MUST_REACH_BUSINESS')
        self.assertTrue(hasattr(f.g,'outer_row'),'ACTUAL_NEW_BUSINESS_MUST_BE_PRODUCED')
        self.assertIsNone(f.g.primary);self.assertIsNone(f.g.outer_primary)
        decision=BusinessChecks.pub(self,f.g)
        self.assertEqual(decision['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE','GENUINE_V2_BUSINESS_PRECONDITION')
        self.assertEqual(f.c0_state['publication']['status'],'READ',
            'V2_BUSINESS_PUBLICATION_MUST_PASS_FIXED_C0: '+str(f.c0_state['report']['secondary']))
        self.assertEqual(f.c0_state['publication']['decision']['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')
        self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_OBSERVATION_COMPLETE')
        self.assertEqual(state['report_readback']['decision']['classification'],'SUPPLIED_C0_FIVE_BUSINESS_REPORT_COMPLETE')
        self.assertEqual(state['observation']['stage'],'SUPPLIED_FIVE_BUSINESS_TERMINAL_OBSERVATION_COMPLETE')
        self.assertTrue(state['delivery']['accepted']);self.assertTrue(f.c0_state['delivery']['accepted'])
        self.assertIs(f.g.context,f.c0.g.context);self.assertIs(f.g.business_context._context,f.g.context)
        self.assertIs(f.clock.policy,f.c0.policy);self.assertIs(f.c0.policy,f.g.policy)
        self.assertIs(f.clock._provider,f.c0.clock._provider)
        self.assertIs(f.clock._provider,f.g.clocks['outer']._provider)
        self.assertIs(f.clock._provider,f.g.clocks['inner']._provider)
        self.assertEqual(f.g.clocks['outer'].snapshot()['minimumObservedMs'],f.c0_state['report']['clockChecks'][0]['nowMs'])
        self.assertEqual((state['observation']['originalC0Identity']['pid'],f.c0_state['report']['originalOuterIdentity']['pid'],f.g.outer_row['identity']['pid']),(888,777,99))
        self.assertEqual(len(f.c0_state['retained_inputs']),21)
        self.assertEqual(f.inline_calls,1)
        self.assertEqual(f.c0.events.count('actual-business-enter-after-outer-resume'),1)
        self.assertLess(f.c0.events.index('actual-business-returned-before-outer-eof'),f.c0.events.index('read-publication-after-finalization'))
