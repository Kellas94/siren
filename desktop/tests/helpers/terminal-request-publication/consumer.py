"""QA-only request reader. Before empty commit exists, do not read either JSON body."""
from pathlib import Path
import hashlib,json,os,stat
NAMES={x+'-request.json' for x in ['ui-operator-ready','ui-folder-cancel','ui-folder-select','native-live','native-capacity','native-stopped','native-closed']}
def need(v,m):
 if not v:raise RuntimeError(m)
def reject_constant(value):
 raise ValueError('NONSTANDARD_JSON_CONSTANT:'+value)
def ident(s):return tuple(getattr(s,k,None) for k in ['st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns','st_birthtime_ns'])
def plain(p,directory=False):
 for x in (p,*p.parents):
  s=x.lstat();need(not stat.S_ISLNK(s.st_mode) and not getattr(s,'st_file_attributes',0)&1024,'REQUEST_REPARSE_REFUSED')
 s=p.lstat();need(p.resolve()==p and (stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode) and s.st_nlink==1),'ORDINARY_OWNED_REQUEST_REQUIRED');return s
def read(p,limit):
 before=plain(p);need(0<before.st_size<=limit,'REQUEST_BODY_BOUND')
 with p.open('rb') as f:
  opened=os.fstat(f.fileno());need((opened.st_dev,opened.st_ino,opened.st_size,opened.st_mtime_ns)==(before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns),'REQUEST_OPEN_IDENTITY_CHANGED');b=f.read(limit+1);need(len(b)==opened.st_size and f.read(1)==b'' and ident(opened)==ident(os.fstat(f.fileno())),'REQUEST_HELD_READ_CHANGED')
 need(ident(before)==ident(plain(p)),'REQUEST_READ_BOOKEND_CHANGED');return b,before
def read_committed(directory,filename,actor_pid):
 root=Path(directory);need(root.is_absolute() and root.name=='native-attempt-v1' and filename in NAMES and type(actor_pid) is int and actor_pid>0,'EXACT_REQUEST_SCOPE_REQUIRED');plain(root,True)
 marker=root/(filename+'.published')
 try:ms=plain(marker)
 except FileNotFoundError:return None
 need(ms.st_size==0,'EMPTY_REQUEST_COMMIT_REQUIRED')
 mp=root/(filename+'.completion.json');mb,mi=read(mp,16384);m=json.loads(mb,parse_constant=reject_constant)
 need(type(m) is dict and set(m)=={'kind','scope','actorPid','name','request'} and m['kind']=='OWNED_REQUEST_COMPLETION_V1' and m['scope']=='R12_TC08_EIGHT_SESSIONS_AND_CLEANUP_ATTEMPT' and m['actorPid']==actor_pid,'CLOSED_REQUEST_COMPLETION_REQUIRED')
 name=filename[:-len('-request.json')];name=name[3:] if name.startswith('ui-') else name;need(m['name']==name,'REQUEST_COMPLETION_PHASE_REQUIRED')
 p=root/filename;b,bi=read(p,2097152);ref=dict(path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest());need(m['request']==ref,'REQUEST_BODY_COMPLETION_JOIN_REQUIRED')
 req=json.loads(b,parse_constant=reject_constant);need(type(req) is dict and req.get('actorPid')==actor_pid and req.get('name')==name,'REQUEST_BODY_IDENTITY_REQUIRED')
 need(ident(ms)==ident(plain(marker)) and ident(mi)==ident(plain(mp)) and ident(bi)==ident(plain(p)),'REQUEST_PUBLICATION_DRIFT')
 return dict(value=req,reference=ref,completion=dict(path=str(mp),bytes=len(mb),sha256=hashlib.sha256(mb).hexdigest()),marker=dict(path=str(marker),bytes=0),authority=False)
