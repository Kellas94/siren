def observe_focus_five_v2(stack, facade, port, binding, clock, controller_identity, proof, secondary):
    """Exact corrected focus operation; preserve first reason before cached getters."""
    operation = None
    primary = None
    record = proof['focus'] = dict(controllerIdentity=dict(controller_identity), binding=dict(proof['originalBinding']), clockBefore=clock.snapshot(), clockAfter=None, result=None, snapshot=None, port=None, bindingReused=False, clockReused=False, facadeReused=False, membershipBasis='CANONICAL_GUARD_DESCENDANT_CHECK', membershipIndependentlyRetained=False)
    try:
        operation = stack.focus_policy.AddressFocusDiscriminator(facade, port, binding, clock, controller_identity['pid'])
        c.need(operation._binding is binding and operation._clock is clock and (operation._facade is facade), 'EXACT_ORIGINAL_FOCUS_BINDING_FACADE_FUSE')
        record['bindingReused'] = record['clockReused'] = record['facadeReused'] = True
        record['result'] = c.focus_evidence.copy_data(operation.observe())
        c.need(operation._driver._binding is binding and operation._driver._api['monotonic'] is clock and (operation._driver._deadline == clock.snapshot()['deadline']), 'FOCUS_SAME_READINESS_DEADLINE')
    except BaseException as error:
        primary = error
    finally:
        getters = [('port', lambda: c.focus_evidence.copy_data(port.snapshot())), ('clockAfter', clock.snapshot)]
        if operation is not None:
            getters.insert(0, ('snapshot', lambda: c.focus_evidence.copy_data(operation.snapshot())))
        for name, getter in getters:
            try:
                record[name] = getter()
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='focus-' + name + '-retention', errorType=type(error).__name__))
        if operation is not None:
            try:
                for error in operation.diagnostic_errors:
                    secondary.append(dict(stage='focus-diagnostic', errorType=type(error).__name__))
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='focus-diagnostic-retention', errorType=type(error).__name__))
    if primary is not None:
        raise primary
    result = record['result']
    c.need(type(result) is dict and result.get('classification') == 'OWNED_FOCUSED_EDIT_OBSERVED' and (result.get('failed') is False) and (result.get('diagnosticErrorCount') == 0) and (not secondary), 'COMPLETE_FOCUS_REQUIRED_BEFORE_C1')
    c.focus_evidence.pre_c1_complete(record, c.k)
    proof['focusOrder'].append('FOCUS')
    return operation

def retain_focus_port_five_v2(port, proof, identities, settlements, forced, secondary):
    """Versioned cached-only retirement; no legacy Popen settlement is inferred."""
    if port is None:
        return
    normal = proof.get('directNormalExits', {}).get('electron')
    row = proof['directFocusPortRetirement'] = dict(kind='FIVE_ROLE_FOCUS_PORT_RETIREMENT_V2', stage='AFTER_ORIGINAL_CHILD_RETIREMENT_ATTEMPTS', samePortRetained=True, originalElectronIdentity=identities.get('electron'), originalExit=normal, originalEdgeOutcome=settlements.get('electron'), retirementConfirmed=False, cachedSnapshot=None, cachedReadbackStatus=None, scope='same strong cached-only port; direct original exit, Job, capture and resource joins')
    row['retirementConfirmed'] = c.direct_normal_exit_five_v2(normal, identities.get('electron')) and c.direct_edge_clean_five_v2(row['originalEdgeOutcome']) and (not forced)
    for name, getter in [('cachedSnapshot', port.snapshot), ('cachedReadbackStatus', port.readback_status)]:
        try:
            row[name] = c.focus_evidence.copy_data(getter())
        except BaseException as error:
            secondary.append(dict(stage='focus-port-after-retirement-' + name, errorType=type(error).__name__))

def retain_prefocus_ready_five_v2(ready, source, identity, ui, proof):
    """Validate the actual ready envelope before the unchanged public Pick timer."""
    c.focus_evidence.prefocus_ready(ready, source, identity, ui, c.k)
    proof['uiReady'] = c.focus_evidence.copy_data(ready)

def cancel_tail_five_v2(stack, facade, binding, clock, phase, proof, edges, settlements, forced, deadline, active_reader, live, secondary):
    """One canonical C1; positive provider/MAIN/UI and original-exit joins."""
    ui = {key: phase[key] for key in ['projectId', 'windowId', 'epoch']}
    identity = phase['identity']
    source = phase['sourceSha256']
    escape = None
    original = None
    try:
        live('electron')
        live('ui')
        proof['focusOrder'].append('C1')
        escape = stack.foreground.create_observed_escape_cancel(facade, binding, clock)
        proof['native'] = dict(cancelAnswer=escape.cancel())
        proof['clockAfterC1'] = clock.snapshot()
    except BaseException as error:
        original = error
        raise
    finally:
        if escape is not None:
            try:
                native = proof.setdefault('native', {})
                native['transport'] = escape.snapshot()
                native['foreground'] = escape.discovery_snapshot()
                for error in (*escape.secondary_errors, *escape.discovery_secondary_errors):
                    secondary.append(dict(stage='c1-diagnostic', error=c.describe(error)))
                if native['foreground'].get('diagnosticErrorCount') != 0:
                    secondary.append(dict(stage='c1-diagnostic-incomplete', error=dict(type='DiagnosticIncomplete')))
            except BaseException as error:
                if original is None:
                    raise
                secondary.append(dict(stage='c1-diagnostic-retention', error=c.describe(error)))
    native = proof['native']
    answer = native['cancelAnswer']
    dispatch = native['transport']
    c.need(type(answer) is dict and answer.get('inputSent') is True and (answer.get('physicalSuccess') is False) and (dispatch.get('attempted') is True) and (type(dispatch.get('rawCount')) is int) and (dispatch['rawCount'] == 2) and (dispatch.get('physicalSuccess') is False), 'CANONICAL_ONE_ESCAPE_DISPATCH')
    c.need(not secondary, 'C1_DIAGNOSTICS_ADVERSE')
    c.write_five_v2(c.OUT / 'native-cancel.json', native)
    live('electron')
    live('ui')
    c.publish_five_v2(c.OUT / 'cancel-issued.json', c.envelope('cancel-issued', **phase))
    cancelled = c.wait_file_five_v2(c.OUT / 'ui-cancelled.json', deadline)
    c.cancel.ui_cancelled(cancelled, c.PROBE, source, identity, ui)
    proof['uiCancelled'] = cancelled
    active = active_reader.read()
    proof['providerActiveHex'] = active.hex()
    proof['provider'] = c.route_evidence.active_cancel(active, proof['receiptBinding'], c.k, c.consumer)
    body = c.read_bytes_five_v2(c.ENDPOINT_JOURNAL, 65536)
    proof['endpointBodyHex'] = body.hex()
    proof['endpoint'] = c.cancel.endpoint_cancel(body, ui['epoch'])
    c.write_five_v2(c.OUT / 'provider-cancel-projection.json', proof['provider'])
    c.write_five_v2(c.OUT / 'endpoint-cancel-pair.json', proof['endpoint'])
    live('electron')
    live('ui')
    c.publish_five_v2(c.OUT / 'go-quit.json', c.envelope('go-quit', **phase))
    proof['directNormalExits'] = {}
    for name in ['ui', 'electron']:
        proof['directNormalExits'][name] = edges[name].wait_original_exit()
        c.write_five_v2(c.OUT / (name + '-exit-settlement.json'), proof['directNormalExits'][name])
        if name == 'ui':
            proof['ui'] = c.read_five_v2(c.OUT / 'ui-result.json')
            c.cancel.ui_final(proof['ui'], c.PROBE, source, identity, ui)
    for name in ['ui', 'electron']:
        edges[name].finalize(None, c.direct_pump_five_v2, time.sleep)
    for name in ['ui', 'electron']:
        settlements[name] = c.direct_edge_value_five_v2(edges[name], secondary)
    c.need(not secondary and (not forced) and all((c.direct_edge_clean_five_v2(value) for value in settlements.values())), 'DIRECT_NORMAL_CHILDREN_CAPTURE_AND_EMPTY_JOBS')
    proof['childrenQuiescent'] = True
    proof['receiptFiles'] = c.direct_receipt_files_five_v2(edges['electron'])
    artifacts = c.direct_retained_streams_five_v2(proof, edges['electron'])
    proof['closedReceipt'] = c.consumer.consume(artifacts['journal'], artifacts['stdout'], artifacts['stderr'], proof['receiptBinding'])
    c.route_evidence.receipt_complete(proof, identity, c.k, c.consumer, artifacts)
    proof['session'] = c.k.clean_close(c.read_five_v2(c.DATA / 'Recovery/sessions.json', 4 * 1024 * 1024), identity)
    final_endpoint = c.read_bytes_five_v2(c.ENDPOINT_JOURNAL, 65536)
    proof['endpointBodyHex'] = final_endpoint.hex()
    proof['endpoint'] = c.cancel.endpoint_cancel(final_endpoint, ui['epoch'])
    proof['cancelStatus'] = 'ADDRESS_FOCUS_CANCEL_DATA_COMPLETE'
    c.write_five_v2(c.OUT / 'normal-close-witnesses.json', dict(closedReceipt=proof['closedReceipt'], receiptFiles=proof['receiptFiles'], session=proof['session'], provider=proof['provider'], endpoint=proof['endpoint']))

def selected_route_five_v2():
    primary = None
    pointer_started = False
    pointer_acknowledged_at = None
    active_journal_reader = None
    route_state = dict(readinessStage='NOT_STARTED', topologyStage='NOT_REQUESTED_BY_CANCEL_ROUTE', readiness=None, attempt=None, capture=None)

    def guard():
        c.remaining_five_v2(deadline)
        live('electron')
        live('ui')
        c.need(not os.path.lexists(c.OUT / 'ui-adverse.json'), 'UI_WORKER_ADVERSE')

    def cache_absence(label, getter):
        captured = route_support.capture_absence(getter)
        if captured['errorPresent']:
            secondary.append(dict(stage=label + '-getter', errorType=type(captured['error']).__name__))
            return
        data = captured['data']
        if not (type(data) is dict and type(data.get('diagnosticErrorCount')) is int and (data['diagnosticErrorCount'] >= 0)):
            secondary.append(dict(stage=label + '-schema', errorType='InvalidAbsenceDiagnosticDTO'))
            return
        proof[label] = data
        if data['diagnosticErrorCount'] > 0:
            secondary.append(dict(stage=label + '-audit-incomplete', diagnosticErrorCount=data['diagnosticErrorCount']))

    def select_target():
        nonlocal primary, pointer_started, pointer_acknowledged_at, active_journal_reader
        guard()
        pick_started = time.monotonic()
        c.publish_five_v2(c.OUT / 'go-pick.json', c.envelope('go-pick', **phase))
        pointer = c.wait_file_five_v2(c.OUT / 'pointer-started.json', deadline)
        c.need(pointer.get('probe') == c.PROBE and pointer.get('stage') == 'pointer-started' and (pointer.get('sourceSha256') == source) and c.k.exact(pointer.get('identity'), identity) and all((pointer.get(k) == v for k, v in ui.items())), 'ONE_POINTER_INTENT_ONLY')
        pointer_started = True
        pointer_acknowledged_at = time.monotonic()
        active_journal_reader = prefix_reader.PrefixReader(c.JOURNAL, maximum=32768)
        rows = []
        while len(rows) < 2:
            guard()
            c.need(time.monotonic() - pick_started < 5, 'PUBLIC_PICKER_BUDGET_PRE_BOUNDARY')
            if os.path.lexists(c.JOURNAL):
                rows = c.k.journal_prefix(active_journal_reader.read())
            if len(rows) < 2:
                time.sleep(0.005)
        hwnd = c.k.picker_boundary(rows, identity['pid'], ui, facade.pointer_bits)
        live('electron')
        parent = apis['electron'].window(hwnd)
        c.need(type(parent) is stack.model.Window and parent.pid == identity['pid'] and (parent.hwnd == hwnd) and (parent.visible is True), 'ACTUAL_HELD_MAIN_PARENT')
        binding = stack.model.Binding(edges['electron'].original_process_handle(), identity['pid'], identity['image'], identity['createdFileTime'], hwnd, parent.tid, parent.class_name)
        clock = stack.clock.create_dialog_clock()

        def public_remaining():
            guard()
            left = 5 - (time.monotonic() - pick_started)
            c.need(left > 0, 'PUBLIC_PICKER_BUDGET_READINESS')
            return left
        readiness = stack.readiness.OwnedDialogReadiness(apis['electron'], binding, clock, public_remaining, time.sleep)
        route_state['readiness'] = readiness
        attempt = retention.ReadinessAttempt(readiness)
        route_state['attempt'] = attempt
        route_state['readinessStage'] = 'CALL'

        def remember_original(error):
            nonlocal primary
            if primary is None:
                primary = error
        captured = route_support.capture_readiness(attempt, remember_original)
        route_state['capture'] = captured
        route_state['readinessStage'] = 'RAISED' if captured['primaryPresent'] else 'RETURNED'
        cache_absence('readinessAbsences', lambda: readiness.enumeration_absence_snapshot())
        for row in captured['secondary']:
            secondary.append(dict(stage=row['stage'], errorType=type(row['reason']).__name__))
        if captured['primaryPresent']:
            raise captured['primaryReason']
        c.need(captured['resultPresent'], 'READINESS_OUTCOME_REQUIRED')
        proof['readiness'] = captured['result']
        proof['fullTopology'] = dict(status='NOT_REQUESTED_BY_CANCEL_ROUTE', scope='No two-pass descendant qualification; canonical C1 independently discovers and guards its current owned dialog')
        return (binding, clock)
    binding, clock = select_target()
    proof['receiptBinding'] = dict(mainPid=identity['pid'], projectId=ui['projectId'], windowId=ui['windowId'], epoch=ui['epoch'], pointerBits=facade.pointer_bits, parentHwnd=binding.parent_hwnd)
    proof['originalBinding'] = dict(originalHandleDecimal=str(binding.original_handle), pid=binding.pid, image=binding.image, createdFileTime=binding.created_filetime, parentHwndDecimal=str(binding.parent_hwnd), parentTid=binding.parent_tid, parentClass=binding.parent_class)
    proof['focusOrder'] = ['READINESS']
    focus_operation = observe_focus_five_v2(stack, facade, focus_port, binding, clock, identities['inner'], proof, secondary)
    cancel_tail_five_v2(stack, facade, binding, clock, phase, proof, edges, settlements, forced, deadline, active_journal_reader, live, secondary)
    return dict(binding=binding, clock=clock, focus_operation=focus_operation, route_state=route_state, active_journal_reader=active_journal_reader)

def _five_inner_result_producer_v2():
    global primary, result
    for name in ['ui', 'electron']:
        settlements[name] = c.direct_edge_value_five_v2(edges.get(name), secondary)
    retain_focus_port_five_v2(focus_port, proof, identities, settlements, forced, secondary)
    result = c.envelope('cancel-inner-five-role-complete' if primary is None and (not secondary) and (not forced) and all((c.direct_edge_clean_five_v2(value) for value in settlements.values())) else 'cancel-inner-five-role-adverse', schema=1, kind='SIREN_FIVE_ROLE_INNER_RESULT_V2', sourceSha256=source, primaryPresent=primary is not None, primary=None if primary is None else c.describe(primary), secondary=secondary, forced=forced, identities=identities, edgeOutcomes=settlements, proof=proof, scope='one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse')
    if result['stage'] == 'cancel-inner-five-role-complete':
        try:
            c.need(c.inner_direct_completion_five_v2(result, source, identities['inner'], edges), 'FULL_DIRECT_INNER_COMPLETION')
        except BaseException as error:
            primary = error
            result.update(stage='cancel-inner-five-role-adverse', primaryPresent=True, primary=c.describe(error))
    try:
        c.write_five_v2(c.OUT / 'inner-result.json', result)
    except BaseException as error:
        if primary is None:
            primary = error
        result.update(stage='cancel-inner-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
        secondary.append(dict(stage='inner-result-retention', error=c.describe(error)))
        print(json.dumps(c.envelope('inner-retention-adverse', primary=result['primary'], secondary=secondary)), file=sys.stderr, flush=True)

def _run_five_business_inner_v2():
    global primary, result, _five_inner_attempt
    c.need(not globals().get('_five_inner_attempt', False), 'FIVE_INNER_TRANSACTION_ONCE')
    _five_inner_attempt = True
    primary = None
    try:
        selected_route_five_v2()
    except BaseException as error:
        primary = error
    finally:
        for name in ('ui', 'electron'):
            try:
                edges[name].finalize(primary, c.direct_pump_five_v2, time.sleep)
            except BaseException as error:
                if primary is None:
                    primary = error
                else:
                    secondary.append(dict(stage='five-original-finalization', error=c.describe(error)))
        _five_inner_result_producer_v2()
    return result
