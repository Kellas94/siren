"""Pure rules for collected producer-closure and temporal Data observations.

This module performs no process or filesystem access. An owned instrument and
independent completed DATA review must establish where its observations came from.
"""
from pathlib import PureWindowsPath
import re, struct

def need(ok,code):
    if not ok:
        raise ValueError(code)

def integer(value):
    return type(value) is int

def same_path(left,right):
    return isinstance(left,str) and isinstance(right,str) and PureWindowsPath(left).is_absolute() and PureWindowsPath(right).is_absolute() and PureWindowsPath(left)==PureWindowsPath(right)

def empty_pids(row):
    code='COMPLETE_EMPTY_JOB_PIDS_REQUIRED'
    need(isinstance(row,dict) and row.get('querySucceeded') is True and row.get('complete') is True and row.get('winError')==0,code)
    need(row.get('assigned')==0 and row.get('returned')==0 and row.get('pids')==[] and row.get('capacity')==512,code)
    try:
        raw=bytes.fromhex(row['rawHex'])
        need(len(raw)==8+8*512 and struct.unpack('<II',raw[:8])==(0,0),code)
        need(integer(row['returnedBytes']) and 8<=row['returnedBytes']<=len(raw),code)
    except (KeyError,TypeError,ValueError):
        raise ValueError(code)

def empty_accounting(closure):
    code='RAW_JOB_ACCOUNTING_REQUIRED'
    raw=closure.get('rawAccounting')
    need(isinstance(raw,dict) and raw.get('querySucceeded') is True and raw.get('winError')==0 and raw.get('returnedBytes')==48,code)
    names=['user','kernel','periodUser','periodKernel','pageFaults','totalProcesses','activeProcesses','terminatedProcesses']
    try:
        data=bytes.fromhex(raw['hex'])
        need(len(data)==48,code)
        values=struct.unpack('<qqqqIIII',data)
        decoded=dict(zip(names,values))
        need(decoded==raw['decoded'] and all(integer(x) and x>=0 for x in raw['decoded'].values()),code)
        counts={name:decoded[name] for name in ['totalProcesses','activeProcesses','terminatedProcesses']}
        need(counts['totalProcesses']>=1 and counts['activeProcesses']==0 and counts['terminatedProcesses']==0,code)
        need(closure['helperAccounting']==closure['afterAccounting']==counts,code)
    except (KeyError,TypeError,ValueError):
        raise ValueError(code)

def empty_census(row):
    need(isinstance(row,dict) and row.get('returncode')==0 and row.get('querySucceeded') is True and row.get('owned')==[],'SUCCESSFUL_EMPTY_CENSUS_REQUIRED')

def inventory(rows):
    code='SAFE_DOMAIN_INVENTORY_REQUIRED'
    need(isinstance(rows,list) and len(rows)<=8194,code)
    result={};folded=set();total=0;files=0;dirs=0
    for row in rows:
        need(isinstance(row,dict),code)
        name=row.get('relativePath')
        need(isinstance(name,str) and '\\' not in name and ':' not in name and all(part not in ['', '.', '..'] for part in name.split('/')),code)
        need(name in ['Projects','Recovery','session-selection.json'] or name.startswith(('Projects/','Recovery/')),code)
        need(name.casefold() not in folded,code);folded.add(name.casefold())
        if row.get('absent') is True:
            need(name in ['Recovery','session-selection.json'] and set(row)=={'relativePath','absent'},code)
        elif row.get('kind')=='directory':
            need(name!='session-selection.json' and set(row)=={'relativePath','kind'},code);dirs+=1
        else:
            need(row.get('kind')=='file' and name not in ['Projects','Recovery'] and set(row)=={'relativePath','kind','bytes','sha256'},code)
            need(integer(row['bytes']) and 0<=row['bytes']<=16777216 and isinstance(row['sha256'],str) and re.fullmatch('[a-f0-9]{64}',row['sha256']),code)
            files+=1;total+=row['bytes']
        result[name]=row
    need(files<=4096 and dirs<=4096 and total<=134217728 and result.get('Projects')=={'relativePath':'Projects','kind':'directory'},code)
    # Agreement cannot prove completeness when every reader omits a domain.
    need('Recovery' in result and 'session-selection.json' in result,'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
    for name in result:
        parts=name.split('/')
        for size in range(1,len(parts)):
            parent='/'.join(parts[:size])
            need(result.get(parent)=={'relativePath':parent,'kind':'directory'},code)
    return result

def admit(observed,context):
    o=observed;c=context
    need(isinstance(o,dict) and isinstance(c,dict),'REQUIRED_OBSERVATION_FIELDS')
    need(o.get('forcedCleanup') is None and o.get('errors')==[],'NO_FORCED_CONTAINMENT_REQUIRED')
    result=o.get('result',{})
    need(result.get('status')=='COMPLETE' and not result.get('error') and not result.get('primaryFailure') and result.get('retentionErrorCount',0)==0 and not result.get('retentionErrors'),'PRODUCER_RESULT_REQUIRED')
    expected=c.get('expectedCases');cases=result.get('cases')
    need(isinstance(expected,list) and expected and len(set(expected))==len(expected) and isinstance(cases,list) and len(cases)==len(expected) and all(isinstance(row,dict) and row.get('ok') is True and row.get('name')==name for row,name in zip(cases,expected)),'PRODUCER_CASES_REQUIRED')
    inputs=c.get('expectedSourceInputs')
    need(isinstance(inputs,dict) and inputs and all(isinstance(v,str) and re.fullmatch('[a-f0-9]{64}',v) for v in inputs.values()) and o.get('sourceInputsBefore')==o.get('sourceInputsAfter')==result.get('inputs')==result.get('afterInputs')==inputs and result.get('inputsUnchanged') is True,'SOURCE_INPUTS_CHANGED')
    need(o.get('childExitCode')==0 and integer(o.get('childExitCode')),'PRODUCER_EXIT_ZERO_REQUIRED')
    pid=o.get('producerPid');before=o.get('identityBefore',{});after=o.get('identityAfter',{});assignment=o.get('assignment',{})
    need(integer(pid) and 0<pid<2**32 and assignment.get('assignedActualHeldHandlePID')==pid and assignment.get('limitKillOnJobClose') is True,'ACTUAL_HELD_PRODUCER_REQUIRED')
    for row,exit_code in [(before,259),(after,0)]:
        need(row.get('pid')==row.get('handlePid')==pid and row.get('fromHeldChildHandle') is True and same_path(row.get('executablePath'),c.get('nodePath')) and integer(row.get('creationFiletime')) and 0<row['creationFiletime']<2**64 and row.get('exitCode')==exit_code,'ACTUAL_HELD_PRODUCER_REQUIRED')
    need(before['creationFiletime']==after['creationFiletime'],'ACTUAL_HELD_PRODUCER_REQUIRED')
    closure=o.get('closure',{})
    need(closure.get('errors')==[],'COMPLETE_EMPTY_JOB_PIDS_REQUIRED')
    empty_pids(closure.get('beforePids'));empty_pids(closure.get('afterPids'));empty_accounting(closure)
    empty_census(closure.get('census'));empty_census(o.get('censusAfterRead'))
    readback=o.get('readback',{})
    sequence=[o.get('assignedAtNs'),o.get('goAtNs'),o.get('exitObservedAtNs'),closure.get('startedAtNs'),closure.get('completedAtNs'),readback.get('startedAtNs'),readback.get('completedAtNs'),o.get('censusAfterRead',{}).get('observedAtNs')]
    need(all(integer(n) and n>0 for n in sequence) and all(left<right for left,right in zip(sequence,sequence[1:])) and integer(closure['census'].get('observedAtNs')) and sequence[3]<=closure['census']['observedAtNs']<=sequence[4],'TEMPORAL_READBACK_REQUIRED')
    need(o.get('evidenceFresh') is True,'FRESH_EXPLICIT_HANDOFF_REQUIRED')
    pins=o.get('pinsBeforeRead')
    need(isinstance(pins,dict) and set(pins)=={'stdout','result','manifest','parser'} and all(isinstance(v,str) and re.fullmatch('[a-f0-9]{64}',v) for v in pins.values()) and pins==o.get('pinsAfterRead'),'EVIDENCE_PIN_DRIFT')
    manifest=o.get('manifest',{})
    need(manifest.get('schema')==1 and manifest.get('phase')=='after-close' and manifest.get('coherence')=='POST_CLOSE_REQUIRES_EXTERNAL_QUIESCENCE' and manifest.get('captureComplete') is True and manifest.get('stableAroundCopy') is True and manifest.get('errors')==[] and manifest.get('errorCount')==0 and manifest.get('scope')==['Projects/**','Recovery/**','session-selection.json'] and manifest.get('limits')=={'files':4096,'fileBytes':16777216,'totalBytes':134217728},'COMPLETE_STABLE_CAPTURE_REQUIRED')
    need(same_path(manifest.get('source'),c.get('expectedDataRoot')) and same_path(result.get('dataAdmissions',{}).get('ownedData',{}).get('path'),c.get('expectedDataRoot')),'EXPECTED_DATA_ROOT_REQUIRED')
    before_rows=inventory(manifest.get('before'));after_rows=inventory(manifest.get('after'))
    actual_before=inventory(readback.get('actualBefore'));actual_after=inventory(readback.get('actualAfter'));captured=inventory(readback.get('captured'))
    need(before_rows==after_rows==actual_before==actual_after==captured,'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
    need(result.get('driverCloseReturned') is True and result.get('rawEvidence',{}).get('afterClose')==manifest,'COMPLETE_STABLE_CAPTURE_REQUIRED')
    files=[{k:v for k,v in row.items() if k!='kind'} for row in before_rows.values() if row.get('kind')=='file']
    directories=[row for row in before_rows.values() if row.get('kind')=='directory']
    pointers=[{**row,'unchanged':True} for row in before_rows.values() if row['relativePath'].endswith('/current.json') or row['relativePath']=='session-selection.json']
    keyed=lambda rows:{row['relativePath']:row for row in rows}
    need(isinstance(manifest.get('files'),list) and len(manifest['files'])==len(files) and keyed(manifest['files'])==keyed(files) and isinstance(manifest.get('directories'),list) and len(manifest['directories'])==len(directories) and keyed(manifest['directories'])==keyed(directories) and isinstance(manifest.get('pointerStability'),list) and len(manifest['pointerStability'])==len(pointers) and keyed(manifest['pointerStability'])==keyed(pointers),'ACTUAL_DATA_CAPTURE_BIJECTION_REQUIRED')
    return {'status':'PRODUCER_OBSERVATIONS_ACCEPTED_REQUIRES_INDEPENDENT_DATA','files':len(files),'directories':len(directories),'bytes':sum(row['bytes'] for row in files),'producerGracefulQuitQualified':False}
