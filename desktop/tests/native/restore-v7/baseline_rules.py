"""Pure admission rules over complete retained read-only Job observations."""
def need(ok,message):
    if not ok:raise ValueError(message)
def path(value):return str(value).replace('/','\\').casefold()
def members(sample):
    need(sample.get('errors')==[],'OBSERVATION_ERRORS_REFUSED')
    before,after=sample['beforePids'],sample['afterPids']
    need(before.get('querySucceeded') is True and after.get('querySucceeded') is True and before.get('complete') is True and after.get('complete') is True,'INCOMPLETE_MEMBERSHIP_REFUSED')
    a,b=before['pids'],after['pids'];need(a and len(set(a))==len(a) and len(set(b))==len(b) and set(a)==set(b),'UNSTABLE_MEMBERSHIP_REFUSED')
    for row in [before,after]:need(row['assigned']==row['returned']==len(row['pids']),'PID_LIST_CARDINALITY_REFUSED')
    raw=sample['rawAccounting'];need(raw.get('querySucceeded') is True,'FAILED_RAW_ACCOUNTING_REFUSED')
    for key,value in sample['helperAccounting'].items():need(raw['decoded'][key]==value,'ACCOUNTING_DECODE_MISMATCH')
    for row in [sample['helperAccounting'],sample['afterAccounting'],raw['decoded']]:need(row['activeProcesses']==len(a) and row['totalProcesses']>=len(a),'ACCOUNTING_CARDINALITY_REFUSED')
    identities=sample['identities'];need(len(identities)==len(a) and {r['pid'] for r in identities}==set(a),'EXACT_WIN32_IDENTITIES_REQUIRED')
    cim=sample['cim'];need(cim.get('querySucceeded') is True and not cim.get('error'),'CIM_QUERY_REFUSED');rows=cim['rows'];need(len(rows)==len(a) and {r['ProcessId'] for r in rows}==set(a),'EXACT_CIM_IDENTITIES_REQUIRED');by={r['ProcessId']:r for r in rows};result={}
    for row in identities:
        pid=row['pid'];need(isinstance(pid,int) and pid>0 and row['handlePid']==pid and row['exitCode']==259 and isinstance(row['creationFiletime'],int) and row['creationFiletime']>0,'LIVE_HANDLE_IDENTITY_REQUIRED')
        other=by[pid];need(other.get('ExecutablePath') and path(other['ExecutablePath'])==path(row['executablePath']) and isinstance(other.get('ParentProcessId'),int) and isinstance(other.get('CommandLine'),str) and other.get('CreationDate') is not None,'WIN32_CIM_IDENTITY_AGREEMENT_REQUIRED')
        result[pid]={'pid':pid,'path':path(row['executablePath']),'creationFiletime':row['creationFiletime'],'parentPid':other['ParentProcessId'],'commandLine':other['CommandLine'],'cimCreationDate':other['CreationDate']}
    return result
def admit_baseline(sample,actorPid,nodePin,consolePin):
    current=members(sample);need(actorPid in current and current[actorPid]['path']==path(nodePin['path']),'EXACT_ACTOR_REQUIRED')
    need(all(sample[k]['totalProcesses']==len(current) for k in ['helperAccounting','afterAccounting']),'NO_PRELAUNCH_HISTORICAL_MEMBER_REQUIRED')
    others=[row for pid,row in current.items() if pid!=actorPid];need(len(others)<=1,'ONLY_OBSERVED_HARNESS_MEMBERS_REQUIRED')
    for row in others:need(row['path']==path(consolePin['path']) and row['parentPid']==actorPid and row['creationFiletime']>=current[actorPid]['creationFiletime'],'EXACT_ACTOR_CONSOLE_IDENTITY_REQUIRED')
    return {'actorPid':actorPid,'members':list(current.values()),'scope':'This run pre-Electron harness only; no historical attribution'}
def require_closed(sample,baseline,applicationPid):
    current=members(sample);expected={row['pid']:row for row in baseline['members']}
    need(baseline['actorPid'] in current and applicationPid not in current and current==expected,'EXACT_PRELAUNCH_BASELINE_RETURN_REQUIRED')
    return {'baselinePids':sorted(expected),'currentPids':sorted(current),'identitiesUnchanged':True,'scope':'Complete Job membership equals exact pre-Electron harness identities; separate scoped app census still mandatory'}
