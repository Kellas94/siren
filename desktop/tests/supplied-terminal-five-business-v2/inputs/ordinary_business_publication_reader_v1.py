"""Pure supplied business completion reader; no IO, launch or admission."""
import hashlib,json,math
import ordinary_business_domain_v1 as BD
import ordinary_external_profile_v1 as F
import ordinary_direct_fixed_plan as P
import ordinary_direct_route as DRoute
import ordinary_picker_contracts as CC
import ordinary_cancel_evidence as CANCEL
import ordinary_closed_picker_consumer as CONSUMER
import ordinary_focus_evidence as FEM
import ordinary_route_evidence as REM

_PUBLICATION_MAX=4194304  # Existing maintained writer OUTPUT_BOUND; not F._MAX.
_PATH=P._ROOT+'\\execution\\result.json'

def _need(value,code):
    if value is not True:raise ValueError('BUSINESS_PUBLICATION_V1:'+code)

def _finite_float(text):
    value=float(text);_need(math.isfinite(value),'NONFINITE_NUMBER');return value

def _tuple_bodies(value):
    return type(value) is tuple and len(value)==4 and all(type(b) is bytes for b in value)

def read_outer_publication(raw,*,expected_pin,context,artifacts,inner_bodies,child_bodies):
    """Retain a bounded original literal and decide the fixed supplied semantics.

    The caller must retain raw independently before invocation, including a raw
    body refused by this profile. No rejected parsed object is validated output.
    The result identity is the original inner child, not C0's outer process.
    """
    _need(type(raw) is bytes and 0<len(raw)<=_PUBLICATION_MAX,'PUBLICATION_PROFILE_BOUND')
    _need(type(context) is BD._BusinessDomainContextV1,'EXACT_BUSINESS_CONTEXT')
    domains=context.snapshot()
    actual=dict(path=_PATH,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
    result=dict(schema=1,kind='SUPPLIED_BUSINESS_PUBLICATION_DECISION_V1',
        classification='RAW_PUBLICATION_REFUSED',reason='EXPECTED_PUBLICATION_PIN_REFUSED',
        raw=raw,publicationPin=actual,domains=domains,wholeSourceGatePassed=False,
        authenticatedTransport=False,sourceCustody=False,nativeEligibility=False,wholeAttempt=False)
    try:
        F._keys(expected_pin,('path','bytes','sha256'),'PUBLICATION_EXPECTED_PIN')
        _need(type(expected_pin['path']) is str and expected_pin['path']==_PATH and
            type(expected_pin['bytes']) is int and 0<expected_pin['bytes']<=_PUBLICATION_MAX and
            F._hex(expected_pin['sha256'],64) and F._same(expected_pin,actual),'EXACT_LITERAL_PUBLICATION_PIN')
    except (ValueError,TypeError,KeyError):return result
    result['reason']='JSON_PUBLICATION_NOT_ACCEPTED'
    try:
        value=json.loads(raw.decode('utf8','strict'),object_pairs_hook=F._pairs,
            parse_constant=F._constant,parse_float=_finite_float)
    except (ValueError,UnicodeError,RecursionError,OverflowError):return result
    result['reason']='SEMANTIC_COMPLETION_NOT_ESTABLISHED'
    if not(type(value) is dict and type(artifacts) is dict and set(artifacts)=={'journal','stdout','stderr'} and
        all(type(b) is bytes for b in artifacts.values()) and _tuple_bodies(inner_bodies) and
        type(child_bodies) is dict and set(child_bodies)=={'electron','ui'} and
        all(_tuple_bodies(b) for b in child_bodies.values())):return result
    # Fixed checked modules; no caller-selected predicate or success callback.
    if DRoute.outer_complete(value,context.source_sha,CC,CANCEL,CONSUMER,artifacts,FEM,REM,
        context,inner_bodies,child_bodies) is not True:return result
    result['classification']='SUPPLIED_BUSINESS_COMPLETE';result['reason']=None
    return result


def read_outer_publication_v2(raw, *, expected_pin, context, policy, artifacts, inner_bodies, child_bodies):
    """Retain a bounded original literal and decide the fixed supplied semantics.

    The caller must retain raw independently before invocation, including a raw
    body refused by this profile. No rejected parsed object is validated output.
    The result identity is the original inner child, not C0's outer process.
    """
    _need(type(raw) is bytes and 0 < len(raw) <= _PUBLICATION_MAX, 'PUBLICATION_PROFILE_BOUND')
    _need(type(context) is BD._BusinessDomainContextV1, 'EXACT_BUSINESS_CONTEXT')
    domains = context.snapshot()
    actual = dict(path=_PATH, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    result = dict(schema=1, kind='SUPPLIED_FIVE_ROLE_BUSINESS_PUBLICATION_DECISION_V2', classification='RAW_PUBLICATION_REFUSED', reason='EXPECTED_PUBLICATION_PIN_REFUSED', raw=raw, publicationPin=actual, domains=domains, wholeSourceGatePassed=False, authenticatedTransport=False, sourceCustody=False, nativeEligibility=False, wholeAttempt=False)
    try:
        F._keys(expected_pin, ('path', 'bytes', 'sha256'), 'PUBLICATION_EXPECTED_PIN')
        _need(type(expected_pin['path']) is str and expected_pin['path'] == _PATH and (type(expected_pin['bytes']) is int) and (0 < expected_pin['bytes'] <= _PUBLICATION_MAX) and F._hex(expected_pin['sha256'], 64) and F._same(expected_pin, actual), 'EXACT_LITERAL_PUBLICATION_PIN')
    except (ValueError, TypeError, KeyError):
        return result
    result['reason'] = 'JSON_PUBLICATION_NOT_ACCEPTED'
    try:
        value = json.loads(raw.decode('utf8', 'strict'), object_pairs_hook=F._pairs, parse_constant=F._constant, parse_float=_finite_float)
    except (ValueError, UnicodeError, RecursionError, OverflowError):
        return result
    result['reason'] = 'SEMANTIC_COMPLETION_NOT_ESTABLISHED'
    if not (type(value) is dict and type(artifacts) is dict and (set(artifacts) == {'journal', 'stdout', 'stderr'}) and all((type(b) is bytes for b in artifacts.values())) and _tuple_bodies(inner_bodies) and (type(child_bodies) is dict) and (set(child_bodies) == {'electron', 'ui'}) and all((_tuple_bodies(b) for b in child_bodies.values()))):
        return result
    if DRoute.outer_complete_five_role_v2(value, context.source_sha, CC, CANCEL, CONSUMER, artifacts, FEM, REM, context, policy, inner_bodies, child_bodies) is not True:
        return result
    result['classification'] = 'SUPPLIED_FIVE_ROLE_BUSINESS_COMPLETE'
    result['reason'] = None
    return result
