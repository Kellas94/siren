"""Pure portable SourceSync input planning; physical provenance stays external.

No filesystem, process, runtime discovery or execution access is performed here.
The caller must establish package/runtime pins, fresh output and owned closure.
"""
import copy,re
from pathlib import PureWindowsPath

def need(ok,code):
    if not ok:raise ValueError(code)

def typed_equal(left,right):
    if type(left) is not type(right):return False
    if isinstance(left,dict):return set(left)==set(right) and all(typed_equal(left[k],right[k]) for k in left)
    if isinstance(left,list):return len(left)==len(right) and all(typed_equal(a,b) for a,b in zip(left,right))
    return left==right

def absolute_path(value):
    code='BOUNDED_ABSOLUTE_WINDOWS_PATH_REQUIRED'
    need(isinstance(value,str) and 3<len(value)<=32700,code)
    normal=value.replace('\\','/');need(re.match(r'^[A-Za-z]:/',normal) is not None,code)
    parts=normal[3:].split('/')
    for part in parts:
        need(part not in ['', '.', '..'] and not part.endswith((' ','.')) and not re.search(r'[\x00-\x1f<>:"|?*]',part),code)
        need(part.split('.')[0].upper() not in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]},code)
    return PureWindowsPath(normal)

def file_identity(value,code,*,path=False):
    keys={'bytes','sha256'}|({'path'} if path else set())
    need(isinstance(value,dict) and set(value)==keys and type(value.get('bytes')) is int and value['bytes']>0 and isinstance(value.get('sha256'),str) and re.fullmatch('[a-f0-9]{64}',value['sha256']) is not None,code)
    if path:absolute_path(value['path'])

def plan_producer(config):
    need(isinstance(config,dict) and type(config.get('schema')) is int and config['schema']==1 and {'schema','mode','appRoot','runtimes'}<=set(config)<= {'schema','mode','appRoot','runtimes','package'},'PRODUCER_CONFIG_REQUIRED')
    mode=config.get('mode');need(mode in ['development','package'],'PRODUCER_MODE_REQUIRED')
    need(('package' in config)==(mode=='package'),'PRODUCER_PACKAGE_MODE_REQUIRED')
    app=absolute_path(config['appRoot']);runtimes=config['runtimes'];code='PRODUCER_RUNTIME_IDENTITIES_REQUIRED'
    need(isinstance(runtimes,dict) and set(runtimes)=={'node','python','powershell'},code)
    for value in runtimes.values():file_identity(value,code,path=True)
    result={'schema':1,'mode':mode,'input':copy.deepcopy(config),'cwd':str(app),'sourceScript':str(app/'tests/native/source-sync.mjs'),'evidenceParent':str(app/'evidence/source-sync'),'producerArguments':[],'runtimes':copy.deepcopy(runtimes),'packageResultExpected':None,'physicalAdmissionEstablished':False}
    if mode=='package':
        package=config['package'];need(isinstance(package,dict) and set(package)=={'root','receipt'},'PRODUCER_PACKAGE_MODE_REQUIRED')
        root=absolute_path(package['root']);receipt=package['receipt'];code='DEVELOPMENT_PACKAGE_RECEIPT_REQUIRED'
        need(isinstance(receipt,dict) and type(receipt.get('schema')) is int and receipt['schema']==1 and receipt.get('kind')=='development-preview' and receipt.get('releaseAdmitted') is False and isinstance(receipt.get('sourceCommit'),str) and re.fullmatch('[a-f0-9]{40}',receipt['sourceCommit']) is not None,code)
        for name in ['appArchive','runtimeBinary']:file_identity(receipt.get(name),code)
        relative=receipt.get('appRelativePath');need(relative=='App/versions/0.1.0/SIREN.exe','DEVELOPMENT_PACKAGE_LAYOUT_REQUIRED')
        app_path=root/PureWindowsPath(relative)
        result.update({'producerArguments':['--package',str(root)],'packageExecutable':str(app_path),'archivePath':str(app_path.parent/'resources/app.asar'),'packageResultExpected':{'sourceCommit':receipt['sourceCommit'],'archive':copy.deepcopy(receipt['appArchive']),'runtime':copy.deepcopy(receipt['runtimeBinary'])}})
    return result

def bind_producer_output(plan,evidence,result):
    need(isinstance(plan,dict) and 'input' in plan and typed_equal(plan,plan_producer(plan['input'])),'PRODUCER_PLAN_REQUIRED')
    path=absolute_path(evidence)
    need(path.parent==PureWindowsPath(plan['evidenceParent']),'EXPLICIT_SOURCE_SYNC_EVIDENCE_REQUIRED')
    need(isinstance(result,dict) and result.get('status')=='COMPLETE','PRODUCER_RESULT_COMPLETION_REQUIRED')
    expected=plan['packageResultExpected']
    need(('package' not in result) if expected is None else ('package' in result and typed_equal(result['package'],expected)),'PRODUCER_PACKAGE_IDENTITY_REQUIRED')
    data=path/'owned-data' if plan['mode']=='development' else path/'Pachet-Știință-Sync/Data'
    return {'schema':1,'mode':plan['mode'],'evidenceRoot':str(path),'dataRoot':str(data),'physicalAdmissionEstablished':False}
