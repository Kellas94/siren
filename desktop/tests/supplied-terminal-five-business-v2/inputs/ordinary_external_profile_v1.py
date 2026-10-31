"""Private supplied-data consistency only; no filesystem, resources or admission."""
import hashlib,json
import ordinary_direct_fixed_plan as P

_EDGES=('owner','outer','inner','electron','ui')
_PRODUCERS=('preparer','supplier','inner','outer','C0','T0')
_MAX=262144
_ROSTER=(
 ('declaration','preparer',0,(),'BEFORE_SOURCE_REVIEW'),
 ('header','supplier',1,('declaration',),'BEFORE_CREATION'),
 ('context','supplier',2,('declaration','header'),'BEFORE_CREATION'),
 ('electron_capture','inner',3,('context',),'AFTER_ELECTRON_SETTLEMENT'),
 ('ui_capture','inner',3,('context',),'AFTER_UI_SETTLEMENT'),
 ('inner_result','inner',4,('context','electron_capture','ui_capture'),'INNER_SAVED_RESULT'),
 ('inner_capture','outer',5,('context','inner_result'),'AFTER_INNER_EXIT_AND_CAPTURE'),
 ('outer_result','outer',6,('context','inner_capture'),'OUTER_SAVED_RESULT'),
 ('outer_capture','C0',7,('context','outer_result'),'AFTER_OUTER_EXIT_AND_CAPTURE'),
 ('c0_report','C0',8,('outer_capture',),'AFTER_CLASSIFICATION_CLEANUP'),
 ('owner_capture','T0',9,('context','c0_report'),'AFTER_C0_EXIT_AND_OWNER_CAPTURE'),
 ('c0_delivery','T0',9,('c0_report',),'AFTER_REPORT_READBACK'),
 ('terminal_observation','T0',10,('owner_capture','c0_delivery'),'FINITE_EXTERNAL_BOUNDARY'))

def _need(value,code):
    if value is not True:raise ValueError('EXTERNAL_PROFILE:'+code)

def _keys(value,keys,code):
    _need(type(value) is dict and all(type(key) is str for key in value) and set(value)==set(keys),code)

def _hex(value,size):return type(value) is str and len(value)==size and all(c in '0123456789abcdef' for c in value)

def _same(a,b):
    if type(a) is not type(b):return False
    if type(a) is dict:return set(a)==set(b) and all(_same(a[key],b[key]) for key in a)
    if type(a) is list:return len(a)==len(b) and all(_same(x,y) for x,y in zip(a,b))
    return a==b

def _detach(value):
    if type(value) is dict:return {key:_detach(item) for key,item in value.items()}
    if type(value) is list:return [_detach(item) for item in value]
    return value

def _pairs(pairs):
    result={}
    for key,value in pairs:
        _need(key not in result,'DUPLICATE_JSON_KEY');result[key]=value
    return result

def _constant(value):raise ValueError('EXTERNAL_PROFILE:NONFINITE_JSON')

def _load(raw):
    _need(type(raw) is bytes and 0<len(raw)<=_MAX,'BOUNDED_LITERAL_BODY')
    try:return json.loads(raw.decode('utf8','strict'),object_pairs_hook=_pairs,parse_constant=_constant)
    except (UnicodeError,json.JSONDecodeError,RecursionError) as error:raise ValueError('EXTERNAL_PROFILE:MALFORMED_JSON') from error

def _version(value,keys,kind):
    _keys(value,keys,'CLOSED_'+kind)
    _need(type(value['schema']) is int and value['schema']==1 and type(value['kind']) is str and value['kind']==kind,'VERSIONED_'+kind)

def _fixed_edge_registry(plans):
    _need(type(plans) is tuple and len(plans)==5,'EXACT_FIXED_PLAN_ROSTER')
    rows=[]
    for edge,plan in zip(_EDGES,plans):
        plan=P._validate_fixed_plan(plan);_need(plan.edge==edge,'FIXED_PLAN_ORDER')
        rows.append(dict(edge=plan.edge,parent=plan.parent,child=plan.child,application=plan.application,
            argv=list(plan.argv),cwd=plan.cwd,environment=[list(row) for row in plan.environment],
            creationFlags=plan.creation_flags,maintainedParentBudgetSeconds=plan.maintained_parent_budget_seconds))
    return rows

def _runtime_path(label):return P._ROOT+'\\capture-external-'+label+'-v1.json'

def _source_refs(refs):
    _keys(refs,_PRODUCERS,'CLOSED_SOURCE_REFERENCES')
    runtime={_runtime_path(label).casefold() for label in ('declaration','attempt-header','context')}
    for ref in refs.values():
        if ref is None:continue
        _keys(ref,('path','bytes','sha256'),'SOURCE_REFERENCE_KEYS')
        path=ref['path']
        _need(type(path) is str and 0<len(path)<=4096 and path.startswith(P._WORK+'\\') and
            '\x00' not in path and '/' not in path and path.casefold() not in runtime,'STATIC_SOURCE_REFERENCE_PATH')
        reserved=tuple((P._ROOT+'\\'+name+'\\').casefold() for name in ('execution','data','temp','owned-profile'))
        _need(path.casefold().endswith('.py') and not path.casefold().startswith(reserved),'STATIC_PYTHON_PRODUCER_UNIT')
        parts=path[3:].split('\\')
        _need(all(part not in ('','.','..') and not part.endswith(('.', ' ')) and
            not any(char in '<>:"|?*' or ord(char)<32 for char in part) for part in parts),'CANONICAL_SOURCE_REFERENCE_PATH')
        _need(type(ref['bytes']) is int and 0<ref['bytes']<=2*1024*1024 and _hex(ref['sha256'],64),'SOURCE_REFERENCE_VALUE')
    return _detach(refs)

def _validate_producer_registry(rows,source_refs):
    refs=_source_refs(source_refs)
    _need(type(rows) is list and len(rows)==len(_ROSTER),'COMPLETE_PRODUCER_ROSTER')
    stages={row[0]:row[2] for row in _ROSTER}
    for row,(name,producer,stage,parents,availability) in zip(rows,_ROSTER):
        _keys(row,('id','producer','sourceRef','stage','parents','availability','applicability'),'CLOSED_PRODUCER_ROW')
        _need(type(row['id']) is str and row['id']==name and type(row['producer']) is str and row['producer']==producer and
            type(row['stage']) is int and row['stage']==stage,'FIXED_PRODUCER_STAGE')
        actual=row['parents']
        _need(type(actual) is list and all(type(parent) is str for parent in actual) and len(set(actual))==len(actual) and
            all(parent in stages and parent!=name and stages[parent]<stage for parent in actual),'CAUSAL_PRODUCER_PARENTS')
        _need(actual==list(parents) and row['availability']==availability and type(row['availability']) is str and
            type(row['applicability']) is str and row['applicability']=='REQUIRED','FIXED_PRODUCER_DEPENDENCIES')
        _need(_same(row['sourceRef'],refs[producer]),'EXACT_PRODUCER_SOURCE_REFERENCE')
    return _detach(rows)

def _read_external_header(raw):
    value=_load(raw)
    _version(value,('schema','kind','sourceSha256','reviewSha256','attemptId','creationInvocations'),'SIREN_EXTERNAL_HEADER_V1')
    _need(_hex(value['sourceSha256'],64) and _hex(value['reviewSha256'],64) and _hex(value['attemptId'],32),'HEADER_IDENTITIES')
    _keys(value['creationInvocations'],_EDGES,'FIVE_EXPLICIT_INVOCATIONS')
    ids=list(value['creationInvocations'].values())
    _need(all(_hex(item,32) for item in ids) and len(set(ids))==5,'DISTINCT_CREATION_INVOCATIONS')
    return value

def _literal_pin(pin,path,raw):
    _keys(pin,('path','bytes','sha256'),'LITERAL_PIN_KEYS')
    _need(type(pin['path']) is str and pin['path']==path and type(pin['bytes']) is int and
        type(raw) is bytes and 0<len(raw)<=_MAX and len(raw)==pin['bytes'] and _hex(pin['sha256'],64) and
        hashlib.sha256(raw).hexdigest()==pin['sha256'],'EXACT_LITERAL_PIN')

def _join_external_context(declaration_raw,header_raw,context_raw,source_sha,review_sha,source_refs):
    _need(_hex(source_sha,64) and _hex(review_sha,64),'EXPECTED_SOURCE_REVIEW')
    declaration=_load(declaration_raw);header=_read_external_header(header_raw);context=_load(context_raw)
    _version(declaration,('schema','kind','edges','producers'),'SIREN_EXTERNAL_DECLARATION_V1')
    _version(context,('schema','kind','sourceSha256','reviewSha256','attemptHeader','declaration','bindings'),'SIREN_EXTERNAL_CONTEXT_V1')
    _need(header['sourceSha256']==source_sha and header['reviewSha256']==review_sha and
        context['sourceSha256']==source_sha and context['reviewSha256']==review_sha,'EXPECTED_SOURCE_REVIEW_JOIN')
    _need(_same(declaration['edges'],_fixed_edge_registry(tuple(P._FixedPlan(edge) for edge in _EDGES))),'EXACT_FIXED_EDGE_DECLARATION')
    _validate_producer_registry(declaration['producers'],source_refs)
    _literal_pin(context['attemptHeader'],_runtime_path('attempt-header'),header_raw)
    _literal_pin(context['declaration'],_runtime_path('declaration'),declaration_raw)
    _keys(context['bindings'],_EDGES,'FIVE_EXPLICIT_BINDINGS')
    for row in declaration['edges']:
        edge=row['edge'];binding=context['bindings'][edge]
        _keys(binding,('attemptId','edge','headerSha256','creationInvocationId','parent','child'),'CLOSED_EDGE_BINDING')
        wanted=dict(attemptId=header['attemptId'],edge=edge,headerSha256=context['attemptHeader']['sha256'],
            creationInvocationId=header['creationInvocations'][edge],parent=row['parent'],child=row['child'])
        _need(_same(binding,wanted),'EXACT_EDGE_BINDING:'+edge)
    return dict(disposition='DECLARATION_CONSISTENT_ONLY',bindings=_detach(context['bindings']),
        unresolvedSources=[name for name in _PRODUCERS if source_refs[name] is None],
        nativeEligibility=False,sourceCustody=False,operationalEntry=False)

def _require_external_entry_admission(membership):
    # This version defines only supplied declarations. No caller label can adopt
    # missing entries, clocks, custody, terminal transport or occurrence policy.
    raise ValueError('EXTERNAL_PROFILE:NOT_ADOPTED')

def _classify_external_completion(events,exit_code):
    dependencies={'outer-observed':(), 'classification-cleanup':('outer-observed',),
        'report-serialized':('classification-cleanup',),'report-delivered':('report-serialized',),
        'c0-exit-observed':(),'owner-capture-settled':('c0-exit-observed',),
        'terminal-observed':('report-delivered','owner-capture-settled')}
    _need(type(events) is list and len(events)<=len(dependencies) and all(type(event) is str for event in events),'EVENT_LIST')
    seen=set()
    for event in events:
        _need(event in dependencies and event not in seen,'UNIQUE_KNOWN_EVENT')
        _need(all(parent in seen for parent in dependencies[event]),'EVENT_PREREQUISITES')
        _need(not(event=='report-serialized' and 'c0-exit-observed' in seen),'SERIALIZATION_BEFORE_EXIT')
        seen.add(event)
    _need(exit_code is None or type(exit_code) is int and 0<=exit_code<=0xffffffff,'EXACT_EXIT_CODE')
    _need(exit_code is None or 'c0-exit-observed' in seen,'NO_FUTURE_EXIT_CLAIM')
    available=exit_code is not None and 'c0-exit-observed' in seen
    complete=set(events)==set(dependencies)
    return dict(disposition='CONSISTENT_SUPPLIED_ONLY' if complete and available and exit_code==0 else 'ADVERSE',
        exitAvailable=available,exitCode=exit_code if available else None,eventRosterComplete=complete,
        nativeEligibility=False,sourceCustody=False,operationalEntry=False)
