"""Pure byte-map interpretation controls; no process or application access."""
from pathlib import Path
import base64,copy,hashlib,json,runpy,sys,unittest,uuid
HERE=Path(__file__).resolve().parent
old_fixture=runpy.run_path(str(HERE/'producer_admission_test.py'))['fixture']
try:derive=runpy.run_path(str(HERE/'route_derivation.py'))['derive_route']
except FileNotFoundError:derive=None
ACTUAL=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def encoded(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def uid(population,n):return str(uuid.UUID(int=population*100+n))
def ref(text,sid,version):
    b=text.encode();return {'sourceId':sid,'version':version,'sha256':sha(b),'utf8Bytes':len(b),'utf16Units':len(text.encode('utf-16-le'))//2,'lines':len(text.split('\n')),'longestLineUnits':max(len(line.encode('utf-16-le'))//2 for line in text.split('\n')),'encoding':'utf8','bom':False,'newline':'lf','provenance':{}}
def refresh(f):
    files=f['files'];directories=set(['Projects','Recovery'])
    for name in files:
        parts=name.split('/')
        for size in range(1,len(parts)):directories.add('/'.join(parts[:size]))
    rows=[{'relativePath':x,'kind':'directory'} for x in sorted(directories)]
    rows += [{'relativePath':name,'kind':'file','bytes':len(value),'sha256':sha(value)} for name,value in sorted(files.items())]
    if 'session-selection.json' not in files:rows.append({'relativePath':'session-selection.json','absent':True})
    rows.sort(key=lambda row:row['relativePath'])
    obs=f['observed'];m=obs['manifest'];m.update(before=copy.deepcopy(rows),after=copy.deepcopy(rows),files=[{k:v for k,v in row.items() if k!='kind'} for row in rows if row.get('kind')=='file'],directories=[row for row in rows if row.get('kind')=='directory'],pointerStability=[{**row,'unchanged':True} for row in rows if row['relativePath'].endswith('/current.json') or row['relativePath']=='session-selection.json'])
    obs['result']['rawEvidence']['afterClose']=copy.deepcopy(m)
    for name in ['actualBefore','actualAfter','captured']:obs['readback'][name]=copy.deepcopy(rows)
def fixture(population=1):
    obs,context=old_fixture();pid=uid(population,1);sid=uid(population,2);point=uid(population,3);prefix='Projects/'+pid;source=prefix+'/sources/'+sid;files={};refs=[];version_files=[];text='Ș😀 base\n'
    for version in range(1,8):
        prior=text
        if version>1:text+='edit '+str(version)+'\n'
        reference=ref(text,sid,version);refs.append(reference);name='v-'+str(version)+'-'+uid(population,10+version)+'.json'
        record={'schema':1,'kind':'import' if version==1 else 'edit','ref':reference,'parent':None if version==1 else {'file':version_files[-1],'sha256':sha(files[source+'/versions/'+version_files[-1]])}}
        if version==1:record['blob']=reference['sha256']
        else:record['edit']={'operationId':uid(population,30+version),'sourceId':sid,'expectedVersion':version-1,'start':len(prior.encode('utf-16-le'))//2,'end':len(prior.encode('utf-16-le'))//2,'insertedText':text[len(prior):]};record['requestHash']='a'*64
        files[source+'/versions/'+name]=encoded(record);version_files.append(name)
        if version in [1,3,7]:files[source+'/blobs/'+reference['sha256']+'.bin']=text.encode()
    previous=None
    for version in [3,7]:
        name='c-'+uid(population,50+version)+'.json';operation=uid(population,60+version)
        commit={'schema':1,'operationId':operation,'sourceId':sid,'version':version,'sha256':refs[version-1]['sha256'],'parent':previous,'durability':'committed'}
        files[source+'/commits/'+name]=encoded(commit);previous={'operationId':operation,'sha256':sha(files[source+'/commits/'+name]),'file':name}
    files[source+'/current.json']=encoded({'schema':1,'sourceId':sid,'head':{'file':version_files[-1],'sha256':sha(files[source+'/versions/'+version_files[-1]])},'commitHead':previous})
    metadata={'workpapers':[{'id':'doc-a','blocks':[{'kind':'knowledge','rows':[{'id':'row-a','sourceRef':{k:refs[0][k] for k in ['sourceId','version','sha256']}}]}]}]}
    manifest={'schema':2,'project':{'id':pid,'label':'Portable toy','external':False},'revision':2,'json':encoded(metadata).decode(),'sha256':sha(encoded(metadata)),'sourceRefs':[refs[0]],'operationId':'initial-sync-source','requestHash':'b'*64,'parentRequestHash':None,'parentManifestHash':None,'checkpointRequired':False}
    revision='2-'+uid(population,70)+'.json';files[prefix+'/revisions/'+revision]=encoded(manifest);files[prefix+'/current.json']=encoded({'schema':2,'file':revision,'revision':2,'sha256':sha(files[prefix+'/revisions/'+revision])})
    files['Recovery/'+pid+'/'+point+'.json']=encoded({'schema':1,'id':point,'kind':'saved','createdAt':'2026-10-17T00:00:00Z','snapshot':manifest})
    f={'files':files,'observed':obs,'context':context,'projectId':pid,'sourceId':sid,'oldPointId':point,'v1':refs[0],'v7':refs[-1],'prefix':prefix,'source':source,'versionFiles':version_files,'revision':revision}
    refresh(f);return f
def edit_json(f,name,action):
    value=json.loads(f['files'][name]);action(value);f['files'][name]=encoded(value);refresh(f)
def bad_link(f):edit_json(f,f['source']+'/versions/'+f['versionFiles'][-1],lambda v:v['parent'].update(sha256='0'*64));edit_json(f,f['source']+'/current.json',lambda v:v['head'].update(sha256=sha(f['files'][f['source']+'/versions/'+f['versionFiles'][-1]])))
def duplicate_point(f):
    name='Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json';v=json.loads(f['files'][name]);v['id']=uid(99,3);f['files']['Recovery/'+f['projectId']+'/'+v['id']+'.json']=encoded(v);refresh(f)
def edit_last(f,action):
    name=f['source']+'/versions/'+f['versionFiles'][-1];edit_json(f,name,action)
    edit_json(f,f['source']+'/current.json',lambda v:v['head'].update(sha256=sha(f['files'][name])))
def old_source_head(f):
    name=f['versionFiles'][-2];edit_json(f,f['source']+'/current.json',lambda v:v.update(head={'file':name,'sha256':sha(f['files'][f['source']+'/versions/'+name])}))
def project_ref_changed(f):
    name=f['prefix']+'/revisions/'+f['revision'];edit_json(f,name,lambda v:v['sourceRefs'][0].update(version=7))
    edit_json(f,f['prefix']+'/current.json',lambda v:v.update(sha256=sha(f['files'][name])))
def ambiguous_project(f):
    f['files']['Projects/'+uid(99,1)+'/current.json']=f['files'][f['prefix']+'/current.json'];refresh(f)
def duplicate_v7(f):
    f['files'][f['source']+'/versions/v-7-'+uid(99,17)+'.json']=f['files'][f['source']+'/versions/'+f['versionFiles'][-1]];refresh(f)
def duplicate_json(f):
    f['files'][f['prefix']+'/current.json']=b'{"schema":1,"schema":2}';refresh(f)
def bool_commit_schema(f):
    current=json.loads(f['files'][f['source']+'/current.json']);name=f['source']+'/commits/'+current['commitHead']['file'];edit_json(f,name,lambda v:v.update(schema=True))
    edit_json(f,f['source']+'/current.json',lambda v:v['commitHead'].update(sha256=sha(f['files'][name])))
class Controls(unittest.TestCase):pass
def attach(name,mutate=None,expected=None,population=1):
    def control(self):
        f=fixture(population)
        if mutate:mutate(f)
        row={'name':name,'expectedError':expected,'input':{'files':{name:base64.b64encode(b).decode() for name,b in f['files'].items()},'observed':copy.deepcopy(f['observed']),'context':copy.deepcopy(f['context'])}}
        try:
            if not callable(derive):raise ValueError('ROUTE_DERIVATION_CAPABILITY_MISSING')
            row['value']=derive(f['files'],f['observed'],f['context'])
        except BaseException as error:row['error']={'type':type(error).__name__,'message':str(error)}
        ACTUAL.append(row)
        if expected:self.assertEqual(row.get('error',{}).get('message'),expected)
        else:
            self.assertNotIn('error',row);v=row['value'];self.assertEqual(v['projectId'],f['projectId']);self.assertEqual(v['sourceId'],f['sourceId']);self.assertEqual(v['oldPointId'],f['oldPointId']);self.assertEqual(v['v1'],f['v1']);self.assertEqual(v['v7'],f['v7']);self.assertEqual(v['versionsReplayed'],7);self.assertFalse(v['physicalAdmissionEstablished']);self.assertFalse(v['restoreExecuted'])
    setattr(Controls,'test_'+name,control)
attach('exact_dynamic_route')
attach('second_id_population',population=2)
attach('raw_closure_unavailable',lambda f:f['observed']['closure']['beforePids'].update(querySucceeded=False),'COMPLETE_EMPTY_JOB_PIDS_REQUIRED')
attach('adverse_producer',lambda f:f['observed']['result'].update(status='ADVERSE'),'PRODUCER_RESULT_REQUIRED')
attach('changed_captured_bytes',lambda f:f['files'].update({f['prefix']+'/current.json':b'{}'}),'ROUTE_CAPTURE_BYTES_REQUIRED')
attach('extra_captured_file',lambda f:f['files'].update({'Recovery/extra.json':b'{}'}),'ROUTE_CAPTURE_BYTES_REQUIRED')
attach('missing_captured_file',lambda f:f['files'].pop(f['source']+'/current.json'),'ROUTE_CAPTURE_BYTES_REQUIRED')
attach('changed_current_revision_hash',lambda f:edit_json(f,f['prefix']+'/current.json',lambda v:v.update(sha256='0'*64)),'PROJECT_REVISION_BINDING_REQUIRED')
attach('missing_original_point',lambda f:(f['files'].pop('Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json'),refresh(f)),'ORIGINAL_SAVED_POINT_REQUIRED')
attach('ambiguous_original_point',duplicate_point,'ORIGINAL_SAVED_POINT_REQUIRED')
attach('changed_source_head_binding',lambda f:edit_json(f,f['source']+'/current.json',lambda v:v['head'].update(sha256='0'*64)),'SOURCE_HEAD_BINDING_REQUIRED')
attach('broken_required_v7_journal_even_with_good_blob',bad_link,'SOURCE_CHAIN_REQUIRED')
attach('rounded_temporal_observation',lambda f:f['observed'].update(assignedAtNs=10.0),'TEMPORAL_READBACK_REQUIRED')
attach('ambiguous_project_selection',ambiguous_project,'UNIQUE_PROJECT_REQUIRED')
attach('wrong_project_v1_reference',project_ref_changed,'PROJECT_V1_REFERENCE_REQUIRED')
attach('old_source_head_is_not_v7',old_source_head,'SOURCE_V7_HEAD_REQUIRED')
attach('duplicate_v7_authority',duplicate_v7,'SOURCE_CHAIN_REQUIRED')
attach('utf16_edit_splits_surrogate',lambda f:edit_last(f,lambda v:v['edit'].update(start=2,end=2)),'SOURCE_REPLAY_REQUIRED')
attach('changed_v7_reference_metadata',lambda f:edit_last(f,lambda v:v['ref'].update(utf8Bytes=v['ref']['utf8Bytes']+1)),'SOURCE_REFERENCE_METADATA_REQUIRED')
attach('changed_commit_head_hash',lambda f:edit_json(f,f['source']+'/current.json',lambda v:v['commitHead'].update(sha256='0'*64)),'SOURCE_COMMIT_CHAIN_REQUIRED')
attach('duplicate_json_fields_refused',duplicate_json,'ROUTE_JSON_REQUIRED')
attach('bool_source_schema_refused',lambda f:edit_json(f,f['source']+'/current.json',lambda v:v.update(schema=True)),'SOURCE_HEAD_BINDING_REQUIRED')
attach('bool_point_schema_refused',lambda f:edit_json(f,'Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json',lambda v:v.update(schema=True)),'ORIGINAL_SAVED_POINT_REQUIRED')
attach('bool_version_schema_refused',lambda f:edit_last(f,lambda v:v.update(schema=True)),'SOURCE_CHAIN_REQUIRED')
attach('bool_commit_schema_refused',bool_commit_schema,'SOURCE_COMMIT_CHAIN_REQUIRED')

def metadata_change(f,change):
    point_path='Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json';manifest_path=f['prefix']+'/revisions/'+f['revision'];manifest=json.loads(f['files'][manifest_path]);metadata=json.loads(manifest['json']);metadata=change(metadata,f);manifest['json']=encoded(metadata).decode();manifest['sha256']=sha(encoded(metadata));f['files'][manifest_path]=encoded(manifest)
    pointer_path=f['prefix']+'/current.json';pointer=json.loads(f['files'][pointer_path]);pointer['sha256']=sha(f['files'][manifest_path]);f['files'][pointer_path]=encoded(pointer)
    point=json.loads(f['files'][point_path]);point['snapshot']=copy.deepcopy(manifest);f['files'][point_path]=encoded(point);refresh(f)
def docs_v7(metadata,f):
    metadata['workpapers'][0]['blocks'][0]['rows'][0]['sourceRef']={k:f['v7'][k] for k in ['sourceId','version','sha256']};return metadata
def point_bool(f):edit_json(f,'Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json',lambda p:p['snapshot']['sourceRefs'][0].update(version=True))
def point_key_order(f):edit_json(f,'Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json',lambda p:p.update(snapshot=dict(reversed(list(p['snapshot'].items())))))
def retain_metadata(metadata,f):metadata['extra']={'note':'keep full metadata','number':1};return metadata
attach('docs_v7_while_manifest_v1',lambda f:metadata_change(f,docs_v7),'PROJECT_DOCS_V1_REQUIRED')
attach('missing_docs_metadata',lambda f:metadata_change(f,lambda m,f:{}),'PROJECT_DOCS_V1_REQUIRED')
attach('point_nested_version_boolean',point_bool,'ORIGINAL_SAVED_POINT_REQUIRED')
attach('point_object_key_order_preserved',point_key_order)
attach('additional_valid_metadata_preserved',lambda f:metadata_change(f,retain_metadata))

def manifest_v1_bom_integer(f):
    manifest_path=f['prefix']+'/revisions/'+f['revision'];manifest=json.loads(f['files'][manifest_path]);manifest['sourceRefs'][0]['bom']=0;f['files'][manifest_path]=encoded(manifest)
    pointer_path=f['prefix']+'/current.json';pointer=json.loads(f['files'][pointer_path]);pointer['sha256']=sha(f['files'][manifest_path]);f['files'][pointer_path]=encoded(pointer)
    point_path='Recovery/'+f['projectId']+'/'+f['oldPointId']+'.json';point=json.loads(f['files'][point_path]);point['snapshot']=copy.deepcopy(manifest);f['files'][point_path]=encoded(point);refresh(f)
attach('manifest_v1_bom_integer_zero',manifest_v1_bom_integer,'PROJECT_V1_REFERENCE_REQUIRED')

if __name__=='__main__':
    target=Path(sys.argv[1]);sys.argv=sys.argv[:1];result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Controls))
    value={'scope':'PURE_SYNTHETIC_BYTE_MAP_ONLY','tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'cases':ACTUAL}
    with target.open('x',encoding='utf-8') as f:json.dump(value,f,indent=2)
    raise SystemExit(0 if result.wasSuccessful() else 1)
