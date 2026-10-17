"""Physical QA boundaries. Automated manifests never substitute for peer DATA review."""
from pathlib import Path
import hashlib,json,os,shutil,stat,sys,time

REVIEW_MODE='AUTOMATED_OBSERVATIONS_REQUIRE_EXTERNAL_DATA_REVIEW'
APP_EXCLUSIONS=frozenset({'evidence','dist','Data','.git'})

def need(ok,code):
    if not ok:raise ValueError(code)

def safe(path):
    path=Path(path);need(path.is_absolute(),'ABSOLUTE_PATH_REQUIRED')
    for node in (path,*path.parents):
        info=node.lstat()
        need(not stat.S_ISLNK(info.st_mode) and not getattr(info,'st_file_attributes',0)&1024,'LINK_REFUSED')
    return path

def pin(path):
    path=safe(path);before=path.stat();need(stat.S_ISREG(before.st_mode),'REGULAR_FILE_REQUIRED')
    digest=hashlib.sha256();size=0
    with path.open('rb') as stream:
        while chunk:=stream.read(1024*1024):digest.update(chunk);size+=len(chunk)
    after=path.stat();need(size==before.st_size==after.st_size and before.st_mtime_ns==after.st_mtime_ns,'FILE_CHANGED_DURING_READ')
    return {'path':str(path.resolve()),'bytes':size,'sha256':digest.hexdigest()}

def read(path):
    def pairs(rows):
        out={}
        for key,value in rows:need(key not in out,'DUPLICATE_JSON_KEY');out[key]=value
        return out
    return json.loads(safe(path).read_bytes().decode('utf-8'),object_pairs_hook=pairs,parse_constant=lambda _:need(False,'NONFINITE_JSON_REFUSED'))

def save(path,value):
    safe(Path(path).parent)
    with Path(path).open('x',encoding='utf-8',newline='\n') as stream:
        json.dump(value,stream,indent=2,ensure_ascii=False);stream.write('\n');stream.flush();os.fsync(stream.fileno())

def snapshot(root,*,exclude=()):
    root=safe(root);need(root.is_dir(),'TREE_ROOT_REQUIRED');files=[];directories=[];total=0
    def walk(directory):
        nonlocal total
        for child in sorted(directory.iterdir()):
            if directory==root and child.name in exclude:continue
            safe(child);name=child.relative_to(root).as_posix()
            need(len(files)+len(directories)<50000,'TREE_ENTRY_BUDGET')
            if child.is_dir():directories.append(name);walk(child)
            else:
                row=pin(child);total+=row['bytes'];need(total<=4*1024**3,'TREE_BYTE_BUDGET')
                files.append({'relativePath':name,**row})
    walk(root)
    return {'root':str(root.resolve()),'files':files,'directories':directories,'bytes':total,'excludedRootEntries':sorted(exclude)}

def copy_app(source,target):
    source=safe(source);target=Path(target);need(not target.exists(),'FRESH_COPY_TARGET_REQUIRED')
    if target.is_relative_to(source):
        need(target.relative_to(source).parts[0] in APP_EXCLUSIONS,'COPY_RECURSION_REFUSED')
    safe(target.parent);original=snapshot(source,exclude=APP_EXCLUSIONS);target.mkdir()
    for name in original['directories']:(target/name).mkdir()
    for row in original['files']:
        path=Path(row['path']);need(pin(path)=={k:row[k] for k in ('path','bytes','sha256')},'SOURCE_COPY_DRIFT')
        with path.open('rb') as before,(target/row['relativePath']).open('xb') as after:shutil.copyfileobj(before,after,1024*1024)
        copied=pin(target/row['relativePath']);need(copied['bytes']==row['bytes'] and copied['sha256']==row['sha256'],'SOURCE_COPY_DRIFT')
    need(snapshot(source,exclude=APP_EXCLUSIONS)==original,'SOURCE_COPY_DRIFT')
    return original

def validate_stage(source,root,host,python,stage):
    need(isinstance(source,dict) and type(source.get('schema')) is int and source['schema']==1 and source.get('reviewMode')==REVIEW_MODE and source.get('stage')==stage and 'author' not in source,'AUTOMATED_STAGE_REQUIRED')
    need(source['python']==pin(python) and pin(host) in source['files'],'SELF_RUNTIME_REQUIRED')
    root=safe(root)
    need(not (root/'operation').exists() and not (root/'host-attempt.json').exists() and not (root/'host-result.json').exists(),'FRESH_STAGE_REQUIRED')
    names=[row['path'] for row in source['files']];need(len(names)==len(set(names)),'DUPLICATE_INPUT_PIN')
    actual={str(p.resolve()) for p in root.rglob('*') if p.is_file() and p!=root/'SOURCE-PINS.json'}
    expected={row['path'] for row in source['files'] if Path(row['path']).is_relative_to(root)}
    need(actual==expected,'STAGE_FILE_SET_REQUIRED')
    for row in source['files']:need(pin(row['path'])==row,'INPUT_PIN_DRIFT')

def validate_outer_go(value,pid):
    need(isinstance(value,dict) and type(value.get('pid')) is int and value['pid']==pid
         and isinstance(value.get('assignment'),dict)
         and type(value['assignment'].get('assignedActualHeldHandlePID')) is int
         and value['assignment']['assignedActualHeldHandlePID']==pid
         and value['assignment'].get('limitKillOnJobClose') is True,'OUTER_HELD_GO_REQUIRED')

def await_outer_go():
    """Bounded Windows pipe read, before any host application work or output."""
    import ctypes,msvcrt
    from ctypes import wintypes as t
    api=ctypes.WinDLL('kernel32',use_last_error=True)
    api.PeekNamedPipe.argtypes=[t.HANDLE,t.LPVOID,t.DWORD,ctypes.POINTER(t.DWORD),ctypes.POINTER(t.DWORD),ctypes.POINTER(t.DWORD)]
    api.PeekNamedPipe.restype=t.BOOL
    descriptor=sys.stdin.fileno();handle=t.HANDLE(msvcrt.get_osfhandle(descriptor));deadline=time.monotonic()+15;raw=b''
    while time.monotonic()<deadline:
        available=t.DWORD()
        need(bool(api.PeekNamedPipe(handle,None,0,None,ctypes.byref(available),None)),'OUTER_GO_PIPE_UNAVAILABLE')
        if available.value:
            raw+=os.read(descriptor,min(4096,available.value));need(len(raw)<=65536,'OUTER_GO_BYTE_BUDGET')
            if b'\n' in raw:
                need(raw.endswith(b'\n') and raw.count(b'\n')==1,'ONE_OUTER_GO_REQUIRED')
                value=json.loads(raw.decode('utf8'));validate_outer_go(value,os.getpid());return value
        else:time.sleep(.01)
    raise ValueError('OUTER_GO_TIMEOUT')
