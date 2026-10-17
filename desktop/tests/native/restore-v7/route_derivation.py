"""Pure interpretation of already collected producer observations and byte maps.

derive_route performs no filesystem/process access. Module loading resolves the
adjacent pure rules. Physical instrument provenance and DATA review remain external.
"""
import copy,hashlib,json,re,runpy
from pathlib import Path
admit=runpy.run_path(str(Path(__file__).with_name('producer_admission.py')))['admit']

UUID=r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
SHA=r'[0-9a-f]{64}'
def need(ok,code):
    if not ok:raise ValueError(code)
def sha(value):return hashlib.sha256(value).hexdigest()
def is_uuid(value):return isinstance(value,str) and re.fullmatch(UUID,value) is not None
def is_sha(value):return isinstance(value,str) and re.fullmatch(SHA,value) is not None
def typed_equal(left,right):
    if type(left) is not type(right):return False
    if isinstance(left,dict):return set(left)==set(right) and all(typed_equal(left[k],right[k]) for k in left)
    if isinstance(left,list):return len(left)==len(right) and all(typed_equal(a,b) for a,b in zip(left,right))
    return left==right
def docs_v1_required(metadata,v1):
    code='PROJECT_DOCS_V1_REQUIRED';papers=metadata.get('workpapers')
    need(isinstance(papers,list) and papers,code);linked=[]
    for paper in papers:
        need(isinstance(paper,dict) and isinstance(paper.get('id'),str) and paper['id'] and isinstance(paper.get('blocks'),list),code)
        for block in paper['blocks']:
            need(isinstance(block,dict),code)
            if block.get('kind')!='knowledge':continue
            rows=block.get('rows');need(isinstance(rows,list),code)
            for row in rows:
                need(isinstance(row,dict),code)
                if 'sourceRef' in row:linked.append(row['sourceRef'])
    expected={key:v1[key] for key in ['sourceId','version','sha256']}
    need(linked and all(typed_equal(value,expected) for value in linked),code)
    def walk(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key=='sourceRef':need(typed_equal(item,expected),code)
                else:walk(item)
        elif isinstance(value,list):
            for item in value:walk(item)
    walk(metadata)
def object_json(value):
    def pairs(rows):
        result={}
        for key,item in rows:
            need(key not in result,'ROUTE_JSON_REQUIRED');result[key]=item
        return result
    try:result=json.loads(value.decode('utf-8',errors='strict'),object_pairs_hook=pairs,parse_constant=lambda _:need(False,'ROUTE_JSON_REQUIRED'))
    except (UnicodeError,ValueError,TypeError):raise ValueError('ROUTE_JSON_REQUIRED')
    need(isinstance(result,dict),'ROUTE_JSON_REQUIRED');return result

def derive_route(files,observed,context):
    admission=admit(observed,context)
    need(isinstance(files,dict) and all(isinstance(k,str) and type(v) is bytes for k,v in files.items()),'ROUTE_CAPTURE_BYTES_REQUIRED')
    rows=observed['manifest']['files'];expected={row['relativePath']:row for row in rows}
    need(set(files)==set(expected),'ROUTE_CAPTURE_BYTES_REQUIRED')
    for name,value in files.items():need(len(value)==expected[name]['bytes'] and sha(value)==expected[name]['sha256'],'ROUTE_CAPTURE_BYTES_REQUIRED')
    def read(name):
        need(name in files,'ROUTE_CAPTURE_BYTES_REQUIRED');return object_json(files[name])
    def bound(base,pointer,pattern,code):
        need(isinstance(pointer,dict) and isinstance(pointer.get('file'),str) and re.fullmatch(pattern,pointer['file']) is not None and is_sha(pointer.get('sha256')),code)
        path=base+'/'+pointer['file'];need(path in files and sha(files[path])==pointer['sha256'],code)
        return path,read(path)
    currents=[name for name in files if re.fullmatch(r'Projects/[^/]+/current\.json',name)]
    need(len(currents)==1,'UNIQUE_PROJECT_REQUIRED');project_id=currents[0].split('/')[1];need(is_uuid(project_id),'UNIQUE_PROJECT_REQUIRED');prefix='Projects/'+project_id
    current=read(currents[0]);need(current.get('schema')==2 and type(current.get('revision')) is int and current['revision']==2,'PROJECT_REVISION_BINDING_REQUIRED')
    manifest_path,manifest=bound(prefix+'/revisions',current,r'2-'+UUID+r'\.json','PROJECT_REVISION_BINDING_REQUIRED')
    need(manifest.get('schema')==2 and manifest.get('revision')==2 and isinstance(manifest.get('project'),dict) and manifest['project'].get('id')==project_id and isinstance(manifest.get('json'),str) and sha(manifest['json'].encode())==manifest.get('sha256'),'PROJECT_REVISION_REQUIRED')
    metadata=object_json(manifest['json'].encode());need('recoveryProbe' not in metadata,'PROJECT_REVISION_REQUIRED')
    refs=manifest.get('sourceRefs');need(isinstance(refs,list) and len(refs)==1 and isinstance(refs[0],dict) and type(refs[0].get('version')) is int and refs[0]['version']==1 and is_uuid(refs[0].get('sourceId')),'PROJECT_V1_REFERENCE_REQUIRED')
    v1=refs[0];source_id=v1['sourceId'];source=prefix+'/sources/'+source_id;docs_v1_required(metadata,v1)
    points=[name for name in files if re.fullmatch(r'Recovery/'+project_id+'/'+UUID+r'\.json',name)]
    need(len(points)==1,'ORIGINAL_SAVED_POINT_REQUIRED');point=read(points[0]);point_id=points[0].split('/')[-1][:-5]
    need(type(point.get('schema')) is int and point['schema']==1 and point.get('kind')=='saved' and point.get('id')==point_id and typed_equal(point.get('snapshot'),manifest),'ORIGINAL_SAVED_POINT_REQUIRED')
    source_current=read(source+'/current.json');need(type(source_current.get('schema')) is int and source_current['schema']==1 and source_current.get('sourceId')==source_id,'SOURCE_HEAD_BINDING_REQUIRED')
    head_path,head=bound(source+'/versions',source_current.get('head'),r'v-[1-7]-'+UUID+r'\.json','SOURCE_HEAD_BINDING_REQUIRED')
    need(isinstance(head.get('ref'),dict) and type(head['ref'].get('version')) is int and head['ref']['version']==7,'SOURCE_V7_HEAD_REQUIRED')
    version_names=[name for name in files if name.startswith(source+'/versions/')]
    need(len(version_names)==7 and all(re.fullmatch(re.escape(source)+r'/versions/v-[1-7]-'+UUID+r'\.json',name) for name in version_names),'SOURCE_CHAIN_REQUIRED')
    pointer=source_current['head'];reverse=[]
    for version in range(7,0,-1):
        path,record=bound(source+'/versions',pointer,r'v-'+str(version)+'-'+UUID+r'\.json','SOURCE_CHAIN_REQUIRED');reference=record.get('ref')
        need(type(record.get('schema')) is int and record['schema']==1 and isinstance(reference,dict) and reference.get('sourceId')==source_id and type(reference.get('version')) is int and reference['version']==version and record.get('kind')==('import' if version==1 else 'edit'),'SOURCE_CHAIN_REQUIRED')
        reverse.append((path,record));pointer=record.get('parent')
    need(pointer is None and {p for p,_ in reverse}==set(version_names),'SOURCE_CHAIN_REQUIRED');chain=list(reversed(reverse));replayed={};references={};text=None
    for version,(path,record) in enumerate(chain,1):
        reference=record['ref']
        if version==1:
            need(record.get('blob')==reference.get('sha256') and is_sha(record.get('blob')),'SOURCE_REPLAY_REQUIRED');blob=source+'/blobs/'+record['blob']+'.bin';need(blob in files,'SOURCE_REPLAY_REQUIRED')
            try:text=files[blob].decode('utf-8',errors='strict')
            except UnicodeError:raise ValueError('SOURCE_REPLAY_REQUIRED')
        else:
            edit=record.get('edit');need(isinstance(edit,dict) and edit.get('sourceId')==source_id and type(edit.get('expectedVersion')) is int and edit['expectedVersion']==version-1 and is_uuid(edit.get('operationId')) and is_sha(record.get('requestHash')),'SOURCE_CHAIN_REQUIRED')
            start=edit.get('start');end=edit.get('end');insert=edit.get('insertedText');raw=text.encode('utf-16-le')
            need(type(start) is int and type(end) is int and 0<=start<=end<=len(raw)//2 and isinstance(insert,str),'SOURCE_REPLAY_REQUIRED')
            try:text=(raw[:start*2]+insert.encode('utf-16-le')+raw[end*2:]).decode('utf-16-le',errors='strict')
            except UnicodeError:raise ValueError('SOURCE_REPLAY_REQUIRED')
        try:
            value=text.encode('utf-8',errors='strict');units=lambda line:len(line.encode('utf-16-le'))//2
            calculated={'sha256':sha(value),'utf8Bytes':len(value),'utf16Units':units(text),'lines':len(text.split('\n')),'longestLineUnits':max(map(units,text.split('\n'))),'encoding':'utf8','bom':False,'newline':'lf'}
        except UnicodeError:raise ValueError('SOURCE_REPLAY_REQUIRED')
        need(not text.startswith('\ufeff') and '\r' not in text and all(type(reference.get(k)) is type(v) and reference.get(k)==v for k,v in calculated.items()) and isinstance(reference.get('provenance'),dict),'SOURCE_REFERENCE_METADATA_REQUIRED')
        replayed[version]=value;references[version]=reference
    need(typed_equal(references[1],v1),'PROJECT_V1_REFERENCE_REQUIRED')
    for path,value in files.items():
        if path.startswith(source+'/blobs/'):
            name=path[len(source+'/blobs/'):];need(re.fullmatch(SHA+r'\.bin',name) is not None and sha(value)==name[:-4],'MATERIALIZED_BLOB_REQUIRED')
            matching=[version for version,reference in references.items() if reference['sha256']==name[:-4]]
            need(matching and all(replayed[version]==value for version in matching),'MATERIALIZED_BLOB_REQUIRED')
    commits=source_current.get('commitHead');seen=[]
    for version in [7,3]:
        path,commit=bound(source+'/commits',commits,r'c-'+UUID+r'\.json','SOURCE_COMMIT_CHAIN_REQUIRED')
        need(type(commit.get('schema')) is int and commit['schema']==1 and is_uuid(commit.get('operationId')) and commit.get('operationId')==commits.get('operationId') and commit.get('sourceId')==source_id and type(commit.get('version')) is int and commit['version']==version and commit.get('sha256')==references[version]['sha256'] and commit.get('durability')=='committed','SOURCE_COMMIT_CHAIN_REQUIRED')
        seen.append(path);commits=commit.get('parent')
    need(commits is None and set(seen)=={name for name in files if name.startswith(source+'/commits/')},'SOURCE_COMMIT_CHAIN_REQUIRED')
    return {'status':'ROUTE_CHAIN_DERIVED_REQUIRES_PHYSICAL_INPUT_AND_FIXTURE_REVIEW','projectId':project_id,'sourceId':source_id,'oldPointId':point_id,'v1':copy.deepcopy(v1),'v7':copy.deepcopy(references[7]),'versionsReplayed':7,'physicalAdmissionEstablished':False,'restoreExecuted':False,'syntheticCheckpointRequired':True,'admissionObservation':admission,'files':[copy.deepcopy(row) for row in rows],'directories':[row['relativePath'] for row in observed['manifest']['directories']],'manifestPath':manifest_path,'originalPointPath':points[0],'sourceHeadPath':head_path}
