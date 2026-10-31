"""Versioned maintained result joins for the supplied three-edge subset.

No legacy envelope conversion/fallback, file IO or capability reconstruction.
All paths still require separately supplied bodies and expected context.
"""
import ordinary_direct_results as D
import ordinary_direct_capture_core as C0

PROBE='siren-ordinary-picker-cancel-v1'
_INNER={'probe','stage','schema','kind','sourceSha256','primaryPresent','primary','secondary',
        'forced','identities','edgeOutcomes','proof','scope'}
_OUTER={'probe','stage','schema','kind','sourceSha256','primaryPresent','primary','secondary',
        'forced','identity','directNormalExit','innerEdge','inner','scope'}

def _need(value,code):
    if value is not True:raise ValueError('DIRECT_ROUTE:'+code)

def _keys(value,keys,code):
    _need(type(value) is dict and all(type(key) is str for key in value) and set(value)==set(keys),code)

def _envelope(row,source,context,inner):
    _keys(row,_INNER if inner else _OUTER,'CLOSED_VERSIONED_ROOT')
    _need(type(row['schema']) is int and row['schema']==1 and row['probe']==PROBE and
          row['kind']==('MAINTAINED_DIRECT_INNER_V1' if inner else 'MAINTAINED_DIRECT_OUTER_V1') and
          row['stage']==('cancel-inner-direct-complete' if inner else 'ordinary-cancel-direct-complete') and
          type(source) is str and source==context.source_sha and row['sourceSha256']==source and
          row['primaryPresent'] is False and row['primary'] is None and
          type(row['secondary']) is list and row['secondary']==[] and
          type(row['forced']) is list and row['forced']==[],'CLEAN_DIRECT_ENVELOPE')
    expected=('one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse'
              if inner else 'one fixed shortcut focus observation then genuine Cancel/normal Quit; forced owned retirement remains adverse')
    _need(type(row['scope']) is str and row['scope']==expected,'EXACT_ROOT_SCOPE')

def _edge(row,name,identity,context,bodies):
    result=D.edge_value(row,bodies,context)
    _need(result['binding']['edge']==name and result['classification']=='CLEAN_INERT' and
          C0._equal(row['identity'],identity),'CURRENT_CLEAN_ORIGINAL_EDGE:'+name)
    return result

def inner_complete(row,source,contracts,cancel,consumer,artifacts,controller_identity,
                   focus_module,route_module,context,bodies):
    try:
        _envelope(row,source,context,True)
        _keys(row['identities'],('inner','electron','ui'),'THREE_DECLARED_IDENTITIES')
        _keys(row['edgeOutcomes'],('electron','ui'),'TWO_ORIGINAL_CHILD_OUTCOMES')
        _keys(bodies,('electron','ui'),'TWO_SUPPLIED_CAPTURE_BODY_TUPLES')
        _need(C0._equal(row['identities']['inner'],controller_identity),'ORIGINAL_INNER_IDENTITY')
        D._identity(controller_identity,context.binding('inner'))
        proof=row['proof'];_need(type(proof) is dict,'PROOF_AVAILABLE')
        _need(not any(key in row for key in ('jobSettlements','normalExit','jobSettlement')) and
              not any(key in proof for key in ('normalExits','focusPortRetirement')),'NO_LEGACY_DIRECT_MIXTURE')
        _keys(proof['directNormalExits'],('electron','ui'),'TWO_ORIGINAL_NORMAL_EXITS')
        for name in ('electron','ui'):
            _edge(row['edgeOutcomes'][name],name,row['identities'][name],context,bodies[name])
            D.join_normal_exit(proof['directNormalExits'][name],row['edgeOutcomes'][name],context)
        identity=row['identities']['electron'];phase=proof['phase']
        ui={key:phase[key] for key in ('projectId','windowId','epoch')}
        _need(C0._equal(phase['identity'],identity) and phase['sourceSha256']==source,'CURRENT_ELECTRON_PHASE')
        rb=proof['receiptBinding']
        _need(all(type(rb[key]) is type(value) and rb[key]==value for key,value in ui.items()),'CURRENT_RECEIPT_CONTEXT')
        _need(proof['cancelStatus']=='ADDRESS_FOCUS_CANCEL_DATA_COMPLETE' and
              proof['fullTopology']['status']=='NOT_REQUESTED_BY_CANCEL_ROUTE' and
              proof['childrenQuiescent'] is True,'UNFORCED_CANCEL_DATA_COMPLETE')
        retired=proof['directFocusPortRetirement']
        _need(C0._equal(retired['originalEdgeOutcome'],row['edgeOutcomes']['electron']),
              'SAME_RETIRED_ORIGINAL_ELECTRON_EDGE')
        focus_module.prefocus_complete(proof,identity,source,contracts)
        focus_module.focus_direct_complete(proof,identity,controller_identity,contracts,
            D,context,row['edgeOutcomes']['electron'],bodies['electron'])
        cancel.ui_cancelled(proof['uiCancelled'],PROBE,source,identity,ui)
        cancel.ui_final(proof['ui'],PROBE,source,identity,ui)
        hexbody=proof['endpointBodyHex']
        _need(type(hexbody) is str and len(hexbody)<=131072 and
              cancel.endpoint_cancel(bytes.fromhex(hexbody),ui['epoch'])==proof['endpoint'],'EXACT_ENDPOINT_RECONCILIATION')
        native=proof['native'];answer=native['cancelAnswer'];dispatch=native['transport'];foreground=native['foreground']
        _need(answer.get('inputSent') is True and answer.get('physicalSuccess') is False and
              dispatch.get('attempted') is True and type(dispatch.get('rawCount')) is int and
              dispatch['rawCount']==2 and dispatch.get('physicalSuccess') is False and
              type(foreground.get('diagnosticErrorCount')) is int and
              foreground['diagnosticErrorCount']==0,'CANONICAL_GENUINE_ESCAPE')
        _keys(artifacts,('journal','stdout','stderr'),'EXACT_RECEIPT_ARTIFACTS')
        _need(type(artifacts['stdout']) is bytes and type(artifacts['stderr']) is bytes and
              artifacts['stdout']==bodies['electron'][0] and artifacts['stderr']==bodies['electron'][1],
              'RECEIPT_USES_ORIGINAL_STAGED_STREAMS')
        route_module.receipt_complete(proof,identity,contracts,consumer,artifacts)
        _need(contracts.clean_close(dict(schema=1,events=proof['session']['events']),identity)==proof['session'],
              'ACTUAL_RECOVERY_CLEAN_CLOSE_DATA')
        return True
    except Exception:return False

def outer_complete(row,source,contracts,cancel,consumer,artifacts,focus_module,route_module,
                   context,inner_bodies,child_bodies):
    try:
        _envelope(row,source,context,False)
        _edge(row['innerEdge'],'inner',row['identity'],context,inner_bodies)
        D.join_normal_exit(row['directNormalExit'],row['innerEdge'],context)
        return inner_complete(row['inner'],source,contracts,cancel,consumer,artifacts,row['identity'],
            focus_module,route_module,context,child_bodies)
    except Exception:return False


def _edge_five_v2(timed,name,identity,context,policy,bodies):
    import json
    import ordinary_business_domain_v1 as BD
    import ordinary_direct_timing_results_v1 as TR
    _need(type(context) is BD._BusinessDomainContextV1,'EXACT_FIVE_BUSINESS_CONTEXT')
    value=TR.read_five_role_v2(json.dumps(timed,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii'),bodies,context._context,policy)
    edge=timed['edge']
    _need(edge['binding']['edge']==name and value['classification']=='CLEAN_INERT' and C0._equal(edge['identity'],identity),'CURRENT_CLEAN_TIMED_ORIGINAL_EDGE:'+name)
    return value


def _envelope_five_v2(row, source, context, inner):
    import ordinary_business_domain_v1 as BD
    _need(type(context) is BD._BusinessDomainContextV1, 'EXACT_FIVE_BUSINESS_CONTEXT')
    _keys(row, _INNER if inner else _OUTER, 'CLOSED_VERSIONED_ROOT')
    _need(type(row['schema']) is int and row['schema'] == 1 and (row['probe'] == PROBE) and (row['kind'] == ('SIREN_FIVE_ROLE_INNER_RESULT_V2' if inner else 'SIREN_FIVE_ROLE_OUTER_RESULT_V2')) and (row['stage'] == ('cancel-inner-five-role-complete' if inner else 'ordinary-cancel-five-role-complete')) and (type(source) is str) and (source == context.source_sha) and (row['sourceSha256'] == source) and (row['primaryPresent'] is False) and (row['primary'] is None) and (type(row['secondary']) is list) and (row['secondary'] == []) and (type(row['forced']) is list) and (row['forced'] == []), 'CLEAN_DIRECT_ENVELOPE')
    expected = 'one initial-null genuine Cancel then normal Quit; positive MAIN projection is not raw renderer receipt; any forced retirement adverse' if inner else 'one fixed shortcut focus observation then genuine Cancel/normal Quit; forced owned retirement remains adverse'
    _need(type(row['scope']) is str and row['scope'] == expected, 'EXACT_ROOT_SCOPE')

def inner_complete_five_role_v2(row, source, contracts, cancel, consumer, artifacts, controller_identity, focus_module, route_module, context, policy, bodies):
    try:
        _envelope_five_v2(row, source, context, True)
        _keys(row['identities'], ('inner', 'electron', 'ui'), 'THREE_DECLARED_IDENTITIES')
        _keys(row['edgeOutcomes'], ('electron', 'ui'), 'TWO_ORIGINAL_CHILD_OUTCOMES')
        _keys(bodies, ('electron', 'ui'), 'TWO_SUPPLIED_CAPTURE_BODY_TUPLES')
        _need(C0._equal(row['identities']['inner'], controller_identity), 'ORIGINAL_INNER_IDENTITY')
        D._identity(controller_identity, context.binding('inner'))
        proof = row['proof']
        _need(type(proof) is dict, 'PROOF_AVAILABLE')
        _need(not any((key in row for key in ('jobSettlements', 'normalExit', 'jobSettlement'))) and (not any((key in proof for key in ('normalExits', 'focusPortRetirement')))), 'NO_LEGACY_DIRECT_MIXTURE')
        _keys(proof['directNormalExits'], ('electron', 'ui'), 'TWO_ORIGINAL_NORMAL_EXITS')
        for name in ('electron', 'ui'):
            _edge_five_v2(row['edgeOutcomes'][name], name, row['identities'][name], context, policy, bodies[name])
            D.join_normal_exit(proof['directNormalExits'][name], row['edgeOutcomes'][name]['edge'], context._context)
        identity = row['identities']['electron']
        phase = proof['phase']
        ui = {key: phase[key] for key in ('projectId', 'windowId', 'epoch')}
        _need(C0._equal(phase['identity'], identity) and phase['sourceSha256'] == source, 'CURRENT_ELECTRON_PHASE')
        rb = proof['receiptBinding']
        _need(all((type(rb[key]) is type(value) and rb[key] == value for key, value in ui.items())), 'CURRENT_RECEIPT_CONTEXT')
        _need(proof['cancelStatus'] == 'ADDRESS_FOCUS_CANCEL_DATA_COMPLETE' and proof['fullTopology']['status'] == 'NOT_REQUESTED_BY_CANCEL_ROUTE' and (proof['childrenQuiescent'] is True), 'UNFORCED_CANCEL_DATA_COMPLETE')
        retired = proof['directFocusPortRetirement']
        _need(C0._equal(retired['originalEdgeOutcome'], row['edgeOutcomes']['electron']), 'SAME_RETIRED_ORIGINAL_ELECTRON_EDGE')
        focus_module.prefocus_complete(proof, identity, source, contracts)
        focus_module.focus_five_role_complete_v2(proof, identity, controller_identity, contracts, context, policy, row['edgeOutcomes']['electron'], bodies['electron'])
        cancel.ui_cancelled(proof['uiCancelled'], PROBE, source, identity, ui)
        cancel.ui_final(proof['ui'], PROBE, source, identity, ui)
        hexbody = proof['endpointBodyHex']
        _need(type(hexbody) is str and len(hexbody) <= 131072 and (cancel.endpoint_cancel(bytes.fromhex(hexbody), ui['epoch']) == proof['endpoint']), 'EXACT_ENDPOINT_RECONCILIATION')
        native = proof['native']
        answer = native['cancelAnswer']
        dispatch = native['transport']
        foreground = native['foreground']
        _need(answer.get('inputSent') is True and answer.get('physicalSuccess') is False and (dispatch.get('attempted') is True) and (type(dispatch.get('rawCount')) is int) and (dispatch['rawCount'] == 2) and (dispatch.get('physicalSuccess') is False) and (type(foreground.get('diagnosticErrorCount')) is int) and (foreground['diagnosticErrorCount'] == 0), 'CANONICAL_GENUINE_ESCAPE')
        _keys(artifacts, ('journal', 'stdout', 'stderr'), 'EXACT_RECEIPT_ARTIFACTS')
        _need(type(artifacts['stdout']) is bytes and type(artifacts['stderr']) is bytes and (artifacts['stdout'] == bodies['electron'][0]) and (artifacts['stderr'] == bodies['electron'][1]), 'RECEIPT_USES_ORIGINAL_STAGED_STREAMS')
        route_module.receipt_complete(proof, identity, contracts, consumer, artifacts)
        _need(contracts.clean_close(dict(schema=1, events=proof['session']['events']), identity) == proof['session'], 'ACTUAL_RECOVERY_CLEAN_CLOSE_DATA')
        return True
    except Exception:
        return False

def outer_complete_five_role_v2(row, source, contracts, cancel, consumer, artifacts, focus_module, route_module, context, policy, inner_bodies, child_bodies):
    try:
        _envelope_five_v2(row, source, context, False)
        _edge_five_v2(row['innerEdge'], 'inner', row['identity'], context, policy, inner_bodies)
        D.join_normal_exit(row['directNormalExit'], row['innerEdge']['edge'], context._context)
        return inner_complete_five_role_v2(row['inner'], source, contracts, cancel, consumer, artifacts, row['identity'], focus_module, route_module, context, policy, child_bodies)
    except Exception:
        return False
