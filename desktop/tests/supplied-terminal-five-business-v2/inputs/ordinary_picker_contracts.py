"""Pure first-pilot evidence predicates and original capability continuity.

No native import, process creation, input, filesystem access or clocks on import.
"""
import json,re,ntpath
from datetime import datetime
class Refused(RuntimeError):pass
def need(value,code):
 if not value:raise Refused(code)
def exact(actual,expected):
 return type(actual) is type(expected) and (set(actual)==set(expected) and all(exact(actual[k],v) for k,v in expected.items()) if type(expected) is dict else len(actual)==len(expected) and all(exact(a,b) for a,b in zip(actual,expected)) if type(expected) is list else actual==expected)
def endpoint_lineage(stderr,portfile):
 need(type(stderr) is bytes and type(portfile) is bytes and len(stderr)<=1048576 and len(portfile)<=256,'ENDPOINT_BYTES')
 text=stderr.decode('utf8');parts=portfile.decode('ascii').splitlines()
 matches=re.findall(r'^DevTools listening on (\S+)\r?$',text,re.M)
 need(len(matches)==1 and len(parts)==2,'ONE_DEBUG_ENDPOINT')
 match=re.fullmatch(r'ws://127\.0\.0\.1:([1-9][0-9]{0,4})/devtools/browser/([a-f0-9-]{36})',matches[0])
 need(match is not None,'LOOPBACK_BROWSER_ENDPOINT');port=int(match[1]);guid=match[2]
 need(0<port<65536 and parts==[str(port),'/devtools/browser/'+guid],'PROFILE_STDERR_ENDPOINT_MISMATCH')
 need(re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',guid) is not None,'BROWSER_GUID')
 return dict(browserURL=matches[0],port=port,browserGuid=guid)
def home_endpoint(targets,endpoint):
 need(type(targets) is list and len(targets)<=64 and all(type(t) is dict for t in targets),'TARGET_LIST')
 pages=[t for t in targets if t.get('type')=='page' and t.get('url')=='siren://app/home.html']
 need(len(pages)==1,'UNIQUE_ACTUAL_HOME_PAGE');row=pages[0];identity=row.get('id')
 need(type(identity) is str and re.fullmatch('[A-Za-z0-9_-]{1,128}',identity) is not None,'HOME_TARGET_ID')
 wanted='ws://127.0.0.1:'+str(endpoint['port'])+'/devtools/page/'+identity
 need(row.get('webSocketDebuggerUrl')==wanted,'SAME_ENDPOINT_HOME_PAGE');return wanted
def journal_prefix(body):
 need(type(body) is bytes and len(body)<=32768,'PICKER_JOURNAL_BOUND')
 lines=body.split(b'\n');need(len(lines)<=18,'PICKER_JOURNAL_ROWS')
 rows=[json.loads(line) for line in lines[:-1]]
 need(all(type(r) is dict for r in rows),'PICKER_JOURNAL_DATA')
 return rows # An unclosed last line is never affirmative evidence.
def picker_boundary(rows,pid,ui,pointer_bits):
 need(type(rows) is list and 2<=len(rows)<=3,'ONE_PICKER_PREFIX');selected,boundary=rows[:2]
 expected=dict(version=1,sequence=1,stage='resolver-selected',failed=False,ordinal=1,branch='detached',projectId=ui['projectId'],windowId=ui['windowId'],epoch=ui['epoch'],role='terminal',webContentsId=selected.get('webContentsId'))
 need(exact(selected,expected) and type(selected['webContentsId']) is int and selected['webContentsId']>0,'PICKER_SELECTED_BINDING')
 parent_contents=boundary.get('parentWebContentsId');need(type(parent_contents) is int and parent_contents==selected['webContentsId'],'DETACHED_PARENT_CONTENTS_ID')
 wanted=dict(version=1,sequence=2,stage='api-call-boundary',failed=False,ordinal=1,matched=True,mainPid=pid,branch='detached',senderWebContentsId=selected['webContentsId'],parentWebContentsId=parent_contents,parentWebContentsStatus='ABSENT' if parent_contents is None else 'VALUE',handleBytes=pointer_bits//8,handleHex=boundary.get('handleHex'))
 need(exact(boundary,wanted),'REAL_API_BOUNDARY_REQUIRED')
 value=boundary['handleHex'];need(pointer_bits in [32,64] and type(value) is str and re.fullmatch('[a-f0-9]{'+str(pointer_bits//4)+'}',value) is not None,'PARENT_HWND_WIDTH')
 hwnd=int.from_bytes(bytes.fromhex(value),'little');need(0<hwnd<2**pointer_bits,'PARENT_HWND_VALUE');return hwnd
def iso_filetime(text):
 need(type(text) is str,'CREATION_ISO_TEXT')
 match=re.fullmatch(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,7}))?Z',text);need(match is not None,'CREATION_ISO_FORMAT')
 moment=datetime.strptime(match[1],'%Y-%m-%dT%H:%M:%S');span=moment-datetime(1601,1,1)
 ticks=(span.days*86400+span.seconds)*10000000+int((match[2] or '').ljust(7,'0'))
 need(0<ticks<2**64,'CREATION_FILETIME_RANGE');return str(ticks)
def clean_close(journal,identity):
 need(type(journal) is dict and set(journal)=={'schema','events'} and type(journal.get('schema')) is int and journal['schema']==1 and type(journal.get('events')) is list,'SESSION_JOURNAL')
 events=journal['events'];need(len(events)==3 and all(type(e) is dict and set(e)=={'event','sessionId','version','processIdentity','at'} for e in events) and [e.get('event') for e in events]==['opened','ready','clean-close'],'FRESH_SESSION_CLOSE_SEQUENCE')
 first=events[0];sid=first.get('sessionId');p=first.get('processIdentity')
 need(type(sid) is str and 0<len(sid)<=128 and type(p) is dict and set(p)=={'pid','path','startedAt'} and type(p.get('pid')) is int and p['pid']==identity['pid'] and type(p.get('path')) is str and 0<len(p['path'])<=32768 and ntpath.normcase(p['path'])==ntpath.normcase(identity['image']) and iso_filetime(p.get('startedAt'))==identity['createdFileTime'],'PERSISTED_SESSION_HELD_IDENTITY')
 need(all(e.get('sessionId')==sid and exact(e.get('processIdentity'),p) and type(e.get('version')) is str and 0<len(e['version'])<=128 and e['version']==first['version'] and type(e.get('at')) is str for e in events),'SAME_PERSISTED_CLOSE_SESSION')
 stamps=[int(iso_filetime(e['at'])) for e in events]
 need(stamps==sorted(stamps),'PERSISTED_EVENT_TIMESTAMPS')
 return dict(sessionId=sid,processIdentity=p,events=events,scope='actual persisted single-session clean-close')
def describe(error):
 try:text=str(error)
 except BaseException:text='<error text unavailable>'
 result=dict(type=type(error).__name__,message=text)
 try:notes=getattr(error,'__notes__',[])
 except BaseException:result['notesUnavailable']=True;return result
 if type(notes) is not list:result['notesUnavailable']=True;return result
 copied=[]
 if len(notes)>4:result['notesTruncated']=True
 for note in notes[:4]:
  if type(note) is not str:result['notesUnavailable']=True;continue
  if len(note)>4096:result['notesTruncated']=True
  copied.append(note[:4096])
 if copied:result['notes']=copied
 return result
class HeldCapability:
 def __init__(self,child):
  self.child=child;self.handle=child._handle;self.pid=child.pid;self.value=int(self.handle);self.failed=False
  self.check(child)
 def check(self,child):
  try:need(not self.failed and child is self.child and child._handle is self.handle and type(child.pid) is int and child.pid==self.pid and type(self.pid) is int and self.pid>0 and getattr(self.handle,'closed',None) is False and int(self.handle)==self.value and self.value>0,'ORIGINAL_HELD_CAPABILITY_CHANGED')
  except BaseException:self.failed=True;raise
  return child
def retire(child,capability,job,secondary,forced):
 """Never poll/wait/kill a refused Popen. Only its retained assigned Job."""
 usable=False;closed=None
 if child is not None:
  try:capability.check(child);usable=True
  except BaseException as error:secondary.append(dict(stage='cleanup-capability-refused',error=describe(error)))
 try:
  if child is not None and not usable:
   if job is not None and job.assignedPID is not None:forced.append('refused-capability-owned-job-retirement');job.terminate_owned()
   else:secondary.append(dict(stage='unknown-unassigned-child-closure',error=dict(type='UnknownClosure',message='Outer held Job supervision required')))
  elif usable:
   capability.check(child)
   if child.poll() is None:
    forced.append('owned-child-forced-retirement')
    if job is not None and job.assignedPID is not None:job.terminate_owned()
    else:capability.check(child);child.kill()
    capability.check(child);child.wait(timeout=5);capability.check(child)
 except BaseException as error:secondary.append(dict(stage='owned-child-retirement',error=describe(error)))
 if job is not None:
  try:closed=job.wait_empty(3);need(closed.get('closed') is True,'OWNED_JOB_NOT_EMPTY')
  except BaseException as error:secondary.append(dict(stage='job-empty',error=describe(error)))
  if closed is None or closed.get('closed') is not True:forced.append('kill-on-close-unclosed-job')
  try:job.close()
  except BaseException as error:secondary.append(dict(stage='job-close',error=describe(error)))
 return closed
