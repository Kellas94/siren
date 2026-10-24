"""Integrated refusal, sealed-delivery and shared actor-reservation controls."""
import copy,hashlib,json,unittest
class IntegratedAdverseChecks(unittest.TestCase):
    def tearDown(self):restore_focus_worlds()
    def observed(self,label,configure):
        f=t0_case_integrated();configure(f);state=f.run()
        try:integration_observe(label,f,state)
        finally:restore_focus_worlds()
        return f,state
    def test_clean_owner_does_not_hide_adverse_missing_or_foreign_business(self):
        for mode in ('ADVERSE','UNAVAILABLE','FOREIGN_PRODUCER'):
            with self.subTest(mode=mode):
                f,s=self.observed('business-'+mode,lambda f:setattr(f.c0,'publication_mode',mode))
                self.assertEqual(BusinessChecks.pub(self,f.g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')
                self.assertEqual(s['lifecycle']['classification'],'CLEAN_INERT')
                self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_ADVERSE')
                self.assertEqual(s['observation']['stage'],'SUPPLIED_T0_FIVE_BUSINESS_ADVERSE')
    def test_report_rechecks_floor_body_order_and_original_producer(self):
        for mode in ('TAMPER','REORDER','FOREIGN_ID','FOREIGN_ROLE'):
            with self.subTest(mode=mode):
                f,s=self.observed('report-'+mode,lambda f:setattr(f,'read_mode',mode))
                self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_OBSERVATION_COMPLETE')
                self.assertEqual(s['lifecycle']['classification'],'CLEAN_INERT');self.assertEqual(f.read_count,1)
                self.assertEqual(s['observation']['stage'],'SUPPLIED_T0_FIVE_BUSINESS_ADVERSE')
                self.assertTrue(any(r['reference']['label']=='c0.report' for r in s['retained_inputs']))
    def test_nonzero_and_still_active_owner_are_not_report_completion(self):
        for code in (23,259):
            with self.subTest(code=code):
                f,s=self.observed('owner-exit-'+str(code),lambda f:setattr(f,'observed_code',code))
                self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_OBSERVATION_COMPLETE')
                self.assertEqual(s['lifecycle']['exitCode'],code);self.assertEqual(f.read_count,0)
                self.assertEqual(s['observation']['stage'],'SUPPLIED_T0_FIVE_BUSINESS_ADVERSE')
    def test_missing_owner_eof_retains_original_read_and_blocks_report(self):
        f,s=self.observed('owner-pending-eof',lambda f:setattr(f,'missing_eof',True))
        self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_OBSERVATION_COMPLETE')
        self.assertEqual(f.read_count,0);self.assertIsNone(s['capture_bodies'])
        self.assertIsNotNone(s['edge'].q.readers['stderr'].read_ticket)
        self.assertEqual(s['observation']['stage'],'SUPPLIED_T0_FIVE_BUSINESS_ADVERSE')
    def test_original_clock_failure_after_report_read_stays_sticky(self):
        error=RuntimeError('INTEGRATED_ORIGINAL_CLOCK_AFTER_READ')
        def fault(f):f.clock_error=error;f.fail_clock_after_read=True
        f,s=self.observed('sticky-clock-after-read',fault)
        self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_FIVE_BUSINESS_OBSERVATION_COMPLETE')
        self.assertIs(f.clock.error,error);self.assertEqual(f.clock_error_calls,['provider-failure'])
        self.assertTrue(s['report_readback']['rawRetained']);self.assertFalse(s['delivery']['attempted'])
        f.fail_clock=False
        with self.assertRaises(RuntimeError) as raised:f.clock.now_ms()
        self.assertIs(raised.exception,error);self.assertEqual(f.clock_error_calls,['provider-failure'])
    def test_late_or_throwing_observation_delivery_keeps_original_sealed_bytes(self):
        for mode in ('throw','wrong','late'):
            error=RuntimeError('INTEGRATED_DELIVERY_ORIGINAL')
            def fault(f):
                if mode=='throw':f.publish_error=error
                elif mode=='wrong':f.publish_wrong=True
                else:f.late_publish=True
            with self.subTest(mode=mode):
                f,s=self.observed('delivery-'+mode,fault)
                self.assertEqual(s['observation']['stage'],'SUPPLIED_FIVE_BUSINESS_TERMINAL_OBSERVATION_COMPLETE')
                self.assertEqual(len(f.published),1);self.assertEqual(f.published[0],s['observation_raw'])
                self.assertEqual(json.loads(s['observation_raw']),s['observation']);self.assertFalse(s['delivery']['accepted'])
                if mode=='throw':self.assertIs(s['delivery']['error'],error)
    def test_cross_protocol_readers_refuse_without_widening_v1(self):
        f,s=self.observed('cross-reader-contracts',lambda f:None)
        state=f.c0_state;inputs=tuple(dict(label=r['reference']['label'],body=r['body']) for r in state['retained_inputs'])
        old=C0READ.read_supplied_c0_report(state['report_raw'],expected_pin=state['report_pin'],context=f.g.context,policy=f.g.policy,business_context=f.g.business_context,runtime_inputs=inputs)
        self.assertEqual(old['classification'],'RAW_REPORT_NOT_COMPLETE');self.assertEqual(old['raw'],state['report_raw'])
        legacy=c0_case();old_state=legacy.run()
        try:
            legacy_inputs=tuple(dict(label=r['reference']['label'],body=r['body']) for r in old_state['retained_inputs'])
            new=C0FIVE_READ.read_supplied_c0_five_business_report_v2(old_state['report_raw'],expected_pin=old_state['report_pin'],context=legacy.g.context,policy=legacy.policy,business_context=legacy.g.business_context,runtime_inputs=legacy_inputs)
            self.assertEqual(old_state['report']['stage'],'SUPPLIED_C0_OBSERVATION_COMPLETE')
            self.assertEqual(new['classification'],'RAW_REPORT_NOT_COMPLETE');self.assertEqual(new['raw'],old_state['report_raw'])
            c0_observe('legacy-report-for-new-reader-refusal',legacy,old_state)
        finally:restore_focus_worlds()
    def test_pre_parent_failure_reserves_actor_across_both_protocols(self):
        for role in ('c0','t0'):
            for direction in ('old-to-new','new-to-old'):
                with self.subTest(role=role,direction=direction):
                    f=c0_case_integrated() if role=='c0' else t0_case_integrated()
                    old=C0RUN.run_c0_supplied if role=='c0' else T0RUN.run_t0_supplied
                    new=C0V2.run_c0_five_business_v2 if role=='c0' else T0V2.run_t0_five_business_v2
                    first,second=(old,new) if direction=='old-to-new' else (new,old)
                    state=first(**dict(f.arguments,runtime={}))
                    self.assertIsNone(state['parent']);self.assertEqual(state['primary'][0],'PARENT_CONSTRUCTION')
                    actor='C0' if role=='c0' else 'T0';self.assertNotIn(actor,f.g.context._parents)
                    before=list(f.effects);returned=None;error=None
                    try:returned=second(**f.arguments)
                    except ValueError as caught:error=caught
                    record=dict(case='integration-cross-reservation',role=role,direction=direction,firstLayer=integration_layer(state,role),
                        secondLayer=integration_layer(returned,role),beforeEffects=before,afterEffects=list(f.effects),
                        secondError=None if error is None else dict(type=type(error).__name__,message=str(error)),actualNativePorts=False)
                    SEMANTIC_OBSERVATIONS.append(record);restore_focus_worlds()
                    self.assertIsNotNone(error,'CROSS_VERSION_ACTOR_RESERVATION_MUST_REFUSE')
                    self.assertIn('LOCAL_RUN_ALREADY_RESERVED',str(error));self.assertEqual(f.effects,before)
