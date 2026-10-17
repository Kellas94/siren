from pathlib import Path
import sys,json,hashlib,subprocess,os,time,ctypes,struct,base64
from ctypes import wintypes as t
R=Path(__file__).resolve().parent;OUT=R/'operation';POWERSHELL=None;ACTOR_DEADLINE=None
def need(ok,msg):
    if not ok:raise ValueError(msg)
def pin(p):
    p=Path(p);b=p.read_bytes();return {'path':str(p.resolve()),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def put(p,o):
    with Path(p).open('x',encoding='utf-8',newline='\n') as f:json.dump(o,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
def err(e):return {'type':type(e).__name__,'message':str(e)[:2500]}
def process_ids(job):
    class Pids(ctypes.Structure):_fields_=[('assigned',t.DWORD),('returned',t.DWORD),('pids',ctypes.c_size_t*512)]
    value=Pids();length=t.DWORD();ok=bool(job.api.QueryInformationJobObject(job.handle,3,ctypes.byref(value),ctypes.sizeof(value),ctypes.byref(length)));code=ctypes.get_last_error() if not ok else 0
    row={'querySucceeded':ok,'winError':code,'assigned':value.assigned,'returned':value.returned,'pids':list(value.pids[:min(value.returned,512)]),'returnedBytes':length.value,'capacity':512,'rawHex':ctypes.string_at(ctypes.byref(value),ctypes.sizeof(value)).hex()}
    row['complete']=ok and value.assigned<=512 and value.returned==value.assigned and len(set(row['pids']))==len(row['pids']) and all(0<x<2**32 for x in row['pids'])
    if not ok:row['error']={**err(ctypes.WinError(code)),'winError':code}
    elif not row['complete']:row['error']={'type':'IncompleteProcessList','message':'Complete valid process list required; raw buffer retained'}
    return row
def raw_accounting(job):
    raw=ctypes.create_string_buffer(48);length=t.DWORD();ok=bool(job.api.QueryInformationJobObject(job.handle,1,raw,48,ctypes.byref(length)));code=ctypes.get_last_error() if not ok else 0;values=struct.unpack('<qqqqIIII',raw.raw)
    row={'querySucceeded':ok,'winError':code,'hex':raw.raw.hex(),'returnedBytes':length.value,'decoded':dict(zip(['user','kernel','periodUser','periodKernel','pageFaults','totalProcesses','activeProcesses','terminatedProcesses'],values))}
    if not ok:row['error']={**err(ctypes.WinError(code)),'winError':code}
    return row
def identity(job,pid):
    api=job.api
    declarations={'OpenProcess':([t.DWORD,t.BOOL,t.DWORD],t.HANDLE),'QueryFullProcessImageNameW':([t.HANDLE,t.DWORD,t.LPWSTR,ctypes.POINTER(t.DWORD)],t.BOOL),'GetProcessTimes':([t.HANDLE,ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME)],t.BOOL),'GetExitCodeProcess':([t.HANDLE,ctypes.POINTER(t.DWORD)],t.BOOL)}
    for name,(args,result)in declarations.items():fn=getattr(api,name);fn.argtypes=args;fn.restype=result
    handle=api.OpenProcess(0x1000,False,pid);job.check(bool(handle))
    try:
        actual=api.GetProcessId(handle);need(actual==pid,'ACTUAL_HANDLE_PID_REQUIRED');size=t.DWORD(32768);path=ctypes.create_unicode_buffer(size.value);job.check(api.QueryFullProcessImageNameW(handle,0,path,ctypes.byref(size)))
        created,exited,kernel,user=t.FILETIME(),t.FILETIME(),t.FILETIME(),t.FILETIME();job.check(api.GetProcessTimes(handle,ctypes.byref(created),ctypes.byref(exited),ctypes.byref(kernel),ctypes.byref(user)));exitCode=t.DWORD();job.check(api.GetExitCodeProcess(handle,ctypes.byref(exitCode)))
        return {'pid':pid,'handlePid':actual,'executablePath':path.value,'creationFiletime':(created.dwHighDateTime<<32)|created.dwLowDateTime,'exitCode':exitCode.value}
    finally:job.check(api.CloseHandle(handle))
def sampled_cim(name,ids,row):
    need(ids and all(isinstance(n,int) and 0<n<2**32 for n in ids),'NUMERIC_OWNED_PID_FILTER_REQUIRED')
    query=' OR '.join('ProcessId = '+str(n) for n in ids)
    script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $rows=@(Get-CimInstance -ClassName Win32_Process -Filter '"+query+"' -ErrorAction Stop | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine); @{querySucceeded=$true;rows=$rows} | ConvertTo-Json -Depth 5 -Compress"
    remaining=ACTOR_DEADLINE-time.monotonic();need(remaining>0,'ACTOR_CUTOFF_BEFORE_CIM');row['timeoutSeconds']=min(10,remaining)
    try:
        result=subprocess.run([str(POWERSHELL),'-NoProfile','-NonInteractive','-Command',script],capture_output=True,timeout=row['timeoutSeconds'],creationflags=subprocess.CREATE_NO_WINDOW);stdout,stderr=result.stdout,result.stderr;row['returncode']=result.returncode
    except subprocess.TimeoutExpired as e:stdout,stderr=e.stdout or b'',e.stderr or b'';row['error']=err(e);row['timedOut']=True
    row['rawStreams']={suffix:{'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'base64Fallback':base64.b64encode(raw).decode() if len(raw)<=1048576 else None} for suffix,raw in [('stdout',stdout),('stderr',stderr)]}
    for suffix,raw in [('stdout',stdout),('stderr',stderr)]:
        with (OUT/(name+'-cim-'+suffix+'.bin')).open('xb') as f:f.write(raw)
    if row.get('error'):return row
    if row.get('returncode')!=0:row['error']={'type':'CimQueryFailure','message':'CIM failed; raw stderr preserved'};return row
    try:
        value=json.loads(stdout.decode('utf-8-sig'));need(value['querySucceeded'] and isinstance(value['rows'],list),'SUCCESSFUL_CIM_ARRAY_REQUIRED');row.update(value)
    except BaseException as e:row['error']=err(e)
    return row
class ObservationFailure(Exception):
    def __init__(self,errors):self.observedPrimary=errors[0];self.observedSecondary=errors[1:];super().__init__(errors[0]['message'])
def snapshot(job,name,actorPid,collector,requiredChild=None):
    row={'phase':name,'startedAt':time.time(),'identities':[],'errors':[]};collector.append(row)
    def observe(key,action):
        try:
            row[key]=action()
            if isinstance(row[key],dict) and row[key].get('error'):row['errors'].append({'stage':key,**row[key]['error']})
        except BaseException as e:
            if isinstance(row.get(key),dict) and row[key].get('error'):row['errors'].append({'stage':key,**row[key]['error']})
            row['errors'].append({'stage':key+'-observation-or-retention',**err(e)})
    try:
        observe('helperAccounting',job.accounting);observe('rawAccounting',lambda:raw_accounting(job));observe('beforePids',lambda:process_ids(job))
        if row.get('beforePids',{}).get('complete'):
            for pid in row['beforePids']['pids']:
                try:row['identities'].append(identity(job,pid))
                except BaseException as e:row['errors'].append({'stage':'identity','pid':pid,**err(e)})
            row['cim']={};observe('cim',lambda:sampled_cim(name,row['beforePids']['pids'],row['cim']))
        else:row['cimSkippedBecauseIncompletePidList']=True
        observe('afterPids',lambda:process_ids(job));observe('afterAccounting',job.accounting)
    finally:
        row['completedAt']=time.time()
        try:put(OUT/(name+'-snapshot.json'),row)
        except BaseException as e:row['errors'].append({'stage':'snapshot-retention',**err(e)})
    if row['errors']:raise ObservationFailure(row['errors'])
    need(set(row['beforePids']['pids'])==set(row['afterPids']['pids']),'STABLE_SAMPLED_MEMBERSHIP_REQUIRED');need(actorPid in row['afterPids']['pids'],'ACTOR_JOB_MEMBERSHIP_REQUIRED')
    if requiredChild is not None:need(requiredChild in row['afterPids']['pids'],'CHILD_JOB_MEMBERSHIP_REQUIRED')
    for key,value in row['helperAccounting'].items():need(row['rawAccounting']['decoded'][key]==value,'INDEPENDENT_ACCOUNTING_DECODE_REQUIRED')
    need(all(r['exitCode']==259 for r in row['identities']),'ACTUAL_LIVE_MEMBERS_REQUIRED');cim={r['ProcessId']:r for r in row['cim']['rows']};need(set(cim)==set(row['beforePids']['pids']),'EXACT_CIM_JOB_PID_SET_REQUIRED')
    for item in row['identities']:need(cim[item['pid']]['ExecutablePath'] and cim[item['pid']]['ExecutablePath'].lower()==item['executablePath'].lower(),'WIN32_CIM_EXECUTABLE_AGREEMENT_REQUIRED')
    return row
