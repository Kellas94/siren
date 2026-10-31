"""Original T0 lifecycle and independent report readback through supplied ports."""
import json,unittest
class T0Checks(unittest.TestCase):
    def tearDown(self):restore_focus_worlds()
    def test_owner_observation_api_exists(self):
        present=callable(getattr(globals().get('T0RUN'),'run_t0_supplied',None))
        SEMANTIC_OBSERVATIONS.append(dict(case='t0-owner-observation-api-presence',present=present));self.assertTrue(present)
    def test_original_c0_exit_late_stderr_and_report_all_join(self):
        f=t0_case();state=f.run();obs=state['observation']
        self.assertEqual(obs['stage'],'SUPPLIED_TERMINAL_OBSERVATION_COMPLETE');self.assertTrue(state['delivery']['accepted'])
        self.assertEqual((f.inline_calls,f.read_count,len(f.published)),(1,1,1));self.assertEqual(f.waits[0]['timeoutMs'],4200)
        self.assertEqual((obs['originalC0Identity']['pid'],f.c0_state['report']['originalOuterIdentity']['pid'],f.g.outer_row['identity']['pid']),(888,777,99))
        self.assertEqual(state['capture_bodies'][1],b'before-report\nlate-after-report\x00\r\n')
        self.assertTrue(obs['c0ExitAvailable']);self.assertEqual(obs['c0ExitCode'],0)
        self.assertEqual(obs['reportReadback']['decision']['classification'],'SUPPLIED_C0_REPORT_COMPLETE')
        self.assertEqual(f.clock._provider,f.c0.clock._provider)
        self.assertTrue(all(obs[k] is False for k in T0RUN._FLAGS));self.assertEqual((f.lock.reentries,f.c0.lock.reentries),(0,0))
        self.assertLess(f.events.index('inline-c0-returned-with-sealed-report'),f.events.index('owner-stderr-suffix-after-c0-seal'))
        self.assertEqual(json.loads(state['observation_raw']),obs);t0_observe('t0-original-owner-late-stream-and-report',f,state)
    def test_available_nonzero_and_259_exit_never_reuse_complete_report(self):
        for code in (23,259):
            f=t0_case();f.observed_code=code;state=f.run()
            self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE');self.assertEqual(state['lifecycle']['exitCode'],code)
            self.assertTrue(state['observation']['c0ExitAvailable']);self.assertEqual(f.read_count,0)
            self.assertEqual(f.c0_state['report']['stage'],'SUPPLIED_C0_OBSERVATION_COMPLETE')
            t0_observe('t0-available-exit-'+str(code),f,state);restore_focus_worlds()
    def test_missing_eof_keeps_original_pending_read_and_no_report_gate(self):
        f=t0_case();f.missing_eof=True;state=f.run()
        self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE');self.assertEqual(f.read_count,0)
        self.assertIsNotNone(state['edge'].q.readers['stderr'].read_ticket);self.assertIsNone(state['capture_bodies'])
        t0_observe('t0-unresolved-stderr-EOF',f,state)
    def test_report_unavailable_tampered_and_wrong_producer_or_roster_refuse(self):
        for mode in ('UNAVAILABLE','TAMPER','FOREIGN_ID','FOREIGN_ROLE','REORDER','BOOL'):
            f=t0_case();f.read_mode=mode;state=f.run()
            self.assertEqual(state['lifecycle']['classification'],'CLEAN_INERT');self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE')
            self.assertEqual(f.read_count,1);t0_observe('t0-report-'+mode.lower(),f,state);restore_focus_worlds()
    def test_owner_timeout_retains_original_4200_and_1000_cleanup(self):
        f=t0_case()
        def timeout(*unused):f.c0.coordinate=5000;return 258
        f.port.override['WaitForSingleObject']=[timeout];state=f.run()
        self.assertEqual([r['timeoutMs'] for r in state['timed_record']['waits']],[4200,1000])
        self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE');self.assertEqual(f.read_count,0)
        t0_observe('t0-original-owner-timeout-cleanup',f,state)
    def test_receipt_floor_and_same_origin_future_report_cannot_reset_time(self):
        for which in ('floor','future'):
            f=t0_case()
            if which=='floor':f.c0_floor_delta=-1
            else:f.c0_skew=100
            state=f.run();self.assertEqual(state['lifecycle']['classification'],'CLEAN_INERT')
            self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE')
            self.assertTrue(any('ORIGINAL_T0_C0_RECEIPT_READ_ORDER' in str(e) for _,e in state['secondary']))
            t0_observe('t0-declared-clock-'+which,f,state);restore_focus_worlds()
    def test_late_inline_or_read_return_cannot_extend_original_cutoffs(self):
        for which in ('inline','read'):
            f=t0_case()
            if which=='inline':f.late_inline=True
            else:f.late_read=True
            state=f.run();self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE')
            if which=='inline':self.assertEqual(f.read_count,0)
            else:
                self.assertTrue(state['report_readback']['rawRetained']);self.assertFalse(state['delivery']['attempted'])
            t0_observe('t0-late-'+which+'-return',f,state);restore_focus_worlds()
    def test_sticky_original_clock_failure_before_work_and_after_read(self):
        for phase in ('initial','after-read'):
            f=t0_case();error=RuntimeError('T0_ORIGINAL_CLOCK_'+phase);f.clock_error=error
            if phase=='initial':f.fail_clock=True
            else:f.fail_clock_after_read=True
            state=f.run();self.assertIs(f.clock.error,error);self.assertEqual(f.clock_error_calls,['provider-failure'])
            self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE');self.assertFalse(state['delivery']['attempted'])
            if phase=='initial':self.assertIs(state['primary'][1],error);self.assertEqual(f.effects,[])
            else:self.assertTrue(state['report_readback']['rawRetained'])
            t0_observe('t0-sticky-clock-'+phase,f,state);restore_focus_worlds()
    def test_original_factory_errors_and_one_use_are_retained(self):
        for field in ('security_error','startup_error','identity_error'):
            f=t0_case();error=RuntimeError('T0_'+field);setattr(f,field,error);state=f.run()
            self.assertIs(state['primary'][1],error);self.assertEqual(state['observation']['stage'],'SUPPLIED_T0_ADVERSE')
            before=list(f.effects)
            with self.assertRaisesRegex(ValueError,'LOCAL_RUN_ALREADY_RESERVED'):f.run()
            self.assertEqual(f.effects,before);t0_observe('t0-exact-'+field,f,state);restore_focus_worlds()
    def test_partial_construction_and_cleanup_do_not_replace_primary(self):
        f=t0_case();error=RuntimeError('T0_PARTIAL_BACKEND');original=B._Backend
        def fail(*unused):raise error
        B._Backend=fail
        try:state=f.run()
        finally:B._Backend=original
        self.assertIs(state['primary'][1],error);self.assertIsNone(state['edge']);self.assertIsNotNone(state['parent']._attempts['owner']['capture'])
        self.assertEqual(state['cleanup'],'NO_EDGE_RETURNED');t0_observe('t0-partial-original-backend',f,state)
        restore_focus_worlds()
        f=t0_case();primary=RuntimeError('T0_PRIMARY_BEFORE_CLEANUP');cleanup=RuntimeError('T0_CLEANUP_UNKNOWN');f.security_error=primary
        original=A._OwnedEdge.finalize
        def cleanup_fail(*unused):raise cleanup
        A._OwnedEdge.finalize=cleanup_fail
        try:state=f.run()
        finally:A._OwnedEdge.finalize=original
        self.assertIs(state['primary'][1],primary);self.assertTrue(any(e is cleanup for _,e in state['secondary']))
        self.assertEqual(state['cleanup'],'RAISED');t0_observe('t0-cleanup-error-separate-original-primary',f,state)
    def test_nested_publication_reentry_and_failed_delivery_never_rewrite(self):
        for mode in ('nested','throw','wrong','late'):
            f=t0_case();original=f.arguments['publish_observation']
            if mode=='nested':
                def publish(raw):
                    before=list(f.effects)
                    with self.assertRaisesRegex(ValueError,'LOCAL_RUN_ALREADY_RESERVED'):f.run()
                    self.assertEqual(f.effects,before);return original(raw)
                f.arguments['publish_observation']=publish
            elif mode=='throw':f.publish_error=RuntimeError('T0_DELIVERY_UNKNOWN')
            elif mode=='wrong':f.publish_wrong=True
            else:f.late_publish=True
            state=f.run();self.assertEqual(len(f.published),1)
            self.assertEqual(state['observation']['stage'],'SUPPLIED_TERMINAL_OBSERVATION_COMPLETE')
            self.assertEqual(f.published[0],state['observation_raw']);self.assertEqual(json.loads(state['observation_raw']),state['observation'])
            if mode!='nested':self.assertFalse(state['delivery']['accepted'])
            t0_observe('t0-delivery-'+mode,f,state);restore_focus_worlds()
