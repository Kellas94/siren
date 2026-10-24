"""Pure focus/C1/closed-receipt joins. Receives retained bytes, never opens paths."""
import hashlib
import math
import re

PROBE='siren-ordinary-picker-cancel-v1'
ROOT='C:/Claude/SIREN_WORK/terminal-operational-four-stage-candidate-v1-20261022'
JOURNAL='C:/Claude/SIREN_WORK/terminal-operational-four-stage-candidate-v1-20261022-image/picker-parent-observation.jsonl'
PATHS=dict(journal=JOURNAL,stdout=ROOT+'/execution/electron-stdout.log',stderr=ROOT+'/execution/electron-stderr.log')

def need(value,reason):
 if not value:raise ValueError(reason)

def active_cancel(body,binding,contracts,consumer):
 consumer.binding_value(binding)
 raw,text=consumer.raw_text(body,11264);lines=text.splitlines(keepends=True)
 need(len(lines)==3,'EXACT_ACTIVE_THREE_ROWS')
 rows=[consumer.decode(line) for line in lines]
 ui={key:binding[key] for key in ('projectId','windowId','epoch')}
 hwnd=contracts.picker_boundary(rows,binding['mainPid'],ui,binding['pointerBits'])
 need(hwnd==binding['parentHwnd'],'ACTIVE_ORIGINAL_PARENT')
 consumer.schema(rows[2],dict(version=1,sequence=3,stage='fulfilled-projection',failed=False,ordinal=1,matched=True,apiCount=1,selectionCount=1,canceled=True,fileCount=0,selectedPathPresent=False))
 need(type(rows[0]['webContentsId']) is int and 0<rows[0]['webContentsId']<=9007199254740991,'ACTIVE_REPORTED_WCID')
 return dict(providerCanceled=True,fileCount=0,selectedPathPresent=False,parentHwnd=hwnd,reportedWebContentsId=rows[0]['webContentsId'],scope='active provider projection only; footer/write/flush/close not yet proved')

def _number(v):return type(v) in (int,float) and math.isfinite(v)

def receipt_complete(proof,identity,contracts,consumer,artifacts):
 need(type(artifacts) is dict and set(artifacts)==set(PATHS),'WHOLE_ARTIFACT_MEMBERSHIP')
 pins=proof['receiptFiles'];need(type(pins) is dict and set(pins)==set(PATHS),'RECEIPT_PIN_MEMBERSHIP')
 for key,expected in PATHS.items():
  raw=artifacts[key];maximum=11264 if key=='journal' else 1048576
  need(type(raw) is bytes and len(raw)<=maximum,'WHOLE_ARTIFACT_BOUNDS')
  pin=pins[key];need(type(pin) is dict and set(pin)=={'path','bytes','sha256'} and type(pin['path']) is str and pin['path'].replace('\\','/')==expected and type(pin['bytes']) is int and pin['bytes']==len(raw) and pin['sha256']==hashlib.sha256(raw).hexdigest(),'WHOLE_ARTIFACT_PIN')
 binding=proof['receiptBinding'];need(binding['mainPid']==identity['pid'],'RECEIPT_ORIGINAL_MAIN_PID')
 prefix=proof['providerActiveHex'];need(type(prefix) is str and len(prefix)<=22528 and re.fullmatch('(?:[0-9a-f]{2})+',prefix) is not None,'ACTIVE_PREFIX_HEX')
 prefix=bytes.fromhex(prefix);need(active_cancel(prefix,binding,contracts,consumer)==proof['provider'],'ACTIVE_PROVIDER_RECONSTRUCTION')
 final=artifacts['journal'];need(final.startswith(prefix) and len(final)>len(prefix) and final[len(prefix):].count(b'\n')==1,'EXACT_ACTIVE_PREFIX_PLUS_ONE_FOOTER')
 receipt=consumer.consume(final,artifacts['stdout'],artifacts['stderr'],binding)
 need(receipt['observationComplete'] is True and receipt['providerOutcome']=='CANCEL' and receipt['selectedPathWitness'] is False and contracts.exact(receipt,proof['closedReceipt']),'CLOSED_CANCEL_RECEIPT')
 return receipt

def inner_complete(row,source,contracts,cancel,consumer,artifacts,controller_identity,focus_module):
 try:
  need(type(row) is dict and row.get('probe')==PROBE and row.get('stage')=='cancel-inner-complete' and row.get('sourceSha256')==source and row.get('primaryPresent') is False and row.get('primary') is None and row.get('secondary')==[] and row.get('forced')==[],'CLEAN_INNER_ENVELOPE')
  p=row['proof'];identity=row['identities']['electron'];phase=p['phase'];ui={key:phase[key] for key in ('projectId','windowId','epoch')}
  need(type(controller_identity) is dict and contracts.exact(row['identities']['inner'],controller_identity) and phase['identity']==identity and phase['sourceSha256']==source,'ORIGINAL_INNER_AND_PHASE')
  rb=p['receiptBinding'];need(all(type(rb[key]) is type(value) and rb[key]==value for key,value in ui.items()),'RECEIPT_CURRENT_CONTEXT')
  need(p['cancelStatus']=='ADDRESS_FOCUS_CANCEL_DATA_COMPLETE' and p['fullTopology']['status']=='NOT_REQUESTED_BY_CANCEL_ROUTE','QUERY_CANCEL_COMPLETION_STATUS')
  need(contracts.exact(p['focusPortRetirement']['electronJobSettlement'],row['jobSettlements']['electron']),'FOCUS_RETIRED_ORIGINAL_JOB_JOIN')
  focus_module.prefocus_complete(p,identity,source,contracts)
  focus_module.focus_complete(p,identity,controller_identity,contracts)
  cancel.ui_cancelled(p['uiCancelled'],PROBE,source,identity,ui);cancel.ui_final(p['ui'],PROBE,source,identity,ui)
  hexbody=p['endpointBodyHex'];need(type(hexbody) is str and len(hexbody)<=131072 and cancel.endpoint_cancel(bytes.fromhex(hexbody),ui['epoch'])==p['endpoint'],'ENDPOINT_RECONCILIATION')
  native=p['native'];answer=native['cancelAnswer'];dispatch=native['transport'];foreground=native['foreground']
  need(answer.get('inputSent') is True and answer.get('physicalSuccess') is False and dispatch.get('attempted') is True and type(dispatch.get('rawCount')) is int and dispatch['rawCount']==2 and dispatch.get('physicalSuccess') is False and type(foreground.get('diagnosticErrorCount')) is int and foreground['diagnosticErrorCount']==0,'CANONICAL_GENUINE_ESCAPE')
  exits=p['normalExits'];need(type(exits) is dict and set(exits)=={'ui','electron'} and all(cancel._normal(v) for v in exits.values()) and all(exits[name]['pid']==row['identities'][name]['pid'] for name in exits),'ORIGINAL_NORMAL_EXITS')
  need(type(row['jobSettlements']) is dict and set(row['jobSettlements'])=={'ui','electron'} and all(cancel._job(v) for v in row['jobSettlements'].values()) and p['childrenQuiescent'] is True,'UNFORCED_EMPTY_JOBS')
  receipt_complete(p,identity,contracts,consumer,artifacts)
  need(contracts.clean_close(dict(schema=1,events=p['session']['events']),identity)==p['session'],'RECOVERY_CLEAN_CLOSE')
  return True
 except BaseException:return False

def outer_complete(row,source,contracts,cancel,consumer,artifacts,focus_module):
 try:
  need(row['probe']==PROBE and row['stage']=='ordinary-cancel-complete' and row['primaryPresent'] is False and row['primary'] is None and row['secondary']==[] and row['forced']==[],'CLEAN_OUTER_ENVELOPE')
  need(cancel._normal(row['normalExit']) and row['normalExit']['pid']==row['identity']['pid'] and cancel._job(row['jobSettlement']),'ORIGINAL_NORMAL_INNER_AND_EMPTY_JOB')
  return inner_complete(row['inner'],source,contracts,cancel,consumer,artifacts,row['identity'],focus_module)
 except BaseException:return False
