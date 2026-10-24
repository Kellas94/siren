"""New supplied controls over actual maintained semantic producers/predicates."""
import copy,hashlib,json,unittest
SEMANTIC_OBSERVATIONS=[]

def semantic_observe(label,f,**extra):
    inputs={key:dict(bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),hex=body.hex())
        for key,body in f.packet_inputs.items() if key.endswith('_raw')}
    SEMANTIC_OBSERVATIONS.append(dict(case=label,transportInputs=inputs,
        domains=f.business_context.snapshot(),header=f.context.binding('inner'),
        innerRawHex=None if not hasattr(f,'row') else _encoded(f.row).hex(),
        outerRawHex=None if not hasattr(f,'outer_row') else _encoded(f.outer_row).hex(),
        captureBodies={name:None if bodies is None else [dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),hex=b.hex()) for b in bodies] for name,bodies in f.bodies.items()},
        effects=list(f.effect_events),ioEvents=list(f.io_events),order=list(f.order),
        actualNativePorts=False,sourceCustody=False,wholeSourceGatePassed=False,wholeAttempt=False,**extra))

class SemanticChecks(unittest.TestCase):
    def tearDown(self):restore_focus_worlds()
    def positive(self):
        f=focus_case();f.run()
        self.assertIsNone(f.primary);self.assertEqual(f.secondary,[])
        self.assertTrue(f.c.inner_direct_completion(f.row,f.source_sha,f.identities['inner'],f.env['edges']))
        f.outer();return f
    def test_00_native_constructor_and_effect_guards(self):
        for ctor,args in [(T._StartupStorage,(None,)*6),(NATIVE.NativeFacade,()),(TOPOLOGY.NativeTopologyFacade,()),(ESCAPE.NativeEscapeFacade,())]:
            try:
                with self.assertRaisesRegex(RuntimeError,'SEMANTIC_NATIVE_CONSTRUCTOR_DENIED'):ctor(*args)
            finally:REARM_PROFILE()
        for event,message in [('ctypes.dlopen','SEMANTIC_DLL_DENIED'),('subprocess.Popen','SEMANTIC_PROCESS_DENIED')]:
            with self.assertRaisesRegex(RuntimeError,message):sys.audit(event,'supplied-semantic-calibration')
        self.assertIs(sys.getprofile(),PROFILE_FUNCTION)
    def test_actual_focus_cancel_retirement_and_outer_semantics(self):
        f=self.positive();self.assertEqual(f.order,['readiness','focus','c1'])
        self.assertEqual((f.seed.focusDispatches,f.seed.dispatches),(1,1))
        self.assertTrue(f.outer_ns['outer_direct_completion'](f.outer_row,f.source_sha,f.edges['inner']))
        self.assertEqual(set(f.outer_ns['_direct_saved_read_started']),{'electron','ui'})
        self.assertTrue(all(len(body)>0 for bodies in f.bodies.values() for body in bodies[:2]))
        semantic_observe('actual-business-semantic-closure',f,accepted=True)
    def test_real_external_header_and_business_expectations_stay_separate(self):
        f=self.positive()
        self.assertEqual(f.header_raw,f.packet_inputs['header_raw']);self.assertEqual(f.context_raw,f.packet_inputs['context_raw'])
        self.assertEqual(f.context.source_sha,SUPPLY['plan_pin']['sha256'])
        self.assertEqual(f.business_context.source_sha,'a'*64)
        for name,edge in f.edges.items():self.assertEqual(edge.q.capture._binding,f.context.binding(name))
        self.assertIs(f.cns['_direct_parent'].context,f.context)
        self.assertIs(f.cns['_direct_expected'],f.business_context)
        semantic_observe('external-header-not-relabeled',f)
    def test_clean_capture_cannot_hide_adverse_semantic_proof(self):
        f=self.positive();bad=copy.deepcopy(f.outer_row)
        bad['inner']['proof']['directFocusPortRetirement']['retirementConfirmed']=False
        self.assertTrue(DX.edge_value(bad['innerEdge'],f.bodies['inner'],f.business_context)['classification']=='CLEAN_INERT')
        self.assertFalse(f.outer_ns['outer_direct_completion'](bad,f.source_sha,f.edges['inner']))
        semantic_observe('clean-capture-adverse-business-proof',f,mutatedOuterRawHex=_encoded(bad).hex(),accepted=False)
    def test_actual_saved_child_substitution_refuses(self):
        f=self.positive();ref=f.row['edgeOutcomes']['electron']['bodyAvailability']['stdout']['reference'];body=f.files[ref['path']]
        bad=bytes([body[0]^1])+body[1:];f.files[ref['path']]=bad
        self.assertFalse(f.outer_ns['outer_direct_completion'](f.outer_row,f.source_sha,f.edges['inner']))
        self.assertEqual(set(f.outer_ns['_direct_saved_read_started']),{'electron'})
        semantic_observe('actual-saved-child-substitution-refused',f,changedBody=dict(path=ref['path'],bytes=len(bad),sha256=hashlib.sha256(bad).hexdigest(),hex=bad.hex()))
    def test_focus_primary_failure_has_no_cancel_or_quit_publication(self):
        f=focus_case();error=RuntimeError('SUPPLIED_SEMANTIC_FOCUS_FAILURE')
        f.seed.w.throw_name='SendMessageTimeoutW';f.seed.w.native_error=error;f.run();f.outer()
        self.assertIs(f.primary,error);self.assertEqual(f.seed.dispatches,0)
        self.assertFalse(f.outer_ns['outer_direct_completion'](f.outer_row,f.source_sha,f.edges['inner']))
        self.assertFalse(any(kind=='publish' and path.endswith(('cancel-issued.json','go-quit.json')) for kind,path in f.io_events))
        semantic_observe('exact-focus-primary-no-cancel-or-quit',f,accepted=False)
    def test_wrong_business_source_refuses_same_capture(self):
        f=self.positive();self.assertFalse(f.outer_ns['outer_direct_completion'](f.outer_row,f.context.source_sha,f.edges['inner']))
        self.assertEqual(f.outer_ns['_direct_saved_read_started'],set())
        semantic_observe('wrong-business-source-refused',f,accepted=False)
