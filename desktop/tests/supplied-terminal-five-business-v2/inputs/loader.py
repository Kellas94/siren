"""Private QA checked-buffer import; trusted interpreter/caller, no IO."""
import builtins,hashlib,sys,types

def _need(v,why):
 if v is not True:raise ValueError(why)

def _name(n):
 _need(type(n) is str and 0<len(n)<=256,'MODULE_NAME')
 _need(all(p and (p[0].isascii() and (p[0].isalpha() or p[0]=='_')) and all(c.isascii() and (c.isalnum() or c=='_') for c in p) for p in n.split('.')),'MODULE_COMPONENT')
 return n

def _path_key(p):
 _need(type(p) is str and 0<len(p)<=4096,'SOURCE_PATH')
 parts=p.replace('\\','/').split('/')
 _need(len(parts)>=4 and [v.casefold() for v in parts[:3]]==['c:','claude','siren_work'],'WORKSPACE_SOURCE')
 reserved={'CON','PRN','AUX','NUL','CONIN$','CONOUT$'}|{a+str(n) for a in ['COM','LPT'] for n in range(1,10)}|{a+n for a in ['COM','LPT'] for n in '¹²³'}
 for part in parts[1:]:
  _need(part not in ('','.','..') and not part.endswith(('.', ' ')) and not any(c in '<>:"|?*' or ord(c)<32 or ord(c)==127 for c in part) and part.split('.')[0].rstrip(' ').upper() not in reserved,'CANONICAL_SOURCE_PATH')
 return '/'.join(parts).casefold()

def load_checked_plan(*,rows,buffers,packages,runtime_imports):
 _need(type(rows) is list and 1<=len(rows)<=64,'SOURCE_ROWS_BOUND')
 _need(type(buffers) is dict and all(type(k) is str for k in buffers),'EXACT_BUFFER_DICTIONARY')
 _need(type(packages) is list and len(packages)<=16,'VIRTUAL_PACKAGES_BOUND')
 _need(type(runtime_imports) is dict and len(runtime_imports)<=64,'RUNTIME_IMPORTS_BOUND')
 runtime={}
 for name,module in runtime_imports.items():
  _name(name);_need(type(module) is types.ModuleType and module.__name__==name,'EXACT_PRELOADED_RUNTIME_MODULE');runtime[name]=module
 virtual=[]
 for name in packages:
  _name(name);_need(name not in virtual,'UNIQUE_VIRTUAL_PACKAGE');virtual.append(name)
 sources={};paths=set();total=0
 for value in rows:
  _need(type(value) is dict and all(type(k) is str for k in value) and set(value)=={'name','path','bytes','sha256','package'},'CLOSED_SOURCE_ROW')
  r=dict(value);name=_name(r['name']);key=_path_key(r['path'])
  _need(name not in sources and name not in virtual and key not in paths,'UNIQUE_SOURCE_NAME_AND_PATH')
  n=r['bytes'];h=r['sha256'];_need(type(n) is int and 0<=n<=2*1024*1024 and type(r['package']) is bool,'EXACT_SOURCE_TYPES_BOUND')
  _need(type(h) is str and len(h)==64 and all(c in '0123456789abcdef' for c in h),'EXACT_SOURCE_SHA')
  total+=n;_need(total<=16*1024*1024,'TOTAL_SOURCE_BOUND');sources[name]=r;paths.add(key)
 _need(set(buffers)==set(sources),'EXACT_BUFFER_MEMBERSHIP')
 checked={}
 for name,r in sources.items():
  b=buffers[name];_need(type(b) is bytes and len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],'EXACT_CHECKED_BUFFER');checked[name]=b
 all_names=virtual+list(sources);local=set(all_names);roots={n.split('.')[0] for n in local}
 _need(not roots.intersection(n.split('.')[0] for n in runtime),'NO_RUNTIME_LOCAL_ROOT_OVERLAP')
 for name in all_names:
  if '.' in name:
   parent=name.rpartition('.')[0];_need(parent in virtual or parent in sources and sources[parent]['package'],'DECLARED_PACKAGE_PARENT')
 for name in virtual:
  _need('.' not in name or name.rpartition('.')[0] in virtual[:virtual.index(name)],'VIRTUAL_PARENT_ORDER')
 _need(not any(type(k) is str and any(k==r or k.startswith(r+'.') for r in roots) for k in sys.modules),'COLD_LOCAL_NAMESPACE')
 # Check every syntax unit before the first registration/body, including late rows.
 compile_names={n:'<checked-buffer:'+n+':'+r['sha256']+'>' for n,r in sources.items()}
 try:code={n:compile(checked[n],compile_names[n],'exec',dont_inherit=True) for n in sources}
 except SyntaxError as error:raise ValueError('INVALID_SOURCE_SYNTAX') from error
 owned={};states={};executed=[];attachments=[];closed=False
 def clean():
  nonlocal closed
  if closed:return
  drift=[]
  for parent,child,value in reversed(attachments):
   if parent.__dict__.get(child) is value:del parent.__dict__[child]
   else:drift.append('PARENT_ATTRIBUTE:'+parent.__name__+'.'+child)
  for name,value in reversed(list(owned.items())):
   if sys.modules.get(name) is value:del sys.modules[name]
   else:drift.append('MODULE_SLOT:'+name)
  closed=True
  _need(not drift,('OWNED_MODULE_DRIFT:count='+str(len(drift))+';'+','.join(drift))[:4000])
 def ownership():
  for name,value in owned.items():_need(sys.modules.get(name) is value,'OWNED_MODULE_SLOT_DRIFT:'+name)
  for parent,child,value in attachments:_need(parent.__dict__.get(child) is value,'OWNED_PARENT_ATTRIBUTE_DRIFT:'+parent.__name__+'.'+child)
 def importing(name,globals=None,locals=None,fromlist=(),level=0):
  _need(type(name) is str and type(level) is int and level>=0,'EXACT_IMPORT_CALL')
  _need(type(fromlist) in (tuple,list) or fromlist is None,'EXACT_FROMLIST')
  requested=() if fromlist is None else tuple(fromlist)
  _need(all(type(x) is str and x and x!='*' for x in requested),'EXPLICIT_IMPORT_NAMES')
  absolute=name
  if level:
   package=globals.get('__package__') if type(globals) is dict else None
   _need(type(package) is str and package and level<=len(package.split('.')),'RELATIVE_PACKAGE_BOUND')
   base=package.split('.')[:len(package.split('.'))-level+1]
   absolute='.'.join(base+([name] if name else []))
  _name(absolute)
  if absolute.split('.')[0] in roots:
   ownership();_need(absolute in local,'UNDECLARED_LOCAL_IMPORT')
   own_initializer=states.get(absolute)=='LOADING' and type(globals) is dict and globals.get('__name__')==absolute and globals.get('__package__')==absolute and bool(requested)
   module=owned[absolute] if own_initializer else load(absolute)
   for part in requested:
    child=absolute+'.'+part
    if child in local:
     value=load(child);_need(module.__dict__.get(part) is value,'OWNED_IMPORT_ATTACHMENT')
    elif not hasattr(module,part):raise ValueError('UNDECLARED_LOCAL_FROM_IMPORT')
    _need(hasattr(module,part),'MISSING_LOCAL_EXPORT')
   return module if requested else load(absolute.split('.')[0])
  _need(level==0 and absolute in runtime,'UNDECLARED_RUNTIME_IMPORT');module=runtime[absolute]
  _need(all(hasattr(module,x) for x in requested),'MISSING_RUNTIME_EXPORT')
  if requested:return module
  root=absolute.split('.')[0];_need(root in runtime,'DECLARED_RUNTIME_ROOT');return runtime[root]
 fixed_builtins=dict(builtins.__dict__,__import__=importing)
 def load(name):
  _need(name in local,'DECLARED_LOCAL_MODULE')
  if states.get(name)=='DONE':ownership();return owned[name]
  _need(states.get(name)!='LOADING','EXECUTION_IMPORT_CYCLE')
  parent_name,_,child=name.rpartition('.')
  if parent_name:
   if states.get(parent_name)=='LOADING':parent=owned[parent_name]
   else:parent=load(parent_name)
   if states.get(name)=='DONE':ownership();return owned[name]
   _need(child not in parent.__dict__,'COLD_PARENT_ATTRIBUTE')
  else:parent=None
  _need(name not in sys.modules,'LOCAL_SLOT_CHANGED_BEFORE_LOAD')
  module=types.ModuleType(name);module.__package__=name if name in virtual or sources[name]['package'] else parent_name
  if name in virtual or sources[name]['package']:module.__path__=[]
  if name in sources:module.__file__=sources[name]['path']
  module.__dict__['__builtins__']=fixed_builtins;owned[name]=module;sys.modules[name]=module;states[name]='LOADING'
  if parent is not None:parent.__dict__[child]=module;attachments.append((parent,child,module))
  if name in sources:
   exec(code[name],module.__dict__)
   r=sources[name];executed.append({k:r[k] for k in ['name','path','bytes','sha256']})
  states[name]='DONE';return module
 try:
  for name in virtual:load(name)
  for name in sources:load(name)
  ownership()
 except BaseException as error:
  # One bounded secondary note retains cleanup drift without replacing primary.
  try:clean()
  except ValueError as secondary:BaseException.add_note(error,('CHECKED_BUFFER_CLEANUP:'+str(secondary))[:4096])
  raise
 class Bundle:
  def __init__(self):self.modules=dict(owned);self.executed=[dict(r) for r in executed];self.compileFilenames=dict(compile_names)
  def close(self):clean()
 return Bundle()
