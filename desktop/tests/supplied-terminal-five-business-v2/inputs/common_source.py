"""Fixed private ordinary-picker harness support; import inert."""
from pathlib import Path
import hashlib,importlib.util,importlib,json,os,stat,sys,time,types,threading
import _owned_early_checked_component as _checked_component
ROOT=Path(__file__).resolve().parent;W=ROOT.parent
A4=W/'terminal-operational-four-stage-candidate-v1-20261022-image';RUNTIME=A4/'runtime'
P3=W/'terminal-win32-observation-pilot-v3-20261018';T1=W/'terminal-readonly-dialog-topology-20261018'
C1=W/'terminal-fixed-escape-cancel-transport-20261018';CV2=W/'terminal-dialog-clock-v2-20261018'
FOCUS_POLICY=W/'terminal-address-focus-discriminator-core-v8-20261021'
QUERY_PROVENANCE=W/'terminal-window-foreground-cache-core-v1-20261021'
FG_PROVENANCE=W/'terminal-window-foreground-cache-core-v1-20261021'
FOCUS_NATIVE=W/'terminal-address-focus-native-binding-v1-20261021'
CLOSED_RECEIPT=W/'terminal-receipt-target-binding-v2-20261023/candidate'
DISCOVERY_DIAGNOSTICS=W/'terminal-dialog-discovery-diagnostics-20261018'
TOPOLOGY_MISMATCH=W/'terminal-topology-mismatch-cache-v1-20261019'
DIALOG_READINESS=W/'terminal-enumeration-lifetime-policy-v2-20261019/candidate'
FOREGROUND_OBSERVATION=W/'terminal-c1-foreground-observation-20261018'
OWNED_CAPTIONS=W/'terminal-owned-dialog-caption-observation-v2-20261018'
AV2=W/'terminal-owned-page-attach-v2-20261018';R8=W/'terminal-runtime-owner-filesystem-status-20261018'
PYTHON=W/'source-sync-ci-evidence-retention-20261016/runtime/python/python.exe';NODE=PYTHON.parent.parent/'node/node.exe';ELECTRON=RUNTIME/'electron/electron.exe'
OUT=ROOT/'execution';DATA=ROOT/'data';JOURNAL=A4/'picker-parent-observation.jsonl';ENDPOINT_JOURNAL=A4/'terminal-request-endpoint.jsonl'
PROBE='siren-ordinary-picker-cancel-v1'
IMAGE_WORKER_ROOT=W/'terminal-owned-dialog-image-worker-v1-20261019'
IMAGE_WORKER_SOURCE_SHA256='b1aaf433b0dea1ff1b51145d6b04799f1802ca22cfd30afa72683b6505e1b91b'
IMAGE_WORKER_ENTRY_SHA256='8e0b063813bf2135a0160b6f7c2ee6cbe98af6f1c759f2518ac73dbcef93aa06'
IMAGE_WORKER_REVIEW_SHA256='f9481b2d659041e7411cbc4d1441dc9d14b985ac7bffdcceea0bba64f830c823'
IMAGE_COMPONENT_ROOT=W/'terminal-owned-dialog-image-component-v2-20261019'
IMAGE_CODEC_ROOT=W/'terminal-owned-dialog-image-protocol-v1-20261019'
IMAGE_TRANSPORT_ROOT=W/'terminal-owned-dialog-image-transport-v1-20261019'
IMAGE_BASELINE_ROOT=W/'terminal-owned-dialog-image-loader-v1-20261019'
def _no_cache(path):
 path=Path(path)
 if os.path.lexists(path.parent/'__pycache__') or os.path.lexists(path.with_suffix('.pyc')):raise RuntimeError('LOCAL_BYTECODE_CACHE_REFUSED:'+str(path))

_EARLY_PATHS=dict(ordinary_picker_contracts=ROOT/'controller_contracts.py',ordinary_cancel_evidence=ROOT/'cancel_evidence.py',ordinary_focus_evidence=ROOT/'focus_evidence.py',ordinary_route_evidence=ROOT/'route_evidence.py',ordinary_closed_picker_consumer=CLOSED_RECEIPT/'subject.py',image_route_retention=W/'terminal-route-retention-policy-v3-20261019/retention.py',image_active_picker_journal_prefix=W/'terminal-active-picker-journal-prefix-reader-v1-20261019/prefix_reader.py')
_EARLY_PATHS.update(ordinary_direct_capture_core=ROOT/'capture_core.py',ordinary_direct_fixed_plan=ROOT/'fixed_launch_plan.py',ordinary_direct_finish_reader=ROOT/'read_finish.py',ordinary_direct_owner_reader=ROOT/'read_owner.py',ordinary_direct_context=ROOT/'direct_context.py')
_EARLY_PATHS.update(ordinary_described_error=ROOT/'described_error.py',ordinary_direct_results=ROOT/'direct_results.py')
_EARLY_PATHS.update(ordinary_direct_route=ROOT/'direct_route.py')
_EARLY_REQUESTED=set()

def local(name,path):
 if name in _EARLY_PATHS or Path(path) in _EARLY_PATHS.values():
  if name not in _EARLY_PATHS or Path(path)!=_EARLY_PATHS[name]:raise RuntimeError('EARLY_ALIAS_PATH')
  if name in _EARLY_REQUESTED:raise RuntimeError('EARLY_EXPLICIT_REQUEST_REPEATED')
  module=__import__(name,globals(),None,('__name__',),0)
  if module.__name__!=name or Path(module.__file__)!=_EARLY_PATHS[name] or sys.modules.get(name) is not module:raise RuntimeError('EARLY_MODULE_IDENTITY')
  _EARLY_REQUESTED.add(name);return module
 _no_cache(path)
 if name in sys.modules:raise RuntimeError('MODULE_NAME_ALREADY_PRESENT:'+name)
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);sys.modules[name]=module;spec.loader.exec_module(module);return module
k=local('ordinary_picker_contracts',ROOT/'controller_contracts.py');need=k.need;describe=k.describe
cancel=local('ordinary_cancel_evidence',ROOT/'cancel_evidence.py')
focus_evidence=local('ordinary_focus_evidence',ROOT/'focus_evidence.py')
route_evidence=local('ordinary_route_evidence',ROOT/'route_evidence.py')
consumer=local('ordinary_closed_picker_consumer',CLOSED_RECEIPT/'subject.py')
def pin(path):
 path=Path(path)
 if path.suffix.casefold()=='.py' and any(path.is_relative_to(root) for root in [ROOT,T1,C1,CV2,P3,FOCUS_POLICY,QUERY_PROVENANCE,FG_PROVENANCE,FOCUS_NATIVE,CLOSED_RECEIPT,DISCOVERY_DIAGNOSTICS,TOPOLOGY_MISMATCH,DIALOG_READINESS,FOREGROUND_OBSERVATION,OWNED_CAPTIONS,IMAGE_WORKER_ROOT,IMAGE_COMPONENT_ROOT,IMAGE_CODEC_ROOT,IMAGE_TRANSPORT_ROOT,IMAGE_BASELINE_ROOT]):_no_cache(path)
 for p in [*reversed(path.parents),path]:
  s=p.lstat();need(not s.st_file_attributes&0x400,'REPARSE_INPUT')
  need(stat.S_ISDIR(s.st_mode) if p!=path else stat.S_ISREG(s.st_mode) and s.st_nlink==1,'PHYSICAL_INPUT')
 before=path.lstat();body=path.read_bytes();after=path.lstat()
 fields=['st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns','st_birthtime_ns']
 need(all(getattr(before,f)==getattr(after,f) for f in fields) and len(body)==before.st_size,'INPUT_READ_CHANGED')
 return dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
def _read_pinned_body(path,maximum):
 path=Path(path);s=path.lstat();need(s.st_size<=maximum,'BOUNDED_FILE');first=pin(path);body=path.read_bytes();last=pin(path)
 need(first==last and len(body)==first['bytes'] and len(body)<=maximum and hashlib.sha256(body).hexdigest()==first['sha256'],'READ_CHANGED')
 return body,dict(last)

def read_bytes(path,maximum):
 return _read_pinned_body(path,maximum)[0]
def read(path,maximum=262144):return json.loads(read_bytes(path,maximum))
def write(path,value):
 body=(json.dumps(value,indent=2,ensure_ascii=True)+'\n').encode('ascii');need(len(body)<=4*1024*1024,'OUTPUT_BOUND')
 need(path.parent==OUT or path.parent==ROOT,'FIXED_OUTPUT_DIRECTORY')
 for p in [path.parent,*path.parent.parents]:need(not p.lstat().st_file_attributes&0x400,'OUTPUT_REPARSE')
 with path.open('xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
def publish(path,value):
 temp=path.with_name(path.name+'.pending');need(not os.path.lexists(path) and not os.path.lexists(temp),'EXCLUSIVE_BARRIER')
 write(temp,value);temp.rename(path) # Windows rename refuses an existing destination.
def remaining(deadline):
 value=deadline-time.monotonic();need(value>0,'ABSOLUTE_CONTROLLER_DEADLINE');return value
def wait_file(path,deadline,maximum=262144):
 while True:
  remaining(deadline)
  if os.path.lexists(OUT/'ui-adverse.json'):raise k.Refused('UI_WORKER_ADVERSE:'+json.dumps(read(OUT/'ui-adverse.json')))
  if os.path.lexists(path):
   # Node link publication is complete only after the fixed temp has gone.
   if not os.path.lexists(path.with_name(path.name+'.pending')):return read(path,maximum)
  time.sleep(min(.02,remaining(deadline)))
def envelope(stage,**facts):return dict(probe=PROBE,stage=stage,**facts)
def owned_environment():
 profile=ROOT/'owned-profile'
 return dict(SystemRoot=r'C:\Windows',WINDIR=r'C:\Windows',PATH=r'C:\Windows\System32',TEMP=str(ROOT/'temp'),TMP=str(ROOT/'temp'),USERPROFILE=str(profile),APPDATA=str(profile/'AppData/Roaming'),LOCALAPPDATA=str(profile/'AppData/Local'),HOMEDRIVE=profile.drive,HOMEPATH=str(profile)[len(profile.drive):])
def create_folders():
 for name in ['data','temp','owned-profile','owned-profile/Desktop','owned-profile/AppData','owned-profile/AppData/Local','owned-profile/AppData/Roaming']:
  p=ROOT/name;need(not os.path.lexists(p),'FRESH_OWNED_DIRECTORY');p.mkdir();s=p.lstat();need(stat.S_ISDIR(s.st_mode) and not s.st_file_attributes&0x400 and not any(p.iterdir()),'OWNED_EMPTY_DIRECTORY')
def decode_source_paths_v2(value):
 # Representation only: the reviewed input manifest still holds full native paths.
 if type(value) is not dict or set(value)!={'schema','root','paths'} or type(value['schema']) is not int or value['schema']!=2 or type(value['root']) is not str or value['root']!=W.as_posix():raise ValueError('SOURCE_PATH_SCHEMA')
 names=value['paths']
 if type(names) is not list or not names:raise ValueError('SOURCE_PATH_LIST')
 rows=[];seen=set()
 for name in names:
  if type(name) is not str or not name or len(name)>32768 or '\\' in name or ':' in name or any(ord(char)<32 or ord(char)==127 for char in name) or any(part in ('','.','..') or part.endswith(('.', ' ')) for part in name.split('/')) or Path(name).is_absolute():raise ValueError('SOURCE_RELATIVE_PATH')
  path=W/Path(name)
  if not path.is_relative_to(W) or str(path).casefold() in seen:raise ValueError('SOURCE_MEMBERSHIP_ALIAS')
  seen.add(str(path).casefold());rows.append(path)
 return rows
def _source_lexical(name,single=False,root=False):
 if type(name) is not str:raise ValueError('SOURCE_COMPONENT_TYPE')
 if name=='' and root:return
 if not name or len(name)>32768 or single and '/' in name or '\\' in name or ':' in name or any(ord(char)<32 or ord(char)==127 for char in name) or any(part in ('','.','..') or part.endswith(('.', ' ')) for part in name.split('/')):raise ValueError('SOURCE_CANONICAL_COMPONENT')
def decode_source_paths(value):

 def expand_v4(value):
  if (type(value) is not dict or any(type(key) is not str for key in value)
      or set(value)!={'schema','root','directories','names','entries'}
      or type(value['schema']) is not int or value['schema']!=4
      or type(value['root']) is not str or value['root']!='C:/Claude/SIREN_WORK'):
   raise ValueError('SOURCE_DICTIONARY_SCHEMA')
  directories=value['directories'];names=value['names'];entries=value['entries']
  if (type(entries) is not list or not 1<=len(entries)<=8192
      or type(directories) is not list or not 1<=len(directories)<=len(entries)
      or type(names) is not list or not 1<=len(names)<=len(entries)):
   raise ValueError('SOURCE_DICTIONARY_BOUNDS')
  if any(type(directory) is not str for directory in directories):
   raise ValueError('SOURCE_DICTIONARY_DIRECTORY_TYPE')
  seen=set()
  for name in names:
   if type(name) is not str or not name or name in seen:
    raise ValueError('SOURCE_DICTIONARY_NAME')
   seen.add(name)
  expanded=[];used=set()
  for entry in entries:
   if (type(entry) is not list or len(entry)!=2
       or type(entry[0]) is not int or not 0<=entry[0]<len(directories)
       or type(entry[1]) is not int or not 0<=entry[1]<len(names)):
    raise ValueError('SOURCE_DICTIONARY_ENTRY')
   directory,index=entry
   if index not in used:
    if index!=len(used):raise ValueError('SOURCE_NAME_FIRST_USE_ORDER')
    used.add(index)
   expanded.append([directory,names[index]])
  if len(used)!=len(names):raise ValueError('SOURCE_UNUSED_NAME')
  return dict(schema=3,root=value['root'],directories=list(directories),entries=expanded)
 if type(value) is dict and all(type(key) is str for key in value) and type(value.get('schema')) is int and value['schema']==4:value=expand_v4(value)
 if type(value) is not dict or set(value)!={'schema','root','directories','entries'} or type(value['schema']) is not int or value['schema']!=3 or type(value['root']) is not str or value['root']!=W.as_posix():raise ValueError('SOURCE_TABLE_SCHEMA')

 directories=value['directories'];entries=value['entries']

 if type(entries) is not list or not 1<=len(entries)<=8192 or type(directories) is not list or not 1<=len(directories)<=len(entries):raise ValueError('SOURCE_TABLE_BOUNDS')

 seen_directories=set()

 for directory in directories:

  _source_lexical(directory,root=True)

  if directory.casefold() in seen_directories:raise ValueError('SOURCE_DIRECTORY_ALIAS')

  seen_directories.add(directory.casefold())

 paths=[];seen_paths=set();used=set();expanded=0

 for entry in entries:

  if type(entry) is not list or len(entry)!=2 or type(entry[0]) is not int or not 0<=entry[0]<len(directories):raise ValueError('SOURCE_TABLE_ENTRY')

  index,name=entry;_source_lexical(name,single=True)

  if index not in used:

   if index!=len(used):raise ValueError('SOURCE_DIRECTORY_FIRST_USE_ORDER')

   used.add(index)

  relative=(directories[index]+'/' if directories[index] else '')+name;_source_lexical(relative)

  expanded+=len(relative.encode('utf8'))

  if expanded>2097152:raise ValueError('SOURCE_EXPANSION_BOUND')

  # Reapply the exact predecessor lexical, containment and native Path rules.

  path=decode_source_paths_v2(dict(schema=2,root=value['root'],paths=[relative]))[0]

  key=str(path).casefold()

  if key in seen_paths:raise ValueError('SOURCE_EXPANDED_PATH_ALIAS')

  seen_paths.add(key);paths.append(path)

 if len(used)!=len(directories):raise ValueError('SOURCE_UNUSED_DIRECTORY')

 return paths
def input_paths():
 body=read_bytes(ROOT/'SOURCE-PATHS.json',262144)
 need(hashlib.sha256(body).hexdigest()=='UNBOUND_NEW_SOURCE_MEMBERSHIP_SHA256','FIXED_REVIEWED_SOURCE_MEMBERSHIP')
 return decode_source_paths(json.loads(body))
def runtime_pins():
 body,episode_pin=_read_pinned_body(A4/'RUNTIME-MANIFEST.json',2*1024*1024)
 need(episode_pin['sha256']=='7df10f4f31a0f2e21ae08810dca230879cd4e8a715ec6735d3871e60ecc2bb30' and pin(A4/'RUNTIME-MANIFEST.json')==episode_pin,'ACCEPTED_OBSERVATION_RUNTIME_MANIFEST')
 manifest=json.loads(body)
 files=manifest['files'];need(type(files) is list and len(files)==3852,'RUNTIME_FILE_COUNT')
 rows=[]
 for row in files:
  rel=Path(row['path']);need(not rel.is_absolute() and '..' not in rel.parts,'RUNTIME_RELATIVE_PATH')
  actual=pin(RUNTIME/rel);need(actual['bytes']==row['bytes'] and actual['sha256']==row['sha256'],'OBSERVATION_RUNTIME_DRIFT');rows.append(actual)
 actual_paths={str(p.relative_to(RUNTIME)).replace('\\','/') for p in RUNTIME.rglob('*') if p.is_file()}
 need(actual_paths=={r['path'] for r in files},'RUNTIME_FILE_SET')
 wanted_dirs=manifest['directories'];need(type(wanted_dirs) is list and len(wanted_dirs)==263 and len(set(wanted_dirs))==263 and '' in wanted_dirs,'RUNTIME_DIRECTORY_SCHEMA')
 directories={''}|{str(p.relative_to(RUNTIME)).replace('\\','/') for p in RUNTIME.rglob('*') if p.is_dir()}
 need(directories==set(wanted_dirs),'RUNTIME_DIRECTORY_MEMBERSHIP')
 for p in [RUNTIME,*RUNTIME.rglob('*')]:need(not p.lstat().st_file_attributes&0x400,'RUNTIME_REPARSE')
 return rows
def source_gate():
 manifest=read(ROOT/'INPUT-MANIFEST.json',4*1024*1024);rows=[pin(p) for p in input_paths()]
 need(manifest.get('inputs')==rows,'CONCRETE_IMAGE_SOURCE_MEMBERSHIP_AND_PINS')
 need(pin(PYTHON)['sha256']=='4d6f5f81a4bca11191c4c7c6b43632694d0a4ce74e068619d8fdc161d469859a' and pin(NODE)['sha256']=='b3094d0b49f9ad602262a9921551737bb97637c05dd357a06ae98188d7290aa3','PINNED_PYTHON_NODE')
 need(pin(P3/'owned_job.py')['sha256']=='af6fb2e16d94ac48f074cb6cf54beb95e6f69a8f6923e623ab78421368a8c473','PINNED_OWNED_JOB')
 copy_path=W/'terminal-a4-direct-runtime-copy-v4-20261022/peer-copy-data-review.json'
 need(pin(copy_path)['sha256']=='7276f3cfea5b4a2ce4a92bac2993fca2c300f555455b2e063b233ca872dae513','ACTUAL_IMAGE_COPY_REVIEW_PIN')
 copied=read(copy_path);mp=pin(A4/'RUNTIME-MANIFEST.json')
 need(copied.get('author')=='/root/bootstrap_entry_map' and copied.get('verdict')=='NO_BLOCKING_OWNED_DIALOG_IMAGE_RUNTIME_COPY_DATA_FINDINGS' and copied.get('findings')==[] and Path(copied.get('candidate',''))==A4 and copied.get('manifestPin')==mp,'ACTUAL_IMAGE_RUNTIME_COPY_DATA_REVIEW')
 full=rows+[pin(ROOT/'INPUT-MANIFEST.json')];receipt=read(ROOT/'CONTROLLER-SOURCE-REVIEW.json',4*1024*1024)
 vector=hashlib.sha256(json.dumps(full,sort_keys=True,separators=(',',':')).encode('utf8')).hexdigest()
 need(receipt.get('author')=='/root/atomic_cleanup_review' and receipt.get('verdict')=='NO_BLOCKING_ORDINARY_PICKER_CONTROLLER_SOURCE_FINDINGS' and receipt.get('findings')==[] and receipt.get('inputManifest')==full[-1] and receipt.get('inputVectorSha256')==vector,'ACTUAL_IMAGE_CONTROLLER_SOURCE_REVIEW')
 return full+[pin(ROOT/'CONTROLLER-SOURCE-REVIEW.json')],runtime_pins()

def final_pins(rows,secondary):
 for row in rows:
  try:need(pin(Path(row['path']))==row,'FINAL_INPUT_DRIFT')
  except BaseException as error:secondary.append(dict(stage='final-pin',path=row['path'],error=describe(error)))
def final_runtime(secondary,role):
 scan_complete=False
 try:
  need(type(role) is str and role in ['inner','outer'],'FIXED_FINAL_RUNTIME_ROLE')
  rows=runtime_pins();scan_complete=True;path=OUT/('runtime-after-'+role+'.json')
  write(path,dict(stage='runtime-after',role=role,coverageComplete=True,fileCount=len(rows),rows=rows))
  return dict(coverageComplete=True,scanComplete=True,evidenceRetained=True,path=str(path),fileCount=len(rows))
 except BaseException as error:secondary.append(dict(stage='final-runtime-membership-and-bytes',role=role,coverageComplete=False,scanComplete=scan_complete,evidenceRetained=False,error=describe(error)))
def retained_streams(proof):
 paths=dict(journal=JOURNAL,stdout=OUT/'electron-stdout.log',stderr=OUT/'electron-stderr.log')
 need(type(proof.get('receiptFiles')) is dict and set(proof['receiptFiles'])==set(paths),'WHOLE_RECEIPT_FILE_SET')
 bodies={}
 for name,path in paths.items():
  expected=proof['receiptFiles'][name];need(pin(path)==expected,'QUIESCENT_RECEIPT_PIN_BEFORE')
  body=read_bytes(path,11264 if name=='journal' else 1048576)
  need(pin(path)==expected,'QUIESCENT_RECEIPT_PIN_AFTER');bodies[name]=body
 return bodies

def inner_completion(row,source,controller_identity):
 return route_evidence.inner_complete(row,source,k,cancel,consumer,retained_streams(row['proof']),controller_identity,focus_evidence)

def outer_completion(row,source):
 return route_evidence.outer_complete(row,source,k,cancel,consumer,retained_streams(row['inner']['proof']),focus_evidence)

_cleanup_fallback_diagnostics=[]
_cleanup_fallback_truncated=False
_native_bundle=None
_native_started=False
_native_closed=False

def cleanup_diagnostic(stage,error):
 details=describe(error)
 value=dict(stage=stage,error=(details['type']+':'+details['message'])[:4000])
 for name in ('notes','notesTruncated','notesUnavailable'):
  if name in details:value[name]=details[name]
 return value

def _retain_cleanup_fallback(value):
 global _cleanup_fallback_truncated
 if len(_cleanup_fallback_diagnostics)<4:_cleanup_fallback_diagnostics.append(value)
 else:_cleanup_fallback_truncated=True

def cleanup_fallback_context():
 value={}
 if _cleanup_fallback_diagnostics:value['cleanupFallback']=_cleanup_fallback_diagnostics
 if _cleanup_fallback_truncated:value['cleanupFallbackTruncated']=True
 return json.loads(json.dumps(value))

def retain_cleanup_emission(error):
 detail=describe(error)
 _retain_cleanup_fallback(dict(stage='source-cleanup-diagnostic-emission',error=(detail['type']+':'+detail['message'])[:512]))

def annotate_cleanup(primary,label,error):
 # Copy before shortening: do not mutate the exception or emitted diagnostics.
 value=cleanup_diagnostic('source-bundle-cleanup',error)
 if 'notes' in value:value['notes']=list(value['notes'])
 body=json.dumps(value,ensure_ascii=True,separators=(',',':'))
 while len(body)>4000:
  value['detailsTruncated']=True
  if any(value.get('notes',[])):
   value['notes']=[note[:len(note)//2] for note in value['notes']];value['notesTruncated']=True
  else:value['error']=value['error'][:len(value['error'])//2];value['errorTruncated']=True
  body=json.dumps(value,ensure_ascii=True,separators=(',',':'))
 try:BaseException.add_note(primary,label+body)
 except BaseException as annotation:
  details=describe(annotation)
  _retain_cleanup_fallback(dict(stage='source-cleanup-annotation',label=label[:64],cleanup=json.loads(body),error=(details['type']+':'+details['message'])[:512]))
  return False
 return True

def close_native_sources():
 global _native_closed
 if _native_closed:return
 _native_closed=True
 if _native_bundle is not None:_native_bundle.close()

def close_source_bundles(early_bundle):
 first=None
 try:close_native_sources()
 except BaseException as error:first=error
 try:early_bundle.close()
 except BaseException as error:
  if first is None:first=error
  else:annotate_cleanup(first,'EARLY_BUNDLE_CLEANUP:',error)
 if first is not None:raise first

def native_stack():
 global _native_bundle,_native_started
 if _native_closed:raise RuntimeError('NATIVE_SOURCES_CLOSED')
 if _native_started:raise RuntimeError('NATIVE_STACK_ALREADY_STARTED')
 _native_started=True
 plan=[('context.reference.folder_dialog_driver',T1/'context/reference/folder_dialog_driver.py',False),('context.observer',T1/'context/observer/__init__.py',True),('context.observer.native',T1/'context/observer/native.py',False),('topology',T1/'topology/__init__.py',True),('topology.native',T1/'topology/native.py',False),('escape_cancel',C1/'escape_cancel/__init__.py',True),('escape_cancel.native',C1/'escape_cancel/native.py',False),('ordinary_shared_dialog_clock',CV2/'dialog_clock.py',False),('ordinary_owned_job',P3/'owned_job.py',False),('siren_discovery_diagnostic_driver',DIALOG_READINESS/'diagnostic_driver.py',False),('siren_discovery_diagnostic_topology',TOPOLOGY_MISMATCH/'diagnostic_topology.py',False),('siren_owned_dialog_readiness',DIALOG_READINESS/'readiness.py',False),('siren_c1_foreground_observation',FOREGROUND_OBSERVATION/'foreground.py',False),('siren_owned_dialog_captions',OWNED_CAPTIONS/'captions.py',False),('siren_owned_dialog_caption_native',OWNED_CAPTIONS/'native.py',False),('ordinary_window_foreground_cache_window',QUERY_PROVENANCE/'provenance.py',False),('ordinary_window_foreground_cache_foreground',FG_PROVENANCE/'foreground.py',False),('ordinary_address_focus_core',FOCUS_POLICY/'focus.py',False),('ordinary_address_focus_native',FOCUS_NATIVE/'focus_native.py',False),('context.observer.adapter',T1/'context/observer/adapter.py',False),('topology.adapter',T1/'topology/adapter.py',False)]
 names=['context','context.reference','ordinary_window_query_provenance','ordinary_guard_foreground_provenance']+[name for name,path,package in plan]
 need(not any(name in sys.modules for name in names),'NATIVE_NAMESPACE_CONFLICT')
 manifest=json.loads((ROOT/'INPUT-MANIFEST.json').read_bytes())
 if type(manifest) is not dict or type(manifest.get('inputs')) is not list or not all(type(row) is dict and type(row.get('path')) is str for row in manifest['inputs']):raise RuntimeError('NATIVE_INPUT_MANIFEST')
 rows=[];buffers={}
 for name,path,package in plan:
  matches=[row for row in manifest['inputs'] if Path(row['path'])==path]
  if len(matches)!=1:raise RuntimeError('NATIVE_SELECTED_INPUT_ROW')
  row=matches[0];_no_cache(path);body=path.read_bytes()
  if type(row.get('bytes')) is not int or type(row.get('sha256')) is not str or len(body)!=row['bytes'] or hashlib.sha256(body).hexdigest()!=row['sha256']:raise RuntimeError('NATIVE_SOURCE_PIN')
  rows.append(dict(name=name,path=str(path),bytes=row['bytes'],sha256=row['sha256'],package=package));buffers[name]=body
 # Resolve native-only runtime names here, after the original main's gate.
 runtime={name:importlib.import_module(name) for name in ('dataclasses','ntpath','types','weakref','functools','ctypes','ctypes.wintypes','math','os','time','json')}
 if runtime['ctypes'].__dict__.get('wintypes') is not runtime['ctypes.wintypes']:raise RuntimeError('NATIVE_RUNTIME_CHILD_IDENTITY')
 _native_bundle=_checked_component.load_checked_plan(rows=rows,buffers=buffers,packages=['context','context.reference'],runtime_imports=runtime)
 modules=_native_bundle.modules
 model=modules['context.reference.folder_dialog_driver'];observer=modules['context.observer'];diagnostic_topology=modules['siren_discovery_diagnostic_topology'];escape=modules['escape_cancel'];native=modules['escape_cancel.native'];clock=modules['ordinary_shared_dialog_clock'];job=modules['ordinary_owned_job'];readiness=modules['siren_owned_dialog_readiness'];foreground=modules['siren_c1_foreground_observation'];captions=modules['siren_owned_dialog_captions'];caption_native=modules['siren_owned_dialog_caption_native'];focus_policy=modules['ordinary_address_focus_core'];focus_native=modules['ordinary_address_focus_native']
 return types.SimpleNamespace(model=model,observer=observer,topology=diagnostic_topology,escape=escape,native=native,clock=clock,readiness=readiness,foreground=foreground,captions=captions,caption_native=caption_native,focus_policy=focus_policy,focus_native=focus_native,OwnedJob=job.OwnedJob)

def held_identity(child,cap,facade,stack,executable):
 cap.check(child);api=stack.observer.ObservationAdapter(facade,cap.value,stack.model);value=api.process_identity(cap.value);cap.check(child)
 need(type(value) is stack.model.ProcessIdentity and value.pid==cap.pid and value.running is True and value.image.casefold()==str(executable).casefold() and stack.model._decimal(value.created_filetime),'HELD_PROCESS_IDENTITY')
 return api,dict(pid=value.pid,image=value.image,createdFileTime=value.created_filetime)
def live(child,cap,api,identity,stack):
 cap.check(child);value=api.process_identity(cap.value);cap.check(child)
 need(type(value) is stack.model.ProcessIdentity and value==stack.model.ProcessIdentity(identity['pid'],identity['image'],identity['createdFileTime'],True),'ORIGINAL_LIVE_IDENTITY')
def settled(child,cap,deadline):
 cap.check(child);code=child.wait(timeout=remaining(deadline));cap.check(child);poll=child.poll();cap.check(child)
 need(type(code) is int and code==0 and type(child.returncode) is int and child.returncode==0 and type(poll) is int and poll==0,'ORIGINAL_NORMAL_EXIT_REQUIRED')
 return dict(pid=cap.pid,auditOnlyProcessHandle=str(cap.value),sameOriginalPopenAndHandle=True,originalHandleClosed=False,waitExitCode=code,returncode=child.returncode,pollResult=poll,scope='original held capability; no post-exit image/FILETIME query')

# Appended to the maintained common derivative by its guarded source preparer.
# Runtime resource ports are explicit objects from the future checked native
# composition. No parser/serialized binding can manufacture those capabilities.
_direct_context_module=local('ordinary_direct_context',ROOT/'direct_context.py')
_direct_expected_started=False
_direct_expected=None
_direct_parent_started=False
_direct_parent=None
_direct_stack=None

def bind_expected_direct_context(source):
 global _direct_expected_started,_direct_expected
 need(not _direct_expected_started,'DIRECT_EXPECTED_CONTEXT_ONCE')
 _direct_expected_started=True
 review=pin(ROOT/'CONTROLLER-SOURCE-REVIEW.json')['sha256']
 # Runtime attempt bodies have GO pins; they do not hash themselves into SOURCE.
 go_body=read_bytes(ROOT/'go.json',262144)
 context_body=read_bytes(ROOT/'capture-context.json',262144)
 header_body=read_bytes(ROOT/'capture-attempt-header.json',262144)
 _direct_expected=_direct_context_module.from_supplied_go(go_body,context_body,header_body,
     source,review,claim_lock=threading.Lock())
 return _direct_expected

def direct_binding_matches(name,value):
 return _direct_expected is not None and _direct_expected.binding_matches(name,value)

def bind_direct_parent(stack,parent,deadline):
 global _direct_parent_started,_direct_parent,_direct_stack
 need(_direct_expected is not None and not _direct_parent_started,'DIRECT_PARENT_CONTEXT_ONCE')
 _direct_parent_started=True
 graph=getattr(stack,'direct_components',None)
 runtime=getattr(stack,'direct_runtime',None)
 need(graph is not None and type(runtime) is dict and
      set(runtime)=={'memory','layouts','kernel','crt','lock'},'QUALIFIED_DIRECT_COMPONENT_AND_RUNTIME_PORTS')
 _direct_parent=_direct_context_module._ParentContext(_direct_expected,parent,
     deadline_seconds=deadline,monotonic=time.monotonic,describe=describe,
     memory=runtime['memory'],layouts=runtime['layouts'],kernel=runtime['kernel'],
     crt=runtime['crt'],lock=runtime['lock'],budget=graph.C._Budget(),components=graph)
 _direct_stack=stack
 return _direct_parent

def new_direct_edge(stack,name,source,deadline,command):
 need(_direct_parent is not None and stack is _direct_stack and
      type(source) is str and source==_direct_expected.source_sha and
      type(deadline) is type(_direct_parent.deadline_seconds) and
      deadline==_direct_parent.deadline_seconds,'BOUND_ORIGINAL_PARENT_CONTEXT')
 return _direct_parent.new_edge(name,command)

def _original_direct_edge(edge):
 need(_direct_parent is not None and any(value is edge for value in _direct_parent.edges.values()),
      'ORIGINAL_CONTEXT_OWNED_EDGE')
 need(type(edge) is _direct_parent._components.A._OwnedEdge,'EXACT_DIRECT_EDGE_CLASS')
 return edge

def direct_security(stack):
 need(stack is _direct_stack and _direct_parent is not None,'BOUND_DIRECT_RUNTIME')
 runtime=stack.direct_runtime;layouts=runtime['layouts'];memory=runtime['memory']
 security=layouts['SECURITY_ATTRIBUTES']()
 security.nLength=memory.sizeof(layouts['SECURITY_ATTRIBUTES'])
 security.lpSecurityDescriptor=None;security.bInheritHandle=True
 return security

def direct_startup_storage(coordinator,plan):
 need(_direct_parent is not None,'BOUND_DIRECT_PARENT')
 matching=[edge for edge in _direct_parent.edges.values() if edge.q is coordinator]
 need(len(matching)==1 and matching[0].plan is plan,'ORIGINAL_FIXED_STARTUP_COORDINATOR')
 graph=_direct_parent._components
 with coordinator.lock:
  inherited=tuple(coordinator.backend._h(name).value for name in
      ('stdin.child','stdout.write','stderr.write'))
  jobs=(coordinator.backend._h('job').value,)
 return graph.T._StartupStorage(coordinator.backend.c,coordinator.backend.t,graph.P,
     plan,inherited,jobs)

def direct_pump(coordinator):
 # Real callback threads run independently. A production pump does not execute
 # callbacks synchronously or synthesize readiness, EOF or thread return.
 need(_direct_parent is not None and any(edge.q is coordinator for edge in _direct_parent.edges.values()),
      'ORIGINAL_DIRECT_COORDINATOR')
 return None

def held_direct_identity(edge,facade,stack,executable):
 _original_direct_edge(edge)
 need(stack is _direct_stack,'BOUND_IDENTITY_STACK')
 edge.borrow_identity();handle=edge.original_process_handle()
 api=stack.observer.ObservationAdapter(facade,handle,stack.model)
 value=api.process_identity(handle);edge.original_process_handle()
 need(type(value) is stack.model.ProcessIdentity and value.pid==edge._identity_pid and
      value.running is True and value.image.casefold()==str(executable).casefold() and
      stack.model._decimal(value.created_filetime),'ORIGINAL_DIRECT_PROCESS_IDENTITY')
 identity=edge.remember_identity(dict(pid=value.pid,image=value.image,createdFileTime=value.created_filetime))
 return api,identity

def live_direct(edge,api,identity,stack):
 _original_direct_edge(edge)
 need(stack is _direct_stack and _direct_context_module.C0._equal(identity,edge.identity),
      'BOUND_DIRECT_LIVE_IDENTITY')
 handle=edge.original_process_handle();value=api.process_identity(handle);edge.original_process_handle()
 need(type(value) is stack.model.ProcessIdentity and value==stack.model.ProcessIdentity(
      identity['pid'],identity['image'],identity['createdFileTime'],True),'ORIGINAL_DIRECT_LIVE_PROCESS')

# Kept separately for exact guarded insertion into the maintained common file.
# These helpers do not make missing bodies or an uncreated edge successful.
_direct_results_module=local('ordinary_direct_results',ROOT/'direct_results.py')
_direct_retained_bodies={}
_direct_retained_rows={}

def direct_normal_exit(value,identity):
 return _direct_expected is not None and _direct_results_module.normal_exit(value,identity,_direct_expected)

def _direct_original_staged_bodies(edge,row):
 _original_direct_edge(edge)
 if row['disposition']!='STAGED_FINISH':return None
 with edge.q.lock:
  ticket=edge.q.final_ticket
  need(ticket is not None and ticket is edge.q.capture._final and
       ticket._owner is edge.q.capture and ticket._kind=='READBACK' and
       ticket._fields['settled'] is True and ticket._fields['phase']==row['finalReadback']['phase'],
       'ORIGINAL_RETAINED_FINAL_TICKET')
  rows=ticket._fields['rows']
  need(type(rows) is tuple and len(rows)==4,'RETAINED_FINAL_BODY_ROSTER')
  bodies=tuple(value['body'] for value in rows)
  need(all(type(body) is bytes for body in bodies),'EXACT_RETAINED_BODY_BYTES')
 return bodies

def direct_edge_value(edge,secondary):
 if edge is None:return None
 try:
  _original_direct_edge(edge)
  # Invalidate only the exact original edge before refresh. No older success
  # survives a later unavailable projection or incomplete replacement.
  name=edge.plan.edge
  _direct_retained_rows.pop(name,None)
  _direct_retained_bodies.pop(name,None)
  need(edge.finalization_started,'ORIGINAL_FINALIZATION_ATTEMPTED')
  row=edge.project_outcome()
  bodies=_direct_original_staged_bodies(edge,row)
  _direct_results_module.edge_value(row,bodies,_direct_expected)
  _direct_retained_bodies[edge.plan.edge]=bodies
  _direct_retained_rows[edge.plan.edge]=json.loads(json.dumps(row,
      separators=(',',':'),ensure_ascii=True,allow_nan=False))
  return row
 except BaseException as error:
  secondary.append(dict(stage='direct-edge-projection',error=describe(error)))
  return None

def direct_edge_clean(row):
 try:
  need(type(row) is dict and _direct_expected is not None,'DIRECT_RESULT_AVAILABLE')
  name=row['binding']['edge']
  need(name in _direct_retained_rows and
       _direct_context_module.C0._equal(row,_direct_retained_rows[name]),'ORIGINAL_RETAINED_EDGE_PROJECTION')
  value=_direct_results_module.edge_value(row,_direct_retained_bodies[name],_direct_expected)
  return value['classification']=='CLEAN_INERT'
 except (k.Refused,ValueError,TypeError,KeyError):return False

def direct_receipt_files(edge):
 _original_direct_edge(edge)
 need(edge.plan.edge=='electron' and direct_edge_clean(_direct_retained_rows.get('electron')),
      'QUIESCENT_ORIGINAL_ELECTRON_CAPTURE')
 row=_direct_retained_rows['electron']
 # Journal is an additional physical input, not a capture body or authority.
 # Its actual reads must enter the future whole-occurrence accounting.
 journal=pin(JOURNAL)
 need(journal['bytes']<=11264,'BOUNDED_RECEIPT_JOURNAL')
 return dict(journal=journal,stdout=dict(row['bodyAvailability']['stdout']['reference']),
             stderr=dict(row['bodyAvailability']['stderr']['reference']))

def direct_retained_streams(proof,edge):
 _original_direct_edge(edge)
 need(edge.plan.edge=='electron' and direct_edge_clean(_direct_retained_rows.get('electron')),
      'ORIGINAL_ELECTRON_STREAMS_AFTER_FINISH')
 expected=proof.get('receiptFiles');need(type(expected) is dict and
     set(expected)=={'journal','stdout','stderr'},'DIRECT_RECEIPT_FILE_SET')
 row=_direct_retained_rows['electron'];bodies=_direct_retained_bodies['electron']
 for index,role in enumerate(('stdout','stderr')):
  need(_direct_context_module.C0._equal(expected[role],row['bodyAvailability'][role]['reference']) and
       expected[role]['bytes']==len(bodies[index]) and
       expected[role]['sha256']==hashlib.sha256(bodies[index]).hexdigest(),
       'EXACT_ORIGINAL_STAGED_RECEIPT_BODY')
 need(expected['journal']==pin(JOURNAL),'ORIGINAL_JOURNAL_PIN_BEFORE')
 journal=read_bytes(JOURNAL,11264)
 need(expected['journal']==pin(JOURNAL),'ORIGINAL_JOURNAL_PIN_AFTER')
 return dict(journal=journal,stdout=bodies[0],stderr=bodies[1])

# Matching versioned route consumer. Native/file custody and whole occurrence
# accounting remain separately required before this source can be installed.
_direct_route_module=local('ordinary_direct_route',ROOT/'direct_route.py')
_direct_saved_readbacks={}
_direct_saved_read_started=set()

def _direct_saved_capture_bodies(row,name):
 need(type(name) is str and name in ('electron','ui'),'FIXED_SAVED_CHILD_ROLE')
 need(_direct_parent is not None and _direct_parent.parent=='outer' and
      direct_edge_clean(_direct_retained_rows.get('inner')),'ORIGINAL_INNER_WRITER_QUIESCENCE')
 need(type(row) is dict and row.get('kind')=='MAINTAINED_DIRECT_EDGE_V1' and
      row.get('disposition')=='STAGED_FINISH' and direct_binding_matches(name,row.get('binding')),
      'CURRENT_SAVED_CHILD_EDGE')
 if name in _direct_saved_readbacks:
  saved,bodies=_direct_saved_readbacks[name]
  need(_direct_context_module.C0._equal(row,saved),'EXACT_PREVIOUS_SAVED_CHILD_RECORD')
  return bodies
 need(name not in _direct_saved_read_started,'SAVED_CHILD_BODY_READ_ONCE')
 _direct_saved_read_started.add(name)
 availability=row.get('bodyAvailability')
 need(type(availability) is dict and set(availability)=={'stdout','stderr','archive','index'},
      'SAVED_BODY_AVAILABILITY_ROSTER')
 paths=dict(stdout=OUT/(name+'-stdout.log'),stderr=OUT/(name+'-stderr.log'))
 if name=='electron':paths.update(archive=OUT/'electron-stderr-prefix-frames.bin',index=OUT/'electron-stderr-prefix-index.json')
 bodies=[]
 for role,cap in zip(('stdout','stderr','archive','index'),(1048576,1048576,4194304,262144)):
  data=availability[role]
  need(type(data) is dict and set(data)=={'state','reference'},'SAVED_BODY_AVAILABILITY_KEYS')
  if role not in paths:
   need(data['state']=='NOT_APPLICABLE' and data['reference'] is None,'INAPPLICABLE_SAVED_BODY')
   bodies.append(b'');continue
  path=paths[role];ref=data['reference']
  need(data['state']=='RETAINED_STAGED_BYTES' and type(ref) is dict and
       set(ref)=={'path','bytes','sha256'} and type(ref['path']) is str and ref['path']==str(path) and
       type(ref['bytes']) is int and 0<=ref['bytes']<=cap,'FIXED_SAVED_BODY_REFERENCE')
  need(pin(path)==ref,'SAVED_BODY_PIN_BEFORE')
  body=read_bytes(path,cap)
  need(len(body)==ref['bytes'] and hashlib.sha256(body).hexdigest()==ref['sha256'] and
       pin(path)==ref,'EXACT_SAVED_STAGED_BODY')
  bodies.append(body)
 result=tuple(bodies)
 _direct_results_module.edge_value(row,result,_direct_expected)
 _direct_saved_readbacks[name]=(json.loads(json.dumps(row,ensure_ascii=True,allow_nan=False)),result)
 return result

def _direct_child_bodies(row,edges):
 outcomes=row['edgeOutcomes']
 need(type(outcomes) is dict and set(outcomes)=={'electron','ui'},'DIRECT_CHILD_OUTCOME_ROSTER')
 if edges is None:return {name:_direct_saved_capture_bodies(outcomes[name],name) for name in ('electron','ui')}
 need(type(edges) is dict and set(edges)=={'electron','ui'},'EXACT_ORIGINAL_CHILD_EDGE_ROSTER')
 for name in ('electron','ui'):
  _original_direct_edge(edges[name])
  need(edges[name].plan.edge==name and direct_edge_clean(outcomes[name]),'ORIGINAL_CHILD_EDGE_AND_PROJECTION')
 return {name:_direct_retained_bodies[name] for name in ('electron','ui')}

def _direct_group_receipt_artifacts(proof,electron_row,electron_bodies):
 expected=proof['receiptFiles']
 need(type(expected) is dict and set(expected)=={'journal','stdout','stderr'},'GROUP_RECEIPT_FILE_ROSTER')
 for i,role in enumerate(('stdout','stderr')):
  need(_direct_context_module.C0._equal(expected[role],electron_row['bodyAvailability'][role]['reference']) and
       expected[role]['bytes']==len(electron_bodies[i]) and
       expected[role]['sha256']==hashlib.sha256(electron_bodies[i]).hexdigest(),
       'GROUP_RECEIPT_ORIGINAL_CAPTURE_BYTES')
 need(expected['journal']==pin(JOURNAL),'GROUP_JOURNAL_BEFORE')
 journal=read_bytes(JOURNAL,11264)
 need(expected['journal']==pin(JOURNAL),'GROUP_JOURNAL_AFTER')
 return dict(journal=journal,stdout=electron_bodies[0],stderr=electron_bodies[1])

def inner_direct_completion(row,source,controller_identity,edges):
 try:
  need(_direct_expected is not None and source==_direct_expected.source_sha,'EXPECTED_GROUP_SOURCE')
  _direct_route_module._envelope(row,source,_direct_expected,True)
  bodies=_direct_child_bodies(row,edges)
  artifacts=_direct_group_receipt_artifacts(row['proof'],row['edgeOutcomes']['electron'],bodies['electron'])
  return _direct_route_module.inner_complete(row,source,k,cancel,consumer,artifacts,controller_identity,
      focus_evidence,route_evidence,_direct_expected,bodies)
 except Exception:return False

def outer_direct_completion(row,source,edge):
 try:
  _direct_route_module._envelope(row,source,_direct_expected,False)
  _original_direct_edge(edge)
  need(edge.plan.edge=='inner' and direct_edge_clean(row['innerEdge']),'ORIGINAL_OUTER_INNER_EDGE')
  bodies=_direct_child_bodies(row['inner'],None)
  artifacts=_direct_group_receipt_artifacts(row['inner']['proof'],row['inner']['edgeOutcomes']['electron'],bodies['electron'])
  return _direct_route_module.outer_complete(row,source,k,cancel,consumer,artifacts,focus_evidence,
      route_evidence,_direct_expected,_direct_retained_bodies['inner'],bodies)
 except Exception:return False

def supplied_direct_go(source,review):
 # Supply attempt identifiers/header bytes externally. This publisher does not
 # invent actors, authenticate transport or place runtime bodies in SOURCE.
 context_body=read_bytes(ROOT/'capture-context.json',262144)
 header_body=read_bytes(ROOT/'capture-attempt-header.json',262144)
 def literal(path,body):return dict(path=str(path),bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
 value=dict(schema=1,kind='MAINTAINED_DIRECT_GO_V1',probe=PROBE,
     stage='ordinary-cancel-native-go-direct',sourceSha256=source,reviewSha256=review,
     contextPin=literal(ROOT/'capture-context.json',context_body),
     attemptHeaderPin=literal(ROOT/'capture-attempt-header.json',header_body))
 raw=json.dumps(value,separators=(',',':'),ensure_ascii=True,allow_nan=False).encode('ascii')
 _direct_context_module.from_supplied_go(raw,context_body,header_body,source,review,claim_lock=threading.Lock())
 return value


"""Explicit supplied business binding; selected with the retained common closure."""

def bind_five_role_business_v2(*,stack,parent,context,business_context,policy,clock,runtime,components):
 global _five_parent_started,_five_parent,_five_expected,_five_execution_context,_five_policy,_five_clock,_five_stack,_five_context_module,_five_results_module,_five_route_module,_five_timing_results,_five_retained_bodies,_five_retained_rows,_five_saved_readbacks,_five_saved_read_started,_five_bind_state,_five_identity_calls
 need(not globals().get('_five_parent_started',False),'FIVE_BUSINESS_BIND_ONCE')
 _five_parent_started=True
 _five_bind_state=dict(phase='RESERVED',parent=None,error=None)
 try:
  import ordinary_direct_context as CX
  import ordinary_direct_results as DX
  import ordinary_direct_timing_results_v1 as TR
  import ordinary_direct_route as ROUTE
  import ordinary_business_domain_v1 as BD
  need(type(business_context) is BD._BusinessDomainContextV1 and business_context._context is context,
       'ORIGINAL_SEPARATE_BUSINESS_EXECUTION_CONTEXTS')
  business_context._validate()
  need(type(parent) is str and parent in ('outer','inner') and clock.parent==parent and
       getattr(stack,'direct_components',None) is components,'ORIGINAL_BUSINESS_PARENT_STACK')
  _five_context_module=CX;_five_results_module=DX;_five_timing_results=TR;_five_route_module=ROUTE
  _five_expected=business_context;_five_execution_context=context;_five_policy=policy;_five_clock=clock;_five_stack=stack
  _five_retained_bodies={};_five_retained_rows={};_five_saved_readbacks={};_five_saved_read_started=set();_five_identity_calls=[]
  _five_parent=_five_bind_state['parent']=CX.from_five_role_execution_v2(supplied_context=context,policy=policy,clock=clock,runtime=runtime,components=components)
  _five_bind_state['phase']='BOUND';return _five_parent
 except BaseException as error:
  _five_bind_state['phase']='BIND_FAILED';_five_bind_state['error']=error;raise

def remaining_five_v2(deadline):
 need(globals().get('_five_parent') is not None,'FIVE_BOUND_BUSINESS_PARENT')
 own=_five_policy.edge(_five_parent.parent)
 need(type(deadline) in (int,float) and deadline==own['workCutoffMs']/1000,
      'ORIGINAL_OWN_ROLE_BUSINESS_WORK_STOP')
 now=_five_clock.now_ms();left=own['workCutoffMs']-now
 need(left>0,'FIVE_BUSINESS_WORK_CUTOFF');return left/1000

def direct_binding_matches_five_v2(name,value):
 return globals().get('_five_expected') is not None and _five_expected.binding_matches(name,value)

def bind_five_role_ports_v2(ports):
 global _five_ports_started,_five_ports,_five_work_calls
 need(not globals().get('_five_ports_started',False) and globals().get('_five_parent') is not None,'FIVE_PORT_BIND_ONCE')
 _five_ports_started=True;_five_work_calls=[]
 need(type(ports) is dict and set(ports)=={'write','publish','read','wait_file','read_bytes','pin'} and
      all(callable(p) for p in ports.values()),'EXPLICIT_FIXED_FIVE_BUSINESS_PORTS')
 _five_ports=dict(ports)

def _five_business_call_v2(name,args):
 need(globals().get('_five_ports') is not None and type(name) is str and name in _five_ports and
      type(args) is tuple and len(_five_work_calls)<4096,'FIXED_BOUNDED_BUSINESS_OPERATION')
 call=dict(operation=name,arguments=args,state='RESERVED',beforeMs=None,afterMs=None,returned=False,value=None,error=None)
 _five_work_calls.append(call)
 stop=_five_policy.edge(_five_parent.parent)['workCutoffMs']
 try:
  call['beforeMs']=_five_clock.now_ms();need(call['beforeMs']<stop,'FIVE_WORK_BEFORE_PORT')
  call['state']='DISPATCHED';value=_five_ports[name](*args)
  call['value']=value;call['returned']=True;call['state']='RETURNED'
  call['afterMs']=_five_clock.now_ms();need(call['afterMs']<stop,'FIVE_WORK_AFTER_PORT')
  return value
 except BaseException as error:
  call['error']=error;raise

def write_five_v2(path,value):return _five_business_call_v2('write',(path,value))
def publish_five_v2(path,value):return _five_business_call_v2('publish',(path,value))
def read_five_v2(path,maximum=4194304):return _five_business_call_v2('read',(path,maximum))
def read_bytes_five_v2(path,maximum):return _five_business_call_v2('read_bytes',(path,maximum))
def pin_five_v2(path):return _five_business_call_v2('pin',(path,))
def wait_file_five_v2(path,deadline):
 need(type(deadline) in (int,float) and deadline==_five_policy.edge(_five_parent.parent)['workCutoffMs']/1000,'ORIGINAL_FIVE_WAIT_WORK_STOP')
 return _five_business_call_v2('wait_file',(path,deadline))

def _five_identity_observation_v2(edge,api,handle,stack):
 _original_direct_edge_five_v2(edge)
 need(stack is _five_stack and len(_five_identity_calls)<4096,'ORIGINAL_BOUNDED_IDENTITY_OPERATION')
 call=dict(edge=edge,api=api,handle=handle,state='RESERVED',beforeMs=None,afterMs=None,returned=False,value=None,error=None)
 _five_identity_calls.append(call);stop=_five_policy.edge(_five_parent.parent)['workCutoffMs']
 try:
  call['beforeMs']=edge._timing.sample();need(call['beforeMs']<stop and call['beforeMs']<edge._timing.work_cutoff_ms,'FIVE_IDENTITY_BEFORE_WORK_STOP')
  call['state']='DISPATCHED';value=api.process_identity(handle)
  call['value']=value;call['returned']=True;call['state']='RETURNED'
  call['afterMs']=edge._timing.sample();need(call['afterMs']<stop and call['afterMs']<edge._timing.work_cutoff_ms,'FIVE_IDENTITY_AFTER_WORK_STOP')
  return value
 except BaseException as error:
  call['error']=error;raise

def _five_reraise_operation_error_v2(error):
 if error is _five_clock.error or any(c['error'] is error for c in globals().get('_five_work_calls',[])+_five_identity_calls):raise error


def _original_direct_edge_five_v2(edge):
    need(_five_parent is not None and any((value is edge for value in _five_parent.edges.values())), 'ORIGINAL_CONTEXT_OWNED_EDGE')
    need(type(edge) is _five_parent._components.A._OwnedEdge, 'EXACT_DIRECT_EDGE_CLASS')
    return edge

def direct_normal_exit_five_v2(value, identity):
    return _five_expected is not None and _five_results_module.normal_exit(value, identity, _five_expected)

def _direct_original_staged_bodies_five_v2(edge, row):
    _original_direct_edge_five_v2(edge)
    if row['disposition'] != 'STAGED_FINISH':
        return None
    with edge.q.lock:
        ticket = edge.q.final_ticket
        need(ticket is not None and ticket is edge.q.capture._final and (ticket._owner is edge.q.capture) and (ticket._kind == 'READBACK') and (ticket._fields['settled'] is True) and (ticket._fields['phase'] == row['finalReadback']['phase']), 'ORIGINAL_RETAINED_FINAL_TICKET')
        rows = ticket._fields['rows']
        need(type(rows) is tuple and len(rows) == 4, 'RETAINED_FINAL_BODY_ROSTER')
        bodies = tuple((value['body'] for value in rows))
        need(all((type(body) is bytes for body in bodies)), 'EXACT_RETAINED_BODY_BYTES')
    return bodies

def direct_edge_value_five_v2(edge, secondary):
    if edge is None:
        return None
    try:
        _original_direct_edge_five_v2(edge)
        name = edge.plan.edge
        _five_retained_rows.pop(name, None)
        _five_retained_bodies.pop(name, None)
        need(edge.finalization_started, 'ORIGINAL_FINALIZATION_ATTEMPTED')
        timed = edge.project_timed_outcome()
        row = timed['edge']
        bodies = _direct_original_staged_bodies_five_v2(edge, row)
        _five_timing_results.read_five_role_v2(json.dumps(timed, separators=(',', ':'), ensure_ascii=True, allow_nan=False).encode('ascii'), bodies, _five_execution_context, _five_policy)
        _five_retained_bodies[edge.plan.edge] = bodies
        _five_retained_rows[edge.plan.edge] = json.loads(json.dumps(timed, separators=(',', ':'), ensure_ascii=True, allow_nan=False))
        return timed
    except BaseException as error:
        secondary.append(dict(stage='direct-edge-projection', error=describe(error)))
        return None

def direct_edge_clean_five_v2(row):
    try:
        need(type(row) is dict and _five_expected is not None, 'DIRECT_RESULT_AVAILABLE')
        name = row['edge']['binding']['edge']
        need(name in _five_retained_rows and _five_context_module.C0._equal(row, _five_retained_rows[name]), 'ORIGINAL_RETAINED_EDGE_PROJECTION')
        value = _five_timing_results.read_five_role_v2(json.dumps(row, separators=(',', ':'), ensure_ascii=True, allow_nan=False).encode('ascii'), _five_retained_bodies[name], _five_execution_context, _five_policy)
        return value['classification'] == 'CLEAN_INERT'
    except (k.Refused, ValueError, TypeError, KeyError):
        return False

def direct_receipt_files_five_v2(edge):
    _original_direct_edge_five_v2(edge)
    need(edge.plan.edge == 'electron' and direct_edge_clean_five_v2(_five_retained_rows.get('electron')), 'QUIESCENT_ORIGINAL_ELECTRON_CAPTURE')
    row = _five_retained_rows['electron']['edge']
    journal = pin_five_v2(JOURNAL)
    need(journal['bytes'] <= 11264, 'BOUNDED_RECEIPT_JOURNAL')
    return dict(journal=journal, stdout=dict(row['bodyAvailability']['stdout']['reference']), stderr=dict(row['bodyAvailability']['stderr']['reference']))

def direct_retained_streams_five_v2(proof, edge):
    _original_direct_edge_five_v2(edge)
    need(edge.plan.edge == 'electron' and direct_edge_clean_five_v2(_five_retained_rows.get('electron')), 'ORIGINAL_ELECTRON_STREAMS_AFTER_FINISH')
    expected = proof.get('receiptFiles')
    need(type(expected) is dict and set(expected) == {'journal', 'stdout', 'stderr'}, 'DIRECT_RECEIPT_FILE_SET')
    row = _five_retained_rows['electron']['edge']
    bodies = _five_retained_bodies['electron']
    for index, role in enumerate(('stdout', 'stderr')):
        need(_five_context_module.C0._equal(expected[role], row['bodyAvailability'][role]['reference']) and expected[role]['bytes'] == len(bodies[index]) and (expected[role]['sha256'] == hashlib.sha256(bodies[index]).hexdigest()), 'EXACT_ORIGINAL_STAGED_RECEIPT_BODY')
    need(expected['journal'] == pin_five_v2(JOURNAL), 'ORIGINAL_JOURNAL_PIN_BEFORE')
    journal = read_bytes_five_v2(JOURNAL, 11264)
    need(expected['journal'] == pin_five_v2(JOURNAL), 'ORIGINAL_JOURNAL_PIN_AFTER')
    return dict(journal=journal, stdout=bodies[0], stderr=bodies[1])

def _direct_saved_capture_bodies_five_v2(row, name):
    need(type(name) is str and name in ('electron', 'ui'), 'FIXED_SAVED_CHILD_ROLE')
    need(_five_parent is not None and _five_parent.parent == 'outer' and direct_edge_clean_five_v2(_five_retained_rows.get('inner')), 'ORIGINAL_INNER_WRITER_QUIESCENCE')
    need(type(row) is dict and row.get('kind') == 'SIREN_FIVE_ROLE_TIMED_EDGE_V2' and type(row.get('edge')) is dict and row['edge'].get('kind') == 'SIREN_FIVE_ROLE_DIRECT_EDGE_V2' and row['edge'].get('disposition') == 'STAGED_FINISH' and direct_binding_matches_five_v2(name, row['edge'].get('binding')), 'CURRENT_SAVED_CHILD_EDGE')
    if name in _five_saved_readbacks:
        saved, bodies = _five_saved_readbacks[name]
        need(_five_context_module.C0._equal(row, saved), 'EXACT_PREVIOUS_SAVED_CHILD_RECORD')
        return bodies
    need(name not in _five_saved_read_started, 'SAVED_CHILD_BODY_READ_ONCE')
    _five_saved_read_started.add(name)
    availability = row['edge'].get('bodyAvailability')
    need(type(availability) is dict and set(availability) == {'stdout', 'stderr', 'archive', 'index'}, 'SAVED_BODY_AVAILABILITY_ROSTER')
    paths = dict(stdout=OUT / (name + '-stdout.log'), stderr=OUT / (name + '-stderr.log'))
    if name == 'electron':
        paths.update(archive=OUT / 'electron-stderr-prefix-frames.bin', index=OUT / 'electron-stderr-prefix-index.json')
    bodies = []
    for role, cap in zip(('stdout', 'stderr', 'archive', 'index'), (1048576, 1048576, 4194304, 262144)):
        data = availability[role]
        need(type(data) is dict and set(data) == {'state', 'reference'}, 'SAVED_BODY_AVAILABILITY_KEYS')
        if role not in paths:
            need(data['state'] == 'NOT_APPLICABLE' and data['reference'] is None, 'INAPPLICABLE_SAVED_BODY')
            bodies.append(b'')
            continue
        path = paths[role]
        ref = data['reference']
        need(data['state'] == 'RETAINED_STAGED_BYTES' and type(ref) is dict and (set(ref) == {'path', 'bytes', 'sha256'}) and (type(ref['path']) is str) and (ref['path'] == str(path)) and (type(ref['bytes']) is int) and (0 <= ref['bytes'] <= cap), 'FIXED_SAVED_BODY_REFERENCE')
        need(pin_five_v2(path) == ref, 'SAVED_BODY_PIN_BEFORE')
        body = read_bytes_five_v2(path, cap)
        need(len(body) == ref['bytes'] and hashlib.sha256(body).hexdigest() == ref['sha256'] and (pin_five_v2(path) == ref), 'EXACT_SAVED_STAGED_BODY')
        bodies.append(body)
    result = tuple(bodies)
    _five_timing_results.read_five_role_v2(json.dumps(row, separators=(',', ':'), ensure_ascii=True, allow_nan=False).encode('ascii'), result, _five_execution_context, _five_policy)
    _five_saved_readbacks[name] = (json.loads(json.dumps(row, ensure_ascii=True, allow_nan=False)), result)
    return result

def _direct_child_bodies_five_v2(row, edges):
    outcomes = row['edgeOutcomes']
    need(type(outcomes) is dict and set(outcomes) == {'electron', 'ui'}, 'DIRECT_CHILD_OUTCOME_ROSTER')
    if edges is None:
        return {name: _direct_saved_capture_bodies_five_v2(outcomes[name], name) for name in ('electron', 'ui')}
    need(type(edges) is dict and set(edges) == {'electron', 'ui'}, 'EXACT_ORIGINAL_CHILD_EDGE_ROSTER')
    for name in ('electron', 'ui'):
        _original_direct_edge_five_v2(edges[name])
        need(edges[name].plan.edge == name and direct_edge_clean_five_v2(outcomes[name]), 'ORIGINAL_CHILD_EDGE_AND_PROJECTION')
    return {name: _five_retained_bodies[name] for name in ('electron', 'ui')}

def _direct_group_receipt_artifacts_five_v2(proof, electron_row, electron_bodies):
    electron_row = electron_row['edge']
    expected = proof['receiptFiles']
    need(type(expected) is dict and set(expected) == {'journal', 'stdout', 'stderr'}, 'GROUP_RECEIPT_FILE_ROSTER')
    for i, role in enumerate(('stdout', 'stderr')):
        need(_five_context_module.C0._equal(expected[role], electron_row['bodyAvailability'][role]['reference']) and expected[role]['bytes'] == len(electron_bodies[i]) and (expected[role]['sha256'] == hashlib.sha256(electron_bodies[i]).hexdigest()), 'GROUP_RECEIPT_ORIGINAL_CAPTURE_BYTES')
    need(expected['journal'] == pin_five_v2(JOURNAL), 'GROUP_JOURNAL_BEFORE')
    journal = read_bytes_five_v2(JOURNAL, 11264)
    need(expected['journal'] == pin_five_v2(JOURNAL), 'GROUP_JOURNAL_AFTER')
    return dict(journal=journal, stdout=electron_bodies[0], stderr=electron_bodies[1])

def inner_direct_completion_five_v2(row, source, controller_identity, edges):
    try:
        remaining_five_v2(_five_policy.edge(_five_parent.parent)['workCutoffMs'] / 1000)
        need(_five_expected is not None and source == _five_expected.source_sha, 'EXPECTED_GROUP_SOURCE')
        _five_route_module._envelope_five_v2(row, source, _five_expected, True)
        bodies = _direct_child_bodies_five_v2(row, edges)
        artifacts = _direct_group_receipt_artifacts_five_v2(row['proof'], row['edgeOutcomes']['electron'], bodies['electron'])
        value = _five_route_module.inner_complete_five_role_v2(row, source, k, cancel, consumer, artifacts, controller_identity, focus_evidence, route_evidence, _five_expected, _five_policy, bodies)
        remaining_five_v2(_five_policy.edge(_five_parent.parent)['workCutoffMs'] / 1000)
        return value
    except Exception as error:
        _five_reraise_operation_error_v2(error)
        return False

def outer_direct_completion_five_v2(row, source, edge):
    try:
        remaining_five_v2(_five_policy.edge(_five_parent.parent)['workCutoffMs'] / 1000)
        _five_route_module._envelope_five_v2(row, source, _five_expected, False)
        _original_direct_edge_five_v2(edge)
        need(edge.plan.edge == 'inner' and direct_edge_clean_five_v2(row['innerEdge']), 'ORIGINAL_OUTER_INNER_EDGE')
        bodies = _direct_child_bodies_five_v2(row['inner'], None)
        artifacts = _direct_group_receipt_artifacts_five_v2(row['inner']['proof'], row['inner']['edgeOutcomes']['electron'], bodies['electron'])
        value = _five_route_module.outer_complete_five_role_v2(row, source, k, cancel, consumer, artifacts, focus_evidence, route_evidence, _five_expected, _five_policy, _five_retained_bodies['inner'], bodies)
        remaining_five_v2(_five_policy.edge(_five_parent.parent)['workCutoffMs'] / 1000)
        return value
    except Exception as error:
        _five_reraise_operation_error_v2(error)
        return False

def direct_pump_five_v2(coordinator):
    need(_five_parent is not None and any((edge.q is coordinator for edge in _five_parent.edges.values())), 'ORIGINAL_DIRECT_COORDINATOR')
    return None

def held_direct_identity_five_v2(edge, facade, stack, executable):
    _original_direct_edge_five_v2(edge)
    need(stack is _five_stack, 'BOUND_IDENTITY_STACK')
    edge.borrow_identity()
    handle = edge.original_process_handle()
    api = stack.observer.ObservationAdapter(facade, handle, stack.model)
    value = _five_identity_observation_v2(edge, api, handle, stack)
    edge.original_process_handle()
    need(type(value) is stack.model.ProcessIdentity and value.pid == edge._identity_pid and (value.running is True) and (value.image.casefold() == str(executable).casefold()) and stack.model._decimal(value.created_filetime), 'ORIGINAL_DIRECT_PROCESS_IDENTITY')
    identity = edge.remember_identity(dict(pid=value.pid, image=value.image, createdFileTime=value.created_filetime))
    return (api, identity)

def live_direct_five_v2(edge, api, identity, stack):
    _original_direct_edge_five_v2(edge)
    remaining_five_v2(_five_policy.edge(_five_parent.parent)['workCutoffMs'] / 1000)
    need(edge._remaining_ms() > 0, 'ORIGINAL_CHILD_WORK_BEFORE_LIVE')
    need(stack is _five_stack and _five_context_module.C0._equal(identity, edge.identity), 'BOUND_DIRECT_LIVE_IDENTITY')
    handle = edge.original_process_handle()
    value = _five_identity_observation_v2(edge, api, handle, stack)
    edge.original_process_handle()
    need(type(value) is stack.model.ProcessIdentity and value == stack.model.ProcessIdentity(identity['pid'], identity['image'], identity['createdFileTime'], True), 'ORIGINAL_DIRECT_LIVE_PROCESS')
