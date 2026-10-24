"""Fresh coupled production, literal readback, original-time faults and preservation."""
import copy,hashlib,json,unittest

class BusinessChecks(unittest.TestCase):
    def tearDown(self):restore_focus_worlds()
    def pub(self,g,raw=None):
        raw=g.files[P._ROOT+'\\execution\\result.json'] if raw is None else raw
        electron=g.bodies.get('electron')
        return PUB.read_outer_publication_v2(raw,expected_pin=dict(path=P._ROOT+'\\execution\\result.json',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()),context=g.business_context,policy=g.policy,
            artifacts=None if electron is None else dict(journal=g.files[P._ROOT+'-image\\picker-parent-observation.jsonl'],stdout=electron[0],stderr=electron[1]),inner_bodies=g.bodies['inner'],child_bodies={n:g.bodies[n] for n in ('electron','ui')})
    def positive(self):
        g=focus_business_case_v2();g.run();self.assertIsNone(g.primary);self.assertEqual(g.secondary,[])
        g.outer();self.assertIsNone(g.outer_primary);self.assertEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE');return g

    def test_actual_v2_production_from_readiness_through_literal_publication(self):
        g=self.positive();business_observe_v2('actual-coherent-production',g,decision=self.pub(g))
        self.assertEqual(g.order,['readiness','focus','c1']);self.assertEqual((g.seed.focusDispatches,g.seed.dispatches),(1,1))
        self.assertEqual(g.row['kind'],'SIREN_FIVE_ROLE_INNER_RESULT_V2');self.assertEqual(g.outer_row['kind'],'SIREN_FIVE_ROLE_OUTER_RESULT_V2')
        self.assertIs(g.row['edgeOutcomes'],g.env['settlements']);self.assertIs(g.row['proof']['directFocusPortRetirement']['originalEdgeOutcome'],g.row['edgeOutcomes']['electron'])
        self.assertTrue(all(g.rows[n]['kind']=='SIREN_FIVE_ROLE_TIMED_EDGE_V2' for n in ('inner','electron','ui')))
        self.assertEqual(_encoded(g.outer_row),g.files[P._ROOT+'\\execution\\result.json'])

    def test_shared_original_provider_receipt_floor_budget_and_deferred_eof(self):
        g=focus_business_case_v2()
        self.assertEqual(g.streams_finished,set());self.assertGreater(g.held_electron['held'],0);self.assertGreater(g.held_both['held'],g.held_electron['held'])
        self.assertIs(g.clocks['outer']._provider,g.clocks['inner']._provider);self.assertIs(g.clocks['inner']._provider,g.clock_provider)
        self.assertEqual(g.clocks['inner'].snapshot()['minimumObservedMs'],1000)
        self.assertEqual(g.clocks['inner'].snapshot()['minimumObservedMs'],g.provider_samples[0])
        self.assertNotEqual(g.edges['electron'].q.owner._deadline_ms,g.edges['ui'].q.owner._deadline_ms)
        g.run();g.outer();business_observe_v2('deferred-eof-original-provider',g)
        events=g.io_events;quit_i=next(i for i,e in enumerate(events) if e[0]=='publish' and e[1].endswith('go-quit.json'))
        inner_i=next(i for i,e in enumerate(events) if e[0]=='write' and e[1].endswith('inner-result.json'))
        self.assertTrue(all(i>quit_i for i,e in enumerate(events) if e[0]=='supplied-stream-eof' and e[1] in ('electron','ui')))
        self.assertTrue(all(i>inner_i for i,e in enumerate(events) if e[0] in ('supplied-original-inner-wait',) or e==('supplied-stream-eof','inner')))

    def test_original_focus_error_prevents_c1_and_complete_publication(self):
        g=focus_business_case_v2();error=RuntimeError('FIVE_BUSINESS_FOCUS_PRIMARY');g.seed.w.throw_name='SendMessageTimeoutW';g.seed.w.native_error=error
        g.run();g.outer();business_observe_v2('focus-original-primary',g)
        self.assertIs(g.primary,error);self.assertEqual(g.seed.dispatches,0)
        self.assertFalse(any(e[0]=='publish' and e[1].endswith(('cancel-issued.json','go-quit.json')) for e in g.io_events))
        self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_missing_ui_eof_retains_pending_reads_despite_available_exit(self):
        g=focus_business_case_v2();g.skip_finish={'ui'};g.run();g.outer();business_observe_v2('missing-ui-eof',g)
        self.assertTrue(any(r.read_ticket is not None for r in g.edges['ui'].q.readers.values()))
        self.assertNotEqual(g.row['stage'],'cancel-inner-five-role-complete');self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_available_nonzero_and_259_are_not_semantic_completion(self):
        for code in (23,259):
            g=focus_business_case_v2()
            def observed(*args,value=code):args[1].value=value;return 1
            g.exports['inner'].override['GetExitCodeProcess']=[observed]
            g.run();g.outer();business_observe_v2('ui-nonzero-'+str(code),g)
            self.assertEqual(g.rows['ui']['exitObservation'],dict(available=True,code=code))
            self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_expired_business_before_pick_dispatches_no_operation(self):
        g=focus_business_case_v2();g.seed.raw.now=15.0;g.run();business_observe_v2('expired-before-pick',g)
        self.assertIsNotNone(g.primary);self.assertEqual(g.seed.dispatches,0)
        self.assertFalse(any(e[0]=='publish' for e in g.io_events));self.assertNotIn(P._ROOT+'\\execution\\inner-result.json',g.files)

    def test_late_identity_observation_preserves_value_and_original_error(self):
        g=focus_business_case_v2();original=g.seed.facade._fn['GetProcessId']
        def late(handle):
            value=original(handle);g.seed.raw.now=15.0;return value
        g.seed.facade._fn['GetProcessId']=late;g.run();business_observe_v2('late-live-identity',g)
        call=g.cns['_five_identity_calls'][-1]
        self.assertTrue(call['returned']);self.assertIs(type(call['value']),MODEL.ProcessIdentity);self.assertIs(g.primary,call['error'])
        self.assertFalse(any(e[0]=='publish' for e in g.io_events))

    def test_sticky_original_clock_cannot_recover_with_later_valid_scalar(self):
        g=focus_business_case_v2();g.seed.raw.now=0.7;g.run();error=g.clocks['inner'].error;g.seed.raw.now=0.8;before=len(g.provider_samples)
        with self.assertRaises(ValueError) as caught:g.cns['remaining_five_v2'](15.0)
        self.assertIs(caught.exception,error);self.assertIs(g.primary,error);self.assertEqual(len(g.provider_samples),before)
        business_observe_v2('sticky-provider-regression',g)

    def test_late_saved_body_is_retained_without_installing_clean_cache(self):
        g=focus_business_case_v2();g.run();self.assertIsNone(g.primary)
        def late(parent,path,body):
            if parent=='outer' and path.name=='electron-stdout.log':g.seed.raw.now=17.5
        g.port_hooks['read_bytes']=late;g.outer();business_observe_v2('late-saved-child-body',g)
        ns=g.outer_ns;call=next(c for c in ns['_five_work_calls'] if c['operation']=='read_bytes' and c['returned'] and str(c['arguments'][0]).endswith('electron-stdout.log'))
        self.assertEqual(call['value'],g.bodies['electron'][0]);self.assertIs(g.outer_primary,call['error']);self.assertNotIn('electron',ns['_five_saved_readbacks'])
        self.assertNotIn(P._ROOT+'\\execution\\result.json',g.files)

    def test_expired_port_has_no_dispatch_and_records_actual_refusal(self):
        g=focus_business_case_v2();g.seed.raw.now=15.0;before=list(g.io_events)
        with self.assertRaises(Exception):g.cns['pin_five_v2'](g.cns['JOURNAL'])
        call=g.cns['_five_work_calls'][-1];self.assertEqual(call['state'],'RESERVED');self.assertFalse(call['returned']);self.assertEqual(g.io_events,before)
        g.run();business_observe_v2('expired-before-pin',g)

    def test_late_inner_write_keeps_delivered_literal_and_local_adverse_state_separate(self):
        g=focus_business_case_v2()
        def late(parent,path,raw):
            if parent=='inner' and path.name=='inner-result.json':g.seed.raw.now=15.0
        g.port_hooks['write']=late;g.run();business_observe_v2('late-inner-writer-return',g)
        raw=g.files[P._ROOT+'\\execution\\inner-result.json'];saved=json.loads(raw)
        self.assertEqual(saved['stage'],'cancel-inner-five-role-complete');self.assertEqual(g.row['stage'],'cancel-inner-five-role-adverse')
        call=next(c for c in g.cns['_five_work_calls'] if c['operation']=='write' and str(c['arguments'][0]).endswith('inner-result.json'))
        self.assertTrue(call['returned']);self.assertIs(g.primary,call['error'])

    def test_actual_saved_child_substitution_is_refused_and_not_healed(self):
        g=focus_business_case_v2();g.run();self.assertIsNone(g.primary);path=g.row['edgeOutcomes']['electron']['edge']['bodyAvailability']['stdout']['reference']['path'];body=g.files[path]
        changed=bytes([body[0]^1])+body[1:];g.files[path]=changed;g.outer();business_observe_v2('changed-saved-child',g,changedBody=dict(path=path,bytes=len(changed),sha256=hashlib.sha256(changed).hexdigest(),hex=changed.hex()))
        self.assertEqual(g.files[path],changed);self.assertNotIn('electron',g.outer_ns['_five_saved_readbacks']);self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_raw_type_bound_and_typed_pin_validation_do_not_trust_fixture_guards(self):
        for fault in ('bytearray','oversize','float-count','foreign-path'):
            g=focus_business_case_v2();g.run();self.assertIsNone(g.primary);ns=g.namespace('outer');original_pin=ns['_five_ports']['pin'];original_read=ns['_five_ports']['read_bytes']
            def pin_port(path):
                value=original_pin(path)
                if path.name=='inner-result.json':
                    if fault=='float-count':value['bytes']=float(value['bytes'])
                    if fault=='foreign-path':value['path']=P._ROOT+'\\execution\\foreign.json'
                return value
            def read_port(path,maximum):
                body=original_read(path,maximum)
                if path.name=='inner-result.json':
                    if fault=='bytearray':return bytearray(body)
                    if fault=='oversize':return body+b' '*(4194305-len(body))
                return body
            ns['_five_ports']['pin']=pin_port;ns['_five_ports']['read_bytes']=read_port
            g.outer();business_observe_v2('producer-return-'+fault,g)
            self.assertIsNotNone(g.outer_primary);self.assertIsNone(g.outer_env['inner'])
            expected='RAW_PROFILE' if fault in ('bytearray','oversize') else 'TYPED_BOUNDED_FIVE_INNER_PIN'
            self.assertIn(expected,str(g.outer_primary));self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_wrong_domain_timing_retirement_and_exit_literals_refuse(self):
        g=self.positive();variants=[]
        bad=copy.deepcopy(g.outer_row);bad['sourceSha256']=g.context.source_sha;variants.append(bad)
        bad=copy.deepcopy(g.outer_row);bad['inner']['proof']['directFocusPortRetirement']['retirementConfirmed']=False;variants.append(bad)
        bad=copy.deepcopy(g.outer_row);bad['inner']['edgeOutcomes']['ui']['timing']['declaration']['originId']='f'*32;variants.append(bad)
        bad=copy.deepcopy(g.outer_row);bad['inner']['proof']['directFocusPortRetirement']['originalEdgeOutcome']=copy.deepcopy(bad['inner']['edgeOutcomes']['ui']);variants.append(bad)
        bad=copy.deepcopy(g.outer_row);bad['innerEdge']['edge']['execution']['ownerDeadlineMs']+=1;variants.append(bad)
        bad=copy.deepcopy(g.outer_row);bad['directNormalExit']['exit']['code']=259;variants.append(bad)
        decisions=[self.pub(g,_encoded(v)) for v in variants]
        business_observe_v2('semantic-literal-refusals',g,mutatedRoots=[_encoded(v).hex() for v in variants],decisions=[{k:v for k,v in d.items() if k!='raw'} for d in decisions])
        self.assertTrue(all(d['classification']!='SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE' for d in decisions))

    def test_legacy_readers_and_new_readers_keep_separate_contracts(self):
        g=self.positive();raw=g.files[P._ROOT+'\\execution\\result.json'];pin=dict(path=P._ROOT+'\\execution\\result.json',bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        args=dict(expected_pin=pin,context=g.business_context,artifacts=dict(journal=g.files[P._ROOT+'-image\\picker-parent-observation.jsonl'],stdout=g.bodies['electron'][0],stderr=g.bodies['electron'][1]),inner_bodies=g.bodies['inner'],child_bodies={n:g.bodies[n] for n in ('electron','ui')})
        self.assertNotEqual(PUB.read_outer_publication(raw,**args)['classification'],'SUPPLIED_BUSINESS_COMPLETE')
        legacy=focus_case();legacy.run();legacy.outer();legacy_raw=_encoded(legacy.outer_row)
        decision=PUB.read_outer_publication_v2(legacy_raw,expected_pin=dict(pin,bytes=len(legacy_raw),sha256=hashlib.sha256(legacy_raw).hexdigest()),context=legacy.business_context,policy=g.policy,
            artifacts=dict(journal=legacy.files[P._ROOT+'-image\\picker-parent-observation.jsonl'],stdout=legacy.bodies['electron'][0],stderr=legacy.bodies['electron'][1]),inner_bodies=legacy.bodies['inner'],child_bodies={n:legacy.bodies[n] for n in ('electron','ui')})
        self.assertNotEqual(decision['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE');semantic_observe('retained-legacy-business-v2-refusal',legacy)
        business_observe_v2('cross-kind-refusals',g)

    def test_one_use_entries_refuse_before_more_effects_or_rewrites(self):
        g=self.positive();before=(list(g.io_events),list(g.effect_events),dict(g.files))
        with self.assertRaises(Exception):g.run()
        with self.assertRaises(Exception):g.outer()
        self.assertEqual((g.io_events,g.effect_events,g.files),before);business_observe_v2('transactions-once',g)

    def test_original_inner_wait_before_publication_remains_unknown_not_exit(self):
        g=focus_business_case_v2()
        with self.assertRaises(ValueError):g.edges['inner'].wait_original_exit()
        self.assertIsInstance(g.edges['inner'].q.backend.first_exception,RuntimeError)
        g.run();g.outer();business_observe_v2('prepublication-inner-wait-refused',g)
        self.assertNotEqual(self.pub(g)['classification'],'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE')

    def test_fractional_initial_sample_keeps_existing_exact_ten_second_refusal(self):
        g=focus_business_case_v2(initial_sample_ms=800);g.run();business_observe_v2('fractional-fuse-profile-refusal',g)
        self.assertIsInstance(g.primary,CLOCK.DialogClockRefused)
        self.assertIn('REPRESENTABLE_TEN_SECOND_LIMIT_REQUIRED',str(g.primary));self.assertEqual(g.seed.dispatches,0)
        self.assertEqual(g.clocks['inner'].snapshot()['minimumObservedMs'],800)
        self.assertNotEqual(g.row['stage'],'cancel-inner-five-role-complete')
