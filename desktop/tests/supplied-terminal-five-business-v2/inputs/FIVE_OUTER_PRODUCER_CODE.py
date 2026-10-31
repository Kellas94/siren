def _five_outer_result_producer_v2():
    global primary, result
    result = c.envelope('ordinary-cancel-five-role-complete' if primary is None and (not secondary) and (not forced) and c.direct_edge_clean_five_v2(settlement) else 'ordinary-cancel-five-role-adverse', schema=1, kind='SIREN_FIVE_ROLE_OUTER_RESULT_V2', sourceSha256=source, primaryPresent=primary is not None, primary=None if primary is None else c.describe(primary), secondary=secondary, forced=forced, identity=identity, directNormalExit=exit_settlement, innerEdge=settlement, inner=inner, scope='one fixed shortcut focus observation then genuine Cancel/normal Quit; forced owned retirement remains adverse')
    if result['stage'] == 'ordinary-cancel-five-role-complete':
        try:
            c.need(c.outer_direct_completion_five_v2(result, source, edge), 'FULL_FIVE_OUTER_COMPLETION')
        except BaseException as error:
            if primary is None:
                primary = error
            result.update(stage='ordinary-cancel-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
    c.write_five_v2(c.OUT / 'result.json', result)

def _run_five_business_outer_v2():
    global primary, result, settlement, exit_settlement, inner, _five_outer_attempt, _five_inner_raw
    import ordinary_external_profile_v1 as PROFILE
    import ordinary_direct_fixed_plan as PLAN
    import math
    import hashlib
    c.need(not globals().get('_five_outer_attempt', False), 'FIVE_OUTER_TRANSACTION_ONCE')
    _five_outer_attempt = True
    primary = None
    settlement = None
    exit_settlement = None
    inner = None
    _five_inner_raw = None
    try:
        c.remaining_five_v2(deadline)
        exit_settlement = edge.wait_original_exit()
        c.need(c.direct_normal_exit_five_v2(exit_settlement, identity), 'FIVE_ORIGINAL_INNER_NORMAL_EXIT')
    except BaseException as error:
        primary = error
    finally:
        try:
            edge.finalize(primary, c.direct_pump_five_v2, time.sleep)
        except BaseException as error:
            if primary is None:
                primary = error
            else:
                secondary.append(dict(stage='five-original-inner-finalization', error=c.describe(error)))
        settlement = c.direct_edge_value_five_v2(edge, secondary)
    if primary is None and (not secondary) and c.direct_edge_clean_five_v2(settlement):
        try:
            path = c.OUT / 'inner-result.json'
            expected_path = PLAN._ROOT + '\\execution\\inner-result.json'
            c.need(str(path) == expected_path, 'FIXED_FIVE_INNER_RESULT_PATH')

            def typed_pin(value):
                PROFILE._keys(value, ('path', 'bytes', 'sha256'), 'FIVE_INNER_LITERAL_PIN')
                c.need(type(value['path']) is str and value['path'] == expected_path and (type(value['bytes']) is int) and (0 < value['bytes'] <= 4194304) and PROFILE._hex(value['sha256'], 64), 'TYPED_BOUNDED_FIVE_INNER_PIN')
            before = c.pin_five_v2(path)
            typed_pin(before)
            before = PROFILE._detach(before)
            _five_inner_raw = c.read_bytes_five_v2(path, 4194304)
            c.need(type(_five_inner_raw) is bytes and 0 < len(_five_inner_raw) <= 4194304, 'FIVE_ORIGINAL_INNER_RAW_PROFILE')
            after = c.pin_five_v2(path)
            typed_pin(after)
            after = PROFILE._detach(after)
            c.need(PROFILE._same(before, after) and before['bytes'] == len(_five_inner_raw) and (before['sha256'] == hashlib.sha256(_five_inner_raw).hexdigest()), 'FIVE_ORIGINAL_INNER_LITERAL_READBACK')

            def finite(text):
                value = float(text)
                c.need(math.isfinite(value), 'FIVE_FINITE_INNER_JSON')
                return value
            inner = json.loads(_five_inner_raw.decode('utf8', 'strict'), object_pairs_hook=PROFILE._pairs, parse_constant=PROFILE._constant, parse_float=finite)
        except BaseException as error:
            primary = error
    try:
        _five_outer_result_producer_v2()
    except BaseException as error:
        if primary is None:
            primary = error
        else:
            secondary.append(dict(stage='five-outer-result-retention', error=c.describe(error)))
        if type(globals().get('result')) is dict:
            result.update(stage='ordinary-cancel-five-role-adverse', primaryPresent=True, primary=c.describe(primary))
    return result
