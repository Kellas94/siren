"""Pure bounded Cancel evidence predicates. No IO, native, clock or imports of app."""
import json,re
PROBE='siren-ordinary-picker-cancel-v1'
ROW={'schema','sequence','stage','method','operationId','epoch','entrySequence','replyKind','ok','code'}
METHODS={'terminalPickCwd','terminalListProfiles','terminalCreate'}
def need(v,code):
 if not v:raise ValueError(code)
def _pairs(pairs):
 d={}
 for k,v in pairs:
  if k in d:raise ValueError('DUPLICATE_JSON_KEY')
  d[k]=v
 return d
def endpoint_cancel(body,epoch):
 need(type(body) is bytes and 0<len(body)<=65536 and body.endswith(b'\n') and type(epoch) is int and epoch>0,'ENDPOINT_COMPLETE_BOUNDED_BYTES')
 try:rows=[json.loads(line,object_pairs_hook=_pairs) for line in body.splitlines()]
 except (ValueError,UnicodeError):raise ValueError('ENDPOINT_JSON') from None
 need(0<len(rows)<=128,'ENDPOINT_ROW_CAP');entries={};replies={};picks=[]
 for number,row in enumerate(rows,1):
  need(type(row) is dict and set(row)==ROW and type(row['schema']) is int and row['schema']==1 and type(row['sequence']) is int and row['sequence']==number and type(row['method']) is str and row['method'] in METHODS and type(row['operationId']) is str and re.fullmatch('[a-z0-9][a-z0-9_-]{0,127}',row['operationId']) is not None and type(row['epoch']) is int and row['epoch']>=0 and type(row['entrySequence']) is int,'ENDPOINT_ROW_SCHEMA')
  if row['stage']=='MAIN_ENDPOINT_ENTRY':
   need(row['entrySequence']==number and row['replyKind'] is None and row['ok'] is None and row['code'] is None,'ENDPOINT_ENTRY_SCHEMA');entries[number]=row
   if row['method']=='terminalPickCwd':picks.append(row)
  else:
   e=entries.get(row['entrySequence']);need(row['stage']=='MAIN_ENDPOINT_REPLY' and e is not None and row['entrySequence'] not in replies and all(type(row[k]) is type(e[k]) and row[k]==e[k] for k in ['method','operationId','epoch']),'ENDPOINT_REPLY_CORRELATION')
   need(type(row['replyKind']) is str and row['replyKind'] in ['undefined','object','function','number','string','boolean','symbol','bigint','null','proxy'] and (row['ok'] is None or type(row['ok']) is bool) and (row['code'] is None or type(row['code']) is str and re.fullmatch('[A-Z][A-Z0-9_]{0,63}',row['code']) is not None),'ENDPOINT_REPLY_DATA');replies[row['entrySequence']]=row
 need(len(picks)==1,'ONE_PICK_ENDPOINT_ENTRY');e=picks[0];r=replies.get(e['entrySequence']);need(e['epoch']==epoch and r is not None and r['replyKind']=='object' and r['ok'] is False and r['code']=='CANCELLED','ACTUAL_MAIN_CANCELLED_REPLY')
 return dict(method='terminalPickCwd',operationId=e['operationId'],epoch=epoch,entrySequence=e['entrySequence'],entry=e,reply=r,completeTraceProved=False,finalObserverCleanliness='UNKNOWN',otherEntryOnlyCount=sum(n not in replies for n in entries if n!=e['entrySequence']),scope='positive MAIN endpoint projection; no raw renderer receipt or final sink status')
def binding(row,probe,source,identity,ui,stage):
 need(type(row) is dict and row.get('probe')==probe and row.get('stage')==stage and type(row.get('sourceSha256')) is str and row['sourceSha256']==source and type(row.get('identity')) is dict and row['identity']==identity and all(type(row.get(k)) is type(v) and row[k]==v for k,v in ui.items()),'ACTUAL_UI_IDENTITY_SOURCE_CONTEXT')
def ui_cancelled(row,probe,source,identity,ui):
 binding(row,probe,source,identity,ui,'ui-cancelled');d=row.get('confirmation');need(type(d) is dict and set(d)=={'before','after','currentContext','rawIpcReplyCaptured'} and d['rawIpcReplyCaptured'] is False,'UI_CANCEL_CONFIRMATION_DATA')
 before=d['before'];after=d['after'];context=d['currentContext'];keys={'url','roots','busy','folder','status','createDisabled','folderDisabled'}
 for value in [before,after]:
  need(type(value) is dict and set(value)==keys and type(value['url']) is str and value['url']=='siren://app/windows/terminal.html?windowId='+ui['windowId'] and type(value['roots']) is int and value['roots']==1 and value['busy'] is False and value['folder']=='No folder selected.' and type(value['folder']) is str and type(value['status']) is str and len(value['status'])<2048 and value['createDisabled'] is True and value['folderDisabled'] is False,'ACTUAL_NULL_UI_STATE')
 need(after['status'].endswith('(CANCELLED)') and before['url']==after['url'] and type(context) is dict and context==dict(ui,role='terminal',mode='normal',access='write',available=True) and type(context['epoch']) is int,'CURRENT_CANCELLED_UI_CONTEXT')
 return d
def ui_final(row,probe,source,identity,ui):
 binding(row,probe,source,identity,ui,'final-ui-result');need(row.get('ok') is True and row.get('phase')=='quit' and row.get('primaryPresent') is False and row.get('primary') is None and row.get('secondary')==[] and row.get('quitPointerConfirmed') is True and row.get('normalQuitProved') is False and row.get('physicalDriverProved') is False,'ACTUAL_UI_QUIT_POINTER_RESULT');return row
def _normal(row):
 return type(row) is dict and row.get('sameOriginalPopenAndHandle') is True and row.get('originalHandleClosed') is False and all(type(row.get(n)) is int and row[n]==0 for n in ['waitExitCode','returncode','pollResult']) and type(row.get('pid')) is int and row['pid']>0
def _job(row):
 if type(row) is not dict or set(row)!={'closed','observations'} or row['closed'] is not True or type(row['observations']) is not list or not 0<len(row['observations'])<=1000:return False
 for r in row['observations']:
  if type(r) is not dict or set(r)!={'totalProcesses','activeProcesses','terminatedProcesses'} or any(type(v) is not int or not 0<=v<2**32 for v in r.values()) or r['totalProcesses']<1 or r['terminatedProcesses']!=0:return False
 return row['observations'][-1]['activeProcesses']==0
