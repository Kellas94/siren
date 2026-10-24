"""Single observation orchestration; adapters own all physical operations."""
def run(make_transport,select_target,bracket):
    transport=None;ready=None;binding=None;witness=None;result=None;state=None
    primary=None;secondary=[]
    try:
        transport=make_transport()
        ready=transport.prewarm()
        binding,witness=select_target()
        bracket()
        result=transport.observe(binding)
        bracket()
    except BaseException as error:primary=error
    finally:
        if transport is not None:
            try:state=transport.close()
            except BaseException as error:
                if primary is None:primary=error
                else:secondary.append({'stage':'uia-close','reason':error})
                try:state=transport.snapshot()
                except BaseException as error:secondary.append({'stage':'uia-cached-snapshot','reason':error})
    witnessed=(type(state) is dict and state.get('complete') is True and state.get('jobJoined') is True and state.get('readersJoined') is True and type(state.get('exitCode')) is int and state['exitCode']==0 and state.get('forced')==[] and state.get('secondary')==[] and type(result) is dict and result.get('complete') is True and result.get('limited') is False)
    if primary is None and (not witnessed or secondary):primary=RuntimeError('UIA_COMPLETION_WITNESSES_REFUSED')
    return {'status':'OBSERVED_COMPLETE' if primary is None else 'ADVERSE','primaryPresent':primary is not None,'primaryReason':primary,'secondary':secondary,'ready':ready,'binding':binding,'witness':witness,'result':result,'transport':state}


def capture_readiness(attempt,remember_primary):
    """Preserve raw route outcome before diagnostic DATA or caller retention.

    This accepts the trusted private one-attempt component. It makes no native
    call itself, grants no readiness authority, and never formats exceptions.
    """
    unexpected=None;secondary=[];data=None
    try:attempt.run()
    except BaseException as error:unexpected=error
    present=attempt.primary_present;primary=attempt.primary_reason
    result_present=attempt.result_present;result=attempt.result
    if unexpected is not None:
        if present:secondary.append(dict(stage='readiness-attempt-run',reason=unexpected))
        else:present=True;primary=unexpected
    if not present and not result_present:
        present=True;primary=RuntimeError('READINESS_ATTEMPT_INCOMPLETE')
    def remember():
        try:remember_primary(primary)
        except BaseException as error:secondary.append(dict(stage='readiness-primary-retention',reason=error))
    if present:remember()
    try:data=attempt.data()
    except BaseException as error:secondary.append(dict(stage='readiness-data',reason=error))
    if not present and type(data) is dict and data.get('running') is True:
        present=True;primary=RuntimeError('READINESS_ATTEMPT_IN_PROGRESS');remember()
    try:
        secondary.extend(dict(stage='readiness-'+stage,reason=error) for stage,error in attempt.secondary_errors)
    except BaseException as error:secondary.append(dict(stage='readiness-errors',reason=error))
    return dict(primaryPresent=present,primaryReason=primary,resultPresent=result_present,result=result,data=data,secondary=secondary)


def capture_absence(getter):
    """Call one trusted cached getter; return raw diagnostics without formatting."""
    try:return dict(present=True,data=getter(),errorPresent=False,error=None)
    except BaseException as error:return dict(present=False,data=None,errorPresent=True,error=error)
