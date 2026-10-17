"""Owned read-only observations; staged outside admitted candidates until review."""
from pathlib import Path
import ctypes,hashlib,json,os,stat,subprocess,time
from ctypes import wintypes as t
import job_members as members
POWERSHELL=None

def need(ok,message):
    if not ok:raise ValueError(message)

def no_links(path):
    path=Path(path);need(path.is_absolute(),'ABSOLUTE_PATH_REQUIRED')
    for node in (path,*path.parents):
        info=node.lstat();need(not stat.S_ISLNK(info.st_mode) and not getattr(info,'st_file_attributes',0)&1024,'LINK_REFUSED')

def pin(path):
    path=Path(path);no_links(path);value=path.read_bytes()
    return {'path':str(path.resolve()),'bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()}

def save(path,value):
    with Path(path).open('x',encoding='utf-8',newline='\n') as handle:
        json.dump(value,handle,indent=2,ensure_ascii=False);handle.write('\n');handle.flush();os.fsync(handle.fileno())

def checked_api(job,name,*args):
    value=getattr(job.api,name)(*args)
    if not value:
        code=ctypes.get_last_error()
        raise RuntimeError(f'{name}: {ctypes.WinError(code)} (winError={code})')
    return value

def held_identity(job,child):
    api=job.api
    for name,(args,result) in {'QueryFullProcessImageNameW':([t.HANDLE,t.DWORD,t.LPWSTR,ctypes.POINTER(t.DWORD)],t.BOOL),'GetProcessTimes':([t.HANDLE,ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME)],t.BOOL),'GetExitCodeProcess':([t.HANDLE,ctypes.POINTER(t.DWORD)],t.BOOL)}.items():
        fn=getattr(api,name);fn.argtypes=args;fn.restype=result
    handle=t.HANDLE(int(child._handle));pid=checked_api(job,'GetProcessId',handle);need(pid==child.pid,'ACTUAL_HELD_HANDLE_PID_REQUIRED')
    size=t.DWORD(32768);path=ctypes.create_unicode_buffer(size.value);checked_api(job,'QueryFullProcessImageNameW',handle,0,path,ctypes.byref(size))
    created,exited,kernel,user=t.FILETIME(),t.FILETIME(),t.FILETIME(),t.FILETIME();checked_api(job,'GetProcessTimes',handle,ctypes.byref(created),ctypes.byref(exited),ctypes.byref(kernel),ctypes.byref(user))
    code=t.DWORD();checked_api(job,'GetExitCodeProcess',handle,ctypes.byref(code))
    return {'pid':child.pid,'handlePid':pid,'heldHandleValue':int(child._handle),'executablePath':path.value,'creationFiletime':(created.dwHighDateTime<<32)|created.dwLowDateTime,'exitCode':code.value,'fromHeldChildHandle':True,'imagePathObservation':'LIVE_HELD_HANDLE_BEFORE_GO'}

def held_identity_after_exit(job,child,before):
    # The image name is a live observation, bound to this unchanged held object.
    need(isinstance(before,dict) and before.get('fromHeldChildHandle') is True and before.get('exitCode')==259 and before.get('imagePathObservation')=='LIVE_HELD_HANDLE_BEFORE_GO' and type(before.get('creationFiletime')) is int and 0<before['creationFiletime']<2**64 and isinstance(before.get('executablePath'),str) and Path(before['executablePath']).is_absolute(),'LIVE_IMAGE_BINDING_REQUIRED')
    need(type(before.get('heldHandleValue')) is int and before['heldHandleValue']==int(child._handle),'SAME_ORIGINAL_HELD_HANDLE_REQUIRED')
    api=job.api
    for name,(args,result) in {'GetProcessTimes':([t.HANDLE,ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME),ctypes.POINTER(t.FILETIME)],t.BOOL),'GetExitCodeProcess':([t.HANDLE,ctypes.POINTER(t.DWORD)],t.BOOL)}.items():
        fn=getattr(api,name);fn.argtypes=args;fn.restype=result
    handle=t.HANDLE(int(child._handle));pid=checked_api(job,'GetProcessId',handle)
    need(pid==child.pid==before.get('pid')==before.get('handlePid'),'ACTUAL_HELD_HANDLE_PID_REQUIRED')
    created,exited,kernel,user=t.FILETIME(),t.FILETIME(),t.FILETIME(),t.FILETIME();checked_api(job,'GetProcessTimes',handle,ctypes.byref(created),ctypes.byref(exited),ctypes.byref(kernel),ctypes.byref(user))
    creation=(created.dwHighDateTime<<32)|created.dwLowDateTime;need(creation==before['creationFiletime'],'SAME_HELD_CREATION_TIME_REQUIRED')
    code=t.DWORD();checked_api(job,'GetExitCodeProcess',handle,ctypes.byref(code));need(code.value!=259,'HELD_PROCESS_EXIT_REQUIRED')
    binding={name:before[name] for name in ['heldHandleValue','pid','creationFiletime','executablePath']}
    return {'pid':child.pid,'handlePid':pid,'heldHandleValue':int(child._handle),'creationFiletime':creation,'exitCode':code.value,'fromHeldChildHandle':True,'executablePath':before['executablePath'],'imagePathObservation':'BOUND_LIVE_HELD_HANDLE_BEFORE_GO','imagePathBinding':binding}

def census(scope,out,name,timeout):
    scope=Path(scope);need(scope.is_absolute() and "'" not in str(scope),'FIXED_SCOPE_PATH_REQUIRED')
    script="$ErrorActionPreference='Stop'; [Console]::Error.WriteLine('SIREN_CIM_STAGE|script-entered'); [Console]::Error.Flush(); [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); $s=Get-Content -LiteralPath '"+str(scope)+"' -Raw | ConvertFrom-Json; [Console]::Error.WriteLine('SIREN_CIM_STAGE|scope-read'); [Console]::Error.Flush(); $all=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop); [Console]::Error.WriteLine('SIREN_CIM_STAGE|cim-returned'); [Console]::Error.Flush(); $owned=@($all | Where-Object {$p=$_; if($p.ProcessId -eq $PID){return $false}; $matched=@($s.processPrefixes | Where-Object {$prefix=$_.Replace([char]47,[char]92); ($p.ExecutablePath -and $p.ExecutablePath.Replace([char]47,[char]92).IndexOf($prefix,[StringComparison]::OrdinalIgnoreCase) -ge 0) -or ($p.CommandLine -and $p.CommandLine.Replace([char]47,[char]92).IndexOf($prefix,[StringComparison]::OrdinalIgnoreCase) -ge 0)}); $matched.Count -gt 0} | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine); [Console]::Error.WriteLine('SIREN_CIM_STAGE|ownership-filtered'); [Console]::Error.Flush(); @{querySucceeded=$true; totalObserved=$all.Count; nullExecutableFields=@($all | Where-Object {-not $_.ExecutablePath}).Count; nullCommandFields=@($all | Where-Object {-not $_.CommandLine}).Count; owned=$owned} | ConvertTo-Json -Depth 5 -Compress; [Console]::Error.WriteLine('SIREN_CIM_STAGE|json-written'); [Console]::Error.Flush();"
    need(POWERSHELL is not None,'EXPLICIT_POWERSHELL_REQUIRED')
    command=[str(POWERSHELL),'-NoProfile','-NonInteractive','-Command',script]
    row={'startedAtNs':time.perf_counter_ns(),'scope':pin(scope),'timeoutSeconds':timeout,'observationScriptSha256':hashlib.sha256(script.encode('utf-8')).hexdigest()}
    try:
        result=subprocess.run(command,capture_output=True,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW);stdout,stderr=result.stdout,result.stderr;row['returncode']=result.returncode
    except subprocess.TimeoutExpired as error:
        stdout,stderr=error.stdout or b'',error.stderr or b'';row['error']={'type':type(error).__name__,'message':str(error)}
    for suffix,raw in [('stdout',stdout),('stderr',stderr)]:
        path=Path(out)/(name+'-'+suffix+'.bin')
        with path.open('xb') as handle:handle.write(raw)
        row[suffix]=pin(path)
    if row.get('returncode')==0 and not row.get('error'):
        try:row.update(json.loads(stdout.decode('utf-8-sig')))
        except BaseException as error:row['error']={'type':type(error).__name__,'message':str(error)}
    row['observedAtNs']=time.perf_counter_ns();save(Path(out)/(name+'.json'),row)
    need(not row.get('error') and row.get('returncode')==0 and row.get('querySucceeded') is True and isinstance(row.get('owned'),list),'CIM_OBSERVATION_UNAVAILABLE')
    return row

def empty_observation(job,scope,out,timeout):
    row={'startedAtNs':time.perf_counter_ns(),'errors':[]}
    for key,action in [('helperAccounting',job.accounting),('rawAccounting',lambda:members.raw_accounting(job)),('beforePids',lambda:members.process_ids(job)),('census',lambda:census(scope,out,'closed-census',timeout)),('afterPids',lambda:members.process_ids(job)),('afterAccounting',job.accounting)]:
        try:row[key]=action()
        except BaseException as error:row['errors'].append({'stage':key,'type':type(error).__name__,'message':str(error)})
    row['completedAtNs']=time.perf_counter_ns();save(Path(out)/'closure-observed-before-validation.json',row)
    return row

def domain_inventory(root,*,capture_root=False):
    root=Path(root);no_links(root);rows=[];total=0;files=0;dirs=0
    if capture_root:need(set(os.listdir(root))<=set(['Projects','Recovery','session-selection.json']),'CAPTURE_UNEXPECTED_ROOT_ENTRY')
    def walk(path):
        nonlocal total,files,dirs
        info=path.lstat();need(not stat.S_ISLNK(info.st_mode) and not getattr(info,'st_file_attributes',0)&1024,'DOMAIN_LINK_REFUSED')
        name=path.relative_to(root).as_posix()
        if stat.S_ISDIR(info.st_mode):
            dirs+=1;need(dirs<=4096 and name!='session-selection.json','DIRECTORY_BUDGET_OR_TYPE');rows.append({'relativePath':name,'kind':'directory'})
            for child in sorted(path.iterdir(),key=lambda p:p.name):walk(child)
        else:
            need(stat.S_ISREG(info.st_mode) and name not in ['Projects','Recovery'],'DOMAIN_FILE_TYPE_REQUIRED');files+=1;total+=info.st_size
            need(files<=4096 and info.st_size<=16777216 and total<=134217728,'DOMAIN_FILE_BUDGET')
            value=path.read_bytes();after=path.lstat();need(len(value)==info.st_size==after.st_size and info.st_mtime_ns==after.st_mtime_ns,'DOMAIN_CHANGED_DURING_READ')
            rows.append({'relativePath':name,'kind':'file','bytes':len(value),'sha256':hashlib.sha256(value).hexdigest()})
    for name in ['Projects','Recovery','session-selection.json']:
        child=root/name
        try:child.lstat()
        except FileNotFoundError:
            need(name!='Projects','PROJECTS_DOMAIN_REQUIRED');rows.append({'relativePath':name,'absent':True});continue
        walk(child)
    return sorted(rows,key=lambda row:row['relativePath'])
