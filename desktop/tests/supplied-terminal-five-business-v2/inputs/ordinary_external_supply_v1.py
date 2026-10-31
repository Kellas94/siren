"""Pure held-byte producers and GO joins; no trusted transport or entry authority.

Prepare static declarations before review. Runtime bodies and review bytes do not
belong to their own source plan. Expected pins must arrive from an external trust
boundary; accepting consistent review-shaped data does not authenticate it.
"""
import hashlib,json
import ordinary_direct_fixed_plan as P
import ordinary_external_profile_v1 as F

_MAX_SOURCE=2*1024*1024
_MAX_TOTAL=16*1024*1024

def _need(value,code):
    if value is not True:raise ValueError('EXTERNAL_SUPPLY:'+code)

def _raw(value):
    body=json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode('ascii')
    _need(0<len(body)<=F._MAX,'BOUNDED_PRODUCED_BODY')
    return body

def _pin(path,body):return dict(path=path,bytes=len(body),sha256=hashlib.sha256(body).hexdigest())

def _source_plan(source_plan_raw,source_buffers):
    plan=F._load(source_plan_raw)
    F._version(plan,('schema','kind','modules','producers'),'SIREN_EXTERNAL_SOURCE_PLAN_V1')
    rows=plan['modules'];F._keys(plan['producers'],F._PRODUCERS,'SIX_PRODUCER_ALIASES')
    _need(type(rows) is list and 0<len(rows)<=64 and type(source_buffers) is dict,'BOUNDED_SOURCE_ROSTER')
    units={};paths=set();total=0
    for row in rows:
        F._keys(row,('name','path','bytes','sha256','package'),'CLOSED_SOURCE_UNIT')
        name=row['name']
        _need(type(name) is str and 0<len(name)<=128 and name[0] not in '0123456789' and
            all(c in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' for c in name) and name not in units,'UNIQUE_MODULE_ALIAS')
        _need(type(row['package']) is bool and row['package'] is False,'SOURCE_UNITS_NOT_PACKAGES')
        ref={key:row[key] for key in ('path','bytes','sha256')}
        F._source_refs({role:ref if role=='preparer' else None for role in F._PRODUCERS})
        _need(row['path'].casefold() not in paths,'UNIQUE_SOURCE_PATH')
        paths.add(row['path'].casefold());units[name]=ref;total+=row['bytes']
    _need(total<=_MAX_TOTAL and all(type(key) is str for key in source_buffers) and set(source_buffers)==set(units),'EXACT_BOUNDED_SOURCE_BUFFERS')
    for name,ref in units.items():
        body=source_buffers[name]
        _need(type(body) is bytes and 0<len(body)<=_MAX_SOURCE and len(body)==ref['bytes'] and
            hashlib.sha256(body).hexdigest()==ref['sha256'],'SOURCE_BUFFER_DIGEST:'+name)
    refs={}
    for role,alias in plan['producers'].items():
        _need(alias is None or type(alias) is str and alias in units,'DECLARED_PRODUCER_MODULE')
        refs[role]=None if alias is None else dict(units[alias])
    return F._source_refs(refs)

def _declaration(refs):
    rows=[dict(id=name,producer=producer,sourceRef=F._detach(refs[producer]),stage=stage,
        parents=list(parents),availability=availability,applicability='REQUIRED')
        for name,producer,stage,parents,availability in F._ROSTER]
    F._validate_producer_registry(rows,refs)
    return _raw(dict(schema=1,kind='SIREN_EXTERNAL_DECLARATION_V1',
        edges=F._fixed_edge_registry(tuple(P._FixedPlan(edge) for edge in F._EDGES)),producers=rows))

def _prepare_external_declaration(source_plan_raw,source_buffers):
    """Derive literal static bytes from held units without needing review or IDs."""
    return _declaration(_source_plan(source_plan_raw,source_buffers))

def _static_label(path):
    _need(type(path) is str and 0<len(path)<=4096 and
        path.casefold().startswith((P._WORK+'\\').casefold()) and path.casefold().endswith('.json') and
        '/' not in path,'STATIC_JSON_LABEL')
    parts=path[3:].split('\\')
    devices={'con','prn','aux','nul','clock$','conin$','conout$'}
    devices.update(prefix+suffix for prefix in ('com','lpt') for suffix in '123456789¹²³')
    _need(all(part not in ('','.','..') and not part.endswith(('.', ' ')) and
        part.split('.')[0].rstrip(' ').casefold() not in devices and
        not any(char in '<>:"|?*' or ord(char)<32 for char in part) for part in parts),'CANONICAL_STATIC_LABEL')
    return path.casefold()

def _expected_pin(value,body):
    F._keys(value,('path','bytes','sha256'),'EXPECTED_EXTERNAL_PIN')
    _need(type(value['path']) is str and 0<len(value['path'])<=4096,'EXPLICIT_EXPECTED_PIN_PATH')
    _static_label(value['path'])
    F._literal_pin(value,value['path'],body)

def _reviewed(source_plan_raw,source_buffers,declaration_raw,review_raw,expected_source_pin,expected_review_pin):
    _expected_pin(expected_source_pin,source_plan_raw);_expected_pin(expected_review_pin,review_raw)
    refs=_source_plan(source_plan_raw,source_buffers)
    labels={_static_label(expected_source_pin['path']),_static_label(expected_review_pin['path'])}
    runtime={F._runtime_path(name).casefold() for name in ('declaration','attempt-header','context','go')}
    _need(len(labels)==2 and labels.isdisjoint(runtime),'DISJOINT_STATIC_RUNTIME_ROLES')
    _need(type(declaration_raw) is bytes and declaration_raw==_declaration(refs),'EXACT_PRE_REVIEW_DECLARATION')
    review=F._load(review_raw)
    _need(type(review) is dict and review.get('kind')=='EXTERNAL_SUPPLY_CANDIDATE_SOURCE_REVIEW_V1' and
        review.get('verdict')=='EXTERNAL_SUPPLY_SOURCE_ACCEPTED' and type(review.get('findings')) is list and
        review['findings']==[],'CONSISTENT_ACCEPTED_REVIEW_DATA')
    _need(F._same(review.get('sourcePlan'),expected_source_pin) and
        F._same(review.get('declaration'),_pin(F._runtime_path('declaration'),declaration_raw)),'REVIEWED_PLAN_DECLARATION_JOIN')
    return refs,expected_source_pin['sha256'],expected_review_pin['sha256']

def _supply_external_attempt(*,source_plan_raw,source_buffers,declaration_raw,review_raw,
        expected_source_pin,expected_review_pin,attempt_id,creation_invocations):
    refs,source_sha,review_sha=_reviewed(source_plan_raw,source_buffers,declaration_raw,review_raw,expected_source_pin,expected_review_pin)
    header_raw=_raw(dict(schema=1,kind='SIREN_EXTERNAL_HEADER_V1',sourceSha256=source_sha,reviewSha256=review_sha,
        attemptId=attempt_id,creationInvocations=creation_invocations))
    header=F._read_external_header(header_raw);header_pin=_pin(F._runtime_path('attempt-header'),header_raw)
    declaration_pin=_pin(F._runtime_path('declaration'),declaration_raw)
    bindings={row['edge']:dict(attemptId=header['attemptId'],edge=row['edge'],headerSha256=header_pin['sha256'],
        creationInvocationId=header['creationInvocations'][row['edge']],parent=row['parent'],child=row['child'])
        for row in F._fixed_edge_registry(tuple(P._FixedPlan(edge) for edge in F._EDGES))}
    context_raw=_raw(dict(schema=1,kind='SIREN_EXTERNAL_CONTEXT_V1',sourceSha256=source_sha,reviewSha256=review_sha,
        attemptHeader=header_pin,declaration=declaration_pin,bindings=bindings))
    F._join_external_context(declaration_raw,header_raw,context_raw,source_sha,review_sha,refs)
    go_raw=_raw(dict(schema=1,kind='SIREN_EXTERNAL_GO_V1',stage='external-five-edge-supplied',sourceSha256=source_sha,
        reviewSha256=review_sha,sourcePlanPin=F._detach(expected_source_pin),reviewPin=F._detach(expected_review_pin),
        declarationPin=declaration_pin,attemptHeaderPin=header_pin,contextPin=_pin(F._runtime_path('context'),context_raw)))
    return dict(declaration=declaration_raw,header=header_raw,context=context_raw,go=go_raw)

def _read_external_go(*,go_raw,declaration_raw,header_raw,context_raw,source_plan_raw,source_buffers,
        review_raw,expected_source_pin,expected_review_pin):
    refs,source_sha,review_sha=_reviewed(source_plan_raw,source_buffers,declaration_raw,review_raw,expected_source_pin,expected_review_pin)
    go=F._load(go_raw)
    F._version(go,('schema','kind','stage','sourceSha256','reviewSha256','sourcePlanPin','reviewPin',
        'declarationPin','attemptHeaderPin','contextPin'),'SIREN_EXTERNAL_GO_V1')
    _need(go['stage']=='external-five-edge-supplied' and go['sourceSha256']==source_sha and go['reviewSha256']==review_sha and
        F._same(go['sourcePlanPin'],expected_source_pin) and F._same(go['reviewPin'],expected_review_pin),'GO_EXPECTED_REVIEW_SOURCE_JOIN')
    for key,label,body in [('declarationPin','declaration',declaration_raw),('attemptHeaderPin','attempt-header',header_raw),('contextPin','context',context_raw)]:
        F._literal_pin(go[key],F._runtime_path(label),body)
    result=F._join_external_context(declaration_raw,header_raw,context_raw,source_sha,review_sha,refs)
    result.update(disposition='REVIEWED_BYTES_CONSISTENT_ONLY',sourceBuffersVerified=True,authenticatedReview=False,
        sourcePlanSha256=source_sha,reviewSha256=review_sha,goSha256=hashlib.sha256(go_raw).hexdigest())
    return result
